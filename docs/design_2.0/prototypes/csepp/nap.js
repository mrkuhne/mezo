/* csepp/nap.js — Nap domain (Mai · A napom · Beszélgetés · Rutin + sheets). Built on window.K (see csepp/README.md). */
(function(){
const {I,T,csepp,ring,page,sec,back,wkBars,register}=K;
function mai(){
  return K.page(`
  <div class="sec rise" style="padding-bottom:4px"><span class="eb">Szerda · október 7.</span><span class="eb">4 / 7 jel</span></div>
  <section class="card hg hero-n rise" style="--i:1">${csepp('ok',57,{s:128,val:72,label:'MA'})}
    <div style="flex:1;min-width:0"><p class="verdict">Ma jó nap egy közepes edzéshez.</p>
      <p class="txt sub">Nyugodt ébredés, 7 ó 40 p alvás. Két check-in még hátravan.</p></div>
  </section>
  <div class="qrow rise" style="--i:2"><button data-toast="Check-in">${I('i-pulse')}Check-in</button><button data-toast="Gyors logolás">${I('i-plus')}Logolás</button><button data-toast="Napló">${I('i-pen')}Napló</button><button class="more" data-toast="Aktivitás · Chat · Életjelek">Több ›</button></div>
  <section class="open rise" style="--i:3"><span class="eb">Üzemanyag · a hét</span>
    <div class="big"><span class="num">2 060</span><span class="v">/ 3 100 kcal ma · 1 040 van még</span></div>
    ${wkBars()}
    <p class="fn" style="margin-top:4px">Egy oszlop egy nap, a három szín a három makró. Ha a nap célja megvan, az oszlop elhallgat: szürke lesz. A szaggatott vonal a napi keret.</p>
    <div style="height:6px"></div>
    <div class="ln"><span class="g">Fehérje</span><span class="v"><b>148</b> / 220 g</span><div class="bar" style="--c:var(--protein)"><b style="--w:67%"></b></div></div>
    <div class="ln"><span class="g">Szénhidrát</span><span class="v"><b>224</b> / 380 g</span><div class="bar" style="--c:var(--carb)"><b style="--w:59%"></b></div></div>
    <div class="ln"><span class="g">Zsír</span><span class="v"><b>58</b> / 95 g</span><div class="bar" style="--c:var(--fat)"><b style="--w:61%"></b></div></div>
  </section>
  <section class="open rise" style="--i:4;padding-top:12px;padding-bottom:12px"><div class="ln" style="border-top:0;padding:4px 0">${I('i-cal')}<span class="g">Heti egyeztetés<span class="dot"></span><small>vasárnap · 1 javaslat vár · 3 lépés, kb. 2 perc</small></span>${I('i-chev','chev')}</div></section>
  <section class="open rise" style="--i:4"><span class="eb">Megfigyelés</span>
    <p class="txt">Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Négy nap adata, még kevés. Figyeljem tovább?</p>
    <div class="act"><button class="btn sm" data-toast="Megjegyeztem: figyelem tovább">Igen, figyeld</button><button class="lk" data-toast="Megjegyeztem">Nem stimmel</button><button class="lk" data-toast="Mezo · Chat">Mesélj erről</button></div>
  </section>
  <section class="open rise" style="--i:5"><span class="eb">Mai pillanatok</span>
    <div class="ln"><time>13:00</time>${I('i-bowl')}<span class="g">Csirke · édesburgonya · spenót<small>Étkezés</small></span>${I('i-chev','chev')}</div>
    <div class="ln"><time>09:15</time>${I('i-bowl')}<span class="g">Túrós zabkása · áfonyával<small>Étkezés</small></span>${I('i-chev','chev')}</div>
    <div class="ln"><time>07:10</time>${I('i-pulse')}<span class="g">Nyugodt ébredés · pihenve<small>Check-in · reggel</small></span>${I('i-chev','chev')}</div>
    <div class="ln"><time>23:35</time>${I('i-bowl')}<span class="g">Lazac · barna rizs · brokkoli<small>Étkezés · tegnap</small></span>${I('i-chev','chev')}</div>
  </section>
  `,'nap','mai');
}

register('nap',{
  mark:'i-sun',
  tabs:[['Mai','i-sun','mai'],['A napom','i-cal','napom'],['Beszélgetés','i-chat','uzenetek'],['Rutin','i-list','rutin']],
  routes:{mai},
  sheets:{},
  notes:`<h2>Nap</h2><p>Mai: a csepp a hős az ítélet-mondattal, három csendes művelet, Üzemanyag heti oszlopokkal (MacroFactor), Heti egyeztetés, Megfigyelés, Mai pillanatok. A többi fül (A napom, Beszélgetés, Rutin) kidolgozás alatt.</p>`
});
})();
