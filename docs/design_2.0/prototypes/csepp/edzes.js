/* csepp/edzes.js — Edzés domain (Mai · Terv · Terhelés · Gyakorlatok, edzés közben, eligazítás, review). Built on window.K. */
(function(){
const {I,T,csepp,ring,page,sec,back,register,mchp}=K;
function mai(){
  const D=[['HÉT',21,'ok'],['KEDD',22,'ok'],['SZE',23,'–'],['MA',24,'•','on'],['PÉN',25,'•'],['SZO',26,'pihenő','rest'],['VAS',27,'pihenő','rest']];
  const MUS=[['back-wide','Hát (széles)',6,0],['back-mid','Hát (közép)',4,3],['shoulder-rear','Váll (hátsó)',3,0],['biceps-brachialis','Kar',3,0]];
  return K.page(`
  <section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k||''}" data-toast="${l} · szept ${n}."><small>${l}</small><b>${n}</b><i class="${m==='ok'?'ok':''}">${m==='ok'?I('i-check'):m}</i></button>`).join('')}</section>
  <section class="hero hg rise" style="--i:1"><div class="top"><span class="eb">Ma 07:30 · Gym · Hypertrophy 04 · 3/6</span></div>${I('i-dumb','art')}
    <h1 class="t">Pull Day</h1>
    <div class="chips"><span class="chip">5 gyakorlat</span><span class="chip">16 szett</span><span class="chip">~78 perc</span></div>
    <div class="mus" style="gap:6px">${['back-wide','back-mid','shoulder-rear','biceps-brachialis','traps'].map(k=>mchp(k,'sm')).join('')}</div>
    <div class="cta"><button class="btn" style="flex:1" data-toast="Eligazítás">${I('i-dumb')}Indítsuk ${I('i-chev')}</button><button class="lk" data-toast="Kihagyom">Kihagyom</button></div>
  </section>
  <section class="card hg rise" style="--i:2;margin-top:0"><div class="hero-cs" style="gap:12px">${csepp('warn',57,{s:56,val:48})}<span style="flex:1"><p class="verdict" style="font-size:17px;margin:0 0 2px">Könnyebb nap javasolt</p><p class="txt sub">Izomláz 7/10, kipihentség 4/10. A jobb vállad fáj: a Rear Delt Fly-t könnyebb súllyal, vagy hagyd ki.</p></span></div>
    <div class="act" style="margin-top:10px"><button class="btn sm" data-toast="Könnyítve: a múlt heti súly marad">Könnyítsük</button><button class="lk" data-toast="Marad a terv">Maradjon a terv</button></div>
  </section>
  <section class="open rise" style="--i:3"><span class="eb">Ma még jön</span>
    <div class="ln">${I('i-ball')}<span class="g">Röpi edzés · BVSC<small>18:00 · 90 perc</small></span><span class="st q">Tervezett</span></div>
    <div class="ln">${I('i-run')}<span class="g">Sprint-intervallum<small>tegnap · 6 kör · RPE 9–10</small></span><span class="st bad">Elmaradt</span></div>
    <div class="act" style="margin-top:8px"><button class="lk" data-toast="Futás pótlása">Pótold a futást</button><button class="lk" data-toast="Sport logolása">Logold a röpit</button></div>
  </section>
  <section class="open rise" style="--i:4"><span class="eb">Mai terhelés</span>
    <div class="big"><span class="num">+650</span><span class="v">kcal jön a kereted fölé, ha megcsinálod</span></div>
    <div style="height:6px"></div>
    ${MUS.map(([k,l,p,d])=>`<div class="ln">${mchp(k,'sm')}<span class="g">${l}</span><span class="v"><b>${d}</b> / ${p}</span><div class="bar q"><b style="--w:${p/6*100}%"></b></div></div>`).join('')}
    <p class="fn">Becslés, nem mérés. Ugyanez a szám áll a Fuel keretében.</p>
  </section>
  <section class="open rise" style="--i:5"><span class="eb">Vagy inkább</span>
    <div class="ln">${I('i-dumb')}<span class="g">Egyedi edzés</span>${I('i-chev','chev')}</div>
    <div class="ln">${I('i-ball')}<span class="g">Sport naplózása</span>${I('i-chev','chev')}</div>
    <div class="ln">${I('i-layers')}<span class="g">Mezociklus<small>Hypertrophy 04 · MAV · 3. hét / 6</small></span>${I('i-chev','chev')}</div>
  </section>
  `,'edzes','mai');
}



function session(){
  const row=(n,kg,r,e,st)=>st==='done'?`<span class="n">${n}</span><span class="v done">${kg}</span><span class="v done">${r}</span><span class="v done">${e}</span><span class="tk">${I('i-check')}</span>`
    :st==='cur'?`<span class="n">${n}</span><span class="in ph">${kg}</span><span class="in ph">${r}</span><span class="in ph">${e}</span><button class="tk go" data-toast="Szett kész · a pihenő indul" aria-label="Szett kész">${I('i-check')}</button>`
    :`<span class="n">${n}</span><span class="up">${kg}</span><span class="up">${r}</span><span class="up">${e}</span><span></span>`;
  const head=`<span class="h">#</span><span class="h">kg</span><span class="h">ism</span><span class="h">erő</span><span></span>`;
  return K.page(`
  <div class="sec rise" style="padding-bottom:6px"><span class="eb">Pull Day · 3. hét / 6</span><span class="eb">7 / 16 szett · 31 perc</span></div>
  <div class="pb rise">${[1,1,.5,0,0].map((w,i)=>`<i><b style="--w:${w*100}%"></b></i>`).join('')}</div>
  <section class="ex hg rise" style="--i:1"><div class="exh">${mchp('back-wide')}<span class="g"><strong>Húzódzkodás (súlyozott)</strong><small>múlt hét 10 kg × 8 · ma a javaslat <b>12,5 kg × 8</b></small></span></div>
    <div class="sets">${head}${row(1,'12,5','8','7','done')}${row(2,'12,5','8','8','done')}${row(3,'12,5','8','8','cur')}${row(4,'12,5','7–8','8–9','up')}</div>
    <div class="tech">${I('i-book')}<span class="g"><b>Technika</b> · Beállás · Végrehajtás · Gyakori hibák</span>${I('i-chev','chev')}</div>
  </section>
  <section class="ex rise" style="--i:2"><div class="exh">${mchp('back-mid','sm')}<span class="g"><strong>Döntött törzsű evezés</strong><small>múlt hét 70 kg × 10 · ma <b>72,5 kg × 10</b></small></span></div>
    <div class="sets">${head}${row(1,'72,5','10','8','up')}${row(2,'72,5','10','8','up')}${row(3,'72,5','10','9','up')}</div>
  </section>
  <section class="ex rise" style="--i:3"><div class="exh">${mchp('shoulder-rear','sm')}<span class="g"><strong>Rear Delt Fly</strong><small>könnyítve a váll miatt · <b>10 kg × 12</b>, a múlt heti 12,5 helyett</small></span></div>
    <div class="sets">${head}${row(1,'10','12','7','up')}${row(2,'10','12','7','up')}${row(3,'10','12','8','up')}</div>
  </section>
  <section class="ex rise" style="--i:4"><div class="exh">${mchp('biceps-brachialis','sm')}<span class="g"><strong>Kalapácsbicepsz</strong><small>múlt hét 16 kg × 12 · ma <b>16 kg × 13</b></small></span></div>
    <div class="sets">${head}${row(1,'16','13','8','up')}${row(2,'16','13','8','up')}${row(3,'16','12–13','9','up')}</div>
  </section>
  <section class="ex rise" style="--i:5"><div class="exh">${mchp('traps','sm')}<span class="g"><strong>Vállemelés</strong><small>múlt hét 30 kg × 15 · ma <b>30 kg × 15</b></small></span></div>
    <div class="sets">${head}${row(1,'30','15','8','up')}${row(2,'30','15','8','up')}${row(3,'30','15','9','up')}</div>
  </section>
  <p class="fn p16 rise" style="--i:6;padding:0 16px">A harmadik mező beírásakor a pihenő magától indul. A javaslat a múlt hetedből jön; felülírhatod.</p>
  `+`<div class="rest rise" style="--i:2"><div class="ring sm" style="--c:var(--acc)"><svg viewBox="0 0 88 88"><circle class="t" cx="44" cy="44" r="38"/><circle class="p" cx="44" cy="44" r="38" style="--d:${(circ(38)*.62).toFixed(1)}"/></svg></div><span class="g"><strong>01:12</strong><small>pihenő · 90 mp az ajánlott</small></span><button class="pill" data-toast="+15 mp">+15</button><button class="pill" data-toast="Pihenő átugorva">Tovább</button></div>`,'edzes','mai',{pad:'170px'});
}


register('edzes',{
  mark:'i-dumb',
  tabs:[['Mai','i-dumb','mai'],['Terv','i-layers','terv'],['Terhelés','i-bars','terheles'],['Gyakorlatok','i-book','exercises']],
  routes:{mai,session},
  sheets:{},
  notes:`<h2>Edzés</h2><p>Mai: Pull Day hős üvegben izomtérkép-chipekkel, Könnyebb nap javasolt a borostyán cseppel, Ma még jön, Mai terhelés, Vagy inkább. <b>#a-edzes-session</b>: edzés közben (BWS): súly · ism · erő, javaslat a sorban, automatikus pihenő, technika-lap. A többi fül kidolgozás alatt.</p>`
});
})();
