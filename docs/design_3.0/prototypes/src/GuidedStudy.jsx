import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, Avatar, Sparkline, Ring } from "./shared.jsx";
import {
  SPACES,
  createGuided,
  selectSpace,
  selectTab,
  greet,
  addWater,
  logMeal,
  startWorkout,
  toggleSet,
  finishWorkout,
  dismissCelebration,
  foodBudget,
  doneSets,
} from "./guided-model.mjs";
import clayIcons from "./clay-icons.svg?raw";
import claySpots from "./clay-spots.svg?raw";
import "./guided.css";

const STORAGE = "mezo-guided-v1";
function readState() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE));
    return v?.tabs && v?.meals && v?.workout ? { ...createGuided(), ...v } : createGuided();
  } catch {
    return createGuided();
  }
}
function readLocation() {
  const parts = location.hash.slice(1).split("?"),
    [, space = "nap", tab] = parts[0].split("/");
  const sp = SPACES[space] ? space : "nap";
  const panel = new URLSearchParams(parts[1] || "").get("panel");
  return {
    space: sp,
    tab: SPACES[sp].tabs.some(([id]) => id === tab) ? tab : SPACES[sp].tabs[0][0],
    panel: ["spaces", "capture"].includes(panel) ? panel : null,
  };
}
function urlFor(space, tab, panel) {
  return `#guided/${space}/${tab}${panel ? "?panel=" + panel : ""}`;
}
export function Clay({ id, size = 24, className = "" }) {
  return (
    <svg className={`gd-clay ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}
function ClayDefs() {
  return <span aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: clayIcons + claySpots }} />;
}
const hu = (n) => String(n).replace(".", ",");
const QUICK_MEALS = [
  { id: "q1", name: "Görög joghurt dióval", kcal: 180, protein: 12, icon: "i-snack" },
  { id: "q2", name: "Alma mogyoróvajjal", kcal: 210, protein: 6, icon: "i-snack" },
  { id: "q3", name: "Túrós palacsinta", kcal: 340, protein: 24, icon: "i-snack" },
  { id: "q4", name: "Lazacos vacsora", kcal: 560, protein: 42, icon: "i-vacsora" },
];

export default function GuidedStudy() {
  const [s, setS] = useState(() => {
    let v = readState();
    const r = location.hash.startsWith("#guided/") ? readLocation() : { space: "nap", tab: "ma" };
    return selectTab(selectSpace(v, r.space), r.tab);
  });
  const [panel, setPanel] = useState(() => readLocation().panel);
  const [notice, setNotice] = useState("");
  const area = useRef(null),
    dialog = useRef(null),
    positions = useRef(new Map()),
    toastTimer = useRef(null),
    lastFocus = useRef(null),
    latest = useRef(s),
    historyDepth = useRef(history.state?.guided ? history.state.depth : 0);
  latest.current = s;
  const space = SPACES[s.space],
    tab = s.tabs[s.space],
    key = s.space + "/" + tab,
    budget = foodBudget(s);
  const viewKey = useRef(key);
  viewKey.current = key;
  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(s));
  }, [s]);
  useEffect(() => {
    history.replaceState({ guided: true, depth: historyDepth.current }, "", location.search + urlFor(s.space, tab, panel));
    const pop = () => {
      positions.current.set(viewKey.current, area.current?.scrollTop || 0);
      const r = readLocation();
      historyDepth.current = history.state?.depth || 0;
      setS((v) => selectTab(selectSpace(v, r.space), r.tab));
      setPanel(r.panel);
    };
    addEventListener("popstate", pop);
    return () => {
      removeEventListener("popstate", pop);
      clearTimeout(toastTimer.current);
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
    }
  }, [panel]);
  function navigate(nextSpace, nextTab, p = null, replace = false) {
    const t = nextTab || latest.current.tabs[nextSpace] || SPACES[nextSpace].tabs[0][0];
    if (!SPACES[nextSpace]?.tabs.some(([id]) => id === t)) return;
    positions.current.set(key, area.current?.scrollTop || 0);
    setS((v) => selectTab(selectSpace(v, nextSpace), t));
    setPanel(p);
    if (!replace) historyDepth.current++;
    history[replace ? "replaceState" : "pushState"]({ guided: true, depth: historyDepth.current }, "", location.search + urlFor(nextSpace, t, p));
  }
  function open(p) {
    navigate(s.space, tab, p);
  }
  function close() {
    if (historyDepth.current > 0) history.back();
    else {
      setPanel(null);
      history.replaceState({ guided: true, depth: 0 }, "", location.search + urlFor(s.space, tab, null));
    }
  }
  function back() {
    if (historyDepth.current > 0) history.back();
    else navigate("nap", "ma", null, true);
  }
  function toast(t) {
    setNotice(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 2600);
  }
  function reset() {
    setS(createGuided());
    positions.current.clear();
    navigate("nap", "ma", null, true);
    toast("A mintanap újraindult");
  }
  const api = { s, setS, budget, navigate, open, back, toast };
  const workoutActive = s.workout.status === "active";
  return (
    <div className="guided-study" style={{ "--gd-width": new URLSearchParams(location.search).get("width") === "360" ? "360px" : "430px" }}>
      <ClayDefs />
      <aside className="gd-note">
        <a href="/" className="gd-lab-link">← Korábbi irányok</a>
        <span className="gd-eyebrow">VEZETETT NAP · 1. KÖR</span>
        <h1>Hol tartok.<br /><em>Mi fontos most.</em></h1>
        <p>Design 2.0 színek és clay ikonok, a Boop dinamikus dokkja, társ a kulcspillanatokban.</p>
        <button onClick={reset}><Icon name="rotate" size={15} /> Mintanap újraindítása</button>
        <span className="gd-demo-label">Szemléltető adatok.<br />4 kulcsjelenet, a többi később.</span>
      </aside>
      <div className="gd-device" style={{ "--sp": space.color, "--sp-deep": space.deep, "--sp-wash": space.wash }}>
        <header className="gd-header">
          {s.space === "nap" && tab === "ma" ? (
            <div className="gd-brand">
              <span className="gd-wordmark">mezo<span>.</span></span>
              <span className="gd-date">szeptember 9. kedd</span>
            </div>
          ) : (
            <div className="gd-brand">
              <button className="gd-icon-button" onClick={back} aria-label="Vissza az előző helyre">
                <Icon name="arrow-left" size={20} />
              </button>
              <span className="gd-place">{space.name}{tab !== space.tabs[0][0] ? " · " + space.tabs.find(([id]) => id === tab)[1] : ""}</span>
            </div>
          )}
          <button className="gd-header-orb" onClick={() => navigate("nap", "ma")} aria-label="Vissza a naphoz">
            <Avatar size={34} state={s.celebration ? "happy" : "idle"} />
          </button>
        </header>
        <main className="gd-main" ref={area}>
          <div key={key} className="gd-surface">
            <Page api={api} />
          </div>
        </main>
        {workoutActive && s.space !== "train" && (
          <button className="gd-shelf" onClick={() => navigate("train", "ma")}>
            <Clay id="i-edzes" size={26} />
            <span><strong>{s.workout.name} folyamatban</strong><small>{doneSets(s)}/{s.workout.sets.length} gyakorlat kész</small></span>
            <Icon name="chevron-right" size={18} />
          </button>
        )}
        <nav className="gd-dock" aria-label="Területek">
          <button className={`gd-orb-toggle ${panel === "spaces" ? "is-open" : ""}`} onClick={() => open("spaces")} aria-label={`Területváltás, most ${space.name}`} aria-haspopup="dialog">
            <span className="gd-orb"><Avatar size={46} state={panel === "spaces" ? "listening" : "idle"} /></span>
            <span className="gd-orb-label">{space.short}<Icon name="chevron-down" size={10} /></span>
          </button>
          <div className="gd-dock-tabs" key={s.space}>
            {space.tabs.map(([id, label, icon]) => (
              <button key={id} onClick={() => navigate(s.space, id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""}>
                <Clay id={icon} size={26} />
                <span>{label}</span>
              </button>
            ))}
            <button className="gd-capture" onClick={() => open("capture")} aria-label="Gyors rögzítés">
              <Icon name="plus" size={20} />
            </button>
          </div>
        </nav>
        {notice && (
          <div className="gd-toast" role="status"><Icon name="check" size={16} />{notice}</div>
        )}
        {s.celebration && (
          <div className="gd-celebrate" role="dialog" aria-label="Edzés lezárva">
            <div className="gd-celebrate-card">
              <Clay id="s-medal" size={92} className="gd-celebrate-medal" />
              <Avatar size={110} state="happy" />
              <h2>Ez megvolt, Daniel!</h2>
              <p>{s.workout.name} lezárva — {doneSets(s)}/{s.workout.sets.length} gyakorlat. A heti harmadik edzésed, a ritmusod kitart.</p>
              <button className="gd-primary" onClick={() => setS((v) => dismissCelebration(v))}>Köszönöm</button>
            </div>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className={`gd-dialog gd-dialog-${panel || "closed"}`}
        onCancel={(e) => { e.preventDefault(); close(); }}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        aria-label={panel === "spaces" ? "Területek" : "Gyors rögzítés"}
      >
        <div className="gd-dialog-body">
          {panel === "spaces" ? (
            <>
              <div className="gd-sheet-handle" />
              <div className="gd-sheet-heading">
                <div>
                  <span className="gd-eyebrow">UGYANAZ A TÁRS</span>
                  <h2>Merre menjünk?</h2>
                </div>
                <button autoFocus className="gd-icon-button" onClick={close} aria-label="Bezárás"><Icon name="x" /></button>
              </div>
              <div className="gd-spaces">
                {Object.entries(SPACES).map(([id, sp]) => (
                  <button key={id} className={id === s.space ? "selected" : ""} style={{ "--sp": sp.color, "--sp-wash": sp.wash }} onClick={() => navigate(id, undefined, null, true)}>
                    <Clay id={sp.icon} size={40} />
                    <span><strong>{sp.name}</strong></span>
                    <Icon name={id === s.space ? "check" : "chevron-right"} size={18} />
                  </button>
                ))}
              </div>
            </>
          ) : panel === "capture" ? (
            <>
              <div className="gd-sheet-handle" />
              <div className="gd-sheet-heading">
                <div>
                  <span className="gd-eyebrow">GYORS RÖGZÍTÉS</span>
                  <h2>Mit adjunk hozzá?</h2>
                </div>
                <button autoFocus className="gd-icon-button" onClick={close} aria-label="Bezárás"><Icon name="x" /></button>
              </div>
              <button className="gd-capture-water" onClick={() => { setS((v) => addWater(v)); toast("+250 ml víz rögzítve"); }}>
                <Clay id="i-viz" size={34} />
                <span><strong>+250 ml víz</strong><small>{s.water} / {s.waterTarget} ml ma</small></span>
                <Icon name="plus" size={18} />
              </button>
              <span className="gd-capture-kicker">Egy gyors étkezés</span>
              <div className="gd-quick-meals">
                {QUICK_MEALS.map((m) => (
                  <button key={m.id} onClick={() => { setS((v) => logMeal(v, { ...m, id: crypto.randomUUID() })); toast(`${m.name} · naplózva`); close(); }}>
                    <Clay id={m.icon} size={30} />
                    <span><strong>{m.name}</strong><small>{m.kcal} kcal · {m.protein} g fehérje</small></span>
                    <Icon name="plus" size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}

function Page({ api }) {
  const { s } = api;
  const tab = s.tabs[s.space];
  if (s.space === "nap") return tab === "het" ? <Week api={api} /> : <Today api={api} />;
  if (s.space === "train") return tab === "naplo" ? <TrainLog api={api} /> : <Train api={api} />;
  if (s.space === "fuel") return tab === "naplo" ? <FuelLog api={api} /> : <FuelBudget api={api} />;
  if (s.space === "mezo") return <Patterns api={api} />;
  if (s.space === "en") return s.tabs.en === "suly" ? <WeightPage api={api} /> : <Me api={api} />;
  return null;
}

function Today({ api }) {
  const { s, setS, budget, navigate, open, toast } = api;
  if (!s.greeted)
    return (
      <section className="gd-greeting">
        <Clay id="s-reggel" size={120} className="gd-greeting-spot" />
        <Avatar size={132} state="listening" />
        <h2>Szép reggelt, Daniel.</h2>
        <p>{s.sleep.hours} alvás után ébredtél, a heted jól halad. Ma egy dolog számít igazán: a délutáni edzésed.</p>
        <button className="gd-primary" onClick={() => setS((v) => greet(v))}>Kezdjük a napot</button>
        <button className="gd-text-button" onClick={() => setS((v) => greet(v))}>Most csak körülnézek</button>
      </section>
    );
  return (
    <>
      <section className="gd-directive" style={{ "--sp": SPACES.train.color, "--sp-deep": SPACES.train.deep, "--sp-wash": SPACES.train.wash }}>
        <span className="gd-eyebrow">MA EZ A FONTOS</span>
        <h2>{s.workout.status === "done" ? "Az edzés megvolt — este séta és nyugodt zárás." : `${s.workout.name} edzés ${s.workout.time}-kor`}</h2>
        <p>{s.workout.status === "done" ? `Szép munka. A keretedből ${budget.remaining} kcal maradt estére.` : `${s.workout.cycle}. A keretedből ${budget.remaining} kcal áll még rendelkezésre.`}</p>
        {s.workout.status !== "done" && (
          <button className="gd-primary" onClick={() => navigate("train", "ma")}>
            {s.workout.status === "active" ? "Vissza az edzéshez" : "Edzés megnyitása"} <Icon name="arrow-right" size={16} />
          </button>
        )}
      </section>
      <section className="gd-state-strip">
        <button onClick={() => navigate("en", "ma")}>
          <Clay id="i-alvas" size={30} />
          <strong>{s.sleep.hours}</strong>
          <small>alvás · {s.sleep.quality}/100</small>
        </button>
        <button onClick={() => navigate("en", "suly")}>
          <Clay id="i-suly" size={30} />
          <strong>{hu(s.weight.kg)} kg</strong>
          <small>{hu(s.weight.delta)} kg a héten</small>
        </button>
        <button onClick={() => { setS((v) => addWater(v)); toast("+250 ml víz rögzítve"); }}>
          <Clay id="i-viz" size={30} />
          <strong>{(s.water / 1000).toFixed(2).replace(".", ",")} l</strong>
          <small>koppints: +250 ml</small>
        </button>
      </section>
      <section className="gd-block">
        <span className="gd-kicker">MIT TEHETEK MOST</span>
        <div className="gd-action-rows">
          <button className="gd-row" onClick={() => open("capture")}>
            <Clay id="i-fuel" size={34} />
            <span><strong>Étkezés naplózása</strong><small>{budget.logged} / {budget.target} kcal ma</small></span>
            <Icon name="plus" size={18} />
          </button>
          <button className="gd-row" onClick={() => navigate("fuel", "keret")}>
            <Clay id="i-recept" size={34} />
            <span><strong>Mi férne még bele?</strong><small>keret és javaslatok</small></span>
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
      </section>
      <section className="gd-block">
        <span className="gd-kicker">MI VÁLTOZOTT</span>
        <button className="gd-insight" onClick={() => navigate("mezo", "mintak")}>
          <Clay id="i-minta" size={38} />
          <span><strong>{s.insight.title}</strong><small>{s.insight.body}</small></span>
          <Icon name="chevron-right" size={18} />
        </button>
        <button className="gd-week-teaser" onClick={() => navigate("nap", "het")}>
          <Clay id="i-heti" size={26} />
          <span>Heti visszatekintés</span>
          <Icon name="chevron-right" size={16} />
        </button>
      </section>
    </>
  );
}

function Week({ api }) {
  const { s } = api;
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">HETI VISSZATEKINTÉS</span>
        <h2>A ritmusod kitart.</h2>
        <p>{s.week.summary}</p>
      </section>
      <section className="gd-card">
        <span className="gd-kicker">ENERGIA A HÉTEN</span>
        <Sparkline values={s.week.energy} color="var(--sp)" height={72} fill />
        <div className="gd-spark-labels"><span>hétfő</span><span>vasárnap</span></div>
      </section>
      <section className="gd-stat-tiles">
        <div><Clay id="i-edzes" size={34} /><strong>{s.week.workouts}</strong><small>edzés</small></div>
        <div><Clay id="i-futas" size={34} /><strong>{hu(s.week.km)}</strong><small>km összesen</small></div>
        <div><Clay id="i-alvas" size={34} /><strong>{s.week.avgSleep}</strong><small>átlag alvás</small></div>
      </section>
      <section className="gd-card gd-medal-card">
        <Clay id="s-medal" size={64} />
        <span><strong>Csütörtök után visszataláltál</strong><small>Két nehéz nap jött, mégis megtartottad a heti három edzést.</small></span>
      </section>
    </>
  );
}

function Train({ api }) {
  const { s, setS, navigate } = api;
  const w = s.workout;
  if (w.status === "done")
    return (
      <>
        <section className="gd-hero">
          <span className="gd-eyebrow">MAI EDZÉS · LEZÁRVA</span>
          <h2>{w.name} megvolt.</h2>
          <p>{doneSets(s)}/{w.sets.length} gyakorlat rögzítve. {w.cycle}.</p>
        </section>
        <section className="gd-card gd-medal-card">
          <Clay id="s-medal" size={64} />
          <span><strong>Heti 3. edzés</strong><small>A blokkod terv szerint halad.</small></span>
        </section>
        <button className="gd-row" onClick={() => navigate("nap", "het")}>
          <Clay id="i-heti" size={34} />
          <span><strong>Heti visszatekintés</strong><small>hogyan áll össze a hét</small></span>
          <Icon name="chevron-right" size={18} />
        </button>
      </>
    );
  return (
    <>
      <section className="gd-hero gd-train-hero">
        <span className="gd-eyebrow">{w.cycle.toUpperCase()}</span>
        <h2>{w.name}</h2>
        <p>{w.status === "active" ? `Folyamatban · ${doneSets(s)}/${w.sets.length} gyakorlat kész` : `Ma ${w.time} · ${w.sets.length} gyakorlat · kb. 45 perc`}</p>
        {w.status === "planned" && (
          <button className="gd-primary" onClick={() => setS((v) => startWorkout(v))}>
            <Icon name="play" size={16} /> Edzés indítása
          </button>
        )}
      </section>
      <section className="gd-block">
        <span className="gd-kicker">{w.status === "active" ? "PIPÁLD, AMI MEGVAN" : "A MAI GYAKORLATOK"}</span>
        <div className="gd-sets">
          {w.sets.map((x) => (
            <button key={x.id} className={`gd-set ${x.done ? "done" : ""}`} disabled={w.status !== "active"} onClick={() => setS((v) => toggleSet(v, x.id))}>
              <span className="gd-set-check">{x.done ? <Icon name="check" size={15} /> : null}</span>
              <span><strong>{x.exercise}</strong><small>{x.detail}</small></span>
            </button>
          ))}
        </div>
      </section>
      {w.status === "active" && (
        <>
          <p className="gd-rest-hint">Pihenő a szettek közt: 90 mp — szólok, ha letelt.</p>
          <button className="gd-primary gd-finish" onClick={() => setS((v) => finishWorkout(v))}>Edzés lezárása</button>
        </>
      )}
    </>
  );
}

function TrainLog({ api }) {
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">EDZÉSNAPLÓ</span>
        <h2>Az elmúlt napok</h2>
      </section>
      <div className="gd-action-rows">
        {[
          ["Push A", "vasárnap · 52 perc", "i-edzes"],
          ["Futás · 6,2 km", "péntek · 34 perc", "i-futas"],
          ["Pull B", "csütörtök · 48 perc", "i-edzes"],
        ].map(([name, meta, icon]) => (
          <div key={name} className="gd-row gd-row-static">
            <Clay id={icon} size={34} />
            <span><strong>{name}</strong><small>{meta}</small></span>
          </div>
        ))}
      </div>
    </>
  );
}

function FuelBudget({ api }) {
  const { s, budget, open, navigate } = api;
  return (
    <>
      <section className="gd-fuel-hero">
        <Ring value={budget.logged} max={budget.target} size={148} width={11} color="var(--sp)" label="" />
        <div className="gd-fuel-hero-num">
          <strong>{budget.remaining}</strong>
          <small>kcal maradt</small>
        </div>
        <p>{budget.logged} kcal naplózva a mai {budget.target} kcal keretből. A keretben benne van a délutáni edzés is.</p>
        <button className="gd-primary" onClick={() => open("capture")}><Icon name="plus" size={16} /> Étkezés hozzáadása</button>
      </section>
      <section className="gd-block">
        <span className="gd-kicker">A MAI NAPLÓ</span>
        <div className="gd-action-rows">
          {s.meals.slice(-3).map((m) => (
            <div key={m.id} className="gd-row gd-row-static">
              <Clay id={m.icon} size={34} />
              <span><strong>{m.name}</strong><small>{m.time} · {m.kcal} kcal · {m.protein} g fehérje</small></span>
            </div>
          ))}
        </div>
        <button className="gd-week-teaser" onClick={() => navigate("fuel", "naplo")}>
          <Clay id="i-naplo" size={26} />
          <span>Teljes napló</span>
          <Icon name="chevron-right" size={16} />
        </button>
      </section>
    </>
  );
}

function FuelLog({ api }) {
  const { s, budget, open } = api;
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">ÉTKEZÉSI NAPLÓ · MA</span>
        <h2>{budget.logged} kcal</h2>
        <p>{s.meals.length} tétel · {budget.remaining} kcal maradt a keretből.</p>
      </section>
      <div className="gd-action-rows">
        {s.meals.map((m) => (
          <div key={m.id} className="gd-row gd-row-static">
            <Clay id={m.icon} size={34} />
            <span><strong>{m.name}</strong><small>{m.time} · {m.kcal} kcal · {m.protein} g fehérje</small></span>
          </div>
        ))}
      </div>
      <button className="gd-primary" onClick={() => open("capture")}><Icon name="plus" size={16} /> Étkezés hozzáadása</button>
    </>
  );
}

function Patterns({ api }) {
  const { s, navigate } = api;
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">FELISMERT MINTA</span>
        <h2>{s.insight.title}</h2>
        <p>{s.insight.body}</p>
      </section>
      <section className="gd-card">
        <span className="gd-kicker">MIRE ÉPÜL</span>
        <div className="gd-evidence">
          <div><strong>12</strong><small>megfigyelt nap</small></div>
          <div><strong>+34 p</strong><small>átlagos különbség</small></div>
          <div><strong>82%</strong><small>egybeesés</small></div>
        </div>
        <p className="gd-fineprint">Együttjárás, nem ok-okozat. A minta a te visszajelzéseiddel erősödik vagy gyengül.</p>
      </section>
      <button className="gd-row" onClick={() => navigate("nap", "het")}>
        <Clay id="i-heti" size={34} />
        <span><strong>Hogyan látszik a héten?</strong><small>heti visszatekintés</small></span>
        <Icon name="chevron-right" size={18} />
      </button>
    </>
  );
}

function Me({ api }) {
  const { s, navigate } = api;
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">ÉN · MA</span>
        <h2>Rendben vagy.</h2>
        <p>Az éjszakád és a tested főbb jelei egy helyen.</p>
      </section>
      <section className="gd-stat-tiles">
        <div><Clay id="i-alvas" size={34} /><strong>{s.sleep.hours}</strong><small>alvás</small></div>
        <div><Clay id="i-eletjel" size={34} /><strong>{s.sleep.quality}</strong><small>pihentség /100</small></div>
        <div><Clay id="i-viz" size={34} /><strong>{(s.water / 1000).toFixed(1).replace(".", ",")} l</strong><small>víz ma</small></div>
      </section>
      <button className="gd-row" onClick={() => navigate("en", "suly")}>
        <Clay id="i-suly" size={34} />
        <span><strong>Súly · {s.weight.kg} kg</strong><small>{hu(s.weight.delta)} kg a héten</small></span>
        <Icon name="chevron-right" size={18} />
      </button>
    </>
  );
}

function WeightPage({ api }) {
  const { s } = api;
  return (
    <>
      <section className="gd-hero">
        <span className="gd-eyebrow">SÚLY</span>
        <h2>{hu(s.weight.kg)} kg</h2>
        <p>{hu(s.weight.delta)} kg az elmúlt héten — lassú, tartható ütem.</p>
      </section>
      <section className="gd-card">
        <span className="gd-kicker">AZ UTOLSÓ 7 MÉRÉS</span>
        <Sparkline values={s.weight.series} color="var(--sp)" height={72} fill />
        <div className="gd-spark-labels"><span>{hu(s.weight.series[0])} kg</span><span>{hu(s.weight.kg)} kg</span></div>
      </section>
    </>
  );
}
