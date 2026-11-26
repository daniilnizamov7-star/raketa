<?php
// Copy to config.php on the hosting server and fill in the values locally.
define('DB_HOST', 'localhost');
define('DB_NAME', 'REPLACE_DATABASE_NAME');
define('DB_USER', 'REPLACE_DATABASE_USER');
define('DB_PASS', 'REPLACE_DATABASE_PASSWORD');

define('MAIL_TO', 'REPLACE_RECIPIENT_EMAILS');
define('SMTP_HOST', 'smtp.beget.com');
define('SMTP_PORT', 465);
define('SMTP_USER', 'no-reply@raketa-park.ru');
define('SMTP_PASS', 'REPLACE_MAILBOX_PASSWORD');

define('TG_BOT_TOKEN', 'REPLACE_TELEGRAM_BOT_TOKEN');
define('TG_CHAT_ID', 'REPLACE_TELEGRAM_CHAT_ID');
// Leave TG_NO_DIRECT undefined to enable direct delivery to Telegram.

// Paste a password_hash(..., PASSWORD_DEFAULT) result generated locally.
define('AFISHA_PASS_HASH', 'REPLACE_ADMIN_PASSWORD_HASH');
