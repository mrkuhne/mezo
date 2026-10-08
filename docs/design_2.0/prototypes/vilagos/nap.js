/* vilagos/nap.js — Nap domain in the "Világos · élő" look. Built on window.F (see vilagos/README.md). */
(function(){
const {I,csepp,page,sec,card,head,hero,btn,lk,step,row,stat,grid,txt,register}=F;
function mai(){return page('nap',{title:'Ma',sub:'Nap · szerda, október 7.',tab:'mai'},`
  ${hero({lbl:'Mai állapot',verdict:'Ma jó nap egy közepes edzéshez.',sub:'Nyugodt ébredés, 7 ó 40 p alvás. A hét jeledből négy megvan.',left:csepp('ok',57,{s:104,val:72,label:'MA'}),
    acts:btn('Délutáni check-in',{toast:'Délutáni check-in'})+lk('Miből áll össze?',{toast:'Életjelek · miből áll össze a 72'})})}
  ${sec(1,'Most következik',1)}
  ${card(step({time:'14:00',icon:'t-checkin',title:'Délutáni check-in',sub:'8 koppintás, kb. fél perc',now:true,right:btn('Kitöltöm',{toast:'Check-in'},'sm')})
    +step({time:'18:00',icon:'t-volley',title:'Röpi edzés · BVSC',sub:'90 perc · feladó',right:btn('Megnézem',{dom:'edzes'},'sm ghost')})
    +step({time:'19:30',icon:'t-bowl',title:'Vacsora',sub:'1 040 kcal van még · 72 g fehérje hiányzik',right:btn('Logolom',{dom:'fuel'},'sm ghost')}),{i:1})}
  ${sec(2,'Mai számok',2)}
  ${card(grid([stat({k:'Kalória',icon:'t-flame',n:'2 060',unit:'/ 3 100',pct:66,s:'1 040 kcal van még',c:'var(--acc)',on:{dom:'fuel'}}),
    stat({k:'Fehérje',icon:'t-meat',n:'148',unit:'/ 220 g',pct:67,s:'72 g hiányzik',c:'var(--protein)',on:{dom:'fuel'}}),
    stat({k:'Alvás',icon:'t-sleep',n:'7 ó 40',unit:'perc',pct:92,s:'a heti átlagod fölött',sCls:'ok',c:'var(--ok)',on:{dom:'en'}}),
    stat({k:'Mozgás',icon:'t-dumbbell',n:'0',unit:'/ 2 alkalom',pct:4,s:'Pull Day még hátravan',sCls:'warn',c:'var(--warn)',on:{dom:'edzes'}})]),{i:2})}
  ${sec(3,'Észrevétel',3)}
  ${card(head('t-pattern','Anna és az alvásod','Összes')+txt('Amikor <b>Anna</b> szerepel a hála-naplódban, másnap átlag <b>40 perccel többet</b> alszol. Négy nap adata, ez még kevés. Figyeljem tovább?')
    +`<div class="fh-acts">${btn('Igen, figyeld',{toast:'Megjegyeztem: figyelem tovább'},'sm')}${btn('Nem stimmel',{toast:'Megjegyeztem'},'sm ghost')}${lk('Miből látod?',{toast:'Miből látom?'})}</div>`,{i:3})}
  ${sec(4,'Mai napló',4)}
  ${card(step({time:'13:00',icon:'t-bowl',title:'Ebéd',sub:'Csirke · édesburgonya · spenót · 760 kcal',on:{toast:'Fuel · étkezés'}})
    +step({time:'09:15',icon:'t-bowl',title:'Reggeli',sub:'Túrós zabkása áfonyával · 420 kcal',on:{toast:'Fuel · étkezés'}})
    +step({time:'07:10',icon:'t-checkin',title:'Reggeli check-in',sub:'Nyugodt ébredés, pihenve',on:{toast:'Check-in'}})
    +`<div class="fh-acts">${btn('+ Új bejegyzés',{toast:'Gyors logolás'},'sm ghost')}</div>`,{i:4})}`)}
register('nap',{title:'Nap',tabs:[['Mai','mai'],['A napom','napom'],['Beszélgetés','uzenetek'],['Rutin','rutin']],routes:{mai},sheets:{},
  notes:`<h2>Nap</h2><p>Egyelőre csak a Mai oldal készült el ebben a kinézetben.</p>`});
})();
