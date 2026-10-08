/* vilagos/edzes.js — Edzés domain in the "Világos · élő" look. Built on window.F (see vilagos/README.md). */
(function(){
const {I,csepp,mchp,muscleColor,page,sec,card,head,hero,btn,lk,step,row,bar,facts,st,note,register}=F;
const LBL={'back-wide':'Hát','back-mid':'Hát közép','shoulder-rear':'Hátsó váll','biceps-brachialis':'Kar','traps':'Trapéz'};
const dstrip=()=>{const D=[['H',21,'ok'],['K',22,'ok'],['Sze',23,'–'],['Cs',24,'ma','on'],['P',25,'•'],['Szo',26,'pihenő','rest'],['V',27,'pihenő','rest']];
  return `<section class="ds rise">${D.map(([l,n,m,k])=>`<button class="${k||''}" data-toast="${l} · ${n}."><small>${l}</small><b>${n}</b><i class="${m==='ok'?'ok':''}">${m==='ok'?I('i-check'):m}</i></button>`).join('')}</section>`};
function mai(){
  const MUS=[['back-wide','Hát (széles)',6,0],['back-mid','Hát (közép)',4,3],['shoulder-rear','Váll (hátsó)',3,0],['biceps-brachialis','Kar',3,0]];
  return page('edzes',{title:'Edzés',sub:'Hypertrophy 04 · 3. hét / 6',tab:'mai'},`${dstrip()}
  ${hero({lbl:'Mai edzés · 07:30 · Gym',verdict:'Pull Day',big:true,art:'t-dumbbell',
    body:facts([['5','gyakorlat'],['16','szett'],['~78','perc']])+`<div class="fh-chips">${Object.keys(LBL).map(k=>`<span>${mchp(k,'sm')}${LBL[k]}</span>`).join('')}</div>`,
    acts:`<button class="btn" style="flex:1" data-toast="Eligazítás, majd indul az edzés">Edzés indítása</button>`+lk('Kihagyom',{toast:'Kihagyom · megadhatod, miért'})},1)}
  ${sec(1,'Mielőtt elkezded',2)}
  ${hero({warn:true,lbl:'A reggeli check-inből',verdict:'Könnyebb nap javasolt',sub:'A jobb vállad fáj. A Rear Delt Fly-t könnyebb súllyal, vagy hagyd ki.',left:csepp('warn',57,{s:60,val:48}),
    body:`<div class="fh-why"><span>Kipihentség</span><span class="v">4 / 10</span>${bar(40,'var(--warn)')}<span>Izomláz</span><span class="v">7 / 10</span>${bar(70,'var(--bad)')}</div>`,
    acts:btn('Könnyítsük',{toast:'Könnyítve: a múlt heti súly marad'},'sm')+btn('Maradjon a terv',{toast:'Marad a terv'},'sm ghost')},2)}
  ${sec(2,'Ma még',3)}
  ${card(step({time:'18:00',icon:'t-volley',title:'Röpi edzés · BVSC',sub:'90 perc · feladó',right:st('Tervezett')})
    +step({time:'tegnap',icon:'t-run',title:'Sprint-intervallum',sub:'6 kör · elmaradt',right:btn('Pótlom',{toast:'Futás pótlása'},'sm ghost')}),{i:3})}
  ${sec(3,'Mai terhelés',4)}
  ${card(head('t-muscle','Mit terhel a mai mozgásod','Térkép')+MUS.map(([k,l,p,d])=>`<div class="fh-mus">${mchp(k,'sm')}<span class="l">${l}</span><span class="v">${d} / ${p} szett</span>${bar(Math.max(4,d/p*100),muscleColor(k))}</div>`).join('')
    +note('+650 kcal kerül a mai kereted fölé, ha mindent megcsinálsz. Becslés, nem mérés.'),{i:4})}
  ${sec(4,'Vagy inkább',5)}
  ${card(`<div class="fh-pair"><button data-toast="Egyedi edzés">${I('t-dumbbell')}Egyedi edzés</button><button data-toast="Sport naplózása">${I('t-volley')}Sport naplózása</button></div>`,{i:5})}`)}
register('edzes',{title:'Edzés',tabs:[['Mai','mai'],['Terv','terv'],['Terhelés','terheles'],['Gyakorlatok','exercises']],routes:{mai},sheets:{},
  notes:`<h2>Edzés</h2><p>Egyelőre csak a Mai oldal készült el ebben a kinézetben.</p>`});
})();
