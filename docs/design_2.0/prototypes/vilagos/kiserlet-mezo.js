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
const {I,badge,page}=F,{KH,hubHead}=X,{bal,pills,g}=E;
const P='.phone.foly[data-s="elo"][data-d="mezo"]';
const O={mai:mz.routes.mai,fal:mz.routes.fal,csapat:mz.routes.csapat};mz.routes['mai-lista']=O.mai;mz.routes['csapat-lista']=O.csapat;O.rolad=mz.routes.rolad;O.terv=mz.routes['rolad-terv'];mz.routes['rolad-lista']=O.rolad;O.emlekek=mz.routes.emlekek;mz.routes['emlekek-lista']=O.emlekek;O.poszt=mz.routes.poszt;mz.routes['poszt-lista']=O.poszt;

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
const pair=(a,b,mid='mint',cap='')=>`<span class="w3-pr">${[a,b].map(([l,v,p,c])=>`<span class="v"><span class="t"><i style="height:${p}%;--c:${c}"></i><b${p<35?' class="lo"':''}>${v}</b></span><small>${l}</small></span>`).join(`<span class="m">${mid}</span>`)}</span>${cap?`<span class="w3-prc">${cap}</span>`:''}`;

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
const olderLeft=()=>POSTS.filter(p=>p.day!=='-'&&!FRONT.includes(p.day)&&!answered(p)).length;
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
  ...(RS.dontes?[]:[`<button class="w3-rw" data-go="poszt.dontes">${badge('falat',{s:40})}<span class="g"><b>Korábbi vacsora, nyugodtabb este?</b><small>Étkezés · döntés kell · 18 nap, elég adat van</small></span><i class="w3-st w">Döntés</i></button>`])];
  return `<section class="mx-s ln" id="w3-rv">${KH('Rád vár')}<div class="w3-rl">${rows.join('')}</div></section>`}
const NUM=['Egy','Két','Három','Négy','Öt'];
function topOf(){const n=open().length+(RS.dontes?0:1),first=open()[0];
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
/* ═══ A CSAPAT (2026-11-02): what the page is about — who watches him and how well each one knows him. The sentence
   names the best-known field; the picture is five tubes (level = how mature that member's picture of him is, tap = the
   member's page); Mezo's line names the weakest and the one button feeds it (owner: the check-in). Every member — the
   Skeptic too — on one card shape: badge, name · field, a status chip, what they watch now, a level bar, one real button. ═══ */
const TEAMK=[['szunya','pihenés','Most figyeli: a késői vacsorák és az éjszakád.',72,'1 kérdés vár rád','t-sleep'],['mocor','terhelés','Most figyeli: a terhelésed. Egy sejtésen dolgozik.',60,'','t-dumbbell'],
  ['falat','étrend','Most figyeli: a vacsoraidőd. Egy kísérlete fut.',80,'kísérlet fut','t-bowl'],['deru','hangulat','Kevés az adata: ma kért tőled egy bejelentkezést.',30,'kevés adat','t-heart'],
  ['mezo','a csapat','A vasárnapi konzíliumon 2 dolog került a közös képbe.',66,'','t-orb']];
const TC4=k=>(F.TEAM[k]||F.TEAM.mezo)[2];
const memCard=([k,area,txt,p,chip])=>`<article class="w4-m"><div class="w4-h">${badge(k,{s:44})}<span class="g"><b>${TN[k]}</b><small>${area}</small></span>${chip?`<i class="w3-st ${chip==='kevés adat'||chip.includes('vár')?'w':'n'}">${chip}</i>`:''}</div>
  <p class="w4-x">${txt}</p><div class="w4-lv"><span class="t"><i style="width:${p}%;--c:${TC4(k)}"></i></span><b>${p}%</b></div><p class="w4-lb">ennyire érett a képe rólad</p>
  <div class="w4-a"><button class="n8-b" data-go="szoba.${k}">Az oldala</button></div></article>`;
const skCard=`<article class="w4-m"><div class="w4-h">${badge('szk',{s:44})}<span class="g"><b>Szkeptikus</b><small>a csapat kételkedője</small></span><i class="w3-st n">nem posztol</i></div>
  <p class="w4-x">A beszélgetésekben kérdez vissza, mielőtt bármi bekerülne rólad. Legutóbb a vacsora-ügyben szólt közbe.</p>
  <div class="w4-a"><button class="n8-b" data-go="poszt.vacsora">Ahol legutóbb szólt</button></div></article>`;
function csapat3(a){if(a)return O.csapat(a);const best=[...TEAMK].sort((x,y)=>y[3]-x[3])[0],low=[...TEAMK].sort((x,y)=>x[3]-y[3])[0];
  const row=(ic,t,sub,go)=>`<button class="ex-mrow w4-r" data-go="${go}">${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i></span><em>›</em></button>`;
  return page('mezo',{title:'A csapat',sub:'Mezo · ők figyelnek rád',tab:'csapat'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb">Öten figyelnek rád</small><h2 class="n7-h">Az ${TN[best[0]]} ismer a legjobban.</h2>
    <div class="w4-tb">${F.vials(TEAMK.map(([k,,,p,,ic])=>({l:TN[k],ic,p,v:p,c:TC4(k),mark:k===low[0]?'kevés':'',on:'szoba.'+k})),{h:132})}</div>
    ${mzLine(`A ${TN[low[0]]} tud rólad a legkevesebbet. Egy esti bejelentkezés sokat segítene neki.`)}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-toast="Bejelentkezés — 1 perces közérzet-kör">Bejelentkezem · 1 perc</button></div></section>
  <section class="mx-s ln">${KH('A csapat tagjai')}<div class="w3-l">${TEAMK.map(memCard).join('')}${skCard}</div></section>
  <section class="mx-s ln">${KH('A közös munka')}<div class="w4-rl">${row('t-council','Konzílium','A heti ülés jegyzőkönyve · 2 dolog került be rólad','konzilium')}${row('t-diagnose','Kérdezd meg a csapatot','Diagnózis · miért vagyok fáradt? · 2 korábbi riport','diagnozis')}${row('t-gear','Gépterem · Összes funkció','A motorháztető és a régi eszköztár','gepterem')}</div></section></div>`)}
mz.routes.csapat=csapat3;

/* ═══ RÓLAD (2026-11-02): the team's surest sentence about him stays the heart of the page (no purple box). The nine
   topics as tubes on two shelves (5 + 4) with whole words (the "Fiz/Tápl/Önv" abbreviations went), a tube opens its topic;
   Talál wide, Pontosítom beside, Miből látom as the line. The decisions in a carousel with dots (owner's pick), each on one
   card shape, the approved buttons and state machine kept (data-m → the approved handlers, which redraw this page). Then
   the Tudástár as four tiles, the facts as cards + a wide "Mind a N tény", life events and Tovább as drop rows; the long
   grey "A te kezedben" became Mezo's line. ═══ */
const DIMW={physical:'Test',training:'Edzés',nutrition:'Étkezés',recovery:'Alvás',mind:'Lélek',discipline:'Fegyelem',life:'Emberek',selfaudit:'Önvizsgálat',chapter:'Munkaciklus'};
const FACTS4=[['szunya','Hétvégén átlag 40 perccel később fekszel le','21× visszaigazolva','beszélgetésből'],['falat','Koffein 14:00 után már nem','23× visszaigazolva','beszélgetésből'],['mocor','Röplabda: kedd + csütörtök + szombat','18× visszaigazolva','beszélgetésből'],['mezo','Szereted érteni a javaslatok indoklását','tőled','kézzel vetted fel · aug. 20.']];
const quarter=t=>t.replace(/(\d{4})\. III\. n\.év/,'$1 nyara').replace(/(\d{4})\. IV\. n\.év/,'$1 ősze').replace(/(\d{4})\. IV\. negyedév/,'$1 ősze');
function rolad3(a){if(a)return O.rolad(a);
  const base=O.rolad(''),full=O.terv(),dimsBtn=[...base.matchAll(/<button class="gv " style="--c:([^"]+)" data-go="dimenzio\.(\w+)" aria-label="([^"·]+)· (\d+)% érettség">/g)].map(m=>({c:m[1],k:m[2],p:+m[4]}));
  const shelf=ds=>`<div class="w5-sh">${F.vials(ds.map(d=>({l:DIMW[d.k]||d.k,p:d.p,v:d.p,c:d.c,on:'dimenzio.'+d.k})),{h:96})}<i class="w5-shf"></i></div>`;
  const talal=/Megerősítetted — a benyomás erősödik/.test(base);
  const top=`<section class="mx-s ex-hero"><small class="ex-eb w5-by">${badge('szunya',{s:26})}Az Alvás benyomása · a legbiztosabb</small><h2 class="n7-h w5-q">„Hétvégén rendszeresen később fekszel le, és a hétfői edzésed ezt meg is érzi.”</h2>
    ${mzLine('Ez javítható benyomás, nem címke. Ha nem így van, pontosítsd.')}
    <p class="w5-cap">A kép rólad kilenc témakörben: ennyire érett</p>${shelf(dimsBtn.slice(0,5))}${shelf(dimsBtn.slice(5))}
    <div class="ex-acts w3-wide">${talal?`<p class="w3-ok">${TICK}Megerősítetted, a benyomás erősödik</p>`:'<button class="n9-btn" data-m="rq">Talál</button>'}<button class="n8-b" data-sheet="reply">Pontosítom</button></div>
    <div class="w3-lk w5-lk"><button class="fh-lk" data-sheet="mibol" data-arg="Hétvégén rendszeresen később fekszel le">Miből látom? ›</button></div></section>`;
  /* the decisions: every inbox card of the full list, restyled, in one carousel */
  const cards=[];let i=0;while((i=full.indexOf('<section class="fh-card',i))>=0){const e=bal(full,i,'section'),h=full.slice(i,e);i=e;if(h.indexOf('<span class="mz-by">')<0||h.indexOf('fh-hero')>=0)continue;cards.push(h)}
  const open=cards.filter(h=>/data-m="rdec:/.test(h)).length;
  const dec=cards.map(h=>{const inner=h.replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'').replace(/class="btn sm"/g,'class="n9-btn"').replace(/class="mz-chip"/g,'class="n8-b"').replace(/(\d{4})\. IV\. negyedév/,'$1 ősze');
    return `<div class="cr-c w5-d${/mz-dim/.test(h.slice(0,80))?' dim':''}">${inner}</div>`}).join('');
  const decS=`<section class="mx-s ln">${KH('Döntésre vár',open?`${open} jelölt`:'mind eldöntve')}<div class="cr w5-cr">${dec}</div>${X.dots(cards.length)}</section>`;
  const tile=(ic,n,k,sub,on)=>`<button class="w5-t" ${on}>${E.drop(ic)}<b>${n}</b><span>${k}</span><small>${sub}</small></button>`;
  const tud=`<section class="mx-s ln">${KH('Amit a csapat megjegyzett')}<div class="w5-tg">${tile('t-person','90','Tények rólad','83 bekapcsolva · 7 elhallgattatva','data-go="tenyek"')}${tile('t-people','70','Emberek','18 ember · 3 elhallgattatva','data-go="kind.6"')}${tile('t-pattern','30','Észrevételek','26 még igaz · 1 felülírva','data-go="mintak"')}${tile('t-cowave','12','Hatások','7 ember · 4 esemény','data-toast="Hatások — a Tudástár hub lapja"')}</div></section>`;
  const nf=g(base,/A tények rólad · (\d+) aktív/)||'15';
  const facts=`<section class="mx-s ln">${KH('A tények rólad',nf+' aktív')}<div class="w3-l">${FACTS4.map(([k,t,c,src])=>`<article class="w5-f">${badge(k,{s:40})}<span class="g"><b>${t}</b><small>${TN[k]} · ${src}</small><i class="w3-st n">${c}</i></span></article>`).join('')}</div>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="tenyek">Mind a ${nf} tény</button></div></section>`;
  const lifes=[...base.matchAll(/<div class="mz-life"><u class="([^"]*)"><\/u><span class="g"><strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span><em>([^<]*)<\/em><\/div>/g)];
  const row=(ic,t,sub,attr,r='›')=>`<button class="ex-mrow w4-r" ${attr}>${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i></span><em>${r}</em></button>`;
  const life=`<section class="mx-s ln">${KH('Életesemények','',`<button class="fh-lk" data-go="eletesemenyek">Mind ›</button>`)}<div class="w4-rl">${lifes.map(([,dim,t,sm,d])=>`<div class="ex-mrow w4-r w5-le${dim?' dim':''}">${E.drop(dim?'t-calendar':'t-journal')}<span class="g"><b>${t}</b><i class="q">${sm.replace(' — ',', ')}</i></span><i class="w3-st n">${quarter(d)}</i></div>`).join('')}</div></section>`;
  const more=`<section class="mx-s ln">${KH('Tovább')}<div class="w4-rl">${row('t-person','A csapat képe rólad','9 témakör, mindegyik pontosítható','data-go="dimenziok"')}${row('t-chat','Így beszélj velem','a saját kommunikációs kéréseid','data-toast="Így beszélj velem — a beállításokban (Én)"')}${row('t-graph','Kapcsolatok','a tudásod térképe','data-go="kategoriak"')}${row('t-brain','Tudástár','tények, kategóriák és a működése','data-go="tudastar"')}</div>
    ${mzLine('Minden, ami itt áll, a forrásával együtt él. Bármit elhallgattathatsz vagy pontosíthatsz, és a csapat csak azt használja, amit jóváhagytál.')}</section>`;
  return page('mezo',{title:'Rólad',sub:'Mezo · a közös kép rólad',tab:'rolad'},`<div class="mx">${top}${decS}${tud}${facts}${life}${more}</div>`)}
mz.routes.rolad=rolad3;

/* ═══ EMLÉKEK (2026-11-02): the week's story on top (no purple box), the sub as Mezo's line; the picture is the seven
   days as capsules filled to how the day felt (owner's pick over "how many sources"), a word under each, the empty day
   dashed, a day opens its memory; Olvasom wide + Archívum. The nightly memories on one card shape (icon drop, date chip,
   title, two lines, Elolvasom); the similar-days search as a real field with example chips, its hits as cards with a
   similarity level; Tovább as drop rows. ═══ */
const WEEK=[['H',15,52,'fáradt'],['K',16,70,'nyugodt'],['Sze',17,null,'nincs emlék'],['Cs',18,82,'erős'],['P',19,40,'nehéz'],['Szo',20,72,'lassú, jó'],['V',21,92,'a legjobb']];
const MEMS=[['t-moon','vasárnap, szept. 21.','Meccs, korai vacsora, és a legjobb éjszakád a héten','A kísérlet egyik találat-napja: 17 óráig bekerült a szénhidrát, a vacsora 20 óra előtt volt, és 8 órát aludtál.','nap.21'],
  ['t-sun','szombat, szept. 20.','Lassú reggel, hosszú séta','Nem volt edzés, délelőtt két órát sétáltál, és délután is nyugodt maradtál.','nap.20'],
  ['t-album','augusztus 12.','Erős pull-nap','A Chest Supported Row 3×8-ra ment, és délután is maradt energia. Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment.','emlek'],
  ['t-album','augusztus 11.','Pihenőnap, sok séta','Ebédnél kimaradt a fehérje, este pótoltad. A napló szerint feszült voltál a munka miatt, de a lefekvés így is 23:00 előtt volt.','emlek'],
  ['t-album','augusztus 10.','Röpi este, három szett','A harmadikban elfogyott a lendület. Utána későn vacsoráztál, az alvás felszínes lett.','emlek']];
const SIM3=[['augusztus 9.','47 napja','Rossz alvás a késő esti edzés után; másnap nehezebben indult a nap.',88],['július 28.','59 napja','Rövid éjszaka röpi után, reggel fáradtság, délutánra rendbe jött.',79],['július 14.','73 napja','Hosszú edzés, késői vacsora, két ébredés.',71]];
function emlekek3(a){if(a)return O.emlekek(a);const on=/3 hasonló nap a memóriából/.test(O.emlekek(''));
  const week=`<div class="w6-wk">${WEEK.map(([d,n,p,w])=>`<button class="w6-d${p==null?' x':''}${n===21?' now':''}" ${p==null?'data-toast="Ezen a napon nem született emlék"':`data-go="nap.${n}"`} aria-label="${d} ${n}. · ${w}"><span class="t"><i style="height:${p||0}%;--c:${p!=null&&p<50?'#E7B25A':'var(--dom)'}"></i></span><b>${d} ${n}</b><small>${w}</small></button>`).join('')}</div>`;
  const top=`<section class="mx-s ex-hero"><small class="ex-eb">A heted története · szept. 15–21.</small><h2 class="n7-h">Apró fordulatok.</h2>
    ${mzLine('Nem egy nagy elhatározás: egy korábban lezárt este, egy meccs, és egy mondat, amit végre leírtál. Négy rövid lépésben mesélem el.')}
    <p class="w5-cap">Milyen volt a heted</p>${week}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="memoar">Olvasom</button><button class="n8-b" data-go="archivum">Archívum · 6 fejezet</button></div></section>`;
  const mem=`<section class="mx-s ln">${KH('Napi emlékek','éjszakai összefoglalók')}<div class="w3-l">${MEMS.map(([ic,d,t,x,go])=>`<article class="w3-c"><button class="w3-tap" data-go="${go}" aria-label="${t} · elolvasom">
    <span class="w3-hd">${E.drop(ic)}<span class="g"><b>${t}</b></span></span><span class="w3-x">${x}</span><span class="w3-f"><i class="w3-st n w6-dt">${d}</i><span class="n8-b">Elolvasom</span></span></button></article>`).join('')}</div></section>`;
  const ex=['rossz alvás edzés után','fáradt hétfő','jó nap meccs után'];
  const srch=`<section class="mx-s ln">${KH('Hasonló napok','mikor éreztem már így magam?')}
    <button class="w6-s" data-m="srch">${I('t-lens')}<span class="${on?'on':''}">${on?'rossz alvás edzés után':'Milyen napot keresel?'}</span><b>${on?'Törlés':'Keresés'}</b></button>
    ${on?`<div class="w3-l w6-hits">${SIM3.map(([d,ago,x,p])=>`<button class="w5-f w6-h" data-go="emlek"><span class="g"><b>${d} · ${ago}</b><small>${x}</small><span class="w4-lv"><span class="t"><i style="width:${p}%;--c:var(--dom)"></i></span><b>${p}%</b></span></span></button>`).join('')}</div>${mzLine('A szám azt mutatja, mennyire hasonlít az a nap a keresésedre.')}`
      :`<div class="w6-ex">${ex.map(t=>`<button class="n8-b" data-m="srch">${t}</button>`).join('')}</div>`}</section>`;
  const row=(ic,t,sub,attr)=>`<button class="ex-mrow w4-r" ${attr}>${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i></span><em>›</em></button>`;
  const more=`<section class="mx-s ln">${KH('Tovább')}<div class="w4-rl">${row('t-calendar','Heti értékelés','az Én · Hét oldalán','data-toast="Heti értékelés — az Én területen"')}${row('t-layers','Memória','rétegek és audit','data-go="memoria"')}</div></section>`;
  return page('mezo',{title:'Emlékek',sub:'Mezo · a te történeted',tab:'emlekek'},`<div class="mx">${top}${mem}${srch}${more}</div>`)}
mz.routes.emlekek=emlekek3;

/* ═══ AZ ÜGY OLDALA · vacsora (2026-11-02): no orange box; the title stays (sub-page), the eyebrow, the sentence and the
   same picture as the wall card (the two vessels), so he recognises it; the same answer block as the drawer (shared state
   with the wall card); what Alvás sees in full; the thread as cards (Mezo's decision marked); the fourteen evenings at
   the bottom in "Miből látszik" (owner's pick), grouped by kind so they read without a legend, then the evidence rows. ═══ */
const VD=[['8.',7.9,1],['9.',5.4,0],['10.',8.0,1],['11.',6.1,1,1],['12.',5.9,0],['13.',7.8,1],['14.',7.7,1],['15.',7.3,0,1],['16.',8.1,1],['17.',5.6,0],['18.',6.3,1,1],['19.',7.8,1],['20.',5.8,0],['21.',7.8,1]];
const nights=(g,l)=>{const ds=VD.filter(d=>d[2]===g);return `<div class="w7-ng"><p class="w7-nl">${l} · ${ds.length} este</p><div class="w7-nr">${ds.map(([d,v,,x])=>`<span class="w7-n${x?' x':''}"><span class="t"><i style="height:${Math.round((v-4)/5*100)}%;--c:${g?'var(--dom)':'#E7B25A'}"></i></span><b>${v.toFixed(1).replace('.',',')}</b><small>${d}</small></span>`).join('')}</div></div>`};
const CMT=[['falat','étrend','Nálam is a <b>23 óra utáni vacsora</b> a vízválasztó: azokon a napokon átlag <b>380 kcal</b> csúszik este 9 utánra. Két hét még, és szét tudom szedni, hogy a mennyiség vagy az időpont számít-e. A tippem: <b>az időpont</b>.'],
  ['szk','visszakérdez','Mielőtt megszeretjük ezt a történetet: a hétvége önmagában is magyarázhatja. Akkor eszel későn <b>és</b> akkor alszol rosszabbul, a kettő között nem kell ok-okozatnak lennie. Javaslom, válasszuk szét a hétköznapot a hétvégétől. Ha hétköznap is kirajzolódik, meggyőztetek.'],
  ['mezo','a csapat döntése','A Szkeptikus javaslatát elfogadom: mostantól a hétvégét <b>külön követjük</b>, és addig ez <b>nem kerül</b> a rólad szóló képbe. Ha a hétköznapi napokon is kirajzolódik, jövő vasárnap újra elővesszük, és szavazunk róla.',1]];
function poszt3(a){if(a&&a!=='vacsora')return O.poszt(a);const p=byId('vacsora');
  const row=(ic,t,sub,go)=>`<button class="ex-mrow w4-r" data-go="${go}">${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i></span><em>›</em></button>`;
  return page('mezo',{title:'Mi tolja későbbre az estédet?',sub:'Közös ügy · alvás × étkezés',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero"><small class="ex-eb w5-by">${badge('szunya',{s:26})}Alvás · rád vár · tegnap 20:30</small><h2 class="n7-h">${p.h}</h2>
    <div class="w7-pic">${p.pic()}</div>
    <div class="w7-ans" data-w7a="vacsora">${ansOf(p)}</div></section>
  <section class="mx-s ln">${KH('Amit az Alvás lát')}<article class="w7-cm">${badge('szunya',{s:40})}<div><b>Alvás <small>bevonta az Étkezést és a Szkeptikust</small></b><p>${p.x}</p></div></article></section>
  <section class="mx-s ln">${KH('Beszélgetés','3 hozzászólás')}<div class="w3-l">${CMT.map(([k,role,t,dec])=>`<article class="w7-cm${dec?' dec':''}">${badge(k,{s:40})}<div><b>${TN[k]} <small>${role}</small></b><p>${t}</p></div></article>`).join('')}</div>
    <button class="w6-s w7-rp" data-sheet="reply">${I('t-chat')}<span>Te hogy látod? Válaszolj…</span><b>Írok</b></button></section>
  <section class="mx-s ln">${KH('Miből látszik?')}<p class="w7-sum">11 este mellette szól, 3 ellene.</p>${nights(0,'Késői vacsora után')}${nights(1,'Korai vacsora után')}
    ${mzLine('A szám az alvásod aznap éjjel. A szaggatott este ellene szól: ott a vacsora ideje és az alvás nem együtt mozgott.')}
    <div class="w4-rl w7-rows">${row('t-clock','14 közös nap','ahol vacsoraidő és alvásminőség is rögzült','minta.vacsora')}${row('t-info','A napok egyenként','vacsoraidő és alvás, estéről estére','bizonyitek')}</div></section></div>`)}
/* ═══ THE OTHER FOUR CASE PAGES (2026-11-02, owner: "jöhet a négy ügy-oldal"): the vacsora page's order on each — the
   eyebrow with who and what kind, the sentence, the case's own picture, the answer (shared with its wall card where it has
   one); what the field sees on a card; the thread as cards; the evidence last, as tubes grouped by kind so they read
   without a legend. No orange box, no emojis, no grey notes (they became Mezo's lines). ═══ */
const tubes=(l,items,c)=>`<div class="w7-ng"><p class="w7-nl">${l}</p><div class="w7-nr">${items.map(([d,t,p,x])=>`<span class="w7-n${x?' x':''}"><span class="t"><i style="height:${Math.max(p,0)}%;--c:${c}"></i></span><b>${t}</b><small>${d}</small></span>`).join('')}</div></div>`;
const cm7=(k,role,t,dec)=>`<article class="w7-cm${dec?' dec':''}">${badge(k,{s:40})}<div><b>${TN[k]} <small>${role}</small></b><p>${t}</p></div></article>`;
const rp7=`<button class="w6-s w7-rp" data-sheet="reply">${I('t-chat')}<span>Te hogy látod? Válaszolj…</span><b>Írok</b></button>`;
const row7=(ic,t,sub,attr)=>`<button class="ex-mrow w4-r" ${attr}>${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub}</i></span><em>›</em></button>`;
const info7=(ic,t,sub,chip='')=>`<div class="ex-mrow w4-r w5-le">${E.drop(ic)}<span class="g"><b>${t}</b><i class="q">${sub.replace(/<\/?b>/g,'')}</i>${chip}</span></div>`;
const eb7=(k,t)=>`<small class="ex-eb w5-by">${badge(k,{s:26})}${t}</small>`;
const AN7=id=>`<div class="w7-ans" data-w7a="${id}">${ansOf(byId(id))}</div>`;
/* the decision has no wall card of its own (it waits in Rád vár), so it gets a post object for the shared answer state */
POSTS.push({id:'dontes',day:'-',who:'falat',t:'',kind:'döntés kell',flag:'Döntés',dec:1,h:'Korábbi vacsora, nyugodtabb este?',x:''});
const DD=[['4.',0,1],['5.',320,0],['6.',60,1],['7.',0,1],['8.',280,0],['9.',120,1],['10.',0,1],['11.',410,0],['12.',80,1],['13.',0,0,1],['14.',0,1],['15.',350,0],['16.',0,1],['17.',260,1,1],['18.',240,0],['19.',40,1],['20.',380,0],['21.',0,1]];
const KM=[['aug. 24.',88,0],['aug. 31.',90,0],['szept. 3.',87,0],['szept. 7.',91,0],['szept. 10.',89,0],['szept. 18.',95,1],['szept. 21.',97,1]];
const KDAYS=[['Cs','',1],['P','',1],['Szo','',2],['V','',1],['H','ma',3],['K','',0],['Sze','',0]];
const kday=()=>`<div class="w7-dy">${KDAYS.map(([d,w,s])=>{const on=s===1||(s===3&&WS.adag);return `<span class="w7-d${on?' on':''}${s===2?' off':''}${s===3&&!WS.adag?' now':''}"><i></i><b>${d}</b><small>${s===1||(s===3&&WS.adag)?TICK:w}</small></span>`}).join('')}</div><p class="w7-dc">Teli kapszula: a nap rendben lezajlott. A szombat nem volt meccsnap, a szaggatott a mai este.</p>`;
const kAns=()=>WS.adag?`<p class="w3-ok">${TICK}Megjelölve: ma 17 óráig bekerült a szénhidrát.</p><button class="fh-lk" data-w3="adag">Visszavonom</button>`
  :`<div class="w3-ab"><button class="n9-btn" data-w3="adag">Ma esti adag: megvolt</button><button class="n8-b" data-sheet="reply">Elmesélem</button></div>`;
const CASES={
 kiserlet:()=>page('mezo',{title:'Meccs előtti szénhidrát',sub:'Közös kísérlet · Étkezés × Mozgás',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('falat','Étkezés × Mozgás · kísérlet · 4 / 7 nap')}<h2 class="n7-h">Stabilabb az ugrásod, ha meccs előtt szénhidrátot kapsz?</h2>
    <div class="w7-pic">${pair(['szénhidrát nélkül','89%',45,'#E7B25A'],['80 g szénhidráttal','96%',80,'var(--dom)'],'helyett','Ennyi marad meg az ugrásodból a 4. szettre')}</div>
    <div class="w7-ans" data-w7k="1">${kAns()}</div></section>
  <section class="mx-s ln">${KH('A terv')}<article class="w7-cm">${badge('falat',{s:40})}<div><b>Étkezés <small>a kísérlet gazdája</small></b><p>Meccsnapokon <b>17 óráig 80 g szénhidrát</b>, aztán megnézzük, mit mond a 4. szett. Két meccsnapon már próbáltuk, és mindkétszer stabilabb volt a végjáték.</p></div></article>
    <div class="w7-kd" data-w7d="1">${kday()}</div></section>
  <section class="mx-s ln">${KH('Eddigi meccsnapok','2 találat a 2-ből')}<div class="w3-l">
    ${info7('t-up','4. szett: az ugrásmagasság kitartott','Szept. 18., csütörtök. 80 g szénhidrát 16:40-ig. A meccs utáni jelentkezésed: „végig volt erőm”.',`<i class="w3-st ok w7-hit">${TICK}Találat</i>`)}${info7('t-up','Végjátékban is stabil láb','Szept. 21., vasárnap. 75 g szénhidrát 17:00-ig. A Mozgás a szettenkénti bontást is átnézte.',`<i class="w3-st ok w7-hit">${TICK}Találat</i>`)}</div></section>
  <section class="mx-s ln">${KH('Beszélgetés','1 hozzászólás')}<div class="w3-l">${cm7('mocor','mozgás','A szettenkénti bontásban is látszik: a 4. szett ugrásai a 2. szetthez képest csak <b>4%-ot</b> estek, a próba előtt ez <b>11%</b> volt. Még két meccsnap, és kimondhatjuk. Addig ne változtass semmi máson, mert összekeveri a képet.')}</div>${rp7}</section>
  <section class="mx-s ln">${KH('Miből látszik?')}<p class="w7-sum">Mindkét próba-meccsen többet tartottál meg.</p>
    ${tubes('Szénhidrát nélkül · 5 meccs',KM.filter(m=>!m[2]).map(([d,v])=>[d.replace(/^\D+/,''),v+'%',(v-80)*5]),'#E7B25A')}${tubes('80 g szénhidráttal · 2 meccs',KM.filter(m=>m[2]).map(([d,v])=>[d.replace(/^\D+/,''),v+'%',(v-80)*5]),'var(--dom)')}
    ${mzLine('A szám azt mutatja, mennyi maradt meg az ugrásodból a 4. szettre a 2. szetthez képest. Hét meccs, augusztus 24-től szeptember 21-ig.')}
    <div class="w4-rl w7-rows">${row7('t-flask','A kísérlet oldala','4 nap a 7-ből · a teljes napló','data-go="kiserlet-oldal.szenhidrat"')}</div></section></div>`),
 sejtes:()=>page('mezo',{title:'Az egyhangú hetek viszik el az energiádat?',sub:'Még csak sejtés · mozgás',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mocor','Mozgás · sejtés · még kevés adat')}<h2 class="n7-h">Ha három napig ugyanaz megy, a negyediken laposabb vagy.</h2>
    <div class="w7-pic">${pair(['vegyes terhelés után','6,4',68,'var(--dom)'],['3 egyforma nap után','5,2',46,'#E7B25A'],'1,2 ponttal kevesebb','A reggeli energiád átlaga · 5 közös nap')}</div>
    ${AN7('sejtes')}</section>
  <section class="mx-s ln">${KH('Amit a Mozgás lát')}${cm7('mocor','5 közös nap a 8-ból','Ötször láttam eddig: három egyforma terhelésű nap után a reggeli energiád <b>átlag 1,2 ponttal</b> alacsonyabb. Ez még nem bizonyíték: nyolc közös nap kell, hogy kimondjam, és a Szkeptikus is figyel.')}</section>
  <section class="mx-s ln">${KH('Mi kellene még?')}<div class="w4-rl">${info7('t-bolt','Egy változatosabb hét','Ha jövő héten vegyes a terhelés, és az energiád nem esik, az ellene szól. Azt is megköszönöm.')}${info7('t-heart','3 további reggeli bejelentkezés','A Közérzet gyűjti. Az energiapontod nélkül nincs mihez mérni.')}</div></section>
  <section class="mx-s ln">${KH('Beszélgetés','1 hozzászólás')}<div class="w3-l">${cm7('szk','visszakérdez','Öt eset kevés, és a hét vége felé amúgy is fáradtabb az ember. Kérlek, a nyolcból legalább kettő legyen <b>hét eleji</b> egyforma blokk, különben a naptár magyarázza, nem a terhelés.')}</div>${rp7}</section>
  <section class="mx-s ln">${KH('Miből látszik?')}<p class="w7-sum">5 közös nap a 8-ból.</p><div class="w7-pic">${caps(8,5,'Nyolc kell, hogy kimondja. Az üres kapszulák még hiányoznak.',1)}</div>
    <div class="w4-rl w7-rows">${row7('t-clock','Az 5 eddigi eset','terhelés és reggeli energia, napról napra','data-go="minta.egyhangu"')}</div></section></div>`),
 dontes:()=>page('mezo',{title:'Korábbi vacsora, nyugodtabb este?',sub:'Döntésre vár · étkezés',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('falat','Étkezés · a te döntésed kell · 18 nap')}<h2 class="n7-h">A 19 óra előtti vacsoráid után nyugodtabbak az estéid.</h2>
    <div class="w7-pic">${pair(['késői vacsora után','280',67,'#E7B25A'],['19 előtti vacsora után','50',12,'var(--dom)'],'helyett','A késő esti nassolás átlaga, kalóriában')}</div>
    ${mzLine('Ha igent mondasz, ez bekerül a rólad szóló képbe. Bármikor visszavonhatod a Rólad oldalon.')}
    ${AN7('dontes')}</section>
  <section class="mx-s ln">${KH('Amit az Étkezés lát')}${cm7('falat','18 nap','18 napot tudtam összevetni: a korai vacsorás estéken kevesebb a késő esti nassolás, és <b>korábbi a lefekvés</b> is. A számok szerint ez már nem véletlen, de a te megerősítésed nélkül nem kerül a rólad szóló képbe.')}</section>
  <section class="mx-s ln">${KH('Ha bekerül, mire használjuk?')}<div class="w4-rl">${info7('t-clock','Az esti javaslatok időzítése','Az Étkezés 18 óra körül szól majd, nem fél tízkor.')}${row7('t-moon','A késői vacsora ügye','ez a minta annak egyik építőköve lesz','data-go="poszt.vacsora"')}</div></section>
  <section class="mx-s ln">${KH('Miből látszik?')}<p class="w7-sum">16 este mellette szól, 2 ellene.</p>
    ${tubes('19 előtti vacsora után · 11 este',DD.filter(d=>d[2]).map(([d,v,,x])=>[d,String(v),Math.round(v/4.2),x]),'var(--dom)')}${tubes('Késői vacsora után · 7 este',DD.filter(d=>!d[2]).map(([d,v,,x])=>[d,String(v),Math.round(v/4.2),x]),'#E7B25A')}
    ${mzLine('A szám a késő esti nassolás kalóriában, szeptember 4-től 21-ig. A szaggatott este ellene szól.')}</section></div>`),
 elorejelzes:()=>page('mezo',{title:'Könnyebb az edzés, ha jól aludtál?',sub:'Lezárt előrejelzés · mozgás',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mocor','Mozgás · lezárt előrejelzés · vasárnap')}<h2 class="n7-h">Ez most nem jött be, és ez is számít.</h2>
    <div class="w7-pic">${pair(['ezt vártam','7 alatt',62,'color-mix(in srgb,var(--dom) 45%,#fff)'],['ez történt','7,5–8',78,'#E7B25A'],'helyett','Mennyire érezted nehéznek az edzést egy jó éjszaka után · tízes skálán')}</div>
    ${AN7('elore')}</section>
  <section class="mx-s ln">${KH('Ezt vártam, és ez történt')}<div class="w3-l">
    ${info7('t-target','Ezt vártam','A jó éjszaka utáni edzés <b>könnyebbnek</b> érződik majd: 7 alatti nehézség.')}
    ${info7('t-up','Ez történt','Ugyanolyannak érezted: <b>7,5 és 8</b> között, a jó éjszakák után is.')}
    ${cm7('mocor','amit ebből tanult','Ebből azt tanultam, hogy nálad az alvás <b>nem az érzeten</b> látszik meg, hanem máshol. Az Alvással most azt nézzük, a súlyoknál jelentkezik-e. A becsléseimet ezért óvatosabbra vettem ennél a jelnél.')}</div></section>
  <section class="mx-s ln">${KH('Beszélgetés','1 hozzászólás')}<div class="w3-l">${cm7('szunya','alvás','Örülök, hogy kimondtad. Nálam közben az látszik, hogy a jó éjszakák utáni napokon <b>korábban</b> kezded az edzést. Lehet, hogy ott a hatás, nem az érzetben. Felveszem gyűlő ügynek.')}</div>${rp7}</section>
  <section class="mx-s ln">${KH('Miből látszik?')}${mzLine('A tévedéseinket is megőrizzük: ettől hihető, amit kimondunk.')}
    <div class="w4-rl w7-rows">${row7('t-info','Az előrejelzés adatai','a várt sáv és a mért edzések','data-go="elore.alvas-edzes"')}</div></section></div>`)};
mz.routes.poszt=a=>CASES[a]?CASES[a]():poszt3(a);
/* ═══ ÉLŐBEN (2026-11-02, owner: "jöhet a három együtt"): the day's live conversation. The approved threads and their
   state machines stay exactly as they are (the late-dinner exchange, the typing Közérzet, the votes): this page cuts them
   out of the approved render and sets them in the new frame — the request for tonight as the sentence, the day's tide as
   the picture, the counts as tags, a real jump to the evening; times of day as plain headings, no emojis; the rule note
   became Mezo's line. ═══ */
O.elo=mz.routes.elo;mz.routes['elo-lista']=O.elo;
const NOEMO=h=>h.replace(/\s?[\p{Extended_Pictographic}️‍]+/gu,'');
function elo8(a){if(a)return O.elo(a);const h=O.elo('');
  const hi=h.indexOf('fh-hero'),hs=h.lastIndexOf('<section',hi),hero=h.slice(hs,bal(h,hs,'section'));
  const tide=cut(hero,'<div class="gt"','div'),facts=[...cut(hero,'<div class="fh-facts"','div').matchAll(/<b>([^<]*)<\/b><small>([^<]*)<\/small>/g)].map(m=>/\//.test(m[1])?`ma ${m[1].split(' / ')[0]} értesítés a ${m[1].split(' / ')[1]}-ből`:`${m[1]} ${m[2]}`);
  const secs=[];let i=bal(h,hs,'section'),head='';
  while(true){const n=h.indexOf('<p class="fh-n',i),c=h.indexOf('<section class="fh-card',i);if(c<0)break;
    if(n>=0&&n<c){const e=h.indexOf('</p>',n);head=h.slice(n,e).replace(/<b>\d+<\/b>/,'').replace(/<[^>]+>/g,'').trim();i=e+4;continue}
    const e=bal(h,c,'section'),inner=h.slice(h.indexOf('>',c)+1,e-'</section>'.length);secs.push([head,inner]);head='';i=e}
  const body=secs.filter(([t])=>t).map(([t,inner])=>`<section class="mx-s ln"${t==='Este'?' id="w8-este"':''}>${KH(t)}<div class="w8-c">${NOEMO(inner)}</div></section>`).join('');
  return page('mezo',{title:'A csapat beszél',sub:'Ma · élőben · hétfő',back:'mai'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('szunya','Az Alvás kérése ma estére')}<h2 class="n7-h">22:45 előtt kerülj ágyba.</h2>
    ${mzLine('Este megnézzük. Mind az öt terület figyel, és csak akkor szólnak, ha teendő van.')}
    <p class="w5-cap">A mai nap szálai</p><div class="w8-tide">${NOEMO(tide)}</div><p class="w8-lg"><span><i class="f"></i>rendeződött</span><span><i class="h"></i>nyitott ügy</span><span><i class="e"></i>még ír</span></p>
    <span class="w3-tg w8-tg">${facts.map(t=>`<span>${t}</span>`).join('')}</span>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-w8="este">Az esti beszélgetéshez</button></div></section>
  ${body}
  <section class="mx-s ln">${KH('Ma este')}<div class="w4-rl">${info7('t-journal','21:00-kor az esti kiadás','Összefoglalja a nap szálait a falon. A nyitva maradt ügyet holnap reggel az Alvás újra előveszi.')}</div>
    ${mzLine('Egy terület csak akkor szól, ha teendő van, és akkor, amikor rendeződött. Naponta legfeljebb két értesítés megy ki, a második csak súlyosabb ügyre.')}${rp7}</section></div>`)}
mz.routes.elo=elo8;
/* ═══ A CSAPAT ALOLDALAI (2026-11-02, owner: "jöhet a csapat-rész a hárommal"). A member's page: the member's own sentence,
   the picture is how its picture of him matured week by week (eight tubes, the old "curve + grey caveat" folded into
   it), the counts as tags, Amit rólad tud wide + Lezárt ügyei; what it works on now as rows with a status chip and a
   level, what it knows as cards, its request as its own card. The council: the stance tubes as the picture, the
   overview / conversation switch IN PLACE (owner rule), the threads open in place, Mezo's decision outlined, the honesty
   note as Mezo's line. The engine room: the sources as tubes, the rows as drop rows, the note as Mezo's line. ═══ */
const ROOMS9={
  szunya:{quote:'Az éjszakáid a szakterületem. Amit itt látsz, azt mind a te naplódból tanultam.',stats:[['15','éjszaka / 60 nap'],['3','beépült tudás']],rows:[
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Közös ügy az Étkezéssel — a te szemed hiányzik hozzá','poszt.vacsora',0],
    ['Gyűlik','q','6 / 8 nap','clock','A hétfői mélypontot a lefekvés ingadozása okozza?','Kb. egy hét, és megszólal — addig csendben számol','',75],
    ['Bekerült','q','szept. 20.','tick','Hétvégén 40 perccel később fekszel','Te erősítetted meg — a rólad szóló kép része','minta.hetvege',0]],
    mat:[52,55,58,58,63,66,70,72],
    tud:[['Hétvégén átlag 40 perccel később fekszel, és ezt a hétfőd érzi meg','te erősítetted meg','szept. 20.','Beépült'],['A jó éjszakáid 23:15 előtti lefekvéssel kezdődnek','12 éjszaka mintája','szept. 5.','Beépült'],['A 16 óra utáni kávé nyugtalanabb éjszakát hoz nálad','8 éjszaka + a te válaszod','aug. 30.','Beépült']],
    arch:[['Nyugdíjazva','3 hétig nem erősödött','moon','A délutáni alvás rontja az éjszakát?','Nem gyűlt hozzá elég nap — ha újra felbukkan, előveszi'],['Elvetetted','a te döntésed','skip','Képernyő lefekvés előtt = rossz alvás?','Azt mondtad, nálad nem így van — a csapat elfogadta']],
    ask:'Kérése: két hétből csak 6 éjszakát naplóztál — minden hiányzó éjszaka egy nappal tolja ki, mire biztosat mondhat.'},
  mocor:{quote:'A terhelésed és az erőd — és az, hogy a napló ne maradjon el. Nem hajtalak, de észreveszem.',stats:[['15','edzésnap / 60 nap'],['1','sejtés']],rows:[
    ['Sejtés','q','5 / 8 nap','bolt','Az egyhangú hetek viszik el az energiádat?','Még nem mondja ki — egy változatosabb hét kellene hozzá','poszt.sejtes',62],
    ['Kísérlet','q','4 / 7 nap','flask','Séta ebéd után — nyugodtabb lesz a délután?','Közös próba az Étkezéssel, együtt nézik majd az eredményt','poszt.kiserlet',57],
    ['Nem jött be','q','lezárva','down','Könnyebb az edzés, ha jól aludtál?','Nem igazolódott — ebből a jelből óvatosabban következtet','poszt.elorejelzes',0]],
    mat:[40,44,47,50,52,55,58,60],
    tud:[['Kihagyott nap után erősebben jössz vissza — az újrakezdés a te terepad','5 visszatérés mintája','szept. 12.','Beépült'],['A felsőtest-napok reggelén magasabb az energiád','9 edzésnap','szept. 2.','Beépült']],
    arch:[['Nem jött be','lezárva vasárnap','down','Könnyebb az edzés, ha jól aludtál?','Az érzeten nem látszik — az Alvással a súlyoknál keressük tovább']],
    ask:'Kérése: a szettek súlyát is írd fel — abból látja a valódi terhelést.'},
  falat:{quote:'A tányérod, a célod és az edzésed üzemanyaga. Minden este három szólamban értékelek.',stats:[['28','kajanap / 60 nap'],['1','aktív kísérlet']],rows:[
    ['Kísérlet','q','4 / 7 nap','flask','Meccs előtti szénhidrát — stabilabb az ugrásod?','Közös próba a Mozgással · ma este megint meccs','poszt.kiserlet',57],
    ['Rád vár','warn','14 közös nap','moon','Rosszabbul alszol, ha későn vacsorázol?','Közös ügy az Alvással — onnan indult, az Étkezés a vacsora-oldalt nézi','poszt.vacsora',0],
    ['Döntésre vár','warn','18 nap','sprout','Korábbi vacsora, nyugodtabb este?','Elég napja van hozzá — most a te döntésed kell','poszt.dontes',0]],
    mat:[60,64,68,70,73,76,78,80],
    tud:[['A fehérje-célod stabilan megvan — ez a te erősséged','21 nap átlaga','szept. 15.','Beépült'],['Hétvégén előfordul, hogy utólag naplózol','a te pontosításod','szept. 8.','Tőled'],['Edzésnapokon kisebb az esti sóvárgás','14 nap összevetése','aug. 28.','Beépült']],
    arch:[['Nyugdíjazva','nem erősödött','sugar','A reggeli cukor dönti el a napod?','6 hét után sem állt össze — pihen']],
    ask:'Napi műsora: a tányér · a cél · az edzés — minden este.'},
  deru:{quote:'Én arra figyelek, hogy vagy. Ehhez a te szavad kell — egy-egy rövid esti bejelentkezés.',stats:[['8','bejelentkezés / 60 nap'],['0','nyitott ügy']],rows:[
    ['Kérés','warn','1 perc','heart','Bejelentkezel ma este?','Hétvégére már látja, mi mozgatja az energiádat','',0]],
    mat:[18,20,22,24,25,27,28,30],
    tud:[['A jó napjaid reggeli mozgással kezdődnek','6 bejelentkezés + edzésnapló','szept. 10.','Beépült']],arch:[],
    ask:'Kevés az adata: két hétből 4 este. Ma bejelentkezést kért tőled.'},
  mezo:{quote:'Én fogom össze a csapatot. Csak az kerül a rólad szóló képbe, amiben egyetértünk.',stats:[['2','bekerült a héten'],['4','forduló']],rows:[
    ['Konzílium','q','vasárnap','journal','Mi került be rólad a héten?','2 bekerült · 1 nyugdíjazva — a jegyzőkönyv olvasható','konzilium',0],
    ['Krónika','q','készül','book','A heted története','Memoár-fejezet érkezik vasárnap estére','memoar',0],
    ['Dev','q','ajtó','info','Gépterem · Összes funkció','Futások, adatforrások, memória — a motorháztető alatt','gepterem',0]],
    mat:[50,53,55,58,60,62,64,66],
    tud:[['Szereted látni, mi miből következik — az indoklás neked jár','a te kérésed','aug. 20.','Tőled'],['Új munkarendet próbálsz szeptembertől','életesemény · tőled','szept. 1.','Tőled']],
    arch:[['Visszadobva','a Szkeptikus kérésére','skip','A hétvégi késés csak a röplabda miatt van?','Kevés volt mögötte a nap — várólistán']],
    ask:'A közös kép gondnoka: minden tény, esemény és döntés nála kereshető vissza.'}
};
const RIC={moon:'t-moon',clock:'t-clock',tick:'t-tick',bolt:'t-bolt',flask:'t-flask',down:'t-down',sprout:'t-sprout',heart:'t-heart',journal:'t-journal',book:'t-book',info:'t-info'};
const AREA9={szunya:'pihenés',mocor:'terhelés',falat:'étrend',deru:'hangulat',mezo:'a csapat'};
const stw=s=>/Rád vár|Döntés|Kérés/.test(s)?'w':/Bekerült|Beépült/.test(s)?'ok':'n';
function szoba9(id){const q=ROOMS9[id];if(!q)return O.szoba(id);const c=TC4(id),mt=q.mat,up=mt[7]-mt[4];
  const wk=mt.map((v,i)=>[i===7?'most':i===0?'7 hete':'',v+'%',v]);
  const work=q.rows.map(([s,k,meta,ic,t,sb,go,pct])=>`<button class="ex-mrow w4-r w9-r" ${go?`data-go="${go}"`:'data-toast="Saját oldala a megvalósításban nyílik meg"'}>${E.drop(RIC[ic]||'t-info')}<span class="g"><b>${t}</b><i class="q">${meta} · ${NOEMO(sb).replace(' — ',', ')}</i>${pct?`<span class="w4-lv"><span class="t"><i style="width:${pct}%;--c:${c}"></i></span><b>${pct}%</b></span>`:''}<i class="w3-st ${stw(s)}">${s}</i></span>${go?'<em>›</em>':''}</button>`).join('');
  const knows=q.tud.slice(0,3).map(([t,s,d,k])=>info7(k==='Tőled'?'t-chat':'t-tick',t.replace(' — ',', '),`${s} · ${d}`,`<i class="w3-st ${k==='Tőled'?'n':'ok'} w7-hit">${k==='Tőled'?'tőled':'beépült'}</i>`)).join('');
  return page('mezo',{title:TN[id],sub:`A csapat · ${AREA9[id]}`,back:'csapat'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7(id,`${TN[id]} · ${AREA9[id]}`)}<h2 class="n7-h w5-q">„${q.quote.replace(' — ',', ')}”</h2>
    <p class="w5-cap">Így érett a képe rólad · 3 hét alatt +${up}%</p>${tubes('',wk.map(([l,t,v])=>[l,t,v]),c).replace('<p class="w7-nl"></p>','')}
    <span class="w3-tg w8-tg">${[`${mt[7]}% érett`,...q.stats.map(([n,l])=>`${n} ${l.replace(' / ',' az elmúlt ').replace('60 nap','60 napból')}`)].map(t=>`<span>${t}</span>`).join('')}</span>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="tud.${id}">Amit rólad tud</button>${q.arch.length?`<button class="n8-b" data-go="ugyek.${id}">Lezárt ügyei · ${q.arch.length}</button>`:''}</div></section>
  <section class="mx-s ln">${KH('Most ezen dolgozik')}<div class="w4-rl">${work}</div></section>
  <section class="mx-s ln">${KH('Amit rólad tud',q.tud.length+' dolog')}<div class="w4-rl">${knows}</div>
    ${q.tud.length>3?`<div class="ex-acts w3-wide"><button class="n9-btn" data-go="tud.${id}">Mind a ${q.tud.length}</button></div>`:''}</section>
  <section class="mx-s ln">${KH(id==='falat'?'A napi műsora':'Kérése hozzád')}${cm7(id,AREA9[id],(t=>t[0].toUpperCase()+t.slice(1))(q.ask.replace(/^(Kérése|Napi műsora): /,'').replace(/ — /g,', ')))}
    ${id==='deru'?'<div class="ex-acts w3-wide"><button class="n9-btn" data-toast="Bejelentkezés — 1 perces közérzet-kör">Bejelentkezem · 1 perc</button></div>':''}</section></div>`)}
O.szoba=mz.routes.szoba;mz.routes['szoba-lista']=O.szoba;mz.routes.szoba=szoba9;

const KS={v:'ov',th:'t1'};
const TH9=[{id:'t1',t:'Regeneráció',f:['szunya','deru','mocor'],sub:'2 állítás · 3 hozzászólás'},{id:'t2',t:'Táplálkozás',f:['falat','szk'],sub:'1 állítás · nem vitatták',it:[['Elvetve','A hétvégi fehérje-elmaradás három hete következetes mintázat.']]},
  {id:'t3',t:'Test',f:['deru'],sub:'1 állítás · 1 elfogadva',it:[['Bekerült','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.']]},{id:'t4',t:'Fegyelem',f:['mocor'],sub:'1 állítás · 1 elfogadva',it:[['Nyugdíjazva','A hétvégi naplózás rendszeresen elmarad.']]}];
const thBody=t=>t.id==='t1'?cm7('szunya','felvetette','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')+cm7('deru','támogatja','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')+cm7('mocor','vitatja','Szerintem ez nem alvás, hanem hétvégi program, nem viselkedési minta.')+cm7('szk','meghagyta · biztos','Hat hét adat, konzisztens.')+cm7('mezo','bekerült · biztos','Bekerül a dossziéba: a Szkeptikus érvét fogadom el.',1)
  :t.it.map(([s,x])=>`<article class="w5-f">${E.drop('t-note')}<span class="g"><b>${x}</b><i class="w3-st ${stw(s)}">${s}</i></span></article>`).join('');
const thCard=t=>`<article class="w3-c w9-th${KS.th===t.id?' on':''}" data-w9t="${t.id}"><button class="w3-tap" data-w9="th:${t.id}" aria-expanded="${KS.th===t.id}"><span class="w3-hd">${minis(t.f)}<span class="g"><b>${t.t}</b><small>${t.sub}</small></span><span class="n8-b">${KS.th===t.id?'Bezárom':'Megnyitom'}</span></span></button><div class="w9-tb">${thBody(t)}</div></article>`;
function konz9(a){if(a)return O.konzilium(a);
  const ov=`<div class="w9-v" data-w9v="ov"${KS.v==='ov'?'':' hidden'}>
    <section class="mx-s ln">${KH('Hogyan zajlott','4 forduló')}<div class="w3-rl">${[['Javaslat','5 felvetés','Ki mit hozott az asztalra: Alvás 2, Étkezés 1, Közérzet 1, Mozgás 1'],['Kereszt-vita','3 hozzászólás','Ahol egymás felvetéseit nézték: a Közérzet az Alvás mellé állt, a Mozgás vitatta'],['Szkeptikus','5 vizsgálat','A kételkedés köre: a fehérje-ügyet kevés napnak találta'],['Mezo dönt','3 elfogadva · 2 elvetve','Ami a képedbe került: a hétvégi lefekvés-minta és a rekompozíció']].map(([t,m,x],i)=>`<div class="w3-rw"><span class="w9-n">${i+1}.</span><span class="g"><b>${t} · ${m}</b><small>${x}</small></span></div>`).join('')}</div></section>
    <section class="mx-s ln">${KH('A szálak','4')}<div class="w3-l">${TH9.map(thCard).join('')}</div></section></div>`;
  const cv=`<div class="w9-v" data-w9v="cv"${KS.v==='cv'?'':' hidden'}>
    <section class="mx-s ln">${KH('Javaslatok','3 felvetés')}<div class="w3-l">${cm7('szunya','alvás','A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.')}${cm7('deru','hangulat','A testzsír-trend és a stagnáló testsúly rekompozícióra utal.')}${cm7('falat','étrend','A hétvégi fehérje-elmaradás három hete következetes mintázat.')}</div></section>
    <section class="mx-s ln">${KH('Kereszt-vita','3 hozzászólás')}<p class="w9-q">„A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.” · Alvás</p><div class="w3-l">${cm7('deru','támogatja','A pulzusvariancia is ezt a két napot mutatja gyengébbnek.')}${cm7('mocor','vitatja','Szerintem ez nem alvás, hanem hétvégi program, nem viselkedési minta.')}${cm7('deru','árnyalja','A kettő nem zárja ki egymást: a program tolja ki, a hatása viszont alvás.')}</div></section>
    <section class="mx-s ln">${KH('A Szkeptikus','2 vizsgálat')}<div class="w3-l">${cm7('szk','meghagyta','Hat hét adat, konzisztens. A Mozgás ellenvetése nem cáfolja a mintát.')}${cm7('szk','kidobta','Három hét túl kevés, és két hétvége nyaralás volt.')}</div></section>
    <section class="mx-s ln">${KH('Mezo dönt','1 bekerült · 1 elvetve')}<div class="w3-l">${cm7('mezo','bekerült · biztos','Bekerül a dossziéba: a Szkeptikus érvét fogadom el.',1)}${cm7('mezo','elvetve','Elvetem: a Szkeptikus kifogása megalapozott.',1)}</div></section></div>`;
  return page('mezo',{title:'Az ülés jegyzőkönyve',sub:'A csapat · konzílium',back:'csapat'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Konzílium · augusztus 30. · heti')}<h2 class="n7-h">2 állítás bekerült rólad, 1 nyugdíjba ment.</h2>
    ${mzLine('Hetente átnézzük az adataidat, megvitatjuk egymás felvetéseit, a Szkeptikus kikérdez minket, és én döntök arról, mi kerül a rólad szóló képbe.')}
    <p class="w5-cap">„A hétvégi lefekvés két órával kitolódik”: ki mennyire áll mellette</p>
    <div class="w4-tb">${F.vials([['szunya',86,'felvetette'],['deru',78,'támogatja'],['mocor',22,'vitatja'],['szk',62,'meghagyta'],['mezo',96,'bekerült']].map(([k,p,s])=>({l:TN[k],s,p,v:p+'%',c:TC4(k),on:{toast:`${TN[k]}: ${s}`}})),{h:110})}</div>
    <span class="w3-tg w8-tg"><span>2 bekerült</span><span>1 nyugdíjazva</span><span>a rólad szóló leírás átírva</span></span>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="rolad">Mi változott rólad?</button></div></section>
  <section class="mx-s ln"><div class="w9-nav"><button class="n8-b" data-toast="Korábbi tanácskozás">‹ Korábbi ülés</button><button class="n8-b" data-sheet="archive">Augusztus 30. · heti</button></div>
    <div class="w9-sw" role="group">${[['ov','Áttekintés'],['cv','A beszélgetés']].map(([k,l])=>`<button class="${KS.v===k?'on':''}" data-w9="v:${k}" aria-pressed="${KS.v===k}">${l}</button>`).join('')}</div></section>
  ${ov}${cv}
  <section class="mx-s ln">${mzLine('Amit itt olvasol, az a valódi beszélgetés, ahogy lezajlott. Utólag nem színezzük ki: a csapat pontosan így mondta.')}</section></div>`)}
O.konzilium=mz.routes.konzilium;mz.routes['konzilium-lista']=O.konzilium;mz.routes.konzilium=konz9;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w9]');if(!b)return;e.preventDefault();const [k,v]=b.dataset.w9.split(':'),ph=document.querySelector('#phone');if(!ph)return;
  if(k==='v'){KS.v=v;ph.querySelectorAll('[data-w9v]').forEach(x=>x.hidden=x.dataset.w9v!==v);ph.querySelectorAll('.w9-sw button').forEach(x=>{const on=x.dataset.w9==='v:'+v;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});return}
  if(k==='th'){KS.th=KS.th===v?'':v;TH9.forEach(t=>{const c=ph.querySelector(`[data-w9t="${t.id}"]`);if(c)c.outerHTML=thCard(t)})}},true);

function gep9(){const row=(ic,t,sub,attr)=>row7(ic,t,sub,attr);
  return page('mezo',{title:'Gépterem',sub:'A csapat · a motorháztető alatt',back:'csapat'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','A gépezet')}<h2 class="n7-h">Legutóbb augusztus 30-án futott: 3 megfigyelés, 2 szakértő hívva.</h2>
    ${mzLine('Ez nem a fal része: ide akkor jössz, ha a gépezetre vagy kíváncsi. Minden, amit a csapat mond, innen ellenőrizhető.')}
    <p class="w5-cap">A naplóid az elmúlt 60 napból</p>
    <div class="w4-tb">${F.vials([['Edzés','t-dumbbell',53],['Alvás','t-moon',58],['Étkezés','t-bowl',56],['Bejelentkezés','t-heart',7]].map(([l,ic,n])=>({l,ic,p:Math.round(n/60*100),v:n+' nap',mark:n<20?'kevés':'',on:'adatforrasok'})),{h:110})}</div>
    <span class="w3-tg w8-tg"><span>emlékezet: 47 nap a 60-ból</span><span>3 megfigyelés</span><span>2 szakértő hívva</span></span>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="futasok">Futások</button></div></section>
  <section class="mx-s ln">${KH('Mi fut a háttérben')}<div class="w4-rl">${[['t-history','Futások','e héten 7 futás · 11 megfigyelés','data-go="futasok"'],['t-link','Adatforrások','a teljes tervezett korpusz','data-go="adatforrasok"'],['t-journal','AI-napló','minden hívás tárolva','data-toast="AI-napló — admin felület"'],['t-radar','Detektorok','az aktív katalógus','data-go="detektorok"'],['t-layers','Memória','rétegek, eredet és költségek','data-go="memoria"'],['t-eye','Megfigyelők','a coaching javaslatainak háttere','data-go="megfigyelo"']].map(a=>row(...a)).join('')}</div></section>
  <section class="mx-s ln">${KH('A régi eszköztár')}<div class="w4-rl">${row('t-grid','Összes funkció','a régi teljes menü, minden eszköz egy helyen','data-go="osszes"')}</div>
    ${mzLine('Minden szakértő-hívást lépésenként mentünk: megfigyelés, javaslat, Szkeptikus, döntés, a rólad szóló leírás. Semmi nem tűnik el.')}</section></div>`)}
O.gepterem=mz.routes.gepterem;mz.routes['gepterem-lista']=O.gepterem;mz.routes.gepterem=gep9;
/* ═══ RÓLAD ALOLDALAI (2026-11-02, owner: "jöhet a Rólad egy körben"). The nine topics: the shelves as the picture, one
   card shape per topic (who watches it, the sentence, a level). One topic: its sentence, how it matured, the overview on
   its owner's card, the claims as cards with a certainty level and the approved answers — kept in place. The facts: the
   fifteen as capsules, filter chips that filter in place, every fact on one card with its switch, the folds opening in
   place. The Tudástár, the categories (two shelves) and the life events (layers, newest on top) in the same frame; every
   grey note became Mezo's line. Own state (R10) — nothing re-renders on a tap. ═══ */
const DIM10=[['physical','deru','Test',58,'A testzsírszázalék lassan csökken, miközben a testsúly stagnál: ez rekompozícióra utal.'],['training','mocor','Edzés',64,'A tartalék-becsléseid pontosak: a mondott tartalék jellemzően 1-en belül megjósolja a következő szettet.'],
 ['nutrition','falat','Étkezés',47,'Hétköznap a fehérje stabilan a cél körül van, hétvégén rendszeresen alatta marad.'],['recovery','szunya','Alvás',71,'A hétvégi lefekvés két órával kitolódik, és ez hétfőn is meglátszik.'],['mind','deru','Lélek',39,'A hála-bejegyzéseid után jellemzően nyugodtabb napot írsz le.'],
 ['discipline','mocor','Fegyelem',66,'A kihagyott naplózást jellemzően másnap reggelre pótolod.'],['life','mezo','Emberek',31,'Az új munkahely első hete óta később fekszel le.'],['selfaudit','szk','Önvizsgálat',34,'A javasolt tényeimből az elmúlt 4 hétben 9-ből 6 maradt meg, 3 kiesett: ez az én találati arányom, nem a te tulajdonságod.'],
 ['chapter','mezo','Munkaciklus',21,'Sűrű munkahetek után jellemzően egyszerre csúszik a naplózás és a lefekvés.']];
const DWHO={selfaudit:'a Szkeptikus vizsgálja',chapter:'a csapat közösen tölti'};
const R10={fb:{},off:{},fold:{wait:true},back:{},cat:'m'};
const dshelf=ds=>`<div class="w5-sh">${F.vials(ds.map(([k,o,t,m])=>({l:t,p:m,v:m+'%',c:TC4(o),on:'dimenzio.'+k})),{h:96})}<i class="w5-shf"></i></div>`;
function dims10(a){if(a)return O.dimenziok(a);const top=[...DIM10].sort((x,y)=>y[3]-x[3])[0],low=[...DIM10].sort((x,y)=>x[3]-y[3])[0];
  return page('mezo',{title:'A csapat képe rólad',sub:'Rólad · 9 témakör, mindegyik pontosítható',back:'rolad'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','A közös kép rólad · 9 témakör')}<h2 class="n7-h">A legtöbbet erről tudjuk: ${top[2].toLowerCase()}.</h2>
    ${mzLine(`A legkevesebbet erről: ${low[2].toLowerCase()}, ${low[3]}%. Ott a te szavad számít a legtöbbet.`)}
    <p class="w5-cap">Ennyire érett a kép rólad témakörönként</p>${dshelf(DIM10.slice(0,5))}${dshelf(DIM10.slice(5))}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="dimenzio.${top[0]}">${top[2]}</button></div></section>
  <section class="mx-s ln">${KH('A kilenc témakör')}<div class="w4-rl">${DIM10.map(([k,o,t,m,c])=>`<button class="ex-mrow w4-r w9-r" data-go="dimenzio.${k}">${badge(o,{s:40})}<span class="g"><b>${t}</b><i class="q">${c}</i><span class="w4-lv"><span class="t"><i style="width:${m}%;--c:${TC4(o)}"></i></span><b>${m}%</b></span><i class="w10-by">${DWHO[k]||TN[o]+' figyeli'}</i></span><em>›</em></button>`).join('')}</div></section></div>`)}
O.dimenziok=mz.routes.dimenziok;mz.routes['dimenziok-lista']=O.dimenziok;mz.routes.dimenziok=dims10;

const CL10=[['Biztos',90,'A testzsírszázalék lassan csökken, miközben a testsúly stagnál: ez rekompozícióra utal.'],['Figyeljük',34,'A gyógyszerciklus hetei egyelőre nem mutatnak kimutatható hatást a súlytrenden.'],['Valószínű',64,'A reggeli mérések szórása alacsony: a mérési fegyelmed stabil alapot ad a trendnek.']];
const clCard=(i)=>{const [cf,p,t]=CL10[i],fb=R10.fb[i];return `<article class="w3-c w10-cl${fb==='no'?' dim':''}" data-w10c="${i}"><div class="w10-cb"><i class="w3-st ${fb==='no'?'n':cf==='Biztos'?'ok':'n'}">${fb==='no'?'nyugdíjazva':cf}</i><p>${t}</p>
  ${fb==='no'?'':`<span class="w4-lv"><span class="t"><i style="width:${p}%;--c:var(--dom)"></i></span><b>${p}%</b></span><p class="w4-lb">ennyire biztos benne a csapat</p>`}
  ${fb==='no'?`<p class="w3-ok n">Nyugdíjazva: a csapat nem viszi tovább.</p><button class="fh-lk" data-w10="fb:${i}:">Visszavonom</button>`:fb==='yes'?`<p class="w3-ok">${TICK}Köszönöm, jegyzem.</p><button class="fh-lk" data-w10="fb:${i}:">Visszavonom</button>`
   :`<div class="w3-ab"><button class="n9-btn" data-w10="fb:${i}:yes">Talál</button><button class="n8-b" data-w10="fb:${i}:no">Nem igaz</button><button class="n8-b" data-sheet="reply">Pontosítom</button></div><div class="w3-lk"><button class="fh-lk" data-sheet="mibol" data-arg="${t}">Miből látom? ›</button></div>`}</div></article>`};
function dim10(k){const d=DIM10.find(x=>x[0]===k);if(!d)return O.dimenzio(k);const [,o,t,m,c]=d,col=TC4(o);
  const wk=Array.from({length:8},(_,i)=>{const v=Math.max(4,m-(7-i)*3);return [i===7?'most':i===0?'7 hete':'',v+'%',v]});
  return page('mezo',{title:t,sub:`Témakör · ${DWHO[k]||TN[o]+' figyeli'}`,back:'dimenziok'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7(o,`${t} · ${m}% érett · ${DWHO[k]||TN[o]+' figyeli'}`)}<h2 class="n7-h">${c}</h2>
    <p class="w5-cap">Így érett ez a témakör hétről hétre</p>${tubes('',wk,col).replace('<p class="w7-nl"></p>','')}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="chat">Beszélgetek erről Mezóval</button></div></section>
  <section class="mx-s ln">${KH('Összkép')}${cm7(o,DWHO[k]||'figyeli','A testösszetételed lassan, de biztosan javul: a testzsír-trend nagyjából három hónap alatt csökken, miközben a testsúlyod gyakorlatilag helyben áll. Ez arra utal, hogy a hipertrófia-blokkok tényleg izmot építenek, nem csak számokat mozgatnak.')}</section>
  <section class="mx-s ln">${KH('Állítások','3')}<div class="w3-l">${CL10.map((_,i)=>clCard(i)).join('')}</div>
    ${mzLine('Az állítások bizonyítékból születnek, sosem fordítva. Amit tévesnek mondasz, azt a csapat nem vitatja tovább.')}</section></div>`)}
O.dimenzio=mz.routes.dimenzio;mz.routes['dimenzio-lista']=O.dimenzio;mz.routes.dimenzio=dim10;

const CAT10={e:['edzés','t-dumbbell'],t:['étkezés','t-bowl'],g:['egészség','t-heart'],l:['élet','t-sun']};
const F10=[['f0','e','Pull Day-en a Chest Supported Row a fő összetett gyakorlat.',12,'beszélgetésből','in'],['f1','t','A késői étkezés és az alvásminőség együtt mozog.',8,'mintából','in'],['f2','g','A reggeli mérés 7:00 és 7:30 között történik.',6,'beszélgetésből','in'],['f3','l','Röplabda: kedd, csütörtök és szombat.',5,'kézzel','in'],
 ['w1','t','Hétvégén később kezdődik az első étkezés.',2,'beszélgetésből','wait'],['w2','e','A vállnyomásnál a bal oldal érzékenyebb.',1,'beszélgetésből','wait'],['o1','t','A kifli.hu az elsődleges élelmiszer-forrás.',3,'beszélgetésből','off']];
const M10=[['g1','t','Az edzés előtti étkezés 2-3 órával előtte esik neked a legjobban.','Edzés előtt 2-3 órával eszel a legszívesebben.'],['g2','e','A röplabda után másnap fáradtabbnak érzed a lábad.','Hosszú röplabda után a következő napon gyakran nehezebb a lábad.']];
const fOn=f=>R10.off[f[0]]!=null?!R10.off[f[0]]:f[5]!=='off';
const fCard=f=>{const [id,c,t,n,src,s]=f,on=fOn(f),[cl,ic]=CAT10[c];return `<article class="w5-f w10-f${on?'':' dim'}" data-w10f="${id}" data-cat="${c}"${R10.cat!=='m'&&R10.cat!==c?' hidden':''}>${E.drop(ic)}<span class="g"><b>${t}</b><small>${cl} · ${n}× visszaigazolva · ${src}</small>
  <span class="w4-lv"><span class="t"><i style="width:${Math.min(100,Math.round(n/12*100))}%;--c:${on?'var(--dom)':'#9AA7B0'}"></i></span></span><i class="w10-st">${on?(s==='wait'?'Bekapcsolva, de most kimarad':'Most benne van a beszélgetésekben'):'Kikapcsolva: a társ nem látja'}</i></span>
  <button class="w10-sw${on?' on':''}" data-w10="sw:${id}" role="switch" aria-checked="${on}" aria-label="${t}"><i></i></button></article>`};
const foldRow=(k,l,body)=>`<div class="w10-fd" data-w10d="${k}"><button class="ex-mrow w4-r" data-w10="fd:${k}" aria-expanded="${!!R10.fold[k]}">${E.drop(k==='s9'?'t-layers':k==='off'?'t-mute':'t-clock')}<span class="g"><b>${l}</b></span><em>${R10.fold[k]?'bezár':'megnyit'}</em></button>${R10.fold[k]?`<div class="w3-l w10-fb">${body}</div>`:''}</div>`;
const mCard=m=>{const [id,c,t,into]=m,bk=R10.back[id],[cl,ic]=CAT10[c];return `<article class="w5-f${bk?'':' dim'}">${E.drop(bk?ic:'t-layers')}<span class="g"><b>${t}</b><small>${cl} · beszélgetésből</small><i class="w10-st">${bk?'Újra külön: mindkettőt használom':`Összevontam ezzel: „${into}”, szept. 29.`}</i>
  <span class="w3-ab"><button class="n8-b" data-w10="bk:${id}">${bk?'Mégis maradjon összevonva':'Visszakapcsolom'}</button></span></span></article>`};
const folds10=()=>foldRow('wait','Bekapcsolva, de most kimarad · '+F10.filter(f=>f[5]==='wait').length,F10.filter(f=>f[5]==='wait').map(fCard).join('')+mzLine('Ha megerősödnek, vagy egy erősebb tény kiesik, bekerülnek a beszélgetésekbe.'))
  +foldRow('off','Kikapcsolva · '+F10.filter(f=>f[5]==='off').length,F10.filter(f=>f[5]==='off').map(fCard).join('')+mzLine('Megőrzöm őket, de a társ nem használja.'))
  +foldRow('s9','Összevontam · '+M10.length,M10.map(mCard).join('')+mzLine('Ezek ugyanazt mondták, mint egy másik tény, ezért a másikba olvasztottam őket. A szövegük nem változott, semmi nem veszett el.'));
function tenyek10(a){if(a)return O.tenyek(a);const nIn=F10.filter(f=>f[5]==='in').length;
  return page('mezo',{title:'Tények',sub:'Tudástár',back:'tudastar'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Amit a csapat megjegyzett')}<h2 class="n7-h">15 tény rólad, 10 megy a beszélgetésekbe.</h2>
    <div class="w7-pic"><span class="w3-cp"><span class="r w10-cp">${Array.from({length:15},(_,i)=>`<i class="${i<10?'on':i<14?'hf':'x'}"></i>`).join('')}</span></span></div>
    <p class="w8-lg"><span><i class="f"></i>megy a beszélgetésekbe · 10</span><span><i class="h"></i>vár · 4</span><span><i class="e"></i>kikapcsolva · 1</span></p>
    ${mzLine('Minden tényt te kapcsolsz be vagy ki. 12 kapcsolat köti össze őket.')}
    <div class="w3-lk w5-lk"><button class="fh-lk" data-go="hogyan">Hogyan működik? ›</button></div></section>
  <section class="mx-s ln">${KH('Keresés és rendrakás')}<button class="w6-s" data-toast="Keresés a tények között">${I('t-lens')}<span>Keresés, például alvás, kávé, váll</span><b>Keresés</b></button>
    <div class="w6-ex w10-ct">${[['m','Mind'],['e','Edzés'],['t','Étkezés'],['g','Egészség'],['l','Élet']].map(([k,l])=>`<button class="n8-b${R10.cat===k?' on':''}" data-w10="cat:${k}" aria-pressed="${R10.cat===k}">${l}</button>`).join('')}</div>
    <div class="w4-rl w7-rows">${row7('t-layers','Hétfői rendrakás','2 ismétlést összevontam, 1 javaslat vár rád a Rólad oldalon','data-go="rolad"')}</div></section>
  <section class="mx-s ln">${KH('Most ezeket kapja meg a társ','10')}<div class="w3-l w10-in">${F10.filter(f=>f[5]==='in').map(fCard).join('')}</div>
    ${mzLine(`Minden beszélgetés elején ezek a mondatok mennek elé: a 10 legerősebb bekapcsolt tény, plusz a frissen megerősített minták. Itt ${nIn}-et mutatok.`)}</section>
  <section class="mx-s ln">${KH('A többi tény')}<div class="w4-rl w10-fds">${folds10()}</div></section></div>`)}
O.tenyek=mz.routes.tenyek;mz.routes['tenyek-lista']=O.tenyek;mz.routes.tenyek=tenyek10;

function tud10(a){if(a)return O.tudastar(a);const nI=+g(O.tudastar(''),/(\d+) javaslat vár rád/)||0;
  return page('mezo',{title:'Tudástár',sub:'Rólad',back:'rolad'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Amit a csapat megjegyzett')}<h2 class="n7-h">15 tényt tudunk rólad, 10 megy a beszélgetésekbe.</h2>
    <div class="w4-tb">${F.vials([['A beszélgetésben',10,'var(--dom)'],['Vár',4,'#E7B25A'],['Kikapcsolva',1,'#9AA7B0']].map(([l,n,c])=>({l,p:Math.round(n/15*100),v:n,c,on:'tenyek'})),{h:110})}</div>
    ${mzLine('12 kapcsolat köti össze őket. Csak a 10 legerősebb bekapcsolt tény fér be egy beszélgetésbe, a többi vár.')}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="tenyek">Tények</button><button class="n8-b" data-go="hogyan">Hogyan működik?</button></div></section>
  <section class="mx-s ln">${KH('Rád vár')}<div class="w4-rl">${nI?row7('t-bell',`${nI} javaslat vár rád a Rólad oldalon`,'ott döntesz róluk: igen, pontosítom, most ne, nem igaz','data-go="rolad"'):info7('t-tick','Nincs döntésre váró javaslat','Ha a csapat újat hoz, a Rólad oldalon kérdez meg.')}</div></section>
  <section class="mx-s ln">${KH('A tudás')}<div class="w4-rl">${row7('t-note','Tények · 15','10 a beszélgetésekben, 4 vár, 1 kikapcsolva','data-go="tenyek"')}${row7('t-graph','Kapcsolatok · 7 kategória','például: a késői evés rontja az alvást · 12 kapcsolat','data-go="kategoriak"')}</div></section></div>`)}
O.tudastar=mz.routes.tudastar;mz.routes['tudastar-lista']=O.tudastar;mz.routes.tudastar=tud10;

const K10=[['Minták','t-pattern',3,'A késői evés rontja az alvást'],['Preferenciák','t-checkin',4,'Reggel edz a legszívesebben'],['Célok','t-flag',2,'Nyári alapozás'],['Életesemények','t-sun',1,'Új munkahely első hete'],['Szezonok','t-calendar',1,'Nyári alapozás'],['Belátások','t-bulb',0,'még nincs'],['Emberek','t-people',2,'Anna']];
const kshelf=ks=>`<div class="w5-sh">${F.vials(ks.map(([l,ic,n,,i])=>({l,ic,p:n/4*100,v:n,mark:n?'':'üres',on:n?'kind.'+i:{toast:l+' — még nincs'}})),{h:96})}<i class="w5-shf"></i></div>`;
function kat10(a){if(a)return O.kategoriak(a);const K=K10.map((k,i)=>[...k,i]);
  return page('mezo',{title:'Kapcsolatok',sub:'Tudástár · a tudásod térképe',back:'tudastar'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','A tudásod térképe')}<h2 class="n7-h">7 kategória, 12 kapcsolat.</h2>
    ${mzLine('A legtöbb a preferenciáid között van, belátás még nincs.')}
    <p class="w5-cap">Hány elem van egy-egy kategóriában</p>${kshelf(K.slice(0,4))}${kshelf(K.slice(4))}</section>
  <section class="mx-s ln">${KH('Kategóriák')}<div class="w4-rl">${K.map(([l,ic,n,ex,i])=>n?`<button class="ex-mrow w4-r" data-go="kind.${i}">${E.drop(ic)}<span class="g"><b>${l}</b><i class="q">${ex}</i></span><i class="w3-st n">${n}</i><em>›</em></button>`:`<div class="ex-mrow w4-r w10-off">${E.drop(ic)}<span class="g"><b>${l}</b><i class="q">${ex}</i></span><i class="w3-st n">0</i></div>`).join('')}</div></section></div>`)}
O.kategoriak=mz.routes.kategoriak;mz.routes['kategoriak-lista']=O.kategoriak;mz.routes.kategoriak=kat10;

function elet10(a){if(a)return O.eletesemenyek(a);
  const L=[...O.rolad('').matchAll(/<div class="mz-life"><u class="([^"]*)"><\/u><span class="g"><strong>([^<]*)<\/strong><small>([^<]*)<\/small><\/span><em>([^<]*)<\/em><\/div>/g)].map(m=>[m[1],m[2],m[3],quarter(m[4])]);
  return page('mezo',{title:'Életesemények',sub:'Rólad',back:'rolad'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','A nagy fordulatok')}<h2 class="n7-h">Ezekhez igazodik a csapat.</h2>
    ${mzLine('A mércék és a javaslatok ezekhez képest értelmeződnek: egy új munkahely első hetén mást várunk tőled.')}
    <p class="w5-cap">Felül a legfrissebb, lent ami már leülepedett</p>
    <div class="w10-st8">${L.map(([dim,t,,d],i)=>`<span class="${dim?'dim':''}" style="background:color-mix(in srgb,var(--dom) ${Math.max(6,30-i*5)}%,#fff)"><b>${t}</b><small>${d}</small></span>`).join('')}</div></section>
  <section class="mx-s ln">${KH('Időrendben',L.length+' esemény')}<div class="w4-rl">${L.map(([dim,t,sm,d])=>`<div class="ex-mrow w4-r w5-le${dim?' dim':''}">${E.drop(dim?'t-calendar':'t-journal')}<span class="g"><b>${t}</b><i class="q">${sm.replace(' — ',', ')}</i></span><i class="w3-st n">${d}</i></div>`).join('')}</div>
    ${mzLine('Új életesemény javaslatként érkezik a Rólad oldalra, ott döntesz róla.')}</section></div>`)}
O.eletesemenyek=mz.routes.eletesemenyek;mz.routes['eletesemenyek-lista']=O.eletesemenyek;mz.routes.eletesemenyek=elet10;
/* ═══ EMLÉKEK ALOLDALAI (2026-11-02, owner: "jöhet az Emlékek egy körben"). A memory and a day: the night's sentence, the
   day's own levels as the picture, the story on Mezo's card. The memoir: the four steps as capsules, the step changes IN
   PLACE (owner rule: no re-render), the answer stays. The archive and a chapter: the weeks as tubes (how many real data
   points each chapter was written from), chapters as cards, the chapter's answer in place. The memory: its four layers
   as stacked bands, the four views switched in place. Own state (E11). ═══ */
const E11={step:0,memo:'',ch:{},mem:'retegek'};
function emlek11(a){if(a)return O.emlek(a);
  return page('mezo',{title:'2026. augusztus 12.',sub:'Napi emlék · kedd',back:'emlekek'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Mezo éjszakai összefoglalója · kedd')}<h2 class="n7-h">Ez volt a hét legnyugodtabb éjszakája.</h2>
    <div class="w7-pic">${pair(['alvás','7:40',88,TC4('szunya')],['a célod','7:30',82,'color-mix(in srgb,var(--dom) 40%,#fff)'],'a cél fölött','Az éjszaka a cél vonala fölé telt')}</div>
    <span class="w3-tg w8-tg"><span>erős pull-nap</span><span>korai lefekvés</span><span>7 óra 40 perc alvás</span></span></section>
  <section class="mx-s ln">${KH('A nap története')}${cm7('mezo','a rögzített napodból','Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia. A napló szerint a munka is jól haladt, és egyszer sem kellett kávé 14 óra után.<br><br>Este korán feküdtél, 7 óra 40 perc lett belőle, a reggeli pulzus is lejjebb ment. Ez volt a hét legnyugodtabb éjszakája.')}</section>
  <section class="mx-s ln">${KH('Lapozz')}<div class="w11-pg"><button class="n8-b" data-toast="2026-08-11">‹ Augusztus 11.</button><button class="n8-b" data-toast="2026-08-13">Augusztus 13. ›</button></div>
    <div class="w4-rl w7-rows">${row7('t-album','Minden emlék','az összes nap','data-go="emlekek"')}</div></section></div>`)}
O.emlek=mz.routes.emlek;mz.routes['emlek-lista']=O.emlek;mz.routes.emlek=emlek11;

const ND={'21':['Vasárnap · szeptember 21.','Meccs, korai vacsora, és a legjobb éjszakád a héten.','Délelőtt csend, délután bemelegítés, este pedig meccs. A vacsora ezúttal <b>18:40-kor</b> lezárult, és bejött: az éjszakád <b>7,4-es</b> lett, a hét legjobbja. A kísérlet is találatot írt: a 4. szettben stabil maradt az ugrásod.',[[74,'t-moon','7,4','alvás'],[62,'t-bowl','18:40','vacsora'],[100,'t-volley','találat','meccs']]],
  '15':['Hétfő · szeptember 15.','Fáradt hétfő a hétvégi késés után.','A hétvégén kétszer is éjfél után feküdtél, és ezt a hétfő megérezte: a reggeli bejelentkezésed <b>5-ös</b> volt, délután pedig elmaradt a séta. Az Alvás szerint ez a hétfői ugrás, nem a munka.',[[52,'t-moon','6,1','alvás'],[40,'t-heart','fáradt','bejelentkezés']]],
  '16':['Kedd · szeptember 16.','Nyugodt kedd, rendben lezárt este.','Edzés nem volt, a nap egyenletesen ment. A vacsora <b>19:20-kor</b> lezárult, és 23 előtt ágyba kerültél: a hét első rendes éjszakája lett belőle.',[[70,'t-moon','7,1','alvás'],[60,'t-bowl','19:20','vacsora']]],
  '18':['Csütörtök · szeptember 18.','Meccsnap, és megvolt a szénhidrát.','<b>17 óráig bekerült a 80 g szénhidrát</b>, és a meccs végjátékában is maradt láb: a 4. szettben alig esett az ugrásod. A kísérlet első találat-napja.',[[82,'t-volley','találat','meccs'],[80,'t-bowl','80 g','szénhidrát']]],
  '19':['Péntek · szeptember 19.','Nehéz péntek, rövid éjszaka után.','A meccs utáni éjszaka rövid lett, <b>5,6 óra</b>. Délután feszült voltál a munka miatt, és a bejelentkezésed is lejjebb ment. Este korán lefeküdtél, ez segített a szombatnak.',[[40,'t-moon','5,6','alvás'],[38,'t-heart','feszült','bejelentkezés']]],
  '20':['Szombat · szeptember 20.','Lassú reggel, hosszú séta.','Nem történt semmi nagy, és pont ez volt a jó benne. Két forrásból is nyugodt napnak látszik; a Közérzet szerint az ilyen szombatok tartják egyben a heted.',[[62,'t-steps','6,2 km','séta'],[82,'t-heart','nyugodt','bejelentkezés']]]};
function nap11(id){const d=ND[id];if(!d)return O.nap(id);
  return page('mezo',{title:d[0],sub:'Napi emlék',back:'emlekek'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Mezo · a nap krónikája')}<h2 class="n7-h">${d[1]}</h2>
    <p class="w5-cap">Amiből a nap története íródott</p><div class="w4-tb">${F.vials(d[3].map(([p,ic,v,l])=>({l,ic,p,v,on:{toast:l+': '+v}})),{h:110})}</div></section>
  <section class="mx-s ln">${KH('A nap története')}${cm7('mezo','a naplóidból',d[2])}</section>
  <section class="mx-s ln">${KH('Kapcsolódik')}<div class="w4-rl">${!['18','21'].includes(id)?'':row7('t-flask','Ehhez a naphoz tartozó ügy','meccs előtti szénhidrát · találat-nap','data-go="poszt.kiserlet"')}${row7('t-history','Mikor volt még ilyen napom?','hasonló emlékek visszakeresése','data-go="emlekek"')}</div></section></div>`)}
O.nap=mz.routes.nap;mz.routes['nap-lista']=O.nap;mz.routes.nap=nap11;

const MST=['Miért most','Mi történt','Miből íródott','Hogy olvastad?'];
const MH=['Ez a hét nem a nagy elhatározásokról szólt.','Kedden még elúszott az este, vasárnapra megfordult.','Négy naplódból állt össze a fejezet.','Hogy olvastad?'];
const memoAns=()=>E11.memo?`<p class="w3-ok">${TICK}${E11.memo==='up'?'Jó volt így olvasni, jegyzem.':'Nem ilyen volt: ebből tanulok a legtöbbet.'}</p><button class="fh-lk" data-w11="memo:">Visszavonom</button>`
  :`<div class="w3-ab"><button class="n9-btn" data-w11="memo:up">Talált</button><button class="n8-b" data-w11="memo:down">Nem ilyen volt</button></div>`;
const mHead=()=>{const s=E11.step;return `${eb7('mezo',`Mezo meséli · ${s+1} / 4`)}<h2 class="n7-h">${MH[s]}</h2>
  <div class="w11-st">${MST.map((t,i)=>`<button class="w7-d${i<s?' on':''}${i===s?' now':''}" data-w11="step:${i}" aria-current="${i===s}"><i></i><b>${i+1}.</b><small>${t}</small></button>`).join('')}</div>
  <div class="ex-acts w3-wide">${s<3?`<button class="n9-btn" data-w11="step:${s+1}">${s?'Tovább':'Mesélj'}</button><button class="n8-b" data-w11="step:${s+1}">Kihagyom</button>`:'<button class="n9-btn" data-w11="step:0">Elölről</button>'}</div>${s?`<div class="w3-lk w5-lk"><button class="fh-lk" data-w11="step:${s-1}">‹ Vissza</button></div>`:''}`};
function memoar11(a){if(a)return O.memoar(a);const s=E11.step;
  const bodies=[cm7('mezo','vasárnap este · a hét lezárult','Ez a hét nem a nagy elhatározásokról szólt. Vasárnap este leültem, és összeraktam a napi emlékeidből. Négy rövid lépésben mesélem, mindegyiket átugorhatod.'),
    cm7('mezo','a heted','Kedden még úgy nézett ki, megint elúszik minden este. Aztán csütörtökön <b>17 óráig megvolt a szénhidrát</b>, és a meccs végjátékában is maradt láb. Szombaton lassú reggel, hosszú séta.<br><br>Vasárnap pedig az történt, amire az Alvás hetek óta várt: <b>korai vacsora, 23 előtti lefekvés</b>, és a hét legjobb éjszakája. Ha a jövő hét is így megy, a vacsora-ügyben ki tudjuk mondani az első biztos mondatot.'),
    `<div class="w4-rl">${[['t-moon','Alvás-napló','vasárnap 7,4, a hét legjobbja'],['t-bowl','Étkezés-napló','csütörtök · 80 g szénhidrát 17:00-ig'],['t-volley','Meccsnapok','csütörtök és vasárnap · találat'],['t-chat','Esti jegyzeteid','szombat · „nem történt semmi nagy, pont ez volt a jó”']].map(x=>info7(...x)).join('')}</div>`,
    `<div class="w11-ma" data-w11a="1">${memoAns()}</div>${mzLine('A következő fejezet ehhez a hanghoz igazodik.')}<div class="w4-rl w7-rows">${info7('t-calendar','Évforduló · 1 hónap','Egy hónapja kezdtük tudatosan korábbra tolni a vacsorát. Azóta 18 este sikerült.')}${row7('t-scroll','Archívum','a korábbi fejezetek · 6','data-go="archivum"')}${row7('t-flask','Ehhez a héthez tartozó ügy','meccs előtti szénhidrát · találat-nap','data-go="poszt.kiserlet"')}</div>`];
  return page('mezo',{title:'Apró fordulatok',sub:'Heti fejezet · szept. 15–21.',back:'emlekek'},`<div class="mx">
  <section class="mx-s ex-hero" id="w11-mh">${mHead()}</section>
  ${bodies.map((b,i)=>`<section class="mx-s ln w11-sb" data-w11s="${i}"${i===s?'':' hidden'}>${KH(MST[i])}${b}</section>`).join('')}</div>`)}
O.memoar=mz.routes.memoar;mz.routes['memoar-lista']=O.memoar;mz.routes.memoar=memoar11;

const CH11=[['május 2026',[[20,'máj. 11–17.','Egy hét, amikor a tested megtanult várni','Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt.',6],[19,'máj. 4–10.','Amikor az alvás előre szólt','Kedd éjjel 5,7 óra, és szerdán már a bemelegítésnél látszott, hogy ez nem az a nap.',5]]],['április 2026',[[18,'ápr. 27. – máj. 3.','Az első közös korrekció','Ezen a héten először mondtad, hogy nem értesz egyet, és igazad lett.',4],[17,'ápr. 20–26.','Lassabban, de tovább','A futások rövidültek, a hét mégis a legerősebb lett.',5],[16,'ápr. 13–19.','A hét, amikor visszajött az étvágy','Három hét után először maradt el a délutáni nassolás.',3]]],['március 2026',[[15,'márc. 30. – ápr. 5.','Az első fejezet','Még alig ismertük egymást. Ezen a héten kezdtük.',2]]]];
const CHA=CH11.flatMap(c=>c[1]);
const chTubes=cur=>`<div class="w4-tb">${F.vials([...CHA].reverse().map(c=>({l:c[0]+'. hét',p:c[4]/6*100,v:c[4],mark:c[0]===cur?'ez':'',on:'fejezet.'+c[0]})),{h:90})}</div>`;
const chCard=c=>`<article class="w3-c"><button class="w3-tap" data-go="fejezet.${c[0]}" aria-label="${c[2]}"><span class="w3-hd">${E.drop('t-scroll')}<span class="g"><b>${c[0]}. hét</b><small>${c[1]}</small></span><i class="w3-st n">${c[4]} adatpontból</i></span><span class="w3-h">${c[2]}</span><span class="w3-x">${c[3]}</span><span class="w3-f"><span class="n8-b">Elolvasom</span></span></button></article>`;
function arch11(a){if(a)return O.archivum(a);
  return page('mezo',{title:'Minden fejezet',sub:'Memoár · archívum',back:'memoar'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','3 hónap közös történet')}<h2 class="n7-h">6 fejezet készült eddig, hetente egy.</h2>
    <p class="w5-cap">Hány valódi adatpontból íródott egy-egy fejezet</p>${chTubes(0)}
    ${mzLine('A legfrissebb: „Egy hét, amikor a tested megtanult várni”. Minél több a pont, annál többet tudtam a hétről.')}
    <div class="ex-acts w3-wide"><button class="n9-btn" data-go="fejezet.20">A legutóbbi fejezet</button></div></section>
  ${CH11.map(([m,rows])=>`<section class="mx-s ln">${KH(m[0].toUpperCase()+m.slice(1),rows.length+' fejezet')}<div class="w3-l">${rows.map(chCard).join('')}</div></section>`).join('')}</div>`)}
O.archivum=mz.routes.archivum;mz.routes['archivum-lista']=O.archivum;mz.routes.archivum=arch11;

const chAns=n=>{const v=E11.ch[n];return v?`<p class="w3-ok">${TICK}${v==='up'?'Köszönöm, jegyzem.':'Értem. Mi nem stimmelt? Írd meg, ebből tanulok.'}</p><button class="fh-lk" data-w11="ch:${n}:">Visszavonom</button>`
  :`<div class="w3-ab"><button class="n9-btn" data-w11="ch:${n}:up">Talált</button><button class="n8-b" data-w11="ch:${n}:down">Nem ilyen volt</button><button class="n8-b" data-sheet="reply">Elmesélem</button></div>`};
function fej11(id){const k=CHA.findIndex(c=>String(c[0])===String(id||20));if(k<0)return O.fejezet(id);const c=CHA[k],prev=CHA[k+1],next=CHA[k-1],big=c[0]===20;
  const prose=big?'Hétfőn még úgy indultál, mintha minden nap csúcsnap lenne. Szerdára a tested szólt: a guggolás nem ment, az alvás rövid volt, és a reggeli pulzus is feljebb kúszott.<br><br>Csütörtökön pihenőt tartottál, pedig a terv mást mondott. Pénteken jött a hét legjobb edzése: a Chest Row 102,5 × 9 új csúcs lett.<br><br>Ez volt az első hét, amikor a várás nem kimaradás volt, hanem döntés.'
    :`${c[3]} A hét elején még minden a terv szerint ment, aztán egy rövid éjszaka mindent átrendezett.<br><br>Ami ebből megmaradt: a tested előbb szól, mint a mérleg vagy a napló. Érdemes rá hallgatni.`;
  const src=big?[['t-up','Chest Row 102,5 × 9','pénteki csúcs'],['t-heart','Reggeli pulzus','pihenten mérve'],['t-moon','Alvás 7,8 óra','szombat']]:[['t-moon','5,7 óra alvás','kedd éjjel'],['t-dumbbell','A guggolás kimaradt','szerda'],['t-journal','Napló','szerda']];
  return page('mezo',{title:c[2],sub:`Heti memoár · ${c[0]}. hét · ${c[1]}`,back:'archivum'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo',`Mezo meséli · ${c[0]}. hét`)}<h2 class="n7-h">${c[3]}</h2>
    <p class="w5-cap">A hat fejezet: ez a megjelölt</p>${chTubes(c[0])}</section>
  <section class="mx-s ln">${KH('A fejezet')}${cm7('mezo',c[1],prose)}</section>
  <section class="mx-s ln">${KH('Miből íródott',src.length+' adatpont')}<div class="w4-rl">${src.map(x=>info7(...x)).join('')}</div></section>
  <section class="mx-s ln">${KH('Hogy olvastad?')}<div class="w11-ma" data-w11c="${c[0]}">${chAns(c[0])}</div></section>
  <section class="mx-s ln">${KH('Lapozz')}<div class="w4-rl">${prev?row7('t-scroll',`‹ ${prev[0]}. hét`,prev[2],`data-go="fejezet.${prev[0]}"`):''}${next?row7('t-scroll',`${next[0]}. hét ›`,next[2],`data-go="fejezet.${next[0]}"`):''}</div></section></div>`)}
O.fejezet=mz.routes.fejezet;mz.routes['fejezet-lista']=O.fejezet;mz.routes.fejezet=fej11;

const LAY=[['t-brain','Tartós tudás','amit biztosan tudok rólad','15 tény','data-go="tudastar"'],['t-pattern','Minták, amikről te döntesz','3 megerősített, 2 függő','6 minta','data-go="rolad"'],['t-journal','Napi emlékek','112 beszélgetés-részlet, július 1-től','38 nap','data-w11="mem:naplo"'],['t-signal','Minden, amit rögzítesz','a nyers adat','47 / 60 nap','']];
const FLOW=['megerősítés után','hetente mintakeresés','minden nap 02:20-kor napi összefoglaló'];
function mem11(a){if(a)return O.memoria(a);const on=/3 hasonló nap a memóriából/.test(O.emlekek(''));
  const lay=`<div class="w4-rl">${[...LAY].reverse().map((l,i)=>`${i?`<p class="w11-fl">↑ ${FLOW[3-i]}</p>`:''}${l[4]?`<button class="ex-mrow w4-r" ${l[4]}>`:'<div class="ex-mrow w4-r">'}${E.drop(l[0])}<span class="g"><b>${l[1]}</b><i class="q">${l[2]}</i></span><i class="w3-st n">${l[3]}</i>${l[4]?'<em>›</em></button>':'</div>'}`).join('')}${row7('t-lens','Miért nem lát még mintát a motor?','a minták oldalán','data-go="mintak"')}</div>`;
  const nap=`<p class="w5-cap">Augusztus 2026 · 38 nap</p><div class="w3-l">${[['augusztus 12., kedd','Erős pull-nap volt: a Chest Supported Row 3×8-ra ment, és délután is maradt energia.',1],['augusztus 11., hétfő','Pihenőnap, sok séta. Ebédnél kimaradt a fehérje, este pótoltad.',1],['augusztus 10., vasárnap','Röpi este, három szett, a harmadikban elfogyott a lendület.',0]].map(([d,x,k])=>`<article class="w3-c"><button class="w3-tap" data-go="emlek"><span class="w3-hd">${E.drop('t-album')}<span class="g"><b>${d}</b></span><i class="w3-st ${k?'ok':'n'}">${k?'kereshető':'még nem kereshető'}</i></span><span class="w3-x">${x}</span></button></article>`).join('')}</div>`;
  const ker=`<button class="w6-s" data-m="srch">${I('t-lens')}<span class="${on?'on':''}">${on?'rossz alvás edzés után':'Milyen napot keresel?'}</span><b>${on?'Törlés':'Keresés'}</b></button>
    ${on?`<div class="w3-l w6-hits">${SIM3.map(([d,ago,x,p])=>`<button class="w5-f w6-h" data-go="emlek"><span class="g"><b>${d} · ${ago}</b><small>${x}</small><span class="w4-lv"><span class="t"><i style="width:${p}%;--c:var(--dom)"></i></span><b>${p}%</b></span></span></button>`).join('')}</div>${mzLine('A szám azt mutatja, mennyire hasonlít az a nap a keresésedre.')}`:''}`;
  const bars=[40,62,35,80,55,48,90,30,66,72,44,58,38,84];
  const aud=`<p class="w7-sum">0,042 dollár</p><p class="w5-cap">Ennyibe került az emlékezet az elmúlt 30 napban, 214 hívás</p>
    <div class="w11-au">${bars.map(h=>`<span><i style="height:${h}%"></i><i class="o" style="height:${Math.round(h*.35)}%"></i></span>`).join('')}</div><p class="w8-lg"><span><i class="f"></i>amit a csapat elolvasott</span><span><i class="h"></i>amit írt</span></p>
    <div class="w4-rl w7-rows">${row7('t-brain','Tudástár','a tények és az eredetük','data-go="tudastar"')}</div>`;
  const V={retegek:['Rétegek',lay],naplo:['Napló',nap],kereso:['Kereső',ker],audit:['Költség',aud]};
  return page('mezo',{title:'Memória',sub:'Rétegek, eredet és költségek',back:'gepterem'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Az emlékezeted')}<h2 class="n7-h">60 napból 47 mért nap van az emlékezetben.</h2>
    <p class="w5-cap">Felül a tartós tudás, alul a nyers adat</p>
    <div class="w10-st8">${LAY.map((l,i)=>`<span style="background:color-mix(in srgb,var(--dom) ${36-i*8}%,#fff)"><b>${l[1]}</b><small>${l[3]}</small></span>`).join('')}</div>
    ${mzLine('Lentről fölfelé tisztul: a nyers adatból napló, a naplóból minta, a mintából tartós tudás lesz.')}</section>
  <section class="mx-s ln"><div class="w9-sw w11-sw" role="group">${Object.entries(V).map(([k,[l]])=>`<button class="${E11.mem===k?'on':''}" data-w11="mem:${k}" aria-pressed="${E11.mem===k}">${l}</button>`).join('')}</div></section>
  ${Object.entries(V).map(([k,[l,b]])=>`<section class="mx-s ln w9-v" data-w11v="${k}"${E11.mem===k?'':' hidden'}>${KH(l)}${b}</section>`).join('')}</div>`)}
O.memoria=mz.routes.memoria;mz.routes['memoria-lista']=O.memoria;mz.routes.memoria=mem11;

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w11]');if(!b)return;e.preventDefault();const [k,v,x]=b.dataset.w11.split(':'),ph=document.querySelector('#phone');if(!ph)return;
  if(k==='step'){E11.step=Math.max(0,Math.min(3,+v));const h=ph.querySelector('#w11-mh');if(h)h.innerHTML=mHead();ph.querySelectorAll('[data-w11s]').forEach(s=>s.hidden=+s.dataset.w11s!==E11.step);return}
  if(k==='memo'){E11.memo=v;const a=ph.querySelector('[data-w11a]');if(a)a.innerHTML=memoAns();if(v)F.toast(v==='up'?'Köszönjük, feljegyeztük.':'Ebből tanulunk a legtöbbet.');return}
  if(k==='ch'){E11.ch[v]=x;const a=ph.querySelector(`[data-w11c="${v}"]`);if(a)a.innerHTML=chAns(+v);return}
  if(k==='mem'){E11.mem=v;ph.querySelectorAll('[data-w11v]').forEach(s=>s.hidden=s.dataset.w11v!==v);ph.querySelectorAll('.w11-sw button').forEach(c=>{const on=c.dataset.w11==='mem:'+v;c.classList.toggle('on',on);c.setAttribute('aria-pressed',on)});ph.querySelector('.w11-sw')?.scrollIntoView({block:'start',behavior:'smooth'})}},true);

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w10]');if(!b)return;e.preventDefault();const [k,v,x]=b.dataset.w10.split(':'),ph=document.querySelector('#phone');if(!ph)return;
  if(k==='fb'){R10.fb[v]=x||undefined;const c=ph.querySelector(`[data-w10c="${v}"]`);if(c)c.outerHTML=clCard(+v);F.toast(x==='yes'?'„Talál” — köszönjük, feljegyeztük.':x==='no'?'Nyugdíjazva — a csapat nem viszi tovább.':'Visszavonva');return}
  if(k==='sw'){const f=F10.find(q=>q[0]===v);R10.off[v]=fOn(f);const c=ph.querySelector(`[data-w10f="${v}"]`);if(c)c.outerHTML=fCard(f);F.toast(fOn(f)?'Bekapcsolva':'Kikapcsolva — a társ nem látja');return}
  if(k==='cat'){R10.cat=v;ph.querySelectorAll('[data-w10f]').forEach(c=>c.hidden=v!=='m'&&c.dataset.cat!==v);ph.querySelectorAll('.w10-ct button').forEach(c=>{const on=c.dataset.w10==='cat:'+v;c.classList.toggle('on',on);c.setAttribute('aria-pressed',on)});return}
  if(k==='fd'){R10.fold[v]=!R10.fold[v];const w=ph.querySelector('.w10-fds');if(w)w.innerHTML=folds10();return}
  if(k==='bk'){R10.back[v]=!R10.back[v];const w=ph.querySelector('.w10-fds');if(w)w.innerHTML=folds10();F.toast(R10.back[v]?'Visszakapcsolva — újra külön':'Összevonva');return}},true);
/* the approved timer types the Közérzet's message into #live after a few seconds; keep it emoji-free too */
new MutationObserver(()=>{const l=document.querySelector('#phone #live');if(!l||!l.closest(P))return;const h=NOEMO(l.innerHTML);if(h!==l.innerHTML)l.innerHTML=h}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w8="este"]');if(!b)return;document.querySelector('#phone #w8-este')?.scrollIntoView({behavior:'smooth',block:'start'})});

/* ═══ MIBŐL LÁTSZIK · A NAPOK EGYENKÉNT (bizonyitek): the case page's fourteen evenings, now each with its dinner time —
   the grouped tubes as the picture (so it matches the case page), then one row per evening: the date, dinner time, the
   night's sleep as a level, mellette / ellene. The Skeptic's condition and the honesty note became Mezo's lines. ═══ */
const VT=['18:35','21:05','18:50','19:20','22:00','19:05','18:20','21:30','19:00','20:45','19:40','18:50','22:15','19:00'];
function biz8(){
  return page('mezo',{title:'Miből látszik?',sub:'Rosszabbul alszol, ha későn vacsorázol?',back:'poszt.vacsora'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('szunya','A késői vacsora ügye · 14 közös nap')}<h2 class="n7-h">11 este mellette szól, 3 ellene.</h2>
    ${nights(0,'Késői vacsora után')}${nights(1,'Korai vacsora után')}
    ${mzLine('Ez együttjárás, még nem bizonyított ok. A csapat addig nem mond ki semmit, amíg a hétvégét külön nem látta: ez a Szkeptikus feltétele.')}</section>
  <section class="mx-s ln">${KH('A napok egyenként','szeptember 8–21.')}<div class="w4-rl">${VD.map(([d,v,early,x],k)=>`<div class="ex-mrow w4-r w8-d"><span class="w8-t${early?'':' late'}"><b>${VT[k]}</b><small>vacsora</small></span><span class="g"><b>Szept. ${d} · alvás ${v.toFixed(1).replace('.',',')}</b><span class="w4-lv"><span class="t"><i style="width:${Math.round((v-4)/5*100)}%;--c:${early?'var(--dom)':'#E7B25A'}"></i></span></span></span>${x?'<i class="w3-st w">ellene</i>':`<i class="w3-st ok">${TICK}mellette</i>`}</div>`).join('')}</div>
    ${mzLine('Ahol nem volt meg a vacsora ideje és az alvás is, az a nap nem számít se mellette, se ellene.')}
    <div class="w4-rl w7-rows">${row7('t-clock','A minta oldala','a teszt-terv, a napló és a számítás','data-go="minta.vacsora"')}</div></section></div>`)}
mz.routes.bizonyitek=biz8;

/* ═══ MIBŐL LÁTSZIK · A MINTA OLDALA (minta.vacsora / .viz / .egyhangu; the weekend and saved patterns keep the approved
   page): the verdict and the hypothesis as the sentence, the same two vessels the wall card shows, how sure the team is as
   a level, the 3 decisions (approved handler → minta.<key>.<decision>), the plan as rows + tags, the days as grouped tubes,
   the log as rows, the calculation behind one toggle. ═══ */
const MN={
 vacsora:{t:'Vacsora ideje és alvás',q:'Rosszabbul alszol, ha későn vacsorázol',cat:'Étkezés · alvás',who:'szunya',st:'monitoring',minN:6,lag:1,belief:72,dir:'kevesebb',win:21,
  A:['Utolsó étkezés ideje','Étkezésnapló','t-bowl'],B:['Alvásminőség','Alvás-napló','t-moon'],ans:'Tartja magát.',r:'−0,58',p:'0,03',
  pic:()=>pair(['késői vacsora után','6,0',42,'#E7B25A'],['korai vacsora után','7,5',80,'var(--dom)'],'másfél pont','Az alvásod átlaga'),
  g:[['Vacsora 20 óra után',VD.filter(d=>!d[2]).map(([d,v])=>[d,v.toFixed(1).replace('.',','),Math.round((v-4)/5*100)]),'#E7B25A'],['Vacsora 20 óra előtt',VD.filter(d=>d[2]).map(([d,v])=>[d,v.toFixed(1).replace('.',','),Math.round((v-4)/5*100)]),'var(--dom)']],gl:'A szám az alvásod aznap éjjel.',
  log:[['Szept. 9.','észrevétel','Feltűnt: a késői vacsorák utáni éjszakákon rosszabb az alvásod.'],['Szept. 10.','te','„Szerintem inkább a hosszú munkanapok miatt eszem későn.”'],['Szept. 10.','átfogalmazva','Ha az utolsó étkezés 21 óra utánra csúszik, másnap rosszabb az alvás. A munkanap hosszát külön figyelem.'],['Szept. 14.','bizonyíték','Bejött · 6 nap'],['Szept. 16.','bizonyíték','Nem jött be · 8 nap'],['Szept. 20.','bizonyíték','Bejött · 11 nap'],['Szept. 21.','döntés','Megfigyelésre tetted.'],['Szept. 23.','bizonyíték','Bejött · 14 nap']]},
 viz:{t:'Vízbevitel és energia',q:'Több energiád van, ha többet iszol',cat:'Fiziológia · közérzet',who:'falat',st:'proposed',minN:8,lag:0,belief:58,dir:'több',win:14,
  A:['Napi vízbevitel','Víz-számláló','t-water'],B:['Energia-szint','Bejelentkezés','t-heart'],ans:'Ígéretes, és elég nap van a döntéshez.',r:'0,41',p:'0,31',
  pic:()=>pair(['2 liter fölött','6–8',74,'var(--water,#3F8FDB)'],['1,5 liter alatt','4–5',46,'#E7B25A']),
  g:[['2 liter alatt',[['13.','5',33,'1,4 l'],['16.','6',50],['18.','4',17],['21.','6',50]],'#E7B25A'],['2 liter fölött',[['14.','6',50],['17.','8',83],['20.','7',67],['22.','7',67]],'var(--water,#3F8FDB)']],gl:'A szám az energiád aznap, tízes skálán.',
  log:[['Szept. 13.','észrevétel','Feltűnt: a többet ivós napjaidon magasabb volt az esti energiád.'],['Szept. 14.','te','„Lehet, hogy edzésnapon amúgy is többet iszom.”'],['Szept. 14.','átfogalmazva','Ha több vizet iszol, aznap magasabb az energiád. Az edzésnapokat külön jelölöm.'],['Szept. 21.','bizonyíték','Kevés nap · 7 éjszaka'],['Szept. 23.','számítás','Először számolhatóvá vált: 8 közös nap.']]},
 egyhangu:{t:'Egyforma terhelés és reggeli energia',q:'Laposabb vagy, ha három napig ugyanaz a terhelés',cat:'Edzés · közérzet',who:'mocor',st:'proposed',minN:8,lag:1,belief:null,dir:'kevesebb',win:21,
  A:['3 egyforma terhelésű nap','Edzésnapló','t-dumbbell'],B:['Reggeli energia','Bejelentkezés','t-heart'],ans:'Ígéretes, de még gyűlik.',r:'nincs még',p:'nincs még',
  pic:()=>pair(['vegyes terhelés után','6,4',68,'var(--dom)'],['3 egyforma nap után','5,2',46,'#E7B25A'],'1,2 ponttal kevesebb','A reggeli energiád átlaga'),
  g:[['Vegyes terhelés után',[['10.','7',67],['16.','6',50]],'var(--dom)'],['3 egyforma nap után',[['13.','5',33],['19.','4',17],['22.','5',33]],'#E7B25A']],gl:'A szám a reggeli energiád, tízes skálán.',
  log:[['Szept. 15.','észrevétel','Feltűnt: három egyforma terhelésű nap után laposabb a reggeli energiád.'],['Szept. 16.','átfogalmazva','Ha 3 napig ugyanaz a terhelés, a 4. reggelen alacsonyabb az energiád.'],['Szept. 23.','bizonyíték','Kevés nap · 7 éjszaka']]}};
const MSTL={monitoring:'Megfigyelés alatt',proposed:'Gyűlik',confirmed:'Beépült',rejected:'Elvetve'};
const MLOGI={észrevétel:'t-pattern',te:'t-chat',átfogalmazva:'t-repeat',bizonyíték:'t-info',számítás:'t-clock',döntés:'t-tick',tudás:'t-brain'};
const MOV={megerositve:['confirmed','Megerősítetted: beépül a rólad szóló képbe.'],figyeljuk:['monitoring','Figyeljük: tovább számolom, de még nem tanulok belőle.'],elvetve:['rejected','Elvetetted: befagy, többé nem hozom elő.']};
const MS={calc:false};
function minta8(a){const [id,over]=(a||'viz').split('.');const m=MN[id];if(!m)return O.minta(a);
  const ov=MOV[over],st=ov?ov[0]:m.st,n=m.g.reduce((s,x)=>s+x[1].length,0);
  const log=[...m.log,...(ov?[['Szept. 24.','döntés',{confirmed:'Megerősítetted.',monitoring:'Megfigyelésre tetted.',rejected:'Elvetetted, befagyasztva.'}[st]]]:[]),...(st==='confirmed'?[['Szept. 24.','tudás','Bekerült a Tudástárba.']]:[])];
  const dec=ov?`<p class="w3-ok">${TICK}${ov[1]}</p>`:`<div class="w3-ab">${[['megerositve','Megerősítem'],['figyeljuk','Figyeljük'],['elvetve','Elvetem']].map(([k,l],i)=>`<button class="${i?'n8-b':'n9-btn'}" data-m="pdec:${id}:${k}">${l}</button>`).join('')}</div>`;
  const tg=[`${m.lag?m.lag+' nappal később nézi':'ugyanazon a napon nézi'}`,`${m.minN} nap kell a döntéshez`,`várt irány: ${m.dir}`,`${m.win} napos ablak`];
  return page('mezo',{title:m.t,sub:`Minta · ${m.cat}`,back:'mintak'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7(m.who,`${TN[m.who]} mintája · ${MSTL[st]}`)}<h2 class="n7-h">${m.ans} ${m.q}?</h2>
    <div class="w7-pic">${m.pic()}</div>
    ${m.belief!=null?`<p class="w5-cap">Ennyire biztos benne a csapat</p><div class="w8-bl"><span class="w4-lv"><span class="t"><i style="width:${m.belief}%;--c:var(--dom)"></i></span><b>${m.belief}%</b></span></div>`:''}
    ${st==='confirmed'||st==='rejected'?'':mzLine(n>=m.minN?`${n} napot tudok összevetni: ez elég ahhoz, hogy dönts. Ha megerősíted, beépül a rólad szóló képbe.`:`${n} napot tudok összevetni a ${m.minN}-ből. Addig dönthetsz, de én még nem mondanám ki.`)}
    <div class="w7-ans w8-dec">${dec}</div></section>
  <section class="mx-s ln">${KH('A teszt-terv','előre rögzítve')}<div class="w4-rl">${info7(m.A[2],'Ha… '+m.A[0].toLowerCase(),'forrás: '+m.A[1])}${info7(m.B[2],'…akkor '+m.B[0].toLowerCase(),'forrás: '+m.B[1])}</div>
    <span class="w3-tg w8-pt">${tg.map(t=>`<span>${t}</span>`).join('')}</span><div class="w7-kd">${caps(m.minN,Math.min(n,m.minN),`${Math.min(n,m.minN)} nap a ${m.minN}-ből${n>m.minN?` · és még ${n-m.minN} ráadás`:''}`)}</div></section>
  <section class="mx-s ln">${KH('Az eddigi napok',n+' közös nap')}${m.g.map(([l,ds,c])=>tubes(`${l} · ${ds.length} nap`,ds,c)).join('')}${mzLine(m.gl)}</section>
  <section class="mx-s ln">${KH('Ami eddig történt')}<div class="w4-rl">${log.map(([d,k,t])=>info7(MLOGI[k]||'t-info',k==='te'?'Te mondtad':k[0].toUpperCase()+k.slice(1),t,`<i class="w3-st n w8-ld">${d}</i>`)).join('')}</div></section>
  <section class="mx-s ln">${KH('A számítás')}<div class="w4-rl"><button class="ex-mrow w4-r" data-w8="calc" aria-expanded="${MS.calc}">${E.drop('t-gear')}<span class="g"><b>Hogyan számoltuk?</b><i class="q">ablak, források, technikai adatok</i></span><em>${MS.calc?'bezár':'›'}</em></button></div>
    ${MS.calc?`<div class="w8-calc"><p><b>Adatablak:</b> ${m.win} nap · <b>közös nap:</b> ${n} · <b>utolsó számítás:</b> ma 03:10</p><p><b>Források:</b> ${m.A[1]} és ${m.B[1]}, ${m.lag?m.lag+' nappal később':'ugyanazon a napon'}</p><p><b>Az együttmozgás ereje:</b> ${m.r} · <b>a véletlen esélye:</b> ${m.p}</p></div>`:''}</section></div>`)}
O.minta=mz.routes.minta;mz.routes['minta-lista']=O.minta;mz.routes.minta=minta8;
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w8="calc"]');if(!b)return;MS.calc=!MS.calc;const s=b.closest('section');if(s){const sc=document.querySelector('#phone .scroll'),y=sc&&sc.scrollTop;const tmp=document.createElement('div');tmp.innerHTML=minta8(F.ARG);const ns=[...tmp.querySelectorAll('section')].pop();if(ns)s.outerHTML=ns.outerHTML;if(sc)sc.scrollTop=y}});
/* a decision redraws the page (the approved handler, a capture listener on document); read the carousel position on
   window first, then put it back on the card that was answered */
window.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.w5-cr [data-m]');if(!b)return;const x=b.closest('.w5-cr').scrollLeft;
  setTimeout(()=>{const c=document.querySelector('#phone .w5-cr');if(c){c.style.scrollBehavior='auto';c.scrollLeft=x;c.style.scrollBehavior=''}},30)},true);

/* the tab pages' header as on the converted domains: no big title, the "?" top left (sub-pages keep their title) */
/* ═══ DIAGNÓZIS (2026-11-03, owner: "sor + az oldal átalakítása"): reachable straight from the team page now (it sat behind
   Gépterem → Összes funkció). The question on top with the day's three question capsules and one wide "Kérdezd meg most"
   (a tap answers in place: the capsule empties, the button says it is reading); the other questions and the two coming ones
   as rows; the earlier reports as rows. A report: the team's answer, the suspects as levels (the strength of their
   evidence), the reckoning tiles, each suspect on one card with its evidence rows and its trial, "Próbáljuk ki" in place.
   Mezo's own re-render draws the approved pages, so these run on data-w13. ═══ */
O.diagnozis=mz.routes.diagnozis;mz.routes['diagnozis-lista']=O.diagnozis;O.diag=mz.routes.diag;mz.routes['diag-lista']=O.diag;
const ASK13=[['Miért vagyok fáradt?','Az alvásod, az edzéseid és az evésed két hetéből keresem az okot.'],['Miért alszom rosszul?','Az esti szokásaid és az alvásnaplód összevetése.'],['Miért mozog a súlyom?','Valódi változás, vagy víz és só? Heti számvetéssel.']];
const REP13=[['1','augusztus 30.','Miért vagyok fáradt?','A fáradtság mögött leginkább a rövid alvás áll.','Alváshiány'],['2','szeptember 7.','Miért mozog a súlyom?','A súlyod valóban csökken, a napi ugrálás víz.','Víz-visszatartás']];
const DG13={1:{q:'Miért vagyok fáradt?',win:'augusztus 17–30. · az utolsó 14 nap adatából',v:'A fáradtság mögött leginkább a rövid alvás áll; a késői edzések csak rátesznek egy lapáttal.',
   s:[{n:'Alváshiány',st:'erős',p:86,c:'Az utóbbi két hétben átlagosan egy órával kevesebbet aludtál, mint előtte.',ev:[['Alváshossz','6,1 óra','1,2 órával kevesebb','alvásnapló · 13 nap'],['Éjszakai ébredés','3,4','1,1-gyel több','alvásnapló · 13 nap']],pr:['7 nap','Feküdj le hét estén át 23 óra előtt, és figyeljük a reggeli energiádat.']},
      {n:'Késői edzés',st:'mérsékelt',p:52,c:'A 19 óra utáni edzések utáni éjszakák 25 perccel rövidebbek.',ev:[['Esti edzés','4 alkalom','','edzésnapló · 14 nap'],['Alvás utána','5,7 óra','0,6 órával kevesebb','alvásnapló · 4 éjszaka']],pr:['14 nap','Két hétig tedd a nehéz edzésnapokat 18 óra elé.']}]},
  2:{q:'Miért mozog a súlyom?',win:'augusztus 31. – szeptember 6. · heti számvetés',v:'A súlyod valóban csökken; a napi ugrálás a só és a víz, nem a zsír.',szam:[['−0,7 kg','valódi változás'],['82,4 kg','heti átlag'],['83,1 kg','előző hét'],['± 0,9 kg','víz okozta ingadozás']],
   s:[{n:'Víz-visszatartás',st:'erős',p:86,c:'A sósabb napok után reggel 0,6–0,9 kilogrammal többet mutat a mérleg.',ev:[['Sóbevitel','5,8 g','1,4 g-mal több','étkezés · 7 nap'],['Reggeli súly','+0,8 kg','több','súlynapló · 3 reggel']],pr:['7 nap','Egy hétig tartsd a sót 4 g alatt, és nézzük a reggeli súlyt.']},
      {n:'Kalóriahiány',st:'mérsékelt',p:52,c:'Átlagosan napi 420 kalóriával a szintentartó mennyiség alatt eszel.',ev:[['Napi átlag','2 180 kalória','420-szal kevesebb','étkezés · 7 nap']],pr:['7 nap','Maradj ennél, és figyeljük a heti átlagot.']}]}};
const W13={busy:false,probe:{}};
const askTop=()=>`${caps(3,W13.busy?2:3,W13.busy?'egy kérdés épp úton van · napi 3 kérdés':'napi 3 kérdés · a megnyitás mindig ingyen')}`;
function diagnozis13(a){if(a)return O.diagnozis(a);
  return page('mezo',{title:'Diagnózis',sub:'Kérdések a csapatnak · 2 riport',back:'csapat'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','Kérdezd meg a csapatot')}<h2 class="n7-h">${ASK13[0][0]}</h2><p class="ex-dates w13-l">${ASK13[0][1]}</p>
    <div class="w13-cap" id="w13-cap">${askTop()}</div>
    <div class="ex-acts w3-wide"><button class="n9-btn" data-w13="ask" id="w13-ask">${W13.busy?'A két hét adatait olvasom…':'Kérdezd meg most'}</button></div></section>
  <section class="mx-s ln">${KH('Más kérdések')}<div class="w4-rl">${ASK13.slice(1).map(q=>`<button class="ex-mrow w4-r" data-toast="Kérdés feltéve — a riport készül">${E.drop('t-spark')}<span class="g"><b>${q[0]}</b><i class="q">${q[1]}</i></span><em>›</em></button>`).join('')}
    ${info7('t-spark','Kell most könnyítő hét?','hamarosan')}${info7('t-spark','Havi Mezo-riport','hamarosan')}</div>
    ${mzLine('Így megy: kérdés, aztán a gyanúsítottak bizonyítékkal, végül egy próba. Naponta három kérdés, a megnyitás mindig ingyen.')}</section>
  <section class="mx-s ln">${KH('Korábbi riportok')}<div class="w4-rl">${REP13.map(r=>`<button class="ex-mrow w4-r" data-go="diag.${r[0]}">${E.drop('t-gem')}<span class="g"><b>${r[2]}</b><i class="q">${r[1]} · ${r[3]} A legerősebb gyanúsított: ${r[4]}.</i></span><em>›</em></button>`).join('')}</div></section></div>`)}
const probeBtn=(id,i)=>W13.probe[id+':'+i]?(i===0?`<button class="n8-b" data-go="kiserletek">Aktív kísérlet lett: a Kísérletek oldalon követed ›</button>`:`<p class="ex-dates w13-ok">Elindítva: aktív kísérlet lett.</p>`):`<button class="n9-btn" data-w13="probe:${id}:${i}">Próbáljuk ki</button>`;
function diag13(id){const d=DG13[id];if(!d)return O.diag(id);
  return page('mezo',{title:d.q,sub:'Riport · '+d.win,back:'diagnozis'},`<div class="mx">
  <section class="mx-s ex-hero">${eb7('mezo','A csapat válasza · '+d.win.split(' · ')[0])}<h2 class="n7-h">${d.v}</h2>
    <div class="w4-tb w13-vi">${F.vials(d.s.map(s=>({l:s.n,ic:s.st==='erős'?'t-diagnose':'t-spark',p:s.p,v:s.st,c:s.st==='erős'?'#E7B25A':'var(--dom)'})).concat([{l:'A próba',ic:'t-flask',p:0,v:'vár'}]),{h:118})}</div>
    ${mzLine('A szint a bizonyíték ereje. Mérsékelt a bizonyosság: azóta új adatod érkezett, a próba dönti el.')}</section>
  ${d.szam?`<section class="mx-s ln">${KH('Számvetés')}<div class="w13-st">${d.szam.map(([v,l])=>`<span><b>${v}</b><small>${l}</small></span>`).join('')}</div></section>`:''}
  <section class="mx-s ln">${KH('Gyanúsítottak, erősség szerint')}<div class="w13-sl">${d.s.map((s,i)=>`<article class="w13-c">
    <small class="w13-e${s.st==='erős'?' w':''}">${i+1}. gyanúsított · ${s.st}</small><h3>${s.n}</h3><p>${s.c}</p>
    <span class="w13-lv"><i style="width:${s.p}%;background:${s.st==='erős'?'#E7B25A':'var(--dom)'}"></i></span>
    <div class="w13-ev">${s.ev.map(e=>`<div><span><b>${e[0]}</b><small>${e[3]}</small></span><em>${e[1]}${e[2]?`<small>${e[2]}</small>`:''}</em></div>`).join('')}</div>
    <div class="w13-pr">${E.drop('t-flask')}<span><b>Próba · ${s.pr[0]}</b><small>${s.pr[1]}</small></span></div>
    <div class="ex-acts w13-pa" id="w13-p-${id}-${i}">${probeBtn(id,i)}</div></article>`).join('')}</div></section></div>`)}
mz.routes.diagnozis=diagnozis13;mz.routes.diag=diag13;
document.addEventListener('click',e=>{const el=e.target.closest('[data-w13]');if(!el)return;e.preventDefault();e.stopPropagation();const ph=el.closest('.phone');if(!ph)return;
  const [k,id,i]=el.dataset.w13.split(':');
  if(k==='ask'){W13.busy=!W13.busy;const c=ph.querySelector('#w13-cap');if(c)c.innerHTML=askTop();el.textContent=W13.busy?'A két hét adatait olvasom…':'Kérdezd meg most';return}
  if(k==='probe'){W13.probe[id+':'+i]=1;const b=ph.querySelector(`#w13-p-${id}-${i}`);if(b)b.innerHTML=probeBtn(id,+i)}},true);

Object.keys(mz.routes).forEach(k=>{const f=mz.routes[k];if(typeof f==='function'&&!f.__hub){const g=(...a)=>hubHead(f(...a));g.__hub=1;mz.routes[k]=g}});

const ansOf=p=>{const r=RS[p.id];
  const btns=p.dec?[['yes','Igen, igaz rám'],['no','Nem igaz rám']]:[['up','Ez talál'],['down','Nem így érzem']];
  return p.done?`<p class="w3-ok">${TICK}${p.done} · bekerült a rólad szóló képbe</p>`
    :r?`<p class="w3-ok">${TICK}Megjegyeztem: ${RL[r]}.</p><button class="fh-lk" data-w3="undo:${p.id}">Visszavonom</button>`
    :`<div class="w3-ab">${btns.map(([k,l],i)=>`<button class="${i?'n8-b':'n9-btn'}" data-w3="r:${p.id}:${k}">${l}</button>`).join('')}<button class="n8-b" data-w3="tell:${p.id}">Elmesélem</button></div>
      ${RE[p.id]?`<textarea class="fh-in w3-in" rows="3" placeholder="Mi az, amit csak te tudhatsz erről?" aria-label="A te részed"></textarea><button class="n9-btn w3-send" data-w3="send:${p.id}">Elküldöm</button>`:''}`};
/* the drawer: who and when big, the headline, the whole text, the picture, the evidence and links, the thread, then the
   answer — quick buttons, or a few words in the field */
function sheet(id){const p=id==='gyors'?PILL:byId(id);if(!p)return '';const r=RS[p.id];
  const links=[p.ev?(p.ev.sheet?`<button class="fh-lk" data-sheet="${p.ev.sheet}">${p.ev.l} ›</button>`:`<button class="fh-lk" data-go="${p.ev.go}">${p.ev.l} ›</button>`):'',...(p.links||[]).map(([l,go])=>`<button class="fh-lk" data-go="${go}">${l} ›</button>`)].join('');
  const thr=p.thr?`<section class="dv-s"><h3>${p.thr.n} hozzászólás</h3><p class="w3-ts">${minis(p.thr.ids)}${p.thr.sum}</p>${p.thr.c.map(([k,t])=>`<div class="w3-cm">${badge(k,{s:34})}<div><b>${TN[k]}</b><p>${t}</p></div></div>`).join('')}<button class="fh-lk" data-go="${p.thr.all}">Mind a ${p.thr.n} hozzászólás ›</button></section>`:'';
  return `<div class="dv w3-sh" data-w3s="${p.id}"><div class="w3-shd">${badge(p.who,{s:56})}<div><small>${TN[p.who]} · ${p.t}</small><b>${p.kind[0].toUpperCase()+p.kind.slice(1)}</b></div></div>
  <h2 class="w3-shh">${p.h}</h2><div class="mg-tx"><p>${p.x}</p></div>
  ${p.pic?`<div class="w3-pic big">${p.pic()}</div>`:''}${tagsOf(p)}${links?`<div class="w3-lk">${links}</div>`:''}
  ${p.own?`<button class="dv-btn pri w3-own" data-toast="${p.own[1]}">${p.own[0]}</button>`:''}
  ${thr}<section class="dv-s"><h3>${p.dec?'Igaz ez rád?':'Mit szólsz hozzá?'}</h3>${ansOf(p)}</section>
  <button class="fh-lk w3-more" data-sheet="menu">A bejegyzés menüje ›</button></div>`}
mz.sheets.w3=sheet;

/* in-place updates: the card, the top, Rád vár and the open drawer redraw; the page does not move */
function refresh(id){const ph=document.querySelector('#phone');if(!ph)return;
  const c=ph.querySelector(`[data-w3c="${id}"]`),p=id==='gyors'?PILL:byId(id);if(c&&p)c.outerHTML=cardOf(p);
  const t=ph.querySelector('#w3-top');if(t)t.outerHTML=topOf();const rv=ph.querySelector('#w3-rv');if(rv)rv.outerHTML=radVar();
  const o=ph.querySelector('.w3-old');if(o){const l=olderLeft();o.classList.toggle('w',!!l);o.querySelector('small').textContent=l?`${l} bejegyzésre még nem reagáltál`:'mindenre reagáltál'}
  if(F.ARG==='korabbi'){const h=ph.querySelector('.mx .n7-h'),l=olderLeft();if(h)h.textContent=l?`${l} bejegyzésre még nem reagáltál.`:'Itt mindenre reagáltál.'}
  const ca=ph.querySelector(`[data-w7a="${id}"]`);if(ca&&p)ca.innerHTML=ansOf(p);
  const s=ph.querySelector(`#sheet [data-w3s="${id}"]`);if(s)s.outerHTML=sheet(id)}
const TT={up:'„Ez talál” — köszönjük, feljegyeztük.',down:'„Nem így érzem” — ebből tanulunk a legtöbbet.',yes:'Bekerült. Bármikor visszavonhatod a Rólad oldalon.',no:'Rendben, nem építünk rá.',reply:'Elküldve — a csapat újraértékeli vele a képet.'};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-w3]');if(!b)return;e.preventDefault();const [k,id,v]=b.dataset.w3.split(':');
  if(k==='adag'){WS.adag=!WS.adag;const ph=document.querySelector('#phone'),a=ph&&ph.querySelector('[data-w7k]'),d=ph&&ph.querySelector('[data-w7d]');if(a)a.innerHTML=kAns();if(d)d.innerHTML=kday();F.toast(WS.adag?'Ma esti adag megjelölve':'Visszavonva');return}
  if(k==='pill'){if(WS.pill)return;WS.pill=true;const ph=document.querySelector('#phone'),l=ph&&ph.querySelector('[data-w3d="ma"]');if(l)l.insertAdjacentHTML('afterbegin',cardOf(PILL));b.classList.remove('on');ph&&ph.querySelector('.scroll')?.scrollTo({top:0,behavior:'smooth'});return}
  if(k==='r'){RS[id]=v;RE[id]=false;refresh(id);F.toast(TT[v]);return}
  if(k==='undo'){delete RS[id];refresh(id);F.toast('Visszavonva');return}
  if(k==='tell'){RE[id]=!RE[id];refresh(id);const ta=document.querySelector('#sheet.on .w3-in')||document.querySelector('#phone [data-w7a] .w3-in');if(ta)ta.focus();return}
  if(k==='send'){const ta=b.parentElement.querySelector('.w3-in');if(ta&&!ta.value.trim()){F.toast('Írj pár szót — ebből tanul a csapat.');return}RS[id]='reply';RE[id]=false;refresh(id);F.toast(TT.reply)}},true);

F.css(`${P} .w13-vi{margin:14px 22px 0!important}${P} .w13-vi .k2-vials{gap:10px}${P} .w13-l{font-size:15px;line-height:1.45}${P} .w13-cap{margin:14px 22px 0}
${P} .w13-st{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:4px 18px 0}${P} .w13-st span{display:grid;gap:3px;padding:14px 12px;border-radius:20px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w13-st b{font:800 19px/1.1 var(--disp);color:var(--ink)}${P} .w13-st small{font-size:13px;color:var(--ink)}
${P} .w13-sl{display:grid;gap:12px;margin:4px 18px 0}${P} .w13-c{padding:16px;border-radius:24px;background:#fff;box-shadow:0 10px 24px -16px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}
${P} .w13-e{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12.5px;font-weight:700;color:var(--ink);background:color-mix(in srgb,var(--dom) 12%,#fff)}${P} .w13-e.w{background:#FBEFD6;color:#8A5A08}
${P} .w13-c h3{margin:8px 0 0;font:800 19px var(--disp);color:var(--ink)}${P} .w13-c>p{margin:6px 0 0;font-size:15px;line-height:1.45;color:var(--ink)}
${P} .w13-lv{display:block;height:12px;margin-top:12px;border-radius:999px;background:#EEF4F7;overflow:hidden}${P} .w13-lv i{display:block;height:100%;border-radius:999px}
${P} .w13-ev{display:grid;margin-top:10px}${P} .w13-ev>div{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid rgba(10,42,60,.07)}
${P} .w13-ev span{flex:1;display:grid;gap:2px;min-width:0}${P} .w13-ev b{font-size:15px;color:var(--ink)}${P} .w13-ev small{font-size:13px;color:var(--ink)}
${P} .w13-ev em{font-style:normal;text-align:right;font:800 16px var(--disp);color:var(--ink);display:grid;gap:2px}${P} .w13-ev em small{font:600 12.5px var(--ff,inherit)}
${P} .w13-pr{display:flex;gap:12px;align-items:center;margin-top:8px;padding:12px;border-radius:18px;background:color-mix(in srgb,var(--dom) 7%,#fff)}${P} .w13-pr>svg.ng{width:42px;height:42px;flex:none;margin:0}
${P} .w13-pr span{display:grid;gap:2px}${P} .w13-pr b{font-size:15px;color:var(--ink)}${P} .w13-pr small{font-size:13.5px;line-height:1.35;color:var(--ink)}
${P} .w13-pa{margin:12px 0 0}${P} .w13-pa .n9-btn{flex:1}${P} .w13-ok{margin:0;font-weight:700}

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
${P} .w4-tb{margin:16px 10px 0}${P} .w4-tb .k2-vials{gap:6px}${P} .w4-tb .k2-vial{min-width:0}${P} .w4-tb+.ex-mz{margin-top:20px}${P} .w4-tb .k2-vial small{color:var(--ink);font-weight:650;font-size:12.5px;white-space:nowrap;letter-spacing:-.02em}${P} .w4-tb .k2-tube em:not(:empty){color:#A86A0C!important;background:#fff}
${P} .w4-m{padding:16px;border-radius:24px;background:#fff;box-shadow:0 12px 28px -20px rgba(10,42,60,.4),0 0 0 1px rgba(10,42,60,.05)}
${P} .w4-h{display:flex;align-items:center;gap:12px}${P} .w4-h .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .w4-h .g b{font:800 17px var(--disp,inherit);color:var(--ink)}${P} .w4-h .g small{font-size:13px;color:var(--ink);opacity:.75}
${P} .w3-st.n{color:var(--ink);background:rgba(10,42,60,.06)}
${P} .w4-x{margin:12px 0 0;font-size:14.5px;line-height:1.45;color:var(--ink)}
${P} .w4-lv{display:flex;align-items:center;gap:10px;margin-top:12px}${P} .w4-lv .t{flex:1;height:14px;border-radius:999px;background:rgba(10,42,60,.07);overflow:hidden}${P} .w4-lv .t i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c))}
${P} .w4-lv b{flex:none;min-width:44px;text-align:right;font:800 18px var(--disp,inherit);color:var(--ink)}${P} .w4-lb{margin:4px 0 0;font-size:13px;font-weight:600;color:var(--ink);opacity:.75}
${P} .w4-a{display:flex;justify-content:flex-end;margin-top:12px}${P} .w4-a .n8-b{margin:0;min-height:44px}
${P} .w4-rl{display:grid;gap:10px;margin:0 14px}${P} .w4-r{width:100%;text-align:left}${P} .w4-r em{margin-left:auto;font-style:normal;font-size:18px;font-weight:700;color:var(--dom)}
@media (max-width:360px){${P} .w4-tb{margin:16px 4px 0}${P} .w4-tb .k2-vial small{font-size:12px;letter-spacing:-.04em}}
${P} .w5-by{display:flex;align-items:center;gap:8px}${P} .w5-q{font-size:25px!important;line-height:1.2}${P} .w5-cap{margin:22px 22px 4px;font-size:14px;font-weight:700;color:var(--ink)}
${P} .w5-sh{position:relative;margin:8px 14px 0;padding-bottom:6px}${P} .w5-sh .k2-vials{gap:6px}${P} .w5-sh .k2-vial{min-width:0}${P} .w5-sh .k2-vial small{color:var(--ink);font-weight:650;font-size:12.5px;white-space:nowrap;letter-spacing:-.03em}
${P} .w5-shf{position:absolute;left:0;right:0;bottom:0;height:6px;border-radius:4px;background:rgba(10,42,60,.1)}${P} .w5-sh+.w5-sh .k2-vials{grid-template-columns:repeat(4,minmax(0,1fr))!important;padding:0 6%}
${P} .w5-lk{margin:6px 22px 0}
${P} .w5-cr{align-items:flex-start}${P} .w5-d{padding:16px}${P} .w5-d.dim{opacity:.8}
${P} .w5-d .mz-lab{display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--ink)}${P} .w5-d .mz-lab span{color:var(--ink)!important;opacity:.85;text-align:left!important;font-weight:650}${P} .w5-d .mz-by{display:flex;align-items:center;gap:8px;font-size:14px;opacity:1!important}
${P} .w5-d .mz-q{font:800 18px/1.3 var(--disp,inherit);color:var(--ink);margin:12px 0 0}${P} .w5-d .mz-srcq{font-size:14px;color:var(--ink);background:rgba(10,42,60,.05)}${P} .w5-d .mz-sub{font-size:14px;line-height:1.45;color:var(--ink);opacity:.85}${P} .w5-d .mz-sub b{opacity:1}
${P} .w5-d .mz-v{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}${P} .w5-d .mz-v .n9-btn{flex:1 0 100%;margin:0;min-height:46px}${P} .w5-d .mz-v .n8-b{margin:0;min-height:44px}
${P} .w5-d .mz-warn{font-size:14px;color:#8A5513}${P} .w5-d .fh-row .g strong{font-size:15px}${P} .w5-d .fh-row .g small{color:var(--ink);opacity:.8}${P} .w5-d .mz-done{font-size:14px;color:#1F7A4D}
${P} .w5-d .mz-ed .fh-acts{display:flex;gap:10px;align-items:center;margin-top:10px}
${P} .w5-tg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 14px}
${P} .w5-t{display:flex;flex-direction:column;align-items:flex-start;padding:14px;border-radius:22px;background:#fff;text-align:left;box-shadow:0 10px 24px -18px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}${P} .w5-t svg.ng{width:46px;height:46px;margin:0 0 4px -4px}
${P} .w5-t b{font:800 30px/1 var(--disp,inherit);color:var(--ink)}${P} .w5-t span{margin-top:4px;font-size:15px;font-weight:750;color:var(--ink)}${P} .w5-t small{margin-top:2px;font-size:13px;line-height:1.35;color:var(--ink);opacity:.8}
${P} .w5-f{display:flex;align-items:center;gap:12px;padding:14px;border-radius:22px;background:#fff;box-shadow:0 10px 24px -18px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}${P} .w5-f .g{flex:1;min-width:0;display:flex;flex-direction:column}${P} .w5-f .g b{font-size:15px;line-height:1.3;color:var(--ink)}${P} .w5-f .g small{margin-top:3px;font-size:13px;color:var(--ink);opacity:.75}
${P} .w5-f .w3-st{align-self:flex-start;margin-top:8px}${P} .w5-t .ng-pipe,${P} .w5-t .ng-flow,${P} .w5-le .ng-pipe,${P} .w5-le .ng-flow{display:none}${P} .mx-h span{color:var(--ink);opacity:.8;font-weight:650}${P} .w5-le .w3-st{margin-left:auto}${P} .w5-le.dim svg.ng{opacity:.6}
@media (max-width:360px){${P} .w5-q{font-size:22px!important}${P} .w5-sh{margin:8px 10px 0}${P} .w5-sh+.w5-sh .k2-vials{padding:0;gap:8px}${P} .w5-sh .k2-vial small{font-size:12px;letter-spacing:-.05em}}
${P} .w6-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:8px 14px 0}
${P} .w6-d{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:0}${P} .w6-d .t{position:relative;width:100%;max-width:44px;height:78px;border-radius:16px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.12)}
${P} .w6-d .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c))}${P} .w6-d.x .t{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.25);outline:1.5px dashed rgba(10,42,60,.25);outline-offset:-1.5px}
${P} .w6-d.now .t{box-shadow:inset 0 0 0 2px var(--dom)}${P} .w6-d b{font-size:13px;font-weight:800;color:var(--ink);white-space:nowrap}${P} .w6-d small{font-size:12px;line-height:1.2;font-weight:600;color:var(--ink);text-align:center;opacity:.85}
${P} .w6-dt{margin-right:auto}${P} .w3-hd svg.ng{width:46px;height:46px;margin:-4px 0 -4px -4px;flex:none}${P} .w3-hd .ng-pipe,${P} .w3-hd .ng-flow{display:none}
${P} .w6-s{display:flex;align-items:center;gap:10px;width:calc(100% - 28px);margin:0 14px;min-height:56px;padding:8px 10px 8px 16px;border-radius:999px;background:#fff;text-align:left;box-shadow:0 0 0 1.5px rgba(10,42,60,.1)}
${P} .w6-s svg.ic{width:26px;height:26px;flex:none}${P} .w6-s span{flex:1;font-size:15px;color:var(--ink);opacity:.7}${P} .w6-s span.on{opacity:1;font-weight:650}${P} .w6-s b{flex:none;padding:10px 16px;border-radius:999px;background:color-mix(in srgb,var(--dom) 12%,#fff);font-size:14px;color:color-mix(in srgb,var(--dom) 80%,var(--ink))}
${P} .w6-ex{display:flex;flex-wrap:wrap;gap:8px;margin:12px 14px 0}${P} .w6-ex .n8-b{margin:0;min-height:44px}${P} .w6-hits{margin-top:12px}${P} .w6-h{width:100%;text-align:left}${P} .w6-h .w4-lv{margin-top:10px}
${P} .w6-hits+.ex-mz{margin-top:14px}
@media (max-width:360px){${P} .w6-wk{gap:4px;margin:8px 8px 0}${P} .w6-d small{font-size:12px;letter-spacing:-.03em}}
${P} .w7-pic{margin:16px 22px 0}${P} .w7-ans{margin:18px 22px 0}${P} .w7-ans .w3-ab .n9-btn{flex:1 0 100%}
${P} .w7-cm{display:flex;gap:12px;margin:0 14px;padding:14px;border-radius:22px;background:#fff;box-shadow:0 10px 24px -18px rgba(10,42,60,.35),0 0 0 1px rgba(10,42,60,.05)}${P} .w3-l .w7-cm{margin:0}
${P} .w7-cm>div{flex:1;min-width:0}${P} .w7-cm b{font-size:15px;color:var(--ink)}${P} .w7-cm b small{margin-left:4px;font-size:13px;font-weight:600;opacity:.75}${P} .w7-cm p{margin:4px 0 0;font-size:15px;line-height:1.55;color:var(--ink)}
${P} .w7-cm.dec{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--dom) 45%,#fff),0 10px 24px -18px rgba(10,42,60,.35)}
${P} .w7-rp{margin-top:14px}${P} .w7-sum{margin:0 22px 6px;font:800 18px var(--disp,inherit);color:var(--ink)}
${P} .w7-ng{margin:12px 14px 0}${P} .w7-nl{margin:0 4px 8px;font-size:14px;font-weight:700;color:var(--ink)}${P} .w7-nr{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:5px}
${P} .w7-n{display:flex;flex-direction:column;align-items:center;gap:3px}${P} .w7-n .t{position:relative;width:100%;max-width:34px;height:56px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.12)}
${P} .w7-n .t i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 55%,#fff),var(--c))}${P} .w7-n.x .t{outline:2px dashed rgba(10,42,60,.45);outline-offset:-2px}
${P} .w7-n b{font-size:13px;font-weight:800;color:var(--ink)}${P} .w7-n small{font-size:12px;font-weight:600;color:var(--ink);opacity:.8}
${P} .w7-rows{margin-top:14px}
${P} .w7-hit{align-self:flex-start;margin-top:8px}${P} .w3-pr .t b.lo{color:var(--ink);text-shadow:none}${P} .w7-pic+.w3-mz{margin-top:16px}${P} .w7-cm>.fh-drop,${P} .w7-cm>.ex-dr{flex:none}
${P} .w7-kd{margin:14px 14px 0}${P} .w7-dy{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
${P} .w7-d{display:flex;flex-direction:column;align-items:center;gap:4px}${P} .w7-d i{width:100%;max-width:38px;height:34px;border-radius:12px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.12)}
${P} .w7-d.on i{background:linear-gradient(180deg,var(--liq1),var(--liq2));box-shadow:none}${P} .w7-d.off i{background:rgba(10,42,60,.06);box-shadow:none}${P} .w7-d.now i{outline:2px dashed color-mix(in srgb,var(--dom) 70%,var(--ink));outline-offset:-2px}
${P} .w7-d b{font-size:13px;font-weight:800;color:var(--ink)}${P} .w8-c{margin:0 14px;padding:14px;border-radius:24px;background:#fff;box-shadow:0 12px 28px -20px rgba(10,42,60,.4),0 0 0 1px rgba(10,42,60,.05)}
${P} .w8-tide{margin:8px 14px 0}${P} .w8-tide .gt b{font-size:12.5px}${P} .w8-tide .gt small{font-size:12px;opacity:.85}${P} .w8-tide .gt em{font-size:12px}
${P} .w8-c .fh-msg .nm small,${P} .w8-c .mz-tag span,${P} .w8-c .mz-tag .st,${P} .w8-c .mz-me small{font-size:12.5px!important}${P} .w8-c .mz-v button{min-height:40px}${P} .w8-lg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 22px 0;font-size:13px;font-weight:650;color:var(--ink)}${P} .w8-lg span{display:inline-flex;align-items:center;gap:6px}
${P} .w8-lg i{width:12px;height:12px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:inset 0 0 0 1.5px var(--dom)}${P} .w8-lg i.f{background:var(--dom)}${P} .w8-lg i.h{background:linear-gradient(0deg,var(--dom) 50%,#fff 50%)}
${P} .w8-tg{margin:14px 22px 0}${P} .w8-pt{margin:14px 14px 0}
${P} .w8-d .g{gap:6px}${P} .w8-t{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:60px;height:48px;border-radius:14px;background:color-mix(in srgb,var(--dom) 14%,#fff)}${P} .w8-t.late{background:#FCEFD9}
${P} .w8-t b{font-size:15px;font-weight:800;color:var(--ink)}${P} .w8-t small{font-size:12px;font-weight:650;color:var(--ink);opacity:.8}
${P} .w8-bl{margin:6px 22px 0}${P} .w8-dec .w3-ab .n9-btn{flex:1 0 100%}${P} .w8-ld{align-self:flex-start;margin-top:6px}
${P} .w8-calc{margin:12px 14px 0;padding:14px;border-radius:20px;background:#fff;box-shadow:0 0 0 1px rgba(10,42,60,.06)}${P} .w8-calc p{margin:0 0 6px;font-size:14px;line-height:1.5;color:var(--ink)}
${P} .w9-r{align-items:flex-start}${P} .w9-r .w4-lv{margin-top:6px}${P} .w9-r .w3-st{align-self:flex-start;margin-top:8px}${P} .w9-sw button{text-align:center;justify-content:center}
${P} .w7-n small{white-space:nowrap}${P} .w9-n{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:14px;background:color-mix(in srgb,var(--dom) 14%,#fff);font:800 16px var(--disp,inherit);color:var(--ink)}
${P} .w9-nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 14px}${P} .w9-nav .n8-b{margin:0}
${P} .w9-sw{display:flex;gap:4px;margin:14px 14px 0;padding:4px;border-radius:999px;background:rgba(10,42,60,.06)}${P} .w9-sw button{flex:1;min-height:44px;border-radius:999px;font-size:14.5px;font-weight:750;color:var(--ink)}${P} .w9-sw button.on{background:#fff;box-shadow:0 4px 12px -6px rgba(10,42,60,.35)}
${P} .w9-tb{display:none;gap:10px;padding:0 12px 14px}${P} .w9-th.on .w9-tb{display:grid}${P} .w9-tb .w7-cm{margin:0;box-shadow:0 0 0 1px rgba(10,42,60,.07)}
${P} .w9-q{margin:0 22px 12px;font-size:15px;font-style:italic;line-height:1.5;color:var(--ink)}
${P} .w10-by{margin-top:4px;font-style:normal;font-size:13px;font-weight:650;color:var(--ink);opacity:.8}
${P} .w10-cb{padding:16px}${P} .w10-cb>p{margin:10px 0 8px;font:700 16px/1.45 var(--disp,inherit);color:var(--ink)}${P} .w10-cl.dim{opacity:.7}${P} .w10-cb .w3-ab,${P} .w10-cb .w3-ok{margin-top:12px}
${P} .w5-f>svg.ng,${P} .w7-cm>svg.ng{width:46px;height:46px;flex:none;margin:0}${P} .w10-f[hidden],${P} .w9-v[hidden]{display:none!important}${P} .w10-f{align-items:flex-start}${P} .w10-f.dim{opacity:.65}${P} .w10-f .w4-lv{margin-top:8px}${P} .w10-st{margin-top:6px;font-style:normal;font-size:13px;font-weight:650;color:var(--ink)}
${P} .w10-sw{flex:none;position:relative;width:56px;height:44px;margin:-6px -4px 0 0}${P} .w10-sw::before{content:'';position:absolute;inset:7px 3px;border-radius:999px;background:rgba(10,42,60,.15);transition:background .2s}
${P} .w10-sw i{position:absolute;top:10px;left:6px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(10,42,60,.25);transition:left .2s}${P} .w10-sw.on::before{background:var(--dom)}${P} .w10-sw.on i{left:26px}
${P} .w10-ct .n8-b.on{background:var(--dom);color:#fff;box-shadow:none}${P} .w10-fb{margin:10px 0 4px}${P} .w10-fb .w5-f{margin:0}${P} .w10-off{opacity:.6}
${P} .w10-cp{flex-wrap:wrap}${P} .w10-cp i{flex:0 0 calc((100% - 28px)/8)}${P} .w10-cp i.hf{background:linear-gradient(0deg,var(--liq2) 50%,rgba(10,42,60,.06) 50%);box-shadow:none}${P} .w10-cp i.x{background:none;outline:2px dashed rgba(10,42,60,.35);outline-offset:-2px;box-shadow:none}
${P} .w10-st8{display:grid;gap:4px;margin:8px 14px 0}${P} .w10-st8 span{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;}
${P} .w10-st8 b{font-size:14.5px;color:var(--ink)}${P} .w10-st8 small{flex:none;font-size:13px;font-weight:650;color:var(--ink)}${P} .w10-st8 .dim{opacity:.6}
${P} .w11-pg{display:flex;gap:8px;margin:0 14px}${P} .w11-pg .n8-b{flex:1;margin:0}
${P} .w11-st{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 14px 0}${P} .w11-st .w7-d i{max-width:none;height:30px}${P} .w11-st .w7-d small{white-space:normal}
${P} .w11-ma{margin:0 22px 12px}${P} .w11-fl{margin:2px 0 2px 64px;font-size:13px;font-weight:650;color:var(--ink);opacity:.8}
${P} .w11-sw{margin:0 14px}${P} .w11-sw button{font-size:13.5px}${P} .w11-sb .w7-cm{margin:0 14px}${P} .w11-sb>.w4-rl{margin:0}
${P} .w11-au{display:flex;align-items:flex-end;gap:4px;height:90px;margin:14px 22px 0}${P} .w11-au span{position:relative;flex:1;height:100%;display:flex;align-items:flex-end}
${P} .w11-au i{position:absolute;left:0;right:0;bottom:0;border-radius:6px 6px 2px 2px;background:color-mix(in srgb,var(--dom) 45%,#fff)}${P} .w11-au i.o{background:var(--dom)}
${P} [data-w11v][hidden],${P} [data-w11s][hidden]{display:none!important}
${P} .w7-dc{margin:10px 4px 0;font-size:13.5px;font-weight:650;line-height:1.4;color:var(--ink)}${P} .w7-d small .w3-tk{color:#1F7A4D}${P} .w7-d small{min-height:16px;font-size:12.5px;font-weight:650;color:var(--ink);opacity:.8;text-align:center;line-height:1.2}
@media (max-width:360px){${P} .w7-nr{gap:3px}${P} .w7-n b{font-size:12px}}
@media (max-width:360px){${P} .w3-h{font-size:17px}${P} .w3-hd{gap:10px}${P} .w3-st{padding:4px 8px;font-size:12px}${P} .w3-tap{padding:14px}}
`);

window.FNOTES_FOLY=(window.FNOTES_FOLY||'')+`<h2>Kísérlet · Mezo</h2><p><a href="#w-mezo-mai"><b>Üzenőfal</b></a> — felül a mondat, a csapat öt cseppje (csak kép) és a Megnézem; a Rád vár marad; Ma és a tegnap esti kiadás egyforma bejegyzés-kártyákon (ki, mikor, fajta, állapot, kiemelt mondat, két sor, a bejegyzés kis képe, Elolvasom); a teljes szöveg, a vita, a Miből látszik és a válasz a felcsúszó fiókban. A régebbi napok egy gomb mögött: <a href="#w-mezo-mai.korabbi">Korábbi napok</a>. Összevetésnek: <a href="#w-mezo-mai-lista">a mostani Üzenőfal</a>.</p><p><a href="#w-mezo-csapat"><b>A csapat</b></a> — a mondat a legjobban ismerő tagról, öt cső (mennyire érett a képük rólad), Mezo mondata a leggyengébbről és a Bejelentkezem gomb; minden tag (a Szkeptikus is) egyforma kártyán; Konzílium és Gépterem csepp-sorként. Összevetésnek: <a href="#w-mezo-csapat-lista">a mostani A csapat</a>.</p><p><a href="#w-mezo-rolad"><b>Rólad</b></a> — a legbiztosabb mondat a szív, a kilenc témakör csövei két polcon teljes szavakkal, a döntések lapozóban pöttyökkel, a Tudástár négy csempén, a tények kártyákon, az életesemények és a Tovább csepp-sorként. Összevetésnek: <a href="#w-mezo-rolad-lista">a mostani Rólad</a>.</p><p><a href="#w-mezo-emlekek"><b>Emlékek</b></a> — a heted története, a hét napja kapszulaként annyira telve, amilyen a nap volt (egy szóval alatta), a napi emlékek egyforma kártyán, a hasonló napok keresése igazi mezővel és példákkal, a találatok kártyán hasonlósági csíkkal. Összevetésnek: <a href="#w-mezo-emlekek-lista">a mostani Emlékek</a>.</p><p><a href="#w-mezo-poszt.vacsora"><b>Az ügy oldala</b></a> — ugyanaz a kép és válasz, mint a fal kártyáján, a teljes szöveg, a beszélgetés kártyákon (Mezo döntése kiemelve), lent a 14 este fajtánként csoportosítva. Összevetésnek: <a href="#w-mezo-poszt-lista.vacsora">a mostani ügy-oldal</a>.</p>`;
})();
