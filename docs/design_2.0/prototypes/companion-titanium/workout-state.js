export const exercises=[
 {name:'Fekvenyomás',muscle:'Mell',zone:'chest',kg:60,reps:10,rir:2,rest:150,last:'57,5 kg × 10 · 2 RIR',cue:'Talpak lent. Stabil lapockák. Maradjon két ismétlés tartalékban.',color:'#c8e895'},
 {name:'Evezés csigán',muscle:'Hát',zone:'back',kg:45,reps:12,rir:2,rest:90,last:'45 kg × 11 · 2 RIR',cue:'Vidd hátra a könyököd. A visszaengedés is legyen kontrollált.',color:'#8ed2e8'},
 {name:'Vállból nyomás',muscle:'Váll',zone:'shoulder',kg:20,reps:10,rir:2,rest:90,last:'20 kg × 10 · 2 RIR',cue:'Nyugodt tempó, stabil törzs. A súly egy kézisúlyzóra értendő.',color:'#bca6f1'},
];
export const createWorkout=()=>({status:'ready',startedAt:null,finishedAt:null,sets:exercises.map(()=>[null,null,null]),note:''});
export function logSet(w,exercise,index,input){
 if(w.status==='complete'||!Number.isInteger(exercise)||!w.sets[exercise]||!Number.isInteger(index)||index<0||index>2)return false;
 const {kg,reps,rir}=input;
 if(![kg,reps,rir].every(Number.isFinite)||kg<0||kg>500||!Number.isInteger(reps)||reps<1||reps>100||!Number.isInteger(rir)||rir<0||rir>10)return false;
 w.status='active';w.startedAt??=Date.now();w.sets[exercise][index]={kg,reps,rir};return true;
}
export function metrics(w){const all=w.sets.flat().filter(Boolean);return {count:all.length,reps:all.reduce((n,s)=>n+s.reps,0),volume:all.reduce((n,s)=>n+s.kg*s.reps,0),xp:all.length*10};}
export function finishWorkout(w){if(w.status==='complete'||metrics(w).count===0)return false;w.status='complete';w.finishedAt=Date.now();return true;}
export function loadRows(w){return [
 {name:'Mell',key:'chest',base:6,plan:12,low:8,high:14,color:'#c8e895'},
 {name:'Hát',key:'back',base:9,plan:14,low:10,high:16,color:'#8ed2e8'},
 {name:'Váll',key:'shoulder',base:4,plan:8,low:6,high:10,color:'#bca6f1'},
 {name:'Láb',key:'leg',base:8,plan:12,low:8,high:14,color:'#e0bd8a'},
 ].map((row,i)=>{const added=w.status==='complete'&&i<3?w.sets[i].filter(Boolean).length:0;return {...row,added,done:row.base+added};});}
