/* vilagos/fuel.js — Fuel domain, "Folyadék" identity (Mai · Kiegészítők · Trendek · Konyha + every inner page and sheet).
   Built on window.F (vilagos/README.md, last part). Every route has its own liquid graphic drawn from its own data;
   content floor = elo/fuel.html. Route names = elo/fuel.html. */
(function(){
const {L,I,page,sec,card,head,hero,btn,lk,step,row,bar,grid,seg,pills,st,note,txt,empty,msg,chev,esc,facts,register}=F;
const {bub,vials,mini,level,fill,area,linked}=F;
const P='.phone[data-v="feher"][data-d="fuel"]';
/* ── NYELV ÉS FORMÁTUM — a Fuel közös segédei (A terület írta; a B és a C terület is ezeket használja, sajátot nem ír) ──
   L(hu,en)            egy mondat két nyelven (F.L); angolul MEGÍRVA, nem fordítva (biblia §2.5)
   EN()                igaz angol módban
   kc(n)               egész szám ezres tagolással: 3 100 · 3,100 (negatívnál „−”)
   fmt(n)              tizedes: 8,4 · 8.4 (számot vagy pontos tizedes-szöveget kap)
   dS(m,d)             rövid dátum: okt. 7. · 7 Oct           dL(m,d)  hosszú: október 7. · 7 October
   dW(w,m,d)           rövid nap + dátum: K, okt. 6. · Tue, 6 Oct      dF(w,m,d)  teljes: kedd, október 6. · Tuesday, 6 October   (w: 0 = hétfő)
   dR(m1,d1,m2,d2)     tartomány: szept. 28 – okt. 4. · 28 Sep – 4 Oct
   wd(w,long)          a hét napja: Sze · Wed / szerda · Wednesday
   dur(perc)           időtartam: 1 ó 20 p · 1 h 20 min
   pl(n,hu,one,many)   darabszám: 3 étkezés · 3 meals / 1 meal
   cap(s) nagy kezdőbetű · azA(s) magyar névelő (a vacsora / az uzsonna) */
const EN=()=>window.LANG==='en';
const fmt=n=>String(n).replace(/[.,]/,EN()?'.':',');
const kc=n=>{const v=Math.round(n);return (v<0?'−':'')+String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g,EN()?',':'\u00a0')};
const MO=[['jan.','Jan','január','January'],['febr.','Feb','február','February'],['márc.','Mar','március','March'],['ápr.','Apr','április','April'],['máj.','May','május','May'],['jún.','Jun','június','June'],['júl.','Jul','július','July'],['aug.','Aug','augusztus','August'],['szept.','Sep','szeptember','September'],['okt.','Oct','október','October'],['nov.','Nov','november','November'],['dec.','Dec','december','December']];
const WDN=[['H','Mon','hétfő','Monday'],['K','Tue','kedd','Tuesday'],['Sze','Wed','szerda','Wednesday'],['Cs','Thu','csütörtök','Thursday'],['P','Fri','péntek','Friday'],['Szo','Sat','szombat','Saturday'],['V','Sun','vasárnap','Sunday']];
const wd=(w,long)=>WDN[w][(long?2:0)+(EN()?1:0)];
const dS=(m,d)=>EN()?`${d} ${MO[m-1][1]}`:`${MO[m-1][0]} ${d}.`;
const dL=(m,d)=>EN()?`${d} ${MO[m-1][3]}`:`${MO[m-1][2]} ${d}.`;
const dW=(w,m,d)=>`${wd(w)}, ${dS(m,d)}`;
const dF=(w,m,d)=>`${wd(w,1)}, ${dL(m,d)}`;
const dR=(m1,d1,m2,d2)=>EN()?(m1===m2?`${d1}–${d2} ${MO[m2-1][1]}`:`${d1} ${MO[m1-1][1]} – ${d2} ${MO[m2-1][1]}`):(m1===m2?`${MO[m1-1][0]} ${d1}–${d2}.`:`${MO[m1-1][0]} ${d1} – ${MO[m2-1][0]} ${d2}.`);
const dur=min=>{const m=Math.abs(Math.round(min)),h=Math.floor(m/60),r=m%60;return EN()?(h&&r?`${h} h ${r} min`:h?`${h} h`:`${r} min`):(h&&r?`${h} ó ${r} p`:h?`${h} ó`:`${r} p`)};
const pl=(n,hu,one,many)=>EN()?`${n} ${n===1?one:many}`:`${n} ${hu}`;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const azA=s=>(/^[aáeéiíoóöőuúüű]/i.test(s)?'az ':'a ')+s;
/* a kit stat() sávja önmagára hivatkozó --c-t kap (style="--c:var(--c)"), ettől minden sáv a terület színére esik vissza; itt levesszük, hogy a csempe színét örökölje */
const stat=o=>F.stat({...o,n:String(o.n).replace(/ /g,' ')}).replace('style="--c:var(--c)"','');
const pc=(v,t)=>Math.max(0,Math.min(100,Math.round(v/t*100)));
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
/* ── adatok (az élő mock alapján, mai nap: szerda, október 7.) ─────────── */
/* a mai nap: szerda, 2026. október 7., 14:10. EGY forrás: a keret = Alap + Mozgás − Deficit (2 480 + 950 − 330 = 3 100); az ablakok kerete (SLOTS.b) összesen a napi keret;
   a makró-célok grammja kiadja a keretet (220×4 + 348×4 + 92×9 = 3 100). A B és a C terület is ebből olvas. */
const DAY={eaten:2060,target:3100,p:[164,220],c:[197,348],f:[64,92],fib:[18,30],water:[1.3,2.5],now:'14:10',wake:'06:30',bed:'23:00',
  train:{start:'08:30',end:'09:28',label:'Felsőtest A'},
  /* budget.energy (a szerver adja): base = tanult alap (formula = a képlet), planned = tervezett és LOGOLT edzés, extra = terven kívüli logolt mozgás, pending = még meg nem csinált tervezett edzés, balance = a cél napi része */
  energy:{base:2480,formula:2400,sd:150,conf:1,planned:420,extra:530,pending:0,balance:-330,rate:.3,blocks:[['Felsőtest A','t-dumbbell',58,420,1]]}};
/* b = az ablak saját kerete (Σ = DAY.target); why = a szerver ablak-okai (windowReasons) */
const SLOTS=[{k:'reggeli',l:'Reggeli',e:'Breakfast',ic:'t-sun',from:'07:00',to:'10:00',b:775,why:['after-wake','protein-start']},{k:'ebed',l:'Ebéd',e:'Lunch',ic:'t-bowl',from:'12:00',to:'14:30',b:1005,why:['protein-spacing']},{k:'uzsonna',l:'Uzsonna',e:'Snack',ic:'t-snack',from:'16:00',to:'17:30',b:390,why:['bridge']},{k:'vacsora',l:'Vacsora',e:'Dinner',ic:'t-moon',from:'19:00',to:'21:00',b:930,why:['protein-spacing','before-bed']}];
/* étkezés: w = ablak-index (−1 = ablak nélküli extra log); macro = [fehérje, szénhidrát, zsír] g; sugar null = a forrás nem adta meg (a vércukor-sáv ilyenkor becsül, és kimondja);
   ings = [név, ikon, kamra-azonosító, forrás (kamra | recept | becslés), kcal, mennyiség, NOVA 1–4, [fehérje, szénhidrát, zsír] g — a sor SAJÁT makrói a Kamra 100 g-os értékeiből]; az étkezés macro-ja a sorok összege, a DAY.eaten és a DAY.p/c/f elfogyasztott része az étkezések összege; q = a Minőség három ténye a bontásból (mealQualityTruth), null = nincs adat;
   headline / lead = az értékelés címsora és összegzése (régi AI-szöveg: angol módban is magyar marad); dims = a nyolc szempont pontja (DIMS sorrendjében) */
const MEALS={
  reggeli:{slot:'Reggeli',se:'Breakfast',w:0,name:'Túrós zabkása · áfonyával',time:'07:20',kcal:689,score:8.4,macro:[54,79,15],fib:7,sugar:24,salt:.3,sat:6.2,ctx:'pre',
    ings:[['Zabpehely · gluténmentes','t-carb','zab','kamra',223,'60 g',1,[8,35,4]],['Túró · félzsíros','t-meat','turo','kamra',325,'250 g',1,[45,9,11]],['Áfonya · fagyasztott','t-fiber',null,'becslés',57,'100 g',1,[1,14,0]],['Akácméz','t-sugar',null,'becslés',84,'25 g',2,[0,21,0]]],
    q:{base:88,dens:158,ultra:0},
    headline:'Fehérjében erős, tiszta tányér',lead:'A fehérje és a feldolgozottság viszi. Ezt nyugodtan ismételheted.',cert:98,dims:[8.6,7.6,8.3,8.4,9.1,8.2,8.7,8.5]},
  tizorai:{slot:'Reggeli',se:'Breakfast',w:-1,name:'Whey + banán + mandulavaj',time:'10:05',kcal:356,score:7.2,macro:[29,31,13],fib:3,sugar:null,salt:.3,sat:2.1,ctx:'post',
    ings:[['Impact Whey · csoki','t-supps','whey','kamra',120,'30 g',4,[24,2,2]],['Banán','t-carb',null,'becslés',105,'120 g',1,[1,28,0]],['Mandulavaj · 100%','t-fat','mandula','kamra',131,'20 g',2,[4,1,11]]],
    q:{base:29,dens:209,ultra:1},
    headline:'Gyors, célzott, de feldolgozott',lead:'A whey viszi a pontot, a feldolgozottság húzza le.',cert:91,dims:[8.1,6.4,8.8,7.0,5.2,6.1,7.4,8.6]},
  ebed:{slot:'Ebéd',se:'Lunch',w:1,name:'Csirke + édesburgonya + spenót',time:'12:40',kcal:1015,score:8.1,macro:[81,87,36],fib:8,sugar:17,salt:null,sat:5.4,
    ings:[['Csirkemell · friss','t-meat','csirke','kamra',330,'300 g',1,[69,0,5]],['Édesburgonya','t-carb','edesburgonya','kamra',344,'400 g',1,[6,80,0]],['Spenót · friss','t-fiber',null,'becslés',46,'200 g',1,[6,7,1]],['Olívaolaj · extra szűz','t-avocado',null,'becslés',295,'33 ml',2,[0,0,30]]],
    q:{base:71,dens:null,ultra:0},
    headline:'Kiegyensúlyozott, edzés utánra ideális',lead:'Minden makró a helyén; a zsír is mértékkel.',cert:95,dims:[9.0,7.9,8.1,8.8,8.4,7.8,8.2,8.9]}
};
const CAT={reggeli:['Reggeli','t-sun'],ebed:['Ebéd','t-bowl'],uzsonna:['Uzsonna','t-snack'],vacsora:['Vacsora','t-moon']};
/* C terület · a recept sorai: ings = [kamra-azonosító, mennyiség az EGÉSZ receptre, a sor tárolt kcal-ja] — a mentett recept minden sora Kamra-tétel (mentés-kapu), a sorok kcal-ja kiadja a receptét;
   role: '' | pre | post (RecipeRole) · last = [hány napja, idő] | null (a szerver ADATOT ad, nem mondatot) · date = [hónap, nap] · fib/sugar/salt/sat = a recept tárolt tényei az egész receptre (null = a forrás nem adta)
   today = a recept MAI logjai [étkezés-azonosító] (useRecipeLogs: csak a mai nap) · fits = fitsFor[0], prose = a bontás summary-ja (tárolt AI-szöveg: angol módban is magyar) · dims/cert/headline/lead = a sablon-bontás */
const REC=[
  {id:'r1',n:'Túrós zabkása · áfonyával',cat:'reggeli',serv:1,kcal:689,p:49,c:74,f:22,min:8,role:'pre',star:1,logged:12,last:[0,'07:20'],score:8.4,nova:1,date:[4,14],fib:7,sugar:24,salt:.3,sat:6.2,today:['reggeli'],
    ings:[['zab',60,223],['turo',250,325],['afonya',100,57],['mez',25,84]],fits:'Edzés előtti reggelire jó',prose:'Lassú szénhidrát és sok fehérje; edzés előtt 2–3 órával ideális, a túró kazeinje sokáig kitart.',
    cert:92,headline:'Fehérjében erős, tiszta sablon',lead:'A fehérje és a feldolgozottság viszi; a méz adja a cukor nagy részét.',dims:[8.6,7.6,8.3,8.4,9.1,8.2,8.7,8.5],imp:[['A méz fele is elég: a cukor az adag keretén belül marad.',.1]]},
  {id:'r2',n:'Csirke + édesburgonya + spenót',cat:'ebed',serv:2,kcal:2030,p:126,c:240,f:50,min:30,role:'',star:1,logged:18,last:[0,'12:40'],score:8.1,nova:1,date:[4,20],fib:16,sugar:34,salt:null,sat:10.8,today:['ebed'],
    ings:[['csirke',600,660],['edesburgonya',800,688],['spenot',400,92],['olaj',66,590]],fits:'Edzés utáni ebédnek jó',prose:'Sok fehérje és elég szénhidrát a visszatöltéshez; az olaj adja a zsír nagy részét.',
    cert:88,headline:'Kiegyensúlyozott, sok alapanyagból',lead:'Minden makró a helyén; a só a forrásból hiányzik.',dims:[9.0,7.9,8.1,8.8,8.4,7.8,8.2,7.6],imp:[['Egy marék hüvelyes a tálba: a rost és a növényi változatosság is nő.',.2]]},
  {id:'r3',n:'Lazac + barna rizs + brokkoli',cat:'vacsora',serv:2,kcal:1636,p:98,c:148,f:74,min:23,role:'post',star:1,logged:24,last:[4,null],score:7.9,nova:1,date:[5,2],fib:14,sugar:8,salt:1.2,sat:13,today:[],
    ings:[['lazac',400,832],['rizs',160,561],['brokkoli',400,136],['olaj',12,107]],fits:'Edzés utáni vacsorának jó',prose:'A lazac zsírja jó minőségű; a rizs visszatölt, a brokkoli adja a rostot.',
    cert:90,headline:'Jó zsírok, teljes értékű köret',lead:'A zsírminőség viszi; az energiasűrűség közepes.',dims:[8.0,8.1,8.4,8.9,8.6,7.2,6.9,7.4],imp:[]},
  {id:'r6',n:'Túró · áfonya · méz quick',cat:'uzsonna',serv:1,kcal:324,p:36,c:24,f:10,min:2,role:'',star:0,logged:14,last:[1,'16:10'],score:null,nova:1,date:[5,11],fib:2,sugar:17,salt:.2,sat:3.9,today:[],
    ings:[['turo',200,260],['afonya',60,34],['mez',9,30]],fits:null,prose:null},
  {id:'r4',n:'Whey + banán + mandulavaj',cat:'uzsonna',serv:1,kcal:356,p:36,c:30,f:11,min:2,role:'',star:0,logged:22,last:[0,'10:05'],score:7.2,nova:4,date:[5,15],fib:3,sugar:null,salt:.3,sat:2.1,today:['tizorai'],
    ings:[['whey',30,120],['banan',120,105],['mandula',20,131]],fits:'Gyors fehérje edzés után',prose:'Gyors fehérje; a banán szénhidrátja jól jön edzés után, a whey feldolgozottsága húzza le.',
    cert:84,headline:'Gyors, célzott, de feldolgozott',lead:'A whey viszi a pontot, a feldolgozottság húzza le.',dims:[8.1,6.4,8.8,7.0,5.2,6.1,7.4,7.9],imp:[['Whey helyett egy pohár görög joghurt: a feldolgozottság pontja ugrana.',.4]]},
  {id:'r5',n:'Tojásrántotta · spenóttal',cat:'reggeli',serv:1,kcal:318,p:24,c:4,f:23,min:0,role:'',star:0,logged:8,last:[5,null],score:7.6,nova:1,date:[6,3],fib:2,sugar:1,salt:.9,sat:5.1,today:[],
    ings:[['tojas',150,215],['spenot',100,23],['olaj',9,80]],fits:'Alacsony szénhidrátú reggelre jó',prose:'Kevés szénhidrát, sok fehérje és zsír; pihenőnap reggelére való.',
    cert:86,headline:'Kevés szénhidrát, sok fehérje',lead:'A makróarány eltér a célodtól; a többi rendben.',dims:[6.4,6.9,8.6,7.1,9.0,6.2,7.8,8.0],imp:[]}];
const KIND={food:['t-carb','étel'],supp:['t-supps','kiegészítő'],stim:['t-bolt','stimuláns'],med:['t-syringe','gyógyszer']};
/* a felvétel MÓDJA a forrás-kulcsból (logic/pantryProvenance): fotó · link (web) · katalógus (minden nevesített bolt) · kézi */
const SRC={foto:['t-camera','fotó','photo'],link:['t-link','link','link'],kat:['t-stack','katalógus','catalogue'],kezi:['t-journal','kézi','by hand']};
/* Kamra-tétel (PantryItem): k = fajta · cat = kategória · src/sl = felvétel módja és a forrás neve · at = [hónap, nap, idő] | null (scrapedAt) · shared = a közös katalógus szerzője (sharedFrom) · lock = más definíciója (catalogEditable false)
   kcal, p, c, f / 100 g (u = egység, alapból g) · sug, salt, sat = tárolt szöveg (magyar tizedes) · nova = NOVA rövid neve, nv = a csoport száma · price = [Ft, egység] · proto = a kiegészítő protokoll-szövege (a felhasználó beírt szövege) */
const KAM=[
  {id:'csirke',n:'Csirkemell · friss',b:'Bonafarm',k:'food',cat:'Fehérje',src:'kat',sl:'kifli.hu',at:[5,20,'09:14'],kcal:110,p:23,c:0,f:1.5,sug:'0',salt:'0,1',sat:'0,4',nova:'Alapanyag',nv:1,price:[3290,'/kg']},
  {id:'turo',n:'Túró · félzsíros',b:'Mizo',k:'food',cat:'Tejtermék',src:'foto',sl:'Fotó',at:[5,22,'18:02'],kcal:130,p:18,c:3.5,f:4.5,sug:'3,5',salt:'0,1',sat:'2,9',nova:'Alapanyag',nv:1,price:[2180,'/kg']},
  {id:'lazac',n:'Lazacfilé · norvég',b:'Kifli Premium',k:'food',cat:'Hal',src:'kat',sl:'kifli.hu',at:[6,2,'07:40'],kcal:208,p:20.4,c:0,f:13.4,sug:'0',salt:'0,2',sat:'3,1',nova:'Alapanyag',nv:1,price:[14990,'/kg']},
  {id:'zab',n:'Zabpehely · gluténmentes',b:'Naturmind',k:'food',cat:'Gabona',src:'link',sl:'Web',at:[4,30,'20:11'],shared:'Anna',lock:1,kcal:372,p:13,c:59,f:7,sug:'1,1',salt:'0',sat:'1,3',nova:'Alapanyag',nv:1,price:[1890,'/kg']},
  {id:'mandula',n:'Mandulavaj · 100%',b:'Nutsi',k:'food',cat:'Mag / olajos',src:'kezi',sl:'Saját bevitel',at:null,kcal:614,p:21,c:7,f:53,sug:'4,4',salt:'0',sat:'4,2',nova:'Konyhai összetevő',nv:2,price:null},
  {id:'edesburgonya',n:'Édesburgonya',b:'Tesco',k:'food',cat:'Zöldség',src:'kat',sl:'tesco.hu',at:[5,20,'09:20'],kcal:86,p:1.6,c:20,f:.1,sug:'4,2',salt:'0,1',sat:'0',nova:'Alapanyag',nv:1,price:[899,'/kg']},
  {id:'spenot',n:'Spenót · friss',b:'Kifli',k:'food',cat:'Zöldség',src:'kat',sl:'kifli.hu',at:[5,20,'09:22'],kcal:23,p:2.9,c:3.6,f:.4,sug:'0,4',salt:'0,2',sat:'0,1',nova:'Alapanyag',nv:1,price:[2990,'/kg']},
  {id:'brokkoli',n:'Brokkoli',b:'Kifli',k:'food',cat:'Zöldség',src:'kat',sl:'kifli.hu',at:[6,2,'07:44'],kcal:34,p:2.8,c:7,f:.4,sug:'1,7',salt:'0,1',sat:'0',nova:'Alapanyag',nv:1,price:[1290,'/kg']},
  {id:'afonya',n:'Áfonya · fagyasztott',b:'Ardo',k:'food',cat:'Gyümölcs',src:'foto',sl:'Fotó',at:[5,22,'18:05'],kcal:57,p:.7,c:14,f:.3,sug:'10',salt:'0',sat:'0',nova:'Alapanyag',nv:1,price:[3490,'/kg']},
  {id:'banan',n:'Banán',b:'Chiquita',k:'food',cat:'Gyümölcs',src:'kezi',sl:'Saját bevitel',at:null,kcal:88,p:1.1,c:23,f:.3,sug:'12',salt:'0',sat:'0,1',nova:'Alapanyag',nv:1,price:null},
  {id:'rizs',n:'Barna rizs',b:'Riceland',k:'food',cat:'Gabona',src:'kat',sl:'tesco.hu',at:[6,2,'07:48'],kcal:351,p:7.5,c:73,f:2.7,sug:'0,7',salt:'0',sat:'0,6',nova:'Alapanyag',nv:1,price:[1190,'/kg']},
  {id:'bulgur',n:'Bulgur',b:'Kifli',k:'food',cat:'Gabona',src:'link',sl:'Web',at:[9,28,'19:02'],shared:'Mezo',lock:1,kcal:342,p:12,c:76,f:1.3,sug:'0,4',salt:'0',sat:'0,2',nova:'Alapanyag',nv:1,price:[990,'/kg']},
  {id:'tojas',n:'Tojás · M-es',b:'Tanyasi',k:'food',cat:'Tojás',src:'kezi',sl:'Saját bevitel',at:null,kcal:143,p:12.6,c:.7,f:9.5,sug:'0,4',salt:'0,4',sat:'3,1',nova:'Alapanyag',nv:1,price:null},
  {id:'olaj',n:'Olívaolaj · extra szűz',b:'Borges',k:'food',u:'ml',cat:'Olaj / zsír',src:'kat',sl:'auchan.hu',at:[5,18,'11:30'],kcal:894,p:0,c:0,f:91,sug:'0',salt:'0',sat:'13',nova:'Konyhai összetevő',nv:2,price:[4290,'/l']},
  {id:'mez',n:'Akácméz',b:'Hungary Honey',k:'food',cat:'Egyéb',src:'foto',sl:'Fotó',at:[5,22,'18:09'],kcal:336,p:.3,c:82,f:0,sug:'82',salt:'0',sat:'0',nova:'Konyhai összetevő',nv:2,price:[4990,'/kg']},
  {id:'whey',n:'Impact Whey · csoki',b:'MyProtein',k:'supp',cat:'Tejsavófehérje',src:'kat',sl:'myprotein.hu',at:[5,4,'11:20'],dose:'30 g',kcal:400,p:80,c:7,f:6.5,sug:'5',salt:'0,5',sat:'4',nova:'Ultra-feldolgozott',nv:4,price:[11990,'/kg'],proto:'Fehérjés reggelihez'},
  {id:'kreatin',n:'Kreatin-monohidrát',b:'MyProtein',k:'supp',cat:'Kiegészítő',src:'kat',sl:'myprotein.hu',at:[5,4,'11:22'],dose:'5 g',proto:'Reggel, vízben oldva'},
  {id:'aakg',n:'AAKG · L-arginin',b:'GymBeam',k:'stim',cat:'Stimuláns',src:'foto',sl:'Fotó',at:[6,10,'17:45'],dose:'6 g',proto:'Edzés előtt, vízben oldva'},
  /* B terület: a protokoll tételei birtokolt Kamra-tételek */
  {id:'gomba',n:'Tasty Dose gombakávé',b:'Tasty Dose',k:'stim',cat:'Stimuláns',src:'foto',sl:'Fotó',at:[6,12,'08:05'],dose:'8 g',proto:'Reggel, a kávé helyett'},
  {id:'pwo',n:'Origin PWO',b:'Origin',k:'stim',cat:'Stimuláns',src:'link',sl:'Web',at:[6,12,'08:09'],dose:'20 g',proto:'Edzés előtt 20–30 perccel'},
  {id:'d3k2',n:'D3 + K2',b:'MyProtein',k:'supp',cat:'Kiegészítő',src:'kat',sl:'myprotein.hu',at:[5,4,'11:25'],dose:'4000 NE + 100 µg',proto:'Naponta zsírral · délben a legjobb'},
  {id:'omega',n:'Omega-3',b:'GymBeam',k:'supp',cat:'Kiegészítő',src:'kat',sl:'gymbeam.hu',at:[5,6,'19:30'],dose:'2 g EPA+DHA',proto:'Ebédhez · zsírral szívódik fel'},
  {id:'magn',n:'Magnézium-glicinát',b:'Naturmind',k:'supp',cat:'Kiegészítő',src:'link',sl:'Web',at:[5,6,'19:34'],shared:'Anna',lock:1,dose:'300 mg',proto:'Lefekvés előtt kb. 2 órával'},
  {id:'cink',n:'Cink-biszglicinát',b:'GymBeam',k:'supp',cat:'Kiegészítő',src:'foto',sl:'Fotó',at:[9,30,'18:20'],dose:'15 mg'}];
/* a tanulás hetei: [[hónap, nap] a hét kezdete, képlet, tanult alap, ± sáv, a keret alapja, várt-e]; null = erről a hétről nincs sor */
const WK=[[[7,13],2396,2440,285,2400,1],[[7,20],2402,2465,265,2430,0],null,[[8,3],2405,2470,245,2455,0],[[8,10],2398,2462,235,2455,1],[[8,17],2400,2485,220,2475,0],[[8,24],2403,2460,205,2455,0],[[8,31],2401,2452,190,2455,1],[[9,7],2399,2445,178,2440,0],[[9,14],2400,2450,165,2420,0],[[9,21],2400,2470,150,2420,0],[[9,28],2400,2480,150,2480,0]];
/* az utolsó 14 nap a tanulásban (a mai nélkül): [hét napja 0 = hétfő, hónap×100 + nap, kcal | null, állapot]. A heti nézet (B terület) ugyanezeket a napi kcal-okat használja:
   hétfő okt. 5. = nincs felírva · kedd okt. 6. = 1 020 kcal (a 2 870-es keretből) · szerda okt. 7. = DAY */
const LD=[[1,1006,1020,'suspicious'],[0,1005,null,'unlogged'],[6,1004,3120,'usable'],[5,1003,2760,'usable'],[4,1002,1180,'suspicious'],[3,1001,1610,'confirmed_complete'],[2,930,2820,'usable'],[1,929,2980,'usable'],[0,928,2150,'marked_incomplete'],[6,927,3050,'usable'],[5,926,null,'unlogged'],[4,925,1340,'suspicious'],[3,924,2890,'usable'],[2,923,2710,'usable']];
const MIC={reggeli:'t-sun',tizorai:'t-snack',ebed:'t-bowl'};
const KIC={'Fehérje':'t-meat','Tejtermék':'t-protein','Hal':'t-meat','Gabona':'t-carb','Mag / olajos':'t-avocado','Zöldség':'t-fiber','Gyümölcs':'t-fiber','Tojás':'t-meat','Olaj / zsír':'t-avocado','Egyéb':'t-sugar'};
const kic=k=>k.k==='food'?(KIC[k.cat]||'t-carb'):KIND[k.k][0];

/* ── kis segédek (a kit fölé, csak Fuel) ───────────────────────── */
/* nh: hős nagy számmal — szám → ítélet-mondat → egy gomb */
const nh=(o,i)=>hero({...o,lbl:o.art?`<span class="fx-la">${o.lbl||''}</span>`:o.lbl,
  verdict:`<span class="fh-big fx-n${o.art?' art':''}">${o.n}${o.unit?`<small>${o.unit}</small>`:''}</span>${o.verdict}`},i);
const hi=id=>bub(id,{s:64});
/* mrow: egy sor = buborék-ikon + név + érték + vízszintes szint */
const mrow=(l,v,pct,c,ic)=>`<div class="fh-mus fu-mr">${ic?bub(ic,{s:30,c}):''}<span class="l">${l}</span><span class="v">${v}</span>${level(pct,{c,h:12})}</div>`;
/* split: egy edény több folyadékkal (energia-megoszlás, összetétel) + jelmagyarázat */
const split=(a,{h=22}={})=>`<div class="fu-split" style="height:${h}px">${a.map(([,p,c])=>p>0?`<i style="flex:${p} 1 0;--c:${c}"></i>`:'').join('')}</div><div class="fu-leg">${a.map(([l,p,c,v])=>`<span style="--c:${c}"><i></i>${l}<b>${v??p+'%'}</b></span>`).join('')}</div>`;
const mk=(p,c,f)=>{const t=p*4+c*4+f*9||1;return [[L('Fehérje','Protein'),Math.round(p*4/t*100),'var(--protein)'],[L('Szénhidrát','Carbs'),Math.round(c*4/t*100),'var(--carb)'],[L('Zsír','Fat'),Math.round(f*9/t*100),'var(--fat)']]};
/* macroVials: a három makró kémcsőben — gramm a szám, az energia-arány a szint */
const macroVials=(p,c,f,o={})=>{const s=mk(p,c,f);return vials([['t-meat',p],['t-carb',c],['t-avocado',f]].map(([ic,g],i)=>({l:s[i][0],ic,c:s[i][2],p:Math.max(6,s[i][1]),v:fmt(g)+' g',s:L(s[i][1]+'% energia',s[i][1]+'% of energy'),on:{toast:L(`${s[i][0]}: ${fmt(g)} g · az energia ${s[i][1]}%-a`,`${s[i][0]}: ${fmt(g)} g · ${s[i][1]}% of the energy`)}})),{h:o.h||104})};
const lab=t=>`<span class="fh-lab">${t}</span>`;
const inp=(l,v,ph,type)=>`<input class="fh-in" ${type?`type="${type}"`:''} value="${esc(v||'')}" placeholder="${esc(ph||'')}" aria-label="${esc(l)}">`;
const fld=(l,v,ph,type)=>lab(l)+inp(l,v,ph,type);
const sel=(l,v)=>lab(l)+`<button class="fh-in fx-sel" data-toast="${esc(l)}"><span>${v}</span><i>▾</i></button>`;
const multi=(l,a)=>lab(l)+`<div class="fx-multi" style="grid-template-columns:repeat(${a.length>3?2:a.length},1fr)">${a.map(([v,ph])=>inp(ph||l,v,ph)).join('')}</div>`;
const stp=(v,u,t=L('Mennyiség','Amount'))=>`<span class="fx-stp"><button data-toast="${esc(t)}: ${L('kevesebb','less')}" aria-label="${L('Kevesebb','Less')}">−</button><b>${v}</b><small>${u}</small><button data-toast="${esc(t)}: ${L('több','more')}" aria-label="${L('Több','More')}">+</button></span>`;
/* pick: választó-pirulák, a koppintott lesz az aktív (helyben, újrarajzolás nélkül) */
const pick=(opts,on,pre='Szűrő')=>`<div class="fh-pills" data-fpick>${opts.map(o=>{const [l,n]=Array.isArray(o)?o:[o];return `<button class="fh-pill ${l===on?'on':''}" data-toast="${esc(pre+': '+l)}">${l}${n!=null?`<b>${n}</b>`:''}</button>`}).join('')}</div>`;
/* ipills: pirulák buborék-ikonnal (ikon sosem áll csupaszon) */
const ipills=a=>`<div class="fh-pills fu-ip">${a.map(([l,x,on,ic])=>`<button class="fh-pill ${on?'on':''}"${F.act(x)}>${ic?bub(ic,{s:26}):''}${l}</button>`).join('')}</div>`;
const sw=(on,label)=>`<button class="fx-sw ${on?'on':''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" data-fsw></button>`;
const tk=(on,label)=>`<button class="fx-tk ${on?'on':''}" data-ftk aria-label="${esc(label)}">${I('i-check')}</button>`;
/* irow: tétel-sor két sorban — fent név és érték, alatta a léptető / szint (320 px-en is elfér) */
const irow=(o)=>`<${o.on?'button':'div'} class="fh-row fx-it"${F.act(o.on)}>${o.icon?`<span class="si">${I(o.icon)}</span>`:''}<span class="g"><strong>${o.title}</strong>${o.sub?`<small>${o.sub}</small>`:''}</span>${o.v!=null?`<span class="v">${o.v}</span>`:''}<div class="fx-l2">${o.l2||''}</div></${o.on?'button':'div'}>`;
const srch=(t,val)=>`<div class="fx-srch" ${val?'':`data-toast="${esc(t)}"`}>${bub('t-lens',{s:28})}${val?`<span>${val}</span><i>×</i>`:t}</div>`;
const acts=h=>`<div class="fh-acts">${h}</div>`;
const closeLk=(l=L('Bezárom','Close'))=>`<button class="fh-lk" data-close>${l}</button>`;
const sh=(ic,t,sub)=>`<div class="fx-shh">${ic?bub(ic,{s:48}):''}<div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div></div>`;
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
const dial=(s,at,sz=40)=>{const ang=t=>(toMin(t)%720)/720*2*Math.PI-Math.PI/2,Pt=(t,r)=>[22+r*Math.cos(ang(t)),22+r*Math.sin(ang(t))],[x1,y1]=s?Pt(s.from,15.5):[0,0],[x2,y2]=s?Pt(s.to,15.5):[0,0],d=at?Pt(at,15.5):null,inw=!s||(at&&toMin(at)>=toMin(s.from)&&toMin(at)<=toMin(s.to));
  return `<svg class="fu-dial" viewBox="0 0 44 44" style="width:${sz}px;height:${sz}px" aria-hidden="true"><circle cx="22" cy="22" r="20.5" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="1.5"/>${[0,1,2,3].map(q=>`<path d="M22 6.5V9" transform="rotate(${q*90} 22 22)" stroke="var(--faint)" stroke-width="1.5" stroke-linecap="round"/>`).join('')}
    ${s?`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A15.5 15.5 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--dom)" stroke-width="4.5" stroke-linecap="round"/>`:''}${d?`<circle cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="3.4" fill="${inw?'#fff':'var(--warn)'}" stroke="${inw?'var(--liq2)':'#fff'}" stroke-width="1.8"/>`:''}<circle cx="22" cy="22" r="1.8" fill="var(--ink)"/></svg>`};
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
const lS=(a,s)=>`<span class="fu-w">${a}</span><span class="fu-s">${s}</span>`;

/* ═══ MAI ════════════════════════════════════════════════════
   Élő forrás: FuelMaiPage + FuelEnergyHero + FuelMacroRings + FuelMealBlocks + DayLearningMark (+ a kímélő arcok:
   FuelGuidanceCard, FuelRecoveryStrip, FuelRecoveryNote). Minden állapot útvonal-argumentum (#w-fuel-mai.<arg>), a lapon nincs demó-kapcsoló:
   tegnap · ures (lezárt nap adat nélkül) · kihagyva · kihagyva-ok · kimelo (gyomorrontás) · beteg · serules (hiány kikapcsolva) ·
   serules-tartas · uton · nincs-ablak · nincs-cel (statikus keret, nincs bontás) · felett · kesz · javaslat (diéta-javaslat sáv) · tolt · hiba */
let SKIP={}, WAT=1300, WSEL=null, WHIST=[], CUR=null;
const MCATS=[['t-nohunger',['Nem vagyok éhes','Not hungry'],0],['t-clock',['Nincs időm','No time'],0],['t-digestion',['Gyomorrontás','Stomach bug'],1],['t-ill',['Beteg vagyok','I’m ill'],1],['t-travel',['Úton vagyok','Travelling'],1],['t-other',['Egyéb','Other'],0]];
const mcl=c=>L(...MCATS[c][1]);
const skLabel=sk=>sk.c==null?L('ok nélkül','no reason given'):sk.c===5?(sk.t?L(`„${sk.t}”`,`“${sk.t}”`):mcl(5)):mcl(sk.c);
const sl=s=>L(s.l,s.e);
/* a nap további étkezései az „kesz” / „felett” archoz; a vacsora friss log: az értékelése még készül (score null → „folyamatban”) */
const MX={
  uzsonna:{slot:'Uzsonna',se:'Snack',w:2,name:'Túró · áfonya · méz quick',time:'16:10',kcal:324,score:7.8,macro:[36,22,9],fib:2,sugar:17,salt:.2,sat:3.9,rec:'r6',
    ings:[['Túró · áfonya · méz quick','t-book',null,'recept',324,'1 adag',null,[36,22,9]]],q:{base:68,dens:185,ultra:0},
    headline:'Gyors fehérje edzés előttre',lead:'Könnyű és fehérjedús; a méz adja a gyors energiát.',cert:84,dims:[8.2,6.9,7.4,7.8,7.0,5.5,8.8,9.0]},
  vacsora:{slot:'Vacsora',se:'Dinner',w:3,name:'Lazac + barna rizs + brokkoli',time:'19:40',kcal:636,score:null,macro:[41,68,23],fib:6,sugar:4,salt:.9,sat:5.2,
    ings:[['Lazacfilé · norvég','t-meat','lazac','kamra',312,'150 g',1,[31,0,20]],['Barna rizs · főtt','t-carb',null,'becslés',276,'240 g',1,[6,58,2]],['Brokkoli · párolt','t-fiber',null,'becslés',48,'140 g',1,[4,10,1]]],q:{base:100,dens:120,ultra:0}}
};
/* tegnap (kedd, okt. 6.) két felírt étkezése — a lezárt nap arcához és a nap-lapozóhoz */
const YM={y1:{slot:'Reggeli',se:'Breakfast',w:0,past:1,name:'Kávé és vajas kifli',time:'09:20',kcal:330,score:6.1,macro:[9,39,17],fib:2,sugar:6,salt:.9,sat:6.8,
    ings:[['Vajas kifli','t-carb',null,'becslés',290,'2 db',3,[7,36,15]],['Tejeskávé','t-tea',null,'becslés',40,'200 ml',1,[2,3,2]]],q:{base:12,dens:null,ultra:0},headline:'Gyors reggeli, kevés fehérjével',lead:'A fehérje és a rost hiányzik belőle.',cert:72,dims:[5.2,4.8,6.9,5.0,6.0,3.5,6.4,7.8]},
  y2:{slot:'Ebéd',se:'Lunch',w:1,past:1,name:'Gulyásleves',time:'13:10',kcal:690,score:7.4,macro:[42,65,27],fib:7,sugar:9,salt:1.6,sat:6.4,
    ings:[['Gulyásleves','t-pot',null,'becslés',560,'500 g',1,[38,40,26]],['Fehér kenyér','t-carb',null,'becslés',130,'50 g',3,[4,25,1]]],q:{base:81,dens:125,ultra:0},headline:'Laktató, fehérjében erős',lead:'A só az étkezés keretének felső szélén van.',cert:78,dims:[7.8,7.0,5.9,6.8,7.6,6.5,8.4,8.0]}};
/* SCREC: ide regisztrálhat más terület értékelhető rekordot (pl. recept: SCREC['r-r1']={…}), hogy a scoreSurface és a „dim” lap megtalálja */
const SCREC={};
const mealOf=id=>MEALS[id]||MX[id]||YM[id]||SCREC[id]||null;
/* a vércukor-válasz három sávja — a logic/glycemicBand.ts szó szerinti tükre: a belső index SOHA nem kerül a felületre */
const gIdx=(c,s,fi,p,f)=>c*(.6+.4*Math.min(1,s/Math.max(1,c)))-(fi*2+p*.25+f*.2);
const gLvl=x=>x<12?0:x<24?1:2;
const GLW=[['alacsony','low'],['közepes','medium'],['magas','high']];
const glw=(i,up)=>{const w=L(...GLW[i]);return up?cap(w):w};
function gBand(m){
  if(!m||m.macro[1]==null) return null;
  const [p,c,f]=m.macro, est=m.sugar==null, s=est?c*.3:m.sugar, fi=m.fib||0, base=gIdx(c,s,fi,p,f), lvl=gLvl(base);
  const sugary=s>=c*.45&&s>=12, bare=fi<4&&p<15;
  const tip=lvl===0?[L('Szép egyensúly','A good balance'),L('A fehérje és a rost lassan engedi fel a vércukrot: ez a tányér magától simít.','Protein and fibre release the sugar slowly: this plate evens itself out.')]
    :lvl===2?(sugary?[L('Öltöztesd fel a szénhidrátot','Dress the carbs'),L('Az édes rész magában gyorsan felszívódik. Egy kis fehérje vagy zsír mellé (joghurt, dió) sokat lapít a csúcson.','The sweet part is absorbed fast on its own. A little protein or fat with it (yoghurt, nuts) flattens the peak a lot.')]
      :[L('Egy séta most sokat ér','A walk now helps a lot'),L('10–15 perc mozgás evés után: az izmok azonnal elhasználják a glükóz egy részét, a csúcs láthatóan kisebb lesz.','10–15 minutes of movement after eating: your muscles use some of the glucose at once, and the peak gets visibly smaller.')])
    :(bare?[L('Rost előre','Fibre first'),L('Pár falat zöldség vagy saláta a szénhidrát előtt lassítja a felszívódást, a domb így laposabb.','A few bites of vegetables or salad before the carbs slow the absorption, so the hill is flatter.')]
      :[L('Jó irány, egy aprósággal','Good direction, with one small thing'),L('Ha teheted, a zöldséget és a fehérjét edd előre, a szénhidrátot utoljára: a sorrend önmagában simít a görbén.','If you can, eat the vegetables and the protein first and the carbs last: the order alone smooths the curve.')]);
  const EXP=[[L('Egyenletes energia 3–4 órára','Steady energy for 3–4 hours'),L('Kb. 2 óra múlva ér vissza az alapszintre, finoman','Back to baseline in about 2 hours, gently'),L('Az éhség későn, fokozatosan tér vissza','Hunger returns late and gradually')],
    [L('Stabil energia 2–3 órára','Stable energy for 2–3 hours'),L('Kb. 2 óra múlva újra alapszinten','Back at baseline in about 2 hours'),L('Az éhség 2–3 óra múlva jelentkezik','Hunger shows up in 2–3 hours')],
    [L('Gyors löket, majd visszaesés','A quick boost, then a dip'),L('Kb. 1,5 óra múlva zuhan, az alapszint alá is eshet','Drops in about 1.5 hours and may fall below baseline'),L('A visszaesés után korán, akár 1–1,5 óra múlva újra megéhezhetsz','After the dip you may be hungry again early, in 1–1.5 hours')]][lvl];
  /* „Legközelebb így lesz laposabb”: a két legtöbbet simító csere, és hogy együtt melyik sávba vinnék (improveFor) */
  let improve=null;
  if(lvl>0){const P0={c,s,fi,p,f},ix=o=>gIdx(o.c,o.s,o.fi,o.p,o.f),cand=[];
    if(!est&&s>=10)cand.push([L('Feleannyi édes rész','Half the sweet part'),L('Az édes összetevőből (méz, lekvár, gyümölcslé, cukros öntet) elég a fele: ez a leggyorsabban felszívódó rész.','Half of the sweet ingredient (honey, jam, juice, sugary dressing) is enough: it is the part absorbed fastest.'),o=>({...o,c:o.c-o.s/2,s:o.s/2})]);
    if(c-s>=40)cand.push([L('Negyeddel kisebb köret','A quarter less of the side'),L('A kenyérből, tésztából, rizsből vagy krumpliból negyeddel kevesebb; a helyére jöhet zöldség.','A quarter less bread, pasta, rice or potato; vegetables can take its place.'),o=>({...o,c:o.c-(o.c-o.s)*.25})]);
    cand.push([L('Rost mellé','Add fibre'),L('Egy marék zöldség, saláta vagy egy evőkanál chiamag a tányér mellé: a rost fékezi a felszívódást.','A handful of vegetables, salad or a tablespoon of chia seeds on the side: fibre slows the absorption.'),o=>({...o,fi:o.fi+5})]);
    if(p<30)cand.push([L('Fehérje mellé','Add protein'),L('150 g túró, görög joghurt vagy két tojás mellé: a fehérje lassítja a csúcsot.','150 g of cottage cheese, Greek yoghurt or two eggs with it: protein slows the peak.'),o=>({...o,p:o.p+18})]);
    const top=cand.map(x=>({x,g:base-ix(x[2](P0))})).sort((a,b)=>b.g-a.g).slice(0,2);
    improve={steps:top.map(({x})=>[x[0],x[1]]),result:gLvl(ix(top.reduce((o,{x})=>x[2](o),P0)))}}
  return {lvl,est,tip,exp:EXP,improve,facts:[[L('szénhidrát','carbs'),`${Math.round(c)} g`],[L('ebből cukor','of which sugar'),est?L('becsült','estimated'):`${Math.round(s)} g`],[L('rost','fibre'),`${Math.round(fi)} g`],[L('fehérje','protein'),`${Math.round(p)} g`]]}}
/* a három válasz-görbe (GlycemicGlass CURVE, 1:1) folyadék-felszínként; tengelyén nincs szám */
const GCV=[{d:'M8 78C56 76 92 62 128 60 166 60 200 72 232 78',pk:[128,60],n:['lapos domb','a low hill']},{d:'M8 78C50 76 76 42 116 40 158 40 190 68 232 78',pk:[116,40],n:['enyhe emelkedés','a mild rise']},{d:'M8 78C46 76 62 14 90 12 112 11 122 52 142 82 160 106 208 90 232 84',pk:[90,12],n:['csúcs','peak']}];
const GCOL=['var(--ok)','var(--warn)','var(--lilac)'];
const gMini=(l,late)=>`<svg class="fu-gmini" viewBox="0 0 240 108" aria-hidden="true"><path d="M8 78H232" stroke="currentColor" stroke-width="3" stroke-dasharray="6 10" opacity=".35"/>${late?`<path d="${GCV[l].d}" transform="translate(8 78) scale(1.12 1.13) translate(-8 -78)" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="8 9" opacity=".5"/>`:''}<path d="${GCV[l].d} L232 108 8 108Z" fill="currentColor" opacity=".22"/><path d="${GCV[l].d}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>`;
const gCurve=l=>{const id=F.uid('gc'),c=GCV[l],AX=[[8,L('evés','meal'),'start'],[82,L('+1 ó','+1 h'),'middle'],[157,L('+2 ó','+2 h'),'middle'],[232,L('+3 ó','+3 h'),'end']];
  return `<svg class="fh-chart fu-gcv" viewBox="0 0 240 128" role="img" aria-label="${L('A várható vércukor-válasz alakja három órán át: ','The expected shape of the blood sugar response over three hours: ')}${L(...c.n)}" style="--gc:${GCOL[l]}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--gc)" stop-opacity=".75"/><stop offset="1" stop-color="var(--gc)" stop-opacity=".12"/></linearGradient></defs>
    <path d="${c.d} L232 78 8 78Z" fill="url(#${id})"/><path d="M8 78H232" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 5" opacity=".45"/><text x="8" y="91">${L('alapszint','baseline')}</text>
    <path d="${c.d}" fill="none" stroke="var(--gc)" stroke-width="2.8" stroke-linecap="round"/><circle cx="${c.pk[0]}" cy="${c.pk[1]}" r="4.5" fill="#fff" stroke="var(--gc)" stroke-width="2.6"/>
    <text x="${c.pk[0]+10}" y="${Math.max(14,c.pk[1]-2)}" class="val">${L(...c.n)}</text>${l===2?`<text x="176" y="70" class="val">${L('visszaesés','dip')}</text>`:''}
    ${AX.map(([x,t,a])=>`<path d="M${x===8?9:x===232?231:x} 110v5" stroke="var(--faint)" stroke-width="1.2"/><text x="${x}" y="125" text-anchor="${a}">${t}</text>`).join('')}</svg>`};
const gband=g=>`<div class="fu-gb" role="img" aria-label="${L('Vércukor-válasz sávja','Blood sugar response band')}: ${glw(g)}">${[0,1,2].map(i=>`<span class="${i===g?'on':''} b${i}">${glw(i,1)}</span>`).join('')}</div>`;
/* a nap tálja: amit ettél (folyadék) + a kihagyott ablakok része (halvány, szaggatott sáv a szint fölött — nem „még belefér”, de nem is mulasztás) */
const dayBowl=(eatP,skipP,{s=152,over=false}={})=>{const id=F.uid('db'),Y=p=>4+96*(1-Math.max(0,Math.min(100,p))/100),ya=Y(eatP),yb=Y(Math.min(100,eatP+skipP));
  return `<svg class="fl-fill fu-daybowl" viewBox="${BOWLVB}" style="width:${s}px" aria-hidden="true"><defs><clipPath id="${id}"><path d="${BOWL}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${over?'color-mix(in srgb,var(--warn) 55%,#fff)':'var(--liq1)'}"/><stop offset="1" stop-color="${over?'var(--warn)':'var(--liq2)'}"/></linearGradient></defs>
    <path d="${BOWL}" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="3"/><g clip-path="url(#${id})">${skipP>0?`<path d="${wv(yb)}V${(ya+3).toFixed(1)} H-10Z" fill="rgba(10,42,60,.07)" stroke="var(--faint)" stroke-width="1.5" stroke-dasharray="4 4"/>`:''}${eatP>0?`<g class="fl-wv"><path d="${wv(ya,-210,18)}V110 H-210Z" fill="url(#${id}g)"/></g>`:''}</g>
    <path d="${BOWL}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/></svg>`};
/* bowlHero: balra amit ettél, középen a tál a keretig töltve, jobbra ami még belefér; `plain` = számok nélkül (lezárt nap adat nélkül, betöltés, hiba) */
const bowlHero=(o,i=0)=>`<section class="fh-card fh-hero fu-bh ${o.est?'est':''} rise" style="--i:${i}"><span class="lbl">${o.lbl}</span>
    <div class="fm-g ${o.plain?'plain':''}">${o.plain?'':`<div class="fm-n"><b>${kc(o.eaten)}</b><small>${L('kcal-t ettél','kcal eaten')}</small></div>`}
      <button class="fu-bowl" ${o.on?F.act(o.on).trim():''} aria-label="${o.plain?L('Üres tál','Empty bowl'):`${kc(o.eaten)} / ${kc(o.target)} kcal${o.skip?L(`, ebből ${kc(o.skip)} kcal kihagyva`,`, ${kc(o.skip)} kcal of it skipped`):''}`}">${dayBowl(o.plain?0:o.eaten?Math.max(7,Math.min(100,o.eaten/o.target*94)):0,o.plain?0:(o.skip||0)/o.target*94,{over:o.rem<0&&!o.est})}${o.plain?'':`<small>${L('keret','budget')} ${kc(o.target)} kcal</small>`}</button>
      ${o.plain?'':`<div class="fm-n r"><b>${kc(Math.abs(o.rem))}</b><small>${o.remLbl}</small></div>`}</div>
    <p class="verdict">${o.verdict}</p>${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}
    ${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`;
/* dn: a megosztott nap-lapozó (shared/ui/DayNavigator, eyebrow-val): a naplózóval közös 7 napos pótlási ablak, jövő nélkül; a dátum a naptárt nyitja */
const dayNav=(eb,title,prev,next)=>`<div class="fx-dn rise"><button ${prev?F.act(prev).trim():'disabled'} aria-label="${L('Előző nap','Previous day')}">‹</button><button class="mid" data-toast="${L('Naptár: az elmúlt 7 nap közül választhatsz','Calendar: pick one of the last 7 days')}"><small>${eb}</small><b>${title}</b></button><button ${next?F.act(next).trim():'disabled'} aria-label="${L('Következő nap','Next day')}">›</button></div>`;
/* a nap nézet-modellje: egy adatszerkezetből jön a hős, a makrók, a blokkok és a lapok minden száma (F3.2) */
const KM={kimelo:['GUIDANCE','STOMACH',2],beteg:['GUIDANCE','ILLNESS',1],serules:['MAINTENANCE','INJURY',2],'serules-tartas':['MAINTENANCE','INJURY',2],uton:['ESTIMATE','TRAVEL',3]};
const KWHO={STOMACH:['Gyomorrontás','stomach bug'],ILLNESS:['Beteg vagy','illness'],INJURY:['Sérülés','injury'],TRAVEL:['Úton vagy','travelling']};
function dayVM(arg){
  const past=arg==='tegnap'||arg==='ures', km=KM[arg]||null, mode=km&&km[0];
  if(arg==='kihagyva') SKIP={2:{}}; else if(arg==='kihagyva-ok') SKIP={2:{c:1}}; else if(arg&&arg!=='javaslat') SKIP={};
  const all=arg==='kesz'||arg==='felett';
  const meals=arg==='ures'||arg==='tolt'||arg==='hiba'||arg==='nincs-ablak'?{}:arg==='tegnap'?YM:all?{...MEALS,uzsonna:MX.uzsonna,vacsora:arg==='felett'?{...MX.vacsora,kcal:1018,macro:[66,109,37],fib:10,sugar:6}:MX.vacsora}:MEALS;
  const sum=k=>Object.values(meals).reduce((a,m)=>a+(k==='kcal'?m.kcal:k==='fib'?m.fib:m.macro[k]),0);
  const en=arg==='nincs-cel'||past?null:arg==='serules'?{...DAY.energy,balance:0}:arg==='jon'?{...DAY.energy,pending:460,blocks:[...DAY.energy.blocks,['Röpi edzés','t-volley',95,460,0]]}:DAY.energy;
  /* a keret: Alap + Mozgás ± Célod (a szerver adja, budget.energy); sérülésnél a hiány kikapcsolva; statikus napon a beállított cél, bontás nélkül */
  const target=arg==='nincs-cel'?2400:arg==='tegnap'?2870:arg==='ures'?2450:arg==='serules'?DAY.target-DAY.energy.balance:DAY.target;
  const slots=arg==='nincs-ablak'?[]:SLOTS.map((s,i)=>({...s,i,b:Math.round(s.b/DAY.target*target/5)*5,meal:Object.entries(meals).find(([,m])=>m.w===i)||null,skip:!past&&mode!=='GUIDANCE'&&SKIP[i]||null}))
    .map(s=>({...s,skip:s.meal?null:s.skip}));
  const extra=Object.entries(meals).filter(([,m])=>m.w===-1);
  const eaten=sum('kcal'), skipped=slots.filter(s=>s.skip).reduce((a,s)=>a+s.b,0);
  /* remainingAfterSkips: a nap csak akkor megy a keret fölé, ha többet ETTÉL; a kihagyott rész nem „még belefér”, de nem is visz fölé */
  const rem=eaten>target?target-eaten:Math.max(0,target-eaten-skipped);
  const water=past?2100:WAT;
  return CUR={arg,past,mode,cat:km&&km[1],kday:km&&km[2],dropped:arg==='serules',meals,slots,extra,eaten,target,skipped,rem,energy:en,weekly:!past&&!mode&&arg!=='nincs-cel',
    now:past?null:DAY.now,water,
    rings:[['p','Fehérje','Protein','t-meat','var(--protein)',sum(0),Math.round(DAY.p[1]/DAY.target*target),'g'],['c','Szénhidrát','Carbs','t-carb','var(--carb)',sum(1),Math.round(DAY.c[1]/DAY.target*target),'g'],['f','Zsír','Fat','t-avocado','var(--fat)',sum(2),Math.round(DAY.f[1]/DAY.target*target),'g'],['water','Víz','Water','t-water','var(--water)',water/1000,2.5,'l'],['fiber','Rost','Fibre','t-fiber','var(--fiber)',sum('fib'),DAY.fib[1],'g']]}}
/* az „Ajánlott …” sor állapot-szava (whenChip) és a „Logolás ide” gomb alsó sora (logButtonLabel) — az ablak SAJÁT idejéből, nem a nap első üres ablakából */
const whenChip=(s,now)=>{if(now==null)return L('még pótolható','can still be added');const n=toMin(now),lo=toMin(s.from),hi=toMin(s.to);return n<lo?(lo-n<=90?L(`nyílik ${dur(lo-n)} múlva`,`opens in ${dur(lo-n)}`):L(`nyílik ${s.from}`,`opens ${s.from}`)):n<=hi?L(`most nyitva · még ${dur(hi-n)}`,`open now · ${dur(hi-n)} left`):L('még pótolható','can still be added')};
const logSub=(s,now,mode)=>{const closed=now==null||toMin(now)>toMin(s.to);if(mode&&(mode==='GUIDANCE'||closed))return L('ha ettél, beírhatod','if you ate, you can log it');return closed?L('még pótolható','can still be added'):toMin(now)<toMin(s.from)?L('még ráér','no rush yet'):L('most van itt az ideje','now is the time')};
/* az étkezés négy kis kapszulája: a fehérje / szénhidrát / zsír szintje az étkezés SAJÁT energiájának aránya (macroEnergyShares), a rosté a napi rost-adag része (fiberSharePct); a szám a gramm */
const mealCells=(m,fibT=DAY.fib[1])=>{const [p,c,f]=m.macro,t=p*4+c*4+f*9||1,sh=[p*4/t,c*4/t,f*9/t].map(x=>Math.round(x*100)),fp=m.fib==null?null:Math.min(100,Math.round(m.fib/fibT*100));
  return `<span class="fm-cells" role="img" aria-label="${L(`fehérje ${p} g, az étkezés energiájának ${sh[0]}%-a; szénhidrát ${c} g, ${sh[1]}%; zsír ${f} g, ${sh[2]}%; rost ${m.fib==null?'nincs adat':m.fib+' g, a napi adag '+fp+'%-a'}`,`protein ${p} g, ${sh[0]}% of the meal’s energy; carbs ${c} g, ${sh[1]}%; fat ${f} g, ${sh[2]}%; fibre ${m.fib==null?'no data':m.fib+' g, '+fp+'% of the daily amount'}`)}">${[[L('feh.','prot.'),'var(--protein)',p,sh[0]],[L('szénh.','carbs'),'var(--carb)',c,sh[1]],[L('zsír','fat'),'var(--fat)',f,sh[2]],[L('rost','fibre'),'var(--fiber)',m.fib,fp]].map(([l,col,v,pp])=>mini({p:v==null?0:Math.max(6,pp),c:col,v:v==null?'—':v+' g',l})).join('')}</span>`};
const scoreChip=(id,m)=>m.score==null?`<span class="fm-chip sc pend">${bub('t-other',{s:24})}${L('folyamatban','in progress')}</span>`:`<button class="fm-chip sc" data-go="score.${id}" aria-label="${L('Mezo értékelése','Mezo’s rating')}: ${fmt(m.score)}">${bub('t-score',{s:24})}${fmt(m.score)}</button>`;
const gluChip=(id,m)=>{const b=gBand(m);return b?`<button class="fm-chip g${b.lvl}" data-sheet="glu" data-arg="${id}" aria-label="${L('Vércukor-válasz','Blood sugar response')}: ${glw(b.lvl)}">${gMini(b.lvl)}${glw(b.lvl,1)}</button>`:''};
const mealRow=(id,m)=>`<div class="fm-meal"><button class="fm-mn" data-go="meal.${id}"><strong>${m.name}</strong></button>
      <div class="fm-mb">${mealCells(m)}<span class="fm-chips">${gluChip(id,m)}${scoreChip(id,m)}</span></div></div>`;
/* slotCup: az ablak kis edénye — a szint a logolt kcal az ablak SAJÁT keretéhez mérve; ami túlfut, borostyán (kímélő napon nincs „fölött”) */
const slotCup=(k,b,neutral)=>{const over=!neutral&&k>b*1.03;return `<span class="fu-cup ${over?'over':''}" role="img" aria-label="${k?L(`Logolva: ${kc(k)} / ${kc(b)} kcal`,`Logged: ${kc(k)} / ${kc(b)} kcal`)+(neutral?'':` (${Math.round(k/b*100)}%)`):L(`Keret: ${kc(b)} kcal`,`Budget: ${kc(b)} kcal`)}">${fill(BOWL,{vb:BOWLVB,p:k?Math.max(10,Math.min(96,k/b*94)):0,s:46,c:over?'color-mix(in srgb,var(--warn) 55%,#fff)':'var(--liq1)',c2:over?'var(--warn)':'var(--liq2)',inner:k?'':`<path d="M30 40H170" stroke="var(--liq2)" stroke-width="5" stroke-dasharray="10 9" opacity=".6"/>`})}<span><b>${kc(k||b)}</b><small>${k?'/ '+kc(b):L('keret','budget')}</small></span></span>`};
const plainCup=k=>`<span class="fu-cup"><span><b>${k==null?'—':kc(k)}</b><small>kcal</small></span></span>`;
function blockCard(V,s,i){const G=V.mode==='GUIDANCE', row=s.meal, k=row?row[1].kcal:0, closed=V.now==null||toMin(V.now)>toMin(s.to), wc=whenChip(s,V.now), nowIn=V.now!=null&&toMin(V.now)>=toMin(s.from)&&toMin(V.now)<=toMin(s.to);
  return `<section class="fh-card fm-blk ${row?'':'open'} rise" style="--i:${i+3}" aria-label="${sl(s)}${s.skip?L(' · kihagyva',' · skipped'):''}"><div class="fm-bh">${bub(s.ic,{s:44})}<span class="g"><strong>${sl(s)}</strong></span>
      <button class="fm-clock ${nowIn&&!row?'live':''}" data-sheet="ora" data-arg="${s.i}" aria-label="${sl(s)} · ${row?L(`logolva ${row[1].time}`,`logged ${row[1].time}`):L(`ajánlott ablak ${s.from}–${s.to}`,`suggested window ${s.from}–${s.to}`)}">${dial(s,row?row[1].time:nowIn?V.now:null)}</button>
      ${s.skip?st(L('kihagyva','skipped'),'q'):G?(row?plainCup(k):''):slotCup(k,s.b,!!V.mode)}</div>
    ${row?mealRow(row[0],row[1])
    :s.skip?`<div class="fm-meal">${tip(s.skip.c!=null?MCATS[s.skip.c][0]:'t-skip',L(`Kihagyva · ${skLabel(s.skip)}`,`Skipped · ${skLabel(s.skip)}`),L(`${kc(s.b)} kcal kiesett a napból. A többi étkezésed nem lett nagyobb.`,`${kc(s.b)} kcal dropped out of the day. Your other meals did not get bigger.`),'var(--faint)')}
      <div class="fh-acts fm-ska">${btn(s.skip.c!=null?L('Másik ok','Change reason'):L('Okot adok','Add a reason'),{sheet:'mealwhy',arg:s.i},'sm ghost')}<button class="fh-lk" data-fundo="${s.i}">${L('Visszavonom','Undo')}</button><button class="fh-lk" data-fate="${s.i}">${L('Mégis ettem','I did eat')}</button></div></div>`
    :`<p class="fm-when">${G?L('Ha megy, egyél. Nincs mihez mérni.','Eat if you can. There is nothing to measure against.'):`${L('Ajánlott','Suggested')} <b>${s.from}–${s.to}</b>${V.mode&&closed?'':` · <span class="${nowIn?'now':''}">${wc}</span>`}`}</p>
      <div class="fh-acts fm-la"><button class="btn sm fm-log ${nowIn?'':'ghost'}" data-go="log.${V.arg==='tegnap'||V.arg==='ures'?'potlas-w':'w'}${s.i}" aria-label="${sl(s)} · ${L('logolás ide','log here')}"><span>+ ${L('Logolás ide','Log here')}</span><small>${logSub(s,V.now,V.mode)}</small></button>${G?'':`<button class="fh-lk" data-fskip="${s.i}" aria-label="${L(`${sl(s)} kihagyása`,`Skip ${sl(s).toLowerCase()}`)}">${closed?L('Kihagytam','I skipped it'):L('Kihagyom','Skip')}</button>`}</div>`}</section>`}
/* ablak nélküli extra log (buildDayPlan 3b): saját blokk a logolás idejénél, keret és ablak nélkül — a napszak nevét viseli */
const extraCard=(id,m,i)=>`<section class="fh-card fm-blk rise" style="--i:${i+3}"><div class="fm-bh">${bub(MIC[id]||'t-snack',{s:44})}<span class="g"><strong>${L(m.slot,m.se||m.slot)}</strong></span><button class="fm-clock" data-sheet="ora" data-arg="x|${id}" aria-label="${L(m.slot,m.se||m.slot)} · ${L(`logolva ${m.time}`,`logged ${m.time}`)}">${dial(null,m.time)}</button>${plainCup(m.kcal)}</div>${mealRow(id,m)}</section>`;
/* a nap jelölése a tanulásban (DayLearningMark): usable · suspicious · marked_incomplete · confirmed_complete; felírás nélküli napon és a lekérdezés alatt semmi */
function learnMark(V){
  const st0=V.arg==='tegnap'?'suspicious':Object.keys(V.meals).length?'usable':'unlogged'; if(st0==='unlogged') return '';
  const COPY={usable:L('Ez a nap számít a tanulásban','This day counts towards the learning'),suspicious:L('Ez a nap hiányosnak tűnt, kihagytam','This day looked incomplete, so I left it out')};
  return `<div class="fu-mark">${bub(st0==='usable'?'t-tick':'t-shield',{s:38,c:st0==='usable'?'var(--dom)':'var(--warn)'})}<span><b>${COPY[st0]}</b>${V.past?'':`<small>${L('A mai napot jövő hétfőn számolom bele. A jelölést addig is elmentem.','Today is counted next Monday. Your mark is saved until then.')}</small>`}<button class="fh-lk" data-go="tanulas">${L('Mit jelent ez?','What does this mean?')}</button></span>
    ${st0==='usable'?btn(L('Hiányos volt','It was incomplete'),{toast:L('A keret nem változott','The budget did not change')},'sm ghost'):btn(L('Teljes volt','It was complete'),{toast:L('A keret +20 kcal-lal változott','The budget changed by +20 kcal')},'sm ghost')}</div>`}
function mai(arg){
  arg={'d-10-07':'','d-10-06':'tegnap','d-10-05':'ures'}[arg]??arg;
  const V=dayVM(arg), {past,mode,meals,slots}=V, G=mode==='GUIDANCE', nMeals=Object.keys(meals).length, nSkip=slots.filter(s=>s.skip).length;
  const pRing=V.rings[0], pLeft=Math.max(0,pRing[6]-pRing[5]);
  /* a hős ítélet-mondata: a maradék kcal (vm.remainingKcal) és a hiányzó fehérje (rings.p) — két valódi szám egy mondatban; a kímélő arcok saját mondatot kapnak */
  const verdict=V.rem<0?(mode==='ESTIMATE'?L('Ma nagyjából a keret körül jársz.','Today you are roughly around your budget.'):L(`Ma ${kc(-V.rem)} kcal-lal a keret felett vagy.`,`Today you are ${kc(-V.rem)} kcal over your budget.`))
    :past?L(`${kc(V.rem)}\u00a0kcal maradt a nap keretéből.`,`${kc(V.rem)}\u00a0kcal of the day’s budget was left.`)
    :mode==='ESTIMATE'?L(`Kb. ${kc(V.rem)} kcal fér még bele ma.`,`About ${kc(V.rem)} kcal still fits today.`)
    :pLeft>0?L(`Még ${kc(V.rem)}\u00a0kcal fér bele, ${pLeft}\u00a0g fehérje hiányzik.`,`${kc(V.rem)}\u00a0kcal still fits, ${pLeft}\u00a0g of protein to go.`):L(`Még ${kc(V.rem)}\u00a0kcal fér bele, a fehérje megvan.`,`${kc(V.rem)}\u00a0kcal still fits, and your protein is done.`);
  const remLbl=V.rem<0?(mode==='ESTIMATE'?L('a keret körül','around the budget'):L('a keret felett','over the budget')):past?L('fért még bele','was still left'):mode==='ESTIMATE'?L('kb. ennyi fér még','about this much fits'):L('még belefér','still fits');
  const skl=V.skipped?`<button class="fu-skl" data-sheet="eq">${bub('t-skip',{s:26,c:'var(--faint)'})}<span>${L(`<b>${slots.filter(s=>s.skip).map(sl).join(', ')} kihagyva</b> · ${kc(V.skipped)} kcal kiesett a napból`,`<b>${slots.filter(s=>s.skip).map(sl).join(', ')} skipped</b> · ${kc(V.skipped)} kcal dropped out of the day`)}</span></button>`:'';
  /* sérülés / utazás: a kímélő megjegyzés a „Miből jön össze?” és a makrók között (FuelRecoveryNote) */
  const kmNote=mode==='MAINTENANCE'?tip('t-pain',V.dropped?L('Sérülés alatt nem fogyókúrázunk','No dieting while you are injured'):L('Sérülés alatt a fehérje a legfontosabb','Protein matters most while you are injured'),(V.dropped?L('A hiányt kikapcsoltam: szinten tartó keretet látsz. A fehérje most a legfontosabb, abból épül vissza a szövet.','I switched the deficit off: you see a maintenance budget. Protein matters most now; tissue rebuilds from it.'):L('Egyél eleget, és figyelj a fehérjére: abból épül vissza a szövet.','Eat enough and watch your protein: tissue rebuilds from it.'))+' '+L('Ez nem orvosi tanács.','This is not medical advice.'),'var(--warn)')
    :mode==='ESTIMATE'?tip('t-travel',L('Úton vagy, becsülj nyugodtan','You are travelling, estimating is fine'),L('Elég nagyjából beírni, a keret most csak tájékoztat. Ha egy dologra figyelsz, a fehérje legyen.','Rough entries are enough; the budget is only a guide for now. If you watch one thing, make it protein.')):'';
  const strip=mode&&!G?`<button class="fu-kms rise" data-toast="${L('A kímélő módot a Nap oldalon zárod le: Hogy vagy? → Jobban','You end gentle mode on the Today page: How are you? → Better')}" aria-label="${L('Kímélő mód','Gentle mode')}, ${L(...KWHO[V.cat])}, ${L(`${V.kday}. nap`,`day ${V.kday}`)}">${bub('t-kimelo',{s:30})}<span><b>${L('Kímélő mód','Gentle mode')}</b> · ${L(...KWHO[V.cat])} · ${L(`${V.kday}. nap`,`day ${V.kday}`)}</span>${chev()}</button>`:'';
  const banner=arg==='javaslat'?`<button class="fu-kms warn rise" data-dom="en" data-toast="${L('Én · Célok · Súlycél','Me · Goals · Weight goal')}">${bub('t-ring',{s:30,c:'var(--warn)'})}<span><b>${L('Diéta-javaslat vár a Cél oldalon','A diet suggestion is waiting on the Goal page')}</b></span>${chev()}</button>`:'';
  const nav=arg==='tegnap'?dayNav(L('Tegnap','Yesterday'),dF(1,10,6),'mai.ures','mai'):arg==='ures'?dayNav(L('2 nappal ezelőtt','2 days ago'),dF(0,10,5),{toast:L('Előző nap · október 4.','Previous day · 4 October')},'mai.tegnap'):dayNav(L('Ma','Today'),dF(2,10,7),'mai.tegnap',null);
  const macros=card(vials(V.rings.map(([k,hu,en,ic,c,v,t,u])=>({l:k==='c'?lS(L(hu,en),L('Szénh.','Carbs')):L(hu,en),ic,c,p:Math.max(5,v/t*100),v:fmt(u==='l'?v.toFixed(1):v),s:`/ ${fmt(t)} ${u}`,mark:mode==='MAINTENANCE'&&k==='p'?L('fő cél','focus'):'',on:k==='water'?{sheet:'water'}:{toast:`${L(hu,en)}: ${fmt(u==='l'?v.toFixed(1):v)} / ${fmt(t)} ${u}`}})),{h:118})
    +(V.past?'':note(L('A Víz koppintható: onnan logolsz.','Tap Water to log a drink.'))),{cls:'fu-mac'+(mode==='MAINTENANCE'?' lead':''),i:1});
  /* fő arc */
  let top;
  if(arg==='tolt') top=bowlHero({plain:1,lbl:L('Ma','Today'),verdict:L('Betöltöm a napodat…','Loading your day…'),sub:L('Egy pillanat, és itt lesznek a mai számaid.','One moment and today’s numbers will be here.')});
  else if(arg==='hiba') top=bowlHero({plain:1,lbl:L('Ma','Today'),verdict:L('Most nem sikerült betölteni a napodat.','Your day could not be loaded just now.'),sub:L('Amit eddig felírtál, megvan; csak megmutatni nem tudom.','What you have logged is safe; I just cannot show it.'),acts:btn(L('Újrapróbálom','Try again'),'mai')});
  else if(arg==='ures') top=bowlHero({plain:1,lbl:L('Ezen a napon','On this day'),verdict:L('Erre a napra nincs adat.','There is no data for this day.'),sub:L('Amit most logolsz, erre a napra könyvelődik.','Whatever you log now is booked to this day.'),acts:btn(L('Reggeli pótlása','Add breakfast'),'log.potlas-w0')});
  else if(G){const st=V.cat==='STOMACH';
    const TIPS=st?[['t-water',L('Kis kortyokban, gyakran','Small sips, often'),L('Víz, gyenge tea, húsleves. Ha hánytál, várj egy kicsit, és kortyonként kezdd újra.','Water, weak tea, broth. If you have been sick, wait a little and start again sip by sip.'),'var(--water)'],['t-tea',L('Egyél, amikor megkívánod','Eat when you feel like it'),L('Nem kell erőltetni. Ha megjön az étvágyad, kezdd kis adaggal.','No need to force it. When your appetite returns, start with a small portion.')],['t-skip',L('Ezeket most hagyd ki','Leave these out for now'),L('Zsíros és csípős étel, gyümölcslé, szénsavas üdítő.','Fatty and spicy food, fruit juice, fizzy drinks.'),'var(--warn)']]
      :[['t-water',L('Igyál sokat','Drink plenty'),L('Víz, tea, leves. A folyadék most fontosabb, mint a kalória.','Water, tea, soup. Fluids matter more than calories now.'),'var(--water)'],['t-tea',L('Könnyű, meleg étel','Light, warm food'),L('Egyél, amikor megy. Egy leves, pirítós, joghurt vagy gyümölcs is elég.','Eat when you can. A soup, toast, yoghurt or fruit is enough.')],['t-meat',L('Ha megy, egy kis fehérje','A little protein, if you can'),L('Tojás, túró, csirke: segít, hogy ne gyengülj le. Nem kötelező.','Eggs, cottage cheese, chicken: it helps you keep your strength. Not a must.')]];
    top=`${hero({warn:true,lbl:`${L('Kímélő mód','Gentle mode')} · ${L(...KWHO[V.cat])} · ${L(`${V.kday}. nap`,`day ${V.kday}`)}`,verdict:L('Ma nincs kalóriacél.','No calorie target today.'),sub:L('Pihenj, igyál, és egyél, amikor megy. A számokat most elengedjük.','Rest, drink, and eat when you can. We let the numbers go for now.')+' '+(V.eaten>0?L(`Ma eddig <b>${kc(V.eaten)} kcal</b>; nem mérjük semmihez.`,`<b>${kc(V.eaten)} kcal</b> so far today; we do not measure it against anything.`):L('Amit megeszel, beírhatod. Nem mérjük semmihez.','You can log what you eat. We do not measure it against anything.')),
      left:`<button class="fu-gl" data-sheet="water" aria-label="${L('Víz logolása','Log water')}">${fill(GLASS,{vb:GLASSVB,p:pc(V.water,2500)*.9,s:74,c:'color-mix(in srgb,var(--water) 55%,#fff)',c2:'var(--water)'})}<small>${fmt((V.water/1000).toFixed(1))} / ${fmt(2.5)} l<i>${L('folyadék ma','fluids today')}</i></small></button>`,
      acts:btn('+ '+L('Víz','Water'),{sheet:'water'})+lk(L('Mikor fordulj orvoshoz?','When to see a doctor'),{sheet:'orvos',arg:V.cat})})}
    ${sec(1,L('Most ez segít','What helps now'),1)}
    ${card(TIPS.map(t=>tip(...t)).join('')+(st?lab(L('Ezek könnyebben mennek le','These go down more easily'))+`<div class="fh-chips fu-chips">${[['Banán','Banana'],['Főtt rizs','Boiled rice'],['Pirítós','Toast'],['Főtt krumpli','Boiled potato'],['Sós keksz','Salted crackers'],['Húsleves','Broth'],['Almapüré','Apple purée']].map(n=>`<span>${L(...n)}</span>`).join('')}</div>`+note(L('Nem előírás, csak ötlet. Amint jobban vagy, ehetsz rendesen.','Not a rule, just ideas. As soon as you feel better you can eat normally.')):'')
      +note(L('A kímélő módot a Nap oldalon zárod le. Ez nem orvosi tanács.','You end gentle mode on the Today page. This is not medical advice.')),{i:1})}`}
  else top=`${bowlHero({lbl:past?L('Ezen a napon','On this day'):L('Ma eddig','Today so far'),eaten:V.eaten,target:V.target,rem:V.rem,skip:V.skipped,remLbl,est:mode==='ESTIMATE',on:{sheet:'eq'},verdict,
      sub:past?L('Amit most logolsz, erre a napra könyvelődik.','Whatever you log now is booked to this day.'):'',body:skl,
      acts:btn(past?L('Pótlás erre a napra','Add to this day'):L('Étkezés logolása','Log a meal'),past?'log.potlas':'log')+`<button class="fh-lk fu-eql" data-sheet="eq">${past?L('Miből jött össze?','How did it add up?'):L('Miből jön össze?','How does it add up?')}${V.weekly?`<i class="fu-dot" aria-label="${L('új heti tanulás','new weekly learning')}"></i>`:''}</button>`})}
    ${kmNote?card(kmNote,{cls:'fu-kmn',i:1}):''}
    ${sec(1,past?L('A nap makrói','The day’s macros'):L('Mai makrók','Today’s macros'),1)}${macros}`;
  let n=arg==='ures'?0:1;
  if(arg==='tolt'||arg==='hiba') return page('fuel',{title:'Fuel',sub:'Szerda, október 7.',tab:'mai'},`${nav}${top}`);
  return page('fuel',{title:'Fuel',sub:'Szerda, október 7.',tab:'mai'},`${banner}${nav}${strip}${top}
  ${sec(++n,`${past?L('Ezen a napon','On this day'):L('A mai blokkjaid','Today’s blocks')} · ${L(`${nMeals} étkezés`,nMeals===1?'1 meal':`${nMeals} meals`)}${nSkip?L(` · ${nSkip} kihagyva`,` · ${nSkip} skipped`):''}`,2)}
  ${slots.length?[...slots.map((s,i)=>[toMin(s.meal?s.meal[1].time:s.from),blockCard(V,s,i)]),...V.extra.map(([id,m],i)=>[toMin(m.time),extraCard(id,m,i)])].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join('')
    :card(empty('t-plate',L('Ma még nincs tervezett étkezési ablak. Logolj bármit, bármikor.','There is no planned meal window yet today. Log anything, any time.')),{i:3})}
  ${sec(++n,L('Ablakon kívül','Between meals'),7)}
  ${card(row({icon:'t-bowl',title:L('Logolj bármit','Log anything'),sub:L('ablakon kívül is','between meals too'),on:past?'log.potlas':'log'})
    /* a tegnapi pótolható ablakok csalija: csak a mai nézetben, ha tegnap maradt üres ablak és nem kímélő nap volt */
    +(!past&&!mode?row({icon:'t-history',title:L(`${dL(10,6)} · 2 ablak pótolható`,`${dL(10,6)} · 2 windows can still be added`),sub:L('tegnap','yesterday'),on:'mai.tegnap'}):''),{i:7})}
  ${learnMark(V)?sec(++n,L('A nap a tanulásban','Does this day count?'),8)+card(learnMark(V),{i:8}):''}`);
}

/* gHero: hős saját grafikával — címke → grafika → ítélet-mondat → gomb */
function gHero(o,i=0){return `<section class="fh-card fh-hero ${o.warn?'warn':''} ${o.cls||''} rise" style="--i:${i}"><span class="lbl">${o.lbl||''}</span>${o.g||''}<p class="verdict">${o.verdict}</p>${o.sub?`<p class="sub">${o.sub}</p>`:''}${o.body||''}${o.acts?`<div class="fh-acts">${o.acts}</div>`:''}</section>`}
/* numG: grafika balra, nagy szám és két-három tény jobbra */
const numG=(g,n,unit,lines='')=>`<div class="fu-ng"><span class="gg">${g}</span><div class="nn"><span class="fh-big">${n}${unit?`<small>${unit}</small>`:''}</span>${lines}</div></div>`;
const pk=(a,b)=>`<p class="fu-pk"><span><i class="a"></i>${a}</span><span><i class="b"></i>${b}</span></p>`;
const notFound=(back)=>page('fuel',{title:L('Nincs meg','Not found'),sub:'Fuel',back},`${card(empty('t-plate',L('Ez az étkezés nincs meg. Lehet, hogy egy másik napon logoltad, vagy közben törölted. A Mai oldalon minden mai étkezésed ott van.','This meal is not here. You may have logged it on another day, or deleted it since. All of today’s meals are on the Today page.'),btn(L('Vissza a Mai oldalra','Back to Today'),'mai','sm')),{i:1})}`);

/* ═══ ÉTKEZÉS (FuelMealDetailPage + FuelQualityBlocks) ═══ állapotok: meal.<id> · meal.vacsora (értékelés folyamatban) · meal.uzsonna (egyetlen recept-sor → „Megnyitom a receptet”) · meal.nincs */
const NOVA=[null,['Alapanyag','Whole food','var(--ok)'],['Konyhai összetevő','Kitchen ingredient','var(--water)'],['Feldolgozott','Processed','var(--warn)'],['Ultra-feldolgozott','Ultra-processed','var(--lilac)']];
const SRCL={kamra:['kamra','pantry','t-stack'],recept:['recept','recipe','t-book'],'becslés':['becslés','estimate','t-chat']};
const CTXL={pre:['edzés előtti','before training'],post:['edzés utáni','after training']};
const mealTitle=m=>L(m.slot,m.se||{Reggeli:'Breakfast','Ebéd':'Lunch'}[m.slot]||m.slot);
function meal(id){
  const m=mealOf(id); if(!m) return notFound('mai');
  const [p,c,f]=m.macro, s=mk(p,c,f), band=gBand(m), all=m.past?YM:{...MEALS,...(MX[id]?MX:{})}, DT=m.past?2870:DAY.target, bk=m.past?'mai.d-10-06':'mai';
  const before=Object.values(all).filter(x=>x.time<m.time).reduce((a,x)=>a+x.kcal,0), share=pc(m.kcal,DT), tot=m.ings.reduce((a,x)=>a+x[4],0)||1;
  const one=m.ings.length===1&&m.ings[0][3]==='recept';
  /* Mikrotápanyagok: a négy tárolt tény (rost · cukor · só · telített zsír) az étkezés részéhez mérve; hiányzó érték őszintén „nincs adat” */
  const MICRO=[[L('Rost','Fibre'),m.fib,7,'t-fiber','var(--fiber)',v=>v>=6?0:1,L('cél','goal')],[L('Cukor','Sugar'),m.sugar,25,'t-sugar','var(--lilac)',v=>v<=12?0:v<=22?1:2,L('keret','allowance')],[L('Só','Salt'),m.salt,1.7,'t-salt','var(--water)',v=>v<=1?0:1,L('keret','allowance')],[L('Telített zsír','Saturated fat'),m.sat,7,'t-avocado','var(--carb)',v=>v<=5?0:v<=9?1:2,L('keret','allowance')]];
  const STL=[L('rendben','fine'),L('oké','okay'),L('figyeld','watch it')];
  const q=m.q||{}, tile=(k,ic,n,unit,pct,c2,on)=>stat({k,icon:ic,n:n==null?'—':n,unit:n==null?'':unit,pct:n==null?null:pct,c:c2,s:n==null?L('nincs adat','no data'):'',on});
  return page('fuel',{title:mealTitle(m),sub:`Fuel · ${m.past?dS(10,6)+' · ':''}${m.time}${m.ctx?' · '+L(...CTXL[m.ctx]):''}`,back:bk},`
  ${gHero({lbl:m.name,g:numG(pour(before/DT*94,m.kcal/DT*94),kc(m.kcal),'kcal',`<p>${L(`a napod <b>${share}%-a</b> a ${kc(DT)} kcal-os keretből · ${m.time}-kor logoltad`,`<b>${share}%</b> of your day’s ${kc(DT)} kcal budget · logged at ${m.time}`)}</p>`+pk(before?L(`előtte ${kc(before)} kcal`,`${kc(before)} kcal before it`):L('előtte üres volt a tál','the bowl was empty before it'),L('ez az étkezés','this meal'))),
    /* az ítélet az értékelés címsora (meal.breakdown.tagline / summary — a lap már betölti); értékelés nélkül a nap-rész mondata */
    verdict:m.headline?m.headline+'.':L('Rögzítve; az értékelés készül.','Logged; the rating is on its way.'),sub:m.lead||'',
    acts:(m.score==null?`<span class="fu-pendl">${L('Az értékelés folyamatban','Rating in progress')}</span>`:btn(`${L('Mezo értékelése','Mezo’s rating')} ${fmt(m.score)}`,'score.'+id))+(band?lk(`${L('Vércukor','Blood sugar')} · ${glw(band.lvl)}`,{sheet:'glu',arg:id}):'')},1)}
  ${sec(1,L('Makrók','Macros'),2)}
  ${card(macroVials(p,c,f)+note(L(`A szint az étkezés energiájának megoszlása: ${kc(p*4)} kcal fehérjéből, ${kc(c*4)} szénhidrátból, ${kc(f*9)} zsírból.`,`The level is the split of the meal’s energy: ${kc(p*4)} kcal from protein, ${kc(c*4)} from carbs, ${kc(f*9)} from fat.`)),{cls:'fu-mac',i:2})}
  ${sec(2,`${L('Hozzávalók','Ingredients')} · ${m.ings.length}`,3)}
  ${card(m.ings.length?m.ings.map(([n,ic,,src,k,amt,nv])=>irow({icon:ic,title:n,sub:`<span class="fu-tags"><em>${L(SRCL[src][0],SRCL[src][1])}</em>${nv?`<em style="--c:${NOVA[nv][2]}"><i></i>${L(NOVA[nv][0],NOVA[nv][1])}</em>`:''}</span>`,v:`${kc(k)}<small>kcal</small>`,l2:`<span class="fu-sh">${level(k/tot*100,{h:8})}</span><small class="fu-shn">${amt.replace('adag',L('adag','serving'))} · ${Math.round(k/tot*100)}%</small>`})).join('')
    +note(L('A sáv azt mutatja, az étkezés kalóriájának mekkora részét adja a tétel.','The bar shows how much of the meal’s calories the item gives.')):empty('t-plate',L('Ehhez az étkezéshez nincsenek részletezett sorok.','This meal has no itemised lines.')),{i:3})}
  ${sec(3,L('Minőség','Quality'),4)}
  ${card(grid([tile(L('Alapanyag-arány','Whole-food share'),'t-processing',q.base,'%',q.base,'var(--carb)'),tile(L('Energiasűrűség','Energy density'),'t-bolt',q.dens,'kcal/100 g',q.dens==null?null:Math.min(100,q.dens/4),'var(--protein)'),
      tile(L('Ultra-feldolgozott','Ultra-processed'),'t-ultra',q.ultra,L('tétel',q.ultra===1?'item':'items'),q.ultra==null?null:Math.min(100,q.ultra*34),q.ultra?'var(--lilac)':'var(--water)'),
      band?stat({k:L('Vércukor-válasz','Blood sugar response'),icon:'t-glucose',n:glw(band.lvl),pct:[26,55,84][band.lvl],c:GCOL[band.lvl],s:(band.est?L('becsült · ','estimated · '):'')+L('részletek ›','details ›'),on:{sheet:'glu',arg:id}}):tile(L('Vércukor-válasz','Blood sugar response'),'t-glucose',null)]),{cls:'fu-q',i:4})}
  ${sec(4,L('Mikrotápanyagok','Micronutrients'),5)}
  ${card(MICRO.map(([l,v,al,ic,col,stf,kind])=>v==null?row({left:bub(ic,{s:40,c:'var(--faint)'}),title:l,sub:L('a forrás nem adott értéket','the source gave no value'),v:'—',right:st(L('nincs adat','no data'),'q')})
      :irow({icon:ic,title:l,v:`${fmt(v)}<small>g</small>`,sub:L(`az étkezés-${kind} ${Math.round(v/al*100)}%-a`,`${Math.round(v/al*100)}% of the meal ${kind}`),l2:`<span class="fu-sh">${level(Math.min(100,v/al*100),{h:8,c:col})}</span>${st(STL[stf(v)],stf(v)===2?'warn':stf(v)?'q':'ok')}`})).join('')
    +note(L('Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.','This is what we store today. Vitamins and minerals are still on the way.')),{i:5})}
  ${sec(5,L('Javítás és recept','Edit and recipe'),6)}
  ${card(row({icon:'t-pencil',title:L('Javítom ezt az étkezést','Edit this meal'),sub:L('a tételeket és az időt is átírhatod','you can change the items and the time'),on:'log.javitas.'+id})
    +(m.ings.length?row({icon:'t-book',title:one?L('Megnyitom a receptet','Open the recipe'):L('Mentsük receptként','Save it as a recipe'),sub:one?m.ings[0][0]:L('a Műhely ezzel az étkezéssel nyílik','the Workshop opens with this meal'),on:one?'recept.'+m.rec:'muhely.etkezesbol-'+id}):''),{i:6})}`);
}

/* ═══ MEZO ÉRTÉKELÉSE (FuelMealScorePage + FuelScoreSurface) ═══ állapotok: score.<id> · score.tizorai (egy szempont kimaradt: kevés adat) ·
   score.ebed.keszul (Mezo olvasata készül) · score.vacsora (még nincs értékelés) · score.nincs */
const DS=[['Makró','Macros'],['Mikro','Micro'],['WHO','WHO'],['Zsír','Fat'],['Feldolg.','Process.'],['Növény','Plants'],['Sűrűség','Density'],['Időzítés','Timing']];
/* a szempontok neve a szerver bontásából jön (MealDimension.label); a súly 0 = kimaradt, „még tanulom” */
const DIMS=[['macro',['Kcal és makróarány','Calories and macro ratio'],'t-macro',22,m=>{const s=mk(...m.macro);return L(`Az energia ${s[0][1]}% fehérje · ${s[1][1]}% szénhidrát · ${s[2][1]}% zsír; a cél 25/55/20%.`,`The energy is ${s[0][1]}% protein · ${s[1][1]}% carbs · ${s[2][1]}% fat; the goal is 25/55/20%.`)},m=>{const s=mk(...m.macro);return [[L('Fehérje','Protein'),`${s[0][1]}% · ${L('cél','goal')} 25%`],[L('Szénhidrát','Carbs'),`${s[1][1]}% · ${L('cél','goal')} 55%`],[L('Zsír','Fat'),`${s[2][1]}% · ${L('cél','goal')} 20%`]]}],
  ['micro',['Rost és mikro','Fibre and micro'],'t-micro',10,m=>L(`${m.fib} g rost ebben az étkezésben; a napi ${DAY.fib[1]} g-os adag ${Math.round(m.fib/DAY.fib[1]*100)}%-a.`,`${m.fib} g of fibre in this meal; ${Math.round(m.fib/DAY.fib[1]*100)}% of the daily ${DAY.fib[1]} g.`),m=>[[L('Rost','Fibre'),`${m.fib} g`],[L('Cukor','Sugar'),m.sugar==null?'—':`${m.sugar} g`],[L('Só','Salt'),m.salt==null?'—':`${fmt(m.salt)} g`]]],
  ['who',['Ajánlások · WHO','Guidelines · WHO'],'t-shield',14,()=>L('A cukor és a só az ajánlott napi határ étkezésre jutó része alatt van.','Sugar and salt are under this meal’s share of the recommended daily limit.'),m=>[[L('Cukor','Sugar'),m.sugar==null?'—':`${m.sugar} g · ${L('keret','allowance')} 25 g`],[L('Só','Salt'),m.salt==null?'—':`${fmt(m.salt)} g · ${L('keret','allowance')} ${fmt(1.7)} g`]]],
  ['fat_quality',['Zsírminőség','Fat quality'],'t-avocado',10,m=>{const e=Math.round(m.sat*9/m.kcal*100),t=Math.round(m.sat/m.macro[2]*100);return L(`Telített zsír az energia ${e}%-a · az összzsír ${t}%-a.`,`Saturated fat is ${e}% of the energy · ${t}% of total fat.`)},m=>[[L('Telített zsír','Saturated fat'),`${fmt(m.sat)} g`],[L('Összes zsír','Total fat'),`${m.macro[2]} g`]]],
  ['nova',['Feldolgozottság','Processing'],'t-processing',18,m=>m.q.base==null?L('A tételekről nincs elég adat.','There is not enough data about the items.'):L(`A kalória ${m.q.base}%-a alapanyagból jön; ${m.q.ultra} ultra-feldolgozott tétel.`,`${m.q.base}% of the calories come from whole foods; ${m.q.ultra} ultra-processed ${m.q.ultra===1?'item':'items'}.`),m=>[[L('Alapanyag','Whole food'),m.q.base==null?'—':`${m.q.base}%`],[L('Ultra-feldolgozott','Ultra-processed'),String(m.q.ultra)]]],
  ['plant_diversity',['Növényi változatosság','Plant variety'],'t-sprout',8,m=>{const n=m.ings.filter(x=>/t-carb|t-fiber|t-avocado/.test(x[1])).length;return L(`${n} különböző növényi kategória a 3-as célhoz.`,`${n} plant ${n===1?'category':'categories'} of the 3 aimed for.`)},m=>[[L('Növényi kategória','Plant categories'),`${m.ings.filter(x=>/t-carb|t-fiber|t-avocado/.test(x[1])).length} / 3`]]],
  ['energy_density',['Energiasűrűség','Energy density'],'t-bolt',6,m=>m.q.dens==null?L('Nem minden tétel grammban van megadva, ezért a sűrűség nem számolható.','Not every item is given in grams, so density cannot be calculated.'):L(`${m.q.dens} kcal/100 g (150 alatt teljes pont, 400 felett nulla).`,`${m.q.dens} kcal/100 g (full points under 150, none over 400).`),m=>[[L('Sűrűség','Density'),m.q.dens==null?'—':`${m.q.dens} kcal/100 g`]]],
  ['context',['Időzítés és kontextus','Timing and context'],'t-clock',12,m=>{const s=SLOTS[m.w];if(m.tpl)return L(`Sablon: nincs időpontja. Az adagot ${s?azA(s.l.toLowerCase())+' ablak keretéhez':'egy étkezés keretéhez'} mérjük.`,`A template has no time. The serving is measured against ${s?'the '+s.e.toLowerCase()+' window’s budget':'one meal’s budget'}.`);return s?L(`${m.time}-kor logoltad; az ajánlott ablak ${s.from}–${s.to}.`,`Logged at ${m.time}; the suggested window is ${s.from}–${s.to}.`):L(`${m.time}-kor logoltad; nem tartozott ablakhoz.`,`Logged at ${m.time}; it did not belong to a window.`)},m=>{const s=SLOTS[m.w];return [[L('Szerep','Role'),m.ctx?L(...CTXL[m.ctx]):L('standard','standard')],[L('Ablak','Window'),s?`${s.from}–${s.to}`:'—'],...(m.tpl?[]:[[L('Logolva','Logged'),m.time]])]}]];
/* a „Rost és mikro” a tízórainál kimarad (súly 0): becsült sorból nincs mire pontot adni */
const dimOff=(id,i)=>(id==='tizorai'&&i===1)||(i===6&&(mealOf(id)||{q:{dens:1}}).q.dens==null);
function score(arg){const [id,st2]=String(arg||'reggeli').split('.'); if(/^r-/.test(id)) return recScore(id.slice(2),st2); const m=mealOf(id); if(!m||SCREC[id]) return notFound('mai');
  return scoreSurface(id,m,st2,{back:'meal.'+id,lbl:`${mealTitle(m)} · ${m.time}`,sub:m.name,detail:[L('Az étkezés részletei','Meal details'),'meal.'+id],imp:IMPM[id]||[]})}
/* scoreSurface(id, rec, state, {back, lbl, sub, detail:[felirat, útvonal], imp:[[szöveg, +pont]]}) — a közös értékelő felület (FuelScoreSurface): étkezés és recept is ezt használja.
   rec: {name, score|null, cert, headline, lead, dims[8], macro[3], fib, sugar, salt, sat, q:{base,dens,ultra}, ings, time, w}; state 'keszul' = Mezo olvasata készül. A „dim” lap a rekordot mealOf(id)-n át éri el (SCREC). */
const IMPM={reggeli:[['Egy marék dió vagy tökmag a tetejére: a zsírok aránya a célhoz közelebb kerül.',.2],['A méz fele is elég; a cukor így az étkezés keretén belül marad.',.1]],tizorai:[['Whey helyett egy pohár görög joghurt: a feldolgozottság pontja ugrana.',.4]],ebed:[['Egy marék hüvelyes a tányérra: a rost és a növényi változatosság is nő.',.2]],uzsonna:[['Egy marék bogyós gyümölcs mellé: a rost a duplájára nő.',.3]]};
function scoreSurface(id,m,st2,o){
  const ttl={title:L('Mezo értékelése','Mezo’s rating'),sub:m.name,back:o.back};
  if(m.score==null) return page('fuel',ttl,`${card(empty('t-score',L('Ehhez az étkezéshez még nincs értékelés. Amint megszületik, itt találod.','This meal has no rating yet. As soon as it is ready you will find it here.'),btn(L('Vissza','Back'),o.back,'sm')),{i:1})}`);
  const live=m.dims.map((v,i)=>dimOff(id,i)?null:v), nums=live.filter(v=>v!=null), low=live.indexOf(Math.min(...nums)), hi=live.indexOf(Math.max(...nums)), pend=st2==='keszul';
  const vv=a=>vials(a.map(i=>live[i]==null?{l:L(...DS[i]),ic:DIMS[i][2],c:'var(--faint)',p:0,v:'—',s:L('még tanulom','still learning'),on:{sheet:'dim',arg:id+'|'+i}}:{l:L(...DS[i]),ic:DIMS[i][2],c:i===low?'var(--warn)':'var(--dom)',p:live[i]*10,v:fmt(live[i]),s:i===low?L('leggyengébb','weakest'):i===hi?L('legerősebb','strongest'):L(`súly ${DIMS[i][3]}%`,`weight ${DIMS[i][3]}%`),on:{sheet:'dim',arg:id+'|'+i}}),{h:92});
  /* „Ha feljebb vinnéd”: a bontás improve listája (szöveg + hatás); a hatás a tízes skálán, ugyanabból a számból, mint a pontszám (F4.8) */
  const IMP=o.imp||[];
  return page('fuel',{...ttl,sub:o.sub},`
  ${gHero({lbl:o.lbl,g:`<div class="fu-sc"><span class="fh-big" aria-label="${L(`Mezo értékelése: ${fmt(m.score)} a tízes skálán`,`Mezo’s rating: ${fmt(m.score)} out of ten`)}">${fmt(m.score)}</span><span class="c">${level(m.cert,{h:14,label:`${L('megbízhatóság','confidence')} ${m.cert}%`})}</span></div><div class="fu-8">${vv([0,1,2,3])}${vv([4,5,6,7])}</div>`,
    verdict:m.headline+'.',sub:pend?L('Mezo olvasata készül…','Mezo’s reading is on the way…'):m.lead,
    acts:btn(o.detail[0],o.detail[1])},1)}
  ${sec(1,L('Miből áll össze?','What is it made of?'),2)}
  ${card(DIMS.map(([,l,ic,w,det],i)=>live[i]==null?irow({icon:ic,title:L(...l),sub:L('Ehhez nem volt elég adat, ezért ez a szempont kimaradt.','There was not enough data for this, so this aspect was left out.'),v:'—',l2:`<span class="fu-sh">${level(0,{h:8})}</span><small class="fu-shn">${L('még tanulom · kevés adat','still learning · little data')}</small>`,on:{sheet:'dim',arg:id+'|'+i}})
      :irow({icon:ic,title:L(...l),sub:det(m),v:fmt(live[i]),l2:`<span class="fu-sh">${level(live[i]*10,{h:8,c:i===low?'var(--warn)':'var(--dom)'})}</span><small class="fu-shn">${L(`súly ${w}%`,`weight ${w}%`)}${i===low?L(' · leggyengébb',' · weakest'):''}</small>`,on:{sheet:'dim',arg:id+'|'+i}})).join('')
    +note(L('Koppints egy sorra a részletekért.','Tap a row for details.')),{i:2})}
  ${IMP.length?`${sec(2,L('Ha feljebb vinnéd','If you want to raise it'),3)}
  ${card(IMP.map(([t,d])=>row({icon:'t-bolt',title:t,right:`<span class="v fu-imp">+${fmt(d)}</span>`})).join(''),{cls:'fu-impc',i:3})}`:''}
  ${pend?'':`${sec(IMP.length?3:2,L('Hasznos volt?','Was this useful?'),4)}
  ${card(`<div class="fu-fb"><span>${L('a Mezo olvasatáról','about Mezo’s reading')}</span><button data-toast="${L('Köszönöm, jegyzem','Thank you, noted')}" aria-label="${L('Hasznos volt','It was useful')}">${bub('t-thumb-up',{s:40})}</button><button data-toast="${L('Köszönöm; mi nem talált?','Thank you; what was off?')}" aria-label="${L('Nem volt hasznos','It was not useful')}">${bub('t-thumb-down',{s:40})}</button></div>`
    +note(o.note||L('A pontszám mentéskor, rögzített szabályok szerint születik; a szöveges részt Mezo írja hozzá, és sosem írja át a számokat. Egyetlen étkezés sosem ítélet: a nap egészében nézzük.','The score is set when you save, by fixed rules; Mezo adds the text and never changes the numbers. One meal is never a verdict: we look at the whole day.')),{i:4})}`}`);
}

/* ═══ AZ ÉTKEZÉS CEREMÓNIÁJA (FuelMealCeremony + MealCeremonyProvider) ═══ mentés után, ha a válasz pontszámot hoz (pontszám nélkül nincs ceremónia).
   A minta marad (csillagok, számláló, egyetlen menet); az anyag folyadék: a kehely az értékelésig telik. Csillag és ítélet EGY függvényből (mealStars / mealVerdict). */
const CERCUP='M24 14 H176 V62 C176 100 144 122 100 122 C56 122 24 100 24 62Z';
const mealStars=s=>Math.max(1,Math.min(5,Math.ceil(s/2)));
const mealVerdict=n=>n>=5?L('Hibátlan választás.','A flawless choice.'):n>=4?L('Erős tányér.','A strong plate.'):n>=3?L('Rendben van.','That works.'):n>=2?L('Ez is számít.','This counts too.'):L('Rögzítve: minden adat segít.','Logged: every entry helps.');
function cer(id){
  const m=mealOf(id)&&mealOf(id).score!=null?mealOf(id):MEALS.reggeli; id=mealOf(id)&&mealOf(id).score!=null?id:'reggeli';
  const n=mealStars(m.score), cid=F.uid('cc'), y=122-108*(m.score/10);
  return page('fuel',{title:L('A napod része lett','Now part of your day'),sub:`${m.name} · ${m.time}`,back:'mai'},`
  <section class="fh-card fh-hero fu-cer rise" style="--i:1"><span class="lbl">${L(`${n} csillag az ötből`,`${n} of five stars`)}</span>
    <div class="fu-cst" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i class="${i<n?'on':''}">${I(i<n?'t-star':'t-star-empty')}</i>`).join('')}</div>
    <div class="fu-ccup" role="img" aria-label="${L(`Mezo értékelése: ${fmt(m.score)} a tízes skálán`,`Mezo’s rating: ${fmt(m.score)} out of ten`)}"><svg viewBox="0 0 200 132"><defs><clipPath id="${cid}"><path d="${CERCUP}"/></clipPath><linearGradient id="${cid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
      <path d="${CERCUP}" fill="#fff" stroke="rgba(10,42,60,.12)" stroke-width="2.5"/><g clip-path="url(#${cid})"><g class="lq"><path fill="url(#${cid}g)" d="${wv(y,-210,18)}V140 H-210Z"/></g>${[.4,.6,.8].map(p=>`<path d="M152 ${14+108*(1-p)}h14" stroke="rgba(10,42,60,.28)" stroke-width="2" stroke-linecap="round"/>`).join('')}<path d="M40 26 V58" stroke="rgba(255,255,255,.8)" stroke-width="6" stroke-linecap="round"/></g>
      <text x="100" y="${Math.max(84,y+38)}" text-anchor="middle" class="n">${fmt(m.score)}</text></svg><small>${L('Mezo értékelése','Mezo’s rating')}</small></div>
    <p class="verdict">${mealVerdict(n)}</p></section>
  ${sec(1,L('Ez került a napodba','This went into your day'),2)}
  ${card(facts([[kc(m.kcal),'kcal'],[m.macro[0],L('g fehérje','g protein')],[m.macro[1],L('g szénh.','g carbs')],[m.macro[2],L('g zsír','g fat')]]),{cls:'fu-cfc',i:2})}`,
  {nonav:true,foot:`<button class="btn ghost" data-go="mai">${L('Vissza a naphoz','Back to today')}</button><button class="btn" data-go="score.${id}">${L('Részletek','Details')}</button>`});
}

/* ═══ LOGOLÁS (FuelLogNewPage + FuelLogModes + MealComposer; a „Mit ettél?” lap: LogFlowPage) ═══
   Állapotok: log (ablakon kívül, üres piszkozat) · log.w0–w3 (ablakba) · log.foto-kesz (fotó csatolva) · log.elemez (az elemzés fut) · log.hiba (a fotót nem ismerte fel) ·
   log.ai-hiba (az elemzés nem sikerült) · log.szokasos · log.szokasos-ures · log.tetelek (felismert tételek) · log.finom (recept-sor finomhangolása nyitva) · log.ido (idő kézzel) ·
   log.jovo (jövőbeli idő) · log.potlas / log.potlas-w2 (lezárt napra) · log.javitas.<id> (logolt étkezés javítása) · log.torles.<id> (a törlés élesítve) ·
   log.kamra-<kamraId> / log.recept-<receptId> („Mit ettél?” a Kamra-tételről / receptről nyitva, előtöltött sorral) */
const LMODES=[['foto','Fotó','Photo','t-camera'],['kamra','Kamra','Pantry','t-stack'],['recept','Recept','Recipe','t-book'],['szokasos','Szokásosak','Usuals','t-repeat']];
const TAGL={kamra:['kamra','pantry','t-stack'],recept:['recept','recipe','t-book'],'becslés':['becslés','estimate','t-score']};
/* a négy tárolt tény kis cellái (NutrientCells): rost · cukor · só · telített zsír; ami nincs, az „—” */
const nutri=a=>`<span class="fu-nut">${[[L('rost','fibre'),a[0]],[L('cukor','sugar'),a[1]],[L('só','salt'),a[2]],[L('tel. zsír','sat. fat'),a[3]]].map(([l,v])=>`<span><b>${v==null?'—':fmt(v)+' g'}</b><small>${l}</small></span>`).join('')}</span>`;
/* egy piszkozat-sor: név + forrás-címke (AI-jellel, ha az elemzés tette oda) · × · léptető · kcal · makrók · tények · „nézd át” megjegyzés */
const lineCard=o=>`<div class="fu-ln" data-tag="${o.tag}"><div class="fu-lnt">${bub(o.ic,{s:36})}<span class="g"><strong>${o.n}</strong><small class="fu-tags"><em>${L(TAGL[o.tag][0],TAGL[o.tag][1])}${o.ai?` · AI`:''}</em>${o.review?`<em class="w">${L('nézd át','check it')}</em>`:''}</small></span><button class="fu-x" data-toast="${L('Eltávolítva','Removed')}: ${esc(o.n)}" aria-label="${L(`${esc(o.n)} eltávolítása`,`Remove ${esc(o.n)}`)}">×</button></div>
    <div class="fu-lns"><span class="fx-stp"><button data-toast="${esc(o.n)}: −${o.step}" aria-label="${L(`${esc(o.n)} csökkentés`,`Less ${esc(o.n)}`)}">−</button><input class="fh-in" inputmode="decimal" value="${o.a}" aria-label="${L(`${esc(o.n)} mennyisége`,`Amount of ${esc(o.n)}`)}"><button data-toast="${esc(o.n)}: +${o.step}" aria-label="${L(`${esc(o.n)} növelés`,`More ${esc(o.n)}`)}">+</button><small>${o.u==='adag'?L('adag','serving'):o.u}</small></span><span class="fu-lnk"><b>${kc(o.k)}</b><small>kcal</small></span></div>
    <div class="fu-lnm">${[[L('feh.','prot.'),'var(--protein)',o.m[0]],[L('szénh.','carbs'),'var(--carb)',o.m[1]],[L('zsír','fat'),'var(--fat)',o.m[2]]].map(([l,c,v])=>`<span style="--c:${c}"><i></i><b>${v} g</b><small>${l}</small></span>`).join('')}</div>
    ${o.tag==='becslés'?'':nutri(o.nut||[null,null,null,null])}
    ${o.review?`<p class="fh-note fx-warn">${o.tag==='kamra'?L('Ezt a kamrádból párosítottam név alapján: ellenőrizd, hogy tényleg ez a tétel, és nézd át a mennyiséget.','I matched this from your pantry by name: check that it is the right item, and look over the amount.'):L('Ebben a sorban nem vagyok teljesen biztos: nézd át a mennyiséget.','I am not fully sure about this line: look over the amount.')}</p>`:''}${o.tune||''}</div>`;
function log(arg){
  arg=arg||''; const [a0,a1]=arg.split('.');
  const past=/^potlas/.test(a0), wm=/w([0-3])$/.exec(a0), win=wm?SLOTS[+wm[1]]:null;
  const edit=a0==='javitas'||a0==='torles', em=edit?(mealOf(a1)||MEALS.ebed):null, eid=edit?(mealOf(a1)?a1:'ebed'):null;
  const pre=/^kamra-|^recept-/.test(a0), preK=pre&&/^kamra-/.test(a0)?KAM.find(k=>k.id===a0.slice(6)):null, preR=pre&&/^recept-/.test(a0)?(REC.find(r=>r.id===a0.slice(7))||REC[0]):null;
  const back=past?'mai.d-10-06':'mai', dayChip=past?`${dL(10,6)} · ${L('kedd','Tuesday')}`:`${dL(10,7)} · ${L('ma','today')}`;
  const mode=a0==='szokasos'||a0==='szokasos-ures'?'szokasos':'foto';
  const hasLines=['tetelek','finom','ido','jovo'].includes(a0)||edit||pre;
  /* a piszkozat sorai — az elemzés (draftMealFromAi) kamra-, recept- vagy becsült sort ad; a javítás a logolt étkezés sorait tölti be */
  const LN=edit?em.ings.map(([n,ic,kid,src,k,amt,,mm])=>{const a=parseFloat(amt),K=kid&&KAM.find(x=>x.id===kid),nf=x=>Math.round(parseFloat(String(x).replace(',','.'))*a/100*10)/10;return {n,ic,tag:src,a,u:amt.replace(/^[\d.,]+\s*/,''),step:src==='recept'?1:10,k,m:mm,nut:src==='becslés'?null:K?[null,nf(K.sug),nf(K.salt),nf(K.sat)]:[em.fib,em.sugar,em.salt,em.sat]}})
    :preK?[{n:preK.n,ic:kic(preK),tag:'kamra',a:100,u:'g',step:10,k:preK.kcal,m:[Math.round(preK.p),Math.round(preK.c),Math.round(preK.f)],nut:[0,parseFloat(String(preK.sug).replace(',','.')),parseFloat(String(preK.salt).replace(',','.')),parseFloat(String(preK.sat).replace(',','.'))]}]
    :preR?[{n:preR.n,ic:'t-book',tag:'recept',a:1,u:'adag',step:1,k:Math.round(preR.kcal/preR.serv),m:[Math.round(preR.p/preR.serv),Math.round(preR.c/preR.serv),Math.round(preR.f/preR.serv)],nut:[7,24,.3,6.2],rec:preR}]
    :[{n:'Zabpehely · gluténmentes',ic:'t-carb',tag:'kamra',ai:1,review:a0!=='finom',a:60,u:'g',step:10,k:223,m:[8,35,4],nut:[6,.7,0,.8]},
      a0==='finom'?{n:'Túró · áfonya · méz quick',ic:'t-book',tag:'recept',a:1,u:'adag',step:1,k:306,m:[34,22,9],nut:[2,17,.2,3.9],rec:REC[3],open:1}:{n:'Görög joghurt',ic:'t-protein',tag:'becslés',a:150,u:'g',step:10,k:146,m:[14,6,8]},
      {n:'Erdei gyümölcs',ic:'t-fiber',tag:'becslés',review:1,a:80,u:'g',step:10,k:51,m:[1,10,0]}];
  /* recept-sor finomhangolása (mezo-ormb): a hozzávalók mennyisége erre az egy alkalomra írható át; a módosított sor jelölve, „Alaphelyzet” visszaállít */
  const tune=l=>!l.rec?'':`<div class="fu-tune"><button class="fu-tuh" data-go="log.${l.open?'tetelek':'finom'}" aria-expanded="${!!l.open}" aria-label="${L('Hozzávalók finomhangolása','Fine-tune the ingredients')}"><b>${L('Hozzávalók','Ingredients')} · 3${l.open?L(' · 1 módosítva',' · 1 changed'):''}</b><span>${l.open?L('összecsuk','collapse')+' ▴':L('finomhangolás','fine-tune')+' ▾'}</span></button>
      ${l.open?[['Túró · félzsíros',200,'g',260,250],['Áfonya · fagyasztott',50,'g',29,null],['Akácméz',5,'g',17,null]].map(([n,a,u,k,orig])=>`<div class="fu-tur ${orig?'ch':''}"><span class="g"><strong>${n}</strong><small>${kc(k)} kcal${orig?L(` · eredetileg ${orig} ${u}`,` · originally ${orig} ${u}`):''}</small></span>${stp(a,u,n)}${orig?`<button class="fh-lk" data-toast="${L('Visszaállítva','Reset')}: ${n}" aria-label="${L('Visszaállítás','Reset')}">↺</button>`:''}</div>`).join('')+acts(`<button class="fh-lk" data-toast="${L('Minden hozzávaló az eredeti mennyiségen','Every ingredient is back to the original amount')}">${L('Alaphelyzet','Reset all')}</button>`):''}</div>`;
  const tot=edit?{k:em.kcal,p:em.macro[0],c:em.macro[1],f:em.macro[2]}:LN.reduce((a,l)=>({k:a.k+l.k,p:a.p+l.m[0],c:a.c+l.m[1],f:a.f+l.m[2]}),{k:0,p:0,c:0,f:0});
  const dayEaten=past?1020:edit?DAY.eaten-em.kcal:DAY.eaten, dayT=past?2870:DAY.target, dayP=dayEaten/dayT*94;
  const title=edit?L('Javítás','Edit'):win?sl(win):pre?L('Mit ettél?','What did you eat?'):L('Ablakon kívül','Between meals');
  const top={title,sub:edit?em.name:`${past?L('Pótlás','Late entry'):L('Logolás','Log')} · ${pre?`${L('ma','today')} · ${DAY.now}`:dayChip}`,back:edit?'meal.'+eid:pre?(preK?'kamra.'+preK.id:'recept.'+preR.id):back};
  const saveLbl=edit?L('Mentem a javítást','Save changes'):past?`${L('Pótlás','Late entry')} · ${dS(10,6)}`:`${L('Logolás','Log')} · +10 XP`;
  /* „Mikor ettél?” (csak új logolásnál, ablakos napon): alapból a mostani idő; a kézi idő abba az ablakba teszi az étkezést, amelyikbe esik (resolveEatingTimePlacement) */
  const tOpen=a0==='ido'||a0==='jovo', tVal=a0==='jovo'?'18:30':a0==='ido'?'12:50':null, place=tVal==='12:50'?`${sl(SLOTS[1])} · ${SLOTS[1].from}–${SLOTS[1].to}`:L('Ablakon kívül','Between meals');
  const timeCard=edit?card(`<div class="fx-time"><input class="fh-in" type="time" value="${em.time}" aria-label="${L('Mikor ettél?','When did you eat?')}"></div>`,{i:4})
    :card(`<button class="fh-row fu-twt" data-go="log.${tOpen?'tetelek':'ido'}" aria-expanded="${tOpen}">${bub('t-clock',{s:40})}<span class="g"><strong>${tVal?tVal:`${L('Most','Now')} · ${DAY.now}`}</strong><small>${tVal?place:L('koppints, ha máskor ettél','tap if you ate at another time')}</small></span><span class="fu-car">${tOpen?'▴':'▾'}</span></button>`
      +(tOpen?`<div class="fx-time"><input class="fh-in" type="time" value="${tVal}" aria-label="${L('Evés időpontja','Time of the meal')}">${btn(L('Most','Now'),'log.tetelek','sm ghost')}</div><p class="fh-note">${place}</p>${a0==='jovo'?`<p class="fh-note fx-bad" role="alert">${L('Jövőbeli időpontot nem lehet menteni.','A time in the future cannot be saved.')}</p>`:''}`:''),{i:4});
  const modes=`<div class="fu-modes" role="group" aria-label="${L('Hozzáadás','Add')}">${LMODES.map(([k,hu,en,ic])=>`<button class="${k===mode&&!hasLines?'on':''}" ${k==='kamra'?'data-sheet="kamrapick"':k==='recept'?'data-sheet="receptpick"':k==='foto'?(hasLines?`data-toast="${L('Kamera · fotózd le a tányért','Camera · take a photo of the plate')}"`:`data-go="log.${win?a0:past?'potlas':''}"`):`data-go="log.szokasos"`} aria-pressed="${k===mode&&!hasLines}">${bub(ic,{s:34})}<span>${L(hu,en)}</span></button>`).join('')}</div>`;
  /* az AI-mező: szöveg, hang (a mikrofon a mező saját csempéje, ugyanebbe a szövegbe ír) és a fent csatolt fotó egy piszkozatba kerül */
  const field=(txt)=>`<div class="fx-cmp"><textarea aria-label="${L('Mit ettél?','What did you eat?')}" placeholder="${L('pl. csirkés wrap és egy latte…','e.g. a chicken wrap and a latte…')}">${txt||''}</textarea><button data-toast="${L('Diktálás · a szöveg a mezőbe kerül','Dictation · the text goes into the field')}" aria-label="${L('Diktálás','Dictate')}">${I('t-mic')}</button></div>`;
  const USU=[['Whey + banán + mandulavaj',['Uzsonna','Snack'],22,356],['Túró · áfonya · méz quick',['Uzsonna','Snack'],14,324],['Görög joghurt · dióval',['Uzsonna','Snack'],1,290]];
  const modeBody=mode==='szokasos'?(a0==='szokasos-ures'?empty('t-repeat',L('Még tanulom, mit szoktál enni. Pár logolás után itt lesznek a szokásosaid; addig fotózd le, vagy írd le lent.','I am still learning what you usually eat. After a few logs your usuals will be here; until then take a photo or write it below.'))
      :`<p class="fh-note" style="margin:0 0 8px">${L('Amihez ilyenkor a leggyakrabban nyúlsz. Koppints rá, majd elemezd a szövegmezőből.','What you reach for most often at this time. Tap one, then analyse it from the text field.')}</p>`+USU.map(([n,s,c,k])=>row({icon:'t-plate',title:n,sub:`${L(...s)} · ${c===1?L('egyszer logoltad','logged once'):L(`${c}× logoltad`,`logged ${c}×`)}`,v:`${kc(k)}<small>kcal</small>`,on:{toast:L('A neve a szövegmezőbe került','Its name went into the text field')}})).join(''))
    :a0==='hiba'?`<div class="fu-fail">${bub('t-camera',{s:56,c:'var(--warn)'})}<small>${L('Őszintén szólva','To be honest')}</small><strong>${L('Ezt a tányért nem ismertem fel.','I did not recognise this plate.')}</strong><p>${L('Írd le lent, mit ettél, vagy próbáld meg új fotóval. A szöveget és az új fotót együtt is elemezheted.','Write below what you ate, or try a new photo. You can analyse the text and the new photo together.')}</p>${btn(L('Új fotót készítek','Take a new photo'),{toast:L('Kamera','Camera')},'sm')}</div>`
    :a0==='foto-kesz'?`<div class="fx-ph has"><span class="fu-pimg" role="img" aria-label="${L('A kiválasztott étel fotója','The selected food photo')}">${bub('t-plate',{s:56})}</span><span class="fu-pcap"><span><strong>${L('Ételfotó csatolva','Food photo attached')}</strong><small>IMG_2041.jpg</small></span><button class="fh-lk" data-toast="${L('Kamera','Camera')}">${L('Csere','Replace')}</button><button class="fu-x" data-go="log" aria-label="${L('Fotó eltávolítása','Remove photo')}">×</button></span></div>`
    :`<button class="fx-ph" data-go="log.foto-kesz">${bub('t-plate',{s:56})}<strong>${L('Fotózd le a tányért','Take a photo of the plate')}</strong><small>${L('Koppints a fotózáshoz','Tap to take a photo')}</small></button>`;
  const foot={foot:`<button class="btn ghost" data-go="${top.back}">${L('Mégse','Cancel')}</button>${hasLines?`<button class="btn" ${a0==='jovo'?'disabled':`data-go="${edit?'meal.'+eid:past?back:'cer.reggeli'}"`}>${saveLbl}</button>`:''}`,nonav:pre};
  const linesSec=`${sec(1,`${L('Tételek','Items')} · ${LN.length}`,2)}
  ${card(LN.map(l=>lineCard({...l,tune:tune(l)})).join(''),{cls:'fu-lns0',i:2})}`;
  const mName=edit?em.name:preR?preR.n:preK?preK.n:a0==='finom'?'Zabpehely + Túró · áfonya · méz quick':'Zabpehely + Görög joghurt + Erdei gyümölcs';
  const totalHero=gHero({cls:'fu-lh',lbl:mName,g:numG(pour(dayP,tot.k/dayT*94),kc(tot.k),'kcal',mealCells({macro:[tot.p,tot.c,tot.f],fib:edit?em.fib:pre?(preK?0:7):6})),
    /* a név (a címke) a sorokból áll össze (deriveMealName); javításnál a logolt étkezés saját címe marad. Az ítélet: hol tart ezzel a nap (fuel.consumed + ez az étkezés a kerethez) */
    verdict:dayEaten+tot.k>dayT?L(`Ezzel ${kc(dayEaten+tot.k-dayT)}\u00a0kcal-lal a keret fölé mész.`,`This takes you ${kc(dayEaten+tot.k-dayT)}\u00a0kcal over the budget.`):L(`Ezzel ${kc(dayT-dayEaten-tot.k)}\u00a0kcal marad a keretből.`,`This leaves ${kc(dayT-dayEaten-tot.k)}\u00a0kcal of the budget.`),
    sub:L(`${past?cap(dL(10,6))+' eddig':'Mai nap eddig'} ${kc(dayEaten)} + ${kc(tot.k)} = ${kc(dayEaten+tot.k)} · cél ${kc(dayT)} kcal · ${pl(LN.length,'tétel','item','items')}`,`${past?dL(10,6):'Today'} so far ${kc(dayEaten)} + ${kc(tot.k)} = ${kc(dayEaten+tot.k)} · goal ${kc(dayT)} kcal · ${pl(LN.length,'tétel','item','items')}`),
    body:pk(L(`eddig ${kc(dayEaten)} kcal`,`${kc(dayEaten)} kcal so far`),L('ez az étkezés','this meal'))},1);
  /* JAVÍTÁS: a négy rögzítő út nem jelenik meg; a törlés két lépés (élesítés → megerősítés) */
  if(edit) return page('fuel',top,`${totalHero}${linesSec}
  ${sec(2,L('Mikor ettél?','When did you eat?'),4)}${timeCard}
  ${sec(3,L('Törlés','Delete'),5)}
  ${card(a0==='torles'?`<p class="fh-txt">${L('Biztosan törlöd? A nap összegéből is kikerül.','Delete it? It also comes off the day’s total.')}</p>`+acts(`<button class="btn sm fu-del" data-go="mai" data-toast="${L('Törölve','Deleted')}">${L('Biztosan törlöm','Yes, delete it')}</button>`+lk(L('Inkább megtartom','Keep it'),'log.javitas.'+eid))
    :acts(`<button class="fh-lk fx-bad" data-go="log.torles.${eid}">${L('Törlöm','Delete')}</button>`),{i:5})}`,foot);
  /* „MIT ETTÉL?” — a Kamra-tételről / receptről nyitott lap (LogFlowPage): napszak-választó + három forrás (Kamra · Recept · AI) + az előtöltött sor */
  if(pre) return page('fuel',top,`${totalHero}
  ${sec(1,L('Mikor','When'),2)}${card(seg([[L('Reggeli','Breakfast'),{toast:L('Reggeli','Breakfast')}],[L('Ebéd','Lunch'),{toast:L('Ebéd','Lunch')},true],[L('Vacsora','Dinner'),{toast:L('Vacsora','Dinner')}],['Snack',{toast:'Snack'}]]),{cls:'fu-segc',i:2})}
  ${sec(2,L('Honnan adod hozzá?','Where do you add it from?'),3)}
  ${card(`<div class="fu-modes three">${[['kamrapick','t-stack',L('Kamra','Pantry'),L('polcról, grammra','from the shelf, by gram')],['receptpick','t-book',L('Recept','Recipe'),L('adagra','by serving')],['','t-score','AI',L('fotó vagy szöveg','photo or text')]].map(([s,ic,t,d])=>`<button ${s?`data-sheet="${s}"`:`data-toast="${L('AI · fotó vagy szöveg','AI · photo or text')}"`}>${bub(ic,{s:34})}<span>${t}</span><small>${d}</small></button>`).join('')}</div>`,{i:3})}
  ${sec(3,`${L('Tételek','Items')} · ${LN.length}`,4)}${card(LN.map(l=>lineCard({...l,tune:tune(l)})).join(''),{cls:'fu-lns0',i:4})}`,foot);
  if(hasLines) return page('fuel',top,`${past?pastNote():''}${totalHero}${linesSec}
  ${sec(2,L('Mikor ettél?','When did you eat?'),4)}${timeCard}
  ${sec(3,L('Adj hozzá még','Add more'),5)}${card(modes+field()+acts(btn(L('Elemzés','Analyse'),{toast:L('Elemzem az étkezést…','Analysing the meal…')},'sm ghost')),{i:5})}`,foot);
  const busy=a0==='elemez';
  return page('fuel',top,`${past?pastNote():''}
  ${gHero({lbl:win?`${sl(win)} · ${win.from}–${win.to} · ${L('ablak','window')}`:L('Szabad tétel · te választod a mikort','Free entry · you pick the time'),
    g:numG(pour(dayP,(win?win.b:400)/dayT*94,{ghost:true}),kc(dayT-dayEaten),L('kcal fér még bele','kcal still fits'),pk(L(`eddig ${kc(dayEaten)} kcal`,`${kc(dayEaten)} kcal so far`),win?L(`${sl(win).toLowerCase()} · ${kc(win.b)} kcal keret`,`${sl(win).toLowerCase()} · ${kc(win.b)} kcal budget`):L('ide kerül, amit most logolsz','what you log now goes here'))),
    verdict:busy?L('Elemzem az étkezést…','Analysing the meal…'):L('Mit ettél?','What did you eat?'),sub:L('Szöveg, hang és fotó egy piszkozatban. Elemzés után a felismert tételeket még átírhatod.','Text, voice and photo in one draft. After the analysis you can still change the recognised items.'),
    body:(busy?'':field(a0==='foto-kesz'||a0==='ai-hiba'?'zabkása joghurttal és gyümölccsel':''))+(a0==='ai-hiba'?`<p class="fh-note fx-bad" role="alert">${L('Nem sikerült az elemzés. Próbáld újra, vagy add hozzá kézzel.','The analysis did not work. Try again, or add it by hand.')}</p>`:''),
    acts:busy?'':`<button class="btn" ${a0==='foto-kesz'||a0==='ai-hiba'?'data-go="log.elemez"':'disabled'}>${L('Elemzés','Analyse')}</button>`},1)}
  ${sec(1,L('Honnan adod hozzá?','Where do you add it from?'),2)}
  ${card(modes+`<div class="fx-mode">${modeBody}</div>`+(mode==='foto'&&a0!=='hiba'?note(L('Fotózhatsz, vagy fent rögtön leírhatod, mit ettél.','Take a photo, or write what you ate straight away above.')):''),{i:2})}`,foot);
  function pastNote(){return `<div class="fu-kms rise">${bub('t-history',{s:30})}<span>${L(`Amit itt logolsz, <b>${dL(10,6)}</b> napra könyvelődik; pontszámot is kap.`,`What you log here is booked to <b>${dL(10,6)}</b>; it gets a score too.`)}</span></div>`}
}

/* ═══ KONYHA (C terület) ═══════════════════════════════════════════
   konyha → FuelKonyhaPage · kamra → FuelKamraPage · kamra.<id> → KamraItemDetailPage · receptek → FuelRecipesPage · recept.<id> → RecipeDetailPage ·
   score.r-<id> → FuelRecipeScorePage · recept-uj → RecipeEditorPage · muhely → RecipeWorkshopPage. Állapotok: a regisztráció „notes” részében, linkként. */
const POTIN=`<path d="M4 40H14M106 40H116" stroke="rgba(10,42,60,.22)" stroke-width="7" stroke-linecap="round"/><path d="M26 15H94" stroke="rgba(10,42,60,.22)" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="7" r="5" fill="rgba(10,42,60,.22)"/>`;
/* potG: a fazék. A recepten: egy adag része a fazékból (1 / servings). A Műhelyben: a menthető (kamrából jövő) sorok aránya. 0 = üres fazék, szaggatott vízvonallal (a Konyha főoldalán: meghívó, nem mérés) */
const potG=(p,s=92)=>fill(POT,{vb:POTVB,p:p?4+p*.66:0,s,inner:POTIN+(p?'':`<path d="M22 58H98" stroke="var(--liq2)" stroke-width="2" stroke-dasharray="4 5" opacity=".6"/>`)});
const m3=(p,c,f)=>{const mx=Math.max(p||0,c||0,f||0)||1;return `<span class="fu-m3">${[[L('feh.','prot.'),p,'var(--protein)'],[L('szénh.','carbs'),c,'var(--carb)'],[L('zsír','fat'),f,'var(--fat)']].map(([l,g,col])=>`<span>${level(g==null?0:g/mx*100,{c:col,h:8})}<small><b>${g==null?'—':fmt(g)}</b>${g==null?'':' g'} ${l}</small></span>`).join('')}</span>`};
/* ── C · címkék ── */
const KAT={'Fehérje':'Protein','Tejtermék':'Dairy','Hal':'Fish','Gabona':'Grains','Mag / olajos':'Nuts / seeds','Zöldség':'Vegetables','Gyümölcs':'Fruit','Tojás':'Eggs','Olaj / zsír':'Oils / fats','Egyéb':'Other','Tejsavófehérje':'Whey protein','Kiegészítő':'Supplement','Stimuláns':'Stimulant','Lekvár':'Other'};
const catL=c=>L(c,KAT[c]||c);
const KINDL={food:['étel','food','Étel','Food'],supp:['kiegészítő','supplement','Kiegészítő','Supps'],stim:['stimuláns','stimulant','Stimuláns','Stims'],med:['gyógyszer','medication','Gyógyszer','Meds']};
const kindL=k=>L(KINDL[k][0],KINDL[k][1]);
const srcM=k=>L(SRC[k.src][1],SRC[k.src][2]);
const srcN=k=>k.sl==='Saját bevitel'?L('Saját bevitel','Own entry'):k.sl==='Fotó'?L('Fotó','Photo'):k.sl;
const whenT=k=>k.at?`${dS(k.at[0],k.at[1])} · ${k.at[2]}`:null;
const priceT=k=>k.price?`${kc(k.price[0])} Ft${k.price[1]}`:null;
const CATL={reggeli:['Reggeli','Breakfast'],ebed:['Ebéd','Lunch'],uzsonna:['Uzsonna','Snack'],vacsora:['Vacsora','Dinner']};
const catT=r=>L(...CATL[r.cat]);
const ROLEL={'':['Általános','General'],pre:['Edzés előtt','Before training'],post:['Edzés után','After training']};
const roleT=k=>L(...ROLEL[k||'']);
const GOALS=[['high_protein','Magas fehérje','High protein','t-meat','Alakítsd át magas fehérjetartalmúra.','Make it high in protein.'],['pre_workout','Edzés előtt','Before training','t-bolt','Alakítsd át edzés előtti étkezésnek.','Turn it into a pre-training meal.'],['post_workout','Edzés után','After training','t-dumbbell','Alakítsd át edzés utáni étkezésnek.','Turn it into a post-training meal.'],['before_bed','Lefekvés előtt','Before bed','t-moon','Alakítsd át lefekvés előtti étkezésnek.','Turn it into a bedtime meal.'],['breakfast','Reggeli','Breakfast','t-sun','Alakítsd át reggelinek.','Turn it into a breakfast.']];
/* a szerver adatot ad (hány napja, idő), a mondat itt készül — angolul is */
const lastT=r=>r.last==null?null:r.last[0]===0?L(`ma ${r.last[1]}`,`today ${r.last[1]}`):r.last[0]===1?L(`tegnap ${r.last[1]}`,`yesterday ${r.last[1]}`):L(`${r.last[0]} napja`,`${r.last[0]} days ago`);
const nRec=n=>pl(n,'recept','recipe','recipes'), nItem=n=>pl(n,'tétel','item','items');
/* a Kamra teljes polca: KAM + egy tétel tápérték nélkül (őszinte „—”). A logoló és a protokoll csak a KAM-ot olvassa. */
const KNULL={id:'lekvar',n:'Házi baracklekvár',b:null,k:'food',cat:null,src:'kezi',sl:'Saját bevitel',at:null,kcal:null,p:null,c:null,f:null,sug:null,salt:null,sat:null,nova:null,nv:null,price:null};
const KALL=[...KAM,KNULL];
const kById=id=>KALL.find(k=>k.id===id);
const hasM=k=>k.kcal!=null||k.p!=null||k.c!=null||k.f!=null;
const num=s=>s==null?null:parseFloat(String(s).replace(',','.'));
/* egy sor a Kamra tényeiből (contributionOf / lineContribution): mennyiség / 100 × tápérték */
const lineOf=(k,a,kcal,sv=1)=>({k,n:k.n,a,u:k.u||'g',kcal:kcal??(k.kcal==null?null:Math.round(k.kcal*a/100)),m:k.p==null?null:[k.p,k.c,k.f].map(x=>Math.round(x*a/sv/100)*sv),nv:k.nv,src:'kamra'});
/* a sor makrói adagra kerekítve, × adagszám: így a recept adagja ugyanazt adja, mint a belőle logolt étkezés sorai (MEALS.ings 8. eleme) */
const recLines=r=>r.ings.map(([id,a,kcal])=>lineOf(kById(id),a,kcal,r.serv));
const sumM=ls=>ls.reduce((s,l)=>l.kcal==null?s:{kcal:s.kcal+l.kcal,p:s.p+(l.m?l.m[0]:0),c:s.c+(l.m?l.m[1]:0),f:s.f+(l.m?l.m[2]:0)},{kcal:0,p:0,c:0,f:0});
/* EGY szám: a recept makrói (REC.p/c/f) a sorai összege — a recept oldala, a szerkesztője, a Műhely, a recept-választó és az értékelés is ezt olvassa */
REC.forEach(r=>{const t=sumM(recLines(r));r.p=t.p;r.c=t.c;r.f=t.f});
/* Minőség (qualityTiles): alapanyag-arány = a NOVA 1 sorok kcal-része · energiasűrűség = kcal / gramm × 100 (csak ha minden sor grammban van) · ultra = a NOVA 4 sorok száma; becsült sor nem ad tényt → „—” */
const qOf=ls=>{const tot=ls.reduce((s,l)=>s+(l.kcal||0),0),nv=ls.length>0&&ls.every(l=>l.nv!=null),g=ls.length>0&&ls.every(l=>l.u==='g')?ls.reduce((s,l)=>s+l.a,0):null;
  return {base:nv&&tot?Math.round(ls.filter(l=>l.nv===1).reduce((s,l)=>s+l.kcal,0)/tot*100):null,dens:g&&tot?Math.round(tot/g*100):null,ultra:nv?ls.filter(l=>l.nv===4).length:null}};
const qTiles=q=>{const tile=(k,ic,n,unit,pct,c2)=>stat({k,icon:ic,n:n==null?'—':n,unit:n==null?'':unit,pct:n==null?null:pct,c:c2,s:n==null?L('nincs adat','no data'):''});
  return grid([tile(L('Alapanyag-arány','Whole-food share'),'t-processing',q.base,'%',q.base,'var(--carb)'),tile(L('Energiasűrűség','Energy density'),'t-bolt',q.dens,'kcal/100 g',q.dens==null?null:Math.min(100,q.dens/4),'var(--protein)'),
    tile(L('Ultra-feldolgozott','Ultra-processed'),'t-ultra',q.ultra,L('tétel',q.ultra===1?'item':'items'),q.ultra==null?null:Math.min(100,q.ultra*34),q.ultra?'var(--lilac)':'var(--water)')])};
/* Mikrotápanyagok (FuelMicroSection): a négy tárolt tény egy étkezés-méretű kerethez mérve; fr = a keret neve („az adag” / „a recept”) */
const microRows=(v,fr)=>{const STL=[L('rendben','fine'),L('oké','okay'),L('figyeld','watch it')];
  return [[L('Rost','Fibre'),v[0],7,'t-fiber','var(--fiber)',x=>x>=6?0:1,0],[L('Cukor','Sugar'),v[1],25,'t-sugar','var(--lilac)',x=>x<=12?0:x<=22?1:2,1],[L('Só','Salt'),v[2],1.7,'t-salt','var(--water)',x=>x<=1?0:1,1],[L('Telített zsír','Saturated fat'),v[3],7,'t-avocado','var(--carb)',x=>x<=5?0:x<=9?1:2,1]]
  .map(([l,x,al,ic,col,stf,lim])=>x==null?row({left:bub(ic,{s:40,c:'var(--faint)'}),title:l,sub:L('a forrás nem adott értéket','the source gave no value'),v:'—',right:st(L('nincs adat','no data'),'q')})
    :irow({icon:ic,title:l,v:`${fmt(Math.round(x*10)/10)}<small>g</small>`,sub:lim?L(`${fr[0]}-keret ${Math.round(x/al*100)}%-a`,`${Math.round(x/al*100)}% of ${fr[1]} limit`):L(`${fr[0]}-cél ${Math.round(x/al*100)}%-a`,`${Math.round(x/al*100)}% of ${fr[1]} target`),l2:`<span class="fu-sh">${level(Math.min(100,x/al*100),{h:8,c:col})}</span>${st(STL[stf(x)],stf(x)===2?'warn':stf(x)?'q':'ok')}`})).join('')
  +note(L('Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.','This is what we store today. Vitamins and minerals are on the way.'))};
const FR1=['az adag','a serving’s'], FRW=['a recept','the recipe’s'];
const amtT=(a,u)=>`${fmt(Math.round(a*10)/10)} ${u}`;
/* olvasható hozzávaló-sorok (FuelIngredientSection): eredet · NOVA rövid neve · kcal · rész a recept kalóriájából · mennyiség. Nem koppintható (az élőben sem). */
const ingRows=(ls,d)=>{const tot=ls.reduce((s,l)=>s+(l.kcal||0),0)||1;return ls.map(l=>irow({icon:kic(l.k),title:l.n,sub:`<span class="fu-tags"><em>${L('kamra','pantry')}</em>${l.nv?`<em style="--c:${NOVA[l.nv][2]}"><i></i>${L(NOVA[l.nv][0],NOVA[l.nv][1])}</em>`:''}</span>`,v:l.kcal==null?'—':`${kc(l.kcal/d)}<small>kcal</small>`,
  l2:`<span class="fu-sh">${level(l.kcal==null?0:l.kcal/tot*100,{h:8})}</span><small class="fu-shn">${amtT(l.a/d,l.u)}${l.kcal==null?'':` · ${Math.round(l.kcal/tot*100)}%`}</small>`})).join('')};
/* szerkeszthető sor (a kézi szerkesztő és a Műhely sora): név · címke · × · léptető gépelhető mennyiséggel · kcal · a sor makrói; kcal null = feloldatlan kamra-sor („—”) */
const cLine=o=>`<div class="fu-ln"><div class="fu-lnt">${bub(o.ic,{s:36})}<span class="g"><strong>${o.n}</strong><small class="fu-tags">${o.tag?`<em class="${o.est?'w':''}">${o.tag}</em>`:''}${o.kind?`<em>${o.kind}</em>`:''}${o.b?`<em>${o.b}</em>`:''}</small></span><button class="fu-x" data-toast="${L('Eltávolítva','Removed')}: ${esc(o.n)}" aria-label="${L(`${esc(o.n)} eltávolítása`,`Remove ${esc(o.n)}`)}">×</button></div>
    <div class="fu-lns"><span class="fx-stp"><button data-toast="${esc(o.n)}: −10" aria-label="${L(`${esc(o.n)} csökkentés`,`Less ${esc(o.n)}`)}">−</button><input class="fh-in" inputmode="decimal" value="${o.a}" aria-label="${L(`${esc(o.n)} mennyisége`,`Amount of ${esc(o.n)}`)}"><button data-toast="${esc(o.n)}: +10" aria-label="${L(`${esc(o.n)} növelés`,`More ${esc(o.n)}`)}">+</button><small>${o.u}</small></span><span class="fu-lnk"><b>${o.kcal==null?'—':kc(o.kcal)}</b><small>kcal</small></span></div>
    <div class="fu-lnm">${[[L('feh.','prot.'),'var(--protein)',0],[L('szénh.','carbs'),'var(--carb)',1],[L('zsír','fat'),'var(--fat)',2]].map(([l,c,i])=>`<span style="--c:${c}"><i></i><b>${o.m?o.m[i]+' g':'—'}</b><small>${l}</small></span>`).join('')}</div>${o.x||''}</div>`;
const servSeg=(n,all,a,b)=>seg([[L('1 adag','1 serving'),a,!all],[L(`Egész · ${n} adag`,`Whole · ${pl(n,'','serving','servings')}`),b,all]]);
const macroV=(p,c,f)=>p==null||c==null||f==null?vials([[L('Fehérje','Protein'),'t-meat','var(--protein)',p],[L('Szénhidrát','Carbs'),'t-carb','var(--carb)',c],[L('Zsír','Fat'),'t-avocado','var(--fat)',f]].map(([l,ic,col,g])=>({l,ic,c:col,p:g==null?0:Math.max(6,g),v:g==null?'—':fmt(g)+' g',s:g==null?L('nincs adat','no data'):''})),{h:104}):macroVials(p,c,f);
const goalRow=(on,act)=>`<div class="fx-goals">${ipills(GOALS.map(([k,hu,en,ic])=>[L(hu,en),act,k===on,ic]))}</div>`;

function konyha(arg){
  const emp=arg==='ures', recs=emp?[]:REC, items=emp?[]:KALL, food=items.filter(k=>k.k==='food').length, fav=recs.slice().sort((a,b)=>b.logged-a.logged)[0];
  /* a hős a Receptműhely meghívója (élő: a hub saját posztere); a fazék üres — itt nincs mért szint. A támasztó tények valódi darabszámok (useRecipes, usePantry). A cél-sor dísz, mint az élőben: a kártya a Műhelyt nyitja. */
  return page('fuel',{title:'Konyha',sub:`Fuel · ${nRec(recs.length)}`,tab:'konyha'},`
  ${hero({lbl:L('Receptműhely · üres fazék','Recipe workshop · empty pot'),verdict:L('Főzzünk ki valamit.','Let’s cook up a meal.'),sub:L(`Te mondod a célt, én a hozzávalót. A számokat a kamrád adja: ${items.length} tétel van a polcodon.`,`You name the goal, I suggest the ingredients. The numbers come from your pantry: ${nItem(items.length)} on your shelf.`),left:`<span class="fu-pot">${potG(0,96)}</span>`,
    body:`<div class="fc-goals" aria-hidden="true">${GOALS.map(([,hu,en,ic])=>`<span>${bub(ic,{s:24})}${L(hu,en)}</span>`).join('')}</div>`,
    acts:btn(L('Műhely megnyitása','Open the workshop'),'muhely')},1)}
  ${sec(1,L('Gyors felvétel','Quick add'),2)}
  ${card(`<div class="fh-pair fu-pair"><button data-go="recept-uj">${bub('t-book',{s:46})}${L('Recept mentése','Save a recipe')}<small>${L('kézzel, a saját szavaiddal','by hand, in your own words')}</small></button><button data-sheet="import">${bub('t-camera',{s:46})}${L('Új elem a kamrába','New pantry item')}<small>${L('fotó a címkéről vagy egy termék linkje','a photo of the label or a product link')}</small></button></div>`,{i:2})}
  ${sec(2,L('Receptek','Recipes'),3)}
  ${card(row({icon:'t-book',title:nRec(recs.length),sub:fav&&fav.logged?L(`kedvenced most: ${fav.n} · ${fav.logged}× etted`,`your favourite right now: ${fav.n} · eaten ${fav.logged} times`):L('még egyet sem mentettél','none saved yet'),on:'receptek'})
    +(recs.length?`<div class="fu-bubs" aria-hidden="true">${recs.slice(0,5).map(r=>bub(CAT[r.cat][1],{s:42})).join('')}</div>`:''),{i:3})}
  ${sec(3,L('Kamra','Pantry'),4)}
  ${card(row({icon:'t-stack',title:L(`${items.length} tétel a polcon`,`${nItem(items.length)} on the shelf`),sub:L('ebből főzünk, ebből számolunk','what we cook and count from'),on:'kamra'})
    +(items.length?split([[L('Étel','Food'),food,'var(--dom)',String(food)],[L('Kiegészítő','Supplements'),items.length-food,'var(--water)',String(items.length-food)]],{h:18}):''),{i:4})}`);
}
/* ═ KAMRA: kamra · kamra.ures · kamra.tolt · kamra.szurt · kamra.nincstalalat · kamra.<id>[.torles | .hianyos] · kamra.nincs ═ */
const KRES=['ures','tolt','szurt','nincstalalat'];
function kamra(arg){
  const [a0,a1]=String(arg||'').split('.');
  if(a0&&!KRES.includes(a0)) return kamraItem(a0,a1);
  const emp=a0==='ures', load=a0==='tolt', flt=a0==='szurt', none=a0==='nincstalalat', n=k=>KALL.filter(x=>x.k===k).length, N=KALL.length;
  const jars=z=>vials([['food','t-carb'],['supp','t-supps'],['stim','t-bolt'],['med','t-syringe']].map(([k,ic])=>({l:L(KINDL[k][2],KINDL[k][3]),ic,p:z?0:n(k)/N*100,v:z?(load?'—':'0'):String(n(k)),s:L('tétel','items')})),{h:84});
  const tools=btn(L('+ Új tétel','+ New item'),{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk(L('Közös katalógus','Shared catalogue'),{sheet:'catalog'});
  const top={title:L('Kamra','Pantry'),sub:emp?L('Konyha · üres polc','Kitchen · empty shelf'):load?L('Konyha','Kitchen'):`${L('Konyha','Kitchen')} · ${nItem(N)}`,back:'konyha'};
  if(load) return page('fuel',top,`${gHero({lbl:L('A polcod','Your shelf'),g:jars(1),verdict:L('Betöltöm a polcodat…','Loading your shelf…'),sub:L('Egy pillanat, és itt lesznek a tételeid.','One moment and your items will be here.')},1)}`);
  if(emp) return page('fuel',top,`
  ${gHero({lbl:L('A polcod · négy üres üveg','Your shelf · four empty jars'),g:jars(1),verdict:L('A kamra üres.','Your pantry is empty.'),sub:L('Vedd fel az első tételt, vagy válassz a közös katalógusból; itt jelenik meg a polcodon.','Add your first item or pick one from the shared catalogue. It will show up here on your shelf.'),
    acts:btn(L('Első tétel felvétele','Add the first item'),{sheet:'add'})+btn('Import',{sheet:'import'},'sm ghost')+lk(L('Közös katalógus','Shared catalogue'),{sheet:'catalog'})},1)}`);
  /* a három tengely ÉS-elve szűr: fajta ÉS kategória ÉS keresés */
  const list=none?[]:flt?KALL.filter(k=>k.k==='food'&&(k.cat==='Fehérje'||k.cat==='Tejtermék')):KALL;
  const tile=k=>k.k==='food'?stat({k:k.n,icon:kic(k),n:k.kcal==null?'—':k.kcal,unit:k.kcal==null?'':`kcal / 100 ${k.u||'g'}`,pct:k.p==null?null:Math.max(6,Math.min(100,k.p/25*100)),c:'var(--protein)',s:[k.kcal==null?L('nincs adat','no data'):k.p==null?null:L(`${fmt(k.p)} g fehérje`,`${fmt(k.p)} g protein`),k.b,srcM(k)].filter(Boolean).join(' · '),on:'kamra.'+k.id})
    :stat({k:k.n,icon:kic(k),n:`<em>${(k.dose||'—').replace(/ \+ /,' +<wbr>')}</em>`/* <em>, not a classed span: the kit's stat() turns every space of n into a no-break space, attributes included */,unit:L('adag','dose'),s:[kindL(k.k),k.b,srcM(k)].join(' · '),c:'var(--water)',on:'kamra.'+k.id});
  return page('fuel',top,`
  ${gHero({lbl:L('A polcod · fajtánként','Your shelf · by kind'),g:jars(0),verdict:L(`${N} tétel van a polcodon: ${n('food')} étel és ${N-n('food')} kiegészítő.`,`${nItem(N)} on your shelf: ${pl(n('food'),'','food','foods')} and ${pl(N-n('food'),'','supplement','supplements')}.`),acts:tools},1)}
  ${sec(1,L('Keresés és szűrés','Search and filter'),2)}
  ${card((none?srch('','kókusz'):`<div class="fx-srch" data-toast="${L('Keresés a kamrában','Search the pantry')}">${bub('t-lens',{s:28})}${L('Keress tételt, márkát…','Search items or brands…')}</div>`)
    +`<div style="margin-top:10px">${pick([[L('Mind','All'),N],...['food','supp','stim','med'].map(k=>[L(KINDL[k][2],KINDL[k][3]),n(k)])],flt?L('Étel','Food'):L('Mind','All'),L('Szűrő','Filter'))}</div>`
    +(flt?`<div class="fc-cats">${['Fehérje','Tejtermék'].map(c=>`<button data-toast="${L('Szűrő levéve','Filter removed')}: ${catL(c)}" aria-label="${L(`${catL(c)} szűrő levétele`,`Remove the ${catL(c)} filter`)}">${catL(c)}<b>×</b></button>`).join('')}</div>`:'')
    +acts(lk(flt?L('Szűrők · 2 kategória','Filters · 2 categories'):L('Szűrők · kategória szerint','Filters · by category'),{sheet:'catfilter',arg:flt?'2':''})),{i:2})}
  ${sec(2,L('A polcon','On the shelf'),3)}
  ${card(list.length?grid(list.map(tile))+note(L('Az ételeknél a csempe szintje a fehérje-sűrűség: 25 g fehérjénél tele van (100 grammban).','For foods, the tile’s level is protein density: it is full at 25 g of protein per 100 g.')):empty('t-lens',L('Nincs egyező tétel.','No matching item.')),{cls:'fu-shelf',i:3})}
  ${none||flt?'':`${sec(3,L('Okosabb csere','A smarter swap'),4)}
  ${card(`<div class="fc-swap"><div>${bub('t-swap',{s:40})}<span><strong>Görög joghurt 10% · 500 g</strong><small>${L('katalógus','catalogue')} · kifli.hu</small></span><b>${kc(1790)} Ft</b></div><p>${L('Több fehérje 100 grammban, mint a mostani joghurtodban, hasonló áron.','More protein per 100 g than your current yoghurt, at a similar price.')}</p></div>`
    +note(L('Javaslat a polcod alapján, szabály szerint számolva. Ha nincs mit ajánlani, ez a rész nem jelenik meg.','A suggestion from your shelf, worked out by rule. When there is nothing to suggest, this part is not shown.')),{i:4})}`}`);
}
function kamraItem(id,st2){
  const k0=kById(id);
  if(!k0) return page('fuel',{title:L('Nincs ilyen tétel','No such item'),sub:L('Kamra','Pantry'),back:'kamra'},`${card(empty('t-stack',L('Lehet, hogy közben levetted a polcról. A Kamrában minden megmaradt tételed ott van.','You may have taken it off the shelf. Everything you still have is in the Pantry.'),btn(L('Vissza a Kamrába','Back to the Pantry'),'kamra','sm')),{i:1})}`);
  const k=st2==='hianyos'?{...k0,f:null}:k0, food=k.k==='food', ic=kic(k), M=hasM(k), u=k.u||'g', per=`100 ${u}`, arm=st2==='torles';
  /* „a kiegészítőid között · {zóna} {idő}”: a mai protokoll-vetület (useStackDay().slots) — a B terület stackVM-je */
  const slot=food?null:stackVM('').rows.find(r=>r.id===k.id)||null;
  const recs=REC.filter(r=>r.ings.some(x=>x[0]===k.id));
  /* a 100 g-os összetétel csak akkor rajzolható, ha mindhárom makró megvan és az egység gramm; a maradék számolt (víz, rost, hamu), nem mért */
  const comp=u==='g'&&k.p!=null&&k.c!=null&&k.f!=null, rest=comp?Math.max(0,Math.round((100-k.p-k.c-k.f)*10)/10):0;
  const edit=lk(L('Szerkesztés','Edit'),{sheet:'add',arg:(k.lock?'lock|':'edit|')+k.id})+(arm?`<button class="fh-lk fx-bad" data-go="kamra">${L('Biztos? Még egy érintés a törléshez','Sure? Tap once more to delete')}</button>`:lk(L('Törlés','Delete'),'kamra.'+k.id+'.torles'));
  const src=card(row({icon:'t-stack',title:L('A polcodon','On your shelf'),sub:k.b||(k.cat?catL(k.cat):L('nincs márka megadva','no brand given'))})
    +row({icon:SRC[k.src][0],title:L(`Így került a polcra: ${srcM(k)}`,`How it got here: ${srcM(k)}`),sub:`${srcN(k)} · ${whenT(k)||L('az időpont nincs rögzítve','time not recorded')}${k.shared?`<br>${L('közös','shared')} · ${k.shared}`:''}`})
    +(k.price?row({icon:'t-coin',title:L('Ár','Price'),v:priceT(k)}):''),{i:4});
  /* a fő mondat: ételnél a domináns makró (energia szerint), kiegészítőnél az idősáv saját mondata — egy üzenet sávonként, nem ragasztott szó */
  const ZPH={wake:['Ébredés után szeded.','You take it when you wake up.'],breakfast:['Reggelihez szeded.','You take it with breakfast.'],pre_workout:['Edzés előtt szeded.','You take it before training.'],post_workout:['Edzés után szeded.','You take it after training.'],lunch:['Ebédhez szeded.','You take it with lunch.'],dinner:['Vacsorához szeded.','You take it with dinner.'],evening:['Este szeded.','You take it in the evening.'],bedtime:['Lefekvés előtt szeded.','You take it before bed.']};
  const dom=k.p==null||k.c==null||k.f==null?null:[[k.p*4,0],[k.c*4,1],[k.f*9,2]].sort((x,y)=>y[0]-x[0])[0][1], uu=u==='ml'?L('milliliterben','ml'):L('grammban','g');
  const verdict=!food?(slot?L(...ZPH[slot.z]):L('Nincs időzítve.','Not scheduled.'))
    :!M?L('Ehhez a tételhez még nincs tápérték.','No nutrition values for this item yet.'):dom===0?L(`${fmt(k.p)} g fehérje van 100 ${u==='ml'?'milliliterében':'grammjában'}.`,`${fmt(k.p)} g of protein in every 100 ${u}.`):dom===1?L(`Főleg szénhidrát: ${fmt(k.c)} g van 100 ${uu}.`,`Mostly carbs: ${fmt(k.c)} g in every 100 ${u}.`):dom===2?L(`Főleg zsír: ${fmt(k.f)} g van 100 ${uu}.`,`Mostly fat: ${fmt(k.f)} g in every 100 ${u}.`):L('Ehhez a tételhez csak részben van tápérték.','This item has only part of its nutrition values.');
  let i=0; const S=(t)=>sec(++i,t,i+1);
  return page('fuel',{title:k.n,sub:[L('Kamra','Pantry'),k.cat?catL(k.cat):null].filter(Boolean).join(' · '),back:'kamra'},`
  ${nh({lbl:k.b||kindL(k.k),n:food?(k.kcal==null?'—':k.kcal):`<span class="fc-dn">${k.dose||'—'}</span>`,unit:food?`kcal / ${per}`:L('egy adag','one dose'),art:ic,verdict,
    sub:food&&!M?L('A forrás nem adott értéket. A Szerkesztésnél kézzel beírhatod.','The source gave none. You can type them in under Edit.'):'',
    body:comp&&food?lab(L(`Mi van 100 grammban?`,`What’s in 100 g?`))+split([[L('Fehérje','Protein'),k.p,'var(--protein)',fmt(k.p)+' g'],[L('Szénhidrát','Carbs'),k.c,'var(--carb)',fmt(k.c)+' g'],[L('Zsír','Fat'),k.f,'var(--fat)',fmt(k.f)+' g'],[L('Egyéb (víz, rost…)','The rest (water, fibre…)'),rest,'color-mix(in srgb,var(--water) 30%,#fff)',fmt(rest)+' g']],{h:30}):'',
    acts:(M?btn(L('Logolás · mai étkezésbe','Log it · into today’s meal'),'log.kamra-'+k.id):food?'':btn(L('Kiegészítők megnyitása','Open Supplements'),'stack'))+edit},1)}
  ${food?'':`${S(L('A napodban','In your day'))}
  ${card(row({icon:'t-clock',title:k.proto||L('Nincs időzítve','Not scheduled'),sub:slot?L(`a kiegészítőid között · ${zl(slot.z)} ${slot.time}`,`among your supplements · ${zl(slot.z)} ${slot.time}`):L('A Kiegészítők oldalon pipálod; ott látod a szedési rendet is','You tick it on Supplements. Your schedule is there too'),on:'stack'}),{i:2})}`}
  ${M?`${S(L('Makrók','Macros'))}${card(macroV(k.p,k.c,k.f),{cls:'fu-mac',i:2})}
  ${S(L(`Minőség · ${per}`,`Quality · per ${per}`))}
  ${card([[L('Cukor','Sugar'),'t-sugar',k.sug],[L('Só','Salt'),'t-salt',k.salt],[L('Telített zsír','Saturated fat'),'t-fat',k.sat]].map(([l,ic2,v])=>row({icon:ic2,title:l,v:v==null?'—':`${fmt(num(v))}<small>g</small>`})).join('')
    +row({icon:'t-processing',title:L('Feldolgozottság','Processing'),sub:k.nv?`NOVA ${k.nv}`:L('nincs adat','no data'),right:k.nv?st(L(NOVA[k.nv][0],NOVA[k.nv][1]),k.nv===1?'ok':k.nv===4?'warn':'q'):`<span class="v">—</span>`}),{i:3})}`:''}
  ${S(L('Forrás','Source'))}${src}
  ${recs.length?S(L('Receptekben','Used in recipes'))+card(recs.map(r=>row({icon:'t-plate',title:r.n,sub:`${catT(r)} · ${L(`${r.logged}× etted`,`eaten ${r.logged} times`)}`,on:'recept.'+r.id})).join(''),{i:5}):''}`);
}
/* ═ RECEPTEK: receptek · receptek.ures · receptek.szurt-ures · receptek.tolt ═ */
function receptek(arg){
  const emp=arg==='ures', fe=arg==='szurt-ures', load=arg==='tolt', recs=emp||load?[]:fe?REC.map(r=>({...r,star:0})):REC, top=recs.slice().sort((a,b)=>b.logged-a.logged), fav=top[0];
  const ttl={title:L('Receptek','Recipes'),sub:load?L('Konyha','Kitchen'):`${L('Konyha','Kitchen')} · ${nRec(recs.length)}`,back:'konyha'};
  if(load) return page('fuel',ttl,`${gHero({lbl:L('Receptek','Recipes'),g:`<div class="fu-top">${[0,1,2].map(()=>`<span class="fc-sk">${level(0,{h:14})}</span>`).join('')}</div>`,verdict:L('Betöltöm a receptjeidet…','Loading your recipes…'),sub:L('Egy pillanat, és itt lesznek.','One moment and they will be here.')},1)}`);
  const cnt=f=>recs.filter(f).length, F2=[[L('Mind','All'),recs.length],[L('Reggeli','Breakfast'),cnt(r=>r.cat==='reggeli')],[L('Ebéd','Lunch'),cnt(r=>r.cat==='ebed')],[L('Vacsora','Dinner'),cnt(r=>r.cat==='vacsora')],[L('Uzsonna','Snack'),cnt(r=>r.cat==='uzsonna')],[L('Csillagos','Starred'),cnt(r=>r.star)]];
  const none=card(empty('t-plate',emp?L('Még nincs recepted.','You have no recipes yet.'):L('Erre a szűrésre nincs recepted.','No recipe matches this filter.'),lk(L('Mentsünk egyet','Save one'),'recept-uj')),{i:3});
  /* a hős: amit a legtöbbször ettél (Recipe.timesLogged — a lap betölti); ha még egyet sem ettél, szintek nélkül */
  return page('fuel',ttl,`
  ${gHero({lbl:fav&&fav.logged?L('Receptek · amit a legtöbbször ettél','Recipes · what you eat most'):L('Receptek','Recipes'),g:fav&&fav.logged?`<div class="fu-top">${top.slice(0,4).map(r=>`<button data-go="recept.${r.id}"><span><b>${r.n}</b><em>${r.logged}×</em></span>${level(r.logged/fav.logged*100,{h:14})}</button>`).join('')}</div>`:`<div class="fu-potc">${potG(0,120)}</div>`,
    verdict:!recs.length?L('Még nincs recepted.','You have no recipes yet.'):fav.logged?L(`${recs.length} recepted van, a kedvencedet ${fav.logged} alkalommal etted.`,`You have ${nRec(recs.length)}. You’ve eaten your favourite ${fav.logged} times.`):L('Még egyik receptedet sem etted.','You haven’t eaten any of your recipes yet.'),
    sub:!recs.length?L('Mentsd el, amit gyakran eszel: legközelebb egy koppintás lesz felírni.','Save what you eat often: next time, logging it is one tap.'):fav.logged?L(`${fav.n} · legutóbb ${lastT(fav)}.`,`${fav.n} · last time ${lastT(fav)}.`):'',acts:btn(L('+ Új recept','+ New recipe'),'recept-uj')},1)}
  ${sec(1,L('Szűrés','Filter'),2)}
  ${card(pick(F2,fe?L('Csillagos','Starred'):L('Mind','All'),L('Szűrő','Filter')),{i:2})}
  ${sec(2,L('Receptjeid','Your recipes'),3)}
  ${emp||fe?none:card(recs.map(r=>irow({icon:CAT[r.cat][1],title:r.n,sub:[catT(r),r.min?L(`${r.min} perc`,`${r.min} min`):null,r.role?roleT(r.role):null,r.serv>1?pl(r.serv,'adag','serving','servings'):null].filter(Boolean).join(' · '),v:`${kc(r.kcal/r.serv)}<small>kcal</small>`,
      l2:m3(Math.round(r.p/r.serv),Math.round(r.c/r.serv),Math.round(r.f/r.serv))+`<span class="fu-tags">${r.star?st(L('csillagos','starred'),'plan'):''}${r.score?st(L(`${fmt(r.score)} pont`,`${fmt(r.score)} points`),'ok'):st(L('értékelés folyamatban','being scored'),'q')}</span>`,on:'recept.'+r.id})).join('')
    +note(L('A szám egy adag kalóriája; a három sáv az adag fehérje-, szénhidrát- és zsírtartalma.','The number is one serving’s calories. The three bars are its protein, carbs and fat.')),{i:3})}`);
}
/* ═ RECEPT: recept.<id>[.egesz | .ertekel | .ujra | .nincsolvasat | .torles | .nemettem] · recept.nincs ═ */
const recNone=()=>page('fuel',{title:L('Nincs ilyen recept','No such recipe'),sub:L('Receptek','Recipes'),back:'receptek'},`${card(empty('t-book',L('Lehet, hogy közben törölted. A Receptek listán minden megmaradt recepted ott van.','You may have deleted it. Everything you still have is in Recipes.'),btn(L('Vissza a Receptekhez','Back to Recipes'),'receptek','sm')),{i:1})}`);
function recept(arg){
  const [id,mode]=(arg||'r1').split('.'); const r0=REC.find(x=>x.id===id); if(!r0) return recNone();
  const r=mode==='nemettem'?{...r0,logged:0,last:null,today:[]}:r0, all=mode==='egesz', d=all?1:r.serv, v=k=>Math.round(r[k]/d), ls=recLines(r);
  /* a bontás állapotai (useRecipeBreakdown): pending = első olvasat készül · refreshing = szerkesztés utáni újraértékelés (a régi szöveget nem mutatjuk késznek) · nincs olvasat */
  const busy=mode==='ertekel'||mode==='ujra', noB=busy||mode==='nincsolvasat'||r.score==null, sc=noB?null:r.score, arm=mode==='torles', nut=[r.fib,r.sugar,r.salt,r.sat].map(x=>x==null?null:x/d);
  return page('fuel',{title:r.n,sub:L(`${catT(r)}-recept`,`${catT(r)} recipe`),back:'receptek'},`
  ${gHero({lbl:all?L(`Egész recept · ${r.serv} adag`,`Whole recipe · ${pl(r.serv,'','serving','servings')}`):r.serv>1?L(`Egy adag a fazékból · ${r.serv} adagos`,`One serving from the pot · serves ${r.serv}`):L('Egy adag · a teljes fazék','One serving · the whole pot'),
    g:numG(`<span class="fu-pot">${potG(all?100:100/r.serv,104)}</span>`,kc(v('kcal')),all?L('kcal · egész','kcal · whole'):L('kcal / adag','kcal / serving'),`<p>${[pl(r.serv,'adag','serving','servings'),r.min?L(`${r.min} perc alatt kész`,`ready in ${r.min} min`):L('elkészítési idő nincs megadva','no cooking time given'),'NOVA '+r.nova].join(' · ')}</p><p>${L(`létrehozva ${dS(...r.date)}`,`created ${dS(...r.date)}`)}</p>`),
    verdict:r.logged?L(`${r.logged}× etted, legutóbb ${lastT(r)}.`,`Eaten ${r.logged} times, last ${lastT(r)}.`):L('Még nem etted.','Not eaten yet.'),
    sub:(r.role?roleT(r.role)+' · ':'')+(r.logged?(sc!=null?L(`Mezo értékelése: ${fmt(sc)}.`,`Mezo’s rating: ${fmt(sc)}.`):mode==='nincsolvasat'?L('Még nincs értékelés: kevés az adat.','No rating yet: too little data.'):L('Az értékelés folyamatban.','The rating is in progress.')):L('Naplózd, ha elkészült.','Log it when it’s made.')),
    body:r.serv>1?`<div style="margin-top:12px">${servSeg(r.serv,all,'recept.'+r.id,'recept.'+r.id+'.egesz')}</div>`:'',
    acts:btn(L('Ma ettem ilyet','I ate this today'),'log.recept-'+r.id)+(sc!=null?lk(`${L('Mezo értékelése','Mezo’s rating')} ${fmt(sc)} ›`,'score.r-'+r.id):'')},1)}
  ${sec(1,L('Makrók','Macros'),2)}
  ${card(macroVials(v('p'),v('c'),v('f')),{cls:'fu-mac',i:2})}
  ${sec(2,`${L('Hozzávalók','Ingredients')} · ${ls.length}`,3)}
  ${card(ingRows(ls,d)+note(L('A sáv azt mutatja, a recept kalóriájának mekkora részét adja a tétel.','The bar shows how much of the recipe’s calories the item gives.')),{i:3})}
  ${sec(3,L('Minőség és mikrotápanyagok','Quality and micronutrients'),4)}
  ${card(qTiles(qOf(ls)),{cls:'fu-q',i:4})}
  ${card(microRows(nut,all?FRW:FR1),{i:4})}
  ${sec(4,L('Mezo jegyzete','Mezo’s note'),5)}
  ${card((busy?txt(mode==='ujra'?L('Mezo újraértékeli…','Mezo is reading it again…'):L('Mezo értékeli…','Mezo is reading it…')):r.prose&&!noB?txt(r.prose)+(r.fits?`<div class="fh-chips fu-chips"><span>${r.fits}</span></div>`:''):txt(L('Még nincs olvasat.','No reading yet.')))
    +(sc!=null?row({icon:'t-score',title:L('Mezo értékelése','Mezo’s rating'),sub:L(`8 szempont · megbízhatóság ${r.cert}%`,`8 aspects · confidence ${r.cert}%`),v:fmt(sc),on:'score.r-'+r.id})
      :`<div class="fh-row fc-off"><span class="si">${I('t-score')}</span><span class="g"><strong>${L('Mezo értékelése','Mezo’s rating')}</strong><small>${busy?L('Amint elkészül, itt nyílik.','It opens here as soon as it is ready.'):L('A sablon értékeléséhez még nincs elég adat (kcal nélküli hozzávalók).','Not enough data to rate the template yet (ingredients without kcal).')}</small></span><span class="v">—</span></div>`),{i:5})}
  ${sec(5,L('Mit tehetsz vele','What you can do'),6)}
  ${card(row({icon:'t-plate',title:L('Logolás · ma ettem ilyet','Log it · I ate this today'),sub:L('a logolás ezzel a recepttel nyílik','logging opens with this recipe'),on:'log.recept-'+r.id})
    +row({icon:'t-chef',title:L('Tovább alakítom a Műhelyben','Rework it in the workshop'),sub:L('ebből indul; mentéskor ezt a receptet frissíti','starts from this one; saving updates this recipe'),on:'muhely.recept-'+r.id})
    +row({icon:'t-journal',title:L(`Logok · ${r.today.length}`,`Logs · ${r.today.length}`),sub:r.today.length?L('ma is a naplódban','in today’s log too'):L('ma még nincs logolva','not logged today'),on:{sheet:'reclogs',arg:mode==='nemettem'?'':r.id}})
    +acts(btn(L('Szerkesztés','Edit'),'recept-uj.szerk-'+r.id,'sm ghost')+lk(r.star?L('Csillag le','Unstar'):L('Csillag','Star'),{toast:r.star?L('Csillag levéve','Star removed'):L('Csillagos lett','Starred')})
      +(arm?`<button class="fh-lk fx-bad" data-go="receptek">${L('Biztos? Még egy érintés a törléshez','Sure? Tap once more to delete')}</button>`:lk(L('Törlés','Delete'),'recept.'+r.id+'.torles'))),{i:6})}`);
}
/* ═ A RECEPT ÉRTÉKELÉSE (FuelRecipeScorePage + a közös FuelScoreSurface): score.r-<id> · .keszul · .nincs · .nincsmeg ═
   a pontszám a SABLONRA szól, egy adagra vetítve. (Élő hiba, az építésben javítandó: a fejléc az EGÉSZ recept kcal-ját írja „/ adag” felirattal — itt helyesen, adagra osztva áll.) */
REC.forEach(r=>{if(r.score==null)return;const ls=recLines(r),s=r.serv;
  SCREC['r-'+r.id]={tpl:1,name:r.n,score:r.score,cert:r.cert,headline:r.headline,lead:r.lead,dims:r.dims,kcal:Math.round(r.kcal/s),macro:[Math.round(r.p/s),Math.round(r.c/s),Math.round(r.f/s)],fib:Math.round(r.fib/s*10)/10,sugar:r.sugar==null?null:Math.round(r.sugar/s*10)/10,salt:r.salt==null?null:Math.round(r.salt/s*10)/10,sat:Math.round(r.sat/s*10)/10,
    q:qOf(ls),ings:ls.map(l=>[l.n,kic(l.k),l.k.id,'kamra',Math.round(l.kcal/s),amtT(l.a/s,l.u),l.nv]),time:null,w:['reggeli','ebed','uzsonna','vacsora'].indexOf(r.cat),ctx:r.role||undefined}});
function recScore(id,st2){
  const r=REC.find(x=>x.id===id), back='recept.'+id, ttl={title:L('Mezo értékelése','Mezo’s rating'),sub:r?r.n:L('Recept','Recipe'),back:r?back:'receptek'};
  if(!r||st2==='nincsmeg') return page('fuel',{...ttl,sub:L('Recept','Recipe'),back:'receptek'},`${card(empty('t-book',L('Ez a recept nincs meg.','This recipe is gone.'),btn(L('Vissza a Receptekhez','Back to Recipes'),'receptek','sm')),{i:1})}`);
  const rec=SCREC['r-'+id];
  if(st2==='keszul'||st2==='nincs'||!rec) return page('fuel',ttl,`${card(empty('t-score',st2==='keszul'?L('Az értékelés készül…','The rating is on its way…'):L('Ehhez a recepthez még nincs értékelés.','This recipe has no rating yet.'),btn(L('Vissza a recepthez','Back to the recipe'),back,'sm')),{i:1})}`);
  return scoreSurface('r-'+id,rec,'',{back,lbl:`${L('Recept · sablon · 1 adag','Recipe · template · 1 serving')} · ${kc(rec.kcal)} kcal`,sub:r.n,detail:[L('A recept részletei','Recipe details'),back],imp:r.imp||[],
    note:L('A recept pontszáma a sablonra szól, egy adagra vetítve; nem arra, amit végül megettél.','The score is for the recipe as written, per serving, not for what you ended up eating.')+(r.role?' '+L(`A mérce ehhez a szerephez igazodik: ${r.role==='pre'?'edzés előtti':'edzés utáni'}.`,`It is judged for its role: ${r.role==='pre'?'before training':'after training'}.`):'')+' '+L('Amit belőle logolsz, a saját étkezés-értékelését kapja.','What you log from it gets its own meal rating.')});
}
/* ═ KÉZI RECEPT-SZERKESZTŐ: recept-uj (üres) · .kitoltve · .x (kitöltve, egész recept) · .szerk-<id> · .nincs ═
   az élő összeg a Kamra tényeiből számol (contributionOf); mentés: név + legalább egy sor. Mentés után nincs üzenet (az élőben sincs): új → Receptek, szerkesztés → vissza a receptre. */
function editor(arg){
  const a=String(arg||''), em=/^szerk-(.+)$/.exec(a), R0=em?REC.find(r=>r.id===em[1]):null;
  if(a==='nincs'||(em&&!R0)) return page('fuel',{title:L('Nincs ilyen recept','No such recipe'),sub:L('Fuel · Receptek','Fuel · Recipes'),back:'receptek'},`${card(empty('t-book',L('Nincs ilyen recept.','No such recipe.'),btn(L('Vissza a Receptekhez','Back to Recipes'),'receptek','sm')),{i:1})}`);
  const filled=a==='kitoltve'||a==='x', all=a==='x';
  const D=R0?{n:R0.n,cat:R0.cat,star:R0.star,role:R0.role,serv:R0.serv,min:R0.min,tags:['whole-foods'],ls:recLines(R0)}
    :filled?{n:'Csirkés bulgur tál',cat:'ebed',star:0,role:'post',serv:2,min:25,tags:['edzés után','gyors'],ls:[lineOf(kById('csirke'),300),lineOf(kById('bulgur'),150)]}
    :{n:'',cat:'reggeli',star:0,role:'',serv:1,min:0,tags:[],ls:[]};
  const T=sumM(D.ls), q=all?1:D.serv, per=k=>Math.round(T[k]/q), oth=k=>Math.round(T[k]/(all?D.serv:1)), has=D.ls.length>0, can=has&&D.n;
  const self=R0?'recept-uj.szerk-'+R0.id:'recept-uj.kitoltve', back=R0?'recept.'+R0.id:'receptek';
  return page('fuel',{title:D.n||L('Új recept','New recipe'),sub:L('Fuel · Receptek','Fuel · Recipes'),back},`
  ${gHero({lbl:all?L('Makró-összeg · egész recept','Macro total · whole recipe'):L('Makró-összeg · egy adag','Macro total · one serving'),g:numG(`<span class="fu-pot">${potG(has?(all?100:100/D.serv):0,96)}</span>`,has?kc(per('kcal')):'0',all?L('kcal · egész','kcal · whole'):L('kcal / adag','kcal / serving'),m3(per('p'),per('c'),per('f'))),
    verdict:!has?L('A fazék még üres.','The pot is still empty.'):D.serv===1?L('Egy adag az egész fazék.','One serving is the whole pot.'):all?L(`${D.serv} adag van a fazékban.`,`${D.serv} servings in the pot.`):L(`Egy adag a fazék ${D.serv===2?'fele':D.serv+'-ed része'}.`,`One serving is ${D.serv===2?'half':'1/'+D.serv} of the pot.`),
    sub:!has?L('Adj hozzá hozzávalót a kamrádból; az összeg a tényeikből számol.','Add ingredients from your pantry. The total is worked out from their facts.'):`${all?L('Egy adag','One serving'):L('Egész recept','Whole recipe')}: ${kc(oth('kcal'))} kcal · ${L(`${oth('p')} g fehérje · ${oth('c')} g szénhidrát · ${oth('f')} g zsír`,`${oth('p')} g protein · ${oth('c')} g carbs · ${oth('f')} g fat`)}.`,
    body:has&&!R0?`<div style="margin-top:12px">${servSeg(D.serv,all,'recept-uj.kitoltve','recept-uj.x')}</div>`:''},1)}
  ${sec(1,L('Alapok','Basics'),2)}
  ${card(fld(L('Név','Name'),D.n,L('pl. Tonhalsaláta · edzés után','e.g. Tuna salad · after training'))
    +lab(L('Étkezés','Meal'))+`<div class="fc-pk2">${pick([L('Reggeli','Breakfast'),L('Ebéd','Lunch'),L('Vacsora','Dinner'),L('Uzsonna','Snack')],[L('Reggeli','Breakfast'),L('Ebéd','Lunch'),L('Uzsonna','Snack'),L('Vacsora','Dinner')][['reggeli','ebed','uzsonna','vacsora'].indexOf(D.cat)],L('Étkezés','Meal'))}<button class="fh-pill ${D.star?'on':''}" data-ftog aria-pressed="${!!D.star}">${bub('t-star',{s:24})}${D.star?L('Csillagos','Starred'):L('Csillag','Star')}</button></div>`
    +lab(L('Szerep','Role'))+pick([roleT(''),roleT('pre'),roleT('post')],roleT(D.role),L('Szerep','Role'))
    +note(L('A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors szénhidrát üzemanyag, nem hiba.','The role decides how we score it: around training, fast carbs are fuel, not a fault.'))
    +`<div class="fx-two fc-ws"><div>${lab(L('Adag','Servings'))}${stp(D.serv,L('adag',D.serv===1?'serving':'servings'),L('Adag','Servings'))}</div><div>${lab(L('Elő + főzés','Prep + cooking'))}${stp(D.min,L('perc','min'),L('Idő','Time'))}</div></div>`,{i:2})}
  ${sec(2,`${L('Hozzávalók','Ingredients')} · ${D.ls.length}`,3)}
  ${card((has?D.ls.map(l=>cLine({n:l.n,ic:kic(l.k),b:l.k.b,kind:l.k.k==='food'?'':L(...({supp:['Kiegészítő','Supplement'],stim:['Stimuláns','Stimulant'],med:['Gyógyszer','Medication']})[l.k.k]),a:l.a,u:l.u,kcal:l.kcal,m:l.m})).join(''):empty('t-stack',L('Még nincs hozzávaló. Nyomd a Kamrából hozzáad gombot.','No ingredients yet. Tap Add from pantry.')))
    +acts(btn(L('+ Kamrából hozzáad','+ Add from pantry'),{sheet:'ingpick',arg:has?'van':''},'sm ghost')),{cls:'fu-lns0',i:3})}
  ${sec(3,L('Címkék','Tags'),4)}
  ${card(`<div class="fh-pills">${D.tags.map(t=>`<button class="fh-pill" data-toast="${L('Címke törölve','Tag removed')}" aria-label="${L(`${esc(t)} címke törlése`,`Remove the tag ${esc(t)}`)}">${t} ×</button>`).join('')}<input class="fh-in fc-tag" placeholder="${L('+ címke','+ tag')}" aria-label="${L('Új címke','New tag')}"></div>`,{i:4})}`,
  {foot:btn(L('Mégse','Cancel'),back,'ghost')+(can?btn(L('Mentés','Save'),back):`<button class="btn" disabled>${L('Mentés','Save')}</button>`)});
}
/* ═ RECEPTMŰHELY: muhely (üres vászon) · .dolgozik · .hiba · .kamrabol · .vazlat (egy sor becslés: nem menthető) · .vazlat-egesz · .kesz · .recept-<id> (meglévő receptből: frissít) ·
   .etkezesbol[-<étkezés>] (logolt étkezésből: új recept) · .feloldatlan (egy kamra-sor már nem oldható fel) · .ures-vazlat ═
   minden makrót a vászon számol a Kamra tényeiből (draftTotals / lineMacros); a becsült sornak van kcal-ja (est), de amíg van ilyen sor, a mentés tiltva (draftToInput). A fazék szintje = a kamrából jövő sorok aránya. */
/* a Műhely MOSTANI körének szövegei (lépések, válasz): új AI-szöveg, a beállított nyelven érkezik — nem tárolt régi szöveg */
const WSTEPS=()=>[L('A bulgurt kétszeres vízben 12 percig főzd, majd hagyd állni.','Simmer the bulgur in twice its volume of water for 12 minutes, then let it rest.'),L('A csirkemellet kockázd fel, sózd, és kevés olajon pirítsd át.','Dice the chicken breast, salt it and sear it in a little oil.'),L('A paprikát vágd csíkokra, a végén forgasd a csirkéhez.','Cut the pepper into strips and toss it in with the chicken at the end.'),L('Keverd össze a bulgurral, és oszd két adagra.','Mix it with the bulgur and split it into two servings.')];
const WLAST=()=>L('Bulgurra cseréltem a rizst, és paprikát tettem hozzá. A paprika még becslés: ha van a kamrádban, cseréld rá.','I swapped the rice for bulgur and added pepper. The pepper is still an estimate: if you have it in your pantry, swap it in.');
function muhely(arg){
  const a=String(arg||''), fr=/^recept-(.+)$/.exec(a), fm=/^etkezesbol(?:-(.+))?$/.exec(a), R0=fr?REC.find(r=>r.id===fr[1]):null, M0=fm?(mealOf(fm[1])||MEALS.ebed):null;
  const busy=a==='dolgozik', err=a==='hiba', ctx=a==='kamrabol', draft=!!(R0||M0)||['vazlat','vazlat-egesz','kesz','feloldatlan','ures-vazlat'].includes(a), all=a==='vazlat-egesz';
  const est=(n,ic,am,u,kcal,m)=>({n,ic,a:am,u,kcal,m,src:'becslés',nv:null});
  /* a logolt étkezés sorai (mealToDraft): kamra-sor → kamra-sor · becsült sor → becslés · recept-sor → a recept hozzávalói */
  const fromMeal=m=>m.ings.flatMap(([n,ic,kid,src,kcal,amt,,mac])=>{const am=parseFloat(amt),u=amt.replace(/^[\d.,]+\s*/,''),rc=src==='recept'&&REC.find(r=>r.n===n),k=kid?kById(kid):KAM.find(x=>x.n===n);
    return rc?recLines(rc):k?[lineOf(k,am,kcal)]:[est(n,ic,am,u,kcal,mac||[Math.round(m.macro[0]*kcal/m.kcal),Math.round(m.macro[1]*kcal/m.kcal),Math.round(m.macro[2]*kcal/m.kcal)])]});
  const D=R0?{n:R0.n,serv:R0.serv,goal:null,ls:recLines(R0),steps:[],upd:1}
    :M0?{n:M0.name,serv:1,goal:null,ls:fromMeal(M0),steps:[]}
    :{n:'Csirkés bulgur',serv:2,goal:'high_protein',steps:a==='ures-vazlat'?[]:WSTEPS(),ls:a==='ures-vazlat'?[]:[lineOf(kById('csirke'),300),lineOf(kById('bulgur'),100),
      a==='kesz'?lineOf(kById('spenot'),150):a==='feloldatlan'?{n:'Kaliforniai paprika',k:{k:'food',cat:'Zöldség'},a:150,u:'g',kcal:null,m:null,nv:null,src:'kamra',gone:1}:est('Paprika · kaliforniai','t-fiber',150,'g',47,[2,9,0])]};
  const goals=on=>goalRow(on,'muhely.dolgozik');
  /* a dokk (WorkshopChatDock): cél-gombok (egy koppintás = egy kérés), a következő körbe szánt kamra-tételek, állapot, az utolsó válasz, üzenetmező */
  const dock=(o={})=>goals(o.goal)
    +(o.ctx?`<div class="fc-cats">${['Túró · félzsíros','Spenót · friss'].map(n=>`<button data-toast="${L('Kivéve a következő körből','Left out of the next round')}: ${esc(n)}" aria-label="${L(`${esc(n)} elvétele a következő körből`,`Leave ${esc(n)} out of the next round`)}">${n}<b>×</b></button>`).join('')}</div>`:'')
    +(o.busy?`<p class="fc-busy">${bub('t-chef',{s:28})}${L('A Műhely dolgozik…','The workshop is on it…')}</p>`:'')
    +(o.err?`<div class="fc-err"><b>${L('A Műhely most nem elérhető. Az üzeneted megvan.','The workshop can’t be reached right now. Your message is safe.')}</b><div class="fh-acts">${btn(L('Újra','Retry'),'muhely.dolgozik','sm')}${lk(L('Szerkesztés','Edit'),{toast:L('Az üzeneted visszakerült a mezőbe','Your message is back in the field')})}</div></div>`:'')
    +(o.last?`<button class="fc-last" data-sheet="thread">${bub('t-chef',{s:30})}<span>${o.last}</span>${chev()}</button>`:'')
    +`<div class="fx-cmp"><button data-sheet="ingpick" data-arg="kor" aria-label="${L('Kamra','Pantry')}">${I('t-stack')}</button><textarea aria-label="${L('Üzenet a Műhelynek','Message to the workshop')}" placeholder="${L('Mit főzzünk? Mondd el szabadon…','What shall we cook?')}">${o.err?L('Legyen benne több zöldség is','Add more vegetables to it'):''}</textarea><button data-toast="${L('Diktálás','Dictate')}" aria-label="${L('Diktálás','Dictate')}">${I('t-mic')}</button><button class="go" ${o.busy?'disabled':'data-go="muhely.dolgozik"'} aria-label="${L('Küldés','Send')}">${I('t-send')}</button></div>`;
  const principle=note(L('A Műhely hozzávalót és mennyiséget javasol; a makrókat mindig a kamra-tények adják.','The workshop suggests ingredients and amounts. The macros always come from your pantry’s facts.'));
  const ttl={title:L('Receptműhely','Recipe workshop'),sub:L('Fuel · Receptek','Fuel · Recipes'),back:R0?'recept.'+R0.id:M0?'mai':'konyha'};
  if(!draft) return page('fuel',ttl,`
  ${gHero({lbl:L('Receptműhely · üres fazék','Recipe workshop · empty pot'),g:`<div class="fu-potc">${potG(0,150)}</div>`,verdict:busy?L('Készül az első vázlat.','The first draft is on its way.'):L('Mit főzzünk ki?','What shall we cook up?'),
    sub:L('Válassz egy célt, vagy írd le a saját szavaiddal. Én hozzávalót és mennyiséget javaslok; a számokat mindig a kamrád adja.','Pick a goal or say it in your own words. I suggest ingredients and amounts. The numbers always come from your pantry.'),
    body:dock({busy,err,ctx,goal:busy?'high_protein':null})},1)}
  ${sec(1,L('Így dolgozunk','How we work'),2)}
  ${card(txt(L('Egy cél-gomb egy kérés: koppintásra elküldi. Minden kör javításként érkezik, a kézi szerkesztéseid megmaradnak.','A goal button is a request: a tap sends it. Each round arrives as a revision. Your own edits stay.'))+principle,{i:2})}`);
  const T=sumM(D.ls), q=all?1:D.serv, per=k=>Math.round(T[k]/q), nEst=D.ls.filter(l=>l.src==='becslés').length, nGone=D.ls.filter(l=>l.gone).length, nOk=D.ls.length-nEst, can=D.ls.length>0&&!nEst;
  const self=a==='vazlat-egesz'?'muhely.vazlat':a, facts=D.ls.filter(l=>l.src==='kamra'&&!l.gone);
  const nutW=['fib','sug','salt','sat'].map((f,i)=>{const xs=facts.map(l=>i===0?null:num(l.k[f])==null?null:num(l.k[f])*l.a/100).filter(x=>x!=null);return xs.length?xs.reduce((s,x)=>s+x,0)/q:null});
  return page('fuel',ttl,`
  ${gHero({lbl:D.upd?L('Vázlat · meglévő receptből','Draft · from an existing recipe'):M0?L('Vázlat · logolt étkezésből','Draft · from a logged meal'):`${L('Vázlat','Draft')}${D.goal?' · '+L(...GOALS.find(g=>g[0]===D.goal).slice(1,3)):''}`,
    g:`<input class="fh-in fc-name" value="${esc(D.n)}" placeholder="${L('Recept neve','Recipe name')}" aria-label="${L('Recept neve','Recipe name')}">`+numG(`<span class="fu-pot">${potG(D.ls.length?Math.max(8,nOk/D.ls.length*100):0,104)}</span>`,kc(per('kcal')),all?L('kcal · egész','kcal · whole'):L('kcal / adag','kcal / serving'),
      `<p>${!D.ls.length?L('Még nincs sor a fazékban.','No lines in the pot yet.'):nEst?L(`${D.ls.length} sorból <b>${nOk} a kamrádból jön</b>; ${nEst===1?'egy még becslés':nEst+' még becslés'}.`,`<b>${nOk} of ${D.ls.length} lines come from your pantry</b>; ${nEst===1?'one is still an estimate':nEst+' are still estimates'}.`):L(`Mind a ${D.ls.length} sor a kamrádból jön.`,`All ${D.ls.length} lines come from your pantry.`)}</p>`),
    verdict:!D.ls.length?L('A vázlat üres.','The draft is empty.'):nEst?L(nEst===1?'Egy sor még becslés, addig nem menthető.':`${nEst} sor még becslés, addig nem menthető.`,nEst===1?'One line is still an estimate, so it can’t be saved yet.':`${nEst} lines are still estimates, so it can’t be saved yet.`):D.upd?L('Menthető: a recepted frissül, nem másolódik.','Ready to save: it updates your recipe, it doesn’t copy it.'):L('Menthető: minden sor a kamrádból jön.','Ready to save: every line comes from your pantry.'),
    sub:nEst?L('Cseréld kamra-tételre vagy töröld a sort.','Swap it for a pantry item or remove the line.'):M0?L('Új receptként mentjük; a logolt étkezésed nem változik.','It is saved as a new recipe. Your logged meal doesn’t change.'):'',
    body:`<div class="fx-two fc-ws" style="margin-top:12px"><div>${stp(D.serv,L('adag',D.serv===1?'serving':'servings'),L('Adag','Servings'))}</div><div>${seg([[L('1 adag','1 serving'),self,!all],[L('Egész','Whole'),a==='vazlat'||all?'muhely.vazlat-egesz':{toast:L('Egész recept · a számok az egész fazékra váltanak','Whole recipe · the numbers switch to the whole pot')},all]])}</div></div>`,
    acts:can?btn(D.upd?L('Recept frissítése','Update the recipe'):L('Mentés a Receptek közé','Save to Recipes'),{go:D.upd?'recept.'+R0.id:'receptek'}):`<button class="btn" disabled>${D.upd?L('Recept frissítése','Update the recipe'):L('Mentés a Receptek közé','Save to Recipes')}</button>`},1)}
  ${sec(1,`${L('Hozzávalók','Ingredients')} · ${D.ls.length}`,2)}
  ${card((D.ls.length?D.ls.map(l=>cLine({n:l.n,ic:l.ic||kic(l.k),tag:l.src==='becslés'?L('becslés','estimate'):L('kamra','pantry'),est:l.src==='becslés',a:l.a,u:l.u,kcal:l.kcal,m:l.m,
      x:l.src==='becslés'?`<div class="fh-acts"><button class="fh-lk" data-sheet="ingpick" data-arg="csere">${L('Csere kamra-tételre','Swap for a pantry item')}</button></div>`:''})).join(''):empty('t-stack',L('Nincs hozzávaló. Kérj egyet alul, vagy válassz a kamrából.','No ingredients. Ask for one below or pick from the pantry.')))
    +(nGone?`<p class="fh-note fx-warn">${L(`${nGone} sorhoz nincs tápérték a kamrában: a számokból kimarad, nem találgatjuk.`,`${nGone===1?'1 line has':nGone+' lines have'} no nutrition values in the pantry: left out of the numbers, not guessed.`)}</p>`:''),{cls:'fu-lns0',i:2})}
  ${D.ls.length?`${sec(2,L('Makrók és minőség','Macros and quality'),3)}
  ${card(macroVials(per('p'),per('c'),per('f')),{cls:'fu-mac',i:3})}
  ${card(qTiles(qOf(D.ls.filter(l=>!l.gone).map(l=>l.src==='becslés'?{...l,nv:null,u:'?'}:l)))+(nEst?note(L('A becsült sor nem ad minőség-tényt: amíg van ilyen, ezek a számok hiányoznak.','An estimated line gives no quality facts: while there is one, these numbers are missing.')):''),{cls:'fu-q',i:3})}
  ${card(microRows([null,nutW[1],nutW[2],nutW[3]],all?FRW:FR1),{i:3})}`:''}
  ${D.steps.length?`${sec(D.ls.length?3:2,`${L('Elkészítés','Method')} · ${pl(D.steps.length,'lépés','step','steps')}`,4)}
  ${card(`<ol class="fc-steps">${D.steps.map((s,i)=>`<li><b>${i+1}.</b><span>${s}</span></li>`).join('')}</ol>`,{i:4})}`:''}
  ${sec(1+(D.ls.length?1:0)+(D.steps.length?1:0)+1,L('Kérj módosítást','Ask for a change'),5)}
  ${card(dock({goal:D.goal,last:D.upd||M0||!D.ls.length?null:WLAST()})+principle,{i:5})}`);
}

const bandG=({lo,hi,a,b,v,vl,tick,tl,al='',bl='',label=''})=>{const id=F.uid('fb'),X=x=>12+(x-lo)/(hi-lo)*296;
  return `<svg class="fh-chart fu-band" viewBox="0 0 320 90" role="img" aria-label="${label}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--liq1)"/><stop offset="1" stop-color="var(--liq2)"/></linearGradient></defs>
    <rect x="12" y="34" width="296" height="26" rx="13" fill="#fff" stroke="rgba(10,42,60,.12)" stroke-width="1.5"/><rect x="${X(a).toFixed(1)}" y="34" width="${(X(b)-X(a)).toFixed(1)}" height="26" rx="13" fill="url(#${id})" opacity=".5"/>
    ${tick!=null?`<path d="M${X(tick).toFixed(1)} 28V66" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/><text x="${X(tick).toFixed(1)}" y="82" text-anchor="middle">${tl}</text>`:''}
    <text x="${X(a).toFixed(1)}" y="27" text-anchor="middle">${al}</text><text x="${X(b).toFixed(1)}" y="27" text-anchor="middle">${bl}</text>
    ${v!=null?`<circle cx="${X(v).toFixed(1)}" cy="47" r="10" fill="#fff" stroke="var(--liq2)" stroke-width="4.5"/><text x="${X(v).toFixed(1)}" y="15" text-anchor="middle" class="big">${vl}</text>`:''}</svg>`};

/* ═══ B TERÜLET · ADATOK (Kiegészítők · Trendek) ═══════════════════════════════════════════════
   EGY forrás mindenre (F3.2): a protokoll (PROTO) adja a Kiegészítők hubot, a Protokoll oldalt és mindkét lapot;
   a két hét (WEEKS) adja a Trendek minden számát. A PROTO tételei a Kamra (KAM) tételei: az élő protokoll csak birtokolt Kamra-tételt tart. */
/* zónák: data/fuel/stackZones.ts (STACK_ZONE_ORDER, STACK_ZONE_LABEL) · arcok: FuelStackProtocolPage ZONE_FACE (8 zóna, mind itt van, akkor is, ha a mintanapban csak öt látszik)
   [magyar, angol, ikon, rövid magyar, rövid angol] */
const ZN={wake:['Ébredés','Wake-up','t-dawn','Ébredés','Wake-up'],breakfast:['Reggeli','Breakfast','t-sun','Reggeli','Breakfast'],pre_workout:['Edzés előtt','Pre-workout','t-dumbbell','Edzés e.','Pre'],post_workout:['Edzés után','Post-workout','t-dumbbell','Edzés u.','Post'],lunch:['Ebéd','Lunch','t-bowl','Ebéd','Lunch'],dinner:['Vacsora','Dinner','t-moon','Vacsora','Dinner'],evening:['Este','Evening','t-moon','Este','Evening'],bedtime:['Lefekvés','Bedtime','t-sleep','Lefekvés','Bedtime']};
const ZO=Object.keys(ZN), ZT={wake:'06:30',breakfast:'07:00',pre_workout:'08:00',post_workout:'09:30',lunch:'12:00',dinner:'19:00',evening:'21:00',bedtime:'22:30'};
const zl=(k,short)=>ZN[k][(short?3:0)+(EN()?1:0)];
/* napszak-sávok: data/fuel/fuelConfig.ts ZONE_LABELS + ZONE_FRACTIONS (az ébredés–lefekvés ív törtrészei), logic/stackBands.ts */
const BANDS=[['morning','Reggel','Morning','t-dawn',0],['midday','Dél','Midday','t-bowl',.30],['afternoon','Délután','Afternoon','t-sun',.52],['evening','Este','Evening','t-moon',.72]];
const bandOf=t=>{const f=(toMin(t)-toMin(DAY.wake))/(toMin(DAY.bed)-toMin(DAY.wake));let k=BANDS[0][0];BANDS.forEach(b=>{if(f>=b[4])k=b[0]});return k};
/* a Kamra-tétel készlet-adatai (SupplementStashItem.form / stock / stockUnit) — a KAM kiegészítő-sorai ezt még nem hordozzák; a kiszerelés és az egység a felhasználó beírt szövege, angolul is marad */
const SUPX={kreatin:{form:'por',stock:420,su:'g'},gomba:{form:'por',stock:160,su:'g'},whey:{form:'por',stock:1800,su:'g'},aakg:{form:'por',stock:250,su:'g'},pwo:{},d3k2:{form:'kapszula',stock:74,su:'db'},omega:{form:'kapszula',stock:48,su:'db'},magn:{form:'kapszula',stock:120,su:'db'},cink:{form:'kapszula',stock:90,su:'db'}};
/* a protokoll: useProtocol().occurrences + useStackDay().slots. id = KAM-tétel · dose = az előfordulás adagja (null = nincs megadva) · z = zóna · pin = kézzel elhelyezve
   src = placementSource (rule | llm | user | fallback) · why = placementReason (a motor TÁROLT magyar szövege; null = nincs indok) · hint = dailyTotalHint (a szabálytábla szövege, ezért két nyelven) · at = mai bevétel ideje (useIntakes) */
const PV={v:3,conf:86};
const PROTO=[
  {id:'kreatin',dose:'5 g',z:'wake',src:'rule',why:'Étkezéstől független: a napi rendszeresség számít, nem az időpont.',hint:['3–5 g/nap','3–5 g a day'],at:'06:35'},
  {id:'gomba',dose:'8 g',z:'wake',pin:1,src:'user',why:null,at:'06:40'},
  {id:'whey',dose:'30 g',z:'breakfast',src:'rule',why:'Fehérjés reggelihez: a reggeli fehérjéjét egészíti ki.',at:'07:25'},
  {id:'aakg',dose:'6 g',z:'pre_workout',src:'fallback',why:null,at:'08:02'},
  {id:'pwo',dose:null,z:'pre_workout',src:'llm',why:'Edzés előtt 20–30 perccel hat a legjobban.',at:'08:02'},
  {id:'d3k2',dose:'4000 NE + 100 µg',z:'lunch',src:'rule',why:'Zsírban oldódik: zsíros étkezéssel szívódik fel jól.',at:'12:45'},
  {id:'omega',dose:'2 g EPA+DHA',z:'lunch',src:'rule',why:'Zsírban oldódik: az ebéd a nap legzsírosabb étkezése.',at:null,late:'12:50'},
  {id:'magn',dose:'300 mg',z:'evening',src:'rule',why:'Este nyugtat; lefekvés előtt kb. 2 órával.',hint:['ajánlott napi összmennyiség 300–400 mg','recommended daily total 300–400 mg'],at:null,late:'21:05'}];
let TKN={}, SARG=null;  /* a mai pipák felülírása (koppintásra vált), és az utolsó állapot-arg */
function stackVM(arg){
  const rows=(arg==='ures'||arg==='tolt'?[]:PROTO).map((o,i)=>{const k=KAM.find(x=>x.id===o.id)||{n:o.id},x=SUPX[o.id]||{},taken=TKN[i]??!!o.at;
    return {...o,i,n:k.n,hint:o.hint?L(...o.hint):null,form:x.form||null,stock:x.stock??null,su:x.su||null,time:ZT[o.z],taken,at:taken?(o.at||(SARG==='kesz'&&o.late)||DAY.now):null}});
  const bands=BANDS.map(([key,hu,en,ic])=>({key,l:L(hu,en),ic,rows:rows.filter(r=>bandOf(r.time)===key)})).filter(b=>b.rows.length).map(b=>({...b,done:b.rows.filter(r=>r.taken).length}));
  const due=bands.find(b=>b.done<b.rows.length)||null;
  return {arg,rows,bands,due,next:due?due.rows.find(r=>!r.taken):null,taken:rows.filter(r=>r.taken).length,pinned:rows.filter(r=>r.pin).length,
    slots:ZO.map(z=>({z,time:ZT[z],rows:rows.filter(r=>r.z===z)})).filter(s=>s.rows.length)}}
/* a kiszerelés és a darab-egység felsorolás (enum), ezért angolul megszólal; az adag-szöveg (dose) a felhasználóé, az marad */
const FORMS={kapszula:['capsule','capsules'],tabletta:['tablet','tablets'],por:['powder','powder'],csepp:['drop','drops']};
const formT=(f,n=1)=>!f||!EN()||!FORMS[f]?f:FORMS[f][n===1?0:1];
const suT=u=>EN()&&u==='db'?'pcs':u;
const doseT=r=>r.dose??L('adag nincs megadva','no dose set');
const stockT=r=>r.stock==null?null:`${kc(r.stock)}${r.su?' '+suT(r.su):''}`;
const NOTE1=()=>L('Tájékoztatás, nem orvosi tanács.','For information, not medical advice.');
/* capsG: a nap adagjai kapszulákban, napszakonként — a tele kapszula bevéve, a keretes a következő */
const capsG=V=>{const nx=V.next;return V.rows.length?`<div class="fu-caps" role="img" aria-label="${L(`A mai adagok napszakonként: ${V.taken} / ${V.rows.length} bevéve`,`Today’s doses by time of day: ${V.taken} of ${V.rows.length} taken`)}">${V.bands.map(b=>`<span class="g"><span class="r">${b.rows.map(r=>`<i class="${r.taken?'on':''} ${nx&&nx.i===r.i?'nx':''}"></i>`).join('')}</span><small>${b.l}</small></span>`).join('')}</div>`
  :`<div class="fu-caps fb-ghost" aria-hidden="true">${BANDS.map(b=>`<span class="g"><span class="r"><i></i><i></i></span></span>`).join('')}</div>`};

/* ═══ KIEGÉSZÍTŐK (FuelStackPage + logic/stackBands + useStackIntakeToggle) ═══ állapotok: stack · stack.kesz (mára minden megvan) · stack.ures (üres protokoll) · stack.tolt (betöltés)
   Az élő oldalnak nincs hiba-arca (a hookok üresre esnek vissza). A pipa: „{név} bevéve” üzenet „Visszavonás” gombbal (a létrejött bevétel azonosítójához kötve); a visszavonás néma. */
function stack(arg){
  if(arg!==SARG){SARG=arg;TKN=arg==='kesz'?Object.fromEntries(PROTO.map((_,i)=>[i,true])):{}}
  const V=stackVM(arg), n=V.rows.length, nx=V.next, load=arg==='tolt';
  const lbl=L('Mit veszek be ma?','What do I take today?');
  const top={title:L('Kiegészítők','Supplements'),sub:n?L(`Fuel · ma · ${V.taken} / ${n}`,`Fuel · today · ${V.taken} / ${n}`):L('Fuel · ma','Fuel · today'),tab:'stack'};
  /* a hős: a következő adag (a legkorábbi be nem fejezett sáv első be nem vett tétele) — az indok a motor mondata (entry.reason; SZÁMOLHATÓ: az oldal betölti, ma csak a dobozban írja ki; ha nincs, a mondat elmarad; angol módban sem áll itt, mert a tárolt magyar mondat egy angol mondat-félhez ragadna — a dobozban ott van) */
  const h=load?gHero({lbl,g:capsG(V),verdict:L('Protokoll betöltése…','Loading your protocol…')},1)
    :!n?gHero({lbl,g:capsG(V),verdict:L('A protokollod még üres.','Your protocol is still empty.'),sub:L('Vedd fel az első kiegészítőt, és megmondom, mennyit vegyél be belőle, mikor és miért.','Add your first supplement and I’ll tell you how much to take, when and why.'),acts:btn(L('Új elem beállítása','Set up a new item'),'stack-uj.1')},1)
    :!nx?gHero({lbl:`${lbl} · ${L(`${V.taken} / ${n} bevéve`,`${V.taken} of ${n} taken`)}`,g:capsG(V),verdict:L('Mára minden megvan.','All done for today.'),sub:L('Ha félrement valami, a pipát bármikor visszavonhatod.','If you ticked one by mistake, you can undo it any time.')},1)
    :gHero({lbl:`${lbl} · ${L(`${V.taken} / ${n} bevéve`,`${V.taken} of ${n} taken`)}`,g:capsG(V),verdict:L(`Következik: ${nx.n}.`,`Next: ${nx.n}.`),sub:`${doseT(nx)} · ${zl(nx.z)}${nx.why&&!EN()?`. ${nx.why}`:''}`,
      acts:`<button class="btn" data-fbtk="${nx.i}">${L('Bevettem','Mark as taken')}</button>`},1);
  const k=V.bands.length;
  return page('fuel',top,`${h}
  ${V.bands.map((b,i)=>sec(i+1,`${b.l} · ${b.done} / ${b.rows.length}${V.due&&V.due.key===b.key?` ${st(L('most esedékes','due now'),'plan')}`:''}`,i+2)
    +card(b.rows.map(r=>`<div class="fh-row"><button class="fx-tk ${r.taken?'on':''}" data-fbtk="${r.i}" aria-pressed="${r.taken}" aria-label="${esc(r.taken?L(`${r.n}: visszavonom`,`${r.n}: undo`):L(`${r.n}: bevettem`,`${r.n}: mark as taken`))}">${I('i-check')}</button><button class="g fx-g" data-sheet="item" data-arg="${r.i}" aria-label="${esc(L(`${r.n} részletei`,`${r.n} details`))}"><span><strong>${r.n}</strong><small>${doseT(r)} · ${zl(r.z)}${r.taken?` · ${L('bevéve','taken')} ${r.at}`:''}</small></span>${chev()}</button></div>`).join(''),{i:i+2,cls:b.done===b.rows.length?'fb-dim':''})).join('')}
  ${sec(k+1,L('Protokoll és beállítás','Protocol and setup'),k+2)}
  ${card(row({icon:'t-protocol',title:load?L('Protokoll · —','Protocol · —'):`${L('Protokoll','Protocol')} · ${pl(n,'elem','item','items')}`,sub:L('Mit miért szedsz, és ki tette a helyére.','What you take, why, and who placed it.'),on:'protokoll'})
    +row({icon:'t-gear',title:L('Új elem beállítása','Set up a new item'),sub:L('Megmondom, mennyit vegyél be belőle, mikor és miért.','I’ll tell you how much to take, when and why.'),on:'stack-uj.1'})
    +row({icon:'t-syringe',title:L('Gyógyszer','Medication'),sub:L('A követett gyógyszered és a ciklusa','The medication you track and its cycle'),on:'gyogyszer'})
    +note(NOTE1()),{i:k+2})}`);
}
/* ═══ PROTOKOLL (FuelStackProtocolPage + StackMealMatch + logic/matchMealsToStack) ═══ állapotok: protokoll · .kotesnelkul (nincs étkezési kötés) · .figyelj (egy étkezés kevés zsírral) · .tolt · .hiba · .ures
   A protokoll előzményének (history[]) NINCS felülete, és nincs közös „Mentés”: minden változás azonnal mentődik. */
/* az étkezési kötések: csak ZSÍRT kérő tétel (FAT_BOUND_NEEDLES) kap étkezés-ítéletet a reggeli / ebéd / vacsora zónában (≥ 15 g zsír = rendben); fehérjét kérő tétel az „Edzés után” zónában receptet kap, ítéletet nem */
function mealMatch(arg){
  const sug=[],ver=[]; if(arg==='kotesnelkul')return {sug,ver};
  stackVM('').slots.forEach(s=>{const cat={breakfast:'reggeli',lunch:'ebed',dinner:'vacsora'}[s.z]; if(!cat)return;
    const b=s.rows.find(r=>['d3','k2','omega','halolaj','krill','kurkum','q10','koenzim'].some(x=>r.n.toLowerCase().includes(x))); if(!b)return;
    const rec=REC.filter(r=>r.cat===cat).sort((a,z)=>z.f/z.serv-a.f/a.serv)[0]; if(rec)sug.push({s,rec,g:Math.round(rec.f/rec.serv),by:b.n});
    const w={breakfast:0,lunch:1,dinner:3}[s.z];
    /* .figyelj: állapot-arc — a tegnapi ebéd zsírja itt 6 g, hogy a „nem volt elég” visszajelzés látsszon (a valós tegnapi ebédé 24 g) */
    [[MEALS,0],[YM,1]].forEach(([M,y])=>Object.values(M).filter(m=>m.w===w).forEach(m=>{const f=arg==='figyelj'&&y?6:m.macro[2];ver.push({m,y,f,ok:f>=15,by:b.n})}))});
  return {sug,ver}}
function protokoll(arg){
  const off=arg==='tolt'||arg==='hiba'||arg==='ures', V=stackVM(off?'ures':''), n=V.rows.length, ns=V.slots.length;
  const top={title:L('Protokoll','Protocol'),sub:L('Kiegészítők','Supplements'),back:'stack'};
  const door=card(row({icon:'t-gear',title:L('Új elem beállítása','Set up a new item'),sub:L('Megmondom, mennyit vegyél be belőle, mikor és miért.','I’ll tell you how much to take, when and why.'),on:'stack-uj.1'})
    +note(L('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.','For information, not medical advice. If you take medication, always ask your doctor.')),{i:2});
  if(off) return page('fuel',top,`${gHero({lbl:L('A napi rended','Your daily order'),g:capsG(V),verdict:arg==='tolt'?L('Protokoll betöltése…','Loading your protocol…'):arg==='hiba'?L('A protokoll most nem tölthető be.','Your protocol can’t be loaded right now.'):L('Még nincs protokolltétel.','No protocol items yet.'),acts:arg==='ures'?btn(L('Új elem beállítása','Set up a new item'),'stack-uj.1'):''},1)}${arg==='ures'?card(note(L('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.','For information, not medical advice. If you take medication, always ask your doctor.')),{i:2}):door}`);
  const mx=Math.max(...V.slots.map(s=>s.rows.length)), M=mealMatch(arg), nm=M.sug.length+M.ver.length, p=V.pinned;
  const verdict=p===0?L('Minden elemet én időzítettem.','I timed every item.'):p===n?L('Minden elemet te tettél a helyére.','You placed every item yourself.')
    :p===1?L('Egy elemet kézzel tettél a helyére, a többit én időzítettem.','You placed one item yourself; I timed the rest.'):L(`${p} elemet kézzel tettél a helyére, a többit én időzítettem.`,`You placed ${p} items yourself; I timed the rest.`);
  return page('fuel',top,`
  ${gHero({lbl:`${L('A napi rended','Your daily order')} · ${pl(ns,'idősáv','time slot','time slots')}`,
    g:`<div class="fb-zv">${vials(V.slots.map(s=>({l:zl(s.z),ic:ZN[s.z][2],p:s.rows.length/mx*56,v:String(s.rows.length),mark:s.time,on:{toast:`${zl(s.z)} · ${s.time} · ${pl(s.rows.length,'elem','item','items')}`}})),{h:96})}</div>`
      +facts([[n,L('elem','items')],[ns,L('idősáv','time slots')],[p,L('kézzel elhelyezve','placed by hand')]]),
    verdict,sub:L(`Koppints egy elemre: ott állítod az idősávot és a dózist. ${PV.v}. változat · ${PV.conf}%-os bizalom.`,`Tap an item to change its time slot and dose. Version ${PV.v} · ${PV.conf}% confidence.`),acts:btn(L('Új elem beállítása','Set up a new item'),'stack-uj.1')},1)}
  ${sec(1,L('Idősávok','Time slots'),2)}
  ${V.slots.map((s,i)=>card(head(ZN[s.z][2],`${zl(s.z)} · ${s.time} · ${s.rows.length}`)+s.rows.map(r=>row({icon:'t-supps',title:r.n,sub:`${r.dose??'—'} · ${r.pin?L('kézi','manual'):L('automatikus','automatic')}${r.why?`<br>${r.why}`:''}`,on:{sheet:'stackitem',arg:r.i}})).join(''),{i:i+2})).join('')}
  ${sec(2,`${L('Étkezéshez','With meals')} · ${nm}`,7)}
  ${card((nm?lab(L('Étkezés-egyeztetés · makró és mikro','Meal match · macros and micros'))
      +M.sug.map(x=>row({icon:'t-bowl',title:`${zl(x.s.z)} · ${x.s.time}`,sub:`${x.rec.n}<br>${L(`${x.g} g zsír / adag · ${cap(azA(x.by))} zsíros étkezést kér.`,`${x.g} g fat per serving · ${x.by} wants a meal with fat.`)}`,on:'recept.'+x.rec.id})).join('')
      +M.ver.map(x=>row({icon:x.ok?'t-tick':'t-info',title:`${x.m.name} · ${x.y?L('tegnap','yesterday'):L('ma','today')}`,sub:L(`${x.f} g zsír`,`${x.f} g fat`)+(x.ok?'':`<br>${L(`${cap(azA(x.by))} zsíros étkezést kér. Legközelebb tedd zsírosabb fogás mellé, vagy mozgasd vacsorára.`,`${x.by} wants a meal with fat. Next time pair it with a fattier dish, or move it to dinner.`)}`),right:x.ok?st(L('rendben','fine'),'ok'):st(L('kevés','low'),'warn')})).join('')
    :txt(L('Ha egy tétel zsíros vagy fehérjés étkezést kér, itt jelenik meg a hozzá illő fogás és a visszajelzés.','When an item needs a meal with fat or protein, the matching dish and the feedback show up here.')))
    +note(L('Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.','For information, not medical advice. If you take medication, always ask your doctor.')),{i:7})}`);
}
/* ═══ ÚJ ELEM BEÁLLÍTÁSA (FuelStackAddPage + logic/doseAdvice) ═══ EGY oldal három lépéssel, egyik lépés sem nyit lapot.
   stack-uj.1 · .1-nincs (nincs találat) · .2 (a polcról) · .2-kezi · .2-link · .2-link-olvas · .2-link-kesz · .2-link-ures · .2-link-hiba · .2-foto · .2-foto-olvas · .2-foto-ures · .2-foto-hiba
   · .3 (ismert anyag) · .3-kerekitve · .3-ismeretlen (nem ismert hatóanyag) · .3-hianyzik (nem tudni, mennyi van egy egységben) · .3-nincspolcon (még nincs a Kamrában)
   A fejléc visszagombja a 2–3. lépésen a Protokollra visz (kilép), az előző lépésre a lapon lévő szöveges link lép — így működik ma. */
/* DREF = doseAdvice.ts SUPPLEMENT_REFERENCE (hat ismert anyag; ez FE-logika, tehát angolul is megszólal): [minta, magyar, angol, egység hu, egység en, napi sáv, zóna, indok, figyelmeztetés] */
const DREF=[[/d3|d-vitamin|vitamin d/,'D3-vitamin','Vitamin D3','NE','IU',[2000,4000],'lunch',['Zsírban oldódik: zsíros étkezéssel 3–4-szer jobb a felszívódása.','Fat-soluble: with a meal that has fat it absorbs 3–4 times better.'],['Tartósan magas adag előtt érdemes vérszintet méretni; K2-vel együtt szokás szedni.','Before a long run of high doses, have your blood level checked; it is usually taken with K2.']],
  [/k2|mk-7/,'K2-vitamin','Vitamin K2','µg','µg',[100,200],'lunch',['Zsírban oldódik: a D3-mal együtt, zsíros étkezéshez.','Fat-soluble: with D3, alongside a meal that has fat.'],['Véralvadásgátló mellett csak orvosi egyeztetéssel.','With blood thinners, only after talking to your doctor.']],
  [/magn/,'Magnézium','Magnesium','mg','mg',[200,400],'evening',['Este: nyugtat és a mélyalvást segíti, lefekvés előtt kb. 2 órával.','In the evening: it calms and supports deep sleep, about 2 hours before bed.'],['Egyszerre sok magnézium zavarhatja az emésztést; ilyenkor oszd két részre.','A lot of magnesium at once can upset digestion; if so, split it in two.']],
  [/kreatin|creatine/,'Kreatin','Creatine','g','g',[3,5],'wake',['Étkezéstől független: a napi rendszeresség számít, nem az időpont.','Independent of meals: taking it every day matters, not the time.'],null],
  [/cink|zinc/,'Cink','Zinc','mg','mg',[10,15],'evening',['Vacsorához: távol a reggeli koffeintől és a többi ásványi anyagtól.','With dinner: away from the morning caffeine and the other minerals.'],['Éhgyomorra gyakran émelygést okoz; hosszú távon nagy adag rézhiányt okozhat.','On an empty stomach it often causes nausea; large doses over a long time can lead to copper deficiency.']],
  [/omega|halolaj|krill/,'Omega-3','Omega-3','mg','mg',[1000,2000],'lunch',['Zsírban oldódik: zsíros étkezéssel szívódik fel jól.','Fat-soluble: it absorbs well with a meal that has fat.'],null]];
/* advise = doseAdvice(): a cél a sáv felső értéke; egység-szám = kerekítve; napok = doboz / egység-szám */
function advise(name,per,form,cont){const r=DREF.find(x=>x[0].test(name.toLowerCase())); if(!r)return null;
  const [,hu,en,uh,ue,rng,zone,why,cau]=r, base={sub:L(hu,en),unit:L(uh,ue),rng,zone,why:L(...why),cau:cau&&L(...cau)};
  if(!per)return {...base,unknown:true};
  const target=rng[1],units=Math.max(1,Math.round(target/per)),daily=Math.round(units*per*100)/100;
  return {...base,units,daily,form,days:cont?Math.floor(cont/units):null,match:Math.abs(daily-target)<=per*.01}}
/* a varázsló termékei állapotonként: per = egy egységben · cont = dobozban · shelf = a Kamrában van-e (csak az kerülhet a protokollba) */
const UJP={'':{id:'cink',name:'Cink-biszglicinát',per:15,unit:'mg',form:'kapszula',cont:90,shelf:1,b2:'2'},
  kerekitve:{id:'magn',name:'Magnézium-glicinát',per:300,unit:'mg',form:'kapszula',cont:120,shelf:1,b2:'2'},
  ismeretlen:{id:'aakg',name:'AAKG · L-arginin',per:6,unit:'g',form:'por',cont:250,shelf:1,dose:'6 g',b2:'2'},
  hianyzik:{name:'Vitamin D3 2000 NE · 120 kapszula',per:null,unit:'',form:'kapszula',cont:null,shelf:0,b2:'2-link-kesz'},
  nincspolcon:{name:'Cink-pikolinát',per:15,unit:'mg',form:'tabletta',cont:60,shelf:0,b2:'2-kezi'}};
const RERR={'link-ures':['Az oldalról nem tudtam kiolvasni a termék adatait. Írd be kézzel.','I couldn’t read the product details from that page. Please type them in.'],'link-hiba':['Az oldal beolvasása nem sikerült. Ellenőrizd a linket, vagy írd be kézzel.','The page couldn’t be read. Check the link, or type the details in.'],
  'foto-ures':['A címkéről nem tudtam kiolvasni a termék adatait. Írd be kézzel.','I couldn’t read the product details from the label. Please type them in.'],'foto-hiba':['A címkefotó beolvasása nem sikerült. Írd be kézzel.','The label photo couldn’t be read. Please type the details in.']};
function stackUj(a){
  const [n0,...ff]=String(a||'1').split('-'), s=Math.min(3,Math.max(1,parseInt(n0)||1)), face=ff.join('-');
  const names=[L('Termék','Product'),L('Adatok','Details'),L('Javaslat','Advice')];
  const top={title:L('Új elem beállítása','New item'),sub:L(`Kiegészítők · ${s} / 3 · ${names[s-1]}`,`Supplements · ${s} of 3 · ${names[s-1]}`),back:s===1?'stack':'protokoll'};
  const pb=`<div class="fx-pb rise" role="list" aria-label="${L('A beállítás lépései','Setup steps')}">${[1,2,3].map(n=>`<span role="listitem" class="${n<s?'done':n===s?'on':''}"><i></i><small>${n}. ${names[n-1]}</small></span>`).join('')}</div>`;
  const NOTE3=note(L('Tájékoztatás, nem orvosi tanács. Gyógyszer vagy krónikus betegség mellett kérdezd meg a kezelőorvosod.','For information, not medical advice. If you take medication or have a chronic condition, ask your doctor.'));
  if(s===1){
    /* a lista: useStack().stash (a Kamra kiegészítői és stimulánsai), a keresőre szűrve; „a kiegészítőid között” = már van előfordulása a protokollban */
    const none=face==='nincs', inP=new Set(PROTO.map(o=>o.id)), list=none?[]:KAM.filter(k=>k.k==='supp'||k.k==='stim');
    return page('fuel',top,`${pb}
    ${hero({lbl:L('1. lépés · termék','Step 1 · product'),verdict:L('Melyik terméket állítsuk be?','Which product are we setting up?'),sub:L('A címkéjéről kiolvasom, mennyi van benne, és megmondom, ez mennyi az ajánlott napi mennyiségből.','I read the amount from its label and tell you how it compares with the recommended daily amount.'),left:hi('t-supps'),
      body:`<div style="margin-top:12px" role="search" aria-label="${L('Keresés a Kamrában','Search your pantry')}">${srch(L('Név vagy márka…','Name or brand…'),none?'ashwagandha':'')}</div>`},1)}
    ${sec(1,L('A Kamrádból','From your pantry'),2)}
    ${card(none?txt(L('Nincs ilyen tétel a Kamrában.','Nothing like that in your pantry.')):list.map(k=>row({icon:'t-supps',title:k.n,sub:`${k.b?k.b+' · ':''}${k.dose}${inP.has(k.id)?`<br>${L('már a kiegészítőid között van','already among your supplements')}`:''}`,on:'stack-uj.2'})).join(''),{i:2})}
    ${sec(2,L('Vagy új termék','Or a new product'),3)}
    ${card(row({icon:'t-link',title:L('Termék linkje','Product link'),sub:L('Bemásolod a webshop oldalát, kiolvasom a termék adatait','Paste the shop page and I’ll read the product details'),on:'stack-uj.2-link'})
      +row({icon:'t-camera',title:L('Címkefotóról','From a label photo'),sub:L('Lefotózod a hátoldalt, kiolvasom, amit a címke mond','Take a photo of the back and I’ll read what the label says'),on:'stack-uj.2-foto'})
      +row({icon:'t-journal',title:L('Beírom kézzel','Type it in'),sub:L('Ha nincs nálad a termék','If you don’t have the product with you'),on:'stack-uj.2-kezi'})+NOTE3,{i:3})}`);
  }
  if(s===2){
    const arm=face.startsWith('link')?'link':face.startsWith('foto')?'foto':'', busy=face.endsWith('olvas'), err=RERR[face], scanned=face==='link-kesz';
    /* beolvasás után csak a név (és ha van, az egység) töltődik ki — az „Egy egységben” őszintén üres marad */
    const P0=arm||face==='kezi'?{name:scanned?UJP.hianyzik.name:'',per:'',unit:'',form:'kapszula',cont:''}:UJP[''];
    const next=arm?'stack-uj.3-hianyzik':face==='kezi'?'stack-uj.3-nincspolcon':'stack-uj.3';
    const armCard=arm==='link'?sec(1,L('Termék linkje','Product link'),2)+card(inp(L('Termék linkje','Product link'),busy||scanned||err?'https://webshop.hu/d3-vitamin-2000':'','https://…','url')
        +acts(`<button class="btn sm ghost" ${busy?'disabled':`data-go="stack-uj.2-link-olvas"`}>${busy?L('Beolvasom…','Reading…'):L('Beolvasom','Read it')}</button>`)+(err?`<p class="fh-note fx-warn">${L(...err)}</p>`:'')+(scanned?note(L('A nevet kiolvastam; a többit írd be.','I read the name; please fill in the rest.')):''),{i:2})
      :arm==='foto'?sec(1,L('Címkefotó','Label photo'),2)+card((busy?txt(L('Olvasom a címkét…','Reading the label…')):acts(btn(L('Fotó választása','Choose a photo'),{toast:L('Kamera vagy galéria','Camera or gallery')},'sm ghost')))+(err?`<p class="fh-note fx-warn">${L(...err)}</p>`:''),{i:2}):'';
    const k=arm?2:1;
    return page('fuel',top,`${pb}
    ${hero({lbl:L('2. lépés · adatok','Step 2 · details'),verdict:L('Ezek a termék saját adatai.','These are the product’s own details.'),sub:L('Ebből számolom ki, hány egység kell naponta. Amit nem tudok, azt inkább megkérdezem, mint hogy kitaláljam.','I use them to work out how many units you need a day. What I don’t know I’d rather ask than guess.'),left:hi('t-supps')},1)}
    ${armCard}
    ${sec(k,L('A termék','The product'),k+1)}
    ${card(fld(L('Termék neve','Product name'),P0.name,L('Pl. D3-vitamin','e.g. Vitamin D3'))+`<div class="fx-two">${[[L('Egy egységben','Per unit'),P0.per,'2000'],[L('Mértékegység','Unit'),P0.unit,L('NE','IU')],[L('Kiszerelés','Form'),formT(P0.form),L('kapszula','capsule')],[L('Dobozban','Units per box'),P0.cont,'90']].map(([l,v,ph])=>`<div>${fld(l,v,ph)}</div>`).join('')}</div>`
      +acts(lk(L('Másik terméket választok','Choose another product'),'stack-uj.1')),{i:k+1})}`,
    {foot:btn(L('Tovább a javaslathoz','Continue to advice'),next)});
  }
  const X=UJP[face]||UJP[''], A=advise(X.name,X.per,X.form,X.cont), zone=A?A.zone:ZO[0];
  const shelf=X.shelf?'':card(tip('t-stack',L('Egy lépés még','One more step'),L('A protokoll a Kamrádban lévő termékeket követi, ez pedig még nincs ott. Vedd fel a Kamrába, és innen egy koppintással a protokollba tehetjük.','The protocol follows products in your pantry, and this one isn’t there yet. Add it to the pantry and we can put it in the protocol with one tap.')),{i:2});
  const back=acts(lk(L('Vissza az adatokhoz','Back to details'),'stack-uj.'+X.b2));
  const foot={foot:X.shelf?btn(L(`Felveszem a protokollba · ${zl(zone)}`,`Add to protocol · ${zl(zone)}`),'protokoll'):btn(L('Felveszem a Kamrába','Add to pantry'),'kamra')};
  /* 3b · nem ismert hatóanyag: nincs sáv, nincs grafika — csak az, amit a címke mond */
  if(!A) return page('fuel',top,`${pb}
    ${hero({lbl:`${X.name} · ${L('javaslat','advice')}`,verdict:L('Ezt a hatóanyagot még nem ismerem.','I don’t know this ingredient yet.'),sub:L('Ezért nem találok ki hozzá adagot. Írd be, amit a termék címkéje javasol, és úgy veszem fel.','So I won’t make up a dose. Enter what the label recommends and I’ll add it that way.'),left:hi('t-supps')},1)}${shelf}
    ${sec(1,L('Az adagod','Your dose'),2)}
    ${card(fld(L('Adag (ahogy szeded)','Dose (as you take it)'),X.dose||'',L('Pl. 1 kapszula','e.g. 1 capsule'))+back+NOTE3,{i:2})}`,foot);
  const [lo,hi2]=A.rng, rT=`${kc(lo)}–${kc(hi2)} ${A.unit}`;
  /* 3c · ismert anyag, de nem tudni, mennyi van egy egységben: a sáv megvan, darabszám nincs */
  if(A.unknown) return page('fuel',top,`${pb}
    ${gHero({lbl:`${X.name} · ${L('javaslat','advice')}`,g:bandG({lo:0,hi:hi2*2,a:lo,b:hi2,v:null,al:kc(lo),bl:kc(hi2),label:L(`Az ajánlott napi sáv: ${rT}`,`The recommended daily range: ${rT}`)}),
      verdict:L('Hiányzik egy adat: mennyi van egy egységben.','One detail is missing: how much is in one unit.'),
      sub:L(`Erre az anyagra (${A.sub}) ismerem az ajánlott napi ${rT} sávot, de darabszámot így nem mondok. Írd be az adatoknál, és megmondom, hány kell belőle.`,`For ${A.sub} I know the recommended ${rT} a day, but I can’t say how many without the amount per unit. Enter it under details and I’ll tell you how many you need.`)},1)}${shelf}
    ${card(back+NOTE3,{i:3})}`,foot);
  const dT=`${kc(A.daily)} ${A.unit}`;
  return page('fuel',top,`${pb}
  ${gHero({lbl:`${X.name} · ${L('javaslat','advice')}`,g:bandG({lo:0,hi:hi2*2,a:lo,b:hi2,v:A.daily,vl:dT,al:A.daily===lo?'':kc(lo),bl:A.daily===hi2?'':kc(hi2),label:L(`A napi ${dT} az ajánlott ${rT} sávban`,`${dT} a day, within the recommended ${rT} range`)}),
    verdict:L(`Napi ${A.units} ${A.form}, azaz ${dT}.`,`${A.units} ${formT(A.form,A.units)} a day, that is ${dT}.`),
    sub:(A.match?L(`Ez az ajánlott ${rT} sávban van.`,`That sits in the recommended ${rT} range.`):L(`Ez az ajánlott ${rT} sávban van (a termék adagja miatt kerekítve).`,`That sits in the recommended ${rT} range (rounded to the product’s dose).`))
      +(A.days!=null?' '+L(`A doboz kb. ${A.days} napra elég.`,`The box lasts about ${A.days} days.`):'')},1)}${shelf}
  ${sec(1,L('Miért így','Why this way'),2)}
  ${card(tip('t-bolt',zl(A.zone),A.why),{i:2})}
  ${sec(2,L('Finomítás','Fine-tune'),3)}
  ${card(lab(L('Napi mennyiség','Daily amount'))+stp(kc(A.daily),A.unit,L('Napi mennyiség','Daily amount'))+lab(L('Mikor','When'))+pick(ZO.map(z=>zl(z)),zl(A.zone),L('Mikor','When'))
    +(A.cau?`<p class="fh-note fx-warn"><b>${L('Amire figyelj:','Watch out:')}</b> ${A.cau}</p>`:'')+back+NOTE3,{i:3})}`,foot);
}
/* ═══ GYÓGYSZER (FuelMedicationPage + MedicationCycleBar; lapok: LogDoseSheet, MedicationFormSheet) ═══
   állapotok: gyogyszer (nincs követett gyógyszer — a tulajdonos ma nem követ) · .aktiv · .ujonnan (felvéve, még nincs beadás) · .leallitas (a megerősítő kártya nyitva)
   A leállítás soha nem hiba-színű: döntés, nem hiba; a beadás-történet megmarad. */
const MED={name:'Retatrutid',ing:'retatrutid',route:'subQ',cad:'weekly-monday',dose:6,unit:'mg',len:7,ph:[['peak',1,2],['stable',3,5],['trough',6,7]],
  doses:[[0,10,5,'Hétfő reggel · subQ has'],[0,9,28,null],[0,9,21,null]]};  /* a jegyzet a felhasználó szövege: angolul is marad */
/* a három magasság a három FÁZIS jele (cycle.week[].phaseKey), nem mért vagy becsült szint */
const PHN={peak:['csúcs','peak',96],stable:['stabil','stable',62],trough:['völgy','trough',30]};
const MROUTE={subQ:['bőr alá','subQ injection'],IM:['izomba','IM injection'],oral:['szájon át','oral']};
const WKEY=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const cadT=c=>c==='daily'?L('napi','daily'):`${L('heti','weekly')} · ${wd(WKEY.indexOf(c.slice(7)),1)}`;
const phOf=d=>(MED.ph.find(x=>d>=x[1]&&d<=x[2])||MED.ph[0])[0];
const phT=k=>L(PHN[k][0],PHN[k][1]);
const cyc=(now,off)=>`<div class="fu-cyc" role="img" aria-label="${off||now<0?L('A ciklus fázisai','Phases of the cycle'):L(`A ciklus fázisai: ${now+1}. nap a ${MED.len}-ből, ${phT(phOf(now+1))} fázis`,`Phases of the cycle: day ${now+1} of ${MED.len}, ${phT(phOf(now+1))} phase`)}">${Array.from({length:MED.len},(_,i)=>`<span class="${i===now?'now':''}"><span class="t"><i style="height:${off?0:PHN[phOf(i+1)][2]}%"></i></span><b>${phT(phOf(i+1))}</b><small>${L(`${i+1}.`,String(i+1))}</small></span>`).join('')}</div>`;
const phDays=()=>MED.ph.map(([k,a,b])=>L(`${b-a+1} nap ${phT(k)}`,`${pl(b-a+1,'','day','days')} ${phT(k)}`)).join(' · ');
function gyogyszer(arg){
  if(arg!=='aktiv'&&arg!=='ujonnan'&&arg!=='leallitas') return page('fuel',{title:L('Gyógyszer','Medication'),sub:L('Kiegészítők · követés','Supplements · tracking'),back:'stack'},`
  ${gHero({lbl:L('Követett gyógyszer','Tracked medication'),g:`<div class="fu-off">${cyc(-1,1)}</div>`,verdict:L('Nincs követett gyógyszer.','No medication yet.'),sub:L('Ha szedsz valamit ciklusban, ide kerül a fázis-térkép és a beadás-napló.','If you take something in cycles, its phase map and dose log will live here.'),body:note(NOTE1()),
    acts:btn(L('Gyógyszer felvétele','Add medication'),{sheet:'medform'})},1)}`);
  const fresh=arg==='ujonnan', day=3, ago=2, ph=phOf(day), doses=fresh?[]:MED.doses;
  /* cycle.cycleDay + cycle.phaseKey + lastDoseAt → egy mondat; a „ma / tegnap / N napja” mindhárom alakja megírva */
  const agoT=ago<=0?L('ma volt','was today'):ago===1?L('tegnap volt','was yesterday'):L(`${ago} napja volt`,`was ${ago} days ago`);
  const verdict=fresh?L('Még nincs beadás: a ciklus az első beadás napjától indul.','No dose yet: the cycle starts on the day of your first dose.')
    :L(`${cap(phT(ph))} fázisban vagy, az utolsó beadás ${agoT}.`,`You’re in the ${phT(ph)} phase; your last dose ${agoT}.`);
  return page('fuel',{title:MED.name,sub:L('Kiegészítők · gyógyszer','Supplements · medication'),back:'stack'},`
  ${gHero({lbl:fresh?L('A ciklus · még nem indult el','The cycle · not started yet'):L(`A ciklus · ${day}. nap a ${MED.len}-ből`,`The cycle · day ${day} of ${MED.len}`),
    g:`<div class="fu-sc"><span class="fh-big">${fmt(MED.dose)}<small>${MED.unit}</small></span><span class="c fb-rc">${L(...MROUTE[MED.route])}<br>${cadT(MED.cad)}</span></div>${fresh?`<div class="fu-off">${cyc(-1,1)}</div>`:cyc(day-1)}`,
    verdict,sub:L(`A három magasság a ciklus három fázisa, a beadás napjától számolva: ${phDays()}. Nem mért szint.`,`The three heights are the three phases of the cycle, counted from the dose day: ${phDays()}. Not a measured level.`),
    acts:btn(L('+ Beadás','+ Dose'),{sheet:'dose'})},1)}
  ${sec(1,doses.length?`${L('Beadások','Doses')} · ${doses.length}`:L('Beadások','Doses'),2)}
  ${card((doses.length?doses.map(([w,m,d,n])=>row({icon:'t-syringe',title:cap(dF(w,m,d)),sub:n?`„${n}”`:'',v:`${fmt(MED.dose)}<small>${MED.unit}</small>`})).join(''):txt(L('Még nincs rögzített beadás.','No doses logged yet.')))
    +(arg==='leallitas'?`<div class="fb-stop" role="group" aria-label="${L('Leállítás megerősítése','Confirm stopping')}"><p>${L(`${cap(azA(MED.name))} leáll. A beadás-történet megmarad, a Fuel-oldalak nem számolnak vele tovább.`,`${MED.name} will stop. The dose history stays; Fuel pages no longer count with it.`)}</p>${acts(btn(L('Leállítom','Stop it'),'gyogyszer','sm ghost')+lk(L('Mégse','Cancel'),'gyogyszer.aktiv'))}</div>`
      :acts(btn(L('Szerkesztés','Edit'),{sheet:'medform',arg:'szerk'},'sm ghost')+lk(L('Leállítás','Stop'),'gyogyszer.leallitas')))
    +note(NOTE1()),{i:2})}`);
}

/* ═══ TRENDEK · adatok ═══════════════════════════════════════════════════════════════════════
   WEEKS: ez a hét (okt. 5–11.) és a múlt hét (szept. 28 – okt. 4.) — useFuelWeek / useFuelWeekRollup (7 napos rollup) + useMeWeek (napi értékelés két étkezés-dimenziója, edzésnap).
   A napi kcal a Tanulás (LD) napjaival egyezik, a kedd a YM két étkezése, a szerda a DAY. nap: kcal (null = nincs naplózva) · t = a nap kerete · mac = [fehérje, szénhidrát, zsír] g
   · nut / q = subscores.nutrition / quality (0–100; null = még nincs értékelés — a mai napé csak az éjszakai zárás után születik meg) · wo = workoutCount · mode = fuelMode (kímélő nap)
   · ids = a nap étkezései a MEALS / YM kulcsaival (megnyithatók) · meals = [név, idő, kcal, pont | null] (a múlt hét étkezései: a prototípusban nincs saját oldaluk) · go = a nap lapja a Mai-n */
const tgM=t=>[DAY.p[1],DAY.c[1],DAY.f[1]].map(x=>Math.round(x/DAY.target*t));
const WEEKS={
  prev:{days:[
    {m:9,d:28,kcal:2150,t:3100,mac:[142,236,71],nut:71,q:82,wo:1,meals:[['Túrós zabkása · áfonyával','07:25',689,8.4],['Csirke + édesburgonya + spenót','12:50',1015,8.1],['Túró · áfonya · méz quick','16:05',324,7.8],['Alma és dió','20:10',122,null]]},
    {m:9,d:29,kcal:2980,t:2870,mac:[196,330,97],nut:88,q:84,wo:1,meals:[['Túrós zabkása · áfonyával','07:10',689,8.4],['Whey + banán + mandulavaj','10:00',356,7.2],['Csirke + édesburgonya + spenót','12:35',1015,8.1],['Banán','16:20',102,null],['Lazac + barna rizs + brokkoli','19:30',818,7.9]]},
    {m:9,d:30,kcal:2820,t:3100,mac:[178,300,101],nut:86,q:80,wo:1,meals:[['Tojásrántotta · spenóttal','07:40',318,7.6],['Csirke + édesburgonya + spenót','12:45',1015,8.1],['Túró · áfonya · méz quick','16:00',324,7.8],['Zabkeksz és tej','17:30',345,5.9],['Lazac + barna rizs + brokkoli','19:50',818,7.9]]},
    {m:10,d:1,kcal:1610,t:2450,mac:[96,180,56],nut:58,q:74,wo:0,meals:[['Túrós zabkása · áfonyával','08:05',689,8.4],['Gulyásleves','13:20',690,7.4],['Túró rudi · 2 db','17:10',231,4.6]]},
    {m:10,d:2,kcal:1180,t:3100,mac:[78,120,43],nut:39,q:61,wo:1,meals:[['Kávé és vajas kifli','09:05',330,6.1],['Csirke + édesburgonya + spenót','14:10',850,8.0]]},
    {m:10,d:3,kcal:2760,t:2870,mac:[150,318,99],nut:80,q:58,wo:1,meals:[['Túrós zabkása · áfonyával','08:30',689,8.4],['Csirke + édesburgonya + spenót','13:00',1015,8.1],['Whey + banán + mandulavaj','16:40',356,7.2],['Pizza · 2 szelet','20:15',700,4.9]]},
    {m:10,d:4,kcal:3120,t:2450,mac:[148,352,124],nut:62,q:46,wo:0,meals:[['Tojásrántotta · spenóttal','09:10',318,7.6],['Rántott csirke rizzsel','13:30',1180,5.4],['Somlói galuska','14:10',520,3.2],['Lazac + barna rizs + brokkoli','19:20',818,7.9],['Pattogatott kukorica','21:00',284,4.4]]}]},
  cur:{days:[
    {m:10,d:5,kcal:null,t:2450,wo:0,go:'mai.d-10-05'},
    {m:10,d:6,kcal:1020,t:2870,mac:[51,104,44],nut:41,q:68,wo:1,ids:['y1','y2'],go:'mai.d-10-06'},
    {m:10,d:7,kcal:DAY.eaten,t:DAY.target,mac:[DAY.p[0],DAY.c[0],DAY.f[0]],nut:null,q:null,wo:1,ids:['reggeli','tizorai','ebed'],go:'mai',today:1},
    {m:10,d:8,kcal:null,t:2450,wo:0},{m:10,d:9,kcal:null,t:3100,wo:0},{m:10,d:10,kcal:null,t:2870,wo:0},{m:10,d:11,kcal:null,t:2450,wo:0}]}};
/* a hosszabb táv: useFuelHorizon(start) — hét hét a megnyitott hétig: heti átlag kcal (meWeek.weekly.avgKcal) + a súlynapló heti átlaga. A heti súly az Én „Hol tartok” vonalával egyezik (… 78,9 → 78,4).
   Az utolsó két hét kcal-átlaga a WEEKS-ből számolódik (ugyanaz, mint a csempén). Napi mérések: useWeight().weightLog (a hook ma is betölti; SZÁMOLHATÓ) — itt a heti átlag körüli eltérésekből (összegük 0, így az átlag pontos).
   A cél vonala: useGoal().targetWeight (SZÁMOLHATÓ: ezt a hookot az oldal ma nem hívja; ha nincs súlycél, nincs vonal — trendek.nincs-cel). */
const HMON=[[8,17],[8,24],[8,31],[9,7],[9,14],[9,21],[9,28],[10,5]], HKG=[81.1,80.6,79.9,80.2,79.7,79.3,78.9,78.4], HKC=[2590,2610,2540,2480,2590,2470];
const HDEV=[.3,-.1,.2,null,-.3,.1,-.2], HDEVC=[.2,0,-.2,null,null,null,null], GOALKG=73;
/* a Fuel-vonatkozású mintázatok: usePatterns() → logic/fuelPatternRefs (kulcs-szűrés). A cím a minta TÁROLT címe (a Mezo „Minták” oldalán ugyanez), az állapot egy szó. */
const PATS=[['vacsora','Vacsora ideje ↔ alvásminőség','monitoring'],['viz','Vízbevitel ↔ energia-szint','proposed']];
const PSTAT={confirmed:['Megerősítve','Confirmed'],monitoring:['Figyeljük','Watching'],rejected:['Elvetve','Dismissed'],proposed:['Döntésre vár','Awaiting your decision'],refuted:['Megnéztük, nem igazolódott','Checked, not confirmed'],dormant:['Pihen, várom az adatot','Resting, waiting for data']};
const avgOf=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
/* a nap étkezés-pontja (0–10): logic/fuelWeekView.mealDayScore — a két étkezés-dimenzió a saját súlyukkal (.30 / .15); ha csak az egyik ismert, az áll magában */
const dayScore=(n,q)=>n==null&&q==null?null:n==null?Math.round(q)/10:q==null?Math.round(n)/10:Math.round((n*.3+q*.15)/.45)/10;
const sc1=v=>fmt(v.toFixed(1));
const dayMeals=x=>x.ids?x.ids.map(id=>{const m=mealOf(id);return {name:m.name,time:m.time,kcal:m.kcal,score:m.score,go:'meal.'+id}}):(x.meals||[]).map(([name,time,kcal,score])=>({name,time,kcal,score}));
/* weekVM = logic/fuelWeekView.buildWeekView + a lap számításai — EGY függvény adja a hős mondatát, az edényeket, a csempéket és a két közlekedőedényt (F3.2, F4.8)
   állapot-argok: '' (ez a hét) · mult (a múlt hét) · elso (első hét) · ures · tolt · kimelo (kedd és szerda kímélő nap, mint a mai.kimelo) · egyszint / hetkoznap (a múlt hét más hétvégével — állapot-arc) */
function weekVM(arg){
  const pv=['mult','egyszint','hetkoznap'].includes(arg), key=pv?'prev':'cur';
  let days=WEEKS[key].days.map((x,w)=>({...x,w}));
  if(arg==='ures'||arg==='tolt') days=days.map(x=>({...x,kcal:null,nut:null,q:null,ids:null,mac:null}));
  if(arg==='egyszint') days=days.map(x=>x.w===5?{...x,kcal:2180,meals:null}:x.w===6?{...x,kcal:1900,meals:null}:x);
  if(arg==='hetkoznap') days=days.map(x=>x.w===5?{...x,kcal:1500,meals:null}:x.w===6?{...x,kcal:1300,meals:null}:x);
  if(arg==='kimelo') days=days.map(x=>x.w===1||x.w===2?{...x,mode:'GUIDANCE'}:x);
  days=days.map(x=>{const logged=x.kcal>0,rec=!!x.mode;return {...x,logged,rec,pct:logged&&x.t&&!rec?x.kcal/x.t*100:null,score:dayScore(x.nut??null,x.q??null),over:!rec&&logged&&x.kcal>x.t+60,weekend:x.w>=5,train:x.wo>0}});
  const wdP=avgOf(days.filter(x=>!x.weekend&&x.pct!=null).map(x=>x.pct)), weP=avgOf(days.filter(x=>x.weekend&&x.pct!=null).map(x=>x.pct));
  const cnt=days.filter(x=>x.kcal!=null&&!x.rec);
  return {arg,pv,key,days,logged:days.filter(x=>x.logged).length,wdP,weP,delta:wdP!=null&&weP!=null?weP-wdP:null,
    kAvg:avgOf(cnt.map(x=>x.kcal)),tAvg:avgOf(cnt.map(x=>x.t)),        /* loggedKcalAvg: a kímélő nap nincs benne */
    qAvg:arg==='tolt'?null:avgOf(days.flatMap(x=>x.logged&&!x.rec?dayMeals(x).map(m=>m.score).filter(s=>s!=null):[])),   /* week.mealScoreAvg × 10; a kímélő nap étkezései itt nem számítanak (a nap „a heti értékelésbe sem számít bele”) */
    kg:arg==='tolt'||arg==='sulynelkul'?null:HKG[pv?6:7], title:dR(days[0].m,days[0].d,days[6].m,days[6].d)}}
/* a változás a múlt héthez mérve (logic/fuelWeekView.weekDeltas): IRÁNY és MENNYISÉG, semmi más — nincs jó / rossz szín. Nincs: a múlt heti nézetben, betöltés közben, első héten, ha bármelyik oldal hiányzik, vagy ha a kiírt pontosságon egyenlők */
const wDelta=(now,before,dec)=>{if(now==null||before==null)return null;const s=10**dec,a=Math.round(Math.abs(now-before)*s)/s;return a===0?null:{up:now>before,a}};
/* weekVes: a hét hét edénye — a szint az evés, a szaggatott vonal a nap kerete, a szám a nap étkezés-pontja; a hétvége két edénye más alapot kap (ők a „hétvége” csoport a lenti összevetésben) */
const weekVes=V=>{const mx=Math.max(2400,...V.days.map(x=>Math.max(x.kcal||0,x.t||0)));
  return `<div class="fu-wk" role="group" aria-label="${L('A hét hét napja a keretéhez mérve','The seven days of the week against their budget')}">${V.days.map(x=>{const dn=cap(dF(x.w,x.m,x.d));
    const aria=x.rec?L(`${dn}: kímélő nap`,`${dn}: gentle day`):x.logged?L(`${dn}: ${kc(x.kcal)} kcal a ${kc(x.t)} kcal-os keretből, ${x.score==null?'étkezés-pont még nincs':'étkezés-pont '+sc1(x.score)}`,`${dn}: ${kc(x.kcal)} kcal of a ${kc(x.t)} kcal budget, ${x.score==null?'no meal score yet':'meal score '+sc1(x.score)}`):L(`${dn}: nincs adat`,`${dn}: no data`);
    return `<button class="fu-wd ${x.logged||x.rec?'':'gap'} ${x.weekend?'we':''} ${x.rec?'rec':''} ${x.today?'on':''}" data-sheet="day" data-arg="${V.arg}|${x.w}" aria-label="${esc(aria)}"><em>${x.rec?I('t-kimelo'):x.score==null?'·':sc1(x.score)}</em><span class="fu-tb">${x.logged?`<i style="height:${(Math.min(x.kcal,x.rec?x.kcal:x.t)/mx*100).toFixed(1)}%"></i>${x.over?`<s style="bottom:${(x.t/mx*100).toFixed(1)}%;height:${((x.kcal-x.t)/mx*100).toFixed(1)}%"></s>`:''}`:''}${x.rec?'':`<u style="bottom:${(x.t/mx*100).toFixed(1)}%"></u>`}</span><b>${wd(x.w)}</b><small class="${x.train?'tr':''}"></small></button>`}).join('')}</div>`};
/* seriesG: heti pontok folyadék-felszínként — a hiány VALÓDI szakadás (nincs áthidalás, nincs nulla); days = a hét napi mérései halvány pontként; target = vízvonal */
const seriesG=(vals,{h=140,c='var(--liq1)',c2='var(--liq2)',days=null,target=null,tl='',labels=null,aria=''}={})=>{
  const id=F.uid('fs'),W=320,pad=12,bot=h-(labels?18:4),nn=vals.filter(v=>v!=null),all=[...nn,...(days||[]).flat().filter(v=>v!=null),...(target!=null?[target]:[])];
  const mn=Math.min(...all),mx=Math.max(...all),r=(mx-mn)||1,lo=mn-r*(target!=null?.10:.35),hi=mx+r*.14;
  const X=i=>pad+i*(W-2*pad)/(vals.length-1),Y=v=>12+(1-(v-lo)/(hi-lo))*(bot-12),step=(W-2*pad)/(vals.length-1);
  const segs=[];let cur=[];vals.forEach((v,i)=>{if(v==null){if(cur.length)segs.push(cur);cur=[]}else cur.push([X(i),Y(v)])});if(cur.length)segs.push(cur);
  return `<svg class="fh-chart fb-ser" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(aria)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset="1" stop-color="${c2}" stop-opacity=".2"/></linearGradient></defs>
    ${segs.filter(s=>s.length>1).map(s=>`<path d="${smooth(s)} L${s[s.length-1][0].toFixed(1)} ${bot} L${s[0][0].toFixed(1)} ${bot}Z" fill="url(#${id})"/><path d="${smooth(s)}" fill="none" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>`).join('')}
    ${target!=null?`<path d="M${pad} ${Y(target).toFixed(1)}H${W-pad}" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".55"/><text x="${W-pad}" y="${(Y(target)-5).toFixed(1)}" text-anchor="end">${tl}</text>`:''}
    ${days?days.map((wk,i)=>wk?wk.map((v,j)=>{const cx=X(i)+(j-3)/7*step;return v==null||cx<pad||cx>W-pad?'':`<circle cx="${cx.toFixed(1)}" cy="${Y(v).toFixed(1)}" r="1.8" fill="var(--ink)" opacity=".32"/>`}).join(''):'').join(''):''}
    ${vals.map((v,i)=>v==null?'':`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.6" fill="#fff" stroke="${c2}" stroke-width="2.2"/>`).join('')}
    ${labels?`<text x="${pad}" y="${h-4}">${labels[0]}</text><text x="${W-pad}" y="${h-4}" text-anchor="end">${labels[1]}</text>`:''}</svg>`};

/* ═══ TRENDEK (FuelTrendekPage + logic/fuelWeekView + FuelHorizon + logic/fuelPatternRefs) ═══ „Jól ment a hetem?”
   állapotok: trendek (ez a hét) · .mult (a múlt hét, ?w=elozo) · .elso (első hét: nincs hova visszalépni) · .ures (nincs naplózott nap) · .egyszint · .hetkoznap · .kimelo · .tolt
   · .sulynelkul (nincs súlymérés) · .sulyhezag (egy hét mérés nélkül) · .nincs-cel (nincs súlycél: nincs vízvonal) · .rovid (még nincs elég hét) · .mintanelkul (nincs Fuel-mintázat)
   A hősnek NINCS gombja (az élő oldalon sincs): a hét-váltó a vezérlő. Hibaarca az élő oldalnak nincs. SZÉGYENMENTES: a keret feletti nap más színt kap, nem hibát. */
function trendek(arg){
  const V=weekVM(arg), load=arg==='tolt', first=arg==='elso', P0=!V.pv&&!first&&!load?weekVM('mult'):null, D=V.delta, n=V.logged;
  /* a hét-váltó: csak ez a hét és a múlt hét létezik; a „Múlt hét” tiltva, ha már ott vagy, vagy ha nincs korábbi hét */
  const nav=`<div class="fb-wn rise"><button ${V.pv||first?'disabled':'data-go="trendek.mult"'} aria-pressed="${V.pv}">‹ ${L('Múlt hét','Last week')}</button><b>${V.title}</b><button ${V.pv?'data-go="trendek"':'disabled'} aria-pressed="${!V.pv}">${L('Ez a hét','This week')} ›</button></div>`
    +(first?`<p class="fb-wnn rise">${L('Ez az első heted. Még nincs korábbi hét, amire visszalépj.','This is your first week. There’s no earlier week to go back to yet.')}</p>`:'');
  /* a SEMLEGES heti olvasat öt alakja (FuelTrendekPage read); a különbség a NYERS értékek különbségének kerekítése, nem két kerekített szám különbsége */
  const dr=D==null?null:Math.round(Math.abs(D));
  const [verdict,sub]=load?[L('Töltöm a hetedet…','Loading your week…'),'']
    :n===0?[L('Ezen a héten még nincs naplózott nap.','No days logged this week yet.'),L('Nem találgatunk helyetted: amit felveszel, az rögtön itt lesz.','We won’t guess for you: whatever you log shows up here right away.')]
    :D==null?[L(`${n} naplózott nap van a héten.`,n===1?'1 day is logged this week.':`${n} days are logged this week.`),L('A hét többi része még előtted áll; üresen hagyjuk, nem találgatjuk.','The rest of the week is still ahead; we leave it empty rather than guess.')]
    :Math.abs(D)<5?[L('A hétköznapok és a hétvége nagyjából egy szinten mozognak.','Weekdays and the weekend run at about the same level.'),'']
    :D>0?[L(`Hétvégén átlagosan <span class="fb-nw">${dr}%-kal</span> többet ettél a keretedhez mérve, mint hétköznap.`,`At the weekend you ate ${dr}% more against your budget than on weekdays, on average.`),L('Így alakult, és most már látod.','That’s how it went, and now you can see it.')]
    :[L(`Hétköznap átlagosan <span class="fb-nw">${dr}%-kal</span> többet ettél a keretedhez mérve, mint hétvégén.`,`On weekdays you ate ${dr}% more against your budget than at the weekend, on average.`),L('Így alakult, és most már látod.','That’s how it went, and now you can see it.')];
  const any=f=>V.days.some(f);
  const leg=lgd([['liq',L('amit ettél','what you ate')],['line',L('a nap kerete','the day’s budget')],...(any(x=>x.over)?[['over',L('a keret fölött','over budget')]]:[]),...(any(x=>!x.logged&&!x.rec)?[['gap',L('nincs adat','no data')]]:[]),...(any(x=>x.rec)?[['rec',L('kímélő nap','gentle day')]]:[]),['we',L('hétvége','weekend')],...(any(x=>x.train)?[['tr',L('edzésnap','training day')]]:[])]);
  const hint=L('A szám a nap étkezés-pontja. Koppints egy edényre a részletekért.','The number is the day’s meal score. Tap a vessel for details.');
  /* három csempe (STAT_FACE): napi átlag · étkezés-minőség · heti súlyátlag. Egyik csempének sincs szintje (a szint a fenti edényeké és a lenti közlekedőedényeké). Üres érték: „—”. */
  const dK=P0&&wDelta(V.kAvg,P0.kAvg,0), dQ=P0&&wDelta(V.qAvg,P0.qAvg,1), dW2=P0&&wDelta(V.kg,P0.kg,1);
  const dT=(d,hu,en)=>d?(d.up?L(`${hu} több`,`${en} more`):L(`${hu} kevesebb`,`${en} less`)):'';
  const tiles=`<div class="fh-grid fb-t3">${[
    stat({k:L('Napi átlag','Daily average'),icon:'t-plate',n:V.kAvg==null?'—':kc(V.kAvg),unit:V.kAvg==null?'':'kcal',s:dK?dT(dK,`${kc(dK.a)} kcal-lal`,`${kc(dK.a)} kcal`):'',on:{toast:L('A naplózott napok átlaga; a ki nem töltött nap nem nulla, hanem kimarad','The average of logged days; a day with no log is left out, not counted as zero')}}),
    stat({k:L('Minőség','Meal quality'),icon:'t-score',n:V.qAvg==null?'—':sc1(V.qAvg),unit:V.qAvg==null?'':'/ 10',s:dQ?dT(dQ,`${sc1(dQ.a)} ponttal`,`${sc1(dQ.a)}`):'',on:{toast:L('Étkezés-minőség: a hét étkezéseinek átlagos pontja','Meal quality: the average score of the week’s meals')}}),
    stat({k:L('Heti súlyátlag','Weekly weight'),icon:'t-weight',c:'var(--water)',n:V.kg==null?'—':sc1(V.kg),unit:V.kg==null?'':'kg',s:dW2?dT(dW2,`${sc1(dW2.a)} kg-mal`,`${sc1(dW2.a)} kg`):'',on:{toast:L('A hét méréseinek átlaga','The average of this week’s weigh-ins')}})].join('')}</div>`
    +(dK||dQ||dW2?note(L('A csempék alsó sora a múlt héthez mért változás: irány és mennyiség, nem ítélet.','The bottom line on each tile is the change from last week: direction and amount, not a verdict.')):'');
  /* két közlekedőedény: a naplózott (nem kímélő) napok kerethez mért átlaga hétköznap és hétvégén (vm.weekdayAvgPct / weekendAvgPct), 130%-os léptékben; a vonal a keret (100%) */
  const pT=v=>v==null?'—':Math.round(v)+'%', yB=(96-100/1.3*.74).toFixed(1);
  const link=linked((V.wdP||0)/1.3,(V.weP||0)/1.3,{a:`${L('Hétköznap','Weekdays')} · ${pT(V.wdP)}`,b:`${L('Hétvége','Weekend')} · ${pT(V.weP)}`,s:250}).replace('</svg>',`<path d="M8 ${yB}H212" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 4" opacity=".5"/><text x="110" y="${(yB-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--sub)">${L('a keret','budget')}</text></svg>`)
    .replace(/<g clip-path="url\(#[^")]+a\)">.*?<\/g>/,m=>V.wdP==null?'':m).replace(/<g clip-path="url\(#[^")]+b\)">.*?<\/g>/,m=>V.weP==null?'':m);
  const splitNote=D==null?L('A kettő összevetéséhez mindkét oldalon kell legalább egy naplózott nap; amíg nincs, üresen hagyjuk.','Comparing the two needs at least one logged day on each side; until then we leave it empty.')
    :D>0?L(`A különbség <b>${dr} százalékpont</b> a hétvége javára.`,`The gap is <b>${dr} percentage points</b>, towards the weekend.`):L(`A különbség <b>${dr} százalékpont</b> a hétköznapok javára.`,`The gap is <b>${dr} percentage points</b>, towards weekdays.`);
  /* a hosszabb táv: 7 hét a megnyitott hétig */
  const e=V.pv?6:7, idx=[...Array(7)].map((_,i)=>e-6+i);
  const kcs=idx.map(i=>i===e?V.kAvg:i===6?weekVM('mult').kAvg:HKC[i]);
  const kgs=idx.map(i=>arg==='sulynelkul'||load?null:arg==='sulyhezag'&&i===e-3?null:HKG[i]);
  const dly=kgs.map((v,k)=>v==null?null:(idx[k]===7?HDEVC:HDEV).map(o=>o==null?null:Math.round((v+o)*10)/10));
  const hl=[dS(...HMON[idx[0]]),dS(...HMON[e])], nKg=kgs.filter(v=>v!=null).length, goal=arg==='nincs-cel'?null:GOALKG;
  /* FuelHorizon: két hétnél kevesebből nincs trend. (Az élő kód `weeks.length < 2`-t néz, ami a 7 elemű listán sosem igaz — az építéskor a NEM üres hetek számát kell nézni; a tulajdonosi listán.) */
  const wait=arg==='rovid'||first;
  const horizon=wait?card(empty('t-trend',L('Néhány hét kell még ehhez a képhez. Egyetlen hétből nincs trend, és nem rajzolunk olyat, ami nincs.','This picture needs a few more weeks. One week is not a trend, and we don’t draw what isn’t there.')),{i:4})
    :card(head('t-weight',L('Heti súlyátlag','Weekly weight average'))
      +(nKg?seriesG(kgs,{h:150,days:dly,target:goal,tl:goal==null?'':L(`cél · ${sc1(goal)} kg`,`goal · ${sc1(goal)} kg`),labels:hl,aria:L(`Heti súlyátlag 7 héten át, ${hl[0]} és ${hl[1]} között`,`Weekly weight average over 7 weeks, ${hl[0]} to ${hl[1]}`)})
          +lgd([['liq',L('heti súlyátlag','weekly weight average')],['dot',L('napi mérések','daily weigh-ins')],...(goal==null?[]:[['line',L(`cél · ${sc1(goal)} kg`,`goal · ${sc1(goal)} kg`)]])])
        :'')
      +(nKg===0?note(L('Súlymérés nélkül ehhez a héthez nincs súlyvonal; a hiányt meghagyjuk hiánynak.','Without weigh-ins there’s no weight line here; we leave the gap as a gap.')):nKg<7?note(L('Ahol nincs mérés, ott a súlyvonal megszakad; nem találgatunk közé értéket.','Where there’s no weigh-in the weight line breaks; we don’t guess a value in between.')):'')
      +lab(L('Heti átlag kcal','Weekly average kcal'))
      +(kcs.some(v=>v!=null)?seriesG(kcs,{h:84,c:'color-mix(in srgb,var(--carb) 55%,#fff)',c2:'var(--carb)',aria:L('Heti átlag kalória 7 héten át','Weekly average calories over 7 weeks')}):'')
      +note(L('A heti átlagok egymás alatt: fent a súly, lent az evés, ugyanazokon a heteken. Egyik sem ok, csak együttjárás.','Weekly averages one under the other: weight above, eating below, over the same weeks. Neither causes the other; they just move together.')),{i:4});
  const pats=arg==='mintanelkul'||first?[]:PATS;
  return page('fuel',{title:L('Trendek','Trends'),sub:`Fuel · ${['mult','egyszint','hetkoznap'].includes(arg)?L('múlt hét','last week'):L('ez a hét','this week')}`,tab:'trendek'},`
  ${nav}
  ${gHero({lbl:load?L('Naplózott napok','Days logged'):L(`${n} / 7 naplózott nap · ebből áll a heti kép`,`${n} of 7 days logged · this is what the week is built from`),g:weekVes(V)+leg,verdict,sub:`${sub?sub+' ':''}${hint}`},1)}
  ${sec(1,L('A hét számai','The week in numbers'),2)}
  ${card(tiles,{i:2})}
  ${sec(2,L('Hétköznap és hétvége','Weekdays and weekend'),3)}
  ${card(`<div class="fu-lk">${link}</div>`+note(splitNote),{i:3})}
  ${sec(3,wait?L('Hosszabb táv','Longer term'):L('Hosszabb táv · 7 hét','Longer term · 7 weeks'),4)}
  ${horizon}
  ${pats.length?sec(4,`${L('Mintázatok','Patterns')} · ${pats.length}`,5)
    +card(pats.map(([id,t,stt])=>`<a class="fh-row fb-a" href="#w-mezo-minta.${id}"><span class="si">${I('t-pattern')}</span><span class="g"><strong>${t}</strong><small>${L(...PSTAT[stt])}</small></span>${chev()}</a>`).join('')
      +note(L('A mintázatok otthona a Mezo; innen odalépsz, nem másolatot látsz.','Patterns live in Mezo; from here you step over to them, you don’t see a copy.')),{i:5}):''}`);
}

/* ═══ BEÁLLÍTÁSOK · ABLAKOK (C terület) — FuelSettingsPage, FuelSlotsPage; a Beállítások keretében élnek ═══
   beallitas · .egyeni · .egyeni-hiba · .modositva · .elonezet-tolt · .elonezet-hiba · .ablak-nelkul · .tolt · .hiba · .mentes-hiba
   ablakok (pihenőnap, ajánlott) · .reggeli (a mai nap típusa) · .esti (mintanap) · .szerk · .mentett · .hiba · .figyel · .ertekel · .olvasat · .olvasat-igazit · .olvasat-nincs · .tolt · .betolt-hiba · .mentes-hiba
   EGY napi keret: az ablakok a SLOTS-ból jönnek (Σ = DAY.target), a makró-arányok a DAY célgrammjaiból (legnagyobb maradék, Σ = 100 — buildFuelSettingsMacroPreview). */
const lrPct=a=>{const t=a.reduce((s,x)=>s+x,0)||1,raw=a.map(x=>x/t*100),fl=raw.map(Math.floor);let left=100-fl.reduce((s,x)=>s+x,0);
  raw.map((x,i)=>[x-fl[i],i]).sort((p,q)=>q[0]-p[0]).forEach(([,i])=>{if(left>0){fl[i]++;left--}});return fl};
const CSTOP='14:00';
/* a naptípusok ablakai: [idő, név HU, EN, ikon, rész %, kcal?]; a kcal = a mai keret része (az élő lap is a mai keretet osztja minden naptípusra). A „reggeli edzés” a mai nap: a SLOTS. */
const DTYPES=[['rest','Pihenőnap','Rest day'],['training_am','Reggeli edzés','Morning training'],['training_pm','Esti edzés','Evening training']];
const WREC={rest:[['07:30','Reggeli','Breakfast','t-sun',26],['12:30','Ebéd','Lunch','t-bowl',30],['16:00','Uzsonna','Snack','t-snack',14],['19:30','Vacsora','Dinner','t-moon',30]],
  training_am:(()=>{const p=lrPct(SLOTS.map(s=>s.b));return SLOTS.map((s,i)=>[s.from,s.l,s.e,s.ic,p[i],s.b])})(),
  training_pm:[['07:00','Reggeli','Breakfast','t-sun',24],['12:00','Ebéd','Lunch','t-bowl',30],['16:30','Uzsonna','Snack','t-snack',14],['19:45','Vacsora','Dinner','t-moon',32]]};
const wKcal=w=>w[5]??Math.round(DAY.target*w[4]/100);
const winTide=(ws,o,bare)=>tide(ws.map(w=>({h:toMin(w[0])/60,l:bare?'':L(w[1],w[2]),v:wKcal(w),top:bare?'':kc(wKcal(w))})),o).replace('A nap étkezései idővonalon',L('A nap étkezései idővonalon','The day’s meals on a timeline')).replace('koffein-stop',L('koffein-stop','caffeine cut-off'));
const setTop=(title,back)=>({title,sub:L('Beállítások · Fuel','Settings · Fuel'),back});
const errCard=(t,b)=>card(empty('t-info',t,btn(L('Újrapróbálás','Try again'),b,'sm')),{i:1});
const evenW=n=>Array.from({length:n},(_,i)=>[`${String(8+i*4).padStart(2,'0')}:00`,'','','',25,775]);
function beallitas(arg){
  const a=String(arg||''), ttl=setTop(L('Fuel beállítások','Fuel settings'),'mai');
  if(a==='tolt') return page('fuel',ttl,`${gHero({lbl:L('Napi ritmus','Daily rhythm'),g:winTide(evenW(4),{},1),verdict:L('Beállítások betöltése…','Loading settings…'),sub:L('Amíg töltünk, semmit nem lehet átállítani.','Nothing can be changed while this loads.')},1)}`);
  if(a==='hiba') return page('fuel',ttl,errCard(L('Nem sikerült betölteni a Fuel beállításait. A mentett értékek nem módosíthatók, amíg a betöltés nem sikerül.','Fuel settings couldn’t be loaded. The saved values can’t be changed until they load.'),'beallitas'));
  const cust=a==='egyeni'||a==='egyeni-hiba', bad=a==='egyeni-hiba', dirty=a==='modositva'||cust, pl0=a==='elonezet-tolt', pe=a==='elonezet-hiba', noWin=a==='ablak-nelkul';
  /* a hős: a mai ablakok névvel és kcal-lal — SZÁMOLHATÓ: useFuelTimeline() + placeWindows(wake, bed, mealsPerDay, blocks) + splitBudget (ugyanaz, amit az ablak-szerkesztő számol), mentett felosztásnál useSlotTemplates() + compileTemplate + splitBudgetPct.
     Tartalék arc (.ablak-nelkul), amíg az idővonal nem töltött be: N egyforma, névtelen edény, mint az élő nap-íven. A koffein-stop: useFuelSettings().caffeineCutoff. */
  const W=WREC.training_am, n=W.length, tideG=noWin?winTide(evenW(n),{stop:toMin(CSTOP)/60},1):winTide(W,{stop:toMin(CSTOP)/60});
  /* a makró-előnézet a PISZKOZATOT követi (useDietSettingsPreview): módosítva = „Alacsony szénhidrát” profil ugyanarra a keretre; egyéni = 30 / 40 / 30% */
  const G=cust?[233,310,103]:a==='modositva'?[220,232,144]:[DAY.p[1],DAY.c[1],DAY.f[1]], pct=lrPct([G[0]*4,G[1]*4,G[2]*9]), prof=cust?L('Egyéni','Custom'):a==='modositva'?L('Alacsony szénhidrát','Low carb'):L('Kiegyensúlyozott','Balanced');
  const prev=pe?`<p class="fh-note fx-warn" role="alert">${L('Az előnézet nem tölthető be.','The preview can’t be loaded.')}</p>${acts(btn(L('Előnézet újrapróbálása','Try the preview again'),'beallitas','sm ghost'))}`
    :pl0?txt(L('Előnézet számítása…','Working out the preview…'))
    :lab(`${dirty?L('Mai cél a beállítás szerint','Today’s target with this setting'):L('Mai cél alapján','From today’s target')} · ${kc(DAY.target)} kcal · ${L('aktív cél','active goal')}`)
      +vials([[L('Fehérje','Protein'),'t-meat','var(--protein)'],[L('Szénhidrát','Carbs'),'t-carb','var(--carb)'],[L('Zsír','Fat'),'t-avocado','var(--fat)']].map(([l,ic,c],i)=>({l,ic,c,p:pct[i]*1.7,v:pct[i]+'%',s:G[i]+' g'})),{h:96})
      +(dirty?note(L('Előnézet: mentésre válik élessé.','Preview: it applies when you save.')):'');
  return page('fuel',ttl,`
  ${a==='mentes-hiba'?`<p class="fc-alert" role="alert">${L('Nem sikerült minden módosítást menteni. Próbáld újra.','Not every change could be saved. Try again.')}</p>`:''}
  ${gHero({lbl:`${L('Napi ritmus','Daily rhythm')} · ${pl(n,'étkezés','meal','meals')}`,g:tideG,verdict:L(`A kereted ma ${kc(DAY.target)} kcal, négy étkezésre osztva.`,`Your budget today is ${kc(DAY.target)} kcal, split across four meals.`),
    sub:(noWin?L('Az ablakaid most töltenek; addig egyenlő részeket mutatok. ','Your windows are still loading. Until then I show equal parts. '):'')+L('A napi ív együtt mozdul a beállításaiddal. A ritmus vezet, nem korlátoz: bármelyik ablak utólag is logolható.','The day’s curve moves with your settings. The rhythm guides, it doesn’t restrict: any window can be logged later.')},1)}
  ${sec(1,L('Ritmus','Rhythm'),2)}
  ${card(`<div class="fx-two fc-ws"><div>${lab(L('Étkezés / nap','Meals per day'))}${stp(n,L('étkezés','meals'),L('Étkezés / nap (3–6)','Meals per day (3–6)'))}</div><div>${fld(L('Koffein-stop','Caffeine cut-off'),CSTOP,'','time')}</div></div>`
    +note(L('A koffein-stop a Mai sorát, a nap-tervet és a koffein-szokást is állítja.','The cut-off also sets the line on Today, the day plan and the caffeine habit.'))
    +row({icon:'t-clock',title:L('Étkezési ablakok','Meal windows'),sub:L('szerkesztése · három naptípus','edit · three day types'),on:'ablakok'})
    +note(L('Ha egy naptípushoz saját felosztást mentettél, azon a napon a léptető nem mozdítja az ábrát: a saját ablakaid érvényesek.','If you saved your own split for a day type, the stepper doesn’t move the picture on that day: your own windows apply.')),{i:2})}
  ${sec(2,L('Makrók','Macros'),3)}
  ${card(sel(L('Makróprofil','Macro profile'),prof)+prev
    +(cust?`<div class="fc-3">${[[L('Fehérje %','Protein %'),30],[L('Szénhidrát %','Carbs %'),bad?35:40],[L('Zsír %','Fat %'),30]].map(([l,v])=>`<div>${fld(l,String(v),'','number')}</div>`).join('')}</div>`
      +(bad?`<p class="fh-note fx-bad" role="alert">${L('Az arányoknak 100%-ra kell összegződniük.','The shares must add up to 100%.')}</p>`:'')
      +note(L('A fehérje-cél g/kg alapon védett; az eltérést a szénhidrát nyeli el.','The protein target is protected per kg of body weight. Carbs absorb the difference.')):''),{cls:'fu-mac',i:3})}
  ${sec(3,L('Célok','Targets'),4)}
  ${card(`<div class="fx-two"><div>${fld(L('Víz-cél (ml)','Water target (ml)'),'2500','','number')}</div><div>${fld(L('Rost-cél (g)','Fibre target (g)'),String(DAY.fib[1]),'','number')}</div></div>`,{i:4})}
  ${sec(4,L('Finomhangolás','Fine-tuning'),5)}
  ${card(lab(L('Fehérje-szint','Protein level'))+pick([L('Alacsony','Low'),L('Mérsékelt','Moderate'),L('Magas','High')],L('Magas','High'),L('Fehérje-szint','Protein level'))
    +note(L('A testsúlyod és a zsírmentes tömeged szerinti számítást is állítja; a cél a kettő közül a nagyobb, egy felső korláttal. Mentés után a Makrók előnézete rögtön a választott szint szerinti grammot mutatja.','It adjusts both the body-weight and the lean-mass calculation. The target is the higher of the two, with a cap. After saving, the Macros preview shows the grams for the level you chose.'))
    +row({icon:'t-lens',title:L('Tanulás a súlyomból és az evésemből','Learn from your weight and food'),sub:L('hetente megtanulom, mennyi energiát használsz valójában','each week Mezo learns how much energy you really use'),right:sw(true,L('Tanulás a súlyomból és az evésemből','Learn from your weight and food'))}),{i:5})}`,
  {foot:(dirty&&!bad?btn(L('Kilépés','Leave'),{sheet:'guard'},'ghost'):'')+(bad?`<button class="btn" disabled>${L('Mentés','Save')}</button>`:btn(L('Mentés','Save'),{toast:dirty?L('Mentve · A keret +60 kcal-lal változott','Saved · Your budget changed by +60 kcal'):L('Mentve','Saved')}))});
}
/* a szerkesztő sorai (SlotTemplateRow): [név HU, EN, fajta, szerep, horgony, idő | eltolás perc, rész %] */
const ANCH=[['fixed','Fix időpont','Fixed time'],['wake','Ébredés után','After waking'],['training_start','Edzés kezdete körül','Around training start'],['training_end','Edzés vége után','After training ends'],['bed','Lefekvés előtt','Before bed']];
const WKIND=[['breakfast','Reggeli','Breakfast','t-sun'],['lunch','Ebéd','Lunch','t-bowl'],['dinner','Vacsora','Dinner','t-moon'],['snack','Uzsonna','Snack','t-snack']];
function ablakok(arg){
  const a=String(arg||''), ttl=setTop(L('Étkezési ablakok','Meal windows'),'beallitas');
  if(a==='tolt') return page('fuel',ttl,`${gHero({lbl:L('Étkezési ablakok','Meal windows'),g:winTide(evenW(4),{},1),verdict:L('Beállítások betöltése…','Loading settings…'),sub:L('Amíg töltünk, a Testreszabás nem indítható.','Customise can’t be started while this loads.')},1)}`);
  if(a==='betolt-hiba') return page('fuel',ttl,errCard(L('Nem sikerült betölteni az étkezési ablakok beállításait. A mentett rendet addig nem lehet felülírni.','Meal windows couldn’t be loaded. The saved plan can’t be overwritten until they load.'),'ablakok'));
  const dt=a==='reggeli'?'training_am':a==='esti'?'training_pm':'rest', edit=!['','reggeli','esti'].includes(a), saved=['mentett','ertekel','olvasat','olvasat-igazit','olvasat-nincs'].includes(a), bad=a==='hiba', warn=a==='figyel';
  const days=`<div class="fh-seg fc-days" role="tablist" aria-label="${L('Naptípusok','Day types')}">${DTYPES.map(([k,hu,en],i)=>`<button role="tab" aria-selected="${k===dt}" class="${k===dt?'on':''}" data-go="ablakok${['','.reggeli','.esti'][i]}">${L(hu,['Rest','Morning','Evening'][i])}</button>`).join('')}</div>`;
  const R=WREC[dt], dtn=DTYPES.find(d=>d[0]===dt);
  if(!edit){
    /* ajánlott felosztás (placeWindows + splitBudget): a mai nap típusánál a valódi edzésblokkból, a többinél egy mintanapból (edzés 07:00-kor / 18:00-kor); horgonya nincs, az csak a saját felosztásnak van */
    const why=dt==='rest'?L('Edzés nélküli napra számolva. Az edény szintje az ablak kalória-része.','Worked out for a day without training. Each vessel’s level is that window’s share of calories.')
      :dt==='training_am'?L(`A mai napod edzésblokkjából számolva (${DAY.train.label} · ${DAY.train.start}). Az edény szintje az ablak kalória-része.`,`Worked out from today’s training block (${DAY.train.label} · ${DAY.train.start}). Each vessel’s level is that window’s share of calories.`)
      :L('Egy mintanapból számolva (edzés 18:00-kor). Az edény szintje az ablak kalória-része.','Worked out from a sample day (training at 18:00). Each vessel’s level is that window’s share of calories.');
    return page('fuel',ttl,`
  ${gHero({lbl:L('Ajánlott felosztás · Σ 100%','Recommended split · Σ 100%'),g:winTide(R,{}),verdict:L(`${dtn[1]}: négy ablak osztja el a napot.`,`${dtn[2]}: four windows split the day.`),sub:why,body:`<div style="margin-top:12px">${days}</div>`,acts:btn(L('Testreszabás','Customise'),'ablakok.szerk')},1)}
  ${sec(1,L('Ablakok','Windows'),2)}
  ${card(R.map(w=>step({time:w[0],icon:w[3],title:L(w[1],w[2]),right:`<span class="fx-kv"><b>${kc(wKcal(w))}</b> kcal<small>${w[4]}%</small></span>`})).join('')
    +note(L('Ez az ajánlás. A Testreszabás ebből indul; utána a nevet, a típust, az időt és a részeket is átírhatod.','This is the recommendation. Customise starts from it. After that you can change the names, types, times and shares.')),{i:2})}`);
  }
  /* szerkesztés: a fork a pihenőnap ajánlásából indul (fix időpontok); a mentett felosztásban van ébredéshez / lefekvéshez kötött sor is. Σ ≠ 100 → hiba, a Mentés és a „Mezo értékelése” tiltva. */
  const rows=saved?[['Reggeli','Breakfast','breakfast','','wake',45,25],['Ebéd','Lunch','lunch','','fixed','12:30',30],['Uzsonna','Snack','snack','','fixed','16:00',15],['Vacsora','Dinner','dinner','','bed',-180,30]]
    :R.map((w,i)=>[bad&&i===2?'':w[1],bad&&i===2?'':w[2],WKIND[[0,1,3,2][i]][0],'','fixed',w[0],bad&&i===3?20:warn?[15,20,10,55][i]:w[4]]);
  const sum=rows.reduce((s,r)=>s+r[6],0), tOf=r=>r[4]==='fixed'?r[5]:r[4]==='wake'?'07:15':r[4]==='bed'?'20:00':'16:00';
  const comp=rows.map(r=>[tOf(r),r[0],r[1],WKIND.find(k=>k[0]===r[2])[3],r[6],Math.round(DAY.target*r[6]/100)]);
  const ev=a==='ertekel', vd=a==='olvasat'||a==='olvasat-igazit', adj=a==='olvasat-igazit', deg=a==='olvasat-nincs';
  const rowEd=r=>{const kd=WKIND.find(k=>k[0]===r[2]), nm=L(r[0],r[1]);return `<div class="fx-win"><div class="fx-wh">${bub(kd[3],{s:40})}<input class="fh-in" value="${esc(nm)}" maxlength="40" placeholder="${L('Ablak neve','Window name')}" aria-label="${L('Ablak neve','Window name')}"><button class="fx-add" data-toast="${L('Ablak törölve','Window removed')}" aria-label="${nm?L(`${esc(nm)} törlése`,`Delete ${esc(nm)}`):L('Névtelen ablak törlése','Delete the unnamed window')}">×</button></div>
    ${pick(WKIND.map(k=>L(k[1],k[2])),L(kd[1],kd[2]),L('Típus','Type'))}
    <div style="margin-top:8px">${pick([roleT(''),roleT('pre'),roleT('post')],roleT(r[3]),L('Szerep','Role'))}</div>
    <div class="fc-anch"><div>${sel(L('Horgony','Anchor'),L(...ANCH.find(x=>x[0]===r[4]).slice(1)))}</div><div>${r[4]==='fixed'?fld(L('Időpont','Time'),r[5],'','time'):lab(L('Eltolás (perc)','Offset (min)'))+stp(r[5]>0?'+'+r[5]:String(r[5]).replace('-','−'),L('perc','min'),L('Eltolás','Offset'))}</div><div>${fld(L('Rész %','Share %'),String(r[6]),'','number')}</div></div></div>`};
  return page('fuel',ttl,`
  ${a==='mentes-hiba'?`<p class="fc-alert" role="alert">${L('Nem sikerült menteni. A módosításaid megmaradtak.','Couldn’t save. Your changes are still here.')}</p>`:''}
  ${gHero({lbl:`${saved?L('Saját felosztás','Your own split'):L('Testreszabás','Customising')} · Σ ${sum}%`,g:winTide(comp,{}),warn:bad,verdict:bad?L('A részek összege 90%: így nem menthető.','The shares add up to 90%, so it can’t be saved.'):saved?L('Pihenőnapra a saját felosztásod érvényes.','On rest days your own split applies.'):L(`A részek összege ${sum}%: menthető.`,`The shares add up to ${sum}%: ready to save.`),
    sub:(saved||bad?'':L('Állítsd át a nevet, a típust, az időt vagy a részt. ','Change the name, the type, the time or the share. '))+L('Az edények szintje a kalória-rész; a részeknek együtt 100%-ot kell adniuk.','Each level is a share of calories. Together the shares must make 100%.'),body:`<div style="margin-top:12px">${days}</div>`},1)}
  ${sec(1,`${L('Ablakok','Windows')} · ${rows.length}`,2)}
  ${card(rows.map(rowEd).join('')+acts(btn(L('+ Új ablak','+ New window'),{toast:L('Új ablak · Uzsonna · 16:00 · 10%','New window · Snack · 16:00 · 10%')},'sm ghost')),{i:2})}
  ${sec(2,L('Így áll össze','How it adds up'),3)}
  ${card(`<p class="fc-sum"><span>${L('A részek összege','Sum of the shares')}</span><b class="${sum===100?'':'off'}">${sum}%</b></p>`
    +comp.map(w=>`<p class="fx-wv"><span class="fc-wt">${w[0]} · ${L(w[1],w[2])||'—'}</span>${level(w[4]*2.4,{h:10})}<span><b>${kc(w[5])}</b> kcal · ${L(`${Math.round(DAY.p[1]*w[4]/100)} g fehérje`,`${Math.round(DAY.p[1]*w[4]/100)} g protein`)}</span></p>`).join('')
    +(bad?`<p class="fh-note fx-bad" role="alert">${L('A részek összege 90%: 100% kell.','The shares add up to 90%. They need to make 100%.')}</p><p class="fh-note fx-bad" role="alert">${L('Van egy névtelen étkezési ablak: adj neki nevet.','One meal window has no name. Give it one.')}</p>`:'')
    +(warn?`<p class="fh-note fx-warn">${L('A nap utolsó harmadára esik a napi keret nagy része.','Most of the day’s budget falls in the last third of the day.')}</p>`:''),{i:3})}
  ${sec(3,L('Mezo véleménye','Mezo’s view'),4)}
  ${card((ev?`<p class="fc-busy">${bub('t-score',{s:28})}${L('Mezo értékeli a felosztást…','Mezo is reading the split…')}</p>`
      :vd?`<div class="fc-vd"><div>${bub('t-score',{s:34})}<span>${L('Mezo · olvasat','Mezo · reading')}</span>${st(adj?L('érdemes igazítani','worth adjusting'):L('rendben','fine'),adj?'warn':'ok')}</div><p>${adj?L('A vacsora a nap harmada, közel a lefekvéshez; az uzsonna kicsi egy edzés előtti ablaknak.','Dinner is a third of the day and close to bedtime. The snack is small for a pre-training window.'):L('Egyenletes felosztás: a fehérje négy részre oszlik, és a vacsora után marad idő lefekvésig.','An even split: protein is spread over four parts, and there is time between dinner and bed.')}</p>${adj?`<p><b>${L('Vacsora','Dinner')}:</b> ${L('vigyél át 5%-ot az ebédre.','move 5% over to lunch.')}</p><p><b>${L('Uzsonna','Snack')}:</b> ${L('edzés előtt 15–20% jobban tart.','15–20% holds better before training.')}</p>`:''}</div>`
      :deg?`<p class="fh-note fx-warn">${L('Mezo véleménye most nem elérhető. A számok ellenőrzése így is működik.','Mezo’s view isn’t available right now. The numbers are still checked.')}</p>`:'')
    +acts(bad||ev?`<button class="btn sm ghost" disabled>${L('Kérd Mezo véleményét','Ask Mezo')}</button>`:btn(L('Kérd Mezo véleményét','Ask Mezo'),'ablakok.ertekel','sm ghost'))
    +note(L('Vélemény a mostani felosztásról; a mentést nem állítja meg. Ha átírsz egy sort, újra kell kérned.','An opinion on the current split. It never blocks saving. If you change a row, ask again.'))
    +(saved?acts(lk(L('Ajánlott visszaállítása','Back to the recommended split'),'ablakok')):''),{i:4})}`,
  {foot:btn(L('Mégse','Cancel'),{sheet:'guard'},'ghost')+(bad?`<button class="btn" disabled>${L('Mentés','Save')}</button>`:btn(L('Mentés','Save'),'beallitas'))});
}
/* ═══ LAPOK — C terület (Konyha · Beállítások) ═══
   add[:edit|<id> · lock|<id> · supp] → AddPantryItemSheet · import[:link · keres · vazlat · bizonytalan · nincs · hiba] → ImportItemSheet · catalog[:ures] → CatalogSearchSheet · catfilter[:2] → CategoryFilterSheet ·
   reclogs:<id> → a recept MAI logjai (RecipeLogsList) · thread → a Műhely beszélgetése · ingpick[:van · kor · csere] → IngredientPickerSheet (a szerkesztő és a Műhely választója) · guard → UnsavedChangesGuard */
const sheetsC={
  add:a=>{const [m,id]=String(a||'').split('|'), k=id?kById(id):null, ed=m==='edit'||m==='lock', lock=m==='lock', supp=m==='supp'||!!(k&&k.k!=='food'&&!hasM(k)), dis=lock?' disabled':'';
    const f=(l,v,ph)=>`<div>${lab(l)}<input class="fh-in"${dis} value="${esc(v==null?'':String(v))}" placeholder="${esc(ph||'')}" aria-label="${esc(l)}" inputmode="decimal"></div>`;
    const sl=(l,v)=>lock?`<div>${lab(l)}<button class="fh-in fx-sel" disabled><span>${v}</span><i>▾</i></button></div>`:`<div>${sel(l,v)}</div>`;
    return `${sh('t-journal',ed?L('Tétel szerkesztése','Edit item'):L('Új kamra-tétel','New pantry item'),ed?(k?k.n:''):L('kézi felvétel','by hand'))}
    <div class="fx-two">${sl(L('Típus','Type'),k?cap(kindL(k.k)):supp?L('Kiegészítő','Supplement'):L('Étel','Food'))}${sl(L('Kategória','Category'),k&&k.cat?catL(k.cat):L('— nincs —','— none —'))}</div>
    ${lab(L('Név','Name'))}<input class="fh-in"${dis} value="${esc(k?k.n:'')}" placeholder="${L('pl. Görög joghurt 10%','e.g. Greek yoghurt 10%')}" aria-label="${L('Név','Name')}">
    ${sl(L('Forrás','Source'),k?srcN(k):L('Saját bevitel','Own entry'))}
    ${lock?`<p class="fh-note fx-warn">${L('Közös katalógus-tétel: az adatait csak a szerző vagy a tulajdonos szerkesztheti. Az ár és a dózis a tiéd.','A shared catalogue item: only its author or the owner can edit its data. The price and the dose are yours.')}</p>`:''}
    ${supp?`${lab(L('Dózis','Dose'))}<input class="fh-in" value="${esc(k&&k.dose||'')}" placeholder="${L('pl. 5 g','e.g. 5 g')}" aria-label="${L('Dózis','Dose')}">`
      :`${lab(L('Makrók · 100 g-ban','Macros · per 100 g'))}<div class="fc-4">${f('kcal',k&&k.kcal,'119')}${f(L('Fehérje','Protein'),k&&k.p!=null?fmt(k.p):null,'6')}${f(L('Szénhidrát','Carbs'),k&&k.c!=null?fmt(k.c):null,'4')}${f(L('Zsír','Fat'),k&&k.f!=null?fmt(k.f):null,'9')}</div>
      ${lab(L('Tápanyag · 100 g-ban','Nutrients · per 100 g'))}<div class="fc-4">${f(L('Rost','Fibre'),null,'0')}${f(L('Cukor','Sugar'),k&&k.sug!=null?fmt(num(k.sug)):null,'0')}${f(L('Tel. zsír','Sat. fat'),k&&k.sat!=null?fmt(num(k.sat)):null,'0')}${f(L('Só','Salt'),k&&k.salt!=null?fmt(num(k.salt)):null,'0')}</div>`}
    ${lab(L('Ár (Ft)','Price (Ft)'))}<input class="fh-in" value="${k&&k.price?k.price[0]:''}" placeholder="750" aria-label="${L('Ár (Ft)','Price (Ft)')}" inputmode="decimal">
    ${acts((ed?`<button class="btn sm" data-close data-toast="${L('Mentve','Saved')}">${L('Mentés','Save')}</button>`:`<button class="btn sm" disabled>${L('Polcra','Add to shelf')}</button>`)+closeLk(L('Mégse','Cancel')))}
    ${ed?'':note(L('A Polcra gomb akkor él, ha a tételnek van neve.','You can add it once it has a name.'))}`},
  import:a=>{const link=a==='link', photo=!link, head=`${sh('t-camera',L('Új tétel a kamrába','New pantry item'),L('Import · fotó és link','Import · photo and link'))}
    ${txt(L('Fotózd le a termék címkéjét, vagy illeszd be egy termékoldal linkjét. A nevet, a makrókat és a tápértékeket Mezo olvassa ki.','Photograph the product label or paste a product page link. Mezo reads out the name, macros and nutrients.'))}
    <div class="fh-seg" style="margin:10px 0"><button class="${photo?'on':''}" data-sheet="import" data-arg="">${L('Fotó','Photo')}</button><button class="${link?'on':''}" data-sheet="import" data-arg="link">Link</button></div>`;
    const drop=(t,s,has)=>`<button class="fx-ph fc-drop ${has?'has':''}" data-toast="${L('Kamera','Camera')} · ${esc(t)}" aria-label="${esc(t)}">${bub('t-camera',{s:40})}<span><strong>${t}</strong><small>${has?'✓ cimke.jpg':s}</small></span></button>`;
    if(a==='keres') return `${head}<div class="fc-busy big">${bub('t-camera',{s:48})}<strong>${L('Beolvasás…','Reading the photo…')}</strong><small>${L('fotó','photo')}</small></div>`;
    if(a==='nincs') return `${head}${empty('t-camera',L('Nem találtam használható adatot a fotón. Próbáld élesebb képpel, adj hozzá előlap fotót (név, márka), vagy vidd fel kézzel.','I found nothing usable in the photo. Try a sharper one, add a front photo (name, brand), or enter it by hand.'))}
      ${acts(btn(L('Vissza','Back'),{sheet:'import'},'sm ghost')+`<button class="btn sm" disabled>${L('Polcra','Add to shelf')}</button>`)}`;
    if(a==='vazlat'||a==='bizonytalan'){const un=a==='bizonytalan';return `${head}
      ${lab(`${L('Polcra kerül · 100 g-ra','Going on the shelf · per 100 g')} · ${L('fotó','photo')}`)}
      ${fld(L('Név','Name'),un?'':'Skyr · epres','')}${sel(L('Kategória','Category'),L('Tejtermék','Dairy'))}
      <div class="fu-lnm" style="margin-top:10px">${[['kcal','var(--dom)','62'],[L('feh.','prot.'),'var(--protein)','9 g'],[L('szénh.','carbs'),'var(--carb)',fmt(5.2)+' g'],[L('zsír','fat'),'var(--fat)',un?'—':fmt(.2)+' g']].map(([l,c,v])=>`<span style="--c:${c}"><i></i><b>${v}</b><small>${l}</small></span>`).join('')}</div>
      ${nutri([null,5,.1,un?null:.1])}
      ${un?`<p class="fh-note fx-warn">${L('Mezo nem teljesen biztos a számokban: ellenőrizd őket mentés előtt.','Mezo isn’t fully sure about the numbers. Check them before you save.')}</p>${acts(lk(L('+ előlap fotó (név, márka)','+ front photo (name, brand)'),{toast:L('Kamera · az előlap','Camera · the front')}))}`:''}
      ${acts(btn(L('Vissza','Back'),{sheet:'import'},'sm ghost')+(un?`<button class="btn sm" disabled>${L('Polcra','Add to shelf')}</button>`:`<button class="btn sm" data-close data-toast="${L('A polcra került','It’s on your shelf')}: Skyr · epres">${L('Polcra','Add to shelf')}</button>`))}
      ${un?note(L('A Polcra gomb akkor él, ha a tételnek van neve.','You can add it once it has a name.')):''}`}
    if(link) return `${head}${fld(L('Termékoldal linkje','Product page link'),'','https://…')}
      ${note(L('Illeszd be egy termékoldal linkjét (pl. myprotein.hu, gymbeam.hu). Ha az oldalon nincs tápérték, kézzel viheted fel.','Paste a product page link (e.g. myprotein.hu, gymbeam.hu). If the page has no nutrition values, you can enter them by hand.'))}
      ${acts(`<button class="btn sm" disabled>${L('Beolvasás','Read it')}</button>`+closeLk(L('Mégse','Cancel')))}`;
    return `${head}${drop(L('Címkefotó','Label photo'),L('a tápérték-táblázat','the nutrition table'),a==='hiba')}
      <div style="height:8px"></div>${drop(L('Előlap fotó','Front photo'),L('nem kötelező; ha a név nem látszik a címkén','optional; if the name isn’t on the label'))}
      ${a==='hiba'?`<p class="fh-note fx-bad" role="alert">${L('A fotó beolvasása nem sikerült. Próbáld élesebb képpel, vagy vidd fel kézzel.','The photo couldn’t be read. Try a sharper one or enter it by hand.')}</p>`:''}
      ${note(L('Mezo a makrókat 100 g-ra olvassa ki. A fotó nem kerül tárolásra. Egy kép legfeljebb 5 MB lehet.','Mezo reads the macros per 100 g. The photo is not stored. An image can be 5 MB at most.'))}
      ${acts((a==='hiba'?btn(L('Beolvasás','Read it'),{sheet:'import',arg:'keres'},'sm'):`<button class="btn sm" disabled>${L('Beolvasás','Read it')}</button>`)+closeLk(L('Mégse','Cancel')))}`},
  catalog:a=>`${sh('t-stack',L('Hozzáadás a közösből','Add from the shared catalogue'),L('közös katalógus','shared catalogue'))}${a==='ures'?srch('','quinoa'):`<div class="fx-srch" data-toast="${L('Keresés','Search')}">${bub('t-lens',{s:28})}${L('Keresés név vagy márka szerint','Search by name or brand')}</div>`}<div style="margin:10px 0 4px">${pick([L('Mind','All'),...['food','supp','stim','med'].map(k=>L(KINDL[k][2],KINDL[k][3]))],L('Mind','All'),L('Szűrő','Filter'))}</div>
    ${a==='ures'?empty('t-stack',L('Nincs találat a közös katalógusban.','Nothing found in the shared catalogue.')):[['Skyr natúr','Ehrmann · 63 kcal/100 g','Anna',0,'t-protein'],['Bulgur','Kifli · 342 kcal/100 g','Mezo',1,'t-carb'],['Kreatin-monohidrát','MyProtein','Béla',1,'t-supps'],['Zabital · barista','Oatly · 59 kcal/100 ml','Mezo',0,'t-carb']].map(([n,s,au,on,ic])=>row({icon:ic,title:n,sub:`${s}<br>${L('felvette','added by')}: ${au}`,right:on?st(L('a polcon','on the shelf'),'q'):btn(L('+ Polcra','+ Add'),{toast:L('A polcra került','It’s on your shelf')+': '+n},'sm ghost')})).join('')}${acts(closeLk())}`,
  catfilter:a=>{const two=a==='2', cats=[...new Set(KALL.map(k=>k.cat).filter(Boolean))].map(c=>[c,KALL.filter(k=>k.cat===c).length]).sort((x,y)=>y[1]-x[1]), on=two?['Fehérje','Tejtermék']:[], n=two?KALL.filter(k=>on.includes(k.cat)).length:KALL.length;
    return `${sh('t-lens',L('Mit mutassak?','What should I show?'),L('kategória-szűrő','category filter'))}<div class="fh-pills" data-fmulti>${cats.map(([c,m])=>`<button class="fh-pill ${on.includes(c)?'on':''}">${catL(c)}<b>${m}</b></button>`).join('')}</div>
    ${acts(`<button class="btn sm" data-close>${L(`Szűrés · ${n} tétel`,`Filter · ${nItem(n)}`)}</button>`+(two?lk(L('2 kiválasztva · törlés','2 selected · clear'),{sheet:'catfilter'}):`<button class="fh-lk" disabled>${L('0 kiválasztva','0 selected')}</button>`))}`},
  reclogs:id=>{const r=REC.find(x=>x.id===id), logs=r?r.today.map(m=>mealOf(m)).filter(Boolean):[];
    return `${sh('t-journal',r?r.n:L('Recept','Recipe'),L('Recept · mai logok','Recipe · today’s logs'))}
    ${logs.length?logs.map(m=>{const d=m.score==null||r.score==null?null:Math.round((m.score-r.score)*10)/10;return `<div class="fc-log"><div>${bub('t-plate',{s:38})}<span class="g"><strong>${mealTitle(m)}</strong><small>${L('ma','today')} ${m.time}</small></span>${m.score==null?st(L('folyamatban','in progress'),'q'):`<span class="v">${fmt(m.score)}</span>`}</div>
      ${d==null?'':`<p>${d===0?L('Ugyanannyi pont, mint a recepté.','The same score as the recipe.'):L(`${d>0?'+':'−'}${fmt(Math.abs(d))} pont a recept értékeléséhez képest.`,`${d>0?'+':'−'}${fmt(Math.abs(d))} points against the recipe’s rating.`)}</p>`}
      <div class="fu-lnm">${[['kcal','var(--dom)',kc(m.kcal)],[L('feh.','prot.'),'var(--protein)',m.macro[0]+' g'],[L('szénh.','carbs'),'var(--carb)',m.macro[1]+' g'],[L('zsír','fat'),'var(--fat)',m.macro[2]+' g']].map(([l,c,v])=>`<span style="--c:${c}"><i></i><b>${v}</b><small>${l}</small></span>`).join('')}</div></div>`}).join('')
      +note(L('Csak a mai logok látszanak itt. A korábbiak a Trendek oldalon.','Only today’s logs show here. Earlier ones are on Trends.'))
      :empty('t-journal',L('Még nem logoltad ma ezt a receptet. Amint felírod egy étkezésbe, itt látod a pontszámát.','You haven’t logged this recipe today. Once it’s in a meal, its score shows here.'))}
    ${acts(closeLk())}`},
  thread:()=>`${sh('t-chef',L('Amiről eddig beszéltünk','What we’ve said so far'),L('Műhely · beszélgetés','Workshop · conversation'))}
    ${[[1,L('Alakítsd át magas fehérjetartalmúra.','Make it high in protein.')],[0,L('Csirkemellet és rizst javaslok, két adagra. A számokat a kamrádból vettem.','I suggest chicken breast and rice, for two servings. The numbers are from your pantry.')],[1,L('Rizs helyett legyen bulgur, és kerüljön bele paprika is.','Use bulgur instead of rice, and add some pepper too.')],[0,WLAST()]].map(([me,t])=>`<div class="fc-bub ${me?'me':''}"><small>${me?L('TE','YOU'):L('MŰHELY','WORKSHOP')}</small><p>${t}</p></div>`).join('')}${acts(closeLk())}`,
  ingpick:a=>{const csere=a==='csere', kor=a==='kor', added=a==='van'?['csirke','bulgur']:[];
    return `${sh('t-stack',L('Válassz hozzávalót','Pick an ingredient'),csere?L('Kamra · csere a becsült sor helyett','Pantry · swap for the estimated line'):kor?L('Kamra · a következő körbe','Pantry · for the next round'):L('Kamra · hozzávaló','Pantry · ingredient'))}<div class="fx-srch" data-toast="${L('Keresés a kamrában','Search the pantry')}">${bub('t-lens',{s:28})}${L('Keress a kamrában…','Search the pantry…')}</div>
    ${KAM.filter(k=>hasM(k)).filter((k,i)=>csere?/Zöldség/.test(k.cat):i<4||k.id==='bulgur'||k.id==='whey').map(k=>{const on=added.includes(k.id);return irow({icon:kic(k),title:k.n,sub:`<span class="fu-tags">${k.k==='food'?'':`<em>${cap(kindL(k.k))}</em>`}<em>${srcM(k)}</em><em>${[k.b,'NOVA '+k.nv].join(' · ')}</em></span>`,
      v:`<span class="fu-pk2"><span>${k.kcal}<small>kcal /100 ${k.u||'g'}</small></span><button class="fx-add ${on?'on':''}" ${on?'disabled':csere?'data-close':''} data-toast="${csere?L('Kicserélve','Swapped'):L('Hozzáadva','Added')}: ${esc(k.n)}" aria-label="${on?L(`${esc(k.n)} hozzáadva`,`${esc(k.n)} added`):L(`${esc(k.n)} hozzáadása`,`Add ${esc(k.n)}`)}">${on?I('i-check'):'+'}</button></span>`,l2:m3(k.p,k.c,k.f)})}).join('')}
    ${note(csere?L('Egy koppintás kicseréli a sort, és bezárja a lapot.','One tap swaps the line and closes this.'):L('Többet is felvehetsz egymás után; a lap nyitva marad.','You can add several in a row. This stays open.'))}${acts(closeLk(L('Kész','Done')))}`},
  guard:()=>`${sh('t-info',L('Nem mentett módosítások','Unsaved changes'),'')}${txt(L('A módosításaid elvesznek, ha most elhagyod az oldalt.','Your changes will be lost if you leave the page now.'))}
    ${acts(`<button class="btn sm" data-close>${L('Maradok, folytatom','Stay and keep going')}</button>`+`<button class="fh-lk" data-go="${F.R==='ablakok'?'beallitas':'mai'}">${L('Elvetem, kilépek','Discard and leave')}</button>`)}`,
};

/* ═══ HOGY TANULTAM? (LearningPage + LearningHistoryChart + LearningDaysList + LearnedBaseExplainer) ═══
   Állapotok: tanulas (tanul, van heti összegző) · tanulas.var (ezen a héten várt) · tanulas.ki (kikapcsolva: a keret a képletből jön) · tanulas.ures (még nincs elég adat) · tanulas.tolt · tanulas.hiba */
const CONF=[['Még tanulok','Still learning'],['Közepesen biztos','Fairly sure'],['Biztos','Sure']];
const DST={usable:['számít','counts'],suspicious:['hiányosnak tűnt','looked incomplete'],confirmed_complete:['te jelölted teljesnek','you marked it complete'],marked_incomplete:['te jelölted hiányosnak','you marked it incomplete'],unlogged:['nincs felírva','not logged']};
const dCounts=s=>s==='usable'||s==='confirmed_complete';
/* a legutóbbi lezárt hét (szept. 28 – okt. 4.) — a heti összegző, a „Hétről hétre” utolsó sora és a hat lépés ugyanebből a rekordból beszél */
const LW={r:[9,28,10,4],base:2480,formula:2400,start:2420,step:60,sd:150,conf:1,usable:LD.filter(d=>d[1]>=928&&d[1]<=1004&&dCounts(d[3])).length,weigh:4,
  excluded:LD.filter(d=>d[1]>=928&&d[1]<=1004&&(d[3]==='suspicious'||d[3]==='marked_incomplete'))};
const ldDate=d=>dW(d[0],Math.floor(d[1]/100),d[1]%100);
function learnSvg(){
  const W=336,H=160,Lx=30,R=8,T0=10,B=24,n=WK.length,x=i=>Lx+(W-Lx-R)*(i+.5)/n,lo=2250,hi=2650,y=v=>T0+(H-T0-B)*(1-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo));
  const runs=[];{let run=[];WK.forEach((w,i)=>{if(w)run.push({w,i});else{if(run.length)runs.push(run);run=[]}});if(run.length)runs.push(run)}
  const line=get=>runs.map(r=>smooth(r.map(({w,i})=>[x(i),y(get(w))]))).join('');
  const band=runs.map(r=>`<path class="band" d="${r.map(({w,i},k)=>`${k?'L':'M'}${x(i).toFixed(1)} ${y(w[2]+w[3]).toFixed(1)}`).join('')}${r.slice().reverse().map(({w,i})=>`L${x(i).toFixed(1)} ${y(w[2]-w[3]).toFixed(1)}`).join('')}Z"/>`).join('');
  const cw=(W-Lx-R)/n, wl=w=>dS(...w[0]);
  return `<svg class="fh-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L(`A keret alapja hétről hétre, ${n} hét: szaggatott a képlet, folytonos a tanult keret-alap, körülötte a bizonytalanság sávja`,`The base of your budget week by week, ${n} weeks: dashed is the formula, solid is the learned base, with the band of uncertainty around it`)}">
    ${[2300,2400,2500,2600].map(v=>`<line class="grid" x1="${Lx}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${Lx-4}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end">${v}</text>`).join('')}
    ${band}${WK.map((w,i)=>w?'':`<rect class="gap" x="${(x(i)-8).toFixed(1)}" y="${T0}" width="16" height="${H-T0-B}" rx="8"/><text x="${x(i).toFixed(1)}" y="${T0+(H-T0-B)/2}" text-anchor="middle" transform="rotate(-90 ${x(i).toFixed(1)} ${T0+(H-T0-B)/2})">${L('nincs adat','no data')}</text>`).join('')}
    <path class="thin dash" d="${line(w=>w[1])}"/><path class="tr" d="${line(w=>w[4])}"/>
    ${WK.map((w,i)=>w?`<circle class="${i===n-1?'end':w[5]?'hold':'raw'}" cx="${x(i).toFixed(1)}" cy="${y(w[4]).toFixed(1)}" r="${i===n-1?4.5:3}"/>`:'').join('')}
    ${[0,4,8,11].map(i=>`<text x="${x(i).toFixed(1)}" y="${H-5}" text-anchor="middle">${WK[i]?wl(WK[i]):dS(7,27)}</text>`).join('')}
    ${WK.map((w,i)=>`<rect x="${(x(i)-cw/2).toFixed(1)}" y="0" width="${cw.toFixed(1)}" height="${H}" fill="transparent" style="cursor:pointer" data-toast="${w?L(`${wl(w)} hete: képlet ${kc(w[1])} · tanult ${kc(w[2])} ± ${w[3]} · a keret alapja ${kc(w[4])}${w[5]?' · ezen a héten vártam':''}`,`Week of ${wl(w)}: formula ${kc(w[1])} · learned ${kc(w[2])} ± ${w[3]} · base of the budget ${kc(w[4])}${w[5]?' · I waited this week':''}`):L('Erről a hétről nincs sorom: kevés volt a felírás és a mérlegelés, ezért nem tippelek számot.','I have no row for this week: there were too few logs and weigh-ins, so I do not guess a number.')}"/>`).join('')}</svg>`;
}
/* az állapot napjai: „var” = a legutóbbi héten csak 3 teljes nap; „ures” = 6 felírt nap (a 10-ből), a többi felírás nélkül */
const ldFor=a=>a==='var'?LD.map(d=>d[1]===1003?[d[0],d[1],null,'unlogged']:d[1]===929?[d[0],d[1],1210,'suspicious']:d):a==='ures'?LD.map(d=>[1006,1004,1002,930,927,924].includes(d[1])?d:[d[0],d[1],null,'unlogged']):LD;
function tanulas(arg){
  const emp=arg==='ures', off=arg==='ki', hold=arg==='var', LDX=ldFor(arg);
  const ttl={title:L('Hogy tanultam?','How I learned'),sub:L('Fuel · energiaigény','Fuel · energy need'),back:'mai'};
  if(arg==='tolt'||arg==='hiba') return page('fuel',ttl,`${gHero({lbl:L('Tanult alap','Learned base'),g:`<div class="fu-need"><span>${level(0,{h:18})}</span></div>`,verdict:arg==='tolt'?L('Betöltöm, hogyan tanultam…','Loading how I learned…'):L('Most nem sikerült betölteni, hogyan tanultam.','How I learned could not be loaded just now.'),acts:arg==='hiba'?btn(L('Újrapróbálom','Try again'),'tanulas','sm'):''},1)}`);
  const cert=`${L(...CONF[LW.conf])} · ±${LW.sd} kcal`;
  const bg=bandG({lo:2200,hi:2760,a:LW.base-LW.sd,b:LW.base+LW.sd,v:LW.base,vl:`${kc(LW.base)} kcal`,tick:LW.formula,tl:L(`képlet ${kc(LW.formula)}`,`formula ${kc(LW.formula)}`),al:'−'+LW.sd,bl:'+'+LW.sd,label:L(`Tanult alap ${kc(LW.base)} kcal, ±${LW.sd} kcal sávban; a képlet ${kc(LW.formula)}`,`Learned base ${kc(LW.base)} kcal, in a ±${LW.sd} kcal band; the formula says ${kc(LW.formula)}`)});
  /* üres arc: a két feltétel szintje számolható (useIntakeDays az utolsó 28 napra + a heti mérlegelések); a lap ma csak a mondatot írja ki */
  const h=emp?gHero({lbl:L('Tanult alap','Learned base'),g:`<div class="fu-need"><span><small>${L('Felírt nap az utolsó 4 hétben','Logged days in the last 4 weeks')}</small>${level(60,{h:18,val:'6 / 10'})}</span><span><small>${L('Mérlegelés ezen a héten','Weigh-ins this week')}</small>${level(50,{h:18,val:'1 / 2'})}</span></div>`,verdict:L('Még nem tanultam.','I have not learned yet.'),sub:L('Ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.','This needs at least 10 logged days in the last 4 weeks and 2 weigh-ins a week.'),acts:btn(L('Étkezés logolása','Log a meal'),'log','sm')},1)
    :off?gHero({lbl:L('Most nem használom','Not in use now'),g:bg,verdict:L(`A keret a képletből jön: ${kc(LW.formula)} kcal.`,`Your budget comes from the formula: ${kc(LW.formula)} kcal.`),sub:L(`Közben csendben tovább tanultam: ${kc(LW.base)} ± ${LW.sd} kcal.`,`Meanwhile I kept learning quietly: ${kc(LW.base)} ± ${LW.sd} kcal.`),acts:btn(L('Bekapcsolás a Fuel beállításokban','Turn it on in Fuel settings'),'beallitas')},1)
    :gHero({lbl:`${L('Tanult alap','Learned base')} · ${cert}`,g:bg,verdict:L(`Ennyit égetsz edzés nélkül: ${kc(LW.base)} kcal.`,`This is what you burn without training: ${kc(LW.base)} kcal.`),sub:L(`A képlet ${kc(LW.formula)} kcal-t mondana.`,`The formula would say ${kc(LW.formula)} kcal.`)+(hold?' '+L('Ezen a héten vártam: kevés volt az adat, a keret nem változott.','I waited this week: there was too little data, so the budget did not change.'):''),
      acts:`<button class="btn" data-sheet="weekly" data-arg="${hold?'var':''}">${L('Heti összegző','Weekly summary')}<i class="fu-dot ${hold?'hold':''}"></i></button>`},1);
  let n=0;
  return page('fuel',ttl,`
  ${h}
  ${emp?'':`${sec(++n,`${L('Hétről hétre','Week by week')} · ${L('12 hét','12 weeks')}`,2)}
  ${card(learnSvg()+lgd([['dash',L('képlet','formula')],['liq',L('a keret alapja','base of the budget')],['band',L('bizonytalanság (±)','uncertainty (±)')],['ring',L('vártam','I waited')]])
    +note(L('Koppints egy hétre a számaiért. Ahol nincs sor, ott a vonal megszakad; nem töltöm ki.','Tap a week for its numbers. Where there is no row the line breaks; I do not fill it in.'))
    +lab(`${dR(...LW.r)}${hold?L(' · ezen a héten vártam',' · I waited this week'):''}`)+kv([[L('Képlet szerint','By the formula'),`${kc(LW.formula)} kcal`],[L('Tanult','Learned'),`${kc(LW.base)} ± ${LW.sd} kcal`],[L('A keret alapja','Base of the budget'),`${kc(off?LW.formula:LW.base)} kcal`],[L('Lépés','Change'),hold||off?L('nem léptem','no change'):`+${LW.step} kcal`],[L('Teljes nap','Complete days'),String(hold?3:LW.usable)],[L('Mérlegelés','Weigh-ins'),String(hold?1:LW.weigh)]])
    +(hold?note(L('Kevés adat volt (legalább 4 teljes nap és 2 mérlegelés kell), ezért a keret nem mozdult.','There was too little data (at least 4 complete days and 2 weigh-ins are needed), so the budget did not move.')):''),{i:2})}`}
  ${sec(++n,L('Az utolsó 14 nap','The last 14 days'),3)}
  ${card(LDX.map(d=>row({left:bub(dCounts(d[3])?'t-tick':d[3]==='unlogged'?'t-calendar':'t-shield',{s:40,c:dCounts(d[3])?'var(--dom)':d[3]==='unlogged'?'var(--faint)':'var(--warn)'}),title:ldDate(d),sub:`${d[2]==null?'':kc(d[2])+' kcal · '}${L(...DST[d[3]])}`,right:d[3]==='unlogged'?'<span class="fx-dash">—</span>':sw(dCounts(d[3]),L(`${ldDate(d)} számít`,`${ldDate(d)} counts`))})).join('')
    +note(L('A mai nap még tart: jövő hétfőn számolom bele. A kapcsolóval megmondod, hogy egy nap teljes volt-e; azonnal újraszámolom. Felírás nélküli napot nem lehet jelölni: ott nincs mit számolni.','Today is still going: I count it in next Monday. With the switch you tell me whether a day was complete; I recalculate at once. A day with no log cannot be marked: there is nothing to count.')),{i:3})}
  ${emp?'':`${sec(++n,L('A legutóbbi hét részletei','Details of the latest week'),4)}
  ${card(HWT().map(([t,s],i)=>row({left:`<span class="fx-dd">${i+1}</span>`,title:t,sub:s,on:{sheet:'hw',arg:i}})).join(''),{i:4})}`}`);
}
/* a hat lépés címe és egy soros kivonata (LearnedBaseExplainerBody cellái) */
const HWT=()=>[[L('Mit néztem meg','What I looked at'),L('47 teljes nap · 52 mérlegelés · 8 hét','47 complete days · 52 weigh-ins · 8 weeks')],[L('A súlyod és az evésed együtt','Your weight and your eating together'),L('evés-oszlopok, súlypontok, trend, víz-sáv','eating bars, weight points, trend, water band')],[L('A számítás, egyszerűen','The calculation, simply'),`${kc(2930)} − 132 − 330 ≈ ${kc(2470)} ${L('(kerekítve)','(rounded)')}`],[L('Amit kiszűrtem, hogy ne tévesszen meg','What I filtered out so it would not mislead me'),L('4 + 1 kihagyott nap · víz · 9 nap felírás nélkül','4 + 1 days left out · water · 9 days with no log')],[L('Mennyire vagyok biztos benne','How sure I am'),`±${LW.sd} kcal · ${L(...CONF[LW.conf]).toLowerCase()}`],[L('Hogyan léptem','How it changed'),`${kc(LW.formula)} → ${kc(LW.start)} → +${LW.step} → ${kc(LW.base)}`]];

/* ═══ LAPOK (alulról) — A terület ═════════════════════════════ */
const howSvg=()=>{const N=56;let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
  const inc={21:604,27:929,47:1340,54:1180,50:2150},unl=new Set([3,11,17,22,28,31,40,44,52]),W=320,H=150,bw=W/N,base=H-14,ky=k=>base-k/3400*70,wy=w=>8+(1-(w-81.6)/3)*60;let bars='',dots='';const tr=[],ti=[];
  for(let i=0;i<N;i++){const water=i>=28&&i<36?Math.min(1.2,(i-27)*.4):0,tissue=82.4+i*.017,w=tissue+water+(rnd()-.5)*.9,k=unl.has(i)?null:inc[i]??Math.round(2760+rnd()*360),cx=i*bw+bw/2;
    if(k!=null)bars+=`<rect x="${(i*bw+.8).toFixed(1)}" y="${ky(k).toFixed(1)}" width="${(bw-1.6).toFixed(1)}" height="${(base-ky(k)).toFixed(1)}" rx="1.6" class="${i in inc?'bad':'okc'}"/>`;
    if(rnd()<.93)dots+=`<circle cx="${cx.toFixed(1)}" cy="${wy(w).toFixed(1)}" r="1.7" class="raw"/>`;tr.push([cx,wy(tissue+water*.9)]);ti.push([cx,wy(tissue)])}
  return `<svg class="fh-chart fu-how" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L('Napi evés oszlopokban, súly pontokban és trendvonalban, 8 hét','Daily eating as bars, weight as points and a trend line, 8 weeks')}"><line class="grid" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${bars}
    <path class="wband" d="${tr.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}${ti.slice().reverse().map(p=>`L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}Z"/>${dots}
    <path class="tr" d="${tr.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}"/>
    <text x="0" y="${H-2}">${dS(8,10)}</text><text x="${W}" y="${H-2}" text-anchor="end">${dS(10,4)}</text><text x="${W}" y="12" text-anchor="end">${L('súly','weight')}</text><text x="${W}" y="${ky(3000)-4}" text-anchor="end">${L('evés','eating')}</text></svg>`};
/* VÍZ (WaterLogSheet): a nagy szám a RÖGZÍTENDŐ mennyiség; gyorsgomb vagy kézi érték választja ki, a Mentés írja be. A pohár a mai szintet mutatja, szaggatottan azt, ahová a választott adag vinné. */
const waterSheet=()=>{const T=2500,cur=WAT,nx=Math.min(T*1.05,cur+(WSEL||0)),Y=p=>126-Math.min(1,p)*112;
  return `${sh('t-water',L('Mennyit ittál?','How much did you drink?'),L('Egy korty szünet.','A sip of a break.'))}
    <div class="fu-wat"><span class="fu-glass" role="img" aria-label="${L(`Ma eddig ${fmt((cur/1000).toFixed(1))} / ${fmt(2.5)} liter`,`${fmt((cur/1000).toFixed(1))} of ${fmt(2.5)} litres so far today`)}">${fill(GLASS,{vb:GLASSVB,p:pc(cur,T)*.92,s:104,c:'color-mix(in srgb,var(--water) 50%,#fff)',c2:'var(--water)',inner:`<path d="M14 14H86" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 4" opacity=".4"/>${WSEL?`<path d="M20 ${Y(nx/T*.92).toFixed(1)}H80" stroke="var(--water)" stroke-width="2.5" stroke-dasharray="5 4" stroke-linecap="round"/>`:''}`})}</span>
      <div><output class="fh-big" aria-label="${L('Rögzítendő vízmennyiség','Amount of water to log')}">${WSEL||0}<small>ml</small></output><p>${L(`ma eddig ${fmt((cur/1000).toFixed(1))} / ${fmt(2.5)} l`,`${fmt((cur/1000).toFixed(1))} / ${fmt(2.5)} l so far today`)}</p></div></div>
    <div class="fh-pills fu-wch">${[250,400,500].map(v=>`<button class="fh-pill ${v===WSEL?'on':''}" data-fwsel="${v}" aria-pressed="${v===WSEL}">${v} ml</button>`).join('')}</div>
    <div class="fu-wman"><input class="fh-in" type="number" inputmode="numeric" min="1" placeholder="${L('pl. 330','e.g. 330')}" aria-label="${L('Víz mennyisége kézzel (ml)','Amount of water by hand (ml)')}"><span>${L('ml kézzel','ml by hand')}</span></div>
    ${acts(`<button class="btn" style="flex:1" data-fwsave ${WSEL?'':'disabled'}>${L('Mentés','Save')}</button>`
      /* visszavonás: useWaterActions().undoLastWater / canUndo — a hook él, a lap ma nem köti be (számolható) */
      +(WHIST.length?`<button class="fh-lk" data-fwundo>${L('Visszavonom az utolsót','Undo the last one')}</button>`:''))}`};
/* a 24 órás napóra (MealClockBox DayDial) — valódi óra: ébrenlét és alvás íve, a többi ablak halványan, ez az ablak erősen, az edzés kívül, a most-mutató és a logolás pontja */
const dayDial=(win,others,at,now,hit)=>{const C=115,R=88,Lm=1440,pt=(min,r)=>{const a=min/Lm*2*Math.PI-Math.PI/2;return [C+r*Math.cos(a),C+r*Math.sin(a)]};
  const arc=(a,b,st,r=R)=>{const s=toMin(a),len=((toMin(b)-s)+Lm)%Lm;return `<circle cx="${C}" cy="${C}" r="${r}" fill="none" pathLength="${Lm}" stroke-dasharray="${len} ${Lm-len}" stroke-dashoffset="${-s}" transform="rotate(-90 ${C} ${C})" ${st}/>`};
  const T=DAY.train, n=now?toMin(now):null, c1=at?L('AJÁNLOTT VOLT','SUGGESTED'):n!=null?L('MOST','NOW'):L('AJÁNLOTT','SUGGESTED'), c2=at?(win?`${win.from}–${win.to}`:'—'):n!=null?now:(win?`${win.from}–${win.to}`:'—');
  const c3=at?(win?L(`${dur(toMin(win.to)-toMin(win.from))} hosszú ablak`,`a ${dur(toMin(win.to)-toMin(win.from))} window`):L('nem tartozott ablakhoz','not part of a window')):n!=null&&win&&n>=toMin(win.from)&&n<=toMin(win.to)?L(`még ${dur(toMin(win.to)-n)}`,`${dur(toMin(win.to)-n)} left`):'';
  const np=n!=null?[pt(n,R-8),pt(n,R+6)]:null, lp=at?pt(toMin(at),R):null, mid=T?pt(toMin(T.start)+(toMin(T.end)-toMin(T.start))/2,R+25):null, mo=pt(120,R-22);
  return `<svg class="fu-dd24" viewBox="0 0 230 230" role="img" aria-label="${L(`Napóra: ébredés ${DAY.wake}, lefekvés ${DAY.bed}${T?`, edzés ${T.start}–${T.end}`:''}`,`Day clock: wake ${DAY.wake}, bed ${DAY.bed}${T?`, training ${T.start}–${T.end}`:''}`)}"><circle cx="${C}" cy="${C}" r="104" fill="#fff" stroke="rgba(10,42,60,.10)" stroke-width="1.5"/>
    ${arc(DAY.wake,DAY.bed,'stroke="color-mix(in srgb,var(--dom) 10%,#fff)" stroke-width="12"')}${arc(DAY.bed,DAY.wake,'stroke="rgba(10,42,60,.16)" stroke-width="12"')}
    ${others.map(w=>arc(w.from,w.to,'stroke="color-mix(in srgb,var(--liq2) 34%,#fff)" stroke-width="12"')).join('')}${win?arc(win.from,win.to,'stroke="var(--liq2)" stroke-width="12" stroke-linecap="round"'):''}${T?arc(T.start,T.end,'stroke="var(--protein)" stroke-width="5" stroke-linecap="round"',R+13):''}
    ${[0,6,12,18].map(hh=>{const [x,y]=pt(hh*60,R-20);return `<text class="hr" x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle">${hh}</text>`}).join('')}
    <use href="#t-moon" x="${(mo[0]-8).toFixed(1)}" y="${(mo[1]-8).toFixed(1)}" width="16" height="16"/>${mid?`<use href="#t-dumbbell" x="${(mid[0]-9).toFixed(1)}" y="${(mid[1]-9).toFixed(1)}" width="18" height="18"/>`:''}
    ${np?`<path d="M${np[0][0].toFixed(1)} ${np[0][1].toFixed(1)}L${np[1][0].toFixed(1)} ${np[1][1].toFixed(1)}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>`:''}${lp?`<circle cx="${lp[0].toFixed(1)}" cy="${lp[1].toFixed(1)}" r="8" fill="${hit?'var(--liq2)':'var(--warn)'}" stroke="#fff" stroke-width="2.5"/>`:''}
    <text class="c1" x="${C}" y="${C-18}" text-anchor="middle">${c1}</text><text class="c2 ${c2.length>5?'rng':''}" x="${C}" y="${C+8}" text-anchor="middle">${c2}</text><text class="c3" x="${C}" y="${C+26}" text-anchor="middle">${c3}</text></svg>`};
/* „Miért ekkor?” — a szerver ablak-okai (windowReasons) a windowReasonCopy szövegeivel */
const WHYC=c=>{const T=DAY.train;return {
  'after-wake':['t-sun',L(`Ébredés (${DAY.wake}) után nem sokkal`,`Soon after waking (${DAY.wake})`),L('Az éjszakai böjt után itt töltöd fel a raktárakat.','After the night’s fast this is where you refill your stores.')],
  'protein-start':['t-protein',L('A nap első fehérjeadagja','The first protein of the day'),L('Ez indítja a napi fehérje-sort, nagyjából 3–4 órás lépésközzel.','It starts the day’s run of protein, roughly every 3–4 hours.')],
  'protein-spacing':['t-protein',L('Nagyjából 3–4 órára az előzőtől','Roughly 3–4 hours after the last one'),L('A fehérje egyenletes elosztása segíti az izomépítést, és kordában tartja az éhséget.','Spreading protein evenly helps build muscle and keeps hunger in check.')],
  'bridge':['t-clock',L('Két fő étkezés között','Between two main meals'),L('Áthidalja a hosszabb szünetet, így nem esel be éhesen a következő étkezésbe.','It bridges the longer gap, so you do not arrive at the next meal starving.')],
  'post-training':['t-dumbbell',L(`Az edzés (${T.end}) után fél–másfél órával`,`Half an hour to an hour and a half after training (${T.end})`),L('Fehérje és szénhidrát segíti a regenerációt és a raktárak visszatöltését.','Protein and carbs help recovery and refill your stores.')],
  'before-bed':['t-moon',L(`Lefekvés (${DAY.bed}) előtt legalább 2,5 órával`,`At least 2.5 hours before bed (${DAY.bed})`),L('Késő este ugyanaz az étel általában nagyobb vércukor-emelkedést okoz, és ronthatja az alvást.','Late in the evening the same food usually raises blood sugar more and can hurt your sleep.')]}[c]};
const sRow=(ic,t,b,v)=>`<div class="fu-tip">${bub(ic,{s:38})}<span><b>${t}</b><small>${b}</small></span>${v?`<em>${v}</em>`:''}</div>`;
const sheetsA={
  /* MIBŐL JÖN ÖSSZE? (FuelEnergyHero EquationBox): Alap + Mozgás ± Célod − Étel [− Kihagyva] = Marad; hiányzó tag „—”, sosem 0 */
  eq:()=>{const V=CUR||dayVM(''),E=V.energy,over=V.rem<0,mv=E?E.planned+E.extra:null,paused=V.dropped;
    const big=over?(V.mode==='ESTIMATE'?L('kcal a keret körül','kcal around the budget'):L('kcal a keret felett','kcal over the budget')):V.past?L('kcal fért még bele','kcal was still left'):L('kcal fér még bele ma','kcal still fits today');
    const goalSub=paused?L('szünetel, amíg a sérülés tart','paused while the injury lasts'):L('a fogyási célod napi része','the daily share of your weight-loss goal');
    const rows=[[L('Alap','Base'),'t-flame',V.weekly?L('a súlytrendedből és az evésedből tanulva · heti tanulás ›','learned from your weight trend and your eating · weekly learning ›'):E?L('a súlytrendedből és az evésedből tanulva','learned from your weight trend and your eating'):'',E?kc(E.base):'—',V.weekly?{sheet:'weekly'}:null],
      [L('Mozgás','Movement'),'t-dumbbell',(V.past?L('aznap logolt mozgásod','the movement you logged that day'):L('ma logolt mozgásod','your logged movement today'))+(E&&E.extra?L(' + terven kívüli',' + unplanned'):'')+(E&&E.pending&&!V.past?`<i class="fu-pend">${L(`még jön +${kc(E.pending)}, ha megcsinálod`,`+${kc(E.pending)} more if you do it`)}</i>`:''),E?'+ '+kc(mv):'—'],
      ...(E||V.arg==='nincs-cel'?[]:[]),...(V.arg==='nincs-cel'?[]:[[L('Célod','Your goal'),'t-ring',goalSub,E?(E.balance===0?'0':(E.balance<0?'− ':'+ ')+kc(Math.abs(E.balance))):'—']]),
      [L('Étel','Food'),'t-bowl',V.past?L('amit aznap logoltál','what you logged that day'):L('amit ma eddig logoltál','what you have logged so far today'),'− '+kc(V.eaten)],
      ...(V.skipped?[[L('Kihagyva','Skipped'),'t-skip',L('kihagyott étkezés · nem kerül át máshová','skipped meal · it does not move elsewhere'),'− '+kc(V.skipped)]]:[])];
    return `${sh('t-bowl',`${kc(Math.abs(V.rem))} ${big}`,L('Miből jön össze?','How does it add up?'))}
    <div class="fu-eqb" role="img" aria-label="${L(`A napi keretedből ${kc(V.eaten)} kcal fogyott el`,`${kc(V.eaten)} kcal of your daily budget is used`)}">${level(pc(V.eaten,V.target),{h:22})}<p class="fu-eqc"><span>${L('ettél','eaten')}</span><span>${over?L(`${kc(-V.rem)} felett`,`${kc(-V.rem)} over`):L('még szabad','still free')}</span></p></div>
    ${rows.map(([l,ic,s,v,on])=>row({icon:ic,title:l,sub:s,v,on:on||null})).join('')}
    <div class="fx-tot"><span>${L('Marad','Left')}<small>${V.past?L('a nap keretének maradéka','what was left of the day’s budget'):L('a mai kereted maradéka','what is left of today’s budget')}</small></span><b>${(over?'−':'')+kc(Math.abs(V.rem))}<small>kcal</small></b></div>
    ${note(V.past?L('Egy lezárt napnál csak az étel és a nap kerete ismert; az Alap, a Mozgás és a Célod a mai napot írná le, ezért ott gondolatjel áll.','For a closed day only the food and the day’s budget are known; Base, Movement and Your goal would describe today, so they show a dash.'):!E?L(`Nincs aktív célod vagy friss testadatod, ezért a keret a beállított napi kereted: ${kc(V.target)} kcal. Bontás ilyenkor nincs.`,`You have no active goal or recent body data, so the budget is the daily budget you set: ${kc(V.target)} kcal. There is no breakdown in this case.`):L('A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja; a keret akkor nő, amikor logolod az edzést.','Your budget comes from your base need, your weight goal and today’s movement together; it grows when you log the workout.'))}
    ${acts((E&&!V.past?btn(L('Részletesen, honnan jön a keret','In detail: where the budget comes from'),{sheet:'energy'},'sm'):'')+closeLk(L('Bezárom','Close')))}`},
  /* HONNAN JÖN A KERET? (EnergyBreakdownSheet, az Én oldallal közös): Alap + Mozgás − Deficit = Mai cél */
  energy:()=>{const V=CUR&&CUR.energy?CUR:dayVM(''),E=V.energy,mv=E.planned+E.extra,def=E.balance;
    const t3=(a,op,b,res)=>`<div class="fu-eq3"><span><b>${a[0]}</b><small>${a[1]}</small></span><i>${op}</i>${b?`<span><b>${b[0]}</b><small>${b[1]}</small></span><i>=</i>`:''}<span class="res"><b>${res[0]}</b><small>${res[1]}</small></span></div>`;
    return `${sh('t-ring',L(`Honnan jön a ${kc(V.target)} kcal?`,`Where do the ${kc(V.target)} kcal come from?`),L('A napi cél nem statikus: az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.','The daily goal is not fixed: it is built from your base need, the movement you logged today and your goal.'))}
    ${split([[L('Alap','Base'),E.base,'var(--dom)',kc(E.base)],[L('Mozgás','Movement'),mv,'var(--water)','+'+kc(mv)],...(def?[[L('Deficit','Deficit'),Math.abs(def),'var(--faint)','−'+kc(Math.abs(def))]]:[])],{h:30})}
    <div class="fx-sum"><span class="fh-big">${kc(E.base)} + ${kc(mv)}${def?' − '+kc(Math.abs(def)):''}</span><b>= ${kc(V.target)}</b></div>
    ${lab(`${L('Alap · tanult','Base · learned')} · ${kc(E.base)}`)}${t3([kc(E.formula),L('Képlet szerint · alapanyagcsere × életmód','By the formula · resting burn × lifestyle')],'→',null,[kc(E.base),L('Tanult alap','Learned base')])}
    ${txt(L(`Ennyit égetsz <b>edzés nélkül</b>: a <b>súlytrendedből és a felírt evésedből</b> tanultam meg. A képlet ${kc(E.formula)} kcal-t mondana.`,`This is what you burn <b>without training</b>: I learned it from <b>your weight trend and the eating you logged</b>. The formula would say ${kc(E.formula)} kcal.`))}
    ${row({icon:'t-lens',title:`${L('Tanult alap','Learned base')} · ${L(...CONF[E.conf])} · ±${E.sd} kcal`,sub:L('Hogy tanultam? Hétről hétre, és a napjaid','How I learned: week by week, and your days'),on:'tanulas'})}
    ${lab(`${L('Mozgás · ma logolva','Movement · logged today')} · +${kc(mv)}`)}${t3([kc(E.planned),L('Tervezett edzés · logolva','Planned workout · logged')],'+',[kc(E.extra),L('Terven kívüli mozgás','Unplanned movement')],['+'+kc(mv),L('Mai mozgás','Today’s movement')])}
    ${E.blocks.some(b=>b[4])?lab(L('A mai edzéseid becsült többlete, tájékoztatásul','The estimated extra of today’s workouts, for information'))+kv(E.blocks.filter(b=>b[4]).map(b=>[`${b[0]} · ${L(`${b[2]} perc`,`${b[2]} min`)}`,`${kc(b[3])} kcal`])):''}
    ${E.pending?lab(L('Még jön, ha megcsinálod · a keretben még nincs benne','Still to come if you do it · not in the budget yet'))+kv(E.blocks.filter(b=>!b[4]).map(b=>[`${b[0]} · ${L(`tervezett · ${b[2]} perc`,`planned · ${b[2]} min`)}`,`+${kc(b[3])} kcal`])):''}
    ${note(L('A keret akkor nő, amikor rögzíted az edzést; a tervezett, még meg nem csinált edzés a keretben nincs benne. A becslés a nyugalmi energiád feletti többletet számolja; ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.','The budget grows when you log the workout; a planned workout you have not done yet is not in it. The estimate counts the extra above your resting energy; if it is regularly too high or too low, the weekly learning corrects your base.'))}
    ${def?lab(`${L('Deficit · fogyás','Deficit · weight loss')} · −${kc(Math.abs(def))}`)+t3([fmt(E.rate.toFixed(2)),L('Cél ütem · kg/hét','Goal pace · kg/week')],'→',null,['−'+kc(Math.abs(def)),L('Napi deficit','Daily deficit')])
      +note(L(`A fogyási célod kb. ${fmt(E.rate.toFixed(2))} kg/hét üteméhez napi kb. ${kc(Math.abs(def))} kcal deficit tartozik (kb. 7 700 kcal / 1 kg zsír, a valós súlytrendedhez igazítva). Ennyivel eszel a fenntartó alatt.`,`Your weight-loss goal of about ${fmt(E.rate.toFixed(2))} kg/week comes with a daily deficit of about ${kc(Math.abs(def))} kcal (about 7,700 kcal per 1 kg of fat, adjusted to your real weight trend). That is how far below maintenance you eat.`)):''}
    ${acts(closeLk(L('Bezárom','Close')))}`},
  water:waterSheet,
  /* HETI TANULÁS (WeeklyLearningSheet) — a heti összegző kártya, ha van mit mondani: lépett (arg nélkül) vagy várt (arg „var”) */
  weekly:a=>{const hold=a==='var',base=L(`Alap ${kc(LW.base)} kcal`,`Base ${kc(LW.base)} kcal`),cert=`${L(...CONF[LW.conf])} · ±${LW.sd} kcal`;
    return `${sh(hold?'t-hold':'t-lens',hold?L('Ezen a héten vártam','I waited this week'):base,`${L('Heti tanulás','Weekly learning')} · ${dR(...LW.r)} · ${hold?base+' · ':''}${cert}`)}
    ${hold?txt(L('Kevés adat volt: <b>3 teljes nap, 1 mérlegelés</b>; legalább 4 és 2 kell. A keret nem változott.','There was too little data: <b>3 complete days, 1 weigh-in</b>; at least 4 and 2 are needed. The budget did not change.'))
      :`<div class="fx-tot"><span>${L('a napi keretedben','in your daily budget')}</span><b>+${LW.step}<small>kcal</small></b></div>${txt(L('A súlyod lassabban nőtt, mint amit a felírt evés alapján vártam.','Your weight rose more slowly than I expected from the eating you logged.'))}
      ${bandG({lo:2200,hi:2760,a:LW.base-LW.sd,b:LW.base+LW.sd,v:LW.base,vl:kc(LW.base),tick:LW.start,tl:L(`múlt hét ${kc(LW.start)}`,`last week ${kc(LW.start)}`),al:'−'+LW.sd,bl:'+'+LW.sd,label:L(`Az alap ${kc(LW.start)}-ról ${kc(LW.base)}-ra lépett`,`The base stepped from ${kc(LW.start)} to ${kc(LW.base)}`)})}`}
    ${lab(L('Kihagyott napok','Days left out'))}
    ${(hold?ldFor('var').filter(d=>d[1]>=928&&d[1]<=1004&&(d[3]==='suspicious'||d[3]==='marked_incomplete')):LW.excluded).map(d=>row({icon:'t-shield',title:ldDate(d),sub:`${kc(d[2])} kcal · ${L(...DST[d[3]])}`,right:d[3]==='marked_incomplete'?btn(L('Visszavonom','Undo'),{toast:L('A keret nem változott','The budget did not change')},'sm ghost'):btn(L('Teljes volt','It was complete'),{toast:L('A keret +20 kcal-lal változott','The budget changed by +20 kcal')},'sm ghost')})).join('')}
    ${note(L('Ha nem nyúlsz hozzá, ezeket a napokat kihagyva hagyom.','If you leave them alone, I keep these days left out.'))}
    ${acts(btn(L('Részletek','Details'),'tanulas','sm')+`<button class="fh-lk" data-close data-toast="${L('Elrejtettem; ezt a hetet nem mutatom újra','Hidden; I will not show this week again')}">${L('Bezárom','Close')}</button>`)}`},
  /* EGY SZEMPONT (FuelScoreSurface DimGlass); arg: <étkezés vagy recept kulcs>|<index> */
  dim:arg=>{const [id,i]=(arg||'reggeli|0').split('|'); const m=mealOf(id)||MEALS.reggeli; const n=+i||0,[,l,ic,w,det,rows]=DIMS[n]||DIMS[0],off=dimOff(id,n),v=m.dims[n],low=!off&&Math.min(...m.dims.filter((x,k)=>!dimOff(id,k)))===v;
    return `${sh(ic,off?'—':fmt(v),L(...l))}
    <div class="fh-chips fu-chips"><span>${L(`súly ${off?0:w}%`,`weight ${off?0:w}%`)}</span>${n===4?`<span>${L('lefedettség 100%','coverage 100%')}</span>`:''}</div>
    <div class="fu-eqb" role="img" aria-label="${L(...l)}: ${off?L('nincs pontszám','no score'):L(`${fmt(v)} a tízes skálán`,`${fmt(v)} out of ten`)}">${level(off?0:v*10,{h:22,c:low?'var(--warn)':'var(--dom)'})}</div>
    ${off?tip('t-info',L('Őszintén','To be honest'),L('Ehhez az étkezéshez nem volt elég adat, ezért ez a szempont kimaradt, és a többi súlya vette át a helyét. Nem találgatunk.','There was not enough data for this meal, so this aspect was left out and the weight of the others took its place. We do not guess.'))
      :txt(det(m))+kv(rows(m))}
    ${!off&&n===0&&id==='reggeli'?tip('t-score',L('Mezo jegyzete','Mezo’s note'),'A zsír aránya kicsit a cél fölött van; egy nap alatt ez bőven kiegyenlítődik.'):''}
    ${acts(closeLk(L('Bezárom','Close')))}`},
  /* VÉRCUKOR-VÁLASZ (GlycemicGlass): a SÁV SZAVA a nagy „szám” — glikémiás index, mért érték vagy bármilyen szám soha. arg: étkezés-kulcs */
  glu:a=>{const id=String(a||'reggeli').split('|').pop(), m=mealOf(id)||MEALS.reggeli, B=gBand(m), g=B.lvl;
    /* az AI-tippek (useMealCoachFor → verdict.glucoseTips) elsőbbséget kapnak: a tányér SAJÁT tételeit nevezik meg; nélkülük a kiszámolt két csere áll itt */
    const ai={ebed:[['Háromnegyed adag édesburgonya','400 g helyett 300 g; a visszatöltéshez így is elég.'],['A spenót és a csirke előre','Az édesburgonyát edd a végén: a sorrend önmagában laposít.']]}[id];
    return `${sh('t-glucose',glw(g,1),L('Vércukor-válasz · várható hatás','Blood sugar response · expected effect'))}
    ${gband(g)}
    <p class="fh-txt fu-gl1"><b>${[L('Szépen simít.','It smooths nicely.'),L('Egy szelídebb domb.','A gentler hill.'),L('Ez most megdobja.','This one lifts it.')][g]}</b></p>
    ${gCurve(g)}
    ${kv(B.facts)}
    ${B.est?`<p class="fh-note fx-warn">${L('A cukor mennyiségét nem tudjuk: a szénhidrát 30%-át vettük finomítottnak. Ez becslés, nem mért adat; a sáv ezért is sáv, nem szám.','We do not know the amount of sugar: we took 30% of the carbs as refined. This is an estimate, not measured data; that is one more reason the band is a band, not a number.')}</p>`:''}
    ${lab(L('Mit érzel majd','What you will feel'))}${sRow('t-bolt',L('Energia','Energy'),B.exp[0])}${sRow('t-clock',L('Alapszint','Baseline'),B.exp[1])}${sRow('t-plate',L('Éhség','Hunger'),B.exp[2])}
    ${note(L('Minél laposabb a domb, annál egyenletesebb az energiád; a magas, hegyes csúcs gyors visszaesést és korai éhséget hoz.','The flatter the hill, the steadier your energy; a tall, sharp peak brings a quick dip and early hunger.'))}
    ${lab(L('Most','Now'))}${tip('t-sprout',B.tip[0],B.tip[1])}
    ${g>0&&ai?`${lab(L('Legközelebb így lesz laposabb','How to make it flatter next time'))}${ai.map(([t,s],k)=>sRow('t-swap',`${k+1}. ${t}`,s)).join('')}${note(L('Javaslat a tányérod tételeiből.','A suggestion from the items on your plate.'))}`
      :B.improve?`${lab(L('Legközelebb így lesz laposabb','How to make it flatter next time'))}${B.improve.steps.map(([t,s],k)=>sRow('t-swap',`${k+1}. ${t}`,s)).join('')}<p class="fh-note"><b>${B.improve.result===g?L(`A kettővel együtt laposabb lesz a domb, de még a ${glw(g)} sávban marad.`,`With the two together the hill gets flatter, but stays in the ${glw(g)} band.`):L(`A kettővel együtt: ${glw(B.improve.result)} vércukor-válasz.`,`With the two together: a ${glw(B.improve.result)} blood sugar response.`)}</b></p>`:''}
    ${note(L('Becslés az étkezés összetételéből, nem mérés és nem orvosi előrejelzés. Sávot mutatunk, számot nem: egy vegyes tányér pontos vércukor-csúcsát senki nem tudja kiszámolni.','An estimate from what the meal is made of, not a measurement and not a medical forecast. We show a band, not a number: nobody can calculate the exact blood sugar peak of a mixed plate.'))}
    ${acts(closeLk(L('Bezárom','Close')))}`},
  /* AZ ÉTKEZÉSI ÓRA (MealClockBox). arg: ablak-index, vagy „x|<étkezés>” egy ablak nélküli extra logra. Logolás előtt: miért ekkor + hogyan illik a napodba; utána: vércukor-sáv + mire számíts */
  ora:a=>{const V=CUR||dayVM(''), ex=String(a).startsWith('x|')?mealOf(String(a).slice(2)):null, i=ex?-1:Math.max(0,Math.min(3,+a||0)), s=ex?null:(V.slots[i]||{...SLOTS[i],i}), m=ex||(s.meal&&s.meal[1])||null, now=V.now;
    const inw=m&&s&&toMin(m.time)>=toMin(s.from)&&toMin(m.time)<=toMin(s.to), off=m&&s&&!inw?(toMin(m.time)<toMin(s.from)?toMin(m.time)-toMin(s.from):toMin(m.time)-toMin(s.to)):0;
    const status=m?L('logolva','logged'):now!=null?(toMin(now)<toMin(s.from)?L(`nyílik ${s.from}`,`opens ${s.from}`):toMin(now)<=toMin(s.to)?L('most nyitva','open now'):L(`az ablak ${s.to}-kor zárult`,`the window closed at ${s.to}`)):L('még pótolható','can still be added');
    const B=m?gBand(m):null, toBed=m?toMin(DAY.bed)-toMin(m.time):null, late=m&&toBed>=0&&toBed<=150, nx=s?SLOTS[i+1]:SLOTS.find(x=>toMin(x.from)>toMin(m.time)), T=DAY.train;
    /* „Mire számíts” (logic/mealForecast): energia · mikor leszel éhes · alvás vagy a nap ritmusa */
    const fc=()=>{const r=[],at=toMin(m.time),toT=toMin(T.start)-at,aftT=at-toMin(T.end);
      if(B){const ctx=toT>0&&toT<=120?(B.lvl===2?L(' Edzés előtt ez most előny: gyorsan elérhető üzemanyag.',' Before training this is an advantage now: fuel you can reach fast.'):L(' Az edzésre ez tartós alapot ad.',' It gives a lasting base for the training.')):aftT>=0&&aftT<=180?L(' Edzés után ez segíti a raktárak visszatöltését.',' After training this helps refill your stores.'):'';r.push(['t-bolt',L('Energia','Energy'),B.exp[0]+'.'+ctx])}
      if(nx){const hun=at+(m.kcal<400?150:210)+(B&&B.lvl===2?-45:B&&B.lvl===0?20:0),hh=`${String(Math.floor(hun/60)).padStart(2,'0')}:${String(hun%60).padStart(2,'0')}`,lo=toMin(nx.from),hi2=toMin(nx.to),nm=sl(nx).toLowerCase();
        r.push(['t-clock',L('Mikor leszel éhes','When you will be hungry'),hun>=lo-30&&hun<=hi2+15?L(`Nagyjából ${hh} körül jelez újra az éhség, pont ${azA(nm)} ablakában.`,`Hunger signals again around ${hh}, right in the ${nm} window.`):hun<lo?L(`Nagyjából ${hh} körül jelez újra az éhség, ${azA(nm)} előtt: egy pohár víz vagy kávé áthidalja.`,`Hunger signals again around ${hh}, before ${nm}: a glass of water or a coffee bridges it.`):L(`Nagyjából ${hh} körül jelez újra az éhség. ${cap(azA(nm))} ablaka ezért kicsit később lehet, vagy kisebb adag is elég.`,`Hunger signals again around ${hh}. So the ${nm} window can be a little later, or a smaller portion is enough.`)])}
      else r.push(['t-clock',L('Mikor leszel éhes','When you will be hungry'),L('Ez volt a nap utolsó étkezése, reggelig ennyi elég.','This was the last meal of the day; it is enough until morning.')]);
      if(late)r.push(['t-moon',L('Alvás','Sleep'),L(`Lefekvés előtt ${dur(toBed)}-cel ettél. Az emésztés még dolgozik, amikor elalszol.`,`You ate ${dur(toBed)} before bed. Your digestion is still working when you fall asleep.`)]);
      else if(!s)r.push(['t-heart',L('A nap ritmusa','The rhythm of the day'),L('Nem tartozott ablakhoz, így a nap többi ablaka változatlan.','It was not part of a window, so the day’s other windows are unchanged.')]);
      else r.push(['t-heart',L('A nap ritmusa','The rhythm of the day'),inw?L('Tartja a 3–4 órás fehérje-ritmust, és a nap többi ablaka a helyén marad.','It keeps the 3–4 hour protein rhythm, and the day’s other windows stay in place.'):L(`${dur(off)}-cel ${off>0?'később':'korábban'} ettél. Ez nem gond, a nap elbírja.`,`You ate ${dur(off)} ${off>0?'later':'earlier'}. No problem, the day can take it.`)]);
      return r};
    return `${sh(s?s.ic:'t-clock',ex?L(ex.slot,ex.se||ex.slot):sl(s),`${s?L(`${i+1}. étkezés 4 közül`,`meal ${i+1} of 4`)+' · ':''}${status}`)}
    <div class="fu-ob"><small>${m?L('Logolva','Logged'):L('Ajánlott ablak','Suggested window')}</small><span class="fh-big">${m?m.time:`${s.from}–${s.to}`}</span>${m&&s?`<p>${L('ajánlott ablak','suggested window')}: ${s.from}–${s.to}</p>`:''}${m&&s?st(inw?L('Az ablakban','In the window'):off>0?L(`+${dur(off)} később`,`+${dur(off)} later`):L(`−${dur(off)} korábban`,`−${dur(off)} earlier`),inw?'ok':'warn'):''}</div>
    ${dayDial(s,SLOTS.filter((x,j)=>j!==i),m?m.time:null,m?null:now,inw)}
    ${lgd([['liq',s?sl(s):L('ez az étkezés','this meal')],['oth',L('többi étkezés','other meals')],['trn',L('edzés','training')],['ngt',L('alvás','sleep')]])}
    ${m?`${B?`${lab(L('Vércukor-válasz','Blood sugar response'))}<div class="fu-ogl" style="--gc:${GCOL[B.lvl]}">${gMini(B.lvl,late)}<b>${glw(B.lvl,1)}${late?L(' · késő este',' · late evening'):''}</b></div>${gband(B.lvl)}<p class="fh-txt"><b>${B.tip[0]}.</b> ${B.tip[1]}${late?' '+L('Késő este ugyanez általában magasabbra és tovább emelkedik (szaggatott vonal).','Late in the evening the same usually rises higher and for longer (dashed line).'):''}</p>${acts(lk(L('A vércukor-válasz részletei','Details of the blood sugar response'),{sheet:'glu',arg:ex?String(a).slice(2):s.meal[0]}))}`:''}
      ${lab(L('Mire számíts','What to expect'))}${fc().map(r=>sRow(...r)).join('')}`
    :`${lab(L('Miért ekkor?','Why then?'))}${s.why.map(c=>sRow(...WHYC(c))).join('')}
      ${lab(L('Hogyan illik a napodba','How it fits your day'))}${T?sRow('t-dumbbell',L('Mozgás ma','Movement today'),`${T.label} ${T.start}–${T.end}`):''}${sRow('t-plate',L('Étkezési terv','Meal plan'),L(`${i+1}. étkezés 4 közül. A terv szerint erre kb. ${kc(s.b)} kcal jut a napi keretből.`,`Meal ${i+1} of 4. By the plan, about ${kc(s.b)} kcal of the daily budget goes to it.`),`${kc(s.b)} kcal`)}
      ${note(L('Az ablak iránymutatás. A napi összes fehérje és kalória többet számít, mint az, hogy percre pontosan mikor eszel.','The window is a guide. Your total protein and calories for the day matter more than eating at the exact minute.'))}`}
    ${acts(`<button class="btn sm" style="flex:1" data-close>${L('Rendben','OK')}</button>`)}`},
  /* MIÉRT MARAD KI? (MealSkipSheet): hat ok, az „Egyéb”-hez szöveg; komoly oknál „Meddig tarthat?” → kímélő mód */
  mealwhy:a=>{const i=+a||0,s=SLOTS[i],cur=SKIP[i]||{},c=cur.c,ser=c!=null&&MCATS[c][2];
    const nt=cur.km!=null?tip('t-kimelo',L('Kímélő mód bekapcsolva','Gentle mode is on'),L('Amíg tart, a Fuel nem kér számon semmit, az edzés és a sport pedig magától kimarad.','While it lasts, Fuel asks nothing of you, and training and sport drop out on their own.'))
      :c==null?tip('t-info',L('Nem kötelező','Optional'),L('Ha megmondod, miért, Mezo érteni fogja a mintát.','If you say why, Mezo will understand the pattern.'))
      :ser?tip('t-heart',[L('Jobbulást!','Get well soon.'),L('Jobbulást!','Get well soon.'),L('Jó utat!','Safe travels.')][c-2],L('Ha több napig tarthat, válaszd ki, meddig. A kímélő mód a Fuelt is átállítja.','If it may last several days, choose how long. Gentle mode changes Fuel too.'))
      :tip('t-info',L('Nem számít mulasztásnak.','It does not count as a miss.'),L('A mai kereted nem változik, és a többi étkezésed sem lesz nagyobb.','Today’s budget does not change, and your other meals do not get bigger.'));
    return `${sh('t-skip',L('Miért marad ki?','Why are you skipping it?'),`${L('Kihagyva','Skipped')} · ${sl(s)} · ${L('nem kötelező; segít, hogy Mezo értse a mintát','optional; it helps Mezo understand the pattern')}`)}
    <div class="fu-why" role="group" aria-label="${L('A kihagyás oka','Reason for skipping')}">${MCATS.map(([ic],k)=>`<button class="${c===k?'on':''}" data-fwhy="${i}|${k}" aria-pressed="${c===k}">${bub(ic,{s:40})}<span>${mcl(k)}</span></button>`).join('')}</div>
    ${c===5?lab(L('Mi történt? · saját szavakkal','What happened? · in your own words'))+`<div class="fx-cmp"><textarea aria-label="${L('Mi történt?','What happened?')}" placeholder="${L('pl. elhúzódott a megbeszélés','e.g. the meeting ran long')}">${cur.t||''}</textarea><button data-toast="${L('Diktálás','Dictate')}" aria-label="${L('Diktálás','Dictate')}">${I('t-mic')}</button></div>`:''}
    ${ser?lab(L('Meddig tarthat?','How long may it last?'))+`<div class="fh-pills">${[L('Csak ma','Just today'),L('2–3 nap','2–3 days'),L('Kb. egy hét','About a week'),L('Nem tudom','I don’t know')].map((l,k)=>`<button class="fh-pill ${cur.km===k?'on':''}" data-fkm="${i}|${k}" ${cur.km!=null?'disabled':''}>${l}</button>`).join('')}</div>`:''}
    ${nt}
    ${acts(`<button class="btn sm" style="flex:1" data-fwhydone="${i}" ${c==null?'disabled':''}>${L('Kész','Done')}</button><button class="fh-lk" data-close>${L('Most nem mondom','Not now')}</button>`)}`},
  /* MIKOR FORDULJ ORVOSHOZ? (DoctorSheet) — arg: STOMACH | ILLNESS */
  orvos:a=>{const st=a!=='ILLNESS';return `${sh('t-info',L('Mikor fordulj orvoshoz?','When to see a doctor'),st?L('gyomorrontás','stomach bug'):L('betegség','illness'))}
    ${(st?[L('Nem marad meg benned a folyadék','You cannot keep fluids down'),L('Véres a széklet vagy a hányás','There is blood in your stool or vomit'),L('A hasmenés 7 napnál, a hányás 2 napnál tovább tart','Diarrhoea lasts more than 7 days, or vomiting more than 2'),L('Kiszáradás jelei: szédülsz, alig van vizeleted','Signs of dehydration: you feel dizzy, you barely pass urine'),L('Erős hasi fájdalom vagy magas láz','Strong stomach pain or a high fever')]
      :[L('A magas láz 3 napnál tovább tart','A high fever lasts more than 3 days'),L('Nehezen kapsz levegőt, vagy mellkasi fájdalmad van','You struggle to breathe, or you have chest pain'),L('Néhány nap javulás után megint romlik az állapotod','After a few better days you get worse again'),L('Nem tudsz inni, vagy a kiszáradás jeleit érzed','You cannot drink, or you feel signs of dehydration')]).map(t=>`<div class="fu-li"><i></i><span>${t}</span></div>`).join('')}
    ${tip('t-info',L('Ez nem orvosi tanács.','This is not medical advice.'),L('Ha bizonytalan vagy, hívd a háziorvosodat vagy az ügyeletet.','If you are unsure, call your GP or the out-of-hours service.'))}${acts(closeLk(L('Bezárom','Close')))}`},
  /* VÁLASSZ A POLCRÓL (KamraPickSheet) — a naplózó Kamra-útja; több tétel is felvehető, a lap nyitva marad. arg „ures” = nincs találat */
  kamrapick:a=>`${sh('t-stack',L('Válassz a polcról','Pick from the shelf'),L('Kamra · hozzáadás','Pantry · add'))}<div class="fx-srch" data-toast="${L('Keresés a kamrában','Search the pantry')}">${bub('t-lens',{s:28})}${a==='ures'?'<span>lazac</span><i>×</i>':L('Keress a Kamrában…','Search the Pantry…')}</div>
    <div class="fh-pills" data-fpick style="margin:10px 0 4px" role="group" aria-label="${L('Kategória-szűrő','Category filter')}">${[L('Mind','All'),...[...new Set(KAM.filter(k=>k.k==='food').map(k=>k.cat))].map(catL)].map((l,i)=>`<button class="fh-pill ${a==='ures'?(l===catL('Gabona')?'on':''):i?'':'on'}" data-toast="${esc(l)}">${l}</button>`).join('')}</div>
    ${a==='ures'?empty('',L('Nincs találat ebben a kategóriában.','Nothing found in this category.')):KAM.filter(k=>k.k==='food').map((k,i)=>irow({icon:kic(k),title:k.n,sub:`${k.b} · ${L(NOVA[k.nova==='Alapanyag'?1:2][0],NOVA[k.nova==='Alapanyag'?1:2][1])}`,v:`<span class="fu-pk2"><span>${k.kcal}<small>kcal /100 g</small></span><button class="fx-add ${i===3?'on':''}" ${i===3?'disabled':''} data-toast="${L('Hozzáadva','Added')}: ${esc(k.n)}" aria-label="${i===3?L(`${esc(k.n)} hozzáadva`,`${esc(k.n)} added`):L(`${esc(k.n)} hozzáadása`,`Add ${esc(k.n)}`)}">${i===3?I('i-check'):'+'}</button></span>`,l2:m3(k.p,k.c,k.f)})).join('')}`,
  /* VÁLASSZ RECEPTET (ReceptPickSheet) — a naplózó Recept-útja; választás után bezár. arg „ures” = nincs ilyen recept */
  receptpick:a=>`${sh('t-book',L('Válassz receptet','Pick a recipe'),L('Recept · hozzáadás','Recipe · add'))}<div class="fu-srow"><div class="fx-srch" data-toast="${L('Keresés a receptek között','Search the recipes')}">${bub('t-book',{s:28})}${L('Keress receptet…','Search recipes…')}</div><button class="fh-pill" data-ftog aria-pressed="false">${bub('t-star',{s:24})}${L('csillagos','starred')}</button></div>
    ${a==='ures'?empty('',L('Nincs ilyen recept.','No such recipe.')):REC.slice(0,5).map(r=>irow({icon:CAT[r.cat][1],title:r.n+(r.star?` <i class="fu-star" role="img" aria-label="${L('csillagos','starred')}">${I('t-star')}</i>`:''),sub:L(`${r.cat==='reggeli'?4:3} hozzávaló · adag`,`${r.cat==='reggeli'?4:3} ingredients · serving`),v:`<span class="fu-pk2"><span>${Math.round(r.kcal/r.serv)}<small>${L('kcal /adag','kcal /serving')}</small></span><button class="fx-add" data-close data-go="log.tetelek" aria-label="${L(`${esc(r.n)} hozzáadása`,`Add ${esc(r.n)}`)}">+</button></span>`,l2:m3(Math.round(r.p/r.serv),Math.round(r.c/r.serv),Math.round(r.f/r.serv))})).join('')}`,
  /* A LEGUTÓBBI HÉT HAT LÉPÉSE (LearnedBaseExplainerBody egy-egy cellája) */
  hw:i=>{i=+i||0;const [t]=HWT()[i]||HWT()[0];
    const G=[
      ()=>facts([['47',L('teljes nap felírt evéssel','complete days with eating logged')],['52',L('mérlegelés','weigh-ins')],['8',L('hét előzmény','weeks of history')]])+txt(L('Csak azokat a napokat számoltam, amikor az evésed teljesnek tűnt. A mai napot soha nem nézem, mert még tart.','I only counted the days when your eating looked complete. I never look at today, because it is still going.')),
      ()=>howSvg()+lgd([['liq',L('számít','counts')],['hatch',L('hiányosnak tűnt','looked incomplete')],['tr',L('súlytrend','weight trend')],['water',L('ebből víz','of which water')]]),
      ()=>[[L('Átlagosan ennyit ettél','On average you ate'),L('a 47 teljes napon','over the 47 complete days'),kc(2930),100,'t-bowl'],[L('− ami súlyként megmaradt','− what stayed as weight'),L(`+${fmt('0.12')} kg/hét valódi gyarapodás (víz nélkül)`,`+${fmt('0.12')} kg/week real gain (without water)`),'−132',95.5,'t-weight'],[L('− amit mozgással égettél','− what you burned by moving'),L('logolt mozgás, napi átlag','logged movement, daily average'),'−330',84.3,'t-steps']].map(([l,s,v,p,ic])=>`<div class="fu-gr">${bub(ic,{s:30})}<span><b>${l}</b><small>${s}</small></span><em>${v}</em>${level(p,{h:12})}</div>`).join('')+`<div class="fx-tot"><span>${L('= ennyit égetsz mozgás nélkül','= what you burn without movement')}</span><b>≈ ${kc(2470)}<small>kcal</small></b></div>`+note(L('A valódi számítás napról napra halad, és minden mérlegelés egy kicsit pontosít rajta. Ez a kerekített, egyszerű változata.','The real calculation moves day by day, and every weigh-in sharpens it a little. This is the rounded, simple version.')),
      ()=>tip('t-shield',L('4 hiányosnak tűnő nap','4 days that looked incomplete'),L('Jóval a szokásos evésed alatt voltak, ezért nem vettem kevés evésnek; kihagytam őket.','They were far below your usual eating, so I did not read them as light days; I left them out.'),'var(--warn)')+`<div class="fh-chips fu-chips">${[[8,30,604],[9,5,929],[9,25,1340],[10,2,1180]].map(([m,d,k])=>`<span>${dS(m,d)} · ${kc(k)}</span>`).join('')}</div>`
        +tip('t-shield',L('1 általad hiányosnak jelölt nap','1 day you marked incomplete'),L('Ezt te jelölted hiányosnak, ezért kihagytam.','You marked this one incomplete, so I left it out.'),'var(--warn)')+`<div class="fh-chips fu-chips"><span>${dS(9,28)} · ${kc(2150)}</span></div>`
        +tip('t-water',L(`Víz, nem zsír · ${dS(9,7)} körül`,`Water, not fat · around ${dS(9,7)}`),L(`A súlyod kb. ${fmt('1.2')} kg-ot ugrott. Ez víz és glikogén, ezért nem számoltam hízásnak.`,`Your weight jumped by about ${fmt('1.2')} kg. That is water and glycogen, so I did not count it as gaining.`),'var(--water)')
        +tip('t-calendar',L('9 nap felírás nélkül','9 days with no log'),L('Ezekből a napokból nem tanultam semmit, és nem is tippeltem helyettük.','I learned nothing from these days, and I did not guess in their place.'),'var(--faint)'),
      ()=>txt(L(`A mostani becslésem <b>±${LW.sd} kcal</b> pontos. Már elég sok adatot láttam, de a keretet továbbra is csak lépésenként igazítom.`,`My current estimate is accurate to <b>±${LW.sd} kcal</b>. I have seen quite a lot of data by now, but I still adjust the budget only step by step.`))+`<div class="fu-eqb">${level(50,{h:22})}</div><div class="fu-gb3">${CONF.map((c,k)=>`<span class="${k===LW.conf?'on':''}">${L(...c)}</span>`).join('')}</div>`+note(L('Minél több teljes napot és mérlegelést látok, annál biztosabb leszek.','The more complete days and weigh-ins I see, the surer I become.')),
      ()=>vials([[L('képlet','formula'),kc(LW.formula),40,'var(--faint)'],[L('a korábbi igazításaiddal','with your earlier adjustments'),kc(LW.start),48,'var(--dom)'],[L('e heti lépés','this week’s step'),'+'+LW.step,24,'var(--ok)'],[L('most','now'),kc(LW.base),72,'var(--dom)']].map(([l,v,p,c])=>({l,v,p,c,on:{toast:`${l}: ${v}`}})),{h:92})+txt(L('Hetente csak kis lépést teszek, és új irányba először csak félig; egy furcsa hét így nem rántja el a keretet.','I take only a small step each week, and only half a step in a new direction at first; this way one odd week does not yank the budget.'))];
    return `${sh('t-lens',`${i+1}. ${t}`,`${L('a legutóbbi hét','the latest week')} · ${dR(...LW.r)}`)}${(G[i]||G[0])()}${acts((i>0?lk(L('Előző','Previous'),{sheet:'hw',arg:i-1}):'')+(i<5?btn(L('Következő lépés','Next step'),{sheet:'hw',arg:i+1},'sm'):'')+closeLk(L('Bezárom','Close')))}`}
};
/* ═══ LAPOK — B terület (Kiegészítők · Trendek) ═══ */
const sheetsB={
  /* day = FuelWeekDayGlass + DayMealList — arg: "<hét-állapot>|<nap 0–6>[|tolt|tetelnelkul]" (a hét-állapot a trendek argja: '' = ez a hét, mult = a múlt hét, kimelo …)
     Három arc: kímélő nap · nem naplózott nap (a hét még hátralévő napja is így nyílik ma — viselkedés nem változott) · rendes nap. A nap étkezéseit a doboz csak megnyitáskor és csak naplózott napon kéri le. */
  day:a=>{const pa=String(a??'').split('|'), [stt,w,face]=pa.length>1?pa:['',pa[0]], V=weekVM(stt), x=V.days[+w||0], dn=cap(dF(x.w,x.m,x.d));
    const goDay=x.go||{toast:L('A nap lapja nyílik a Mai oldalon','Opens the day’s page under Today')};
    const bye=acts(closeLk());
    if(x.rec) return `${sh('t-kimelo',L('Kímélő nap','Gentle day'),dn)}
      ${tip('t-info',L('Így számolom','How I count it'),x.logged?L(`Amit ezen a napon ettél (${kc(x.kcal)} kcal), nem mérem a kerethez, és a heti értékelésbe sem számít bele. A beírt étkezéseid megmaradnak.`,`What you ate that day (${kc(x.kcal)} kcal) isn’t measured against the budget and doesn’t count in the weekly rating. The meals you logged stay.`)
        :L('Amit ezen a napon ettél, nem mérem a kerethez, és a heti értékelésbe sem számít bele. A beírt étkezéseid megmaradnak.','What you ate that day isn’t measured against the budget and doesn’t count in the weekly rating. The meals you logged stay.'))}
      ${row({icon:'t-journal',title:L('Megnézem a napot','Open the day'),sub:L('Az étkezések a nap lapján','Its meals on the day’s page'),on:goDay})}${bye}`;
    if(!x.logged) return `${sh('t-plate',dn,L('nincs adat','no data'))}
      <div class="fu-ng"><span class="gg">${fill(BOWL,{vb:BOWLVB,p:0,s:120})}</span><div class="nn"><span class="fh-big">—</span></div></div>
      ${tip('t-info',L('Őszintén','No data for this day'),L('Ezen a napon nem naplóztál. Nem töltjük ki becsléssel, és a heti átlagból is kimarad.','You didn’t log on this day. We don’t fill it with a guess, and it stays out of the weekly average.'))}
      ${row({icon:'t-journal',title:L('Pótolom a napot','Fill in the day'),sub:L('A nap saját lapján bármikor felvehető','You can add it on the day’s own page any time'),on:goDay})}${bye}`;
    const over=x.over?x.kcal-x.t:null, [tp,tc,tf]=tgM(x.t), ms=dayMeals(x);
    /* a két étkezés-dimenzió a napi értékelésből (0–100): a pont a szint; a tények soronként. A Minőségnek ma nincsenek napi ténysorai: a megjegyzés csak pont nélkül áll alatta (az élő oldal ma pont mellett is kiírja — ez ellentmondás, itt javítva). null = „—”, szint nélkül. */
    const dim=(l,pctW,v)=>`${lab(`${l} · ${L(`a napi értékelés ${pctW}%-a`,`${pctW}% of the day’s rating`)}`)}<div class="fu-eqb">${v==null?level(0,{h:16,val:'—'}):level(v,{h:16,val:String(Math.round(v))})}</div>`;
    return `${sh('t-calendar',dn,L('étkezés-pont','meal score'))}
    <div class="fu-ng"><span class="gg">${fill(BOWL,{vb:BOWLVB,p:Math.min(100,x.kcal/x.t*94),s:120,c:x.over?'color-mix(in srgb,var(--warn) 55%,#fff)':'var(--liq1)',c2:x.over?'var(--warn)':'var(--liq2)'})}</span><div class="nn"><span class="fh-big">${x.score==null?'—':sc1(x.score)}${x.score==null?'':'<small>/ 10</small>'}</span><p>${kc(x.kcal)} / ${kc(x.t)} kcal${x.train?` · ${L('edzésnap','training day')}`:''}${x.score==null?`<br>${L('még nincs étkezés-pont','no meal score yet')}`:''}</p></div></div>
    ${txt((x.train?L(`A kereted ezen a napon <b>${kc(x.t)} kcal</b> volt, edzésnapra igazítva.`,`Your budget that day was <b>${kc(x.t)} kcal</b>, adjusted for a training day.`):L(`A kereted ezen a napon <b>${kc(x.t)} kcal</b> volt.`,`Your budget that day was <b>${kc(x.t)} kcal</b>.`))+' '
      +(over!=null?L(`${kc(over)} kcal-lal fölé ment; így alakult.`,`It went ${kc(over)} kcal over.`):L('Belefértél; így alakult.','You stayed within it.')))}
    ${dim(L('Táplálkozás','Nutrition'),30,x.nut)}
    ${mrow(L('Kalória','Calories'),`<b>${kc(x.kcal)}</b> / ${kc(x.t)} kcal`,pc(x.kcal,x.t),'var(--dom)','t-plate')}${mrow(L('Fehérje','Protein'),`<b>${x.mac[0]}</b> / ${tp} g`,pc(x.mac[0],tp),'var(--protein)','t-meat')}${mrow(L('Szénhidrát','Carbs'),`<b>${x.mac[1]}</b> / ${tc} g`,pc(x.mac[1],tc),'var(--carb)','t-carb')}${mrow(L('Zsír','Fat'),`<b>${x.mac[2]}</b> / ${tf} g`,pc(x.mac[2],tf),'var(--fat)','t-avocado')}
    ${dim(L('Minőség','Quality'),15,x.q)}
    ${x.q==null?note(L('Ehhez a szemponthoz még nincs elég adat ezen a napon.','Not enough data for this aspect on this day yet.')):''}
    ${lab(L('A nap étkezései','The day’s meals'))}
    ${face==='tolt'?txt(L('Töltjük a nap étkezéseit…','Loading the day’s meals…')):face==='tetelnelkul'||!ms.length?txt(L('Erről a napról nincs tételes étkezés mentve.','No itemised meals are saved for this day.'))
      :ms.map(m=>row({icon:'t-plate',title:m.name,sub:`${m.time} · ${kc(m.kcal)} kcal`,v:m.score==null?null:sc1(m.score),on:m.go||{toast:L('Az étkezés oldala nyílik','Opens the meal’s page')}})).join('')}
    ${row({icon:'t-journal',title:L('Megnézem a napot','Open the day'),sub:L('Az étkezések és az értékelésük a nap lapján','Its meals and their ratings on the day’s page'),on:goDay})}
    ${note(L('A napi értékelés hat szempontból áll; itt a két étkezéshez tartozó látszik. A többi (edzés, alvás, naplózás, ritmus) az Én oldal napi nézetén él.','The day’s rating has six aspects; the two about eating are shown here. The rest (training, sleep, logging, rhythm) live in the day view under Me.'))}${bye}`},
  /* item = FuelStackItemGlass — arg: "<sorszám a protokollban>[|nincsadat|nincspolcon]". A dobozban NINCS készlet-szint és „meddig elég”: a Kamra csak a készletet és az egységét tudja. */
  item:a=>{const [ix,face]=String(a??'6').split('|'), V=stackVM(''), r=V.rows[+ix]||V.rows[0], noShelf=face==='nincspolcon', bare=face==='nincsadat', dose=bare?null:r.dose, stock=bare||noShelf?null:stockT(r);
    const place=r.pin?L('kézi elhelyezés','placed by hand'):L(...{rule:['okos elhelyezés','smart placement'],llm:['okos elhelyezés','smart placement'],user:['saját döntés','your choice'],fallback:['alapértelmezett hely','default time']}[r.src]);
    return `${sh('t-supps',r.n,`${dose??'—'} · ${L('naponta','daily')}`)}
    <div class="fh-chips fu-chips"><span>${zl(r.z)} · ${r.time}</span><span>${place}</span><span>${r.taken?`${L('bevéve','taken')} ${r.at}`:L('ma még nincs bevéve','not taken yet today')}</span></div>
    ${acts(`<button class="btn sm" data-fbtk="${r.i}">${r.taken?L('Mégsem vettem be','Undo'):L('Bevettem','Mark as taken')}</button>`)}
    ${dose||stock?lab(L('Ebből a termékből','From this product'))+kv([[L('Napi adag','Daily dose'),dose??'—'],...(r.form&&!bare?[[L('Kiszerelés','Form'),formT(r.form)]]:[]),...(stock?[[L('Készleten','In stock'),stock]]:[]),...(r.hint?[[L('Napi összmennyiség','Daily total'),r.hint]]:[])]).replace('class="fu-kv"','class="fu-kv fb-kv"')
      :lab(L('Termékadatok','Product details'))+txt(L('Nincs megadva, mennyi van egy egységben. A beállítóban pótolhatod, és megmondom, hány kell belőle.','The amount per unit is missing. Add it in setup and I’ll tell you how many you need.'))+row({icon:'t-gear',title:L('Beállítom','Set it up'),on:'stack-uj.1'})}
    ${lab(L('Miért így','Why this way'))}${txt(r.why??(r.pin?L(`Ide raktad kézzel: ${zl(r.z)}.`,`You placed it here yourself: ${zl(r.z)}.`):L('Az elhelyezéshez nem tartozik indok.','No reason is recorded for this placement.')))}
    ${noShelf?lab(L('Nincs a kamrádban','Not in your pantry'))+txt(L('A protokollodban ott van, a Kamrádban nem. Ha felveszed a Konyhában, innen is elérhető lesz.','It’s in your protocol but not in your pantry. Add it in Kitchen and you can open it from here.'))
      :row({icon:'t-stack',title:r.n,sub:stock?L(`${stock} a kamrádban`,`${stock} in your pantry`):L('a kamrádban','in your pantry'),on:'kamra.'+r.id})}
    ${note(NOTE1())}${acts(closeLk())}`},
  /* stackitem = StackItemSheet — arg: a tétel sorszáma. A dózis elhagyáskor mentődik; mozgatás, visszaállítás és eltávolítás bezárja a lapot; a „még egy bevétel” nyitva hagyja. */
  stackitem:a=>{const V=stackVM(''), r=V.rows[+String(a??'1').split('|').pop()]||V.rows[1], k=KAM.find(x=>x.id===r.id)||{};
    return `${sh('t-supps',r.n,`${L('Kiegészítők · időzítés','Supplements · timing')}${r.dose?` · ${r.dose}`:''}`)}
    ${r.pin?`<div class="fu-tip">${bub('t-pin',{s:38})}<span><b>${L(`Ide raktad kézzel (${zl(r.z)})`,`You placed it here yourself (${zl(r.z)})`)}</b></span></div>${acts(`<button class="btn sm ghost" data-close>${L('Vissza automatikusra','Back to automatic')}</button>`)}`
      :`<div class="fu-tip">${bub('t-bolt',{s:38})}<span><small class="fb-why">${r.why??L('Automatikusan időzítve.','Timed automatically.')}</small></span></div>`}
    ${lab(L('Áthelyezés másik idősávba','Move to another time slot'))}<div class="fh-pills">${ZO.map(z=>z===r.z?`<button class="fh-pill on" disabled aria-label="${esc(L(`${zl(z)} (most itt van)`,`${zl(z)} (it is here now)`))}">${zl(z)}</button>`:`<button class="fh-pill" data-close>${zl(z)}</button>`).join('')}</div>
    ${fld(L('Dózis','Dose'),r.dose||'')}
    ${lab(L('+ Még egy bevétel','+ One more intake'))}${pick(ZO.map(z=>zl(z)),zl('wake'),L('Idősáv','Time slot'))}
    <div class="fb-add">${inp(L('Új bevétel dózisa','Dose of the new intake'),k.dose||'',L('Dózis','Dose'))}${btn(L('Hozzáadás','Add'),{toast:L('Még egy bevétel hozzáadva','One more intake added')},'sm ghost')}</div>
    ${r.hint?note(r.hint):''}
    ${acts(`<button class="fh-lk" data-close>${L('Eltávolítás a kiegészítőim közül','Remove from my supplements')}</button>`+closeLk())}`},
  /* dose = LogDoseSheet: az időpont nem kötelező (üresen a ciklus a dátumhoz igazodik); a dózis alapértéke az utolsó beadás; a jegyzet diktálható */
  dose:()=>`${sh('t-syringe',L('Új beadás','New dose'),`${L('Beadás','Dose')} · ${MED.name}`)}
    <div class="fx-two"><div>${fld(L('Dátum','Date'),EN()?'7 Oct 2026':'2026. 10. 07.')}</div><div>${fld(L('Időpont','Time'),'','--:--')}</div></div>
    ${lab(L('Dózis','Dose'))}<div class="fb-unit">${inp(L('Dózis','Dose'),fmt(MED.dose),fmt(MED.dose))}<span>${MED.unit}</span></div>
    ${lab(L('Jegyzet','Note'))}<div class="fb-unit">${inp(L('Jegyzet','Note'),'',L('pl. hétfő reggel, has','e.g. Monday, abdomen'))}<button class="fb-mic" data-toast="${L('Diktálás','Dictate')}" aria-label="${L('Diktálás','Dictate')}">${I('t-mic')}</button></div>
    ${acts(`<button class="btn sm" data-close>${L('Rögzítem','Log dose')}</button>`+closeLk(L('Mégse','Cancel')))}`,
  /* medform = MedicationFormSheet — arg: szerk = szerkesztés (a ciklus fázis-beosztása változatlan marad). A hét napja csak heti kadenciánál látszik. A mentés addig tiltott, amíg név, hatóanyag, dózis és egység nincs. */
  medform:a=>{const ed=a==='szerk';
    return `${sh('t-syringe',ed?L('Gyógyszer szerkesztése','Edit medication'):L('Gyógyszer felvétele','Add medication'),L('Gyógyszer','Medication'))}
    <div class="fx-two"><div>${fld(L('Név','Name'),ed?MED.name:'',L('pl. Retatrutid','e.g. Retatrutide'))}</div><div>${fld(L('Hatóanyag','Active ingredient'),ed?MED.ing:'',L('retatrutid','retatrutide'))}</div></div>
    ${lab(L('Beviteli út','Route'))}${pick(Object.values(MROUTE).map(x=>L(...x)),L(...MROUTE.subQ),L('Beviteli út','Route'))}
    <div class="fx-two"><div>${fld(L('Dózis','Dose'),ed?fmt(MED.dose):'','4')}</div><div>${fld(L('Egység','Unit'),'mg','mg')}</div></div>
    ${lab(L('Gyakoriság','How often'))}${pick([L('heti','weekly'),L('napi','daily')],L('heti','weekly'),L('Gyakoriság','How often'))}
    ${lab(L('Beadás napja','Dose day'))}${pick([0,1,2,3,4,5,6].map(w=>wd(w)),wd(0),L('Beadás napja','Dose day'))}
    ${lab(L('Ciklus · fázisok','Cycle · phases'))}<div class="fu-off">${cyc(-1,0)}</div>
    ${note(ed?L(`${MED.len} napos ciklus; a fázis-beosztás változatlan marad.`,`${MED.len}-day cycle; the phase layout stays as it is.`):L(`Alap-sablon: ${phDays()}; a beadás napjától számolva.`,`Default template: ${phDays()}, counted from the dose day.`))}
    ${acts(`<button class="btn sm" data-close>${ed?L('Mentés','Save'):L('Felveszem','Add')}</button>`+closeLk(L('Mégse','Cancel')))}`},
};
const sheets={
  ...sheetsA,
  ...sheetsB,
  ...sheetsC,
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

/* ═══ CSS — A terület (Mai · étkezés · értékelés · logolás · tanulás és a lapjaik) ═══ */
const QA='.phone.foly[data-s="elo"][data-d="fuel"]';
const cssA=`
${QA} .fm-g.plain{grid-template-columns:1fr;justify-items:center}
${QA} .fu-bh.est .fm-n b{color:var(--sub)}
${QA} .fx-dn .mid{width:auto;height:auto;flex:1;min-width:0;background:none;box-shadow:none;padding:0;display:block;text-align:center}
${QA} .fx-dn .mid small{display:block;font-size:11.5px;font-weight:650;color:var(--sub);text-transform:uppercase;letter-spacing:.4px}
${QA} .fx-dn .mid b{display:block;font-family:var(--disp);font-size:16px;font-weight:700;line-height:1.2}
${QA} .fu-kms{display:flex;align-items:center;gap:10px;width:auto;margin:12px 14px 0;padding:8px 14px 8px 8px;border-radius:999px;background:#fff;box-shadow:${RIM},0 10px 16px -14px var(--liq2);font-size:13px;color:var(--sub);text-align:left;line-height:1.3}
${QA} .fu-kms>span:not(.fb){flex:1;min-width:0}${QA} .fu-kms b{color:var(--ink)}
${QA} .fu-kms .chev{width:18px;height:18px;color:var(--faint);flex:0 0 auto}
${QA} .fu-kms.warn{background:color-mix(in srgb,var(--warn) 9%,#fff)}
${QA} div.fu-kms{border-radius:24px}
${QA} .fu-kmn{padding:10px 16px}
${QA} .fu-dot{display:inline-block;width:8px;height:10px;margin-left:7px;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.35);vertical-align:1px}
${QA} .btn .fu-dot{background:#fff}${QA} .fu-dot.hold{background:none;box-shadow:inset 0 0 0 2px #fff}
${QA} .fu-mark{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
${QA} .fu-mark>span:not(.fb){flex:1;min-width:190px}
${QA} .fu-mark b{display:block;font-size:14.5px;font-weight:650;line-height:1.3}
${QA} .fu-mark small{display:block;font-size:12.5px;color:var(--sub);line-height:1.4;margin:2px 0 4px}
${QA} .fu-mark .fh-lk{font-size:13px}
${QA} .fm-chip.g0{color:var(--ok);background:color-mix(in srgb,var(--ok) 10%,#fff)}
${QA} .fm-chip.g1{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,#fff)}
${QA} .fm-chip.g2{color:var(--lilac);background:color-mix(in srgb,var(--lilac) 11%,#fff)}
${QA} .fm-chip .fu-gmini{width:26px;height:12px;flex:0 0 auto}
${QA} .fm-chip.pend{color:var(--sub);font-family:var(--ff);font-size:12.5px;font-weight:600}
${QA} .fm-mn strong{font-size:15.5px;line-height:1.3}
${QA} .fm-when .now{color:var(--dom);font-weight:700}
${QA} .fm-la{flex-wrap:nowrap;margin-top:12px}
${QA} .fm-log{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 18px;text-align:left;white-space:normal}
${QA} .fm-log span{font-weight:700}${QA} .fm-log small{font-size:11px;font-weight:500;opacity:.9}${QA} .fm-log.ghost small{color:var(--sub);opacity:1}
${QA} .fm-ska{gap:8px 14px;margin-top:10px}
${QA} .fm-clock.live{box-shadow:0 0 0 3px color-mix(in srgb,var(--liq1) 45%,transparent),0 8px 12px -8px rgba(10,42,60,.45)}
${QA} .fu-mac.lead .k2-vial:first-child .k2-tube{box-shadow:inset 0 0 0 2.5px var(--protein),0 12px 16px -12px var(--protein)}
${QA} .fu-mac .k2-tube em{font-size:9px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;white-space:nowrap}
${QA} .fu-gl small i{display:block;font-style:normal;font-weight:500;color:var(--sub)}
${QA} .fu-tags{display:flex!important;gap:5px;flex-wrap:wrap;margin-top:4px}
${QA} .fu-tags em{display:inline-flex;align-items:center;gap:5px;font-style:normal;font-size:11px;font-weight:650;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--dom) 7%,#fff);color:var(--sub)}
${QA} .fu-tags em i{width:7px;height:7px;border-radius:50%;background:var(--c)}
${QA} .fu-tags em.w{color:var(--warn);background:color-mix(in srgb,var(--warn) 12%,#fff)}
${QA} .fu-q .fh-stat{min-height:118px}${QA} .fu-q .fh-stat .n{font-size:24px}${QA} .fu-q .fh-stat .n small{display:block;margin:3px 0 0}
${QA} .fu-8 .k2-vial small i{white-space:nowrap}
${QA} .fu-pendl{color:#fff;font-weight:700;font-size:15px}
${QA} .fu-mac .k2-tube em{letter-spacing:0}
@media(max-width:360px){${QA} .fh-hero.warn .fh-hrow{flex-direction:column;align-items:flex-start;gap:8px}${QA} .fu-8 .k2-vial small i{font-size:9px;letter-spacing:-.2px}}
${QA} .fu-imp{color:var(--ok)}
${QA} .fu-impc .fh-row strong{font-weight:500;line-height:1.4}
${QA} .fu-fb{display:flex;align-items:center;gap:10px}${QA} .fu-fb>span{flex:1;font-size:14px;color:var(--sub)}
${QA} .fu-sc .fh-big{font-size:56px}
${QA} .fu-gcv{margin:6px 0 10px}${QA} .fu-gcv text{font-size:9px}
${QA} .fu-tip>em{font-style:normal;font-family:var(--disp);font-weight:800;font-size:14px;white-space:nowrap;align-self:center}
${QA} .fu-ob{text-align:center;margin:4px 0 6px}
${QA} .fu-ob small{display:block;font-size:11.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--sub)}
${QA} .fu-ob .fh-big{display:block;font-size:38px;margin:4px 0}
${QA} .fu-ob p{font-size:13px;color:var(--sub);margin-bottom:6px}
${QA} .fu-dd24{display:block;width:min(100%,230px);height:auto;margin:6px auto 4px}
${QA} .fu-dd24 text.hr{font:600 11px var(--mono,var(--ff));fill:var(--faint)}
${QA} .fu-dd24 text.c1{font:700 9.5px var(--ff);letter-spacing:.6px;fill:var(--sub)}
${QA} .fu-dd24 text.c2{font:800 21px var(--disp);letter-spacing:-.6px;fill:var(--ink)}
${QA} .fu-dd24 text.c3{font:600 10.5px var(--ff);fill:var(--sub)}
${QA} .fu-dd24 use{--ic:var(--sub);--ic2:transparent;color:var(--sub)}
${QA} .fu-lg{justify-content:center}
${QA} .fu-lg i.oth{background:color-mix(in srgb,var(--liq2) 34%,#fff)}${QA} .fu-lg i.trn{height:4px;background:var(--protein)}${QA} .fu-lg i.ngt{background:rgba(10,42,60,.16)}
${QA} .fu-ogl{display:flex;align-items:center;gap:10px;color:var(--gc);margin-bottom:8px}
${QA} .fu-ogl .fu-gmini{width:84px;height:38px;flex:0 0 auto}${QA} .fu-ogl b{font-family:var(--disp);font-size:18px;font-weight:800;color:var(--ink)}
${QA} .fu-eq3{display:flex;align-items:stretch;gap:8px;margin:6px 0 8px}
${QA} .fu-eq3>span{flex:1;min-width:0;padding:10px 10px;border-radius:18px;background:color-mix(in srgb,var(--dom) 6%,#fff)}
${QA} .fu-eq3>span.res{background:linear-gradient(135deg,var(--liq1),var(--liq2));color:#fff}
${QA} .fu-eq3 b{display:block;font-family:var(--disp);font-size:18px;font-weight:800;letter-spacing:-.4px}
${QA} .fu-eq3 small{display:block;font-size:10.5px;line-height:1.25;color:var(--sub);margin-top:2px}${QA} .fu-eq3 .res small{color:rgba(255,255,255,.9)}
${QA} .fu-eq3>i{align-self:center;font-style:normal;font-weight:700;color:var(--faint)}
${QA} .fu-eqc{display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;color:var(--sub);margin-top:5px}
${QA} .fu-dd24 text.c2.rng{font-size:16px;letter-spacing:-.4px}
${QA} .fu-pend{display:block;font-style:normal;color:var(--dom);font-weight:650;margin-top:2px}
${QA} .fu-wat .fh-big{display:block;font-size:52px}
${QA} .fu-wch{justify-content:center;margin:4px 0 12px}
${QA} .fu-wman{display:flex;align-items:center;gap:10px;margin-bottom:6px}${QA} .fu-wman .fh-in{flex:1;min-width:0}${QA} .fu-wman span{font-size:13px;color:var(--sub);white-space:nowrap}
${QA} .fu-pk2{display:inline-flex;align-items:center;gap:10px}${QA} .fu-pk2>span{text-align:right;line-height:1.1}${QA} .fu-pk2 small{display:block!important;font-family:var(--ff);font-size:10.5px;font-weight:500;margin:0!important}
${QA} .fu-srow{display:flex;gap:8px;align-items:center;margin-bottom:8px}${QA} .fu-srow .fx-srch{flex:1;min-width:0}${QA} .fu-srow .fh-pill{padding:4px 12px 4px 4px;flex:0 0 auto}
${QA} .fu-star{display:inline-block;width:15px;height:15px;vertical-align:-2px}${QA} .fu-star svg.ic{width:15px;height:15px}
/* logolás */
${QA} .fu-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
${QA} .fu-modes.three{grid-template-columns:repeat(3,1fr)}
${QA} .fu-modes button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 2px 10px;border-radius:22px;background:color-mix(in srgb,var(--dom) 5%,#fff);font-size:11px;letter-spacing:-.3px;font-weight:650;text-align:center;line-height:1.15;min-width:0;overflow:hidden}
${QA} .fu-modes button>span:not(.fb){max-width:100%;padding:0 4px;overflow:hidden;text-overflow:ellipsis}
${QA} .fu-modes button.on{box-shadow:inset 0 0 0 2.5px var(--liq2)}
${QA} .fu-modes small{font-size:10.5px;font-weight:500;color:var(--sub);line-height:1.2}
${QA} .fu-modes + .fx-cmp{margin-top:12px}
${QA} .fx-ph.has{height:auto;padding:12px;flex-direction:row;gap:12px;justify-content:flex-start;border-style:solid}
${QA} .fu-pimg{flex:0 0 auto;width:72px;height:72px;border-radius:16px;display:grid;place-items:center;background:color-mix(in srgb,var(--dom) 12%,#fff)}
${QA} .fu-pcap{flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left;flex-wrap:wrap}${QA} .fu-pcap>span{flex:1;min-width:90px}
${QA} .fu-pcap strong{display:block;font-size:14px}${QA} .fu-pcap small{display:block;font-size:12px;color:var(--sub)}
${QA} .fu-x{width:32px;height:32px;border-radius:50%;background:var(--page);display:grid;place-items:center;font-size:18px;line-height:1;color:var(--sub);flex:0 0 auto}
${QA} .fu-fail{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:8px 4px}
${QA} .fu-fail small{font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#9A6708}
${QA} .fu-fail strong{font-family:var(--disp);font-size:18px;font-weight:800}${QA} .fu-fail p{font-size:13.5px;color:var(--sub);line-height:1.45;margin-bottom:6px}
${QA} .fu-lns0{padding:6px 16px}
${QA} .fu-ln{padding:14px 0;border-top:1px solid var(--hair)}${QA} .fu-ln:first-child{border-top:0}
${QA} .fu-lnt{display:flex;align-items:flex-start;gap:10px}${QA} .fu-lnt .g{flex:1;min-width:0}
${QA} .fu-lnt strong{display:block;font-size:15px;font-weight:650;line-height:1.3}
${QA} .fu-lns{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 8px}
${QA} .fu-lns .fx-stp .fh-in{width:64px;padding:7px 4px;text-align:center;font-family:var(--disp);font-weight:700;font-size:16px}
${QA} .fu-lnk b{font-family:var(--disp);font-size:18px;font-weight:800}${QA} .fu-lnk small{font-size:11.5px;color:var(--sub);margin-left:3px}
${QA} .fu-lnm,${QA} .fu-nut{display:flex;gap:6px}
${QA} .fu-lnm span,${QA} .fu-nut span{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;padding:6px 8px;border-radius:12px;background:color-mix(in srgb,var(--c,var(--dom)) 8%,#fff)}
${QA} .fu-lnm i{display:none}
${QA} .fu-lnm b,${QA} .fu-nut b{font-size:13px;font-weight:700;white-space:nowrap}${QA} .fu-lnm small,${QA} .fu-nut small{font-size:10.5px;color:var(--sub);white-space:nowrap}
${QA} .fu-nut{margin-top:6px}${QA} .fu-nut span{background:var(--page)}
${QA} .fu-tune{margin-top:10px;border-radius:16px;background:var(--page);padding:4px 12px}
${QA} .fu-tuh{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:8px 0;font-size:12.5px;text-align:left}
${QA} .fu-tuh b{font-weight:700}${QA} .fu-tuh span{color:var(--dom);font-weight:650;white-space:nowrap}
${QA} .fu-tur{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--hair);flex-wrap:wrap}
${QA} .fu-tur .g{flex:1;min-width:110px}${QA} .fu-tur strong{display:block;font-size:13.5px;font-weight:600}${QA} .fu-tur small{display:block;font-size:11.5px;color:var(--sub)}
${QA} .fu-tur.ch strong{color:var(--dom)}${QA} .fu-tur .fx-stp button{background:#fff}
${QA} .fh-foot .btn.ghost:only-child{flex:1 1 auto}
${QA} .fu-twt{padding:0!important}${QA} .fu-car{color:var(--faint);font-size:13px}
${QA} .fu-twt + .fx-time{margin-top:12px}
${QA} .fu-del{background:var(--bad)!important;box-shadow:0 10px 20px -10px var(--bad)!important}
${QA} .fu-segc .fh-seg{margin:0}
/* ceremónia */
${QA} .fu-cer{text-align:center;padding-bottom:22px}${QA} .fu-cer::before,${QA} .fu-cer::after{display:none!important}
${QA} .fu-cer .verdict{font-size:30px;margin:6px 0 0}
${QA} .fu-cst{display:flex;justify-content:center;gap:6px;margin:12px 0 4px}
${QA} .fu-cst i{width:34px;height:34px;display:block;--ic:var(--faint);--ic2:transparent}
${QA} .fu-cst i.on{--ic:#D99A2B;--ic2:#F6CB5A}${QA} .fu-cst svg.ic{width:34px;height:34px}
${QA} .fu-ccup{margin:0 auto;width:min(100%,220px)}
${QA} .fu-ccup svg{display:block;width:100%;height:auto;filter:drop-shadow(0 16px 18px color-mix(in srgb,var(--liq2) 35%,transparent))}
${QA} .fu-ccup text.n{font:800 44px var(--disp);letter-spacing:-2px;fill:#fff}
${QA} .fu-ccup small{display:block;font-size:12px;font-weight:650;color:var(--sub);margin-top:2px}
${QA} .fu-cfc .fh-facts{margin:0}
@media (prefers-reduced-motion:no-preference){body:not(.still) ${QA} .fu-ccup .lq{animation:fucr 1.5s cubic-bezier(.2,.8,.2,1) both .2s}}
@keyframes fucr{from{transform:translateY(110px)}}
@media(max-width:360px){
  ${QA} .fu-ng .nn .fm-cells{gap:4px}${QA} .fu-ng .nn .fm-cells .fl-mini{min-width:26px}${QA} .fu-lh .fu-pour{width:98px!important}${QA} .fu-lh .verdict{hyphens:manual;font-size:20px}
  ${QA} .fu-modes button{font-size:10.5px;padding:10px 0 8px}${QA} .fu-modes .fb{--s:30px!important}
  ${QA} .fu-sc .fh-big{font-size:44px}
  ${QA} .fm-la{flex-wrap:wrap}
  ${QA} .fu-eq3 b{font-size:15px}${QA} .fu-eq3>span{padding:8px 7px}
  ${QA} .fu-lnm span,${QA} .fu-nut span{padding:5px 5px}${QA} .fu-nut small{font-size:9.5px}
  ${QA} .fu-cst i,${QA} .fu-cst svg.ic{width:28px;height:28px}
  ${QA} .fu-lns .fx-stp .fh-in{width:54px}
  ${QA} .fu-q .fh-stat .n{font-size:20px}
}
`;

/* ═══ CSS — B terület (Kiegészítők · Protokoll · Új elem · Gyógyszer · Trendek és a lapjaik) ═══ */
const cssB=`
${QA} .fb-dim .fh-row strong{color:var(--sub)}
${QA} .fb-ghost i{opacity:.55}
${QA} .fh-n .st{margin-left:6px;vertical-align:middle}
${QA} .fb-zv .k2-vial{min-width:0}
${QA} .fb-zv .k2-vial small{font-size:10.5px;line-height:1.15;overflow-wrap:break-word}
${QA} .fb-nw{white-space:nowrap}
${QA} .fb-kv>div:last-child:nth-child(odd){grid-column:1/-1}
${QA} .fb-rc{font-size:12.5px;line-height:1.35;color:var(--sub);font-weight:600}
${QA} .fb-wn{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;margin:12px 14px 0}
${QA} .fb-wn button{height:38px;padding:0 12px;border-radius:13px;background:rgba(255,255,255,.85);box-shadow:0 4px 10px -6px rgba(15,30,51,.3),inset 0 0 0 1px rgba(15,30,51,.05);font-size:13px;font-weight:650;white-space:nowrap;color:var(--ink)}
${QA} .fb-wn button[disabled]{opacity:.4}
${QA} .fb-wn b{text-align:center;font-family:var(--disp);font-size:15px;font-weight:700;min-width:0}
${QA} .fb-wnn{margin:8px 18px 0;font-size:12.5px;line-height:1.4;color:var(--sub);text-align:center}
${QA} .fu-wd em{display:grid;place-items:center;min-height:17px}
${QA} .fu-wd em svg{width:16px;height:16px}
${QA} .fu-wd.we .fu-tb{background:linear-gradient(180deg,color-mix(in srgb,var(--dom2) 14%,#fff),color-mix(in srgb,var(--dom2) 30%,#fff))}
${QA} .fu-wd.gap.we .fu-tb{background:color-mix(in srgb,var(--dom2) 12%,#fff)}
${QA} .fu-wd.rec .fu-tb i{background:linear-gradient(180deg,color-mix(in srgb,var(--lilac) 40%,#fff),color-mix(in srgb,var(--lilac) 75%,#fff))}
${QA} .fu-wd.we b{padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--dom2) 30%,#fff)}
${QA} .fu-wd small{display:block;width:6px;height:6px;border-radius:50%}
${QA} .fu-wd small.tr{background:#F2683A}
${QA} .fu-lg i.we{background:color-mix(in srgb,var(--dom2) 30%,#fff);box-shadow:inset 0 0 0 1px rgba(10,42,60,.1)}
${QA} .fu-lg i.rec{background:color-mix(in srgb,var(--lilac) 60%,#fff)}
${QA} .fu-lg i.tr{width:7px;height:7px;border-radius:50%;background:#F2683A}
${QA} .fu-lg i.dot{width:6px;height:6px;border-radius:50%;background:color-mix(in srgb,var(--ink) 38%,#fff)}
${QA} .fb-t3{grid-template-columns:repeat(3,1fr);gap:8px}
${QA} .fb-t3 .fh-stat{min-height:128px;padding:12px 10px}
${QA} .fb-t3 .fh-stat .ti{position:static;width:34px;height:34px;margin:0 0 8px}
${QA} .fb-t3 .fh-stat .ti svg.ic{width:22px;height:22px}
${QA} .fb-t3 .fh-stat .k{font-size:11.5px;line-height:1.2}
${QA} .fb-t3 .fh-stat .k{display:block}
${QA} .fb-t3 .fh-stat .n{font-size:21px;white-space:nowrap}
${QA} .fb-t3 .fh-stat .n small{font-size:10.5px}
${QA} .fb-t3 .fh-stat .s{font-size:11px;line-height:1.25;margin-top:6px}
${QA} a.fb-a{text-decoration:none;color:inherit}
${QA} .fb-stop{margin:10px 0 4px;padding:14px;border-radius:20px;outline:1.5px dashed var(--faint);outline-offset:-1.5px}
${QA} .fb-stop p{font-size:13.5px;line-height:1.45;margin:0 0 4px}
${QA} .fb-add,${QA} .fb-unit{display:flex;gap:8px;align-items:center;margin:8px 0}
${QA} .fb-add .fh-in,${QA} .fb-unit .fh-in{flex:1;min-width:0;margin:0}
${QA} .fb-unit>span{font-weight:650;color:var(--sub);padding:0 6px}
${QA} .fb-mic{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--dom) 8%,#fff);flex:0 0 auto}
${QA} .fb-mic svg{width:22px;height:22px}
${QA} .fb-why{font-size:13.5px!important;color:var(--ink)!important}
${QA} .fb-ser{display:block;width:100%;height:auto;margin:6px 0 2px}
${QA} .fu-cyc b{white-space:nowrap}
@media(max-width:360px){
  ${QA} .fb-zv .k2-vials{gap:4px}
  ${QA} .fb-zv .k2-vial small{font-size:8.5px;letter-spacing:-.2px}
  ${QA} .fb-wn{gap:5px;margin:12px 10px 0}
  ${QA} .fb-wn button{padding:0 8px;font-size:12px}
  ${QA} .fb-wn b{font-size:12.5px}
  ${QA} .fb-t3{gap:6px}
  ${QA} .fb-t3 .fh-stat{padding:10px 8px}
  ${QA} .fb-t3 .fh-stat .n{font-size:18px}
  ${QA} .fb-t3 .fh-stat .k{font-size:10.5px}
  ${QA} .fu-cyc b{font-size:9px}
}
`;

/* ═══ CSS — C terület (Konyha · Kamra · Receptek · Műhely · Beállítások · Ablakok és a lapjaik) ═══ */
const cssC=`
${QA} .fc-goals{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
${QA} .fc-goals span{display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;border-radius:999px;background:color-mix(in srgb,var(--dom) 7%,#fff);font-size:12px;font-weight:600;color:var(--sub);white-space:nowrap}
${QA} .fc-cats{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
${QA} .fc-cats button{display:inline-flex;align-items:center;gap:6px;padding:6px 10px 6px 12px;border-radius:999px;background:color-mix(in srgb,var(--dom) 10%,#fff);font-size:12.5px;font-weight:650;color:var(--ink);min-height:32px}
${QA} .fc-cats button b{font-size:15px;line-height:1;color:var(--sub)}
${QA} .fc-swap{border:1.5px dashed color-mix(in srgb,var(--dom) 40%,transparent);border-radius:18px;padding:12px}
${QA} .fc-swap>div{display:flex;align-items:center;gap:10px}${QA} .fc-swap>div>span{flex:1;min-width:0}
${QA} .fc-swap strong{display:block;font-size:15px;font-weight:650;line-height:1.3}${QA} .fc-swap small{font-size:12px;color:var(--sub)}
${QA} .fc-swap b{font-family:var(--disp);font-size:16px;font-weight:800;white-space:nowrap}
${QA} .fc-swap p{margin:8px 0 0;font-size:13.5px;line-height:1.45;color:var(--sub)}
${QA} .fc-sk{display:block;opacity:.5}
${QA} .fc-off{opacity:.62}
${QA} .fc-pk2{display:flex;flex-wrap:wrap;gap:6px;align-items:center}${QA} .fc-pk2 .fh-pills{display:contents}
${QA} .fc-pk2>.fh-pill{display:inline-flex;align-items:center;gap:6px;padding-left:4px}
${QA} .fh-in.fc-tag{width:108px;flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:13px}
${QA} .fh-in.fc-name{margin:10px 0 12px;font-family:var(--disp);font-weight:700;font-size:17px}
${QA} .fc-busy{display:flex;align-items:center;gap:10px;margin:12px 0 0;font-size:14px;font-weight:600;color:var(--sub)}
${QA} .fc-busy.big{flex-direction:column;gap:6px;padding:28px 0 20px;text-align:center}${QA} .fc-busy.big strong{font-family:var(--disp);font-size:18px;color:var(--ink)}${QA} .fc-busy.big small{font-size:12px}
${QA} .fc-err{margin-top:12px;padding:12px;border-radius:16px;background:color-mix(in srgb,var(--warn) 12%,#fff)}
${QA} .fc-err b{display:block;font-size:13.5px;line-height:1.4;font-weight:650}${QA} .fc-err .fh-acts{margin-top:8px}
${QA} .fc-last{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-top:12px;padding:8px 10px;border-radius:16px;background:var(--page)}
${QA} .fc-last span:not(.fb){flex:1;min-width:0;font-size:13px;line-height:1.4;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
${QA} .fc-steps{list-style:none;margin:0;padding:0;display:grid;gap:10px}
${QA} .fc-steps li{display:flex;gap:10px;font-size:14px;line-height:1.45}${QA} .fc-steps b{font-family:var(--disp);font-weight:800;color:var(--dom);flex:0 0 auto}
${QA} .fc-alert{margin:12px 14px 0;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--bad) 10%,#fff);color:var(--bad);font-size:13.5px;font-weight:650;line-height:1.4}
${QA} .fc-3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 8px;margin-top:6px}${QA} .fc-3>div{min-width:0}
${QA} .fc-4{display:grid;grid-template-columns:repeat(4,1fr);gap:0 8px}${QA} .fc-4>div{min-width:0}
${QA} .fc-3 .fh-in,${QA} .fc-4 .fh-in{padding:10px 8px;font-size:14px;min-width:0;width:100%}
${QA} .fc-3 .fh-lab,${QA} .fc-4 .fh-lab{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
${QA} .fc-days button{font-size:12.5px;padding-left:4px;padding-right:4px;white-space:nowrap}
${QA} .fc-anch{display:grid;grid-template-columns:1.25fr 1fr .8fr;gap:0 8px;align-items:end;margin-top:4px}${QA} .fc-anch>div{min-width:0}
${QA} .fc-anch .fh-in{padding:10px 8px;font-size:14px;width:100%;min-width:0}${QA} .fc-anch .fx-sel span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
${QA} .fc-anch .fx-stp{gap:4px}${QA} .fc-anch .fx-stp small{display:none}${QA} .fc-anch .fx-stp button{width:28px;height:36px}${QA} .fc-anch .fx-stp b{font-size:14px;min-width:34px}
${QA} .fc-anch .fh-lab{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
${QA} .fc-sum{display:flex;align-items:center;justify-content:space-between;margin:0 0 4px;font-size:13px;color:var(--sub)}
${QA} .fc-sum b{font-family:var(--disp);font-size:17px;font-weight:800;color:var(--ok);padding:2px 12px;border-radius:999px;background:color-mix(in srgb,var(--ok) 12%,#fff)}
${QA} .fc-sum b.off{color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,#fff)}
${QA} .fx-wv .fc-wt{flex:1 1 100%;color:var(--ink);font-weight:600}
${QA} .fx-wv>span:last-child{white-space:nowrap}
${QA} .fc-vd{padding:12px;border-radius:18px;background:color-mix(in srgb,var(--dom) 6%,#fff)}
${QA} .fc-vd>div{display:flex;align-items:center;gap:10px;margin-bottom:6px}${QA} .fc-vd>div>span:not(.fb):not(.st){flex:1;font-size:12px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--sub)}
${QA} .fc-vd p{margin:6px 0 0;font-size:14px;line-height:1.45}
${QA} .fx-ph.fc-drop{height:auto;min-height:76px;flex-direction:row;justify-content:flex-start;gap:12px;padding:12px;text-align:left}
${QA} .fx-ph.fc-drop>span:last-child{display:flex;flex-direction:column;min-width:0}${QA} .fx-ph.fc-drop small{font-size:12px;color:var(--sub);line-height:1.3}
${QA} .fc-log{padding:12px 0;border-top:1px solid var(--hair)}${QA} .fc-log:first-of-type{border-top:0}
${QA} .fc-log>div:first-child{display:flex;align-items:center;gap:10px;margin-bottom:8px}${QA} .fc-log .g{flex:1;min-width:0}
${QA} .fc-log strong{display:block;font-size:15px;font-weight:650}${QA} .fc-log small{font-size:12px;color:var(--sub)}
${QA} .fc-log .v{font-family:var(--disp);font-size:20px;font-weight:800}
${QA} .fc-log>p{margin:0 0 8px;font-size:13px;color:var(--sub)}
${QA} .fc-bub{max-width:88%;margin:8px 0;padding:10px 12px;border-radius:16px;background:var(--page)}
${QA} .fc-bub.me{margin-left:auto;background:color-mix(in srgb,var(--dom) 10%,#fff)}
${QA} .fc-bub small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.4px;color:var(--sub);margin-bottom:2px}${QA} .fc-bub p{margin:0;font-size:14px;line-height:1.45}
${QA} .fu-bubs{pointer-events:none}
${QA} .fh-pill.on .fb{background:rgba(255,255,255,.2);box-shadow:none;--ic:#fff;--ic2:rgba(255,255,255,.75);color:#fff}
${QA} .fu-shelf .fh-stat .k{padding-right:40px;white-space:normal;overflow:visible;overflow-wrap:anywhere;hyphens:auto}
${QA} .fu-shelf .fh-stat .n em{display:block;font-style:normal;font-size:19px;line-height:1.2;letter-spacing:-.4px}
@media(max-width:360px){${QA} .fu-shelf .fh-stat .n em{font-size:15px;letter-spacing:-.3px}}
${QA} .fx-n .fc-dn{display:block;font-size:24px;line-height:1.15;white-space:normal;letter-spacing:0}
${QA} .fx-two.fc-ws{align-items:start}
${QA} .fu-q .fh-grid>:nth-child(3):last-child{grid-column:1 / -1}
${QA} .fx-wv{flex-wrap:wrap;row-gap:4px}
@media (max-width:360px){
  ${QA} .fc-anch{grid-template-columns:1fr 1fr}${QA} .fc-anch>div:first-child{grid-column:1 / -1}
  ${QA} .fc-4{grid-template-columns:1fr 1fr}
  ${QA} .fx-two.fc-ws{grid-template-columns:1fr;gap:10px}
  ${QA} .fc-days button{font-size:11.5px}
  ${QA} .fu-ng .nn .fu-m3{flex-direction:column;gap:5px}
  ${QA} .fx-n .fc-dn{font-size:17px;letter-spacing:0}
  ${QA} .fu-tide text{font-size:11.5px}
  ${QA} .fc-swap>div{flex-wrap:wrap}${QA} .fc-swap>div>b{flex:1 1 100%;padding-left:50px}
}
`;

/* apró, újrarajzolás nélküli váltók: pipák, kapcsolók, választó-pirulák (közös); + a víz lapja és az étkezés kihagyása (A terület) */
if(!window.__fuelVil){window.__fuelVil=true;
  const rr=()=>F.go(F.R+(F.ARG?'.'+F.ARG:''));
  document.addEventListener('click',e=>{
  if(!e.target.closest||!e.target.closest('.phone[data-v="feher"][data-d="fuel"]')) return;
  const q=s=>e.target.closest(s);
  let b;
  if((b=q('[data-fwsel]'))){WSEL=WSEL===+b.dataset.fwsel?null:+b.dataset.fwsel;F.openSheet(waterSheet());return}
  if((b=q('[data-fwsave]'))){if(!WSEL)return;WAT=Math.min(6000,WAT+WSEL);WHIST.push(WSEL);const t=L(`Víz mentve · +${WSEL} ml`,`Water saved · +${WSEL} ml`);WSEL=null;F.closeSheet();if(F.R==='mai')rr();F.toast(t);return}
  if((b=q('[data-fwundo]'))){if(WHIST.length){WAT-=WHIST.pop();F.openSheet(waterSheet());F.toast(L('Visszavontam az utolsót','Undid the last one'))}return}
  if((b=q('[data-fskip]'))){SKIP[b.dataset.fskip]={};rr();F.openSheet(sheetsA.mealwhy(b.dataset.fskip));return}
  if((b=q('[data-fundo]'))){delete SKIP[b.dataset.fundo];rr();F.toast(L('Visszavonva · az étkezés visszakerült a napba','Undone · the meal is back in your day'));return}
  if((b=q('[data-fate]'))){delete SKIP[b.dataset.fate];F.go('log.w'+b.dataset.fate);return}
  if((b=q('[data-fwhy]'))){const [i,c]=b.dataset.fwhy.split('|');SKIP[i]={...(SKIP[i]||{}),c:+c,t:+c===5?'elhúzódott a megbeszélés':undefined};rr();F.openSheet(sheetsA.mealwhy(i));return}
  if((b=q('[data-fkm]'))){const [i,k]=b.dataset.fkm.split('|');SKIP[i]={...(SKIP[i]||{}),km:+k};F.openSheet(sheetsA.mealwhy(i));F.toast(L('Kímélő mód bekapcsolva','Gentle mode is on'));return}
  if((b=q('[data-fwhydone]'))){const s=SKIP[b.dataset.fwhydone]||{};F.closeSheet();rr();F.toast(L(`Megjegyeztem · ${skLabel(s)}`,`Noted · ${skLabel(s)}`));return}
  /* B terület: a kiegészítő pipája — átvált, újrarajzol (a nyitott dobozt is), és csak bevételkor szól („{név} bevéve”; az élő üzeneten „Visszavonás” gomb is van) */
  if((b=q('[data-fbtk]'))){const i=+b.dataset.fbtk,r=stackVM('').rows[i],on=!r.taken,inSheet=!!q('#sheet');TKN[i]=on;if(F.R==='stack')rr();if(inSheet)F.openSheet(sheets.item(String(i)));if(on)F.toast(L(`${r.n} bevéve`,`${r.n} taken`));return}
  if((b=q('[data-ftog]'))){const on=b.classList.toggle('on');b.setAttribute('aria-pressed',String(on));return}
  const t=q('[data-ftk],[data-fsw]');
  if(t){e.preventDefault(); const on=t.classList.toggle('on'); if(t.hasAttribute('data-fsw')) t.setAttribute('aria-checked',String(on));
    F.toast(t.hasAttribute('data-fsw')?(on?L('Bekapcsolva','Turned on'):L('Kikapcsolva','Turned off')):(on?L('Bevéve · 14:10','Taken · 14:10'):L('Visszavonva','Undone'))); return}
  const p=q('[data-fpick] .fh-pill'); if(p){p.parentNode.querySelectorAll('.fh-pill').forEach(x=>x.classList.toggle('on',x===p)); return}
  const m=q('[data-fmulti] .fh-pill'); if(m) m.classList.toggle('on');
});}

register('fuel',{title:'Fuel',
  tabs:[['Mai','mai'],['Kiegészítők','stack'],['Trendek','trendek'],['Konyha','konyha']],
  routes:{mai,meal,score,cer,log,konyha,kamra,receptek,recept,'recept-uj':editor,muhely,stack,protokoll,'stack-uj':stackUj,gyogyszer,trendek,beallitas,ablakok,tanulas},
  sheets,css:css+cssA+cssB+cssC,
  notes:`<h2>Fuel</h2>
<p>A Fuel minden oldala kapott egy saját, „folyadékos” grafikát, ami az oldal saját adatából rajzolódik. A karikák eltűntek (csak az étkezési óra maradt kerek, mert az tényleg óra), az ikonok üveg-buborékban ülnek.</p>
<h2>Mit érdemes megnézni</h2>
<ul>
<li><b>Mai:</b> a kalória-mérő egy <b>tál</b>, ami a napi keretig töltődik; balra amit ettél, jobbra ami még belefér, alatta egy mondat a maradékról és a hiányzó fehérjéről. Fent a <b>nap-lapozó</b> (az elmúlt 7 nap). Az öt makró öt kémcső (a Víz koppintható). Az étkezés-blokkokban kis edény mutatja az ablak keretét, a négy kis kapszula szintje az étkezés saját összetétele. Az üres ablaknál „Logolás ide” és „Kihagyom”. Lent: „Logolj bármit”, a tegnap pótolható ablakai, és hogy a nap számít-e a tanulásban.</li>
<li><b>Vércukor</b> (a színes címke egy étkezésen): pontosan az, amit az app ma tud: a sáv szava nagyban, a válasz görbéje, a tányér négy ténye, mit érzel majd (energia, alapszint, éhség), egy tipp mostanra, és két csere legközelebbre. Számot szándékosan nem ír.</li>
<li><b>Étkezési óra</b> (a kis óra a blokkon): 24 órás napóra az ablakkal, az edzéssel és az alvással. Logolás előtt: miért ekkor, hogyan illik a napodba; utána: eltaláltad-e az ablakot, vércukor-sáv, mire számíts.</li>
<li><b>Víz:</b> gyorsgomb vagy kézi érték, aztán Mentés; a pohár a mai szintet mutatja, szaggatottan azt, ahová a választott adag vinné.</li>
<li><b>Egy étkezés:</b> mennyit töltött a nap táljába; makrók, hozzávalók (honnan jött, mennyire feldolgozott), minőség, mikrotápanyagok; lent „Javítom” és „Mentsük receptként”. A <b>Mezo értékelése</b> nyolc szempontja nyolc kémcső, a leggyengébb sárga. Mentés után rövid <b>ceremónia</b>: csillagok és egy kehely, ami az értékelésig telik.</li>
<li><b>Logolás:</b> négy út (Fotó, Kamra, Recept, Szokásosak) és egy szövegmező mikrofonnal; az elemzés után a tételek soronként átírhatók, alul a „Mikor ettél?”. Ugyanez a lap a pótlás (lezárt napra) és a javítás (két lépéses törléssel).</li>
<li><b>Trendek:</b> fent a hét-váltó (ez a hét és a múlt hét), alatta a hét hét edénye a nap keretének vízvonalával és a nap étkezés-pontjával; három szám a hétről; hétköznap és hétvége két közlekedőedény; a hosszabb távon a heti súlyátlag folyadék-felszín a súlycél vonalával, alatta a heti evés. Egy edényre koppintva a nap doboza nyílik.</li>
<li><b>Kiegészítők:</b> a mai adagok kapszulákban, napszakonként, a pipák élnek; a Protokoll idősávjai kémcsövek; az Új elem három lépés egy oldalon; a gyógyszer ciklusa hét edény, a magasság a fázist jelöli.</li>
<li><b>Konyha:</b> a főoldalon az üres fazék a Receptműhely meghívója (itt nincs mért szint). A recepten a fazék egy adag részét mutatja, a Műhelyben azt, hány sor jön már a kamrádból. A Kamra csempéin a szint a fehérje-sűrűség (25 g-nál tele).</li>
<li><b>Hogy tanultam?:</b> a tanult keret egy csepp a ± sávban; hétről hétre, az utolsó 14 nap kapcsolókkal, és a legutóbbi hét hat lépése saját ábrával. A „Heti összegző” a hét egy lapon.</li>
<li><b>Beállítások, ablakok:</b> a nap mint árapály, rajta a mai étkezési ablakok edényei névvel és kalóriával, és a koffein-stop. Az ablak-szerkesztőben naptípusonként az ajánlás, vagy a saját felosztásod.</li>
</ul>
<h2>Mai és társai · ami változott az átnézés után</h2>
<p><b>Kikerült, mert az app nem tud ilyet:</b> a „Heti egyeztetés” (helyette a valódi heti összegző a tanulásról), „A hét képe” a Mai-ról (a hét a Trendeken van), a vércukor-lap összetevőnkénti listái és perc-feliratai, a „Hatás a napra” és a „Jegyzet” az étkezés oldalán, a „Növényféle” csempe, a Keresés / Gyors / Diktálás logoló-módok, és minden „Prototípus · állapotváltó”.</p>
<p><b>Állapotok (a képernyőn nincs kapcsoló, linkről nyílnak):</b><br>
Mai: <a href="#w-fuel-mai.kihagyva">kihagyott étkezés</a> · <a href="#w-fuel-mai.kihagyva-ok">kihagyva, okkal</a> · <a href="#w-fuel-mai.felett">a keret felett</a> · <a href="#w-fuel-mai.kesz">minden logolva</a> · <a href="#w-fuel-mai.jon">még jön edzés</a> · <a href="#w-fuel-mai.javaslat">diéta-javaslat vár</a> · <a href="#w-fuel-mai.nincs-ablak">nincs ablak</a> · <a href="#w-fuel-mai.nincs-cel">nincs cél</a> · <a href="#w-fuel-mai.d-10-06">tegnap</a> · <a href="#w-fuel-mai.d-10-05">nap adat nélkül</a> · <a href="#w-fuel-mai.tolt">betöltés</a> · <a href="#w-fuel-mai.hiba">hiba</a><br>
Kímélő mód: <a href="#w-fuel-mai.kimelo">gyomorrontás</a> · <a href="#w-fuel-mai.beteg">betegség</a> · <a href="#w-fuel-mai.serules">sérülés (hiány kikapcsolva)</a> · <a href="#w-fuel-mai.serules-tartas">sérülés (tartás)</a> · <a href="#w-fuel-mai.uton">úton</a><br>
Étkezés: <a href="#w-fuel-meal.ebed">ebéd</a> · <a href="#w-fuel-meal.tizorai">becsült cukor</a> · <a href="#w-fuel-meal.uzsonna">receptből</a> · <a href="#w-fuel-meal.vacsora">értékelés folyamatban</a> · <a href="#w-fuel-meal.nincs">nincs meg</a> · értékelés: <a href="#w-fuel-score.reggeli">kész</a> · <a href="#w-fuel-score.tizorai">egy szempont kimaradt</a> · <a href="#w-fuel-score.ebed.keszul">a szöveg készül</a> · <a href="#w-fuel-score.vacsora">még nincs</a> · <a href="#w-fuel-cer.reggeli">ceremónia</a><br>
Logolás: <a href="#w-fuel-log">üres</a> · <a href="#w-fuel-log.w2">ablakba</a> · <a href="#w-fuel-log.foto-kesz">fotó csatolva</a> · <a href="#w-fuel-log.elemez">elemez</a> · <a href="#w-fuel-log.hiba">nem ismerte fel</a> · <a href="#w-fuel-log.ai-hiba">nem sikerült</a> · <a href="#w-fuel-log.szokasos">szokásosak</a> · <a href="#w-fuel-log.szokasos-ures">még nincs szokásos</a> · <a href="#w-fuel-log.tetelek">tételek</a> · <a href="#w-fuel-log.finom">recept finomhangolása</a> · <a href="#w-fuel-log.ido">idő kézzel</a> · <a href="#w-fuel-log.jovo">jövőbeli idő</a> · <a href="#w-fuel-log.potlas">pótlás</a> · <a href="#w-fuel-log.javitas.ebed">javítás</a> · <a href="#w-fuel-log.torles.ebed">törlés</a> · <a href="#w-fuel-log.kamra-csirke">Kamra-tételről</a> · <a href="#w-fuel-log.recept-r1">receptről</a><br>
Tanulás: <a href="#w-fuel-tanulas">tanul</a> · <a href="#w-fuel-tanulas.var">ezen a héten várt</a> · <a href="#w-fuel-tanulas.ki">kikapcsolva</a> · <a href="#w-fuel-tanulas.ures">még nincs adat</a> · <a href="#w-fuel-tanulas.tolt">betöltés</a> · <a href="#w-fuel-tanulas.hiba">hiba</a></p>
<h2>Kiegészítők és Trendek · ami változott az átnézés után</h2>
<p><b>Kikerült, mert az app nem tud ilyet:</b> a „Cél felé” lépcsős ábra és a simított súlytrend (helyette a valódi heti átlagok), a negyedik „Naplózott nap” csempe (ez a hős sora), a mintázatok kitalált alsó sorai, a kiegészítő dobozából a „készlet 42 / 90 · kb. 6 hét” szint, a protokoll „fehérje rendben” sora, az Új elemnél a „25 mg fölött” határ, a gyógyszernél a „becsült jelenlét”, és a két minta-váltó link.</p>
<p><b>Javítva:</b> a hét számai egy helyről jönnek, és egyeznek a Mai-jal és a Tanulással (a hét szerdánál tart: két naplózott nap); a hétköznap–hétvége különbség úgy kerekít, ahogy az app (a múlt héten 38). A „stack” szó helyett mindenhol „kiegészítők”.</p>
<p><b>Állapotok:</b><br>
Kiegészítők: <a href="#w-fuel-stack.kesz">mára minden megvan</a> · <a href="#w-fuel-stack.ures">üres protokoll</a> · <a href="#w-fuel-stack.tolt">betöltés</a><br>
Protokoll: <a href="#w-fuel-protokoll.figyelj">kevés zsír egy étkezésben</a> · <a href="#w-fuel-protokoll.kotesnelkul">nincs étkezési kötés</a> · <a href="#w-fuel-protokoll.ures">üres</a> · <a href="#w-fuel-protokoll.tolt">betöltés</a> · <a href="#w-fuel-protokoll.hiba">hiba</a><br>
Új elem: <a href="#w-fuel-stack-uj.1-nincs">nincs találat</a> · <a href="#w-fuel-stack-uj.2-kezi">kézzel</a> · <a href="#w-fuel-stack-uj.2-link">linkről</a> · <a href="#w-fuel-stack-uj.2-link-olvas">beolvasás</a> · <a href="#w-fuel-stack-uj.2-link-kesz">beolvasva</a> · <a href="#w-fuel-stack-uj.2-link-ures">nem talált adatot</a> · <a href="#w-fuel-stack-uj.2-link-hiba">nem sikerült</a> · <a href="#w-fuel-stack-uj.2-foto">fotóról</a> · <a href="#w-fuel-stack-uj.2-foto-olvas">olvassa a címkét</a> · <a href="#w-fuel-stack-uj.2-foto-ures">a címkén nincs adat</a> · <a href="#w-fuel-stack-uj.2-foto-hiba">a fotó nem sikerült</a> · javaslat: <a href="#w-fuel-stack-uj.3">ismert anyag</a> · <a href="#w-fuel-stack-uj.3-kerekitve">kerekítve</a> · <a href="#w-fuel-stack-uj.3-ismeretlen">nem ismert anyag</a> · <a href="#w-fuel-stack-uj.3-hianyzik">hiányzik egy adat</a> · <a href="#w-fuel-stack-uj.3-nincspolcon">még nincs a Kamrában</a><br>
Gyógyszer: <a href="#w-fuel-gyogyszer">nincs követett</a> · <a href="#w-fuel-gyogyszer.aktiv">követett gyógyszer</a> · <a href="#w-fuel-gyogyszer.ujonnan">még nincs beadás</a> · <a href="#w-fuel-gyogyszer.leallitas">leállítás megerősítése</a><br>
Trendek: <a href="#w-fuel-trendek">ez a hét</a> · <a href="#w-fuel-trendek.mult">a múlt hét</a> · <a href="#w-fuel-trendek.elso">első hét</a> · <a href="#w-fuel-trendek.ures">nincs naplózott nap</a> · <a href="#w-fuel-trendek.egyszint">egy szinten</a> · <a href="#w-fuel-trendek.hetkoznap">hétköznap több</a> · <a href="#w-fuel-trendek.kimelo">kímélő napok</a> · <a href="#w-fuel-trendek.sulynelkul">nincs súlymérés</a> · <a href="#w-fuel-trendek.sulyhezag">egy hét mérés nélkül</a> · <a href="#w-fuel-trendek.nincs-cel">nincs súlycél</a> · <a href="#w-fuel-trendek.rovid">még kevés hét</a> · <a href="#w-fuel-trendek.mintanelkul">nincs mintázat</a> · <a href="#w-fuel-trendek.tolt">betöltés</a></p>
<h2>Konyha és Beállítások · ami változott az átnézés után</h2>
<p><b>Kikerült, mert az app nem tud ilyet (vagy korábban kivetted):</b> a recept „Növényféle” csempéje, a Receptek oldalról a „Kifőzöm a Műhelyben” link, a koppintható csere-javaslat a Kamrában, a Konyha cél-gombjai mint külön indítók (most dísz, a kártya nyitja a Műhelyt), a mentett receptben a „becslés” sorok, a hozzávalóról a kamra-tételre ugrás, a más napokról mutatott recept-logok (a lista csak a mai), az ajánlott ablakok „horgony” felirata, a „Hogy tanultam?” link a beállításokban, és a kézi szerkesztő „Recept mentve” üzenete.</p>
<p><b>Javítva:</b> egy napi keret van mindenhol (3 100 kcal: az ablakok és a makró-arányok ebből jönnek); a recept és a szerkesztő számai a hozzávalókból adódnak; a Kamra felvételi módjai az appéi (fotó · link · katalógus · kézi, a közös katalógus szerzője külön sor); a Műhelyben a becsült sornak van kalóriája, és azért nem menthető, mert becslés. A recept értékelése saját oldalt kapott. Új lapok: a Műhely beszélgetése, a hozzávaló-választó, a „nem mentett módosítások” kérdés.</p>
<p><b>Szóhasználat:</b> „Slot” helyett a receptnél „Étkezés”, az ablakoknál „Ablak”; „Budget %” helyett „Rész %”; „cutoff” helyett „koffein-stop”; „patch” helyett „javítás”; „kamra-item” helyett „kamra-tétel”.</p>
<p><b>Állapotok:</b><br>
Konyha: <a href="#w-fuel-konyha.ures">üres konyha</a><br>
Kamra: <a href="#w-fuel-kamra.ures">üres polc</a> · <a href="#w-fuel-kamra.tolt">betöltés</a> · <a href="#w-fuel-kamra.szurt">szűrve</a> · <a href="#w-fuel-kamra.nincstalalat">nincs találat</a> · tétel: <a href="#w-fuel-kamra.csirke">étel</a> · <a href="#w-fuel-kamra.csirke.hianyos">hiányzik egy makró</a> · <a href="#w-fuel-kamra.lekvar">nincs tápérték</a> · <a href="#w-fuel-kamra.zab">közös katalógusból</a> · <a href="#w-fuel-kamra.olaj">milliliterben</a> · <a href="#w-fuel-kamra.whey">kiegészítő tápértékkel</a> · <a href="#w-fuel-kamra.kreatin">kiegészítő</a> · <a href="#w-fuel-kamra.aakg">nincs időzítve</a> · <a href="#w-fuel-kamra.csirke.torles">törlés megerősítése</a> · <a href="#w-fuel-kamra.nincs">nincs ilyen</a><br>
Receptek: <a href="#w-fuel-receptek.ures">még nincs recept</a> · <a href="#w-fuel-receptek.szurt-ures">üres szűrő</a> · <a href="#w-fuel-receptek.tolt">betöltés</a> · recept: <a href="#w-fuel-recept.r1">egy adagos</a> · <a href="#w-fuel-recept.r2">két adagos</a> · <a href="#w-fuel-recept.r2.egesz">egész recept</a> · <a href="#w-fuel-recept.r6">értékelés folyamatban</a> · <a href="#w-fuel-recept.r1.ertekel">Mezo értékeli</a> · <a href="#w-fuel-recept.r1.ujra">újraértékeli</a> · <a href="#w-fuel-recept.r1.nincsolvasat">nincs olvasat</a> · <a href="#w-fuel-recept.r5.nemettem">még nem etted</a> · <a href="#w-fuel-recept.r1.torles">törlés megerősítése</a> · <a href="#w-fuel-recept.nincs">nincs ilyen</a><br>
A recept értékelése: <a href="#w-fuel-score.r-r1">kész</a> · <a href="#w-fuel-score.r-r1.keszul">készül</a> · <a href="#w-fuel-score.r-r6.nincs">még nincs</a> · <a href="#w-fuel-score.r-xx.nincsmeg">a recept nincs meg</a><br>
Kézi szerkesztő: <a href="#w-fuel-recept-uj">üres</a> · <a href="#w-fuel-recept-uj.kitoltve">kitöltve</a> · <a href="#w-fuel-recept-uj.x">egész recept</a> · <a href="#w-fuel-recept-uj.szerk-r2">szerkesztés</a> · <a href="#w-fuel-recept-uj.nincs">nincs ilyen</a><br>
Műhely: <a href="#w-fuel-muhely">üres vászon</a> · <a href="#w-fuel-muhely.dolgozik">dolgozik</a> · <a href="#w-fuel-muhely.hiba">nem elérhető</a> · <a href="#w-fuel-muhely.kamrabol">kamra-tételekkel a következő körre</a> · <a href="#w-fuel-muhely.vazlat">vázlat, egy sor becslés</a> · <a href="#w-fuel-muhely.vazlat-egesz">egész recept</a> · <a href="#w-fuel-muhely.kesz">menthető</a> · <a href="#w-fuel-muhely.recept-r2">meglévő receptből</a> · <a href="#w-fuel-muhely.etkezesbol">logolt étkezésből</a> · <a href="#w-fuel-muhely.feloldatlan">egy sor nem oldható fel</a> · <a href="#w-fuel-muhely.ures-vazlat">üres vázlat</a><br>
Beállítások: <a href="#w-fuel-beallitas.modositva">módosítva, előnézet</a> · <a href="#w-fuel-beallitas.egyeni">egyéni arányok</a> · <a href="#w-fuel-beallitas.egyeni-hiba">nem 100%</a> · <a href="#w-fuel-beallitas.elonezet-tolt">előnézet számol</a> · <a href="#w-fuel-beallitas.elonezet-hiba">előnézet hiba</a> · <a href="#w-fuel-beallitas.ablak-nelkul">ablakok még töltenek</a> · <a href="#w-fuel-beallitas.tolt">betöltés</a> · <a href="#w-fuel-beallitas.hiba">hiba</a> · <a href="#w-fuel-beallitas.mentes-hiba">mentés nem sikerült</a><br>
Ablakok: <a href="#w-fuel-ablakok">pihenőnap</a> · <a href="#w-fuel-ablakok.reggeli">reggeli edzés (a mai nap)</a> · <a href="#w-fuel-ablakok.esti">esti edzés (mintanap)</a> · <a href="#w-fuel-ablakok.szerk">testreszabás</a> · <a href="#w-fuel-ablakok.mentett">saját felosztás</a> · <a href="#w-fuel-ablakok.hiba">hibás</a> · <a href="#w-fuel-ablakok.figyel">figyelmeztetés</a> · <a href="#w-fuel-ablakok.ertekel">Mezo értékeli</a> · <a href="#w-fuel-ablakok.olvasat">olvasat: rendben</a> · <a href="#w-fuel-ablakok.olvasat-igazit">olvasat: igazítanál</a> · <a href="#w-fuel-ablakok.olvasat-nincs">olvasat nem elérhető</a> · <a href="#w-fuel-ablakok.tolt">betöltés</a> · <a href="#w-fuel-ablakok.betolt-hiba">hiba</a> · <a href="#w-fuel-ablakok.mentes-hiba">mentés nem sikerült</a><br>
A lapok állapotai (új tétel, import, közös katalógus, szűrő, recept-logok) a lapon belül váltanak; az import lépései: fotó → keresés → vázlat.</p>
<h2>Angolul</h2>
<p>Az oldalsáv „English” kapcsolójával a Fuel minden oldala, lapja és állapota angolul olvasható. Magyar marad, amit te írtál vagy ami korábban már elkészült: az étkezések, receptek, hozzávalók, termékek és márkák neve, a címkéid és jegyzeteid, a korábban megírt értékelő szöveg és recept-jegyzet, a kiegészítőkhöz elmentett indok-mondat. Minden más angol: a feliratok, a mondatok, a dátumok és a számok formája is.</p>
<p>A fotó, a kamera, a hang és a +/− gombok koppintásra csak visszajeleznek; a pipák, kapcsolók, választó-gombok, a víz és a kihagyás átváltanak.</p>`
});
})();
