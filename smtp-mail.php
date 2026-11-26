<?php
// Отправка писем через SMTP (когда на сервере нет почтовой программы). Только функции, ничего не выводит.
// Нужны константы из config.php: SMTP_USER, SMTP_PASS (SMTP_HOST и SMTP_PORT необязательны).
function bd_smtp_send($toCsv, $subject, $body) {
    if (!defined('SMTP_USER') || !defined('SMTP_PASS') || SMTP_USER === '' || SMTP_PASS === '') return false;
    $user = SMTP_USER;
    $domain = strtolower(substr(strrchr($user, '@'), 1));
    $hosts = array('gmail.com' => 'smtp.gmail.com', 'mail.ru' => 'smtp.mail.ru', 'inbox.ru' => 'smtp.mail.ru',
        'list.ru' => 'smtp.mail.ru', 'bk.ru' => 'smtp.mail.ru', 'yandex.ru' => 'smtp.yandex.ru', 'ya.ru' => 'smtp.yandex.ru');
    $host = defined('SMTP_HOST') && SMTP_HOST !== '' ? SMTP_HOST : (isset($hosts[$domain]) ? $hosts[$domain] : 'smtp.' . $domain);
    $port = defined('SMTP_PORT') ? (int)SMTP_PORT : 465;
    $rcpt = array();
    foreach (explode(',', $toCsv) as $r) { $r = trim($r); if ($r !== '') $rcpt[] = $r; }
    if (!$rcpt) return false;
    $fp = @stream_socket_client('ssl://' . $host . ':' . $port, $en, $es, 10);
    if (!$fp) { error_log("smtp: connect $host:$port failed: $es"); return false; }
    stream_set_timeout($fp, 15);
    $read = function () use ($fp) {
        $out = '';
        while (($line = fgets($fp, 1024)) !== false) { $out .= $line; if (strlen($line) < 4 || $line[3] === ' ') break; }
        return $out;
    };
    $cmd = function ($c, $ok) use ($fp, $read) {
        if ($c !== null) fwrite($fp, $c . "\r\n");
        $resp = $read();
        return strncmp($resp, $ok, strlen($ok)) === 0 ? true : $resp;
    };
    $steps = array(
        array(null, '220'),
        array('EHLO raketa-park.ru', '250'),
        array('AUTH LOGIN', '334'),
        array(base64_encode($user), '334'),
        array(base64_encode(SMTP_PASS), '235'),
        array('MAIL FROM:<' . $user . '>', '250'),
    );
    foreach ($rcpt as $r) $steps[] = array('RCPT TO:<' . $r . '>', '250');
    $steps[] = array('DATA', '354');
    foreach ($steps as $s) {
        $res = $cmd($s[0], $s[1]);
        if ($res !== true) { error_log('smtp: ' . ($s[0] === null ? 'banner' : substr($s[0], 0, 20)) . ' -> ' . trim(is_string($res) ? $res : '')); fclose($fp); return false; }
    }
    $msg = "From: =?UTF-8?B?" . base64_encode('Ракета') . "?= <$user>\r\n"
        . 'To: ' . implode(', ', $rcpt) . "\r\n"
        . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
        . 'Date: ' . date('r') . "\r\n"
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($body));
    fwrite($fp, $msg . "\r\n.\r\n");
    $res = $read();
    fwrite($fp, "QUIT\r\n");
    fclose($fp);
    if (strncmp($res, '250', 3) !== 0) { error_log('smtp: data -> ' . trim($res)); return false; }
    return true;
}
