import React from "react";
import { Avatar, Chat, FoodArt, Icon, Sparkline } from "../shared.jsx";
import "./grove.css";

function Terrain({ kind = "day" }) {
  const lift = kind === "train";
  return (
    <svg
      className={`g-terrain g-terrain-${kind}`}
      viewBox="0 0 400 330"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient
          id={`g-land-${kind}`}
          x1="200"
          y1="120"
          x2="200"
          y2="330"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#55765c" stopOpacity=".4" />
          <stop offset="1" stopColor="#11291f" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`g-glow-${kind}`}>
          <stop stopColor="#d2ed93" stopOpacity=".17" />
          <stop offset="1" stopColor="#d2ed93" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx={lift ? 270 : 215}
        cy="120"
        rx="160"
        ry="150"
        fill={`url(#g-glow-${kind})`}
      />
      <path
        d={
          lift
            ? "M-30 305C52 305 60 274 90 243S160 235 204 192S229 110 285 88S349 91 434 7V350H-30Z"
            : "M-25 229C44 181 66 231 123 207S203 138 261 173S357 227 432 136V350H-25Z"
        }
        fill={`url(#g-land-${kind})`}
      />
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={
            lift
              ? `M-35 ${310 + i * 14}C52 ${310 + i * 13} 60 ${276 + i * 11} 90 ${244 + i * 10}S160 ${237 + i * 9} 204 ${193 + i * 9}S229 ${109 + i * 13} 285 ${88 + i * 12}S349 ${91 + i * 16} 434 ${7 + i * 22}`
              : `M-25 ${229 + i * 15}C44 ${181 + i * 16} 66 ${231 + i * 13} 123 ${207 + i * 13}S203 ${138 + i * 17} 261 ${173 + i * 16}S357 ${227 + i * 10} 432 ${136 + i * 16}`
          }
          stroke="#a5bb94"
          strokeOpacity={i === 0 ? ".48" : ".13"}
          strokeWidth={i === 0 ? "1.2" : ".7"}
        />
      ))}
      <path
        d={
          lift
            ? "M-10 302C90 289 107 284 177 223S199 140 278 98"
            : "M-10 244C67 185 84 274 177 220S243 190 321 222S379 172 410 178"
        }
        stroke="#d6ec9a"
        strokeWidth="1.5"
        strokeDasharray="2 5"
      />
      <circle cx={lift ? 278 : 177} cy={lift ? 98 : 220} r="5" fill="#e0efb6" />
      <circle
        cx={lift ? 278 : 177}
        cy={lift ? 98 : 220}
        r="12"
        stroke="#d6ec9a"
        strokeOpacity=".3"
      />
    </svg>
  );
}

function SectionTitle({ children, detail, onClick }) {
  return (
    <div className="g-section-title">
      <h2>{children}</h2>
      {onClick ? (
        <button className="g-text-action" onClick={onClick}>
          {detail}
          <Icon name="arrow-up-right" size={16} />
        </button>
      ) : (
        detail && <span>{detail}</span>
      )}
    </div>
  );
}

function Primary({ children, onClick, icon = "arrow-right", className = "" }) {
  return (
    <button className={`g-primary ${className}`} onClick={onClick}>
      <span>{children}</span>
      <Icon name={icon} size={19} />
    </button>
  );
}

function Water({ api }) {
  return (
    <section className="g-water">
      <div className="g-water-top">
        <span className="g-small-label">
          <Icon name="droplet" size={15} /> Folyadék
        </span>
        <span className="g-muted">2,5 l cél</span>
      </div>
      <div className="g-water-bottom">
        <div>
          <strong>
            {(api.state.water / 1000).toLocaleString("hu-HU", {
              maximumFractionDigits: 2,
            })}
            <small> l</small>
          </strong>
          <div className="g-water-level" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className={
                  i < Math.floor(api.state.water / 250) ? "is-filled" : ""
                }
              />
            ))}
          </div>
        </div>
        <button
          className="g-water-add"
          onClick={api.water}
          aria-label="250 ml víz hozzáadása"
        >
          <Icon name="plus" size={18} />
          <span>250 ml</span>
        </button>
      </div>
    </section>
  );
}

function Home({ api }) {
  const evening = api.state.daypart === "evening";
  return (
    <div className="g-page g-home">
      <section className="g-dayland">
        <Terrain />
        <div className="g-day-intro">
          <div className="g-overline">
            <span className="g-live-dot" /> A TE TEMPÓDBAN
          </div>
          <h1>
            {evening ? "Lassan megérkezünk." : "Jó helyen vagy,"}
            <br />
            {evening ? <em>önmagadhoz.</em> : <em>Daniel.</em>}
          </h1>
          <p>
            {evening
              ? "A napodnak most már csend is jár."
              : "Ma van miből építkezned."}
          </p>
        </div>
        <button
          className="g-land-avatar"
          aria-label="Beszélgetés Mezóval"
          onClick={() => api.go("chat")}
        >
          <Avatar size={152} />
          <span>Veled vagyok.</span>
        </button>
        <button
          className="g-land-stat g-land-sleep"
          onClick={() => api.go("sleep")}
        >
          <Icon name="moon" size={16} />
          <strong>
            7<small>ó</small> 42<small>p</small>
          </strong>
          <span>Pihentető éjszaka</span>
        </button>
        <button
          className="g-land-stat g-land-recovery"
          onClick={() => api.go("goals")}
        >
          <span className="g-recovery-dot" />
          <strong>
            82<small>/100</small>
          </strong>
          <span>Regeneráció</span>
        </button>
        <div className="g-horizon-caption">
          <span>REGGEL</span>
          <span>
            MOST <i />
          </span>
          <span>ESTE</span>
        </div>
      </section>

      <section className="g-next">
        <div className="g-next-head">
          <span className="g-small-label">
            <Icon name="dumbbell" size={17} />{" "}
            {api.state.workoutFinished ? "Mai edzés kész" : "A következő lépés"}
          </span>
          <span className="g-muted">17:30</span>
        </div>
        <div className="g-next-title">
          <div>
            <h2>
              {api.state.workoutFinished ? "Szép munka, Daniel." : "Pull Day"}
            </h2>
            <p>
              {api.state.workoutFinished
                ? "A pihenés is része az építkezésnek."
                : "Hát és bicepsz · 45 perc · 4 gyakorlat"}
            </p>
          </div>
          <span className="g-session-glyph">
            <Icon
              name={api.state.workoutFinished ? "check" : "activity"}
              size={32}
            />
          </span>
        </div>
        <Primary
          onClick={() =>
            api.go(api.state.workoutFinished ? "train" : "workout")
          }
          icon={api.state.workoutFinished ? "arrow-right" : "play"}
        >
          {api.state.workoutFinished ? "Edzés összegzése" : "Kezdjük az edzést"}
        </Primary>
      </section>

      <section className="g-daypath">
        <SectionTitle detail="Egy kis irány, semmi sietség">
          A napod ösvénye
        </SectionTitle>
        <button className="g-path-item" onClick={() => api.go("routine")}>
          <span
            className={`g-path-node ${api.state.routineDone ? "is-done" : ""}`}
          >
            <Icon name={api.state.routineDone ? "check" : "sun"} size={17} />
          </span>
          <span>
            <strong>
              {api.state.routineDone
                ? "Magadra hangolódtál"
                : "Egy perc magadra"}
            </strong>
            <small>
              {api.state.routineDone
                ? "A mai bejelentkezés kész"
                : "Hogy érzed most magad?"}
            </small>
          </span>
          <Icon name="chevron-right" size={17} />
        </button>
        <button className="g-path-item" onClick={() => api.go("fuel")}>
          <span className="g-path-node">
            <Icon name="utensils" size={17} />
          </span>
          <span>
            <strong>Energia a délutánhoz</strong>
            <small>
              {api.nutrition.kcal} kcal · {api.nutrition.protein} g fehérje
              eddig
            </small>
          </span>
          <Icon name="chevron-right" size={17} />
        </button>
        <button className="g-path-item" onClick={() => api.go("pattern")}>
          <span className="g-path-node">
            <Icon name="moon" size={17} />
          </span>
          <span>
            <strong>Este egy rövid séta?</strong>
            <small>Van egy megfigyelésem hozzá.</small>
          </span>
          <Icon name="chevron-right" size={17} />
        </button>
      </section>
      <Water api={api} />
      <button className="g-week-link" onClick={() => api.go("week")}>
        <span className="g-week-orbit">
          <Icon name="leaf" size={24} />
        </span>
        <span>
          <span className="g-overline">A HETED TÁVLATBÓL</span>
          <strong>A kis lépések összeérnek.</strong>
          <small>3 edzés · 18,4 km · 7ó 28p átlagalvás</small>
        </span>
        <Icon name="arrow-up-right" size={20} />
      </button>
    </div>
  );
}

function Train({ api }) {
  const done = api.state.workoutFinished;
  return (
    <div className="g-page g-train">
      <section className="g-climb">
        <Terrain kind="train" />
        <div className="g-overline">
          <span className="g-live-dot" />{" "}
          {done ? "A MAI LÉPÉST MEGTETTED" : "MA · 17:30"}
        </div>
        <h1>
          Erő, ami
          <br />
          <em>veled marad.</em>
        </h1>
        <div className="g-climb-session">
          <span className="g-small-label">
            {done ? "BEFEJEZETT EDZÉS" : "KÖVETKEZŐ EDZÉS"}
          </span>
          <h2>
            Pull Day<span>02</span>
          </h2>
          <p>Hát · bicepsz · stabil alapok</p>
        </div>
        <div className="g-climb-metrics">
          <div>
            <strong>
              45<small>perc</small>
            </strong>
            <span>Saját idő</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Gyakorlat</span>
          </div>
          <div>
            <strong>
              {done ? "12" : api.state.completedSets.length}
              <small>/12</small>
            </strong>
            <span>Sorozat kész</span>
          </div>
        </div>
        <Primary
          onClick={() => api.go("workout")}
          icon={done ? "check" : "play"}
        >
          {done
            ? "Edzés megtekintése"
            : api.state.completedSets.length
              ? "Edzés folytatása"
              : "Edzés indítása"}
        </Primary>
      </section>
      <section className="g-training-week">
        <SectionTitle detail="SZEPT. 7–13.">A hét ritmusa</SectionTitle>
        <div className="g-weekdays">
          {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((day, i) => (
            <button
              key={day}
              className={`${i === 1 ? "is-today" : ""} ${[0, 1, 4].includes(i) ? "is-training" : ""}`}
              onClick={() => api.go(i === 1 ? "workout" : "week")}
              aria-label={`${day}: heti edzésterv`}
            >
              <span>{day}</span>
              <strong>{7 + i}</strong>
              <i>
                {i === 0 ? (
                  <Icon name="check" size={12} />
                ) : [1, 4].includes(i) ? (
                  <span />
                ) : null}
              </i>
            </button>
          ))}
        </div>
        <p>
          <i className="g-live-dot" /> Két erőnap között is van hely a
          feltöltődésnek.
        </p>
      </section>
      <section>
        <SectionTitle detail="Teljes terv" onClick={() => api.go("workout")}>
          Erre készülünk
        </SectionTitle>
        <div className="g-exercises">
          {[
            ["01", "Lehúzás mellhez", "3 × 10", "45 kg"],
            ["02", "Evezés csigán", "3 × 12", "40 kg"],
            ["03", "Face pull", "3 × 15", "15 kg"],
            ["04", "Bicepsz kézisúlyzóval", "3 × 12", "12 kg"],
          ].map(([n, name, reps, weight]) => (
            <button
              className="g-exercise"
              key={n}
              onClick={() => api.go("workout")}
            >
              <span className="g-exercise-number">{n}</span>
              <span>
                <strong>{name}</strong>
                <small>{reps}</small>
              </span>
              <span className="g-exercise-load">
                {weight}
                <Icon name="chevron-right" size={15} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <button className="g-progress-card" onClick={() => api.go("week")}>
        <div>
          <span className="g-overline">HOSSZÚ TÁVON</span>
          <h3>Csendesen erősödsz.</h3>
          <p>Nézd meg, mi épült az elmúlt hetekben.</p>
        </div>
        <Sparkline
          values={[20, 26, 24, 34, 37, 35, 48, 52]}
          height={65}
          color="#d7edaa"
        />
        <span className="g-text-action">
          Heti áttekintés <Icon name="arrow-up-right" size={16} />
        </span>
      </button>
    </div>
  );
}

function Fuel({ api }) {
  return (
    <div className="g-page g-fuel">
      <section className="g-nourish">
        <div className="g-overline">
          <span className="g-live-dot" /> AMIBŐL ÉPÍTKEZEL
        </div>
        <h1>
          Tápláld azt,
          <br />
          <em>ami mozgat.</em>
        </h1>
        <div className="g-food-orbit">
          <svg viewBox="0 0 340 248" aria-hidden="true">
            <ellipse
              cx="170"
              cy="140"
              rx="148"
              ry="84"
              fill="none"
              stroke="#a7bf91"
              strokeOpacity=".2"
              transform="rotate(-18 170 140)"
            />
            <ellipse
              cx="170"
              cy="140"
              rx="137"
              ry="76"
              fill="none"
              stroke="#d1e7a1"
              strokeWidth="2"
              strokeDasharray="245 440"
              transform="rotate(-18 170 140)"
            />
            <ellipse
              cx="170"
              cy="150"
              rx="118"
              ry="43"
              fill="#829f68"
              fillOpacity=".1"
            />
            <circle cx="40" cy="182" r="4" fill="#d6ed9f" />
            <circle cx="291" cy="71" r="3" fill="#8ba07e" />
          </svg>
          <FoodArt kind="bowl" className="g-food-hero" />
          <span className="g-orbit-caption">GONDOSKODÁS, BELÜLRŐL.</span>
        </div>
        <div className="g-energy">
          <span className="g-small-label">Mai bevitel</span>
          <div>
            <strong>
              {api.nutrition.kcal.toLocaleString("hu-HU")}
              <small> kcal</small>
            </strong>
            <span>/ 2 400 kcal</span>
          </div>
          <div className="g-energy-track">
            <i
              style={{
                width: `${Math.min(100, (api.nutrition.kcal / 2400) * 100)}%`,
              }}
            />
          </div>
          <p>
            Még <b>{Math.max(0, api.remaining).toLocaleString("hu-HU")} kcal</b>{" "}
            fér a mai tervedbe.
          </p>
        </div>
        <Primary onClick={() => api.go("meal")} icon="plus">
          Étkezés hozzáadása
        </Primary>
      </section>
      <section className="g-macros" aria-label="Mai makrotápanyagok">
        {[
          ["Fehérje", api.nutrition.protein, 160, "protein"],
          ["Szénhidrát", api.nutrition.carbs, 270, "carbs"],
          ["Zsír", api.nutrition.fat, 80, "fat"],
        ].map(([label, value, target, type]) => (
          <div key={label} className={`g-macro g-macro-${type}`}>
            <span>{label}</span>
            <strong>
              {value}
              <small> g</small>
            </strong>
            <div>
              <i
                style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
              />
            </div>
            <small>{target} g cél</small>
          </div>
        ))}
      </section>
      <section>
        <SectionTitle detail={`${api.state.meals.length} étkezés`}>
          A mai asztalod
        </SectionTitle>
        <div className="g-meals">
          {api.state.meals.map((meal) => (
            <button
              className="g-meal"
              key={meal.id}
              onClick={() => api.go("meal")}
            >
              <div className="g-meal-art">
                <FoodArt kind={meal.kind} />
              </div>
              <span>
                <small>
                  {meal.time} · {meal.protein} g fehérje
                </small>
                <strong>{meal.name}</strong>
                <span>{meal.kcal} kcal</span>
              </span>
              <Icon name="chevron-right" size={17} />
            </button>
          ))}
        </div>
      </section>
      <Water api={api} />
      <button className="g-food-note" onClick={() => api.go("meal")}>
        <span className="g-food-note-icon">
          <Icon name="leaf" size={25} />
        </span>
        <span>
          <span className="g-overline">AZ ESTI ASZTALRA</span>
          <strong>Egyszerű. Jóleső. A tiéd.</strong>
          <small>Találjunk egy vacsorát a mai napodhoz.</small>
        </span>
        <Icon name="arrow-up-right" size={19} />
      </button>
    </div>
  );
}

function Mezo({ api }) {
  return (
    <div className="g-page g-mezo">
      <section className="g-observatory">
        <div className="g-overline">
          <span className="g-live-dot" /> A SAJÁT KIS TISZTÁSOD
        </div>
        <h1>
          Látom, ahogy
          <br />
          <em>összeérnek a dolgok.</em>
        </h1>
        <div className="g-constellation">
          <svg viewBox="0 0 360 268" aria-hidden="true">
            <ellipse
              cx="180"
              cy="143"
              rx="153"
              ry="83"
              fill="none"
              stroke="#829d75"
              strokeOpacity=".24"
              transform="rotate(-19 180 143)"
            />
            <ellipse
              cx="180"
              cy="143"
              rx="126"
              ry="110"
              fill="none"
              stroke="#829d75"
              strokeOpacity=".15"
              transform="rotate(39 180 143)"
            />
            <path
              d="M62 114L154 75L291 157L230 227L62 114Z"
              fill="none"
              stroke="#c8dca0"
              strokeOpacity=".15"
              strokeDasharray="2 4"
            />
            <circle cx="62" cy="114" r="5" fill="#aec595" />
            <circle cx="154" cy="75" r="3" fill="#e8b5a3" />
            <circle cx="291" cy="157" r="5" fill="#d8e9ad" />
            <circle cx="230" cy="227" r="3" fill="#aec595" />
          </svg>
          <button
            className="g-constellation-avatar"
            onClick={() => api.go("avatar")}
            aria-label="Mezo megjelenése és mozgása"
          >
            <Avatar size={170} />
          </button>
          <button
            className="g-star-label g-star-sleep"
            onClick={() => api.go("sleep")}
          >
            <Icon name="moon" size={13} /> Pihenés
          </button>
          <button
            className="g-star-label g-star-motion"
            onClick={() => api.go("train")}
          >
            <Icon name="activity" size={13} /> Mozgás
          </button>
          <button
            className="g-star-label g-star-you"
            onClick={() => api.go("journal")}
          >
            A te történeted <Icon name="arrow-up-right" size={12} />
          </button>
        </div>
        <div className="g-mezo-voice">
          <span className="g-overline">MEZO NEKED</span>
          <p>
            „Ma kipihentebb vagy. Van hely az edzésnek — és annak is, hogy
            közben figyelj magadra.”
          </p>
        </div>
        <Primary onClick={() => api.go("chat")} icon="sparkles">
          Beszélgessünk
        </Primary>
      </section>
      <section className="g-discovery">
        <div className="g-small-label">
          <Icon name="sparkles" size={16} /> Egy visszatérő kapcsolat
        </div>
        <h2>
          Amikor este sétálsz,
          <br />
          <em>tovább alszol.</em>
        </h2>
        <div className="g-pattern-metric">
          <strong>
            +34<small>perc</small>
          </strong>
          <span>
            átlagosan több alvás
            <br />
            12 megfigyelt napon
          </span>
        </div>
        <div className="g-evidence-lines" aria-hidden="true">
          <span>
            Esti séta
            <i style={{ width: "82%" }} />
          </span>
          <span>
            Séta nélkül
            <i style={{ width: "64%" }} />
          </span>
        </div>
        <p>
          Együttjárás a naplódban, nem bizonyított ok-okozati kapcsolat. Magadra
          ismersz benne?
        </p>
        <button className="g-soft-action" onClick={() => api.go("pattern")}>
          {api.state.patternConfirmed
            ? "A megerősített megfigyelésed"
            : "Nézzük meg együtt"}
          <Icon name="arrow-right" size={17} />
        </button>
      </section>
      <section className="g-mezo-readings">
        <SectionTitle>Ami a számaid mögött van</SectionTitle>
        <button onClick={() => api.go("week")}>
          <span className="g-reading-icon">
            <Icon name="book" size={22} />
          </span>
          <span>
            <strong>Egy hét, egy történet</strong>
            <small>Mi adott energiát, és mi vett el?</small>
          </span>
          <Icon name="arrow-up-right" size={18} />
        </button>
        <button onClick={() => api.go("journal")}>
          <span className="g-reading-icon">
            <Icon name="leaf" size={22} />
          </span>
          <span>
            <strong>Amit fontosnak tartasz</strong>
            <small>Emlékek, szokások, saját szavak.</small>
          </span>
          <Icon name="arrow-up-right" size={18} />
        </button>
        <button onClick={() => api.go("avatar")}>
          <span className="g-reading-icon">
            <Icon name="settings" size={22} />
          </span>
          <span>
            <strong>Ismerd meg Mezót</strong>
            <small>Megjelenés, mozgás és jelenlét.</small>
          </span>
          <Icon name="arrow-up-right" size={18} />
        </button>
      </section>
    </div>
  );
}

export default function Grove({ page, api }) {
  if (page === "train") return <Train api={api} />;
  if (page === "fuel") return <Fuel api={api} />;
  if (page === "mezo") return <Mezo api={api} />;
  if (page === "chat")
    return (
      <div className="g-chat">
        <div className="g-chat-setting">
          <span className="g-live-dot" /> Egy kis tér, ahol meghallak.
        </div>
        <Chat api={api} />
      </div>
    );
  return <Home api={api} />;
}
