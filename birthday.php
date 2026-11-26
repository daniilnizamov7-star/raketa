<?php
// birthday.php — принимает заявку из калькулятора дня рождения.
// Что делает: проверяет данные, САМ пересчитывает смету по birthday-catalog.json,
// сохраняет заявку в ту же таблицу raketa_bookings, что и обычная форма (booking.php),
// и отправляет менеджеру подробный состав в Telegram и на почту.
// Секреты (БД, токен бота, почта) берутся из config.php и в браузер не попадают.

date_default_timezone_set('Asia/Yekaterinburg'); // время парка (Челябинск) в уведомлениях
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function bd_reply($status, array $body) {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
function bd_fail($error, $status = 400, array $extra = array()) {
    bd_reply($status, array_merge(array('ok' => false, 'error' => $error), $extra));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    bd_fail('method_not_allowed', 405);
}

// Настройки: тот же config.php, что у booking.php.
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) bd_fail('service_not_configured', 503);
require $configFile;
foreach (array('DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS') as $c) {
    if (!defined($c)) bd_fail('service_not_configured', 503);
}
require __DIR__ . '/birthday-engine.php';

// Каталог (цены, залы, программы, меню).
$catalogFile = __DIR__ . '/birthday-catalog.json';
$catalog = is_file($catalogFile) ? json_decode(file_get_contents($catalogFile), true) : null;
if (!is_array($catalog) || !isset($catalog['tickets'], $catalog['roomRule'], $catalog['rooms'], $catalog['animations'], $catalog['menu'])
    || (isset($catalog['status']) && $catalog['status'] !== 'active')) {
    bd_fail('catalog_unavailable', 503);
}

// Защита от потока заявок: не больше 6 за 10 минут с одного адреса (если нет доступа к временной папке — пропускаем).
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
$rlFile = rtrim(sys_get_temp_dir(), '/\\') . '/raketa_bd_' . md5($ip) . '.json';
$now = time();
$hits = array();
if (is_readable($rlFile)) {
    $old = json_decode((string)@file_get_contents($rlFile), true);
    if (is_array($old)) $hits = array_values(array_filter($old, function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
}
if (count($hits) >= 6) bd_fail('too_many_requests', 429);
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

// Разбор запроса (не больше 64 КБ).
$raw = file_get_contents('php://input', false, null, 0, 65537);
if ($raw === false || strlen($raw) > 65536) bd_fail('payload_too_large', 413);
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['plan']) || !is_array($data['plan'])) bd_fail('invalid_json');

$name = mb_substr(trim(isset($data['name']) ? (string)$data['name'] : ''), 0, 120);
$phone = mb_substr(trim(isset($data['phone']) ? (string)$data['phone'] : ''), 0, 32);
$digits = preg_replace('/\D/', '', $phone);
if ($name === '') bd_fail('name_required');
if (!preg_match('/^[+0-9()\s-]+$/', $phone) || strlen($digits) < 10 || strlen($digits) > 15) bd_fail('invalid_phone');

$plan = $data['plan'];
$plan['notes'] = mb_substr(trim(isset($plan['notes']) && is_string($plan['notes']) ? $plan['notes'] : ''), 0, 1000);
$plan['time'] = isset($plan['time']) && is_string($plan['time']) && preg_match('/^\d{2}:\d{2}$/', $plan['time']) ? $plan['time'] : '';
if (!isset($plan['items']) || !is_array($plan['items']) || count($plan['items']) > 120) $plan['items'] = array();
if (!isset($plan['animationIds']) || !is_array($plan['animationIds']) || count($plan['animationIds']) > 40) $plan['animationIds'] = array();

// Дата: формат верный и не в прошлом (по времени парка, с запасом в сутки на разницу часовых поясов).
$date = isset($plan['date']) && is_string($plan['date']) ? $plan['date'] : '';
if (!preg_match('/^20\d\d-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))) {
    bd_fail('invalid_date');
}
$parkNow = new DateTime('now', new DateTimeZone('Asia/Yekaterinburg'));
$parkNow->modify('-1 day');
if ($date < $parkNow->format('Y-m-d')) bd_fail('past_date');

// Пересчёт сметы на сервере.
$estimate = bd_estimate($plan, $catalog);
if (count($estimate['errors'])) {
    bd_fail($estimate['errors'][0]['code'], 422, array('message' => $estimate['errors'][0]['message']));
}
$text = bd_plan_text($plan, $estimate);

// Сохранение: основная запись — в raketa_bookings (видна там же, где обычные заявки).
$requestId = null;
try {
    $dsn = defined('DB_DSN') ? DB_DSN : 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION));
    $stmt = $pdo->prepare(
        'INSERT INTO raketa_bookings (name, phone, event_type, event_date, comment, status)
         VALUES (:name, :phone, :event_type, :event_date, :comment, "new")'
    );
    $stmt->execute(array(
        ':name' => $name,
        ':phone' => $phone,
        ':event_type' => 'День рождения (калькулятор)',
        ':event_date' => $date,
        ':comment' => mb_substr($text, 0, 2000),
    ));
    $requestId = (int)$pdo->lastInsertId();
} catch (Throwable $e) {
    error_log('birthday.php DB error: ' . $e->getMessage());
    bd_fail('db_error', 500);
}

// Полный состав заявки (JSON) — отдельная таблица, создаётся сама. Если не получилось — не страшно, текст уже сохранён выше.
try {
    $pdo->exec('CREATE TABLE IF NOT EXISTS raketa_birthday_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        catalog_version VARCHAR(64) NULL,
        plan_json MEDIUMTEXT NOT NULL,
        estimate_json MEDIUMTEXT NOT NULL,
        INDEX (booking_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $ins = $pdo->prepare('INSERT INTO raketa_birthday_plans (booking_id, catalog_version, plan_json, estimate_json) VALUES (:b, :v, :p, :e)');
    $ins->execute(array(
        ':b' => $requestId,
        ':v' => isset($catalog['version']) ? (string)$catalog['version'] : null,
        ':p' => json_encode($plan, JSON_UNESCAPED_UNICODE),
        ':e' => json_encode($estimate, JSON_UNESCAPED_UNICODE),
    ));
} catch (Throwable $e) {
    error_log('birthday.php plan table: ' . $e->getMessage());
}

// Уведомления. Заявка считается принятой, если дошло хотя бы одно: Telegram или почта.
$message = "🎂 Заявка из калькулятора дня рождения № {$requestId}\n\n"
    . "👤 Имя: {$name}\n📞 Телефон: {$phone}\n\n" . $text . "\n\n⏰ " . date('d.m.Y H:i');
if (mb_strlen($message) > 3900) $message = mb_substr($message, 0, 3900) . "\n…(текст обрезан, полный состав в базе, заявка № {$requestId})";

$tgOk = false;
// TG_NO_DIRECT: с этого сервера Telegram недоступен, уведомление в Telegram отправляет GitHub Actions (notify-telegram.yml).
if (!defined('TG_NO_DIRECT') && defined('TG_BOT_TOKEN') && defined('TG_CHAT_ID')) {
    $base = defined('TG_API_BASE') ? TG_API_BASE : 'https://api.telegram.org';
    $ch = curl_init($base . '/bot' . TG_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, array(
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 6,
        CURLOPT_POSTFIELDS => json_encode(array('chat_id' => TG_CHAT_ID, 'text' => $message), JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => array('Content-Type: application/json'),
    ));
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = is_string($resp) ? json_decode($resp, true) : null;
    $tgOk = $code === 200 && is_array($j) && !empty($j['ok']);
    if (!$tgOk) error_log('birthday.php: Telegram не принял сообщение, HTTP ' . $code);
}

$mailOk = false;
if (defined('MAIL_TO')) {
    $subject = '=?UTF-8?B?' . base64_encode('🎂 Заявка из калькулятора дня рождения № ' . $requestId) . '?=';
    $headers = "From: Ракета <no-reply@raketa-park.ru>\r\n"
        . "Reply-To: no-reply@raketa-park.ru\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: 8bit";
    if (defined('SMTP_USER') && SMTP_USER !== '') {
        require_once __DIR__ . '/smtp-mail.php';
        $mailOk = bd_smtp_send(MAIL_TO, '🎂 Заявка из калькулятора дня рождения № ' . $requestId, $message);
    } else {
        $mailOk = (bool)@mail(MAIL_TO, $subject, $message, $headers);
    }
}

if (!$tgOk && !$mailOk && !defined('TG_NO_DIRECT')) {
    bd_fail('notification_unavailable', 502, array('saved' => true, 'requestId' => $requestId));
}

bd_reply(200, array(
    'ok' => true,
    'requestId' => $requestId,
    'estimate' => array(
        'currency' => $estimate['currency'],
        'total' => $estimate['total'],
        'knownSubtotal' => $estimate['knownSubtotal'],
        'lines' => $estimate['lines'],
    ),
));
