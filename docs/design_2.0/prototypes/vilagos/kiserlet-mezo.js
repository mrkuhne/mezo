/* vilagos/kiserlet-mezo.js — EXPERIMENT (mezo-pi0jf), the Mezo domain in the system the Nap, Edzés and Fuel domains settled
   on (KISERLET.md). NOT part of the build target: loaded only by ../kiserlet-napom-grafika.html after the other kiserlet-*.js
   files, whose styles (now scoped to mezo too) and helpers (window.KXN, window.KXE) it reuses. The approved pages stay
   reachable as <route>-lista.

   ÜZENŐFAL (owner brainstorm, 2026-11-02): he opens it in the morning to see what needs his answer and what new thoughts the
   team has — and 10–20 full-length posts were too much. Kept, because he likes them: the Rád vár block, the day headings,
   the evening edition. Changed: every post is ONE card shape (who · when · kind · status, the headline, two lines, the
   post's own small picture, its tags, "Elolvasom"); the full text, the thread, "Miből látszik?", the answer buttons and the
   reply field open in a drawer. The front holds today + last night's edition (in the morning that is the freshest); older
   days sit behind one button that says how many still wait for him. The team drops stay as a picture only (he looks, never
   taps). */
(function(){
const F=window.F,mz=window.FREG&&FREG.mezo,X=window.KXN,E=window.KXE;if(!mz||!X||!E)return;
const {I,badge,page}=F,{KH,hubHead}=X,{bal,pills}=E;
const P='.phone.foly[data-s="elo"][data-d="mezo"]';
const O={mai:mz.routes.mai,fal:mz.routes.fal};mz.routes['mai-lista']=O.mai;

const TN={szunya:'Alvás',mocor:'Mozgás',falat:'Étkezés',deru:'Közérzet',mezo:'Mezo',szk:'Szkeptikus'};
const TICK='<svg class="w3-tk" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5L6.8 11.5L12.5 5"/></svg>';
const minis=ids=>`<span class="w3-mi">${ids.map(k=>badge(k,{s:24})).join('')}</span>`;
const cut=(h,mark,tag)=>{const i=h.indexOf(mark);return i<0?'':h.slice(i,bal(h,i,tag))};

/* pictures the approved wall already draws, cut from its rendered markup (made inert: the card is the one target) */
let PIC=null;
function pics(){if(PIC)return PIC;const h=O.mai('');
  const fi=h.indexOf('napi értékelés'),tal=fi<0?'':cut(h.slice(fi),'<div class="gr ','div');
  const days=cut(h,'<div class="gr days"','div');
  const team=cut(h,'<nav class="gfm','nav').replace(/<button[^>]*?aria-label="([^"]*)"[^>]*>/g,'<span class="w3-tm" role="img" aria-label="$1">').replace(/<\/button>/g,'</span>');
  return PIC={tal,days,team}}
/* own small pictures where the approved wall had only words */
const caps=(n,k,cap,warn)=>`<span class="w3-cp${warn?' w':''}"><span class="r">${Array.from({length:n},(_,i)=>`<i class="${i<k?'on':''}"></i>`).join('')}</span><span class="c">${cap}</span></span>`;
const pair=(a,b,mid='mint',cap='')=>`<span class="w3-pr">${[a,b].map(([l,v,p,c])=>`<span class="v"><span class="t"><i style="height:${p}%;--c:${c}"></i><b>${v}</b></span><small>${l}</small></span>`).join(`<span class="m">${mid}</span>`)}</span>${cap?`<span class="w3-prc">${cap}</span>`:''}`;

/* the posts — content of the approved wall (csepp/mezo.js fal), emojis out (Folyadék: never emojis) */
const POSTS=[
 {id:'deru',day:'ma',who:'deru',t:'ma 13:40',kind:'kérés',flag:'Kérés',h:'Két hétből csak 4 estéről tudom, hogy érezted magad.',
  x:'Így a stressz-szálhoz még nem tudok hozzányúlni, pedig gyanús nekem valami. Ha ma este bejelentkezel (tényleg 1 perc), hétvégére már meg tudom mutatni, mi mozgatja az energiádat. A sejtésem: <b>az alvásoddal függ össze</b>, nem a munkával.',
  pic:()=>caps(14,4,'4 este a 14-ből'),own:['Bejelentkezem · 1 perc','Bejelentkezés — 1 perces közérzet-kör']},
 {id:'vacsora',day:'tegnap',who:'szunya',t:'tegnap 20:30',kind:'bevonva: Étkezés és a Szkeptikus',flag:'Rád vár',wait:1,h:'Lehet, hogy nem az edzés tolja el az estédet.',
  x:'A késői vacsorák inkább a <b>későn befejezett napok</b> mellé esnek, és utánuk rendre rosszabb az éjszakád: később alszol el, és a mély szakaszból is kevesebb jut. Az edzés-estéket külön néztem: azok után <b>nem</b> látom ugyanezt. Étkezés, nálad mi látszik a vacsora-oldalon?',
  pic:()=>pair(['késői vacsora után','6,0',42,'#E7B25A'],['korai vacsora után','7,5',80,'var(--dom)'],'másfél pont','Az alvásod átlaga · 11 este mellette szól, 3 ellene'),thr:{ids:['falat','szk'],n:3,sum:'Az Étkezés egyetért, a Szkeptikus vitatja',
   c:[['szk','Szép együttfutás, de a hétvége önmagában is magyarázhatja: akkor eszel későn <b>és</b> akkor alszol rosszabbul. Válasszuk szét a hétköznapot a hétvégétől, mielőtt bármit kimondunk.']],all:'poszt.vacsora'},
  ev:{l:'Miből látszik? · 14 közös nap',sheet:'evidence'}},
 {id:'falat1',day:'tegnap',who:'falat',t:'tegnap 20:30',kind:'napi értékelés',h:'A mai tányérod rendben volt.',
  x:'A fehérje megint összejött (<b>148 g</b>), és a meccs előtti szénhidrát is a helyén. Egy dolgot vinnék át holnapra: <b>a zöldség délután elmaradt</b>, pedig délelőtt szépen megy. Holnap a délutáni falatokhoz hozok egy konkrét javaslatot.',
  pic:()=>pics().tal},
 {id:'mezo1',day:'tegnap',who:'mezo',t:'tegnap 20:30',kind:'a nap beszélgetései',h:'Tegnap két ügyön dolgoztunk.',
  x:'Délben a Mozgás jelezte, hogy az esti edzéshez kevés az üzemanyag. Az Étkezés az ebédnél pótoltatta, és <b>13:05-re rendeződött</b>. A lefekvés ügye nyitva maradt: a <b>22:45-ös</b> lefekvésből 23:20 lett, ma este újra próbáljuk.',
  tags:['2 ügy','1 rendeződött','1 holnapra maradt'],links:[['A tegnapi beszélgetés · 9 üzenet','elo']]},
 {id:'viz',day:'tegnap',who:'falat',t:'tegnap 20:30',kind:'döntés kell',flag:'Döntés',wait:1,dec:1,h:'Többet iszol, több az energiád?',
  x:'Kezd úgy tűnni, hogy <b>a többet ivós napjaidon több az energiád</b>: 2 liter fölött rendre 6–8 pontot jelentettél, 1,5 alatt inkább 4–5-öt. <b>8 napot tudok összevetni</b>, épp annyit, amennyit a terv kér. Innen a te szavad kell: igaz ez rád?',
  pic:()=>pair(['2 liter fölött','6–8',74,'var(--water,#3F8FDB)'],['1,5 liter alatt','4–5',46,'#E7B25A']),ev:{l:'Miből látszik? · 8 nap',go:'minta.viz'}},
 {id:'sejtes',day:'tegnap',who:'mocor',t:'tegnap 20:30',kind:'még csak sejtés',h:'Egyhangúbb hetek után esik az energiád?',
  x:'Ha három napig ugyanaz a terhelés megy, a negyediken laposabb a reggeli jelentkezésed. Még csak 5 közös napom van a 8-ból, úgyhogy nem mondom ki. Ha jövő héten becsúszik egy változatosabb blokk, sokat fogok tanulni belőle.',
  pic:()=>caps(8,5,'5 nap a 8-ból · még kevés'),ev:{l:'Miből látszik? · 5 / 8 nap',go:'minta.egyhangu'}},
 {id:'kiserlet',day:'tegnap',who:'falat',t:'tegnap 20:30',kind:'közös kísérlet a Mozgással · 4/7 nap',h:'Szénhidrát a meccs előtt',
  x:'Két meccsnapon próbáltuk, és mindkétszer stabilabb volt az ugrásod a végjátékban, a 4. szettben is. Ma este megint meccs: ha 17 óráig bekerül a <b>80 g szénhidrát</b>, holnapra majdnem kész a kép.',
  pic:()=>pics().days,ev:{l:'Miből látszik? · 4/7 nap',go:'kiserlet-oldal.szenhidrat'},links:[['A Mozgás követi · a kísérlet oldala','poszt.kiserlet']]},
 {id:'hetvege',day:'szombat',who:'szunya',t:'szombat',kind:'megfigyelés',done:'Megerősítetted',h:'Hétvégén átlag 40 perccel később fekszel le.',
  x:'És ezt a hétfői első bejelentkezésed rendre megérzi. Nem a hétvége a baj, hanem a <b>hétfői ugrás</b>: már egy köztes vasárnapi lefekvés is sokat kisimítana. Megerősítetted, bekerült a rólad szóló képbe.',
  ev:{l:'Miből látszik? · 26 nap',go:'minta.hetvege'}},
 {id:'konz',day:'vasarnap',who:'mezo',t:'vasárnap 19:30',kind:'heti konzílium',h:'Két dolog került a rólad szóló képbe.',
  x:'Vasárnap leültünk mind az öten, és végigvettük a hetedet. Bekerült a hétvégi lefekvés-minta és a meccs előtti szénhidrát; egyet nyugdíjaztunk, mert három hete nem erősödik. A Szkeptikus két felvetést visszadobott, jogosan: kevés még mögöttük a nap. <b>Jövő héten a vacsora-ügy a fókusz.</b>',
  tags:['+2 bekerült','1 nyugdíjazva','2 visszadobva'],links:[['Az ülés jegyzőkönyve · 4 forduló','konzilium']]},
 {id:'elore',day:'vasarnap',who:'mocor',t:'vasárnap',kind:'lezárt előrejelzés',h:'Ez most nem jött be.',
  x:'Könnyebbnek vártam a jó alvás utáni edzést, te ugyanolyannak érezted. Ez is számít: ebből a jelből mostantól óvatosabban következtetek.',
  ev:{l:'Miből látszik?',go:'elore.alvas-edzes'},links:[['Ezt vártam, és ez történt · a teljes kép','poszt.elorejelzes']]}];
const PILL={id:'gyors',day:'ma',who:'szunya',t:'most',kind:'gyors jelzés',h:'Láttam a tegnapi korábbi lefekvést: 23:05!',
  x:'Ha ma is összejön, az már hármas sorozat, és a hármas sorozat nálam a minta kezdete. Szurkolok, este halkan jelentkezem.',pic:()=>caps(3,2,'2 este a 3-ból')};
const FRONT=['ma','tegnap'],DAYS=[['ma','Ma'],['tegnap','Tegnap · esti kiadás'],['szombat','Szombat'],['vasarnap','Vasárnap · konzílium']];
const RS={},RE={},WS={pill:false};
const byId=id=>POSTS.find(p=>p.id===id);
const answered=p=>!!RS[p.id]||!!p.done;
const open=()=>POSTS.filter(p=>p.wait&&!RS[p.id]);
const olderLeft=()=>POSTS.filter(p=>!FRONT.includes(p.day)&&!answered(p)).length;
const RL={up:'Ez talál',down:'Nem így érzem',yes:'Igaz rám',no:'Nem igaz rám',reply:'Elmesélted'};

function chipOf(p){if(p.done)return `<i class="w3-st ok">${TICK}${p.done}</i>`;if(RS[p.id])return `<i class="w3-st ok">${TICK}Megvan</i>`;return p.flag?`<i class="w3-st w">${p.flag}</i>`:''}
const tagsOf=p=>p.tags?`<span class="w3-tg">${p.tags.map(t=>`<span>${t}</span>`).join('')}</span>`:'';
const cardOf=p=>`<article class="w3-c${answered(p)?' ok':''}" data-w3c="${p.id}"><button class="w3-tap" data-sheet="w3" data-arg="${p.id}" aria-label="${p.h} · elolvasom">
  <span class="w3-hd">${badge(p.who,{s:40})}<span class="g"><b>${TN[p.who]}</b><small>${p.t} · ${p.kind}</small></span>${chipOf(p)}</span>
  <span class="w3-h">${p.h}</span><span class="w3-x">${p.x.replace(/<[^>]+>/g,'')}</span>
  ${p.pic?`<span class="w3-pic">${p.pic()}</span>`:''}${tagsOf(p)}
  <span class="w3-f">${p.thr?`<span class="w3-th">${minis(p.thr.ids)}${p.thr.n} hozzászólás</span>`:''}<span class="n8-b">Elolvasom</span></span></button></article>`;

/* Rád vár: kept as he likes it — the live conversation, then each thing waiting for his word (a wall post opens its drawer,
   the decision keeps its own page) */
function radVar(){const rows=[
  `<button class="w3-rw" data-go="elo"><i class="w3-live"></i><span class="g"><b>Élőben · a csapat beszél</b><small>Étkezés: „Megvan, 1 140 kcal, rendeződött”</small></span><em>1 új ›</em></button>`,
  ...open().map(p=>`<button class="w3-rw" data-sheet="w3" data-arg="${p.id}">${badge(p.who,{s:40})}<span class="g"><b>${p.h}</b><small>${TN[p.who]} · ${p.kind}</small></span><i class="w3-st w">${p.flag}</i></button>`),
  `<button class="w3-rw" data-go="poszt.dontes">${badge('falat',{s:40})}<span class="g"><b>Korábbi vacsora, nyugodtabb este?</b><small>Étkezés · döntés kell · 18 nap, elég adat van</small></span><i class="w3-st w">Döntés</i></button>`];
  return `<section class="mx-s ln" id="w3-rv">${KH('Rád vár')}<div class="w3-rl">${rows.join('')}</div></section>`}
const NUM=['Egy','Két','Három','Négy','Öt'];
function topOf(){const n=open().length+1,first=open()[0];
  return `<section class="mx-s ex-hero" id="w3-top"><small class="ex-eb">A te kis csapatod · ma</small><h2 class="n7-h">${n?`${NUM[n-1]||n} beszélgetésben várnak rád.`:'Mindenre válaszoltál.'}</h2>
  <div class="w3-team">${pics().team}</div>
  <div class="ex-acts w3-wide"><button class="n9-btn" ${first?`data-sheet="w3" data-arg="${first.id}"`:'data-go="poszt.dontes"'}>Megnézem</button></div></section>`}
const daySec=(d,l,list)=>{const ps=list.filter(p=>p.day===d);return ps.length?`<section class="mx-s ln">${KH(l)}<div class="w3-l" data-w3d="${d}">${ps.map(cardOf).join('')}</div></section>`:''};
const mzLine=t=>`<div class="ex-mz w3-mz">${badge('mezo',{s:30})}<p>${t}</p></div>`;
function wall(a){
  if(a==='korabbi')return page('mezo',{title:'Korábbi napok',sub:'Mezo · üzenőfal',back:'mai'},`<div class="mx">
    <section class="mx-s"><h2 class="n7-h">${olderLeft()?`${olderLeft()} bejegyzésre még nem reagáltál.`:'Itt mindenre reagáltál.'}</h2></section>
    ${DAYS.filter(([d])=>!FRONT.includes(d)).map(([d,l])=>daySec(d,l,POSTS)).join('')}
    <section class="mx-s ln">${mzLine('Ennél régebbi bejegyzés nincs. A lezárt ügyek a Rólad és az Emlékek fülön élnek tovább.')}</section></div>`);
  if(a&&a!=='uj')return O.mai(a);
  const list=WS.pill?[PILL,...POSTS]:POSTS,left=olderLeft();
  return hubHead(page('mezo',{title:'Üzenőfal',sub:'Mezo · hétfő · esti kiadás 21:00',tab:'mai'},`
  ${WS.pill?'':'<div class="mz-pill" id="mzpill" data-w3="pill" role="button">1 új bejegyzés ↑</div>'}<div class="mx">
  ${topOf()}${radVar()}
  ${DAYS.filter(([d])=>FRONT.includes(d)).map(([d,l])=>daySec(d,l,list)).join('')}
  <section class="mx-s ln">${mzLine('Ennyi történt tegnap este óta. A folyamatban lévő ügyeket közben tovább figyeljük.')}
    <button class="w3-old${left?' w':''}" data-go="mai.korabbi"><span class="g"><b>Korábbi napok</b><small>${left?`${left} bejegyzésre még nem reagáltál`:'mindenre reagáltál'}</small></span><em>›</em></button></section></div>`))}
mz.routes.mai=wall;mz.routes.fal=wall;
/* the tab pages' header as on the converted domains: no big title, the "?" top left (sub-pages keep their title) */
Object.keys(mz.routes).forEach(k=>{const f=mz.routes[k];if(typeof f==='function'&&!f.__hub){const g=(...a)=>hubHead(f(...a));g.__hub=1;mz.routes[k]=g}});

/* the drawer: who and when big, the headline, the whole text, the picture, the evidence and links, the thread, then the
   answer — quick buttons, or a few words in the field */
function sheet(id){const p=id==='gyors'?PILL:byId(id);if(!p)return '';const r=RS[p.id];
  const links=[p.ev?(p.ev.sheet?`<button class="fh-lk" data-sheet="${p.ev.sheet}">${p.ev.l} ›</button>`:`<button class="fh-lk" data-go="${p.ev.go}">${p.ev.l} ›</button>`):'',...(p.links||[]).map(([l,go])=>`<button class="fh-lk" data-go="${go}">${l} ›</button>`)].join('');
  const thr=p.thr?`<section class="dv-s"><h3>${p.thr.n} hozzászólás</h3><p class="w3-ts">${minis(p.thr.ids)}${p.thr.sum}</p>${p.thr.c.map(([k,t])=>`<div class="w3-cm">${badge(k,{s:34})}<div><b>${TN[k]}</b><p>${t}</p></div></div>`).join('')}<button class="fh-lk" data-go="${p.thr.all}">Mind a ${p.thr.n} hozzászólás ›</button></section>`:'';
  const btns=p.dec?[['yes','Igen, igaz rám'],['no','Nem igaz rám']]:[['up','Ez talál'],['down','Nem így érzem']];
  const ans=p.done?`<p class="w3-ok">${TICK}${p.done} · bekerült a rólad szóló képbe</p>`
    :r?`<p class="w3-ok">${TICK}Megjegyeztem: ${RL[r]}.</p><button class="fh-lk" data-w3="undo:${p.id}">Visszavonom</button>`
    :`<div class="w3-ab">${btns.map(([k,l],i)=>`<button class="${i?'n8-b':'n9-btn'}" data-w3="r:${p.id}:${k}">${l}</button>`).join('')}<button class="n8-b" data-w3="tell:${p.id}">Elmesélem</button></div>
      ${RE[p.id]?`<textarea class="fh-in w3-in" rows="3" placeholder="Mi az, amit csak te tudhatsz erről?" aria-label="A te részed"></textarea><button class="n9-btn w3-send" data-w3="send:${p.id}">Elküldöm</button>`:''}`;
  return `<div class="dv w3-sh" data-w3s="${p.id}"><div class="w3-shd">${badge(p.who,{s:56})}<div><small>${TN[p.who]} · ${p.t}</small><b>${p.kind[0].toUpperCase()+p.kind.slice(1)}</b></div></div>
  <h2 class="w3-shh">${p.h}</h2><div class="mg-tx"><p>${p.x}</p></div>
  ${p.pic?`<div class="w3-pic big">${p.pic()}</div>`:''}${tagsOf(p)}${links?`<div class="w3-lk">${links}</div>`:''}
  ${p.own?`<button class="dv-btn pri w3-own" data-toast="${p.own[1]}">${p.own[0]}</button>`:''}
  ${thr}<section class="dv-s"><h3>${p.dec?'Igaz ez rád?':'Mit szólsz hozzá?'}</h3>${ans}</section>
  <button class="fh-lk w3-more" data-sheet="menu">A bejegyzés menüje ›</button></div>`}
mz.sheets.w3=sheet;

/* in-place updates: the card, the top, Rád vár and the open drawer redraw; the page does not move */
function refresh(id){const ph=document.querySelector('#phone');if(!ph)return;
  const c=ph.querySelector(`[data-w3c="${id}"]`),p=id==='gyors'?PILL:byId(id);if(c&&p)c.outerHTML=cardOf(p);
  const t=ph.querySelector('#w3-top');if(t)t.outerHTML=topOf();const rv=ph.querySelector('#w3-rv');if(rv)rv.outerHTML=radVar();
  const o=ph.querySelector('.w3-old');if(o){const l=olderLeft();o.classList.toggle('w',!!l);o.querySelector('small').textContent=l?`${l} bejegyzésre még nem reagáltál`:'mindenre reagáltál'}
  if(F.ARG==='korabbi'){const h=ph.querySelector('.mx .n7-h'),l=olderLeft();if(h)h.textContent=l?`${l} bejegyzésre még nem reagáltál.`:'Itt mindenre reagáltál.'}
  const s=ph.querySelector(`#sheet [data-w3s="${id}"]`);if(s)s.outerHTML=sheet(id)}
const TT={up:'„Ez talál” — köszönjük, feljegyeztük.',down:'„Nem így érzem” — ebből tanulunk a legtöbbet.',yes:'Bekerült. Bármikor visszavonhatod a Rólad oldalon.',no:'Rendben, nem építünk rá.',reply:'Elküldve — a csapat újraértékeli vele a képet.'};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w3]');if(!b)return;e.preventDefault();const [k,id,v]=b.dataset.w3.split(':');
  if(k==='pill'){if(WS.pill)return;WS.pill=true;const ph=document.querySelector('#phone'),l=ph&&ph.querySelector('[data-w3d="ma"]');if(l)l.insertAdjacentHTML('afterbegin',cardOf(PILL));b.classList.remove('on');ph&&ph.querySelector('.scroll')?.scrollTo({top:0,behavior:'smooth'});return}
  if(k==='r'){RS[id]=v;RE[id]=false;refresh(id);F.toast(TT[v]);return}
  if(k==='undo'){delete RS[id];refresh(id);F.toast('Visszavonva');return}
  if(k==='tell'){RE[id]=!RE[id];refresh(id);const ta=document.querySelector('#sheet .w3-in');if(ta)ta.focus();return}
  if(k==='send'){const ta=document.querySelector('#sheet .w3-in');if(ta&&!ta.value.trim()){F.toast('Írj pár szót — ebből tanul a csapat.');return}RS[id]='reply';RE[id]=false;refresh(id);F.toast(TT.reply)}},true);

F.css(`
${P} .w3-team{margin:14px 14px 0}${P} .w3-team .gfm{pointer-events:none}${P} .w3-tm{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--ink)}
${P} .w3-tm small{font-size:12px!important;font-weight:600!important;color:var(--ink)!important;opacity:.8}
${P} .w3-wide{margin:16px 22px 0}${P} .w3-wide .n9-btn{flex:1}
${P} #mzpill{top:112px}
${P} .w3-rl{display:grid;gap:10px;margin:0 14px}
${P} .w3-rw{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:12px 14px;border-radius:20px;background:#fff;text-align:left;box-shadow:0 10px 24px -18px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w3-rw .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .w3-rw .g b{font-size:15px;line-height:1.3;color:var(--ink)}${P} .w3-rw .g small{margin-top:3px;font-size:13px;line-height:1.35;color:var(--ink);opacity:.75}
${P} .w3-rw em{flex:none;font-style:normal;font-size:13.5px;font-weight:750;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}
${P} .w3-live{flex:none;width:12px;height:12px;margin:0 14px;border-radius:50%;background:var(--dom);box-shadow:0 0 0 5px color-mix(in srgb,var(--dom) 18%,#fff)}
${P} .w3-st{flex:none;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;font-style:normal;font-size:12.5px;font-weight:750;white-space:nowrap}
${P} .w3-st.w{color:#8A5513;background:#FCEFD9}${P} .w3-st.ok{color:#1F7A4D;background:#E2F4EA}
${P} .w3-tk{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
${P} .w3-l{display:grid;gap:14px;margin:0 14px}
${P} .w3-c{border-radius:24px;background:#fff;box-shadow:0 12px 28px -20px rgba(10,42,60,.4),0 0 0 1px rgba(10,42,60,.05)}
${P} .w3-tap{display:flex;flex-direction:column;width:100%;padding:16px;text-align:left;border-radius:24px}
${P} .w3-hd{display:flex;align-items:center;gap:12px}${P} .w3-hd .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .w3-hd .g b{font-size:15px;color:var(--ink)}
${P} .w3-hd .g small{font-size:12.5px;line-height:1.35;color:var(--ink);opacity:.75}
${P} .w3-h{display:block;margin-top:12px;font:800 18px/1.25 var(--disp,inherit);letter-spacing:-.02em;color:var(--ink);text-wrap:balance}
${P} .w3-x{margin-top:6px;font-size:14.5px;line-height:1.45;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
${P} .w3-pic{display:block;margin-top:14px}${P} .w3-pic svg.gc{display:block;width:100%;height:auto}${P} .w3-pic .gr{margin:0}
${P} .w3-tg{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}${P} .w3-tg span{padding:5px 11px;border-radius:999px;background:rgba(10,42,60,.06);font-size:13px;font-weight:650;color:var(--ink)}
${P} .w3-f{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:14px}${P} .w3-f .n8-b{margin:0}
${P} .w3-th{display:flex;align-items:center;gap:8px;margin-right:auto;font-size:13.5px;font-weight:650;color:var(--ink)}
${P} .w3-mi{display:inline-flex}${P} .w3-mi .fh-av+.fh-av{margin-left:-8px}
${P} .w3-c.ok{box-shadow:0 0 0 1px rgba(10,42,60,.05)}
${P} .w3-cp{display:flex;flex-direction:column;gap:8px}${P} .w3-cp .r{display:flex;gap:4px}${P} .w3-cp i{flex:1;height:26px;border-radius:9px;background:rgba(10,42,60,.06);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.1)}
${P} .w3-cp i.on{background:linear-gradient(180deg,var(--liq1),var(--liq2));box-shadow:none}${P} .w3-cp .c{font-size:13.5px;font-weight:700;color:var(--ink)}
${P} .w3-pr{display:flex;align-items:flex-end;gap:10px}${P} .w3-pr .v{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}${P} .w3-pr .m{flex:none;max-width:70px;text-align:center;padding-bottom:34px;font-size:13px;font-weight:700;color:var(--ink);opacity:.7}
${P} .w3-pr .t{position:relative;width:100%;max-width:120px;height:78px;border-radius:20px;overflow:hidden;background:rgba(10,42,60,.05);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.1)}
${P} .w3-pr .t i{position:absolute;left:0;right:0;bottom:0;background:var(--c)}${P} .w3-pr .t b{position:absolute;left:0;right:0;bottom:10px;text-align:center;font:800 20px var(--disp,inherit);color:#fff}
${P} .w3-prc{display:block;margin-top:10px;font-size:13.5px;font-weight:650;color:var(--ink)}${P} .w3-pic .gv small,${P} .w3-pic .gv b{font-size:13px!important}${P} .w3-pic .gv b{font-size:14.5px!important}${P} .w3-tm,${P} .w3-tm>span{font-size:13px!important}${P} .w3-pr small{font-size:13px;font-weight:700;color:var(--ink);text-align:center}
${P} .w3-mz{margin:0 18px}
${P} .w3-old{display:flex;align-items:center;gap:12px;width:calc(100% - 28px);margin:16px 14px 0;min-height:60px;padding:12px 16px;border-radius:20px;background:#fff;text-align:left;box-shadow:0 0 0 1px rgba(10,42,60,.08)}
${P} .w3-old .g{flex:1;display:flex;flex-direction:column}${P} .w3-old b{font-size:15.5px;color:var(--ink)}${P} .w3-old small{font-size:13.5px;color:var(--ink);opacity:.8}${P} .w3-old em{font-style:normal;font-size:18px;font-weight:700;color:var(--dom)}
${P} .w3-old.w{box-shadow:inset 0 0 0 2px #E7B25A}${P} .w3-old.w small{color:#8A5513;opacity:1;font-weight:700}
${P} .w3-shd{display:flex;align-items:center;gap:14px}${P} .w3-shd small{display:block;font-size:13.5px;color:var(--ink);opacity:.8}${P} .w3-shd b{display:block;margin-top:2px;font:800 19px/1.2 var(--disp,inherit);color:var(--ink)}
${P} .w3-shh{margin:18px 0 0;font:800 23px/1.2 var(--disp,inherit);letter-spacing:-.02em;color:var(--ink);text-wrap:balance}
${P} .w3-sh .mg-tx{margin-top:10px}${P} .w3-pic.big{margin-top:18px}
${P} .w3-lk{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:12px}${P} .w3-lk .fh-lk,${P} .w3-sh .fh-lk{min-height:44px;text-align:left}
${P} .w3-ts{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:14px;font-weight:650;color:var(--ink)}
${P} .w3-cm{display:flex;gap:12px;padding:12px;border-radius:18px;background:rgba(10,42,60,.04)}${P} .w3-cm b{font-size:14px;color:var(--ink)}${P} .w3-cm p{margin:2px 0 0;font-size:14.5px;line-height:1.5;color:var(--ink)}
${P} .w3-ab{display:flex;flex-wrap:wrap;gap:8px}${P} .w3-ab .n9-btn,${P} .w3-ab .n8-b{margin:0;min-height:44px}${P} .w3-ab .n9-btn{padding:0 20px}
${P} .w3-in{width:100%;margin-top:12px}${P} .w3-send{margin-top:10px;min-height:44px;padding:0 22px}
${P} .w3-ok{display:flex;align-items:center;gap:8px;margin:0;font-size:15px;font-weight:700;color:#1F7A4D}${P} .w3-ok .w3-tk{width:18px;height:18px}
${P} .w3-own{margin-top:18px}${P} .w3-more{margin-top:14px}
@media (max-width:360px){${P} .w3-h{font-size:17px}${P} .w3-hd{gap:10px}${P} .w3-st{padding:4px 8px;font-size:12px}${P} .w3-tap{padding:14px}}
`);

window.FNOTES_FOLY=(window.FNOTES_FOLY||'')+`<h2>Kísérlet · Mezo</h2><p><a href="#w-mezo-mai"><b>Üzenőfal</b></a> — felül a mondat, a csapat öt cseppje (csak kép) és a Megnézem; a Rád vár marad; Ma és a tegnap esti kiadás egyforma bejegyzés-kártyákon (ki, mikor, fajta, állapot, kiemelt mondat, két sor, a bejegyzés kis képe, Elolvasom); a teljes szöveg, a vita, a Miből látszik és a válasz a felcsúszó fiókban. A régebbi napok egy gomb mögött: <a href="#w-mezo-mai.korabbi">Korábbi napok</a>. Összevetésnek: <a href="#w-mezo-mai-lista">a mostani Üzenőfal</a>.</p>`;
})();
