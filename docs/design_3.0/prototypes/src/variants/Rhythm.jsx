import React from "react";
import {
  Avatar,
  Chat,
  FoodArt,
  Icon,
  Sparkline,
  WorkoutArt,
} from "../shared.jsx";
import "./rhythm.css";

const weekdays = ["H", "K", "Sz", "Cs", "P", "Sz", "V"];

function Arrow({ diagonal = false }) {
  return <Icon name={diagonal ? "arrow-up-right" : "arrow-right"} size={18} />;
}

function SectionTitle({ eyebrow, title, action, onClick }) {
  return (
    <div className="r-section-heading">
      <div>
        {eyebrow && <span className="r-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="r-text-link" onClick={onClick}>
          {action}
          <Arrow />
        </button>
      )}
    </div>
  );
}

function Primary({ children, onClick, light = false }) {
  return (
    <button
      className={`r-primary${light ? " r-primary-light" : ""}`}
      onClick={onClick}
    >
      {children}
      <Arrow />
    </button>
  );
}

function Water({ api, compact = false }) {
  const amount = api.state.water;
  const percentage = Math.min(100, (amount / 2500) * 100);
  return (
    <section
      className={`r-water${compact ? " r-water-compact" : ""}`}
      aria-label="Folyadékbevitel"
    >
      <div className="r-water-icon">
        <Icon name="droplet" size={22} />
      </div>
      <div className="r-water-content">
        <div>
          <strong>Egy pohárnyi szünet</strong>
          <span>
            {(amount / 1000).toLocaleString("hu-HU", {
              maximumFractionDigits: 2,
            })}{" "}
            / 2,5 l
          </span>
        </div>
        <div className="r-water-track">
          <span style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <button
        className="r-water-add"
        onClick={api.water}
        aria-label="250 ml víz hozzáadása"
      >
        <Icon name="plus" size={18} />
        <span>250 ml</span>
      </button>
    </section>
  );
}

function Week({ api, expanded = false }) {
  return (
    <div className={`r-week${expanded ? " r-week-expanded" : ""}`}>
      <div className="r-week-days">
        {weekdays.map((day, i) => (
          <button
            className={`r-day${i === 1 ? " r-day-today" : ""}${[0, 1, 3].includes(i) ? " r-day-training" : ""}`}
            key={i}
            onClick={() => api.go(i === 1 ? "workout" : "week")}
            aria-label={`${day}, szeptember ${7 + i}. ${i === 1 ? "Mai edzés" : "Heti áttekintés"}`}
          >
            <span>{day}</span>
            <strong>{7 + i}</strong>
            <i>{i === 0 ? <Icon name="check" size={11} /> : <span />}</i>
          </button>
        ))}
      </div>
      {expanded && (
        <div className="r-week-caption">
          <span>
            <i /> Edzésnap
          </span>
          <span>3 alkalom · teret hagyva a pihenésnek</span>
        </div>
      )}
    </div>
  );
}

function Session({ api, train = false }) {
  const done = api.state.workoutFinished;
  return (
    <section className={`r-session${train ? " r-session-train" : ""}`}>
      <div className="r-session-orbit r-session-orbit-one" />
      <div className="r-session-orbit r-session-orbit-two" />
      <div className="r-session-copy">
        <span className="r-eyebrow">
          <span className="r-live-dot" />
          {done ? "Ma már tettél magadért" : "A következő jó lépés"}
        </span>
        <div className="r-session-time">
          <span>{done ? "Kész" : "17:30"}</span>
          <span>{done ? "Szép munka, Daniel." : "Erő · hát és bicepsz"}</span>
        </div>
        <h2>
          {done ? "Ezt ma beletetted." : "Pull Day"}
          {!done && <span>Erő, a saját ritmusodban.</span>}
        </h2>
        <p>
          {done
            ? "Az edzésed bekerült a naplódba. Jöhet a feltöltődés."
            : "4 gyakorlat · 12 sorozat · 45 perc"}
        </p>
        <Primary light onClick={() => api.go(done ? "week" : "workout")}>
          {done
            ? "Megnézem a hetem"
            : train
              ? "Kezdjük az edzést"
              : "Ráhangolódom"}
        </Primary>
      </div>
      <div className="r-session-art" aria-hidden="true">
        <WorkoutArt />
      </div>
    </section>
  );
}

function Home({ api }) {
  const daypart = api.state.daypart;
  const greeting =
    daypart === "morning"
      ? "Jó reggelt, Daniel."
      : daypart === "evening"
        ? "Lassan megérkezhetsz."
        : "Jó úton vagy, Daniel.";
  return (
    <div className="r-page r-home">
      <section className="r-intro">
        <span className="r-eyebrow">Kedd, szeptember 8.</span>
        <h1>{greeting}</h1>
        <p>Ma is elég egy jó lépés a következő felé.</p>
      </section>
      <div className="r-state-strip">
        <button onClick={() => api.go("sleep")}>
          <span className="r-state-label">
            <Icon name="moon" size={15} />
            Alvás
          </span>
          <strong>
            7<span>ó</span> 42<span>p</span>
          </strong>
          <span className="r-state-caption">Pihentető éjszaka</span>
        </button>
        <div className="r-state-divider" />
        <button onClick={() => api.go("routine")}>
          <span className="r-state-label">
            <Icon name="leaf" size={15} />
            Készenlét
          </span>
          <strong>
            82<span>/100</span>
          </strong>
          <span className="r-state-caption">Van miből építkezned</span>
        </button>
        <div className="r-mini-sun" aria-hidden="true">
          <svg viewBox="0 0 54 54">
            <path d="M8 43a19 19 0 0 1 38 0M4 49h46M27 5v9M7 15l7 7M47 15l-7 7M1 33h9M44 33h9" />
          </svg>
        </div>
      </div>
      <Session api={api} />
      <section className="r-day-path">
        <SectionTitle
          title="A napod fonala"
          action="Hetem"
          onClick={() => api.go("week")}
        />
        <div className="r-path-list">
          <button
            className="r-path-item r-path-complete"
            onClick={() => api.go("fuel")}
          >
            <div className="r-path-node">
              <Icon name="check" size={12} />
            </div>
            <span className="r-path-time">12:30</span>
            <div className="r-path-copy">
              <strong>Feltöltöttél.</strong>
              <span>Ebéd · csirkés Buddha-tál</span>
            </div>
            <Arrow />
          </button>
          <button
            className="r-path-item r-path-current"
            onClick={() =>
              api.go(api.state.routineDone ? "journal" : "routine")
            }
          >
            <div className="r-path-node">
              <span />
            </div>
            <span className="r-path-time">Most</span>
            <div className="r-path-copy">
              <strong>
                {api.state.routineDone
                  ? "Jó, hogy figyeltél magadra."
                  : "Hogy vagy, igazán?"}
              </strong>
              <span>
                {api.state.routineDone
                  ? "Mai bejelentkezés elmentve"
                  : "Egy perc figyelem magadnak"}
              </span>
            </div>
            <Arrow />
          </button>
          <button className="r-path-item" onClick={() => api.go("workout")}>
            <div className="r-path-node" />
            <span className="r-path-time">17:30</span>
            <div className="r-path-copy">
              <strong>
                {api.state.workoutFinished
                  ? "Az edzésed kész."
                  : "Mozgás, ami épít."}
              </strong>
              <span>Pull Day · 45 perc</span>
            </div>
            <Arrow />
          </button>
          <button
            className="r-path-item r-path-last"
            onClick={() => api.go("pattern")}
          >
            <div className="r-path-node" />
            <span className="r-path-time">Este</span>
            <div className="r-path-copy">
              <strong>Egy kis séta. Egy kis csend.</strong>
              <span>Neked ez gyakran jólesik</span>
            </div>
            <Arrow />
          </button>
        </div>
      </section>
      <Water api={api} compact />
      <button className="r-companion-note" onClick={() => api.go("mezo")}>
        <div className="r-note-avatar">
          <Avatar state="idle" size={82} />
        </div>
        <div>
          <span className="r-eyebrow">Mezo figyel rád</span>
          <p>„Az esti sétáid után mostanában hosszabban alszol.”</p>
          <span className="r-text-link">
            Nézzünk rá együtt <Arrow />
          </span>
        </div>
      </button>
    </div>
  );
}

const exercises = [
  { title: "Széles lehúzás", detail: "3 × 12", weight: "50 kg", shape: "pull" },
  { title: "Evezés csigán", detail: "3 × 12", weight: "45 kg", shape: "row" },
  { title: "Face pull", detail: "3 × 15", weight: "20 kg", shape: "face" },
  {
    title: "Bicepsz kézisúlyzóval",
    detail: "3 × 12",
    weight: "12 kg",
    shape: "curl",
  },
];

function ExerciseGlyph({ kind }) {
  return (
    <svg
      className="r-exercise-glyph"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="24" cy="11" r="4" />
      <path d="M24 17v15m0-1-9 12m9-12 9 12" />
      {kind === "pull" ? (
        <path d="m24 21-12-7V5m12 16 12-7V5M7 4h34" />
      ) : kind === "row" ? (
        <path d="m24 21-12 7m12-7 12 7M6 28h36M15 43h18" />
      ) : kind === "face" ? (
        <path d="m24 21-12-5-5 7m17-2 12-5 5 7M4 20v7m40-7v7" />
      ) : (
        <path d="m24 21-11 8-5-9m16 1 11 8 5-9M4 18h8m24 0h8" />
      )}
    </svg>
  );
}

function Train({ api }) {
  return (
    <div className="r-page r-train">
      <section className="r-intro">
        <span className="r-eyebrow">Mozgás, ami a tiéd</span>
        <h1>Ma az erődön a sor.</h1>
        <p>Jó alapokról indulsz. Építsünk rá.</p>
      </section>
      <div className="r-readiness">
        <span className="r-readiness-number">
          82<span>/100</span>
        </span>
        <div>
          <strong>A tested készen áll.</strong>
          <p>7 óra 42 perc alvás után.</p>
        </div>
        <button
          className="r-round-button"
          onClick={() => api.go("sleep")}
          aria-label="Regeneráció és alvás részletei"
        >
          <Arrow diagonal />
        </button>
      </div>
      <Session api={api} train />
      <section className="r-exercises">
        <SectionTitle eyebrow="A mai terv" title="Négy gyakorlat. Egy irány." />
        <div className="r-exercise-list">
          {exercises.map((exercise, i) => (
            <button
              className="r-exercise"
              key={exercise.title}
              onClick={() => api.go("workout")}
            >
              <span className="r-exercise-index">0{i + 1}</span>
              <ExerciseGlyph kind={exercise.shape} />
              <div>
                <strong>{exercise.title}</strong>
                <span>
                  {exercise.detail}
                  <i />
                  {exercise.weight}
                </span>
              </div>
              <Icon name="chevron-right" size={17} />
            </button>
          ))}
        </div>
        <p className="r-editorial-note">
          Nem kell sietned. A sorozatok között is történik valami.
        </p>
      </section>
      <section className="r-week-section">
        <SectionTitle
          title="A hét ritmusa"
          action="Megnézem"
          onClick={() => api.go("week")}
        />
        <Week api={api} expanded />
      </section>
      <button className="r-progress-note" onClick={() => api.go("week")}>
        <div className="r-progress-copy">
          <span className="r-eyebrow">A sok kicsi összeadódik</span>
          <h3>Erősebb, hétről hétre.</h3>
          <p>{api.state.workoutFinished ? 4 : 3} edzés ezen a héten</p>
        </div>
        <Sparkline
          values={[24, 31, 28, 42, 38, 48, 57]}
          color="#687963"
          height={57}
        />
        <Arrow />
      </button>
    </div>
  );
}

function EnergyArc({ percent }) {
  return (
    <svg
      className="r-energy-arc"
      viewBox="0 0 320 130"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 116a140 100 0 0 1 280 0"
        pathLength="100"
        className="r-energy-base"
      />
      <path
        d="M20 116a140 100 0 0 1 280 0"
        pathLength="100"
        strokeDasharray={`${Math.max(0, Math.min(100, percent))} 100`}
        className="r-energy-progress"
      />
      <path d="M44 116h232" className="r-energy-ground" />
      <circle cx="160" cy="116" r="4" fill="currentColor" />
    </svg>
  );
}

function Fuel({ api }) {
  const macros = [
    {
      name: "Fehérje",
      value: api.nutrition.protein,
      goal: 160,
      className: "protein",
    },
    {
      name: "Szénhidrát",
      value: api.nutrition.carbs,
      goal: 270,
      className: "carbs",
    },
    { name: "Zsír", value: api.nutrition.fat, goal: 76, className: "fat" },
  ];
  return (
    <div className="r-page r-fuel">
      <section className="r-intro">
        <span className="r-eyebrow">Tápláld a napod</span>
        <h1>Jólesően egyensúlyban.</h1>
      </section>
      <section className="r-energy">
        <span className="r-eyebrow">Ennyi fér még a mai napba</span>
        <div className="r-energy-number">
          {Math.max(0, api.remaining).toLocaleString("hu-HU")}
          <span>kcal</span>
        </div>
        <div className="r-energy-visual">
          <EnergyArc percent={(api.nutrition.kcal / 2400) * 100} />
          <span className="r-energy-consumed">
            {api.nutrition.kcal.toLocaleString("hu-HU")}
            <small>elfogyasztva</small>
          </span>
          <span className="r-energy-target">
            2400<small>napi cél</small>
          </span>
        </div>
        <div className="r-macros">
          {macros.map((m) => (
            <div className={`r-macro r-macro-${m.className}`} key={m.name}>
              <span>{m.name}</span>
              <strong>
                {m.value}
                <small> / {m.goal} g</small>
              </strong>
              <div className="r-macro-track">
                <i
                  style={{
                    width: `${Math.min(100, (m.value / m.goal) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <Primary onClick={() => api.go("meal")}>
        <span className="r-button-label">
          <Icon name="plus" size={19} />
          Étkezés hozzáadása
        </span>
      </Primary>
      <section className="r-meals">
        <SectionTitle eyebrow="Ami ma feltöltött" title="Az asztalodnál" />
        <div className="r-meal-list">
          {api.state.meals.map((meal, i) => (
            <button
              className="r-meal"
              key={meal.id}
              onClick={() => api.go("meal")}
            >
              <div className={`r-food r-food-${i % 3}`}>
                <FoodArt kind={meal.kind || (i === 0 ? "oats" : "bowl")} />
              </div>
              <div className="r-meal-copy">
                <span className="r-meal-time">
                  {meal.time} ·{" "}
                  {i === 0
                    ? "Reggeli"
                    : i === 1
                      ? "Ebéd"
                      : i === 2
                        ? "Uzsonna"
                        : "Étkezés"}
                </span>
                <h3>{meal.name}</h3>
                <p>
                  <strong>{meal.kcal} kcal</strong>
                  <i />
                  {meal.protein} g fehérje
                </p>
              </div>
              <Icon name="chevron-right" size={16} />
            </button>
          ))}
        </div>
      </section>
      <Water api={api} />
      <button className="r-dinner" onClick={() => api.go("meal")}>
        <div>
          <span className="r-eyebrow">És mi legyen este?</span>
          <h3>
            Valami egyszerű.
            <br />
            Valami, ami feltölt.
          </h3>
          <span className="r-text-link">
            Vacsoraötletet kérek <Arrow />
          </span>
        </div>
        <div className="r-dinner-food">
          <FoodArt kind="salmon" />
        </div>
      </button>
    </div>
  );
}

function Mezo({ api }) {
  return (
    <div className="r-page r-mezo">
      <section className="r-companion-intro">
        <div className="r-companion-title">
          <span className="r-eyebrow">A társad a hétköznapokban</span>
          <h1>
            Egyre jobban
            <br />
            értelek.
          </h1>
          <p>
            Apró részletekből
            <br />
            áll össze a te történeted.
          </p>
        </div>
        <button
          className="r-avatar-button"
          onClick={() => api.go("avatar")}
          aria-label="Mezo megjelenésének és hangulatainak felfedezése"
        >
          <div className="r-avatar-orbit" />
          <Avatar state="idle" size={152} />
          <span>
            Ismerj meg <Arrow diagonal />
          </span>
        </button>
      </section>
      <Primary onClick={() => api.go("chat")}>Beszélgessünk egy kicsit</Primary>
      <section className="r-synthesis">
        <SectionTitle eyebrow="A mai képed" title="Ezt látom most benned." />
        <div className="r-synthesis-row">
          <span className="r-synthesis-symbol">
            <Icon name="moon" size={19} />
          </span>
          <p>
            <strong>Volt időd feltöltődni.</strong> A 7 óra 42 perc alvás jó
            alap a mai naphoz.
          </p>
        </div>
        <div className="r-synthesis-row">
          <span className="r-synthesis-symbol">
            <Icon name="dumbbell" size={19} />
          </span>
          <p>
            <strong>
              {api.state.workoutFinished
                ? "Megérkeztél az edzés végére."
                : "Ma jöhet egy kis építkezés."}
            </strong>{" "}
            {api.state.workoutFinished
              ? "Egy újabb lépés, ami már a történeted része."
              : "A Pull Day mellé estére hagyj helyet a pihenésnek is."}
          </p>
        </div>
        <div className="r-synthesis-row">
          <span className="r-synthesis-symbol">
            <Icon name="utensils" size={19} />
          </span>
          <p>
            <strong>A feltöltődés is a nap része.</strong> Eddig{" "}
            {api.nutrition.protein} g fehérjét naplóztál a 160 g-os célodból.
          </p>
        </div>
      </section>
      <button className="r-pattern" onClick={() => api.go("pattern")}>
        <div className="r-pattern-top">
          <span className="r-eyebrow">
            <Icon name="sparkles" size={14} />
            Egy apró összefüggés
          </span>
          <Arrow diagonal />
        </div>
        <h2>
          Az esti sétáid
          <br />
          elkísérnek az álmodba.
        </h2>
        <div className="r-pattern-evidence">
          <strong>
            +34<span>perc</span>
          </strong>
          <p>
            átlagosan ennyivel
            <br />
            hosszabb alvás
          </p>
          <svg viewBox="0 0 88 50" aria-hidden="true">
            <path d="M2 39c8 0 7-12 16-12s5 8 14 8 8-16 16-16 8 5 15 5S72 8 86 5" />
            <circle cx="86" cy="5" r="3" />
          </svg>
        </div>
        <div className="r-pattern-bottom">
          <span>12 megfigyelt nap · együttjárás, nem ok-okozat</span>
          <strong>
            {api.state.patternConfirmed
              ? "Visszajelzésed elmentve"
              : "Nézzük meg közelebbről"}{" "}
            <Arrow />
          </strong>
        </div>
      </button>
      <button className="r-week-story" onClick={() => api.go("week")}>
        <span className="r-eyebrow">Heti levél tőlem</span>
        <h2>
          Van egy ritmus,
          <br />
          ami már a tiéd.
        </h2>
        <p>
          {api.state.workoutFinished ? 4 : 3} edzés. 18,4 kilométer. És sok apró
          döntés, amivel magad mellé álltál.
        </p>
        <div className="r-week-story-footer">
          <span>Elolvasom a hetem</span>
          <div className="r-round-button">
            <Arrow />
          </div>
        </div>
        <svg className="r-story-plant" viewBox="0 0 90 130" aria-hidden="true">
          <path d="M45 128C39 93 49 55 46 13M45 91C20 96 8 77 12 58c21-1 32 12 33 33Zm1-34c22 1 34-16 31-33-21 0-31 14-31 33Z" />
        </svg>
      </button>
      <section className="r-memory">
        <SectionTitle title="Ami neked fontos" />
        <p>Az apró megjegyzéseid segítenek, hogy a nagyobb képet is lássam.</p>
        <button className="r-memory-entry" onClick={() => api.go("journal")}>
          <span className="r-memory-icon">
            <Icon name="book" size={20} />
          </span>
          <div>
            <strong>Egy gondolat a mai napból</strong>
            <span>Hely a saját szavaidnak</span>
          </div>
          <Arrow />
        </button>
        <button className="r-memory-entry" onClick={() => api.go("goals")}>
          <span className="r-memory-icon">
            <Icon name="target" size={20} />
          </span>
          <div>
            <strong>Amerre tartasz</strong>
            <span>A céljaid, a saját tempódban</span>
          </div>
          <Arrow />
        </button>
      </section>
    </div>
  );
}

export default function Rhythm({ page, api }) {
  if (page === "chat")
    return (
      <div className="r-page r-chat">
        <Chat api={api} />
      </div>
    );
  if (page === "train") return <Train api={api} />;
  if (page === "fuel") return <Fuel api={api} />;
  if (page === "mezo") return <Mezo api={api} />;
  return <Home api={api} />;
}
