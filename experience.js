'use strict';
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...document.querySelectorAll('#navigation a')];
  function markSection() {
    let current = '';
    for (const section of sections) {
      const box=section.getBoundingClientRect();
      if (box.top <= innerHeight*.38 && box.bottom > 0) current=section.id;
    }
    for(const link of links) {
      if(link.hash===`#${current}`||(current==='calculator'&&link.hash==='#party-menu')) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
    const heroBox=document.querySelector('.hero').getBoundingClientRect();
    document.querySelector('.site-guide')?.classList.toggle('in-hero',heroBox.bottom>innerHeight*.55);
    const max=document.documentElement.scrollHeight-innerHeight;
    document.documentElement.style.setProperty('--journey-progress',max>0?String(scrollY/max):'0');
  }
  let ticking=false;
  addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{markSection();ticking=false;});}},{passive:true});
  markSection();
  const scene=document.querySelector('.space-scene');
  const hero=document.querySelector('.hero');
  if(!reduce.matches && matchMedia('(pointer:fine)').matches) {
    hero.addEventListener('pointermove',event=>{
      const r=hero.getBoundingClientRect();
      scene.style.setProperty('--drift-x',`${((event.clientX-r.left)/r.width-.5)*16}px`);
      scene.style.setProperty('--drift-y',`${((event.clientY-r.top)/r.height-.5)*10}px`);
    });
    hero.addEventListener('pointerleave',()=>{scene.style.setProperty('--drift-x','0px');scene.style.setProperty('--drift-y','0px');});
  }
  // Content remains visible when scripting or motion is unavailable.
  if(!reduce.matches && 'IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries) if(entry.isIntersecting){entry.target.classList.add('arrived');observer.unobserve(entry.target);}
    },{threshold:.08});
    document.querySelectorAll('.section-top,.adventure-grid,.room-card,.price-card,.atmosphere,.review-card,.booking-copy,.booking-form').forEach(element=>{
      if(element.getBoundingClientRect().top>innerHeight){element.classList.add('arrival');observer.observe(element);}
    });
  }
  reduce.addEventListener('change',()=>{
    if(reduce.matches){document.querySelectorAll('.arrival').forEach(e=>e.classList.add('arrived'));scene.style.setProperty('--drift-x','0px');scene.style.setProperty('--drift-y','0px');}
  });
})();
