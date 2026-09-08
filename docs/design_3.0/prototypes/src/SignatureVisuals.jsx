import React, { useEffect, useRef, useState } from 'react';
import { rhythmPoints, budgetFraction } from './signature-model.mjs';
import { BoopIcon } from './BoopIdentity.jsx';
import './signature.css';

export function RhythmArc({ labels, completed, title, selected, onSelect }) {
  const points = rhythmPoints(labels.length, completed);
  const previous = useRef(completed);
  const changed = previous.current !== completed;
  useEffect(() => { previous.current = completed; }, [completed]);
  return <div className="sig-rhythm" aria-label={title}>
    <svg viewBox="0 0 360 90" preserveAspectRatio="none" aria-hidden="true">
      <path className="sig-ghost" d="M28 78Q180 -16 332 78" />
      <path className="sig-track" d="M28 70Q180 -30 332 70" />
      {points.map((p, i) => <g key={i} className={`sig-point ${p.state} ${changed && i === completed - 1 ? 'arrived' : ''}`} style={{transformOrigin:`${p.x}px ${p.y}px`}}>
        {(p.state === 'current' || selected === i) && <circle className="sig-point-halo" cx={p.x} cy={p.y} r="12" />}
        <circle cx={p.x} cy={p.y} r={p.state === 'current' ? 7 : 5} />
        {p.state === 'done' && <path className="sig-tick" d={`M${p.x-2.5} ${p.y}l2 2 3.5-4`} />}
      </g>)}
    </svg>
    <div className="sig-rhythm-labels">{labels.map((label, i) => onSelect ? <button key={label} onClick={() => onSelect(i)} aria-pressed={selected === i} className={points[i].state}>{label}<small>{i < completed ? 'Lezárt' : i === completed ? 'Most' : 'Előtted'}</small></button> : <span key={label} className={points[i].state}>{label}<span className="sig-sr">{i < completed ? ', rögzítve' : i === completed ? ', következő' : ', később'}</span></span>)}</div>
  </div>;
}
export function CycleSignature({ cycle, onOpen }) {
  const [week, setWeek] = useState(cycle.week - 1);
  return <section className="sig-cycle sig-sculpted">
    <div className="sig-section-top"><span className="pr-eyebrow">A MUNKÁD ÍVE</span><BoopIcon name="layers" size={20} /></div>
    <h2>{cycle.name}</h2>
    <div className="sig-cycle-number"><strong>{cycle.week}<small> / {cycle.weeks}</small></strong><span>hét<br/>Hypertrophy</span></div>
    <RhythmArc labels={Array.from({length:cycle.weeks},(_,i)=>`${i+1}. hét`)} completed={cycle.week-1} selected={week} onSelect={setWeek} title={`Mezociklus: ${cycle.week}. hét a ${cycle.weeks} hétből`} />
    <p className="sig-week-detail" aria-live="polite"><b>{week + 1}. hét</b> · {week === cycle.week-1 ? `${cycle.session} · ma ${cycle.time}` : week < cycle.week-1 ? 'Lezárt hét · a program része' : 'A mezociklus következő szakasza'}</p>
    {onOpen && <button className="sig-text-button" onClick={onOpen}>A mezociklusom <BoopIcon name="arrow-right" size={17}/></button>}
  </section>;
}
export function FuelSignature({ budget, sportActive, onSport, onExplain }) {
  const [details, setDetails] = useState(false);
  const previousTarget = useRef(budget.target);
  const changed = previousTarget.current !== budget.target;
  useEffect(() => { previousTarget.current = budget.target; }, [budget.target]);
  return <section className={`sig-fuel sig-sculpted ${changed ? 'sig-updated' : ''}`}>
    <svg className="sig-surface-shape" viewBox="0 0 360 560" preserveAspectRatio="none" aria-hidden="true"><path d="M32 1H328Q359 1 359 32V190C359 210 341 214 341 230S359 250 359 270V518Q359 559 318 559H26Q1 559 1 534V270C1 250 19 246 19 230S1 210 1 190V32Q1 1 32 1Z"/></svg>
    <div className="sig-section-top"><span className="pr-eyebrow">AMIBŐL A MAI KERETED ÖSSZEÁLL</span><BoopIcon name="utensils" size={20}/></div>
    <div className="sig-sources">
      <div><BoopIcon name="sun" size={24}/><strong>{budget.base}</strong><span>alapkeret · kcal</span></div>
      <button onClick={onSport}><BoopIcon name="activity" size={24}/><strong>+{budget.sport}</strong><span>{sportActive ? 'mai röplabda' : 'sport elmaradt'} · kcal</span></button>
    </div>
    <svg className="sig-joining" viewBox="0 0 340 82" aria-hidden="true">
      <path className="sig-base-thread" d="M78 2C78 53 170 22 170 76"/>
      <path className={`sig-sport-thread ${sportActive ? '' : 'inactive'}`} d="M262 2C262 53 170 22 170 76"/>
      <circle cx="78" cy="3" r="3"/><circle cx="262" cy="3" r="3"/>
      <circle className="sig-join-halo" cx="170" cy="66" r="11"/><circle cx="170" cy="66" r="4"/>
    </svg>
    <div className="sig-budget" key={budget.target} aria-live="polite"><strong>{budget.target}</strong><span>kcal · mai cél</span></div>
    <div className="sig-budget-meter" role="img" aria-label={`${budget.logged} kcal naplózva, ${budget.remaining} kcal maradt`}><i style={{width:`${budgetFraction(budget.logged,budget.target)*100}%`}} /></div>
    <div className="sig-budget-labels"><span>{budget.logged} naplózva</span><b>{budget.remaining} maradt</b></div>
    <button className="sig-text-button" aria-expanded={details} onClick={()=>setDetails(!details)}>Hogyan kapcsolódik? <BoopIcon name="chevron-down" size={15}/></button>
    {details && <div className="sig-explanation"><p>A bemutató alapkeretéhez a tervezett sport {budget.sport} kcal-t ad. Ha a röplabda elmaradását átvezetjük, ez a rész is változik.</p><button className="sig-text-button" onClick={onExplain}>Beszéljük át Booppal <BoopIcon name="message" size={16}/></button></div>}
  </section>;
}
export function DayConnection({ cycle, budget, onMovement, onFuel }) {
  return <div className="sig-day-connection">
    <span className="pr-eyebrow">A NAPOD SZÁLAI ÖSSZEÉRNEK</span>
    <div className="sig-day-pair"><button onClick={onMovement}><BoopIcon name="dumbbell" size={23}/><strong>{cycle.session}</strong><small>{cycle.week}. hét · {cycle.time}</small></button><span className="sig-day-knot" aria-hidden="true"><i/><i/></span><button onClick={onFuel}><BoopIcon name="utensils" size={23}/><strong>{budget.target}<small> kcal</small></strong><small>étkezési keret</small></button></div>
    <p>A mai sport az étkezési keretedben is megjelenik.</p>
  </div>;
}
