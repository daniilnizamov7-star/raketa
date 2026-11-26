'use strict';
(() => {
  const guide = document.querySelector('.site-guide');
  if (!guide) return;
  const toggle = guide.querySelector('.guide-toggle');
  const panel = guide.querySelector('.guide-panel');
  const text = guide.querySelector('#guide-text');
  const action = guide.querySelector('.guide-action');
  const tips = {
    main: ['Привет! Я енот-проводник «Ракеты». Помогу найти программу, выбрать зал и спланировать приключение.', 'Посмотреть афишу', '#afisha'],
    afisha: ['Здесь живёт афиша месяца. Нажмите «Посмотреть афишу», чтобы открыть программу. У прошедших событий есть отметка «Архивная программа».', 'Открыть программу', '#afisha'],
    park: ['Готовы исследовать парк? После знакомства с игровыми зонами можно выбрать удобный день для визита.', 'Посмотреть цены', '#prices'],
    prices: ['Билет действует весь день. Взрослые и малыши до года проходят бесплатно. Льготы собраны под карточками билетов.', 'Спланировать визит', '#booking'],
    rooms: ['У каждого праздника своя планета! Нажмите на зал, посмотрите фотографии и выберите понравившийся — я перенесу его в заявку.', 'Обсудить праздник', '#booking'],
    menu: ['После приключений — время подкрепиться. Меню для праздника поможет подобрать команда парка.', 'Обсудить меню', '#booking'],
    reviews: ['А теперь можно запланировать своё приключение. Расскажите, какой праздник хотите устроить.', 'Перейти к заявке', '#booking'],
    booking: ['Оставьте имя, телефон и пожелания. Команда парка поможет выбрать зал и программу. Если удобнее — можно сразу позвонить.', 'Позвонить в парк', 'tel:+73512163626'],
    calculator: ['Соберём праздник вместе! Выберите билеты, программы и блюда. От 7 детей именинник бесплатно, а обслуживание меню 6% показано отдельной строкой.', 'Перейти к контактам', '#party-contacts'],
    contacts: ['Наш космодром — ТРК «Таганай», ул. Труда, 181. Поднимайтесь на второй этаж, слева от Hoff. Ждём каждый день с 10:00 до 22:00!', 'Построить маршрут', 'https://yandex.ru/maps/?text=Челябинск%20Труда%20181%20ТРК%20Таганай']
  };
  let active = '';
  let frame = false;
  let onSectionChange = () => {};
  const sections = [...document.querySelectorAll('main section[id]')];
  function refresh() {
    frame = false;
    const line = innerHeight * .45;
    let id = 'main';
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > 0 && tips[section.id]) id = section.id;
    }
    if (id === active) return;
    const previous = active;
    active = id;
    const tip = tips[id];
    text.textContent = tip[0];
    action.replaceChildren(document.createTextNode(tip[1]));
    const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true'); action.append(arrow);
    action.href = tip[2];
    if (previous) onSectionChange();
  }
  function close(returnFocus = false) {
    panel.hidden = true; toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label','Открыть подсказки енота');
    if (returnFocus) toggle.focus({preventScroll:true});
  }
  toggle.addEventListener('click', () => {
    const open = panel.hidden; panel.hidden = !open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Свернуть подсказки енота':'Открыть подсказки енота');
    if (open) refresh();
  });
  guide.querySelector('.guide-close').addEventListener('click', () => close(true));
  document.addEventListener('keydown',event => { if(event.key==='Escape' && !panel.hidden) close(true); });
  document.addEventListener('click',event => { if(!guide.contains(event.target)) close(); });
  guide.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
    if (link === action && active === 'afisha') { event.preventDefault(); document.querySelector('.afisha-open').click(); }
    close();
  }));
  document.addEventListener('focusin',event => { if(event.target.matches('input,textarea,select')) { guide.classList.add('form-focused'); close(); } });
  document.addEventListener('focusout',() => { requestAnimationFrame(() => guide.classList.toggle('form-focused',document.activeElement.matches('input,textarea,select'))); });
  addEventListener('scroll',() => { if(!frame) { frame=true; requestAnimationFrame(refresh); } },{passive:true});
  addEventListener('resize',refresh);
  refresh();

  // A decorative flight accompanies section navigation without blocking it.
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let flight = null;
  let lastClickFlight = 0;
  let lastFlightStart = -Infinity;
  let sectionFlightTimer;
  let autoFlights = 0;
  const FLIGHT_COOLDOWN = 60000; // пауза между полётами от нажатий на меню, мс
  function stopFlight() {
    if (!flight) return;
    const current = flight;
    flight = null;
    current.animation.cancel();
    current.layer.remove();
    guide.classList.remove('guide-flying');
  }
  function fly(manual = false) {
    clearTimeout(sectionFlightTimer);
    if ((!manual && reducedMotion.matches) || document.hidden || document.body.classList.contains('modal-open') || guide.classList.contains('form-focused')) return;
    stopFlight();
    lastFlightStart = performance.now();
    const dock = toggle.getBoundingClientRect();
    const width = innerWidth <= 600 ? 145 : 230;
    const height = width * 2 / 3;
    const destination = {x:dock.left + dock.width / 2, y:dock.top + dock.height / 2 - 8};
    const layer = document.createElement('div');
    layer.className = 'raccoon-flight-layer'; layer.setAttribute('aria-hidden','true');
    if (manual) layer.classList.add('manual-flight');
    const ship = document.createElement('div'); ship.className = 'raccoon-flight';
    ship.style.width = `${width}px`; ship.style.height = `${height}px`;
    const trail = document.createElement('span'); trail.className = 'raccoon-flight-trail';
    const image = document.createElement('img'); image.src = toggle.querySelector('img').src; image.alt = '';
    ship.append(trail,image); layer.append(ship); document.body.append(layer);
    const points = [
      {x:-width/2, y:innerHeight*.55},
      {x:innerWidth*.25, y:innerHeight*.08},
      {x:innerWidth*.76, y:innerHeight*.18},
      destination
    ];
    const frames = Array.from({length:41}, (_,i) => {
      const t=i/40, u=1-t;
      const x=u*u*u*points[0].x+3*u*u*t*points[1].x+3*u*t*t*points[2].x+t*t*t*points[3].x;
      const y=u*u*u*points[0].y+3*u*u*t*points[1].y+3*u*t*t*points[2].y+t*t*t*points[3].y;
      const scale=1-.52*t*t;
      return {offset:t,transform:`translate3d(${x-width/2}px,${y-height/2}px,0) rotate(${-15+35*t}deg) scale(${scale})`,opacity:t>.9?(1-t)*10:1};
    });
    guide.classList.add('guide-flying');
    const animation = ship.animate(frames,{duration:4600,easing:'linear',fill:'forwards'});
    flight = {layer,animation};
    animation.finished.then(() => {
      if (flight?.animation !== animation) return;
      layer.remove(); flight=null; guide.classList.remove('guide-flying');
    }).catch(() => {});
  }
  function isSectionLink(link) {
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return false;
    const url = new URL(link.href,location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return false;
    if (!url.hash) return link.getAttribute('href') === '#';
    try { return Boolean(document.getElementById(decodeURIComponent(url.hash.slice(1)))); } catch { return false; }
  }
  document.addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!isSectionLink(event.target.closest('a'))) return;
    lastClickFlight=performance.now();
    if (performance.now()-lastFlightStart>FLIGHT_COOLDOWN) fly();
  });
  onSectionChange = () => {
    clearTimeout(sectionFlightTimer);
    sectionFlightTimer = setTimeout(() => {
      // Само по себе при прокрутке ракета вылетает редко: не чаще раза в минуту и не больше двух раз за визит.
      /* автоматический вылет при прокрутке отключён */
    },250);
  };
  // Один приветственный вылет при открытии сайта (раз за визит).
  let greeted = false;
  try { greeted = sessionStorage.getItem('raketa-greeted') === '1'; } catch (e) {}
  if (!greeted) {
    setTimeout(() => {
      try { sessionStorage.setItem('raketa-greeted','1'); } catch (e) {}
      fly();
    }, 1800);
  }
  const flyButton = guide.querySelector('.guide-fly');
  flyButton?.addEventListener('click',() => { close(true); fly(true); });
  // A user-requested replay remains available even with reduced motion enabled.

  addEventListener('resize',stopFlight);
  addEventListener('pagehide',stopFlight);
  document.addEventListener('visibilitychange',() => { if(document.hidden) stopFlight(); });
  reducedMotion.addEventListener('change',() => { if(reducedMotion.matches) stopFlight(); });
  new MutationObserver(() => {
    if(document.body.classList.contains('modal-open') || guide.classList.contains('form-focused')) stopFlight();
  }).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});
})();
