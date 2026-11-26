(function(){
  'use strict';
  const images=window.RAKETA_FOOD_IMAGES;
  if(!images)return;
  function create(item){
    const illustration=images[item.id];
    if(!illustration)return null;
    const tile=document.createElement('span'),picture=document.createElement('span');
    tile.className='food-icon';
    tile.setAttribute('aria-hidden','true');
    tile.dataset.foodType=item.id;
    picture.className='food-art';
    const columns=illustration.columns,rows=illustration.rows,crop=illustration.crop,inset=(1-crop)/2;
    const column=illustration.index%columns,row=Math.floor(illustration.index/columns);
    picture.style.backgroundImage='url("'+window.RAKETA_INLINE_ASSETS['assets/food/'+illustration.file]+'")';
    picture.style.backgroundSize=`${columns*100/crop}% ${rows*100/crop}%`;
    picture.style.backgroundPosition=`${columns===1?50:(column+inset)/(columns-crop)*100}% ${rows===1?50:(row+inset)/(rows-crop)*100}%`;
    tile.append(picture);return tile;
  }
  window.RaketaFoodIcons=Object.freeze({create,typeFor:item=>item.id,types:Object.freeze(Object.keys(images))});
}());
