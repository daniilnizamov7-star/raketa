<?php
// afisha-api.php — афиша месяца, которую редактируют из админки (вкладка «Афиша»).
//   GET  — отдаёт текущую афишу (публично, это то же, что видно на сайте).
//   POST — сохраняет новую афишу. Нужен пароль редактирования: на сервере хранится только его хеш (AFISHA_PASS_HASH в config.php).
// Афиша лежит в базе данных (таблица raketa_afisha, хранится 30 последних версий), файлы сайта не меняются.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, array('https://raketa-park.ru', 'https://www.raketa-park.ru', 'https://admin.raketa-park.ru'), true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function af_reply($status, array $body) {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) af_reply(503, array('ok' => false, 'error' => 'service_not_configured'));
require $configFile;
try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
    $pdo->exec('CREATE TABLE IF NOT EXISTS raketa_afisha (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
} catch (Throwable $e) {
    error_log('afisha-api DB: ' . $e->getMessage());
    af_reply(500, array('ok' => false, 'error' => 'db_error'));
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $row = $pdo->query('SELECT data, created_at FROM raketa_afisha ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    if (!$row) af_reply(200, array('ok' => true, 'afisha' => null));
    af_reply(200, array('ok' => true, 'afisha' => json_decode($row['data'], true), 'updatedAt' => $row['created_at']));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') af_reply(405, array('ok' => false, 'error' => 'method_not_allowed'));

// Защита от подбора пароля: не больше 8 неверных попыток за 10 минут с одного адреса.
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
$rlFile = rtrim(sys_get_temp_dir(), '/\\') . '/raketa_af_' . md5($ip) . '.json';
$now = time();
$fails = array();
if (is_readable($rlFile)) {
    $old = json_decode((string)@file_get_contents($rlFile), true);
    if (is_array($old)) $fails = array_values(array_filter($old, function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
}
if (count($fails) >= 8) af_reply(429, array('ok' => false, 'error' => 'too_many_attempts'));

$raw = file_get_contents('php://input', false, null, 0, 3 * 1024 * 1024);
$in = json_decode((string)$raw, true);
if (!is_array($in)) af_reply(400, array('ok' => false, 'error' => 'invalid_json'));

$pass = isset($in['password']) && is_string($in['password']) ? trim($in['password']) : '';
if (!defined('AFISHA_PASS_HASH') || AFISHA_PASS_HASH === '' || $pass === '' || !password_verify($pass, AFISHA_PASS_HASH)) {
    $fails[] = $now;
    @file_put_contents($rlFile, json_encode($fails), LOCK_EX);
    af_reply(403, array('ok' => false, 'error' => 'wrong_password'));
}
if (!empty($in['check'])) af_reply(200, array('ok' => true, 'checked' => true)); // только проверка пароля

$a = isset($in['afisha']) && is_array($in['afisha']) ? $in['afisha'] : null;
if (!$a) af_reply(400, array('ok' => false, 'error' => 'afisha_required'));

// Проверяем и собираем афишу заново: в базу попадает только то, что нужно сайту.
$str = function ($v, $max) { return mb_substr(trim(is_string($v) ? $v : ''), 0, $max); };
$clean = array(
    'month' => $str(isset($a['month']) ? $a['month'] : '', 30),
    'year' => (int)(isset($a['year']) ? $a['year'] : 0),
    'validUntil' => $str(isset($a['validUntil']) ? $a['validUntil'] : '', 10),
    'poster' => '',
    'posterAlt' => $str(isset($a['posterAlt']) ? $a['posterAlt'] : '', 200),
    'link' => $str(isset($a['link']) ? $a['link'] : '', 300),
    'events' => array(),
);
if ($clean['month'] === '' || $clean['year'] < 2020 || $clean['year'] > 2100) af_reply(422, array('ok' => false, 'error' => 'bad_month'));
if ($clean['validUntil'] !== '' && !preg_match('/^20\d\d-\d{2}-\d{2}$/', $clean['validUntil'])) af_reply(422, array('ok' => false, 'error' => 'bad_valid_until'));
if ($clean['link'] !== '' && !preg_match('#^https://#i', $clean['link'])) af_reply(422, array('ok' => false, 'error' => 'bad_link'));
$poster = isset($a['poster']) && is_string($a['poster']) ? trim($a['poster']) : '';
if ($poster !== '') {
    $okData = preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $poster) && strlen($poster) <= 2400000;
    $okUrl = preg_match('#^https://[^\s"<>]{3,500}$#', $poster);
    if (!$okData && !$okUrl) af_reply(422, array('ok' => false, 'error' => 'bad_poster'));
    $clean['poster'] = $poster;
}
if (isset($a['bands']) && is_array($a['bands'])) {
    $n = function ($v, $d) { return is_numeric($v) ? round(max(0, min(100, (float)$v)), 2) : $d; };
    $clean['bands'] = array('top' => $n(isset($a['bands']['top']) ? $a['bands']['top'] : null, 26.5), 'bottom' => $n(isset($a['bands']['bottom']) ? $a['bands']['bottom'] : null, 89.5), 'gap' => $n(isset($a['bands']['gap']) ? $a['bands']['gap'] : null, 0.4));
}
$events = isset($a['events']) && is_array($a['events']) ? $a['events'] : array();
if (count($events) > 40) af_reply(422, array('ok' => false, 'error' => 'too_many_events'));
foreach ($events as $ev) {
    if (!is_array($ev)) continue;
    $day = $str(isset($ev['day']) ? $ev['day'] : '', 2);
    if (!preg_match('/^\d{1,2}$/', $day)) continue;
    $items = array();
    foreach ((isset($ev['items']) && is_array($ev['items']) ? $ev['items'] : array()) as $it) {
        if (!is_array($it)) continue;
        $title = $str(isset($it['title']) ? $it['title'] : '', 200);
        if ($title === '') continue;
        $item = array('time' => $str(isset($it['time']) ? $it['time'] : '', 30), 'title' => $title);
        $text = $str(isset($it['text']) ? $it['text'] : '', 500);
        if ($text !== '') $item['text'] = $text;
        $items[] = $item;
        if (count($items) >= 10) break;
    }
    if (!$items) continue;
    $clean['events'][] = array('day' => str_pad($day, 2, '0', STR_PAD_LEFT), 'weekday' => $str(isset($ev['weekday']) ? $ev['weekday'] : '', 3), 'items' => $items);
}

try {
    $pdo->prepare('INSERT INTO raketa_afisha (data) VALUES (:d)')->execute(array(':d' => json_encode($clean, JSON_UNESCAPED_UNICODE)));
    $pdo->exec('DELETE FROM raketa_afisha WHERE id <= (SELECT m FROM (SELECT MAX(id) - 30 AS m FROM raketa_afisha) t)');
} catch (Throwable $e) {
    error_log('afisha-api save: ' . $e->getMessage());
    af_reply(500, array('ok' => false, 'error' => 'db_error'));
}
af_reply(200, array('ok' => true, 'events' => count($clean['events'])));
