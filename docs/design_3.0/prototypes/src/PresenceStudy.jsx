import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, Icon, Sparkline, FoodArt, WorkoutArt } from "./shared.jsx";
import {
  ROLES,
  createPresence,
  selectRole,
  selectTab,
  recordPresenceCheckin,
  foodBudget,
  presenceReply,
  applyPresenceTool,
} from "./presence-model.mjs";
import "./presence.css";
const STORAGE = "mezo-presence-v1";
function readState() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE));
    return v?.checkins && v?.tabs && v?.messages
      ? { ...createPresence(), ...v }
      : createPresence();
  } catch {
    return createPresence();
  }
}
function readLocation() {
  const parts = location.hash.slice(1).split("?"),
    [, role = "home", tab] = parts[0].split("/");
  const r = ROLES[role] ? role : "home";
  return {
    role: r,
    tab: ROLES[r].tabs.some(([id]) => id === tab) ? tab : ROLES[r].tabs[0][0],
    panel: ["talk", "roles", "capture"].includes(
      new URLSearchParams(parts[1] || "").get("panel"),
    )
      ? new URLSearchParams(parts[1] || "").get("panel")
      : null,
  };
}
function urlFor(role, tab, panel) {
  return `#presence/${role}/${tab}${panel ? "?panel=" + panel : ""}`;
}
function Orb({ role, size = 70, state = "idle" }) {
  const r = ROLES[role];
  return (
    <span
      className="pr-orb"
      style={{
        "--clay-highlight": "#fff1e3",
        "--clay-light": r.light,
        "--clay-body": r.color,
        "--clay-shadow": r.shadow,
      }}
    >
      <Avatar size={size} state={state} />
    </span>
  );
}
export default function PresenceStudy() {
  const [s, setS] = useState(() => {
      let v = readState();
      if (location.hash.startsWith("#presence/")) {
        const r = readLocation();
        v = selectTab(selectRole(v, r.role), r.tab);
      } else v = selectTab(selectRole(v, "home"), "today");
      return v;
    }),
    [panel, setPanel] = useState(() => readLocation().panel),
    [typing, setTyping] = useState(false),
    [notice, setNotice] = useState(""),
    [mood, setMood] = useState("idle");
  const area = useRef(null),
    dialog = useRef(null),
    chatEnd = useRef(null),
    positions = useRef(new Map()),
    timer = useRef(null),
    toastTimer = useRef(null),
    moodTimer = useRef(null),
    latest = useRef(s),
    lastFocus = useRef(null),
    historyDepth = useRef(history.state?.presence ? history.state.depth : 0),
    sendLock = useRef(false);
  latest.current = s;
  const role = ROLES[s.role],
    tab = s.tabs[s.role],
    key = s.role + "/" + tab,
    budget = foodBudget(s);
  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(s));
  }, [s]);
  useEffect(() => {
    history.replaceState(
      { presence: true, depth: historyDepth.current },
      "",
      location.search + urlFor(s.role, tab, panel),
    );
    const pop = () => {
      const current = latest.current;
      positions.current.set(
        current.role + "/" + current.tabs[current.role],
        area.current?.scrollTop || 0,
      );
      const r = readLocation();
      historyDepth.current = history.state?.depth || 0;
      setS((v) => selectTab(selectRole(v, r.role), r.tab));
      setPanel(r.panel);
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
    if (area.current) area.current.scrollTop = positions.current.get(key) || 0;
  }, [key]);
  useEffect(() => {
    const d = dialog.current;
    if (panel) {
      lastFocus.current = document.activeElement;
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
      if (lastFocus.current?.isConnected) lastFocus.current.focus();
      else document.querySelector(".pr-role-toggle")?.focus();
    }
  }, [panel]);
  useEffect(() => {
    if (panel === "talk")
      chatEnd.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
  }, [s.messages.length, typing, panel]);
  function navigate(nextRole, nextTab, p = null, replace = false) {
    const t =
      nextTab || latest.current.tabs[nextRole] || ROLES[nextRole].tabs[0][0];
    if (!ROLES[nextRole]?.tabs.some(([id]) => id === t)) return;
    positions.current.set(key, area.current?.scrollTop || 0);
    setS((v) => selectTab(selectRole(v, nextRole), t));
    setPanel(p);
    if (!replace) historyDepth.current++;
    history[replace ? "replaceState" : "pushState"](
      { presence: true, depth: historyDepth.current },
      "",
      location.search + urlFor(nextRole, t, p),
    );
  }
  function open(p) {
    navigate(s.role, tab, p);
  }
  function close() {
    if (historyDepth.current > 0) history.back();
    else navigate(s.role, tab, null, true);
  }
  function back() {
    if (historyDepth.current > 0) history.back();
    else navigate("home", "today", null, true);
  }
  function toast(t) {
    setNotice(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 3000);
  }
  function celebrate() {
    setMood("happy");
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), 2200);
  }
  function send(text) {
    if (!text.trim() || sendLock.current) return;
    sendLock.current = true;
    const response = presenceReply(text, latest.current);
    setS((v) => ({
      ...v,
      draft: "",
      messages: [
        ...v.messages,
        { id: crypto.randomUUID(), role: "user", text: text.trim() },
      ],
    }));
    setTyping(true);
    timer.current = setTimeout(() => {
      setS((v) => ({
        ...applyPresenceTool(v, response.tool),
        messages: [
          ...v.messages,
          { id: crypto.randomUUID(), role: "assistant", ...response },
        ],
      }));
      setTyping(false);
      sendLock.current = false;
    }, 800);
  }
  function ask(text) {
    open("talk");
    if (text) send(text);
  }
  function pickTab(id) {
    if (s.role === "home" && id === "talk") return open("talk");
    if (s.role === "home" && id === "capture") return open("capture");
    navigate(s.role, id);
  }
  function reset() {
    clearTimeout(timer.current);
    sendLock.current = false;
    setTyping(false);
    setS(createPresence());
    positions.current.clear();
    navigate("home", "today", null, true);
    toast("A mintanap újraindult");
  }
  const api = { s, setS, budget, navigate, ask, toast, celebrate, open };
  return (
    <div
      className="presence-study"
      style={{
        "--pr-width":
          new URLSearchParams(location.search).get("width") === "360"
            ? "360px"
            : "430px",
      }}
    >
      <aside className="pr-study-note">
        <a href="/" className="pr-lab-link">
          ← Korábbi irányok
        </a>
        <span className="pr-eyebrow">MEZO / INTERAKCIÓS TANULMÁNY 05</span>
        <h1>
          Egy társ.
          <br />
          <em>Többféle tér.</em>
        </h1>
        <p>
          A beszélgetés folytonos.
          <br />A munkafelület ahhoz igazodik,
          <br />
          amivel éppen foglalkozol.
        </p>
        <div className="pr-note-rule" />
        <p className="pr-note-small">
          Kezdd egy check-innel. A lenti Mezo-buborékkal válts területet, majd
          térj vissza a beszélgetéshez.
        </p>
        <button onClick={reset}>
          <Icon name="rotate" size={15} />
          Mintanap újraindítása
        </button>
        <span className="pr-demo-label">
          Navigáció és kommunikáció.
          <br />
          Szemléltető adatok, előre írt AI-válaszok.
        </span>
      </aside>
      <div
        className="pr-device"
        style={{
          "--pr-accent": role.color,
          "--pr-tint": role.light,
          "--clay-highlight": "#fff1e3",
          "--clay-light": role.light,
          "--clay-body": role.color,
          "--clay-shadow": role.shadow,
        }}
      >
        <header className="pr-header">
          <div>
            {s.role === "home" ? (
              <span className="pr-wordmark">
                mezo<span>veled</span>
              </span>
            ) : (
              <>
                <button
                  className="pr-icon-button"
                  onClick={back}
                  aria-label="Vissza az előző helyre"
                >
                  <Icon name="arrow-left" size={20} />
                </button>
                <span className="pr-current-role">
                  <i />
                  {role.name}
                </span>
              </>
            )}
          </div>
          <button
            className="pr-chat-open"
            onClick={() => open("talk")}
            aria-label="Folytatom a beszélgetést"
          >
            <Icon name="message" size={20} />
            <span>Beszélgessünk</span>
          </button>
        </header>
        <main className="pr-main" ref={area}>
          <div key={key} className="pr-surface">
            {s.role === "home" ? (
              <Home api={api} mood={mood} />
            ) : (
              <Workspace api={api} />
            )}
          </div>
        </main>
        <nav className="pr-dock" aria-label="Aktuális terület navigációja">
          <button
            className={`pr-role-toggle ${panel === "roles" ? "is-open" : ""}`}
            onClick={() => open("roles")}
            aria-label={`Területváltás, most ${role.name}`}
            aria-haspopup="dialog"
          >
            <Orb role={s.role} size={49} state={mood} />
            <span>
              {s.role === "home" ? "Tereim" : role.short}
              <Icon name="chevron-down" size={10} />
            </span>
          </button>
          <div className="pr-dock-tabs" key={s.role}>
            {role.tabs.map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => pickTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={tab === id ? "active" : ""}
              >
                <Icon name={icon} size={19} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
        {notice && (
          <div className="pr-toast" role="status">
            <Icon name="check" size={16} />
            {notice}
          </div>
        )}
      </div>
      <aside className="pr-study-right">
        <span className="pr-eyebrow">UGYANAZ A MEZO</span>
        <div className="pr-role-line">
          {Object.entries(ROLES)
            .filter(([id]) => id !== "home")
            .map(([id, r]) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                aria-label={`${r.name} terület`}
                className={id === s.role ? "selected" : ""}
              >
                <Orb role={id} size={42} />
                <span>{r.name}</span>
              </button>
            ))}
        </div>
        <p>
          Helyet váltasz.
          <br />A történeted veled marad.
        </p>
        <div className="pr-note-rule" />
        <span className="pr-eyebrow">PRÓBÁLD KI A KAPCSOLATOT</span>
        <button
          className="pr-demo-prompt"
          onClick={() => ask("Mi lenne, ha elmaradna ma a röplabda?")}
        >
          „Mi lenne, ha elmaradna ma a röplabda?”
          <Icon name="arrow-up-right" size={17} />
        </button>
        <p className="pr-note-small">
          Előbb átbeszélitek. Átvezetés után az étkezési keret is követi a
          változást.
        </p>
      </aside>
      <dialog
        ref={dialog}
        className={`pr-dialog pr-dialog-${panel || "closed"}`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        style={{ "--pr-accent": role.color, "--pr-tint": role.light }}
        aria-label={
          panel === "talk"
            ? "Beszélgetés Mezóval"
            : panel === "roles"
              ? "Mezo terei"
              : "Gyors rögzítés"
        }
      >
        <div className="pr-dialog-body">
          {panel === "roles" ? (
            <>
              <div className="pr-sheet-handle" />
              <div className="pr-sheet-heading">
                <div>
                  <span className="pr-eyebrow">UGYANAZ A TÁRS</span>
                  <h2>Merre menjünk?</h2>
                </div>
                <button
                  autoFocus
                  className="pr-icon-button"
                  onClick={close}
                  aria-label="Területválasztó bezárása"
                >
                  <Icon name="x" />
                </button>
              </div>
              <p className="pr-sheet-copy">
                Válassz teret annak, amivel most foglalkozol.
              </p>
              <div className="pr-worlds">
                {Object.entries(ROLES).map(([id, r]) => (
                  <button
                    key={id}
                    className={id === s.role ? "selected" : ""}
                    onClick={() => navigate(id, undefined, null, true)}
                  >
                    <Orb
                      role={id}
                      size={id === "home" ? 58 : 68}
                      state={id === s.role ? "listening" : "idle"}
                    />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.description}</small>
                    </span>
                    <Icon
                      name={id === s.role ? "check" : "arrow-up-right"}
                      size={18}
                    />
                  </button>
                ))}
              </div>
              <p className="pr-sheet-footer">
                A közös emlékezet és a beszélgetés minden térben veled van.
              </p>
            </>
          ) : panel === "capture" ? (
            <>
              <div className="pr-sheet-handle" />
              <div className="pr-sheet-heading">
                <h2>Mit hozol a napodból?</h2>
                <button
                  autoFocus
                  className="pr-icon-button"
                  onClick={close}
                  aria-label="Rögzítésválasztó bezárása"
                >
                  <Icon name="x" />
                </button>
              </div>
              <div className="pr-capture-grid">
                {[
                  ["fuel", "log", "Étel", "utensils"],
                  ["life", "body", "Alvás és súly", "moon"],
                  ["life", "journal", "Gondolat vagy hála", "book"],
                  ["home", "today", "Check-in", "sun"],
                ].map(([r, t, label, icon]) => (
                  <button
                    key={label}
                    onClick={() => navigate(r, t, null, true)}
                  >
                    <Icon name={icon} size={25} />
                    <span>{label}</span>
                    <Icon name="arrow-up-right" size={17} />
                  </button>
                ))}
              </div>
              <button
                className="pr-secondary"
                onClick={() => navigate(s.role, tab, "talk", true)}
              >
                Inkább elmondom Mezónak
                <Icon name="message" size={18} />
              </button>
            </>
          ) : panel === "talk" ? (
            <>
              <header className="pr-talk-header">
                <Orb
                  role={s.role}
                  size={48}
                  state={typing ? "thinking" : "listening"}
                />
                <div>
                  <h2>Itt vagyok.</h2>
                  <span>Egy beszélgetés · {role.name}</span>
                </div>
                <button
                  autoFocus
                  className="pr-icon-button"
                  onClick={close}
                  aria-label="Vissza a munkafelületre"
                >
                  <Icon name="x" />
                </button>
              </header>
              <div className="pr-context-ribbon">
                <Icon name="layers" size={14} />
                <span>
                  {s.checkins.length} mai check-in · 3. hét · {budget.target}{" "}
                  kcal keret
                </span>
              </div>
              <div className="pr-talk-feed" aria-live="polite">
                {s.messages.map((m) => (
                  <article className={`pr-message ${m.role}`} key={m.id}>
                    {m.role === "assistant" && (
                      <span className="pr-message-author">MEZO</span>
                    )}
                    <p>{m.text}</p>
                    {m.sources && (
                      <details className="pr-sources">
                        <summary>
                          Miből indulok ki?
                          <Icon name="chevron-down" size={12} />
                        </summary>
                        <ul>
                          {m.sources.map((v) => (
                            <li key={v}>{v}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {m.tool && (
                      <div className="pr-tool-result">
                        <Icon name="check-circle" size={19} />
                        <div>
                          <strong>Átvezetve a mintanapban</strong>
                          <span>Sportnaptár → étkezési keret</span>
                        </div>
                      </div>
                    )}
                    {m.actions?.length > 0 && (
                      <div className="pr-message-actions">
                        {m.actions.map((a) => (
                          <button
                            key={a.label}
                            onClick={() => navigate(a.role, a.tab, null, true)}
                          >
                            {a.label}
                            <Icon name="arrow-up-right" size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.suggestion && (
                      <button
                        className="pr-message-suggestion"
                        disabled={typing}
                        onClick={() => send(m.suggestion)}
                      >
                        {m.suggestion}
                        <Icon name="arrow-right" size={16} />
                      </button>
                    )}
                  </article>
                ))}
                {typing && (
                  <div className="pr-thinking">
                    <Orb role={s.role} size={37} state="thinking" />
                    <span>Összekapcsolom a történetedet…</span>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <div className="pr-talk-bottom">
                <div className="pr-talk-starters">
                  {[
                    "Hogy fér össze a mai edzés és a közérzetem?",
                    "Mire emlékszel rólam?",
                    "Mi lenne, ha elmaradna ma a röplabda?",
                  ].map((t) => (
                    <button key={t} disabled={typing} onClick={() => send(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(s.draft);
                  }}
                >
                  <input
                    aria-label="Üzenet Mezónak"
                    placeholder="Nem kell az elejéről kezdened…"
                    value={s.draft}
                    onChange={(e) =>
                      setS((v) => ({ ...v, draft: e.target.value }))
                    }
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    aria-label="Üzenet küldése"
                    disabled={typing || !s.draft.trim()}
                  >
                    <Icon name="send" size={21} />
                  </button>
                </form>
                <span className="pr-chat-demo">
                  Interakciós minta · előre megírt válaszok
                </span>
              </div>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
function SectionTitle({ kicker, title, children }) {
  return (
    <div className="pr-section-title">
      <span className="pr-eyebrow">{kicker}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
function Row({ icon, title, sub, value, onClick }) {
  const C = onClick ? "button" : "div";
  return (
    <C className="pr-row" onClick={onClick}>
      <span className="pr-row-icon">
        <Icon name={icon} size={20} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
      {value ? (
        <b>{value}</b>
      ) : onClick ? (
        <Icon name="arrow-up-right" size={16} />
      ) : null}
    </C>
  );
}
function Home({ api, mood }) {
  const { s, setS, navigate, ask, celebrate, toast } = api;
  const [feeling, setFeeling] = useState(null),
    [note, setNote] = useState(""),
    [saved, setSaved] = useState(false);
  const next =
    ["Reggel", "Délben", "Délután", "Este"][s.checkins.length] || "Napközben";
  return (
    <div className="pr-home">
      <span className="pr-date">
        KEDD, SZEPTEMBER 8. <i /> 16:40
      </span>
      <div className="pr-home-hero">
        <div className="pr-halo pr-halo-a" />
        <div className="pr-halo pr-halo-b" />
        <Orb role="home" size={144} state={feeling ? "listening" : mood} />
        <span>Mezo veled</span>
      </div>
      <h1>
        {saved ? (
          <>
            Köszönöm, hogy
            <br />
            <em>elhoztad magad.</em>
          </>
        ) : (
          <>
            Hogy vagy most,
            <br />
            <em>Daniel?</em>
          </>
        )}
      </h1>
      <p className="pr-home-sub">
        {saved
          ? "Ez is része a mai történetednek."
          : "A napod számai mellett te is itt vagy."}
      </p>
      <div
        className="pr-day-rhythm"
        aria-label={`${Math.min(4, s.checkins.length)} a négy napi bejelentkezésből`}
      >
        {["Reggel", "Délben", "Délután", "Este"].map((label, i) => (
          <div
            key={label}
            className={
              i < s.checkins.length
                ? "done"
                : i === s.checkins.length
                  ? "next"
                  : ""
            }
          >
            <i>
              {i < s.checkins.length ? <Icon name="check" size={11} /> : null}
            </i>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!saved ? (
        <div className="pr-checkin">
          <span className="pr-eyebrow">{next} · EGY PILLANAT MAGADRA</span>
          <div className="pr-feelings">
            {[
              ["good", "Jól vagyok", "sun"],
              ["busy", "Tele a fejem", "wind"],
              ["tired", "Fáradtabban", "moon"],
            ].map(([id, t, icon]) => (
              <button
                key={id}
                aria-pressed={id === feeling}
                onClick={() => setFeeling(id)}
              >
                <Icon name={icon} size={20} />
                <span>{t}</span>
              </button>
            ))}
          </div>
          {feeling && (
            <div className="pr-checkin-note">
              <textarea
                aria-label="Egy mondat a közérzetedről"
                placeholder="Van mögötte valami? Egy mondat is elég. (Opcionális)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
              <button
                className="pr-primary"
                onClick={() => {
                  setS((v) => recordPresenceCheckin(v, feeling, note));
                  setSaved(true);
                  celebrate();
                  toast("A check-in a mai kontextusod része lett");
                }}
              >
                Elteszem a napomba
                <Icon name="check" size={17} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="pr-checkin-saved">
          <Icon name="check-circle" size={21} />
          <span>{s.checkins.at(-1).note || "A közérzeted elmentve."}</span>
          <button
            onClick={() => {
              setSaved(false);
              setFeeling(null);
              setNote("");
            }}
          >
            Új bejelentkezés
          </button>
        </div>
      )}
      <button className="pr-conversation-invite" onClick={() => ask()}>
        <span className="pr-invite-icon">
          <Icon name="message" size={24} />
        </span>
        <span>
          <strong>Mi jár a fejedben?</strong>
          <small>Folytassuk onnan, ahol tartasz.</small>
        </span>
        <Icon name="arrow-up-right" size={20} />
      </button>
      <section className="pr-home-thread">
        <span className="pr-eyebrow">KÖZBEN AZ ÉLETED IS HALAD</span>
        <h2>
          Az apró részletek
          <br />
          <em>összeérnek.</em>
        </h2>
        <Row
          icon="dumbbell"
          title="Pull A · a 3. hétben"
          sub="A meglévő hypertrophy mezociklusod"
          value="17:30"
          onClick={() => navigate("movement", "gym")}
        />
        <Row
          icon="utensils"
          title={`${api.budget.target} kcal · mai mintakeret`}
          sub={
            s.training.sportActive
              ? "Az alapod és a röplabda együtt"
              : "A sportváltozás után frissítve"
          }
          onClick={() => navigate("fuel", "today")}
        />
        <Row
          icon="sparkles"
          title="Egy alakuló összefüggés"
          sub="Sűrű munkanapok, esti lelassulás"
          onClick={() => navigate("understanding", "patterns")}
        />
      </section>
      <p className="pr-quiet-foot">
        Nem mindenből lesz teendő.
        <br />
        Van, amit egyszerűen jó megosztani.
      </p>
    </div>
  );
}
function Workspace({ api }) {
  const { s, budget, navigate, ask } = api,
    tab = s.tabs[s.role],
    role = ROLES[s.role];
  return (
    <div className="pr-workspace">
      <div className="pr-workspace-intro">
        <SectionTitle kicker={role.eyebrow} title={role.name} />
        <Orb role={s.role} size={74} />
      </div>
      {s.role === "movement" ? (
        <>
          {tab === "today" ? (
            <>
              <p className="pr-lead">A sportjaid egy közös nap részei.</p>
              <div className="pr-focus-card pr-training-focus">
                <span className="pr-eyebrow">A MEGLÉVŐ PROGRAMOD</span>
                <h2>Őszi építkezés</h2>
                <p>Hypertrophy · 3 / 6. hét</p>
                <div className="pr-week-track">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <span
                      key={i}
                      className={i === 3 ? "current" : i < 3 ? "done" : ""}
                    >
                      {i < 3 ? <Icon name="check" size={13} /> : i}
                    </span>
                  ))}
                </div>
                <button onClick={() => navigate("movement", "gym")}>
                  A mezociklusom
                  <Icon name="arrow-right" size={17} />
                </button>
                <WorkoutArt />
              </div>
              <Row
                icon="dumbbell"
                title="Pull A"
                sub="Hát és bicepsz · a heti terv része"
                value="17:30"
              />
              <Row
                icon="activity"
                title="Röplabda"
                sub={
                  s.training.sportActive
                    ? "75 perc · tervezett"
                    : "Ma elmarad · átvezetve"
                }
                value={s.training.sportActive ? "19:00" : "—"}
                onClick={() => navigate("movement", "sport")}
              />
              <Bridge
                api={api}
                text="A mai sportterhelés az étkezési keretben is megjelenik."
                label="Táplálás"
                role="fuel"
                tab="today"
              />
            </>
          ) : tab === "gym" ? (
            <>
              <p className="pr-lead">A következetes munka íve.</p>
              <div className="pr-program-heading">
                <span>
                  3<span>/6</span>
                </span>
                <div>
                  <h2>Őszi építkezés</h2>
                  <p>Hypertrophy mezociklus</p>
                </div>
              </div>
              <div className="pr-program-days">
                {[
                  ["H", "Push A", "Teljesítve"],
                  ["K", "Pull A", "Ma · 17:30"],
                  ["Cs", "Láb A", "Következő"],
                  ["Szo", "Felsőtest", "Tervezett"],
                ].map(([d, t, sub]) => (
                  <div key={d} className={d === "K" ? "today" : ""}>
                    <b>{d}</b>
                    <span>
                      <strong>{t}</strong>
                      <small>{sub}</small>
                    </span>
                    <Icon name={d === "H" ? "check" : "dumbbell"} size={18} />
                  </div>
                ))}
              </div>
              <CompanionLine api={api}>
                A programodat, a naplózott sorozatokat és a sportjaidat együtt
                figyelem. A beszélgetés innen indul.
              </CompanionLine>
              <button
                className="pr-secondary"
                onClick={() =>
                  ask("Hogy fér össze a mai edzés és a közérzetem?")
                }
              >
                Beszéljük át a mai napot
                <Icon name="message" size={18} />
              </button>
            </>
          ) : tab === "sport" ? (
            <>
              <p className="pr-lead">A pályán is ugyanaz a tested dolgozik.</p>
              <div className="pr-sport-art">
                <Icon name="activity" size={65} />
                <span>Röplabda</span>
                <small>
                  {s.training.sportActive
                    ? "Ma · 19:00 · 75 perc"
                    : "Mai alkalom elmarad"}
                </small>
              </div>
              <Row
                icon="calendar"
                title="Kedd és csütörtök"
                sub="A megszokott sportheted"
              />
              <Bridge
                api={api}
                text={`${budget.sport} kcal sporthoz kapcsolt rész a mai mintakeretben.`}
                label="Étkezési összefüggés"
                role="fuel"
                tab="today"
              />
              <button
                className="pr-primary"
                onClick={() => ask("Mi lenne, ha elmaradna ma a röplabda?")}
              >
                Mi változik, ha ma elmarad?
                <Icon name="message" size={18} />
              </button>
            </>
          ) : (
            <>
              <p className="pr-lead">Futás a teljes terhelésed mellett.</p>
              <div className="pr-run-art">
                <svg
                  viewBox="0 0 300 120"
                  aria-label="Szemléltető futóútvonal"
                  role="img"
                >
                  <path
                    d="M10 90C50 15 100 130 143 45S219 35 280 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="3 7"
                  />
                  <circle cx="10" cy="90" r="6" fill="currentColor" />
                  <circle cx="280" cy="20" r="6" fill="currentColor" />
                </svg>
                <strong>
                  4,1 <small>km</small>
                </strong>
                <p>Legutóbbi könnyű kör · 29 perc</p>
              </div>
              <Row
                icon="run"
                title="Könnyű futás"
                sub="Beszélgetős tempó · szombat"
              />
              <CompanionLine api={api}>
                A futásodat is beleszámítjuk a mozgásod történetébe, az erősítés
                és a röplabda mellé.
              </CompanionLine>
            </>
          )}
        </>
      ) : s.role === "fuel" ? (
        <>
          {tab === "today" ? (
            <>
              <p className="pr-lead">A célod együtt mozog a napoddal.</p>
              <div className="pr-fuel-total">
                <span className="pr-eyebrow">MAI ENERGIAKERET</span>
                <strong>
                  {budget.target}
                  <small> kcal</small>
                </strong>
                <div className="pr-budget-bar">
                  <i
                    style={{
                      width: (budget.logged / budget.target) * 100 + "%",
                    }}
                  />
                </div>
                <span>
                  {budget.logged} kcal naplózva{" "}
                  <b>{budget.remaining} kcal maradt</b>
                </span>
              </div>
              <div className="pr-budget-equation">
                <span>
                  <b>{budget.base}</b>alapkeret
                </span>
                <i>+</i>
                <span className={!s.training.sportActive ? "muted" : ""}>
                  <b>{budget.sport}</b>mai sport
                </span>
                <i>=</i>
                <span>
                  <b>{budget.target}</b>mai cél
                </span>
              </div>
              <p className="pr-small-note">
                Szemléltető összefüggés, nem személyre számított táplálkozási
                előírás.
              </p>
              <Bridge
                api={api}
                text={
                  s.training.sportActive
                    ? "A mai röplabdád is része ennek a keretnek."
                    : "A röplabda elmaradását a keret is követte."
                }
                label="Mai mozgás"
                role="movement"
                tab="sport"
              />
              <Row
                icon="utensils"
                title="Étkezési naplóm"
                sub="Reggeli, ebéd és a köztük lévő apróságok"
                onClick={() => navigate("fuel", "log")}
              />
            </>
          ) : tab === "log" ? (
            <>
              <p className="pr-lead">A teljes napod egy asztalnál.</p>
              <div className="pr-food-scene">
                <FoodArt kind="bowl" />
              </div>
              {[
                ["07:50", "Joghurtos zab", "420 kcal"],
                ["12:40", "Csirkés rizstál", "680 kcal"],
                ["15:10", "Gyümölcs és mandula", "340 kcal"],
              ].map(([t, n, k]) => (
                <Row key={t} icon="utensils" title={n} sub={t} value={k} />
              ))}
              <button
                className="pr-primary"
                onClick={() =>
                  ask("Nézzük át a mai étkezésemet a sport mellett.")
                }
              >
                Beszéljünk az étkezésemről
                <Icon name="message" size={18} />
              </button>
            </>
          ) : tab === "recipes" ? (
            <>
              <p className="pr-lead">Ötletek a valódi napjaidhoz.</p>
              <div className="pr-recipe-cover">
                <FoodArt kind="salmon" />
                <span>ESTÉRE</span>
                <h2>Citromos lazactál</h2>
                <p>25 perc · a kamrádból indulva</p>
              </div>
              <Bridge
                api={api}
                text="Az otthoni alapanyagaid a receptválasztásnál is számítanak."
                label="Kamrám"
                role="fuel"
                tab="pantry"
              />
            </>
          ) : (
            <>
              <p className="pr-lead">Amiből otthon építkezhetsz.</p>
              {[
                ["box", "Barna rizs", "750 g"],
                ["utensils", "Görög joghurt", "400 g"],
                ["leaf", "Brokkoli", "300 g"],
                ["utensils", "Lazac", "2 adag"],
              ].map(([icon, n, v]) => (
                <Row
                  key={n}
                  icon={icon}
                  title={n}
                  sub="A bemutató kamrájában"
                  value={v}
                />
              ))}
              <Bridge
                api={api}
                text="A receptek és a napló ugyanazokra az alapanyagokra épülnek."
                label="Receptötletek"
                role="fuel"
                tab="recipes"
              />
            </>
          )}
        </>
      ) : s.role === "life" ? (
        <Life api={api} />
      ) : (
        <Understanding api={api} />
      )}
    </div>
  );
}
function Bridge({ api, text, label, role, tab }) {
  return (
    <button className="pr-bridge" onClick={() => api.navigate(role, tab)}>
      <Orb role={role} size={36} />
      <span>
        <small>{text}</small>
        <strong>
          {label}
          <Icon name="arrow-up-right" size={14} />
        </strong>
      </span>
    </button>
  );
}
function CompanionLine({ api, children }) {
  return (
    <div className="pr-companion-line">
      <Orb role={api.s.role} size={40} />
      <p>{children}</p>
    </div>
  );
}
function Life({ api }) {
  const { s, setS, navigate, ask, toast } = api,
    tab = s.tabs.life;
  return tab === "today" ? (
    <>
      <p className="pr-lead">Nem csak az számít, mit teljesítettél.</p>
      <div className="pr-life-note">
        <span className="pr-eyebrow">A LEGUTÓBBI SZAVAID</span>
        <blockquote>
          „{s.checkins.at(-1).note || "Most így vagyok."}”
        </blockquote>
        <span>{s.checkins.at(-1).slot} · check-in</span>
      </div>
      <Row
        icon="sun"
        title={`${s.checkins.length} mai bejelentkezés`}
        sub="Reggel, délben, délután és este"
        onClick={() => navigate("home", "today")}
      />
      <Row
        icon="book"
        title="Napló és hála"
        sub="Szabad szöveg. A saját hangodon."
        onClick={() => navigate("life", "journal")}
      />
      <Row
        icon="moon"
        title="Alvás és súly"
        sub="Mérések a közérzet mellé"
        onClick={() => navigate("life", "body")}
      />
      <Row
        icon="heart"
        title="Rutinok és kapcsolatok"
        sub="Ami megtart a hétköznapokban"
        onClick={() => navigate("life", "goals")}
      />
    </>
  ) : tab === "journal" ? (
    <>
      <p className="pr-lead">Itt nem kell szépen megfogalmaznod.</p>
      <label className="pr-journal-field">
        Mi van most benned?
        <textarea
          value={s.journal}
          onChange={(e) => setS((v) => ({ ...v, journal: e.target.value }))}
          placeholder="Ami foglalkoztat, ami nehéz, ami jólesett…"
          maxLength={4000}
        />
      </label>
      <label className="pr-journal-field">
        Miért vagy ma hálás?
        <textarea
          value={s.gratitude}
          onChange={(e) => setS((v) => ({ ...v, gratitude: e.target.value }))}
          placeholder="Egy egészen kis dolog is lehet."
          maxLength={2000}
        />
      </label>
      <span className="pr-saved-note">
        <Icon name="check" size={13} />
        Helyben, írás közben megőrizve
      </span>
      <button
        className="pr-primary"
        onClick={() => ask("Szeretnék beszélni arról, ami ma foglalkoztat.")}
      >
        Beszélgetnék róla
        <Icon name="message" size={18} />
      </button>
    </>
  ) : tab === "body" ? (
    <>
      <p className="pr-lead">A tested jelzései is hozzád tartoznak.</p>
      <div className="pr-body-pair">
        <div>
          <Icon name="moon" />
          <strong>
            7 <small>ó</small> 50 <small>p</small>
          </strong>
          <span>Legutóbbi alvás</span>
        </div>
        <div>
          <Icon name="scale" />
          <strong>
            81,4 <small>kg</small>
          </strong>
          <span>Legutóbbi mérés</span>
        </div>
      </div>
      <Sparkline
        values={[81.9, 82, 81.8, 81.7, 81.6, 81.5, 81.4]}
        width={320}
        height={95}
      />
      <p className="pr-small-note">
        Minta a naplóid áttekintésére. A mérési űrlapok ebben a navigációs
        tanulmányban nem szerepelnek.
      </p>
      <CompanionLine api={api}>
        Az alvás és a súly a mozgásoddal, az étkezéseiddel és a közérzeteddel
        együtt adnak képet.
      </CompanionLine>
      <button
        className="pr-secondary"
        onClick={() => ask("Mire emlékszel rólam a naplóim alapján?")}
      >
        A tágabb összefüggés
        <Icon name="message" size={18} />
      </button>
    </>
  ) : (
    <>
      <p className="pr-lead">Amiért jó elindulni reggel.</p>
      <div className="pr-goal-art">
        <Icon name="sun" size={41} />
        <h2>
          Erősen jelen lenni
          <br />a saját életemben.
        </h2>
        <p>Egy életcél a bemutatóban</p>
      </div>
      <Row
        icon="target"
        title="Tartható mozgásritmus"
        sub="Az erő építése hosszabb távon"
      />
      <Row
        icon="users"
        title="Több valódi közös idő"
        sub="Máté · szombati kávé"
      />
      <Row
        icon="moon"
        title="Nyugodtabb esték"
        sub="Telefon félre, néhány sor napló"
      />
      <button
        className="pr-secondary"
        onClick={() => ask("Beszélgessünk arról, mi fontos nekem most.")}
      >
        Mi fontos nekem most?
        <Icon name="message" size={18} />
      </button>
    </>
  );
}
function Understanding({ api }) {
  const { s, navigate, ask } = api,
    tab = s.tabs.understanding;
  return tab === "patterns" ? (
    <>
      <p className="pr-lead">A részletekből lassan kirajzolódik valami.</p>
      <div className="pr-pattern-study">
        <span className="pr-eyebrow">ALAKULÓ MEGFIGYELÉS</span>
        <h2>
          A sűrű napok után
          <br />
          nehezebb lelassulni?
        </h2>
        <Sparkline
          values={[30, 50, 40, 75, 60, 85, 64]}
          width={300}
          height={80}
        />
        <p>
          Check-inek és esti napló · szemléltető összefüggés, még nem
          megerősített tudás.
        </p>
      </div>
      <CompanionLine api={api}>
        A mintát a saját tapasztalatoddal együtt értelmezzük. Együttjárásból
        önmagában nem lesz biztos következtetés.
      </CompanionLine>
      <button
        className="pr-primary"
        onClick={() => ask("Mit tudsz rólam a minták és a naplóim alapján?")}
      >
        Beszéljük át
        <Icon name="message" size={18} />
      </button>
    </>
  ) : tab === "memory" ? (
    <>
      <p className="pr-lead">Nem kell minden alkalommal újrakezdenünk.</p>
      <div className="pr-memory-layers">
        {[
          ["01", "Most", "A mai nap, a check-inek és ez a beszélgetés."],
          [
            "02",
            "Emlékek",
            "Edzések, étkezések, naplórészletek, kapcsolódások.",
          ],
          [
            "03",
            "Közös tudás",
            "Megerősített minták, preferenciák és életcélok.",
          ],
          [
            "04",
            "Alakuló kép",
            "A rólad épülő többoldalú profil, javítható állításokkal.",
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <p className="pr-small-note">
        A memória szerepeinek szemléltetése; itt nem fut háttérfeldolgozás.
      </p>
      <Bridge
        api={api}
        text="Az emlékezetből áll össze a tágabb kép, a te visszajelzéseiddel."
        label="Karakter"
        role="understanding"
        tab="profile"
      />
    </>
  ) : tab === "profile" ? (
    <>
      <p className="pr-lead">Több vagy, mint egyetlen mutató.</p>
      <div className="pr-profile-orbit">
        <Orb role="understanding" size={92} />
        {[
          ["Fizikai", "dumbbell"],
          ["Mentális", "brain"],
          ["Szociális", "users"],
          ["Egészségi", "heart"],
          ["Lelki", "sun"],
        ].map(([t, i], n) => (
          <span style={{ "--n": n }} key={t}>
            <Icon name={i} size={20} />
            <small>{t}</small>
          </span>
        ))}
      </div>
      <p className="pr-profile-caption">
        Egy közös történet.
        <br />
        Öt egymáshoz kapcsolódó nézőpont.
      </p>
      <CompanionLine api={api}>
        A rólad alakuló kép nem végleges címke. A saját szavaid és
        visszajelzéseid mindig részei maradnak.
      </CompanionLine>
      <button
        className="pr-secondary"
        onClick={() => ask("Miből épül a rólam alakuló profil?")}
      >
        Miből áll össze?
        <Icon name="message" size={18} />
      </button>
    </>
  ) : (
    <>
      <p className="pr-lead">Lehetőségek, amelyeket együtt mérlegelünk.</p>
      <div className="pr-outlook">
        <Icon name="sparkles" size={32} />
        <h2>
          Mi könnyíthetné
          <br />a következő hetedet?
        </h2>
        <p>
          A visszatérő megfigyelésekből beszélgetésre hívó javaslat lesz. A
          mezociklusod, az étkezésed és a jólléted együtt marad a képben.
        </p>
      </div>
      <button
        className="pr-primary"
        onClick={() => ask("Hogy fér össze a mai edzés és a közérzetem?")}
      >
        Nézzük együtt a lehetőségeket
        <Icon name="message" size={18} />
      </button>
      <p className="pr-small-note">
        Szemléltető irány, nem automatikus diagnózis vagy kész tervmódosítás.
      </p>
    </>
  );
}
