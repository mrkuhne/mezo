import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, Icon, Ring, Sparkline, WorkoutArt, Chat } from "./shared.jsx";
import Details from "./LegacyDetails.jsx";
import FuelFlow, { FUEL_ROUTES } from "./flows/FuelFlow.jsx";
import TrainFlow, { TRAIN_ROUTES } from "./flows/TrainFlow.jsx";
import PersonalFlow, { PERSONAL_ROUTES } from "./flows/PersonalFlow.jsx";
import InsightFlow, { INSIGHT_ROUTES } from "./flows/InsightFlow.jsx";
import { FlowHead, FlowRow, CompanionNote } from "./flows/FlowUI.jsx";
import { nutrition, reduce, EXERCISES } from "./model.mjs";
import {
  createExplorationState,
  updateSlice,
  parseRoute,
  routeUrl,
  recordCheckIn,
  companionSuggestion,
  addNotification,
  addExplorationMeal,
  contextualReply,
  workoutRecord,
} from "./exploration-model.mjs";
import "./variants/measure.css";
import "./exploration.css";
export const ROUTES = {
  ...FUEL_ROUTES,
  ...TRAIN_ROUTES,
  ...PERSONAL_ROUTES,
  ...INSIGHT_ROUTES,
  home: { title: "A mai napod" },
  chat: { title: "Beszélgessünk", parent: "mezo" },
  workout: { title: "Pull Day", parent: "train" },
  journal: { title: "Napló", parent: "me" },
  avatar: { title: "A kis Mezo", parent: "mezo" },
  goals: { title: "Céljaim", parent: "me" },
};
const TABS = [
  ["home", "Nap", "sun"],
  ["train", "Edzés", "dumbbell"],
  ["fuel", "Fuel", "utensils"],
  ["mezo", "Mezo", "sparkles"],
  ["me", "Én", "heart"],
];
const VERSIONS = {
  measure: {
    name: "Mérték",
    letter: "A",
    line: "Lásd át. Válassz. Haladj.",
    description:
      "Nyugodt áttekintés, világos prioritások. Az eredeti szerkesztett világ, puhább formákkal.",
    references: "Bevel · Strava · Hevy",
  },
  companion: {
    name: "Mezo veled",
    letter: "B",
    line: "Egy társ. A teljes napodban.",
    description:
      "Mezo meghallgat, összeköti a történetedet, és segít kiválasztani a következő lépést.",
    references: "Nike · Harvee · Bears Gratitude",
  },
};
const ALIASES = { meal: "fuel-log", sleep: "me-sleep", routine: "me-routines" };
function current() {
  const r = parseRoute(location.hash);
  r.page = ALIASES[r.page] || r.page;
  return ROUTES[r.page] ? r : { page: "home", params: {} };
}
function load(variant) {
  try {
    const s = JSON.parse(localStorage.getItem("mezo-full-v2-" + variant));
    return s?.personal?.sleep?.logs &&
      s?.insight?.patterns &&
      s?.training?.cycles &&
      s?.fuel?.pantry
      ? { ...createExplorationState(), ...s }
      : createExplorationState();
  } catch {
    return createExplorationState();
  }
}
export function Launcher() {
  const [page, setPage] = useState("home");
  return (
    <div className="lab-landing complete-landing">
      <header className="lab-masthead">
        <a className="lab-brand" href="/">
          <span className="brand-orb" />
          mezo<span className="lab-word">design studies / 04</span>
        </a>
        <span className="lab-version">
          EGY TELJES ALKALMAZÁS · KÉT MEGKÖZELÍTÉS
        </span>
      </header>
      <div className="lab-intro">
        <div>
          <span className="lab-eyebrow">MOST MÁR A TELJES NAPOD.</span>
          <h1>
            Gazdagabb élet.
            <br />
            <em>Átláthatóbb tér.</em>
          </h1>
        </div>
        <p>
          Edzés, étkezés, alvás, kapcsolatok és önismeret.
          <br />
          Két belépési pont ugyanahhoz a teljes történethez.
          <br />
          <span>Menthető mintanap, előre megírt AI-válaszok.</span>
        </p>
      </div>
      <a className="presence-study-entry" href="?v=rpg"><strong>Boop Play · új RPG irány</strong><span>Színes, adatközpontú felületek · edzés, táplálás, fejlődés →</span></a>
      <a className="presence-study-entry" href="?v=boop">
        Új tanulmány · Boop, a társad{" "}
        <span>Dinamikus navigáció és folytonos beszélgetés →</span>
      </a>
      <div className="comparison-controls">
        <span>UGORJ EGY TERÜLETRE</span>
        {[
          ...TABS,
          ["chat", "Chat", "message"],
          ["avatar", "Clay", "sparkles"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={page === id ? "selected" : ""}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="comparison-grid">
        {Object.entries(VERSIONS).map(([id, v]) => (
          <section className="study-column" key={id}>
            <div className="study-heading">
              <span>{v.letter} / 02</span>
              <h2>{v.name}</h2>
              <p>{v.description}</p>
              <a href={`?v=${id}#${page}`}>
                Megnyitom és végigjárom <Icon name="arrow-up-right" size={17} />
              </a>
            </div>
            <div className="comparison-device">
              <iframe
                key={id + page}
                src={`?v=${id}&embed=1#${page}`}
                title={v.name + " interaktív prototípus"}
              />
            </div>
          </section>
        ))}
      </div>
      <div className="lab-footer">
        <p>
          A két irány külön menti a változtatásaidat. A felső kis Mezo minden
          oldalon megnyitja a beszélgetést; az értesítések konkrét részletekre
          vezetnek.
        </p>
        <p>
          Az AI, a kamera és az üzenetek itt szemléltető mintafolyamatok. Az
          alkalmazásod adatait nem használják.
        </p>
      </div>
    </div>
  );
}
export function Explorer({ variant }) {
  const v = VERSIONS[variant],
    embedded = new URLSearchParams(location.search).has("embed");
  const [state, setState] = useState(() => load(variant)),
    [route, setRoute] = useState(current),
    [notice, setNotice] = useState(""),
    [typing, setTyping] = useState(false),
    [mood, setMood] = useState("idle");
  const page = route.page,
    scroller = useRef(null),
    positions = useRef(new Map()),
    returning = useRef(false),
    key = useRef(
      history.state?.mezoFull ? history.state.key : crypto.randomUUID(),
    ),
    depth = useRef(history.state?.mezoFull ? history.state.depth : 0),
    timer = useRef(null),
    toastTimer = useRef(null),
    moodTimer = useRef(null),
    stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    try {
      localStorage.setItem("mezo-full-v2-" + variant, JSON.stringify(state));
    } catch {}
  }, [state, variant]);
  useEffect(() => {
    history.replaceState(
      { mezoFull: true, key: key.current, depth: depth.current },
      "",
      location.search + routeUrl(route.page, route.params),
    );
    const pop = () => {
      const entry = history.state;
      if (
        entry?.key === key.current &&
        routeUrl(current().page, current().params) === location.hash
      )
        return;
      positions.current.set(key.current, scroller.current?.scrollTop || 0);
      key.current = entry?.key || "first";
      depth.current = entry?.depth || 0;
      returning.current = true;
      setRoute(current());
    };
    addEventListener("popstate", pop);
    addEventListener("hashchange", pop);
    return () => {
      removeEventListener("popstate", pop);
      removeEventListener("hashchange", pop);
      clearTimeout(timer.current);
      clearTimeout(toastTimer.current);
      clearTimeout(moodTimer.current);
    };
  }, []);
  useLayoutEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = returning.current
        ? positions.current.get(key.current) || 0
        : 0;
    returning.current = false;
  }, [route]);
  function go(next, params = {}) {
    next = ALIASES[next] || next;
    if (!ROUTES[next]) {
      toast("Ez a nézet nem található");
      return;
    }
    if (routeUrl(page, route.params) === routeUrl(next, params)) return;
    positions.current.set(key.current, scroller.current?.scrollTop || 0);
    key.current = crypto.randomUUID();
    depth.current++;
    history.pushState(
      { mezoFull: true, key: key.current, depth: depth.current },
      "",
      location.search + routeUrl(next, params),
    );
    setRoute({ page: next, params });
  }
  function back() {
    if (depth.current > 0) history.back();
    else {
      const next = { page: ROUTES[page].parent || "home", params: {} };
      history.replaceState(
        { mezoFull: true, key: key.current, depth: 0 },
        "",
        location.search + routeUrl(next.page),
      );
      setRoute(next);
    }
  }
  function toast(t) {
    setNotice(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 3500);
  }
  function celebrate() {
    setMood("happy");
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 2200);
  }
  function send(text) {
    if (!text.trim() || typing) return;
    const answer = contextualReply(text, stateRef.current);
    setState((s) => ({
      ...s,
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "user", text: text.trim() },
      ],
    }));
    setTyping(true);
    setMood("thinking");
    timer.current = setTimeout(() => {
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: "assistant", ...answer },
        ],
      }));
      setTyping(false);
      setMood("idle");
    }, 750);
  }
  const dispatch = (a) => setState((s) => reduce(s, a)),
    totals = nutrition(state);
  const api = {
    variant,
    state,
    params: route.params,
    go,
    back,
    toast,
    celebrate,
    typing,
    mood,
    send,
    ask: (text) => {
      go("chat");
      send(text);
    },
    nutrition: totals,
    remaining: Math.max(0, state.fuel.targets.kcal - totals.kcal),
    update: (domain, updater) =>
      setState((s) => updateSlice(s, domain, updater)),
    notify: (n) => setState((s) => addNotification(s, n)),
    addMeal: (food) => setState((s) => addExplorationMeal(s, food)),
    logFood: (food) => {
      setState((s) =>
        addExplorationMeal(s, { ...food, id: crypto.randomUUID() }),
      );
      go("fuel");
      toast("Az étkezés bekerült a naplódba");
    },
    water: () => dispatch({ type: "water" }),
    toggleSet: (key) => dispatch({ type: "set", key }),
    setValue: (key, field, value) =>
      dispatch({ type: "setValue", key, field, value }),
    finishWorkout: () => {
      setState((s) => {
        if (s.workoutFinished) return s;
        const item = workoutRecord(s);
        return addNotification(
          {
            ...s,
            workoutFinished: true,
            training: {
              ...s.training,
              gymHistory: [item, ...s.training.gymHistory],
            },
          },
          {
            title: "A Pull Day a naplódban",
            body: "Megnézheted a sorozataid összegzését és a hetedet.",
            route: "train-gym-detail",
            params: { id: "gym-today" },
            kind: "training",
          },
        );
      });
      celebrate();
    },
    saveJournal: (text) => {
      dispatch({ type: "journal", text });
      toast("A gondolatod elmentve");
      celebrate();
    },
    completeRoutine: () => dispatch({ type: "routine" }),
    confirmPattern: () => dispatch({ type: "confirm" }),
    checkIn: (value) => {
      setState((s) => recordCheckIn(s, value));
      setMood("listening");
    },
    adjustDay: () => {
      setState((s) => ({
        ...s,
        companion: { ...s.companion, adjusted: true },
      }));
      toast("Ma a regenerációt helyezzük előtérbe");
    },
  };
  function reset() {
    clearTimeout(timer.current);
    setTyping(false);
    setMood("idle");
    setState(createExplorationState());
    go("home");
    toast("A mintanap újra az elejéről indul");
  }
  let tab = page;
  const seen = new Set();
  while (
    ROUTES[tab]?.parent &&
    !TABS.some(([id]) => id === tab) &&
    !seen.has(tab)
  ) {
    seen.add(tab);
    tab = ROUTES[tab].parent;
  }
  if (!TABS.some(([id]) => id === tab)) tab = "mezo";
  const isHub = TABS.some(([id]) => id === page),
    unread = state.personal.notifications.filter((n) => !n.read).length;
  let body =
    page === "home" ? (
      <Home api={api} />
    ) : page === "chat" ? (
      <Chat api={api} />
    ) : FUEL_ROUTES[page] ? (
      <FuelFlow page={page} api={api} />
    ) : TRAIN_ROUTES[page] ? (
      <TrainFlow page={page} api={api} />
    ) : PERSONAL_ROUTES[page] ? (
      <PersonalFlow page={page} api={api} />
    ) : INSIGHT_ROUTES[page] ? (
      <InsightFlow page={page} api={api} />
    ) : (
      <Details page={page} api={api} />
    );
  return (
    <div className={`prototype-workspace ${embedded ? "embedded" : ""}`}>
      {!embedded && (
        <aside className="lab-sidebar">
          <a href="/" className="lab-back">
            <Icon name="arrow-left" size={17} />
            Két irány
          </a>
          <div className="study-number">{v.letter} / 02</div>
          <h1>{v.name}</h1>
          <p>{v.description}</p>
          <div className="direction-switch">
            {Object.entries(VERSIONS).map(([id, a]) => (
              <a
                className={id === variant ? "selected" : ""}
                key={id}
                href={`?v=${id}${routeUrl(page, route.params)}`}
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
              ...TABS,
              ["patterns", "Minták"],
              ["character", "Karakter · rólad"],
              ["fuel-log", "AI ételnapló"],
              ["train-build", "Mezociklus építése"],
              ["notifications", "Értesítések"],
              ["avatar", "A kis Mezo"],
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
              <Icon name="rotate" size={15} />
              Mintanap visszaállítása
            </button>
            <p>
              Helyben mentett bemutató.
              <br />
              Előre megírt AI-válaszok.
              <br />
              Szeptember 8., kedd.
            </p>
          </div>
        </aside>
      )}
      <div className="device-wrap">
        {!embedded && (
          <div className="mobile-lab-bar">
            <a href="/">‹ Irányok</a>
            <span>{v.name} · prototípus</span>
            <button onClick={reset} aria-label="Mintanap visszaállítása">
              <Icon name="rotate" size={16} />
            </button>
          </div>
        )}
        <div
          data-clay-tone={state.companion.avatarTone}
          style={
            new URLSearchParams(location.search).get("width") === "360"
              ? { width: 360, maxWidth: "100%" }
              : undefined
          }
          className={`app-frame theme-measure ${variant === "companion" ? "theme-companion" : ""}`}
        >
          <header className="app-header">
            <div className="header-left">
              {isHub ? (
                <span className="wordmark">
                  <span className="brand-orb" />
                  mezo
                </span>
              ) : (
                <button
                  className="header-button"
                  onClick={back}
                  aria-label="Vissza az előző oldalra"
                >
                  <Icon name="arrow-left" />
                </button>
              )}
              <span className="app-title">{ROUTES[page].title}</span>
            </div>
            <div className="header-tools">
              <button
                className="header-button notification-bell"
                aria-label={`Értesítések, ${unread} olvasatlan`}
                onClick={() => go("notifications")}
              >
                <Icon name="bell" />
                {unread > 0 && <i />}
              </button>
              <button
                className="header-avatar"
                aria-label="Beszélgetés Mezóval"
                onClick={() => go("chat")}
              >
                <Avatar size={38} state={typing ? "thinking" : mood} />
              </button>
            </div>
          </header>
          <main
            ref={scroller}
            className={`app-content ${page === "chat" ? "is-chat" : ""}`}
          >
            <div className="page-enter" key={routeUrl(page, route.params)}>
              {body}
            </div>
          </main>
          <nav className="app-nav" aria-label="Fő navigáció">
            {TABS.map(([id, label, icon]) => (
              <button
                key={id}
                className={`nav-item ${tab === id ? "active" : ""}`}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => go(id)}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {tab === id && <i />}
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
            {variant === "companion"
              ? "Érzed, hogy figyel rád?"
              : "Tudod, mi következik?"}
          </h2>
          <p>
            Indulj el egy hétköznapi feladattal. Naplózz, pontosíts, tervezz —
            majd nézd meg, hogyan kapcsolódik vissza a napodhoz.
          </p>
          <div className="note-rule" />
          <p>
            Öt stabil hely.
            <br />
            Egyetlen fejléc.
            <br />
            Beszélgetés bárhonnan.
          </p>
          <button className="note-avatar" onClick={() => go("avatar")}>
            <Avatar size={112} />
            <span>
              A kis Mezo
              <br />
              <b>
                Ismerd meg <Icon name="arrow-right" size={14} />
              </b>
            </span>
          </button>
          <div className="note-rule" />
          <p>
            A Karakter oldalon a rólad alakuló kép szerepel. A kis Clay pedig az
            a társ, akivel végigjárod.
          </p>
        </aside>
      )}
    </div>
  );
}
function Home({ api }) {
  return api.variant === "companion" ? (
    <CompanionHome api={api} />
  ) : (
    <MeasureHome api={api} />
  );
}
function MeasureHome({ api }) {
  const s = api.state,
    sl = s.personal.sleep.latest;
  return (
    <div className="flow-page measure-home">
      <FlowHead
        eyebrow="KEDD, SZEPTEMBER 8."
        title={
          <>
            Jó alapok.
            <br />
            <em>Saját tempó.</em>
          </>
        }
        description="Ma az erősítésé a főszerep. Mellette maradjon hely az életnek is."
      />
      <section className="home-recovery">
        <div>
          <span className="flow-kicker">REGENERÁCIÓ · MINTAADAT</span>
          <strong>
            82<span>/100</span>
          </strong>
          <p>Stabil kiindulópont</p>
        </div>
        <Ring value={82} size={122} stroke={6} />
      </section>
      <div className="home-metrics">
        <button onClick={() => api.go("me-sleep")}>
          <Icon name="moon" size={17} />
          <b>
            {Math.floor(sl.minutes / 60)}
            <small>ó</small> {sl.minutes % 60}
            <small>p</small>
          </b>
          <span>utolsó alvás</span>
        </button>
        <button onClick={() => api.go("me-weight")}>
          <Icon name="scale" size={17} />
          <b>
            {s.personal.weight.latest}
            <small>kg</small>
          </b>
          <span>utolsó mérés</span>
        </button>
        <button onClick={() => api.go("fuel")}>
          <Icon name="utensils" size={17} />
          <b>
            {api.remaining}
            <small>kcal</small>
          </b>
          <span>a napi célból</span>
        </button>
      </div>
      <section className="home-next">
        <div>
          <span className="flow-kicker">
            {s.workoutFinished
              ? "MA MÁR MEGTETTED"
              : "A KÖVETKEZŐ LÉPÉS · 17:30"}
          </span>
          <h2>{s.workoutFinished ? "Pull Day ✓" : "Pull Day"}</h2>
          <p>
            {s.workoutFinished
              ? "Az edzésed a naplóban. Most tölts vissza."
              : "Hát & bicepsz · 45 perc"}
          </p>
          <button
            onClick={() => api.go(s.workoutFinished ? "fuel" : "workout")}
          >
            {s.workoutFinished ? "Étkezéseim" : "Edzés indítása"}
            <Icon name="arrow-right" size={17} />
          </button>
        </div>
        <WorkoutArt />
      </section>
      <section className="flow-section">
        <div className="flow-section-heading">
          <h2>A napod többi része</h2>
          <button className="text-button" onClick={() => api.go("week")}>
            A teljes hét <Icon name="arrow-right" size={14} />
          </button>
        </div>
        <div className="flow-list">
          <FlowRow
            icon="scan"
            title="Mi volt az utolsó étkezésed?"
            subtitle={`${s.meals.length} étkezés naplózva · szövegből vagy képmintából`}
            onClick={() => api.go("fuel-log")}
          />
          <FlowRow
            icon="droplet"
            title={`${(s.water / 1000).toFixed(2).replace(".", ",")} liter víz`}
            subtitle="Még egy pohár, +250 ml"
            value="+"
            onClick={api.water}
          />
          <FlowRow
            icon="sun"
            title="A kis szokások összeadódnak"
            subtitle="A mai rutinjaid és a következő apró lépés"
            onClick={() => api.go("me-routines")}
          />
          <FlowRow
            icon="users"
            title="Emberek, akik számítanak"
            subtitle="Kapcsolódások és közelgő alkalmak"
            onClick={() => api.go("me-people")}
          />
        </div>
      </section>
      <CompanionNote
        action="Megnézem a mintát"
        onClick={() => api.go("pattern", { id: "walk-sleep" })}
      >
        Az esti séták után másképp alakult az alvásod. Megnézzük, valóban
        jellemző-e rád?
      </CompanionNote>
      <WeeklyEntry api={api} />
    </div>
  );
}
function CompanionHome({ api }) {
  const s = api.state,
    suggestion = companionSuggestion(s),
    m = s.companion.checkin;
  return (
    <div className="flow-page companion-home">
      <div className="companion-greeting">
        <span className="flow-kicker">KEDD · A NAPUNK KÖZEPÉN</span>
        <h1>
          Szia, Daniel.
          <br />
          <em>Itt vagyok veled.</em>
        </h1>
        <div className="companion-stage">
          <span className="companion-orbit o1" />
          <span className="companion-orbit o2" />
          <i className="orbit-symbol os1">
            <Icon name="sun" size={21} />
          </i>
          <i className="orbit-symbol os2">
            <Icon name="dumbbell" size={21} />
          </i>
          <Avatar
            size={186}
            state={
              api.typing
                ? "thinking"
                : m === "tired"
                  ? "listening"
                  : m
                    ? "happy"
                    : "idle"
            }
          />
          <span className="companion-caption">
            {m === "tired"
              ? "A közérzeted is számít."
              : m === "busy"
                ? "Kis lépés is elég."
                : m === "ready"
                  ? "A te tempódban indulunk."
                  : "A naplód csak a történet egyik fele."}
          </span>
        </div>
        <h2>{m ? "Ezzel számolunk ma." : "Te hogy vagy most?"}</h2>
        <div className="checkin-choices">
          {[
            ["ready", "Jól vagyok", "sun"],
            ["tired", "Fáradtabban", "moon"],
            ["busy", "Sűrű a nap", "clock"],
          ].map(([id, t, i]) => (
            <button
              key={id}
              aria-pressed={m === id}
              className={m === id ? "selected" : ""}
              onClick={() => api.checkIn(id)}
            >
              <Icon name={i} size={18} />
              {t}
            </button>
          ))}
        </div>
      </div>
      <section className="companion-next">
        <span className="flow-kicker">
          {m ? "A VISSZAJELZÉSEDDEL EGYÜTT" : "A TERVED ALAPJÁN"}
        </span>
        <h2>{suggestion.title}</h2>
        <p>{suggestion.body}</p>
        <button
          className="primary-button"
          onClick={() => api.go(suggestion.page)}
        >
          {suggestion.action}
          <Icon name="arrow-right" size={18} />
        </button>
        {m === "tired" && !s.companion.adjusted && (
          <button className="text-button" onClick={api.adjustDay}>
            Ma a pihenés legyen előtérben
          </button>
        )}
        <button
          className="text-button"
          onClick={() =>
            api.ask(
              m === "tired"
                ? "Fáradtnak érzem magam. Nézzük meg a terhelésem."
                : "Beszéljük át, hogyan folytassam a napomat.",
            )
          }
        >
          Beszéljük át <Icon name="message" size={16} />
        </button>
      </section>
      <section className="flow-section quick-capture">
        <div className="flow-section-heading">
          <h2>Csak rögzítenék valamit</h2>
          <Icon name="plus" size={18} />
        </div>
        <div className="capture-tools">
          {[
            ["fuel-log", "Étel", "scan"],
            ["me-sleep-log", "Alvás", "moon"],
            ["me-weight-log", "Súly", "scale"],
            ["journal", "Gondolat", "book"],
          ].map(([p, t, i]) => (
            <button key={p} onClick={() => api.go(p)}>
              <Icon name={i} size={22} />
              <span>{t}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="companion-thread flow-section">
        <span className="flow-kicker">AMIT ÖSSZEKÖTÖTTÜNK</span>
        <h2>
          A sétád.
          <br />
          Az éjszakád.
          <br />
          <em>Egy lehetséges kapcsolat.</em>
        </h2>
        <Sparkline
          values={[62, 58, 70, 66, 78, 74, 85]}
          width={300}
          height={64}
        />
        <p>
          Van egy megfigyelésem. A te tapasztalatoddal együtt kaphat értelmet.
        </p>
        <button
          className="text-button"
          onClick={() => api.go("pattern", { id: "walk-sleep" })}
        >
          Megnézzük együtt <Icon name="arrow-right" size={17} />
        </button>
      </section>
      <div className="flow-list">
        <FlowRow
          icon="sun"
          title="A mai rutinod"
          subtitle="Egy apró szokás a következőhöz vezet"
          onClick={() => api.go("me-routines")}
        />
        <FlowRow
          icon="users"
          title="Kik vannak a napodban?"
          subtitle="Egy kis figyelem valakire, aki fontos"
          onClick={() => api.go("me-people")}
        />
        <FlowRow
          icon="droplet"
          title={`${s.water} ml víz a naplóban`}
          subtitle="Ittál egy pohárral? +250 ml"
          onClick={api.water}
        />
      </div>
      <WeeklyEntry api={api} />
    </div>
  );
}
function WeeklyEntry({ api }) {
  return (
    <section className="flow-section home-week">
      <div>
        <span className="flow-kicker">EGY HÉT. EGY TÖRTÉNET.</span>
        <h2>Nem csak egy mai szám.</h2>
        <p>Edzés, étkezés, pihenés — egymás mellett értelmezve.</p>
      </div>
      <div className="home-week-line">
        {["Sz", "Cs", "P", "Sz", "V", "H", "K"].map((d, i) => (
          <button
            aria-label={`Heti történet ${i + 1}. nap`}
            key={i}
            onClick={() =>
              api.go("week-day", {
                id: ["wed", "thu", "fri", "sat", "sun", "mon", "tue"][i],
              })
            }
          >
            <span>{d}</span>
            <i style={{ height: 18 + [25, 10, 34, 5, 15, 30, 23][i] }} />
          </button>
        ))}
      </div>
      <button className="text-button" onClick={() => api.go("week")}>
        A hetem története <Icon name="arrow-right" size={17} />
      </button>
    </section>
  );
}
