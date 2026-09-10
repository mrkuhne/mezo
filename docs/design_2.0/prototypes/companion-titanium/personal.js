import {createPersonal,saveWeight,saveSleep,saveEntry,archiveEntry,reviewDecision,saveMoment,toggleRoutine,closeDay,saveWater,undoWater} from './personal-state.js';
import {mePage,journalRows} from './me-pages.js';
import {dayPage} from './day-pages.js';
import {footer,safe} from './life-ui.js';
import {closeSheet,toast,react,currentDaypart} from './nap.js';
import {foodSnapshot} from './food.js';
import {workoutSnapshot} from './workout.js';
let state=createPersonal(),callbacks;
const makeUI=()=>({weightPeriod:'14',journalFilter:'all',journalQuery:'',entryKind:'note',journalDraft:'',chatDraft:'',part:currentDaypart()});
let ui=makeUI();
const labels={me:['Áttekintés','Súly','Alvás','Napló'],nap:['Mai','Beszélgetés','Rutin','Napzárás']};
const external=()=>({food:foodSnapshot(),workout:workoutSnapshot()});
export function personalDetail(){const [d,,v]=location.hash.slice(1).split('/');return (d==='me'||d==='nap')&&!!v;}
export function personalContent(domain,page,selectedDate=state.date){if(!labels[domain])return null;const [,,view='',id='']=location.hash.slice(1).split('/');ui.part=currentDaypart();return `<div class="mezo-world life-world ${domain==='nap'?'life-day':'life-me'} ${state.settings.quiet?'life-quiet':''}">${view?`<button class="lf-back" data-life="${domain}/${page}">‹ ${labels[domain][page]}</button>`:''}${(domain==='me'?mePage:dayPage)(state,page,view,id,ui,external(),selectedDate)}${footer}</div>`;}
export function openPersonalJournal(text=''){ui.journalDraft=text;ui.entryKind='note';go('me/3/entry-new');}
function go(path){closeSheet();if(location.hash==='#'+path)callbacks.refresh();else location.hash='#'+path;}
function refresh(message='Megőriztem a demóban.'){callbacks.refresh();toast(message);react('connect',1800);}
const required=(text,message)=>{if(!String(text||'').trim())throw new Error(message);return text.trim();};
export function initPersonal(options){callbacks=options;
 document.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el)return;
  const legacy={profile:'me/0/profile',sleep:'me/2',journal:'me/3/entry-new',intention:'nap/0/intention',routine:'nap/2',checkin:'nap/0/checkin',ritual:'nap/3',needs:'nap/0/signals',messages:'nap/1',train:'train/0',fuel:'fuel/0',quick:'nap/0/quick'};
  if(el.id==='quick-add'||legacy[el.dataset.open]||el.hasAttribute('data-weight')){event.preventDefault();event.stopImmediatePropagation();go(el.id==='quick-add'?'nap/0/quick':el.hasAttribute('data-weight')?'me/1/weight-log':legacy[el.dataset.open]);return;}
 },true);
 document.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el)return;const d=el.dataset;
  if(d.life){if(d.life==='me/3/entry-edit/day-close'){go('nap/3/close-edit');return;}go(d.life);}
  if(d.lifeFilter){ui[d.lifeFilter]=d.value;callbacks.refresh();}
  if(d.lifeWater){saveWater(state,Number(d.lifeWater));refresh('Egy pohárral több figyelem magadra.');}
  if(el.hasAttribute('data-life-water-undo')){undoWater(state);refresh('Az utolsó saját poharat visszavontam.');}
  if(d.lifeHabit){if(toggleRoutine(state,d.lifeHabit))refresh('A rutinod frissült.');}
  if(d.lifePause){const r=state.routines.find(x=>x.id===d.lifePause);if(r){r.paused=!r.paused;refresh(r.paused?'Most pihen ez a lépés.':'Újra helye van a rutinodban.');}}
  if(d.lifeArchive){archiveEntry(state,d.lifeArchive,d.value==='true');refresh(d.value==='true'?'Archívumba került. Visszaállíthatod.':'Visszaállítottam a bejegyzést.');}
  if(d.lifeGoal){const g=state.goals.find(x=>x.id===d.lifeGoal);if(g){g.status=g.status==='active'?'paused':'active';refresh();}}
  if(d.lifeSetting){state.settings[d.lifeSetting]=!state.settings[d.lifeSetting];refresh('Demópreferencia frissítve.');}
  if(d.lifeIntention){document.querySelector('[data-life-form=intention] textarea').value=d.lifeIntention;}
  if(d.lifePrompt){ui.chatDraft=d.lifePrompt;const field=document.querySelector('[data-life-form=chat] textarea');field.value=d.lifePrompt;field.focus();}
  if(el.hasAttribute('data-life-save-message')){const m=state.messages[Number(d.lifeSaveMessage)];if(m&&!m.saved){saveEntry(state,{kind:'note',date:state.date,text:m.text});m.saved=true;refresh('A saját mondatod a Naplóba került.');}}
 });
 document.addEventListener('input',e=>{const t=e.target;if(t.dataset.lifeRange)document.querySelector(`[data-life-output="${t.dataset.lifeRange}"]`).value=t.value+' / 10';if(t.dataset.lifeSearch==='journal'){ui.journalQuery=t.value;document.querySelector('#life-journal-results').innerHTML=journalRows(state,ui);}if(t.closest('[data-life-form=entry]')&&t.name==='text'&&!t.closest('form').dataset.id)ui.journalDraft=t.value;if(t.closest('[data-life-form=chat]')&&t.name==='text')ui.chatDraft=t.value;});
 document.addEventListener('submit',e=>{const form=e.target,type=form.dataset.lifeForm;if(!type)return;e.preventDefault();const f=new FormData(form),val=k=>String(f.get(k)||''),num=k=>Number(f.get(k));let path='';
  try{
   if(type==='weight'){const date=val('date');saveWeight(state,{date,kg:num('kg'),note:val('note')});path='me/1/weight-day/'+date;}
   if(type==='sleep'){const date=val('date');saveSleep(state,{date,bed:val('bed'),wake:val('wake'),awake:num('awake'),quality:num('quality'),factors:f.getAll('factors'),note:val('note')});path='me/2/sleep-night/'+date;}
   if(type==='entry'){const id=saveEntry(state,{id:form.dataset.id||undefined,kind:form.dataset.kind,date:val('date'),text:val('text'),due:val('due')});ui.journalDraft='';path='me/3/entry/'+id;}
   if(type==='decision-review')reviewDecision(state,form.dataset.id,required(val('text'),'Írd le, hogyan alakult a döntés.'));
   if(type==='weight-goal'){const v=num('target');if(!Number.isFinite(v)||v<20||v>400)throw new Error('20 és 400 kg közötti célt adj meg.');state.weightGoal=v;}
   if(type==='sleep-goal'){const hours=num('hours');if(!Number.isFinite(hours)||hours<1||hours>16)throw new Error('Ellenőrizd az alváscél értékét.');state.sleepGoal=hours*60;state.bedGoal=val('bed');}
   if(type==='profile'){state.profile={name:required(val('name'),'Adj meg egy megszólítást.'),height:num('height'),bio:val('bio').trim()};}
   if(type==='goal'){const g={title:required(val('title'),'Adj nevet a célnak.'),why:required(val('why'),'Írd le, miért fontos.'),step:required(val('step'),'Mi legyen a következő lépés?')};const old=state.goals.find(x=>x.id===form.dataset.id);if(old)Object.assign(old,g);else{const id='goal-'+state.next++;state.goals.push({id,...g,status:'active'});path='me/0/goal/'+id;}}
   if(type==='person-note'){const p=state.people.find(x=>x.id===form.dataset.id);if(p)p.mentions.push('Ma · '+required(val('text'),'Írj egy említést.'));}
   if(type==='moment'){saveMoment(state,form.dataset.id,{energy:num('energy'),stress:num('stress'),body:num('body'),mind:num('mind'),note:val('note')});path='nap/0/checkin';}
   if(type==='water')saveWater(state,num('ml'));
   if(type==='intention')state.intention=required(val('text'),'Írj egy mondatnyi irányt.');
   if(type==='habit'){const values={name:required(val('name'),'Adj nevet a lépésnek.'),part:val('part'),anchor:required(val('anchor'),'Mi után következzen?'),why:val('why').trim()};const r=state.routines.find(x=>x.id===form.dataset.id);if(r)Object.assign(r,values);else{const id='habit-'+state.next++;state.routines.push({id,...values,done:false,paused:false});path='nap/2/habit/'+id;}}
   if(type==='close'){closeDay(state,{keep:val('keep').trim(),release:val('release').trim(),tomorrow:val('tomorrow').trim()});path='nap/3/close-summary';}
   if(type==='chat'){const text=required(val('text'),'Írj egy gondolatot Mezonak.');const normalized=text.toLocaleLowerCase('hu');let reply='Ezt a gondolatodat megőrizheted a naplóban, vagy választhatsz a témák közül. Ebben a demóban nem értelmezem szabadon az üzenetet; egy valódi beszélgetés helyét próbáljuk ki.',target='me/3/entry-new',label='Megnyitom a naplómat';if(/fárad|farad|stressz/.test(normalized)){reply='Megállhatunk egy pillanatra. Jelezd, hogy vagy most, aztán egymás mellé tudjuk tenni a saját megélésedet, az alvásodat és a mai tervet. Ez előre megírt demóválasz.';target='nap/0/checkin';label='Jelzem, hogy vagyok';}else if(/edzés|edzes/.test(normalized)){reply='A mai tervet és a már logolt terhelést egymás mellett találod. Nyissuk meg, és onnan dönthetsz az indításról. Ez előre megírt demóválasz.';target='train/1';label='Nézzük meg a terhelést';}else if(/letesz|leten|napot|alud/.test(normalized)){reply='Ami ma fontos volt, maradhat. Ami ráér, azt leteheted. A napzárásban a saját szavaiddal hagyhatod a napot. Ez előre megírt demóválasz.';target='nap/3';label='Leteszem a napot';}state.messages.push({text,reply,path:target,label,saved:false});ui.chatDraft='';}
   if(path)go(path);else callbacks.refresh();toast(type==='close'?'A mai nap a helyén. Jó pihenést.':'Megőriztem a demóban.');react('connect',2000);
  }catch(error){const target=form.querySelector('[data-life-error]');target.textContent=error.message;target.scrollIntoView({block:'nearest'});}
 });
 document.addEventListener('mezo:day-render',()=>{ui.part=currentDaypart();callbacks.refresh();});
 document.querySelector('#restart').addEventListener('click',()=>{state=createPersonal();ui=makeUI();callbacks.refresh();});
}

export function personalArrival(domain){const name=state.profile.name;const part=currentDaypart();if(domain==='me')return {greeting:'A te ritmusod, '+name+'.',copy:'Súly, alvás, mozgás. Az egész történetet nézzük, együtt.'};if(domain!=='nap')return null;return part==='reggel'?{greeting:'Jó reggelt, '+name+'.',copy:'Adjunk irányt a napnak. A többi jön lépésenként.'}:part==='este'?{greeting:'Megérkeztél, '+name+'.',copy:state.closing?'A mai nap a helyén. Most már jöhet a pihenés.':'Ami ma belefért, az már a tiéd. A többit letehetjük holnapig.'}:{greeting:'Jó itt folytatni, '+name+'.',copy:'A délelőtt mögötted. Beszéljük át, mi fér ma bele.'};}

export const personalInitial=()=>state.profile.name.trim().slice(0,1).toLocaleUpperCase('hu');
