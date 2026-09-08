export function imprintWeek(s) {
  const today = s.checkins.map((c,i)=>({id:`checkin-${i}`,kind:'checkin',title:`${c.slot} · check-in`,detail:c.note || 'Közérzet rögzítve, szöveges megjegyzés nélkül.',time:c.time,planned:false}));
  if(s.journal.trim()) today.push({id:'journal',kind:'journal',title:'A saját szavaid',detail:s.journal.trim(),time:'Ma',planned:false});
  if(s.gratitude.trim()) today.push({id:'gratitude',kind:'gratitude',title:'Amiért hálás vagy',detail:s.gratitude.trim(),time:'Ma',planned:false});
  today.push({id:'gym',kind:'movement',title:s.training.cycle.session,detail:`A hypertrophy mezociklus ${s.training.cycle.week}. hetének tervezett edzése.`,time:s.training.cycle.time,planned:true});
  if(s.training.sportActive) today.push({id:'sport',kind:'movement',title:'Röplabda',detail:'Tervezett sport · 75 perc.',time:'19:00',planned:true});
  return ['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap'].map((name,i)=>({name,short:['H','K','Sze','Cs','P','Szo','V'][i],date:7+i,today:i===1,fixture:i===0,future:i>1,events:i===1?today:i===0?[
    {id:'m-checkin',kind:'checkin',title:'Reggeli indulás',time:'08:10',detail:'Nyugodtan indult a hét. Előre megírt hétfői példa.',planned:false},
    {id:'m-gym',kind:'movement',title:'Push A',time:'17:30',detail:'Lezárt edzés a hétfői bemutatóban.',planned:false},
    {id:'m-journal',kind:'journal',title:'Esti napló',time:'21:15',detail:'Jólesett időt hagyni a mozgásra. Előre megírt példa.',planned:false},
    {id:'m-gratitude',kind:'gratitude',title:'Egy közös pillanat',time:'21:20',detail:'Hálás vagyok a délutáni beszélgetésért. Előre megírt példa.',planned:false},
  ]:[]}));
}
export const imprintKinds = {
  checkin: {label:'Check-in',color:'#bd8876'},
  movement: {label:'Mozgás',color:'#718ba3'},
  journal: {label:'Napló',color:'#9a84a5'},
  gratitude: {label:'Hála',color:'#b99a59'},
};
