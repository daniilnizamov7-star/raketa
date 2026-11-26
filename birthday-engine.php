<?php
// birthday-engine.php — расчёт сметы дня рождения.
// Это PHP-версия расчёта из party-engine.js: сервер сам пересчитывает заявку по каталогу
// (birthday-catalog.json), а не верит сумме из браузера. Если меняете логику в party-engine.js,
// меняйте и здесь.

function bd_is_int($v) {
    return is_int($v) || (is_float($v) && is_finite($v) && floor($v) == $v);
}

function bd_cents($value) {
    if ((is_int($value) || is_float($value)) && is_finite((float)$value) && $value >= 0) {
        return (int) round($value * 100);
    }
    return null;
}

function bd_money($value) {
    $rounded = round($value * 100) / 100;
    $isInt = floor($rounded) == $rounded;
    return number_format($rounded, $isInt ? 0 : 2, ',', "\u{00A0}") . "\u{00A0}₽";
}

function bd_find_by_id(array $list, $id) {
    foreach ($list as $row) {
        if (is_array($row) && isset($row['id']) && $row['id'] === $id && (!isset($row['active']) || $row['active'] !== false)) {
            return $row;
        }
    }
    return null;
}

function bd_estimate(array $plan, array $catalog) {
    $errors = array();
    $lines = array();
    $unknownLines = array();
    $subtotal = 0;
    $menuCents = 0;
    $unknownMenu = false;

    $add = function ($label, $value, $kind) use (&$lines, &$unknownLines, &$subtotal) {
        $lines[] = array('label' => $label, 'amount' => $value === null ? null : $value / 100, 'kind' => $kind);
        if ($value === null) {
            $unknownLines[] = $label;
        } else {
            $subtotal += $value;
        }
    };
    $err = function ($code, $message) use (&$errors) {
        $errors[] = array('code' => $code, 'message' => $message);
    };

    $tickets = $catalog['tickets'];
    $validChildren = isset($plan['children']) && bd_is_int($plan['children']) && $plan['children'] >= 1 && $plan['children'] <= 30;
    $validAdults = isset($plan['adults']) && bd_is_int($plan['adults']) && $plan['adults'] >= 0 && $plan['adults'] <= 60;
    $children = $validChildren ? (int)$plan['children'] : 0;
    $adults = $validAdults ? (int)$plan['adults'] : 0;
    if (!$validChildren) $err('invalid_guests', 'Укажите от 1 до 30 детей.');
    if (!$validAdults) $err('invalid_guests', 'Укажите от 0 до 60 взрослых.');

    // Тариф по дню недели: вторник, выходные или будни.
    $tariff = null;
    $date = isset($plan['date']) && is_string($plan['date']) ? $plan['date'] : '';
    if (preg_match('/^20\d\d-\d{2}-\d{2}$/', $date)) {
        $parts = array_map('intval', explode('-', $date));
        if (checkdate($parts[1], $parts[2], $parts[0])) {
            $dow = (int) gmdate('w', gmmktime(12, 0, 0, $parts[1], $parts[2], $parts[0]));
            $tariff = $dow === 2 ? 'tuesday' : (($dow === 0 || $dow === 6) ? 'weekend' : 'weekday');
        }
    }

    $freeFrom = !empty($tickets['birthdayChildFreeFromChildren']) ? $tickets['birthdayChildFreeFromChildren'] : 7;
    $birthdayEligible = !empty($plan['birthdayChildIncluded']) && $children >= $freeFrom;
    $bcf = array_key_exists('birthdayChildFree', $tickets) ? $tickets['birthdayChildFree'] : null;
    $paidChildren = ($birthdayEligible && $bcf === null) ? null : $children - (($birthdayEligible && $bcf === true) ? 1 : 0);
    $rate = $tariff ? bd_cents(isset($tickets[$tariff]) ? $tickets[$tariff] : null) : null;
    $add(
        $paidChildren === null
            ? 'Детские билеты: условия именинника уточнит менеджер'
            : 'Детские билеты: ' . $paidChildren . ($rate === null ? '' : ' × ' . bd_money($rate / 100)),
        ($paidChildren === null || $rate === null) ? null : $paidChildren * $rate,
        'tickets'
    );
    if ($adults > 0) {
        $adultsFree = !empty($tickets['adultsFree']);
        $add('Взрослые: ' . $adults . ($adultsFree ? ' — бесплатно' : ''), $adultsFree ? 0 : null, 'adults');
    }

    // Меню.
    $chosen = array();
    $seen = array();
    $items = isset($plan['items']) && is_array($plan['items']) ? $plan['items'] : array();
    foreach ($items as $selected) {
        $sid = is_array($selected) && isset($selected['id']) ? $selected['id'] : null;
        $q = is_array($selected) && array_key_exists('quantity', $selected) ? $selected['quantity'] : null;
        $item = is_string($sid) ? bd_find_by_id($catalog['menu'], $sid) : null;
        if (!$item || isset($seen[$sid])) {
            $err('invalid_plan', 'Проверьте выбранные блюда.');
            continue;
        }
        $seen[$sid] = true;
        $min = !empty($item['minQuantity']) ? $item['minQuantity'] : 1;
        $step = !empty($item['step']) ? $item['step'] : 1;
        if (!bd_is_int($q) || $q < $min || $q > 99 || (($q - $min) % $step) !== 0) {
            $err('item_quantity_rule', $item['name'] . ': минимальное количество ' . $min . ', шаг ' . $step . '.');
            continue;
        }
        $q = (int)$q;
        $price = bd_cents(isset($item['price']) ? $item['price'] : null);
        if ($price === null) $unknownMenu = true; else $menuCents += $price * $q;
        $chosen[] = array('item' => $item, 'quantity' => $q, 'price' => $price);
    }

    // Зал.
    $roomRule = $catalog['roomRule'];
    $roomId = isset($plan['roomId']) && is_string($plan['roomId']) ? $plan['roomId'] : '';
    $room = $roomId !== '' ? bd_find_by_id($catalog['rooms'], $roomId) : null;
    if ($roomId !== '' && !$room) $err('invalid_plan', 'Выберите действующий зал.');
    if ($room && $children < $roomRule['minChildren']) {
        $err('room_min_children', 'Банкетная комната доступна от ' . $roomRule['minChildren'] . ' детей.');
    }
    if ($room && $children + $adults > $room['capacity']) {
        $err('room_capacity_exceeded', 'Зал «' . $room['name'] . '» вмещает до ' . $room['capacity'] . ' гостей вместе с детьми и взрослыми.');
    }
    $roomFree = !empty($roomRule['confirmed']) && $children >= $roomRule['minChildren'] && (empty($roomRule['requiresFood']) || count($chosen) > 0);
    if ($children < $roomRule['minChildren']) {
        $add('Банкетная комната доступна от ' . $roomRule['minChildren'] . ' детей', 0, 'room');
    } else {
        $add(($room ? 'Зал «' . $room['name'] . '»' : 'Зал подберёт менеджер') . ($roomFree ? ' — ' . $roomRule['durationHours'] . ' часа в подарок' : ' — требуется предзаказ меню'), $roomFree ? 0 : null, 'room');
    }

    // Анимация.
    $seenPrograms = array();
    $animIds = isset($plan['animationIds']) && is_array($plan['animationIds']) ? $plan['animationIds'] : array();
    foreach ($animIds as $id) {
        $item = is_string($id) ? bd_find_by_id($catalog['animations'], $id) : null;
        if (!$item || isset($seenPrograms[$id])) {
            $err('invalid_plan', 'Проверьте выбранные программы.');
            continue;
        }
        $seenPrograms[$id] = true;
        $add($item['name'], bd_cents(isset($item['price']) ? $item['price'] : null), 'animation');
        if (!empty($item['participantLimit']) && $children > $item['participantLimit']) {
            $add('«' . $item['name'] . '»: участие ' . $children . ' детей уточнит менеджер', null, 'animation');
        } elseif (!empty($item['includedParticipants']) && $children > $item['includedParticipants']) {
            $extra = $children - $item['includedParticipants'];
            $p = bd_cents(isset($item['extraParticipantPrice']) ? $item['extraParticipantPrice'] : null);
            $add('«' . $item['name'] . '»: ещё ' . $extra . ' участников', $p === null ? null : $p * $extra, 'animation');
        }
    }
    $animationConsult = !empty($plan['animationConsult']);
    $menuConsult = !empty($plan['menuConsult']);
    if (!count($seenPrograms) && !$animationConsult) $add('Без анимации', 0, 'animation');
    if ($animationConsult) $add('Анимацию подберёт менеджер', null, 'animation');
    foreach ($chosen as $c) {
        $add(($c['item']['menu'] === 'banquet' ? 'Банкетное' : 'Основное') . ' меню: ' . $c['item']['name'] . ' — ' . $c['quantity'] . ' ' . $c['item']['unit'], $c['price'] === null ? null : $c['price'] * $c['quantity'], 'menu');
    }
    if ($menuConsult) $add('Меню подберёт менеджер', null, 'menu');

    $percent = $catalog['serviceChargePercent'];
    $service = (int) round($menuCents * $percent / 100);
    $add('Банкетное обслуживание ' . $percent . '%', $service, 'service');
    if ($percent > 0 && ($unknownMenu || $menuConsult)) {
        $add('Обслуживание ' . $percent . '% дополнительного меню уточнит менеджер', null, 'service');
    }

    return array(
        'currency' => 'RUB',
        'knownSubtotal' => $subtotal / 100,
        'total' => count($unknownLines) ? null : $subtotal / 100,
        'unknownLines' => $unknownLines,
        'lines' => $lines,
        'errors' => $errors,
        'paidChildren' => $paidChildren,
        'roomFree' => $roomFree,
        'menuSubtotal' => $menuCents / 100,
        'serviceCharge' => $service / 100,
        'serviceChargePercent' => $percent,
        'tariff' => $tariff,
    );
}

// Текст заявки для менеджера (Telegram, письмо, поле «комментарий» в базе).
function bd_plan_text(array $plan, array $estimate) {
    $date = isset($plan['date']) ? $plan['date'] : '';
    $niceDate = preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m) ? $m[3] . '.' . $m[2] . '.' . $m[1] : $date;
    $time = !empty($plan['time']) ? ' · ' . $plan['time'] : '';
    $out = array(
        'День рождения в «Ракете»',
        'Дата: ' . $niceDate . $time,
        'Детей: ' . (int)$plan['children'] . (!empty($plan['birthdayChildIncluded']) ? ' (включая именинника)' : '') . '; взрослых: ' . (int)$plan['adults'],
        '',
    );
    foreach ($estimate['lines'] as $line) {
        $out[] = $line['label'] . ' — ' . ($line['amount'] === null ? 'уточнит менеджер' : bd_money($line['amount']));
    }
    $out[] = '';
    $out[] = ($estimate['total'] === null ? 'Сумма известных позиций' : 'Предварительный итог') . ': ' . bd_money($estimate['knownSubtotal']);
    if (!empty($plan['notes'])) $out[] = 'Пожелания: ' . $plan['notes'];
    return implode("\n", $out);
}
