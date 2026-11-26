'use strict';
(() => {
  // Афиша приходит с сервера (её меняют из админки); если сервер не ответил — показываем афишу из afisha-config.js.
  const staticConfig = window.RAKETA_AFISHA;
  let started = false;
  const start = config => { if (started) return; started = true; render(config); };
  const fallbackTimer = setTimeout(() => start(staticConfig), 2500);
  fetch('afisha-api.php', {cache: 'no-store', headers: {Accept: 'application/json'}})
    .then(r => r.ok ? r.json() : null)
    .then(data => { clearTimeout(fallbackTimer); start(data && data.ok && data.afisha && Array.isArray(data.afisha.events) ? data.afisha : staticConfig); })
    .catch(() => { clearTimeout(fallbackTimer); start(staticConfig); });
  function render(config) {
  const section = document.querySelector('#afisha');
  if (!config) { section.hidden = true; return; }
  const dialog = document.querySelector('#afisha-dialog');
  const period = `${config.month} ${config.year}`;
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const archived = Boolean(config.validUntil && localDate > config.validUntil);
  document.querySelectorAll('[data-afisha-period]').forEach(node => { node.textContent = period; });
  document.querySelectorAll('[data-afisha-archive]').forEach(node => { node.hidden = !archived; });
  const events = Array.isArray(config.events) ? config.events : [];
  const schedule = document.querySelector('#afisha-schedule');
  const dates = document.querySelector('.afisha-dates');
  for (const event of events) {
    const date = document.createElement('span');
    date.textContent = event.day;
    date.dataset.i = String(dates.children.length);
    date.setAttribute('role', 'button'); date.tabIndex = 0;
    date.setAttribute('aria-label', `Открыть программу ${event.day} числа`);
    dates.append(date);
    const row = document.createElement('article');
    row.className = 'afisha-event';
    const stamp = document.createElement('div');
    stamp.className = 'afisha-event-date';
    const day = document.createElement('strong'); day.textContent = event.day;
    const weekday = document.createElement('span'); weekday.textContent = event.weekday;
    stamp.append(day, weekday);
    const programs = document.createElement('div'); programs.className = 'afisha-programs';
    for (const item of event.items || []) {
      const program = document.createElement('div');
      const time = document.createElement('span'); time.className = 'afisha-time'; time.textContent = item.time;
      const title = document.createElement('h3'); title.textContent = item.title;
      program.append(time, title);
      if (item.text) { const text = document.createElement('p'); text.className = 'afisha-text'; text.textContent = item.text; program.append(text); }
      programs.append(program);
    }
    row.append(stamp, programs); schedule.append(row);
  }
  const poster = document.querySelector('#afisha-poster');
  const viewer = document.querySelector('#afisha-viewer');
  const stage = document.querySelector('#afisha-stage');
  const dayView = document.querySelector('#afisha-day');
  const chips = document.querySelector('#afisha-chips');
  const hint = document.querySelector('#afisha-hint');
  const zonesBox = document.querySelector('#afisha-zones');
  let posterReady = false, current = -1, zoneList = [];
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const bands = config.bands || {};
  const top = Math.min(95, Math.max(0, num(bands.top, 26.5)));
  const bottom = Math.min(100, Math.max(top + 5, num(bands.bottom, 89.5)));
  const gap = Math.min(3, Math.max(0, num(bands.gap, 0.4)));
  const rowH = events.length ? (bottom - top - gap * (events.length - 1)) / events.length : 0;
  function setChips() {
    chips.querySelectorAll('button').forEach(btn => btn.classList.toggle('on', Number(btn.dataset.i) === current));
  }
  function showAll() {
    current = -1; dayView.hidden = true; stage.hidden = false; hint.hidden = !zoneList.length; setChips();
  }
  function showDay(i) {
    if (!posterReady || !events[i]) { showAll(); return; }
    current = i;
    const event = events[i];
    const t = top + i * (rowH + gap);
    const strip = document.querySelector('#afisha-strip');
    strip.style.aspectRatio = `${poster.naturalWidth} / ${poster.naturalHeight * rowH / 100}`;
    strip.style.backgroundImage = `url("${poster.currentSrc || poster.src}")`;
    strip.style.backgroundSize = `100% ${100 / rowH * 100}%`;
    strip.style.backgroundPosition = `0 ${t / (100 - rowH) * 100}%`;
    strip.setAttribute('aria-label', `Афиша на ${event.day} числа`);
    const info = document.querySelector('#afisha-day-info');
    info.replaceChildren();
    const head = document.createElement('div'); head.className = 'afisha-day-head';
    const big = document.createElement('strong'); big.textContent = event.day;
    const wd = document.createElement('span'); wd.textContent = `${event.weekday || ''} · ${config.month ? String(config.month).toLowerCase() : ''}`.replace(/^ · /, '');
    head.append(big, wd); info.append(head);
    for (const item of event.items || []) {
      const row = document.createElement('div'); row.className = 'afisha-day-item';
      if (item.time) { const tm = document.createElement('span'); tm.className = 'afisha-time'; tm.textContent = item.time; row.append(tm); }
      const h = document.createElement('h3'); h.textContent = item.title; row.append(h);
      if (item.text) { const p = document.createElement('p'); p.textContent = item.text; row.append(p); }
      info.append(row);
    }
    stage.hidden = true; dayView.hidden = false; hint.hidden = true; setChips();
    document.querySelector('#afisha-dialog').scrollTo({top: 0});
  }
  function openAfisha(i) {
    if (!dialog.open) { dialog.showModal(); document.body.classList.add('modal-open'); }
    if (typeof i === 'number') showDay(i); else showAll();
  }
  if (config.poster) {
    poster.alt = config.posterAlt || `Афиша: ${period}`;
    poster.addEventListener('load', () => {
      posterReady = true;
      poster.hidden = false; schedule.hidden = true; viewer.hidden = false;
      const thumbnail = document.querySelector('#afisha-preview-image');
      thumbnail.src = poster.src; thumbnail.alt = poster.alt;
      document.querySelector('.afisha-preview').hidden = false;
      document.querySelector('.afisha-visual').classList.add('has-poster');
      const all = document.createElement('button'); all.type = 'button'; all.className = 'on'; all.dataset.i = '-1'; all.textContent = 'Вся афиша';
      all.addEventListener('click', showAll); chips.append(all);
      events.forEach((event, i) => {
        const chip = document.createElement('button'); chip.type = 'button'; chip.dataset.i = String(i);
        chip.textContent = `${event.day}${event.weekday ? ' ' + event.weekday : ''}`;
        chip.addEventListener('click', () => showDay(i)); chips.append(chip);
        const zone = document.createElement('button'); zone.type = 'button'; zone.className = 'afisha-zone';
        zone.style.top = `${top + i * (rowH + gap)}%`; zone.style.height = `${rowH}%`;
        zone.setAttribute('aria-label', `${event.day} числа: открыть программу крупно`);
        zone.addEventListener('click', () => showDay(i));
        zonesBox.append(zone); zoneList.push(zone);
      });
      hint.hidden = !zoneList.length;
    });
    poster.addEventListener('error', () => { poster.hidden = true; viewer.hidden = true; schedule.hidden = false; });
    poster.src = config.poster;
  }
  document.querySelector('#afisha-all').addEventListener('click', showAll);
  document.querySelector('#afisha-prev').addEventListener('click', () => showDay((current - 1 + events.length) % events.length));
  document.querySelector('#afisha-next').addEventListener('click', () => showDay((current + 1) % events.length));
  dates.addEventListener('click', event => { const d = event.target.closest('[data-i]'); if (d) openAfisha(Number(d.dataset.i)); });
  dates.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.dataset.i) { event.preventDefault(); openAfisha(Number(event.target.dataset.i)); } });
  if (!events.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Подробности программы уточняйте в нашем сообществе ВКонтакте.';
    schedule.append(empty);
    dates.hidden = true;
  }
  const detailLink = document.querySelector('.afisha-vk');
  try {
    const link = new URL(config.link);
    if (link.protocol === 'https:') detailLink.href = link.href;
  } catch { /* Keep the supplied community link as a fallback. */ }
  const openButton = document.querySelector('.afisha-open');
  openButton.addEventListener('click', () => openAfisha());
  document.querySelector('.afisha-preview').addEventListener('click', event => {
    // нажатие на строку с датой на превью сразу открывает эту дату крупно
    const img = document.querySelector('#afisha-preview-image').getBoundingClientRect();
    const y = img.height ? (event.clientY - img.top) / img.height * 100 : -1;
    const i = events.findIndex((_, k) => y >= top + k * (rowH + gap) && y <= top + k * (rowH + gap) + rowH);
    openAfisha(i >= 0 ? i : undefined);
  });
  document.querySelector('.afisha-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); if (posterReady) showAll(); openButton.focus({preventScroll:true}); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  }
})();
