'use strict';
(() => {
  const catalog=window.RAKETA_PARTY_CATALOG,engine=window.RaketaPartyEngine,form=document.querySelector('#party-form');
  if(!form||!catalog||!engine)return;
  const $=selector=>form.querySelector(selector),money=engine.money;
  const fields={date:$('#party-date'),time:$('#party-time'),children:$('#party-children'),adults:$('#party-adults'),birthday:$('#party-birthday'),room:$('#party-room'),animationConsult:$('#party-animation-consult'),menuConsult:$('#party-menu-consult')};
  const sourceMenu=new Map(catalog.menu.filter(i=>i.active!==false).map(i=>[i.id,i]));
  const sourcePrograms=new Map(catalog.animations.filter(i=>i.active!==false).map(i=>[i.id,i]));
  const storageKey='raketa-party-v1';
  let state={schemaVersion:1,date:'',time:'',children:8,adults:4,birthdayChildIncluded:true,roomId:'',animationIds:[],animationConsult:false,menuConsult:false,items:[],notes:''};
  try{
    const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');
    if(saved&&saved.schemaVersion===1){
      state={...state,date:typeof saved.date==='string'?saved.date:'',time:typeof saved.time==='string'?saved.time:'',children:Number.isInteger(saved.children)&&saved.children>=1&&saved.children<=30?saved.children:8,adults:Number.isInteger(saved.adults)&&saved.adults>=0&&saved.adults<=60?saved.adults:4,birthdayChildIncluded:saved.birthdayChildIncluded!==false,roomId:catalog.rooms.some(r=>r.id===saved.roomId)?saved.roomId:'',animationIds:Array.isArray(saved.animationIds)?[...new Set(saved.animationIds)].filter(id=>sourcePrograms.has(id)).slice(0,20):[],animationConsult:saved.animationConsult===true,menuConsult:saved.menuConsult===true,items:Array.isArray(saved.items)?saved.items.filter(i=>i&&sourceMenu.has(i.id)&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=99).filter((i,n,a)=>a.findIndex(j=>j.id===i.id)===n).slice(0,100):[]};
    }
  }catch{ /* Draft storage is optional; personal details are never stored. */ }
  let menuType='main',menuCategory='',query='',visibleCount=12,busy=false;
  function node(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function announce(text){$('#party-status').textContent=text;}
  function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify({...state,notes:''}));}catch{}}
  function syncFields(){fields.date.value=state.date;fields.time.value=state.time;fields.children.value=state.children;fields.adults.value=state.adults;fields.birthday.checked=state.birthdayChildIncluded;fields.room.value=state.roomId;fields.animationConsult.checked=state.animationConsult;fields.menuConsult.checked=state.menuConsult;}
  const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  fields.date.min=`${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  fields.time.min='10:00';fields.time.max='22:00';
  if(state.date&&state.date<fields.date.min)state.date='';
  for(const room of catalog.rooms){const option=node('option','',`${room.name} · до ${room.capacity} гостей`);option.value=room.id;fields.room.append(option);}
  function readFields(){state.date=fields.date.value;state.time=fields.time.value;state.children=fields.children.value===''?NaN:Number(fields.children.value);state.adults=fields.adults.value===''?NaN:Number(fields.adults.value);state.birthdayChildIncluded=fields.birthday.checked;state.roomId=fields.room.value;state.animationConsult=fields.animationConsult.checked;state.menuConsult=fields.menuConsult.checked;}
  function quantity(id){return state.items.find(i=>i.id===id)?.quantity||0;}
  function changeQuantity(id,next){
    const item=sourceMenu.get(id);if(!item||busy)return;
    const min=item.minQuantity||1,step=item.step||1;
    let value=Number.isFinite(next)?Math.round(next):0;
    if(value<=0)value=0;
    else {value=Math.min(99,Math.max(min,value));value=min+Math.floor((value-min)/step)*step;}
    if(value&&quantity(id)===0&&state.items.length>=100){announce('В одной заявке можно выбрать до 100 разных позиций.');return;}
    const activeElement=document.activeElement,cartControl=activeElement?.closest('#party-cart')?['partyPlus','partyMinus','partyQuantityInput'].find(key=>activeElement.dataset[key]===id):null;
    const index=state.items.findIndex(i=>i.id===id);
    if(index>=0){if(value)state.items[index]={id,quantity:value};else state.items.splice(index,1);}else if(value)state.items.push({id,quantity:value});
    renderSummary();updateQuantityControls();persist();
    if(cartControl){const attribute=cartControl==='partyPlus'?'data-party-plus':cartControl==='partyMinus'?'data-party-minus':'data-party-quantity-input';$(`#party-cart [${attribute}="${id}"]`)?.focus({preventScroll:true});}
  }
  function quantityControl(item){
    const control=node('div','party-quantity');control.dataset.partyQuantity=item.id;
    const minus=node('button','','−');minus.type='button';minus.dataset.partyMinus=item.id;minus.setAttribute('aria-label',`Уменьшить количество: ${item.name}`);
    const input=node('input');input.type='number';input.min='0';input.max='99';input.step=String(item.step||1);input.inputMode='numeric';input.value=quantity(item.id);input.dataset.partyQuantityInput=item.id;input.setAttribute('aria-label',`Количество: ${item.name}`);
    const plus=node('button','','+');plus.type='button';plus.dataset.partyPlus=item.id;plus.setAttribute('aria-label',`Добавить: ${item.name}`);
    control.append(minus,input,plus);return control;
  }
  function updateQuantityControls(){
    form.querySelectorAll('[data-party-quantity]').forEach(control=>{const value=quantity(control.dataset.partyQuantity);control.querySelector('input').value=value;control.querySelector('[data-party-minus]').disabled=value===0;control.querySelector('[data-party-plus]').disabled=value>=99;control.closest('.party-item')?.classList.toggle('is-selected',value>0);});
  }
  function renderCategories(){
    const select=$('#party-menu-category');select.replaceChildren();const all=node('option','','Все категории');all.value='';select.append(all);
    for(const category of [...new Set([...sourceMenu.values()].filter(i=>i.menu===menuType).map(i=>i.category))]){const option=node('option','',category);option.value=category;select.append(option);}
    select.value=menuCategory;
  }
  function renderMenu(){
    const list=$('#party-menu-list');list.replaceChildren();
    const items=[...sourceMenu.values()].filter(item=>item.menu===menuType&&(!menuCategory||item.category===menuCategory)&&(!query||`${item.name} ${item.description} ${item.category}`.toLocaleLowerCase('ru').includes(query)));
    for(const item of items.slice(0,visibleCount)){
      const card=node('article','party-item');card.dataset.partyItem=item.id;card.classList.toggle('is-selected',quantity(item.id)>0);
      const heading=node('div','party-item-heading'),icon=window.RaketaFoodIcons?.create(item);
      if(icon)heading.append(icon);
      heading.append(node('h4','',item.name));card.append(heading);
      const detail=[item.description,`Единица заказа: ${item.unit}`,item.minQuantity>1?`Минимум ${item.minQuantity} шт.`:''].filter(Boolean).join(' · ');
      card.append(node('p','party-item-meta',detail),node('p','party-item-price',item.price===null?'Уточнит менеджер':money(item.price)),quantityControl(item));list.append(card);
    }
    if(!items.length)list.append(node('p','party-empty','По этому запросу ничего не нашли. Попробуйте другую категорию или название.'));
    $('#party-more').hidden=items.length<=visibleCount;
    $('#party-more').textContent=`Показать ещё · осталось ${Math.max(0,items.length-visibleCount)}`;
    updateQuantityControls();
  }
  function renderPrograms(){
    const container=$('#party-programs');container.replaceChildren();const category=$('#party-program-category').value;
    for(const program of sourcePrograms.values()){
      if(program.category!==category)continue;
      const card=node('article','party-program-card');card.classList.toggle('is-selected',state.animationIds.includes(program.id));
      const label=node('label'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=state.animationIds.includes(program.id);checkbox.dataset.partyProgram=program.id;
      label.append(checkbox,node('span','',program.name));
      card.append(label,node('p','party-item-meta',[program.duration,program.includedParticipants?`База на ${program.includedParticipants} детей`:program.participantLimit?`До ${program.participantLimit} детей`:''].filter(Boolean).join(' · ')),node('p','party-item-price',program.price===null?'Уточнит менеджер':money(program.price)));
      const estimate=engine.estimate({...state,animationIds:[program.id],animationConsult:false,items:[],menuConsult:false},catalog),extra=estimate.lines.filter(l=>l.kind==='animation').slice(1);
      if(extra.length)card.append(node('p','party-program-extra',extra.map(l=>`${l.label}: ${l.amount===null?'уточним':money(l.amount)}`).join('; ')));
      if(program.description){const details=node('details'),summary=node('summary','','Подробнее');details.append(summary,node('p','',program.description));card.append(details);}
      container.append(card);
    }
    if(!container.children.length)container.append(node('p','party-empty','Поможем подобрать программу по возрасту и интересам детей.'));
  }
  function cartLine(name,description,price,item){
    const row=node('div','party-cart-line'),copy=node('div'),heading=node('div','party-cart-name'),icon=item&&window.RaketaFoodIcons?.create(item);
    if(icon){heading.classList.add('has-food-icon');icon.classList.add('party-cart-icon');heading.append(icon,node('span','',name));}else heading.textContent=name;
    copy.append(heading);if(description)copy.append(node('div','party-cart-meta',description));row.append(copy,node('strong','',price));return row;
  }
  function renderSummary(){
    const estimate=engine.estimate(state,catalog),cart=$('#party-cart');cart.replaceChildren();
    for(const id of state.animationIds){const p=sourcePrograms.get(id);if(!p)continue;const row=cartLine(p.name,p.category,p.price===null?'Уточним':money(p.price));const remove=node('button','party-cart-remove','×');remove.type='button';remove.dataset.partyRemoveProgram=id;remove.setAttribute('aria-label',`Убрать программу: ${p.name}`);row.append(remove);cart.append(row);}
    for(const selected of state.items){const item=sourceMenu.get(selected.id);if(!item)continue;const row=cartLine(item.name,`${selected.quantity} ${item.unit} × ${item.price===null?'уточним':money(item.price)}`,item.price===null?'Уточним':money(item.price*selected.quantity),item);const remove=node('button','party-cart-remove','×');remove.type='button';remove.dataset.partyRemove=item.id;remove.setAttribute('aria-label',`Убрать блюдо: ${item.name}`);row.append(remove,quantityControl(item));cart.append(row);}
    if(!cart.children.length)cart.append(node('p','party-empty','Добавьте программы и угощения — здесь будет состав вашего праздника.'));
    $('#party-clear').disabled=!state.items.length&&!state.animationIds.length;
    const breakdown=$('#party-breakdown');breakdown.replaceChildren();
    const groups=[['Банкетные билеты','tickets'],['Взрослые','adults'],['Комната на 3 часа','room'],['Программы и участники','animation'],['Меню и напитки','menu'],[`Обслуживание ${catalog.serviceChargePercent}%`,'service']];
    for(const [label,kind] of groups){const rows=estimate.lines.filter(l=>l.kind===kind);if(!rows.length)continue;const known=rows.reduce((s,l)=>s+(l.amount||0),0),unknown=rows.some(l=>l.amount===null);const row=node('div','party-cost-line');row.append(node('span','',label),node('strong','',unknown?(known?`${money(known)} + уточнение`:'Уточним'):money(known)));breakdown.append(row);}
    $('#party-known-total').value=money(estimate.knownSubtotal);$('#party-known-total').textContent=money(estimate.knownSubtotal);
    $('#party-total-label').textContent=estimate.total===null?'Сумма известных позиций':'Предварительный итог';
    const unknown=$('#party-unknown');unknown.replaceChildren();unknown.hidden=!estimate.unknownLines.length;
    if(estimate.unknownLines.length){unknown.append(node('p','','Полный итог уточним после согласования:'));const ul=node('ul');for(const label of estimate.unknownLines)ul.append(node('li','',label));unknown.append(ul);}
    const errors=$('#party-errors');errors.replaceChildren();errors.hidden=!estimate.errors.length;
    if(estimate.errors.length){const ul=node('ul');for(const error of estimate.errors)ul.append(node('li','',error));errors.append(ul);}
    fields.room.disabled=state.children<catalog.roomRule.minChildren;
    const tariffNames={tuesday:'вторник',weekday:'будний день',weekend:'выходной день'};
    $('#party-date-help').textContent=estimate.tariff?`Банкетный тариф: ${tariffNames[estimate.tariff]}, ${money(catalog.tickets[estimate.tariff])} за платный детский билет. Скидки и акции на банкетные билеты не действуют. Дату, время и свободный зал подтвердит менеджер.`:`Банкетные билеты: будни ${money(catalog.tickets.weekday)}, вторник ${money(catalog.tickets.tuesday)}, выходные ${money(catalog.tickets.weekend)}. Скидки и акции не действуют.`;
    const paid=estimate.paidChildren;
    $('#party-guests-help').textContent=`Взрослые бесплатно. ${state.birthdayChildIncluded&&state.children>=7?'Именинник бесплатно; платных детских билетов — '+paid+'.':'Именинник проходит бесплатно в компании от 7 детей.'}`;
    $('#party-room-help').textContent=state.children<7?'Банкетная комната доступна от 7 детей. Для меньшей компании можно оставить заявку на посещение парка.':estimate.roomFree?'Комната на 3 часа в подарок: в компании от 7 детей с предзаказом меню. Зал и время подтвердит менеджер.':'Комната доступна от 7 детей на 3 часа при предзаказе меню. Выберите блюда или обсудите предзаказ с менеджером.';
    const barTotal=document.querySelector('#party-mobile-amount');if(barTotal)barTotal.textContent=`${money(estimate.knownSubtotal)}${estimate.total===null?' + уточнение':''}`;
    updateQuantityControls();return estimate;
  }
  function updateBasics(){readFields();if(state.children<7&&state.roomId){state.roomId='';fields.room.value='';announce('Для компании меньше 7 детей банкетный зал недоступен; выбор зала снят.');}renderPrograms();renderSummary();persist();}
  Object.values(fields).forEach(field=>field.addEventListener(['number','date','time'].includes(field.type)?'input':'change',updateBasics));
  $('#party-program-category').addEventListener('change',renderPrograms);
  $('#party-menu-search').addEventListener('input',event=>{query=event.target.value.trim().toLocaleLowerCase('ru');visibleCount=12;renderMenu();});
  $('#party-menu-category').addEventListener('change',event=>{menuCategory=event.target.value;visibleCount=12;renderMenu();});
  $('#party-more').addEventListener('click',()=>{visibleCount+=12;renderMenu();});
  function switchMenu(type){menuType=type;menuCategory='';visibleCount=12;form.querySelectorAll('[data-party-menu]').forEach(button=>{const selected=button.dataset.partyMenu===type;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});$('#party-menu-list').setAttribute('aria-labelledby',`party-menu-tab-${type}`);renderCategories();renderMenu();}
  $('#party-menu-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-party-menu]');if(button)switchMenu(button.dataset.partyMenu);});
  $('#party-menu-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const type=event.key==='Home'?'main':event.key==='End'?'banquet':menuType==='main'?'banquet':'main';switchMenu(type);$(`#party-menu-tab-${type}`).focus();});
  form.addEventListener('change',event=>{
    const program=event.target.closest('[data-party-program]');if(program){const id=program.dataset.partyProgram;if(program.checked){if(state.animationIds.length>=20){program.checked=false;announce('В заявке можно выбрать до 20 программ.');return;}state.animationIds.push(id);}else state.animationIds=state.animationIds.filter(i=>i!==id);program.closest('.party-program-card').classList.toggle('is-selected',program.checked);renderSummary();persist();}
    const input=event.target.closest('[data-party-quantity-input]');if(input){const item=sourceMenu.get(input.dataset.partyQuantityInput),raw=Number(input.value);if(raw>0&&raw<(item.minQuantity||1))announce(`${item.name}: минимальный заказ ${item.minQuantity} шт. Количество скорректировано.`);changeQuantity(item.id,raw);}
  });
  form.addEventListener('click',event=>{
    const plus=event.target.closest('[data-party-plus]'),minus=event.target.closest('[data-party-minus]'),remove=event.target.closest('[data-party-remove]'),removeProgram=event.target.closest('[data-party-remove-program]');
    if(plus){const item=sourceMenu.get(plus.dataset.partyPlus),q=quantity(item.id);changeQuantity(item.id,q?q+(item.step||1):item.minQuantity||1);}
    if(minus){const item=sourceMenu.get(minus.dataset.partyMinus),q=quantity(item.id);changeQuantity(item.id,q<=(item.minQuantity||1)?0:q-(item.step||1));}
    if(remove)changeQuantity(remove.dataset.partyRemove,0);
    if(removeProgram){state.animationIds=state.animationIds.filter(id=>id!==removeProgram.dataset.partyRemoveProgram);renderPrograms();renderSummary();persist();}
  });
  $('#party-clear').addEventListener('click',()=>{state.items=[];state.animationIds=[];state.animationConsult=false;state.menuConsult=false;syncFields();renderPrograms();renderMenu();renderSummary();persist();announce('Выбранные программы и блюда удалены. Дата и состав гостей сохранены.');});
  function planText(estimate){
    const lines=[`День рождения в «Ракете»`,`Дата: ${state.date}${state.time?' · '+state.time:''}`,`Детей: ${state.children}${state.birthdayChildIncluded?' (включая именинника)':''}; взрослых: ${state.adults}`,''];
    for(const line of estimate.lines)lines.push(`${line.label} — ${line.amount===null?'уточнит менеджер':money(line.amount)}`);
    lines.push('',`${estimate.total===null?'Сумма известных позиций':'Предварительный итог'}: ${money(estimate.knownSubtotal)}`);if(state.notes)lines.push(`Пожелания: ${state.notes}`);return lines.join('\n');
  }
  const preview=location.protocol==='file:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname);$('#party-preview-note').hidden=!preview;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;readFields();state.notes=$('#party-notes').value.trim();const estimate=renderSummary();
    if(estimate.errors.length){$('#party-errors').scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(!state.date||state.date<fields.date.min){announce('Выберите дату праздника не раньше сегодняшнего дня.');fields.date.focus();return;}
    const name=$('#party-name').value.trim(),phone=$('#party-phone').value.trim(),digits=phone.replace(/\D/g,'');
    if(!name){$('#party-name').focus();return;}if(!/^[+0-9()\s-]+$/.test(phone)||digits.length<10||digits.length>15){announce('Проверьте телефон: укажите номер с кодом города или страны.');$('#party-phone').focus();return;}
    const payload={name,phone,event_date:state.date,comment:'',plan:JSON.parse(JSON.stringify(state))};
    if(preview){
      announce('План праздника готов. Это локальная проверка: заявка менеджеру не отправлена.');
      let details=$('#party-demo-result');if(!details){details=node('details','party-demo-result');details.id='party-demo-result';details.append(node('summary','','Посмотреть состав заявки'),node('pre'));$('#party-preview-note').after(details);}details.querySelector('pre').textContent=`Имя: ${name}\nТелефон: ${phone}\n\n${planText(estimate)}`;details.open=true;return;
    }
    busy=true;const button=$('#party-submit');button.disabled=true;button.textContent='Отправляем план…';announce('');
    try{
      const response=await fetch('birthday.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){
        if(result.error==='notification_unavailable'&&result.saved){announce(`План сохранён под номером ${result.requestId}, но уведомление менеджеру пока не подтверждено. Позвоните: +7 (351) 216-36-26 и назовите этот номер.`);return;}
        const messages={room_capacity_exceeded:'Выбранный зал не вмещает всех гостей. Измените зал или количество гостей.',room_min_children:'Банкетная комната доступна от 7 детей.',past_date:'Эта дата уже прошла. Выберите новую дату.',item_quantity_rule:'Проверьте минимальное количество выбранных блюд.',catalog_unavailable:'Каталог временно недоступен. Позвоните в парк: +7 (351) 216-36-26.',service_not_configured:'Форма пока не подключена к приёму заявок. Позвоните в парк: +7 (351) 216-36-26.'};throw new Error(messages[result.error]||'Не удалось подтвердить отправку. Ваш выбор сохранён; попробуйте позже или позвоните: +7 (351) 216-36-26.');
      }
      const total=result.estimate?.total;announce(`Заявка № ${result.requestId} принята. Банкетный менеджер свяжется с вами, чтобы согласовать дату, зал и детали.${Number.isFinite(total)?` Предварительный итог: ${money(total)}.`:''}`);
    }catch(error){announce(error.message||'Отправка не подтверждена. Позвоните: +7 (351) 216-36-26.');}
    finally{busy=false;button.disabled=false;button.replaceChildren(document.createTextNode('Отправить заявку '),node('span','','↗'));}
  });
  window.RaketaPartyCalculator={selectRoom(id){if(state.children<7){announce('Комната доступна для компании от 7 детей. Сначала уточните состав гостей.');return false;}if(!catalog.rooms.some(r=>r.id===id))return false;state.roomId=id;syncFields();renderSummary();persist();return true;}};
  const summary=$('.party-summary');summary.id='party-summary';
  const mobileBar=node('div','party-mobile-bar');mobileBar.hidden=true;const amount=node('strong');amount.id='party-mobile-amount';const jump=node('a','','Ваш план ↓');jump.href='#party-summary';mobileBar.append(amount,jump);document.body.append(mobileBar);
  let barFrame=false;function updateMobileBar(){barFrame=false;const r=document.querySelector('#calculator').getBoundingClientRect(),s=summary.getBoundingClientRect(),show=innerWidth<=980&&r.top<innerHeight*.8&&r.bottom>200&&s.top>innerHeight*.8;mobileBar.hidden=!show;document.body.classList.toggle('party-builder-active',show);}
  addEventListener('scroll',()=>{if(!barFrame){barFrame=true;requestAnimationFrame(updateMobileBar);}},{passive:true});addEventListener('resize',updateMobileBar);
  syncFields();renderCategories();renderPrograms();renderMenu();renderSummary();updateMobileBar();
})();
