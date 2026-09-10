import { icon,safe } from './nap.js';
import { dayDescriptor } from './day-navigation-state.js';
export {icon,safe};
export const fmt=(v,d=1)=>v==null?'—':Number(v).toLocaleString('hu-HU',{maximumFractionDigits:d});
export const duration=m=>`${Math.floor(m/60)} ó ${Math.round(m%60)} p`;
export const dateLabel=d=>new Date(d+'T12:00:00Z').toLocaleDateString('hu-HU',{month:'short',day:'numeric'});
export const head=(tag,title,copy,art='person')=>`<header class="mz-heading">${icon(art)}<span class="overline">${tag}</span><h1>${title}</h1><p>${copy}</p></header>`;
export const note=(text)=>`<div class="lf-note">${icon('chat')}<p>${text}</p></div>`;
export const section=(title,sub='')=>`<div class="lf-section"><h2>${title}</h2>${sub?`<small>${sub}</small>`:''}</div>`;
export const link=(art,title,sub,path)=>`<button class="lf-link" data-life="${path}">${icon(art)}<span><strong>${title}</strong><small>${sub}</small></span><b>↗</b></button>`;
export const action=(label,path,secondary=false)=>`<button class="lf-action ${secondary?'secondary':''}" data-life="${path}">${label} <span>↗</span></button>`;
export const submit=(label)=>`<p class="lf-error" role="alert" data-life-error></p><button class="lf-action" type="submit">${label} <span>✓</span></button>`;
export const stats=(items)=>`<div class="lf-stats">${items.map(([v,l])=>`<div><strong>${v}</strong><small>${l}</small></div>`).join('')}</div>`;
export const field=(label,name,value,type='text',attrs='')=>`<label class="lf-field">${label}<input name="${name}" type="${type}" value="${safe(value??'')}" ${attrs}></label>`;
export const area=(label,name,value='',placeholder='')=>`<label class="lf-field">${label}<textarea name="${name}" maxlength="4000" placeholder="${placeholder}">${safe(value)}</textarea></label>`;
export const select=(label,name,values,current)=>`<label class="lf-field">${label}<select name="${name}">${values.map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')}</select></label>`;
export const hero=(tag,value,unit,copy,art='ring')=>`<div class="lf-hero"><span class="overline">${tag}</span>${icon(art)}<div class="lf-number">${value}<small>${unit}</small></div><p>${copy}</p><div class="lf-orbit" aria-hidden="true"></div></div>`;
export const empty=(title,copy,path,label='Folytatom')=>`<div class="lf-empty">${icon('book')}<h2>${title}</h2><p>${copy}</p>${path?action(label,path,true):''}</div>`;
export const chips=(id,values,current)=>`<div class="lf-chips">${values.map(([v,l])=>`<button data-life-filter="${id}" data-value="${v}" aria-pressed="${v===current}">${l}</button>`).join('')}</div>`;
export const body=(text)=>`<div class="lf-prose">${safe(text).split('\n').map(t=>`<p>${t}</p>`).join('')}</div>`;
export const footer=`<p class="lf-footer">TITANIUM · INTERAKTÍV DEMÓ<br>Szeptember 9-i mintanap. Mintaadatok, előre megírt AI-szövegek. A változtatások újratöltéskor törlődnek.</p>`;
export function dayFrame(content,date,today,direction=''){
 const day=dayDescriptor(date,today),animation=direction?` day-enter-${direction}`:'';
 return `<section class="day-swipe-frame" data-day-swipe aria-label="${safe(day.label)} napi nézete"><nav class="day-navigator" aria-label="Napok közötti navigáció"><button data-day-shift="-1" aria-label="Előző nap">‹</button><label class="day-calendar" aria-label="Ugrás egy dátumra"><span aria-hidden="true"><i></i><i></i></span><input type="date" data-day-picker value="${date}" max="${today}" aria-label="Dátum kiválasztása"></label><div class="day-date" aria-live="polite"><small>${day.eyebrow}</small><strong>${safe(day.label)}</strong></div><button data-day-shift="1" aria-label="Következő nap" ${day.isToday?'disabled':''}>›</button></nav>${day.isToday?'':`<button class="day-back-today" data-day-today>Vissza mára <span>→</span></button>`}<div class="day-swipe-page${animation}">${content}</div><p class="day-swipe-hint"><span>←</span> Húzd oldalra a napváltáshoz <span>→</span></p></section>`;
}
export function chart(rows,key,unit){if(rows.length<2)return empty('Még kevés a mérés.','Legalább két adatból rajzolunk görbét.');const vals=rows.map(r=>r[key]),min=Math.min(...vals)-.2,max=Math.max(...vals)+.2;const points=vals.map((v,i)=>`${32+i*270/(vals.length-1)},${130-(v-min)/(max-min)*100}`).join(' ');return `<figure class="lf-chart"><svg viewBox="0 0 330 165" role="img" aria-label="${safe(unit)} mérések ${dateLabel(rows[0].date)} és ${dateLabel(rows.at(-1).date)} között"><path d="M32 30H305M32 80H305M32 130H305" stroke="#ffffff0d"/><text x="0" y="34">${fmt(max)}</text><text x="0" y="134">${fmt(min)}</text><polyline points="${points}" fill="none" stroke="var(--domain-color)" stroke-width="2.5" stroke-linejoin="round"/>${vals.map((v,i)=>`<circle cx="${32+i*270/(vals.length-1)}" cy="${130-(v-min)/(max-min)*100}" r="3" fill="var(--domain-color)"/>`).join('')}<text x="32" y="158">${dateLabel(rows[0].date)}</text><text x="248" y="158">${dateLabel(rows.at(-1).date)}</text></svg><figcaption>${unit} · naplózott mintamérések</figcaption><details><summary>Adatok szövegesen</summary>${rows.map(r=>`<p>${dateLabel(r.date)} · ${fmt(r[key])} ${unit}</p>`).join('')}</details></figure>`;}
