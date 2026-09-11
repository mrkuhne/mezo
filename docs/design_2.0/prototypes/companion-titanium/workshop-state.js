// Receptműhely demo state — mirrors the production contract: canvas-first, one turn returns the
// WHOLE new draft (patch semantics), macros come only from pantry facts, estimate lines block save.
export const GOALS=[
 {id:'high_protein',label:'Magas fehérje',message:'Alakítsd át magas fehérjetartalmúra.',slot:'Ebéd',color:'#e08a7c',art:'meat'},
 {id:'pre_workout',label:'Edzés előtt',message:'Alakítsd át edzés előtti étkezésnek.',slot:'Uzsonna',color:'#f0b36e',art:'bolt'},
 {id:'post_workout',label:'Edzés után',message:'Alakítsd át edzés utáni étkezésnek.',slot:'Ebéd',color:'#8fd97a',art:'dumbbell'},
 {id:'before_bed',label:'Lefekvés előtt',message:'Alakítsd át lefekvés előtti étkezésnek.',slot:'Vacsora',color:'#bca6f1',art:'moon'},
 {id:'breakfast',label:'Reggeli',message:'Alakítsd át reggelinek.',slot:'Reggeli',color:'#d9c395',art:'sun'},
];
const keyOf=name=>name.toLocaleLowerCase('hu-HU');
const pantryLine=(refId,name,amount,unit='g',extra={})=>({key:keyOf(name),source:'pantry',refId,name,amount,unit,...extra});
const estimateLine=(name,amount,est,unit='g')=>({key:keyOf(name),source:'estimate',name,amount,unit,est,estAmount:amount});
const TEMPLATES={
 high_protein:{name:'Fehérjés csirkés tál',servings:2,lines:[pantryLine('k-csirke','Csirkemell',300),pantryLine('k-rizs','Jázmin rizs',140),pantryLine('k-joghurt','Görög joghurt',150),estimateLine('Szezámmag',15,{kcal:86,p:2.7,c:3.5,f:7.5})],steps:['A rizst főzd meg enyhén sós vízben.','A csirkét csíkozd fel, és süsd aranybarnára.','A joghurtot keverd ki citrommal és fokhagymával.','Tálald a rizsre, és szórd meg szezámmal.']},
 pre_workout:{name:'Banános zabkása edzés előtt',servings:1,lines:[pantryLine('k-zab','Zabpehely',70),pantryLine('k-banan','Banán',120),pantryLine('k-joghurt','Görög joghurt',150),estimateLine('Méz',10,{kcal:30,p:0,c:8.2,f:0})],steps:['A zabot főzd puhára vízzel.','Keverd bele a joghurtot.','Tetejére banán és egy csurgatás méz.']},
 post_workout:{name:'Edzés utáni csirke-rizs',servings:1,lines:[pantryLine('k-csirke','Csirkemell',200),pantryLine('k-rizs','Jázmin rizs',100),estimateLine('Brokkoli',120,{kcal:41,p:3.4,c:8,f:.4})],steps:['Főzd meg a rizst.','A csirkét és a brokkolit süsd egy serpenyőben.','Tálald együtt.']},
 before_bed:{name:'Esti joghurtos tál',servings:1,lines:[pantryLine('k-joghurt','Görög joghurt',250),pantryLine('k-zab','Zabpehely',30),estimateLine('Dió',15,{kcal:98,p:2.3,c:2,f:9.8})],steps:['A joghurtot tedd tálba.','Szórd meg zabbal és dióval.']},
 breakfast:{name:'Tojásos reggeli tál',servings:1,lines:[pantryLine('k-tojas','Tojás',3,'db',{gramsPerUnit:55}),pantryLine('k-zab','Zabpehely',50),pantryLine('k-banan','Banán',100)],steps:['A tojásból süss rántottát.','A zabot áztasd be vízben.','Mellé szeletelt banán.']},
};
export function draftFromGoal(goalId){const template=TEMPLATES[goalId]??TEMPLATES.high_protein;return structuredClone({...template,goal:TEMPLATES[goalId]?goalId:'high_protein'});}
// Seeds the canvas from a saved recipe; lines that match a shelf item become pantry lines, the rest estimates.
export function draftFromRecipe(recipe,pantry){
 const lineKcal=recipe.lines.reduce((sum,l)=>sum+(l[2]||0),0)||1,whole=recipe.servings||1;
 const lines=recipe.lines.map(([name,amountText,kcal])=>{
  const parsed=/^(\d+(?:[.,]\d+)?)\s*(g|db|ml)?/.exec(amountText||'');
  const amount=parsed?Number(parsed[1].replace(',','.')):100,unit=parsed?.[2]==='db'?'db':'g';
  const item=pantry.find(k=>k.kind==='food'&&keyOf(name).includes(keyOf(k.name)));
  if(item)return pantryLine(item.id,name,amount,unit,unit==='db'?{gramsPerUnit:55}:{});
  const share=(kcal||0)/lineKcal;
  return estimateLine(name,amount,{kcal:kcal||0,p:recipe.p*whole*share,c:recipe.c*whole*share,f:recipe.f*whole*share},unit);
 });
 return {name:recipe.name,servings:whole,goal:null,lines,steps:[]};
}
export function lineMacros(line,pantry){
 if(line.source==='estimate'){const factor=line.estAmount>0?line.amount/line.estAmount:0;return {kcal:line.est.kcal*factor,p:line.est.p*factor,c:line.est.c*factor,f:line.est.f*factor,known:true};}
 const item=pantry.find(k=>k.id===line.refId);
 if(!item||item.kcal100==null)return {kcal:null,p:null,c:null,f:null,known:false};
 const grams=line.unit==='db'?line.amount*(line.gramsPerUnit||55):line.amount,of=v=>(v??0)*grams/100;
 return {kcal:of(item.kcal100),p:of(item.p100),c:of(item.c100),f:of(item.f100),known:true};
}
export function draftTotals(draft,pantry){return draft.lines.reduce((t,line)=>{const m=lineMacros(line,pantry);if(m.known){t.kcal+=m.kcal;t.p+=m.p;t.c+=m.c;t.f+=m.f;}else t.unknown++;return t;},{kcal:0,p:0,c:0,f:0,unknown:0});}
export const canSave=draft=>Boolean(draft&&draft.name.trim()&&draft.lines.length&&draft.lines.every(l=>l.source==='pantry'));
// The estimate snapshot is kept against the amount it arrived with, so an empty field never zeroes it for good.
export function setLineAmount(draft,index,amount){const next=structuredClone(draft);if(!next.lines[index])return next;next.lines[index].amount=Math.max(0,Math.round(Number(amount)*10)/10||0);return next;}
export function scaleServings(draft,servings){const target=Math.min(12,Math.max(1,Math.round(servings)));const factor=target/draft.servings;const next=structuredClone(draft);next.servings=target;next.lines.forEach(l=>{l.amount=Math.round(l.amount*factor*10)/10;});return next;}
export function replaceWithPantry(draft,index,item){const next=structuredClone(draft);if(!next.lines[index])return next;next.lines[index]=pantryLine(item.id,item.name,100);return next;}
export function dropLine(draft,index){const next=structuredClone(draft);next.lines.splice(index,1);return next;}
export function diffKeys(previous,next){const before=new Map((previous?.lines??[]).map(l=>[l.key,`${l.source}:${l.amount}`]));return next.lines.filter(l=>before.get(l.key)!==`${l.source}:${l.amount}`).map(l=>l.key);}
// Scripted stand-in for POST /api/recipe/workshop/turn: deterministic, never invents macros.
export function workshopTurn({draft,message,goal=null,context=[]}){
 const text=keyOf(message||'');
 if(text.includes('hiba'))return {ok:false};
 const tail=context.length?` A kamrádból figyelembe vettem: ${context.join(', ')}.`:'';
 if(!draft){const goalId=goal??(/zab|reggel/.test(text)?'breakfast':/este|lefekv/.test(text)?'before_bed':/edzés előtt/.test(text)?'pre_workout':'high_protein');const next=draftFromGoal(goalId);return {ok:true,draft:next,reply:`Összeraktam egy első vázlatot: ${next.name}. A számokat a kamrád adja — ahol becsültem, jelöltem.${tail}`,changed:next.lines.map(l=>l.key)};}
 const next=structuredClone(draft);let reply='Frissítettem a vázlatot.';
 if(goal)next.goal=goal;
 const bump=(pattern,factor)=>{const i=next.lines.findIndex(l=>pattern.test(l.key));if(i<0)return null;next.lines[i].amount=Math.round(next.lines[i].amount*factor*10)/10;return next.lines[i];};
 if(/fehérj/.test(text)||goal==='high_protein'||goal==='post_workout'){const line=bump(/csirke|joghurt|tojás|lazac|skyr/,1.5);if(line)reply=`Megemeltem: ${keyOf(line.name)} — így adagonként több fehérje jut.`;}
 else if(/könny|kevesebb|diét/.test(text)||goal==='before_bed'){const line=bump(/rizs|zab|tortilla|tészta/,.7);if(line)reply=`Visszavettem: ${keyOf(line.name)} — könnyebb lett, a fehérje maradt.`;}
 else if(/zöldség|rost/.test(text)){if(!next.lines.some(l=>l.key==='brokkoli')){next.lines.push(estimateLine('Brokkoli',120,{kcal:41,p:3.4,c:8,f:.4}));reply='Tettem bele brokkolit a rost miatt. Ez becsült sor — cseréld kamraelemre, ha van otthon.';}}
 else if(goal==='breakfast'||goal==='pre_workout'){if(!next.lines.some(l=>l.key==='banán')){next.lines.push(pantryLine('k-banan','Banán',120));reply='Hozzáadtam egy banánt a gyors energiáért.';}}
 return {ok:true,draft:next,reply:reply+tail,changed:diffKeys(draft,next)};
}
