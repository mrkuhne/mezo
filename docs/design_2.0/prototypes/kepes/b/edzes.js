/* Edzés domain (skill /lagy, round 1 of 4: the four tabs + Mai's states). Registers DOM.edzes.
   Routes: edzes (Mai) · edzes-terv · edzes-terheles · edzes-gyak · edzes-mai-<state> (kesz, folyamatban,
   kihagyva, kimelo, pihen, ures). Content mirrors the real Edzés records (Hypertrophy 04, the Pull day,
   the week's sets, the sports); today is csütörtök, szeptember 24., 14:10. */
(()=>{
/* ── glyphs this domain adds to the family (same recipe: soft gradient shape + one white highlight) ── */
Object.assign(SH,{
  ball:(u,h)=>`<circle cx="32" cy="32" r="24" fill="url(#${u})"/><path d="M32 8c-6 8-6 20 0 24s18 6 24 2M14 18c8 2 14 8 18 14M32 32c-4 6-12 12-22 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/><path d="M20 16a16 16 0 0 1 8-4" stroke="url(#${h})" stroke-width="3" stroke-linecap="round"/>`,
  shoe:(u,h)=>`<path d="M8 40c0-6 2-14 6-18l8 4c4 2 8 2 10-2l4-6c6 6 14 10 20 12 2 1 2 4 2 6v4H8z" fill="url(#${u})"/><rect x="8" y="44" width="50" height="6" rx="3" fill="url(#${u})" opacity=".55"/><path d="M26 30l4 3M30 26l4 3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>`,
  medal:(u,h)=>`<path d="M20 6h10l6 16h-10zM44 6H34l-6 16h10z" fill="url(#${u})" opacity=".6"/><circle cx="32" cy="40" r="17" fill="url(#${u})"/><circle cx="32" cy="40" r="10" fill="#fff" opacity=".45"/><path d="M26 34a8 8 0 0 1 6-3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>`
});

/* ── the domain's own styles ── */
document.head.insertAdjacentHTML('beforeend',`<style>
/* Edzés: the week strip on Mai (seven day pills in one card) */
.dstrip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));padding:8px 4px}
.dstrip button{border:0;background:none;display:grid;justify-items:center;gap:5px;padding:4px 0;min-height:64px;font:700 12px var(--b);color:var(--ink2)}
.dstrip button i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--paper);font-style:normal;font:700 12.5px var(--b);color:var(--ink2)}
.dstrip button i .g{font-size:18px}
.dstrip button.done i{background:var(--sage3)}
.dstrip button.today{color:var(--deep)}.dstrip button.today i{background:var(--ink);color:#fff}
.dstrip button.miss i{background:var(--peach2)}
.dstrip button.plan i{background:none;box-shadow:inset 0 0 0 1.5px rgba(30,35,33,.16)}
/* Edzés: the six-week arc (level tubes inside the deep card) */
.arc6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;align-items:end;width:100%;padding:4px 2px 0}
.arc6.a4{grid-template-columns:repeat(4,minmax(0,1fr))}
.arc6>div{display:grid;justify-items:center;gap:6px}
.arc6 em{font-style:normal;font:700 12px var(--b);color:rgba(255,255,255,.75);font-variant-numeric:tabular-nums}
.arc6 span{position:relative;width:100%;max-width:34px;height:112px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;display:block}
.arc6 span i{position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:999px 999px 0 0;background:linear-gradient(180deg,rgba(191,227,204,.75),rgba(191,227,204,.4));transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.pre .arc6 span i,.pre .e1 span i{height:0}
.arc6 .now span{box-shadow:inset 0 0 0 2px #BFE3CC}.arc6 .now span i{background:linear-gradient(180deg,#F4C860,#E9B44C)}
.arc6 .past span i{background:linear-gradient(180deg,#BFE3CC,#8FCBA9)}
.arc6 b{font:700 12px var(--b);color:rgba(255,255,255,.82)}.arc6 .now b,.arc6 .now em{color:#fff}
.dhead{display:flex;justify-content:space-between;align-items:baseline;width:100%;gap:10px}
.dhead small{font:700 12px var(--b);text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.72)}
.dhead b{font:600 22px var(--d);color:#fff;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.dhead b small{font:700 12px var(--b);text-transform:none;letter-spacing:0;margin-left:4px}
/* Edzés: alternative actions (two cards side by side) */
.ealt{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ealt button{border:0;background:var(--card);border-radius:22px;box-shadow:var(--sh);display:grid;justify-items:start;gap:6px;padding:14px;text-align:left;min-height:96px;color:var(--ink)}
.ealt button .g{font-size:30px}.ealt button b{font:600 15px/1.2 var(--d)}.ealt button span{font:600 12.5px var(--b);color:var(--ink2)}
.ealt button.wide{grid-column:1/-1;min-height:0;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;padding:12px 14px}
.ealt button.wide .chev{width:18px;height:18px;color:var(--mute)}
/* Edzés: e1RM mini curve in the deep record card */
.recc{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center;width:100%}
.recc img{width:72px;height:72px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 3px rgba(255,255,255,.22)}
.recc small{display:block;font:700 12px var(--b);text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.72)}
.recc strong{display:block;font:600 18px/1.2 var(--d);color:#fff;margin-top:2px}
.recc .big{display:block;font:600 26px var(--d);color:#fff;letter-spacing:-.02em;margin-top:4px;font-variant-numeric:tabular-nums}
.recc .big small{display:inline;text-transform:none;letter-spacing:0;font-size:12.5px;margin-left:6px;color:#F4C860}
.e1{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;align-items:end;width:100%;margin-top:4px;padding-top:12px;border-top:1px solid rgba(255,255,255,.12)}
.e1>div{display:grid;justify-items:center;gap:5px}
.e1 span{position:relative;width:100%;max-width:26px;height:64px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;display:block}
.e1 span i{position:absolute;left:0;right:0;bottom:0;height:var(--h);border-radius:999px 999px 0 0;background:linear-gradient(180deg,#BFE3CC,#8FCBA9);transition:height 1.1s cubic-bezier(.2,.8,.2,1)}
.e1 .now span i{background:linear-gradient(180deg,#F4C860,#E9B44C)}
.e1 b{font:700 12px var(--b);color:rgba(255,255,255,.82);font-variant-numeric:tabular-nums}
/* Edzés: exercise thumbnails are the app's own instruction stills */
.dl .stk img.ex,.rl .rph img.ex{filter:saturate(.9) contrast(.96)}
.rl.ex{grid-template-columns:96px minmax(0,1fr)}.rl.ex .rph{width:96px;height:112px}
.w320 .rl.ex{grid-template-columns:84px minmax(0,1fr)}.w320 .rl.ex .rph{width:84px;height:104px}
.rl .meta b{font:700 12px var(--b);color:var(--ink)}
.rl .care{position:absolute;left:8px;bottom:8px;height:26px;font-size:12px;padding:0 8px}
.emore{display:flex;justify-content:center;margin:14px 16px 0}
.mstate{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:16px 12px 6px}
.mstate .mi .tb{height:72px;width:26px}
.t-sky .mi .tb{background:rgba(255,255,255,.7)}
.mstate+.acts{margin:6px 14px 14px}
.why{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 0}
.why .fp.on{background:var(--ink);border-color:var(--ink);color:#fff}
.phead img.bg[src*="edz-nyujtas"]{filter:brightness(.66) saturate(.9) contrast(1.05)}
.trio.deep>div{border-color:rgba(255,255,255,.14)}.trio.deep b{color:#fff}.trio.deep small{color:rgba(255,255,255,.72)}
.rl.ex .meta{display:grid;gap:3px;justify-items:start}
.phone[data-theme="dark"] .dstrip button.today i{background:#EEF2EE;color:#141A17}.phone[data-theme="dark"] .ealt button{background:var(--card)}
</style>`);

/* ── data ── */
const EPH=n=>`gyak/${n}.jpg`;
const ETABS=[['Mai','edzes'],['Terv','edzes-terv'],['Terhelés','edzes-terheles'],['Gyakorlatok','edzes-gyak']];
const MESO={name:'Hypertrophy 04',week:3,of:6,sets:[52,61,75,75,84,38],phase:['alap','alap','építés','építés','csúcs','könnyű']};
/* today's Pull day: [name, photo, sets, reps, weight, note] */
const PULL=[['Húzódzkodás (súlyozott)','weighted-pull-up',4,'6–8','+12,5 kg'],['Döntött törzsű evezés','barbell-row',3,'8–10','72,5 kg'],['Rear Delt Fly','cable-rear-delt-fly',3,'12–15','12,5 kg','kímélve'],['Kalapácsbicepsz','hammer-curl',3,'10–12','16 kg'],['Vállemelés','db-shrug',3,'12–15','30 kg']];
/* where today's 16 sets go: [label, sets, colour on the deep card] */
const PMUS=[['Hát · széles',4,'#BFE3CC'],['Hát · közép',3,'#8CC3E8'],['Váll · hátsó',3,'#F0B48C'],['Bicepsz',3,'#F4C860'],['Trapéz',3,'#CDB4E3']];
/* the week: [day, short, type, state, sets, photos] */
const EWEEK=[['Hétfő','H','Push','done',16,['barbell-bench-press','incline-db-press','overhead-press'],'68 perc · 1 rekord'],
  ['Kedd','K','Legs A','done',12,['front-squat','leg-curl','walking-lunge'],'51 perc'],
  ['Szerda','Sze','Legs','done',17,['barbell-squat','romanian-deadlift','leg-press'],'74 perc · 2 rekord'],
  ['Csütörtök','Cs','Pull','today',16,['weighted-pull-up','barbell-row','hammer-curl'],'16:00 · 64 perc'],
  ['Péntek','P','Push · könnyű','plan',12,['incline-db-press','cable-fly','lateral-raise'],'46 perc'],
  ['Szombat','Szo','Röplabda · meccs','sport',0,null,'10:00 · 90 perc'],
  ['Vasárnap','V','Pihenőnap','rest',0,null,'']];
/* the week's sets per muscle group: [label, done, target] */
const WMUS=[['Hát',10,12],['Váll',12,12],['Comb',13,14],['Mell',13,13],['Lábhajlító',9,12],['Kar',9,20],['Far',3,8]];
/* the exercise library: [name, region, photo, estimated max, best set, medals, kind, note] */
const GYAK=[['Guggolás','Láb','barbell-squat','144 kg','120 × 6',3,'Összetett','új rekord'],
  ['Román felhúzás','Láb','romanian-deadlift','133,5 kg','100 × 10',2,'Összetett','új rekord'],
  ['Chest Supported Row','Hát','chest-supported-t-bar-row','140 kg','107,5 × 8',2,'Összetett'],
  ['Fekvenyomás','Mell','barbell-bench-press','101,5 kg','92,5 × 8',2,'Összetett'],
  ['Döntött törzsű evezés','Hát','barbell-row','98 kg','72,5 × 10',2,'Összetett'],
  ['Húzódzkodás (súlyozott)','Hát','weighted-pull-up','+23 kg','+12,5 × 8',0,'Összetett'],
  ['Lehúzás · semleges fogás','Hát','lat-pulldown-neutral','101 kg','77 × 10',0,'Összetett'],
  ['Ferde kézisúlyzós nyomás','Mell','incline-db-press','38 kg','32 × 10',1,'Összetett'],
  ['Vállból nyomás','Váll','overhead-press','57 kg','45 × 9',1,'Összetett'],
  ['Lábtolás','Láb','leg-press','252 kg','180 × 12',0,'Összetett'],
  ['Csípőemelés','Láb','hip-thrust','150 kg','115 × 8',0,'Összetett'],
  ['Elülső guggolás','Láb','front-squat','112 kg','90 × 8',0,'Összetett'],
  ['Kalapácsbicepsz','Kar','hammer-curl','22,5 kg','16 × 12',1,'Izolált'],
  ['Tricepsz letolás','Kar','tricep-pushdown','38 kg','27 × 12',0,'Izolált'],
  ['Tricepsz nyújtás fej fölött','Kar','cable-overhead-extension','34 kg','25 × 11',0,'Izolált'],
  ['Face Pull','Váll','face-pull','36 kg','27 × 17',0,'Izolált'],
  ['Oldalemelés','Váll','lateral-raise','14 kg','10 × 15',0,'Izolált'],
  ['Rear Delt Fly','Váll','cable-rear-delt-fly','17 kg','12,5 × 14',0,'Izolált','kímélve'],
  ['Kábeles tárogatás','Mell','cable-fly','20 kg','14 × 15',0,'Izolált'],
  ['Lábhajlítás','Láb','leg-curl','60 kg','47,5 × 10',0,'Izolált'],
  ['Álló vádliemelés','Láb','standing-calf-raise','80 kg','60 × 15',0,'Izolált'],
  ['Plank','Core','plank','—','90 másodperc',0,'Izolált'],
  ['Függő lábemelés','Core','hanging-leg-raise','—','15 ismétlés',0,'Izolált']];
const REG={Mell:['peach','barbell-bench-press'],Hát:['sage','barbell-row'],Váll:['sky','overhead-press'],Kar:['sun','hammer-curl'],Láb:['berry','barbell-squat'],Core:['deep','plank']};
const GF=[['Érmes','medal','sun'],['Összetett','dumbbell','sage'],['Izolált','bolt','sky'],['Mostanában','clock','berry']];
const ES={cat:'',f:'',q:''};
/* the Mai states shown in the side panel */
const STATES=[['','Betervezve (alap)'],['folyamatban','Folyamatban'],['kesz','Kész'],['kihagyva','Kihagyva'],['kimelo','Kímélő mód'],['pihen','Pihenőnap'],['ures','Nincs terv']];
const WHY=[['Fáradt vagyok','moon','sky'],['Nincs időm','clock','sky'],['Nincs kedvem','spark','sun'],['Beteg vagyok','drop','sky'],['Gyomorrontás','bowl','peach'],['Sérülés, fájdalom','bolt','peach'],['Úton vagyok','pin','berry'],['Egyéb','dots','ink']];

/* ── small builders ── */
const ehead=(tab,o)=>phead(tab,{...o,tabs:ETABS});
const exStack=ps=>`<span class="stk">${ps.slice(0,3).map(p=>`<img class="ex" src="${EPH(p)}" alt="">`).join('')}</span>`;
const set1=n=>`${n} szett`;
const tubesDeep=(vals,max,now,labels,cls='arc6',fmt=v=>v)=>`<div class="${cls}">${vals.map((v,i)=>`<div class="${i===now?'now':i<now?'past':''}"><em>${fmt(v)}</em><span><i style="--h:${Math.round(v/max*100)}%"></i></span><b>${labels[i]}</b></div>`).join('')}</div>`;

/* the week strip (Mai) */
const dstrip=()=>`<div class="card dstrip">${EWEEK.map(([d,s,t,st])=>`<button class="${st==='done'?'done':st==='today'?'today':st==='plan'||st==='sport'||st==='rest'?'plan':''}" data-toast="${d} · ${t} — a nap oldala a Terv aloldalainál jön" aria-label="${d}, ${t}"><i>${st==='done'?G('check','sage'):st==='today'?'24':st==='sport'?G('ball','sun'):st==='rest'?G('moon','sky'):G('dumbbell','ink')}</i>${s}</button>`).join('')}</div>`;

/* the deep card on Mai: where today's sets go */
const pullRing=(done=0)=>{const tot=PMUS.reduce((a,m)=>a+m[1],0);return `<div class="card gy g1 deep pre">${ring({d:104,sw:10,p:1,segs:PMUS.map(m=>[m[1]/tot,m[2]]),val:done?`${done} / ${tot}`:tot,unit:done?'szett kész':'szett ma'})}<div class="bars">${PMUS.map(([l,n,c])=>`<div class="br"><span>${l}</span><b>${n} <small>szett</small></b><u><i style="--w:${n/4*100}%;background:${c}"></i></u></div>`).join('')}</div></div>`};

const exList=(note)=>`<div class="dlist one">${PULL.map(([n,p,s,r,w,c])=>`<article class="dl tap" role="button" tabindex="0" data-toast="${n} — a gyakorlat oldala a 4. körben jön"><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip soft">${G('repeat','deep')}${s} × ${r}</span><span class="chip">${w}</span>${c?`<span class="chip warm">${G('bolt','peach')}${c}</span>`:''}${note&&note[n]?note[n]:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div>`;

const stateCard=()=>`<div class="card t-sky"><div class="mstate">${[['Kipihentség',4,'low'],['Izomláz',7,'low'],['Kedv',5,'']].map(([l,v,c])=>`<div class="mi ${c}"><span class="tb"><i style="--h:${v*10}%"></i></span><b>${v} / 10</b><small>${l}</small></div>`).join('')}</div><div class="acts"><button class="pill soft" data-toast="Könnyítve: ma a múlt heti súlyok maradnak">Könnyítsük</button></div></div>`;

const comingUp=()=>`<div class="dlist one"><article class="dl tap" role="button" tabindex="0" data-toast="Röplabda — a sport oldala a 4. körben jön"><span class="stk"><img src="${PH('edz-ropi-sq.jpg')}" alt=""></span><div class="dtx"><strong>Röplabda · BVSC · 18:00</strong><div class="chips"><span class="chip soft">${G('clock','deep')}90 perc</span><span class="chip">váll · láb · core</span></div></div>${G('chev','ink','chev')}</article>
  <article class="dl tap" role="button" tabindex="0" data-toast="Sprint naplózása — a 4. körben jön"><span class="stk"><img src="${PH('edz-futas-sq.jpg')}" alt=""></span><div class="dtx"><strong>Sprint-intervallum · tegnap</strong><div class="chips"><span class="chip warm">${G('shoe','peach')}elmaradt</span><span class="chip">Naplózom utólag</span></div></div>${G('chev','ink','chev')}</article></div>`;

const altCard=()=>`<div class="ealt"><button data-toast="Egyedi edzés — a 4. körben jön">${G('dumbbell','sage')}<b>Egyedi edzés</b><span>Saját gyakorlatokkal</span></button><button data-toast="Sport naplózása — a 4. körben jön">${G('ball','sun')}<b>Sport naplózása</b><span>Röpi, futás, bármi</span></button><button class="wide" data-sheet="edzWhy">${G('moon','sky')}<b>Ma kihagyom</b>${G('chev','ink','chev')}</button></div>`;

/* ── Mai (and its states) ── */
function mai(st=''){
  const S={
    '':{ph:'edz-huzodzkodas.jpg',pos:'center 30%',eb:'Ma · 16:00 · Hypertrophy 04 · 3. hét / 6',title:'Pull Day',sub:'Öt gyakorlat · 16 szett · körülbelül 64 perc',btn:`${G('bolt','ink')}Indítsuk`,at:'data-toast="Az edzés közbeni folyamat a 2. körben jön"',
      h1:'Ma <em>hát és bicepsz</em> jön, a vállad kímélve.',lead:'A Rear Delt Fly könnyített súllyal megy, amíg a jobb vállad fáj.'},
    folyamatban:{ph:'edz-huzodzkodas.jpg',pos:'center 30%',eb:'Folyamatban · 16:04 óta · 23 perc',title:'Pull Day',sub:'A második gyakorlatnál tartasz: döntött törzsű evezés.',btn:`${G('bolt','ink')}Folytassuk`,at:'data-toast="Az edzés közbeni folyamat a 2. körben jön"',
      h1:'<em>Hat szett megvan</em> a tizenhatból. Jó tempó.',lead:'A húzódzkodás mind a négy szettje meglett, az utolsó 8 ismétléssel.'},
    kesz:{ph:'edz-sulyzotarto.jpg',eb:'Ma · kész · 71 perc',title:'Pull Day megvan',sub:'14 szett · 142 ismétlés · 4 180 kg megmozgatva',btn:`${G('star','ink')}Az eredmény`,at:'data-toast="Az eredmény oldala a 2. körben jön"',
      h1:'<em>Két új rekord</em> ma: húzódzkodás és evezés.',lead:'A tizenhatból tizennégy szett lett meg, a vállad miatt kettőt kihagytál.'},
    kihagyva:{ph:'edz-nyujtas.jpg',eb:'Ma · kihagyva · fáradt vagy',title:'Ma nincs edzés',sub:'A Pull Day a jövő hétre tolódik, a terv igazodik hozzá.',btn:`${G('dumbbell','ink')}Mégis edzek`,at:'data-go="edzes"',
      h1:'Rendben, <em>ma pihensz</em>. A hét így is jól áll.',lead:'Az 55 szett a heti 83-ból elég ahhoz, hogy a hét ne vesszen el.'},
    kimelo:{ph:'edz-nyujtas.jpg',eb:'Kímélő mód · 2. nap a négyből',title:'Lassan vissza',sub:'Megfázás után: ma csak könnyű mozgás, holnaptól fél terhelés.',btn:`${G('person','ink')}Hogy vagy ma?`,at:'data-sheet="edzWhy"',
      h1:'<em>Most a gyógyulás</em> a dolgod, az edzés megvár.',lead:'A terv négy napra félreállt. Ha jobban vagy, egy koppintással visszajössz.'},
    pihen:{ph:'edz-nyujtas.jpg',eb:'Ma · pihenőnap',title:'Ma pihensz',sub:'A tegnapi lábnap után a regeneráció a dolgod.',btn:`${G('shoe','ink')}Könnyű séta`,at:'data-toast="Séta betervezve 17:00-ra"',
      h1:'A pihenőnap <em>az edzés része</em>. Ma itt az izom nő.',lead:'Holnap Pull Day jön, 16 szett. Aludj legalább hét órát.'},
    ures:{ph:'edz-korlat.jpg',eb:'Edzés · még nincs terved',title:'Rakjuk össze a heted',sub:'Három kérdés, és kész a hat hetes terv a céljaidhoz.',btn:`${G('plus','ink')}Tervet készítek`,at:'data-toast="Az új terv varázsló a 3. körben jön"',
      h1:'Még nincs edzésterved, <em>de egy edzést már ma</em> rögzíthetsz.',lead:'Egyedi edzés vagy sport: a naplózás terv nélkül is megy.'}}[st];
  const head=ehead('Mai',{ph:S.ph,pos:S.pos,eb:S.eb,title:S.title,sub:S.sub,btn:S.btn,attrs:S.at});
  const intro=`<h1 class="head rise" style="--i:1">${S.h1}</h1><p class="lead rise" style="--i:1">${S.lead}</p>`;
  const week=`<section class="sec rise" style="--i:2"><div class="sh"><h3>A heted</h3><a href="#edzes-terv">A terv ${G('chev')}</a></div>${dstrip()}</section>`;
  if(st==='ures')return `${head}${intro}
    <section class="sec rise first" style="--i:2"><div class="sh"><h3>Indulásnak</h3></div><div class="card trio deep">${[['dumbbell','sage','3–5','edzés egy héten'],['clock','sky','45–70','perc alkalmanként'],['chart','deep','6','hetes terv']].map(([ic,pal,n,l])=>`<div>${G(ic,pal)}<b>${n}</b><small>${l}</small></div>`).join('')}</div></section>
    <section class="sec rise" style="--i:3"><div class="sh"><h3>Vagy inkább</h3></div>${altCard().replace(/<button class="wide"[\s\S]*?<\/button>/,'')}</section>
    ${mzCard('A sablonjaid közül a <em>Pull / Push / Legs</em> illik hozzád a legjobban: heti öt alkalom, a röpi napjait kihagyja.',`<button class="pill soft" data-toast="Az új terv varázsló a 3. körben jön">Ebből indulok</button>`)}</div>`;
  if(st==='pihen'||st==='kimelo'||st==='kihagyva'){const k=st==='kimelo';
    return `${head}${intro}${week.replace('first','')}
    <section class="sec rise first" style="--i:3"><div class="sh"><h3>${k?'A visszatérés':'A hét eddig'}</h3><a href="#edzes-terheles">Terhelés ${G('chev')}</a></div>${k?`<div class="card gy only deep pre"><div class="dhead"><small>Kímélő mód · négy nap</small><b>2<small>/ 4 nap</small></b></div>${tubesDeep([8,15,50,75],100,1,['tegnap','ma','holnap','szombat'],'arc6 a4',v=>v+'%')}<div class="bars"><div class="br"><span>Terhelés holnaptól</span><b>50 <small>%</small></b><u><i style="--w:50%;background:#BFE3CC"></i></u></div></div></div>`:weekRing()}</section>
    <section class="sec rise" style="--i:4"><div class="sh"><h3>Ma még jön</h3></div>${k?`<div class="dlist one"><article class="dl"><span class="stk"><img src="${PH('edz-ropi-sq.jpg')}" alt=""></span><div class="dtx"><strong>Röplabda · 18:00</strong><div class="chips"><span class="chip warm">${G('moon','peach')}kímélő módban kimarad</span></div></div></article></div>`:comingUp()}</section>
    ${mzCard(k?'Ha reggel <em>láz nélkül</em> ébredsz, holnap fél terheléssel jöhet a Pull Day. Szólok reggel.':st==='pihen'?'Ma este a röpi is elmarad, úgyhogy <em>tényleg pihenőnap</em>. Holnapra 16 szett vár, a fehérjét ma is tartsd.':'A kihagyott Pull Day <em>hétfőre</em> kerül, a Push könnyebb lesz cserébe. Így a hát heti szettje megmarad.',`<button class="pill soft" data-toast="Rendben, így marad">${k?'Szólj reggel':'Így legyen'}</button>`)}</div>`}
  /* betervezve / folyamatban / kész */
  const done=st==='kesz'?14:st==='folyamatban'?6:0;
  return `${head}${intro}
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>${st==='kesz'?'Ma megvolt':'A mai edzés'}</h3></div>${pullRing(done)}</section>
  ${week.replace('--i:2','--i:3')}
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A gyakorlatok</h3><span class="crumb">5 gyakorlat</span></div>${exList(st==='kesz'?{'Húzódzkodás (súlyozott)':`<span class="chip warm">${G('medal','sun')}rekord</span>`,'Döntött törzsű evezés':`<span class="chip warm">${G('medal','sun')}rekord</span>`}:null)}</section>
  ${st===''?`<section class="sec rise" style="--i:5"><div class="sh"><h3>Mai állapot</h3><span class="crumb">reggel 07:40</span></div>${stateCard()}</section>`:''}
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Ma még jön</h3></div>${comingUp()}</section>
  <section class="sec rise" style="--i:7"><div class="sh"><h3>A mozgásod ma</h3></div><div class="card trio t-sun">${[['flame','deep',st==='kesz'?'540':'≈ 540','kalória az edzés'],['ball','sun','≈ 620','kalória a röpi'],['clock','sky',st==='kesz'?'161':'≈ 154','perc mozgás']].map(([ic,pal,n,l])=>`<div>${G(ic,pal)}<b>${n}</b><small>${l}</small></div>`).join('')}</div></section>
  ${st===''?`<section class="sec rise" style="--i:8"><div class="sh"><h3>Vagy inkább</h3></div>${altCard()}</section>`:''}
  ${mzCard(st==='kesz'?'Szép edzés. A <em>két rekord</em> után a jövő héten 2,5 kg-mal feljebb megy az evezés. A röpi előtt egyél egy banánt.':'Este röpi is van, ezért a <em>húzódzkodás utolsó szettjét</em> kihagynám: a vállad így frissebb marad a meccsre.',`<button class="pill soft" data-toast="${st==='kesz'?'Betervezve a jövő hétre':'Rendben: a negyedik szett kimarad'}">Így csináljuk</button>`)}</div>`}

/* the week's ring (shared by Terhelés and the rest states) */
const weekRing=()=>`<div class="card gy g1 deep pre">${ring({d:104,sw:10,p:55/83,c:'#BFE3CC',val:'55',unit:'/ 83 szett'})}<div class="bars">${WMUS.slice(0,5).map(([l,d,t])=>`<div class="br"><span>${l}</span><b>${d} <small>/ ${t}</small></b><u><i style="--w:${Math.min(100,d/t*100)}%;background:${d>=t?'#F4C860':'#BFE3CC'}"></i></u></div>`).join('')}</div></div>`;

/* ── Terv ── */
function terv(){
  return `${ehead('Terv',{ph:'edz-korlat.jpg',pos:'center 40%',eb:'Futó terv · 3. hét / 6 · október 18-ig',title:'Hypertrophy 04',sub:'Pull / Push / Legs · öt edzés egy héten',btn:`${G('clock','ink')}A heted`,attrs:'data-toast="A hét részletei a 3. körben jönnek"'})}
  <h1 class="head rise" style="--i:1">A harmadik hétnél tartasz, <em>innen emelkedik</em> a terhelés.</h1>
  <p class="lead rise" style="--i:1">A negyedik és ötödik hét a legkeményebb, a hatodik könnyű hét.</p>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hat hét</h3><a href="#" data-toast="A terv íve a 3. körben jön">Az ív ${G('chev')}</a></div><div class="card gy only deep pre"><div class="dhead"><small>Szett egy héten</small><b>75<small>ezen a héten</small></b></div>${tubesDeep(MESO.sets,90,2,['1.','2.','3.','4.','5.','6.'])}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Ez a hét</h3><span class="crumb">szeptember 21–27.</span></div><div class="dlist">${EWEEK.map(([d,s,t,st,n,ps,m])=>{const fut=st==='plan'||st==='rest'||st==='sport';
    return `<article class="dl tap ${st==='today'?'today':''} ${fut&&st!=='sport'?'fut':''}" role="button" tabindex="0" data-toast="${d} · ${t} — a nap oldala a 3. körben jön">${ps?exStack(ps):st==='sport'?`<span class="stk"><img src="${PH('edz-ropi-sq.jpg')}" alt=""></span>`:`<span class="stk none">${G('moon','sky')}</span>`}<div class="dtx"><strong>${d} · ${t}</strong><div class="chips">${st==='done'?`<span class="chip soft">${G('check','sage')}kész</span>`:st==='today'?`<span class="chip soft">${G('bolt','deep')}ma</span>`:''}${n?`<span class="chip">${set1(n)}</span>`:''}${m?`<span class="chip">${m}</span>`:''}</div></div>${G('chev','ink','chev')}</article>`}).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Izmaid a héten</h3><a href="#edzes-terheles">Terhelés ${G('chev')}</a></div><div class="card gy only t-sage"><div class="bars">${WMUS.map(([l,d,t])=>`<div class="br"><span>${l}</span><b>${d} <small>/ ${t} szett</small></b><u><i style="--w:${Math.min(100,d/t*100)}%;background:${d>=t?'var(--deep)':d/t<.5?'var(--peach)':'var(--sage)'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Terveid</h3></div><div class="dlist one">${[['edz-korlat','Hypertrophy 04 · Tavasz',[`<span class="chip soft">${G('bolt','deep')}fut</span>`,'<span class="chip">3. hét / 6</span>']],['edz-sulyzotarto','Strength 02 · Nyár',[`<span class="chip">lezárva</span>`,`<span class="chip warm">${G('star','sun')}92% megvolt</span>`]],['edz-sulyzo','Sablonok',['<span class="chip">három sablon</span>']],['edz-nyujtas','Új terv',[`<span class="chip">${G('plus','ink')}varázslóval</span>`]]].map(([p,n,c])=>`<article class="dl tap" role="button" tabindex="0" data-toast="${n} — a 3. körben jön"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips">${c.join('')}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('A negyedik héten a hát <em>12 szettre</em> emelkedik. Ha a vállad addig sem jobb, a Rear Delt Fly helyére Face Pull jön.',`<button class="pill soft" data-toast="Rendben: a csere be van készítve">Így legyen</button>`)}</div>`}

/* ── Terhelés ── */
function terheles(){const DS=[16,12,17,0,12,null,null],PL=[16,12,19,16,12,0,0];
  return `${ehead('Terhelés',{ph:'edz-kreta.jpg',pos:'center 45%',eb:'A hét terhelése · szeptember 21–27.',title:'55 / 83 szett a héten',sub:'Csütörtök van, a hét kétharmada megvan.',btn:`${G('person','ink')}Izomtérkép`,attrs:'data-toast="Az izomtérkép a 3. körben jön"'})}
  <h1 class="head rise" style="--i:1"><em>A hát és a comb</em> jól halad, a kar és a far lemaradt.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hét eddig</h3></div>${weekRing()}</section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Napról napra</h3><span class="crumb">szaggatott: a terv</span></div><div class="card" style="padding:16px 12px 12px"><div class="wk">${EWEEK.map(([d,s,t,st],i)=>{const v=DS[i],p=PL[i],fut=v==null||st==='today'||st==='plan';return `<div class="wd ${st==='today'?'today':''} ${fut?'fut':''}"><em>${st==='today'?'ma':v?v:st==='sport'?'röpi':''}</em><span class="tube" style="height:124px"><i style="height:${v?Math.min(100,v/20*100):0}%"></i>${p?`<u style="bottom:${p/20*100}%"></u>`:''}</span><b>${s}</b></div>`}).join('')}</div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Mit mond a tested</h3><span class="crumb">reggel 07:40</span></div><div class="card t-peach pad">${[['bolt','peach','Jobb váll','fáj, a Rear Delt Fly kímélve megy',['kímélve','5 / 10']],['flame','peach','Izomláz','a lábad, a szerdai guggolás után',['7 / 10']],['moon','sky','Alvás','6 óra 54 perc az éjjel',['kevesebb a szokottnál']]].map(([ic,pal,n,d,c])=>`<div class="row">${G(ic,pal)}<div><b>${n}</b><small>${d}</small><div class="chips">${c.map((x,i)=>`<span class="chip">${x}</span>`).join('')}</div></div></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Minden mozgásod</h3></div><div class="card trio t-sun">${[['ball','sun','2','röpi a héten'],['flame','deep','1 240','kalória sportból'],['clock','sky','180','perc sport']].map(([ic,pal,n,l])=>`<div>${G(ic,pal)}<b>${n}</b><small>${l}</small></div>`).join('')}</div>
    <div class="dlist one" style="margin-top:10px">${[['edz-ropi','Röplabda · kedd',[`<span class="chip soft">${G('flame','deep')}620 kalória</span>`,'<span class="chip">90 perc</span>']],['edz-futas','Sprint-intervallum · szerda',[`<span class="chip warm">${G('shoe','peach')}elmaradt</span>`]],['edz-ropi','Röplabda · ma 18:00',['<span class="chip">betervezve</span>','<span class="chip">90 perc</span>']],['edz-futas','Piramis-intervallum · péntek',['<span class="chip">betervezve</span>','<span class="chip">17:30</span>']]].map(([p,n,c],i)=>`<article class="dl tap ${i>1?'fut':''}" role="button" tabindex="0" data-toast="${n} — a sport oldala a 4. körben jön"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips">${c.join('')}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('A kar <em>9 szettnél</em> tart a 20-ból. A pénteki könnyű push napra beteszek két szett kalapácsbicepszt.',`<button class="pill soft" data-toast="Beteszem: péntek, 2 szett kalapácsbicepsz">Beteszem</button>`)}</div>`}

/* ── Gyakorlatok ── */
const exCard=([n,r,p,max,best,med,kind,note])=>`<article class="rl ex tap" role="button" tabindex="0" data-toast="${n} — a gyakorlat oldala a 4. körben jön"><div class="rph"><img class="ex" src="${EPH(p)}" alt="">${note?`<span class="chip ${note==='kímélve'?'warm':'soft'} care">${note}</span>`:''}</div><div class="rtx"><small class="ey">${G('dumbbell',REG[r][0])}${r} · ${kind.toLowerCase()}</small><strong>${n}</strong><div class="meta">${max!=='—'?`<span>${G('chart','deep')}max <b>${max}</b></span>`:''}<span>${G('star','sun')}legjobb <b>${best}</b></span></div></div>${med?`<span class="rate">${G('medal','sun')}${med}</span>`:''}<button class="go" data-toast="Hozzáadva a mai edzéshez: ${n}" aria-label="A mai edzéshez: ${n}">${G('plus','ink')}</button></article>`;
const exFilter=()=>{const q=ES.q.trim().toLowerCase();const L=GYAK.filter(g=>(!ES.cat||g[1]===ES.cat)&&(!ES.f||(ES.f==='Érmes'?g[5]>0:ES.f==='Mostanában'?['Guggolás','Román felhúzás','Húzódzkodás (súlyozott)','Döntött törzsű evezés','Kalapácsbicepsz','Fekvenyomás'].includes(g[0]):g[6]===ES.f))&&(!q||(g[0]+' '+g[1]).toLowerCase().includes(q)));
  return L.length?L.map(exCard).join(''):`<div class="emptyph"><img src="${PH('edz-sulyzo.jpg')}" alt=""><b>Ilyen gyakorlatod még nincs.</b><small>Felvehetsz újat, vagy választhatsz a tárból.</small><button class="pill soft" data-toast="Új gyakorlat — a 4. körben jön" style="margin-top:8px;justify-self:start">${G('plus','sage')}Új gyakorlat</button></div>`};
function gyak(){Object.assign(ES,{cat:'',f:'',q:''});
  return `${ehead('Gyakorlatok',{ph:'edz-sulyzo.jpg',eb:'Gyakorlattár',title:'42 gyakorlat · 14 érem',sub:'Mindegyiknél a becsült maximumod és a legjobb szetted.',btn:`${G('plus','ink')}Új gyakorlat`,attrs:'data-toast="Új gyakorlat — a 4. körben jön"'})}
  <h1 class="head rise" style="--i:1">Ezen a héten <em>két új rekord</em> lett: guggolás és román felhúzás.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Legutóbbi rekord</h3><a href="#" data-toast="Az érmek oldala a 4. körben jön">Érmek ${G('chev')}</a></div><div class="card gy only deep pre"><div class="recc"><img src="${EPH('barbell-squat')}" alt=""><div><small>Szerda · súlyrekord</small><strong>Guggolás</strong><span class="big">120 kg × 6<small>+2,5 kg</small></span></div></div>${tubesDeep([132,136,138,140,141,144],150,5,['1.','2.','3.','4.','5.','most'],'e1')}</div></section>
  <div class="sh rise" style="--i:3;margin:24px 20px 10px"><h3>A tárad</h3></div>
  ${searchBar({ph:'Gyakorlat vagy izom…',cls:'esin',aria:'Keresés a gyakorlatok közt'})}
  <div class="hrow cats rise" style="--i:3;margin-top:10px" id="ecats">${Object.entries(REG).map(([l,[,p]])=>`<button class="cat" data-ecat="${l}"><img src="${EPH(p)}" alt=""><span>${l}</span></button>`).join('')}</div>
  ${filterPills('efps',GF,'','data-ef')}
  <section class="rlist rise" style="--i:5" id="elist">${exFilter()}</section>
  <div class="emore rise" style="--i:6"><button class="pill soft" data-toast="A teljes tár (42 gyakorlat) a 4. körben jön">Mind a 42 gyakorlat</button></div>
  ${mzCard('A Face Pull két hete <em>27 kg-on áll</em>. Jövő héten 2,5 kg-mal feljebb próbáljuk, 15 ismétlésre.',`<button class="pill soft" data-toast="Betervezve: Face Pull 29,5 kg">Próbáljuk</button>`)}</div>`}

/* live filters on Gyakorlatok */
document.addEventListener('click',e=>{const t=e.target.closest('[data-ecat],[data-ef]');if(!t)return;e.preventDefault();e.stopPropagation();
  if(t.dataset.ecat!=null){ES.cat=ES.cat===t.dataset.ecat?'':t.dataset.ecat;$$('#ecats .cat').forEach(c=>c.classList.toggle('on',c.dataset.ecat===ES.cat))}
  else{ES.f=ES.f===t.dataset.ef?'':t.dataset.ef;$$('#efps .fp[data-ef]').forEach(c=>c.classList.toggle('on',c.dataset.ef===ES.f))}
  $('#elist').innerHTML=exFilter();haptic(6)},true);
document.addEventListener('input',e=>{if(e.target.classList.contains('esin')){ES.q=e.target.value;$('#elist').innerHTML=exFilter()}});
document.addEventListener('click',e=>{const t=e.target.closest('[data-why]');if(!t)return;t.classList.toggle('on');haptic(6)});

/* the skip sheet (Mai › Ma kihagyom) */
SHEETS.edzWhy=()=>`<div class="grab"></div><div class="dsh"><div class="dshph">${['edz-nyujtas','edz-huzodzkodas','edz-futas'].map(p=>`<img src="${PH(p+'-sq.jpg')}" alt="">`).join('')}</div><h2>Miért marad ki ma?</h2><div class="chips"><span class="chip soft">${G('dumbbell','deep')}Pull Day · 16:00</span><span class="chip">16 szett</span></div></div><div class="why">${WHY.map(([l,ic,pal])=>`<button class="fp" data-why="${l}">${G(ic,pal)}${l}</button>`).join('')}</div><p class="note">${G('spark','deep')}A beteg, gyomorrontás, sérülés és úton választásnál több napra kímélő módba teszem a tervet.</p><div class="acts" style="margin:14px 0 0"><button class="pill" data-go="edzes-mai-kihagyva">Kihagyom</button><button class="pill soft" data-close>Mégse</button></div>`;

/* side panel: Edzés notes while the domain is open (Fuel's notes come back outside it) */
const notes=document.querySelector('.notes'),FUELNOTES=notes?notes.innerHTML:'';
const ENOTES=()=>`<h2>Lágy irány · Edzés</h2><small>Állapot: 2026-11-04 · 1. kör: a négy fül</small><p>Az Edzés a Fuel nyelvén: fotó a lap tetején, egy mélyzöld kártya a fő számmal, színes kártyák, pirulák, Mezo a végén.</p><div class="tog"><button id="e320">320 px</button></div><p><b>A Mai fül állapotai:</b></p><ul>${STATES.map(([k,l])=>`<li><a href="#edzes${k?'-mai-'+k:''}">${l}</a></li>`).join('')}</ul><p><b>Ami a következő körökben jön:</b> az edzés közbeni folyamat (2.), a Terv aloldalai (3.), egy gyakorlat oldala, sport, lapok (4.).</p>`;
window.addEventListener('hashchange',()=>{if(!notes)return;const on=!!domOf(location.hash.slice(1))&&location.hash.slice(1).startsWith('edzes');if(on&&!notes.dataset.e){notes.innerHTML=ENOTES();notes.dataset.e=1;const b=$('#e320');if(b)b.onclick=()=>$('#phone').classList.toggle('w320')}else if(!on&&notes.dataset.e){notes.innerHTML=FUELNOTES;delete notes.dataset.e}});

/* keep the tab photos decoded so a tab switch never flashes */
['edz-huzodzkodas','edz-korlat','edz-kreta','edz-sulyzo'].forEach(n=>{const im=new Image();im.src=PH(n+'.jpg');if(im.decode)im.decode().catch(()=>{});TABPH.push(im)});

const MSTATES=STATES.map(s=>s[0]).filter(Boolean);
DOM.edzes={tabs:['edzes','edzes-terv','edzes-terheles','edzes-gyak',...MSTATES.map(s=>'edzes-mai-'+s)],
  tabName:h=>h==='edzes-terv'?'Terv':h==='edzes-terheles'?'Terhelés':h==='edzes-gyak'?'Gyakorlatok':'Mai',
  render:h=>h==='edzes-terv'?terv():h==='edzes-terheles'?terheles():h==='edzes-gyak'?gyak():h.startsWith('edzes-mai-')?mai(h.slice(10)):mai(''),
  after:()=>{if(notes&&!notes.dataset.e){notes.innerHTML=ENOTES();notes.dataset.e=1;const b=$('#e320');if(b)b.onclick=()=>$('#phone').classList.toggle('w320')}}};
})();
