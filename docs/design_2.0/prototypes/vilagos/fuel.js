/* vilagos/fuel.js — Fuel domain, "Folyadék" identity (Mai · Kiegészítők · Trendek · Konyha + every inner page and sheet).
   Built on window.F (vilagos/README.md, last part). Every route has its own liquid graphic drawn from its own data;
   content floor = elo/fuel.html. Route names = elo/fuel.html. */
(function(){
const {I,page,sec,card,head,hero,btn,lk,step,row,bar,grid,seg,pills,st,note,txt,empty,msg,chev,esc,facts,register}=F;
const {bub,vials,mini,level,fill,area,linked}=F;
const P='.phone[data-v="feher"][data-d="fuel"]';
const fmt=n=>String(n).replace('.',',');
const kc=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
/* a kit stat() sávja önmagára hivatkozó --c-t kap (style="--c:var(--c)"), ettől minden sáv a terület színére esik vissza; itt levesszük, hogy a csempe színét örökölje */
const stat=o=>F.stat({...o,n:String(o.n).replace(/ /g,' ')}).replace('style="--c:var(--c)"','');
const pc=(v,t)=>Math.max(0,Math.min(100,Math.round(v/t*100)));
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
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
const hi=id=>bub(id,{s:64});
/* mrow: egy sor = buborék-ikon + név + érték + vízszintes szint */
const mrow=(l,v,pct,c,ic)=>`<div class="fh-mus fu-mr">${ic?bub(ic,{s:30,c}):''}<span class="l">${l}</span><span class="v">${v}</span>${level(pct,{c,h:12})}</div>`;
/* split: egy edény több folyadékkal (energia-megoszlás, összetétel) + jelmagyarázat */
const split=(a,{h=22}={})=>`<div class="fu-split" style="height:${h}px">${a.map(([,p,c])=>p>0?`<i style="flex:${p} 1 0;--c:${c}"></i>`:'').join('')}</div><div class="fu-leg">${a.map(([l,p,c,v])=>`<span style="--c:${c}"><i></i>${l}<b>${v??p+'%'}</b></span>`).join('')}</div>`;
const mk=(p,c,f)=>{const t=p*4+c*4+f*9||1;return [['Fehérje',Math.round(p*4/t*100),'var(--protein)'],['Szénhidrát',Math.round(c*4/t*100),'var(--carb)'],['Zsír',Math.round(f*9/t*100),'var(--fat)']]};
/* macroVials: a három makró kémcsőben — gramm a szám, az energia-arány a szint */
const macroVials=(p,c,f,o={})=>{const s=mk(p,c,f);return vials([['t-meat',p],['t-carb',c],['t-avocado',f]].map(([ic,g],i)=>({l:s[i][0],ic,c:s[i][2],p:Math.max(6,s[i][1]),v:fmt(g)+' g',s:s[i][1]+'% energia',on:{toast:`${s[i][0]}: ${fmt(g)} g · az energia ${s[i][1]}%-a`}})),{h:o.h||104})};
const lab=t=>`<span class="fh-lab">${t}</span>`;
const inp=(l,v,ph,type)=>`<input class="fh-in" ${type?`type="${type}"`:''} value="${esc(v||'')}" placeholder="${esc(ph||'')}" aria-label="${esc(l)}">`;
const fld=(l,v,ph,type)=>lab(l)+inp(l,v,ph,type);
const sel=(l,v)=>lab(l)+`<button class="fh-in fx-sel" data-toast="${esc(l)}"><span>${v}</span><i>▾</i></button>`;
const multi=(l,a)=>lab(l)+`<div class="fx-multi" style="grid-template-columns:repeat(${a.length>3?2:a.length},1fr)">${a.map(([v,ph])=>inp(ph||l,v,ph)).join('')}</div>`;
const stp=(v,u,t='Mennyiség')=>`<span class="fx-stp"><button data-toast="${esc(t)}: kevesebb" aria-label="Kevesebb">−</button><b>${v}</b><small>${u}</small><button data-toast="${esc(t)}: több" aria-label="Több">+</button></span>`;
/* pick: választó-pirulák, a koppintott lesz az aktív (helyben, újrarajzolás nélkül) */
const pick=(opts,on,pre='Szűrő')=>`<div class="fh-pills" data-fpick>${opts.map(o=>{const [l,n]=Array.isArray(o)?o:[o];return `<button class="fh-pill ${l===on?'on':''}" data-toast="${esc(pre+': '+l)}">${l}${n!=null?`<b>${n}</b>`:''}</button>`}).join('')}</div>`;
/* ipills: pirulák buborék-ikonnal (ikon sosem áll csupaszon) */
const ipills=a=>`<div class="fh-pills fu-ip">${a.map(([l,x,on,ic])=>`<button class="fh-pill ${on?'on':''}"${F.act(x)}>${ic?bub(ic,{s:26}):''}${l}</button>`).join('')}</div>`;
const sw=(on,label)=>`<button class="fx-sw ${on?'on':''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-fsw></button>`;
const tk=(on,label)=>`<button class="fx-tk ${on?'on':''}" data-ftk aria-label="${esc(label)}">${I('i-check')}</button>`;
/* irow: tétel-sor két sorban — fent név és érték, alatta a léptető / szint (320 px-en is elfér) */
const irow=(o)=>`<${o.on?'button':'div'} class="fh-row fx-it"${F.act(o.on)}>${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}<div class="fx-l2">${o.l2||''}</div></${o.on?'button':'div'}>`;
const srch=(t,val)=>`<div class="fx-srch" ${val?'':`data-toast="${esc(t)}"`}>${bub('t-basket',{s:28})}${val?`<span>${val}</span><i>×</i>`:t}</div>`;
const acts=h=>`<div class="fh-acts">${h}</div>`;
const closeLk=(l='Bezárom')=>`<button class="fh-lk" data-close>${l}</button>`;
const sh=(ic,t,sub)=>`<div class="fx-shh">${ic?bub(ic,{s:48}):''}<div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div></div>`;
const dn=(eb,title,prev,next)=>`<div class="fx-dn rise"><button ${prev?F.act(prev).trim():'disabled'} aria-label="Előző">‹</button><span><small>${eb}</small><b>${title}</b></span><button ${next?F.act(next).trim():'disabled'} aria-label="Következő">›</button></div>`;
const cmp=(ph,o={})=>`<div class="fx-cmp">${o.kamra?`<button data-sheet="kamrapick" aria-label="Kamra">${I('t-stack')}</button>`:''}<textarea aria-label="${esc(ph)}" placeholder="${esc(ph)}"></textarea><button data-toast="Diktálás" aria-label="Diktálás">${I('t-mic')}</button>${o.send?`<button class="go" data-go="${o.send}" aria-label="Küldés">${I('t-send')}</button>`:''}</div>`;
const smooth=pts=>pts.map((p,i)=>{if(!i)return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;const a=pts[i-2]||pts[i-1],b=pts[i-1],d=pts[i+1]||p;return `C${(b[0]+(p[0]-a[0])/6).toFixed(1)} ${(b[1]+(p[1]-a[1])/6).toFixed(1)} ${(p[0]-(d[0]-b[0])/6).toFixed(1)} ${(p[1]-(d[1]-b[1])/6).toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`}).join('');
const kv=a=>`<div class="fu-kv">${a.map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
const tip=(ic,t,s,c)=>`<div class="fu-tip">${bub(ic,{s:38,c:c||'var(--dom)'})}<span><b>${t}</b><small>${s}</small></span></div>`;
const lgd=a=>`<div class="fu-lg">${a.map(([cls,l])=>`<span><i class="${cls}"></i>${l}</span>`).join('')}</div>`;

/* ── saját folyadék-grafikák (a foly.js anyagából: fehér edény, halvány tus-körvonal, hullámos folyadék) ── */
const BOWL='M6 4 H194 C194 62 152 100 100 100 C48 100 6 62 6 4Z', BOWLVB='0 0 200 104';
const GLASS='M12 4 H88 L79 116 C78.4 122 74 126 68 126 H32 C26 126 21.6 122 21 116Z', GLASSVB='0 0 100 130';
const CUP='M6 6 H54 V32 C54 46 44 54 30 54 C16 54 6 46 6 32Z', CUPVB='0 0 60 58';
const POT='M14 26 H106 V62 C106 80 94 92 76 92 H44 C26 92 14 80 14 62Z', POTVB='0 0 120 96';
const JAR='M17 4 H43 V13 C51 17 54 23 54 31 V64 C54 71 50 76 43 76 H17 C10 76 6 71 6 64 V31 C6 23 9 17 17 13Z', JARVB='0 0 60 80';
const wv=(y,x0=-10,n=10,a=25,amp=4)=>`M${x0} ${y.toFixed(1)} q${a/2} ${-amp} ${a} 0 ${`t${a} 0 `.repeat(n)}`;
/* pour(előtte %, ez %, {ghost}) — a nap tálja: halványan, ami már benne volt, erősen, amit ez az étkezés tölt bele */
const pour=(a,b,{s=168,ghost=false}={})=>{const id=F.uid('fp'),Y=p=>4+96*(1-Math.max(0,Math.min(100,p))/100),ya=Y(a),yb=Y(a+b);
  return `<svg class="fl-fill fu-pour" viewBox="${BOWLVB}" style="width:${s}px" aria-hidden="true"><defs><clipPath id="${id}"><path d="${BOWL}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    <path d="${BOWL}" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="3"/><g clip-path="url(#${id})">
    <path d="${wv(ya)}V110 H-10Z" fill="color-mix(in srgb,var(--liq2) 42%,#fff)"/>
    ${b>0?(ghost?`<path d="${wv(yb)}V${ya.toFixed(1)} H-10Z" fill="color-mix(in srgb,var(--liq1) 22%,#fff)" stroke="var(--liq2)" stroke-width="1.5" stroke-dasharray="4 4"/>`:`<path d="${wv(yb)}V${(ya+3).toFixed(1)} H-10Z" fill="url(#${id}g)"/>`):''}
    </g>
    <path d="${BOWL}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`};
/* dial: valódi óra-számlap (12 órás) — az ajánlott ablak íve + a logolás / a mostani idő pontja */
const dial=(s,at,sz=40)=>{const ang=t=>(toMin(t)%720)/720*2*Math.PI-Math.PI/2,Pt=(t,r)=>[22+r*Math.cos(ang(t)),22+r*Math.sin(ang(t))],[x1,y1]=Pt(s.from,15.5),[x2,y2]=Pt(s.to,15.5),d=at?Pt(at,15.5):null,inw=at&&toMin(at)>=toMin(s.from)&&toMin(at)<=toMin(s.to);
  return `<svg class="fu-dial" viewBox="0 0 44 44" style="width:${sz}px;height:${sz}px" aria-hidden="true"><circle cx="22" cy="22" r="20.5" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="1.5"/>${[0,1,2,3].map(q=>`<path d="M22 6.5V9" transform="rotate(${q*90} 22 22)" stroke="var(--faint)" stroke-width="1.5" stroke-linecap="round"/>`).join('')}
    <path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A15.5 15.5 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--dom)" stroke-width="4.5" stroke-linecap="round"/>${d?`<circle cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="3.4" fill="${inw?'#fff':'var(--warn)'}" stroke="${inw?'var(--liq2)':'#fff'}" stroke-width="1.8"/>`:''}<circle cx="22" cy="22" r="1.8" fill="var(--ink)"/></svg>`};
/* tide: a nap mint árapály 06–24 óra között — minden étkezés egy edény az idővonalon, a szintje a kalória-része */
const tide=(pts,{stop=null,now=null,sel=-1}={})=>{const id=F.uid('ft'),X=h=>18+(h-6)/18*284,mx=Math.max(...pts.map(p=>p.v||1));
  return `<svg class="fh-chart fu-tide" viewBox="0 0 320 146" role="img" aria-label="A nap étkezései idővonalon"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    <path d="${wv(104,0,13,25,5)}V118 H0Z" fill="color-mix(in srgb,var(--liq1) 26%,#fff)"/><path d="${wv(109,-12,13,25,4)}V118 H-12Z" fill="color-mix(in srgb,var(--liq2) 20%,#fff)"/>
    ${stop!=null?`<path d="M${X(stop)} 8V112" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 4"/><text x="${X(stop)}" y="143" text-anchor="middle" class="w">${String(Math.floor(stop)).padStart(2,'0')}:${String(Math.round(stop%1*60)).padStart(2,'0')} koffein-stop</text>`:''}
    ${now!=null?`<path d="M${X(now)} 20V112" stroke="var(--ink)" stroke-width="1.5" opacity=".5"/><circle cx="${X(now)}" cy="18" r="3" fill="var(--ink)"/>`:''}
    ${pts.map((p,i)=>{const x=X(p.h),hh=p.v?Math.max(10,p.v/mx*66):40,top=106-hh;return `<g ${p.on?`data-sheet="${p.on[0]}" data-arg="${p.on[1]}" style="cursor:pointer"`:''}><clipPath id="${id}c${i}"><rect x="${x-15}" y="30" width="30" height="80" rx="15"/></clipPath><rect x="${x-15}" y="30" width="30" height="80" rx="15" fill="#fff" stroke="${i===sel?'var(--liq2)':'rgba(10,42,60,.12)'}" stroke-width="${i===sel?2.5:1.5}"/>
      <g clip-path="url(#${id}c${i})"><path d="${wv(top,x-20,3,10,2.5)}V112 H${x-20}Z" fill="url(#${id})" opacity="${sel>=0&&i!==sel?.45:1}"/></g>
      <text x="${x}" y="22" text-anchor="middle" class="val">${p.top||''}</text><text x="${x}" y="128" text-anchor="middle" class="${i===sel?'on':'nm'}">${p.l}</text></g>`}).join('')}
    <text x="4" y="143">06</text><text x="316" y="143" text-anchor="end">24</text></svg>`};
/* weekVes: a hét hét edénye, mindegyiken a saját keret-vízvonala */
const weekVes=()=>{const mx=2900;return `<div class="fu-wk" role="group" aria-label="A hét hét napja a keretéhez mérve">${WEEK.map(([d,k,t,s,tr],i)=>`<button class="fu-wd ${k==null?'gap':''} ${i===2?'on':''}" data-sheet="day" data-arg="${i}" aria-label="${DAYN[i]}: ${k==null?'nincs naplózva':k+' / '+t+' kcal'}"><em>${s||'·'}</em><span class="fu-tb">${k?`<i style="height:${(Math.min(k,t)/mx*100).toFixed(1)}%"></i>${k>t+60?`<s style="bottom:${(t/mx*100).toFixed(1)}%;height:${((k-t)/mx*100).toFixed(1)}%"></s>`:''}`:''}<u style="bottom:${(t/mx*100).toFixed(1)}%"></u></span><b>${d}</b>${tr?'<small>edzés</small>':'<small>&nbsp;</small>'}</button>`).join('')}</div>`};
/* caps: a nap adagjai kapszulákban, napszakonként — a tele kapszula bevéve */
const caps=()=>{let nx=false;return `<div class="fu-caps" role="img" aria-label="A mai adagok napszakonként">${STACK.map(b=>`<span class="g"><span class="r">${b.items.map(x=>{const n=!x[3]&&!nx;if(n)nx=true;return `<i class="${x[3]?'on':''} ${n?'nx':''}"></i>`}).join('')}</span><small>${b.band}</small></span>`).join('')}</div>`};
/* cyc: a gyógyszer heti ciklusa hét szintben — csúcs, stabil, völgy */
const PHS={C:['csúcs',96],S:['stabil',62],V:['völgy',30]};
const cyc=now=>`<div class="fu-cyc" role="img" aria-label="A heti ciklus fázisai">${[...'CCSSSVV'].map((g,i)=>`<span class="${i===now?'now':''}"><span class="t"><i style="height:${PHS[g][1]}%"></i></span><b>${PHS[g][0]}</b><small>${i+1}. nap</small></span>`).join('')}</div>`;
/* slotCup: egy étkezési ablak kis edénye — a szint a logolt kcal az ablak saját keretéhez mérve */
const slotCup=(k,b)=>`<span class="fu-cup ${k>b?'over':''}" role="img" aria-label="${k?'Logolva: '+k+' / '+b+' kcal':'keret '+b+' kcal'}">${fill(BOWL,{vb:BOWLVB,p:k?Math.max(10,Math.min(96,k/b*94)):0,s:46,inner:k?'':`<path d="M30 40H170" stroke="var(--liq2)" stroke-width="5" stroke-dasharray="10 9" opacity=".6"/>`})}<span><b>${kc(k||b)}</b><small>${k?'/ '+b:'keret'}</small></span></span>`;
const lS=(a,s)=>`<span class="fu-w">${a}</span><span class="fu-s">${s}</span>`;
const GL=['Alacsony','Közepes','Magas'];
const gluPath=g=>g?'M1 10 C6 10 7 2 12 2 S18 10 23 10':'M1 9 C7 9 8 5 12 5 S17 9 23 9';
const gband=g=>`<div class="fu-gb" role="img" aria-label="Vércukor-válasz sávja: ${GL[g].toLowerCase()}">${GL.map((l,i)=>`<span class="${i===g?'on':''} b${i}">${l}</span>`).join('')}</div>`;

/* ═══ MAI ════════════════════════════════════════════════════ */
let SKIP={}, WAT=1300, WSEL=250;
const MCATS=[['t-hunger','Nem vagyok éhes',0],['t-clock','Nincs időm',0],['t-digestion','Gyomorrontás',1],['t-ill','Beteg vagyok',1],['t-travel','Úton vagyok',1],['t-other','Egyéb',0]];
const skK=()=>Object.keys(SKIP).reduce((a,i)=>a+SLOTS[i].b,0);
/* bowlHero: a nap tálja — balra amit ettél, jobbra ami még belefér, középen a tál a keretig töltve */
const bowlHero=(o,i=0)=>`<section class="fh-card fh-hero fu-bh rise" style="--i:${i}"><span class="lbl">${o.lbl}</span>
    <div class="fm-g"><div class="fm-n"><b>${kc(o.eaten)}</b><small>kcal-t ettél</small></div>
      <button class="fu-bowl" ${o.on?F.act(o.on).trim():''} aria-label="${kc(o.eaten)} / ${kc(o.target)} kcal">${fill(BOWL,{vb:BOWLVB,p:o.eaten?Math.max(7,Math.min(100,o.eaten/o.target*94)):0,s:152})}<small>keret ${kc(o.target)} kcal</small></button>
      <div class="fm-n r"><b>${kc(Math.abs(o.rem))}</b><small>${o.remLbl||(o.rem<0?'a keret felett':'még belefér')}</small></div></div>
    <p class="verdict">${o.verdict}</p>${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}
    ${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`;
function mai(arg){
  if(arg==='tegnap'||arg==='ures') return pastDay(arg==='ures');
  if(arg==='het') return het();
  if(arg==='kihagyva') SKIP={2:{c:0}};
  const G=arg==='kimelo';
  const sk=G?0:skK(), rem=DAY.target-DAY.eaten-sk, skN=Object.keys(SKIP).map(i=>SLOTS[i].l);
  const state=s=>{const n=toMin(DAY.now),lo=toMin(s.from),hi=toMin(s.to);return n<lo?(lo-n<=90?`nyílik ${lo-n} perc múlva`:`nyílik ${s.from}-kor`):n<=hi?`most nyitva · még ${hi-n} perc`:'még pótolható'};
  const MAC=[['Fehérje','t-meat','var(--protein)',DAY.p,'g'],['Szénhidrát','t-carb','var(--carb)',DAY.c,'g'],['Zsír','t-avocado','var(--fat)',DAY.f,'g'],['Rost','t-fiber','var(--fiber)',DAY.fib,'g'],['Víz','t-water','var(--water)',[WAT/1000,2.5],'l']];
  const mealRow=(id,m)=>`<div class="fm-meal"><button class="fm-mn" data-go="meal.${id}"><strong>${m.name}</strong><small>${m.time} · ${kc(m.kcal)} kcal</small></button>
      <div class="fm-mb"><span class="fm-cells" role="img" aria-label="Makrók: ${m.macro[0]} g fehérje, ${m.macro[1]} g szénhidrát, ${m.macro[2]} g zsír, ${m.fib} g rost">${[['feh.','var(--protein)',m.macro[0],45],['szénh.','var(--carb)',m.macro[1],90],['zsír','var(--fat)',m.macro[2],25],['rost','var(--fiber)',m.fib,10]].map(([l,c,v,t])=>mini({p:Math.max(6,v/t*100),c,v:v+' g',l})).join('')}</span>
        <span class="fm-chips"><button class="fm-chip ${m.glu?'mid':''}" data-sheet="glu" data-arg="${m.glu}|${id}" aria-label="Vércukor-válasz: ${GL[m.glu].toLowerCase()}"><svg viewBox="0 0 24 12" aria-hidden="true"><path d="${gluPath(m.glu)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${GL[m.glu]}</button>
        <button class="fm-chip sc" data-go="score.${id}" aria-label="Mezo-értékelés: ${fmt(m.score)}">${bub('t-score',{s:24})}${fmt(m.score)}</button></span></div></div>`;
  const blocks=SLOTS.map((s,i)=>{const rows=Object.entries(MEALS).filter(([,m])=>m.w===i), k=rows.reduce((a,[,m])=>a+m.kcal,0), skp=!G&&!rows.length&&SKIP[i], c=skp&&skp.c!=null?MCATS[skp.c]:null;
    return `<section class="fh-card fm-blk ${rows.length?'':'open'} rise" style="--i:${i+2}"><div class="fm-bh">${bub(s.ic,{s:44})}<span class="g"><strong>${s.l}</strong><small>${s.from}–${s.to}</small></span>
        <button class="fm-clock" data-sheet="ora" data-arg="${i}" aria-label="${s.l} · étkezési óra">${dial(s,rows.length?rows[0][1].time:DAY.now)}</button>
        ${G?(rows.length?`<span class="fu-cup"><span><b>${kc(k)}</b><small>kcal</small></span></span>`:''):skp?st('kihagyva','q'):slotCup(rows.length?k:0,s.b)}</div>
      ${rows.length?rows.map(([id,m])=>mealRow(id,m)).join('')
      :skp?`<div class="fm-meal">${tip(c?c[0]:'t-skip',`Kihagyva · ${c?c[1].toLowerCase():'ok nélkül'}`,`${s.b} kcal kiesett a napból. A többi étkezésed nem lett nagyobb, és ez nem számít mulasztásnak.`,'var(--faint)')}
        <div class="fh-acts">${btn(c?'Másik ok':'Okot adok',{sheet:'mealwhy',arg:i},'sm ghost')}<button class="fh-lk" data-fundo="${i}">Visszavonom</button>${lk('Mégis ettem','log.w'+i)}</div></div>`
      :G?`<p class="fm-when">Ha megy, egyél. Nincs mihez mérni.</p><div class="fh-acts">${btn('+ Logolás ide','log.w'+i,'sm')}</div>`
      :`<p class="fm-when">Ajánlott <b>${s.from}–${s.to}</b> · ${state(s)}</p>
        <div class="fh-acts">${btn('+ Logolás ide','log.w'+i,'sm')}<button class="fh-lk" data-fskip="${i}">${state(s)==='még pótolható'?'Kihagytam':'Kihagyom'}</button></div>`}</section>`}).join('');
  const out=Object.entries(MEALS).filter(([,m])=>m.w===-1);
  const top=G?`
  ${hero({warn:true,lbl:'Kímélő mód · gyomorrontás · 2. nap',verdict:'Ma nincs kalóriacél.',sub:`Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük. Ma eddig ${kc(DAY.eaten)} kcal; nem mérjük semmihez.`,
    left:`<button class="fu-gl" data-sheet="water" aria-label="Víz logolása">${fill(GLASS,{vb:GLASSVB,p:pc(WAT,2500)*.9,s:74,c:'color-mix(in srgb,var(--water) 55%,#fff)',c2:'var(--water)'})}<small>${fmt(WAT/1000)} / 2,5 l</small></button>`,
    acts:btn('+ Víz',{sheet:'water'})+lk('Mikor fordulj orvoshoz?',{sheet:'orvos'})})}
  ${sec(1,'Most ez segít',1)}
  ${card(tip('t-water','Kis kortyokban, gyakran','Víz, gyenge tea, húsleves. Ha hánytál, várj egy kicsit, és kortyonként kezdd újra.','var(--water)')
    +tip('t-kettle','Egyél, amikor megkívánod','Nem kell erőltetni. Ha megjön az étvágyad, kezdd kis adaggal.')
    +tip('t-skip','Ezeket most hagyd ki','Zsíros és csípős étel, gyümölcslé, szénsavas üdítő.','var(--warn)')
    +lab('Ezek könnyebben mennek le')+`<div class="fh-chips fu-chips">${['Banán','Főtt rizs','Pirítós','Főtt krumpli','Sós keksz','Húsleves','Almapüré'].map(n=>`<span>${n}</span>`).join('')}</div>`
    +note('Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen. A kímélő módot a Nap oldalon zárod le. Ez nem orvosi tanács.'),{i:1})}`
  :`
  ${bowlHero({lbl:'Ma eddig',eaten:DAY.eaten,target:DAY.target,rem,on:{sheet:'eq'},verdict:`Egy rendes vacsora még belefér, ${DAY.p[1]-DAY.p[0]} g fehérje hiányzik.`,
    body:sk?`<button class="fu-skl" data-sheet="eq">${bub('t-skip',{s:26,c:'var(--faint)'})}<span><b>${skN.join(', ')} kihagyva</b> · ${kc(sk)} kcal kiesett a napból</span></button>`:'',
    acts:btn('Étkezés logolása','log')+lk('Miből jön össze?',{sheet:'eq'})})}
  ${sec(1,'Mai makrók',1)}
  ${card(vials(MAC.map(([l,ic,c,[v,t],u])=>({l:l==='Szénhidrát'?lS(l,'Szénh.'):l,ic,c,p:Math.max(5,v/t*100),v:fmt(v),s:`/ ${fmt(t)} ${u}`,on:l==='Víz'?{sheet:'water'}:{toast:`${l}: ${fmt(v)} / ${fmt(t)} ${u}`}})),{h:118}),{cls:'fu-mac',i:1})}`;
  return page('fuel',{title:'Fuel',sub:'Szerda, október 7.',tab:'mai'},`${top}
  ${sec(2,`A mai blokkjaid · ${Object.keys(MEALS).length} étkezés${skN.length&&!G?` · ${skN.length} kihagyva`:''}`,2)}
  ${blocks}
  ${out.length?card(`<div class="fm-bh">${bub('t-snack',{s:44})}<span class="g"><strong>Ablakon kívül</strong><small>két étkezés között</small></span><span class="fu-cup"><span><b>${kc(out.reduce((a,[,m])=>a+m.kcal,0))}</b><small>kcal</small></span></span></div>`+out.map(([id,m])=>mealRow(id,m)).join(''),{cls:'fm-blk',i:6}):''}
  ${sec(3,'Logolj bármit',7)}
  ${card(ipills(RIB.map(([k,l,ic])=>[l,'log.'+k,false,ic]))+note('Ablakon kívül is logolhatsz. Az idő alapból a mostani, de átírhatod.')+acts(lk('Az étkezési óra',{sheet:'ora',arg:1})),{i:7})}
  ${sec(4,'A hét és a tanulás',8)}
  ${card(row({icon:'t-calendar',title:'A hét képe',sub:'a hét napjai a keretükhöz mérve',on:'mai.het'})
    +row({icon:'t-compare',title:'Heti egyeztetés',sub:'vasárnap · 3 lépés, kb. 2 perc',right:st('1 javaslat vár','warn')+chev(),on:{sheet:'weekly'}})
    +row({icon:'t-brain',title:'Ez a nap számít a tanulásban',sub:'jövő hétfőn számolom bele · Mit jelent ez?',on:'tanulas'})
    +row({icon:'t-history',title:'Tegnap · 2 ablak pótolható',sub:'kedd, október 6.',on:'mai.tegnap'})
    +row({icon:'t-gear',title:'Fuel beállítások',sub:'ritmus · makrók · célok · ablakok',on:'beallitas'})
    +acts(btn('Ma hiányos volt a naplóm',{toast:'Hiányosnak jelölve · kihagyom a tanulásból'},'sm ghost')),{i:8})}
  ${sec(5,'Prototípus · állapotváltó',9)}
  ${card(seg([['Rendes nap','mai',!G],['Kímélő mód','mai.kimelo',G]])+note('Csak a prototípusban. Kímélő módban (betegség, gyomorrontás) a Fuel nem kér számon semmit: cél helyett tanácsot ad.'),{i:9})}`);
}
function het(){
  return page('fuel',{title:'A hét képe',sub:'Fuel · ez a hét',back:'mai'},`
  ${hero({lbl:'Ez a hét · hét edény',verdict:'A hét négy napján a keret körül maradtál.',sub:'Két nap még hátravan. A szaggatott vonal a nap kerete, a szám a nap pontja.',body:weekVes()+lgd([['liq','amit ettél'],['line','a nap kerete'],['over','a keret fölött'],['gap','nincs naplózva']]),
    acts:btn('Trendek megnyitása','trendek')+lk('Vissza a mai napra','mai')})}
  ${sec(1,'A hét napjai',1)}
  ${card(WEEK.map(([d,k,t,s,tr],i)=>row({left:`<span class="fx-dd ${i===2?'on':''}">${d}</span>`,title:k==null?'Nincs naplózva':`${kc(k)} / ${kc(t)} kcal`,sub:k==null?'nem töltöm ki becsléssel':`a nap pontja ${s}${tr?' · edzésnap':''}`,right:(k==null?'':`<span class="fu-rl">${level(pc(k,t),{h:10,c:k>t+60?'var(--warn)':'var(--dom)'})}</span>`)+chev(),on:{sheet:'day',arg:i}})).join('')
    +note('Koppints egy napra: a nap számai és étkezései lapon nyílnak.'),{i:1})}`);
}
function pastDay(emp){
  const rows=emp?[]:[['Kávé és vajas kifli','09:20',330,'6,1',1],['Gulyásleves','13:10',690,'7,4',0]];
  const free=SLOTS.map((s,i)=>[s,i]).filter(([,i])=>!rows[i]);
  return page('fuel',{title:emp?'Hétfő, október 5.':'Kedd, október 6.',sub:emp?'Fuel · 2 nappal ezelőtt':'Fuel · tegnap',back:'mai'},`
  ${dn(emp?'2 nappal ezelőtt':'Tegnap',emp?'hétfő, október 5.':'kedd, október 6.',emp?null:'mai.ures',emp?'mai.tegnap':'mai')}
  ${emp?bowlHero({lbl:'Ezen a napon · üres tál',eaten:0,target:3100,rem:3100,remLbl:'a nap kerete',verdict:'Erre a napra nincs adat.',sub:'Amit most logolsz, erre a napra könyvelődik. A heti átlagból kimarad, nem töltöm ki becsléssel.',acts:btn('Reggeli pótlása','log.w0')},1)
    :bowlHero({lbl:'Ezen a napon',eaten:1020,target:3100,rem:2080,remLbl:'fért még bele',verdict:'Két étkezés van felírva, két ablak üres maradt.',sub:'Még pótolhatod: amit most logolsz, erre a napra könyvelődik.',acts:btn('Uzsonna pótlása','log.w2')+lk('Miből jött össze?',{sheet:'eq'})},1)}
  ${sec(1,'Még pótolható',2)}
  ${card(free.map(([s,i])=>step({time:s.from,icon:s.ic,title:`${s.l} · ${s.b} kcal`,sub:`${s.from}–${s.to} · még pótolható`,on:'log.w'+i})).join(''),{i:2})}
  ${emp?'':`${sec(2,'A nap számai',3)}
  ${card(vials([['Fehérje','t-meat','var(--protein)',70,220,'g'],['Szénhidrát','t-carb','var(--carb)',120,380,'g'],['Zsír','t-avocado','var(--fat)',40,95,'g'],['Rost','t-fiber','var(--fiber)',9,30,'g'],['Víz','t-water','var(--water)',2.1,2.5,'l']].map(([l,ic,c,v,t,u])=>({l:l==='Szénhidrát'?lS(l,'Szénh.'):l,ic,c,p:v/t*100,v:fmt(v),s:`/ ${fmt(t)} ${u}`,on:{toast:`${l}: ${fmt(v)} / ${fmt(t)} ${u}`}})),{h:104}),{cls:'fu-mac',i:3})}
  ${sec(3,'Ezen a napon · 2 étkezés',4)}
  ${card(rows.map((r,i)=>step({time:r[1],icon:SLOTS[i].ic,title:r[0],sub:`${SLOTS[i].l} · ${r[2]} / ${SLOTS[i].b} kcal · ${r[3]} pont · vércukor: ${GL[r[4]].toLowerCase()}`,on:{toast:r[0]+' · az étkezés részletei'}})).join(''),{i:4})}
  ${sec(4,'Ez a nap a tanulásban',5)}
  ${card(tip('t-shield','Ez a nap hiányosnak tűnt, kihagytam','1 020 kcal jóval a szokásos evésed alatt van. Ha mégis teljes volt, mondd, és azonnal újraszámolok.','var(--warn)')
    +acts(btn('Teljes volt',{toast:'Teljesnek jelölve · a keret +20 kcal-lal változott'},'sm ghost')+lk('Mit jelent ez?','tanulas')),{i:5})}`}`);
}

/* gHero: hős saját grafikával — címke → grafika → ítélet-mondat → gomb */
function gHero(o,i=0){return `<section class="fh-card fh-hero ${o.warn?'warn':''} ${o.cls||''} rise" style="--i:${i}"><span class="lbl">${o.lbl||''}</span>${o.g||''}<p class="verdict">${o.verdict}</p>${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`}
/* numG: grafika balra, nagy szám és két-három tény jobbra */
const numG=(g,n,unit,lines='')=>`<div class="fu-ng"><span class="gg">${g}</span><div class="nn"><span class="fh-big">${n}${unit?`<small>${unit}</small>`:''}</span>${lines}</div></div>`;
const pk=(a,b)=>`<p class="fu-pk"><span><i class="a"></i>${a}</span><span><i class="b"></i>${b}</span></p>`;

/* ═══ ÉTKEZÉS · ÉRTÉKELÉS ═════════════════════════════════════ */
const DS=['Makró','Mikro','WHO','Zsír','Feldolg.','Növény','Sűrűség','Időzítés'];
function meal(id){
  const m=MEALS[id]||MEALS.reggeli; id=MEALS[id]?id:'reggeli'; const [p,c,f]=m.macro, s=mk(p,c,f);
  const before=Object.values(MEALS).filter(x=>x.time<m.time).reduce((a,x)=>a+x.kcal,0);
  return page('fuel',{title:m.w===-1?'Tízórai':m.slot,sub:`Fuel · ${m.time}${m.w===-1?' · ablakon kívül':''}`,back:'mai'},`
  ${gHero({lbl:m.name,g:numG(pour(before/DAY.target*94,m.kcal/DAY.target*94),kc(m.kcal),'kcal',`<p>a napod <b>${pc(m.kcal,DAY.target)}%-a</b> a ${kc(DAY.target)} kcal-os keretből · ${m.time}-kor logoltad</p>`+pk(before?`előtte ${kc(before)} kcal`:'előtte üres volt a tál','ez az étkezés')),
    verdict:m.headline+'.',sub:m.lead,
    acts:btn(`Mezo-értékelés ${fmt(m.score)}`,'score.'+id)+lk(`Vércukor · ${GL[m.glu].toLowerCase()}`,{sheet:'glu',arg:m.glu+'|'+id})},1)}
  ${sec(1,'Hatás a napra',2)}
  ${card(vials([['Fehérje','t-meat','var(--protein)',p,DAY.p[1]],['Szénhidrát','t-carb','var(--carb)',c,DAY.c[1]],['Zsír','t-avocado','var(--fat)',f,DAY.f[1]],['Rost','t-fiber','var(--fiber)',m.fib,DAY.fib[1]]].map(([l,ic,col,v,t])=>({l:l==='Szénhidrát'?lS(l,'Szénh.'):l,ic,c:col,p:Math.max(5,v/t*100),v:v+' g',s:`/ ${t} g · ${pc(v,t)}%`,on:{toast:`${l}: ${v} g a napi ${t} g-ból`}})),{h:104})
    +note('A kémcső a napi célod; a szint az, amennyit ez az egy étkezés töltött bele.'),{cls:'fu-mac',i:2})}
  ${sec(2,'Makrók · miből jön az energia',3)}
  ${card(split(s.map(([l,pp,col],i)=>[l,pp,col,`${[p,c,f][i]} g · ${pp}%`]))+note(`${kc(p*4)} kcal fehérjéből, ${kc(c*4)} szénhidrátból, ${kc(f*9)} zsírból.`),{i:3})}
  ${sec(3,`Hozzávalók · ${m.ings.length} tétel`,4)}
  ${card(m.ings.map(([n,ic,kid,src,k,amt])=>irow({icon:ic,title:n,sub:`${amt} · ${src}${src==='kamra'?' · alapanyag':''}`,v:`${k}<small>kcal</small>`,l2:`<span class="fu-sh">${level(k/m.kcal*100,{h:8})}</span><small class="fu-shn">${Math.round(k/m.kcal*100)}%</small>`,on:kid?'kamra.'+kid:{toast:n+' · becsült sor, nincs kamra-tétel'}})).join('')
    +note('A sáv azt mutatja, az étkezés kalóriájának mekkora részét adja a tétel.'),{i:4})}
  ${sec(4,'Minőség',5)}
  ${card(m.quality.map(([l,ic,v])=>row({icon:ic,title:l,v})).join('')
    +row({icon:'t-bolt',title:'Energiasűrűség',sub:'laktató, mérsékelt',v:'1,3<small>kcal/g</small>'})
    +row({icon:'t-glucose',title:'Vércukor-válasz',sub:'sávot mutatok, nem számot',right:st(GL[m.glu].toLowerCase(),m.glu?'warn':'ok')+chev(),on:{sheet:'glu',arg:m.glu+'|'+id}}),{i:5})}
  ${sec(5,'Jegyzet',6)}
  ${card(msg('falat',m.note,'étel · miért így?')+acts(btn('Javítom ezt az étkezést',{toast:'Szerkesztés · a naplózó nyílik ezzel az étkezéssel'},'sm ghost')+lk('Mentsük receptként','muhely.vazlat')),{i:6})}`);
}
function score(id){
  const m=MEALS[id]||MEALS.reggeli; id=MEALS[id]?id:'reggeli'; const low=m.dims.indexOf(Math.min(...m.dims)), hi=m.dims.indexOf(Math.max(...m.dims));
  const vv=a=>vials(a.map(i=>({l:DS[i],ic:DIMS[i][1],c:i===low?'var(--warn)':'var(--dom)',p:m.dims[i]*10,v:fmt(m.dims[i]),s:i===low?'leggyengébb':i===hi?'legerősebb':`súly ${DIMS[i][2]}%`,on:{sheet:'dim',arg:id+'|'+i}})),{h:92});
  return page('fuel',{title:'Mezo-értékelés',sub:`${m.name}`,back:'meal.'+id},`
  ${gHero({lbl:`${m.w===-1?'Tízórai':m.slot} · ${m.time}`,g:`<div class="fu-sc"><span class="fh-big">${fmt(m.score)}<small>/ 10</small></span><span class="c">${level(m.cert,{h:14,label:`bizonyosság ${m.cert}%`})}</span></div><div class="fu-8">${vv([0,1,2,3])}${vv([4,5,6,7])}</div>`,
    verdict:m.headline+'.',sub:m.lead,
    acts:btn('Mi emelné még?',{toast:'Lent, a 2. szakaszban: egy marék tökmag'},'sm')+lk('Vissza az étkezéshez','meal.'+id)},1)}
  ${sec(1,'Miből áll össze? · 8 szempont',2)}
  ${card(DIMS.map(([l,ic,w,t],i)=>irow({icon:ic,title:l,sub:t,v:fmt(m.dims[i]),l2:`<span class="fu-sh">${level(m.dims[i]*10,{h:8,c:i===low?'var(--warn)':'var(--dom)'})}</span><small class="fu-shn">súly ${w}%${i===low?' · leggyengébb':''}</small>`,on:{sheet:'dim',arg:id+'|'+i}})).join('')
    +note('A pontszám a nyolc szempont súlyozott átlaga. Koppints egy sorra a részletekért.'),{i:2})}
  ${sec(2,'Mi emelné még?',3)}
  ${card(msg('falat',`A ${DIMS[low][0].toLowerCase()} a leggyengébb láncszem (${fmt(m.dims[low])}): egy marék tökmag vasat és magnéziumot hozna, és ${fmt(Math.min(9.9,m.score+.2).toFixed(1))} fölé tolná az értékelést.`,'étel · javaslat'),{i:3})}`);
}

/* ═══ LOGOLÁS ═══════════════════════════════════════════════════ */
function log(arg){
  arg=arg||'foto'; const fail=arg==='hiba';
  const win=/^w[0-3]$/.test(arg)?SLOTS[+arg[1]]:null; const mode=win||fail?'foto':arg;
  const lines=arg==='tetelek'||arg==='ido';
  const ctx=win?`${win.l} · ${win.from}–${win.to} · ablak`:'Most · 14:10 · Ebéd-ablak után';
  const top={title:win?'Logolás ide':'Étkezés logolása',sub:ctx,back:'mai'};
  const dayP=DAY.eaten/DAY.target*94, mm=(a)=>`<span class="fm-cells">${[['feh.','var(--protein)',a[0],45],['szénh.','var(--carb)',a[1],90],['zsír','var(--fat)',a[2],25]].map(([l,c,v,t])=>mini({p:Math.max(6,v/t*100),c,v:v+' g',l})).join('')}</span>`;
  if(lines) return page('fuel',top,`
  ${gHero({lbl:'Ez az étkezés · 3 tétel a tálban',g:numG(pour(dayP,420/DAY.target*94),'420','kcal',mm([23,52,12])),verdict:'Zabkása joghurttal és gyümölccsel',
    sub:`Mai nap eddig ${kc(DAY.eaten)} + 420 = ${kc(DAY.eaten+420)} kcal · a ${kc(DAY.target)}-ból marad ${kc(DAY.target-DAY.eaten-420)}.`,body:pk(`ma eddig ${kc(DAY.eaten)} kcal`,'ez az étkezés')},1)}
  ${sec(1,'Tételek · 3',2)}
  ${card([['Zabpehely','t-carb','kamra',60,'g',223,'8 · 36 · 4'],['Görög joghurt','t-meat','kamra',150,'g',146,'14 · 6 · 8'],['Erdei gyümölcs','t-fiber','becslés',80,'g',51,'1 · 10 · 0']].map(([n,ic,t,a,u,k,m])=>irow({icon:ic,title:n,sub:`${t} · ${m} g (feh. · szénh. · zsír)`,v:`${k}<small>kcal</small>`,l2:(t==='becslés'?st('nézd át','warn'):'<span></span>')+stp(a,u,n)})).join('')
    +`<p class="fh-note fx-warn">Az Erdei gyümölcs sorban nem vagyok teljesen biztos: nézd át a mennyiséget.</p>`
    +acts(lk('+ Még egy tétel','log.kereses')+lk('Eltávolítok egy tételt',{toast:'Koppints a tétel × gombjára'})),{i:2})}
  ${sec(2,'Mikor ettél?',3)}
  ${card(row({icon:'t-clock',title:'Most · 14:10',sub:`Ebéd-ablak után · ${arg==='ido'?'tényleges':'aktuális'} idő`,right:st(arg==='ido'?'Bezárom':'Átállítom','q')+chev(),on:'log.'+(arg==='ido'?'tetelek':'ido')})
    +(arg==='ido'?`${lab('Időpont')}<div class="fx-time"><input class="fh-in" type="time" value="14:10" aria-label="Evés időpontja">${btn('Most','log.tetelek','sm ghost')}</div>${note('Az étkezés a megadott idő szerinti ablakba kerül. A mai napra jövőbeli időpontot nem lehet menteni.')}`:''),{i:3})}`,
  {foot:btn('Mégse','mai','ghost')+btn('Logolás',{toast:'Mentve · 14:10 · ablakon kívül'})});
  let body='';
  if(mode==='szokasos') body=lab('Ilyenkor szoktál · 14:10 körül')
    +[['Whey + banán + mandulavaj','edzés után · 22× logoltad',356],['Túró · áfonya · méz quick','délután · 14× logoltad',324],['Görög joghurt · dióval','délután · 6× logoltad',290]].map(([n,s,k])=>row({icon:'t-plate',title:n,sub:s,v:`${k}<small>kcal</small>`,on:'log.tetelek'})).join('')
    +note('Amihez ilyenkor a leggyakrabban nyúlsz. Az idő szerint ajánlom, nem a hét napja szerint. Egy koppintás, aztán jóváhagyod.');
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
  else if(mode==='diktalas') body=`<div class="fx-listen">${bub('t-mic',{s:48})}<div><strong>Hallgatlak…</strong><p>„Egy csirkés wrap és egy latte volt.”</p></div></div>`
    +acts(btn('Elemzés','log.tetelek','sm')+lk('Mégse','log'));
  else if(mode==='recept') body=lab('Receptjeid')
    +REC.slice(0,4).map(r=>row({icon:CAT[r.cat][1],title:r.n,sub:`${CAT[r.cat][0]} · ${Math.round(r.kcal/r.serv)} kcal / adag${r.star?' · csillagos':''}`,on:'log.tetelek'})).join('')
    +acts(lk('Választó lapon',{sheet:'receptpick'}));
  else body=`<button class="fx-ph" data-toast="Kamera · fotózd le a tányért">${bub('t-camera',{s:52})}<strong>Fotózd le a tányért</strong><small>vagy írd le fent, mit ettél</small></button>`;
  const plate=mode==='kereses'?`<span class="fx-pl">${bub('t-plate',{s:38})}<span><strong>Tányér · 2 tétel · 369 kcal</strong><small>23 g fehérje · 42 g szénhidrát · 12 g zsír</small></span></span>${btn('Tovább','log.tetelek','sm')}`:'';
  const inPlate=mode==='kereses'?369:0;
  return page('fuel',top,`
  ${fail?hero({warn:true,lbl:'Őszintén szólva',verdict:'Ezt a tányért nem ismertem fel.',sub:'Írd le lent, mit ettél, vagy próbáld meg új fotóval.',acts:btn('Új fotót készítek','log','sm')},1):''}
  ${gHero({lbl:win?'Logolás ebbe az ablakba':'Egy piszkozat',
    g:numG(pour(dayP,(inPlate||(win?win.b:420))/DAY.target*94,{ghost:!inPlate}),inPlate?String(inPlate):kc(DAY.target-DAY.eaten),inPlate?'kcal a tányéron':'kcal fér még bele',pk(`ma eddig ${kc(DAY.eaten)} kcal`,inPlate?'a tányérod · 2 tétel':win?`${win.l.toLowerCase()} · ${win.b} kcal keret`:'ide kerül, amit most logolsz')),
    verdict:win?`Mit ettél: ${win.l.toLowerCase()}?`:'Mit ettél?',sub:'Szöveg, hang és fotó egy piszkozatba kerül. Elemzés után a felismert tételeket még átírhatod.',
    body:cmp('pl. csirkés wrap és egy latte…'),acts:btn('Elemzés','log.tetelek')},1)}
  ${sec(1,'Hat mód, egy koppintásra',2)}
  ${card(ipills(RIB.map(([k,l,ic])=>[l,'log.'+k,k===mode,ic]))+`<div class="fx-mode">${body}</div>`,{i:2})}
  ${sec(2,'Mikor ettél?',3)}
  ${card(row({icon:'t-clock',title:win?`${win.l} · ${win.from}–${win.to}`:'Most · 14:10',sub:'Alapból a mostani időt írom. Mentés előtt átállíthatod; a tétel abba az ablakba kerül, amelyikbe az idő esik.'}),{i:3})}`,
  plate?{foot:plate}:{});
}

/* ═══ KONYHA ═══════════════════════════════════════════════════ */
const POTIN=`<path d="M4 40H14M106 40H116" stroke="rgba(10,42,60,.22)" stroke-width="7" stroke-linecap="round"/><path d="M26 15H94" stroke="rgba(10,42,60,.22)" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="7" r="5" fill="rgba(10,42,60,.22)"/>`;
/* potG: a fazék — amennyire tele van, annyi a recept kész része (0 = üres, szaggatott vízvonallal) */
const potG=(p,s=92)=>fill(POT,{vb:POTVB,p:p?4+p*.66:0,s,inner:POTIN+(p?'':`<path d="M22 58H98" stroke="var(--liq2)" stroke-width="2" stroke-dasharray="4 5" opacity=".6"/>`)});
const m3=(p,c,f)=>{const mx=Math.max(p,c,f)||1;return `<span class="fu-m3">${[['feh.',p,'var(--protein)'],['szénh.',c,'var(--carb)'],['zsír',f,'var(--fat)']].map(([l,g,col])=>`<span>${level(g/mx*100,{c:col,h:8})}<small><b>${fmt(g)}</b> g ${l}</small></span>`).join('')}</span>`};
function konyha(){
  const food=KAM.filter(k=>k.k==='food').length; const fav=REC.slice().sort((a,b)=>b.logged-a.logged)[0];
  return page('fuel',{title:'Konyha',sub:`Fuel · ${REC.length} recept · ${KAM.length} tétel`,tab:'konyha'},`
  ${hero({lbl:'Receptműhely · üres fazék',verdict:'Főzzünk ki valamit.',sub:'Te mondod a célt, én a hozzávalót. A számokat a kamrád adja.',left:`<span class="fu-pot">${potG(0,96)}</span>`,
    body:`<div class="fx-goals">${ipills([['Magas fehérje','muhely.vazlat',false,'t-meat'],['Edzés előtt','muhely.vazlat',false,'t-bolt'],['Edzés után','muhely.vazlat',false,'t-dumbbell'],['Lefekvés előtt','muhely.vazlat',false,'t-moon'],['Reggeli','muhely.vazlat',false,'t-sun']])}</div>`,
    acts:btn('Műhely megnyitása','muhely')},1)}
  ${sec(1,'Gyors felvétel',2)}
  ${card(`<div class="fh-pair fu-pair"><button data-go="recept-uj">${bub('t-book',{s:46})}Recept mentése<small>kézzel, a saját szavaiddal</small></button><button data-sheet="import">${bub('t-camera',{s:46})}Új elem a kamrába<small>fotó a címkéről vagy egy termék linkje</small></button></div>`,{i:2})}
  ${sec(2,'Receptek',3)}
  ${card(row({icon:'t-book',title:`${REC.length} recept`,sub:`kedvenced most: ${fav.n} · ${fav.logged}× etted`,on:'receptek'})
    +`<div class="fu-bubs">${REC.map(r=>`<button data-go="recept.${r.id}" aria-label="${esc(r.n)}">${bub(CAT[r.cat][1],{s:42})}</button>`).join('')}</div>`,{i:3})}
  ${sec(3,'Kamra',4)}
  ${card(row({icon:'t-stack',title:`${KAM.length} tétel a polcon`,sub:'ebből főzünk, ebből számolunk',on:'kamra'})
    +split([['Étel',food,'var(--dom)',food+' tétel'],['Kiegészítő',KAM.length-food,'var(--water)',(KAM.length-food)+' tétel']],{h:18}),{i:4})}`);
}
function kamra(arg){
  if(arg&&arg!=='ures') return kamraItem(arg);
  const emp=arg==='ures'; const n=k=>KAM.filter(x=>x.k===k).length;
  const jars=z=>vials([['Étel','t-carb','food'],['Supp','t-supps','supp'],['Stim','t-bolt','stim'],['Gyógyszer','t-syringe','med']].map(([l,ic,k])=>({l,ic,p:z?0:n(k)/KAM.length*100,v:z?'0':String(n(k)),s:'tétel',on:{toast:'Szűrő: '+l}})),{h:84});
  const tools=btn('+ Új tétel',{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk('Közös katalógus',{sheet:'catalog'});
  if(emp) return page('fuel',{title:'Kamra',sub:'Konyha · üres polc',back:'konyha'},`
  ${gHero({lbl:'A polcod · négy üres üveg',g:jars(1),verdict:'A kamra üres.',sub:'Vedd fel az első tételt, vagy válassz a közös katalógusból; itt jelenik meg a polcodon.',
    acts:btn('Első tétel felvétele',{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk('Közös katalógus',{sheet:'catalog'})},1)}
  ${sec(1,'A polcon',2)}
  ${card(empty('',bub('t-basket',{s:52})+'<br>Még nincs tétel. Fotó a címkéről, egy termék linkje vagy kézi felvétel: mind ide kerül.'),{i:2})}`);
  return page('fuel',{title:'Kamra',sub:`Konyha · ${KAM.length} tétel`,back:'konyha'},`
  ${gHero({lbl:'A polcod · fajtánként',g:jars(0),verdict:`${KAM.length} tétel van a polcodon: ${n('food')} étel és ${KAM.length-n('food')} kiegészítő.`,acts:tools},1)}
  ${sec(1,'Keresés és szűrés',2)}
  ${card(srch('Keress tételt, márkát…')+`<div style="margin-top:10px">${pick([['Mind',KAM.length],['Étel',n('food')],['Supp',n('supp')],['Stim',n('stim')],['Gyógyszer',0]],'Mind')}</div>`+acts(lk('Szűrők · kategória szerint',{sheet:'catfilter'})),{i:2})}
  ${sec(2,'A polcon',3)}
  ${card(grid(KAM.map(k=>k.k==='food'?stat({k:k.n,icon:kic(k),n:k.kcal,unit:'kcal / 100 g',pct:Math.max(6,k.p/40*100),c:'var(--protein)',s:`${fmt(k.p)} g fehérje · ${k.b} · ${SRC[k.src][1]}`,on:'kamra.'+k.id})
      :stat({k:k.n,icon:kic(k),n:k.dose,unit:'adag',s:`${KIND[k.k][1]} · ${k.b} · ${SRC[k.src][1]}`,c:'var(--water)',on:'kamra.'+k.id})))
    +note('Az ételeknél a csempe szintje a fehérje-sűrűség: minél feljebb ér, annál több a fehérje 100 grammban.'),{cls:'fu-shelf',i:3})}
  ${sec(3,'Okosabb csere',4)}
  ${card(row({icon:'t-swap',title:'Görög joghurt 10% · 500 g',sub:'1 790 Ft · esti kazein, +2 recepthez illik a stackedben',on:{toast:'Csere-javaslat · a termék oldala'}}),{i:4})}`);
}
function kamraItem(id){
  const k=KAM.find(x=>x.id===id)||KAM[0]; const kind=KIND[k.k][1],ic=kic(k); const food=k.k==='food';
  const edit=lk('Szerkesztés',{sheet:'add',arg:'edit'})+lk('Törlés',{toast:'Biztos? Még egy érintés a törléshez'});
  const recs=k.recs.length?card(k.recs.map(r=>{const R=REC.find(x=>x.id===r);return row({icon:'t-plate',title:R.n,sub:`${CAT[R.cat][0]} · ${R.logged}× etted`,on:'recept.'+r})}).join(''),{i:5}):'';
  const rest=food?Math.max(0,Math.round((100-k.p-k.c-k.f)*10)/10):0;
  const src=card(row({icon:'t-stack',title:'A polcodon',sub:k.b})
    +row({icon:SRC[k.src][0],title:`Így került a polcra: ${SRC[k.src][1]}`,sub:`${k.sl}${k.when?' · '+k.when:' · az időpont nincs rögzítve'}`})
    +(k.price?row({icon:'t-coin',title:'Ár',v:k.price}):''),{i:4});
  return page('fuel',{title:k.n,sub:`Kamra · ${k.cat} · ${kind}`,back:'kamra'},`
  ${nh({lbl:k.b,n:food?k.kcal:k.dose,unit:food?'kcal / 100 g':'egy adag',art:ic,verdict:food?`${fmt(k.p)} g fehérje van 100 grammjában.`:k.id==='kreatin'?'Ébredés után szeded, a stackben van.':'Nincs időzítve; a Kiegészítők oldalon pipálod.',
    body:food?lab('Mi van 100 grammban?')+split([['Fehérje',k.p,'var(--protein)',fmt(k.p)+' g'],['Szénhidrát',k.c,'var(--carb)',fmt(k.c)+' g'],['Zsír',k.f,'var(--fat)',fmt(k.f)+' g'],['Víz és egyéb',rest,'color-mix(in srgb,var(--water) 30%,#fff)',fmt(rest)+' g']],{h:30}):'',
    acts:(food?btn('Logolás a mai napra','log.kereses'):btn('Kiegészítők megnyitása','stack'))+edit},1)}
  ${food?`${sec(1,'Makrók · miből jön az energia',2)}${card(macroVials(k.p,k.c,k.f),{cls:'fu-mac',i:2})}
  ${sec(2,'Minőség · 100 g',3)}
  ${card(row({icon:'t-sugar',title:'Cukor',v:`${k.sug}<small>g</small>`})+row({icon:'t-salt',title:'Só',v:`${k.salt}<small>g</small>`})+row({icon:'t-fat',title:'Telített zsír',v:`${k.sat}<small>g</small>`})+row({icon:'t-processing',title:'Feldolgozottság',sub:'NOVA-besorolás',right:st(k.nova,'ok')}),{i:3})}`
  :`${sec(1,'A napodban',2)}
  ${card(row({icon:'t-clock',title:k.id==='kreatin'?'5 g · ébredés után':'Nincs időzítve',sub:k.id==='kreatin'?'a stackben · Ébredés 07:00':'A Kiegészítők oldalon pipálod; ott látod a protokollt is',on:'stack'}),{i:2})}`}
  ${sec(food?3:2,'Forrás',4)}${src}
  ${recs?sec(food?4:3,'Receptekben',5)+recs:''}`);
}
function receptek(){
  const top=REC.slice().sort((a,b)=>b.logged-a.logged), fav=top[0];
  return page('fuel',{title:'Receptek',sub:`Konyha · ${REC.length} recept`,back:'konyha'},`
  ${gHero({lbl:'Receptkönyv · amit a legtöbbször ettél',g:`<div class="fu-top">${top.slice(0,4).map(r=>`<button data-go="recept.${r.id}"><span><b>${r.n}</b><em>${r.logged}×</em></span>${level(r.logged/fav.logged*100,{h:14})}</button>`).join('')}</div>`,
    verdict:`${REC.length} recepted van, a kedvencedet ${fav.logged} alkalommal etted.`,sub:`${fav.n} · legutóbb ${fav.last}.`,acts:btn('+ Új recept','recept-uj')+lk('Kifőzöm a Műhelyben','muhely')},1)}
  ${sec(1,'Szűrés',2)}
  ${card(pick([['Mind',REC.length],['Reggeli',2],['Ebéd',1],['Vacsi',1],['Snack',2],['Csillagos',3]],'Mind'),{i:2})}
  ${sec(2,'Receptjeid',3)}
  ${card(REC.map(r=>irow({icon:CAT[r.cat][1],title:r.n,sub:`${CAT[r.cat][0]} · ${r.min} perc${r.role?' · '+r.role:''}${r.serv>1?' · '+r.serv+' adag':''}`,v:`${Math.round(r.kcal/r.serv)}<small>kcal</small>`,
      l2:m3(Math.round(r.p/r.serv),Math.round(r.c/r.serv),Math.round(r.f/r.serv))+`<span class="fu-tags">${r.star?st('csillagos','plan'):''}${r.score?st(fmt(r.score)+' pont','ok'):st('értékelés folyamatban','q')}</span>`,on:'recept.'+r.id})).join('')
    +note('A szám egy adag kalóriája; a három sáv az adag fehérje-, szénhidrát- és zsírtartalma.'),{i:3})}`);
}
function recept(arg){
  const [id,mode]=(arg||'r1').split('.'); const r=REC.find(x=>x.id===id)||REC[0]; const all=mode==='egesz'; const d=all?1:r.serv; const v=k=>Math.round(r[k]/d);
  const ings=r.id==='r1'?MEALS.reggeli.ings:r.id==='r4'?MEALS.tizorai.ings:MEALS.ebed.ings; const tot=ings.reduce((a,x)=>a+x[4],0);
  const s=mk(v('p'),v('c'),v('f'));
  return page('fuel',{title:r.n,sub:`${CAT[r.cat][0]}-recept · ${r.min} perc${r.role?' · '+r.role:''}`,back:'receptek'},`
  ${gHero({lbl:all?`Egész recept · ${r.serv} adag`:r.serv>1?`Egy adag a fazékból · ${r.serv} adagos`:'Egy adag · a teljes fazék',
    g:numG(`<span class="fu-pot">${potG(all?100:100/r.serv,104)}</span>`,kc(v('kcal')),all?'kcal · egész recept':'kcal / adag',`<p>${r.serv} adag · ${r.min} perc alatt kész · NOVA ${r.nova}</p><p>létrehozva ${r.date}${r.role?' · '+r.role:''}</p>`),
    verdict:`${r.logged}× etted, legutóbb ${r.last}.`,
    sub:r.score?`Pontszám ${fmt(r.score)} · ${r.fits}`:`Értékelés folyamatban · ${r.fits}`,
    body:r.serv>1?`<div style="margin-top:12px">${seg([['1 adag','recept.'+r.id,!all],[`Egész · ${r.serv} adag`,'recept.'+r.id+'.egesz',all]])}</div>`:'',
    acts:btn('Ma ettem ilyet','log.tetelek')+(r.score?lk(`Pontszám ${fmt(r.score)} ›`,{toast:'A recept értékelése · 9 szempont · megbízhatóság 92%'}):'')},1)}
  ${sec(1,'Makrók',2)}
  ${card(macroVials(v('p'),v('c'),v('f'))+`<div style="margin-top:14px">${split(s.map(([l,pp,col],i)=>[l,pp,col,pp+'%']),{h:14})}</div>`,{cls:'fu-mac',i:2})}
  ${sec(2,`Hozzávalók · ${ings.length} tétel`,3)}
  ${card(ings.map(([n,ic,kid,src,k,amt])=>irow({icon:ic,title:n,sub:`${amt} · ${src} · alapanyag`,v:`${Math.round(k/d)}<small>kcal</small>`,l2:`<span class="fu-sh">${level(k/tot*100,{h:8})}</span><small class="fu-shn">${Math.round(k/tot*100)}%</small>`,on:kid?'kamra.'+kid:{toast:n+' · becsült sor'}})).join(''),{i:3})}
  ${sec(3,'Minőség · mikrotápanyagok',4)}
  ${card(row({icon:'t-processing',title:'Alapanyag-arány',v:'100<small>%</small>'})+row({icon:'t-sprout',title:'Növényféle',v:'3<small>db</small>'})
    +kv([['Rost','7 g'],['Cukor','19 g'],['Só','0,6 g'],['Tel. zsír','nincs adat']])
    +row({icon:'t-score',title:'Pontszám',sub:'9 szempont · megbízhatóság 92%',v:r.score?fmt(r.score):'—',on:{toast:'A recept értékelése · 9 szempont · megbízhatóság 92%'}}),{i:4})}
  ${sec(4,'Jegyzet',5)}
  ${card(msg('falat','Lassú szénhidrát és sok fehérje; edzés előtt 2–3 órával ideális, a túró kazeinje sokáig kitart.','étel · miért így?')+note(r.fits),{i:5})}
  ${sec(5,'Tovább',6)}
  ${card(row({icon:'t-plate',title:'Logolás · ma ettem ilyet',sub:'a mostani időre, 1 adag',on:'log.tetelek'})
    +row({icon:'t-chef',title:'Iterálás a Műhelyben',sub:'a recept mint kiindulás',on:'muhely.vazlat'})
    +row({icon:'t-journal',title:`Logok · ${r.logged}`,sub:r.last.startsWith('ma')?'ma is a naplódban':'ma még nincs logolva',on:{sheet:'reclogs',arg:r.id}})
    +acts(btn('Szerkesztés','recept-uj','sm ghost')+lk(r.star?'Csillag le':'Csillag',{toast:'Csillag átállítva'})+lk('Törlés',{toast:'Biztos? Még egy érintés a törléshez'})),{i:6})}`);
}
function editor(arg){
  const all=arg==='x', q=all?2:1;
  return page('fuel',{title:'Új recept',sub:'Konyha · receptkönyv',back:'receptek'},`
  ${gHero({lbl:all?'Makró-összeg · egész recept':'Makró-összeg · egy adag',g:numG(`<span class="fu-pot">${potG(all?100:50,96)}</span>`,kc(529*q),all?'kcal · egész recept':'kcal / adag',m3(53*q,54*q,11*q)),
    verdict:all?'Két adag van a fazékban.':'A fazék fele egy adag.',sub:all?'Egy adag = 529 kcal · P 53 · C 54 · F 11.':'Egész recept = 1 058 kcal · P 106 · C 108 · F 22.',
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
  const goals=ipills([['Magas fehérje','muhely.vazlat',!!arg,'t-meat'],['Edzés előtt','muhely.vazlat',false,'t-bolt'],['Edzés után','muhely.vazlat',false,'t-dumbbell'],['Lefekvés előtt','muhely.vazlat',false,'t-moon'],['Reggeli','muhely.vazlat',false,'t-sun']]);
  if(!arg) return page('fuel',{title:'Receptműhely',sub:'Konyha · közös főzés',back:'konyha'},`
  ${gHero({lbl:'Receptműhely · üres fazék',g:`<div class="fu-potc">${potG(0,150)}</div>`,verdict:'Mit főzzünk ki?',sub:'Válassz egy célt, vagy írd le a saját szavaiddal. Én hozzávalót és mennyiséget javaslok; a számokat mindig a kamrád adja.',
    body:`<div class="fx-goals">${goals}</div>${cmp('Mit főzzünk? Mondd el szabadon…',{kamra:true})}`,acts:btn('Küldés','muhely.vazlat')},1)}
  ${sec(1,'Így dolgozunk',2)}
  ${card(msg('falat','Minden kör javításként érkezik, a kézi szerkesztéseid megmaradnak.','étel · műhely'),{i:2})}`);
  const all=arg==='vazlat-egesz';
  return page('fuel',{title:'Csirkés bulgur',sub:'Receptműhely · vázlat · Magas fehérje',back:'konyha'},`
  ${gHero({lbl:'Vázlat · a fazék kétharmada kész',g:numG(`<span class="fu-pot">${potG(66,104)}</span>`,all?'1 224':'612',all?'kcal · egész · 2 adag':'kcal / adag · 2 adag',`<p>3 sorból <b>2-nek van tápértéke</b>; a harmadik helye még üres a fazékban.</p>`),
    verdict:'Egy sorhoz még nincs tápérték, addig nem menthető.',sub:'Cseréld kamra-tételre vagy töröld a sort; a számokból kimarad, nem találgatjuk.',
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

/* bandG: egy érték egy sávban — vízszintes edény, benne a megengedett / bizonytalan sáv folyadéka, rajta az érték cseppje */
const bandG=({lo,hi,a,b,v,vl,tick,tl,al='',bl='',label=''})=>{const id=F.uid('fb'),X=x=>12+(x-lo)/(hi-lo)*296;
  return `<svg class="fh-chart fu-band" viewBox="0 0 320 90" role="img" aria-label="${label}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    <rect x="12" y="34" width="296" height="26" rx="13" fill="#fff" stroke="rgba(10,42,60,.12)" stroke-width="1.5"/><rect x="${X(a).toFixed(1)}" y="34" width="${(X(b)-X(a)).toFixed(1)}" height="26" rx="13" fill="url(#${id})" opacity=".5"/>
    ${tick!=null?`<path d="M${X(tick).toFixed(1)} 28V66" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/><text x="${X(tick).toFixed(1)}" y="82" text-anchor="middle">${tl}</text>`:''}
    <text x="${X(a).toFixed(1)}" y="27" text-anchor="middle">${al}</text><text x="${X(b).toFixed(1)}" y="27" text-anchor="middle">${bl}</text>
    ${v!=null?`<circle cx="${X(v).toFixed(1)}" cy="47" r="10" fill="#fff" stroke="var(--liq2)" stroke-width="4.5"/><text x="${X(v).toFixed(1)}" y="15" text-anchor="middle" class="big">${vl}</text>`:''}</svg>`};

/* ═══ KIEGÉSZÍTŐK ═══════════════════════════════════════════════ */
function stack(){
  const all=STACK.flatMap(b=>b.items), taken=all.filter(x=>x[3]).length, nx=all.find(x=>!x[3]);
  return page('fuel',{title:'Kiegészítők',sub:`Fuel · ma · ${taken} / ${all.length} bevéve`,tab:'stack'},`
  ${gHero({lbl:`Mit veszek be ma? · ${taken} / ${all.length} bevéve`,g:caps(),verdict:`Következik: ${nx[0]}.`,sub:`${nx[1]} · ${nx[2]} · zsíros étkezéssel szívódik fel a legjobban.`,
    acts:btn('Bevettem',{toast:`Bevéve · ${nx[0]} · 14:10`})+lk('Miért így?',{sheet:'item',arg:nx[0]})},1)}
  ${STACK.map((b,i)=>{const d=b.items.filter(x=>x[3]).length;return sec(i+1,`${b.band} · ${d} / ${b.items.length}`,i+2)+card(b.items.map(x=>`<div class="fh-row">${tk(!!x[3],x[3]?'visszavonom':'bevettem')}<button class="g fx-g" data-sheet="item" data-arg="${esc(x[0])}"><span><strong>${x[0]}</strong><small>${x[1]} · ${x[2]}${x[3]?' · bevéve '+x[4]:''}</small></span>${chev()}</button></div>`).join(''),{i:i+2})}).join('')}
  ${sec(5,'Protokoll és beállítás',6)}
  ${card(row({icon:'t-protocol',title:'Protokoll · 8 elem',sub:'mit miért szedsz, és ki tette a helyére',on:'protokoll'})
    +row({icon:'t-gear',title:'Új elem beállítása',sub:'megmondom, mennyit vegyél be belőle, mikor és miért',on:'stack-uj.1'})
    +row({icon:'t-syringe',title:'Gyógyszer',sub:'a követett gyógyszered és a ciklusa',on:'gyogyszer'})
    +note('Ha félrement valami, a pipát bármikor visszavonhatod. Tájékoztatás, nem orvosi tanács.'),{i:6})}`);
}
function protokoll(){
  const Z=[['Ébredés','t-dawn','07:00',[['Kreatin-monohidrát','5 g','Reggel, üres gyomorra is jól szívódik; a napi összmennyiség a lényeg.','auto'],['Kávé · espresso','80–100 mg','Ébredés után 60–90 perccel a legjobb, a koffein-stop 14:00.','auto'],['Tasty Dose gombakávé','8 g','A reggeli kávé mellé, fókuszhoz.','kézi']]],
    ['Reggeli','t-sun','08:00',[['Impact Whey Protein','30–40 g','Pihenőnapon a reggelihez kerül.','auto']]],
    ['Ebéd','t-bowl','12:30',[['D3 + K2','4000 IU + 100 µg','Zsíros étkezéssel szívódik fel a legjobban.','auto'],['Omega-3','2 g EPA+DHA','Az ebéd a nap legzsírosabb pontja.','auto']]],
    ['Edzés előtt','t-dumbbell','16:30',[['Origin PWO','20 g','Edzés előtt 20–30 perccel; pihenőnapon kimarad.','auto']]],
    ['Este','t-moon','21:00',[['Magnézium-glicinát','300 mg','Este nyugtat, segíti az elalvást.','auto']]]];
  return page('fuel',{title:'Protokoll',sub:'Kiegészítők · v3 · 86% bizalom',back:'stack'},`
  ${gHero({lbl:'A napi rended · öt idősáv',g:vials(Z.map(([z,ic,t,items])=>({l:z==='Edzés előtt'?'Edzés e.':z,ic,p:items.length/3*74,v:String(items.length),s:'elem',mark:t,on:{toast:`${z} · ${t} · ${items.length} elem`}})),{h:96})+facts([['8','elem'],['5','idősáv'],['1','kézzel elhelyezve']]),
    verdict:'Egy elemet kézzel tettél a helyére, a többit én időzítettem.',sub:'Koppints egy elemre: ott állítod a zónát és a dózist.',acts:btn('Új elem beállítása','stack-uj.1')},1)}
  ${sec(1,'Idősávok',2)}
  ${Z.map(([z,ic,t,items],i)=>card(head(ic,`${z} · ${t} · ${items.length}`)+items.map(([n,d,why,m])=>row({icon:'t-supps',title:n,sub:`${d} · ${why}`,right:st(m==='kézi'?'kézi':'auto',m==='kézi'?'plan':'q')+chev(),on:{sheet:'stackitem',arg:m+'|'+n}})).join(''),{i:i+2})).join('')}
  ${sec(2,'Étkezéshez · 2',7)}
  ${card(lab('Étkezés-egyeztetés · makró és mikro')+row({icon:'t-bowl',title:'Ebéd · 12:30',sub:'Csirke + édesburgonya + spenót · zsír 11 g · a D3 + K2 mellé elég',on:'recept.r2'})
    +row({icon:'t-tick',title:'Reggeli · tegnap',sub:'fehérje 49 g · a whey-jel együtt rendben'})
    +note('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.'),{i:7})}`);
}
function stackUj(s){
  s=Math.min(3,Math.max(1,+s||1)); const names=['Termék','Adatok','Javaslat'];
  const top={title:'Új elem beállítása',sub:`Kiegészítők · ${s} / 3 · ${names[s-1]}`,back:s===1?'stack':'stack-uj.'+(s-1)};
  const pb=`<div class="fx-pb rise">${[1,2,3].map(n=>`<span class="${n<s?'done':n===s?'on':''}"><i></i><small>${n}. ${names[n-1]}</small></span>`).join('')}</div>`;
  if(s===1) return page('fuel',top,`${pb}
  ${hero({lbl:'1. lépés · termék',verdict:'Melyik terméket állítsuk be?',sub:'A címkéjéről kiolvasom, mennyi van benne, és megmondom, ez mennyi az ajánlott napi mennyiségből.',left:hi('t-supps'),body:`<div style="margin-top:12px">${srch('Név vagy márka…')}</div>`},1)}
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
  ${gHero({lbl:'Cink-biszglicinát · javaslat',g:bandG({lo:0,hi:30,a:10,b:15,v:15,vl:'15 mg · az ajánlott 10–15 mg sáv szélén',tick:25,tl:'25 mg fölött figyelj',label:'Az adag az ajánlott 10–15 mg-os sáv felső szélén van'}),
    verdict:'Napi 1 kapszula: ez az ajánlott 10–15 mg-os sávban van.',sub:'Vacsorával szívódik fel a legjobban, és nem versenyez a reggeli vassal. A doboz kb. 90 napra elég.'},1)}
  ${sec(1,'Finomítás',2)}
  ${card(lab('Napi mennyiség')+stp(1,'kapszula','Napi mennyiség')+lab('Mikor')+pick(['Ébredés','Reggeli','Edzés előtt','Edzés után','Ebéd','Vacsora','Este','Lefekvés'],'Vacsora','Mikor')
    +`<p class="fh-note fx-warn">Amire figyelj: hosszan 25 mg fölött a réz felszívódását ronthatja.</p>`
    +note('Tájékoztatás, nem orvosi tanács. Gyógyszer vagy krónikus betegség mellett kérdezd meg a kezelőorvosod.'),{i:2})}`,
  {foot:btn('Vissza','stack-uj.2','ghost')+btn('Felveszem · Vacsora','protokoll')});
}
function gyogyszer(arg){
  if(arg!=='aktiv') return page('fuel',{title:'Gyógyszer',sub:'Kiegészítők · követés',back:'stack'},`
  ${gHero({lbl:'Követett gyógyszer · üres ciklus',g:`<div class="fu-off">${cyc(-1)}</div>`,verdict:'Nincs követett gyógyszer.',sub:'Ha szedsz valamit ciklusban, ide kerül a fázis-térkép (csúcs, stabil, völgy) és a beadás-napló.',
    acts:btn('Gyógyszer felvétele',{sheet:'medform'})+lk('Minta: ha van követett gyógyszer','gyogyszer.aktiv')},1)}
  ${card(note('Tájékoztatás, nem orvosi tanács.'),{i:2})}`);
  return page('fuel',{title:'Retatrutid',sub:'Gyógyszer · subQ injekció · heti · hétfő',back:'stack'},`
  ${gHero({lbl:'Kinetikus ciklus · 3. nap a 7-ből',g:`<div class="fu-sc"><span class="fh-big">6<small>mg · hetente</small></span></div>${cyc(2)}`,verdict:'Stabil fázisban vagy, az utolsó beadás 2 napja volt.',sub:'A szint a hatóanyag becsült jelenléte a beadás napjától számolva: 2 nap csúcs, 3 nap stabil, 2 nap völgy.',
    acts:btn('+ Beadás',{sheet:'dose'})+lk('Váltás: nincs gyógyszer','gyogyszer')},1)}
  ${sec(1,'Beadások · 3',2)}
  ${card([['hétfő, okt. 5.','„Hétfő reggel · subQ has”'],['hétfő, szept. 28.',''],['hétfő, szept. 21.','']].map(([d,n])=>row({icon:'t-syringe',title:d,sub:n,v:'6<small>mg</small>'})).join('')
    +acts(btn('Szerkesztés',{sheet:'medform'},'sm ghost')+lk('Leállítás',{toast:'Leállítom? Még egy érintés'}))+note('Tájékoztatás, nem orvosi tanács.'),{i:2})}`);
}

/* ═══ TRENDEK · ábrák ═══════════════════════════════════════════ */
function waterfallSvg(){
  const steps=[['aug.',-0.4],['',-0.3],['',-0.5],['szept.',+0.2],['',-0.6],['',-0.4],['okt.',-0.7]]; const start=84.0,goal=78.0;
  const W=336,H=140,bw=26,x=i=>14+i*37,Y=v=>18+(84.3-v)/(84.3-goal+0.3)*100;
  let cur=start,out=`<text x="14" y="11" class="val">${fmt(start.toFixed(1))} kg</text><path d="M10 ${Y(goal).toFixed(1)}H326" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" opacity=".45"/>`;
  steps.forEach(([l,d],i)=>{const a=cur,b=cur+d;cur=b;const top=Math.min(a,b),bot=Math.max(a,b);
    out+=`<rect class="col ${d>0?'up':''}" x="${x(i)}" y="${Y(bot).toFixed(1)}" width="${bw}" height="${Math.max(10,(Y(top)-Y(bot))).toFixed(1)}" rx="5"/><text x="${x(i)+bw/2}" y="${(Y(bot)+Math.max(10,Y(top)-Y(bot))+11).toFixed(1)}" text-anchor="middle">${d>0?'+':'−'}${fmt(Math.abs(d).toFixed(1))}</text>${l?`<text x="${x(i)+bw/2}" y="${H-3}" text-anchor="middle">${l}</text>`:''}`;
    if(i<steps.length-1) out+=`<line class="grid" x1="${x(i)+bw}" x2="${x(i+1)}" y1="${Y(b).toFixed(1)}" y2="${Y(b).toFixed(1)}"/>`});
  out+=`<rect class="tot" x="${x(7)}" y="${Y(cur).toFixed(1)}" width="${bw}" height="${(Y(goal)-Y(cur)).toFixed(1)}" rx="8"/><text x="${x(7)+bw/2}" y="${(Y(cur)-6).toFixed(1)}" text-anchor="middle" class="on">${fmt(cur.toFixed(1))}</text><text x="${x(7)+bw/2}" y="${H-3}" text-anchor="middle">cél ${fmt(goal.toFixed(1))}</text>`;
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="A hét hét lépése a kiindulástól a célig, vízesés-ábrán">${out}</svg>`;
}
function trendek(){
  const wt=[84.0,83.9,null,83.7,83.6,null,83.9,83.4,83.2,82.9,82.6,82.2,81.9,81.6,81.5,81.3,81.4,81.1,80.9,80.8,80.7];
  const tr=wt.map((_,i)=>{const w=wt.slice(Math.max(0,i-2),i+3).filter(v=>v!=null);return w.reduce((a,b)=>a+b,0)/w.length});
  const kcal=[2860,2990,3050,2940,3120,3010,3055];
  const link=linked(79/1.3,125/1.3,{a:'Hétköznap · 79%',b:'Hétvége · 125%',s:250}).replace('</svg>',`<path d="M8 ${(92-100/1.3*.72).toFixed(1)}H212" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/><text x="110" y="${(92-100/1.3*.72-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--sub)">a keret</text></svg>`);
  return page('fuel',{title:'Trendek',sub:'Fuel · október 1–7.',tab:'trendek'},`
  ${dn('Ez a hét','október 1–7.',{toast:'Múlt hét'},null)}
  ${gHero({lbl:'5 / 7 naplózott nap · ebből áll a heti kép',g:weekVes()+lgd([['liq','amit ettél'],['line','a nap kerete'],['over','a keret fölött'],['gap','nincs naplózva']]),
    verdict:'Hétvégén 46%-kal többet ettél a keretedhez mérve, mint hétköznap.',sub:'A szám a nap pontja. A szaggatott edény nem naplózott nap; nem töltöm ki becsléssel. Koppints egy edényre.',
    acts:btn('A hét napjai','mai.het','sm')},1)}
  ${sec(1,'A hét számai',2)}
  ${card(grid([
    stat({k:'Napi átlag',icon:'t-plate',n:'2 069',unit:'kcal',pct:67,s:'180 kcal-lal kevesebb, mint múlt héten',on:{toast:'Napi átlag · 5 naplózott nap'}}),
    stat({k:'Minőség',icon:'t-score',n:'7,8',unit:'/ 10',pct:78,s:'0,7-del több, mint múlt héten',sCls:'ok',c:'var(--ok)',on:{toast:'Étkezés-minőség · a napi pontok átlaga'}}),
    stat({k:'Heti súlyátlag',icon:'t-weight',n:'81,3',unit:'kg',pct:45,c:'var(--water)',s:'0,6 kg-mal kevesebb',on:{toast:'Heti súlyátlag · 4 mérés'}}),
    stat({k:'Naplózott nap',icon:'t-calendar',n:'5',unit:'/ 7',pct:71,s:'2 nap kimaradt',on:'mai.het'})]),{i:2})}
  ${sec(2,'Hétköznap és hétvége',3)}
  ${card(`<div class="fu-lk">${link}</div>`+note('Két közlekedőedény: amit hétköznap nem eszel meg, az hétvégén átfolyik. A különbség <b>46 százalékpont</b> a hétvége javára. Így alakult, és most már látod.'),{i:3})}
  ${sec(3,'Hosszabb táv · 7 hét',4)}
  ${card(head('t-weight','Súlytrend')+area(tr,{h:150,min:77.6,max:84.4,dots:wt,target:78,labels:['aug. 18.','szept. 10.','okt. 7.']})
    +lgd([['liq','simított súlytrend'],['dot','napi mérések'],['line','cél · 78,0 kg']])
    +lab('Heti átlag kcal')+area(kcal,{h:76,min:2700,max:3200,c:'color-mix(in srgb,var(--carb) 55%,#fff)',c2:'var(--carb)'})
    +note('A heti átlagok egymás alatt: fent a súly, lent az evés. Ahol nem volt mérés, ott nincs pont. Egyik sem ok, csak együttjárás.'),{i:4})}
  ${sec(4,'A cél felé · 84,0 → 78,0 kg',5)}
  ${card(waterfallSvg()+note('Egy oszlop egy hét lépése; az üres oszlop az a hét, amikor nőtt a súlyod. Ami még hátravan, az utolsó oszlop a cél vízvonaláig.'),{i:5})}
  ${sec(5,'Mintázatok · 2',6)}
  ${card(row({icon:'t-pattern',title:'Késő szénhidrát → másnap reggeli RPE +1',sub:'20:00 után, 60 g felett',right:st('figyeljük','q')+chev(),on:{toast:'Mezo · a mintázat oldala'}})
    +row({icon:'t-pattern',title:'Koffein 14:00 után → elalvás +24 perc',sub:'több hét adata',right:st('megerősítve','ok')+chev(),on:{toast:'Mezo · a mintázat oldala'}})
    +note('A mintázatok otthona a Mezo; innen odalépsz, nem másolatot látsz.'),{i:6})}`);
}

/* ═══ BEÁLLÍTÁSOK · ABLAKOK · TANULÁS ══════════════════════════ */
const WINS=[['08:00','Reggeli','t-sun',600],['12:30','Ebéd','t-bowl',780],['16:00','Uzsonna','t-snack',300],['19:30','Vacsora','t-moon',720]];
const winTide=o=>tide(WINS.map(([t,l,,k])=>({h:toMin(t)/60,l,v:k,top:k})),o);
function beallitas(){
  return page('fuel',{title:'Fuel beállítások',sub:'Fuel · ritmus, makrók, célok',back:'mai'},`
  ${gHero({lbl:'Napi ritmus · 4 étkezés',g:winTide({stop:14}),verdict:`A kereted ma ${kc(DAY.target)} kcal, négy étkezésre osztva.`,sub:'A napi ív együtt mozdul a beállításaiddal. A ritmus vezet, nem korlátoz: bármelyik ablak utólag is logolható.'},1)}
  ${sec(1,'Ritmus',2)}
  ${card(`<div class="fx-two"><div>${lab('Étkezés / nap')}${stp(4,'étkezés','Étkezés/nap (3–6)')}</div><div>${sel('Koffein-stop','14:00')}</div></div>`
    +note('A koffein-stop a Mai sorát, a nap-tervet és a koffein-szokást is állítja.')
    +row({icon:'t-clock',title:'Étkezési ablakok',sub:'szerkesztése · 4 ablak · 3 naptípus',on:'ablakok'}),{i:2})}
  ${sec(2,'Makrók',3)}
  ${card(sel('Makróprofil','Kiegyensúlyozott')+lab(`Mai cél alapján · ${kc(DAY.target)} kcal · aktív cél`)
    +vials([['Fehérje','t-meat','var(--protein)',24,'220 g'],['Szénhidrát','t-carb','var(--carb)',47,'380 g'],['Zsír','t-avocado','var(--fat)',29,'95 g']].map(([l,ic,c,p,g])=>({l,ic,c,p:p*1.7,v:p+'%',s:g,on:{toast:`${l}: ${p}% · ${g}`}})),{h:96}),{cls:'fu-mac',i:3})}
  ${sec(3,'Célok',4)}
  ${card(`<div class="fx-two"><div>${fld('Víz-cél','2 500 ml')}</div><div>${fld('Rost-cél','30 g')}</div></div>`,{i:4})}
  ${sec(4,'Finomhangolás',5)}
  ${card(lab('Fehérje-szint')+pick(['Alacsony','Mérsékelt','Magas'],'Magas','Fehérje-szint')
    +note('A testsúlyod és a zsírmentes tömeged szerinti számítást is állítja; a cél a kettő közül a nagyobb, egy felső korláttal. Mentés után a Makrók előnézete rögtön a választott szint szerinti grammot mutatja.')
    +row({icon:'t-brain',title:'Tanulás a súlyomból és az evésemből',sub:'hetente megtanulom, mennyi energiát használsz valójában',right:sw(true,'Tanulás a súlyomból és az evésemből')})
    +acts(lk('Hogy tanultam?','tanulas')),{i:5})}`,
  {foot:btn('Mentés',{toast:'Mentve'})});
}
function ablakok(arg){
  const edit=arg==='szerk';
  const days=`<div style="margin-top:12px">${pick(['Pihenőnap','Reggeli edzés','Esti edzés'],'Pihenőnap','Naptípus')}</div>`;
  return page('fuel',{title:'Étkezési ablakok',sub:'Beállítások · 4 ablak · 3 naptípus',back:edit?'ablakok':'beallitas'},`
  ${gHero({lbl:edit?'Testreszabás · Σ 100 %':'Ajánlott felosztás · Σ 100 %',g:winTide({}),verdict:edit?'Állítsd át a nevet, a típust vagy az időt.':'Pihenőnapon négy ablak osztja el a napot.',sub:edit?'Az edények szintje a kalória-rész; a részek együtt mindig 100 %-ot adnak.':'A napod valódi edzésblokkjaiból számolva. Az edény szintje az ablak kalória-része.',body:days,
    acts:edit?'':btn('Testreszabás','ablakok.szerk')},1)}
  ${sec(1,'Ablakok · Σ 100 %',2)}
  ${edit?card(WINS.map(([t,l,ic,k])=>`<div class="fx-win"><div class="fx-wh">${bub(ic,{s:40})}<input class="fh-in" value="${l}" aria-label="Ablak neve"><button class="fx-add" data-toast="Ablak törölve" aria-label="Ablak törlése">×</button></div>${pick(['Reggeli','Ebéd','Vacsora','Snack'],l==='Uzsonna'?'Snack':l,'Típus')}
      <div class="fx-two"><div>${sel('Horgony','Fix időpont')}</div><div>${fld('Idő · rész',`${t} · ${Math.round(k/24)} %`)}</div></div><p class="fx-wv">${level(k/24*2.4,{h:10})}<span><b>${k}</b> kcal</span></p></div>`).join('')
    +acts(btn('+ Új ablak',{toast:'Új ablak'},'sm ghost')+lk('Mezo értékelése',{toast:'Mezo értékeli a felosztást…'})),{i:2})
  :card(WINS.map(([t,l,ic,k])=>step({time:t,icon:ic,title:l,sub:'horgony: fix időpont',right:`<span class="fx-kv"><b>${k}</b> kcal<small>${Math.round(k/24)} %</small></span>`})).join('')
    +note('Ajánlott felosztás: a napod valódi edzésblokkjaiból számolva. Σ 100 %.'),{i:2})}`,
  edit?{foot:btn('Mégse','ablakok','ghost')+btn('Mentés',{toast:'Mentve'})}:{});
}
function learnSvg(){
  const W=336,H=160,L=30,R=8,T0=10,B=24,n=WK.length,x=i=>L+(W-L-R)*(i+.5)/n,lo=2250,hi=2650,y=v=>T0+(H-T0-B)*(1-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo));
  const runs=[];{let run=[];WK.forEach((w,i)=>{if(w)run.push({w,i});else{if(run.length)runs.push(run);run=[]}});if(run.length)runs.push(run)}
  const line=get=>runs.map(r=>smooth(r.map(({w,i})=>[x(i),y(get(w))]))).join('');
  const band=runs.map(r=>`<path class="band" d="${r.map(({w,i},k)=>`${k?'L':'M'}${x(i).toFixed(1)} ${y(w[2]+w[3]).toFixed(1)}`).join('')}${r.slice().reverse().map(({w,i})=>`L${x(i).toFixed(1)} ${y(w[2]-w[3]).toFixed(1)}`).join('')}Z"/>`).join('');
  const cw=(W-L-R)/n;
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="A keret alapja hétről hétre, 12 hét: szaggatott a képlet, folytonos a tanult alap, körülötte a bizonytalanság sávja">
    ${[2300,2400,2500,2600].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-4}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    ${band}${WK.map((w,i)=>w?'':`<rect class="gap" x="${(x(i)-8).toFixed(1)}" y="${T0}" width="16" height="${H-T0-B}" rx="8"/>`).join('')}
    <path class="thin dash" d="${line(w=>w[1])}"/><path class="tr" d="${line(w=>w[4])}"/>
    ${WK.map((w,i)=>w?`<circle class="${i===n-1?'end':w[5]?'hold':'raw'}" cx="${x(i).toFixed(1)}" cy="${y(w[4]).toFixed(1)}" r="${i===n-1?4.5:3}"/>`:'').join('')}
    ${[0,4,8,11].map(i=>`<text x="${x(i).toFixed(1)}" y="${H-5}" text-anchor="middle">${WK[i]?WK[i][0]:'júl. 27.'}</text>`).join('')}
    ${WK.map((w,i)=>`<rect x="${(x(i)-cw/2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer" data-toast="${w?`${w[0]} hete: képlet ${kc(w[1])} · tanult ${kc(w[2])} ± ${w[3]} · a keret alapja ${kc(w[4])}${w[5]?' · ezen a héten vártam':''}`:'Erről a hétről nincs sorom: kevés volt a felírás és a mérlegelés, nem tippelek számot.'}"/>`).join('')}</svg>`;
}
function tanulas(arg){
  const emp=arg==='ures', off=arg==='ki';
  const bg=bandG({lo:2200,hi:2760,a:2330,b:2630,v:2480,vl:'2 480 kcal',tick:2400,tl:'képlet 2 400',al:'−150',bl:'+150',label:'Tanult alap 2 480 kcal, ±150 kcal sávban; a képlet 2 400'});
  const h=emp?gHero({lbl:'Tanulás · még gyűlik az adat',g:`<div class="fu-need"><span><small>Felírt nap az utolsó 4 hétben</small>${level(60,{h:18,val:'6 / 10'})}</span><span><small>Mérlegelés ezen a héten</small>${level(50,{h:18,val:'1 / 2'})}</span></div>`,verdict:'Még nem tanultam.',sub:'Ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.',acts:btn('Étkezés logolása','log','sm')},1)
    :off?gHero({lbl:'Most nem használom',g:bg,verdict:'A keret a képletből jön: 2 400 kcal.',sub:'Közben csendben tovább tanultam: 2 480 ± 150 kcal.',acts:btn('Bekapcsolás a beállításokban','beallitas')},1)
    :gHero({lbl:'Tanult alap · közepesen biztos · ±150 kcal',g:bg,verdict:'Ennyit égetsz edzés nélkül: 2 480 kcal.',sub:'A képlet 2 400-at mondana; én ennyit tanultam a súlytrendedből és a felírt evésedből. A valós érték jó eséllyel a sávon belül van.',
      acts:btn('Heti egyeztetés',{sheet:'weekly'})+lk('1 javaslat vár',{sheet:'weekly'})},1);
  let n=0;
  return page('fuel',{title:'Hogy tanultam?',sub:'Fuel · a keret alapja',back:'mai'},`
  ${h}
  ${emp?'':`${sec(++n,'Hétről hétre · 12 hét',2)}
  ${card(learnSvg()+lgd([['dash','képlet'],['liq','a keret alapja'],['band','bizonytalanság (±)'],['ring','vártam']])
    +note('Koppints egy hétre a számaiért. Ahol nincs sor, ott a vonal megszakad; nem töltöm ki.')
    +lab('szept. 28 – okt. 4. · a legutóbbi hét')+kv([['Képlet szerint','2 400 kcal'],['Tanult','2 480 ± 150'],['A keret alapja','2 480 kcal'],['Lépés','+60 kcal'],['Teljes nap','4'],['Mérlegelés','4']]),{i:2})}`}
  ${sec(++n,'Az utolsó 14 nap · a mai nem számít',3)}
  ${card(LD.map(([d,k,s,on,can])=>row({icon:on?'t-tick':'t-shield',title:d,sub:`${k==null?'':kc(k)+' kcal · '}${s}`,right:can?sw(!!on,d+' számít'):'<span class="fx-dash">—</span>'})).join('')
    +note('A kapcsolóval megmondod, hogy egy nap teljes volt-e; azonnal újraszámolom. Felírás nélküli napot nem lehet jelölni: ott nincs mit számolni.'),{i:3})}
  ${emp?'':`${sec(++n,'A legutóbbi hét · hat lépésben',4)}
  ${card(HW.map(([t],i)=>row({left:`<span class="fx-dd">${i+1}</span>`,title:t,sub:['47 teljes nap · 52 mérlegelés · 8 hét','evés-oszlopok, súlypontok, trend, víz-sáv','2 930 − 132 − 330 ≈ 2 470','3 + 1 kihagyott nap · víz · 9 nap felírás nélkül','±150 kcal · közepesen biztos','2 400 → 2 420 → +60 → 2 480'][i],on:{sheet:'hw',arg:i}})).join(''),{i:4})}`}
  ${sec(++n,'Prototípus · állapotváltó',5)}
  ${card(seg([['Tanul','tanulas',!emp&&!off],['Nincs adat','tanulas.ures',emp],['Ki','tanulas.ki',off]])+note('Csak a prototípusban: a három állapot, amit ez az oldal mutatni tud.'),{i:5})}`);
}

/* ═══ LAPOK (alulról) ═════════════════════════════════════════ */
/* vércukor-doboz adatai étkezésenként: mi emeli, mi fékezi, mit tehetsz most és legközelebb. Sáv van, szám soha. */
const GLUD={
  reggeli:{up:[['Akácméz · 25 g','gyors cukor, ez emel a leginkább',78],['Zabpehely · 60 g','keményítő, lassan bomlik',46],['Áfonya · 100 g','gyümölcscukor, rosttal együtt',22]],
    down:[['Túró · 49 g fehérje','lassítja a gyomor ürülését',88],['Zsír · 22 g','késlelteti a felszívódást',52],['Rost · 7 g','a zabból és az áfonyából',48]],
    expect:'A zab és a túró lassan ereszti a cukrot: egyenletes energia kb. délig, éhség 3–4 óra múlva.',
    now:[['t-tick','Nincs teendő','Ez a tányér magától is laposan megy.']],next:null,
    ai:'Ez a tányér sima, nincs mit cserélni. Ha a mézet elhagyod, még laposabb, de nem kell.',est:'Az áfonya és a méz cukortartalmát becsültem, mert a címkéjük nincs a kamrádban. Becsült adatból sosem lesz „egyél kevesebb cukrot” tanács.'},
  tizorai:{up:[['Banán · 120 g','érett gyümölcs, gyors cukor',74],['Whey · 30 g','kevés tejcukor',14]],
    down:[['Whey · 36 g fehérje','erős fék, gyorsan hat',72],['Mandulavaj · 11 g zsír','késlelteti a felszívódást',40],['Rost · 3 g','kevés, alig fékez',16]],
    expect:'Gyors emelkedés, gyors visszatérés. Edzés után ez üzemanyag: a szénhidrát az izomba megy.',
    now:[['t-hike','Egy 10 perces séta','Evés után érezhetően lejjebb viszi a csúcsot.'],['t-water','Egy pohár víz mellé','Lassítja, ahogy a turmix leér.']],
    next:[['A banán fele is elég','60 g a 120 helyett; edzés után így is visszatölt.'],['+5 g rost','egy evőkanál chia vagy zabkorpa a turmixba']],promise:'A kettő együtt az alacsony sávba vinné.',
    ai:'A banán fele is elég a whey mellé; a mandulavaj maradjon, az fékez.',est:'A banán cukortartalmát becsültem (nincs kamra-tétel hozzá).'},
  ebed:{up:[['Édesburgonya · 400 g','sok keményítő, ez adja a csúcsot',90],['Spenót · 200 g','szinte semmi',6]],
    down:[['Csirkemell · 63 g fehérje','erős fék',90],['Olívaolaj · 25 g zsír','késlelteti a felszívódást',56],['Rost · 8 g','az édesburgonyából és a spenótból',44]],
    expect:'A következő órában élénkebb, utána egy rövid laposabb szakasz jöhet; éhség 2,5–3 óra múlva. Edzés után a gyors szénhidrát most épp jól jön.',
    now:[['t-hike','Egy 10 perces séta','Evés után érezhetően lejjebb viszi a csúcsot.'],['t-repeat','Az evés sorrendje','Legközelebb a csirkét és a spenótot edd előbb, az édesburgonyát a végén.']],
    next:[['Negyeddel kevesebb édesburgonya','400 g helyett 300 g; a visszatöltéshez így is elég.'],['+5 g rost','egy marék brokkoli vagy lencse a tányérra']],promise:'A kettő együtt laposabbá tenné, de még a közepes sávban maradna.',
    ai:'Az édesburgonyából elég háromnegyed adag, és ha a spenótot előre eszed, laposabb lesz.',est:''}};
const GCUR=[[0,5,12,18,21,19,15,10,6,3,1,0,0],[0,14,34,48,44,34,22,12,5,0,-3,-2,0]];
/* gluCurve: a várható görbe folyadék-felszínként — csúcs, a csúcsig eltelt idő és a visszatérés jelölve; y tengelyen nincs szám */
const gluCurve=g=>{const v=GCUR[g],w=320,h=150,pad=8,lo=-8,r=72,X=i=>pad+i*(w-2*pad)/(v.length-1),Y=y=>pad+(1-(y-lo)/r)*(h-2*pad-14),pi=v.indexOf(Math.max(...v)),ri=g?9:10;
  return area(v,{w,h,min:lo,max:64,target:0,labels:['evés','1 óra','2 óra','3 óra'],c:g?'color-mix(in srgb,var(--warn) 55%,#fff)':'var(--liq1)',c2:g?'var(--warn)':'var(--liq2)'}).replace('</svg>',
    `<path d="M${X(pi)} ${Y(v[pi])+7}V${Y(0)}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/><circle cx="${X(pi)}" cy="${Y(v[pi])}" r="5" fill="#fff" stroke="${g?'var(--warn)':'var(--liq2)'}" stroke-width="3"/>
     <text x="${X(pi)+10}" y="${Y(v[pi])-6}" class="val">csúcs · kb. ${pi*15} perc</text>
     <path d="M${X(ri)} ${Y(0)-7}V${Y(0)+7}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><text x="${X(ri)}" y="${Y(0)+19}" text-anchor="middle" class="val">vissza · kb. ${g?'2 óra 15 perc':'2,5 óra'}</text>
     <text x="${pad+2}" y="${Y(0)+13}">kiinduló szint</text></svg>`)};
const howSvg=()=>{const N=56;let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
  const inc={28:604,34:929,45:1340,48:2150},unl=new Set([3,11,17,22,27,31,40,47,53]),W=320,H=150,bw=W/N,base=H-14,ky=k=>base-k/3400*70,wy=w=>8+(1-(w-81.6)/3)*60;let bars='',dots='';const tr=[],ti=[];
  for(let i=0;i<N;i++){const water=i>=36&&i<44?Math.min(1.2,(i-35)*.4):0,tissue=82.4+i*.017,w=tissue+water+(rnd()-.5)*.9,k=unl.has(i)?null:inc[i]??Math.round(2760+rnd()*360),cx=i*bw+bw/2;
    if(k!=null)bars+=`<rect x="${(i*bw+.8).toFixed(1)}" y="${ky(k).toFixed(1)}" width="${(bw-1.6).toFixed(1)}" height="${(base-ky(k)).toFixed(1)}" rx="1.6" class="${i in inc?'bad':'okc'}"/>`;
    if(rnd()<.93)dots+=`<circle cx="${cx.toFixed(1)}" cy="${wy(w).toFixed(1)}" r="1.7" class="raw"/>`;tr.push([cx,wy(tissue+water*.9)]);ti.push([cx,wy(tissue)])}
  return `<svg class="fh-chart fu-how" viewBox="0 0 ${W} ${H}" role="img" aria-label="Napi evés oszlopokban, súly pontokban és trendvonalban, 8 hét"><line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${bars}
    <path class="wband" d="${tr.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}${ti.slice().reverse().map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}Z"/>${dots}
    <path class="tr" d="${tr.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}"/>
    <text x="0" y="${H-2}">aug. 9.</text><text x="${W}" y="${H-2}" text-anchor="end">okt. 4.</text><text x="${W}" y="12" text-anchor="end">súly</text><text x="${W}" y="${ky(3000)-4}" text-anchor="end">evés</text></svg>`};
const waterSheet=()=>`${sh('t-water','Mennyit ittál?','Egy korty szünet.')}
    <div class="fu-wat"><button class="fu-glass" data-fwadd aria-label="Hozzáadok ${WSEL} ml-t">${fill(GLASS,{vb:GLASSVB,p:pc(WAT,2500)*.92,s:118,c:'color-mix(in srgb,var(--water) 50%,#fff)',c2:'var(--water)',inner:`<path d="M14 14H86" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 4" opacity=".4"/>${[.25,.5,.75].map(q=>`<path d="M${(21+(1-q)*-8+2).toFixed(1)} ${(126-q*112).toFixed(1)}h7" stroke="var(--ink)" stroke-width="1.2" opacity=".3"/>`).join('')}`})}</button>
      <div><span class="fh-big">${fmt((WAT/1000).toFixed(2).replace(/0$/,''))}<small>/ 2,5 l</small></span><p>${WAT>=2500?'Megvan a mai cél.':`Még ${fmt(((2500-WAT)/1000).toFixed(2).replace(/0$/,''))} l a célig · kb. ${Math.ceil((2500-WAT)/WSEL)} pohár.`}</p>
        <button class="btn sm" data-fwadd>+ ${WSEL} ml</button></div></div>
    ${lab('Egy pohár mérete')}<div class="fh-pills">${[250,400,500].map(v=>`<button class="fh-pill ${v===WSEL?'on':''}" data-fwsel="${v}">${v} ml</button>`).join('')}</div>
    ${fld('Kézzel','','pl. 330')}
    ${note('Koppints a pohárra vagy a gombra: a szint annyival emelkedik. A szaggatott vonal a napi cél.')}
    ${acts(btn('Mentés',{toast:`Víz mentve · ma ${fmt(WAT/1000)} l`},'sm')+`<button class="fh-lk" data-fwundo>Visszavonom az utolsót</button>`+closeLk('Mégse'))}`;
const sheets={
  eq:()=>{const sk=skK(),rem=DAY.target-DAY.eaten-sk;return `${sh('t-bowl','Miből jön össze?',`${kc(rem)} kcal fér még bele ma`)}
    <div class="fu-eqb">${level(pc(DAY.eaten,DAY.target),{h:26,label:'ettél · '+kc(DAY.eaten),val:'még szabad · '+kc(rem)})}</div>
    ${[['Alap','t-flame','a súlytrendedből és az evésedből tanulva · heti tanulás ›','2 480',{sheet:'weekly'}],['Mozgás','t-dumbbell','ma logolt mozgásod · még jön +460, ha megcsinálod a röpit','+ 650'],['Célod','t-ring','a fogyási célod napi része','− 30'],['Étel','t-bowl','amit ma eddig logoltál','− '+kc(DAY.eaten)],...(sk?[['Kihagyva','t-skip','kihagyott étkezés · nem kerül át máshová','− '+kc(sk)]]:[])].map(([l,ic,s,v,on])=>row({icon:ic,title:l,sub:s,v,on:on||null})).join('')}
    <div class="fx-tot"><span>Marad<small>a mai kereted maradéka</small></span><b>${kc(rem)}<small>kcal</small></b></div>
    ${note('A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja; a keret akkor nő, amikor logolod az edzést.')}
    ${acts(btn('Részletesen, honnan jön a keret',{sheet:'energy'},'sm')+closeLk())}`},
  energy:()=>`${sh('t-ring','Honnan jön a 3 100 kcal?','A napi cél nem statikus: az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.')}
    ${split([['Alap',2480,'var(--dom)','2 480'],['Mozgás',650,'var(--water)','+650'],['Célod',30,'var(--faint)','−30']],{h:30})}
    <div class="fx-sum"><span class="fh-big">2 480 + 650 − 30</span><b>= 3 100</b></div>
    ${lab('Alap · tanult')}${kv([['Képlet szerint · BMR × NEAT','2 400 kcal'],['Tanult alap','2 480 kcal']])}
    ${txt('Ennyit égetsz <b>edzés nélkül</b>: a súlytrendedből és a felírt evésedből tanultam meg.')}
    ${row({icon:'t-lens',title:'Tanult alap · közepesen biztos · ±150 kcal',sub:'Hogy tanultam? Hétről hétre, és a napjaid',on:'tanulas'})}
    ${lab('Mozgás · ma logolva · +650')}${kv([['Felsőtest A · 58 perc','190 kcal'],['Röpi edzés · 95 perc','460 kcal']])}
    ${note('A keret akkor nő, amikor rögzíted az edzést; a tervezett, még meg nem csinált edzés a keretben nincs benne. A becslés a nyugalmi energiád feletti többletet számolja; ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.')}
    ${lab('Célod · −30')}${kv([['Cél ütem','0,3 kg / hét'],['Napi rész','−30 kcal']])}
    ${note('Lassú ütem, hogy az edzés ereje megmaradjon.')}
    ${acts(closeLk())}`,
  water:waterSheet,
  /* heti egyeztetés: három rövid modul, mind átugorható */
  weekly:()=>`${sh('t-compare','Heti egyeztetés','szept. 28 – okt. 4. · 3 lépés, kb. 2 perc; bármelyiket átugorhatod')}
    <div class="fx-mod"><div class="fx-modh"><b>1 / 3 · Miért most</b><button class="fh-lk" data-toast="Átugorva">Kihagyom</button></div><p class="fh-txt">Lezárult a hét, és a súlyod lassabban nőtt, mint amit a felírt evés alapján vártam. Alap 2 480 kcal · közepesen biztos · ±150.</p>
      ${bandG({lo:2200,hi:2760,a:2330,b:2630,v:2480,vl:'2 480',tick:2420,tl:'múlt hét 2 420',al:'−150',bl:'+150',label:'Az alap 2 420-ról 2 480-ra lépett'})}</div>
    <div class="fx-mod"><div class="fx-modh"><b>2 / 3 · Mi történt</b><button class="fh-lk" data-toast="Átugorva">Kihagyom</button></div><p class="fh-txt">Két napot kihagytam, mert hiányosnak tűntek. Ha teljesek voltak, mondd; ha nem nyúlsz hozzá, kihagyva hagyom őket.</p>
      ${[['szerda, szept. 30.','1 180 kcal · hiányosnak tűnt'],['vasárnap, okt. 4.','1 020 kcal · hiányosnak tűnt']].map(([d,s])=>row({icon:'t-shield',title:d,sub:s,right:btn('Teljes volt',{toast:'Teljesnek jelölve · a keret +20 kcal'},'sm ghost')})).join('')}</div>
    <div class="fx-mod"><div class="fx-modh"><b>3 / 3 · Javaslat</b><button class="fh-lk" data-toast="Később">Később</button></div><p class="fh-txt">A napi keretedben <b>+60 kcal</b>. Hetente csak kis lépést teszek, új irányba először csak félig.</p>
      ${acts(btn('Elfogadom',{toast:'Elfogadva · a keret 3 100 kcal'},'sm')+lk('Részletek','tanulas')+`<button class="fh-lk" data-toast="Elrejtettem; ezt a hetet nem mutatom újra" data-close>Bezárom</button>`)}</div>`,
  day:i=>{i=+i||0;const [d,k,t,s,tr]=WEEK[i]||WEEK[0]; return k==null?`${sh('t-plate',`${DAYN[i]} · okt. ${1+i}.`,'Ezen a napon nem naplóztál.')}<div class="fu-ng">${`<span class="gg">${fill(BOWL,{vb:BOWLVB,p:0,s:120})}</span>`}<div class="nn"><p><b>Őszintén:</b> nem töltöm ki becsléssel, és a heti átlagból is kimarad.</p></div></div>${acts(btn('Pótolom a napot','log','sm')+closeLk())}`
    :`${sh('t-calendar',`${DAYN[i]} · okt. ${1+i}.`,`étkezés-pont ${s} / 10${tr?' · edzésnap':''}`)}
    <div class="fu-ng"><span class="gg">${fill(BOWL,{vb:BOWLVB,p:Math.min(100,k/t*94),s:120,c:k>t+60?'color-mix(in srgb,var(--warn) 55%,#fff)':'var(--liq1)',c2:k>t+60?'var(--warn)':'var(--liq2)'})}</span><div class="nn"><span class="fh-big">${kc(k)}<small>/ ${kc(t)} kcal</small></span><p>A kereted ezen a napon ${kc(t)} kcal volt. ${k>t?`${k-t} kcal-lal fölé ment; így alakult.`:'Belefértél; így alakult.'}</p></div></div>
    ${lab('Táplálkozás · a napi értékelés 30%-a')}
    ${mrow('Fehérje','<b>148</b> / 160 g',pc(148,160),'var(--protein)','t-meat')}${mrow('Szénhidrát','<b>231</b> / 250 g',pc(231,250),'var(--carb)','t-carb')}${mrow('Zsír','<b>66</b> / 75 g',pc(66,75),'var(--fat)','t-avocado')}
    ${lab('A nap étkezései')}
    ${row({icon:'t-plate',title:'Zabkása gyümölccsel',sub:'08:00 · 420 kcal',v:'8,2',on:{toast:'Az étkezés részletei'}})}${row({icon:'t-plate',title:'Csirkés rizstál',sub:'12:40 · 760 kcal',v:'8,4',on:{toast:'Az étkezés részletei'}})}
    ${acts(btn('Megnézem a napot','mai.tegnap','sm')+closeLk())}`},
  item:name=>{const x=STACK.flatMap(b=>b.items).find(i=>i[0]===name)||STACK[1].items[1]; return `${sh('t-supps',x[0],`naponta · ${x[1]}`)}
    <div class="fh-chips fu-chips"><span>${x[2]} · ${x[4]||'12:30'}</span><span>okos elhelyezés</span><span>${x[3]?'bevéve '+x[4]:'ma még nincs bevéve'}</span></div>
    ${lab('Ebből a termékből')}${kv([['Napi adag',x[1]],['Kiszerelés','kapszula · 1 db'],['Készleten','42 db'],['Napi összmennyiség',x[1]]])}
    <div class="fu-eqb">${level(47,{h:16,label:'készlet',val:'42 / 90 db · kb. 6 hét'})}</div>
    ${lab('Miért így')}${txt('Zsíros étkezéssel szívódik fel a legjobban; az ebéd a nap legzsírosabb pontja.')}
    ${row({icon:'t-stack',title:x[0],sub:'42 db a kamrádban',on:'kamra.kreatin'})}
    ${acts(btn(x[3]?'Mégsem vettem be':'Bevettem',{toast:x[3]?'Visszavonva':'Bevéve · '+x[0]},'sm')+closeLk())}
    ${note('Tájékoztatás, nem orvosi tanács.')}`},
  stackitem:arg=>{const [pin,name]=(arg||'auto|Tasty Dose gombakávé').split('|'); return `${sh('t-supps',name||'Tasty Dose gombakávé',pin==='kézi'?'ide raktad kézzel (Ébredés)':'automatikusan időzítve')}
    ${pin==='kézi'?tip('t-pin','Ide raktad kézzel','Ébredés · amíg nem állítod vissza, nem mozdítom.')+acts(btn('Vissza automatikusra',{toast:'Vissza automatikusra'},'sm ghost')):tip('t-bolt','Automatikusan időzítve','A napod és a többi elem szerint tettem a helyére.')}
    ${lab('Mozgatás másik zónába')}${pick(['Ébredés','Reggeli','Edzés előtt','Edzés után','Ebéd','Vacsora','Este','Lefekvés'],'Ébredés','Zóna')}
    <div class="fx-two"><div>${fld('Dózis','8 g')}</div><div>${fld('+ Még egy bevétel','','dózis')}</div></div>
    ${acts(btn('+ Hozzáadás',{toast:'Még egy bevétel hozzáadva'},'sm ghost')+`<button class="fh-lk fx-bad" data-toast="Eltávolítva a stackből">Eltávolítás a stackből</button>`+closeLk())}`},
  dim:arg=>{const [id,i]=(arg||'reggeli|0').split('|'); const m=MEALS[id]||MEALS.reggeli; const n=+i||0,[l,ic,w,t,rows]=DIMS[n]||DIMS[0],low=m.dims.indexOf(Math.min(...m.dims))===n; return `${sh(ic,l,`súly az értékelésben: ${w}%${low?' · a leggyengébb láncszem':''}`)}
    <div class="fu-eqb">${level(m.dims[n]*10,{h:26,c:low?'var(--warn)':'var(--dom)',label:fmt(m.dims[n])+' / 10'})}</div>${txt(t)}${kv(rows)}${acts(closeLk())}`},
  glu:a=>{const [gs,idr]=String(a||'0').split('|'); const id=GLUD[idr]?idr:gs==='1'?'ebed':'reggeli', m=MEALS[id], g=m.glu, D=GLUD[id];
    const lv=(rows,c)=>rows.map(([t,s,p])=>`<div class="fu-gr"><span><b>${t}</b><small>${s}</small></span>${level(p,{c,h:10})}</div>`).join('');
    return `${sh('t-glucose','Vércukor-válasz',`${m.name} · ${m.time}`)}
    ${gband(g)}
    <p class="fh-txt fu-gl1"><b>${GL[g]} emelkedés várható.</b> ${D.expect}</p>
    ${lab('A várható görbe')}${gluCurve(g)}
    ${note('A görbe alakja becslés: mihez képest emelkedik és mikor tér vissza. Számot szándékosan nem írok rá.')}
    <div class="fu-g2"><div>${lab('Ami emeli')}${lv(D.up,'var(--warn)')}</div><div>${lab('Ami fékezi')}${lv(D.down,'var(--ok)')}</div></div>
    ${lab('Mit tehetsz most')}${D.now.map(([ic,t,s])=>tip(ic,t,s)).join('')}
    ${D.next?`${lab('Legközelebb így lesz laposabb')}${D.next.map(([t,s])=>tip('t-swap',t,s,'var(--ok)')).join('')}<p class="fh-note">${D.promise}</p>`:`${lab('Legközelebb')}${tip('t-repeat','Ugyanígy','Ez a tányér az alacsony sávban van; nincs mit javítani rajta.','var(--ok)')}`}
    ${lab('Étkezés szerint, ebből a tányérból')}${msg('falat',D.ai,'étel · a saját tételeidről')}
    ${lab('Mivel párosítsd')}<div class="fh-chips fu-chips">${['dió vagy mandula','görög joghurt','főtt tojás','zöldség előre','ecetes saláta'].map(n=>`<span>${n}</span>`).join('')}</div>
    ${D.est?`<p class="fh-note fx-warn">${D.est}</p>`:''}
    ${note('Becslés a hozzávalókból, nem mérés. Sávot mutatok, nem számot: vegyes ételnél a pontos szám félrevezetne. Nem orvosi tanács.')}
    ${acts(btn('Az étkezés részletei','meal.'+id,'sm')+closeLk())}`},
  ora:a=>{const i=a===''||a==null?1:Math.max(0,Math.min(3,+a||0)), s=SLOTS[i], e=Object.entries(MEALS).find(([,m])=>m.w===i), m=e&&e[1];
    const WHY=['Ébredés után 1–3 órán belül: feltölti a reggelt, és jóval a délutáni edzés előtt van.','A nap közepe és a legnagyobb ablak: ide fér a legtöbb szénhidrát, és a zsírban oldódó kiegészítők (D3 + K2, Omega-3) is ide kerülnek.','Edzés előtt 60–90 perccel: könnyű, gyorsan emészthető étel, ebből megy az edzés.','Edzés után, lefekvés előtt legalább két órával: visszatöltés és esti fehérje.'];
    const EXP=['Délig egyenletes energia; ha kimarad, délelőtt hamarabb megéhezel.','Ebből töltesz a délutáni edzésre; ha későn eszed, az uzsonna-ablak összecsúszik vele.','Ha kimarad, az edzés végére elfogyhat a lendület. Nem kötelező: kihagyhatod.','Késő, nehéz vacsora után nehezebb az elalvás; a fehérje reggelig dolgozik.'];
    return `${sh('t-clock',`${s.l} · étkezési óra`,'miért ekkor, mire számíts')}
    <div class="fu-ng"><span class="gg">${dial(s,m?m.time:DAY.now,112)}</span><div class="nn"><span class="fh-big">${s.from}–${s.to}</span><p>ajánlott ablak · keret <b>${s.b} kcal</b></p><p>${m?`logolva ${m.time}-kor · ${toMin(m.time)>=toMin(s.from)&&toMin(m.time)<=toMin(s.to)?'az ablakon belül':'az ablakon kívül'}`:`most ${DAY.now} · ${toMin(DAY.now)<toMin(s.from)?'még nem nyílt ki':toMin(DAY.now)<=toMin(s.to)?'most nyitva':'még pótolható'}`}</p></div></div>
    ${lab('Miért ekkor')}${txt(WHY[i])}
    ${lab('Mire számíts')}${txt(EXP[i])}
    ${lab('Vércukor-válasz')}${m?gband(m.glu)+`<div class="fu-mc"><svg viewBox="0 0 24 12" aria-hidden="true"><path d="${gluPath(m.glu)}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>${m.name}: ${GL[m.glu].toLowerCase()} emelkedés várható.</span><button class="fh-lk" data-sheet="glu" data-arg="${m.glu}|${e[0]}">Részletek</button></div>`:note('Amint logolsz ebbe az ablakba, itt látod a sávot és a görbe alakját. Számot sosem írok rá.')}
    ${lab('A nap ablakai')}${tide(SLOTS.map((x,j)=>({h:(toMin(x.from)+toMin(x.to))/120,l:x.l,v:x.b,top:x.from,on:['ora',j]})),{sel:i,now:toMin(DAY.now)/60})}
    ${note('Az ablakok a napod valódi edzésblokkjaiból jönnek. Nem korlátok: bármelyik utólag is logolható, és egy kézzel megadott idő átviheti az étkezést másik ablakba.')}
    ${acts(btn('Ablakok szerkesztése','ablakok','sm')+closeLk())}`},
  mealwhy:a=>{const i=+a||0,s=SLOTS[i],cur=SKIP[i]||{};return `${sh('t-skip','Miért marad ki?',`Kihagyva · ${s.l} · nem kötelező; segít, hogy a coach értse a mintát`)}
    <div class="fu-why">${MCATS.map(([ic,l],c)=>`<button class="${cur.c===c?'on':''}" data-fwhy="${i}|${c}">${bub(ic,{s:40})}<span>${l}</span></button>`).join('')}</div>
    ${fld('Mi történt? · saját szavakkal','','pl. elhúzódott a megbeszélés')}
    ${tip('t-info','Nem számít mulasztásnak','A mai kereted nem változik, és a többi étkezésed sem lesz nagyobb.')}
    ${lab('Ha több napig tarthat (betegség, gyomorrontás, utazás)')}${pick(['Csak ma','2–3 nap','Kb. egy hét','Nem tudom'],'Csak ma','Meddig tarthat')}
    ${note('Több nap esetén a kímélő mód a Fuelt is átállítja: nem kér számon semmit, az edzés és a sport pedig magától kimarad.')}
    ${acts(`<button class="btn sm" data-close>Kész</button>`+closeLk('Most nem mondom'))}`},
  orvos:()=>`${sh('t-info','Mikor fordulj orvoshoz?','gyomorrontás')}
    ${['Nem marad meg benned a folyadék','Véres a széklet vagy a hányás','A hasmenés 7 napnál, a hányás 2 napnál tovább tart','Kiszáradás jelei: szédülsz, alig van vizeleted','Erős hasi fájdalom vagy magas láz'].map(t=>`<div class="fu-li"><i></i><span>${t}</span></div>`).join('')}
    ${tip('t-info','Ez nem orvosi tanács','Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet.')}${acts(closeLk())}`,
  import:()=>`${sh('t-camera','Új tétel a kamrába','fotó a címkéről vagy egy termék linkje')}
    ${note('Fotózd le a termék tápérték-táblázatát, vagy illeszd be egy termékoldal linkjét. A nevet, makrókat és tápértékeket az AI olvassa ki /100 g bázison. A fotó nem kerül tárolásra.')}
    <div style="margin:10px 0">${pick(['Fotó','Link'],'Fotó','Forrás')}</div>
    <button class="fx-ph" style="height:132px" data-toast="Kamera · a tápérték-táblázat">${bub('t-camera',{s:48})}<strong>Címkefotó</strong><small>előlap fotó opcionális, ha a név nem látszik</small></button>
    ${acts(btn('Beolvasás',{toast:'Beolvasva · Skyr · epres · Milbona · 62 kcal'},'sm')+closeLk('Mégse'))}`,
  add:edit=>`${sh('t-journal',edit?'Tétel szerkesztése':'Új kamra-tétel',edit?'':'kézi felvétel')}
    <div class="fx-two"><div>${sel('Típus','Étel')}</div><div>${sel('Kategória',edit?'Fehérje':'nincs')}</div></div>
    ${fld('Név',edit?'Csirkemell · friss':'','pl. Görög joghurt 10%')}${sel('Forrás','Saját bevitel')}
    ${multi('Makrók / 100 g',[['119 kcal','kcal'],['6 feh.','fehérje'],['4 szénh.','szénhidrát'],['9 zsír','zsír']])}
    ${multi('Tápanyag / 100 g',[['','Rost'],['','Cukor'],['','Tel. zsír'],['','Só']])}
    ${fld('Ár','','750 Ft')}
    ${acts(btn(edit?'Mentés':'Polcra',{toast:edit?'Mentve':'A polcra került'},'sm')+closeLk('Mégse'))}`,
  catalog:()=>`${sh('t-stack','Hozzáadás a közösből','közös katalógus')}${srch('Keresés név vagy márka szerint')}<div style="margin:10px 0 4px">${pick(['Mind','Étel','Supp','Stim','Gyógyszer'],'Mind')}</div>
    ${[['Skyr natúr','Ehrmann · 63 kcal/100 g · Anna',0,'t-meat'],['Bulgur','Kifli · 342 kcal/100 g · mezo',0,'t-carb'],['Kreatin-monohidrát','— · kiegészítő · Béla',1,'t-supps']].map(([n,s,on,ic])=>row({icon:ic,title:n,sub:s,right:on?st('a polcon','q'):btn('+ Polcra',{toast:'A polcra került'},'sm ghost')})).join('')}`,
  catfilter:()=>`${sh('t-lens','Mit mutassak?','kategória-szűrő · 0 kiválasztva')}<div class="fh-pills" data-fmulti>${['Fehérje','Tejtermék','Hal','Gabona','Mag / olajos','Whey / protein','Kiegészítő','Stimuláns'].map(l=>`<button class="fh-pill" data-toast="Szűrő: ${l}">${l}<b>1</b></button>`).join('')}</div>${acts(`<button class="btn sm" data-close>Szűrés · 8 tétel</button>`+lk('Törlés',{toast:'0 kiválasztva'}))}`,
  kamrapick:()=>`${sh('t-stack','Válassz a polcról','kamra · hozzáadás')}${srch('Keress a kamrában…')}
    ${KAM.filter(k=>k.k==='food').slice(0,4).map((k,i)=>irow({icon:kic(k),title:k.n,sub:`${k.b} · ${k.kcal} kcal / 100 g`,v:`<button class="fx-add ${i===1?'on':''}" data-toast="${i===1?'Már a listában':'Hozzáadva: '+esc(k.n)}" aria-label="${i===1?'Már a listában':'Hozzáadás'}">${i===1?I('i-check'):'+'}</button>`,l2:m3(k.p,k.c,k.f)})).join('')}`,
  receptpick:()=>`${sh('t-book','Válassz receptet','recept · hozzáadás')}${srch('Keress receptet…')}<div style="margin:10px 0 4px">${pick(['Mind','Csillagos'],'Mind')}</div>${REC.slice(0,4).map(r=>row({icon:CAT[r.cat][1],title:r.n+(r.star?' · csillagos':''),sub:`${CAT[r.cat][0]} · 4 hozzávaló · ${Math.round(r.p/r.serv)} / ${Math.round(r.c/r.serv)} / ${Math.round(r.f/r.serv)} g`,v:`${Math.round(r.kcal/r.serv)}<small>kcal</small>`,on:'log.tetelek'})).join('')}`,
  reclogs:id=>{const r=REC.find(x=>x.id===id)||REC[0]; return `${sh('t-journal',`Logok · ${r.logged}`,r.n)}${[['ma 07:20','689 kcal','8,4'],['tegnap 07:30','689 kcal','8,3'],['szept. 19. 07:10','620 kcal','8,1']].map(([d,k,s])=>row({icon:'t-plate',title:d,sub:k,v:`${s}<small>pont</small>`})).join('')}${acts(closeLk())}`},
  dose:()=>`${sh('t-syringe','Új beadás','Retatrutid')}<div class="fx-two"><div>${fld('Mikor','2026. 10. 07.')}</div><div>${fld('Időpont','14:10')}</div></div>${fld('Dózis','6 mg')}${fld('Jegyzet','','pl. hétfő reggel · subQ has')}${acts(btn('Beadás',{toast:'Beadás rögzítve'},'sm')+closeLk('Mégse'))}`,
  medform:()=>`${sh('t-syringe','Gyógyszer felvétele','')}<div class="fx-two"><div>${fld('Név','','pl. Retatrutid')}</div><div>${fld('Hatóanyag','','retatrutid')}</div></div>
    ${lab('Beviteli út')}${pick(['subQ injekció','IM injekció','orális'],'subQ injekció','Beviteli út')}
    ${lab('Kadencia')}${pick(['heti','napi'],'heti','Kadencia')}
    ${lab('Nap')}${pick(['H','K','Sze','Cs','P','Szo','V'],'H','Nap')}
    ${lab('Ciklus · fázisok')}${cyc(-1)}${note('Alap-sablon: 2 nap csúcs · 3 nap stabil · 2 nap völgy; a beadás napjától számolva.')}
    ${acts(btn('Felveszem',{toast:'Felvéve'},'sm')+closeLk('Mégse'))}`,
  hw:i=>{i=+i||0;const [t,b]=HW[i]||HW[0];
    const G=[
      ()=>facts([['47','teljes nap felírt evéssel'],['52','mérlegelés'],['8','hét előzmény']])+txt('Csak azokat a napokat számoltam, amikor az evésed teljesnek tűnt. A mai napot soha nem nézem, mert még tart.'),
      ()=>howSvg()+lgd([['liq','számít'],['hatch','hiányosnak tűnt'],['tr','súlytrend'],['water','ebből víz'],['dot','mérlegelés']])+txt('Napi evés oszlopokban, súly pontokban, a trend vonalban, 8 hét. A hiányosnak tűnő napok más színnel, a vízugrás külön sávban.'),
      ()=>[['Átlagosan ennyit ettél','a 47 teljes napon','2 930',100,'t-bowl'],['− ami súlyként megmaradt','+0,12 kg/hét valódi gyarapodás, víz nélkül','−132',95.5,'t-weight'],['− amit mozgással égettél','edzések és terven kívüli mozgás, napi átlag','−330',84.3,'t-steps']].map(([l,s,v,p,ic])=>`<div class="fu-gr">${bub(ic,{s:30})}<span><b>${l}</b><small>${s}</small></span><em>${v}</em>${level(p,{h:12})}</div>`).join('')+`<div class="fx-tot"><span>Ennyit égetsz mozgás nélkül<small>a kerekített, egyszerű változat</small></span><b>≈ 2 470<small>kcal</small></b></div>`+note('A valódi számítás napról napra halad, és minden mérlegelés egy kicsit pontosít rajta.'),
      ()=>tip('t-shield','3 hiányosnak tűnő nap','Jóval a szokásos evésed alatt voltak, ezért nem vettem kevés evésnek; kihagytam őket.','var(--warn)')+`<div class="fh-chips fu-chips"><span>aug. 30. · 604</span><span>szept. 5. · 929</span><span>szept. 16. · 1 340</span></div>`
        +tip('t-shield','1 általad hiányosnak jelölt nap','Te jelölted hiányosnak, ezért kihagytam.','var(--warn)')+`<div class="fh-chips fu-chips"><span>szept. 28. · 2 150</span></div>`
        +tip('t-water','Víz, nem zsír · szept. 7. körül','A súlyod kb. 1,2 kg-ot ugrott. Ez víz és glikogén, ezért nem számoltam hízásnak.','var(--water)')
        +tip('t-calendar','9 nap felírás nélkül','Ezekből a napokból nem tanultam semmit, és nem is tippeltem helyettük.','var(--faint)'),
      ()=>txt('A mostani becslésem <b>±150 kcal</b> pontos. Már elég sok adatot láttam, de a keretet továbbra is csak lépésenként igazítom.')+`<div class="fu-eqb">${level(50,{h:22})}</div><div class="fu-gb3"><span>Még tanulok</span><span class="on">Közepesen biztos</span><span>Biztos</span></div>`+bandG({lo:2200,hi:2760,a:2330,b:2630,v:2480,vl:'2 480',al:'2 330',bl:'2 630',label:'A becslés ±150 kcal sávja'})+note('Minél több teljes napot és mérlegelést látok, annál biztosabb leszek, és annál keskenyebb a sáv.'),
      ()=>vials([['képlet','2 400',40,'var(--faint)'],['korábbi igazítások','2 420',48,'var(--dom)'],['e heti lépés','+60',24,'var(--ok)'],['most','2 480',72,'var(--dom)']].map(([l,v,p,c])=>({l,v,p,c,on:{toast:`${l}: ${v}`}})),{h:92})+txt('Hetente csak kis lépést teszek, és új irányba először csak félig; egy furcsa hét így nem rántja el a keretet.')];
    return `${sh('t-lens',`${i+1}. ${t}`,'a legutóbbi hét · szept. 28 – okt. 4.')}${(G[i]||G[0])()}${acts((i>0?lk('Előző',{sheet:'hw',arg:i-1}):'')+(i<5?btn('Következő lépés',{sheet:'hw',arg:i+1},'sm'):'')+closeLk())}`}
};

/* ═══ CSS (csak a Fuel területre) ═══════════════════════════════ */
const LIQ='linear-gradient(180deg,var(--liq1),var(--liq2))', VES='linear-gradient(180deg,#fff,color-mix(in srgb,var(--dom) 5%,#fff))', RIM='inset 0 0 0 1.5px rgba(10,42,60,.09)';
const css=`
${P}{--fiber:#5FA05A;--water:#3F8FD6;--lilac:#8A6FD1}
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
${P} .fh-hero .verdict{position:relative}
${P} .fx-n{display:block;white-space:nowrap;margin:4px 0 12px}
${P} .fx-n small{display:block;white-space:normal;margin:6px 0 0;line-height:1.3}
${P} .fx-n.art{min-height:74px;padding-right:100px}
${P} .fx-la{display:block;padding-right:100px;min-height:14px}
${P} .fh-mus .v{white-space:nowrap}
${P} .fh-mus .v b{color:var(--ink);font-weight:700}
${P} .fh-mus .bar{width:72px;flex:0 0 auto}
${P} .fx-dd{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:var(--page);font-family:var(--disp);font-size:14px;font-weight:700;flex:0 0 auto}
${P} .fx-dd.on{background:var(--dom);color:#fff}
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
${P} .fx-listen{display:flex;gap:14px;align-items:center;padding:14px;border-radius:16px;background:color-mix(in srgb,var(--dom) 8%,#fff)}
${P} .fx-listen strong{display:block;font-family:var(--disp);font-size:18px;font-weight:700}
${P} .fx-listen p{font-size:13.5px;color:var(--sub);margin-top:2px}
${P} .fx-time{display:flex;gap:10px;align-items:center}
${P} .fx-time .fh-in{flex:1;min-width:0;color-scheme:light}
${P} .fx-pl{flex:1;min-width:0;display:flex;align-items:center;gap:10px}
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
${P} .sheet .fx-cyc span{background:var(--page)}
${P} .fx-kv{font-size:12.5px;color:var(--sub);text-align:right;white-space:nowrap;flex:0 0 auto}
${P} .fx-kv b{font-family:var(--disp);font-size:16px;font-weight:700;color:var(--ink)}
${P} .fx-kv small{display:block;font-size:11.5px}
${P} .fx-win{padding:14px 0;border-top:1px solid var(--hair)}
${P} .fx-win:first-child{border-top:0;padding-top:0}
${P} .fx-wh{display:flex;align-items:center;gap:10px;margin-bottom:10px}
${P} .fx-wh .fh-in{flex:1;min-width:0}
${P} .fx-shh{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
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
/* ── Folyadék: a Fuel saját grafikái ── */
${P} .fu-s{display:none}
${P} .fx-srch .fb,${P} .fx-pl .fb,${P} .fx-listen .fb,${P} .fx-shh .fb{flex:0 0 var(--s);width:var(--s)}
${P} .fh-hero>.k2-vials{margin:14px 0 16px}
${P} .fh-hero>.fh-facts{margin-bottom:14px}
${P} .fm-g{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin:16px 0 16px}
${P} .fm-n b{display:block;font-family:var(--disp);font-size:30px;font-weight:800;letter-spacing:-1.2px;line-height:1;font-variant-numeric:tabular-nums}
${P} .fm-n small{display:block;font-size:11px;font-weight:650;letter-spacing:.4px;text-transform:uppercase;color:var(--sub);margin-top:5px}
${P} .fm-n.r{text-align:right}
${P} .fu-bowl{display:flex;flex-direction:column;align-items:center;gap:8px}
${P} .fu-bowl small{font-size:10.5px;font-weight:650;color:var(--sub);white-space:nowrap}
${P} .fu-skl{display:flex;align-items:center;gap:8px;width:100%;margin-top:12px;padding:6px 12px 6px 6px;border-radius:999px;background:#fff;box-shadow:${RIM};font-size:12.5px;color:var(--sub);text-align:left}
${P} .fu-skl b{color:var(--ink)}
${P} .fu-mac .k2-vials{gap:8px}
${P} .fu-mac .k2-vial small{font-size:11px}
${P} .k2-vial b{white-space:nowrap}
${P} .k2-tube{max-width:74px}
${P} .fm-blk{padding:14px 16px}
${P} .fm-blk.open{background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1.5px rgba(10,42,60,.10)}
${P} .fm-bh{display:flex;align-items:center;gap:10px}
${P} .fm-bh .g{flex:1;min-width:0}
${P} .fm-bh strong{display:block;font-family:var(--disp);font-size:18px;font-weight:700;letter-spacing:-.4px}
${P} .fm-bh small{display:block;font-size:12px;color:var(--sub)}
${P} .fm-clock{flex:0 0 auto;border-radius:50%;box-shadow:0 8px 12px -8px rgba(10,42,60,.45)}
${P} .fu-dial{display:block}
${P} .fu-cup{display:flex;align-items:center;gap:6px;flex:0 0 auto}
${P} .fu-cup .fl-fill{filter:drop-shadow(0 6px 6px color-mix(in srgb,var(--liq2) 30%,transparent))}
${P} .fu-cup b{display:block;font-family:var(--disp);font-size:15px;font-weight:800;letter-spacing:-.4px;line-height:1.1}
${P} .fu-cup small{display:block;font-size:10.5px;color:var(--sub);white-space:nowrap}
${P} .fu-cup.over small{font-weight:700;color:var(--ink)}
${P} .fm-meal{margin-top:12px;padding-top:12px;border-top:1px solid var(--hair)}
${P} .fm-mn{display:block;width:100%;text-align:left}
${P} .fm-mn strong{display:block;font-size:15px;font-weight:650}
${P} .fm-mn small{display:block;font-size:12.5px;color:var(--sub);margin-top:1px}
${P} .fm-mb{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap}
${P} .fm-cells{display:flex;gap:10px}
${P} .fm-chips{display:flex;gap:6px;align-items:center}
${P} .fm-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;font-size:12.5px;font-weight:650;color:var(--ok);background:color-mix(in srgb,var(--ok) 10%,#fff);white-space:nowrap}
${P} .fm-chip svg:not(.ic){width:22px;height:11px}
${P} .fm-chip.mid{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,#fff)}
${P} .fm-chip.sc{padding:3px 11px 3px 3px;color:var(--ink);background:#fff;box-shadow:${RIM};font-family:var(--disp);font-size:14px;font-weight:800}
${P} .fm-when{font-size:13.5px;color:var(--sub);margin-top:10px}
${P} .fm-when b{color:var(--ink)}
${P} .fm-blk .fu-tip{padding:0}
${P} .fu-ng{display:flex;align-items:center;gap:14px;margin:12px 0 14px}
${P} .fu-ng .gg{flex:0 0 auto}
${P} .fu-ng .nn{flex:1;min-width:0}
${P} .fu-ng .nn .fh-big{display:block;font-size:36px;white-space:nowrap}
${P} .fu-ng .nn .fh-big small{display:block;margin:5px 0 0;white-space:normal;font-size:12.5px;line-height:1.3}
${P} .fu-ng .nn p{font-size:12.5px;color:var(--sub);line-height:1.4;margin-top:6px}
${P} .fu-ng .nn p b{color:var(--ink)}
${P} .fu-ng .nn .fm-cells{margin-top:10px}
${P} .fu-ng .nn .fu-m3{margin-top:10px}
${P} .fu-pk{display:flex;gap:4px 12px;flex-wrap:wrap;font-size:11.5px;color:var(--sub);margin-top:8px}
${P} .fu-pk span{display:inline-flex;align-items:center;gap:5px}
${P} .fu-pk i{width:10px;height:10px;border-radius:50%;flex:0 0 auto}
${P} .fu-pk i.a{background:color-mix(in srgb,var(--liq2) 42%,#fff);box-shadow:${RIM}}
${P} .fu-pk i.b{background:${LIQ}}
${P} .fu-pot{display:block}
${P} .fu-potc{display:flex;justify-content:center;margin:14px 0 10px}
${P} .fu-sc{display:flex;align-items:center;gap:14px;margin:10px 0 14px}
${P} .fu-sc .fh-big{white-space:nowrap}
${P} .fu-sc .c{flex:1;min-width:0}
${P} .fu-8{display:grid;gap:14px;margin-bottom:16px}
${P} .fu-8 .k2-vial small{font-size:11px}
${P} .fl-level span{white-space:nowrap;text-shadow:0 1px 2px rgba(10,42,60,.35)}
${P} .fl-level b{white-space:nowrap}
${P} .fu-split{display:flex;gap:2px;padding:2px;border-radius:999px;overflow:hidden;background:#fff;box-shadow:${RIM}}
${P} .fu-split i{min-width:5px;border-radius:5px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 62%,#fff),var(--c))}
${P} .fu-split i:first-child{border-radius:999px 5px 5px 999px}
${P} .fu-split i:last-child{border-radius:5px 999px 999px 5px}
${P} .fu-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px;color:var(--sub)}
${P} .fu-leg span{display:inline-flex;align-items:center;gap:6px}
${P} .fu-leg i{width:10px;height:10px;border-radius:50%;background:var(--c);flex:0 0 auto}
${P} .fu-leg b{color:var(--ink);font-weight:700}
${P} .fu-mr{gap:8px}
${P} .fu-mr .fl-level{width:76px;flex:0 0 auto}
${P} .fu-sh{flex:1;min-width:0}
${P} .fu-shn{font-size:11.5px;color:var(--sub);flex:0 0 auto}
${P} .fu-rl{width:54px;flex:0 0 auto}
${P} button.fx-it{cursor:pointer}
${P} .fu-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:14px 0 8px}
${P} .fu-wd{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
${P} .fu-wd em{font-style:normal;font-family:var(--disp);font-size:12.5px;font-weight:800}
${P} .fu-wd .fu-tb{position:relative;display:block;width:100%;max-width:34px;height:132px;border-radius:999px;overflow:hidden;background:${VES};box-shadow:${RIM},0 12px 14px -12px var(--liq2)}
${P} .fu-wd .fu-tb i{position:absolute;left:0;right:0;bottom:0;background:${LIQ}}
${P} .fu-wd .fu-tb s{position:absolute;left:0;right:0;background:color-mix(in srgb,var(--warn) 75%,#fff)}
${P} .fu-wd .fu-tb u{position:absolute;left:0;right:0;height:0;border-top:2px dashed color-mix(in srgb,var(--ink) 60%,transparent)}
${P} .fu-wd.gap .fu-tb{background:none;box-shadow:none;outline:1.5px dashed var(--faint);outline-offset:-1.5px}
${P} .fu-wd.on .fu-tb{box-shadow:inset 0 0 0 2.5px var(--liq2),0 12px 14px -12px var(--liq2)}
${P} .fu-wd b{font-size:12px;font-weight:700}
${P} .fu-wd.on b{color:var(--dom)}
${P} .fu-wd small{font-size:9px;color:var(--sub);line-height:1}
${P} .fu-lg{display:flex;flex-wrap:wrap;gap:5px 12px;margin:8px 0 12px;font-size:11.5px;color:var(--sub)}
${P} .fu-lg span{display:inline-flex;align-items:center;gap:5px}
${P} .fu-lg i{width:12px;height:10px;border-radius:3px;flex:0 0 auto}
${P} .fu-lg i.liq{background:${LIQ}}
${P} .fu-lg i.over,${P} .fu-lg i.hatch{background:color-mix(in srgb,var(--warn) 70%,#fff)}
${P} .fu-lg i.line,${P} .fu-lg i.dash{height:0;width:14px;border-radius:0;border-top:2px dashed color-mix(in srgb,var(--ink) 60%,transparent)}
${P} .fu-lg i.gap{background:none;outline:1.5px dashed var(--faint);outline-offset:-1.5px}
${P} .fu-lg i.dot{width:6px;height:6px;border-radius:50%;background:var(--faint)}
${P} .fu-lg i.band{background:color-mix(in srgb,var(--dom) 18%,#fff)}
${P} .fu-lg i.ring{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2px var(--dom)}
${P} .fu-lg i.tr{height:3px;background:var(--dom)}
${P} .fu-lg i.water{background:color-mix(in srgb,var(--water) 40%,#fff)}
${P} .fu-caps{display:flex;justify-content:space-between;gap:10px;margin:16px 0}
${P} .fu-caps .g{display:flex;flex-direction:column;align-items:center;gap:7px}
${P} .fu-caps .r{display:flex;gap:5px}
${P} .fu-caps i{display:block;width:20px;height:46px;border-radius:999px;background:${VES};box-shadow:${RIM}}
${P} .fu-caps i.on{background:${LIQ};box-shadow:0 10px 12px -8px var(--liq2),inset 0 0 0 1.5px rgba(255,255,255,.5)}
${P} .fu-caps i.nx{box-shadow:inset 0 0 0 2.5px var(--liq2)}
${P} .fu-caps small{font-size:11px;font-weight:600;color:var(--sub)}
${P} .fu-cyc{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:14px 0}
${P} .fu-cyc>span{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
${P} .fu-cyc .t{position:relative;display:block;width:100%;max-width:36px;height:78px;border-radius:999px;overflow:hidden;background:${VES};box-shadow:${RIM}}
${P} .fu-cyc .t i{position:absolute;left:0;right:0;bottom:0;background:${LIQ};opacity:.4}
${P} .fu-cyc .now .t{box-shadow:inset 0 0 0 2.5px var(--liq2),0 12px 14px -10px var(--liq2)}
${P} .fu-cyc .now .t i{opacity:1}
${P} .fu-cyc b{font-size:10.5px;font-weight:700}
${P} .fu-cyc small{font-size:9.5px;color:var(--sub);white-space:nowrap}
${P} .fu-off{opacity:.6}
${P} .fx-pb{display:flex;gap:8px;margin:14px 18px 0}
${P} .fx-pb span{flex:1;min-width:0}
${P} .fx-pb i{display:block;height:10px;border-radius:999px;background:#fff;box-shadow:${RIM}}
${P} .fx-pb .on i,${P} .fx-pb .done i{background:linear-gradient(90deg,var(--liq1),var(--liq2));box-shadow:none}
${P} .fx-pb .done i{opacity:.55}
${P} .fx-pb small{display:block;font-size:11px;color:var(--sub);margin-top:5px}
${P} .fx-pb .on small{color:var(--ink);font-weight:700}
${P} .fu-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
${P} .fu-kv div{padding:10px 12px;border-radius:18px;background:color-mix(in srgb,var(--dom) 6%,#fff);min-width:0}
${P} .fu-kv small{display:block;font-size:11px;color:var(--sub);line-height:1.25}
${P} .fu-kv b{display:block;font-family:var(--disp);font-size:15px;font-weight:700;margin-top:2px}
${P} .fu-tip{display:flex;gap:12px;align-items:flex-start;padding:8px 0}
${P} .fu-tip>span:last-child{flex:1;min-width:0}
${P} .fu-tip b{display:block;font-size:14px;font-weight:650}
${P} .fu-tip small{display:block;font-size:12.5px;color:var(--sub);line-height:1.4;margin-top:2px}
${P} .fu-chips span{padding:5px 11px}
${P} .sheet .fu-chips span,${P} .fh-card:not(.fh-hero) .fu-chips span{background:color-mix(in srgb,var(--dom) 6%,#fff);box-shadow:none}
${P} .fu-gb,${P} .fu-gb3{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:4px 0 12px}
${P} .fu-gb{padding:4px;border-radius:999px;background:#fff;box-shadow:${RIM}}
${P} .fu-gb span,${P} .fu-gb3 span{text-align:center;padding:7px 2px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--faint)}
${P} .fu-gb span.on{color:#fff;font-weight:700}
${P} .fu-gb .on.b0{background:var(--ok)}${P} .fu-gb .on.b1{background:var(--warn)}${P} .fu-gb .on.b2{background:var(--lilac)}
${P} .fu-gb3{margin-top:-4px}${P} .fu-gb3 span{padding:0;font-size:11.5px}${P} .fu-gb3 span.on{color:var(--ink);font-weight:700}
${P} .fu-gl1{margin-bottom:4px}
${P} .fu-g2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
${P} .fu-gr{display:flex;flex-wrap:wrap;align-items:center;gap:5px 10px;padding:7px 0}
${P} .fu-gr>span:not(.fb){flex:1;min-width:0}
${P} .fu-gr b{display:block;font-size:13px;font-weight:650;line-height:1.25}
${P} .fu-gr small{display:block;font-size:11.5px;color:var(--sub);line-height:1.3;margin-top:1px}
${P} .fu-gr>em{font-style:normal;font-family:var(--disp);font-weight:800;font-size:16px}
${P} .fu-gr .fl-level{flex:0 0 100%}
${P} .fu-mc{display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap}
${P} .fu-mc svg{width:28px;height:14px;color:var(--sub);flex:0 0 auto}
${P} .fu-mc span{flex:1;min-width:120px}
${P} .fu-li{display:flex;gap:10px;padding:7px 0;font-size:14px;line-height:1.4}
${P} .fu-li i{width:8px;height:10px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:var(--bad);margin-top:5px;flex:0 0 auto}
${P} .fu-why{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:4px 0 6px}
${P} .fu-why button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;border-radius:22px;background:color-mix(in srgb,var(--dom) 5%,#fff);font-size:12px;font-weight:600;text-align:center;line-height:1.2}
${P} .fu-why button.on{box-shadow:inset 0 0 0 2.5px var(--liq2)}
${P} .fu-wat{display:flex;align-items:center;gap:18px;margin:8px 0 10px}
${P} .fu-wat>div{flex:1;min-width:0}
${P} .fu-wat p{font-size:13px;color:var(--sub);margin:6px 0 12px;line-height:1.4}
${P} .fu-glass{flex:0 0 auto}
${P} .fu-gl{display:flex;flex-direction:column;align-items:center;gap:6px}
${P} .fu-gl small{font-size:11px;font-weight:700;white-space:nowrap}
${P} .fu-eqb{margin:8px 0 12px}
${P} .fu-top{display:grid;gap:10px;margin:12px 0 16px}
${P} .fu-top button{display:block;width:100%;text-align:left}
${P} .fu-top span{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:4px}
${P} .fu-top b{font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${P} .fu-top em{font-style:normal;font-family:var(--disp);font-weight:800}
${P} .fu-m3{display:flex;gap:8px;flex:1 1 100%;min-width:0}
${P} .fu-m3>span{flex:1;min-width:0}
${P} .fu-m3 small{display:block;font-size:10.5px;color:var(--sub);margin-top:3px;white-space:nowrap}
${P} .fu-m3 small b{color:var(--ink);font-weight:700;display:inline}
${P} .fu-tags{display:flex;gap:6px;flex-wrap:wrap}
${P} .fu-bubs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0 50px}
${P} .fu-pair button{align-items:flex-start;text-align:left;background:color-mix(in srgb,var(--dom) 5%,#fff);border-radius:22px}
${P} .fu-pair button small{font-family:var(--ff);font-size:11.5px;font-weight:500;color:var(--sub);line-height:1.3}
${P} .fh-pair .fb svg.ic,${P} .fb svg.ic.td{width:62%;height:62%}
${P} .fu-shelf .fh-stat .k{display:block;padding-right:44px;min-height:34px;line-height:1.25}
${P} .fu-shelf .fh-stat .n{font-size:24px}
${P} .fu-shelf .fh-stat .n small{display:block;margin:2px 0 0}
${P} .fh-stat .k{padding-right:42px}
${P} .fu-lk{display:flex;justify-content:center;padding:4px 0 2px}
${P} .fu-ip .fh-pill{padding:4px 12px 4px 4px}
${P} .fu-need{display:grid;gap:10px;margin:12px 0 14px}
${P} .fu-need small{display:block;font-size:12px;color:var(--sub);margin-bottom:4px}
${P} .fh-chart text.big{font-family:var(--disp);font-size:15px;font-weight:800;fill:var(--ink)}
${P} .fh-chart text.nm{fill:var(--ink);font-weight:600}
${P} .fh-chart text.w{fill:var(--warn);font-weight:700}
${P} .fu-tide,${P} .fu-band{margin:12px 0 10px}
${P} .fu-how .okc{fill:color-mix(in srgb,var(--dom) 42%,#fff)}
${P} .fu-how .bad{fill:color-mix(in srgb,var(--warn) 70%,#fff)}
${P} .fu-how .wband{fill:color-mix(in srgb,var(--water) 38%,transparent)}
${P} .fu-how .tr{stroke-width:2.2}
${P} .fx-wv{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--sub);margin-top:10px}
${P} .fx-wv .fl-level{flex:1}
${P} .fx-wv b{font-family:var(--disp);font-size:15px;color:var(--ink)}
${P} .fx-shh>div{flex:1;min-width:0}
${P} .fh-hero .fl-level,${P} .sheet .fl-level{background:#fff}
@media(max-width:360px){
  ${P} .fu-w{display:none}${P} .fu-s{display:inline}
  ${P} .fu-bowl .fl-fill{width:100px!important}
  ${P} .fm-n b{font-size:22px;letter-spacing:-.8px}${P} .fm-n small{font-size:9.5px}${P} .fm-g{gap:4px}
  ${P} .fu-mac .k2-vials{gap:5px}${P} .fu-mac .k2-vial b{font-size:16px}${P} .fu-mac .k2-vial small{font-size:10px}
  ${P} .fm-bh{gap:7px}${P} .fm-bh .fb{--s:36px!important}${P} .fm-bh strong{font-size:16px}${P} .fm-clock .fu-dial{width:34px!important;height:34px!important}
  ${P} .fu-ng{gap:10px}${P} .fu-ng .fu-pour{width:118px!important}${P} .fu-ng .nn .fh-big{font-size:30px}${P} .fu-pot .fl-fill{width:84px!important}
  ${P} .fu-caps{gap:6px}${P} .fu-caps i{width:16px}${P} .fu-caps .r{gap:4px}
  ${P} .fu-g2{grid-template-columns:1fr}
  ${P} .fu-wat{gap:12px}${P} .fu-glass .fl-fill{width:92px!important}
  ${P} .fu-8 .k2-vial small{font-size:10px}
}
`;

/* apró, újrarajzolás nélküli váltók: pipák, kapcsolók, választó-pirulák; + a víz pohara és az étkezés kihagyása */
if(!window.__fuelVil){window.__fuelVil=true;let dirty=false;const WH=[];
  const rr=()=>F.go(F.R+(F.ARG?'.'+F.ARG:''));
  document.addEventListener('click',e=>{
  if(!e.target.closest||!e.target.closest('.phone[data-v="feher"][data-d="fuel"]')) return;
  const q=s=>e.target.closest(s);
  let b;
  if((b=q('[data-fwadd]'))){WAT=Math.min(4000,WAT+WSEL);WH.push(WSEL);dirty=true;F.openSheet(waterSheet());return}
  if((b=q('[data-fwsel]'))){WSEL=+b.dataset.fwsel;F.openSheet(waterSheet());return}
  if((b=q('[data-fwundo]'))){if(WH.length){WAT-=WH.pop();dirty=true;F.openSheet(waterSheet())}else F.toast('Nincs mit visszavonni');return}
  if((b=q('[data-fskip]'))){SKIP[b.dataset.fskip]={};rr();F.openSheet(sheets.mealwhy(b.dataset.fskip));F.toast('Kihagyva · a kereted nem változik');return}
  if((b=q('[data-fundo]'))){delete SKIP[b.dataset.fundo];rr();F.toast('Visszavontam, az ablak újra nyitva');return}
  if((b=q('[data-fwhy]'))){const [i,c]=b.dataset.fwhy.split('|');SKIP[i]={c:+c};dirty=true;F.openSheet(sheets.mealwhy(i));if(MCATS[+c][2])F.toast('Jobbulást! Ha több napig tart, válaszd ki lent, meddig.');return}
  if(dirty&&(e.target.id==='scrim'||q('[data-close]'))){dirty=false;if(F.R==='mai')rr();return}
  const t=q('[data-ftk],[data-fsw]');
  if(t){e.preventDefault(); const on=t.classList.toggle('on'); if(t.hasAttribute('data-fsw')) t.setAttribute('aria-checked',String(on));
    F.toast(t.hasAttribute('data-fsw')?(on?'Bekapcsolva':'Kikapcsolva'):(on?'Bevéve · 14:10':'Visszavonva')); return}
  const p=q('[data-fpick] .fh-pill'); if(p){p.parentNode.querySelectorAll('.fh-pill').forEach(x=>x.classList.toggle('on',x===p)); return}
  const m=q('[data-fmulti] .fh-pill'); if(m) m.classList.toggle('on');
});}

register('fuel',{title:'Fuel',
  tabs:[['Mai','mai'],['Kiegészítők','stack'],['Trendek','trendek'],['Konyha','konyha']],
  routes:{mai,meal,score,log,konyha,kamra,receptek,recept,'recept-uj':editor,muhely,stack,protokoll,'stack-uj':stackUj,gyogyszer,trendek,beallitas,ablakok,tanulas},
  sheets,css,
  notes:`<h2>Fuel</h2>
<p>A Fuel minden oldala kapott egy saját, „folyadékos” grafikát, ami az oldal saját adatából rajzolódik. A karikák eltűntek (csak az étkezési óra maradt kerek, mert az tényleg óra), az ikonok üveg-buborékban ülnek.</p>
<h2>Mit érdemes megnézni</h2>
<ul>
<li><b>Mai:</b> a kalória-mérő most egy <b>tál</b>, ami a napi keretig töltődik; balra amit ettél, jobbra ami még belefér. Alatta az öt makró öt kémcsőben (a Víz koppintható). Az étkezés-blokkokban a karika helyett kis edény mutatja az ablak keretét, a négy makró négy kis kapszula. Az üres ablak üres edény a vízvonallal; a „Kihagyom” megkérdezi, miért.</li>
<li><b>Vércukor</b> (a sárga / zöld címke egy étkezésen): teljes doboz. A várható görbe a csúccsal és a visszatéréssel, mi emeli és mi fékezi ezen a tányéron, mit tehetsz most, mit legközelebb, és mivel párosítsd. Számot szándékosan nem ír.</li>
<li><b>Étkezési óra</b> (a kis óra a blokkon): miért ekkor, mire számíts, és a nap négy ablaka idővonalon.</li>
<li><b>Víz:</b> a pohár koppintásra töltődik.</li>
<li><b>Egy étkezés:</b> látod, mennyit töltött a nap táljába; a <b>Mezo-értékelés</b> nyolc szempontja nyolc kémcső, a leggyengébb sárga.</li>
<li><b>Logolás:</b> a tál mutatja, hova kerül, amit most írsz fel.</li>
<li><b>Trendek:</b> a hét hét edénye a keret vízvonalával; hétköznap és hétvége két közlekedőedény; a súlytrend folyadék-felszín a cél vonalával.</li>
<li><b>Kiegészítők:</b> a mai adagok kapszulákban, napszakonként; a Protokoll öt idősávja öt kémcső; a gyógyszer heti ciklusa hét szint.</li>
<li><b>Konyha:</b> a fazék annyira van tele, amennyire a recept kész; a Kamra csempéin a szint a fehérje-sűrűség.</li>
<li><b>Hogy tanultam?:</b> a tanult keret egy csepp a ± sávban; a hat lépés mindegyike saját ábrát kapott.</li>
<li><b>Beállítások, ablakok:</b> a nap mint árapály, rajta a négy étkezés edénye és a koffein-stop.</li>
</ul>
<h2>Ami visszakerült</h2>
<p>A vércukor-doboz és az étkezési óra teljes tartalma; a kihagyás okai és a kímélő mód (a Mai alján váltható); a „Honnan jön a keret?” részletei; a kiegészítő-lap adatai; a recept mikrotápanyagai; a tanulás heti részletei.</p>
<p>A fotó, a kamera, a hang és a +/− gombok koppintásra csak visszajeleznek; a pipák, kapcsolók, választó-gombok, a pohár és a kihagyás átváltanak.</p>`
});
})();
