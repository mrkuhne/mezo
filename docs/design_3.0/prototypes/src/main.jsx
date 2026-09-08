import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Measure from "./variants/Measure.jsx";
import Rhythm from "./variants/Rhythm.jsx";
import Grove from "./variants/Grove.jsx";
import {
  Avatar,
  Icon,
  Ring,
  Sparkline,
  FoodArt,
  WorkoutArt,
} from "./shared.jsx";
import {
  createState,
  reduce,
  nutrition,
  replyTo,
  FOODS,
  EXERCISES,
} from "./model.mjs";
import "./shell.css";

const VARIANTS = {
  measure: {
    name: "Mérték",
    letter: "A",
    phrase: "Tisztán látni. Tudatosan lépni.",
    description:
      "Precíz adatok, szerkesztett felületek, nyugodt magabiztosság.",
    references: "Bevel · Strava · Nike",
    component: Measure,
  },
  rhythm: {
    name: "Ritmus",
    letter: "B",
    phrase: "Egy nap, ami összeáll.",
    description: "Személyes vezetés, puha formák, a következő jó lépés.",
    references: "Nike · Bevel · Bears Gratitude",
    component: Rhythm,
  },
  grove: {
    name: "Liget",
    letter: "C",
    phrase: "Egy saját hely, ahol növekedsz.",
    description: "Térbeli világ, élő karakter, csendes felfedezés.",
    references: "Tide Guide · Harvee · Huawei",
    component: Grove,
  },
};
const TABS = [
  ["home", "Nap", "sun"],
  ["train", "Edzés", "dumbbell"],
  ["fuel", "Fuel", "utensils"],
  ["mezo", "Mezo", "sparkles"],
  ["chat", "Chat", "more"],
];
const TITLES = {
  home: "A mai napod",
  train: "Edzés",
  fuel: "Étkezés",
  mezo: "Mezo",
  chat: "Beszélgessünk",
  workout: "Pull Day",
  meal: "Étkezés hozzáadása",
  pattern: "Egy esti összefüggés",
  week: "A heted története",
  routine: "A reggeli ritmusod",
  avatar: "Ismerd meg Mezót",
  sleep: "Az éjszakád",
  journal: "Egy kis tér magadnak",
  goals: "Ami felé tartasz",
};
const PARENTS = {
  workout: "train",
  meal: "fuel",
  pattern: "mezo",
  week: "home",
  routine: "home",
  avatar: "mezo",
  sleep: "home",
  journal: "mezo",
  goals: "home",
};
const urlParams = new URLSearchParams(location.search);
function currentRoute() {
  const r = location.hash.slice(1).split("?")[0];
  return TITLES[r] ? r : "home";
}
function storageLoad(variant) {
  try {
    const data = JSON.parse(localStorage.getItem(`mezo-lab-v1-${variant}`));
    return data &&
      Array.isArray(data.meals) &&
      Array.isArray(data.messages) &&
      Array.isArray(data.completedSets)
      ? { ...createState(), ...data }
      : createState();
  } catch {
    return createState();
  }
}
function Launcher() {
  const [page, setPage] = useState("home");
  return (
    <div className="lab-landing">
      <header className="lab-masthead">
        <a className="lab-brand" href="/">
          <span className="brand-orb" />
          mezo<span className="lab-word">design studies / 03</span>
        </a>
        <span className="lab-version">
          SZEPTEMBER 2026 · INTERAKTÍV PROTOTÍPUSOK
        </span>
      </header>
      <div className="lab-intro">
        <div>
          <span className="lab-eyebrow">EGY MEZO. HÁROM LEHETSÉGES VILÁG.</span>
          <h1>
            Melyikben érzed
            <br />
            magad <em>otthon?</em>
          </h1>
        </div>
        <p>
          Ugyanaz a nap. Ugyanazok a lehetőségek.
          <br />
          Három különböző élmény, amit végigjárhatsz.
          <br />
          <span>Minden adat szemléltető; az AI válaszai előre megírtak.</span>
        </p>
      </div>
      <div className="lab-comparison-controls">
        <span>Hasonlítsd össze</span>
        <div>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-pressed={page === id}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
          <button
            className={page === "avatar" ? "active" : ""}
            aria-pressed={page === "avatar"}
            onClick={() => setPage("avatar")}
          >
            Karakter
          </button>
        </div>
      </div>
      <div className="comparison-grid">
        {Object.entries(VARIANTS).map(([id, v]) => (
          <section className={`concept-preview preview-${id}`} key={id}>
            <div className="concept-label">
              <div>
                <span>{v.letter} /</span>
                <h2>{v.name}</h2>
              </div>
              <a href={`?v=${id}#${page}`}>
                Kipróbálom <Icon name="arrow-up-right" size={18} />
              </a>
            </div>
            <p>{v.phrase}</p>
            <div className="preview-frame">
              <iframe
                title={`${v.name} interaktív prototípus`}
                src={`?v=${id}&embed=1#${page}`}
                loading="eager"
              />
            </div>
            <div className="concept-foot">
              <span>{v.description}</span>
              <small>{v.references}</small>
            </div>
          </section>
        ))}
      </div>
      <footer className="lab-footer">
        <span>A csempéken túl — közös ritmus, saját karakter.</span>
        <span>Avatar Lab · valódi SVG-karakter és állapotok</span>
      </footer>
    </div>
  );
}

function Prototype({ variant }) {
  const v = VARIANTS[variant],
    Body = v.component,
    embedded = urlParams.has("embed");
  const [state, setState] = useState(() => storageLoad(variant)),
    [page, setPage] = useState(currentRoute),
    [notice, setNotice] = useState(""),
    [typing, setTyping] = useState(false),
    [mood, setMood] = useState("idle");
  const scroller = useRef(null),
    positions = useRef(new Map()),
    currentKey = useRef(
      history.state?.mezoLab ? history.state.key : crypto.randomUUID(),
    ),
    depth = useRef(history.state?.mezoLab ? history.state.depth : 0),
    returning = useRef(false),
    timer = useRef(null),
    toastTimer = useRef(null),
    moodTimer = useRef(null);
  const dispatch = (action) => setState((s) => reduce(s, action));
  useEffect(() => {
    try {
      localStorage.setItem(`mezo-lab-v1-${variant}`, JSON.stringify(state));
    } catch {}
  }, [state, variant]);
  useEffect(() => {
    history.replaceState(
      { mezoLab: true, key: currentKey.current, depth: depth.current },
      "",
      `${location.search}#${currentRoute()}`,
    );
    const pop = (e) => {
      positions.current.set(
        currentKey.current,
        scroller.current?.scrollTop || 0,
      );
      currentKey.current = e.state?.key || "initial";
      depth.current = e.state?.depth || 0;
      returning.current = true;
      setPage(currentRoute());
    };
    addEventListener("popstate", pop);
    return () => {
      removeEventListener("popstate", pop);
      clearTimeout(timer.current);
      clearTimeout(toastTimer.current);
      clearTimeout(moodTimer.current);
    };
  }, []);
  useLayoutEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = returning.current
        ? positions.current.get(currentKey.current) || 0
        : 0;
    returning.current = false;
  }, [page]);
  function go(route) {
    if (!TITLES[route] || route === page) return;
    positions.current.set(currentKey.current, scroller.current?.scrollTop || 0);
    currentKey.current = crypto.randomUUID();
    depth.current++;
    history.pushState(
      { mezoLab: true, key: currentKey.current, depth: depth.current },
      "",
      `${location.search}#${route}`,
    );
    setPage(route);
  }
  function back() {
    if (depth.current > 0) history.back();
    else go(PARENTS[page] || "home");
  }
  function toast(text) {
    setNotice(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 3200);
  }
  function celebrate() {
    setMood("happy");
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 2700);
  }
  function send(text) {
    if (!text.trim() || typing) return;
    dispatch({ type: "message", role: "user", text });
    setTyping(true);
    setMood("thinking");
    const response = replyTo(text, state);
    timer.current = setTimeout(() => {
      dispatch({ type: "message", role: "assistant", text: response });
      setTyping(false);
      setMood("idle");
    }, 900);
  }
  const api = {
    state,
    nutrition: nutrition(state),
    remaining: Math.max(0, 2400 - nutrition(state).kcal),
    go,
    back,
    typing,
    toast,
    send,
    water: () => {
      dispatch({ type: "water" });
      toast("+250 ml víz hozzáadva");
      celebrate();
    },
    logFood: (food) => {
      dispatch({ type: "food", food });
      toast(`${food.name} naplózva`);
      celebrate();
      back();
    },
    toggleSet: (key) => dispatch({ type: "set", key }),
    setValue: (key, field, value) =>
      dispatch({ type: "setValue", key, field, value }),
    finishWorkout: () => {
      dispatch({ type: "finish" });
      celebrate();
    },
    completeRoutine: () => {
      dispatch({ type: "routine" });
      celebrate();
      toast("A reggeli rutinod kész");
    },
    confirmPattern: () => {
      dispatch({ type: "confirm" });
      celebrate();
      toast("Megőriztem ezt a megfigyelést");
    },
    saveJournal: (text) => {
      dispatch({ type: "journal", text });
      toast("A gondolatod elmentve");
    },
  };
  const main = TABS.some(([id]) => id === page),
    activeTab = main ? page : PARENTS[page] || "home";
  function reset() {
    clearTimeout(timer.current);
    clearTimeout(moodTimer.current);
    setMood("idle");
    setTyping(false);
    setState(createState());
    toast("Újrakezdjük ugyanazt a mock napot");
    go("home");
  }
  return (
    <div className={`prototype-workspace ${embedded ? "embedded" : ""}`}>
      {!embedded && (
        <aside className="lab-sidebar">
          <a href="/" className="lab-back">
            <Icon name="arrow-left" size={17} /> Három irány
          </a>
          <div className="study-number">{v.letter} / 03</div>
          <h1>{v.name}</h1>
          <p>{v.description}</p>
          <div className="direction-switch">
            {Object.entries(VARIANTS).map(([id, a]) => (
              <a
                key={id}
                className={id === variant ? "selected" : ""}
                href={`?v=${id}#${page}`}
              >
                <span>{a.letter}</span>
                {a.name}
                <Icon name="arrow-up-right" size={15} />
              </a>
            ))}
          </div>
          <span className="lab-eyebrow">JÁRD VÉGIG</span>
          <nav className="journey-links">
            {[
              ["home", "A napod"],
              ["workout", "Egy teljes edzés"],
              ["meal", "Étkezés naplózása"],
              ["pattern", "AI-felismerés"],
              ["chat", "Beszélgetés"],
              ["week", "Heti visszatekintés"],
              ["avatar", "A Clay karakter"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={page === id ? "active" : ""}
              >
                {label}
                <Icon name="chevron-right" size={14} />
              </button>
            ))}
          </nav>
          <div className="lab-sidebar-bottom">
            <button onClick={reset}>
              <Icon name="rotate" size={15} /> Mock nap visszaállítása
            </button>
            <p>
              Szemléltető adatok · helyben mentve
              <br />A chat előre megírt válaszokat ad.
              <br />A működő apphoz nem kapcsolódik.
            </p>
            <a
              href="https://github.com/smontlouis/bible-strong-avatar-lab"
              target="_blank"
              rel="noreferrer"
            >
              Avatar Lab · AGPL-3.0
            </a>
          </div>
        </aside>
      )}
      <div className="device-wrap">
        {!embedded && (
          <div className="mobile-lab-bar">
            <a href="/">‹ Irányok</a>
            <span>
              {v.letter} / {v.name} · prototípus
            </span>
            <button onClick={reset} aria-label="Mock nap visszaállítása">
              <Icon name="rotate" size={14} />
            </button>
          </div>
        )}
        <div className={`app-frame theme-${variant}`}>
          <header className="app-header">
            <div className="header-left">
              {!main ? (
                <button
                  className="header-button"
                  onClick={back}
                  aria-label="Vissza az előző oldalra"
                >
                  <Icon name="arrow-left" />
                </button>
              ) : (
                <span className="wordmark">
                  <span className="brand-orb" />
                  mezo
                </span>
              )}
              <span className="app-title">{TITLES[page]}</span>
            </div>
            <button
              className="header-avatar"
              aria-label="Mezo karaktere"
              onClick={() => go("avatar")}
            >
              <Avatar size={38} state={typing ? "thinking" : mood} />
            </button>
          </header>
          <main
            ref={scroller}
            className={`app-content ${page === "chat" ? "is-chat" : ""}`}
            key={variant}
          >
            <div className="page-enter" key={page}>
              {main ? (
                <Body page={page} api={api} />
              ) : (
                <Details page={page} api={api} />
              )}
            </div>
          </main>
          <nav className="app-nav" aria-label="Fő navigáció">
            {TABS.map(([id, label, icon]) => (
              <button
                className={`nav-item ${activeTab === id ? "active" : ""}`}
                key={id}
                onClick={() => go(id)}
                aria-current={activeTab === id ? "page" : undefined}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {activeTab === id && <i />}
              </button>
            ))}
          </nav>
          {notice && (
            <div className="app-toast" role="status">
              <Icon name="check" size={17} />
              {notice}
            </div>
          )}
        </div>
        {!embedded && (
          <p className="device-caption">
            {v.references} <span>↔</span> Mezo saját formanyelve
          </p>
        )}
      </div>
      {!embedded && (
        <aside className="lab-notes">
          <span className="lab-eyebrow">MIT ÉRDEMES FIGYELNI?</span>
          <h2>
            {page === "chat"
              ? "Mennyire természetes a párbeszéd?"
              : page === "workout"
                ? "Segít abban, amit éppen csinálsz?"
                : "Tudod, merre indulnál?"}
          </h2>
          <p>
            A főoldaltól a részletekig minden kattintható. Próbálj naplózni egy
            étkezést, végigvinni egy edzést, majd visszatérni a napodhoz.
          </p>
          <div className="note-rule" />
          <p>
            Ugyanazok az adatok.
            <br />
            Külön állapot irányonként.
            <br />
            Valódi visszalépés és mentés.
          </p>
          <button className="note-avatar" onClick={() => go("avatar")}>
            <Avatar size={112} />
            <span>
              Van valaki a forma mögött.
              <br />
              <b>
                Ismerd meg Mezót <Icon name="arrow-right" size={14} />
              </b>
            </span>
          </button>
        </aside>
      )}
    </div>
  );
}

function Details({ page, api }) {
  if (page === "workout") return <Workout api={api} />;
  if (page === "meal") return <Meal api={api} />;
  if (page === "avatar") return <AvatarPlayground />;
  if (page === "pattern")
    return (
      <div className="detail-page">
        <span className="detail-kicker">MEZO ÉSZREVETTE · ALVÁS ÉS MOZGÁS</span>
        <h1 className="detail-lead">
          A nap végén egy séta.
          <br />
          <em>Éjjel egy kis többlet.</em>
        </h1>
        <div className="insight-figure">
          <span>+34</span>
          <small>
            perc alvás
            <br />a sétálós estéken
          </small>
          <Icon name="moon" size={46} />
        </div>
        <p className="detail-prose">
          Tizenkét megfigyelt napod között egy halk összefüggés rajzolódik ki.
          Amikor este sétáltál, általában tovább aludtál.
        </p>
        <div className="sleep-comparison">
          <div>
            <span>Séta nélkül</span>
            <i style={{ width: "76%" }} />
            <b>7 óra 08</b>
          </div>
          <div>
            <span>Esti sétával</span>
            <i style={{ width: "88%" }} />
            <b>7 óra 42</b>
          </div>
        </div>
        <p className="evidence-note">
          12 megfigyelt nap · szemléltető adatok. Együttjárás, nem bizonyított
          ok-okozat.
        </p>
        <div className="detail-card companion-detail">
          <Avatar size={72} />
          <p>
            Ismerős neked ez? Ha igen, megőrzöm, és a következő esti tervezésnél
            figyelembe vesszük.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={api.confirmPattern}
          disabled={api.state.patternConfirmed}
        >
          <Icon name={api.state.patternConfirmed ? "check" : "leaf"} />
          {api.state.patternConfirmed
            ? "Megőrizve a közös tudásunkban"
            : "Igen, ez rám jellemző"}
        </button>
        <button className="secondary-button" onClick={() => api.go("chat")}>
          Beszéljük át <Icon name="arrow-right" />
        </button>
        <div className="detail-section">
          <span className="detail-kicker">AMIBŐL ÖSSZEÁLLT</span>
          <div className="detail-row">
            <Icon name="moon" />
            <span>Alvásnapló</span>
            <small>12 éjszaka</small>
          </div>
          <div className="detail-row">
            <Icon name="activity" />
            <span>Esti aktivitások</span>
            <small>5 séta</small>
          </div>
          <div className="detail-row">
            <Icon name="book" />
            <span>Saját visszajelzéseid</span>
            <small>3 bejegyzés</small>
          </div>
        </div>
      </div>
    );
  if (page === "week")
    return (
      <div className="detail-page">
        <span className="detail-kicker">
          SZEPTEMBER 2–8. · AZ ELMÚLT HÉT NAP
        </span>
        <h1 className="detail-lead">
          A kis lépésekből
          <br />
          <em>ritmus lett.</em>
        </h1>
        <p className="detail-prose">
          {api.state.workoutFinished ? "Négy" : "Három"} edzés, több séta és egy
          egyre nyugodtabb este. Ezt a hetet a következetességed tartotta össze.
        </p>
        <div className="week-stats">
          <div>
            <b>{api.state.workoutFinished ? 4 : 3}</b>
            <span>edzés</span>
          </div>
          <div>
            <b>18,4</b>
            <span>km mozgás</span>
          </div>
          <div>
            <b>7:28</b>
            <span>átlagos alvás</span>
          </div>
        </div>
        <div className="detail-section">
          <h2>Így alakult az energiád</h2>
          <Sparkline values={[65, 71, 68, 79, 74, 85, 82]} height={110} fill />
          <div className="chart-labels">
            {"Sz Cs P Sz V H K".split(" ").map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
        <div className="story-chapter">
          <span>01</span>
          <div>
            <h2>Amit megtartunk</h2>
            <p>
              A hétfő–szerda–péntek edzésritmus jól illeszkedik a napjaidba. Az
              előre elkészített ebéd mellett kevesebb döntés maradt délutánra.
            </p>
          </div>
        </div>
        <div className="story-chapter">
          <span>02</span>
          <div>
            <h2>Amit finoman hangolunk</h2>
            <p>
              A késői lefekvések után nehezebben indult a nap. Jövő héten
              próbáljunk két estét tudatosan korábban lezárni.
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => api.go("chat")}>
          Beszéljünk a következő hétről <Icon name="arrow-right" />
        </button>
        <button className="secondary-button" onClick={() => api.go("journal")}>
          Hozzáteszem a saját gondolatom
        </button>
      </div>
    );
  if (page === "routine") return <Routine api={api} />;
  if (page === "journal") return <Journal api={api} />;
  if (page === "sleep")
    return (
      <div className="detail-page">
        <span className="detail-kicker">KEDD REGGEL · PIHENÉS</span>
        <h1 className="detail-lead">
          Volt időd
          <br />
          <em>feltöltődni.</em>
        </h1>
        <div className="sleep-hero">
          <Icon name="moon" size={40} />
          <strong>
            7<span>ó</span>42<span>p</span>
          </strong>
          <p>23:18 — 07:00</p>
        </div>
        <div className="detail-section">
          <h2>Az éjszaka ritmusa</h2>
          <div
            className="sleep-bars"
            role="img"
            aria-label="Szemléltető alvásfázisok 23:18 és 07:00 között"
          >
            {[
              2, 3, 3, 2, 1, 2, 3, 3, 2, 1, 2, 3, 2, 1, 2, 2, 3, 1, 2, 1, 2, 2,
              1, 1,
            ].map((h, i) => (
              <i
                key={i}
                style={{ height: `${h * 23}px`, opacity: 0.35 + h * 0.2 }}
              />
            ))}
          </div>
          <div className="chart-labels">
            <span>23:18</span>
            <span>03:00</span>
            <span>07:00</span>
          </div>
        </div>
        <div className="week-stats">
          <div>
            <b>1:32</b>
            <span>mély alvás</span>
          </div>
          <div>
            <b>1:48</b>
            <span>REM</span>
          </div>
          <div>
            <b>82</b>
            <span>regeneráció</span>
          </div>
        </div>
        <p className="detail-prose">
          Ma kipihentebb alapokról indulsz. Az esti sétáid és a nyugodtabb
          lefekvés együtt egy stabilabb ritmust rajzolnak.
        </p>
        <button className="primary-button" onClick={() => api.go("pattern")}>
          Mi segített ebben? <Icon name="arrow-right" />
        </button>
        <p className="evidence-note">
          Szemléltető alvásadatok; a prototípus nem olvas egészségügyi eszközt.
        </p>
      </div>
    );
  if (page === "goals")
    return (
      <div className="detail-page">
        <span className="detail-kicker">A SAJÁT IRÁNYOD</span>
        <h1 className="detail-lead">
          Erősebb test.
          <br />
          <em>Több tér az életre.</em>
        </h1>
        {[
          [
            "Mozgás, ami megtart",
            `${api.state.workoutFinished ? 4 : 3} / 4 edzés az elmúlt hét napban`,
            api.state.workoutFinished ? 100 : 75,
            "dumbbell",
          ],
          ["Nyugodtabb esték", "4 / 7 este képernyő nélkül", 57, "moon"],
          ["Kapcsolódni", "2 közös program a héten", 66, "heart"],
        ].map(([name, line, value, icon]) => (
          <div className="goal-item" key={name}>
            <Icon name={icon} size={26} />
            <h2>{name}</h2>
            <p>{line}</p>
            <div className="goal-track">
              <i style={{ width: `${value}%` }} />
            </div>
            <button
              className="text-button"
              onClick={() =>
                api.go(
                  icon === "dumbbell"
                    ? "train"
                    : icon === "moon"
                      ? "routine"
                      : "journal",
                )
              }
            >
              Megnézem <Icon name="arrow-right" size={16} />
            </button>
          </div>
        ))}
        <button className="secondary-button" onClick={() => api.go("chat")}>
          Hangoljuk együtt a céljaimat
        </button>
      </div>
    );
  return null;
}
function Workout({ api }) {
  const [rest, setRest] = useState(0);
  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setRest((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [rest > 0]);
  if (api.state.workoutFinished)
    return (
      <div className="detail-page workout-finished">
        <Avatar size={172} state="happy" />
        <span className="detail-kicker">PULL DAY · ELMENTVE</span>
        <h1 className="detail-lead">
          Ma is tettél
          <br />
          <em>magadért.</em>
        </h1>
        <p className="detail-prose">
          Az edzésed bekerült a naplódba. Most jöhet egy kis levezetés, víz, és
          a napod többi része.
        </p>
        <div className="week-stats">
          <div>
            <b>{api.state.completedSets.length}</b>
            <span>naplózott sorozat</span>
          </div>
          <div>
            <b>
              {
                new Set(api.state.completedSets.map((x) => x.split("-")[0]))
                  .size
              }
            </b>
            <span>gyakorlat</span>
          </div>
        </div>
        <button className="primary-button" onClick={() => api.go("home")}>
          Vissza a napomhoz <Icon name="arrow-right" />
        </button>
        <button className="secondary-button" onClick={() => api.go("week")}>
          Megnézem a heti összképet
        </button>
      </div>
    );
  return (
    <div className="detail-page workout-page">
      <div className="workout-intro">
        <span className="detail-kicker">HÁT & BICEPSZ · 45 PERC</span>
        <h1 className="detail-lead">
          Egy sorozat.
          <br />
          <em>Aztán a következő.</em>
        </h1>
      </div>
      <div className="session-progress">
        <span>
          {api.state.completedSets.length}
          <small> / 12 sorozat</small>
        </span>
        <div>
          <i
            style={{ width: `${(api.state.completedSets.length / 12) * 100}%` }}
          />
        </div>
      </div>
      <div className="warmup-note">
        <Icon name="wind" />
        <span>
          Kezdj 5 perc könnyű bemelegítéssel.
          <small>Majd egy könnyebb rávezető sorozat.</small>
        </span>
      </div>
      {EXERCISES.map((ex, i) => (
        <section className="exercise-block" key={ex.name}>
          <div className="exercise-heading">
            <span className="exercise-number">0{i + 1}</span>
            <div>
              <h2>{ex.name}</h2>
              <p>{ex.muscle}</p>
            </div>
            <span className="exercise-last">
              Előző
              <br />
              <b>{ex.last}</b>
            </span>
          </div>
          <div className="set-labels">
            <span>SZETT</span>
            <span>KG</span>
            <span>ISM.</span>
            <span>KÉSZ</span>
          </div>
          {Array.from({ length: 3 }, (_, s) => {
            const key = `${i}-${s}`,
              done = api.state.completedSets.includes(key);
            return (
              <div className={`set-row ${done ? "done" : ""}`} key={key}>
                <span>{s + 1}</span>
                <input
                  aria-label={`${ex.name} ${s + 1}. sorozat súly`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="500"
                  step=".5"
                  value={api.state.setValues?.[key]?.weight ?? ex.weight}
                  onChange={(e) =>
                    api.setValue(
                      key,
                      "weight",
                      Math.min(500, Math.max(0, Number(e.target.value))),
                    )
                  }
                />
                <input
                  aria-label={`${ex.name} ${s + 1}. sorozat ismétlés`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="100"
                  value={api.state.setValues?.[key]?.reps ?? ex.reps}
                  onChange={(e) =>
                    api.setValue(
                      key,
                      "reps",
                      Math.min(100, Math.max(1, Number(e.target.value))),
                    )
                  }
                />
                <button
                  aria-label={`${ex.name} ${s + 1}. sorozat ${done ? "visszavonása" : "kész"}`}
                  aria-pressed={done}
                  onClick={() => {
                    api.toggleSet(key);
                    setRest(done ? 0 : 90);
                  }}
                >
                  <Icon name="check" />
                </button>
              </div>
            );
          })}
        </section>
      ))}
      <button
        className="primary-button"
        onClick={api.finishWorkout}
        disabled={!api.state.completedSets.length}
      >
        Edzés befejezése <Icon name="check" />
      </button>
      {rest > 0 && (
        <div className="rest-timer" role="status">
          <Icon name="clock" />
          <div>
            <b>
              {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
            </b>
            <span>Pihenő · a következő sorozatig</span>
          </div>
          <button aria-label="Pihenő kihagyása" onClick={() => setRest(0)}>
            <Icon name="x" />
          </button>
        </div>
      )}
    </div>
  );
}
function Meal({ api }) {
  const [query, setQuery] = useState(""),
    [food, setFood] = useState(null),
    [portion, setPortion] = useState(1),
    [category, setCategory] = useState("all");
  const filtered = FOODS.filter(
    (f) =>
      f.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")) &&
      (category === "all" ||
        (category === "quick"
          ? f.kcal < 300
          : category === "protein"
            ? f.protein >= 28
            : true)),
  );
  return (
    <div className="detail-page meal-page">
      <span className="detail-kicker">EGYSZERŰEN A NAPLÓDBA</span>
      <h1 className="detail-lead">
        Mi esett
        <br />
        <em>jól ma?</em>
      </h1>
      <div className="search-field">
        <Icon name="search" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Étel, recept, összetevő…"
          aria-label="Étel keresése"
        />
      </div>
      <div className="filter-chips">
        {[
          ["all", "Gyakori ételeid"],
          ["protein", "Fehérjedús"],
          ["quick", "Gyors falatok"],
        ].map(([id, l]) => (
          <button
            className={category === id ? "selected" : ""}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
            key={id}
          >
            {l}
          </button>
        ))}
      </div>
      {food ? (
        <div className="meal-selected">
          <button className="text-button" onClick={() => setFood(null)}>
            <Icon name="arrow-left" size={16} /> Másik ételt választok
          </button>
          <FoodArt kind={food.kind} />
          <h2>{food.name}</h2>
          <p>Egy adag · frissen, egyszerűen</p>
          <div className="portion-picker">
            <button
              aria-label="Adag csökkentése"
              disabled={portion <= 0.5}
              onClick={() => setPortion((p) => p - 0.5)}
            >
              −
            </button>
            <strong>{portion.toLocaleString("hu-HU")} adag</strong>
            <button
              aria-label="Adag növelése"
              disabled={portion >= 3}
              onClick={() => setPortion((p) => p + 0.5)}
            >
              +
            </button>
          </div>
          <div className="week-stats">
            <div>
              <b>{Math.round(food.kcal * portion)}</b>
              <span>kcal</span>
            </div>
            <div>
              <b>{Math.round(food.protein * portion)} g</b>
              <span>fehérje</span>
            </div>
            <div>
              <b>{Math.round(food.carbs * portion)} g</b>
              <span>szénhidrát</span>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={() =>
              api.logFood({
                ...food,
                kcal: Math.round(food.kcal * portion),
                protein: Math.round(food.protein * portion),
                carbs: Math.round(food.carbs * portion),
                fat: Math.round(food.fat * portion),
              })
            }
          >
            Hozzáadom a napomhoz <Icon name="plus" />
          </button>
        </div>
      ) : (
        <div className="food-results">
          {filtered.map((f) => (
            <button
              key={f.id}
              className="food-result"
              onClick={() => {
                setFood(f);
                setPortion(1);
              }}
            >
              <FoodArt kind={f.kind} />
              <span>
                <b>{f.name}</b>
                <small>
                  {f.kcal} kcal · {f.protein} g fehérje
                </small>
              </span>
              <Icon name="plus" size={18} />
            </button>
          ))}
          {!filtered.length && (
            <div className="no-results">
              <Icon name="search" size={30} />
              <h2>Ezt még nem tettük a mintanaplóba.</h2>
              <p>Próbáld például: lazac, zabkása vagy joghurt.</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Gyakori ételek
              </button>
            </div>
          )}
        </div>
      )}
      <p className="evidence-note">A prototípus öt mintaétellel dolgozik.</p>
    </div>
  );
}
function Routine({ api }) {
  const [checked, setChecked] = useState(
    api.state.routineDone ? [0, 1, 2, 3] : [0],
  );
  return (
    <div className="detail-page">
      <span className="detail-kicker">REGGEL · 8 PERC MAGADRA</span>
      <h1 className="detail-lead">
        Lassan érkezz
        <br />
        <em>meg a napodba.</em>
      </h1>
      <Avatar size={120} state={api.state.routineDone ? "happy" : "idle"} />
      <div className="routine-list">
        {[
          ["droplet", "Egy pohár víz", "Mielőtt minden más elkezdődik."],
          ["sun", "Engedd be a fényt", "Nyisd ki az ablakot, nézz körül."],
          ["wind", "Három nyugodt lélegzet", "Semmit sem kell siettetni."],
          ["target", "Egy szándék a napra", "Mi lenne ma elég?"],
        ].map(([icon, title, sub], i) => (
          <button
            key={i}
            aria-pressed={checked.includes(i)}
            onClick={() =>
              setChecked((c) =>
                c.includes(i) ? c.filter((x) => x !== i) : [...c, i],
              )
            }
          >
            <span
              className={`routine-check ${checked.includes(i) ? "checked" : ""}`}
            >
              <Icon name={checked.includes(i) ? "check" : icon} />
            </span>
            <span>
              <b>{title}</b>
              <small>{sub}</small>
            </span>
          </button>
        ))}
      </div>
      <button
        className="primary-button"
        disabled={checked.length < 4 || api.state.routineDone}
        onClick={api.completeRoutine}
      >
        {api.state.routineDone
          ? "A reggeled összeállt"
          : "Készen állok a napra"}{" "}
        <Icon name="check" />
      </button>
      <button className="secondary-button" onClick={() => api.go("home")}>
        Vissza a napomhoz
      </button>
    </div>
  );
}
function Journal({ api }) {
  const [value, setValue] = useState(api.state.journal);
  return (
    <div className="detail-page">
      <span className="detail-kicker">A SAJÁT HANGODON</span>
      <h1 className="detail-lead">
        Mit vinnél
        <br />
        <em>magaddal a mából?</em>
      </h1>
      <p className="detail-prose">
        Lehet egy apró jó dolog, egy gondolat, vagy valami, ami még dolgozik
        benned.
      </p>
      <textarea
        className="journal-input"
        aria-label="Naplóbejegyzés"
        placeholder="Ma az volt jó, hogy…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={4000}
      />
      <span className="journal-count">{value.length} / 4000</span>
      <button
        className="primary-button"
        disabled={!value.trim()}
        onClick={() => api.saveJournal(value)}
      >
        Megőrzöm ezt a gondolatot <Icon name="book" />
      </button>
      <div className="detail-section">
        <span className="detail-kicker">KORÁBBI LAPJAID</span>
        <div className="journal-previous">
          <small>TEGNAP · 21:14</small>
          <h2>Jó volt csak úgy sétálni.</h2>
          <p>
            Nem hallgattam semmit. Észrevettem, hogy lassabban lélegzem, mint
            amikor elindultam.
          </p>
        </div>
      </div>
    </div>
  );
}
function AvatarPlayground() {
  const [state, setState] = useState("idle");
  return (
    <div className="detail-page avatar-playground">
      <span className="detail-kicker">
        UGYANAZ A CLAY. MOST EGY KIS SZEMÉLYISÉGGEL.
      </span>
      <h1 className="detail-lead">
        Szia.
        <br />
        <em>Itt vagyok.</em>
      </h1>
      <div className="avatar-stage">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <Avatar size={260} state={state} />
      </div>
      <div className="avatar-states">
        {[
          ["idle", "Jelen van", "sun"],
          ["listening", "Figyel", "headphones"],
          ["thinking", "Gondolkodik", "sparkles"],
          ["happy", "Örül veled", "heart"],
          ["sleeping", "Elcsendesedik", "moon"],
        ].map(([id, label, icon]) => (
          <button
            aria-pressed={id === state}
            className={id === state ? "selected" : ""}
            onClick={() => setState(id)}
            key={id}
          >
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </div>
      <p className="detail-prose">
        A figyelme és a mozdulatai változnak. A meleg, korallszínű forma végig
        ugyanaz marad.
      </p>
      <div className="avatar-sizes">
        <Avatar state={state} size={38} />
        <Avatar state={state} size={68} />
        <Avatar state={state} size={108} />
      </div>
      <span className="avatar-size-label">FEJLÉC · ÜZENET · TALÁLKOZÁS</span>
      <a className="secondary-button" href="/mezo-clay.avatar.json" download>
        Karakterdefiníció letöltése <Icon name="arrow-up-right" size={16} />
      </a>
      <p className="evidence-note">
        Valódi Avatar Lab React-megjelenítő · egyedi Mezo-definíció. A
        hordozható JSON a runtime formátuma; nem Studio-projektmentés.
      </p>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>A prototípus megakadt.</h1>
        <p>Az adataid helyben maradtak. Újratöltéssel visszatérhetsz.</p>
        <button onClick={() => location.reload()}>Újratöltés</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {VARIANTS[urlParams.get("v")] ? (
      <Prototype variant={urlParams.get("v")} />
    ) : (
      <Launcher />
    )}
  </ErrorBoundary>,
);
