import React from "react";
import { Avatar, Chat, FoodArt, Icon, Sparkline } from "../shared.jsx";
import "./measure.css";

const number = (value) => new Intl.NumberFormat("hu-HU").format(value);

function SectionHead({ index, title, action, onClick }) {
  return (
    <div className="m-section-head">
      <div>
        <span className="m-index">{index}</span>
        <h2>{title}</h2>
      </div>
      {action && (
        <button className="m-text-link" onClick={onClick}>
          {action}
          <Icon name="arrow-up-right" size={15} />
        </button>
      )}
    </div>
  );
}

function Action({ children, onClick, light = false, icon = "arrow-right" }) {
  return (
    <button
      className={`m-action ${light ? "m-action-light" : ""}`}
      onClick={onClick}
    >
      <span>{children}</span>
      <Icon name={icon} size={19} />
    </button>
  );
}

function Meter({ value = 82, label = "Regeneráció" }) {
  return (
    <div
      className="m-meter"
      role="img"
      aria-label={`${label}: ${value} százalék`}
    >
      {Array.from({ length: 32 }, (_, i) => (
        <i key={i} className={(i / 32) * 100 < value ? "is-filled" : ""} />
      ))}
    </div>
  );
}

function TrainingGraphic() {
  return (
    <svg
      className="m-training-graphic"
      viewBox="0 0 180 180"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="m-weight-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#c5c6bd" />
          <stop offset=".52" stopColor="#666960" />
          <stop offset="1" stopColor="#d5d6cd" />
        </linearGradient>
      </defs>
      <g transform="rotate(-30 90 90)">
        <path d="M35 90h110" stroke="#8e9189" strokeWidth="12" />
        <ellipse cx="54" cy="90" rx="29" ry="51" fill="#3b3d37" />
        <ellipse
          cx="46"
          cy="90"
          rx="27"
          ry="51"
          fill="url(#m-weight-gradient)"
        />
        <ellipse
          cx="46"
          cy="90"
          rx="18"
          ry="36"
          fill="none"
          stroke="#e0e0d5"
          strokeOpacity=".5"
        />
        <ellipse cx="46" cy="90" rx="6" ry="11" fill="#2a2c25" />
        <ellipse cx="138" cy="90" rx="29" ry="51" fill="#3b3d37" />
        <ellipse
          cx="130"
          cy="90"
          rx="27"
          ry="51"
          fill="url(#m-weight-gradient)"
        />
        <ellipse
          cx="130"
          cy="90"
          rx="18"
          ry="36"
          fill="none"
          stroke="#e0e0d5"
          strokeOpacity=".5"
        />
        <ellipse cx="130" cy="90" rx="6" ry="11" fill="#2a2c25" />
      </g>
    </svg>
  );
}

function WorkoutPanel({ api, large = false }) {
  const done = api.state.workoutFinished;
  return (
    <section className={`m-workout-panel ${large ? "m-workout-large" : ""}`}>
      <div className="m-workout-top">
        <span className="m-kicker">
          {done ? "Mai edzés · teljesítve" : "Következő edzés"}
        </span>
        <span className="m-time-chip">
          <span />
          17:30
        </span>
      </div>
      <div className="m-workout-body">
        <div>
          <h2>
            Pull Day<span>.</span>
          </h2>
          <p>Hát. Bicepsz. Egy kicsit erősebben.</p>
          <div className="m-workout-stats">
            <span>
              <b>45</b> perc
            </span>
            <span>
              <b>4</b> gyakorlat
            </span>
            <span>
              <b>12</b> sorozat
            </span>
          </div>
        </div>
        <TrainingGraphic />
      </div>
      <Action
        light
        onClick={() => api.go("workout")}
        icon={done ? "check" : "play"}
      >
        {done ? "Edzés összegzése" : "Edzés indítása"}
      </Action>
    </section>
  );
}

function Water({ api, compact = false }) {
  const amount = api.state.water;
  return (
    <section className={`m-water ${compact ? "m-water-compact" : ""}`}>
      <div className="m-water-label">
        <Icon name="droplet" size={19} />
        <span>Folyadék</span>
        <span className="m-muted">{Math.round((amount / 2500) * 100)}%</span>
      </div>
      <div className="m-water-main">
        <div>
          <strong>
            {(amount / 1000).toLocaleString("hu-HU", {
              maximumFractionDigits: 2,
            })}
          </strong>
          <span> / 2,5 l</span>
        </div>
        <button onClick={api.water} aria-label="250 milliliter víz hozzáadása">
          <Icon name="plus" size={17} />
          250 ml
        </button>
      </div>
      <div className="m-liquid-track">
        <span style={{ width: `${Math.min(100, (amount / 2500) * 100)}%` }} />
      </div>
    </section>
  );
}

function WeekBars({ api }) {
  const values = [57, 82, 28, 68, 43, 92, 36];
  return (
    <button
      className="m-week-reading"
      onClick={() => api.go("week")}
      aria-label="Heti áttekintés megnyitása"
    >
      <div className="m-week-copy">
        <span className="m-kicker">A hét eddig</span>
        <strong>Jó ritmusban.</strong>
        <span>
          <b>{api.state.workoutFinished ? 4 : 3}</b> edzés <i /> <b>18,4</b> km
        </span>
        <span className="m-week-goal">
          {api.state.workoutFinished
            ? "4/4 edzés · heti cél elérve"
            : "3/4 edzés · heti cél"}
          <i>
            <b style={{ width: api.state.workoutFinished ? "100%" : "75%" }} />
          </i>
        </span>
        <span className="m-week-link">
          Heti áttekintés <Icon name="arrow-up-right" size={16} />
        </span>
      </div>
      <div className="m-bars" aria-hidden="true">
        {values.map((height, i) => (
          <div key={i}>
            <i
              className={i === 1 ? "is-today" : ""}
              style={{ height: `${height}%` }}
            />
            <span>{["H", "K", "S", "C", "P", "S", "V"][i]}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function Home({ api }) {
  const evening = api.state.daypart === "evening";
  return (
    <div className="m-page m-home">
      <section className="m-readiness">
        <div className="m-intro-line">
          <span className="m-kicker">
            {evening ? "Esti állapot" : "A tested ma"}
          </span>
          <span className="m-status-dot">Jó egyensúly</span>
        </div>
        <div className="m-readiness-main">
          <div>
            <h1>{evening ? "Szép munka mára." : "Készen állsz."}</h1>
            <p>
              {evening
                ? "Most jöhet egy nyugodtabb ritmus."
                : "A pihenésed most erőt ad."}
            </p>
          </div>
          <button
            className="m-recovery-value"
            onClick={() => api.go("sleep")}
            aria-label="Regeneráció 82 a 100-ból, részletek"
          >
            <strong>82</strong>
            <span>/100</span>
          </button>
        </div>
        <Meter />
        <div className="m-meter-legend">
          <span>REGENERÁCIÓ</span>
          <span>+6 az előző naphoz</span>
        </div>
        <div className="m-vitals">
          <button onClick={() => api.go("sleep")}>
            <span>
              <Icon name="moon" size={15} />
              Alvás
            </span>
            <strong>
              7<span>ó</span> 42<span>p</span>
            </strong>
            <small>+14 perc a heti átlaghoz</small>
          </button>
          <button onClick={() => api.go("goals")}>
            <span>
              <Icon name="heart" size={15} />
              Nyugalmi pulzus
            </span>
            <strong>
              54<span> bpm</span>
            </strong>
            <small>A megszokott tartományban</small>
          </button>
        </div>
      </section>

      <WorkoutPanel api={api} />

      <section className="m-day-route">
        <SectionHead index="01" title="A napod vonala" />
        <button className="m-route-row" onClick={() => api.go("routine")}>
          <span
            className={`m-route-marker ${api.state.routineDone ? "is-done" : ""}`}
          >
            <Icon name={api.state.routineDone ? "check" : "sun"} size={17} />
          </span>
          <span>
            <strong>
              {api.state.routineDone
                ? "Reggeli ráhangolódás kész"
                : "Egy perc magadra"}
            </strong>
            <small>
              {api.state.routineDone
                ? "Jó alap a mai naphoz."
                : "Hogy érzed magad a számok mögött?"}
            </small>
          </span>
          <Icon name="arrow-up-right" size={19} />
        </button>
        <button className="m-route-row" onClick={() => api.go("meal")}>
          <span className="m-route-marker">
            <Icon name="utensils" size={17} />
          </span>
          <span>
            <strong>Üzemanyag a délutánhoz</strong>
            <small>Még {number(api.remaining)} kcal a napi célodig.</small>
          </span>
          <Icon name="arrow-up-right" size={19} />
        </button>
        <button className="m-route-row" onClick={() => api.go("pattern")}>
          <span className="m-route-marker">
            <Icon name="moon" size={17} />
          </span>
          <span>
            <strong>20:30 · Egy esti séta?</strong>
            <small>Mezo szerint érdemes megfigyelned.</small>
          </span>
          <Icon name="arrow-up-right" size={19} />
        </button>
      </section>

      <Water api={api} compact />

      <button className="m-companion-note" onClick={() => api.go("mezo")}>
        <div className="m-note-avatar">
          <Avatar size={74} />
        </div>
        <div>
          <span className="m-kicker">Mezo megfigyelése</span>
          <p>A jó napjaid már este elkezdődnek.</p>
          <span>
            Nézzük meg a mintázatot <Icon name="arrow-right" size={15} />
          </span>
        </div>
      </button>
      <WeekBars api={api} />
    </div>
  );
}

function Train({ api }) {
  const days = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
  return (
    <div className="m-page m-train">
      <div className="m-page-intro">
        <span className="m-kicker">Mozgás, ami épít</span>
        <h1>
          Minden ismétlés
          <br />
          hozzád tesz.
        </h1>
      </div>
      <div className="m-week-strip">
        <div className="m-week-strip-title">
          <span>Szeptember 7–13.</span>
          <button className="m-text-link" onClick={() => api.go("week")}>
            Heted
            <Icon name="arrow-up-right" size={15} />
          </button>
        </div>
        <div className="m-days">
          {days.map((day, i) => (
            <button
              onClick={() => api.go(i === 1 ? "workout" : "week")}
              className={i === 1 ? "is-current" : ""}
              key={day}
            >
              <span>{day}</span>
              <strong>{7 + i}</strong>
              <i
                className={
                  i === 0 || i === 1 || i === 3 || i === 5 ? "is-training" : ""
                }
              >
                {i === 0 ? <Icon name="check" size={10} /> : null}
              </i>
            </button>
          ))}
        </div>
      </div>
      <WorkoutPanel api={api} large />
      <section>
        <SectionHead
          index="01"
          title="Ma erre építünk"
          action="Teljes terv"
          onClick={() => api.go("workout")}
        />
        <div className="m-exercises">
          {[
            {
              name: "Széles lehúzás",
              type: "Hát · széles fogás",
              sets: "3 × 12",
              weight: "50 kg",
            },
            {
              name: "Evezés csigán",
              type: "Hát · semleges fogás",
              sets: "3 × 12",
              weight: "45 kg",
            },
            {
              name: "Face pull",
              type: "Hátsó váll · kontrollált",
              sets: "3 × 15",
              weight: "20 kg",
            },
          ].map((exercise, i) => (
            <button
              key={exercise.name}
              className="m-exercise-row"
              onClick={() => api.go("workout")}
            >
              <span className="m-exercise-number">0{i + 1}</span>
              <span>
                <strong>{exercise.name}</strong>
                <small>{exercise.type}</small>
              </span>
              <span>
                <strong>{exercise.sets}</strong>
                <small>{exercise.weight}</small>
              </span>
              <Icon name="chevron-right" size={15} />
            </button>
          ))}
        </div>
      </section>
      <section className="m-progression">
        <SectionHead
          index="02"
          title="Lassan. Biztosan."
          action="Részletek"
          onClick={() => api.go("goals")}
        />
        <div className="m-progress-copy">
          <div>
            <span className="m-kicker">Evezés · munkasúly</span>
            <strong>
              45<span> kg</span>
            </strong>
          </div>
          <span className="m-positive">
            <Icon name="arrow-up-right" size={14} />
            12,5%<small>az elmúlt 6 hétben</small>
          </span>
        </div>
        <div className="m-chart-grid">
          <Sparkline
            values={[32, 32, 35, 35, 40, 40, 40, 42, 42, 45]}
            color="#d4472d"
            height={96}
          />
        </div>
        <div className="m-chart-labels">
          <span>AUG. 03.</span>
          <span>SZEPT. 08.</span>
        </div>
      </section>
      <button className="m-last-session" onClick={() => api.go("week")}>
        <span className="m-session-icon">
          <Icon name="dumbbell" size={21} />
        </span>
        <span>
          <span className="m-kicker">Legutóbb · hétfő</span>
          <strong>Push Day</strong>
          <small>48 perc · 12 sorozat · 4 820 kg</small>
        </span>
        <Icon name="arrow-up-right" size={20} />
      </button>
    </div>
  );
}

function Fuel({ api }) {
  const { nutrition } = api;
  const macros = [
    {
      label: "Fehérje",
      value: nutrition.protein,
      target: 160,
      color: "m-protein",
    },
    {
      label: "Szénhidrát",
      value: nutrition.carbs,
      target: 280,
      color: "m-carbs",
    },
    { label: "Zsír", value: nutrition.fat, target: 80, color: "m-fat" },
  ];
  return (
    <div className="m-page m-fuel">
      <section className="m-energy">
        <div className="m-intro-line">
          <span className="m-kicker">Mai bevitel</span>
          <button className="m-text-link" onClick={() => api.go("goals")}>
            Célok
            <Icon name="arrow-up-right" size={15} />
          </button>
        </div>
        <div className="m-energy-value">
          <strong>{number(nutrition.kcal)}</strong>
          <span>kcal</span>
        </div>
        <div className="m-energy-sub">
          <span>
            a <b>2 400</b> kcal célodból
          </span>
          <span>
            <b>{number(api.remaining)}</b> van még
          </span>
        </div>
        <Meter
          value={Math.min(100, (nutrition.kcal / 2400) * 100)}
          label="Napi energiabevitel"
        />
        <div className="m-macros">
          {macros.map((macro) => (
            <div className={macro.color} key={macro.label}>
              <span>{macro.label}</span>
              <strong>
                {Math.round(macro.value)}
                <small> / {macro.target} g</small>
              </strong>
              <div>
                <i
                  style={{
                    width: `${Math.min(100, (macro.value / macro.target) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <Action onClick={() => api.go("meal")} icon="plus">
          Étkezés hozzáadása
        </Action>
      </section>
      <section className="m-meals">
        <SectionHead
          index="01"
          title="A mai tányérod"
          action={`${api.state.meals.length} étkezés`}
          onClick={() => api.go("meal")}
        />
        {api.state.meals.map((meal, i) => (
          <button
            className="m-meal"
            onClick={() => api.go("meal")}
            key={meal.id}
          >
            <span className="m-meal-art">
              <FoodArt kind={meal.kind || (i === 0 ? "oats" : "bowl")} />
            </span>
            <span className="m-meal-info">
              <span className="m-kicker">
                {meal.time} <span>·</span>{" "}
                {i === 0
                  ? "Reggeli"
                  : i === 1
                    ? "Ebéd"
                    : i === 2
                      ? "Uzsonna"
                      : "Étkezés"}
              </span>
              <strong>{meal.name}</strong>
              <small>{meal.protein} g fehérje</small>
            </span>
            <span className="m-meal-kcal">
              <strong>{meal.kcal}</strong>
              <span>kcal</span>
            </span>
          </button>
        ))}
      </section>
      <Water api={api} />
      <section className="m-dinner">
        <div className="m-dinner-copy">
          <span className="m-kicker">Az estédhez</span>
          <h2>
            Jó edzés.
            <br />
            Jó vacsora.
          </h2>
          <p>Egy fehérjében gazdag tányér a Pull Day után.</p>
          <button className="m-text-link" onClick={() => api.go("meal")}>
            Vacsoraötletek
            <Icon name="arrow-up-right" size={17} />
          </button>
        </div>
        <div className="m-dinner-art">
          <FoodArt kind="salmon" />
        </div>
      </section>
      <button className="m-subtle-row" onClick={() => api.go("week")}>
        <span>
          <Icon name="chart" size={18} />
          Étkezési ritmusod a héten
        </span>
        <Icon name="arrow-up-right" size={18} />
      </button>
    </div>
  );
}

function SleepAssociation() {
  return (
    <div
      className="m-association-chart"
      role="img"
      aria-label="A 12 megfigyelt napból az esti sétás napokon átlagosan 34 perccel hosszabb volt az alvás"
    >
      <div>
        <span>Séta nélkül</span>
        <i style={{ width: "70%" }} />
        <strong>7ó 08p</strong>
      </div>
      <div>
        <span>Esti sétával</span>
        <i className="m-walk-bar" style={{ width: "85%" }} />
        <strong>7ó 42p</strong>
      </div>
    </div>
  );
}

function Mezo({ api }) {
  return (
    <div className="m-page m-mezo">
      <section className="m-mezo-intro">
        <div>
          <span className="m-kicker">
            <i className="m-live-dot" />A személyes nézőpontod
          </span>
          <h1>
            Összeáll
            <br />a kép.
          </h1>
          <p>
            Nem csak számokat látok.
            <br />A köztük lévő kapcsolatot is.
          </p>
        </div>
        <button
          className="m-mezo-avatar"
          onClick={() => api.go("avatar")}
          aria-label="Mezo megjelenésének személyre szabása"
        >
          <Avatar size={154} />
          <span>
            <Icon name="settings" size={13} />
          </span>
        </button>
      </section>
      <section className="m-synthesis">
        <div className="m-synthesis-top">
          <span className="m-kicker">A mai összkép</span>
          <span className="m-small-date">SZEPT. 08.</span>
        </div>
        <p>
          Jól aludtál, a regenerációd erős. Ma van tér a terhelésnek — és este a
          lelassulásnak is.
        </p>
        <button className="m-text-link" onClick={() => api.go("chat")}>
          Beszéljük át a napod
          <Icon name="arrow-right" size={17} />
        </button>
      </section>
      <section className="m-pattern">
        <SectionHead index="01" title="Egy apró összefüggés" />
        <div className="m-pattern-title">
          <h2>
            Több séta.
            <br />
            Hosszabb alvás.
          </h2>
          <div>
            <strong>+34</strong>
            <span>perc alvás</span>
          </div>
        </div>
        <SleepAssociation />
        <p>
          Az esti sétás napjaidon átlagosan tovább aludtál. Együttjárás, amit
          érdemes figyelni.
        </p>
        <div className="m-pattern-bottom">
          <span>12 megfigyelt nap</span>
          <button onClick={() => api.go("pattern")}>
            Nézzük meg
            <Icon name="arrow-up-right" size={17} />
          </button>
        </div>
      </section>
      <section className="m-memory">
        <SectionHead index="02" title="Amit együtt tanulunk" />
        <button className="m-memory-row" onClick={() => api.go("journal")}>
          <span className="m-memory-mark">Aa</span>
          <span>
            <strong>A saját szavaiddal</strong>
            <small>A naplód ad mélységet a számoknak.</small>
          </span>
          <Icon name="arrow-up-right" size={18} />
        </button>
        <button className="m-memory-row" onClick={() => api.go("pattern")}>
          <span className="m-memory-mark">
            <Icon name="activity" size={21} />
          </span>
          <span>
            <strong>
              {api.state.patternConfirmed
                ? "Megerősített megfigyelés"
                : "Alakuló mintázataid"}
            </strong>
            <small>Alvás, mozgás, közérzet — összekötve.</small>
          </span>
          <Icon name="arrow-up-right" size={18} />
        </button>
      </section>
      <WeekBars api={api} />
      <Action onClick={() => api.go("chat")}>Van valami a fejedben?</Action>
    </div>
  );
}

export default function Measure({ page, api }) {
  if (page === "train") return <Train api={api} />;
  if (page === "fuel") return <Fuel api={api} />;
  if (page === "mezo") return <Mezo api={api} />;
  if (page === "chat")
    return (
      <div className="m-chat-page">
        <Chat api={api} />
      </div>
    );
  return <Home api={api} />;
}
