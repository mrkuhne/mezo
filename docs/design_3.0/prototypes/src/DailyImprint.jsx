import React, { useState } from 'react';
import { imprintWeek, imprintKinds } from './imprint-model.mjs';
import { ContourSurface } from './ContourSurface.jsx';
import { BoopIcon } from './BoopIdentity.jsx';
import './imprint.css';
export function ImprintArt({events,large=false}) {
 return <svg className={`imprint-art ${large?'large':''}`} viewBox="0 0 160 160" role="img" aria-label={events.length?`${events.filter(e=>!e.planned).length} rögzített és ${events.filter(e=>e.planned).length} tervezett esemény lenyomata`:'Még nincs bejegyzés'}>
   <ellipse className="imprint-guide" cx="80" cy="80" rx="57" ry="50" transform="rotate(-22 80 80)"/>
   <ellipse className="imprint-guide inner" cx="80" cy="80" rx="44" ry="60" transform="rotate(28 80 80)"/>
   {events.map((e,i)=>{const angle=i*2.399, radius=28+(i%3)*10,x=80+Math.cos(angle)*radius,y=80+Math.sin(angle)*radius;return <g key={e.id} style={{color:imprintKinds[e.kind].color}} className={e.planned?'imprint-planned':''}>
    <path className="imprint-thread" d={`M80 80Q${x} 80 ${x} ${y}`}/>
    {e.kind==='checkin'?<circle cx={x} cy={y} r="6"/>:e.kind==='journal'?<rect x={x-4} y={y-10} width="8" height="20" rx="4" transform={`rotate(-25 ${x} ${y})`}/>:e.kind==='gratitude'?<path d={`M${x} ${y-8}Q${x+2} ${y-2} ${x+8} ${y}Q${x+2} ${y+2} ${x} ${y+8}Q${x-2} ${y+2} ${x-8} ${y}Q${x-2} ${y-2} ${x} ${y-8}Z`}/>:<path className="imprint-movement" d={`M${x-9} ${y+5}Q${x-9} ${y-10} ${x+6} ${y-8}Q${x+13} ${y-2} ${x+7} ${y+7}`}/>}
   </g>})}
   <circle className="imprint-center" cx="80" cy="80" r="3"/>
 </svg>;
}
export function DailyImprint({state,compact=false,onOpen,onJournal}) {
 const [selected,setSelected]=useState(1),[eventId,setEventId]=useState(null);
 const days=imprintWeek(state),day=days[compact?1:selected];
 if(compact) return <button className="imprint-preview" onClick={onOpen}>
   <ImprintArt events={day.events}/><span><small>A MAI LENYOMATOD</small><strong>Így áll össze a napod.</strong><span>{day.events.filter(e=>!e.planned).length} rögzített pillanat · nézd meg a heted</span></span><BoopIcon name="arrow-up-right" size={18}/>
 </button>;
 return <section className="imprint-week">
   <div className="imprint-heading"><span className="pr-eyebrow">SZEPTEMBER 7–13. · MINTAHÉT</span><p>Minden jel egy pillanat, amit idehoztál.</p></div>
   <div className="imprint-days" role="group" aria-label="Válassz napot">{days.map((d,i)=><button key={d.name} className={d.future?'future':''} aria-label={`${d.name}, szeptember ${d.date}${d.today?', ma':''}`} aria-pressed={selected===i} onClick={()=>{setSelected(i);setEventId(null)}}><span>{d.short}</span><ImprintArt events={d.events}/><small>{d.date}{d.today?' · ma':''}</small></button>)}</div>
   <div className="imprint-detail sig-sculpted">
    <ContourSurface variant="reflection"/>
    <div className="imprint-day-heading"><strong>{day.today?'Ma':day.name}</strong><span>SZEPTEMBER {day.date}.</span></div>
    <ImprintArt events={day.events} large/>
    <p className="imprint-caption">{day.future?'Ennek a napnak még nincs lenyomata.':day.fixture?'Hétfői bemutató · előre megírt események.':'A mentett pillanataid és ami még előtted van.'}</p>
    {!day.future && <div className="imprint-legend">{Object.entries(imprintKinds).map(([id,k])=><span key={id} style={{color:k.color}}><i className={`imprint-key-${id}`}/>{k.label}</span>)}</div>}
    {!!day.events.length && <p className="imprint-hint">Válassz egy eseményt az eredeti bejegyzéshez.</p>}
    <div className="imprint-events">{day.events.map(e=><React.Fragment key={e.id}><button aria-expanded={eventId===e.id} onClick={()=>setEventId(eventId===e.id?null:e.id)}><i style={{background:imprintKinds[e.kind].color}}/><span><strong>{e.title}</strong><small>{e.time}{e.planned?' · tervezett':''}</small></span><BoopIcon name="chevron-down" size={14}/></button>{eventId === e.id && <div className="imprint-source" role="status"><span className="pr-eyebrow">{e.planned ? "A TERVEDBŐL" : "A BEJEGYZÉSED"}</span><p>{e.detail}</p></div>}</React.Fragment>)}</div>

    {day.today && <button className="sig-text-button" onClick={onJournal}>Hozzáteszek a napomhoz <BoopIcon name="book" size={17}/></button>}
   </div>
   <p className="imprint-footnote">A szaggatott jelek tervek. A lenyomat a rögzített történetedet mutatja, nem a napodat pontozza.</p>
 </section>;
}
