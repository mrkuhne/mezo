import React, { useState } from "react";
import { Icon, Sparkline } from "../shared.jsx";
import {
  FlowHead,
  FlowTabs,
  FlowRow,
  CompanionNote,
  EmptyState,
} from "./FlowUI.jsx";
import {
  PERSONAL_TODAY,
  createPersonalState,
  sleepMinutes,
  saveSleep,
  saveWeight,
  savePerson,
  addContact,
  planEvent,
  saveRoutine,
  toggleRoutineStep,
  filterNotifications,
  markNotificationsRead,
} from "./personal-state.mjs";
import "./personal-flow.css";

export const PERSONAL_ROUTES = {
  me: { title: "Én", parent: "home" },
  "me-sleep": { title: "Alvás", parent: "me" },
  "me-sleep-history": { title: "Alvásnapló", parent: "me-sleep" },
  "me-sleep-log": { title: "Alvás rögzítése", parent: "me-sleep" },
  "me-weight": { title: "Testsúly", parent: "me" },
  "me-weight-log": { title: "Mérés rögzítése", parent: "me-weight" },
  "me-people": { title: "Kapcsolataim", parent: "me" },
  "me-person": { title: "Kapcsolat", parent: "me-people" },
  "me-person-edit": { title: "Személy adatai", parent: "me-people" },
  "me-contact-log": { title: "Kapcsolódás", parent: "me-person" },
  "me-event": { title: "Közös terv", parent: "me-person" },
  "me-routines": { title: "Rutinjaim", parent: "me" },
  "me-routine": { title: "Egy kis kapaszkodó", parent: "me-routines" },
  "me-routine-edit": { title: "Rutin alakítása", parent: "me-routines" },
  notifications: { title: "Értesítések", parent: "home" },
  "notification-settings": {
    title: "Értesítési szokások",
    parent: "notifications",
  },
};
const days = ["V", "H", "K", "Sze", "Cs", "P", "Szo"];
const kinds = [
  ["all", "Összes"],
  ["sleep", "Alvás"],
  ["people", "Emberek"],
  ["routine", "Rutin"],
  ["insight", "Felismerések"],
  ["training", "Edzés"],
  ["fuel", "Fuel"],
];
const kindIcons = {
  sleep: "moon",
  people: "users",
  routine: "check-circle",
  insight: "sparkles",
  training: "dumbbell",
  fuel: "utensils",
};
const duration = (m) => `${Math.floor(m / 60)} ó ${m % 60} p`;
const dateText = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("hu-HU", {
    month: "short",
    day: "numeric",
  });
const num = (v) =>
  Number(v).toLocaleString("hu-HU", { maximumFractionDigits: 1 });
function Field({ label, children, ...props }) {
  return (
    <label className="flow-field">
      {label}
      {children || (
        <input
          {...props}
          onInput={props.type === "time" ? props.onChange : undefined}
        />
      )}
    </label>
  );
}
function Section({ title, action, onClick, children }) {
  return (
    <section className="flow-section">
      <div className="flow-section-heading">
        <h2>{title}</h2>
        {action && (
          <button className="text-button" onClick={onClick}>
            {action}
            <Icon name="arrow-right" size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function Note({ api, children, action, prompt }) {
  return api.variant === "companion" ? (
    <CompanionNote action={action} onClick={() => api.ask(prompt || children)}>
      {children}
    </CompanionNote>
  ) : (
    <p className="personal-note">
      {children}
      {action && (
        <button
          className="text-button"
          onClick={() => api.ask(prompt || children)}
        >
          {action}
          <Icon name="arrow-right" size={15} />
        </button>
      )}
    </p>
  );
}
function useSave(api) {
  const [error, setError] = useState("");
  return [
    error,
    (fn, route, params) => {
      try {
        fn(api.state.personal);
        api.update("personal", fn);
        setError("");
        if (route) api.go(route, params);
      } catch (e) {
        setError(e.message);
      }
    },
  ];
}
function Actions({ api, primary, onClick }) {
  return (
    <div className="flow-actions">
      <button
        type="button"
        className="secondary-button"
        onClick={() => api.back()}
      >
        Mégse
      </button>
      <button className="primary-button" type="submit" onClick={onClick}>
        {primary || "Mentés"}
        <Icon name="check" size={18} />
      </button>
    </div>
  );
}
function Missing({ api }) {
  return (
    <EmptyState
      title="Ez a bejegyzés nem található"
      description="A listából válassz másikat."
      action="Vissza az Én oldalra"
      onClick={() => api.go("me")}
    />
  );
}

function Hub({ api }) {
  const s = api.state.personal;
  return (
    <>
      <div className="personal-identity">
        <span className="personal-monogram">D</span>
        <div>
          <span className="flow-kicker">A saját ritmusod</span>
          <h1>Dániel</h1>
          <p>Nem csak adatok. Ami neked számít.</p>
        </div>
      </div>
      {api.variant === "companion" && (
        <CompanionNote>
          Van, amit mérünk. És van, amit csak te érzel. Itt mindkettőnek van
          helye.
        </CompanionNote>
      )}
      <div className="personal-hub-grid">
        <button
          className="personal-hub-tile"
          onClick={() => api.go("me-sleep")}
        >
          <Icon name="moon" />
          <span>Alvás</span>
          <strong>{duration(s.sleep.latest.minutes)}</strong>
          <small>Legutóbbi éjszakád</small>
          <div className="personal-mini-bars">
            {[...s.sleep.logs].reverse().map((x) => (
              <i key={x.id} style={{ height: x.minutes / 10 }} />
            ))}
          </div>
        </button>
        <button
          className="personal-hub-tile"
          onClick={() => api.go("me-weight")}
        >
          <Icon name="scale" />
          <span>Testsúly</span>
          <strong>
            {num(s.weight.latest)} <em>kg</em>
          </strong>
          <small>A trend számít</small>
          <Sparkline
            values={[...s.weight.logs].reverse().map((x) => x.value)}
            height={55}
          />
        </button>
      </div>
      <Section title="Ami megtart">
        <FlowRow
          icon="users"
          title="Kapcsolataim"
          subtitle={`${s.people.length} fontos ember · közös idő, emlékek, tervek`}
          onClick={() => api.go("me-people")}
        />
        <FlowRow
          icon="check-circle"
          title="Rutinjaim"
          subtitle={`${s.routines.length} kapaszkodó a napban`}
          onClick={() => api.go("me-routines")}
        />
        <FlowRow
          icon="book"
          title="Naplóm"
          subtitle="Egy mondat is lehet elég"
          onClick={() => api.go("journal")}
        />
      </Section>
      <Section title="Tágabb kép">
        <FlowRow
          icon="chart"
          title="A hetem"
          subtitle="Hogyan áll össze az egész?"
          onClick={() => api.go("week")}
        />
        <FlowRow
          icon="target"
          title="Céljaim"
          subtitle="Az irány, amihez visszatérsz"
          onClick={() => api.go("goals")}
        />
        <FlowRow
          icon="brain"
          title="Alakuló önarckép"
          subtitle="Test, figyelem, kapcsolatok, belső világ"
          onClick={() => api.go("character")}
        />
        <FlowRow
          icon="bell"
          title="Értesítéseim"
          subtitle="Csak annyi jelzés, amennyi segít"
          value={s.notifications.filter((x) => !x.read).length}
          onClick={() => api.go("notifications")}
        />
      </Section>
    </>
  );
}
function SleepOverview({ api }) {
  const s = api.state.personal.sleep,
    latest = s.latest,
    mean = Math.round(
      s.logs.reduce((a, x) => a + x.minutes, 0) / s.logs.length,
    );
  if (!latest) return <><FlowHead title="Milyen volt az éjszakád?"/><button className="primary-button" onClick={()=>api.go("me-sleep-log")}>Alvás rögzítése</button></>;
  return (
    <>
      <FlowHead
        eyebrow="Pihenés · az alapod"
        title={
          api.variant === "companion"
            ? "Hogy telt az éjszakád?"
            : "Alvás, a te ritmusodban."
        }
        description="A hossz mellett az is számít, hogyan ébredtél."
      />
      <div className="personal-sleep-hero">
        <svg
          viewBox="0 0 300 150"
          role="img"
          aria-label={`Legutóbbi alvás: ${duration(latest.minutes)}`}
        >
          <path
            d="M25 132 A125 115 0 0 1 275 132"
            fill="none"
            stroke="var(--line)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M25 132 A125 115 0 0 1 275 132"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${Math.min(100, (latest.minutes / s.targetMinutes) * 100)} 100`}
          />
          <circle cx="150" cy="51" r="17" fill="var(--panel)" />
          <path
            d="M157 35a17 17 0 1 0 9 27 16 16 0 0 1-9-27"
            fill="var(--accent)"
          />
        </svg>
        <div>
          <span className="flow-kicker">{dateText(latest.date)} · ébredés</span>
          <strong>{duration(latest.minutes)}</strong>
          <small>
            {
              ["", "Nehéz", "Nyugtalan", "Közepes", "Pihentető", "Nagyon jó"][
                latest.quality
              ]
            }{" "}
            · {latest.quality}/5
          </small>
        </div>
      </div>
      <div className="personal-statline">
        <div>
          <Icon name="moon" />
          <strong>{latest.bed}</strong>
          <small>Lefekvés</small>
        </div>
        <div>
          <Icon name="sun" />
          <strong>{latest.wake}</strong>
          <small>Ébredés</small>
        </div>
        <div>
          <Icon name="target" />
          <strong>{duration(s.targetMinutes)}</strong>
          <small>Saját cél</small>
        </div>
      </div>
      <button
        className="primary-button personal-full"
        onClick={() => api.go("me-sleep-log")}
      >
        <Icon name="plus" />
        Alvás rögzítése
      </button>
      <Note
        api={api}
        action="Beszéljük át"
        prompt="Nézzük meg együtt az alvásnaplómat, és egyetlen kicsi esti változtatást."
      >
        Az utóbbi {s.logs.length} éjszaka átlaga {duration(mean)}. A napló az
        összefüggéseket segít észrevenni, nem az éjszakákat osztályozni.
      </Note>
      <Section
        title="Az elmúlt éjszakák"
        action="Napló"
        onClick={() => api.go("me-sleep-history")}
      >
        <div
          className="personal-sleep-bars"
          role="group"
          aria-label={`Alvásidők: ${[...s.logs]
            .reverse()
            .map((x) => dateText(x.date) + " " + duration(x.minutes))
            .join("; ")}`}
        >
          {[...s.logs]
            .reverse()
            .slice(-7)
            .map((x) => (
              <button
                key={x.id}
                onClick={() => api.go("me-sleep-log", { id: x.id })}
                aria-label={`${dateText(x.date)}, ${duration(x.minutes)}, szerkesztés`}
              >
                <span style={{ height: x.minutes / 5 }} />
                <small>
                  {new Date(x.date + "T12:00:00").toLocaleDateString("hu-HU", {
                    weekday: "short",
                  })}
                </small>
              </button>
            ))}
        </div>
        <div className="flow-chart-caption">
          <span>Rögzített ágyban töltött idő</span>
          <span>7 éjszaka</span>
        </div>
      </Section>
      <Section title="Az este nyomai">
        <div className="personal-tags">
          {latest.factors.length ? (
            latest.factors.map((f) => (
              <span className="flow-tag" key={f}>
                {f}
              </span>
            ))
          ) : (
            <span className="flow-copy">Még nincs tényező megadva.</span>
          )}
        </div>
        {latest.note && <p className="personal-quote">„{latest.note}”</p>}
        <FlowRow
          icon="edit"
          title="Legutóbbi bejegyzés szerkesztése"
          onClick={() => api.go("me-sleep-log", { id: latest.id })}
        />
        <FlowRow
          icon="moon"
          title="Esti rutinom"
          subtitle="Adj egy ismerős lezárást a napnak"
          onClick={() => api.go("me-routines")}
        />
      </Section>
      <Field label="Saját alváscél">
        <select
          value={s.targetMinutes}
          onChange={(e) =>
            api.update("personal", (p) => ({
              ...p,
              sleep: { ...p.sleep, targetMinutes: Number(e.target.value) },
            }))
          }
        >
          {[360, 390, 420, 450, 480, 510, 540].map((v) => (
            <option value={v} key={v}>
              {duration(v)}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
function SleepHistory({ api }) {
  return (
    <>
      <FlowHead
        eyebrow="A pihenés nyomai"
        title="Éjszakáról éjszakára"
        description="Az ébredés dátuma szerint. Egy bejegyzést megnyitva javíthatod a részleteit."
      />
      {api.state.personal.sleep.logs.map((x) => (
        <FlowRow
          key={x.id}
          icon="moon"
          title={`${dateText(x.date)} · ${duration(x.minutes)}`}
          subtitle={`${x.bed} – ${x.wake} · Minőség ${x.quality}/5${x.factors.length ? " · " + x.factors.join(", ") : ""}`}
          onClick={() => api.go("me-sleep-log", { id: x.id })}
        />
      ))}
      <button
        className="primary-button personal-full"
        onClick={() => api.go("me-sleep-log")}
      >
        <Icon name="plus" />
        Új éjszaka
      </button>
    </>
  );
}
function SleepForm({ api }) {
  const existing = api.state.personal.sleep.logs.find(
    (x) => x.id === api.params.id,
  );
  const [d, set] = useState(
    existing || {
      date: PERSONAL_TODAY,
      bed: "23:00",
      wake: "07:00",
      quality: 4,
      factors: [],
      note: "",
    },
  );
  const [err, save] = useSave(api);
  const field = (k, v) => set((x) => ({ ...x, [k]: v }));
  let mins;
  try {
    mins = sleepMinutes(d.bed, d.wake);
  } catch {}
  return (
    <>
      <FlowHead
        eyebrow={existing ? "Napló · szerkesztés" : "Gyors rögzítés"}
        title="Mesélj az éjszakádról."
        description="Két időpont, egy érzés. A részletek maradhatnak későbbre."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save((s) => saveSleep(s, d), "me-sleep");
        }}
      >
        <Field
          label="Ébredés napja"
          type="date"
          value={d.date}
          max={PERSONAL_TODAY}
          required
          onChange={(e) => field("date", e.target.value)}
        />
        <div className="flow-grid">
          <Field
            label="Lefekvés"
            type="time"
            value={d.bed}
            required
            onChange={(e) => field("bed", e.target.value)}
          />
          <Field
            label="Ébredés"
            type="time"
            value={d.wake}
            required
            onChange={(e) => field("wake", e.target.value)}
          />
        </div>
        <div className="personal-duration">
          <Icon name="moon" />
          <strong>{mins ? duration(mins) : "—"}</strong>
          <span>
            {d.bed > d.wake ? "Előző este → reggel" : "Azonos naptári napon"}
          </span>
        </div>
        <p className="evidence-note">
          Az időpontok közti időt rögzítjük. Ez nem alvásfázis-mérés; éjfél
          átlépését automatikusan kezeljük.
        </p>
        <fieldset className="personal-fieldset">
          <legend>Milyen volt felébredni?</legend>
          <div className="personal-quality">
            {["Nehéz", "Nyugtalan", "Közepes", "Jó", "Kipihent"].map((q, i) => (
              <button
                type="button"
                key={q}
                className={d.quality === i + 1 ? "selected" : ""}
                aria-pressed={d.quality === i + 1}
                onClick={() => field("quality", i + 1)}
              >
                <span>{i + 1}</span>
                <small>{q}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="personal-fieldset">
          <legend>
            Mi kísérte az estét? <small>Opcionális</small>
          </legend>
          <div className="personal-tags">
            {[
              "Olvasás",
              "Séta",
              "Képernyő",
              "Késői vacsora",
              "Koffein",
              "Feszültség",
              "Nyugodt este",
            ].map((f) => (
              <button
                type="button"
                key={f}
                aria-pressed={d.factors.includes(f)}
                className={d.factors.includes(f) ? "selected" : ""}
                onClick={() =>
                  field(
                    "factors",
                    d.factors.includes(f)
                      ? d.factors.filter((x) => x !== f)
                      : [...d.factors, f],
                  )
                }
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Egy mondat az éjszakáról · opcionális">
          <textarea
            value={d.note}
            onChange={(e) => field("note", e.target.value)}
            placeholder="Mi segített, mi zavart?"
          />
        </Field>
        {err && (
          <p className="flow-status" role="alert">
            {err}
          </p>
        )}
        <Actions
          api={api}
          primary={existing ? "Változtatások mentése" : "Éjszaka mentése"}
        />
      </form>
    </>
  );
}
function WeightOverview({ api }) {
  const s = api.state.personal.weight;
  const [range, setRange] = useState("week");
  const logs = range === "week" ? s.logs.slice(0, 7) : s.logs;
  if (!logs.length) return <><FlowHead title="Az első mérésedtől indulunk."/><button className="primary-button" onClick={()=>api.go("me-weight-log")}>Testsúly rögzítése</button></>;
  const change = logs[0].value - logs.at(-1).value;
  return (
    <>
      <FlowHead
        eyebrow="Testsúly · távlatban"
        title={
          api.variant === "companion"
            ? "Egy mérés csak egy pillanat."
            : "A trend a fontosabb."
        }
        description="A napi ingadozás természetes. A változás több mérésből látszik."
      />
      <div className="personal-weight-number">
        <strong>{num(s.latest)}</strong>
        <span>kg</span>
      </div>
      <p className="personal-subline">
        Legutóbbi mérés · {dateText(s.logs[0].date)}
      </p>
      <button
        className="primary-button personal-full"
        onClick={() => api.go("me-weight-log")}
      >
        <Icon name="plus" />
        Mérés rögzítése
      </button>
      <FlowTabs
        items={[
          ["week", "7 nap"],
          ["month", "30 nap"],
        ]}
        value={range}
        onChange={setRange}
      />
      <div
        className="personal-weight-chart"
        role="img"
        aria-label={`Testsúlymérések: ${[...logs]
          .reverse()
          .map((x) => num(x.value) + " kg")
          .join(", ")}`}
      >
        <div className="personal-chart-bounds">
          <span>{num(Math.max(...logs.map((x) => x.value)))} kg</span>
          <span>{num(Math.min(...logs.map((x) => x.value)))} kg</span>
        </div>
        <Sparkline
          values={[...logs].reverse().map((x) => x.value)}
          height={150}
          fill
        />
      </div>
      <div className="flow-chart-caption">
        <span>{dateText(logs.at(-1).date)}</span>
        <span>{dateText(logs[0].date)}</span>
      </div>
      <div className="personal-statline">
        <div>
          <strong>
            {change > 0 ? "+" : ""}
            {num(change)} kg
          </strong>
          <small>A megjelenített időszakban</small>
        </div>
        <div>
          <strong>
            {num(logs.reduce((a, x) => a + x.value, 0) / logs.length)} kg
          </strong>
          <small>{logs.length} mérés átlaga</small>
        </div>
      </div>
      <Note api={api}>
        A mérleg nem mondja el, milyen volt a napod. Érdemes hasonló körülmények
        között mérni, és az irányt figyelni.
      </Note>
      <Section title="Méréseid">
        {logs.map((x) => (
          <FlowRow
            key={x.id}
            icon="scale"
            title={`${num(x.value)} kg`}
            subtitle={`${dateText(x.date)}${x.note ? " · " + x.note : ""}`}
            onClick={() => api.go("me-weight-log", { id: x.id })}
          />
        ))}
      </Section>
      <FlowRow
        icon="target"
        title="A célomhoz kapcsolom"
        subtitle={`Saját cél: ${num(s.target)} kg · a teljes képhez`}
        onClick={() => api.go("goals")}
      />
    </>
  );
}
function WeightForm({ api }) {
  const existing = api.state.personal.weight.logs.find(
    (x) => x.id === api.params.id,
  );
  const [d, set] = useState(
    existing || { date: PERSONAL_TODAY, value: "", note: "" },
  );
  const [error, save] = useSave(api);
  return (
    <>
      <FlowHead
        eyebrow={existing ? "Mérés · szerkesztés" : "Egy pillanatkép"}
        title="Hol tartasz ma?"
        description="Az azonos napi mérés mentése frissíti az előző értéket."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save((s) => saveWeight(s, d), "me-weight");
        }}
      >
        <Field
          label="Testsúly · kg"
          inputMode="decimal"
          placeholder="pl. 81,4"
          value={d.value}
          autoFocus
          required
          onChange={(e) => set({ ...d, value: e.target.value })}
        />
        <Field
          label="Mérés napja"
          type="date"
          value={d.date}
          max={PERSONAL_TODAY}
          required
          onChange={(e) => set({ ...d, date: e.target.value })}
        />
        <Field label="Megjegyzés · opcionális">
          <textarea
            value={d.note}
            onChange={(e) => set({ ...d, note: e.target.value })}
            placeholder="Reggel, reggeli előtt…"
          />
        </Field>
        {error && (
          <p className="flow-status" role="alert">
            {error}
          </p>
        )}
        <Actions api={api} primary="Mérés mentése" />
      </form>
    </>
  );
}
function People({ api }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const people = api.state.personal.people.filter(
    (p) =>
      p.name.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")) &&
      (filter === "all" || p.relationship === filter),
  );
  return (
    <>
      <FlowHead
        eyebrow="A te köröd"
        title={
          api.variant === "companion"
            ? "Akikkel jó kapcsolódni."
            : "Hely a fontos embereknek."
        }
        description="Emlékek, apró figyelmességek és idő, amit egymásra szántok."
      />
      <div className="personal-facepile">
        {api.state.personal.people.slice(0, 5).map((p) => (
          <button
            key={p.id}
            onClick={() => api.go("me-person", { id: p.id })}
            aria-label={p.name}
          >
            {p.name.slice(0, 1)}
          </button>
        ))}
        <span>
          {api.state.personal.people.length} ember
          <br />a saját körödben
        </span>
      </div>
      <button
        className="primary-button personal-full"
        onClick={() => api.go("me-person-edit")}
      >
        <Icon name="plus" />
        Új személy
      </button>
      <Field
        label="Keresés a kapcsolataid között"
        type="search"
        value={query}
        placeholder="Egy név…"
        onChange={(e) => setQuery(e.target.value)}
      />
      <FlowTabs
        items={[
          ["all", "Mindenki"],
          ["Család", "Család"],
          ["Barát", "Barátok"],
          ["Párom", "Párom"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      {people.length ? (
        people.map((p) => (
          <button
            className="personal-person-row"
            key={p.id}
            onClick={() => api.go("me-person", { id: p.id })}
          >
            <span className="personal-face">{p.name.slice(0, 1)}</span>
            <span>
              <strong>{p.name}</strong>
              <small>
                {p.relationship} ·{" "}
                {p.contacts.length
                  ? `Legutóbb ${dateText(p.contacts[0].date)}`
                  : "Még nincs kapcsolódás rögzítve"}
              </small>
              <p>{p.note}</p>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))
      ) : (
        <EmptyState
          title="Nincs ilyen találat"
          description="Próbálj másik nevet vagy szűrőt."
          action="Szűrők törlése"
          onClick={() => {
            setQuery("");
            setFilter("all");
          }}
        />
      )}
      <Section title="Közös tervek">
        {api.state.personal.people.flatMap((p) =>
          p.events
            .filter((e) => e.status === "planned")
            .map((e) => (
              <FlowRow
                key={e.id}
                icon="calendar"
                title={e.title}
                subtitle={`${p.name} · ${dateText(e.date)} · ${e.time}`}
                onClick={() => api.go("me-person", { id: p.id })}
              />
            )),
        )}
      </Section>
      <Note api={api}>
        A kapcsolataid nem feladatok. Ez a hely csak segít megőrizni, ami neked
        fontos bennük.
      </Note>
    </>
  );
}
function Person({ api }) {
  const p = api.state.personal.people.find((x) => x.id === api.params.id);
  if (!p) return <Missing api={api} />;
  const eventAction = (id, status) =>
    api.update("personal", (s) => ({
      ...s,
      people: s.people.map((x) =>
        x.id === p.id
          ? {
              ...x,
              events: x.events.map((e) => (e.id === id ? { ...e, status } : e)),
            }
          : x,
      ),
    }));
  return (
    <>
      <div className="personal-profile">
        <span className="personal-face large">{p.name.slice(0, 1)}</span>
        <span className="flow-kicker">{p.relationship}</span>
        <h1>{p.name}</h1>
        <button
          className="text-button"
          onClick={() => api.go("me-person-edit", { id: p.id })}
        >
          <Icon name="edit" size={16} />
          Adatok és jegyzet
        </button>
      </div>
      <div className="flow-actions">
        <button
          className="primary-button"
          onClick={() => api.go("me-contact-log", { id: p.id })}
        >
          <Icon name="heart" />
          Kapcsolódás
        </button>
        <button
          className="secondary-button"
          onClick={() => api.go("me-event", { id: p.id })}
        >
          <Icon name="calendar" />
          Közös terv
        </button>
      </div>
      {p.note && (
        <Section title="Amit észben tartasz">
          <p className="personal-quote">{p.note}</p>
        </Section>
      )}
      <Section title="Következő közös idő">
        {p.events.filter((e) => e.status === "planned").length ? (
          p.events
            .filter((e) => e.status === "planned")
            .map((e) => (
              <div className="personal-event" key={e.id}>
                <span className="flow-kicker">
                  {dateText(e.date)} · {e.time}
                </span>
                <h3>{e.title}</h3>
                <p>{e.place || "A helyet még egyeztetitek."}</p>
                <div className="flow-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      eventAction(e.id, "done");
                      api.go("me-contact-log", { id: p.id, event: e.title });
                    }}
                  >
                    Megtörtént · feljegyzem
                  </button>
                  <button
                    className="text-button"
                    onClick={() => eventAction(e.id, "cancelled")}
                  >
                    Terv elengedése
                  </button>
                </div>
              </div>
            ))
        ) : (
          <p className="flow-copy">
            Még nincs közös terv. Egy kávé is lehet jó kezdet.
          </p>
        )}
      </Section>
      <Section
        title="Fontos dátumok"
        action="Szerkesztés"
        onClick={() => api.go("me-person-edit", { id: p.id })}
      >
        {p.importantDates.length ? (
          p.importantDates.map((d, i) => (
            <FlowRow
              key={i}
              icon="calendar"
              title={d.label}
              value={dateText(d.date)}
            />
          ))
        ) : (
          <p className="flow-copy">
            Születésnap, évforduló vagy egy közös mérföldkő.
          </p>
        )}
      </Section>
      <Section title="Kapcsolódásaitok">
        {p.contacts.length ? (
          p.contacts.map((c) => (
            <div className="personal-contact" key={c.id}>
              <span className="personal-timeline-dot" />
              <div>
                <span className="flow-kicker">
                  {dateText(c.date)} · {c.type}
                </span>
                <p>{c.note || "Jó, hogy szántatok egymásra időt."}</p>
                <span className="flow-tag">{c.feeling || "Feljegyezve"}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="flow-copy">
            Itt gyűlnek majd a saját feljegyzéseid a közös időről.
          </p>
        )}
      </Section>
      <p className="evidence-note">
        Saját kapcsolati naplód. A rögzítés és a tervezés nem küld üzenetet a
        másik személynek.
      </p>
    </>
  );
}
function PersonEdit({ api }) {
  const existing = api.state.personal.people.find(
    (x) => x.id === api.params.id,
  );
  const [d, set] = useState(
    existing || {
      name: "",
      relationship: "Barát",
      note: "",
      importantDates: [],
    },
  );
  const [error, save] = useSave(api);
  return (
    <>
      <FlowHead
        eyebrow={existing ? "Kapcsolat · finomítás" : "Egy fontos ember"}
        title={
          existing ? `${existing.name}, ahogy ismered.` : "Kit hozol közelebb?"
        }
        description="Annyit írj le, amennyit jólesik megőrizni."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const id = d.id || crypto.randomUUID();
          save((s) => savePerson(s, { ...d, id }), "me-person", { id });
        }}
      >
        <Field
          label="Név"
          required
          value={d.name}
          onChange={(e) => set({ ...d, name: e.target.value })}
        />
        <Field label="Kapcsolat">
          <select
            value={d.relationship}
            onChange={(e) => set({ ...d, relationship: e.target.value })}
          >
            {[
              "Barát",
              "Család",
              "Párom",
              "Munkatárs",
              "Ismerős",
              "Más fontos ember",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Saját jegyzet">
          <textarea
            value={d.note}
            onChange={(e) => set({ ...d, note: e.target.value })}
            placeholder="Mi fontos neki? Mire szeretnél emlékezni?"
          />
        </Field>
        <Section title="Fontos dátumok">
          {d.importantDates.map((v, i) => (
            <div className="personal-date-edit" key={i}>
              <Field
                label="Alkalom"
                value={v.label}
                placeholder="Születésnap"
                required
                onChange={(e) =>
                  set({
                    ...d,
                    importantDates: d.importantDates.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <Field
                label="Dátum"
                type="date"
                value={v.date}
                required
                onChange={(e) =>
                  set({
                    ...d,
                    importantDates: d.importantDates.map((x, j) =>
                      j === i ? { ...x, date: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`${v.label || "Dátum"} eltávolítása`}
                onClick={() =>
                  set({
                    ...d,
                    importantDates: d.importantDates.filter((_, j) => j !== i),
                  })
                }
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              set({
                ...d,
                importantDates: [...d.importantDates, { label: "", date: "" }],
              })
            }
          >
            <Icon name="plus" />
            Fontos dátum hozzáadása
          </button>
        </Section>
        {error && (
          <p className="flow-status" role="alert">
            {error}
          </p>
        )}
        <Actions api={api} primary="Személy mentése" />
      </form>
    </>
  );
}
function ContactForm({ api }) {
  const p = api.state.personal.people.find((x) => x.id === api.params.id);
  const [d, set] = useState({
    date: PERSONAL_TODAY,
    type: api.params.event ? "Közös idő" : "Beszélgetés",
    note: api.params.event || "",
    feeling: "Jólesett",
  });
  const [error, save] = useSave(api);
  if (!p) return <Missing api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${p.name} · kapcsolódás`}
        title="Milyen volt együtt?"
        description="Egy saját feljegyzés. Nem üzenet és nem teljesítménymérés."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save((s) => addContact(s, p.id, d), "me-person", { id: p.id });
        }}
      >
        <Field
          label="Mikor?"
          type="date"
          value={d.date}
          max={PERSONAL_TODAY}
          required
          onChange={(e) => set({ ...d, date: e.target.value })}
        />
        <Field label="Hogyan kapcsolódtatok?">
          <select
            value={d.type}
            onChange={(e) => set({ ...d, type: e.target.value })}
          >
            {[
              "Beszélgetés",
              "Közös idő",
              "Telefon",
              "Üzenetváltás",
              "Közös mozgás",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Mit szeretnél megőrizni?">
          <textarea
            value={d.note}
            onChange={(e) => set({ ...d, note: e.target.value })}
            placeholder="Egy mondat a közös időről…"
          />
        </Field>
        <fieldset className="personal-fieldset">
          <legend>Milyen nyomot hagyott?</legend>
          <div className="personal-tags">
            {["Feltöltött", "Jólesett", "Semleges", "Nehéz volt"].map((f) => (
              <button
                type="button"
                key={f}
                className={d.feeling === f ? "selected" : ""}
                aria-pressed={d.feeling === f}
                onClick={() => set({ ...d, feeling: f })}
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="flow-status">
            {error}
          </p>
        )}
        <Actions api={api} primary="Kapcsolódás mentése" />
      </form>
    </>
  );
}
function EventForm({ api }) {
  const p = api.state.personal.people.find((x) => x.id === api.params.id);
  const [d, set] = useState({
    title: "",
    date: "2026-09-12",
    time: "10:00",
    place: "",
  });
  const [error, save] = useSave(api);
  if (!p) return <Missing api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${p.name} · közös idő`}
        title="Csináljatok neki helyet."
        description="Egy terv a saját naptárszerű listádra. A meghívást ti egyeztetitek."
      />
      <div className="personal-tags">
        {["Közös kávé", "Séta", "Vacsora", "Közös edzés"].map((x) => (
          <button
            key={x}
            onClick={() => set({ ...d, title: x })}
            aria-pressed={d.title === x}
            className={d.title === x ? "selected" : ""}
          >
            {x}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save((s) => planEvent(s, p.id, d), "me-person", { id: p.id });
        }}
      >
        <Field
          label="Mit terveztek?"
          required
          value={d.title}
          onChange={(e) => set({ ...d, title: e.target.value })}
          placeholder="Közös kávé"
        />
        <div className="flow-grid">
          <Field
            label="Dátum"
            type="date"
            required
            min={PERSONAL_TODAY}
            value={d.date}
            onChange={(e) => set({ ...d, date: e.target.value })}
          />
          <Field
            label="Időpont"
            type="time"
            required
            value={d.time}
            onChange={(e) => set({ ...d, time: e.target.value })}
          />
        </div>
        <Field
          label="Hely · opcionális"
          value={d.place}
          onChange={(e) => set({ ...d, place: e.target.value })}
          placeholder="Hol találkoznátok?"
        />
        <p className="flow-status">
          Ez a közös terv a kapcsolat oldalán jelenik meg. Nem küld meghívót és
          nem ír külső naptárba.
        </p>
        {error && (
          <p role="alert" className="flow-status">
            {error}
          </p>
        )}
        <Actions api={api} primary="Közös terv mentése" />
      </form>
    </>
  );
}
function stepDone(s, r, step, date, journal = "") {
  if (step.kind === "manual") return (r.checks[date] || []).includes(step.id);
  if (step.route === "me-weight-log")
    return s.weight.logs.some((x) => x.date === date);
  if (step.route === "journal")
    return date === PERSONAL_TODAY && Boolean(journal?.trim());
  return false;
}
function Routines({ api }) {
  const s = api.state.personal;
  const [filter, setFilter] = useState("all");
  const rows = s.routines.filter(
    (r) =>
      filter === "all" ||
      (filter === "morning" ? r.time < "12:00" : r.time >= "12:00"),
  );
  return (
    <>
      <FlowHead
        eyebrow="Ismerős kapaszkodók"
        title={
          api.variant === "companion"
            ? "Apróságok, amik megtartanak."
            : "Könnyű elkezdeni. Jó visszatérni."
        }
        description="A rutin nem egy edzés vagy program. Néhány kicsi szokás, egy ismerős pillanat köré rendezve."
      />
      <button
        className="primary-button personal-full"
        onClick={() => api.go("me-routine-edit")}
      >
        <Icon name="plus" />
        Új rutin
      </button>
      <FlowTabs
        items={[
          ["all", "Mind"],
          ["morning", "Reggel"],
          ["evening", "Délután és este"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      {rows.map((r) => {
        const done = r.steps.filter((x) =>
          stepDone(s, r, x, PERSONAL_TODAY, api.state.journal),
        ).length;
        const scheduled = r.days.includes(2);
        return (
          <button
            className="personal-routine-card"
            key={r.id}
            onClick={() => api.go("me-routine", { id: r.id })}
          >
            <div className="personal-routine-top">
              <Icon name={r.time < "12:00" ? "sun" : "moon"} />
              <span>
                {r.time} · {scheduled ? "ma is" : "következő alkalomra"}
              </span>
              <Icon name="chevron-right" size={16} />
            </div>
            <h2>{r.title}</h2>
            <p>{r.anchor}</p>
            <div className="personal-routine-progress">
              {r.steps.map((x) => (
                <i
                  key={x.id}
                  className={
                    stepDone(s, r, x, PERSONAL_TODAY, api.state.journal)
                      ? "done"
                      : ""
                  }
                />
              ))}
            </div>
            <small>
              {done}/{r.steps.length} lépés ma ·{" "}
              {r.days.length === 7
                ? "Minden nap"
                : r.days.map((d) => days[d]).join(", ")}
            </small>
          </button>
        );
      })}
      {!rows.length && (
        <EmptyState
          icon="sun"
          title="Itt még szabad a hely"
          description="Egy kétperces szokás is lehet egy új rutin kezdete."
          action="Új rutin"
          onClick={() => api.go("me-routine-edit")}
        />
      )}
      <Note
        api={api}
        action="Segíts kicsiben kezdeni"
        prompt="Segíts egy apró, személyes reggeli rutint kialakítani, ami rossz napon is belefér."
      >
        Egy kihagyott nap nem törli el, amit már felépítettél. A következő
        alkalom mindig új lehetőség.
      </Note>
    </>
  );
}
function RoutineDetail({ api }) {
  const s = api.state.personal,
    r = s.routines.find((x) => x.id === api.params.id);
  const [date, setDate] = useState(PERSONAL_TODAY);
  if (!r) return <Missing api={api} />;
  const done = r.steps.filter((x) =>
    stepDone(s, r, x, date, api.state.journal),
  ).length;
  return (
    <>
      <FlowHead
        eyebrow={`${r.time} · ${r.days.length === 7 ? "Minden nap" : r.days.map((d) => days[d]).join(", ")}`}
        title={r.title}
        description={`${r.anchor}… akkor megteszem ezt a néhány apróságot.`}
      />
      <FlowTabs
        items={[
          ["2026-09-07", "Tegnap"],
          [PERSONAL_TODAY, "Ma"],
        ]}
        value={date}
        onChange={setDate}
      />
      <div className="personal-routine-big">
        <strong>
          {done}
          <span> / {r.steps.length}</span>
        </strong>
        <p>
          {done === r.steps.length
            ? "Ennyi ma elég. Jó, hogy tettél magadért."
            : "Kezdd azzal, amelyik most belefér."}
        </p>
      </div>
      <div className="flow-list">
        {r.steps.map((step, i) => {
          const checked = stepDone(s, r, step, date, api.state.journal);
          return (
            <div
              className={`personal-step ${checked ? "completed" : ""}`}
              key={step.id}
            >
              <button
                className="personal-step-check"
                disabled={step.kind !== "manual"}
                aria-pressed={checked}
                aria-label={`${step.title}: ${checked ? "kész, visszavonás" : "megjelölés késznek"}`}
                onClick={() =>
                  api.update("personal", (p) =>
                    toggleRoutineStep(p, r.id, step.id, date),
                  )
                }
              >
                {checked ? <Icon name="check" size={20} /> : i + 1}
              </button>
              <div>
                <strong>{step.title}</strong>
                <small>
                  {step.kind === "manual"
                    ? "Saját pipa · bármikor visszavonhatod"
                    : checked
                      ? "A naplódból automatikusan kész"
                      : date !== PERSONAL_TODAY
                        ? "A bejegyzésedből derül ki"
                        : "A naplóbejegyzésedhez kapcsolódik"}
                </small>
                {step.kind === "derived" &&
                  date === PERSONAL_TODAY &&
                  !checked && (
                    <button
                      className="text-button"
                      onClick={() => api.go(step.route)}
                    >
                      Megnyitás
                      <Icon name="arrow-right" size={15} />
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>
      <Section title="Nem kell tökéletes sorozat">
        <div className="personal-consistency">
          {["02", "03", "04", "05", "06", "07", "08"].map((d) => {
            const dt = "2026-09-" + d;
            const active = r.steps.some((x) =>
              stepDone(s, r, x, dt, api.state.journal),
            );
            return (
              <div key={d}>
                <i className={active ? "active" : ""}>
                  {active ? <Icon name="check" size={15} /> : <span />}
                </i>
                <small>{d}.</small>
              </div>
            );
          })}
        </div>
        <p className="evidence-note">
          A jelölt napokon legalább egy lépésed megvolt. Egy csendes nap nem
          nullázza az előzőket.
        </p>
      </Section>
      <FlowRow
        icon="edit"
        title="Lépések és ütemezés alakítása"
        subtitle="Név, kapaszkodó, napok és időpont"
        onClick={() => api.go("me-routine-edit", { id: r.id })}
      />
    </>
  );
}
function RoutineEdit({ api }) {
  const existing = api.state.personal.routines.find(
    (x) => x.id === api.params.id,
  );
  const [d, set] = useState(
    existing || {
      title: "",
      anchor: "Miután megittam a reggeli kávém",
      time: "07:30",
      days: [1, 2, 3, 4, 5],
      steps: [{ id: crypto.randomUUID(), title: "", kind: "manual" }],
    },
  );
  const [error, save] = useSave(api);
  return (
    <>
      <FlowHead
        eyebrow={existing ? "Finomhangolás" : "Egy új kapaszkodó"}
        title="Legyen olyan kicsi, hogy menjen."
        description="Kösd egy már ismerős pillanathoz. Egyetlen lépéssel is kezdheted."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const id = d.id || crypto.randomUUID();
          save((s) => saveRoutine(s, { ...d, id }), "me-routine", { id });
        }}
      >
        <Field
          label="A rutin neve"
          value={d.title}
          required
          onChange={(e) => set({ ...d, title: e.target.value })}
          placeholder="Könnyű reggel"
        />
        <Field
          label="Mi után következzen?"
          value={d.anchor}
          required
          onChange={(e) => set({ ...d, anchor: e.target.value })}
          placeholder="Miután…"
        />
        <Field
          label="Irányadó időpont"
          type="time"
          value={d.time}
          required
          onChange={(e) => set({ ...d, time: e.target.value })}
        />
        <fieldset className="personal-fieldset">
          <legend>Mely napokon?</legend>
          <div className="personal-week-picker">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                type="button"
                key={day}
                aria-pressed={d.days.includes(day)}
                className={d.days.includes(day) ? "selected" : ""}
                onClick={() =>
                  set({
                    ...d,
                    days: d.days.includes(day)
                      ? d.days.filter((x) => x !== day)
                      : [...d.days, day],
                  })
                }
              >
                {days[day]}
              </button>
            ))}
          </div>
        </fieldset>
        <Section title="A kis lépések">
          {d.steps.map((step, i) => (
            <div className="personal-routine-edit-step" key={step.id}>
              <Field
                label={`${i + 1}. lépés${step.kind === "derived" ? " · naplóhoz kötött" : ""}`}
                required
                value={step.title}
                onChange={(e) =>
                  set({
                    ...d,
                    steps: d.steps.map((x) =>
                      x.id === step.id ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
                placeholder="Két perc nyújtás"
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`${i + 1}. lépés törlése`}
                onClick={() =>
                  set({ ...d, steps: d.steps.filter((x) => x.id !== step.id) })
                }
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              set({
                ...d,
                steps: [
                  ...d.steps,
                  { id: crypto.randomUUID(), title: "", kind: "manual" },
                ],
              })
            }
          >
            <Icon name="plus" />
            Még egy kis lépés
          </button>
        </Section>
        <p className="flow-status">
          „{d.anchor || "Miután…"}, megteszem:{" "}
          {d.steps
            .map((x) => x.title)
            .filter(Boolean)
            .join(", ") || "az első kis lépést"}
          .”
        </p>
        {error && (
          <p className="flow-status" role="alert">
            {error}
          </p>
        )}
        <Actions api={api} primary="Rutin mentése" />
      </form>
    </>
  );
}
function Notifications({ api }) {
  const [kind, setKind] = useState("all"),
    [mode, setMode] = useState("all");
  const s = api.state.personal;
  const rows = filterNotifications(s.notifications, kind, mode === "unread");
  const groups = [...new Set(rows.map((x) => x.day || "Ma"))];
  const unread = s.notifications.filter((x) => !x.read).length;
  return (
    <>
      <FlowHead
        eyebrow="Ami most figyelmet kér"
        title={unread ? `${unread} új jelzés vár.` : "Minden a helyére került."}
        description="Rövid jelzések, amelyekből egyenesen a részletekhez jutsz."
      />
      <div className="flow-actions">
        <button
          className="secondary-button"
          disabled={!unread}
          onClick={() =>
            api.update("personal", (p) => markNotificationsRead(p))
          }
        >
          <Icon name="check" />
          Mind olvasott
        </button>
        <button
          className="secondary-button"
          onClick={() => api.go("notification-settings")}
        >
          <Icon name="settings" />
          Beállítások
        </button>
      </div>
      <FlowTabs
        items={[
          ["all", "Minden jelzés"],
          ["unread", "Olvasatlan"],
        ]}
        value={mode}
        onChange={setMode}
      />
      <div className="personal-notification-filters">
        <FlowTabs items={kinds} value={kind} onChange={setKind} />
      </div>
      {groups.map((group) => (
        <Section title={group} key={group}>
          {rows
            .filter((x) => (x.day || "Ma") === group)
            .map((n) => (
              <button
                key={n.id}
                className={`personal-notification ${n.read ? "" : "unread"}`}
                onClick={() => {
                  api.update("personal", (p) => markNotificationsRead(p, n.id));
                  api.go(n.route, n.params || {});
                }}
              >
                <span className="personal-notification-icon">
                  <Icon name={kindIcons[n.kind] || "bell"} />
                </span>
                <span>
                  <span className="personal-notification-meta">
                    {n.time}
                    {!n.read && <i aria-label="Olvasatlan" />}
                  </span>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>
                    Részletek <Icon name="arrow-right" size={13} />
                  </small>
                </span>
              </button>
            ))}
        </Section>
      ))}
      {!rows.length && (
        <EmptyState
          icon="check-circle"
          title={
            mode === "unread"
              ? "Itt most minden csendes."
              : "Nincs ilyen jelzés."
          }
          description="Az új értesítések itt kapnak majd helyet."
          action="Összes jelzés"
          onClick={() => {
            setMode("all");
            setKind("all");
          }}
        />
      )}
    </>
  );
}
function NotificationSettings({ api }) {
  const [d, set] = useState(api.state.personal.preferences),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const update = (k, v) => {
    set({ ...d, [k]: v });
    setSaved(false);
  };
  return (
    <>
      <FlowHead
        eyebrow="Annyi jelzés, amennyi segít"
        title="A figyelmed a tiéd."
        description="Válaszd ki, mi szólhat hozzád, és mikor legyen csend."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (d.quietEnabled && d.quietStart === d.quietEnd) {
            setError("A csendes időszak kezdete és vége legyen eltérő.");
            return;
          }
          api.update("personal", (s) => ({ ...s, preferences: d }));
          setSaved(true);
          setError("");
        }}
      >
        <label className="personal-switch">
          <span>
            <strong>Értesítések engedélyezése</strong>
            <small>Az alkalmazáson belüli jelzések beállítása</small>
          </span>
          <input
            type="checkbox"
            checked={d.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
        </label>
        <Section title="Amiről szeretnék hallani">
          {kinds
            .filter(([k]) => k !== "all")
            .map(([k, label]) => (
              <label className="personal-switch" key={k}>
                <span>
                  <strong>{label}</strong>
                  <small>
                    {
                      {
                        sleep: "Esti kapaszkodók, alvásnapló",
                        people: "Fontos dátumok és közös tervek",
                        routine: "A saját ritmusod emlékeztetői",
                        insight: "Új minták és heti összkép",
                        training: "Edzéstervek és alkalmak",
                        fuel: "Étkezési tervek és készletek",
                      }[k]
                    }
                  </small>
                </span>
                <input
                  type="checkbox"
                  disabled={!d.enabled}
                  checked={d.categories[k]}
                  onChange={(e) => {
                    set({
                      ...d,
                      categories: { ...d.categories, [k]: e.target.checked },
                    });
                    setSaved(false);
                  }}
                />
              </label>
            ))}
        </Section>
        <Section title="Csendes órák">
          <label className="personal-switch">
            <span>
              <strong>Legyen időm kikapcsolni</strong>
              <small>Éjfélen átívelő időszakot is beállíthatsz</small>
            </span>
            <input
              type="checkbox"
              checked={d.quietEnabled}
              onChange={(e) => update("quietEnabled", e.target.checked)}
            />
          </label>
          {d.quietEnabled && (
            <div className="flow-grid">
              <Field
                label="Csend kezdete"
                type="time"
                required
                value={d.quietStart}
                onChange={(e) => update("quietStart", e.target.value)}
              />
              <Field
                label="Jelzések újra"
                type="time"
                required
                value={d.quietEnd}
                onChange={(e) => update("quietEnd", e.target.value)}
              />
            </div>
          )}
        </Section>
        <p className="evidence-note">
          Prototípus-beállítások: megőrizzük a választásodat ebben a
          bemutatóban. Valódi push, időzítés és rendszerengedély itt nem
          működik.
        </p>
        {error && (
          <p className="flow-status" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="flow-status" role="status">
            <Icon name="check" size={16} /> A beállításaidat megőriztük.
          </p>
        )}
        <button className="primary-button personal-full" type="submit">
          Beállítások mentése
          <Icon name="check" />
        </button>
      </form>
    </>
  );
}
const pages = {
  me: Hub,
  "me-sleep": SleepOverview,
  "me-sleep-history": SleepHistory,
  "me-sleep-log": SleepForm,
  "me-weight": WeightOverview,
  "me-weight-log": WeightForm,
  "me-people": People,
  "me-person": Person,
  "me-person-edit": PersonEdit,
  "me-contact-log": ContactForm,
  "me-event": EventForm,
  "me-routines": Routines,
  "me-routine": RoutineDetail,
  "me-routine-edit": RoutineEdit,
  notifications: Notifications,
  "notification-settings": NotificationSettings,
};
export default function PersonalFlow({ page, api }) {
  const Page = pages[page] || Missing;
  const fullApi = api.state.personal
    ? api
    : { ...api, state: { ...api.state, personal: createPersonalState() } };
  return (
    <div className="flow-page personal-flow">
      <Page
        key={`${page}:${api.params?.id || ""}`}
        api={{ ...fullApi, params: api.params || {} }}
      />
    </div>
  );
}
