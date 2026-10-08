/* vilagos/fuel.js — Fuel domain in the "Világos · élő" look (Mai · Kiegészítők · Trendek · Konyha + every inner page and sheet).
   Built on window.F (see vilagos/README.md). Content and parity source: csepp/fuel.js; route names = elo/fuel.html. */
(function(){
const {I,page,sec,card,head,hero,btn,lk,step,row,bar,grid,seg,pills,st,ring,note,txt,empty,msg,chev,esc,register}=F;
const P='.phone[data-v="feher"][data-d="fuel"]';
const fmt=n=>String(n).replace('.',',');
const kc=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');
/* a kit stat() sávja önmagára hivatkozó --c-t kap (style="--c:var(--c)"), ettől minden sáv a terület színére esik vissza; itt levesszük, hogy a csempe színét örökölje */
const stat=o=>F.stat({...o,n:String(o.n).replace(/ /g,'\u00a0')}).replace('style="--c:var(--c)"','');
const pc=(v,t)=>Math.max(0,Math.min(100,Math.round(v/t*100)));

/* ── adatok (az élő mock alapján, mai nap: szerda, október 7.) ─────────── */
const DAY={eaten:2060,target:3100,p:[148,220],c:[224,380],f:[58,95],fib:[18,30],water:[1.3,2.5],now:'14:10'};
const SLOTS=[{k:'reggeli',l:'Reggeli',ic:'t-sun',from:'07:00',to:'10:00',b:640},{k:'ebed',l:'Ebéd',ic:'t-bowl',from:'12:00',to:'14:30',b:900},{k:'uzsonna',l:'Uzsonna',ic:'t-snack',from:'16:00',to:'17:30',b:420},{k:'vacsora',l:'Vacsora',ic:'t-moon',from:'19:00',to:'21:00',b:840}];
const MEALS={
  reggeli:{slot:'Reggeli',w:0,name:'Túrós zabkása · áfonyával',time:'07:20',kcal:689,score:8.4,macro:[49,74,22],fib:7,glu:0,
    ings:[['Zabpehely · gluténmentes','t-carb','zab','kamra',223,'60 g'],['Túró · félzsíros','t-meat','turo','kamra',325,'250 g'],['Áfonya · fagyasztott','t-fiber',null,'becslés',57,'100 g'],['Akácméz','t-sugar',null,'becslés',84,'25 g']],
    quality:[['Alapanyag-arány','t-processing','100 %'],['Növényféle','t-sprout','3 db']],
    note:'Lassú szénhidrát reggelre, a túró kazeinje délig kitart. Holnap mehet bele egy marék dió a zsírok miatt.',
    headline:'Fehérjében erős, tiszta tányér',lead:'A fehérje és a feldolgozottság viszi. Ezt nyugodtan ismételheted.',cert:98,dims:[8.6,7.6,8.3,8.4,9.1,8.2,8.7,8.5]},
  tizorai:{slot:'Ablakon kívül',w:-1,name:'Whey + banán + mandulavaj',time:'10:05',kcal:356,score:7.2,macro:[36,30,11],fib:3,glu:1,
    ings:[['Impact Whey · csoki','t-supps','whey','kamra',120,'30 g'],['Banán','t-carb',null,'becslés',105,'120 g'],['Mandulavaj · 100%','t-fat','mandula','kamra',131,'20 g']],
    quality:[['Alapanyag-arány','t-processing','67 %'],['Növényféle','t-sprout','2 db']],
    note:'Gyors fehérje edzés után. A banán szénhidrátja most jól jön.',
    headline:'Gyors, célzott, de feldolgozott',lead:'A whey viszi a pontot, a feldolgozottság húzza le.',cert:91,dims:[8.1,6.4,8.8,7.0,5.2,6.1,7.4,8.6]},
  ebed:{slot:'Ebéd',w:1,name:'Csirke + édesburgonya + spenót',time:'12:40',kcal:1015,score:8.1,macro:[63,120,25],fib:8,glu:1,
    ings:[['Csirkemell · friss','t-meat','csirke','kamra',330,'300 g'],['Édesburgonya','t-carb',null,'kamra',344,'400 g'],['Spenót · friss','t-fiber',null,'becslés',46,'200 g'],['Olívaolaj · extra szűz','t-avocado',null,'becslés',295,'33 ml']],
    quality:[['Alapanyag-arány','t-processing','100 %'],['Növényféle','t-sprout','3 db']],
    note:'Edzés utáni ablakba pont jó: sok fehérje, elég szénhidrát a visszatöltéshez.',
    headline:'Kiegyensúlyozott, edzés utánra ideális',lead:'Minden makró a helyén; a zsír is mértékkel.',cert:95,dims:[9.0,7.9,8.1,8.8,8.4,7.8,8.2,8.9]}
};
const DIMS=[['Makró-egyensúly','t-macro',22,'A fehérje–szénhidrát–zsír arány közel van a célarányodhoz.',[['Fehérje aránya','21% · cél 25%'],['Szénhidrát','60% · cél 50%'],['Zsír','19% · cél 25%']]],
  ['Mikrotápanyagok','t-micro',10,'Jó B-vitamin és kálium, kevés D-vitamin és vas.',[['Kálium','jó'],['B1-vitamin','kiváló'],['Vas','kevés']]],
  ['WHO-irányelvek','t-shield',14,'Hozzáadott cukor és só a határ alatt.',[['Hozzáadott cukor','4 g · határ 25 g'],['Só','0,3 g · határ 5 g']]],
  ['Zsírminőség','t-avocado',10,'Főleg telítetlen zsír; a túró adja a telítettet.',[['Telítetlen','72%'],['Telített','28%']]],
  ['Feldolgozottság','t-processing',18,'Minden hozzávaló alapanyag, semmi ultra-feldolgozott.',[['Alapanyag','4 / 4'],['Ultra-feldolgozott','0']]],
  ['Növényi változatosság','t-sprout',8,'3 különböző növény; a heti 30-as célhoz hozzátesz.',[['Ma eddig','9 növény'],['A héten','22 / 30']]],
  ['Energiasűrűség','t-bolt',6,'Laktató, mérsékelt kalóriasűrűség.',[['Energiasűrűség','1,3 kcal/g'],['Rost','7 g']]],
  ['Napi kontextus','t-clock',12,'Jó időben: a reggeli ablak közepén, edzés előtt 4 órával.',[['Ablak','07:00–10:00'],['Edzésig','4 óra']]]];
const CAT={reggeli:['Reggeli','t-sun'],ebed:['Ebéd','t-bowl'],uzsonna:['Snack','t-snack'],vacsora:['Vacsora','t-moon']};
const REC=[
  {id:'r1',n:'Túrós zabkása · áfonyával',cat:'reggeli',serv:1,kcal:689,p:49,c:74,f:22,min:8,role:'Edzés előtt',star:1,logged:12,last:'ma 07:20',score:8.4,nova:1,fits:'Pre Pull Day · T-10h',date:'ápr. 14.'},
  {id:'r2',n:'Csirke + édesburgonya + spenót',cat:'ebed',serv:2,kcal:2030,p:126,c:240,f:50,min:30,role:'',star:1,logged:18,last:'ma 12:40',score:8.1,nova:1,fits:'Edzés után · délben',date:'ápr. 20.'},
  {id:'r3',n:'Lazac + barna rizs + brokkoli',cat:'vacsora',serv:2,kcal:1636,p:98,c:148,f:74,min:23,role:'Edzés után',star:1,logged:24,last:'4 napja',score:7.9,nova:1,fits:'Edzés után · este',date:'máj. 2.'},
  {id:'r6',n:'Túró · áfonya · méz quick',cat:'uzsonna',serv:1,kcal:324,p:36,c:24,f:10,min:2,role:'',star:0,logged:14,last:'tegnap 16:10',score:null,nova:3,fits:'Kazein · esti',date:'máj. 11.'},
  {id:'r4',n:'Whey + banán + mandulavaj',cat:'uzsonna',serv:1,kcal:356,p:36,c:30,f:11,min:2,role:'',star:0,logged:22,last:'ma 10:05',score:7.2,nova:4,fits:'Edzés után · gyors',date:'máj. 15.'},
  {id:'r5',n:'Tojásrántotta · spenóttal',cat:'reggeli',serv:1,kcal:318,p:24,c:4,f:23,min:8,role:'',star:0,logged:8,last:'5 napja',score:7.6,nova:1,fits:'Alacsony szénhidrátú reggel',date:'jún. 3.'}];
const KIND={food:['t-carb','étel'],supp:['t-supps','kiegészítő'],stim:['t-bolt','stimuláns'],med:['t-syringe','gyógyszer']};
const SRC={foto:['t-camera','fotó'],link:['t-link','link'],kat:['t-stack','közös katalógus'],kezi:['t-journal','kézi']};
const KAM=[
  {id:'csirke',n:'Csirkemell · friss',b:'Bonafarm',k:'food',cat:'Fehérje',src:'link',sl:'kifli.hu',when:'máj. 20. · 09:14',kcal:110,p:23,c:0,f:1.5,sug:'0',salt:'0,1',sat:'0,4',nova:'Alapanyag',price:'3 290 Ft/kg',recs:['r2']},
  {id:'turo',n:'Túró · félzsíros',b:'Mizo',k:'food',cat:'Tejtermék',src:'foto',sl:'Fotó',when:'máj. 22. · 18:02',kcal:130,p:18,c:3.5,f:4.5,sug:'3,5',salt:'0,1',sat:'2,9',nova:'Alapanyag',price:'2 180 Ft/kg',recs:['r1','r6']},
  {id:'lazac',n:'Lazacfilé · norvég',b:'Kifli Premium',k:'food',cat:'Hal',src:'link',sl:'kifli.hu',when:'jún. 2. · 07:40',kcal:208,p:20.4,c:0,f:13.4,sug:'0',salt:'0,2',sat:'3,1',nova:'Alapanyag',price:'14 990 Ft/kg',recs:['r3']},
  {id:'zab',n:'Zabpehely · gluténmentes',b:'Naturmind',k:'food',cat:'Gabona',src:'kat',sl:'Közös katalógus · Anna',when:'ápr. 30. · 20:11',kcal:372,p:13,c:59,f:7,sug:'1,1',salt:'0',sat:'1,3',nova:'Alapanyag',price:'1 890 Ft/kg',recs:['r1']},
  {id:'mandula',n:'Mandulavaj · 100%',b:'Nutsi',k:'food',cat:'Mag / olajos',src:'kezi',sl:'Saját bevitel',when:'',kcal:614,p:21,c:7,f:53,sug:'4,4',salt:'0',sat:'4,2',nova:'Konyhai összetevő',price:'',recs:['r4']},
  {id:'whey',n:'Impact Whey · csoki',b:'MyProtein',k:'supp',cat:'Whey / protein',src:'link',sl:'myprotein.hu',when:'máj. 4. · 11:20',dose:'30 g',recs:['r4']},
  {id:'kreatin',n:'Kreatin-monohidrát',b:'MyProtein',k:'supp',cat:'Kiegészítő',src:'link',sl:'myprotein.hu',when:'máj. 4. · 11:22',dose:'5 g',recs:[]},
  {id:'aakg',n:'AAKG · L-arginin',b:'GymBeam',k:'stim',cat:'Stimuláns',src:'foto',sl:'Fotó',when:'jún. 10. · 17:45',dose:'6 g',recs:[]}];
const STACK=[
  {band:'Reggel',ic:'t-dawn',items:[['Kreatin-monohidrát','5 g','Ébredés',1,'07:02'],['Kávé · espresso','80–100 mg','Ébredés',1,'07:05'],['Tasty Dose gombakávé','8 g','Ébredés',1,'07:30'],['Impact Whey Protein','30–40 g','Reggeli',1,'08:10']]},
  {band:'Dél',ic:'t-bowl',items:[['D3 + K2','4000 IU + 100 µg','Ebéd',1,'12:45'],['Omega-3','2 g EPA+DHA','Ebéd',0]]},
  {band:'Délután',ic:'t-sun',items:[['Origin PWO','20 g','Edzés előtt',0]]},
  {band:'Este',ic:'t-moon',items:[['Magnézium-glicinát','300 mg','Este',0]]}];
const WEEK=[['H',2115,2400,'7,8',0],['K',2260,2400,'7,7',1],['Sze',1180,2400,'8,3',0],['Cs',null,2400,null,1],['P',2050,2400,'7,9',0],['Szo',2740,2200,'7,1',0],['V',null,2200,null,0]];
const WK=[['júl. 13.',2396,2440,285,2400,1],['júl. 20.',2402,2465,265,2430,0],null,['aug. 3.',2405,2470,245,2455,0],['aug. 10.',2398,2462,235,2455,1],['aug. 17.',2400,2485,220,2475,0],['aug. 24.',2403,2460,205,2455,0],['aug. 31.',2401,2452,190,2455,1],['szept. 7.',2399,2445,178,2440,0],['szept. 14.',2400,2450,165,2420,0],['szept. 21.',2400,2470,150,2470,0],['szept. 28.',2400,2480,150,2480,0]];
const LD=[['kedd, okt. 6.',1020,'hiányosnak tűnt',0,1],['hétfő, okt. 5.',null,'nincs felírva',0,0],['vasárnap, okt. 4.',3120,'számít',1,1],['szombat, okt. 3.',2760,'számít',1,1],['péntek, okt. 2.',1180,'hiányosnak tűnt',0,1],['csütörtök, okt. 1.',1610,'te jelölted teljesnek',1,1],['szerda, szept. 30.',2820,'számít',1,1],['kedd, szept. 29.',2980,'számít',1,1],['hétfő, szept. 28.',2150,'te jelölted hiányosnak',0,1],['vasárnap, szept. 27.',3050,'számít',1,1],['szombat, szept. 26.',null,'nincs felírva',0,0],['péntek, szept. 25.',1340,'hiányosnak tűnt',0,1],['csütörtök, szept. 24.',2890,'számít',1,1],['szerda, szept. 23.',2710,'számít',1,1]];
const HW=[['Mit néztem meg','47 teljes nap felírt evéssel · 52 mérlegelés · 8 hét előzmény. Csak azokat a napokat számoltam, amikor az evésed teljesnek tűnt. A mai napot soha nem nézem, mert még tart.'],
  ['A súlyod és az evésed együtt','Napi evés oszlopokban, súly pontokban, a trend vonalban, 8 hét. A hiányosnak tűnő napok sraffozva, a vízugrás külön sávban.'],
  ['A számítás, egyszerűen','Átlagosan ennyit ettél a 47 teljes napon: 2 930. Ebből ami súlyként megmaradt: −132 (+0,12 kg/hét valódi gyarapodás, víz nélkül). Amit mozgással égettél: −330. Ennyit égetsz mozgás nélkül: ≈ 2 470. A valódi számítás napról napra halad; ez a kerekített, egyszerű változata.'],
  ['Amit kiszűrtem','3 hiányosnak tűnő nap (jóval a szokásos evésed alatt): kihagytam őket. 1 általad hiányosnak jelölt nap. Víz, nem zsír: szept. 7. körül a súlyod ~1,2 kg-ot ugrott, ezt nem számoltam hízásnak. 9 nap felírás nélkül: ezekből nem tanultam, és nem is tippeltem helyettük.'],
  ['Mennyire vagyok biztos benne','±150 kcal. Már elég sok adatot láttam, de a keretet továbbra is csak lépésenként igazítom. Minél több teljes napot és mérlegelést látok, annál biztosabb leszek.'],
  ['Hogyan léptem','Képlet 2 400 → a korábbi igazításaiddal 2 420 → e heti lépés +60 → most 2 480. Hetente csak kis lépést teszek, és új irányba először csak félig; egy furcsa hét így nem rántja el a keretet.']];
const RIB=[['foto','Fotó','t-camera'],['kereses','Keresés','t-basket'],['gyors','Gyors','t-quick'],['diktalas','Diktálás','t-mic'],['recept','Recept','t-book'],['szokasos','Szokásosak','t-repeat']];
const MIC={reggeli:'t-sun',tizorai:'t-snack',ebed:'t-bowl'};
const KIC={'Fehérje':'t-meat','Tejtermék':'t-protein','Hal':'t-meat','Gabona':'t-carb','Mag / olajos':'t-avocado'};
const kic=k=>k.k==='food'?(KIC[k.cat]||'t-carb'):KIND[k.k][0];
const DAYN=['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'];

/* ── kis segédek (a kit fölé, csak Fuel) ───────────────────────── */
/* nh: hős nagy számmal — szám → ítélet-mondat → egy gomb */
const nh=(o,i)=>hero({...o,lbl:o.art?`<span class="fx-la">${o.lbl||''}</span>`:o.lbl,
  verdict:`<span class="fh-big fx-n${o.art?' art':''}">${o.n}${o.unit?`<small>${o.unit}</small>`:''}</span>${o.verdict}`},i);
const hi=id=>`<span class="fx-hi">${I(id)}</span>`;
const mrow=(l,v,pct,c,ic)=>`<div class="fh-mus">${ic?`<span class="fx-mi">${I(ic)}</span>`:''}<span class="l">${l}</span><span class="v">${v}</span>${bar(pct,c)}</div>`;
const macros3=(p,c,f,unit)=>{const tot=p*4+c*4+f*9||1;return [['Fehérje',p,'var(--protein)',p*4,'t-meat'],['Szénhidrát',c,'var(--carb)',c*4,'t-carb'],['Zsír',f,'var(--fat)',f*9,'t-avocado']].map(([l,g,col,k,ic])=>mrow(l,`<b>${fmt(g)}</b> g · ${Math.round(k/tot*100)}%`,Math.round(k/tot*100),col,ic)).join('')};
const lab=t=>`<span class="fh-lab">${t}</span>`;
const inp=(l,v,ph,type)=>`<input class="fh-in" ${type?`type="${type}"`:''} value="${esc(v||'')}" placeholder="${esc(ph||'')}" aria-label="${esc(l)}">`;
const fld=(l,v,ph,type)=>lab(l)+inp(l,v,ph,type);
const sel=(l,v)=>lab(l)+`<button class="fh-in fx-sel" data-toast="${esc(l)}"><span>${v}</span><i>▾</i></button>`;
const multi=(l,a)=>lab(l)+`<div class="fx-multi" style="grid-template-columns:repeat(${a.length>3?2:a.length},1fr)">${a.map(([v,ph])=>inp(ph||l,v,ph)).join('')}</div>`;
const stp=(v,u,t='Mennyiség')=>`<span class="fx-stp"><button data-toast="${esc(t)}: kevesebb" aria-label="Kevesebb">−</button><b>${v}</b><small>${u}</small><button data-toast="${esc(t)}: több" aria-label="Több">+</button></span>`;
/* pick: választó-pirulák, a koppintott lesz az aktív (helyben, újrarajzolás nélkül) */
const pick=(opts,on,pre='Szűrő')=>`<div class="fh-pills" data-fpick>${opts.map(o=>{const [l,n]=Array.isArray(o)?o:[o];return `<button class="fh-pill ${l===on?'on':''}" data-toast="${esc(pre+': '+l)}">${l}${n!=null?`<b>${n}</b>`:''}</button>`}).join('')}</div>`;
const sw=(on,label)=>`<button class="fx-sw ${on?'on':''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-fsw></button>`;
const tk=(on,label)=>`<button class="fx-tk ${on?'on':''}" data-ftk aria-label="${esc(label)}">${I('i-check')}</button>`;
/* irow: tétel-sor két sorban — fent név és érték, alatta a léptető (320 px-en is elfér) */
const irow=(o)=>`<div class="fh-row fx-it">${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}<div class="fx-l2">${o.l2||''}</div></div>`;
const srch=(t,val)=>`<div class="fx-srch" ${val?'':`data-toast="${esc(t)}"`}>${I('t-basket')}${val?`<span>${val}</span><i>×</i>`:t}</div>`;
const acts=h=>`<div class="fh-acts">${h}</div>`;
const closeLk=(l='Bezárom')=>`<button class="fh-lk" data-close>${l}</button>`;
const sh=(ic,t,sub)=>`<div class="fx-shh">${ic?I(ic):''}<div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div></div>`;
const dn=(eb,title,prev,next)=>`<div class="fx-dn rise"><button ${prev?F.act(prev).trim():'disabled'} aria-label="Előző">‹</button><span><small>${eb}</small><b>${title}</b></span><button ${next?F.act(next).trim():'disabled'} aria-label="Következő">›</button></div>`;
const cmp=(ph,o={})=>`<div class="fx-cmp">${o.kamra?`<button data-sheet="kamrapick" aria-label="Kamra">${I('t-stack')}</button>`:''}<textarea aria-label="${esc(ph)}" placeholder="${esc(ph)}"></textarea><button data-toast="Diktálás" aria-label="Diktálás">${I('t-mic')}</button>${o.send?`<button class="go" data-go="${o.send}" aria-label="Küldés">${I('t-send')}</button>`:''}</div>`;
const cyc=now=>`<div class="fx-cyc">${['C','C','S','S','S','V','V'].map((g,i)=>`<span class="${i===now?'now':''}">${g}<small>${i+1}</small></span>`).join('')}</div>`;
const smooth=pts=>pts.map((p,i)=>{if(!i)return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;const a=pts[i-2]||pts[i-1],b=pts[i-1],d=pts[i+1]||p;return `C${(b[0]+(p[0]-a[0])/6).toFixed(1)} ${(b[1]+(p[1]-a[1])/6).toFixed(1)} ${(p[0]-(d[0]-b[0])/6).toFixed(1)} ${(p[1]-(d[1]-b[1])/6).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`}).join('');

F.css(`
${P}{--fiber:#5FA05A;--water:#3F8FD6}
${P} .fm-g{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:10px 0 14px}
${P} .fm-n b{display:block;font-family:var(--disp);font-size:30px;font-weight:800;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums}
${P} .fm-n small{display:block;font-size:11px;font-weight:650;letter-spacing:.4px;text-transform:uppercase;color:var(--sub);margin-top:5px}
${P} .fm-n.r{text-align:right}
${P} .fm-gauge{position:relative;width:132px;height:132px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.75);box-shadow:0 14px 26px -14px color-mix(in srgb,var(--dom) 70%,transparent),inset 0 0 0 1px rgba(15,30,51,.05)}
${P} .fm-gauge .fm-mr{position:absolute;inset:0}
${P} .fm-gauge span svg.ic{width:68px;height:68px;filter:drop-shadow(0 10px 10px rgba(15,30,51,.28))}
${P} .fm-mac{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
${P} .fm-m{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-width:0}
${P} .fm-m>svg.ic{width:26px;height:26px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
${P} .fm-mw{position:relative;width:54px;height:54px;display:grid;place-items:center;margin-top:2px}
${P} .fm-mw .fm-mr{position:absolute;inset:0}
${P} .fm-mw b{font-family:var(--disp);font-size:14px;font-weight:800;letter-spacing:-.4px}
${P} .fm-m strong{font-size:11.5px;font-weight:650;margin-top:2px}
${P} .fm-m small{font-size:10.5px;color:var(--sub)}
${P} .fm-blk{padding:14px 16px}
${P} .fm-blk.open{background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1.5px rgba(15,30,51,.10);border-radius:24px}
${P} .fm-bh{display:flex;align-items:center;gap:10px}
${P} .fm-bh .si{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:var(--page);flex:0 0 auto}
${P} .fm-bh .si svg.ic{width:30px;height:30px;filter:drop-shadow(0 4px 5px rgba(15,30,51,.22))}
${P} .fm-bh .g{flex:1;min-width:0}
${P} .fm-bh strong{display:block;font-family:var(--disp);font-size:18px;font-weight:700;letter-spacing:-.4px}
${P} .fm-bh small{display:block;font-size:12px;color:var(--sub)}
${P} .fm-clock{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--page);flex:0 0 auto}
${P} .fm-clock svg.ic{width:22px;height:22px}
${P} .fm-kr{position:relative;width:48px;height:48px;display:grid;place-items:center;flex:0 0 auto}
${P} .fm-kr .fm-mr{position:absolute;inset:0}
${P} .fm-kr b{font-family:var(--disp);font-size:12.5px;font-weight:800;letter-spacing:-.3px}
${P} .fm-meal{margin-top:12px;padding-top:12px;border-top:1px solid var(--hair)}
${P} .fm-mn{display:block;width:100%;text-align:left}
${P} .fm-mn strong{display:block;font-size:15px;font-weight:650}
${P} .fm-mn small{display:block;font-size:12.5px;color:var(--sub);margin-top:1px}
${P} .fm-mb{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap}
${P} .fm-cells{display:flex;gap:8px}
${P} .fm-cell{display:flex;flex-direction:column;align-items:center;gap:2px}
${P} .fm-cell svg.ic{width:16px;height:16px}
${P} .fm-cell i{font-style:normal;font-size:10.5px;font-weight:600;color:var(--sub);font-variant-numeric:tabular-nums}
${P} .fm-chips{display:flex;gap:6px;align-items:center}
${P} .fm-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12.5px;font-weight:650;color:var(--ok);background:color-mix(in srgb,var(--ok) 10%,#fff)}
${P} .fm-chip svg:not(.ic){width:22px;height:11px}
${P} .fm-chip.mid{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,#fff)}
${P} .fm-chip.sc{color:var(--ink);background:var(--page);font-family:var(--disp);font-size:14px;font-weight:800}
${P} .fm-chip.sc svg.ic{width:20px;height:20px}
${P} .fm-when{font-size:13.5px;color:var(--sub);margin-top:10px}
${P} .fm-when b{color:var(--ink)}
@media(max-width:360px){${P} .fm-gauge{width:100px;height:100px}${P} .fm-gauge .fm-mr{width:100px!important;height:100px!important}${P} .fm-gauge span svg.ic{width:52px;height:52px}
  ${P} .fm-n b{font-size:23px;letter-spacing:-.8px}${P} .fm-n small{font-size:9.5px}${P} .fm-g{gap:4px}
  ${P} .fm-mw{width:44px;height:44px}${P} .fm-mw .fm-mr{width:44px!important;height:44px!important}${P} .fm-mw b{font-size:12px}${P} .fm-m strong{font-size:10px;letter-spacing:-.2px}${P} .fm-m small{font-size:9.5px}${P} .fm-mac{gap:0}}
`);
/* ═══ MAI ════════════════════════════════════════════════════ */
function mai(arg){
  if(arg==='tegnap'||arg==='ures') return pastDay(arg==='ures');
  if(arg==='het') return het();
  const rem=DAY.target-DAY.eaten, P100=pc(DAY.eaten,DAY.target);
  const state=s=>DAY.now>=s.from&&DAY.now<=s.to?'most nyitva':DAY.now<s.from?`nyílik ${s.from}-kor`:'még pótolható';
  const mr=(pct,c,sz=46,w=5)=>{const r=(sz-w)/2,C=2*Math.PI*r;return `<svg class="fm-mr" viewBox="0 0 ${sz} ${sz}" style="width:${sz}px;height:${sz}px"><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="rgba(15,30,51,.08)" stroke-width="${w}"/><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(C*Math.min(100,pct)/100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${sz/2} ${sz/2})"/></svg>`};
  const MAC=[['Fehérje','t-meat','var(--protein)',DAY.p,'g'],['Szénhidrát','t-carb','var(--carb)',DAY.c,'g'],['Zsír','t-avocado','var(--fat)',DAY.f,'g'],['Rost','t-fiber','var(--fiber)',DAY.fib,'g'],['Víz','t-water','var(--water)',DAY.water,'l']];
  const GL=['Alacsony','Közepes'];
  const mealRow=(id,m)=>`<div class="fm-meal"><button class="fm-mn" data-go="meal.${id}"><strong>${m.name}</strong><small>${m.time} · ${kc(m.kcal)} kcal</small></button>
      <div class="fm-mb"><span class="fm-cells">${[['t-meat','var(--protein)',m.macro[0],45],['t-carb','var(--carb)',m.macro[1],90],['t-avocado','var(--fat)',m.macro[2],25],['t-fiber','var(--fiber)',m.fib,10]].map(([ic,c,v,t])=>`<span class="fm-cell">${I(ic)}${mr(v/t*100,c,30,4)}<i>${v} g</i></span>`).join('')}</span>
        <span class="fm-chips"><button class="fm-chip ${m.glu?'mid':''}" data-sheet="glu" data-arg="${m.glu}"><svg viewBox="0 0 24 12" aria-hidden="true"><path d="${m.glu?'M1 10 C6 10 7 2 12 2 S18 10 23 10':'M1 9 C7 9 8 5 12 5 S17 9 23 9'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${GL[m.glu]}</button>
        <button class="fm-chip sc" data-go="score.${id}" aria-label="Értékelés">${I('t-score')}${fmt(m.score)}</button></span></div></div>`;
  const blocks=SLOTS.map((s,i)=>{const rows=Object.entries(MEALS).filter(([,m])=>m.w===i), k=rows.reduce((a,[,m])=>a+m.kcal,0);
    return `<section class="fh-card fm-blk ${rows.length?'':'open'} rise" style="--i:${i+2}"><div class="fm-bh"><span class="si">${I(s.ic)}</span><span class="g"><strong>${s.l}</strong><small>${s.from}–${s.to}</small></span>
        <button class="fm-clock" data-sheet="ora" aria-label="${s.l} · étkezési óra">${I('t-clock')}</button>
        <span class="fm-kr">${mr(rows.length?k/s.b*100:0,'var(--dom)',48,5)}<b>${kc(rows.length?k:s.b)}</b></span></div>
      ${rows.length?rows.map(([id,m])=>mealRow(id,m)).join(''):`<p class="fm-when">Ajánlott <b>${s.from}–${s.to}</b> · ${state(s)}</p>
        <div class="fh-acts">${btn('+ Logolás ide','log.w'+i,'sm')}${lk('Kihagyom',{toast:s.l+' kihagyva · megadhatod, miért'})}</div>`}</section>`}).join('');
  const out=Object.entries(MEALS).filter(([,m])=>m.w===-1);
  return page('fuel',{title:'Fuel',sub:'Szerda, október 7.',tab:'mai'},`
  <section class="fh-card fh-hero rise"><span class="lbl">Ma eddig</span>
    <div class="fm-g"><div class="fm-n"><b>${kc(DAY.eaten)}</b><small>kcal-t ettél</small></div>
      <button class="fm-gauge" data-sheet="eq" aria-label="${kc(DAY.eaten)} / ${kc(DAY.target)} kcal">${mr(P100,'var(--dom)',132,11)}<span>${I('t-bowl')}</span></button>
      <div class="fm-n r"><b>${kc(rem)}</b><small>még belefér</small></div></div>
    <p class="verdict">Egy rendes vacsora még belefér, ${DAY.p[1]-DAY.p[0]} g fehérje hiányzik.</p>
    <div class="fh-acts">${btn('Étkezés logolása','log')}${lk('Miből jön össze?',{sheet:'eq'})}</div></section>
  ${sec(1,'Mai makrók',1)}
  ${card(`<div class="fm-mac">${MAC.map(([l,ic,c,[v,t],u])=>`<button class="fm-m" ${l==='Víz'?'data-sheet="water"':`data-toast="${l}: ${fmt(v)} / ${fmt(t)} ${u}"`}>${I(ic)}<span class="fm-mw">${mr(v/t*100,c,54,5)}<b>${fmt(v)}</b></span><strong>${l}</strong><small>/ ${fmt(t)} ${u}</small></button>`).join('')}</div>`,{i:1})}
  ${sec(2,`A mai blokkjaid · ${Object.keys(MEALS).length} étkezés`,2)}
  ${blocks}
  ${out.length?card(`<div class="fm-bh"><span class="si">${I('t-snack')}</span><span class="g"><strong>Ablakon kívül</strong><small>két étkezés között</small></span></div>`+out.map(([id,m])=>mealRow(id,m)).join(''),{cls:'fm-blk',i:6}):''}
  ${sec(3,'Logolj bármit',7)}
  ${card(pills(RIB.map(([k,l,ic])=>[l,'log.'+k,false,ic]))+note('Ablakon kívül is logolhatsz. Az idő alapból a mostani, de átírhatod.')+acts(lk('Az étkezési óra',{sheet:'ora'})),{i:7})}
  ${sec(4,'A hét és a tanulás',8)}
  ${card(row({icon:'t-calendar',title:'A hét képe',sub:'a hét napjai a keretükhöz mérve',on:'mai.het'})
    +row({icon:'t-compare',title:'Heti egyeztetés',sub:'vasárnap · 3 lépés, kb. 2 perc',right:st('1 javaslat vár','warn')+chev(),on:{sheet:'weekly'}})
    +row({icon:'t-brain',title:'Ez a nap számít a tanulásban',sub:'jövő hétfőn számolom bele · Mit jelent ez?',on:'tanulas'})
    +row({icon:'t-history',title:'Tegnap · 2 ablak pótolható',sub:'kedd, október 6.',on:'mai.tegnap'})
    +row({icon:'t-gear',title:'Fuel beállítások',sub:'ritmus · makrók · célok · ablakok',on:'beallitas'})
    +acts(btn('Ma hiányos volt a naplóm',{toast:'Hiányosnak jelölve · kihagyom a tanulásból'},'sm ghost')),{i:8})}`);
}
function het(){
  return page('fuel',{title:'A hét képe',sub:'Fuel · ez a hét',back:'mai'},`
  ${hero({lbl:'Ez a hét',verdict:'A hét négy napján a keret körül maradtál.',sub:'Két nap még hátravan. A vonás a nap kerete, a szám a nap pontja.',body:weekSvg(),
    acts:btn('Trendek megnyitása','trendek')+lk('Vissza a mai napra','mai')})}
  ${sec(1,'A hét napjai',1)}
  ${card(WEEK.map(([d,k,t,s,tr],i)=>row({left:`<span class="fx-dd ${i===2?'on':''}">${d}</span>`,title:k==null?'Nincs naplózva':`${kc(k)} / ${kc(t)} kcal`,sub:k==null?'nem töltöm ki becsléssel':`a nap pontja ${s}${tr?' · edzésnap':''}`,right:(k==null?'':bar(pc(k,t)))+chev(),on:{sheet:'day',arg:i}})).join('')
    +note('Koppints egy napra: a nap számai és étkezései lapon nyílnak.'),{i:1})}`);
}
function pastDay(emp){
  const rows=emp?[]:[['Kávé és vajas kifli','09:20',330,'6,1'],['Gulyásleves','13:10',690,'7,4']];
  const free=SLOTS.map((s,i)=>[s,i]).filter(([,i])=>!rows[i]);
  return page('fuel',{title:emp?'Hétfő, október 5.':'Kedd, október 6.',sub:emp?'Fuel · 2 nappal ezelőtt':'Fuel · tegnap',back:'mai'},`
  ${dn(emp?'2 nappal ezelőtt':'Tegnap',emp?'hétfő, október 5.':'kedd, október 6.',emp?null:'mai.ures',emp?'mai.tegnap':'mai')}
  ${emp?hero({lbl:'Ezen a napon',verdict:'Erre a napra nincs adat.',sub:'Amit most logolsz, erre a napra könyvelődik. A heti átlagból kimarad, nem töltöm ki becsléssel.',left:hi('t-calendar'),acts:btn('Reggeli pótlása','log.w0')},1)
    :nh({lbl:'Ezen a napon',n:kc(1020),unit:'/ 3 100 kcal',art:'t-history',verdict:'Két étkezés van felírva, két ablak üres maradt.',sub:'Még pótolhatod: amit most logolsz, erre a napra könyvelődik.',body:bar(pc(1020,3100)),acts:btn('Uzsonna pótlása','log.w2')},1)}
  ${sec(1,'Még pótolható',2)}
  ${card(free.map(([s,i])=>step({time:s.from,icon:s.ic,title:`${s.l} · ${s.b} kcal`,sub:`${s.from}–${s.to} · még pótolható`,on:'log.w'+i})).join(''),{i:2})}
  ${emp?'':`${sec(2,'A nap számai',3)}
  ${card(grid([stat({k:'Fehérje',icon:'t-meat',n:70,unit:'/ 220 g',pct:32,c:'var(--protein)'}),stat({k:'Szénhidrát',icon:'t-carb',n:120,unit:'/ 380 g',pct:32,c:'var(--carb)'}),stat({k:'Zsír',icon:'t-avocado',n:40,unit:'/ 95 g',pct:42,c:'var(--fat)'}),stat({k:'Kalória',icon:'t-flame',n:kc(1020),unit:'/ 3 100',pct:33})]),{i:3})}
  ${sec(3,'Ezen a napon · 2 étkezés',4)}
  ${card(rows.map((r,i)=>step({time:r[1],icon:SLOTS[i].ic,title:r[0],sub:`${SLOTS[i].l} · ${r[2]} kcal · ${r[3]} pont`,on:{toast:r[0]+' · az étkezés részletei'}})).join(''),{i:4})}
  ${sec(4,'Ez a nap a tanulásban',5)}
  ${card(txt('Ez a nap hiányosnak tűnt, kihagytam. Ha mégis teljes volt, mondd, és azonnal újraszámolok.')
    +acts(btn('Teljes volt',{toast:'Teljesnek jelölve · a keret +20 kcal-lal változott'},'sm ghost')+lk('Mit jelent ez?','tanulas')),{i:5})}`}`);
}

/* ═══ ÉTKEZÉS · ÉRTÉKELÉS ═════════════════════════════════════ */
function meal(id){
  const m=MEALS[id]||MEALS.reggeli; id=MEALS[id]?id:'reggeli'; const [p,c,f]=m.macro;
  return page('fuel',{title:m.w===-1?'Tízórai':m.slot,sub:`Fuel · ${m.time}${m.w===-1?' · ablakon kívül':''}`,back:'mai'},`
  ${nh({lbl:m.name,n:kc(m.kcal),unit:`kcal · a napod ${pc(m.kcal,DAY.target)}%-a`,art:MIC[id],verdict:m.headline+'.',sub:m.lead,
    acts:btn(`Mezo-értékelés ${fmt(m.score)}`,'score.'+id)+lk(`Vércukor · ${m.glu?'közepes':'alacsony'}`,{sheet:'glu',arg:m.glu})},1)}
  ${sec(1,'Hatás a napra',2)}
  ${card(mrow('Kalória',`<b>${kc(m.kcal)}</b> / ${kc(DAY.target)}`,pc(m.kcal,DAY.target),'var(--dom)','t-flame')
    +mrow('Fehérje',`<b>${p}</b> / ${DAY.p[1]} g`,pc(p,DAY.p[1]),'var(--protein)','t-meat')
    +mrow('Szénhidrát',`<b>${c}</b> / ${DAY.c[1]} g`,pc(c,DAY.c[1]),'var(--carb)','t-carb')
    +mrow('Zsír',`<b>${f}</b> / ${DAY.f[1]} g`,pc(f,DAY.f[1]),'var(--fat)','t-avocado')
    +mrow('Rost',`<b>${m.fib}</b> / ${DAY.fib[1]} g`,pc(m.fib,DAY.fib[1]),'var(--dom)','t-fiber')
    +note('Ennyit tett hozzá a napi keretedhez. A sáv a napból ennek az étkezésnek a részét mutatja.'),{i:2})}
  ${sec(2,`Hozzávalók · ${m.ings.length} tétel`,3)}
  ${card(m.ings.map(([n,ic,kid,src,k,amt])=>row({icon:ic,title:n,sub:`${amt} · ${src}`,v:`${k}<small>kcal</small>`,on:kid?'kamra.'+kid:{toast:n+' · becsült sor, nincs kamra-tétel'}})).join(''),{i:3})}
  ${sec(3,'Minőség',4)}
  ${card(m.quality.map(([l,ic,v])=>row({icon:ic,title:l,v})).join(''),{i:4})}
  ${sec(4,'Jegyzet',5)}
  ${card(msg('falat',m.note,'étel · jegyzet')+acts(btn('Javítom ezt az étkezést',{toast:'Szerkesztés · a naplózó nyílik ezzel az étkezéssel'},'sm ghost')+lk('Mentsük receptként','muhely.vazlat')),{i:5})}`);
}
function score(id){
  const m=MEALS[id]||MEALS.reggeli; id=MEALS[id]?id:'reggeli'; const low=m.dims.indexOf(Math.min(...m.dims));
  return page('fuel',{title:'Mezo-értékelés',sub:`${m.name}`,back:'meal.'+id},`
  ${hero({lbl:`${m.w===-1?'Tízórai':m.slot} · ${m.time} · bizonyosság ${m.cert}%`,verdict:m.headline+'.',sub:m.lead,left:ring(Math.round(m.score*10),{s:88,val:fmt(m.score),label:'/ 10'}),
    acts:btn('Mi emelné még?',{toast:'Lent, a 2. szakaszban: egy marék tökmag'},'sm')+lk('Vissza az étkezéshez','meal.'+id)},1)}
  ${sec(1,'Miből áll össze? · 8 szempont',2)}
  ${card(DIMS.map(([l,ic,w],i)=>row({icon:ic,title:l,sub:`súly ${w}%${i===low?' · a leggyengébb láncszem':''}`,v:fmt(m.dims[i]),right:bar(m.dims[i]*10,i===low?'var(--warn)':'var(--dom)')+chev(),on:{sheet:'dim',arg:id+'|'+i}})).join(''),{i:2})}
  ${sec(2,'Mi emelné még?',3)}
  ${card(msg('falat','A mikrotápanyag a leggyengébb láncszem: egy marék tökmag vasat és magnéziumot hozna, és 8,6 fölé tolná az értékelést.','étel · javaslat'),{i:3})}`);
}

/* ═══ LOGOLÁS ═══════════════════════════════════════════════════ */
function log(arg){
  arg=arg||'foto'; const fail=arg==='hiba';
  const win=/^w[0-3]$/.test(arg)?SLOTS[+arg[1]]:null; const mode=win||fail?'foto':arg;
  const lines=arg==='tetelek'||arg==='ido';
  const ctx=win?`${win.l} · ${win.from}–${win.to} · ablak`:'Most · 14:10 · Ebéd-ablak után';
  const top={title:win?'Logolás ide':'Étkezés logolása',sub:ctx,back:'mai'};
  if(lines) return page('fuel',top,`
  ${nh({lbl:'Ez az étkezés',n:'420',unit:'kcal · 23 feh. · 52 szénh. · 12 zsír',verdict:'Zabkása joghurttal és gyümölccsel',
    sub:`${kc(DAY.eaten)} + 420 = ${kc(DAY.eaten+420)} kcal · marad ${kc(DAY.target-DAY.eaten-420)}.`,body:bar(pc(DAY.eaten+420,DAY.target))},1)}
  ${sec(1,'Tételek · 3',2)}
  ${card([['Zabpehely','t-carb','kamra',60,'g',223,'8 · 36 · 4'],['Görög joghurt','t-meat','kamra',150,'g',146,'14 · 6 · 8'],['Erdei gyümölcs','t-fiber','becslés',80,'g',51,'1 · 10 · 0']].map(([n,ic,t,a,u,k,m])=>irow({icon:ic,title:n,sub:`${t} · ${m} g`,v:`${k}<small>kcal</small>`,l2:(t==='becslés'?st('nézd át','warn'):'<span></span>')+stp(a,u,n)})).join('')
    +acts(lk('+ Még egy tétel','log.kereses')),{i:2})}
  ${sec(2,'Mikor ettél?',3)}
  ${card(row({icon:'t-clock',title:'Most · 14:10',sub:`Ebéd-ablak után · ${arg==='ido'?'tényleges':'aktuális'} idő`,right:st(arg==='ido'?'Bezárom':'Átállítom','q')+chev(),on:'log.'+(arg==='ido'?'tetelek':'ido')})
    +(arg==='ido'?`${lab('Időpont')}<div class="fx-time"><input class="fh-in" type="time" value="14:10" aria-label="Evés időpontja">${btn('Most','log.tetelek','sm ghost')}</div>${note('Az étkezés a megadott idő szerinti ablakba kerül. A mai napra jövőbeli időpontot nem lehet menteni.')}`:''),{i:3})}`,
  {foot:btn('Mégse','mai','ghost')+btn('Logolás',{toast:'Mentve · 14:10 · ablakon kívül'})});
  let body='';
  if(mode==='szokasos') body=lab('Ilyenkor szoktál · 14:10 körül')
    +[['Whey + banán + mandulavaj','edzés után · 22× logoltad',356],['Túró · áfonya · méz quick','délután · 14× logoltad',324],['Görög joghurt · dióval','délután · 6× logoltad',290]].map(([n,s,k])=>row({icon:'t-plate',title:n,sub:s,v:`${k}<small>kcal</small>`,on:'log.tetelek'})).join('')
    +note('Az idő szerint ajánlom, nem a hét napja szerint. Egy koppintás, aztán jóváhagyod.');
  else if(mode==='kereses') body=srch('Keresés','zab')
    +lab('A kamrádból')
    +row({icon:'t-carb',title:'Zabpehely · gluténmentes',sub:'Naturmind · 372 kcal / 100 g · 60 g a tányéron',right:`<button class="fx-add on" data-toast="A tányérra tettem: Zabpehely 60 g" aria-label="A tányéron">${I('i-check')}</button>`})
    +row({icon:'t-meat',title:'Túró · félzsíros',sub:'Mizo · 130 kcal / 100 g',right:`<button class="fx-add" data-toast="A tányérra tettem: Túró 150 g" aria-label="Tányérra">+</button>`})
    +lab('Receptek · szokásosak')
    +row({icon:'t-book',title:'Túrós zabkása · áfonyával',sub:'recept · 689 kcal / adag',right:`<button class="fx-add" data-toast="A tányérra tettem a receptet" aria-label="Tányérra">+</button>`})
    +row({icon:'t-repeat',title:'Zabkása gyümölccsel',sub:'szokásos · 9× logoltad',right:`<button class="fx-add" data-toast="A tányérra tettem: Zabkása gyümölccsel" aria-label="Tányérra">+</button>`});
  else if(mode==='gyors') body=lab('Gyors hozzáadás · csak a számok')+inp('Név','','pl. büfés szendvics')+fld('Kalória','420','kcal')
    +multi('Makrók',[['23 g feh.','fehérje'],['52 g szénh.','szénhidrát'],['12 g zsír','zsír']])
    +note('Ha csak a kalóriát tudod, az is elég: a makrók üresen maradnak, nem találgatom.');
  else if(mode==='diktalas') body=`<div class="fx-listen">${I('t-mic')}<div><strong>Hallgatlak…</strong><p>„Egy csirkés wrap és egy latte volt.”</p></div></div>`
    +acts(btn('Elemzés','log.tetelek','sm')+lk('Mégse','log'));
  else if(mode==='recept') body=lab('Receptjeid')
    +REC.slice(0,4).map(r=>row({icon:CAT[r.cat][1],title:r.n,sub:`${CAT[r.cat][0]} · ${Math.round(r.kcal/r.serv)} kcal / adag${r.star?' · csillagos':''}`,on:'log.tetelek'})).join('')
    +acts(lk('Választó lapon',{sheet:'receptpick'}));
  else body=`<button class="fx-ph" data-toast="Kamera · fotózd le a tányért">${I('t-camera')}<strong>Fotózd le a tányért</strong><small>vagy írd le fent, mit ettél</small></button>`;
  const plate=mode==='kereses'?`<span class="fx-pl">${I('t-plate')}<span><strong>Tányér · 2 tétel · 369 kcal</strong><small>23 g fehérje · 42 g szénhidrát · 12 g zsír</small></span></span>${btn('Tovább','log.tetelek','sm')}`:'';
  return page('fuel',top,`
  ${fail?hero({warn:true,lbl:'Őszintén szólva',verdict:'Ezt a tányért nem ismertem fel.',sub:'Írd le lent, mit ettél, vagy próbáld meg új fotóval.',acts:btn('Új fotót készítek','log','sm')},1):''}
  ${hero({lbl:win?'Logolás ebbe az ablakba':'Egy piszkozat',verdict:win?`Mit ettél: ${win.l.toLowerCase()}?`:'Mit ettél?',sub:'Szöveg, hang és fotó egy piszkozatba kerül.',
    body:cmp('pl. csirkés wrap és egy latte…'),acts:btn('Elemzés','log.tetelek')},1)}
  ${sec(1,'Hat mód, egy koppintásra',2)}
  ${card(pills(RIB.map(([k,l,ic])=>[l,'log.'+k,k===mode,ic]))+`<div class="fx-mode">${body}</div>`,{i:2})}
  ${sec(2,'Mikor ettél?',3)}
  ${card(row({icon:'t-clock',title:win?`${win.l} · ${win.from}–${win.to}`:'Most · 14:10',sub:'Alapból a mostani időt írom. Mentés előtt átállíthatod; a tétel abba az ablakba kerül, amelyikbe az idő esik.'}),{i:3})}`,
  plate?{foot:plate}:{});
}

/* ═══ KONYHA ═══════════════════════════════════════════════════ */
function konyha(){
  const food=KAM.filter(k=>k.k==='food').length; const fav=REC.slice().sort((a,b)=>b.logged-a.logged)[0];
  return page('fuel',{title:'Konyha',sub:`Fuel · ${REC.length} recept · ${KAM.length} tétel`,tab:'konyha'},`
  ${hero({lbl:'Receptműhely',verdict:'Főzzünk ki valamit.',sub:'Te mondod a célt, én a hozzávalót. A számokat a kamrád adja.',left:hi('t-chef'),
    body:`<div class="fx-goals">${pills([['Magas fehérje','muhely.vazlat',false,'t-meat'],['Edzés előtt','muhely.vazlat',false,'t-bolt'],['Edzés után','muhely.vazlat',false,'t-dumbbell'],['Lefekvés előtt','muhely.vazlat',false,'t-moon']])}</div>`,
    acts:btn('Műhely megnyitása','muhely')},1)}
  ${sec(1,'Gyors felvétel',2)}
  ${card(`<div class="fh-pair"><button data-go="recept-uj">${I('t-book')}Recept mentése</button><button data-sheet="import">${I('t-camera')}Új elem a kamrába</button></div>`,{i:2})}
  ${sec(2,'A konyhád',3)}
  ${card(row({icon:'t-book',title:'Receptek',sub:`${REC.length} recept · kedvenced: ${fav.n} (${fav.logged}×)`,on:'receptek'})
    +row({icon:'t-stack',title:'Kamra',sub:`${KAM.length} tétel · ${food} étel · ${KAM.length-food} kiegészítő`,on:'kamra'}),{i:3})}`);
}
function kamra(arg){
  if(arg&&arg!=='ures') return kamraItem(arg);
  const emp=arg==='ures'; const n=k=>KAM.filter(x=>x.k===k).length;
  const tools=btn('+ Új tétel',{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk('Közös katalógus',{sheet:'catalog'});
  if(emp) return page('fuel',{title:'Kamra',sub:'Konyha · üres polc',back:'konyha'},`
  ${hero({lbl:'A polcod',verdict:'A kamra üres.',sub:'Vedd fel az első tételt, vagy válassz a közös katalógusból; itt jelenik meg a polcodon.',left:hi('t-stack'),
    acts:btn('Első tétel felvétele',{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk('Közös katalógus',{sheet:'catalog'})},1)}
  ${sec(1,'A polcon',2)}
  ${card(empty('t-basket','Még nincs tétel. Fotó a címkéről, egy termék linkje vagy kézi felvétel: mind ide kerül.'),{i:2})}`);
  return page('fuel',{title:'Kamra',sub:`Konyha · ${KAM.length} tétel`,back:'konyha'},`
  ${hero({lbl:'A polcod',verdict:`${KAM.length} tétel van a polcodon: ${n('food')} étel és ${KAM.length-n('food')} kiegészítő.`,left:hi('t-stack'),acts:tools},1)}
  ${sec(1,'Keresés és szűrés',2)}
  ${card(srch('Keress tételt, márkát…')+`<div style="margin-top:10px">${pick([['Mind',KAM.length],['Étel',n('food')],['Supp',n('supp')],['Stim',n('stim')],['Gyógyszer',0]],'Mind')}</div>`+acts(lk('Szűrők · kategória szerint',{sheet:'catfilter'})),{i:2})}
  ${sec(2,'A polcon',3)}
  ${card(KAM.map(k=>{const kind=KIND[k.k][1],ic=kic(k);return row({icon:ic,title:k.n,sub:`${k.b} · ${kind} · ${SRC[k.src][1]}${k.k==='food'?` · ${fmt(k.p)} g feh. / 100 g`:''}`,v:k.k==='food'?`${k.kcal}<small>kcal</small>`:k.dose,on:'kamra.'+k.id})}).join(''),{i:3})}
  ${sec(3,'Okosabb csere',4)}
  ${card(row({icon:'t-swap',title:'Görög joghurt 10% · 500 g',sub:'1 790 Ft · esti kazein, +2 recepthez illik',on:{toast:'Csere-javaslat · a termék oldala'}}),{i:4})}`);
}
function kamraItem(id){
  const k=KAM.find(x=>x.id===id)||KAM[0]; const kind=KIND[k.k][1],ic=kic(k); const food=k.k==='food';
  const how=`Így került a polcra: ${SRC[k.src][1]} · ${k.sl}${k.when?' · '+k.when:' · az időpont nincs rögzítve'}${k.price?' · '+k.price:''}`;
  const edit=lk('Szerkesztés',{sheet:'add',arg:'edit'})+lk('Törlés',{toast:'Biztos? Még egy érintés a törléshez'});
  const recs=k.recs.length?card(k.recs.map(r=>{const R=REC.find(x=>x.id===r);return row({icon:'t-plate',title:R.n,sub:`${CAT[R.cat][0]} · ${R.logged}× etted`,on:'recept.'+r})}).join(''),{i:4}):'';
  return page('fuel',{title:k.n,sub:`Kamra · ${k.cat} · ${kind}`,back:'kamra'},`
  ${nh({lbl:k.b,n:food?k.kcal:k.dose,unit:food?'kcal / 100 g':'egy adag',art:ic,verdict:food?`${fmt(k.p)} g fehérje van 100 grammjában.`:k.id==='kreatin'?'Ébredés után szeded, a stackben van.':'Nincs időzítve; a Kiegészítők oldalon pipálod.',sub:how,
    acts:(food?btn('Logolás a mai napra','log.kereses'):btn('Kiegészítők megnyitása','stack'))+edit},1)}
  ${food?`${sec(1,'Makrók · 100 g',2)}${card(macros3(k.p,k.c,k.f),{i:2})}
  ${sec(2,'Minőség · 100 g',3)}
  ${card(row({icon:'t-sugar',title:'Cukor',v:`${k.sug}<small>g</small>`})+row({icon:'t-salt',title:'Só',v:`${k.salt}<small>g</small>`})+row({icon:'t-fat',title:'Telített zsír',v:`${k.sat}<small>g</small>`})+row({icon:'t-processing',title:'Feldolgozottság',right:st(k.nova,'ok')}),{i:3})}`
  :`${sec(1,'A napodban',2)}
  ${card(row({icon:'t-clock',title:k.id==='kreatin'?'5 g · ébredés után':'Nincs időzítve',sub:k.id==='kreatin'?'a stackben · Ébredés 07:00':'A Kiegészítők oldalon pipálod; ott látod a protokollt is',on:'stack'}),{i:2})}`}
  ${recs?sec(food?3:2,'Receptekben',4)+recs:''}`);
}
function receptek(){
  const fav=REC.slice().sort((a,b)=>b.logged-a.logged)[0];
  return page('fuel',{title:'Receptek',sub:`Konyha · ${REC.length} recept`,back:'konyha'},`
  ${hero({lbl:'Receptkönyv',verdict:`${REC.length} recepted van, a kedvencedet ${fav.logged} alkalommal etted.`,sub:`${fav.n} · legutóbb ${fav.last}.`,left:hi('t-book'),acts:btn('+ Új recept','recept-uj')+lk('Kifőzöm a Műhelyben','muhely')},1)}
  ${sec(1,'Szűrés',2)}
  ${card(pick([['Mind',REC.length],['Reggeli',2],['Ebéd',1],['Vacsi',1],['Snack',2],['Csillagos',3]],'Mind'),{i:2})}
  ${sec(2,'Receptjeid',3)}
  ${card(REC.map(r=>row({icon:CAT[r.cat][1],title:r.n+(r.star?' <span class="fx-star">'+I('t-star')+'</span>':''),sub:`${CAT[r.cat][0]} · ${r.min} perc${r.role?' · '+r.role:''}${r.serv>1?' · '+r.serv+' adag':''} · ${r.score?fmt(r.score)+' pont':'értékelés folyamatban'}`,v:`${Math.round(r.kcal/r.serv)}<small>kcal</small>`,on:'recept.'+r.id})).join('')
    +note('A szám egy adag kalóriája.'),{i:3})}`);
}
function recept(arg){
  const [id,mode]=(arg||'r1').split('.'); const r=REC.find(x=>x.id===id)||REC[0]; const all=mode==='egesz'; const d=all?1:r.serv; const v=k=>Math.round(r[k]/d);
  const ings=r.id==='r1'?MEALS.reggeli.ings:r.id==='r4'?MEALS.tizorai.ings:MEALS.ebed.ings;
  return page('fuel',{title:r.n,sub:`${CAT[r.cat][0]}-recept · ${r.min} perc${r.role?' · '+r.role:''}`,back:'receptek'},`
  ${nh({lbl:all?`Egész recept · ${r.serv} adag`:'Egy adag',n:kc(v('kcal')),unit:all?'kcal · egész recept':'kcal / adag',art:CAT[r.cat][1],verdict:`${r.logged}× etted, legutóbb ${r.last}.`,
    sub:r.score?`Pontszám ${fmt(r.score)} · ${r.fits}`:`Értékelés folyamatban · ${r.fits}`,
    body:r.serv>1?`<div style="margin-top:12px">${seg([['1 adag','recept.'+r.id,!all],[`Egész · ${r.serv} adag`,'recept.'+r.id+'.egesz',all]])}</div>`:'',
    acts:btn('Ma ettem ilyet','log.tetelek')+(r.score?lk(`Pontszám ${fmt(r.score)} ›`,{toast:'A recept értékelése · 9 szempont · megbízhatóság 92%'}):'')},1)}
  ${sec(1,'Makrók',2)}
  ${card(macros3(v('p'),v('c'),v('f')),{i:2})}
  ${sec(2,`Hozzávalók · ${ings.length} tétel`,3)}
  ${card(ings.map(([n,ic,kid,src,k,amt])=>row({icon:ic,title:n,sub:`${amt} · ${src}`,v:`${Math.round(k/d)}<small>kcal</small>`,on:kid?'kamra.'+kid:{toast:n+' · becsült sor'}})).join(''),{i:3})}
  ${sec(3,'Minőség · mikrotápanyagok',4)}
  ${card(row({icon:'t-processing',title:'Alapanyag-arány',v:'100<small>%</small>'})+row({icon:'t-sprout',title:'Növényféle',v:'3<small>db</small>'})+row({icon:'t-fiber',title:'Rost · cukor · só',sub:'7 g · 19 g · 0,6 g · telített zsír: nincs adat'})
    +note(`NOVA ${r.nova} · létrehozva ${r.date}`),{i:4})}
  ${sec(4,'Jegyzet',5)}
  ${card(msg('falat','Lassú szénhidrát és sok fehérje; edzés előtt 2–3 órával ideális, a túró kazeinje sokáig kitart.','étel · jegyzet')+note(r.fits),{i:5})}
  ${sec(5,'Tovább',6)}
  ${card(row({icon:'t-plate',title:'Logolás · ma ettem ilyet',sub:'a mostani időre, 1 adag',on:'log.tetelek'})
    +row({icon:'t-chef',title:'Iterálás a Műhelyben',sub:'a recept mint kiindulás',on:'muhely.vazlat'})
    +row({icon:'t-journal',title:`Logok · ${r.logged}`,sub:r.last.startsWith('ma')?'ma is a naplódban':'ma még nincs logolva',on:{sheet:'reclogs',arg:r.id}})
    +acts(btn('Szerkesztés','recept-uj','sm ghost')+lk(r.star?'Csillag le':'Csillag',{toast:'Csillag átállítva'})+lk('Törlés',{toast:'Biztos? Még egy érintés a törléshez'})),{i:6})}`);
}
function editor(arg){
  const all=arg==='x';
  return page('fuel',{title:'Új recept',sub:'Konyha · receptkönyv',back:'receptek'},`
  ${nh({lbl:'Makró-összeg',n:all?'1 058':'529',unit:all?'kcal · egész recept':'kcal / adag',verdict:all?'106 g fehérje, 108 g szénhidrát, 22 g zsír.':'53 g fehérje, 54 g szénhidrát, 11 g zsír.',sub:all?'Egy adag = 529 kcal.':'Egész recept = 1 058 kcal · P 106 · C 108 · F 22.',
    body:`<div style="margin-top:12px">${seg([['1 adag','recept-uj',!all],['Egész recept','recept-uj.x',all]])}</div>`},1)}
  ${sec(1,'Alapok',2)}
  ${card(fld('Név','','pl. Tonhalsaláta · edzés után')
    +lab('Blokk')+pick(['Reggeli','Ebéd','Vacsora','Snack','Csillag'],'Ebéd','Blokk')
    +lab('Szerep')+pick(['Általános','Edzés előtt','Edzés után'],'Általános','Szerep')
    +note('A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors szénhidrát üzemanyag, nem hiba.')
    +`<div class="fx-two"><div>${lab('Adag')}${stp(2,'adag','Adag')}</div><div>${lab('Elő + főzés')}${stp(25,'perc','Idő')}</div></div>`,{i:2})}
  ${sec(2,'Hozzávalók · 2',3)}
  ${card([['Csirkemell · friss','t-meat','Bonafarm',300],['Édesburgonya','t-carb','Tesco',400]].map(([n,ic,b,g])=>irow({icon:ic,title:n,sub:b,l2:`<button class="fh-lk" data-toast="Törölve a receptből">Törlés</button>`+stp(g,'g',n)})).join('')
    +acts(btn('+ Kamrából hozzáad',{sheet:'kamrapick'},'sm ghost')),{i:3})}
  ${sec(3,'Címkék',4)}
  ${card(`<div class="fh-pills"><button class="fh-pill" data-toast="Címke törölve">pre-workout ×</button><button class="fh-pill" data-toast="Címke törölve">whole-foods ×</button><button class="fh-pill" data-toast="Új címke">+ címke</button></div>`,{i:4})}`,
  {foot:btn('Mégse','receptek','ghost')+btn('Mentés',{toast:'Recept mentve'})});
}
function muhely(arg){
  const goals=pills([['Magas fehérje','muhely.vazlat',!!arg,'t-meat'],['Edzés előtt','muhely.vazlat',false,'t-bolt'],['Edzés után','muhely.vazlat',false,'t-dumbbell'],['Lefekvés előtt','muhely.vazlat',false,'t-moon'],['Reggeli','muhely.vazlat',false,'t-sun']]);
  if(!arg) return page('fuel',{title:'Receptműhely',sub:'Konyha · közös főzés',back:'konyha'},`
  ${hero({lbl:'Receptműhely',verdict:'Mit főzzünk ki?',sub:'Válassz egy célt, vagy írd le a saját szavaiddal. Én hozzávalót és mennyiséget javaslok; a számokat mindig a kamrád adja.',
    body:`<div class="fx-goals">${goals}</div>${cmp('Mit főzzünk? Mondd el szabadon…',{kamra:true})}`,acts:btn('Küldés','muhely.vazlat')},1)}
  ${sec(1,'Így dolgozunk',2)}
  ${card(msg('falat','Minden kör javításként érkezik, a kézi szerkesztéseid megmaradnak.','étel · műhely'),{i:2})}`);
  const all=arg==='vazlat-egesz';
  return page('fuel',{title:'Csirkés bulgur',sub:'Receptműhely · vázlat · Magas fehérje',back:'konyha'},`
  ${nh({lbl:'Vázlat · magas fehérje',n:all?'1 224':'612',unit:all?'kcal · egész · 2 adag':'kcal / adag · 2 adag',art:'t-chef',verdict:'Egy sorhoz még nincs tápérték, addig nem menthető.',sub:'Cseréld kamra-tételre vagy töröld a sort; a számokból kimarad, nem találgatjuk.',
    body:`<div class="fx-two" style="margin-top:12px"><div>${stp(2,'adag','Adag')}</div><div>${seg([['1 adag','muhely.vazlat',!all],['Egész','muhely.vazlat-egesz',all]])}</div></div>`,
    acts:`<button class="btn" disabled>Mentés a receptkönyvbe</button>`},1)}
  ${sec(1,'Hozzávalók · 3 tétel',2)}
  ${card([['Csirkemell · friss','t-meat','kamra','330',300,'g'],['Bulgur','t-carb','kamra','342',100,'g'],['Paprika · kaliforniai','t-fiber','becslés','—',150,'g']].map(([n,ic,t,k,a,u])=>irow({icon:ic,title:n,sub:t,v:k==='—'?'—':`${k}<small>kcal</small>`,l2:(t==='becslés'?`<button class="fh-lk" data-sheet="kamrapick">Csere kamra-tételre</button>`:'<span></span>')+stp(a,u,n)})).join('')
    +`<p class="fh-note fx-warn">1 sorhoz nincs tápérték a kamrában: a számokból kimarad, nem találgatjuk.</p>`,{i:2})}
  ${sec(2,'Elkészítés',3)}
  ${card(row({icon:'t-journal',title:'Elkészítés',sub:'4 lépés',on:{toast:'Elkészítés: 4 lépés'}}),{i:3})}
  ${sec(3,'Kérj módosítást',4)}
  ${card(`<div class="fx-goals" style="margin-top:0">${goals}</div>${cmp('Mit változtassak? Mondd el szabadon…',{kamra:true,send:'muhely.vazlat'})}`+note('Minden kör javításként érkezik, a kézi szerkesztéseid megmaradnak.'),{i:4})}`);
}

/* ═══ KIEGÉSZÍTŐK ═══════════════════════════════════════════════ */
function stack(){
  const all=STACK.flatMap(b=>b.items), taken=all.filter(x=>x[3]).length, nx=all.find(x=>!x[3]);
  return page('fuel',{title:'Kiegészítők',sub:`Fuel · ma · ${taken} / ${all.length} bevéve`,tab:'stack'},`
  ${hero({lbl:'Következik',verdict:nx[0],sub:`${nx[1]} · ${nx[2]} · zsíros étkezéssel szívódik fel a legjobban.`,left:ring(pc(taken,all.length),{s:84,val:`${taken}/${all.length}`,label:'bevéve'}),
    acts:btn('Bevettem',{toast:`Bevéve · ${nx[0]} · 14:10`})+lk('Miért így?',{sheet:'item',arg:nx[0]})},1)}
  ${STACK.map((b,i)=>{const d=b.items.filter(x=>x[3]).length;return sec(i+1,`${b.band} · ${d} / ${b.items.length}`,i+2)+card(b.items.map(x=>`<div class="fh-row">${tk(!!x[3],x[3]?'visszavonom':'bevettem')}<button class="g fx-g" data-sheet="item" data-arg="${esc(x[0])}"><span><strong>${x[0]}</strong><small>${x[1]} · ${x[2]}${x[3]?' · bevéve '+x[4]:''}</small></span>${chev()}</button></div>`).join(''),{i:i+2})}).join('')}
  ${sec(5,'Protokoll és beállítás',6)}
  ${card(row({icon:'t-protocol',title:'Protokoll · 8 elem',sub:'mit miért szedsz, és ki tette a helyére',on:'protokoll'})
    +row({icon:'t-gear',title:'Új elem beállítása',sub:'mennyit, mikor és miért',on:'stack-uj.1'})
    +row({icon:'t-syringe',title:'Gyógyszer',sub:'a követett gyógyszered és a ciklusa',on:'gyogyszer'})
    +note('Tájékoztatás, nem orvosi tanács.'),{i:6})}`);
}
function protokoll(){
  const Z=[['Ébredés','t-dawn','07:00',[['Kreatin-monohidrát','5 g','Reggel, üres gyomorra is jól szívódik; a napi összmennyiség a lényeg.','auto'],['Kávé · espresso','80–100 mg','Ébredés után 60–90 perccel a legjobb, a koffein-stop 14:00.','auto'],['Tasty Dose gombakávé','8 g','A reggeli kávé mellé, fókuszhoz.','kézi']]],
    ['Reggeli','t-sun','08:00',[['Impact Whey Protein','30–40 g','Pihenőnapon a reggelihez kerül.','auto']]],
    ['Ebéd','t-bowl','12:30',[['D3 + K2','4000 IU + 100 µg','Zsíros étkezéssel szívódik fel a legjobban.','auto'],['Omega-3','2 g EPA+DHA','Az ebéd a nap legzsírosabb pontja.','auto']]],
    ['Edzés előtt','t-dumbbell','16:30',[['Origin PWO','20 g','Edzés előtt 20–30 perccel; pihenőnapon kimarad.','auto']]],
    ['Este','t-moon','21:00',[['Magnézium-glicinát','300 mg','Este nyugtat, segíti az elalvást.','auto']]]];
  return page('fuel',{title:'Protokoll',sub:'Kiegészítők · v3 · 86% bizalom',back:'stack'},`
  ${nh({lbl:'A napi rended',n:'8',unit:'elem · 5 idősáv',art:'t-protocol',verdict:'Egy elemet kézzel tettél a helyére, a többit én időzítettem.',sub:'Koppints egy elemre: ott állítod a zónát és a dózist.',acts:btn('Új elem beállítása','stack-uj.1')},1)}
  ${sec(1,'Idősávok',2)}
  ${Z.map(([z,ic,t,items],i)=>card(head(ic,`${z} · ${t}`)+items.map(([n,d,why,m])=>row({icon:'t-supps',title:n,sub:`${d} · ${why}`,right:st(m==='kézi'?'kézi':'auto',m==='kézi'?'plan':'q')+chev(),on:{sheet:'stackitem',arg:m+'|'+n}})).join(''),{i:i+2})).join('')}
  ${sec(2,'Étkezéshez · 2',7)}
  ${card(row({icon:'t-bowl',title:'Ebéd · 12:30',sub:'Csirke + édesburgonya + spenót · zsír 11 g · a D3 + K2 mellé elég',on:'recept.r2'})
    +row({icon:'t-sun',title:'Reggeli · tegnap',sub:'fehérje 49 g · a whey-jel együtt rendben'})
    +note('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.'),{i:7})}`);
}
function stackUj(s){
  s=Math.min(3,Math.max(1,+s||1)); const names=['Termék','Adatok','Javaslat'];
  const top={title:'Új elem beállítása',sub:`Kiegészítők · ${s} / 3 · ${names[s-1]}`,back:s===1?'stack':'stack-uj.'+(s-1)};
  const pb=`<div class="fx-pb rise">${[1,2,3].map(n=>`<i class="${n<=s?'on':''}"></i>`).join('')}</div>`;
  if(s===1) return page('fuel',top,`${pb}
  ${hero({lbl:'1. lépés · termék',verdict:'Melyik terméket állítsuk be?',sub:'A címkéjéről kiolvasom, mennyi van benne, és megmondom, ez mennyi az ajánlott napi mennyiségből.',body:`<div style="margin-top:12px">${srch('Név vagy márka…')}</div>`},1)}
  ${sec(1,'A polcodról',2)}
  ${card([['Kreatin-monohidrát','MyProtein · 5 g',1],['Cink-biszglicinát','— · 15 mg',0],['D3 + K2','MyProtein · 4000 IU + 100 µg',1]].map(([n,sub,inn])=>row({icon:'t-supps',title:n,sub,right:(inn?st('a stackben','q'):'')+chev(),on:'stack-uj.2'})).join(''),{i:2})}
  ${sec(2,'Vagy új termék',3)}
  ${card(row({icon:'t-link',title:'Termék linkje',sub:'bemásolod a webshop oldalát, kiolvasom a termék adatait',on:'stack-uj.2'})
    +row({icon:'t-camera',title:'Címkefotóról',sub:'lefotózod a hátoldalt, kiolvasom, amit a címke mond',on:'stack-uj.2'})
    +row({icon:'t-journal',title:'Beírom kézzel',sub:'ha nincs nálad a termék',on:'stack-uj.2'}),{i:3})}`);
  if(s===2) return page('fuel',top,`${pb}
  ${hero({lbl:'2. lépés · adatok',verdict:'Ezek a termék saját adatai.',sub:'A címkén vagy a webshopban látod őket. Javítsd, ha valami nem stimmel.',left:hi('t-supps')},1)}
  ${sec(1,'A termék',2)}
  ${card(fld('Termék neve','Cink-biszglicinát')+`<div class="fx-two">${[['Egy egységben','15'],['Mértékegység','mg'],['Kiszerelés','kapszula'],['Dobozban','90']].map(([l,v])=>`<div>${fld(l,v)}</div>`).join('')}</div>`,{i:2})}`,
  {foot:btn('Másik termék','stack-uj.1','ghost')+btn('Tovább','stack-uj.3')});
  return page('fuel',top,`${pb}
  ${nh({lbl:'Cink-biszglicinát · javaslat',n:'1',unit:'kapszula naponta · 15 mg',art:'t-supps',verdict:'Ez az ajánlott 10–15 mg-os sávban van.',sub:'Vacsorával szívódik fel a legjobban, és nem versenyez a reggeli vassal. A doboz kb. 90 napra elég.'},1)}
  ${sec(1,'Finomítás',2)}
  ${card(lab('Napi mennyiség')+stp(1,'kapszula','Napi mennyiség')+lab('Mikor')+pick(['Ébredés','Reggeli','Edzés előtt','Edzés után','Ebéd','Vacsora','Este','Lefekvés'],'Vacsora','Mikor')
    +`<p class="fh-note fx-warn">Amire figyelj: hosszan 25 mg fölött a réz felszívódását ronthatja.</p>`
    +note('Tájékoztatás, nem orvosi tanács. Gyógyszer vagy krónikus betegség mellett kérdezd meg a kezelőorvosod.'),{i:2})}`,
  {foot:btn('Vissza','stack-uj.2','ghost')+btn('Felveszem · Vacsora','protokoll')});
}
function gyogyszer(arg){
  if(arg!=='aktiv') return page('fuel',{title:'Gyógyszer',sub:'Kiegészítők · követés',back:'stack'},`
  ${hero({lbl:'Követett gyógyszer',verdict:'Nincs követett gyógyszer.',sub:'Ha szedsz valamit ciklusban, ide kerül a fázis-térkép és a beadás-napló.',left:hi('t-syringe'),
    acts:btn('Gyógyszer felvétele',{sheet:'medform'})+lk('Minta: ha van követett gyógyszer','gyogyszer.aktiv')},1)}
  ${card(note('Tájékoztatás, nem orvosi tanács.'),{i:2})}`);
  return page('fuel',{title:'Retatrutid',sub:'Gyógyszer · subQ injekció · heti · hétfő',back:'stack'},`
  ${nh({lbl:'3. nap a ciklusban',n:'6',unit:'mg · hetente',art:'t-syringe',verdict:'Stabil fázisban vagy, az utolsó beadás 2 napja volt.',body:cyc(2)+note('C csúcs · S stabil · V völgy; a beadás napjától számolva.'),
    acts:btn('+ Beadás',{sheet:'dose'})+lk('Váltás: nincs gyógyszer','gyogyszer')},1)}
  ${sec(1,'Beadások · 3',2)}
  ${card([['hétfő, okt. 5.','hétfő reggel · subQ has'],['hétfő, szept. 28.',''],['hétfő, szept. 21.','']].map(([d,n])=>row({icon:'t-syringe',title:d,sub:n,v:'6<small>mg</small>'})).join('')
    +acts(btn('Szerkesztés',{sheet:'medform'},'sm ghost')+lk('Leállítás',{toast:'Leállítom? Még egy érintés'}))+note('Tájékoztatás, nem orvosi tanács.'),{i:2})}`);
}

/* ═══ TRENDEK · ábrák (inline SVG, .fh-chart) ═══════════════════ */
function weekSvg(){
  const W=336,H=132,mx=2900,x=i=>12+i*46,bw=26,base=110,h=v=>v/mx*82;
  return `<svg class="fh-chart fx-wk" viewBox="0 0 ${W} ${H}" role="img" aria-label="A hét hét napja a keretéhez mérve, a nap pontja fölötte">
    ${WEEK.map(([d,k,t,s],i)=>`<g data-sheet="day" data-arg="${i}" style="cursor:pointer"><rect x="${x(i)-10}" y="0" width="${bw+20}" height="${H}" fill="transparent"/>
      ${k==null?`<rect class="gap" x="${x(i)}" y="${base-h(t)}" width="${bw}" height="${h(t)}" rx="7"/>`:`<rect class="col ${i===2?'on':''}" x="${x(i)}" y="${base-h(k)}" width="${bw}" height="${h(k)}" rx="7"/>`}
      <line class="tgt" x1="${x(i)-4}" x2="${x(i)+bw+4}" y1="${base-h(t)}" y2="${base-h(t)}"/>
      <text x="${x(i)+bw/2}" y="${(base-h(Math.max(k||0,t)))-7}" text-anchor="middle" class="${k==null?'':'val'}">${s||'·'}</text>
      <text x="${x(i)+bw/2}" y="${H-3}" text-anchor="middle" class="${i===2?'on':''}">${d}</text></g>`).join('')}
  </svg>`;
}
function longSvg(){
  const kcal=[2860,2990,3050,2940,3120,3010,3055], wt=[84.0,83.9,null,83.7,83.6,null,83.9,83.4,83.2,82.9,82.6,82.2,81.9,81.6,81.5,81.3,81.4,81.1,80.9,80.8,80.7];
  const W=336,H=152,X=i=>14+i*(292/20),Yw=v=>22+(84.2-v)/3.8*88;
  const dots=wt.map((v,i)=>v==null?'':`<circle class="raw" cx="${X(i).toFixed(1)}" cy="${Yw(v).toFixed(1)}" r="2.6"/>`).join('');
  const tr=wt.map((_,i)=>{const w=wt.slice(Math.max(0,i-2),i+3).filter(v=>v!=null);return [X(i),Yw(w.reduce((a,b)=>a+b,0)/w.length)]});
  const kx=i=>14+i*(292/6), ky=v=>134-(v-2800)/400*34; const last=tr[tr.length-1];
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Súlytrend simított vonallal, a mérések pontokként, alatta a heti átlag kcal vékony vonallal, 7 hét">
    ${[81,82,83,84].map(v=>`<line class="grid" x1="14" x2="${W-26}" y1="${Yw(v).toFixed(1)}" y2="${Yw(v).toFixed(1)}"/><text x="${W-2}" y="${(Yw(v)+3.5).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    <path class="thin" d="${smooth(kcal.map((v,i)=>[kx(i),ky(v)]))}"/>
    ${dots}<path class="tr" d="${smooth(tr)}"/><circle class="end" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5"/>
    <text x="14" y="${H-2}">aug. 18.</text><text x="${W-26}" y="${H-2}" text-anchor="end">okt. 7.</text></svg>`;
}
function waterfallSvg(){
  const steps=[['aug.',-0.4],['',-0.3],['',-0.5],['szept.',+0.2],['',-0.6],['',-0.4],['okt.',-0.7]]; const start=84.0,goal=78.0;
  const W=336,H=140,bw=26,x=i=>14+i*37,Y=v=>18+(84.3-v)/(84.3-goal+0.3)*100;
  let cur=start,out=`<text x="14" y="11" class="val">${fmt(start.toFixed(1))} kg</text>`;
  steps.forEach(([l,d],i)=>{const a=cur,b=cur+d;cur=b;const top=Math.min(a,b),bot=Math.max(a,b);
    out+=`<rect class="col ${d>0?'up':''}" x="${x(i)}" y="${Y(bot).toFixed(1)}" width="${bw}" height="${Math.max(6,(Y(top)-Y(bot))).toFixed(1)}" rx="4"/>${l?`<text x="${x(i)+bw/2}" y="${H-3}" text-anchor="middle">${l}</text>`:''}`;
    if(i<steps.length-1) out+=`<line class="grid" x1="${x(i)+bw}" x2="${x(i+1)}" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}"/>`});
  out+=`<rect class="tot" x="${x(7)}" y="${Y(cur).toFixed(1)}" width="${bw}" height="${(Y(goal)-Y(cur)).toFixed(1)}" rx="5"/><text x="${x(7)+bw/2}" y="${(Y(cur)-6).toFixed(1)}" text-anchor="middle" class="on">${fmt(cur.toFixed(1))}</text><text x="${x(7)+bw/2}" y="${H-3}" text-anchor="middle">cél ${fmt(goal.toFixed(1))}</text>`;
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="A hét hét lépése a kiindulástól a célig, vízesés-ábrán">${out}</svg>`;
}
function trendek(){
  return page('fuel',{title:'Trendek',sub:'Fuel · október 1–7.',tab:'trendek'},`
  ${dn('Ez a hét','október 1–7.',{toast:'Múlt hét'},null)}
  ${hero({lbl:'5 / 7 naplózott nap · ebből áll a heti kép',verdict:'Hétvégén 46%-kal többet ettél a keretedhez mérve, mint hétköznap.',body:weekSvg()+note('A vonás a nap kerete, a szám a nap pontja. A szaggatott oszlop nem naplózott nap; nem töltöm ki becsléssel. Koppints egy oszlopra.'),
    acts:btn('A hét napjai','mai.het','sm')},1)}
  ${sec(1,'A hét számai',2)}
  ${card(grid([
    stat({k:'Napi átlag',icon:'t-plate',n:'2 069',unit:'kcal',s:'180 kcal-lal kevesebb, mint múlt héten',on:{toast:'Napi átlag · 5 naplózott nap'}}),
    stat({k:'Minőség',icon:'t-score',n:'7,8',unit:'/ 10',s:'0,7-del több, mint múlt héten',sCls:'ok',c:'var(--ok)',on:{toast:'Étkezés-minőség · a napi pontok átlaga'}}),
    stat({k:'Heti súlyátlag',icon:'t-weight',n:'81,3',unit:'kg',s:'0,6 kg-mal kevesebb',on:{toast:'Heti súlyátlag · 4 mérés'}}),
    stat({k:'Naplózott nap',icon:'t-calendar',n:'5',unit:'/ 7',pct:71,s:'2 nap kimaradt',on:'mai.het'})]),{i:2})}
  ${sec(2,'Hétköznap és hétvége',3)}
  ${card(mrow('Hétköznap','<b>79</b> %',pc(79,130),'var(--dom)')+mrow('Hétvége','<b>125</b> %',pc(125,130),'var(--dom)')
    +note('A keret százalékában. A különbség 46 százalékpont a hétvége javára. Így alakult, és most már látod.'),{i:3})}
  ${sec(3,'Hosszabb táv · 7 hét',4)}
  ${card(head('t-weight','Súlytrend')+longSvg()+note('A vastag vonal a simított súlytrend, a halvány pontok a napi mérések. Alatta vékonyan a heti átlag kcal. Egyik sem ok, csak együttjárás.'),{i:4})}
  ${sec(4,'A cél felé · 84,0 → 78,0 kg',5)}
  ${card(waterfallSvg()+note('Egy oszlop egy hét lépése. Ami még hátravan, az utolsó oszlop. Ahol nem volt elég mérés, ott a súlyvonal megszakad.'),{i:5})}
  ${sec(5,'Mintázatok · 2',6)}
  ${card(row({icon:'t-pattern',title:'Késő szénhidrát → másnap reggeli RPE +1',sub:'20:00 után, 60 g felett',right:st('figyeljük','q')+chev(),on:{toast:'Mezo · a mintázat oldala'}})
    +row({icon:'t-pattern',title:'Koffein 14:00 után → elalvás +24 perc',sub:'több hét adata',right:st('megerősítve','ok')+chev(),on:{toast:'Mezo · a mintázat oldala'}})
    +note('A mintázatok otthona a Mezo; innen odalépsz, nem másolatot látsz.'),{i:6})}`);
}

/* ═══ BEÁLLÍTÁSOK · ABLAKOK · TANULÁS ══════════════════════════ */
function beallitas(){
  return page('fuel',{title:'Fuel beállítások',sub:'Fuel · ritmus, makrók, célok',back:'mai'},`
  ${hero({lbl:'A mai cél alapján',verdict:`A kereted ma ${kc(DAY.target)} kcal, négy étkezésre osztva.`,sub:'A ritmus vezet, nem korlátoz: bármelyik ablak utólag is logolható.',left:hi('t-gear')},1)}
  ${sec(1,'Ritmus',2)}
  ${card(`<div class="fx-two"><div>${lab('Étkezés / nap')}${stp(4,'étkezés','Étkezés/nap (3–6)')}</div><div>${sel('Koffein-stop','14:00')}</div></div>`
    +note('A koffein-stop a Mai sorát, a nap-tervet és a koffein-szokást is állítja.')
    +row({icon:'t-clock',title:'Étkezési ablakok',sub:'szerkesztése · 4 ablak · 3 naptípus',on:'ablakok'}),{i:2})}
  ${sec(2,'Makrók',3)}
  ${card(sel('Makróprofil','Kiegyensúlyozott')+`<div style="margin-top:12px">${[['Fehérje','24 %','220 g','var(--protein)',24,'t-meat'],['Szénhidrát','47 %','380 g','var(--carb)',47,'t-carb'],['Zsír','29 %','95 g','var(--fat)',29,'t-avocado']].map(([l,p,g,c,w,ic])=>mrow(l,`<b>${p}</b> · ${g}`,w*2,c,ic)).join('')}</div>`,{i:3})}
  ${sec(3,'Célok',4)}
  ${card(`<div class="fx-two"><div>${fld('Víz-cél','2 500 ml')}</div><div>${fld('Rost-cél','30 g')}</div></div>`,{i:4})}
  ${sec(4,'Finomhangolás',5)}
  ${card(lab('Fehérje-szint')+pick(['Alacsony','Mérsékelt','Magas'],'Magas','Fehérje-szint')
    +note('A testsúlyod és a zsírmentes tömeged szerinti számítást is állítja; a cél a kettő közül a nagyobb, egy felső korláttal.')
    +row({icon:'t-brain',title:'Tanulás a súlyomból és az evésemből',sub:'hetente megtanulom, mennyi energiát használsz valójában',right:sw(true,'Tanulás a súlyomból és az evésemből')})
    +acts(lk('Hogy tanultam?','tanulas')),{i:5})}`,
  {foot:btn('Mentés',{toast:'Mentve'})});
}
function ablakok(arg){
  const edit=arg==='szerk';
  const S=[['08:00','Reggeli','t-sun',600],['12:30','Ebéd','t-bowl',780],['16:00','Uzsonna','t-snack',300],['19:30','Vacsora','t-moon',720]];
  const days=`<div style="margin-top:12px">${pick(['Pihenőnap','Reggeli edzés','Esti edzés'],'Pihenőnap','Naptípus')}</div>`;
  return page('fuel',{title:'Étkezési ablakok',sub:'Beállítások · 4 ablak · 3 naptípus',back:edit?'ablakok':'beallitas'},`
  ${hero({lbl:edit?'Testreszabás':'Ajánlott felosztás',verdict:edit?'Állítsd át a nevet, a típust vagy az időt.':'Pihenőnapon négy ablak osztja el a napot.',sub:edit?'A részek együtt mindig 100 %-ot adnak.':'A napod valódi edzésblokkjaiból számolva.',body:days,
    acts:edit?'':btn('Testreszabás','ablakok.szerk')},1)}
  ${sec(1,'Ablakok · Σ 100 %',2)}
  ${edit?card(S.map(([t,l,ic,k])=>`<div class="fx-win"><div class="fx-wh"><span class="si">${I(ic)}</span><input class="fh-in" value="${l}" aria-label="Ablak neve"><button class="fx-add" data-toast="Ablak törölve" aria-label="Ablak törlése">×</button></div>${pick(['Reggeli','Ebéd','Vacsora','Snack'],l==='Uzsonna'?'Snack':l,'Típus')}<p class="fx-wv"><b>${t}</b> · ${Math.round(k/24)} % · ${k} kcal</p></div>`).join('')
    +acts(btn('+ Új ablak',{toast:'Új ablak'},'sm ghost')+lk('Mezo értékelése',{toast:'Mezo értékeli a felosztást…'})),{i:2})
  :card(S.map(([t,l,ic,k])=>step({time:t,icon:ic,title:l,sub:'horgony: fix időpont',right:`<span class="fx-kv"><b>${k}</b> kcal<small>${Math.round(k/24)} %</small></span>`})).join('')
    +note('Ajánlott felosztás: a napod valódi edzésblokkjaiból számolva. Σ 100 %.'),{i:2})}`,
  edit?{foot:btn('Mégse','ablakok','ghost')+btn('Mentés',{toast:'Mentve'})}:{});
}
function learnSvg(){
  const W=336,H=160,L=30,R=8,T0=10,B=24,n=WK.length,x=i=>L+(W-L-R)*(i+.5)/n,lo=2250,hi=2650,y=v=>T0+(H-T0-B)*(1-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo));
  const runs=[];{let run=[];WK.forEach((w,i)=>{if(w)run.push({w,i});else{if(run.length)runs.push(run);run=[]}});if(run.length)runs.push(run)}
  const line=get=>runs.map(r=>smooth(r.map(({w,i})=>[x(i),y(get(w))]))).join('');
  const band=runs.map(r=>`<path class="band" d="${r.map(({w,i},k)=>`${k?'L':'M'}${x(i).toFixed(1)} ${y(w[2]+w[3]).toFixed(1)}`).join('')}${r.slice().reverse().map(({w,i})=>`L${x(i).toFixed(1)} ${y(w[2]-w[3]).toFixed(1)}`).join('')}Z"/>`).join('');
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="A keret alapja hétről hétre, 12 hét: szaggatott a képlet, folytonos a tanult alap, körülötte a bizonytalanság sávja">
    ${[2300,2400,2500,2600].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-4}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    ${band}${WK.map((w,i)=>w?'':`<rect class="gap" x="${(x(i)-8).toFixed(1)}" y="${T0}" width="16" height="${H-T0-B}" rx="6"/>`).join('')}
    <path class="thin dash" d="${line(w=>w[1])}"/><path class="tr" d="${line(w=>w[4])}"/>
    ${WK.map((w,i)=>w?`<circle class="${i===n-1?'end':w[5]?'hold':'raw'}" cx="${x(i).toFixed(1)}" cy="${y(w[4]).toFixed(1)}" r="${i===n-1?4.5:3}"/>`:'').join('')}
    ${[0,4,8,11].map(i=>`<text x="${x(i).toFixed(1)}" y="${H-5}" text-anchor="middle">${WK[i]?WK[i][0]:'júl. 27.'}</text>`).join('')}</svg>`;
}
function tanulas(arg){
  const emp=arg==='ures', off=arg==='ki';
  const h=emp?hero({lbl:'Tanulás',verdict:'Még nem tanultam.',sub:'Ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.',left:hi('t-brain'),acts:btn('Étkezés logolása','log','sm')},1)
    :off?hero({lbl:'Most nem használom',verdict:'A keret a képletből jön: 2 400 kcal.',sub:'Közben csendben tovább tanultam: 2 480 ± 150 kcal.',left:hi('t-brain'),acts:btn('Bekapcsolás a beállításokban','beallitas')},1)
    :nh({lbl:'Tanult alap · közepesen biztos',n:'2 480',unit:'kcal · ±150',art:'t-brain',verdict:'A képlet 2 400-at mondana; én ennyit tanultam a súlyodból és az evésedből.',
      acts:btn('Heti egyeztetés',{sheet:'weekly'})+st('1 javaslat vár','warn')},1);
  let n=0;
  return page('fuel',{title:'Hogy tanultam?',sub:'Fuel · a keret alapja',back:'mai'},`
  ${h}
  ${emp?'':`${sec(++n,'Hétről hétre · 12 hét',2)}
  ${card(learnSvg()+note('Szaggatott: a képlet. Folytonos: a keret alapja. A sáv a bizonytalanság. Üres kör: azon a héten vártam. Ahol nincs sor, a vonal megszakad.')
    +row({icon:'t-calendar',title:'szept. 28 – okt. 4.',sub:'képlet 2 400 · tanult 2 480 ± 150 · lépés +60 · 4 teljes nap · 4 mérlegelés'}),{i:2})}`}
  ${sec(++n,'Az utolsó 14 nap · a mai nem számít',3)}
  ${card(LD.map(([d,k,s,on,can])=>row({icon:on?'t-tick':'t-shield',title:d,sub:`${k==null?'':kc(k)+' kcal · '}${s}`,right:can?sw(!!on,d+' számít'):'<span class="fx-dash">—</span>'})).join('')
    +note('A kapcsolóval megmondod, hogy egy nap teljes volt-e; azonnal újraszámolom. Felírás nélküli napot nem lehet jelölni.'),{i:3})}
  ${emp?'':`${sec(++n,'A legutóbbi hét · hat lépésben',4)}
  ${card(HW.map(([t],i)=>row({left:`<span class="fx-dd">${i+1}</span>`,title:t,on:{sheet:'hw',arg:i}})).join(''),{i:4})}`}
  ${sec(++n,'Prototípus · állapotváltó',5)}
  ${card(seg([['Tanul','tanulas',!emp&&!off],['Nincs adat','tanulas.ures',emp],['Ki','tanulas.ki',off]])+note('Csak a prototípusban: a három állapot, amit ez az oldal mutatni tud.'),{i:5})}`);
}

/* ═══ LAPOK (alulról) ═════════════════════════════════════════ */
const sheets={
  eq:()=>`${sh('t-bowl','Miből jön össze?','1 040 kcal fér még bele ma')}
    ${[['Alap','t-flame','a súlytrendedből és az evésedből tanulva · heti egyeztetés ›','2 480'],['Mozgás','t-dumbbell','ma logolt mozgásod · még jön +460, ha megcsinálod a röpit','+ 650'],['Célod','t-ring','a fogyási célod napi része','− 30'],['Étel','t-bowl','amit ma eddig logoltál','− 2 060']].map(([l,ic,s,v],i)=>row({icon:ic,title:l,sub:s,v,on:i===0?{sheet:'weekly'}:null})).join('')}
    <div class="fx-tot"><span>Marad<small>a mai kereted maradéka</small></span><b>1 040<small>kcal</small></b></div>
    ${note('A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja; a keret akkor nő, amikor logolod az edzést.')}
    ${acts(btn('Honnan jön a keret?',{sheet:'energy'},'sm')+closeLk())}`,
  energy:()=>`${sh('t-ring','Honnan jön a 3 100 kcal?','A napi cél nem statikus: az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.')}
    <div class="fx-sum"><span class="fh-big">2 480 + 650 − 30</span><b>= 3 100</b></div>
    ${row({icon:'t-history',title:'Alap · tanult',sub:'a képlet (BMR × NEAT) 2 400-at mondana · közepesen biztos · ±150',v:'2 480',on:'tanulas'})}
    ${row({icon:'t-dumbbell',title:'Mozgás · ma logolva',sub:'Felsőtest A · 58 perc · 190 · Röpi edzés · 95 perc · 460',v:'+650'})}
    ${row({icon:'t-ring',title:'Célod',sub:'0,3 kg/hét · lassú ütem, hogy az edzés ereje megmaradjon',v:'−30'})}
    ${note('A tervezett, még meg nem csinált edzés csak halványan látszik; a becslés a nyugalmi energiád feletti többletet számolja. Ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.')}
    ${acts(closeLk())}`,
  water:()=>`${sh('t-water','Mennyit ittál?','ma eddig 1,3 / 2,5 l')}
    <div class="fx-sum"><span class="fh-big">400<small>ml</small></span></div>
    ${pick(['250 ml','400 ml','500 ml'],'400 ml','Adag')}
    ${fld('Kézzel','','pl. 330')}
    ${acts(btn('Mentés',{toast:'Víz mentve · 400 ml'},'sm')+closeLk('Mégse'))}`,
  /* heti egyeztetés: három rövid modul, mind átugorható */
  weekly:()=>`${sh('t-compare','Heti egyeztetés','szept. 28 – okt. 4. · 3 lépés, kb. 2 perc; bármelyiket átugorhatod')}
    <div class="fx-mod"><div class="fx-modh"><b>1 / 3 · Miért most</b><button class="fh-lk" data-toast="Átugorva">Kihagyom</button></div><p class="fh-txt">Lezárult a hét, és a súlyod lassabban nőtt, mint amit a felírt evés alapján vártam. Alap 2 480 kcal · közepesen biztos · ±150.</p></div>
    <div class="fx-mod"><div class="fx-modh"><b>2 / 3 · Mi történt</b><button class="fh-lk" data-toast="Átugorva">Kihagyom</button></div><p class="fh-txt">Két napot kihagytam, mert hiányosnak tűntek. Ha teljesek voltak, mondd.</p>
      ${[['szerda, szept. 30.','1 180 kcal · hiányosnak tűnt'],['vasárnap, okt. 4.','1 020 kcal · hiányosnak tűnt']].map(([d,s])=>row({icon:'t-shield',title:d,sub:s,right:btn('Teljes volt',{toast:'Teljesnek jelölve · a keret +20 kcal'},'sm ghost')})).join('')}</div>
    <div class="fx-mod"><div class="fx-modh"><b>3 / 3 · Javaslat</b><button class="fh-lk" data-toast="Később">Később</button></div><p class="fh-txt">A napi keretedben <b>+60 kcal</b>. Hetente csak kis lépést teszek, új irányba először csak félig.</p>
      ${acts(btn('Elfogadom',{toast:'Elfogadva · a keret 3 100 kcal'},'sm')+lk('Részletek','tanulas')+`<button class="fh-lk" data-toast="Elrejtettem; ezt a hetet nem mutatom újra" data-close>Bezárom</button>`)}</div>`,
  day:i=>{i=+i||0;const [d,k,t,s,tr]=WEEK[i]||WEEK[0]; return k==null?`${sh('t-plate',`${DAYN[i]} · okt. ${1+i}.`,'Ezen a napon nem naplóztál.')}${txt('Nem töltöm ki becsléssel, és a heti átlagból is kimarad.')}${acts(btn('Pótolom a napot','log','sm')+closeLk())}`
    :`${sh('t-calendar',`${DAYN[i]} · okt. ${1+i}.`,`a nap pontja ${s} · ${kc(k)} / ${kc(t)} kcal${tr?' · edzésnap':''}`)}
    ${mrow('Kalória',`<b>${kc(k)}</b> / ${kc(t)}`,pc(k,t),'var(--dom)')}${mrow('Fehérje','<b>148</b> / 160 g',pc(148,160),'var(--protein)')}${mrow('Szénhidrát','<b>231</b> / 250 g',pc(231,250),'var(--carb)')}${mrow('Zsír','<b>66</b> / 75 g',pc(66,75),'var(--fat)')}
    ${note(`A kereted ezen a napon ${kc(t)} kcal volt. ${k>t?`${k-t} kcal-lal fölé ment; így alakult.`:'Belefértél; így alakult.'}`)}
    ${lab('A nap étkezései')}
    ${row({icon:'t-plate',title:'Zabkása gyümölccsel',sub:'08:00 · 420 kcal',v:'8,2',on:{toast:'Az étkezés részletei'}})}${row({icon:'t-plate',title:'Csirkés rizstál',sub:'12:40 · 760 kcal',v:'8,4',on:{toast:'Az étkezés részletei'}})}
    ${acts(btn('Megnézem a napot','mai.tegnap','sm')+closeLk())}`},
  item:name=>{const x=STACK.flatMap(b=>b.items).find(i=>i[0]===name)||STACK[1].items[1]; return `${sh('t-supps',x[0],`naponta · ${x[1]} · ${x[2]}${x[3]?' · bevéve '+x[4]:' · ma még nincs bevéve'}`)}
    ${txt('Zsíros étkezéssel szívódik fel a legjobban; az ebéd a nap legzsírosabb pontja.')}
    ${row({icon:'t-stack',title:'Ebből a termékből',sub:`kapszula · 1 db · készleten 42 db · napi összmennyiség ${x[1]}`,on:'kamra.kreatin'})}
    ${acts(btn(x[3]?'Mégsem vettem be':'Bevettem',{toast:x[3]?'Visszavonva':'Bevéve · '+x[0]},'sm')+closeLk())}
    ${note('Tájékoztatás, nem orvosi tanács.')}`},
  stackitem:arg=>{const [pin,name]=(arg||'auto|Tasty Dose gombakávé').split('|'); return `${sh('t-supps',name||'Tasty Dose gombakávé',pin==='kézi'?'ide raktad kézzel (Ébredés)':'automatikusan időzítve')}
    ${pin==='kézi'?acts(btn('Vissza automatikusra',{toast:'Vissza automatikusra'},'sm ghost')):''}
    ${lab('Zóna')}${pick(['Ébredés','Reggeli','Edzés előtt','Edzés után','Ebéd','Vacsora','Este','Lefekvés'],'Ébredés','Zóna')}
    <div class="fx-two"><div>${fld('Dózis','8 g')}</div><div>${fld('+ Bevétel','','még egy dózis')}</div></div>
    ${acts(`<button class="fh-lk fx-bad" data-toast="Eltávolítva a stackből">Eltávolítás a stackből</button>`+closeLk())}`},
  dim:arg=>{const [id,i]=(arg||'reggeli|0').split('|'); const m=MEALS[id]||MEALS.reggeli; const [l,ic,w,t,rows]=DIMS[+i]||DIMS[0]; return `${sh(ic,l,`${fmt(m.dims[+i||0])} / 10 · súly ${w}%`)}${txt(t)}${rows.map(([k,v])=>row({title:k,v})).join('')}${acts(closeLk())}`},
  glu:g=>`${sh('t-glucose','Vércukor',g==='1'?'közepes emelkedés várható':'alacsony emelkedés várható')}${txt(g==='1'?'A rizs gyors szénhidrátja most épp jól jön edzés után, de a következő órában laposabb a figyelem.':'A zab és a túró lassan ereszti a cukrot; egyenletes energia délig.')}${note('Becslés a hozzávalókból, nem mérés.')}${acts(closeLk())}`,
  ora:()=>`${sh('t-clock','Az étkezési óra','miért ekkor, mire számíts')}${txt('Az ablakok a napod valódi edzésblokkjaiból jönnek. Nem korlátok: bármelyik utólag is logolható, és egy manuálisan megadott idő átviheti az étkezést másik ablakba.')}
    ${SLOTS.map(s=>step({time:s.from,icon:s.ic,title:s.l,sub:`${s.from}–${s.to}`,right:`<span class="fx-kv"><b>${s.b}</b> kcal</span>`})).join('')}
    ${acts(btn('Ablakok szerkesztése','ablakok','sm')+closeLk())}`,
  import:()=>`${sh('t-camera','Új tétel a kamrába','fotó a címkéről vagy egy termék linkje')}
    ${note('A nevet, makrókat és tápértékeket az AI olvassa ki /100 g bázison. A fotó nem kerül tárolásra.')}
    <div style="margin:10px 0">${pick(['Fotó','Link'],'Fotó','Forrás')}</div>
    <button class="fx-ph" style="height:120px" data-toast="Kamera · a tápérték-táblázat">${I('t-camera')}<strong>Címkefotó</strong><small>előlap fotó opcionális, ha a név nem látszik</small></button>
    ${acts(btn('Beolvasás',{toast:'Beolvasva · Skyr · epres · Milbona · 62 kcal'},'sm')+closeLk('Mégse'))}`,
  add:edit=>`${sh('t-journal',edit?'Tétel szerkesztése':'Új kamra-tétel',edit?'':'kézi felvétel')}
    <div class="fx-two"><div>${sel('Típus','Étel')}</div><div>${sel('Forrás','Saját bevitel')}</div></div>
    ${fld('Név',edit?'Csirkemell · friss':'','pl. Görög joghurt 10%')}
    ${multi('Makrók / 100 g',[['119 kcal','kcal'],['6 feh.','fehérje'],['4 szénh.','szénhidrát'],['9 zsír','zsír']])}
    ${multi('Tápanyag / 100 g',[['','Rost'],['','Cukor'],['','Tel. zsír'],['','Só']])}
    ${fld('Ár','','750 Ft')}
    ${acts(btn(edit?'Mentés':'Polcra',{toast:edit?'Mentve':'A polcra került'},'sm')+closeLk('Mégse'))}`,
  catalog:()=>`${sh('t-stack','Hozzáadás a közösből','közös katalógus')}${srch('Keresés név vagy márka szerint')}<div style="margin:10px 0 4px">${pick(['Mind','Étel','Supp','Stim','Gyógyszer'],'Mind')}</div>
    ${[['Skyr natúr','Ehrmann · 63 kcal/100 g · Anna',0,'t-meat'],['Bulgur','Kifli · 342 kcal/100 g · mezo',0,'t-carb'],['Kreatin-monohidrát','— · kiegészítő · Béla',1,'t-supps']].map(([n,s,on,ic])=>row({icon:ic,title:n,sub:s,right:on?st('a polcon','q'):btn('+ Polcra',{toast:'A polcra került'},'sm ghost')})).join('')}`,
  catfilter:()=>`${sh('t-lens','Mit mutassak?','kategória-szűrő · 0 kiválasztva')}<div class="fh-pills" data-fmulti>${['Fehérje','Tejtermék','Hal','Gabona','Mag / olajos','Whey / protein','Kiegészítő','Stimuláns'].map(l=>`<button class="fh-pill" data-toast="Szűrő: ${l}">${l}<b>1</b></button>`).join('')}</div>${acts(`<button class="btn sm" data-close>Szűrés · 8 tétel</button>`)}`,
  kamrapick:()=>`${sh('t-stack','Válassz a polcról','kamra · hozzáadás')}${srch('Keress a kamrában…')}
    ${KAM.filter(k=>k.k==='food').slice(0,4).map((k,i)=>row({icon:kic(k),title:k.n,sub:`${k.b} · ${k.kcal} kcal · ${fmt(k.p)} feh. · ${fmt(k.c)} szénh. · ${fmt(k.f)} zsír / 100 g`,right:`<button class="fx-add ${i===1?'on':''}" data-toast="${i===1?'Már a listában':'Hozzáadva: '+esc(k.n)}" aria-label="${i===1?'Már a listában':'Hozzáadás'}">${i===1?I('i-check'):'+'}</button>`})).join('')}`,
  receptpick:()=>`${sh('t-book','Válassz receptet','recept · hozzáadás')}${REC.slice(0,4).map(r=>row({icon:CAT[r.cat][1],title:r.n+(r.star?' · csillagos':''),sub:`${CAT[r.cat][0]} · ${Math.round(r.p/r.serv)} / ${Math.round(r.c/r.serv)} / ${Math.round(r.f/r.serv)} g`,v:`${Math.round(r.kcal/r.serv)}<small>kcal</small>`,on:'log.tetelek'})).join('')}`,
  reclogs:id=>{const r=REC.find(x=>x.id===id)||REC[0]; return `${sh('t-journal',`Logok · ${r.logged}`,r.n)}${[['ma 07:20','689 kcal','8,4'],['tegnap 07:30','689 kcal','8,3'],['szept. 19. 07:10','620 kcal','8,1']].map(([d,k,s])=>row({icon:'t-plate',title:d,sub:k,v:`${s}<small>pont</small>`})).join('')}${acts(closeLk())}`},
  dose:()=>`${sh('t-syringe','Új beadás','Retatrutid')}${fld('Mikor','2026. 10. 07. · 14:10')}${fld('Dózis','6 mg')}${fld('Jegyzet','','pl. hétfő reggel · subQ has')}${acts(btn('Beadás',{toast:'Beadás rögzítve'},'sm')+closeLk('Mégse'))}`,
  medform:()=>`${sh('t-syringe','Gyógyszer felvétele','')}${fld('Név','','pl. Retatrutid')}${fld('Hatóanyag','','retatrutid')}
    ${lab('Beviteli út')}${pick(['subQ injekció','IM injekció','orális'],'subQ injekció','Beviteli út')}
    ${lab('Kadencia')}${pick(['heti','napi'],'heti','Kadencia')}
    ${lab('Nap')}${pick(['H','K','Sze','Cs','P','Szo','V'],'H','Nap')}
    ${lab('Ciklus · fázisok')}${cyc(-1)}${note('Alap-sablon: 2 nap csúcs · 3 nap stabil · 2 nap völgy; a beadás napjától számolva.')}
    ${acts(btn('Felveszem',{toast:'Felvéve'},'sm')+closeLk('Mégse'))}`,
  hw:i=>{i=+i||0;const [t,b]=HW[i]||HW[0]; return `${sh('t-info',`${i+1}. ${t}`,'a legutóbbi hét · szept. 28 – okt. 4.')}${txt(b)}${acts((i<5?btn('Következő lépés',{sheet:'hw',arg:i+1},'sm'):'')+closeLk())}`}
};

/* ═══ CSS (csak a Fuel területre) ═══════════════════════════════ */
const css=`
${P} .fh-row{border-top:1px solid var(--hair);padding:12px 0}
${P} .fh-row:first-child,${P} :not(.fh-row) + .fh-row{border-top:0}
${P} .fh-card > .fh-row:first-child,${P} .fh-card > .fh-h + .fh-row{padding-top:0}
${P} .fh-row:last-child{padding-bottom:0}
${P} :not(.fh-step) + .fh-step:not(.now){border-top:0}
${P} .fh-card > .fh-step:first-child:not(.now){padding-top:0}
${P} .fh-step:not(.now):last-child{padding-bottom:0}
${P} .fh-step[data-go],${P} .fh-step[data-toast]{cursor:pointer}
${P} .fh-row .v small{font-size:11.5px;color:var(--sub)}
${P} .fh-row > .bar{width:56px}
${P} .fh-row .st{flex:0 0 auto;white-space:nowrap}
${P} .fh-pill b{font-weight:600;opacity:.6;margin-left:2px}
${P} .fh-lab{margin-top:14px}
${P} .fh-card > .fh-lab:first-child{margin-top:0}
${P} .fh-hero > .bar{height:8px;border-radius:4px;margin-top:14px;background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px rgba(15,30,51,.05)}
${P} .fh-hero > .bar b{border-radius:4px}
${P} .fh-hero .verdict{position:relative}
${P} .fx-n{display:block;white-space:nowrap;margin:4px 0 12px}
${P} .fx-n small{display:block;white-space:normal;margin:6px 0 0;line-height:1.3}
${P} .fx-n.art{min-height:74px;padding-right:100px}
${P} .fx-la{display:block;padding-right:100px;min-height:14px}
${P} .fx-hi{display:grid;place-items:center;width:68px;height:68px;border-radius:22px;background:rgba(255,255,255,.75);box-shadow:inset 0 0 0 1px rgba(15,30,51,.05),0 10px 18px -12px rgba(15,30,51,.35);flex:0 0 auto}
${P} .fx-hi svg.ic{width:46px;height:46px;filter:drop-shadow(0 6px 7px rgba(15,30,51,.28))}
${P} .fx-mi{display:grid;place-items:center;width:26px;flex:0 0 auto}
${P} .fx-mi svg.ic{width:24px;height:24px;filter:drop-shadow(0 3px 4px rgba(15,30,51,.22))}
${P} .fh-mus .v{white-space:nowrap}
${P} .fh-mus .v b{color:var(--ink);font-weight:700}
${P} .fh-mus .bar{width:72px;flex:0 0 auto}
${P} .fx-dd{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);font-family:var(--disp);font-size:14px;font-weight:700;flex:0 0 auto}
${P} .fx-dd.on{background:var(--dom);color:#fff}
${P} .fx-star svg.ic{width:15px;height:15px;vertical-align:-2px;display:inline-block}
${P} .fx-sel{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left}
${P} .fx-sel i{font-style:normal;color:var(--faint)}
${P} .fx-multi{display:grid;gap:8px}
${P} .fx-multi .fh-in{padding:11px 10px;font-size:14px}
${P} .fx-two{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;align-items:end}
${P} .fx-two > div{min-width:0}
${P} .fx-stp{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
${P} .fx-stp b{font-family:var(--disp);font-size:17px;font-weight:700;min-width:22px;text-align:center}
${P} .fx-stp small{font-size:12px;color:var(--sub)}
${P} .fx-stp button{width:32px;height:32px;border-radius:11px;background:var(--page);display:grid;place-items:center;font-size:18px;font-weight:600;line-height:1;color:var(--ink)}
${P} .fx-it{flex-wrap:wrap}
${P} .fx-l2{flex:0 0 100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:50px;margin-top:2px;flex-wrap:wrap}
${P} .fx-sw{width:46px;height:28px;border-radius:14px;background:rgba(15,30,51,.14);position:relative;flex:0 0 auto;transition:background .2s}
${P} .fx-sw::after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(15,30,51,.3);transition:left .2s}
${P} .fx-sw.on{background:var(--dom)}
${P} .fx-sw.on::after{left:21px}
${P} .fx-tk{width:32px;height:32px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(15,30,51,.16);display:grid;place-items:center;color:transparent;flex:0 0 auto;margin:0 4px}
${P} .fx-tk.on{background:var(--ok);box-shadow:0 6px 12px -6px var(--ok);color:#fff}
${P} .fx-tk svg.ic{width:16px;height:16px;stroke-width:2.6}
${P} .fx-g{display:flex;align-items:center;gap:10px;text-align:left}
${P} .fx-g > span{flex:1;min-width:0}
${P} .fx-add{width:34px;height:34px;border-radius:12px;background:var(--page);display:grid;place-items:center;font-size:19px;font-weight:600;line-height:1;color:var(--ink);flex:0 0 auto}
${P} .fx-add.on{background:var(--dom);color:#fff}
${P} .fx-add svg.ic{width:16px;height:16px;stroke-width:2.6}
${P} .fx-dash{color:var(--faint);padding:0 16px}
${P} .fx-srch{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:13px;background:#fff;box-shadow:inset 0 0 0 1px var(--hair);color:var(--faint);font-size:15px}
${P} .fx-srch span{flex:1;color:var(--ink)}
${P} .fx-srch i{font-style:normal;color:var(--sub)}
${P} .fx-srch svg.ic{width:22px;height:22px}
${P} .fh-card:not(.fh-hero) .fx-srch{background:var(--page);box-shadow:none}
${P} .sheet .fx-srch{background:var(--page);box-shadow:none}
${P} .fx-cmp{display:flex;gap:8px;align-items:flex-end;padding:10px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px var(--hair);margin-top:12px}
${P} .fh-card:not(.fh-hero) .fx-cmp{background:var(--page);box-shadow:none}
${P} .fx-cmp textarea{flex:1;min-width:0;min-height:58px;background:none;border:0;color:var(--ink);font:inherit;font-size:15px;line-height:1.4;resize:none;outline:none;padding:4px}
${P} .fx-cmp textarea::placeholder{color:var(--faint)}
${P} .fx-cmp button{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:var(--page);flex:0 0 auto}
${P} .fh-card:not(.fh-hero) .fx-cmp button{background:#fff}
${P} .fx-cmp button svg.ic{width:24px;height:24px}
${P} .fx-cmp button.go{background:var(--dom)}
${P} .fx-goals{margin-top:12px}
${P} .fh-hero .fh-pill{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06)}
${P} .fh-hero .fh-pill.on{background:var(--dom);box-shadow:none}
${P} .fx-mode{margin-top:14px;padding-top:14px;border-top:1px solid var(--hair)}
${P} .fx-mode > .fh-lab:first-child{margin-top:0}
${P} .fx-ph{width:100%;height:150px;border-radius:18px;border:1.5px dashed color-mix(in srgb,var(--dom) 45%,transparent);background:color-mix(in srgb,var(--dom) 5%,#fff);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:var(--sub);font-size:12.5px;text-align:center;padding:0 12px}
${P} .fx-ph strong{color:var(--ink);font-family:var(--disp);font-size:16px;font-weight:700}
${P} .fx-ph svg.ic{width:44px;height:44px;margin-bottom:4px}
${P} .fx-listen{display:flex;gap:14px;align-items:center;padding:14px;border-radius:16px;background:color-mix(in srgb,var(--dom) 8%,#fff)}
${P} .fx-listen svg.ic{width:40px;height:40px}
${P} .fx-listen strong{display:block;font-family:var(--disp);font-size:18px;font-weight:700}
${P} .fx-listen p{font-size:13.5px;color:var(--sub);margin-top:2px}
${P} .fx-time{display:flex;gap:10px;align-items:center}
${P} .fx-time .fh-in{flex:1;min-width:0;color-scheme:light}
${P} .fx-pl{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
${P} .fx-pl svg.ic{width:34px;height:34px}
${P} .fx-pl > span{flex:1;min-width:0}
${P} .fx-pl strong{display:block;font-size:13.5px;font-weight:700}
${P} .fx-pl small{display:block;font-size:11.5px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${P} .fh-foot .btn{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;padding-left:10px;padding-right:10px;white-space:nowrap}
${P} .fh-foot .btn.ghost{flex:0 1 auto;padding-left:16px;padding-right:16px}
${P} .fh-foot .btn.sm{flex:0 0 auto}
${P} .btn[disabled]{opacity:.45;box-shadow:none}
${P} .fx-warn{color:var(--warn);font-weight:600}
${P} .fx-bad{color:var(--bad)}
${P} .fx-dn{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 14px 0}
${P} .fx-dn button{width:40px;height:40px;border-radius:13px;background:rgba(255,255,255,.85);box-shadow:0 4px 10px -6px rgba(15,30,51,.3),inset 0 0 0 1px rgba(15,30,51,.05);font-size:22px;line-height:1;display:grid;place-items:center;padding-bottom:3px}
${P} .fx-dn button[disabled]{opacity:.35}
${P} .fx-dn span{text-align:center}
${P} .fx-dn small{display:block;font-size:11.5px;font-weight:600;color:var(--sub)}
${P} .fx-dn b{font-family:var(--disp);font-size:16px;font-weight:700}
${P} .fx-pb{display:flex;gap:6px;margin:14px 16px 0}
${P} .fx-pb i{flex:1;height:6px;border-radius:3px;background:rgba(15,30,51,.10)}
${P} .fx-pb i.on{background:var(--dom)}
${P} .fx-cyc{display:flex;gap:5px;margin-top:14px}
${P} .fx-cyc span{flex:1;height:44px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--disp);font-size:14px;font-weight:700;color:var(--sub);background:rgba(255,255,255,.8);box-shadow:inset 0 0 0 1px rgba(15,30,51,.06);line-height:1}
${P} .sheet .fx-cyc span{background:var(--page)}
${P} .fx-cyc span small{font-family:var(--ff);font-size:10px;font-weight:500;color:var(--faint);margin-top:3px}
${P} .fx-cyc span.now{background:var(--dom);color:#fff;box-shadow:0 8px 14px -8px var(--dom)}
${P} .fx-cyc span.now small{color:rgba(255,255,255,.8)}
${P} .fx-kv{font-size:12.5px;color:var(--sub);text-align:right;white-space:nowrap;flex:0 0 auto}
${P} .fx-kv b{font-family:var(--disp);font-size:16px;font-weight:700;color:var(--ink)}
${P} .fx-kv small{display:block;font-size:11.5px}
${P} .fx-win{padding:14px 0;border-top:1px solid var(--hair)}
${P} .fx-win:first-child{border-top:0;padding-top:0}
${P} .fx-wh{display:flex;align-items:center;gap:10px;margin-bottom:10px}
${P} .fx-wh .si{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);flex:0 0 auto}
${P} .fx-wh .si svg.ic{width:28px;height:28px}
${P} .fx-wh .fh-in{flex:1;min-width:0}
${P} .fx-wv{font-size:13px;color:var(--sub);margin-top:10px}
${P} .fx-wv b{font-family:var(--disp);font-size:15px;color:var(--ink)}
${P} .fx-shh{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
${P} .fx-shh svg.ic{width:40px;height:40px;flex:0 0 auto;filter:drop-shadow(0 5px 6px rgba(15,30,51,.25))}
${P} .fx-shh > div{flex:1;min-width:0}
${P} .fx-shh h2{margin:0 0 2px;text-wrap:balance}
${P} .fx-shh p{font-size:13.5px;line-height:1.4;color:var(--sub)}
${P} .fx-tot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:14px;border-radius:16px;background:color-mix(in srgb,var(--dom) 10%,#fff)}
${P} .fx-tot span{font-weight:700;font-size:15px}
${P} .fx-tot span small{display:block;font-weight:500;font-size:12.5px;color:var(--sub)}
${P} .fx-tot b{font-family:var(--disp);font-size:26px;font-weight:800;letter-spacing:-.8px;white-space:nowrap}
${P} .fx-tot b small{font-family:var(--ff);font-size:12.5px;font-weight:500;color:var(--sub);margin-left:4px;letter-spacing:0}
${P} .fx-sum{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:6px 0 12px}
${P} .fx-sum .fh-big{font-size:28px;letter-spacing:-1px}
${P} .fx-sum > b{font-family:var(--disp);font-size:20px;font-weight:800;color:var(--dom)}
${P} .fx-mod{padding:14px 0;border-top:1px solid var(--hair)}
${P} .fx-mod:first-of-type{border-top:0;padding-top:4px}
${P} .fx-modh{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:4px}
${P} .fx-modh b{font-family:var(--disp);font-size:15px;font-weight:700}
${P} .sheet{max-height:86%;overflow-y:auto}
${P} .fh-chart{margin-top:12px}
${P} .fh-chart text{font-family:var(--ff);font-size:10.5px;font-weight:500;fill:var(--sub)}
${P} .fh-chart text.on{fill:var(--dom);font-weight:700}
${P} .fh-chart text.val{fill:var(--ink);font-weight:650}
${P} .fh-chart .grid{stroke:var(--hair);stroke-width:1}
${P} .fh-chart .col{fill:color-mix(in srgb,var(--dom) 34%,#fff)}
${P} .fh-chart .col.on{fill:var(--dom)}
${P} .fh-chart .col.up{fill:#fff;stroke:color-mix(in srgb,var(--dom) 60%,#fff);stroke-width:1.5}
${P} .fh-chart .tot{fill:var(--dom);opacity:.9}
${P} .fh-chart .gap{fill:rgba(255,255,255,.5);stroke:var(--faint);stroke-width:1.2;stroke-dasharray:3 3}
${P} .fh-chart .tgt{stroke:var(--ink);stroke-width:1.6;stroke-linecap:round;opacity:.55}
${P} .fh-chart .tr{fill:none;stroke:var(--dom);stroke-width:3.2;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 5px 5px color-mix(in srgb,var(--dom) 40%,transparent))}
${P} .fh-chart .raw{fill:var(--faint);opacity:.6}
${P} .fh-chart .end{fill:#fff;stroke:var(--dom);stroke-width:3}
${P} .fh-chart .hold{fill:#fff;stroke:var(--dom);stroke-width:1.8}
${P} .fh-chart .thin{fill:none;stroke:var(--faint);stroke-width:1.4;opacity:.8}
${P} .fh-chart .thin.dash{stroke-dasharray:4 4}
${P} .fh-chart .band{fill:color-mix(in srgb,var(--dom) 13%,transparent)}
`;

/* apró, újrarajzolás nélküli váltók: pipák, kapcsolók, választó-pirulák */
if(!window.__fuelVil){window.__fuelVil=true;document.addEventListener('click',e=>{
  if(!e.target.closest||!e.target.closest('.phone[data-v="feher"][data-d="fuel"]')) return;
  const t=e.target.closest('[data-ftk],[data-fsw]');
  if(t){e.preventDefault(); const on=t.classList.toggle('on'); if(t.hasAttribute('data-fsw')) t.setAttribute('aria-checked',String(on));
    F.toast(t.hasAttribute('data-fsw')?(on?'Bekapcsolva':'Kikapcsolva'):(on?'Bevéve · 14:10':'Visszavonva')); return}
  const p=e.target.closest('[data-fpick] .fh-pill'); if(p){p.parentNode.querySelectorAll('.fh-pill').forEach(b=>b.classList.toggle('on',b===p)); return}
  const m=e.target.closest('[data-fmulti] .fh-pill'); if(m) m.classList.toggle('on');
});}

register('fuel',{title:'Fuel',
  tabs:[['Mai','mai'],['Kiegészítők','stack'],['Trendek','trendek'],['Konyha','konyha']],
  routes:{mai,meal,score,log,konyha,kamra,receptek,recept,'recept-uj':editor,muhely,stack,protokoll,'stack-uj':stackUj,gyogyszer,trendek,beallitas,ablakok,tanulas},
  sheets,css,
  notes:`<h2>Fuel</h2>
<p>A Fuel minden oldala elkészült ebben a kinézetben. Mindegyik ugyanúgy olvasható: fent a cím, alatta egy zöld fő kártya egy mondattal és egy gombbal, aztán számozott szakaszok.</p>
<h2>Mit érdemes megnézni</h2>
<ul>
<li><b>Mai:</b> fent a mai kalória nagy számmal és egy mondat arról, mi van még hátra. Alatta: 1. mi következik (a két üres étkezés), 2. a mai számok színes csempéken (fehérje, szénhidrát, zsír, rost, víz, keret), 3. a mai étkezések, 4. a hét és a tanulás. Koppints egy étkezésre, a Víz vagy a Mai keret csempére, és a „Heti egyeztetés” sorra.</li>
<li><b>Étkezés logolása</b> (a nagy gomb): fent leírhatod, mit ettél; alatta a hat beviteli mód egy sorban (Fotó, Keresés, Gyors, Diktálás, Recept, Szokásosak). A Keresésnél alul megjelenik a Tányér. Az „Elemzés” után a tételek jönnek, alul a Logolás gombbal.</li>
<li><b>Kiegészítők:</b> fent a következő adag, alatta napszakonként a lista; a pipa koppintható. Lent a Protokoll, az Új elem (három lépés) és a Gyógyszer.</li>
<li><b>Trendek:</b> a heti kép oszlopokkal (egy oszlopra koppintva a nap részletei), a hét számai, majd a súlytrend: a vastag vonal a lényeg, a halvány pontok a napi mérések.</li>
<li><b>Konyha:</b> fent a Receptműhely, alatta a két gyors felvétel, majd a Receptek és a Kamra.</li>
</ul>
<h2>Mi változott a korábbihoz képest</h2>
<ul>
<li>A Mai oldalon a „Ma / Hét” váltó helyett a hét saját oldalt kapott („A hét képe” sor).</li>
<li>A „Miből jön össze?” a fő kártyáról és a Mai keret csempéről is nyílik.</li>
<li>A mentés gombok (Logolás, Mentés, Tovább) alul lebegnek, mindig ugyanott.</li>
<li>Az étkezésekhez és receptekhez tartozó jegyzetet Falat, a csapat ételes tagja mondja.</li>
</ul>
<p>A fotó, a kamera, a hang és a +/− gombok koppintásra csak visszajeleznek; a pipák, kapcsolók és választó-gombok átváltanak.</p>`
});
})();
