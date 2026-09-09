export const TODAY = '2026-09-09';
export const STORAGE = 'mezo-fuel-clay-lab-v1';
export const NAV = [['diary','Napló','naplo'],['recipes','Receptek','recept'],['pantry','Kamra','kamra'],['stack','Stack','stack'],['settings','Beállítások','beallitas']];
export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export function createState() {
 const pantry = [
  {id:'oats',name:'Zabpehely',brand:'Saját kamra',category:'Gabona',icon:'reggeli',kcal:390,p:13,c:62,f:7,fiber:10,stock:600,unit:'g',source:'Címke',nova:1},
  {id:'yogurt',name:'Görög joghurt',brand:'Natúr · 2%',category:'Tejtermék',icon:'reggeli',kcal:63,p:10,c:4,f:2,fiber:0,stock:450,unit:'g',source:'Címke',nova:1},
  {id:'berries',name:'Áfonya',brand:'Friss',category:'Gyümölcs',icon:'snack',kcal:57,p:1,c:14,f:0.3,fiber:2.4,stock:200,unit:'g',source:'Katalógus',nova:1},
  {id:'chicken',name:'Sült csirkemell',brand:'Natúr',category:'Fehérje',icon:'ebed',kcal:165,p:31,c:0,f:3.6,fiber:0,stock:400,unit:'g',source:'Katalógus',nova:1},
  {id:'rice',name:'Főtt barna rizs',brand:'Főtt tömeg',category:'Gabona',icon:'ebed',kcal:123,p:2.7,c:25.6,f:1,fiber:1.6,stock:500,unit:'g',source:'Katalógus',nova:1},
  {id:'broccoli',name:'Brokkoli',brand:'Friss',category:'Zöldség',icon:'vacsora',kcal:34,p:2.8,c:6.6,f:0.4,fiber:2.6,stock:100,unit:'g',source:'Katalógus',nova:1},
  {id:'salmon',name:'Lazacfilé',brand:'Friss · bőr nélkül',category:'Fehérje',icon:'vacsora',kcal:208,p:20,c:0,f:13,fiber:0,stock:300,unit:'g',source:'Címke',nova:1},
  {id:'banana',name:'Banán',brand:'Friss',category:'Gyümölcs',icon:'snack',kcal:89,p:1.1,c:23,f:0.3,fiber:2.6,stock:360,unit:'g',source:'Katalógus',nova:1},
  {id:'almond',name:'Mandula',brand:'Natúr',category:'Magvak',icon:'snack',kcal:579,p:21,c:22,f:50,fiber:12.5,stock:150,unit:'g',source:'Címke',nova:1},
 ];
 const recipes = [
  {id:'bowl',name:'Csirkés ebédtál',category:'Ebéd',icon:'ebed',minutes:20,servings:2,favorite:true,description:'Ismerős ízek, jó arányok. Egy tál, ami elkísér a délutánba.',lines:[{id:'chicken',g:320},{id:'rice',g:360},{id:'broccoli',g:200}],steps:['Készítsd elő és mérd ki a hozzávalókat.','Készítsd el a csirkét és a rizst, párold meg a brokkolit.','Oszd két adagra, és tálald kedved szerint.']},
  {id:'oatbowl',name:'Áfonyás reggeli',category:'Reggeli',icon:'reggeli',minutes:5,servings:1,favorite:true,description:'Krémes joghurt, zab és egy marék áfonya. Egy lassabb reggelhez is.',lines:[{id:'oats',g:65},{id:'yogurt',g:150},{id:'berries',g:80}],steps:['Mérd ki a joghurtot és a zabot.','Keverd össze, majd tedd rá az áfonyát.']},
  {id:'salmonbowl',name:'Citromos lazactál',category:'Vacsora',icon:'vacsora',minutes:25,servings:2,favorite:false,description:'Meleg rizs, lazac és roppanós brokkoli. Egy nyugodt vacsora alapjai.',lines:[{id:'salmon',g:300},{id:'rice',g:360},{id:'broccoli',g:300}],steps:['Készítsd elő a hozzávalókat. A főtt rizst tedd félre.','Süsd készre a lazacot, közben párold meg a brokkolit.','Melegítsd át a rizst, majd tálald a hal és a zöldség mellé.']},
  {id:'snack',name:'Banán és mandula',category:'Kisétkezés',icon:'snack',minutes:2,servings:1,favorite:false,description:'Egy kis szünet két nagyobb étkezés között.',lines:[{id:'banana',g:120},{id:'almond',g:20}],steps:['Mérd ki a mandulát, és készíts mellé egy banánt.']},
 ];
 const meal = (id,recipe,time,date=TODAY) => ({id,name:recipe.name,time,date,slot:recipe.category,icon:recipe.icon,lines:recipe.lines.map(l=>({...l,g:l.g/recipe.servings})),score: id==='m1'?88:id==='m2'?92:81,source:'Recept'});
 return {version:2,pantry,recipes,meals:[meal('m1',recipes[1],'08:10'),meal('m2',recipes[0],'12:35'),meal('m3',recipes[3],'15:00'),meal('h1',recipes[1],'08:00','2026-09-08'),meal('h2',recipes[2],'19:00','2026-09-08')],water:{[TODAY]:1250,'2026-09-08':2250},goal:{title:'Erősebb, könnyebb forma',currentWeight:82,targetWeight:78,targetDate:'2026-12-15',maintenanceKcal:2300,dailyEnergyBalanceKcal:-200},workouts:[{id:'w1',date:TODAY,label:'Teljes test A',time:'17:30',kcal:350,loggedDates:[]}],settings:{fiber:30,water:2500,meals:4,cutoff:'14:00',profile:'Kiegyensúlyozott'},slots:[{name:'Reggeli',time:'08:00',share:25},{name:'Ebéd',time:'12:30',share:35},{name:'Kisétkezés',time:'15:00',share:15},{name:'Vacsora',time:'19:00',share:25}],stack:[{id:'s1',name:'D-vitamin',dose:'1 kapszula',time:'08:00',zone:'Reggelihez',taken:[TODAY],reason:'A mintaprotokollban a reggelihez kötött tétel.'},{id:'s2',name:'Kreatin',dose:'1 adag',time:'15:30',zone:'Délután',taken:[],reason:'A mentett mintaprotokoll délutáni eleme.'},{id:'s3',name:'Magnézium',dose:'1 kapszula',time:'21:00',zone:'Este',taken:[],reason:'A mintaprotokollban esti emlékeztetővel szerepel.'}],medications:[],shopping:[],plan:{},chat:[]};
}
export function nutrition(lines, pantry) {
 const result={kcal:0,p:0,c:0,f:0,fiber:0};
 for(const l of lines){const item=pantry.find(i=>i.id===l.id);if(!item)continue;for(const k of Object.keys(result))result[k]+=(Number(item[k])||0)*Number(l.g)/100;}
 return result;
}
export const plannedWorkout = (s,date=TODAY) => s.workouts.find(w=>w.date===date);
export const activityKcal = (s,date=TODAY) => s.workouts.filter(w=>w.loggedDates.includes(date)).reduce((sum,w)=>sum+Number(w.kcal),0);
export const baselineTarget = s => Number(s.goal.maintenanceKcal)+Number(s.goal.dailyEnergyBalanceKcal);
export const target = (s,date=TODAY) => baselineTarget(s)+activityKcal(s,date);
export function macroTargets(s,date=TODAY){
 const kcal=target(s,date),weight=Number(s.goal.currentWeight),proteinPerKg=s.settings.profile==='Fehérjehangsúlyos'?2.2:s.settings.profile==='Szénhidrát-hangsúlyos'?1.6:1.95;
 const p=Math.round(weight*proteinPerKg),f=Math.round(weight*.85),c=Math.max(0,Math.round((kcal-p*4-f*9)/4));
 return {kcal,p,c,f,fiber:Number(s.settings.fiber),water:Number(s.settings.water)};
}
export const mealsOn = (s,date) => s.meals.filter(m=>m.date===date).sort((a,b)=>a.time.localeCompare(b.time));
export const dayTotals = (s,date) => nutrition(mealsOn(s,date).flatMap(m=>m.lines),s.pantry);
export const portionLines = (recipe,servings=1) => recipe.lines.map(l=>({...l,g:l.g*servings/recipe.servings}));
export function saveMeal(s,draft) {
 if(!draft.name.trim()||!draft.lines.length||draft.lines.some(l=>!Number.isFinite(Number(l.g))||Number(l.g)<=0))throw Error('Adj nevet és legalább egy érvényes mennyiséget az étkezésnek.');
 const record={...clone(draft),id:draft.id||uid(),score:draft.score??84,source:draft.source||'Kézi'};
 const existing=s.meals.findIndex(m=>m.id===record.id);if(existing<0)s.meals.push(record);else s.meals[existing]=record;
 return record;
}
export function addShortages(s, recipe,servings=1){
 for(const line of portionLines(recipe,servings)){const item=s.pantry.find(p=>p.id===line.id);const missing=Math.max(0,line.g-Number(item?.stock||0));if(!missing)continue;const old=s.shopping.find(l=>l.id===line.id);if(old)old.g=Math.max(old.g,missing);else s.shopping.push({id:line.id,g:missing,done:false});}
}
export function toggleIntake(s,id,date=TODAY){const item=s.stack.find(i=>i.id===id);if(!item)return;item.taken=item.taken.includes(date)?item.taken.filter(d=>d!==date):[...item.taken,date];}
export function shiftDate(date,delta){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
export function load(storage){try{const saved=JSON.parse(storage.getItem(STORAGE));if((saved?.version===1||saved?.version===2)&&Array.isArray(saved.meals)&&Array.isArray(saved.pantry)){const fresh=createState();return {...fresh,...saved,version:2,goal:{...fresh.goal,...saved.goal},workouts:Array.isArray(saved.workouts)?saved.workouts:fresh.workouts,settings:{...fresh.settings,...saved.settings}};}}catch{}return createState();}
