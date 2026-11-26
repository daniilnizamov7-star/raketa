'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RaketaPartyEngine=api;})(typeof window!=='undefined'?window:this,function(){
  const cents=value=>Number.isFinite(value)&&value>=0?Math.round(value*100):null;
  const money=value=>{const rounded=Math.round(value*100)/100;return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:Number.isInteger(rounded)?0:2,maximumFractionDigits:2}).format(rounded);};
  function estimate(plan,catalog){
    const errors=[],lines=[],unknownLines=[];let subtotal=0,menuCents=0,unknownMenu=false;
    const add=(label,value,kind)=>{lines.push({label,amount:value===null?null:value/100,kind});if(value===null)unknownLines.push(label);else subtotal+=value;};
    const validChildren=Number.isInteger(plan.children)&&plan.children>=1&&plan.children<=30,validAdults=Number.isInteger(plan.adults)&&plan.adults>=0&&plan.adults<=60;
    const children=validChildren?plan.children:0,adults=validAdults?plan.adults:0;
    if(!validChildren)errors.push('Укажите от 1 до 30 детей.');
    if(!validAdults)errors.push('Укажите от 0 до 60 взрослых.');
    let tariff=null;
    if(/^20\d\d-\d{2}-\d{2}$/.test(plan.date||'')){
      const parts=plan.date.split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2],12);
      if(date.getFullYear()===parts[0]&&date.getMonth()===parts[1]-1&&date.getDate()===parts[2])tariff=date.getDay()===2?'tuesday':[0,6].includes(date.getDay())?'weekend':'weekday';
    }
    const birthdayEligible=plan.birthdayChildIncluded&&children>=(catalog.tickets.birthdayChildFreeFromChildren||7);
    const paidChildren=birthdayEligible&&catalog.tickets.birthdayChildFree===null?null:children-(birthdayEligible&&catalog.tickets.birthdayChildFree===true?1:0);
    const rate=tariff?cents(catalog.tickets[tariff]):null;
    add(paidChildren===null?'Детские билеты: условия именинника уточнит менеджер':`Детские билеты: ${paidChildren}${rate===null?'':` × ${money(rate/100)}`}`,paidChildren===null||rate===null?null:paidChildren*rate,'tickets');
    if(adults>0)add(`Взрослые: ${adults}${catalog.tickets.adultsFree?' — бесплатно':''}`,catalog.tickets.adultsFree?0:null,'adults');
    const menuMap=new Map(catalog.menu.filter(i=>i.active!==false).map(i=>[i.id,i]));
    const chosen=[],seen=new Set();
    for(const selected of plan.items||[]){
      const item=menuMap.get(selected.id),q=selected.quantity;
      if(!item||seen.has(selected.id)){errors.push('Проверьте выбранные блюда.');continue;}seen.add(selected.id);
      const min=item.minQuantity||1,step=item.step||1;
      if(!Number.isInteger(q)||q<min||q>99||(q-min)%step!==0){errors.push(`${item.name}: минимальное количество ${min}, шаг ${step}.`);continue;}
      const price=cents(item.price);if(price===null)unknownMenu=true;else menuCents+=price*q;
      chosen.push({item,quantity:q,price});
    }
    const roomRule=catalog.roomRule,room=catalog.rooms.find(r=>r.id===plan.roomId&&r.active!==false);
    if(plan.roomId&&!room)errors.push('Выберите действующий зал.');
    if(room&&children<roomRule.minChildren)errors.push(`Банкетная комната доступна от ${roomRule.minChildren} детей.`);
    if(room&&children+adults>room.capacity)errors.push(`Зал «${room.name}» вмещает до ${room.capacity} гостей вместе с детьми и взрослыми.`);
    const roomFree=roomRule.confirmed&&children>=roomRule.minChildren&&(!roomRule.requiresFood||chosen.length>0);
    if(children<roomRule.minChildren)add(`Банкетная комната доступна от ${roomRule.minChildren} детей`,0,'room');
    else add(`${room?`Зал «${room.name}»`:'Зал подберёт менеджер'}${roomFree?` — ${roomRule.durationHours} часа в подарок`:' — требуется предзаказ меню'}`,roomFree?0:null,'room');
    const animationMap=new Map(catalog.animations.filter(i=>i.active!==false).map(i=>[i.id,i])),seenPrograms=new Set();
    for(const id of plan.animationIds||[]){
      const item=animationMap.get(id);if(!item||seenPrograms.has(id)){errors.push('Проверьте выбранные программы.');continue;}seenPrograms.add(id);
      add(item.name,cents(item.price),'animation');
      if(item.participantLimit&&children>item.participantLimit)add(`«${item.name}»: участие ${children} детей уточнит менеджер`,null,'animation');
      else if(item.includedParticipants&&children>item.includedParticipants){const extra=children-item.includedParticipants,price=cents(item.extraParticipantPrice);add(`«${item.name}»: ещё ${extra} участников`,price===null?null:price*extra,'animation');}
    }
    if(!seenPrograms.size&&!plan.animationConsult)add('Без анимации',0,'animation');
    if(plan.animationConsult)add('Анимацию подберёт менеджер',null,'animation');
    for(const {item,quantity,price} of chosen)add(`${item.menu==='banquet'?'Банкетное':'Основное'} меню: ${item.name} — ${quantity} ${item.unit}`,price===null?null:price*quantity,'menu');
    if(plan.menuConsult)add('Меню подберёт менеджер',null,'menu');
    const service=Math.round(menuCents*catalog.serviceChargePercent/100);
    add(`Банкетное обслуживание ${catalog.serviceChargePercent}%`,service,'service');
    if(catalog.serviceChargePercent>0&&(unknownMenu||plan.menuConsult))add(`Обслуживание ${catalog.serviceChargePercent}% дополнительного меню уточнит менеджер`,null,'service');
    return {currency:'RUB',knownSubtotal:subtotal/100,total:unknownLines.length?null:subtotal/100,unknownLines,lines,errors,paidChildren,roomFree,menuSubtotal:menuCents/100,serviceCharge:service/100,serviceChargePercent:catalog.serviceChargePercent,tariff};
  }
  return{estimate,money};
});
