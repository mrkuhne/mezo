/* vilagos/mezo.js — placeholder until the domain agent fills it. */
(function(){const {page,card,txt,register}=F;
register('mezo',{title:'Mezo',tabs:[['Üzenőfal','mai'],['A csapat','csapat'],['Rólad','rolad'],['Emlékek','emlekek']],routes:{mai:()=>page('mezo',{title:'Mezo',sub:'Kidolgozás alatt',tab:'mai'},card(txt('Ez a terület most készül ebben a kinézetben.')))},sheets:{},notes:''});})();
