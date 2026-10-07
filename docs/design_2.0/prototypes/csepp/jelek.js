/* csepp/jelek.js — the Jelek sheet: the élő csepp system and the team's sibling forms. */
(function(){
const {I,csepp,register}=K;
const TEAM=[['Szunya','alvás','#AB9FD2','pebble',62],['Mocor','mozgás','#7FB2D0','bean',48],['Falat','étel','#8FB49A','drop',70],['Derű','kedv','#D9B67E','leaf',55],['Mezo','összkép','#9AA3A8','crystal',64]];
function jelek(){
  return K.page(`
  <div class="sec rise"><span class="eb">Jelek</span><span class="eb">a prototípus lapja</span></div>
  <div class="p16 rise" style="--i:1"><h1 class="t">Az élő csepp</h1><p class="lead">Egy jel, egy jelentés: <b>a mai napod</b>. A töltöttség azt mutatja, mennyi van már meg a napból; a szín és a forma azt, hogy állsz. Arc nincs, de lélegzik.</p></div>
  <section class="jl rise" style="--i:2"><div class="grid">
    <div class="cell">${csepp('ok',57,{s:72,val:72})}<strong>Nyugodt</strong><small>kerek forma, lassú lélegzés, zöld</small></div>
    <div class="cell">${csepp('warn',57,{s:72,val:48})}<strong>Figyelj</strong><small>hullámosabb forma, gyorsabb ritmus, borostyán</small></div>
    <div class="cell">${csepp('bad',57,{s:72,val:21})}<strong>Baj</strong><small>szögletes forma, szapora ritmus, vörös</small></div>
  </div></section>
  <section class="jl rise" style="--i:3"><span class="eb">Töltöttség · a nap halad</span><div class="grid">
    <div class="cell">${csepp('ok',12,{s:64,val:'1/7',alive:false})}<strong>Reggel</strong><small>egy jel megvan</small></div>
    <div class="cell">${csepp('ok',57,{s:64,val:'4/7',alive:false})}<strong>Délután</strong><small>négy a hétből</small></div>
    <div class="cell">${csepp('ok',100,{s:64,val:'7/7',alive:false})}<strong>Este</strong><small>teli: a nap kész</small></div>
  </div></section>
  <section class="jl rise" style="--i:4"><span class="eb">Méretek · ugyanaz a jel mindenhol</span><div class="grid" style="grid-template-columns:1fr">
    <div class="cell" style="flex-direction:row;justify-content:space-around;align-items:flex-end">${csepp('ok',57,{s:124,val:72,label:'MA'})}${csepp('ok',57,{s:72,val:72})}${csepp('ok',57,{s:44,val:'4/7',cls:'mini'})}${csepp('ok',57,{s:28})}</div>
  </div><p class="fn">Nagyban a Nap tetején (a mai állapotod), közepesen a kártyákon, kicsiben minden fejlécben, és ikonként az alsó menü terület-jelén.</p></section>
  <section class="jl rise" style="--i:5"><span class="eb">A csapat · testvérformák, arc nélkül</span><div class="grid team">
    ${TEAM.map(([n,r,c,f,fl])=>`<div class="cell">${csepp('ok',fl,{s:46,form:f,color:c})}<strong>${n}</strong><small>${r}</small></div>`).join('')}
  </div><p class="fn">Ugyanaz az anyag, más sziluett és szín. Az üzenetekben ők szólnak: a forma a feladó, a szöveg a hang. Így marad meg a „többhangú csapat” a tamagotchi nélkül.</p></section>
  <section class="jl rise" style="--i:6"><span class="eb">Szabály</span><p class="lead">A csepp csak <b>egy</b> dolgot jelent: a napodat. Díszként, gombként, más adathoz soha nem használjuk. Ettől lesz aláírás.</p></section>
  `,'nap','mai');
}


register('jelek',{mark:'i-sun',tabs:[['Mai','i-sun','mai'],['A napom','i-cal','napom'],['Beszélgetés','i-chat','uzenetek'],['Rutin','i-list','rutin']],routes:{mai:jelek},
  notes:`<h2>Jelek</h2><p>Az élő csepp három állapota, a töltöttsége, a méretei és a csapat öt testvérformája. Egy jel, egy jelentés: a napod.</p>`});
})();
