'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const menuButton = $('.menu-toggle');
const nav = $('#navigation');
function closeMenu() { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Открыть меню'); }
menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню'); });
nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });

const heroVideo = $('#hero-video');
const videoButton = $('.video-toggle');
function updateVideoButton() { videoButton.textContent = heroVideo.paused ? '▶' : 'Ⅱ'; videoButton.setAttribute('aria-label', heroVideo.paused ? 'Воспроизвести видео' : 'Приостановить видео'); }
heroVideo.addEventListener('play', updateVideoButton); heroVideo.addEventListener('pause', updateVideoButton);
videoButton.addEventListener('click', () => { if (heroVideo.paused) heroVideo.play().catch(updateVideoButton); else heroVideo.pause(); });
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { heroVideo.autoplay = false; heroVideo.pause(); }
updateVideoButton();

const rooms = {
  saturn: {name: 'Сатурн', info: 'До 25 гостей · Зелёный зал с космической росписью.'},
  venus: {name: 'Венера', info: 'До 30 гостей · Яркий розовый зал со стеклянной перегородкой.'},
  jupiter: {name: 'Юпитер', info: 'До 30 гостей · Солнечный жёлтый зал с детской зоной.'},
  neptun: {name: 'Нептун', info: 'До 30 гостей · Бирюзовый зал со стеклянной стеной.'}
};
const dialog = $('.room-dialog');
let activeRoom = 'saturn';
let activePhoto = 1;
let dialogTrigger;
function renderPhoto() { $('#gallery-image').src = window.RAKETA_INLINE_ASSETS[`assets/rooms/${activeRoom}-${activePhoto}.jpg`]; $('#gallery-image').alt = `Зал ${rooms[activeRoom].name}, фото ${activePhoto + 1} из 5`; $('.gallery-count').textContent = `${activePhoto + 1} / 5`; }
document.querySelectorAll('[data-room]').forEach(button => button.addEventListener('click', () => { activeRoom = button.dataset.room; activePhoto = 1; dialogTrigger = button; $('#room-title').textContent = rooms[activeRoom].name; $('#room-info').textContent = rooms[activeRoom].info; renderPhoto(); dialog.showModal(); document.body.classList.add('modal-open'); }));
function changePhoto(direction) { activePhoto = (activePhoto + direction + 5) % 5; renderPhoto(); }
$('.gallery-prev').addEventListener('click', () => changePhoto(-1));
$('.gallery-next').addEventListener('click', () => changePhoto(1));
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); dialogTrigger?.focus({preventScroll: true}); });
dialog.addEventListener('keydown', event => { if (event.key === 'ArrowRight') { event.preventDefault(); changePhoto(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); changePhoto(-1); } });

const form = $('#booking-form');
document.querySelectorAll('[data-event]').forEach(link => link.addEventListener('click', () => { form.elements.event_type.value = link.dataset.event; }));
$('.room-book').addEventListener('click', () => { form.elements.event_type.value = 'День рождения ребёнка'; const previous = form.elements.comment.value.replace(/^Выбран зал «[^»]+»\.\s*/, ''); form.elements.comment.value = `Выбран зал «${rooms[activeRoom].name}». ${previous}`; dialog.close(); const destination = window.RaketaPartyCalculator ? '#calculator' : '#booking'; if (window.RaketaPartyCalculator) window.RaketaPartyCalculator.selectRoom(activeRoom); $(destination).scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); });
const today = new Date();
form.elements.event_date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const preview = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
$('.preview-note').hidden = !preview;
form.addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('.form-status');
  if (preview) { status.textContent = 'Всё готово к старту! В этой пробной версии заявка не отправлена. На сервере сайта форма использует ваш обработчик бронирования.'; return; }
  const button = $('.submit');
  if (button.disabled) return;
  const values = Object.fromEntries(new FormData(form));
  if (!values.name.trim() || !values.phone.trim()) { status.textContent = 'Укажите имя и телефон.'; return; }
  button.disabled = true; button.textContent = 'Отправляем…'; status.textContent = '';
  try {
    const response = await fetch('/booking.php', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error('booking_failed');
    status.textContent = 'Заявка отправлена! Менеджер свяжется с вами и поможет подготовить праздник.';
    form.reset();
  } catch { status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или позвоните: +7 (351) 216-36-26.'; }
  finally { button.disabled = false; button.innerHTML = 'Поехали! Отправить заявку <span>↗</span>'; }
});

// Existing announcement integration; disabled in local design previews.
if (!preview) {
(function(){
  const SB_ANN = 'https://yiqipulgofoschkccaxr.supabase.co';
  const SK_ANN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpcWlwdWxnb2Zvc2Noa2NjYXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjExMjksImV4cCI6MjA4OTg5NzEyOX0.Op4iBjGSOBcKh4pkVSd75_l8Fle3Cz15nBh9KF21YhI';
  const ANN_KEY = 'raketa_ann_seen';

  async function checkAnn() {
    const seen = localStorage.getItem(ANN_KEY);
    try {
      const r = await fetch(SB_ANN+'/rest/v1/raketa_announcements?active=eq.true&order=created_at.desc&limit=1', {
        headers:{'apikey':SK_ANN,'Authorization':'Bearer '+SK_ANN}
      });
      const rows = await r.json();
      if (!rows || !rows.length) return;
      const a = rows[0];
      if (seen === a.id) return;
      const n = new Date();
      const localNow = n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')+'T'+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
      if (a.show_from && a.show_from > localNow) return;
      if (a.show_until && a.show_until < localNow) return;
      document.getElementById('annTitle').textContent = a.title;
      document.getElementById('annText').textContent = a.text;
      if (a.image_url) {
        const img = document.getElementById('annImg');
        img.src = a.image_url; img.style.display = 'block';
      }
      if (a.button_text && a.button_url) {
        const cta = document.getElementById('annCta');
        cta.textContent = a.button_text;
        cta.href = a.button_url;
        cta.style.display = 'block';
      }
      setTimeout(() => { document.getElementById('annModal').hidden = false; document.getElementById('annModal').classList.add('show'); document.querySelector('.ann-close').focus(); }, 800);
      window._annId = a.id;
    } catch(e) {}
  }

  window.closeAnnModal = function() {
    document.getElementById('annModal').classList.remove('show'); document.getElementById('annModal').hidden = true;
    if (window._annId) localStorage.setItem(ANN_KEY, window._annId);
  };

  checkAnn();
})();
}
