/* Пути к файлам: часть PNG заменена на webp (меньше вес). */
(function(){
  var map={
  "assets/raccoon-guide.png": "assets/raccoon-guide.webp",
  "assets/food/main-specific-04.png": "assets/food/main-specific-04.webp",
  "assets/food/savory-atlas-v1.png": "assets/food/savory-atlas-v1.webp",
  "assets/food/main-specific-01.png": "assets/food/main-specific-01.webp",
  "assets/food/specials-atlas-v1.png": "assets/food/specials-atlas-v1.webp",
  "assets/food/main-specific-02.png": "assets/food/main-specific-02.webp",
  "assets/food/food-corrections-01.png": "assets/food/food-corrections-01.webp",
  "assets/food/main-specific-03.png": "assets/food/main-specific-03.webp",
  "assets/food/drinks-specific-01.png": "assets/food/drinks-specific-01.webp",
  "assets/food/drinks-specific-02.png": "assets/food/drinks-specific-02.webp",
  "assets/food/drinks-specific-03.png": "assets/food/drinks-specific-03.webp",
  "assets/food/drinks-specific-04.png": "assets/food/drinks-specific-04.webp",
  "assets/food/pizza-specific-01.png": "assets/food/pizza-specific-01.webp",
  "assets/food/ufo-burgers-v2.png": "assets/food/ufo-burgers-v2.webp",
  "assets/food/bakery-specific-01.png": "assets/food/bakery-specific-01.webp",
  "assets/food/banquet-specific-01.png": "assets/food/banquet-specific-01.webp",
  "assets/food/banquet-specific-02.png": "assets/food/banquet-specific-02.webp",
  "assets/food/banquet-atlas-v1.png": "assets/food/banquet-atlas-v1.webp"
};
  window.RAKETA_INLINE_ASSETS=new Proxy({},{get:function(_,k){return typeof k==='string'?(map[k]||k):undefined;}});
}());
