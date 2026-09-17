import React, { useEffect, useRef, useState } from "react";
import { BoopAvatar } from "./BoopIdentity.jsx";
import { DOMAINS, DOMAIN_ORDER, DEMO, greeting, addWater } from "./hybrid-model.mjs";
import "./hybrid.css";

/* ---- Production clay sprite-ok betöltése <use> hivatkozáshoz ---- */
function SpriteSheet() {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    Promise.all(
      ["clay-icons.svg", "clay-spots.svg"].map((f) =>
        fetch(import.meta.env.BASE_URL + f).then((r) => r.text()),
      ),
    ).then((parts) => setSvg(parts.join("")));
  }, []);
  return <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function ClayIcon({ id, size = 24, className = "" }) {
  return (
    <svg className={`hy-clay ${className}`} width={size} height={size} aria-hidden="true">
      <use href={`#${id}`} />
    </svg>
  );
}

/* ---- Útvonal: #hibrid/<domain>/<cél> ---- */
function readHash() {
  const [, d = "nap", dest] = (location.hash.replace(/^#/, "") || "hibrid").split("/");
  const domain = DOMAINS[d] ? d : "nap";
  const dests = DOMAINS[domain].dests.map(([id]) => id);
  return { domain, dest: dests.includes(dest) ? dest : dests[0] };
}
function urlFor(domain, dest) {
  return `#hibrid/${domain}/${dest}`;
}

/* ---- Kör-műszer (kcal ív, makró gyűrűk) ---- */
function Ring({ value, max, size = 56, stroke = 6, tone = "sage", children }) {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    frac = Math.max(0, Math.min(1, value / max));
  return (
    <span className={`hy-ring tone-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="hy-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="hy-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="hy-ring-label">{children}</span>
    </span>
  );
}

/* ---- Mozaik csempe ---- */
function Tile({ tone, eyebrow, spot, spotSize = 44, value, sub, onClick, action, delay = 0, wide }) {
  return (
    <button
      className={`hy-tile tone-${tone} ${wide ? "is-wide" : ""}`}
      style={{ "--d": `${delay}ms` }}
      onClick={onClick}
    >
      <span className="hy-tile-eyebrow">{eyebrow}</span>
      <span className="hy-tile-spot">
        <ClayIcon id={spot} size={spotSize} />
      </span>
      <span className="hy-tile-value">{value}</span>
      <span className="hy-tile-sub">{sub}</span>
      {action}
    </button>
  );
}

/* ---- Nap → Mai: teljes társ + a nap élő csempéi ---- */
function NapMai({ go }) {
  const [water, setWater] = useState(DEMO.water);
  const [happy, setHappy] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const [hello, line] = greeting(DEMO.daypart, DEMO.name);
  const pet = () => {
    clearTimeout(t.current);
    setHappy(true);
    t.current = setTimeout(() => setHappy(false), 1800);
  };
  return (
    <div className="hy-page hy-nap">
      <div className="hy-hero">
        <button className="hy-pet" onClick={pet} aria-label="Boop megsimogatása">
          <BoopAvatar size={132} state={happy ? "happy" : "idle"} />
        </button>
        <h1 className="hy-hello">{hello}</h1>
        <p className="hy-line">{happy ? "Boop! Ez jólesett." : line}</p>
      </div>
      <div className="hy-mosaic">
        <Tile
          tone="sky"
          eyebrow="Víz"
          spot="s-viz"
          spotSize={52}
          value={`${water.logged.toLocaleString("hu-HU")} L`}
          sub={`cél ${water.goal.toLocaleString("hu-HU")} L`}
          delay={40}
          action={
            <span
              className="hy-tile-action"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setWater(addWater(water));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  setWater(addWater(water));
                }
              }}
            >
              +2,5 dl
            </span>
          }
        />
        <Tile
          tone="lav"
          eyebrow="Alvás"
          spot="i-alvas"
          value={DEMO.sleep.text}
          sub={DEMO.sleep.note}
          delay={90}
          onClick={() => go("en", "alvas")}
        />
        <Tile
          tone="gold"
          eyebrow="Bevitel"
          spot="s-energia"
          spotSize={50}
          value={`${DEMO.fuel.eaten.toLocaleString("hu-HU")} kcal`}
          sub={`${(DEMO.fuel.goal - DEMO.fuel.eaten + DEMO.fuel.burned).toLocaleString("hu-HU")} maradt`}
          delay={140}
          onClick={() => go("fuel", "mai")}
        />
        <Tile
          tone="coral"
          eyebrow="Edzés"
          spot="s-edzes"
          spotSize={50}
          value={DEMO.train.title}
          sub={DEMO.train.detail}
          delay={190}
          onClick={() => go("edzes", "mai")}
        />
        <Tile
          tone="sage"
          eyebrow="Rutin"
          spot="i-rend"
          value={`${DEMO.routine.done}/${DEMO.routine.total}`}
          sub={DEMO.routine.note}
          delay={240}
          onClick={() => go("nap", "rutin")}
        />
        <Tile
          tone="rose"
          eyebrow="Napló"
          spot="i-memoar"
          value={`${DEMO.journal.count} bejegyzés`}
          sub={DEMO.journal.note}
          delay={290}
          onClick={() => go("en", "naplo")}
        />
      </div>
    </div>
  );
}

/* ---- Edzés → Mai: kompakt fejléc, nincs nagy társ ---- */
function EdzesMai() {
  return (
    <div className="hy-page">
      <header className="hy-task-head tone-sky">
        <ClayIcon id="s-edzes" size={44} />
        <div>
          <h1>Mai edzés</h1>
          <p>Pull Day · a heti terv 3. napja</p>
        </div>
      </header>
      <section className="hy-card tone-sky" style={{ "--d": "60ms" }}>
        <span className="hy-tile-eyebrow">Következik</span>
        {DEMO.train.exercises.map(([name, sets]) => (
          <div className="hy-row" key={name}>
            <span>{name}</span>
            <strong>{sets}</strong>
          </div>
        ))}
        <button className="hy-primary tone-sky">Edzés indítása</button>
      </section>
      <section className="hy-card" style={{ "--d": "140ms" }}>
        <span className="hy-tile-eyebrow">Heti terhelés</span>
        <div className="hy-spark">
          {[42, 65, 38, 80, 55, 0, 0].map((v, i) => (
            <i key={i} style={{ height: `${Math.max(6, v)}%` }} data-empty={v === 0} />
          ))}
        </div>
        <p className="hy-quiet">4 nap megvan · 2 pihenőnap van hátra</p>
      </section>
    </div>
  );
}

/* ---- Fuel → Mai: kompakt fejléc, egy domináns energiaműszer ---- */
function FuelMai() {
  const f = DEMO.fuel;
  const remaining = f.goal - f.eaten + f.burned;
  return (
    <div className="hy-page">
      <header className="hy-task-head tone-gold">
        <ClayIcon id="s-energia" size={44} />
        <div>
          <h1>Mai étkezés</h1>
          <p>
            {f.goal.toLocaleString("hu-HU")} − {f.eaten.toLocaleString("hu-HU")} +{" "}
            {f.burned.toLocaleString("hu-HU")} mozgás
          </p>
        </div>
      </header>
      <section className="hy-energy" style={{ "--d": "60ms" }}>
        <Ring value={f.eaten} max={f.goal + f.burned} size={128} stroke={10} tone="gold">
          <ClayIcon id="i-fuel" size={40} />
        </Ring>
        <div className="hy-energy-num">
          <strong>{remaining.toLocaleString("hu-HU")}</strong>
          <span>kcal maradt</span>
        </div>
      </section>
      <section className="hy-macros" style={{ "--d": "140ms" }}>
        {f.macros.map(([name, v, max, tone]) => (
          <div className="hy-macro" key={name}>
            <Ring value={v} max={max} tone={tone}>
              {v}
            </Ring>
            <span>{name}</span>
          </div>
        ))}
      </section>
      <button className="hy-primary tone-gold" style={{ "--d": "200ms" }}>
        <ClayIcon id="i-mikrofon" size={22} /> Étkezés naplózása
      </button>
      <section className="hy-meals" style={{ "--d": "260ms" }}>
        {f.meals.map(([icon, name, when, kcal]) => (
          <div className="hy-row hy-meal" key={name}>
            <ClayIcon id={icon} size={34} />
            <div>
              <span>{name}</span>
              <small>{when}</small>
            </div>
            <strong>{kcal}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---- Még nem kidolgozott cél ---- */
function Stub({ domain, dest }) {
  const d = DOMAINS[domain];
  const [, label, icon] = d.dests.find(([id]) => id === dest);
  return (
    <div className="hy-page hy-stub">
      <header className={`hy-task-head tone-${d.tone}`}>
        <ClayIcon id={icon} size={40} />
        <div>
          <h1>{label}</h1>
          <p>{d.name}</p>
        </div>
      </header>
      <p className="hy-quiet hy-stub-note">
        Ez a felület a vizuális irány jóváhagyása után, a saját körében készül el.
      </p>
    </div>
  );
}

/* ---- A tanulmány ---- */
export default function HybridStudy() {
  const [loc, setLoc] = useState(readHash);
  const dialog = useRef(null);
  const toggle = useRef(null);
  const d = DOMAINS[loc.domain];

  useEffect(() => {
    const onHash = () => setLoc(readHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const go = (domain, dest) => {
    dialog.current?.close();
    location.hash = urlFor(domain, dest ?? DOMAINS[domain].dests[0][0]);
  };

  const page =
    loc.domain === "nap" && loc.dest === "mai" ? (
      <NapMai go={go} />
    ) : loc.domain === "edzes" && loc.dest === "mai" ? (
      <EdzesMai />
    ) : loc.domain === "fuel" && loc.dest === "mai" ? (
      <FuelMai />
    ) : (
      <Stub domain={loc.domain} dest={loc.dest} />
    );

  return (
    <div className="hy-stage">
      <SpriteSheet />
      <aside className="hy-aside">
        <a href="./">← Korábbi irányok</a>
        <p className="hy-aside-eyebrow">HIBRID VIZUÁLIS IRÁNY</p>
        <h2>
          Mozaik fény.
          <br />
          <em>Titanium szerkezet.</em>
          <br />
          Boop veled.
        </h2>
        <p>
          A mostani app világos, meleg világa és saját ikonjai; a Titanium területi
          navigációja és hierarchiája; a Boop mint élő, pislogó társ — nagyban csak a
          Nap főoldalán, kicsiben a bal alsó váltóban mindenhol.
        </p>
      </aside>
      <div className="hy-phone" style={{
        "--clay-light": d.clay.light,
        "--clay-body": d.clay.body,
        "--clay-shadow": d.clay.shadow,
      }}>
        <header className="hy-top">
          <span className="hy-date">{DEMO.dateLabel}</span>
          <button className="hy-bell" aria-label="Értesítések">
            <ClayIcon id="i-ertesites" size={22} />
          </button>
        </header>
        <main className="hy-screen" key={loc.domain + loc.dest}>
          {page}
        </main>
        <nav className="hy-dock">
          <button
            ref={toggle}
            className="hy-boop-toggle"
            aria-haspopup="dialog"
            aria-label={`Területváltás, most: ${d.name}`}
            onClick={() => {
              const r = toggle.current.getBoundingClientRect();
              const dlg = dialog.current;
              dlg.style.left = `${Math.max(10, r.left - 6)}px`;
              dlg.style.bottom = `${Math.max(14, window.innerHeight - r.bottom + 4)}px`;
              dlg.showModal();
            }}
          >
            <BoopAvatar size={44} state="idle" />
            <span>{d.name}</span>
          </button>
          <div className="hy-dock-tabs" key={loc.domain}>
            {d.dests.map(([id, label, icon]) => (
              <button
                key={id}
                className={id === loc.dest ? "is-active" : ""}
                onClick={() => go(loc.domain, id)}
              >
                <ClayIcon id={icon} size={24} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
        <dialog
          ref={dialog}
          className="hy-selector"
          onClick={(e) => e.target === dialog.current && dialog.current.close()}
          onClose={() => toggle.current?.focus()}
        >
          <p className="hy-selector-eyebrow">UGYANAZ A BOOP, MÁS TÉRBEN</p>
          {DOMAIN_ORDER.map((id) => {
            const dom = DOMAINS[id];
            return (
              <button
                key={id}
                className={id === loc.domain ? "is-current" : ""}
                style={{
                  "--clay-light": dom.clay.light,
                  "--clay-body": dom.clay.body,
                  "--clay-shadow": dom.clay.shadow,
                }}
                onClick={() => go(id)}
              >
                <BoopAvatar size={40} state="idle" />
                <span>
                  <strong>{dom.name}</strong>
                  <small>{dom.eyebrow.toLowerCase()}</small>
                </span>
              </button>
            );
          })}
        </dialog>
      </div>
    </div>
  );
}
