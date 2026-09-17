import { RpgIcon as Icon } from "./RpgIcon.jsx";
import React, { useState } from "react";
import { BoopPet } from "./BoopIdentity.jsx";
import { FoodArt } from "./shared.jsx";
import { rpgStats, rpgRecords, RPG_ROLES } from "./rpg-model.mjs";
import {
  ModuleBadge,
  RankEmblem,
  DataRing,
  MuscleMap,
  MiniBars,
} from "./RpgVisuals.jsx";
import { EXERCISES } from "./flows/train-state.mjs";
import { recordPresenceCheckin } from "./presence-model.mjs";
import CompleteFlow from "./CompleteFlow.jsx";
import "./rpg.css";
const fmt = (n) => Math.round(n || 0).toLocaleString("hu-HU");
const Head = ({ label, title, action, onAction }) => (
  <div className="rpg-section-head">
    <div>
      {label && <span className="rpg-eyebrow">{label}</span>}
      <h2>{title}</h2>
    </div>
    {action && (
      <button onClick={onAction}>
        {action}
        <Icon name="arrow-right" size={16} />
      </button>
    )}
  </div>
);
const Action = ({
  children,
  onClick,
  secondary = false,
  icon = "arrow-right",
}) => (
  <button
    className={`rpg-action ${secondary ? "rpg-action-secondary" : ""}`}
    onClick={onClick}
  >
    {children}
    <Icon name={icon} size={19} />
  </button>
);
const Row = ({ icon = "arrow-up-right", title, detail, value, onClick }) => (
  <button className="rpg-data-row" onClick={onClick}>
    <span className="rpg-row-icon">
      <Icon name={icon} />
    </span>
    <span>
      <b>{title}</b>
      {detail && <small>{detail}</small>}
    </span>
    {value && <strong>{value}</strong>}
    <Icon name="chevron-right" size={16} />
  </button>
);
function XpStrip({ d }) {
  return (
    <div className="rpg-xp-strip">
      <span className="rpg-level">LVL {d.level}</span>
      <div>
        <div>
          <b>{d.xp} XP</b>
          <span>{d.next - d.current} a következő szintig</span>
        </div>
        <progress
          max="100"
          value={d.current}
          aria-label="Fejlődés a következő szintig"
        />
      </div>
    </div>
  );
}
export function RpgSidebar({ api }) {
  return (
    <>
      <a className="rpg-back-study" href="?v=boop#presence/home/today">
        ← Editorial változat
      </a>
      <span className="rpg-study-tag">BOOP / PLAY STUDY 02</span>
      <h1>
        Erő.
        <br />
        Energia.
        <br />
        <span>Fejlődés.</span>
      </h1>
      <p>
        A te adataid.
        <br />A következő szinted.
      </p>
      <div className="rpg-palette">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="rpg-side-note">
        Naplózz. Nézd a számokat.
        <br />
        Építs a saját eredményeidre.
      </p>
      <button onClick={api.reset}>
        Demó újrakezdése <Icon name="rotate" size={16} />
      </button>
      <button onClick={() => api.goFeature("core-index")}>
        Összes funkció <Icon name="layers" size={16} />
      </button>
      <small>Önálló mock mentés · a korábbi változat megmarad.</small>
    </>
  );
}
export function RpgRight({ api }) {
  const d = rpgStats(api.s);
  return (
    <>
      <span className="rpg-study-tag">VÁLASSZ MODULT</span>
      <div className="rpg-world-links">
        {Object.entries(RPG_ROLES).map(([id, r]) => (
          <button
            key={id}
            className={api.s.role === id ? "selected" : ""}
            onClick={() => api.navigate(id)}
          >
            <ModuleBadge role={id} />
            <span>{r.name}</span>
            <Icon name="arrow-up-right" size={17} />
          </button>
        ))}
      </div>
      <div className="rpg-side-level">
        <RankEmblem level={d.level} />
        <h3>Minden bejegyzés számít.</h3>
        <p>
          10 XP egy rögzítésért.
          <br />
          Az adatokból lesz fejlődési történet.
        </p>
      </div>
      <small>Demóadatok · szimulált AI</small>
    </>
  );
}
function Home({ api, d }) {
  return (
    <>
      <div className="rpg-date">
        <span>KEDD, SZEPTEMBER 8.</span>
        <span className="rpg-live-dot">DEMO</span>
      </div>
      <h1 className="rpg-page-title">Játékban vagy.</h1>
      <section className="rpg-command">
        <div className="rpg-command-copy">
          <span className="rpg-eyebrow">A SAJÁT PÁLYÁDON</span>
          <h2>
            Építs a<br />
            tegnapra.
          </h2>
          <p>
            {d.logged} megőrzött bejegyzés.
            <br />
            Egyre teljesebb kép.
          </p>
        </div>
        <RankEmblem level={d.level} />
        <XpStrip d={d} />
      </section>
      <div className="rpg-quick-actions">
        <button onClick={() => api.core.go("workout")}>
          <Icon name="dumbbell" />
          Edzés
        </button>
        <button onClick={() => api.goFeature("fuel-log")}>
          <Icon name="utensils" />
          Étkezés
        </button>
        <button onClick={() => api.goFeature("me-weight-log")}>
          <Icon name="scale" />
          Mérés
        </button>
      </div>
      <Head title="A mai állás" label="TE ADOD AZ ADATOT" />
      <div className="rpg-stat-pair">
        <button
          onClick={() => api.navigate("movement", "today")}
          className="rpg-small-stat blue"
        >
          <ModuleBadge role="movement" size={34} />
          <strong>
            {d.sessions}
            <small> / {d.cycle?.days.length || "—"}</small>
          </strong>
          <span>heti edzés</span>
          <div className="rpg-pips">
            {Array.from({ length: d.cycle?.days.length || 0 }, (_, i) => (
              <i key={i} className={i < d.sessions ? "on" : ""} />
            ))}
          </div>
        </button>
        <button
          onClick={() => api.navigate("fuel", "today")}
          className="rpg-small-stat orange"
        >
          <ModuleBadge role="fuel" size={34} />
          <strong>{fmt(Math.abs(d.remaining))}</strong>
          <span>{d.remaining<0?"kcal a keret fölött":"kcal maradt mára"}</span>
          <progress max={d.target} value={d.kcal} />
        </button>
      </div>
      <Head title="Következő lépés" />
      <Row
        title={
          api.s.full.session?.status === "active"
            ? "Edzés folytatása"
            : d.cycle?.days[0]?.name || "Saját edzés"
        }
        detail={
          d.cycle
            ? `${d.cycle.currentWeek}. hét · ${d.cycle.title}`
            : "Állíts össze egy saját edzést"
        }
        icon="dumbbell"
        onClick={() => api.core.go("workout")}
      />
      <Row
        title="Életcélok"
        detail={`${api.s.full.lifeGoals.filter((g) => g.status === "active").length} aktív cél · pillérek és haladás`}
        icon="target"
        onClick={() => api.goFeature("goals")}
      />
      <Row
        title="Életem · Booppal"
        detail="Check-in, napló és a személyes beszélgetés"
        icon="message"
        onClick={() => api.navigate("life", "today")}
      />
      <p className="rpg-footnote">
        Az XP a rögzítést jelzi. A teljesítményedet a saját adataid mutatják.
      </p>
    </>
  );
}
function Movement({ api, d }) {
  const c = d.cycle,
    groups = [
      ...new Set(
        c?.days.flatMap((day) =>
          day.exercises.map(
            (e) => EXERCISES.find((x) => x.id === e.id)?.muscle,
          ),
        ) || [],
      ),
    ].filter(Boolean);
  return (
    <>
      <div className="rpg-date">
        <span>MOZGÁS / EDZÉS + SPORT</span>
        <span className="rpg-tag">HYPERTROPHY</span>
      </div>
      <h1 className="rpg-page-title">Erőből építkezel.</h1>
      <section className="rpg-training-hero">
        <div>
          <span className="rpg-eyebrow">AKTÍV MEZOCIKLUS</span>
          <h2>{c?.title || "Új blokk indulhat"}</h2>
          <strong className="rpg-week-number">
            {c?.currentWeek || "—"}
            <small> / {c?.weeks || "—"} HÉT</small>
          </strong>
          <p>{c?.days.length || 0} edzésnap / hét</p>
        </div>
        <MuscleMap groups={groups} />
        <div className="rpg-week-path" aria-label="Mezociklus hetei">
          {Array.from({ length: c?.weeks || 0 }, (_, i) => (
            <button
              key={i}
              aria-label={`${i + 1}. hét részletei`}
              className={
                i + 1 === c.currentWeek
                  ? "current"
                  : i + 1 < c.currentWeek
                    ? "done"
                    : ""
              }
              onClick={() =>
                api.goFeature("train-cycle-week", {
                  id: c.id,
                  week: String(i + 1),
                })
              }
            >
              {i + 1 < c.currentWeek ? <Icon name="check" size={15} /> : i + 1}
            </button>
          ))}
        </div>
        <Action
          onClick={() =>
            c
              ? api.goFeature("train-cycle", { id: c.id })
              : api.goFeature("train-build")
          }
        >
          {c ? "Mezociklus megnyitása" : "Mezociklus építése"}
        </Action>
      </section>
      <div className="rpg-metric-row">
        <div>
          <strong>{d.sessions}</strong>
          <span>edzés / hét</span>
        </div>
        <div>
          <strong>{d.sets}</strong>
          <span>sorozat / hét</span>
        </div>
        <div>
          <strong>{fmt(d.volume)}</strong>
          <span>kg volumen / hét</span>
        </div>
      </div>
      <Head
        title="Indíts egy edzést"
        action="Napló"
        onAction={() => api.goFeature("train-gym")}
      />
      <section className="rpg-workout-ticket">
        <span className="rpg-ticket-icon">
          <Icon name="dumbbell" size={29} />
        </span>
        <div>
          <h3>
            {api.s.full.session?.status === "active"
              ? api.s.full.session.title
              : c?.days[0]?.name || "Saját edzés"}
          </h3>
          <p>
            {c?.days[0]?.exercises.length || 3} gyakorlat · kg / ismétlés / RIR
          </p>
        </div>
        <Action onClick={() => api.core.go("workout")}>
          {api.s.full.session?.status === "active"
            ? "Folytatom"
            : "Edzés indítása"}
        </Action>
      </section>
      <Head
        title="Saját rekordok"
        label="LEGNAGYOBB RÖGZÍTETT SÚLY"
        action="Mind"
        onAction={() => api.goFeature("train-exercises")}
      />
      <div className="rpg-records">
        {rpgRecords(api.s)
          .slice(0, 2)
          .map((e, i) => (
            <button
              key={e.id}
              onClick={() => api.goFeature("train-exercise", { id: e.id })}
            >
              <span className="rpg-record-medal">
                <Icon name="medal" size={22} />
              </span>
              <span>
                <small>
                  {e.name} · {e.source}
                </small>
                <strong>{e.best}</strong>
              </span>
              <Icon name="arrow-up-right" size={16} />
            </button>
          ))}
      </div>
      <Row
        title="Heti volumen"
        detail="Izomcsoportok és edzésnapok"
        value={`${d.sets} szett`}
        icon="chart"
        onClick={() =>
          api.goFeature(
            c ? "train-cycle-week" : "train-cycles",
            c ? { id: c.id, week: String(c.currentWeek) } : {},
          )
        }
      />
      <Row
        title="Sport és futás"
        detail="Naptár, terv és rögzített alkalmak"
        icon="run"
        onClick={() => api.navigate("movement", "sport")}
      />
      <Row
        title="Sablonok és lezárt blokkok"
        icon="layers"
        onClick={() => api.goFeature("train-templates")}
      />
    </>
  );
}
function Fuel({ api, d }) {
  const f = api.s.full,
    targets = f.fuel.targets;
  return (
    <>
      <div className="rpg-date">
        <span>KEDD, SZEPTEMBER 8.</span>
        <button onClick={() => api.goFeature("fuel-settings")}>
          <Icon name="settings" size={16} /> Célok
        </button>
      </div>
      <h1 className="rpg-page-title">Tankolj a napra.</h1>
      <section className="rpg-fuel-hero">
        <div className="rpg-energy-ring">
          <DataRing
            value={d.kcal}
            max={d.target}
            label={`${d.kcal} elfogyasztott kcal a ${d.target} kcal célból`}
            size={184}
          />
          <div>
            <span>{d.remaining < 0 ? "CÉL FÖLÖTT" : "MÉG BELEFÉR"}</span>
            <strong>{fmt(Math.abs(d.remaining))}</strong>
            <small>kcal</small>
          </div>
        </div>
        <div className="rpg-energy-sides">
          <span>
            <Icon name="utensils" />
            <b>{fmt(d.kcal)}</b>
            <small>elfogyasztva</small>
          </span>
          <span>
            <Icon name="activity" />
            <b>+{api.budget.sport}</b>
            <small>sportból</small>
          </span>
        </div>
        <div className="rpg-target-line">
          Napi cél <b>{fmt(d.target)} kcal</b>
          <button onClick={() => api.goFeature("fuel-settings")}>
            Módosítás ↗
          </button>
        </div>
      </section>
      <div className="rpg-macros">
        {[
          ["protein", "Fehérje"],
          ["carbs", "Szénhidrát"],
          ["fat", "Zsír"],
        ].map(([k, label]) => (
          <div key={k} className={k}>
            <span>{label}</span>
            <strong>
              {fmt(d.macros[k])}
              <small> / {targets[k]} g</small>
            </strong>
            <progress aria-label={`${label}: ${d.macros[k]} / ${targets[k]} g`} value={d.macros[k]} max={targets[k]} />
          </div>
        ))}
      </div>
      <Action onClick={() => api.goFeature("fuel-log")} icon="plus">
        Étkezés naplózása
      </Action>
      <Head
        title="A mai menü"
        action="Teljes napló"
        onAction={() => api.goFeature("fuel")}
      />
      <div className="rpg-meals">
        {!f.meals.length&&<p className="rpg-footnote">Még nincs mai étkezés. A naplózógombbal hozzáadhatod az elsőt.</p>}
        {f.meals.map((m) => (
          <button
            className="rpg-meal"
            key={m.id}
            onClick={() => api.goFeature("fuel-meal", { id: m.id })}
          >
            <span className="rpg-meal-art">
              <FoodArt kind={m.kind} />
            </span>
            <span>
              <small>
                {m.time} · {m.slot || "Étkezés"}
              </small>
              <b>{m.name}</b>
              <span>{m.protein} g fehérje</span>
            </span>
            <strong>
              {m.kcal}
              <small>kcal</small>
            </strong>
          </button>
        ))}
      </div>
      <section className="rpg-water">
        <span>
          <Icon name="droplet" size={24} />
          <b>{(f.water / 1000).toLocaleString("hu-HU")} / 2,5 l</b>
          <small>Víz</small>
        </span>
        <button
          aria-label="250 milliliter víz hozzáadása"
          onClick={() => {
            api.core.water();
            api.toast("+250 ml víz rögzítve");
          }}
        >
          +250 ml
        </button>
        <div>
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} className={i < f.water / 250 ? "filled" : ""} />
          ))}
        </div>
      </section>
      <div className="rpg-shortcut-pair">
        <button onClick={() => api.goFeature("fuel-recipes")}>
          <Icon name="chef" />
          Receptek ↗
        </button>
        <button onClick={() => api.goFeature("fuel-pantry")}>
          <Icon name="box" />
          Kamra ↗
        </button>
      </div>
    </>
  );
}
function Life({ api, d }) {
  const [note, setNote] = useState("");
  return (
    <>
      <div className="rpg-date">
        <span>ÉLETEM / BOOP</span>
        <span className="rpg-live-dot">ITT VAN</span>
      </div>
      <h1 className="rpg-page-title">Mi újság, Daniel?</h1>
      <section className="rpg-life-hero">
        <div>
          <span className="rpg-eyebrow">A TE AI TÁRSAD</span>
          <h2>
            Szia!
            <br />
            Mesélj a napodról.
          </h2>
          <button onClick={() => api.ask()}>
            Beszélgetés <Icon name="message" size={17} />
          </button>
        </div>
        <BoopPet />
      </section>
      <XpStrip d={d} />
      <Head
        title="Gyors check-in"
        label={`${api.s.checkins.length} MAI BEJELENTKEZÉS`}
      />
      <div className="rpg-mood-choices">
        {[
          ["good", "sun", "Jól vagyok"],
          ["busy", "activity", "Pörgős"],
          ["tired", "moon", "Fáradt"],
        ].map(([m, icon, t]) => (
          <button
            key={m}
            onClick={() => {
              api.setS((s) => recordPresenceCheckin(s, m, note));
              setNote("");
              api.celebrate();
              api.toast("Check-in rögzítve · +10 XP");
            }}
          >
            <Icon name={icon} size={24} />
            {t}
          </button>
        ))}
      </div>
      <label className="rpg-note-label">
        Egy mondat hozzá · opcionális
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Mi foglalkoztat most?"
        />
      </label>
      <Head title="A személyes tér" />
      <div className="rpg-life-links">
        {[
          [
            "book",
            "Napló és hála",
            "A saját szavaiddal",
            () => api.navigate("life", "journal"),
          ],
          [
            "target",
            "Életcélok",
            `${api.s.full.lifeGoals.filter((g) => g.status === "active").length} aktív cél`,
            () => api.goFeature("goals"),
          ],
          [
            "users",
            "Emberek",
            `${api.s.full.personal.people.length} kapcsolat`,
            () => api.goFeature("me-people"),
          ],
          [
            "rotate",
            "Rutinok",
            "Ami rendszeresen számít",
            () => api.goFeature("me-routines"),
          ],
        ].map(([icon, t, detail, go]) => (
          <button key={t} onClick={go}>
            <Icon name={icon} size={24} />
            <b>{t}</b>
            <small>{detail}</small>
            <Icon name="arrow-up-right" size={17} />
          </button>
        ))}
      </div>
      <Row
        title="Testem"
        detail={`${d.latestWeight ?? "—"} kg · ${d.latestSleep ? `${Math.floor(d.latestSleep.minutes / 60)} ó ${d.latestSleep.minutes % 60} p alvás` : "Nincs alvásadat"}`}
        icon="heart"
        onClick={() => api.navigate("life", "body")}
      />
      <Row
        title="Boop tudástára"
        detail="Minták, emlékek és amit rólad tud"
        icon="brain"
        onClick={() => api.navigate("understanding", "memory")}
      />
    </>
  );
}
export default function RpgScreen({ api, feature, coreApi, fallback }) {
  const tab = api.s.tabs[api.s.role],
    d = rpgStats(api.s);
  if (!feature) {
    if (api.s.role === "home")
      return (
        <div className="rpg-content">
          <Home api={api} d={d} />
        </div>
      );
    if (tab === "today" && api.s.role === "movement")
      return (
        <div className="rpg-content">
          <Movement api={api} d={d} />
        </div>
      );
    if (tab === "today" && api.s.role === "fuel")
      return (
        <div className="rpg-content">
          <Fuel api={api} d={d} />
        </div>
      );
    if (tab === "today" && api.s.role === "life")
      return (
        <div className="rpg-content">
          <Life api={api} d={d} />
        </div>
      );
  }
  return feature ? (
    <>
    {['patterns','knowledge','character','predictions'].includes(feature)&&<div className="rpg-analysis-band"><span className="rpg-analysis-signal"><Icon name="activity" size={19}/> ADATMODUL · DEMÓ</span><div><button onClick={()=>api.goFeature('patterns')}><strong>{api.s.full.insight.patterns.length}</strong><span>minta</span></button><button onClick={()=>api.goFeature('knowledge')}><strong>{api.s.full.insight.facts.filter(f=>f.enabled).length}</strong><span>aktív tény</span></button><button onClick={()=>api.goFeature('predictions')}><strong>{api.s.full.insight.predictions.length}</strong><span>előrejelzés</span></button></div></div>}
    <CompleteFlow page={feature} api={coreApi} visual="rpg" />
    </>
  ) : (
    fallback
  );
}
