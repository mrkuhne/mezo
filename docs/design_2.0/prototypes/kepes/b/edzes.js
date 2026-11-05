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
.arc6.a4{grid-template-columns:repeat(4,minmax(0,1fr))}.arc6.a5{grid-template-columns:repeat(5,minmax(0,1fr))}
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
const MESO={name:'Hypertrophy 04',week:3,of:6,sets:[64,70,75,82,91,43],phase:['alap','alap','építés','építés','csúcs','könnyű']};
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
const dstrip=()=>`<div class="card dstrip">${EWEEK.map(([d,s,t,st])=>`<button class="${st==='done'?'done':st==='today'?'today':st==='plan'||st==='sport'||st==='rest'?'plan':''}" ${dayGo(EWEEK.findIndex(w=>w[0]===d))} aria-label="${d}, ${t}"><i>${st==='done'?G('check','sage'):st==='today'?'24':st==='sport'?G('ball','sun'):st==='rest'?G('moon','sky'):G('dumbbell','ink')}</i>${s}</button>`).join('')}</div>`;

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
    '':{ph:'edz-huzodzkodas.jpg',pos:'center 30%',eb:'Ma · 16:00 · Hypertrophy 04 · 3. hét / 6',title:'Pull Day',sub:'Öt gyakorlat · 16 szett · körülbelül 64 perc',btn:`${G('bolt','ink')}Indítsuk`,at:'data-go="edzes-indulas"',
      h1:'Ma <em>hát és bicepsz</em> jön, a vállad kímélve.',lead:'A Rear Delt Fly könnyített súllyal megy, amíg a jobb vállad fáj.'},
    folyamatban:{ph:'edz-huzodzkodas.jpg',pos:'center 30%',eb:'Folyamatban · 16:04 óta · 12 perc',title:'Pull Day',sub:'Az első gyakorlatnál tartasz: húzódzkodás, 3. szett.',btn:`${G('bolt','ink')}Folytassuk`,at:'data-go="edzes-session"',
      h1:'<em>Két szett megvan</em> a tizenhatból. Jó kezdés.',lead:'A második szett rekord lett: +12,5 kg nyolcszor.'},
    kesz:{ph:'edz-sulyzotarto.jpg',eb:'Ma · kész · 71 perc',title:'Pull Day megvan',sub:'14 szett · 142 ismétlés · 4 180 kg megmozgatva',btn:`${G('star','ink')}Az eredmény`,at:'data-go="edzes-review"',
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
  const done=st==='kesz'?14:st==='folyamatban'?2:0;
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
  return `${ehead('Terv',{ph:'edz-korlat.jpg',pos:'center 40%',eb:'Futó terv · 3. hét / 6 · október 18-ig',title:'Hypertrophy 04',sub:'Pull / Push / Legs · öt edzés egy héten',btn:`${G('chart','ink')}A terv`,attrs:'data-go="edzes-run"'})}
  <h1 class="head rise" style="--i:1">A harmadik hétnél tartasz, <em>innen emelkedik</em> a terhelés.</h1>
  <p class="lead rise" style="--i:1">A negyedik és ötödik hét a legkeményebb, a hatodik könnyű hét.</p>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hat hét</h3><a href="#edzes-run">Az ív ${G('chev')}</a></div><div class="card gy only deep pre"><div class="dhead"><small>Szett egy héten</small><b>75<small>ezen a héten</small></b></div>${tubesDeep(MESO.sets,100,2,['1.','2.','3.','4.','5.','6.'])}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Ez a hét</h3><span class="crumb">szeptember 21–27.</span></div><div class="dlist">${EWEEK.map(([d,s,t,st,n,ps,m])=>{const fut=st==='plan'||st==='rest'||st==='sport';
    return `<article class="dl tap ${st==='today'?'today':''} ${fut&&st!=='sport'?'fut':''}" role="button" tabindex="0" ${dayGo(EWEEK.findIndex(w=>w[0]===d))}>${ps?exStack(ps):st==='sport'?`<span class="stk"><img src="${PH('edz-ropi-sq.jpg')}" alt=""></span>`:`<span class="stk none">${G('moon','sky')}</span>`}<div class="dtx"><strong>${d} · ${t}</strong><div class="chips">${st==='done'?`<span class="chip soft">${G('check','sage')}kész</span>`:st==='today'?`<span class="chip soft">${G('bolt','deep')}ma</span>`:''}${n?`<span class="chip">${set1(n)}</span>`:''}${m?`<span class="chip">${m}</span>`:''}</div></div>${G('chev','ink','chev')}</article>`}).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Izmaid a héten</h3><a href="#edzes-het">Heti vizsgálat ${G('chev')}</a></div><div class="card gy only t-sage"><div class="bars">${WMUS.map(([l,d,t])=>`<div class="br"><span>${l}</span><b>${d} <small>/ ${t} szett</small></b><u><i style="--w:${Math.min(100,d/t*100)}%;background:${d>=t?'var(--deep)':d/t<.5?'var(--peach)':'var(--sage)'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Terveid</h3><a href="#edzes-tervek">Mind ${G('chev')}</a></div><div class="dlist one">${[['edz-korlat','Hypertrophy 04',[`<span class="chip soft">${G('bolt','deep')}fut</span>`,'<span class="chip">3. hét / 6</span>'],'edzes-run'],['edz-sulyzotarto','Strength 02',['<span class="chip">következik</span>','<span class="chip">október 19-től</span>'],'edzes-tervek'],['edz-sulyzo','Sablonok',['<span class="chip">három sablon</span>'],'edzes-sablonok'],['edz-kreta','Lezárt futamok',[`<span class="chip warm">${G('star','sun')}legjobb 92%</span>`],'edzes-futamok'],['edz-futas','Futás',['<span class="chip">Robbanékonyság 01</span>'],'edzes-futas'],['edz-nyujtas','Új terv',[`<span class="chip">${G('plus','ink')}varázslóval</span>`],'edzes-ujterv']].map(([p,n,c,go])=>`<article class="dl tap" role="button" tabindex="0" data-go="${go}"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips">${c.join('')}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
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

/* ══ Round 2: the in-workout flow — eligazítás → edzés közben (szettek, pihenő) → lezárás → összegzés ══ */
document.head.insertAdjacentHTML('beforeend',`<style>
/* Edzés flow: time range in the briefing's deep card */
.trange{width:100%;display:grid;gap:8px}
.trange .tbar{position:relative;height:14px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden}
.trange .tbar i{position:absolute;left:0;top:0;bottom:0;width:var(--a);background:linear-gradient(90deg,rgba(191,227,204,.35),rgba(191,227,204,.6));border-radius:999px}
.trange .tbar u{position:absolute;top:0;bottom:0;left:var(--a);width:var(--b);background:linear-gradient(90deg,#F4C860,#E9B44C);border-radius:999px}
.trange .tax{display:flex;justify-content:space-between;font:700 12px var(--b);color:rgba(255,255,255,.7)}.trange .tax b{color:#fff}
.trio.deep.in{padding:12px 0 0;margin-top:4px;border-top:1px solid rgba(255,255,255,.12);background:none;box-shadow:none;width:100%}
/* quest cards */
.qlist{display:grid;gap:10px}
.qc{display:grid;grid-template-columns:56px minmax(0,1fr) 44px;gap:12px;align-items:center;background:var(--card);border-radius:22px;box-shadow:var(--sh);padding:12px 12px 12px 12px;text-align:left}
.qc.off{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(30,35,33,.12)}
.qc img{width:56px;height:56px;border-radius:16px;object-fit:cover}
.qc small{display:flex;align-items:center;gap:5px;font:700 12px var(--b);color:var(--ink2)}.qc small .g{font-size:14px}
.qc strong{display:block;font:600 16px/1.2 var(--d);margin-top:2px}
.qc .lv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin-top:8px}
.qc .lv u{display:block;height:6px;border-radius:3px;background:rgba(30,35,33,.08);overflow:hidden;text-decoration:none}.qc .lv u i{display:block;height:100%;width:var(--w);background:var(--sun);border-radius:3px}
.qc .lv span{font:700 12px var(--b);color:var(--ink2)}
.qc .qwhy{border:0;background:none;font:700 12.5px var(--b);color:var(--deep);padding:10px 0 0;min-height:40px}
.qt{width:44px;height:44px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--paper);box-shadow:inset 0 0 0 1.5px rgba(30,35,33,.16);padding:0}
.qt .g{font-size:20px;opacity:.35}.qt.on{background:var(--sage);box-shadow:0 10px 20px -10px rgba(46,107,82,.7)}.qt.on .g{opacity:1;filter:brightness(0) invert(1)}
/* session: exercise progress strip */
.pstrip{display:flex;gap:6px;padding:10px}
.pstrip button{border:0;background:none;display:grid;gap:5px;padding:4px 2px;min-width:0;min-height:44px;text-align:left}
.pstrip button span{display:block;height:8px;border-radius:999px;background:rgba(30,35,33,.08);overflow:hidden}.pstrip button span i{display:block;height:100%;width:var(--w);background:var(--sage);border-radius:999px}
.pstrip button small{font:700 12px var(--b);color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pstrip button.on small{color:var(--deep)}.pstrip button.on span{box-shadow:0 0 0 2px var(--sage)}.pstrip button.full span i{background:var(--deep)}
/* session: the set table on the deep card */
.stab{width:100%;display:grid;grid-template-columns:28px repeat(3,minmax(0,1fr)) 44px;gap:8px 8px;align-items:center}
.stab .h{font:700 12px var(--b);color:rgba(255,255,255,.65);text-align:center}.stab .h:first-child{text-align:left}
.stab .n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 12.5px var(--b);background:rgba(255,255,255,.12);color:#fff}
.stab .n.cur{background:#F4C860;color:#1E2321}
.stab .v{font:600 17px var(--d);color:#fff;text-align:center;font-variant-numeric:tabular-nums}.stab .v.up{color:rgba(255,255,255,.45)}
.stab input{width:100%;min-width:0;height:44px;border:0;border-radius:14px;background:#fff;color:var(--ink);font:600 17px var(--d);text-align:center;font-variant-numeric:tabular-nums}
.stab .ok{width:44px;height:44px;border-radius:50%;border:0;background:#F4C860;display:grid;place-items:center;padding:0;box-shadow:0 10px 20px -10px rgba(0,0,0,.5)}.stab .ok .g{font-size:20px}
.stab .vd{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.12);display:grid;place-items:center;padding:0}.stab .vd .g{font-size:20px}
.stab .slg{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)}
.stab .slg span{display:inline-flex;align-items:center;gap:4px;font:700 12px var(--b);color:rgba(255,255,255,.75)}.stab .slg .g{font-size:14px}
.sgoal{display:flex;justify-content:space-between;width:100%;gap:10px}
.sgoal div{display:grid;gap:2px}.sgoal small{font:700 12px var(--b);text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.65)}.sgoal b{font:600 17px var(--d);color:#fff}.sgoal i{font-style:normal;font:700 12px var(--b);color:#F4C860}
.sgoal div:last-child{text-align:right;justify-items:end}
/* the rest dock (replaces the bottom bar while resting) */
.edock{position:absolute;left:12px;right:12px;bottom:12px;z-index:6;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 8px 8px 16px;border-radius:999px;background:rgba(255,255,255,.92);backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);box-shadow:0 20px 40px -18px rgba(30,35,33,.45),0 0 0 1px rgba(30,35,33,.05);transform:translateY(130%);transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.edock.on{transform:none}
.edock .rtm{display:grid;gap:5px;min-width:0}
.edock .rtm strong{font:600 20px var(--d);font-variant-numeric:tabular-nums;letter-spacing:-.02em}.edock .rtm strong small{font:700 12px var(--b);color:var(--mute);margin-left:6px;letter-spacing:0}
.edock .rtm u{display:block;height:6px;border-radius:3px;background:rgba(30,35,33,.08);overflow:hidden;text-decoration:none}.edock .rtm u i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,var(--sage2),var(--sage));border-radius:3px;transition:width 1s linear}
.edock .pill{height:44px;padding:0 14px;box-shadow:none}
.phone.resting .scroll{padding-bottom:110px}
/* ceremony stars */
.cstars{display:flex;gap:6px;align-items:center}
.cst{position:relative;width:38px;height:38px}.cst .g{position:absolute;inset:0;width:38px;height:38px;font-size:38px}
.cst .g:first-child{opacity:.22;filter:grayscale(1) brightness(2)}
.cst .fill{position:absolute;inset:0;width:0;overflow:hidden;transition:width .45s cubic-bezier(.2,.8,.2,1)}.cst .fill .g{opacity:1;filter:none}
.cstars.go .cst .fill{width:var(--f)}
.cstars.go .cst:nth-child(2) .fill{transition-delay:.18s}.cstars.go .cst:nth-child(3) .fill{transition-delay:.36s}.cstars.go .cst:nth-child(4) .fill{transition-delay:.54s}.cstars.go .cst:nth-child(5) .fill{transition-delay:.72s}
body.still .cst .fill{transition:none}
.w320 .cst,.w320 .cst .g{width:30px;height:30px;font-size:30px}.w320 .cstars{gap:4px}.w320 .cscore{font-size:22px}
.cscore{font:600 26px var(--d);color:#fff;margin-left:6px}.cscore small{font:700 12px var(--b);color:rgba(255,255,255,.7);margin-left:4px}
.notefld{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:10px;align-items:center;padding:12px 12px 12px 16px;text-align:left;border:0;width:100%;color:var(--ink)}
.notefld span{font:600 14px/1.4 var(--b);color:var(--ink2)}.notefld i{width:44px;height:44px;border-radius:50%;background:#fff;display:grid;place-items:center}.notefld i .g{font-size:20px}
.cmp .br{padding:8px 0}.cmp .br+.br{border-top:1px solid var(--line)}.cmp .br u i.prev{opacity:.35}
.cmp .br em{grid-column:1/-1;font-style:normal;font:700 12px var(--b);color:var(--mute)}
.phone[data-theme="dark"] .edock{background:rgba(30,38,34,.92)}.phone[data-theme="dark"] .qt{background:#26312B}
</style>`);

/* the session: one object, filled by the workout, read by every flow page */
const SX0=[{n:'Húzódzkodás (súlyozott)',p:'weighted-pull-up',mus:'Hát · széles',last:'10 × 8',goal:'12,5 × 8',chg:'+2,5 kg',w:12.5,r:8,ri:2,q:0,sets:4},
  {n:'Döntött törzsű evezés',p:'barbell-row',mus:'Hát · közép',last:'70 × 10',goal:'72,5 × 10',chg:'+2,5 kg',w:72.5,r:10,ri:2,q:1,sets:3,cue:'Könyök a test mellett, lassú leengedés.'},
  {n:'Rear Delt Fly',p:'cable-rear-delt-fly',mus:'Váll · hátsó',last:'12,5 × 12',goal:'10 × 12',chg:'könnyítve · −2,5 kg',w:10,r:12,ri:3,q:3,sets:3,warn:'A jobb vállad fáj (5 / 10): ma könnyebb súllyal, vagy hagyd ki.'},
  {n:'Kalapácsbicepsz',p:'hammer-curl',mus:'Bicepsz',last:'16 × 12',goal:'16 × 13',chg:'+1 ismétlés',w:16,r:13,ri:1,q:2,sets:3,cue:'A 18 kg túl nagy ugrás lenne: előbb egy ismétléssel több 16 kg-mal.'},
  {n:'Vállemelés',p:'db-shrug',mus:'Trapéz',last:'30 × 15',goal:'30 × 15',chg:'tartjuk',w:30,r:15,ri:2,sets:3,cue:'Fent tarts egy pillanatot, ne forgasd a vállad.'}];
const QUEST=[{t:'Túlterhelés',ic:'chart',pal:'sage',ex:0,target:'12,5 kg × 8',conf:50,cl:'még tanulom',why:'Múlt héten 10 kg × 8 volt, a tartomány tetején: ezért jön a +2,5 kg.',on:true},
  {t:'Rekordkísérlet',ic:'medal',pal:'sun',ex:1,target:'75 kg × 8',conf:72,cl:'72% biztos',why:'Május óta 70 kg a stabil szinted. A múlt heti 2 ismétlés tartalék és a 7 óra alvás együtt négyből háromszor bírt el +5 kg-ot.',on:true},
  {t:'Mélység',ic:'flame',pal:'peach',ex:3,target:'Az utolsó szett tartalék nélkül',conf:81,cl:'81% biztos',why:'Múlt héten egy ismétlés tartalékkal zártad. A 3. héten az utolsó szett tartalék nélkül a logikus lépés.',on:true},
  {t:'Volumen',ic:'repeat',pal:'sky',ex:2,target:'+1 szett · 4 × 12',conf:68,cl:'68% biztos',why:'A hátsó váll heti 12 szettet kér, most 9-nél tartasz. Csak akkor, ha nem fáj a vállad.',on:false}];
const EST={day:'',sx:null,focus:null,rest:null,pend:null};
const fk=v=>String(v).replace('.',',');
const seedSX=done=>EST.sx=SX0.map((e,i)=>({...e,rows:Array.from({length:e.sets},(_,j)=>{const k=i===0&&j<done;return k?[e.w,e.r,j===1?1:2,j===1?'record':'tick']:['up',e.w,e.r,e.ri]})}));
const markCur=()=>{let found=false;EST.sx.forEach(e=>e.rows.forEach(r=>{if(r[0]==='cur')r[0]='up'}));for(const e of EST.sx){const r=e.rows.find(x=>x[0]==='up');if(r){r[0]='cur';found=true;break}}return found};
const isD=r=>typeof r[0]==='number';
const sxDone=()=>EST.sx.reduce((a,e)=>a+e.rows.filter(isD).length,0),sxTot=()=>EST.sx.reduce((a,e)=>a+e.rows.length,0);
const curI=()=>Math.max(0,EST.sx.findIndex(e=>e.rows.some(r=>r[0]==='cur')));
const VERD={tick:['check','sage','célsávban'],record:['medal','sun','rekord'],up:['chart','sage','cél fölött'],down:['back','peach','cél alatt']};
const ensureSX=()=>{if(!EST.sx){seedSX(2);markCur()}};

/* ── Eligazítás ── */
function indulas(){const n=QUEST.filter(q=>q.on).length;
  return `${ihead({ph:'edz-huzodzkodas.jpg',crumb:'Edzés › Mai › <b>Eligazítás</b>',eb:'Pull Day · 3. hét / 6 · 16:00',title:'70–85 perc ma',sub:'Öt gyakorlat, 16 szett, a saját tempód alapján.',btn:`${G('bolt','ink')}<span id="qgo">Indulás · ${n} küldetéssel</span>`,attrs:'data-estart'})}
  <h1 class="head rise" style="--i:1">Ma <em>három küldetést</em> javaslok, egyet elengedtem.</h1>
  <p class="lead rise" style="--i:1">Passzolni ér, és edzés közben is elengedheted bármelyiket.</p>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A mai edzés</h3></div><div class="card gy only deep"><div class="dhead"><small>Várható idő</small><b>70–85<small>perc</small></b></div><div class="trange"><span class="tbar" style="--a:${70/95*100}%;--b:${15/95*100}%"><i></i><u></u></span><span class="tax"><span>0</span><span>30</span><span>60</span><b>85 perc</b></span></div><div class="trio deep in">${[['dumbbell','sage','5','gyakorlat'],['repeat','sky','16','szett'],['star','sun',`<span id="qn">${n}</span>`,'küldetés']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Figyelj rá</h3></div><div class="card t-peach pad"><div class="row">${G('bolt','peach')}<div><b>Jobb váll · 5 / 10</b><small>Először bemelegítő szett, a Rear Delt Fly ma könnyítve megy.</small></div></div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Mit vállalsz ma?</h3></div><div class="qlist">${QUEST.map((q,i)=>`<article class="qc ${q.on?'':'off'}" data-qi="${i}"><img class="ex" src="${EPH(SX0[q.ex].p)}" alt=""><div><small>${G(q.ic,q.pal)}${q.t} · ${SX0[q.ex].n}</small><strong>${q.target}</strong><div class="lv"><u><i style="--w:${q.conf}%"></i></u><span>${q.cl}</span></div><button class="qwhy" data-sheet="edzQuest" data-arg="${i}">Miért ez?</button></div><button class="qt ${q.on?'on':''}" data-qtog="${i}" aria-label="${q.on?'Elengedem':'Vállalom'}: ${q.target}">${G('check','ink')}</button></article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>A mai sor</h3><span class="crumb">16 szett</span></div><div class="dlist one">${SX0.map((e,i)=>`<article class="dl"><span class="stk"><img class="ex" src="${EPH(e.p)}" alt=""></span><div class="dtx"><strong>${e.n}</strong><div class="chips"><span class="chip soft">${G('repeat','deep')}${e.sets} × ${e.goal}</span><span class="chip ${e.warn?'warm':''}">${e.chg}</span>${QUEST.some(q=>q.on&&q.ex===i)?`<span class="chip warm">${G('star','sun')}küldetés</span>`:''}</div></div></article>`).join('')}</div></section>
  ${mzCard('A húzódzkodásnál <em>+2,5 kg</em> a lépés, az evezésnél egy ismétlés. Ha a váll fáj, a Rear Delt Fly-t nyugodtan hagyd ki.')}</div>`}

/* ── Edzés közben ── */
function session(){ensureSX();const ci=curI(),fi=EST.focus!=null?EST.focus:ci,e=EST.sx[fi],d=sxDone(),T=sxTot(),dn=x=>x.rows.filter(isD).length,q=QUEST.find(x=>x.ex===fi);
  const row=(r,j)=>{if(isD(r)){const [ic,pal,l]=VERD[r[3]];return `<span class="n">${j+1}</span><span class="v">${fk(r[0])}</span><span class="v">${r[1]}</span><span class="v">${r[2]}</span><button class="vd" data-sheet="edzSet" data-arg="${fi}.${j}" aria-label="${j+1}. szett, ${l}: szerkesztem">${G(ic,pal)}</button>`}
    if(r[0]==='cur'&&fi===ci)return `<span class="n cur">${j+1}</span><input class="ein" data-c="w" inputmode="decimal" value="${fk(r[1])}" aria-label="Súly, kilogramm"><input class="ein" data-c="r" inputmode="numeric" value="${r[2]}" aria-label="Ismétlés"><input class="ein" data-c="ri" inputmode="numeric" value="${r[3]}" aria-label="Tartalék ismétlés"><button class="ok" data-eok="${fi}.${j}" aria-label="Szett kész">${G('check','ink')}</button>`;
    return `<span class="n">${j+1}</span><span class="v up">${fk(r[1])}</span><span class="v up">${r[2]}</span><span class="v up">${r[3]}</span><span></span>`};
  return `${ihead({ph:fi===0?'edz-huzodzkodas.jpg':'edz-sulyzotarto.jpg',crumb:'Edzés › Pull Day › <b>Edzés közben</b>',eb:`${fi===ci?'Most':'Megnyitva'} · ${fi+1}. gyakorlat / 5 · ${e.mus}`,title:e.n,sub:`Múlt héten ${e.last}, ma ${e.goal} (${e.chg}).`,btn:`${G('book','ink')}Technika`,attrs:`data-sheet="edzTech" data-arg="${fi}"`,sm:true})}
  <section class="sec rise first" style="--i:1"><div class="card pstrip">${EST.sx.map((x,i)=>`<button class="${i===fi?'on':''} ${dn(x)===x.rows.length?'full':''}" data-efocus="${i}" style="flex:${x.rows.length}" aria-label="${x.n}: ${dn(x)} / ${x.rows.length} szett"><span><i style="--w:${dn(x)/x.rows.length*100}%"></i></span><small>${i+1}. · ${dn(x)}/${x.rows.length}</small></button>`).join('')}</div></section>
  <h1 class="head rise" style="--i:1">${d?`<em>${d} / ${T} szett</em> megvan.${d<T?' Jó tempó.':' Mehet a lezárás.'}`:`Kezdjük: <em>${T} szett</em> vár ma.`}</h1>
  <section class="sec rise" style="--i:2"><div class="sh"><h3>A szettek</h3><a href="#" data-sheet="edzRecs" data-arg="${fi}">Rekordok ${G('chev')}</a></div><div class="card gy only deep"><div class="sgoal"><div><small>Múlt héten</small><b>${e.last}</b></div><div><small>Mai cél</small><b>${e.goal}</b><i>${e.chg}</i></div></div><div class="stab"><span class="h">#</span><span class="h">kg</span><span class="h">ismétlés</span><span class="h">tartalék</span><span></span>${e.rows.map(row).join('')}${e.rows.some(isD)?`<div class="slg">${Object.values(VERD).map(([ic,pal,l])=>`<span>${G(ic,pal)}${l}</span>`).join('')}</div>`:''}</div></div></section>
  ${q||e.cue||e.warn?`<section class="sec rise" style="--i:3"><div class="card ${e.warn?'t-peach':'t-sun'} pad">${q?`<div class="row tap" role="button" tabindex="0" data-sheet="edzQuest" data-arg="${QUEST.indexOf(q)}">${G(q.ic,q.pal)}<div><b>Küldetés · ${q.target}</b><div class="chips"><span class="chip">${q.t}</span><span class="chip ${q.on?'soft':''}">${q.on?'vállalva':'elengedve'}</span></div></div>${G('chev','ink','chev')}</div>`:''}${e.cue?`<div class="row">${G('book','sky')}<div><b>Emlékeztető</b><small>${e.cue}</small></div></div>`:''}${e.warn?`<div class="row">${G('bolt','peach')}<div><b>Kímélve</b><small>${e.warn}</small></div></div>`:''}</div></section>`:''}
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A mai sor</h3></div><div class="dlist one">${EST.sx.map((x,i)=>i===fi?'':`<article class="dl tap" role="button" tabindex="0" data-efocus="${i}"><span class="stk"><img class="ex" src="${EPH(x.p)}" alt=""></span><div class="dtx"><strong>${x.n}</strong><div class="chips">${i===ci?`<span class="chip ink">most</span>`:dn(x)===x.rows.length?`<span class="chip soft">${G('check','sage')}kész</span>`:''}<span class="chip">${dn(x)} / ${x.rows.length} szett</span><span class="chip">${x.goal}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Közben és a végén</h3></div><div class="ealt"><button data-toast="Gyakorlat hozzáadása — a választó a 4. körben jön">${G('plus','sage')}<b>Gyakorlat hozzáadása</b><span>a lista végére</span></button><button data-sheet="edzFin">${G('star','sun')}<b>Edzés befejezése</b><span>${T-d} szett van hátra</span></button><button class="wide" data-sheet="edzMenu" data-arg="${fi}">${G('dots','ink')}<b>Műveletek ehhez a gyakorlathoz</b>${G('chev','ink','chev')}</button></div></section>
  ${mzCard(fi===0?'Ha a harmadik szett utolsó ismétlése nehéz, <em>ne erőltesd</em>: a küldetés két jó szettel is megvan.':`A ${e.n.toLowerCase()} után <em>${EST.sx.slice(fi+1).filter(x=>x.rows.some(r=>!isD(r))).length}</em> gyakorlat marad. Tartsd a 90 másodperces pihenőt.`)}</div>`}
const sessPaint=()=>{const sc=$('#scroll');if(!sc||location.hash!=='#edzes-session')return;const y=sc.scrollTop;sc.innerHTML=session().replace(/ rise/g,'');sc.scrollTop=y};

/* the rest dock: a real countdown, a draining bar, +30 mp, Tovább */
const dock=document.createElement('div');dock.className='edock';dock.id='edock';$('#phone').appendChild(dock);
const mmss=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const dockPaint=()=>{const R=EST.rest;if(!R){dock.classList.remove('on');$('#phone').classList.remove('resting');return}dock.innerHTML=`<div class="rtm"><strong>${mmss(R.left)}<small>pihenő · ${R.total} mp</small></strong><u><i style="--w:${R.left/R.total*100}%"></i></u></div><button class="pill soft" data-eplus aria-label="Plusz 30 másodperc">+30 mp</button><button class="pill" data-estop>Tovább</button>`;dock.classList.add('on');$('#phone').classList.add('resting')};
const stopRest=()=>{if(EST.rest)clearInterval(EST.rest.t);EST.rest=null;dockPaint()};
const startRest=()=>{stopRest();EST.rest={left:90,total:90,t:setInterval(()=>{const R=EST.rest;if(!R)return;R.left--;if(R.left<=0){stopRest();toast('Pihenő vége, jöhet a következő szett');haptic(20);return}const s=dock.querySelector('strong'),b=dock.querySelector('u i');if(s)s.firstChild.textContent=mmss(R.left);if(b)b.style.setProperty('--w',R.left/R.total*100+'%')},1000)};dockPaint()};
window.addEventListener('hashchange',()=>{if(location.hash!=='#edzes-session')stopRest()});

/* ── Lezárás (ceremony) ── */
const CER={sets:14,reps:142,vol:4180,min:71,pts:185,kcal:540,stars:4.5};
const counter=()=>{const still=document.body.classList.contains('still')||matchMedia('(prefers-reduced-motion:reduce)').matches;$$('#scroll [data-cnt]').forEach(el=>{const to=+el.dataset.cnt;if(still){el.textContent=nb(to);return}const t0=performance.now()+700;const f=now=>{const k=Math.max(0,Math.min(1,(now-t0)/1200)),v=Math.round(to*(1-Math.pow(1-k,3)));el.textContent=nb(v);if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)});requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=$('#scroll .cstars');if(s)s.classList.add('go')}))};
function cer(){const done=[4,3,3,2,2];
  return `${ihead({ph:'edz-sulyzotarto.jpg',crumb:'Edzés › Pull Day › <b>Lezárva</b>',eb:'Pull Day · szeptember 24. · 71 perc',title:'Erős nap.',sub:'Négy és fél csillag az ötből, két új rekorddal.',btn:`${G('chart','ink')}Az összegzés`,attrs:'data-go="edzes-review"'})}
  <h1 class="head rise" style="--i:1"><em>14 szett</em> a 16-ból, és két rekord.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Így sikerült</h3></div><div class="card gy only deep"><div class="cstars">${[1,1,1,1,.5].map(f=>`<span class="cst" style="--f:${f*100}%">${G('star','cream')}<span class="fill">${G('star','sun')}</span></span>`).join('')}<span class="cscore">4,5<small>/ 5</small></span></div><div class="trio deep in">${[['repeat','sky','sets','szett'],['bolt','sun','reps','ismétlés'],['dumbbell','sage','vol','kg megmozgatva']].map(([ic,pal,k,l])=>`<div>${G(ic,pal)}<b data-cnt="${CER[k]}">0</b><small>${l}</small></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Ez a tiéd mostantól</h3><span class="crumb">két új rekord</span></div><div class="card t-sun pad">${[['weighted-pull-up','Húzódzkodás (súlyozott)','Súlyrekord','+12,5 kg × 8','előtte +10 kg'],['barbell-row','Döntött törzsű evezés','Ismétlésrekord','72,5 kg × 10','előtte 9 ismétlés']].map(([p,n,t,v,pv])=>`<div class="row"><img class="rimg big ex" src="${EPH(p)}" alt=""><div><b>${n}</b><div class="chips"><span class="chip">${G('medal','sun')}${t}</span><span class="chip">${pv}</span></div></div><span class="v">${v}</span></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A mai számok</h3></div><div class="card trio">${[['clock','sky',CER.min,'perc edzés'],['star','sun','+'+CER.pts,'pont'],['flame','deep','+'+CER.kcal,'kalória']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Küldetések</h3><span class="crumb">egy a kettőből</span></div><div class="card pad">${[['check','sage','Húzódzkodás: 12,5 kg × 8',`<span class="chip soft">${G('check','sage')}megvan</span>`],['moon','sky','Kalapácsbicepsz: utolsó szett tartalék nélkül','<span class="chip">most nem jött össze</span>']].map(([ic,pal,t,c])=>`<div class="row">${G(ic,pal)}<div><b>${t}</b><div class="chips">${c}</div></div></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Izmok a mai edzésen</h3></div><div class="card gy only"><div class="bars">${PMUS.map(([l,n,c],i)=>`<div class="br"><span>${l}</span><b>${done[i]} <small>/ ${n} szett</small></b><u><i style="--w:${done[i]/n*100}%;background:${done[i]>=n?'var(--deep)':'var(--sage)'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:7"><div class="sh"><h3>A mai mozgással</h3></div><div class="card t-peach pad"><div class="row">${G('flame','peach')}<div><b>+540 kalória a mai keretedbe</b><small>A Fuel napi kerete ennyivel nőtt.</small></div></div><div class="acts" style="margin:8px 0 6px"><button class="pill soft" data-go="">Megnézem a Fuelben</button></div></div></section>
  <section class="sec rise" style="--i:8"><div class="sh"><h3>Hogy ment?</h3></div><button class="card t-sky notefld" data-sheet="edzNote"><span>Például: rosszul aludtam, de a húzódzkodás jól ment…</span><i>${G('mic','ink')}</i></button></section>
  <section class="sec rise" style="--i:9"><div class="acts" style="margin:0"><button class="pill" data-edone>Vissza a mai napra</button></div></section>
  ${mzCard('A két rekord után a jövő héten <em>az evezés 75 kg-mal</em> indul. Egyél a röpi előtt egy banánt, 18:00-ig van időd.')}</div>`}

/* ── Összegzés ── */
const LANE=[['Húzódzkodás (súlyozott)','weighted-pull-up','+12,5 × 8',4,4,1,'Hát széles'],['Döntött törzsű evezés','barbell-row','72,5 × 10',3,3,1,'Hát közép'],['Rear Delt Fly','cable-rear-delt-fly','10 × 12',3,3,0,'Hátsó váll'],['Kalapácsbicepsz','hammer-curl','16 × 13',3,2,0,'Bicepsz'],['Vállemelés','db-shrug','30 × 15',3,2,0,'Trapéz']];
function review(){
  return `${ihead({ph:'edz-sulyzotarto.jpg',crumb:'Edzés › Mai › <b>Összegzés</b>',eb:'Lezárva · szeptember 24. · Pull Day',title:'14 szett a 16-ból',sub:'4,2 tonna összesen · 71 perc a tervezett 62 helyett.',btn:`${G('back','ink')}Előző Pull Day`,attrs:'data-toast="Előző Pull Day · szeptember 17."'})}
  <h1 class="head rise" style="--i:1"><em>Három rekord</em>, és a legnehezebb szett három hete emelkedik.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Gyakorlatonként</h3></div><div class="card gy only deep pre"><div class="dhead"><small>Kész szett / terv</small><b>14<small>/ 16</small></b></div>${tubesDeep(LANE.map(l=>l[4]),4,-1,LANE.map(l=>l[6].split(' ')[0]),'arc6 a5',v=>v)}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Mihez képest</h3><span class="crumb">szeptember 17.</span></div><div class="card gy only cmp"><div class="bars">${[['Összesen megmozgatva','4,2 t','előtte 3,9 t',100,93],['Legnehezebb szett','12,5 × 8','előtte 10 × 8',100,80],['Átlagos tartalék','1,6 ismétlés','előtte 2,0: kevesebb maradt',80,100]].map(([l,v,p,a,b])=>`<div class="br"><span>${l}</span><b>${v}</b><u><i style="--w:${a}%;background:var(--sage)"></i></u><u><i class="prev" style="--w:${b}%;background:var(--ink2)"></i></u><em>${p}</em></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Érmek</h3><span class="crumb">három rekord · kilenc célszett</span></div><div class="card t-sun pad">${[['weighted-pull-up','Húzódzkodás (súlyozott)','Súlyrekord','+12,5 kg'],['barbell-row','Döntött törzsű evezés','Ismétlésrekord','10 × 72,5'],['barbell-row','Döntött törzsű evezés','Mennyiségi rekord','2 175 kg']].map(([p,n,t,v])=>`<div class="row"><img class="rimg big ex" src="${EPH(p)}" alt=""><div><b>${n}</b><div class="chips"><span class="chip">${G('medal','sun')}${t}</span></div></div><span class="v">${v}</span></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Küldetések</h3></div><div class="card pad"><div class="row">${G('check','sage')}<div><b>Húzódzkodás: 12,5 kg × 8 az első szetten</b><div class="chips"><span class="chip soft">megvan</span></div></div></div><div class="row">${G('moon','sky')}<div><b>Kalapácsbicepsz: utolsó szett tartalék nélkül</b><div class="chips"><span class="chip">kimaradt, nem büntet</span></div></div></div></div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>A gyakorlatok</h3></div><div class="dlist one">${LANE.map(([n,p,t,of,d,rec],i)=>`<article class="dl tap" role="button" tabindex="0" ${i===0?'data-go="edzes-review-gyak"':`data-toast="${n} összegzése — ugyanígy, mint a húzódzkodásé"`}><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip ${d<of?'':'soft'}">${d} / ${of} szett</span><span class="chip">${t}</span>${rec?`<span class="chip warm">${G('medal','sun')}rekord</span>`:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:7"><div class="sh"><h3>Amit aznap írtál</h3><a href="#" data-sheet="edzNote">Szerkesztem ${G('chev')}</a></div><div class="card t-sky pad"><p style="margin:8px 0;font:600 14px/1.5 var(--b);color:var(--ink2)">Ma a váll végig nyugton volt, a sorok tiszták. A kalapácsbicepsznél az utolsó szett elmaradt, elfogyott az idő.</p></div></section>
  ${mzCard('A javulás itt <em>a trend</em>, nem egy nap: a legnehezebb szett súlya három hete emelkedik. Jövő héten a bicepsznél pótoljuk a két szettet.',`<button class="pill soft" data-toast="Betervezve: jövő heti Pull Day +2 szett bicepsz">Betervezem</button>`)}</div>`}
function reviewGyak(){const S=[['12,5 × 8',8,2,'tick'],['12,5 × 8',8,1,'record'],['12,5 × 7',7,2,'down'],['12,5 × 8',8,2,'tick']];
  return `${ihead({ph:'edz-huzodzkodas.jpg',pos:'center 30%',crumb:'Edzés › Összegzés › <b>Húzódzkodás</b>',eb:'Hát · széles · Pull Day',title:'Húzódzkodás (súlyozott)',sub:'Négy szett, a legnehezebb +12,5 kg × 8.',btn:`${G('dumbbell','ink')}A gyakorlat oldala`,attrs:'data-toast="A gyakorlat oldala a 4. körben jön"'})}
  <h1 class="head rise" style="--i:1">A legnehezebb szett <em>2,5 kg-mal több</em>, mint legutóbb.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A négy szett</h3><span class="crumb">cél: 8 ismétlés</span></div><div class="card gy only deep pre"><div class="dhead"><small>Ismétlés szettenként</small><b>31<small>ismétlés</small></b></div>${tubesDeep(S.map(s=>s[1]),9,1,['1.','2.','3.','4.'],'arc6 a4')}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>A számok</h3></div><div class="card trio t-sun">${[['dumbbell','sage','820','kg összesen'],['repeat','sky','1,8','tartalék átlag'],['back','peach','10 × 8','előtte']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Szettek</h3></div><div class="card pad">${S.map(([a,r,ri,vd],i)=>{const [ic,pal,l]=VERD[vd];return `<div class="row">${G(ic,pal)}<div><b>${i+1}. szett · +${a}</b><div class="chips"><span class="chip ${vd==='record'?'warm':vd==='down'?'':'soft'}">${l}</span><span class="chip">${ri} tartalék</span>${i===1?'<span class="chip">„az utolsó kemény volt”</span>':''}</div></div></div>`}).join('')}</div></section>
  ${mzCard('A harmadik szettnél egy ismétlés hiányzott: <em>a pihenő 70 másodperc</em> volt. Jövő héten tartsd meg a teljes 90-et.')}</div>`}

/* ── the flow's sheets (each with a photo strip, chips, one action) ── */
const strip=ps=>`<div class="dshph">${ps.map(p=>`<img class="ex" src="${EPH(p)}" alt="">`).join('')}</div>`;
SHEETS.edzQuest=i=>{const q=QUEST[+i||0],e=SX0[q.ex];return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>${q.target}</h2><div class="chips"><span class="chip">${G(q.ic,q.pal)}${q.t}</span><span class="chip">${e.n}</span><span class="chip ${q.on?'soft':''}">${q.on?'vállalva':'elengedve'}</span></div></div><div class="card t-sun gy only"><div class="bars"><div class="br"><span>Mennyire biztos</span><b>${q.cl}</b><u><i style="--w:${q.conf}%;background:var(--sun)"></i></u></div></div></div><p class="note">${G('spark','deep')}${q.why}</p><div class="acts" style="margin:14px 0 0"><button class="pill" data-qtog="${+i||0}" data-close>${q.on?'Elengedem':'Vállalom'}</button><button class="pill soft" data-close>Bezárom</button></div>`};
SHEETS.edzRp=()=>{const e=EST.sx[EST.pend.i];return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>Szett kész · hogy ment?</h2><div class="chips"><span class="chip soft">${G('check','sage')}${fk(EST.pend.w)} kg × ${EST.pend.r}</span><span class="chip">${e.n}</span></div></div>${[['Pumpa · érzed?',['Semmi','Enyhe','Jó','Brutális'],2],['Ízületi fájdalom',['Nincs','Enyhe','Erős'],0],['Akarunk még?',['Kevés volt','Pont jó','Sok volt'],1]].map(([qq,o,s],k)=>`<p class="sub" style="margin:12px 0 8px">${qq}</p><div class="why">${o.map((x,j)=>`<button class="fp ${j===s?'on':''}" data-rpq="${k}">${x}</button>`).join('')}</div>`).join('')}<div class="acts" style="margin:16px 0 0"><button class="pill" data-esave>Mentés · pihenő indul</button><button class="pill soft" data-esave>Csak a pihenő</button></div>`};
SHEETS.edzSet=a=>{const [i,j]=(a||'0.0').split('.').map(Number),e=EST.sx[i],r=e.rows[j],[ic,pal,l]=VERD[r[3]]||VERD.tick;return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>${j+1}. szett · ${e.n}</h2><div class="chips"><span class="chip">${G(ic,pal)}${l}</span></div></div><div class="card pad" style="background:var(--paper);box-shadow:none">${[['Súly · kg',fk(r[0])],['Ismétlés',r[1]],['Tartalék',r[2]]].map(([k,v])=>`<div class="row"><div><b>${k}</b></div><span class="v">${v}</span><span></span></div>`).join('')}</div><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Szett mentve" data-close>Mentés</button><button class="pill soft" data-toast="Szett törölve" data-close>Törlöm</button></div>`};
SHEETS.edzFin=()=>{ensureSX();const L=EST.sx.filter(e=>e.rows.some(r=>!isD(r))),d=sxDone(),T=sxTot();return `<div class="grab"></div><div class="dsh">${strip(EST.sx.map(e=>e.p))}<h2>${T-d?`Van még ${T-d} szett hátra`:'Minden szett megvan'}</h2><div class="chips"><span class="chip soft">${G('check','sage')}${d} kész</span>${T-d?`<span class="chip">${T-d} kimarad</span>`:''}</div></div>${L.length?`<div class="card pad" style="background:var(--paper);box-shadow:none">${L.map(e=>{const k=e.rows.filter(isD).length;return `<div class="row"><img class="rimg big ex" src="${EPH(e.p)}" alt=""><div><b>${e.n}</b><div class="chips"><span class="chip">${e.rows.length-k} szett maradna ki</span></div></div></div>`}).join('')}</div><p class="note">${G('spark','deep')}A kimaradt szettek kihagyottként zárulnak, az összegzés nem büntet értük.</p>`:''}<div class="acts" style="margin:14px 0 0"><button class="pill" data-efin>Befejezem így</button><button class="pill soft" data-close>Visszamegyek</button></div>`};
SHEETS.edzMenu=i=>{const e=(EST.sx||SX0)[+i||0];return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>${e.n}</h2><div class="chips"><span class="chip">${e.mus}</span><span class="chip">${(e.rows||[]).length||e.sets} szett</span></div></div><div class="card pad" style="background:var(--paper);box-shadow:none">${[['camera','sky','Videó a mozdulatról'],['book','peach','Jegyzet a gyakorlathoz'],['plus','sage','Szett hozzáadása'],['repeat','berry','Gyakorlat cseréje'],['chart','sage','Előrébb vagy hátrébb'],['moon','sky','Gyakorlat kihagyása']].map(([ic,pal,l])=>`<div class="row tap" role="button" tabindex="0" data-toast="${l} — a 4. körben jön" data-close>${G(ic,pal)}<div><b>${l}</b></div>${G('chev','ink')}</div>`).join('')}</div>`};
SHEETS.edzTech=i=>{const e=(EST.sx||SX0)[+i||0];return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>Technika · ${e.n}</h2><div class="chips"><span class="chip">${e.mus}</span></div></div><div class="card pad" style="background:var(--paper);box-shadow:none">${[['Beállás','Váll lent és hátul, a fogás vállszélességű.'],['Mozdulat','Könyököt a csípő felé húzd, ne a kezed.'],['Visszaút','Lassan, két másodperc alatt engedd vissza.']].map(([h,t],k)=>`<div class="row"><span class="chip ink" style="width:36px;justify-content:center">${k+1}</span><div><b>${h}</b><small>${t}</small></div></div>`).join('')}</div><div class="acts" style="margin:14px 0 0"><button class="pill soft" data-toast="Demó videó — a 4. körben jön">${G('camera','sage')}Demó videó</button></div>`};
SHEETS.edzRecs=i=>{const e=(EST.sx||SX0)[+i||0];return `<div class="grab"></div><div class="dsh">${strip([e.p])}<h2>Rekordok · ${e.n}</h2><div class="chips"><span class="chip">24 alkalom</span><span class="chip">múltkor ${e.last}</span></div></div><div class="card gy only t-sun"><div class="bars">${[['Becsült maximum','96,5 kg',86],['Legjobb szett',e.goal,100],['Legtöbb egy alkalommal','2 175 kg',66]].map(([l,v,w])=>`<div class="br"><span>${l}</span><b>${v}</b><u><i style="--w:${w}%;background:var(--sun)"></i></u></div>`).join('')}</div></div>`};
SHEETS.edzNote=()=>`<div class="grab"></div><div class="dsh">${strip(['weighted-pull-up','barbell-row','hammer-curl'])}<h2>Hogy ment?</h2><div class="chips"><span class="chip">Pull Day · szeptember 24.</span><span class="chip">nem kötelező</span></div></div><label class="fld"><span>Jegyzet</span><input value="Ma a váll végig nyugton volt, a sorok tiszták."></label><div class="acts" style="margin:14px 0 0"><button class="pill" data-toast="Jegyzet mentve" data-close>Mentés</button><button class="pill soft" data-toast="Diktálás — a hangfelismerés a következő körben" data-close>${G('mic','sage')}Diktálom</button></div>`;

/* the flow's clicks */
document.addEventListener('click',e=>{
  const qt=e.target.closest('[data-qtog]');if(qt){const i=+qt.dataset.qtog,q=QUEST[i];q.on=!q.on;const c=$(`.qc[data-qi="${i}"]`);if(c){c.classList.toggle('off',!q.on);const b=c.querySelector('.qt');b.classList.toggle('on',q.on);b.setAttribute('aria-label',`${q.on?'Elengedem':'Vállalom'}: ${q.target}`)}const n=QUEST.filter(x=>x.on).length;const g=$('#qgo');if(g)g.textContent=n?`Indulás · ${n} küldetéssel`:'Indulás küldetés nélkül';const qn=$('#qn');if(qn)qn.textContent=n;haptic(8);if(!qt.hasAttribute('data-close'))return;if(location.hash==='#edzes-session')sessPaint();return}
  if(e.target.closest('[data-estart]')){seedSX(0);markCur();EST.focus=null;location.hash='edzes-session';return}
  const fo=e.target.closest('[data-efocus]');if(fo){EST.focus=+fo.dataset.efocus===curI()?null:+fo.dataset.efocus;sessPaint();$('#scroll').scrollTop=0;haptic(6);return}
  const ok=e.target.closest('[data-eok]');if(ok){const [i,j]=ok.dataset.eok.split('.').map(Number),v=c=>$(`#scroll .ein[data-c="${c}"]`).value.replace(',','.');EST.pend={i,j,w:+v('w')||0,r:+v('r')||0,ri:+v('ri')||0};openSheet(SHEETS.edzRp());haptic(10);return}
  const rq=e.target.closest('[data-rpq]');if(rq){rq.parentElement.querySelectorAll('.fp').forEach(x=>x.classList.toggle('on',x===rq));return}
  if(e.target.closest('[data-esave]')){const P=EST.pend,ex=EST.sx[P.i],g=ex.r;const vd=P.r>g?'up':P.r<g?'down':P.ri<=1&&P.w>=ex.w?'record':'tick';ex.rows[P.j]=[P.w,P.r,P.ri,vd];EST.pend=null;closeSheet();EST.focus=null;const more=markCur();sessPaint();if(more)startRest();else{stopRest();openSheet(SHEETS.edzFin())}return}
  if(e.target.closest('[data-eplus]')){if(EST.rest){EST.rest.left+=30;EST.rest.total+=30;dockPaint()}return}
  if(e.target.closest('[data-estop]')){stopRest();return}
  if(e.target.closest('[data-efin]')){stopRest();closeSheet();location.hash='edzes-cer';return}
  if(e.target.closest('[data-edone]')){EST.day='kesz';EST.sx=null;location.hash='edzes';return}
},true);

/* ══ Round 3: the Terv inner pages — the plan, a day + its editor, the weekly check, a muscle, plans, closed runs + report,
   templates, the new-plan wizard, running + its plan, comparing two runs ══ */
document.head.insertAdjacentHTML('beforeend',`<style>
/* Terv: a bar with a marker ("ennyitől fejlődik") */
.br u.mk{position:relative;overflow:visible}.br u.mk b{position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;background:var(--ink);opacity:.55}
.deep .br u.mk b{background:#fff;opacity:.8}
.mklg{display:flex;gap:14px;flex-wrap:wrap;margin:0 4px 10px;font:700 12px var(--b);color:var(--ink2)}.mklg span{display:inline-flex;align-items:center;gap:6px}.mklg i{width:2px;height:12px;background:var(--ink);opacity:.55;border-radius:1px}.mklg u{width:18px;height:6px;border-radius:3px;background:var(--sage);text-decoration:none}
/* Terv: set stepper on the day editor */
.stp{display:inline-grid;grid-template-columns:40px 34px 40px;align-items:center;justify-items:center;background:var(--paper);border-radius:999px}
.stp button{width:40px;height:40px;border:0;border-radius:50%;background:none;font:700 18px var(--d);color:var(--ink);padding:0}
.stp b{font:600 16px var(--d);font-variant-numeric:tabular-nums}
.dl .stp{justify-self:end}
.dl.ed{grid-template-columns:44px minmax(0,1fr) auto}
/* Terv: the plans ribbon (runs one after another) */
.ribbon{display:flex;gap:4px;width:100%}
.ribbon div{display:grid;gap:6px;min-width:0}
.ribbon span{display:block;height:16px;border-radius:999px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}
.ribbon span i{position:absolute;left:0;top:0;bottom:0;width:var(--w);background:linear-gradient(90deg,#F4C860,#E9B44C);border-radius:999px}
.ribbon .now span{box-shadow:inset 0 0 0 2px #BFE3CC}
.ribbon small{font:700 12px var(--b);color:rgba(255,255,255,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ribbon .now small{color:#fff}
/* Terv: wizard controls */
.cnt5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.cnt5 button{border:0;border-radius:18px;background:var(--card);box-shadow:var(--sh);display:grid;gap:2px;padding:10px 4px;min-height:64px;color:var(--ink)}
.cnt5 button b{font:600 20px var(--d)}.cnt5 button small{font:700 12px var(--b);color:var(--mute)}
.cnt5 button.on{background:var(--ink);color:#fff}.cnt5 button.on small{color:rgba(255,255,255,.75)}
.wdays{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));margin-top:10px}
.wdays button{border:0;background:none;display:grid;justify-items:center;gap:4px;min-height:60px;padding:4px 0;font:700 12px var(--b);color:var(--ink2)}
.wdays button i{width:34px;height:34px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(30,35,33,.16);display:grid;place-items:center}
.wdays button.on i{background:var(--sage);box-shadow:none}.wdays button.on i .g{filter:brightness(0) invert(1)}
.wfld{width:100%;min-height:84px;border:0;border-radius:18px;background:var(--card);box-shadow:var(--sh);padding:14px 16px;font:600 14px/1.45 var(--b);color:var(--ink);resize:none}
/* Terv: interval session shape (warm-up, sprints, cool-down) */
.ivl{display:flex;align-items:flex-end;gap:3px;height:92px;width:100%}
.ivl i{flex:1;border-radius:6px 6px 3px 3px;background:rgba(191,227,204,.45);min-width:3px}
.ivl i.s{background:linear-gradient(180deg,#F4C860,#E9B44C)}.ivl i.w{background:rgba(191,227,204,.75)}
.ivlax{display:flex;justify-content:space-between;width:100%;font:700 12px var(--b);color:rgba(255,255,255,.72)}
/* Terv: A vs B two bars per row */
.ab .br u+u{margin-top:4px}
.arc6.a7{grid-template-columns:repeat(7,minmax(0,1fr))}.arc6.a8{grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}
.ablg{display:flex;gap:14px;margin:0 4px 10px;font:700 12px var(--b);color:var(--ink2)}.ablg span{display:inline-flex;gap:6px;align-items:center}.ablg i{width:18px;height:6px;border-radius:3px}
</style>`);

const repaintIn=fn=>{const sc=$('#scroll'),y=sc.scrollTop;sc.innerHTML=fn().replace(/ rise(?=["\s])/g,'').replace(/ pre(?=["\s])/g,'');sc.scrollTop=y};
const RC6=['#BFE3CC','#8CC3E8','#F0B48C','#F4C860','#CDB4E3','#A8D5BA'];
/* the five training days of the week (index = EWEEK index) */
const DAYD=[
  {ph:'edz-sulyzo',min:62,done:'68 perc · 1 rekord',mus:[['Mell · közép',4],['Mell · felső',3],['Váll · elülső',3],['Váll · oldalsó',3],['Tricepsz',3]],ex:[['Fekvenyomás','barbell-bench-press',4,'6–8','80 kg'],['Ferde kézisúlyzós nyomás','incline-db-press',3,'8–10','30 kg'],['Vállból nyomás','overhead-press',3,'8–10','45 kg','kímélő változat'],['Oldalemelés','lateral-raise',3,'12–15','10 kg'],['Tricepsz letolás','tricep-pushdown',3,'10–12','27 kg']]},
  {ph:'edz-sulyzotarto',min:48,done:'51 perc',mus:[['Comb',6],['Lábhajlító',3],['Vádli',3]],ex:[['Elülső guggolás','front-squat',3,'8–10','90 kg'],['Lábhajlítás','leg-curl',3,'10–12','45 kg'],['Kitörés sétálva','walking-lunge',3,'12','20 kg'],['Álló vádliemelés','standing-calf-raise',3,'12–15','60 kg']]},
  {ph:'edz-sulyzotarto',min:70,done:'74 perc · 2 rekord',mus:[['Comb',7],['Lábhajlító',6],['Far',3],['Vádli',3]],ex:[['Guggolás','barbell-squat',4,'6–8','120 kg'],['Román felhúzás','romanian-deadlift',3,'8–10','100 kg'],['Lábtolás','leg-press',3,'10–12','180 kg'],['Lábhajlítás','leg-curl',3,'10–12','45 kg'],['Csípőemelés','hip-thrust',3,'8–10','110 kg'],['Álló vádliemelés','standing-calf-raise',3,'12–15','60 kg']]},
  {ph:'edz-huzodzkodas',min:64,mus:PMUS.map(m=>[m[0],m[1]]),ex:PULL},
  {ph:'edz-sulyzo',min:46,mus:[['Mell · felső',3],['Mell · közép',3],['Váll · oldalsó',3],['Tricepsz',3]],ex:[['Ferde kézisúlyzós nyomás','incline-db-press',3,'10–12','26 kg'],['Kábeles tárogatás','cable-fly',3,'12–15','14 kg'],['Oldalemelés','lateral-raise',3,'12–15','9 kg'],['Tricepsz nyújtás fej fölött','cable-overhead-extension',3,'10–12','25 kg']]}];
const MX=[[0,1,2,3,4],[0,1,0,2],[0,1,0,1,2,3],[0,1,2,3,4],[0,1,2,3]];
const dayGo=i=>i<=4?`data-go="edzes-nap-${i}"`:`data-toast="${EWEEK[i][0]} · ${EWEEK[i][2]} — ${i===5?'a sport oldala a 4. körben jön':'pihenőnap, nincs mit szerkeszteni'}"`;
/* a muscle in the plan: name, this week's sets, "ennyitől fejlődik", the plan's ceiling, focus, the six weeks, photo, where it is trained [day, exercise, photo, sets] */
const MUS={hat:['Hát',10,8,12,'Építés',[8,9,10,11,12,6],'barbell-row',[[3,'Húzódzkodás (súlyozott)','weighted-pull-up',4],[3,'Döntött törzsű evezés','barbell-row',3],[3,'Vállemelés','db-shrug',3]]],
  vall:['Váll',12,8,12,'Hangsúly',[10,11,12,12,12,6],'overhead-press',[[0,'Vállból nyomás','overhead-press',3],[0,'Oldalemelés','lateral-raise',3],[4,'Oldalemelés','lateral-raise',3],[3,'Rear Delt Fly','cable-rear-delt-fly',3]]],
  comb:['Comb',13,8,14,'Hangsúly',[10,12,13,14,14,7],'barbell-squat',[[1,'Elülső guggolás','front-squat',3],[1,'Kitörés sétálva','walking-lunge',3],[2,'Guggolás','barbell-squat',4],[2,'Lábtolás','leg-press',3]]],
  labh:['Lábhajlító',9,6,12,'Építés',[7,8,9,10,12,5],'leg-curl',[[1,'Lábhajlítás','leg-curl',3],[2,'Román felhúzás','romanian-deadlift',3],[2,'Lábhajlítás','leg-curl',3]]],
  mell:['Mell',13,8,13,'Építés',[11,12,13,13,13,7],'barbell-bench-press',[[0,'Fekvenyomás','barbell-bench-press',4],[0,'Ferde kézisúlyzós nyomás','incline-db-press',3],[4,'Ferde kézisúlyzós nyomás','incline-db-press',3],[4,'Kábeles tárogatás','cable-fly',3]]],
  tri:['Tricepsz',6,6,10,'Tartás',[6,6,6,6,6,3],'tricep-pushdown',[[0,'Tricepsz letolás','tricep-pushdown',3],[4,'Tricepsz nyújtás fej fölött','cable-overhead-extension',3]]],
  vadli:['Vádli',6,6,10,'Tartás',[6,6,6,6,6,3],'standing-calf-raise',[[1,'Álló vádliemelés','standing-calf-raise',3],[2,'Álló vádliemelés','standing-calf-raise',3]]],
  far:['Far',3,3,8,'Építés',[3,3,3,5,8,3],'hip-thrust',[[2,'Csípőemelés','hip-thrust',3]]],
  bic:['Bicepsz',3,3,8,'Építés',[3,3,3,5,8,3],'hammer-curl',[[3,'Kalapácsbicepsz','hammer-curl',3]]]};
const room=m=>m[4]==='Tartás'?0:m[3]-m[1],step=m=>m[5][3]-m[5][2];
const tierChip=t=>`<span class="chip ${t==='Hangsúly'?'warm':t==='Építés'?'soft':''}">${G(t==='Hangsúly'?'star':t==='Építés'?'chart':'repeat',t==='Hangsúly'?'sun':t==='Építés'?'deep':'ink')}${t}</span>`;
const mkBar=(v,mev,ceil,max,col)=>`<u class="mk"><i style="--w:${Math.min(100,v/max*100)}%;background:${col}"></i>${mev<ceil?`<b style="left:${mev/max*100}%"></b>`:''}</u>`;
const dayRingD=d=>{const tot=d.mus.reduce((a,m)=>a+m[1],0),mx=Math.max(...d.mus.map(m=>m[1]));return `<div class="card gy g1 deep pre">${ring({d:104,sw:10,p:1,segs:d.mus.map((m,i)=>[m[1]/tot,RC6[i%6]]),val:tot,unit:'szett'})}<div class="bars">${d.mus.map(([l,n],i)=>`<div class="br"><span>${l}</span><b>${n} <small>szett</small></b><u><i style="--w:${n/mx*100}%;background:${RC6[i%6]}"></i></u></div>`).join('')}</div></div>`};

/* ── the running plan ── */
function run(){const rows=Object.values(MUS);
  return `${ihead({ph:'edz-korlat.jpg',pos:'center 40%',crumb:'Edzés › Terv › <b>Hypertrophy 04</b>',eb:'Aktív · 3. hét / 6 · vége október 18.',title:'Az 5. hét a csúcs, a 6. a pihenőhét.',sub:'Most a 3. héten jársz: 75 szett.',btn:`${G('chart','ink')}Heti vizsgálat`,attrs:'data-go="edzes-het"'})}
  <h1 class="head rise" style="--i:1">Pull / Push / Legs, <em>öt edzés</em> egy héten, hat hétig.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A terv íve</h3><span class="crumb">szeptember 7. – október 18.</span></div><div class="card gy only deep pre"><div class="dhead"><small>Szett egy héten</small><b>75<small>most</small></b></div>${tubesDeep(MESO.sets,100,2,['1.','2.','3.','4.','csúcs','pihenő'])}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Hol tartasz</h3></div><div class="card t-sage pad"><div class="row tap" role="button" tabindex="0" data-go="edzes-het">${G('chart','sage')}<div><b>Heti vizsgálat</b><div class="chips"><span class="chip">75 szett</span><span class="chip">${rows.filter(m=>room(m)>0).length} emelkedik</span><span class="chip">${rows.filter(m=>!room(m)).length} tart</span></div></div>${G('chev','ink','chev')}</div><div class="row">${G('clock','sky')}<div><b>Hétfőn jön</b><div class="chips">${rows.filter(m=>step(m)>0).map(m=>`<span class="chip soft">${m[0]} +${step(m)}</span>`).join('')}</div></div></div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A heted</h3><span class="crumb">koppints egy napra</span></div><div class="dlist">${EWEEK.map(([d,s,t,st,n,ps,m],i)=>`<article class="dl tap ${st==='today'?'today':''} ${st==='plan'||st==='rest'?'fut':''}" role="button" tabindex="0" ${dayGo(i)}>${ps?exStack(ps):st==='sport'?`<span class="stk"><img src="${PH('edz-ropi-sq.jpg')}" alt=""></span>`:`<span class="stk none">${G('moon','sky')}</span>`}<div class="dtx"><strong>${d} · ${t}</strong><div class="chips">${st==='done'?`<span class="chip soft">${G('check','sage')}kész</span>`:st==='today'?`<span class="chip soft">${G('bolt','deep')}ma</span>`:''}${n?`<span class="chip">${n} szett</span>`:''}${m?`<span class="chip">${m}</span>`:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Lezárás</h3></div><div class="card pad"><div class="row tap" role="button" tabindex="0" data-toast="Lezárás: október 18-án magától, vagy most kézzel — riport készül róla">${G('check','sage')}<div><b>A terv lezárása</b><div class="chips"><span class="chip">riport készül róla</span><span class="chip">október 18.</span></div></div>${G('chev','ink','chev')}</div></div></section>
  ${mzCard('A lábhajlító a múlt héten nehezen ment, ezért most <em>tartjuk a 9 szettet</em>. Az emelés folytatódik, amint visszaáll a tempó.')}</div>`}

/* ── a day ── */
function nap(i){const d=DAYD[i],w=EWEEK[i],tot=d.mus.reduce((a,m)=>a+m[1],0);
  return `${ihead({ph:d.ph+'.jpg',pos:i===3?'center 30%':'',crumb:`Edzés › Terv › <b>${w[0]}</b>`,eb:`${w[0]} · 3. hét / 6${w[3]==='done'?' · kész':w[3]==='today'?' · ma 16:00':''}`,title:`${w[2]} nap`,sub:`${tot} szett, ${d.ex.length} gyakorlat, körülbelül ${d.min} perc.`,btn:`${G('book','ink')}Szerkesztem`,attrs:`data-go="edzes-napszerk-${i}"`})}
  <h1 class="head rise" style="--i:1">${w[3]==='done'?`Megvolt: <em>${d.done}</em>.`:w[3]==='today'?'Ma jön, <em>16:00-kor</em>.':'Még előtted van, <em>pénteken</em>.'}</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Mit terhel ez a nap</h3></div>${dayRingD(d)}</section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>A nap gyakorlatai</h3><span class="crumb">${d.ex.length} gyakorlat</span></div><div class="dlist one">${d.ex.map(([n,p,s,r,kg,c])=>`<article class="dl tap" role="button" tabindex="0" data-toast="${n} — a gyakorlat oldala a 4. körben jön"><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip soft">${G('repeat','deep')}${s} × ${r}</span><span class="chip">${kg}</span>${c?`<span class="chip warm">${G('bolt','peach')}${c}</span>`:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="card t-sky pad"><div class="row">${G('clock','sky')}<div><b>Csúcshéten hosszabb</b><div class="chips"><span class="chip">most ${d.min} perc</span><span class="chip">az 5. héten ≈ ${Math.round(d.min*1.15)} perc</span></div></div></div></div></section>
  ${mzCard(i===3?'A vállad miatt a Rear Delt Fly <em>könnyített súllyal</em> megy, amíg 5 / 10 fölött jelzed a fájdalmat.':i===2?'Ez a hét <em>legnehezebb napja</em>. Előtte este legyen meg a 7 óra alvás.':'A nap rendben van: <em>minden izom</em> a heti tartományában kapja a szettjeit.')}</div>`}

/* ── the day editor (in place: steppers change the sets, the totals follow) ── */
const NSZ={i:-1,sets:[]};
function napszerk(i){const d=DAYD[i],w=EWEEK[i];if(NSZ.i!==i){NSZ.i=i;NSZ.sets=d.ex.map(e=>e[2])}
  const tot=NSZ.sets.reduce((a,b)=>a+b,0),base=d.ex.reduce((a,e)=>a+e[2],0),min=Math.round(d.min*tot/base);
  const mus=d.mus.map((m,mi)=>[m[0],NSZ.sets.reduce((a,v,k)=>a+(MX[i][k]===mi?v:0),0)]);
  const D={...d,mus};
  return `${ihead({ph:d.ph+'.jpg',pos:i===3?'center 30%':'',crumb:`Edzés › ${w[0]} › <b>Szerkesztés</b>`,eb:`${w[0]} · ${w[2]} · a nap szerkesztése`,title:`${tot} szett, ${d.ex.length} gyakorlat`,sub:`Körülbelül ${min} perc. A változás minden hétre érvényes.`,btn:`${G('check','ink')}Mentés`,attrs:`data-nsave="${i}"`,sm:true})}
  <section class="sec rise first" style="--i:1"><div class="sh"><h3>Sorrend és előírás</h3><span class="crumb">${tot-base>0?'+':''}${tot-base?tot-base+' szett':'az eredeti'}</span></div><div class="dlist one">${d.ex.map(([n,p,s,r,kg],k)=>`<article class="dl ed"><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip">${r} ismétlés</span><span class="chip">${kg}</span></div></div><span class="stp"><button data-nst="${k}|-1" aria-label="${n}: egy szettel kevesebb">−</button><b>${NSZ.sets[k]}</b><button data-nst="${k}|1" aria-label="${n}: egy szettel több">+</button></span></article>`).join('')}</div>
    <div class="ealt" style="margin-top:10px"><button class="wide" data-toast="Gyakorlat hozzáadása — a választó a 4. körben jön">${G('plus','sage')}<b>Gyakorlat hozzáadása</b>${G('chev','ink','chev')}</button></div></section>
  <section class="sec rise" style="--i:2"><div class="sh"><h3>Ma · izmonként</h3></div>${dayRingD(D)}</section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Heti szettek · izmonként</h3></div><div class="mklg"><span><u></u>e heti szett</span><span><i></i>ennyitől fejlődik</span></div><div class="card gy only"><div class="bars">${Object.values(MUS).slice(0,6).map(m=>`<div class="br"><span>${m[0]}</span><b>${m[1]} <small>/ ${m[3]} szett</small></b>${mkBar(m[1],m[2],m[3],m[3]+2,m[1]>=m[3]?'var(--deep)':'var(--sage)')}</div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Ellenőrzés</h3></div><div class="card t-sun pad"><div class="row">${G('clock','sky')}<div><b>Csúcshét · időbecslés</b><div class="chips"><span class="chip">most ${min} perc</span><span class="chip">${min>75?'túl hosszú lehet':'belefér'} · ≈ ${Math.round(min*1.15)} perc</span></div></div></div><div class="row">${G('check','sage')}<div><b>Felépítés</b><div class="chips"><span class="chip">összetett elöl</span><span class="chip">${tot>20?'sok egy napra':'rendben'}</span></div></div></div></div></section>
  ${mzCard(tot>base?'Egy szettel több itt <em>a csúcshéten 5 perccel</em> hosszabb edzést jelent. Ha belefér, mehet.':tot<base?'Kevesebb szettel a heti tartomány alá csúszhatsz. <em>Hétfőn szólok</em>, ha így lenne.':'Ez a nap <em>pont a heti tartományban</em> van. A sorrend is jó: az összetett gyakorlatok vannak elöl.')}</div>`}

/* ── the weekly check ── */
function het(){const L=Object.entries(MUS).sort((a,b)=>room(b[1])-room(a[1])||b[1][3]-a[1][3]),g=L.filter(([,m])=>room(m)>0).length,mx=L.filter(([,m])=>m[4]!=='Tartás'&&!room(m)).length,hd=L.filter(([,m])=>m[4]==='Tartás').length;
  return `${ihead({ph:'edz-kreta.jpg',pos:'center 45%',crumb:'Edzés › Terv › <b>Heti vizsgálat</b>',eb:'Heti vizsgálat · 3. hét',title:`${L.length} izomcsoportot edzel ezen a héten.`,sub:`${g} izomban van még hova nőni, ${mx} elérte a felső értéket, ${hd}-t szinten tartasz.`,btn:`${G('clock','ink')}Hétfői változások`,attrs:'data-sheet="edzRoll"'})}
  <h1 class="head rise" style="--i:1"><em>5 szettel több</em>, mint a múlt héten.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hét szettjei</h3></div><div class="card gy only deep pre"><div class="dhead"><small>Ezen a héten</small><b>75<small>szett</small></b></div><div class="bars">${L.slice(0,6).map(([,m])=>`<div class="br"><span>${m[0]}</span><b>${m[1]} <small>/ ${m[3]}</small></b>${mkBar(m[1],m[2],m[3],m[3]+2,m[1]>=m[3]?'#F4C860':'#BFE3CC')}</div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Hétfőtől változik</h3></div><div class="card t-sky pad"><div class="row">${G('clock','sky')}<div><b>Hétfő hajnalban magától</b><div class="chips">${L.map(([,m])=>m).filter(m=>step(m)>0).map(m=>`<span class="chip">${m[0]} +${step(m)}</span>`).join('')}<span class="chip">a többi marad</span></div></div></div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Izmonként</h3><span class="crumb">ahol a legtöbb hely van, elöl</span></div><div class="dlist one">${L.map(([k,m])=>`<article class="dl tap" role="button" tabindex="0" data-go="edzes-izom-${k}"><span class="stk"><img class="ex" src="${EPH(m[6])}" alt=""></span><div class="dtx"><strong>${m[0]}</strong><div class="chips">${tierChip(m[4])}<span class="chip">${m[1]} / ${m[3]} szett</span>${room(m)?`<span class="chip soft">még ${room(m)}</span>`:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('A far és a bicepsz most csak <em>3 szettet</em> kap, de a 4. héttől gyorsan nő: a csúcshéten már 8.')}</div>`}

/* ── a muscle ── */
function izom(k){const m=MUS[k]||MUS.hat,[n,s,mev,ceil,tier,ser,p,where]=m,lo=n.toLowerCase(),r=room(m),st=step(m);
  const say=tier==='Tartás'?'Ez így is marad: most máshol építesz, ez az izom közben megtartja, amit tud.':r>0?`Még ${r} fér bele, aztán a terv végéig ${ceil} marad a felső érték.`:'Ennél többet ez a terv már nem ad.';
  return `${ihead({ph:/Comb|Lábh|Far|Vádli/.test(n)?'edz-sulyzotarto.jpg':/Hát|Bicepsz/.test(n)?'edz-huzodzkodas.jpg':'edz-sulyzo.jpg',pos:'center 30%',crumb:`Edzés › Heti vizsgálat › <b>${n}</b>`,eb:`3. hét · ${tier}`,title:`A ${lo} hetente ${s} szettet kap.`,sub:`${say} ${st>0?`Hétfőn ${st} szettel több jön.`:'Hétfőn nem változik.'}`})}
  <h1 class="head rise" style="--i:1">${r>0?`<em>Még ${r} szett</em> fér bele ebbe a tervbe.`:tier==='Tartás'?'<em>Szinten tartod</em>, amíg máshol építesz.':'<em>Elérte</em> a terv felső értékét.'}</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hat hét</h3></div><div class="card gy only deep pre"><div class="dhead"><small>Szett egy héten · ${n}</small><b>${s}<small>most</small></b></div>${tubesDeep(ser,Math.max(...ser)+2,2,['1.','2.','3.','4.','csúcs','pihenő'])}<div class="bars"><div class="br"><span>Most · ennyitől fejlődik: ${mev}</span><b>${s} <small>/ ${ceil}</small></b>${mkBar(s,mev,ceil,ceil+2,s>=ceil?'#F4C860':'#BFE3CC')}</div></div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Hol tartasz</h3></div><div class="card trio t-sun">${[['clock','sky',new Set(where.map(w=>w[0])).size,'edzés hetente'],['repeat','sage',ser[0],'szett az 1. héten'],['chart','deep',Math.max(...ser),'a legtöbb lesz']].map(([ic,pal,v,l])=>`<div>${G(ic,pal)}<b>${v}</b><small>${l}</small></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Hol edzed</h3></div><div class="dlist one">${where.map(([d,e,ph,c])=>`<article class="dl tap" role="button" tabindex="0" data-go="edzes-nap-${d}"><span class="stk"><img class="ex" src="${EPH(ph)}" alt=""></span><div class="dtx"><strong>${e}</strong><div class="chips"><span class="chip">${EWEEK[d][0]} · ${EWEEK[d][2]}</span><span class="chip soft">${c} szett</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Honnan jön ez a szám</h3></div><div class="card t-sky pad">${[['book','sky','Kiinduló ajánlás',`${mev}–${ceil+2} szett hetente`],['star','sun',`Fókusz · ${tier}`,tier==='Hangsúly'?'a felső érték felé visszük':tier==='Építés'?'hétről hétre emelkedik':'szinten tartjuk'],['person','sage','Rád szabva',/Váll|Comb/.test(n)?'a röpi miatt 2 szettel kevesebb':'a múlt heti teljesítésed alapján'],['chart','deep','Ebben a tervben',`${ser[0]} → ${Math.max(...ser)}, a végén pihenőhét`]].map(([ic,pal,b,t])=>`<div class="row">${G(ic,pal)}<div><b>${b}</b><small>${t}</small></div></div>`).join('')}</div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Az előző tervhez képest</h3></div><div class="card pad"><div class="row tap" role="button" tabindex="0" data-go="edzes-riport">${G('repeat','berry')}<div><b>Hypertrophy 03</b><div class="chips"><span class="chip">${Math.max(2,ser[0]-2)} → ${ceil}</span><span class="chip soft">most ${ser[0]} → ${Math.max(...ser)}</span></div></div>${G('chev','ink','chev')}</div></div></section>
  ${mzCard(tier==='Tartás'?`A ${lo} most <em>pihen az építéstől</em>: a következő tervben ő jön előre.`:`A ${lo} a <em>${ser.indexOf(Math.max(...ser))+1}. héten</em> éri el a csúcsot, utána a pihenőhéten ${ser[5]} szettre esik vissza.`)}</div>`}

/* ── plans (library) ── */
const RUNS=[['Hypertrophy 04','fut','Pull / Push / Legs · ötször',6,'szeptember 7. – október 18.','edz-korlat',3],['Strength 02','következik','Upper / Lower · négyszer',7,'október 19-től','edz-sulyzotarto',0],['Pre-cut maintenance','következik','Full body · háromszor',4,'december 7-től','edz-nyujtas',0]];
function tervek(){const tot=RUNS.reduce((a,r)=>a+r[3],0);
  return `${ihead({ph:'edz-sulyzo.jpg',crumb:'Edzés › Terv › <b>Edzéstervek</b>',eb:'Edzéstervek · 17 hét előre',title:'Itt élnek a terveid.',sub:'Egy fut, kettő sorban áll, a polcon a sablonok és a lezártak.',btn:`${G('plus','ink')}Új terv`,attrs:'data-go="edzes-ujterv"'})}
  <h1 class="head rise" style="--i:1">Január elejéig <em>meg van tervezve</em> az edzésed.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Egymás után</h3><span class="crumb">${tot} hét</span></div><div class="card gy only deep"><div class="ribbon">${RUNS.map((r,i)=>`<div class="${i?'':'now'}" style="flex:${r[3]}"><span><i style="--w:${r[6]/r[3]*100}%"></i></span><small>${r[0]}</small></div>`).join('')}</div><div class="ivlax"><span>szeptember 7.</span><span>január 3.</span></div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Most fut és következik</h3></div><div class="dlist one">${RUNS.map((r,i)=>`<article class="dl tap ${i?'fut':'today'}" role="button" tabindex="0" ${i?`data-toast="${r[0]} · ${r[4]} — a tervezett terv oldala ugyanígy néz ki"`:'data-go="edzes-run"'}><span class="stk"><img src="${PH(r[5]+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${r[0]}</strong><div class="chips"><span class="chip ${i?'':'soft'}">${i?r[4]:`${G('bolt','deep')}3. hét / 6`}</span><span class="chip">${r[3]} hét</span><span class="chip">${r[2]}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A polcod</h3></div><div class="card t-sage pad">${[['book','peach','Sablonjaid','három sablon','edzes-sablonok'],['check','sage','Lezárt futamaid','három futam · 20 hét','edzes-futamok'],['repeat','berry','Két futam összevetése','Hypertrophy 03 · Recovery rebuild','edzes-osszevetes']].map(([ic,pal,b,c,go])=>`<div class="row tap" role="button" tabindex="0" data-go="${go}">${G(ic,pal)}<div><b>${b}</b><div class="chips"><span class="chip">${c}</span></div></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  ${mzCard('A Strength 02 <em>október 19-én</em> magától indul. A röpi napjait már most kihagyja.')}</div>`}

/* ── closed runs + a report ── */
const CLOSED=[['Hypertrophy 03',6,'június 1. – július 12.',1,'A láb és a hát vitte, a váll kímélve.','edz-sulyzotarto',92],['Cut prep',6,'július 20. – augusztus 30.',0,'Riport nem készült.','edz-futas',null],['Recovery rebuild',8,'február 9. – április 5.',1,'Sérülés után vissza a teljes terhelésig.','edz-nyujtas',88]];
function futamok(){
  return `${ihead({ph:'edz-kreta.jpg',pos:'center 45%',crumb:'Edzés › Edzéstervek › <b>Lezárt futamok</b>',eb:'Amit lezártál',title:'3 lezárt futam, 20 hét összesen.',sub:'Kettőről riport is van: mi ment, mi nem, mennyit erősödtél.',btn:`${G('repeat','ink')}Összevetés`,attrs:'data-go="edzes-osszevetes"'})}
  <h1 class="head rise" style="--i:1">A legjobb futamod a <em>Hypertrophy 03</em> volt: 92% megvolt.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Mennyi lett meg</h3></div><div class="card gy only deep pre"><div class="dhead"><small>Megcsinált edzések</small><b>90<small>% átlag</small></b></div><div class="bars">${CLOSED.filter(c=>c[6]).map(c=>`<div class="br"><span>${c[0]}</span><b>${c[6]} <small>%</small></b><u><i style="--w:${c[6]}%;background:${c[6]>=90?'#F4C860':'#BFE3CC'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Futamok</h3></div><div class="dlist one">${CLOSED.map(([n,w,d,rep,s,ph,p],i)=>`<article class="dl tap ${rep?'':'fut'}" role="button" tabindex="0" ${i===0?'data-go="edzes-riport"':`data-toast="${n} — ${rep?'a riport ugyanígy néz ki':'ehhez nem készült riport'}"`}><span class="stk"><img src="${PH(ph+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip">${w} hét</span><span class="chip">${d}</span>${rep?`<span class="chip soft">${G('check','sage')}riport</span>`:''}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('A két riportos futamból kiderül: <em>a vállat kímélve</em> is nőtt az erőd. A Strength 02 ezt viszi tovább.')}</div>`}
function riport(){
  return `${ihead({ph:'edz-sulyzotarto.jpg',crumb:'Edzés › Lezárt futamok › <b>Hypertrophy 03</b>',eb:'Lezárt futam · június 1. – július 12.',title:'92% megvolt',sub:'22 edzés a 24-ből, 6 hét a 6-ból.',btn:`${G('book','ink')}Sablon mentése`,attrs:'data-toast="Sablon mentve: Hypertrophy 03"'})}
  <h1 class="head rise" style="--i:1">A láb és a hát vitte, <em>a váll kímélve</em> maradt.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Hogy ment</h3></div><div class="card gy g1 deep pre">${ring({d:104,sw:10,p:.92,c:'#BFE3CC',val:'92%',unit:'megvolt'})}<div class="bars">${[['Edzések',22,24],['Hetek',6,6],['Célszettek',84,96]].map(([l,a,b])=>`<div class="br"><span>${l}</span><b>${a} <small>/ ${b}</small></b><u><i style="--w:${a/b*100}%;background:${a>=b?'#F4C860':'#BFE3CC'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Izmonként</h3><span class="crumb">indulás → csúcs</span></div><div class="mklg"><span><u></u>a csúcs</span><span><i></i>az indulás</span></div><div class="card gy only"><div class="bars">${[['Hát',6,12,14],['Váll',8,14,16],['Comb',10,14,14],['Mell',10,14,14],['Lábhajlító',6,11,12],['Tricepsz',6,8,10]].map(([l,a,b,c])=>`<div class="br"><span>${l}</span><b>${a} → ${b} <small>/ ${c}</small></b>${mkBar(b,a,c,c,b>=c?'var(--deep)':'var(--sage)')}</div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Erő</h3><span class="crumb">négy gyakorlat</span></div><div class="dlist one">${[['Guggolás','barbell-squat','110 → 117,5 kg','+7,5 kg'],['Román felhúzás','romanian-deadlift','90 → 100 kg','+10 kg'],['Döntött törzsű evezés','barbell-row','70 → 75 kg','+5 kg'],['Fekvenyomás','barbell-bench-press','77,5 → 77,5 kg','8 ismétlésig']].map(([n,p,v,d])=>`<article class="dl"><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip">${v}</span><span class="chip soft">${G('chart','deep')}${d}</span></div></div></article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>A futam alatt</h3></div><div class="card t-sun pad"><div class="row">${G('moon','sky')}<div><b>Az életed közben</b><div class="chips">${['7,2 óra alvás','2 840 kalória naponta','energia 6,8','stressz 4,1','+1,2 kg','1 260 perc sport'].map(c=>`<span class="chip">${c}</span>`).join('')}</div></div></div><div class="row">${G('book','peach')}<div><b>Amit a végén írtál</b><small>Az utolsó két hét nehéz volt, de a guggolás végre nem fájt. A vállat kímélni kell a következőben.</small></div></div></div></section>
  ${mzCard('A 24 edzésből 22 megvolt, a két kimaradt <em>a negyedik hétre</em> esett. Az erő a lábon mozdult a legtöbbet.',`<button class="pill soft" data-toast="Riport újragenerálva">Újragenerálom</button>`)}</div>`}

/* ── templates ── */
const TPL=[['Hypertrophy 04','Pull / Push / Legs',6,5,58,2,'ebből fut a mostani terved',['barbell-bench-press','barbell-row','barbell-squat'],[0,1,2,3,4]],['Upper / Lower · alap','Upper / Lower',7,4,65,1,'egy futam indult belőle',['barbell-row','incline-db-press','romanian-deadlift'],[0,1,3,4]],['Full body · utazós','Full body',4,3,42,0,'még nem indítottál belőle',['barbell-squat','weighted-pull-up','barbell-bench-press'],[0,2,4]]];
function sablonok(){
  return `${ihead({ph:'edz-sulyzo.jpg',crumb:'Edzés › Edzéstervek › <b>Sablonok</b>',eb:'Sablonjaid',title:'Három sablon, egy fut belőle.',sub:'Egy sablonból bármikor új terv indul, a hetekkel és a napokkal együtt.',btn:`${G('plus','ink')}Új sablon`,attrs:'data-toast="Új sablon: a futó tervből vagy üresen"'})}
  <h1 class="head rise" style="--i:1">A <em>Hypertrophy 04</em> a kedvenced: már két futam indult belőle.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Edzésnapok hetente</h3></div><div class="card gy only deep pre"><div class="bars">${TPL.map(t=>`<div class="br"><span>${t[0]}</span><b>${t[3]} <small>nap · ${t[4]} perc</small></b><u><i style="--w:${t[3]/7*100}%;background:#BFE3CC"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Sablonok</h3></div><div class="dlist">${TPL.map((t,i)=>`<article class="dl tap" role="button" tabindex="0" ${i===0?'data-go="edzes-sablon"':`data-toast="${t[0]} — a sablon oldala ugyanígy néz ki"`}>${exStack(t[7])}<div class="dtx"><strong>${t[0]}</strong><div class="chips"><span class="chip">${t[2]} hét</span><span class="chip">${t[3]} nap</span><span class="chip ${i?'':'soft'}">${t[6]}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  ${mzCard('A <em>Full body · utazós</em> sablon jól jön, ha egyszer úton leszel: heti három nap, 42 perc.')}</div>`}
function sablon(){const t=TPL[0];
  return `${ihead({ph:'edz-korlat.jpg',pos:'center 40%',crumb:'Edzés › Sablonok › <b>Hypertrophy 04</b>',eb:'Sablon · Pull / Push / Legs',title:'6 hét, hetente 5 edzésnap.',sub:'Átlagosan 58 perc egy edzés. Ebből fut a mostani terved.',btn:`${G('bolt','ink')}Új terv ebből`,attrs:'data-toast="Új terv a sablonból: a varázsló kitöltve nyílik"'})}
  <h1 class="head rise" style="--i:1">Két futam indult belőle, <em>mindkettő 90% fölött</em> lett meg.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A hét felépítése</h3></div><div class="card dstrip">${['H','K','Sze','Cs','P','Szo','V'].map((d,i)=>`<button class="${t[8].includes(i)?'done':'plan'}" aria-label="${d}: ${t[8].includes(i)?['Push','Legs A','Legs','Pull','Push · könnyű'][i]:'szabad'}" data-toast="${d}: ${t[8].includes(i)?['Push','Legs A','Legs','Pull','Push · könnyű'][i]:'szabad nap'}"><i>${t[8].includes(i)?G('dumbbell','deep'):G('moon','sky')}</i>${d}</button>`).join('')}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Heti szettek izmonként</h3><span class="crumb">a csúcshéten</span></div><div class="card gy only deep pre"><div class="bars">${Object.values(MUS).slice(0,6).map(m=>`<div class="br"><span>${m[0]}</span><b>${Math.max(...m[5])} <small>szett</small></b><u><i style="--w:${Math.max(...m[5])/14*100}%;background:#BFE3CC"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Futamok ebből a sablonból</h3></div><div class="dlist one">${[['edz-korlat','Hypertrophy 04','fut · 3. hét / 6'],['edz-sulyzotarto','Hypertrophy 03','92% megvolt']].map(([p,n,c],i)=>`<article class="dl tap" role="button" tabindex="0" data-go="${i?'edzes-riport':'edzes-run'}"><span class="stk"><img src="${PH(p+'-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip ${i?'':'soft'}">${c}</span></div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>A sablon kezelése</h3></div><div class="card t-sage pad">${[['book','peach','Szerkesztés'],['repeat','berry','Másolat készítése'],['moon','sky','Törlés']].map(([ic,pal,l])=>`<div class="row tap" role="button" tabindex="0" data-toast="${l} — a sablonszerkesztő a következő körben">${G(ic,pal)}<div><b>${l}</b></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  ${mzCard('Ha a röpi szezonja tart, ebből a sablonból <em>négy napos</em> változatot is csinálhatok.')}</div>`}

/* ── the new-plan wizard (one page, everything updates in place) ── */
const WZ={n:5,days:[0,1,2,3,4],w:6,f:['Hát','Váll']};
const WZN={2:'full body',3:'full body',4:'upper / lower',5:'upper / lower + PPL',6:'PPL kétszer'};
const curve=w=>Array.from({length:w},(_,i)=>i===w-1?40:55+Math.round(i/(w-2||1)*35));
function ujterv(){const W=WZ.w;
  return `${ihead({ph:'edz-korlat.jpg',pos:'center 40%',crumb:'Edzés › Edzéstervek › <b>Új terv</b>',eb:'Új terv · pár kérdés',title:'Mikor edzel, és mire gyúrsz?',sub:'Csak ennyit kérdezünk, a többit Mezo rakja össze.',btn:`${G('spark','ink')}Összerakom`,attrs:'data-wzgo',sm:true})}
  <section class="sec rise first" style="--i:1"><div class="sh"><h3>A terv íve</h3><span class="crumb">${W} hét = ${W-1} emelkedő + 1 pihenő</span></div><div class="card gy only deep pre">${tubesDeep(curve(W),100,-1,curve(W).map((_,i)=>(i+1)+'.'),'arc6 a'+W,v=>'')}<div class="ivlax"><span>${WZ.n} edzésnap · ${WZN[WZ.n]}</span><b style="color:#fff">${W} hét</b></div></div></section>
  <section class="sec rise" style="--i:2"><div class="sh"><h3>Edzésnapok</h3><span class="crumb">${WZ.days.length} nap kijelölve</span></div><div class="cnt5">${[2,3,4,5,6].map(c=>`<button class="${WZ.n===c?'on':''}" data-wzn="${c}" aria-pressed="${WZ.n===c}"><b>${c}</b><small>nap</small></button>`).join('')}</div><div class="card wdays" style="margin-top:10px">${['H','K','Sze','Cs','P','Szo','V'].map((d,j)=>`<button class="${WZ.days.includes(j)?'on':''}" data-wzd="${j}" aria-pressed="${WZ.days.includes(j)}"><i>${WZ.days.includes(j)?G('check','ink'):''}</i>${d}</button>`).join('')}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Hossz</h3></div><div class="hrow fps" style="margin:0 -16px">${[4,5,6,7,8].map(w=>`<button class="fp ${WZ.w===w?'on':''}" data-wzw="${w}">${G('clock','sky')}${w} hét</button>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>A célod</h3><span class="crumb">nem kötelező</span></div><textarea class="wfld" rows="3" aria-label="Mit szeretnél ebben a tervben?" placeholder="Például: röpi szezon mellett, a vállam kímélve, de a hát nagyon jöhet."></textarea></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Fókusz</h3><span class="crumb">legfeljebb kettő · ${WZ.f.length} kiválasztva</span></div><div class="hrow cats" style="margin:0 -16px">${Object.values(MUS).map(m=>`<button class="cat ${WZ.f.includes(m[0])?'on':''}" data-wzf="${m[0]}"><img src="${EPH(m[6])}" alt=""><span>${m[0]}</span></button>`).join('')}</div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Ami magától megy</h3></div><div class="card t-sky pad">${[['ball','sun','A röpi napjait kihagyja','kedd, csütörtök, szombat'],['bolt','peach','Kíméli a jobb vállad','amíg 5 / 10 fölött jelzed'],['moon','sky','Pihenőhét a végén','az utolsó hét könnyű']].map(([ic,pal,b,c])=>`<div class="row">${G(ic,pal)}<div><b>${b}</b><div class="chips"><span class="chip">${c}</span></div></div></div>`).join('')}</div></section>
  ${mzCard(`${WZ.n} nap és ${W} hét: <em>${WZN[WZ.n]}</em> felosztást rakok össze, a ${WZ.f.length?WZ.f.join(' és ').toLowerCase():'teljes test'} hangsúllyal.`)}</div>`}

/* ── running + its plan ── */
const RLOG=[['szeptember 18., péntek','Piramis',8,5,46,''],['szeptember 16., szerda','Sprint',9,6,49,'Az utolsó két kör nehéz volt, de tartottam az iramot.'],['szeptember 11., péntek','Piramis',8,5,52,''],['szeptember 9., szerda','Sprint',9,5,56,'Az első hét: öt kör ment tisztán.']];
const sprintShape=()=>[30,30,...Array.from({length:9},()=>[100,26]).flat(),30,30];
function futas(){
  return `${ihead({ph:'edz-futas.jpg',pos:'center 55%',crumb:'Edzés › Terv › <b>Futás</b>',eb:'Robbanékonyság 01 · 3. hét / 8',title:'Két futás a héten',sub:'Sprint-állóképesség a röpihez, építő fázis.',btn:`${G('shoe','ink')}Pótolom a sprintet`,attrs:'data-toast="Futás naplózása — a 4. körben jön"'})}
  <h1 class="head rise" style="--i:1">A szerdai sprint <em>elmaradt</em>, péntekre még megvan a piramis.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>A sprint-intervallum</h3><span class="crumb">minden szerdán</span></div><div class="card gy only deep"><div class="dhead"><small>Kilenc kör · 15 másodperc</small><b>9–10<small>/ 10</small></b></div><div class="ivl">${sprintShape().map((h,i,a)=>`<i class="${h===100?'s':i<2||i>a.length-3?'w':''}" style="height:${h}%"></i>`).join('')}</div><div class="ivlax"><span>bemelegítés</span><span>sprint és séta</span><span>levezetés</span></div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>E hét</h3><span class="crumb">két edzés</span></div><div class="dlist one">${[['Sprint-intervallum · szerda 18:00',`<span class="chip warm">${G('shoe','peach')}elmaradt</span><span class="chip">pótolható</span>`,0],['Piramis-intervallum · péntek 17:30','<span class="chip">15 / 30 / 45 / 30 / 15 mp</span><span class="chip">8–9 erőfeszítés</span>',1]].map(([n,c,f])=>`<article class="dl tap ${f?'fut':''}" role="button" tabindex="0" data-toast="Futás naplózása — a 4. körben jön"><span class="stk"><img src="${PH('edz-futas-sq.jpg')}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips">${c}</div></div>${G('chev','ink','chev')}</article>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="card t-peach pad"><div class="row">${G('bolt','peach')}<div><b>Comb és lábhajlító · −2 szett</b><small>A sprintek a lábat is terhelik, ezért a heti láb-szettekből kettőt levonunk, ugyanúgy, mint a röpinél.</small></div></div></div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Pulzus-megnyugvás</h3><span class="crumb">egyre gyorsabb</span></div><div class="card gy only"><div class="bars">${[...RLOG].reverse().map(r=>`<div class="br"><span>${r[0].split(',')[0]} · ${r[1]}</span><b>${r[4]} <small>másodperc</small></b><u><i style="--w:${r[4]/60*100}%;background:${r[4]<50?'var(--deep)':'var(--sage)'}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:6"><div class="sh"><h3>Napló</h3></div><div class="dlist one">${RLOG.map(([d,t,rpe,k,hr,n])=>`<article class="dl"><span class="stk"><img src="${PH('edz-futas-sq.jpg')}" alt=""></span><div class="dtx"><strong>${d} · ${t}</strong><div class="chips"><span class="chip soft">${k} kör</span><span class="chip">${rpe} / 10</span>${n?`<span class="chip">„${n.slice(0,24)}…”</span>`:''}</div></div></article>`).join('')}</div></section>
  <section class="sec rise" style="--i:7"><div class="sh"><h3>Futótervek</h3></div><div class="card t-sage pad">${[['bolt','deep','Robbanékonyság 01','aktív · 3. hét / 8','data-go="edzes-futasterv"'],['clock','sky','5K-alapozó','november 9-től · 6 hét','data-toast="5K-alapozó — tervezett, ugyanígy szerkeszthető"'],['check','sage','Téli base 02','lezárva · 16-ból 14 megvolt','data-toast="Téli base 02 — archív"']].map(([ic,pal,b,c,go])=>`<div class="row tap" role="button" tabindex="0" ${go}>${G(ic,pal)}<div><b>${b}</b><div class="chips"><span class="chip">${c}</span></div></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  ${mzCard('A pulzusod a sprint után <em>46 másodperc</em> alatt nyugszik meg, három hete még 56 volt. Ez a röpin a harmadik szettben érződik.')}</div>`}
function futasterv(){
  return `${ihead({ph:'edz-futas.jpg',pos:'center 55%',crumb:'Edzés › Futás › <b>Robbanékonyság 01</b>',eb:'Futóterv · aktív · 3. hét / 8',title:'Robbanékonyság 01',sub:'Sprint-állóképesség a röpihez. Szeptember 8. – november 2.',btn:`${G('check','ink')}Lezárom`,attrs:'data-toast="Lezárás: a terv az archívumba kerül"',sm:true})}
  <h1 class="head rise" style="--i:1"><em>Minden változás</em> magától mentődik.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Nyolc hét</h3><span class="crumb">körök száma</span></div><div class="card gy only deep pre">${tubesDeep([6,7,9,9,10,10,11,6],12,2,['1.','2.','3.','4.','5.','6.','7.','8.'],'arc6 a8')}</div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Alapadatok</h3></div><div class="card t-sky pad">${[['spark','sun','Cél','sprint-állóképesség röpihez'],['clock','sky','Sprint','szerda 18:00 · 9 kör · 45 mp séta'],['repeat','sage','Piramis','péntek 17:30 · 15 / 30 / 45 / 30 / 15 mp']].map(([ic,pal,b,c])=>`<div class="row tap" role="button" tabindex="0" data-toast="${b} szerkesztése — a mező a következő körben">${G(ic,pal)}<div><b>${b}</b><div class="chips"><span class="chip">${c}</span></div></div>${G('chev','ink','chev')}</div>`).join('')}</div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Hetek</h3></div><div class="dlist one">${[6,7,9,9,10,10,11,6].map((k,i)=>`<article class="dl ${i===2?'today':i>2?'fut':''}"><span class="stk"><img src="${PH('edz-futas-sq.jpg')}" alt=""></span><div class="dtx"><strong>${i+1}. hét${i===7?' · könnyű':''}</strong><div class="chips">${i<2?`<span class="chip soft">${G('check','sage')}kész</span>`:i===2?`<span class="chip ink">most</span>`:''}<span class="chip">sprint ${k} kör</span><span class="chip">piramis ${i<4?'egyszer':'kétszer'}</span></div></div></article>`).join('')}</div></section>
  ${mzCard('Az 5. héttől <em>a piramis kétszer</em> fut le egy edzésen. Ha a röpi meccs szombaton van, pénteken egyszer elég.')}</div>`}

/* ── two runs side by side ── */
function osszevetes(){const A='#2E6B52',B='#8CC3E8';
  return `${ihead({ph:'edz-kreta.jpg',pos:'center 45%',crumb:'Edzés › Lezárt futamok › <b>Összevetés</b>',eb:'A · B · két lezárt futam',title:'A Hypertrophy 03-ból több lett meg.',sub:'92% a 88% mellett. A: június–július, B: február–április.',btn:`${G('repeat','ink')}Másik kettő`,attrs:'data-toast="Két másik futam választása — a Lezárt futamok oldalán"'})}
  <h1 class="head rise" style="--i:1">Az A futam <em>rövidebb volt</em>, de egyenletesebb.</h1>
  <section class="sec rise first" style="--i:2"><div class="sh"><h3>Mennyi lett meg</h3></div><div class="card gy only deep pre"><div class="bars">${[['A · Hypertrophy 03','22 / 24 edzés · 6 hét',92,'#F4C860'],['B · Recovery rebuild','28 / 32 edzés · 8 hét',88,'#8CC3E8']].map(([l,s,p,c])=>`<div class="br"><span>${l}</span><b>${p} <small>% · ${s}</small></b><u><i style="--w:${p}%;background:${c}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:3"><div class="sh"><h3>Fókusz</h3></div><div class="card t-sun pad"><div class="row">${G('star','sun')}<div><b>A · hangsúly</b><div class="chips"><span class="chip">Hát</span><span class="chip">Comb</span><span class="chip">Váll · tartva</span></div></div></div><div class="row">${G('repeat','sky')}<div><b>B · visszaépítés</b><div class="chips"><span class="chip">minden izom építés</span></div></div></div></div></section>
  <section class="sec rise" style="--i:4"><div class="sh"><h3>Csúcs szett egy héten</h3></div><div class="ablg"><span><i style="background:${A}"></i>A</span><span><i style="background:${B}"></i>B</span></div><div class="card gy only ab"><div class="bars">${[['Hát',12,9],['Váll',14,10],['Comb',14,12],['Mell',14,11]].map(([l,a,b])=>`<div class="br"><span>${l}</span><b>${a} <small>/ ${b}</small></b><u><i style="--w:${a/16*100}%;background:${A}"></i></u><u><i style="--w:${b/16*100}%;background:${B}"></i></u></div>`).join('')}</div></div></section>
  <section class="sec rise" style="--i:5"><div class="sh"><h3>Közös gyakorlatok</h3></div><div class="dlist one">${[['Guggolás','barbell-squat','+7,5 kg','+12,5 kg'],['Döntött törzsű evezés','barbell-row','+5 kg','+2,5 kg'],['Fekvenyomás','barbell-bench-press','=','+5 kg']].map(([n,p,a,b])=>`<article class="dl"><span class="stk"><img class="ex" src="${EPH(p)}" alt=""></span><div class="dtx"><strong>${n}</strong><div class="chips"><span class="chip soft">A ${a}</span><span class="chip">B ${b}</span></div></div></article>`).join('')}</div></section>
  ${mzCard('A B futamban <em>sérülés után</em> nőttél nagyot, az A-ban már magasabbról indultál. Mindkettő jó volt a maga helyén.')}</div>`}

/* sheet: Monday's changes (heti vizsgálat) */
SHEETS.edzRoll=()=>{const L=Object.values(MUS);return `<div class="grab"></div><div class="dsh"><div class="dshph">${L.filter(m=>step(m)>0).map(m=>`<img class="ex" src="${EPH(m[6])}" alt="">`).join('')}</div><h2>Hétfőtől változik</h2><div class="chips"><span class="chip soft">75 → 82 szett</span><span class="chip">hétfő hajnalban</span></div></div><div class="card pad" style="background:var(--paper);box-shadow:none">${L.map(m=>`<div class="row"><img class="rimg big ex" src="${EPH(m[6])}" alt=""><div><b>${m[0]}</b><div class="chips">${tierChip(m[4])}</div></div><span class="v">${step(m)>0?`+${step(m)}`:'marad'}</span></div>`).join('')}</div>`};

/* in-place controls: day editor steppers, wizard */
document.addEventListener('click',e=>{
  const ns=e.target.closest('[data-nst]');if(ns){const [k,d]=ns.dataset.nst.split('|').map(Number);NSZ.sets[k]=Math.max(1,Math.min(6,NSZ.sets[k]+d));repaintIn(()=>napszerk(NSZ.i));haptic(6);return}
  const wn=e.target.closest('[data-wzn]');if(wn){WZ.n=+wn.dataset.wzn;WZ.days={2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5]}[WZ.n];repaintIn(ujterv);haptic(6);return}
  const wd=e.target.closest('[data-wzd]');if(wd){const j=+wd.dataset.wzd;WZ.days=WZ.days.includes(j)?WZ.days.filter(x=>x!==j):[...WZ.days,j].sort();if(WZ.days.length>=2&&WZ.days.length<=6)WZ.n=WZ.days.length;repaintIn(ujterv);haptic(6);return}
  const ww=e.target.closest('[data-wzw]');if(ww){WZ.w=+ww.dataset.wzw;repaintIn(ujterv);haptic(6);return}
  const wf=e.target.closest('[data-wzf]');if(wf){const m=wf.dataset.wzf;if(WZ.f.includes(m))WZ.f=WZ.f.filter(x=>x!==m);else if(WZ.f.length>=2){toast('Legfeljebb két hangsúly: előbb vegyél ki egyet');return}else WZ.f=[...WZ.f,m];repaintIn(ujterv);haptic(6);return}
  const nv=e.target.closest('[data-nsave]');if(nv){toast('Mentve: a nap minden hétre így marad');location.hash='edzes-nap-'+nv.dataset.nsave;return}
  if(e.target.closest('[data-wzgo]')){if(WZ.days.length<2){toast('Legalább két edzésnap kell');return}toast(`Kész: ${WZ.w} hetes terv, ${WZ.days.length} nap · a tervek közé került`);location.hash='edzes-tervek';return}
},true);

const R3={'edzes-run':run,'edzes-het':het,'edzes-tervek':tervek,'edzes-futamok':futamok,'edzes-riport':riport,'edzes-sablonok':sablonok,'edzes-sablon':sablon,'edzes-ujterv':ujterv,'edzes-futas':futas,'edzes-futasterv':futasterv,'edzes-osszevetes':osszevetes};
const route3=h=>{if(R3[h])return R3[h]();let m=h.match(/^edzes-nap-(\d)$/);if(m)return nap(+m[1]);m=h.match(/^edzes-napszerk-(\d)$/);if(m)return napszerk(+m[1]);m=h.match(/^edzes-izom-(\w+)$/);if(m)return izom(m[1]);return null};

/* side panel: Edzés notes while the domain is open (Fuel's notes come back outside it) */
const notes=document.querySelector('.notes');
const ENOTES=()=>`<h2>Lágy irány · Edzés</h2><small>Állapot: 2026-11-04 · 1. kör: a négy fül</small><p>Az Edzés a Fuel nyelvén: fotó a lap tetején, egy mélyzöld kártya a fő számmal, színes kártyák, pirulák, Mezo a végén.</p><p><b>A Mai fül állapotai:</b></p><ul>${STATES.map(([k,l])=>`<li><a href="#edzes${k?'-mai-'+k:''}">${l}</a></li>`).join('')}</ul><p><b>Az edzés útja (2. kör):</b></p><ul><li><a href="#edzes-indulas">Eligazítás</a> → Indulás</li><li><a href="#edzes-session">Edzés közben</a>: a pipa → „hogy ment?” → pihenő</li><li><a href="#edzes-cer">Lezárás</a></li><li><a href="#edzes-review">Összegzés</a> · <a href="#edzes-review-gyak">egy gyakorlaté</a></li></ul><p><b>A Terv aloldalai (3. kör):</b></p><ul><li><a href="#edzes-run">a futó terv</a> · <a href="#edzes-nap-3">egy nap</a> · <a href="#edzes-napszerk-3">a nap szerkesztése</a></li><li><a href="#edzes-het">heti vizsgálat</a> · <a href="#edzes-izom-hat">egy izom</a></li><li><a href="#edzes-tervek">edzéstervek</a> · <a href="#edzes-ujterv">új terv</a></li><li><a href="#edzes-futamok">lezárt futamok</a> · <a href="#edzes-riport">riport</a> · <a href="#edzes-osszevetes">összevetés</a></li><li><a href="#edzes-sablonok">sablonok</a> · <a href="#edzes-sablon">egy sablon</a></li><li><a href="#edzes-futas">futás</a> · <a href="#edzes-futasterv">futóterv</a></li></ul><p><b>Ami még jön:</b> egy gyakorlat oldala, érmek, sport, saját edzés, lapok (4.).</p>`;
/* swap only the panel's text: the shell's toggle row (.tog) and its handlers stay in place */
const setNotes=on=>{if(!notes)return;const has=!!document.getElementById('enotes');if(on&&!has){[...notes.children].forEach(c=>{if(!c.classList.contains('tog')){c.dataset.fh=1;c.style.display='none'}});const d=document.createElement('div');d.id='enotes';d.innerHTML=ENOTES();notes.insertBefore(d,notes.firstChild);const t=notes.querySelector('.tog');if(t)d.insertBefore(t,d.children[2]||null)}else if(!on&&has){const d=document.getElementById('enotes'),t=d.querySelector('.tog');if(t){const ref=[...notes.children].find(c=>c.dataset.fh&&c.tagName==='P'&&c.previousElementSibling&&c.previousElementSibling.tagName==='SMALL');notes.insertBefore(t,ref?ref.nextSibling:null)}d.remove();[...notes.children].forEach(c=>{if(c.dataset.fh){c.style.display='';delete c.dataset.fh}})}};
window.addEventListener('hashchange',()=>setNotes(location.hash.slice(1).startsWith('edzes')));

/* keep the tab photos decoded so a tab switch never flashes */
['edz-huzodzkodas','edz-korlat','edz-kreta','edz-sulyzo'].forEach(n=>{const im=new Image();im.src=PH(n+'.jpg');if(im.decode)im.decode().catch(()=>{});TABPH.push(im)});

const MSTATES=STATES.map(s=>s[0]).filter(Boolean);
DOM.edzes={tabs:['edzes','edzes-terv','edzes-terheles','edzes-gyak',...MSTATES.map(s=>'edzes-mai-'+s)],
  tabName:h=>h==='edzes-terv'?'Terv':h==='edzes-terheles'?'Terhelés':h==='edzes-gyak'?'Gyakorlatok':'Mai',
  render:h=>route3(h)||(h==='edzes-indulas'?indulas():h==='edzes-session'?session():h==='edzes-cer'?cer():h==='edzes-review'?review():h==='edzes-review-gyak'?reviewGyak():h==='edzes-terv'?terv():h==='edzes-terheles'?terheles():h==='edzes-gyak'?gyak():h.startsWith('edzes-mai-')?mai(h.slice(10)):mai(EST.day)),
  after:h=>{if(h==='edzes-cer')counter();if(h==='edzes-session')dockPaint();setNotes(true)}};
})();
