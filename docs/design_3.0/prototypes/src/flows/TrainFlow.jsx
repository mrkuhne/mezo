import React, { useState } from "react";
import { Icon, WorkoutArt } from "../shared.jsx";
import {
  FlowHead,
  FlowTabs,
  FlowRow,
  CompanionNote,
  EmptyState,
} from "./FlowUI.jsx";
import {
  DAYS,
  EXERCISES,
  buildMesoDraft,
  editDraftExercise,
  activateDraft,
  saveSportSlot,
  logSport,
  buildRunPlan,
  activateRunPlan,
  logRun,
  crossLoad,
  searchExercises,
  resolveCycle,
  resolveRunPlan,
  resolveCycleDay,
  hubAppointments,
} from "./train-state.mjs";
import "./train-flow.css";

export const TRAIN_ROUTES = {
  train: { title: "Edzés", parent: "home" },
  "train-gym": { title: "Terem", parent: "train" },
  "train-gym-detail": { title: "Edzésnapló", parent: "train-gym" },
  "train-cycles": { title: "Mezociklusok", parent: "train" },
  "train-build": { title: "Új mezociklus", parent: "train-cycles" },
  "train-draft": { title: "Terved előnézete", parent: "train-build" },
  "train-cycle": { title: "Mezociklus", parent: "train-cycles" },
  "train-cycle-week": { title: "Heti vizsgálat", parent: "train-cycle" },
  "train-day": { title: "Edzésnap", parent: "train-cycle" },
  "train-sport": { title: "Sport", parent: "train" },
  "train-sport-schedule": { title: "Heti sportterv", parent: "train-sport" },
  "train-sport-log": { title: "Sport naplózása", parent: "train-sport" },
  "train-sport-detail": { title: "Sportalkalom", parent: "train-sport" },
  "train-recovery": { title: "Terhelés és pihenés", parent: "train" },
  "train-running": { title: "Futás", parent: "train" },
  "train-run-build": { title: "Új futóterv", parent: "train-running" },
  "train-run-preview": {
    title: "Futóterv előnézete",
    parent: "train-run-build",
  },
  "train-run-plan": { title: "Futóterv", parent: "train-running" },
  "train-run-session": { title: "Futóedzés", parent: "train-run-plan" },
  "train-run-log": { title: "Futás naplózása", parent: "train-running" },
  "train-run-detail": { title: "Futás részletei", parent: "train-running" },
  "train-exercises": { title: "Gyakorlatok", parent: "train" },
  "train-exercise": { title: "Gyakorlat", parent: "train-exercises" },
  "train-medals": { title: "Medálok", parent: "train" },
  "train-medal": { title: "Medál", parent: "train-medals" },
};
const activeCycle = (s) => s.cycles.find((c) => c.status === "active");
const activeRun = (s) => s.runPlans.find((c) => c.status === "active");
const ex = (id) => EXERCISES.find((e) => e.id === id) || EXERCISES[0];
const showDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("hu-HU", {
    month: "short",
    day: "numeric",
  });
const asset = (e, pose = "a") => `/train/${e.asset}-${pose}.jpg`;
const ID = (prefix) => `${prefix}-${Date.now()}`;
function Action({
  children,
  onClick,
  secondary = false,
  icon = "arrow-right",
  ...props
}) {
  return (
    <button
      type="button"
      className={secondary ? "secondary-button" : "primary-button"}
      onClick={onClick}
      {...props}
    >
      <span>{children}</span>
      <Icon name={icon} size={18} />
    </button>
  );
}
function Section({ title, action, onClick, children }) {
  return (
    <section className="flow-section">
      <div className="flow-section-heading">
        <h2>{title}</h2>
        {action && (
          <button type="button" className="text-button" onClick={onClick}>
            {action}
            <Icon name="arrow-right" size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function Stats({ items }) {
  return (
    <div className="tr-stats">
      {items.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="flow-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function ErrorText({ error }) {
  return (
    error && (
      <p role="alert" className="tr-error">
        {error}
      </p>
    )
  );
}
function Empty({ api, title = "Ez a részlet nem található." }) {
  return (
    <EmptyState
      title={title}
      description="A demó adatai időközben változhattak."
      action="Vissza az Edzéshez"
      onClick={() => api.go("train")}
    />
  );
}
function ExerciseRow({ item, api, editing, onChange }) {
  const e = ex(item.id);
  return (
    <div className="tr-exercise-row">
      <button
        type="button"
        className="tr-exercise-link"
        onClick={() => api.go("train-exercise", { id: e.id })}
      >
        <img src={asset(e)} alt="" />
        <span>
          <strong>{e.name}</strong>
          <small>
            {e.muscle} · {item.sets} × {item.reps}
          </small>
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      {editing && (
        <div className="tr-set-editor">
          <label>
            Sorozat
            <input
              aria-label={`${e.name} sorozat`}
              type="number"
              min="1"
              max="6"
              value={item.sets}
              onChange={(v) => onChange({ sets: v.target.value })}
            />
          </label>
          <label>
            Ismétlés
            <input
              aria-label={`${e.name} ismétlés`}
              type="number"
              min="1"
              max="30"
              value={item.reps}
              onChange={(v) => onChange({ reps: v.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
function WeekStrip({ selected, onSelect }) {
  return (
    <div className="tr-weekstrip">
      {DAYS.map((d, i) => (
        <button
          key={d}
          type="button"
          aria-pressed={i === selected}
          onClick={() => onSelect(i)}
        >
          <span>{d.slice(0, 2)}</span>
          <strong>{7 + i}</strong>
          <i className={[0, 2, 4].includes(i) ? "filled" : ""} />
        </button>
      ))}
    </div>
  );
}

function TrainHub({ api }) {
  const s = api.state.training,
    c = activeCycle(s),
    appointments = hubAppointments(s);
  return (
    <>
      <FlowHead
        eyebrow={
          api.variant === "companion"
            ? "A mozgásnak is van ritmusa"
            : "KEDD · SZEPTEMBER 8."
        }
        title={
          api.variant === "companion"
            ? "Erősödj a saját tempódban."
            : "Mozgásban vagy."
        }
        description="Terem, pálya, futócipő — egy közös hétben."
      />
      <div className="tr-hero">
        <WorkoutArt className="tr-hero-art" />
        <span className="flow-kicker">KÖVETKEZŐ TEREM · SZERDA</span>
        <h2>{c?.days[1]?.name || "Saját edzés"}</h2>
        <p>
          {c?.title} · {c?.currentWeek}. hét
          <br />4 gyakorlat · kb. 55 perc
        </p>
        <Action onClick={() => api.go("workout")}>Edzés megnyitása</Action>
      </div>
      <Stats
        items={[
          [`${s.gymHistory.length}/3`, "termi alkalom"],
          [`${s.runLogs[0]?.distance || 0} km`, "utolsó futás"],
          [`${s.medals.filter((m) => m.earned).length}`, "megszerzett medál"],
        ]}
      />
      {api.variant === "companion" && (
        <CompanionNote
          action="Nézzük meg együtt"
          onClick={() => api.go("train-recovery")}
        >
          A terem mellett röplabdázol is. Nézzük egyben, mennyi mozgás fér most
          jól a hetedbe.
        </CompanionNote>
      )}
      <Section
        title="A heted"
        action="Heti nézet"
        onClick={() => api.go("week")}
      >
        {appointments.sport ? (
          <FlowRow
            icon="activity"
            title={`${appointments.sport.slot.day === 1 ? "Ma" : DAYS[appointments.sport.slot.day]} · ${appointments.sport.slot.sport}`}
            subtitle={`${appointments.sport.slot.time} · ${appointments.sport.slot.location || "Helyszín nélkül"} · ${appointments.sport.slot.duration} perc`}
            value={appointments.sport.log ? "Naplózva" : "Naplózás"}
            onClick={() =>
              api.go(
                appointments.sport.log
                  ? "train-sport-detail"
                  : "train-sport-log",
                appointments.sport.log
                  ? { id: appointments.sport.log.id }
                  : { slot: appointments.sport.slot.id },
              )
            }
          />
        ) : (
          <FlowRow
            icon="activity"
            title="Adj helyet a sportnak"
            subtitle="Most nincs sportalkalom a heti tervben"
            onClick={() => api.go("train-sport-schedule")}
          />
        )}
        {appointments.run ? (
          <FlowRow
            icon="run"
            title={`${DAYS[appointments.run.session.day]} · ${appointments.run.session.name}`}
            subtitle={`${appointments.run.session.duration} perc · ${appointments.run.plan.title}`}
            value={appointments.run.log ? "Naplózva" : undefined}
            onClick={() =>
              api.go(
                appointments.run.log ? "train-run-detail" : "train-run-session",
                appointments.run.log
                  ? { id: appointments.run.log.id }
                  : {
                      id: appointments.run.session.id,
                      plan: appointments.run.plan.id,
                    },
              )
            }
          />
        ) : (
          <FlowRow
            icon="run"
            title="A következő futóterved"
            subtitle="Készíts tartható heti ritmust"
            onClick={() => api.go("train-run-build")}
          />
        )}
      </Section>
      <Section title="A mozgásod világa">
        <div className="tr-hub-grid">
          {[
            ["dumbbell", "Terem", "Edzésnapok és történet", "train-gym"],
            [
              "layers",
              "Mezociklus",
              `${c?.currentWeek || 1}. hét · építkezés`,
              "train-cycles",
            ],
            ["activity", "Sport", "Röplabda, TRX és Cross", "train-sport"],
            ["run", "Futás", "Terv, alkalmak, napló", "train-running"],
            ["book", "Gyakorlatok", "Technika és rekordok", "train-exercises"],
            ["medal", "Medálok", "A munkád nyomai", "train-medals"],
          ].map(([icon, title, sub, route]) => (
            <button
              className="tr-hub-tile"
              key={route}
              onClick={() => api.go(route)}
            >
              <Icon name={icon} size={25} />
              <strong>{title}</strong>
              <small>{sub}</small>
              <Icon name="arrow-up-right" size={17} />
            </button>
          ))}
        </div>
      </Section>
      <FlowRow
        icon="heart"
        title="Terhelés és regeneráció"
        subtitle="A terem, sport és futás együtt"
        onClick={() => api.go("train-recovery")}
      />
    </>
  );
}
function Gym({ api }) {
  const s = api.state.training,
    c = activeCycle(s),
    [day, setDay] = useState(2),
    d = c?.days.find((x) => x.day === day);
  return (
    <>
      <FlowHead
        eyebrow="TEREM"
        title="Egy jó edzés innen indul."
        description="Nyisd meg a napot, nézd át a tervet, aztán csak az aktuális sorozatra figyelj."
      />
      <WeekStrip selected={day} onSelect={setDay} />
      {d ? (
        <>
          <div className="tr-session-heading">
            <span className="flow-kicker">
              {DAYS[day]} · {c.currentWeek}. HÉT
            </span>
            <h2>{d.name}</h2>
            <p>
              {d.exercises.length} gyakorlat ·{" "}
              {d.exercises.reduce((n, e) => n + e.sets, 0)} sorozat ·{" "}
              {d.duration} perc
            </p>
          </div>
          {d.exercises.map((e) => (
            <ExerciseRow key={e.id} item={e} api={api} />
          ))}
          <Action onClick={() => api.go("workout")}>Edzés indítása</Action>
        </>
      ) : (
        <EmptyState
          icon="sun"
          title="Ma nincs tervezett teremi edzés."
          description="Van hely a sportnak és a pihenésnek is."
          action="Saját edzés indítása"
          onClick={() => api.go("workout")}
        />
      )}
      <Section title="Edzésnapló">
        {s.gymHistory.map((h) => (
          <FlowRow
            key={h.id}
            icon="check-circle"
            title={h.name}
            subtitle={`${showDate(h.date)} · ${h.duration} perc · ${h.sets} sorozat`}
            value={`${h.volume} kg`}
            onClick={() => api.go("train-gym-detail", { id: h.id })}
          />
        ))}
      </Section>
      <FlowRow
        icon="layers"
        title="Az egész blokk"
        subtitle={c?.title}
        onClick={() => api.go("train-cycle", { id: c?.id || "" })}
      />
    </>
  );
}
function GymDetail({ api }) {
  const h = api.state.training.gymHistory.find((x) => x.id === api.params.id);
  if (!h) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${showDate(h.date)} · BEFEJEZETT EDZÉS`}
        title={h.name}
        description="A sorozatokból összeáll a történeted."
      />
      <Stats
        items={[
          [`${h.duration} p`, "időtartam"],
          [h.sets, "sorozat"],
          [h.volume + " kg", "volumen"],
        ]}
      />
      <div className="tr-chart" aria-label="Volumen az utolsó öt edzésen">
        <div>
          {[42, 56, 52, 68, 78].map((n, i) => (
            <i key={i} style={{ height: `${n}%` }}>
              <span>{i + 1}.</span>
            </i>
          ))}
        </div>
        <small>Terhelési minta · demó edzéstörténet</small>
      </div>
      <Section title="Amit elvégeztél">
        {h.exercises?.length ? (
          h.exercises.map((exercise, i) => (
            <div key={`${exercise.name}-${i}`}>
              <h3>{exercise.name}</h3>
              {exercise.sets.map((set, j) => (
                <FlowRow
                  key={j}
                  icon="check-circle"
                  title={`${j + 1}. sorozat`}
                  value={`${set.weight} kg × ${set.reps}`}
                />
              ))}
            </div>
          ))
        ) : (
          <p className="evidence-note">
            Ehhez a korábbi demóedzéshez csak az összesítés áll rendelkezésre;
            részletes sorozatnapló nincs.
          </p>
        )}
      </Section>
      <CompanionNote
        action="Beszéljünk az edzésről"
        onClick={() =>
          api.ask(
            `Nézzük át a ${h.name} edzésemet: ${h.sets} sorozat, ${h.duration} perc.`,
          )
        }
      >
        Volt munka benne. A következő alkalomnál az előző sorozatok segítenek
        elindulni.
      </CompanionNote>
    </>
  );
}
function Cycles({ api }) {
  const s = api.state.training;
  return (
    <>
      <FlowHead
        eyebrow="MEZOCIKLUS"
        title="A következő hetek íve."
        description="Egy átlátható terv. Elég ismétlés a fejlődéshez, elég hely az élethez."
      />
      {s.cycles.map((c) => (
        <button
          type="button"
          className="tr-cycle-card"
          key={c.id}
          onClick={() => api.go("train-cycle", { id: c.id })}
        >
          <span className="flow-kicker">
            {c.status === "active" ? "AKTÍV BLOKK" : "KORÁBBI BLOKK"} ·{" "}
            {c.currentWeek}/{c.weeks}. HÉT
          </span>
          <h2>{c.title}</h2>
          <div className="tr-arc">
            {Array.from({ length: c.weeks }, (_, i) => (
              <span
                key={i}
                style={{ height: `${i === c.weeks - 1 ? 20 : 35 + i * 11}px` }}
                className={i + 1 === c.currentWeek ? "current" : ""}
              />
            ))}
          </div>
          <span>
            {c.frequency} nap / hét ·{" "}
            {c.equipment === "gym" ? "terem" : "otthon"}
            <Icon name="arrow-right" size={18} />
          </span>
        </button>
      ))}
      <Action icon="plus" onClick={() => api.go("train-build")}>
        Új mezociklus építése
      </Action>
      {s.draft && (
        <FlowRow
          icon="edit"
          title="Félretett tervvázlat"
          subtitle={s.draft.title}
          onClick={() => api.go("train-draft")}
        />
      )}
      <CompanionNote>
        Előbb megnézed a tervet, és finomíthatsz rajta. Csak az aktiválással
        lesz belőle az aktuális blokkod.
      </CompanionNote>
    </>
  );
}
function MesoBuild({ api }) {
  const [step, setStep] = useState(0),
    [form, setForm] = useState({
      goal: "muscle",
      frequency: 3,
      equipment: "gym",
      sportLoad: "medium",
      weeks: 6,
    }),
    [error, setError] = useState("");
  const change = (key, v) => setForm({ ...form, [key]: v });
  const steps = ["Irány", "Idő és hely", "A teljes kép"];
  function next(e) {
    e.preventDefault();
    try {
      if (step < 2) {
        setStep(step + 1);
        return;
      }
      const draft = buildMesoDraft(form);
      api.update("training", (s) => ({ ...s, draft }));
      api.go("train-draft");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow={`ÚJ MEZOCIKLUS · ${step + 1}/3`}
        title={
          [
            "Miért szeretnél edzeni?",
            "Mibe férjen bele?",
            "A többi mozgás is számít.",
          ][step]
        }
        description={
          [
            "Ez adja a terv hangsúlyát. Később alakíthatsz rajta.",
            "A jó terv az, amit valóban végig tudsz vinni.",
            "A sport és a futás is munka a testednek.",
          ][step]
        }
      />
      <div className="tr-stepper">
        {steps.map((s, i) => (
          <span className={i <= step ? "active" : ""} key={s}>
            {i + 1} · {s}
          </span>
        ))}
      </div>
      <form className="flow-form" onSubmit={next}>
        {step === 0 ? (
          <>
            <div className="tr-choices">
              {[
                [
                  "muscle",
                  "dumbbell",
                  "Izmot építenék",
                  "Fokozatos, kontrollált volumen.",
                ],
                [
                  "strength",
                  "zap",
                  "Erősebb lennék",
                  "Kevesebb ismétlés, több fókusz.",
                ],
                [
                  "balance",
                  "sun",
                  "Jó ritmust keresek",
                  "Erő a hétköznapokhoz és a sporthoz.",
                ],
              ].map(([value, icon, title, sub]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={form.goal === value}
                  onClick={() => change("goal", value)}
                >
                  <Icon name={icon} />
                  <span>
                    <strong>{title}</strong>
                    <small>{sub}</small>
                  </span>
                  <i>
                    {form.goal === value && <Icon name="check" size={15} />}
                  </i>
                </button>
              ))}
            </div>
            <Field label="Blokk hossza">
              <select
                value={form.weeks}
                onChange={(e) => change("weeks", e.target.value)}
              >
                <option value="4">4 hét</option>
                <option value="6">6 hét</option>
                <option value="8">8 hét</option>
              </select>
            </Field>
          </>
        ) : step === 1 ? (
          <>
            <Field label="Heti teremi / otthoni alkalmak">
              <select
                value={form.frequency}
                onChange={(e) => change("frequency", e.target.value)}
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} alkalom / hét
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Elérhető felszerelés">
              <select
                value={form.equipment}
                onChange={(e) => change("equipment", e.target.value)}
              >
                <option value="gym">Teljes terem</option>
                <option value="home">Otthon · súlyzók, rúd és pad</option>
              </select>
            </Field>
            <p className="flow-copy">
              A vázlat{" "}
              {form.frequency <= 3
                ? "teljes testes napokat"
                : "megosztott edzésnapokat"}{" "}
              ajánl, közéjük pihenővel.
            </p>
          </>
        ) : (
          <>
            <Field label="Sport és futás a terem mellett">
              <select
                value={form.sportLoad}
                onChange={(e) => change("sportLoad", e.target.value)}
              >
                <option value="low">Kevés · legfeljebb 1 könnyű alkalom</option>
                <option value="medium">Közepes · 2–3 alkalom</option>
                <option value="high">Sok · több intenzív alkalom</option>
              </select>
            </Field>
            <CompanionNote>
              {form.sportLoad === "high"
                ? "Rövidebb napokat és kevesebb teremi sorozatot teszünk a vázlatba."
                : "Marad egyenletes teremi munka, és hely a többi mozgásnak."}{" "}
              Ez egy szerkeszthető demóvázlat, nem automatikus edzői döntés.
            </CompanionNote>
            <Stats
              items={[
                [form.frequency, "nap / hét"],
                [form.weeks, "hét"],
                [form.sportLoad === "high" ? "40 p" : "55 p", "alkalmanként"],
              ]}
            />
          </>
        )}
        <ErrorText error={error} />
        <button className="primary-button" type="submit">
          {step === 2 ? "Tervvázlat készítése" : "Tovább"}
          <Icon name="arrow-right" size={18} />
        </button>
        {step > 0 && (
          <button
            className="text-button"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            Előző lépés
          </button>
        )}
      </form>
    </>
  );
}
function MesoDraft({ api }) {
  const d = api.state.training.draft,
    [selected, setSelected] = useState(0),
    [error, setError] = useState("");
  if (!d)
    return (
      <EmptyState
        icon="layers"
        title="Még nincs tervvázlat."
        action="Terv készítése"
        onClick={() => api.go("train-build")}
      />
    );
  const day = d.days[selected] || d.days[0];
  const edit = (exercise, changes) => {
    try {
      const next = editDraftExercise(d, day.id, exercise, changes);
      api.update("training", (s) => ({ ...s, draft: next }));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <FlowHead
        eyebrow="TERVVÁZLAT · MÉG NEM AKTÍV"
        title="Nézd meg. Alakítsd magadra."
        description="A célod és az elérhető időd alapján összeállított helyi demóterv. Minden nap áttekinthető, minden sorozatszám szerkeszthető."
      />
      <Field label="A blokk neve">
        <input
          value={d.title}
          maxLength="60"
          onChange={(e) =>
            api.update("training", (s) => ({
              ...s,
              draft: { ...s.draft, title: e.target.value },
            }))
          }
        />
      </Field>
      <Stats
        items={[
          [d.weeks, "hét"],
          [d.days.length, "nap / hét"],
          [d.sportLoad === "high" ? "Visszafogott" : "Egyenletes", "terhelés"],
        ]}
      />
      <FlowTabs
        items={d.days.map((x, i) => [i, DAYS[x.day].slice(0, 3)])}
        value={selected}
        onChange={setSelected}
      />
      <Section title={day.name}>
        {day.exercises.map((e) => (
          <ExerciseRow
            key={e.id}
            item={e}
            api={api}
            editing
            onChange={(c) => edit(e.id, c)}
          />
        ))}
      </Section>
      <ErrorText error={error} />
      <p className="flow-copy">
        Az aktiválás a jelenlegi blokkot a korábbiak közé teszi. A szerkesztett
        sorozatok az új tervben maradnak.
      </p>
      <Action
        onClick={() => {
          if (!d.title.trim()) {
            setError("Adj nevet a blokkodnak.");
            return;
          }
          const id = ID("cycle");
          api.update("training", (s) => activateDraft(s, id));
          api.notify({
            title: "A mezociklusod készen áll",
            body: d.title,
            route: "train-cycle",
            params: { id },
            kind: "training",
          });
          api.toast("Az új mezociklus aktív.");
          api.go("train-cycle", { id });
        }}
      >
        Terv aktiválása
      </Action>
      <Action secondary onClick={() => api.go("train-cycles")}>
        Félreteszem későbbre
      </Action>
    </>
  );
}
function Cycle({ api }) {
  const c = resolveCycle(api.state.training, api.params.id);
  if (!c) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${c.status === "active" ? "AKTÍV" : "KORÁBBI"} · ${c.currentWeek}/${c.weeks}. HÉT`}
        title={c.title}
        description={`${c.frequency} nap / hét · ${c.equipment === "gym" ? "teljes terem" : "otthoni súlyzók"} · fokozatos építkezés`}
      />
      <div className="tr-cycle-arc">
        <div className="tr-arc">
          {Array.from({ length: c.weeks }, (_, i) => (
            <button
              key={i}
              className={i + 1 === c.currentWeek ? "current" : ""}
              style={{ height: `${i === c.weeks - 1 ? 35 : 55 + i * 10}px` }}
              onClick={() =>
                api.go("train-cycle-week", { id: c.id, week: String(i + 1) })
              }
            >
              <span>{i + 1}.</span>
            </button>
          ))}
        </div>
        <p>Alapozás → építkezés → könnyített hét</p>
      </div>
      <CompanionNote
        action="Heti vizsgálat"
        onClick={() =>
          api.go("train-cycle-week", { id: c.id, week: String(c.currentWeek) })
        }
      >
        A {c.currentWeek}. hétben jársz. A vázlat terhelési íve tájékozódást ad;
        a tested jelzései fontosabbak a tervnél.
      </CompanionNote>
      <Section title="A napjaid">
        {c.days.map((d) => (
          <FlowRow
            key={d.id}
            icon="dumbbell"
            title={`${DAYS[d.day]} · ${d.name}`}
            subtitle={`${d.exercises.length} gyakorlat · ${d.exercises.reduce((n, e) => n + e.sets, 0)} sorozat · ${d.duration} perc`}
            onClick={() => api.go("train-day", { id: c.id, day: d.id })}
          />
        ))}
      </Section>
      <Action
        secondary
        onClick={() => {
          api.update("training", (s) => ({
            ...s,
            draft: {
              ...JSON.parse(JSON.stringify(c)),
              status: "draft",
              title: c.title + " · új kör",
            },
          }));
          api.go("train-draft");
        }}
        icon="rotate"
      >
        Új kör ebből a tervből
      </Action>
    </>
  );
}
function CycleWeek({ api }) {
  const c = resolveCycle(api.state.training, api.params.id);
  if (!c) return <Empty api={api} />;
  const week = Number(api.params.week) || c.currentWeek;
  const muscles = {};
  c.days.forEach((d) =>
    d.exercises.forEach((e) => {
      const m = ex(e.id).muscle;
      muscles[m] = (muscles[m] || 0) + e.sets;
    }),
  );
  return (
    <>
      <FlowHead
        eyebrow={`${c.title} · ${week}. HÉT`}
        title={
          week === c.weeks
            ? "Hely a feltöltődésnek."
            : "A terhelés közelebbről."
        }
        description="Tervezett sorozatok izomcsoportonként. A sport és a futás külön is látható."
      />
      <FlowTabs
        items={Array.from({ length: c.weeks }, (_, i) => [i + 1, `${i + 1}.`])}
        value={week}
        onChange={(w) =>
          api.go("train-cycle-week", { id: c.id, week: String(w) })
        }
      />
      <Section title="Heti teremi volumen">
        {Object.entries(muscles).map(([m, n]) => (
          <div className="tr-load-row" key={m}>
            <div>
              <strong>{m}</strong>
              <span>{week === c.weeks ? Math.ceil(n / 2) : n} sorozat</span>
            </div>
            <div className="tr-meter">
              <i
                style={{
                  width: `${Math.min(100, (n / 24) * 100) * (week === c.weeks ? 0.5 : 1)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </Section>
      <p className="evidence-note">
        A záró hét felezett sorozatszámai a prototípus tervezési példái. Nincs
        automatikus, élő edzésmódosítás.
      </p>
      <FlowRow
        icon="heart"
        title="A többi terhelés"
        subtitle="Sport + futás + regeneráció"
        onClick={() => api.go("train-recovery")}
      />
      <Section title="Napokra bontva">
        {c.days.map((d) => (
          <FlowRow
            key={d.id}
            icon="calendar"
            title={`${DAYS[d.day]} · ${d.name}`}
            onClick={() => api.go("train-day", { id: c.id, day: d.id })}
          />
        ))}
      </Section>
    </>
  );
}
function Day({ api }) {
  const c = resolveCycle(api.state.training, api.params.id),
    d = resolveCycleDay(c, api.params.day);
  if (!d) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${DAYS[d.day]} · ${c.title}`}
        title={d.name}
        description={`${d.duration} perc · ${d.exercises.length} gyakorlat · a következő edzésed terve`}
      />
      <div className="tr-prep">
        <Icon name="sun" />
        <div>
          <strong>Érkezz meg az edzésbe.</strong>
          <p>
            5–8 perc könnyű átmozgatás, majd az első gyakorlatból néhány
            fokozatos bemelegítő sorozat.
          </p>
        </div>
      </div>
      <Section title="Gyakorlatok sorrendben">
        {d.exercises.map((e) => (
          <ExerciseRow key={e.id} api={api} item={e} />
        ))}
      </Section>
      <Action onClick={() => api.go("workout")}>Edzés megnyitása</Action>
      <p className="evidence-note">
        Az aktív edzés a közös demó edzésnapját nyitja meg. A mezociklusvázlat
        szerkesztése ettől külön kipróbálható.
      </p>
      <Action
        secondary
        icon="message"
        onClick={() =>
          api.ask(
            `Segíts áttekinteni a ${d.name} edzést: ${d.exercises.map((x) => ex(x.id).name).join(", ")}.`,
          )
        }
      >
        Mezóval átnézem
      </Action>
    </>
  );
}
function Sport({ api }) {
  const s = api.state.training,
    [tab, setTab] = useState("schedule");
  return (
    <>
      <FlowHead
        eyebrow="SPORT"
        title="A pályán is te vagy."
        description="Röplabda, TRX, Cross. A csapat és a mozgás öröme mellett a terhelés is helyet kap."
      />
      <div className="tr-sport-art" aria-hidden="true">
        <svg viewBox="0 0 340 120">
          <path
            d="M25 105 92 20h173l52 85Z M60 61h229 M180 20v85"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="228"
            cy="53"
            r="28"
            fill="var(--panel)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M209 32q40 7 40 38M201 57q22-20 43-18M209 76q4-24 42-20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>
      <Stats
        items={[
          [s.schedule.length, "heti alkalom"],
          [
            `${s.schedule.reduce((n, x) => n + x.duration, 0)} p`,
            "tervezett idő",
          ],
          [s.sportLogs.length, "naplóbejegyzés"],
        ]}
      />
      <FlowTabs
        items={[
          ["schedule", "Heti terv"],
          ["history", "Napló"],
          ["load", "Terhelés"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "schedule" ? (
        <>
          <Section
            title="Heti ritmus"
            action="Szerkesztés"
            onClick={() => api.go("train-sport-schedule")}
          >
            {s.schedule.map((slot) => {
              const log = s.sportLogs.find(
                (l) =>
                  l.slotId === slot.id &&
                  l.date === `2026-09-${String(7 + slot.day).padStart(2, "0")}`,
              );
              return (
                <FlowRow
                  key={slot.id}
                  icon="activity"
                  title={`${DAYS[slot.day]} · ${slot.sport}`}
                  subtitle={`${slot.time} · ${slot.duration} perc · ${slot.location || "Helyszín nélkül"}`}
                  value={log ? "Kész" : "Naplózd"}
                  onClick={() =>
                    api.go(
                      log ? "train-sport-detail" : "train-sport-log",
                      log ? { id: log.id } : { slot: slot.id },
                    )
                  }
                />
              );
            })}
          </Section>
          <Action
            icon="plus"
            secondary
            onClick={() => api.go("train-sport-schedule")}
          >
            Új sportalkalom a hétbe
          </Action>
        </>
      ) : tab === "history" ? (
        <Section title="A pályán töltött idő">
          {s.sportLogs.map((l) => (
            <FlowRow
              key={l.id}
              icon="check-circle"
              title={`${l.sport} · ${showDate(l.date)}`}
              subtitle={`${l.duration} perc · erőkifejtés ${l.rpe}/10`}
              onClick={() => api.go("train-sport-detail", { id: l.id })}
            />
          ))}
        </Section>
      ) : (
        <>
          <CompanionNote>
            A sport terhelése is hozzáadódik a teremi munkához. A helyi demó a
            naplózott idő × erőkifejtés alapján mutatja az arányokat.
          </CompanionNote>
          <Action secondary onClick={() => api.go("train-recovery")}>
            A teljes terhelési kép
          </Action>
        </>
      )}
      <Action icon="plus" onClick={() => api.go("train-sport-log")}>
        Sport naplózása
      </Action>
    </>
  );
}
function SportSchedule({ api }) {
  const s = api.state.training,
    [form, setForm] = useState({
      day: 1,
      sport: "Röplabda",
      time: "19:00",
      duration: 60,
      location: "",
    }),
    [error, setError] = useState("");
  const change = (k, v) => setForm({ ...form, [k]: v });
  function save(e) {
    e.preventDefault();
    try {
      const next = saveSportSlot(s, form);
      api.update("training", () => next);
      api.toast(
        form.id ? "Sportalkalom frissítve." : "Sportalkalom hozzáadva.",
      );
      setForm({ ...form, id: undefined });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow="HETI SPORTTERV"
        title="Legyen helye a pályának."
        description="Egy napra több alkalmat is felvehetsz. A mentett időpontok visszakerülnek a sport hetébe."
      />
      <div className="tr-schedule-list">
        {s.schedule.map((x) => (
          <div className="tr-schedule-item" key={x.id}>
            <button onClick={() => setForm({ ...x })}>
              <strong>
                {DAYS[x.day]} · {x.sport}
              </strong>
              <small>
                {x.time} · {x.duration} perc · {x.location || "Helyszín nélkül"}
              </small>
              <Icon name="edit" size={18} />
            </button>
            <button
              aria-label={`${DAYS[x.day]} ${x.sport} törlése`}
              onClick={() => {
                api.update("training", (st) => ({
                  ...st,
                  schedule: st.schedule.filter((slot) => slot.id !== x.id),
                }));
                api.toast("Alkalom törölve a heti tervből.");
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </div>
      <Section title={form.id ? "Alkalom szerkesztése" : "Új alkalom"}>
        <form className="flow-form" onSubmit={save}>
          <div className="flow-grid">
            <Field label="Nap">
              <select
                value={form.day}
                onChange={(e) => change("day", e.target.value)}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sport">
              <select
                value={form.sport}
                onChange={(e) => change("sport", e.target.value)}
              >
                {["Röplabda", "TRX", "Cross"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flow-grid">
            <Field label="Kezdés">
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => change("time", e.target.value)}
              />
            </Field>
            <Field label="Időtartam · perc">
              <input
                type="number"
                min="5"
                max="300"
                required
                value={form.duration}
                onChange={(e) => change("duration", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Helyszín">
            <input
              placeholder="Pl. Városmajor"
              value={form.location}
              onChange={(e) => change("location", e.target.value)}
            />
          </Field>
          <ErrorText error={error} />
          <button type="submit" className="primary-button">
            {form.id ? "Módosítás mentése" : "Alkalom hozzáadása"}
            <Icon name="check" size={18} />
          </button>
          {form.id && (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setForm({
                  day: 1,
                  sport: "Röplabda",
                  time: "19:00",
                  duration: 60,
                  location: "",
                })
              }
            >
              Inkább új alkalom
            </button>
          )}
        </form>
      </Section>
      <Action secondary onClick={() => api.go("train-sport")}>
        Vissza a sport hetéhez
      </Action>
    </>
  );
}
function SportLog({ api }) {
  const slot = api.state.training.schedule.find(
      (x) => x.id === api.params.slot,
    ),
    [form, setForm] = useState({
      sport: slot?.sport || "Röplabda",
      date: slot
        ? `2026-09-${String(7 + slot.day).padStart(2, "0")}`
        : "2026-09-08",
      duration: slot?.duration || 60,
      rpe: 6,
      notes: "",
    }),
    [error, setError] = useState("");
  const change = (k, v) => setForm({ ...form, [k]: v });
  function save(e) {
    e.preventDefault();
    try {
      const id = ID("sportlog"),
        next = logSport(api.state.training, { ...form, slotId: slot?.id, id });
      api.update("training", () => next);
      api.toast("Sportalkalom naplózva.");
      api.go("train-sport-detail", { id });
    } catch (e) {
      setError(e.message);
    }
  }
  if (api.params.slot !== undefined && !slot) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={slot ? `${DAYS[slot.day]} · ${slot.time}` : "ÚJ SPORTALKALOM"}
        title="Milyen volt a mozgás?"
        description="Amit valóban elvégeztél. A terv és a napló külön marad."
      />
      <form className="flow-form" onSubmit={save}>
        <Field label="Sport">
          <select
            value={form.sport}
            onChange={(e) => change("sport", e.target.value)}
          >
            {["Röplabda", "TRX", "Cross"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <div className="flow-grid">
          <Field label="Dátum">
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => change("date", e.target.value)}
            />
          </Field>
          <Field label="Időtartam · perc">
            <input
              type="number"
              min="1"
              max="600"
              required
              value={form.duration}
              onChange={(e) => change("duration", e.target.value)}
            />
          </Field>
        </div>
        <Field label={`Érzékelt erőkifejtés · ${form.rpe}/10`}>
          <input
            type="range"
            min="1"
            max="10"
            value={form.rpe}
            onChange={(e) => change("rpe", e.target.value)}
          />
          <span className="tr-range-labels">
            <small>Könnyű</small>
            <small>Nagyon nehéz</small>
          </span>
        </Field>
        <Field label="Amit megjegyeznél">
          <textarea
            rows="3"
            placeholder="Milyen volt a mozgás, a csapat, az energiaszinted?"
            value={form.notes}
            onChange={(e) => change("notes", e.target.value)}
          />
        </Field>
        <ErrorText error={error} />
        <button type="submit" className="primary-button">
          Alkalom mentése
          <Icon name="check" size={18} />
        </button>
      </form>
    </>
  );
}
function SportDetail({ api }) {
  const l = api.state.training.sportLogs.find((x) => x.id === api.params.id);
  if (!l) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${showDate(l.date)} · NAPLÓZVA`}
        title={l.sport}
        description="Ez is része annak, ahogy erősödsz."
      />
      <Stats
        items={[
          [`${l.duration} p`, "időtartam"],
          [`${l.rpe}/10`, "erőkifejtés"],
          [l.duration * l.rpe, "relatív terhelés"],
        ]}
      />
      <Section title="A te megjegyzésed">
        <blockquote className="tr-note">
          {l.notes || "Ehhez az alkalomhoz nem írtál megjegyzést."}
        </blockquote>
      </Section>
      <CompanionNote
        action="Nézzük egyben a hetet"
        onClick={() => api.go("train-recovery")}
      >
        {l.rpe >= 7
          ? "Intenzív alkalom volt. A következő edzés előtt érdemes ránézni, hogyan érzed magad."
          : "Egy újabb alkalom, amiben jelen voltál. Nem kell minden mozgásnak maximálisnak lennie."}
      </CompanionNote>
      <FlowRow
        icon="calendar"
        title="Vissza a sporthoz"
        subtitle="Heti terv és teljes napló"
        onClick={() => api.go("train-sport")}
      />
    </>
  );
}
function Recovery({ api }) {
  const load = crossLoad(api.state.training),
    sleep = api.state.personal?.sleep?.latest?.minutes;
  return (
    <>
      <FlowHead
        eyebrow="EGY TEST · TÖBBFÉLE MOZGÁS"
        title="A pihenés is része a tervnek."
        description="A szeptember 7–13-i demóhét naplózott terhelése egy helyen."
      />
      <div className="tr-load-total">
        <strong>{load.total}</strong>
        <span>relatív terhelési egység</span>
        <div
          className="tr-stacked"
          role="img"
          aria-label={`Terem ${load.gym}, sport ${load.sport}, futás ${load.running}`}
        >
          {[
            ["gym", 1],
            ["sport", 0.65],
            ["running", 0.35],
          ].map(([k, o]) => (
            <i key={k} style={{ flex: load[k], opacity: o }} />
          ))}
        </div>
      </div>
      {[
        ["Terem", load.gym, "A korábbi edzés mintája"],
        ["Sport", load.sport, "Naplózott perc × erőkifejtés"],
        ["Futás", load.running, "Naplózott perc × erőkifejtés"],
      ].map(([label, n, sub]) => (
        <div key={label} className="tr-load-row">
          <div>
            <strong>{label}</strong>
            <span>{n}</span>
          </div>
          <small>{sub}</small>
          <div className="tr-meter">
            <i style={{ width: `${(n / load.total) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="evidence-note">
        Szemléltető helyi összesítés, nem validált regenerációs pontszám. A
        prototípus nem módosítja automatikusan a teremi tervedet.
      </p>
      <Section title="Mi fér mellé ma?">
        <FlowRow
          icon="moon"
          title="Alvás"
          subtitle={
            sleep
              ? `${Math.floor(sleep / 60)} óra ${sleep % 60} perc · legutóbbi napló`
              : "Az alvásnapló adja a másik nézőpontot"
          }
          onClick={() => api.go("sleep")}
        />
        <FlowRow
          icon="utensils"
          title="Étkezés és folyadék"
          subtitle="Edzés körüli támogatás"
          onClick={() => api.go("fuel")}
        />
      </Section>
      <CompanionNote
        action="Segíts átgondolni a holnapot"
        onClick={() =>
          api.ask(
            `A heti relatív terhelésem ${load.total}: terem ${load.gym}, sport ${load.sport}, futás ${load.running}. Hogyan gondoljam át a következő edzést?`,
          )
        }
      >
        A számok mellé tedd oda azt is, hogyan érzed magad. Ha fáradtabb vagy a
        megszokottnál, lehet könnyebb napot választani.
      </CompanionNote>
    </>
  );
}

function Running({ api }) {
  const s = api.state.training,
    p = activeRun(s),
    [tab, setTab] = useState("plan");
  return (
    <>
      <FlowHead
        eyebrow="FUTÁS"
        title={
          api.variant === "companion"
            ? "Nem kell sietned. Csak indulj."
            : "A saját tempódban."
        }
        description="Egy könnyű kör, néhány élénk perc. Lépésről lépésre lesz belőle ritmus."
      />
      <div className="tr-run-art" aria-hidden="true">
        <svg viewBox="0 0 340 120">
          <path
            d="M-20 120Q80-45 170 72T380 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            opacity=".1"
          />
          <path
            d="M-20 120Q80-45 170 72T380 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="5 6"
          />
          <circle cx="163" cy="66" r="8" fill="var(--accent)" />
        </svg>
        <span>Nem a sebesség. A folytonosság.</span>
      </div>
      <Stats
        items={[
          [p ? `${p.currentWeek}/${p.weeks}` : "—", "a terv hete"],
          [
            s.runLogs.reduce((n, x) => n + x.distance, 0).toFixed(1) + " km",
            "naplózott táv",
          ],
          [s.runLogs.length, "futás"],
        ]}
      />
      <FlowTabs
        items={[
          ["plan", "Terv"],
          ["history", "Futónapló"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "plan" ? (
        <>
          <Section
            title={p?.title || "A következő futóterved"}
            action="Teljes terv"
            onClick={() => p && api.go("train-run-plan", { id: p.id })}
          >
            {p?.sessions.map((r) => (
              <FlowRow
                key={r.id}
                icon="run"
                title={r.name}
                subtitle={`${DAYS[r.day]} · ${r.duration} perc`}
                onClick={() =>
                  api.go("train-run-session", { id: r.id, plan: p.id })
                }
              />
            ))}
          </Section>
          <Action
            icon="plus"
            secondary
            onClick={() => api.go("train-run-build")}
          >
            Új futóterv építése
          </Action>
        </>
      ) : (
        <Section title="A megtett körök">
          {s.runLogs.map((l) => (
            <FlowRow
              key={l.id}
              icon="run"
              title={`${l.distance} km · ${showDate(l.date)}`}
              subtitle={`${l.duration} perc · ${l.pace} /km · ${l.rpe}/10 erőkifejtés`}
              onClick={() => api.go("train-run-detail", { id: l.id })}
            />
          ))}
        </Section>
      )}
      <Action icon="plus" onClick={() => api.go("train-run-log")}>
        Szabad futás naplózása
      </Action>
      <FlowRow
        icon="heart"
        title="Hogyan fér a hetedbe?"
        subtitle="Futás + sport + teremi terhelés"
        onClick={() => api.go("train-recovery")}
      />
    </>
  );
}
function RunBuild({ api }) {
  const [form, setForm] = useState({
      goal: "5k",
      frequency: 2,
      weeks: 6,
      minutes: 30,
    }),
    [error, setError] = useState("");
  const change = (k, v) => setForm({ ...form, [k]: v });
  function save(e) {
    e.preventDefault();
    try {
      const runDraft = buildRunPlan(form);
      api.update("training", (s) => ({ ...s, runDraft }));
      api.go("train-run-preview");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow="FUTÓTERV ÉPÍTÉSE"
        title="Találjunk egy tartható ritmust."
        description="Egyszerű, szerkeszthető demóvázlat könnyű és váltakozó tempójú alkalmakból."
      />
      <form className="flow-form" onSubmit={save}>
        <Field label="A célod">
          <select
            value={form.goal}
            onChange={(e) => change("goal", e.target.value)}
          >
            <option value="5k">Magabiztos 5 kilométer</option>
            <option value="base">Könnyed állóképesség</option>
          </select>
        </Field>
        <div className="flow-grid">
          <Field label="Heti alkalom">
            <select
              value={form.frequency}
              onChange={(e) => change("frequency", e.target.value)}
            >
              <option value="2">2 futás</option>
              <option value="3">3 futás</option>
            </select>
          </Field>
          <Field label="Hetek száma">
            <input
              type="number"
              min="2"
              max="8"
              required
              value={form.weeks}
              onChange={(e) => change("weeks", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Egy alkalomra szánt perc">
          <input
            type="number"
            min="20"
            max="90"
            required
            value={form.minutes}
            onChange={(e) => change("minutes", e.target.value)}
          />
        </Field>
        <CompanionNote>
          Az elsődleges cél az ismételhető, kényelmes mozgás. A teremi és
          sportnapjaid mellett is maradjon idő feltöltődni.
        </CompanionNote>
        <ErrorText error={error} />
        <button className="primary-button" type="submit">
          Mutasd a vázlatot
          <Icon name="arrow-right" size={18} />
        </button>
      </form>
    </>
  );
}
function RunPreview({ api }) {
  const p = api.state.training.runDraft;
  if (!p)
    return (
      <EmptyState
        title="Még nincs futótervvázlat."
        action="Terv építése"
        onClick={() => api.go("train-run-build")}
      />
    );
  return (
    <>
      <FlowHead
        eyebrow="ELŐNÉZET · MÉG NEM AKTÍV"
        title={p.title}
        description={`${p.weeks} hét · ${p.sessions.length} futás hetente · kényelmes kezdés`}
      />
      <Section title="Egy hét a tervből">
        {p.sessions.map((s, i) => (
          <div key={s.id} className="tr-run-preview">
            <h3>{s.name}</h3>
            <p>
              {s.duration} perc · {s.intervals.map((x) => x.label).join(" → ")}
            </p>
            <Field label="Melyik napon?">
              <select
                value={s.day}
                onChange={(e) =>
                  api.update("training", (st) => ({
                    ...st,
                    runDraft: {
                      ...st.runDraft,
                      sessions: st.runDraft.sessions.map((r, j) =>
                        i === j ? { ...r, day: Number(e.target.value) } : r,
                      ),
                    },
                  }))
                }
              >
                {DAYS.map((d, j) => (
                  <option key={d} value={j}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </Section>
      <p className="flow-copy">
        Az új futóterv aktiválása a korábbi futóblokkot archiválja. A teremi
        mezociklusod aktív marad.
      </p>
      <Action
        onClick={() => {
          const id = ID("runplan");
          api.update("training", (s) => activateRunPlan(s, s.runDraft, id));
          api.toast("A futóterved aktív.");
          api.go("train-run-plan", { id });
        }}
      >
        Futóterv aktiválása
      </Action>
      <Action secondary onClick={() => api.go("train-run-build")}>
        Vissza a beállításokhoz
      </Action>
    </>
  );
}
function RunPlan({ api }) {
  const p = resolveRunPlan(api.state.training, api.params.id),
    [week, setWeek] = useState(p?.currentWeek || 1);
  if (!p) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${p.status === "active" ? "AKTÍV FUTÓTERV" : "KORÁBBI FUTÓTERV"} · ${p.currentWeek}/${p.weeks}. HÉT`}
        title={p.title}
        description="A napok kapaszkodók. A naplóban az marad meg, amit valóban lefutottál."
      />
      <FlowTabs
        items={Array.from({ length: p.weeks }, (_, i) => [i + 1, `${i + 1}.`])}
        value={week}
        onChange={setWeek}
      />
      <Section
        title={`${week}. hét · ${week === p.weeks ? "Könnyű lezárás" : "Kényelmes folytonosság"}`}
      >
        {p.sessions.map((s) => (
          <FlowRow
            key={s.id}
            icon="run"
            title={s.name}
            subtitle={`${DAYS[s.day]} · ${s.duration} perc`}
            onClick={() =>
              api.go("train-run-session", {
                id: s.id,
                plan: p.id,
                week: String(week),
              })
            }
          />
        ))}
      </Section>
      <p className="evidence-note">
        Ebben a demóban ugyanaz az alapheti szerkezet ismétlődik; nincs élő,
        teljesítmény alapján történő progresszió.
      </p>
      <CompanionNote
        action="A terhelésed egyben"
        onClick={() => api.go("train-recovery")}
      >
        A futás akkor is számít, ha lassú. A mozgás élménye és a visszatérés
        többet mond egyetlen tempóadatnál.
      </CompanionNote>
    </>
  );
}
function RunSession({ api }) {
  const p = resolveRunPlan(api.state.training, api.params.plan),
    r = p?.sessions.find((x) => x.id === api.params.id);
  if (!r) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${DAYS[r.day]} · ${api.params.week || p.currentWeek}. HÉT`}
        title={r.name}
        description={`${r.duration} perc · ${p.title}`}
      />
      <div className="tr-session-orbit">
        <Icon name="run" size={42} />
        <strong>{r.duration}</strong>
        <span>perc magadnak</span>
      </div>
      <Section title="Így épül fel">
        {r.intervals.map((x, i) => (
          <FlowRow
            key={i}
            icon={i === 0 ? "sun" : "activity"}
            title={x.label}
            value={`${x.minutes} p`}
          />
        ))}
      </Section>
      <CompanionNote>
        Olyan tempót válassz, ahol még tudsz mondatokban beszélni. Ha szükséges,
        válts sétára.
      </CompanionNote>
      <Action
        onClick={() => api.go("train-run-log", { plan: p.id, session: r.id })}
      >
        Elvégeztem · naplózom
      </Action>
      <p className="evidence-note">
        Nincs GPS-követés vagy elindított háttérmérés. A következő lépésben a
        tényleges futásodat rögzítheted.
      </p>
    </>
  );
}
function RunLog({ api }) {
  const p = resolveRunPlan(api.state.training, api.params.plan),
    r = p?.sessions.find((x) => x.id === api.params.session),
    [form, setForm] = useState({
      date: "2026-09-08",
      distance: "",
      duration: r?.duration || 30,
      rpe: 4,
      notes: "",
    }),
    [error, setError] = useState("");
  const change = (k, v) => setForm({ ...form, [k]: v });
  function save(e) {
    e.preventDefault();
    try {
      const id = ID("runlog"),
        next = logRun(api.state.training, {
          ...form,
          id,
          planId: r ? p.id : undefined,
          sessionId: r?.id,
        });
      api.update("training", () => next);
      api.toast("A futásod bekerült a naplóba.");
      api.go("train-run-detail", { id });
    } catch (e) {
      setError(e.message);
    }
  }
  if (
    (api.params.plan !== undefined && !p) ||
    (api.params.session !== undefined && !r)
  )
    return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={r ? "TERVHEZ KAPCSOLT FUTÁS" : "SZABAD FUTÁS"}
        title="Megvolt a kör."
        description={
          r
            ? r.name
            : "A tényleges táv és idő alapján kiszámoljuk az átlagtempót."
        }
      />
      <form className="flow-form" onSubmit={save}>
        <Field label="Dátum">
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => change("date", e.target.value)}
          />
        </Field>
        <div className="flow-grid">
          <Field label="Megtett táv · km">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              placeholder="4,2"
              required
              value={form.distance}
              onChange={(e) => change("distance", e.target.value)}
            />
          </Field>
          <Field label="Időtartam · perc">
            <input
              type="number"
              min="1"
              max="600"
              required
              value={form.duration}
              onChange={(e) => change("duration", e.target.value)}
            />
          </Field>
        </div>
        <Field label={`Erőkifejtés · ${form.rpe}/10`}>
          <input
            type="range"
            min="1"
            max="10"
            value={form.rpe}
            onChange={(e) => change("rpe", e.target.value)}
          />
        </Field>
        <Field label="Milyen érzés volt?">
          <textarea
            rows="3"
            placeholder="Pl. könnyű lábak, szeles idő, jólesett…"
            value={form.notes}
            onChange={(e) => change("notes", e.target.value)}
          />
        </Field>
        <ErrorText error={error} />
        <button type="submit" className="primary-button">
          Futás mentése
          <Icon name="check" size={18} />
        </button>
      </form>
    </>
  );
}
function RunDetail({ api }) {
  const l = api.state.training.runLogs.find((x) => x.id === api.params.id);
  if (!l) return <Empty api={api} />;
  return (
    <>
      <FlowHead
        eyebrow={`${showDate(l.date)} · FUTÓNAPLÓ`}
        title={`${l.distance} kilométer magadért.`}
        description={
          l.sessionId
            ? "Tervhez kapcsolt, naplózott futás."
            : "Szabadon naplózott futás."
        }
      />
      <div className="tr-run-distance">
        <Icon name="run" size={34} />
        <strong>
          {String(l.distance).replace(".", ",")}
          <small>km</small>
        </strong>
      </div>
      <Stats
        items={[
          [`${l.duration} p`, "idő"],
          [l.pace, "perc / km"],
          [`${l.rpe}/10`, "erőkifejtés"],
        ]}
      />
      <Section title="A futás érzése">
        <blockquote className="tr-note">
          {l.notes || "Ehhez a futáshoz nem írtál megjegyzést."}
        </blockquote>
      </Section>
      <p className="evidence-note">
        Az átlagtempó a megadott időből és távból számított érték. Ehhez a
        kézzel naplózott futáshoz nincs GPS-nyomvonal.
      </p>
      <CompanionNote
        action="A hét teljes terhelése"
        onClick={() => api.go("train-recovery")}
      >
        Ez a futás már a heti terhelési képben is benne van. A következő kör
        előtt hagyj helyet a feltöltődésnek.
      </CompanionNote>
      <Action secondary onClick={() => api.go("train-running")}>
        Vissza a futáshoz
      </Action>
    </>
  );
}
function Exercises({ api }) {
  const [query, setQuery] = useState(""),
    [muscle, setMuscle] = useState("all"),
    [favorites, setFavorites] = useState(false);
  const list = searchExercises(query, muscle).filter(
    (e) => !favorites || api.state.training.favorites.includes(e.id),
  );
  return (
    <>
      <FlowHead
        eyebrow="GYAKORLATTÁR"
        title="Ismerd a mozdulatot."
        description="Képes technikai útmutatók, saját rekordok és gyorsan elérhető kedvencek."
      />
      <Field label="Gyakorlat keresése">
        <div className="tr-search">
          <Icon name="search" size={19} />
          <input
            type="search"
            placeholder="Név vagy izomcsoport…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Field>
      <FlowTabs
        items={[
          ["all", "Mind"],
          ["Mell", "Mell"],
          ["Hát", "Hát"],
          ["Láb", "Láb"],
          ["Váll", "Váll"],
        ]}
        value={muscle}
        onChange={setMuscle}
      />
      <button
        type="button"
        className="tr-favorite-filter"
        aria-pressed={favorites}
        onClick={() => setFavorites(!favorites)}
      >
        <Icon name="heart" size={18} />
        {favorites ? "Csak a kedvenceim" : "Kedvencek mutatása"}
        <span>{api.state.training.favorites.length}</span>
      </button>
      <div className="tr-catalog">
        {list.map((e) => (
          <button
            type="button"
            className="tr-catalog-item"
            key={e.id}
            onClick={() => api.go("train-exercise", { id: e.id })}
          >
            <div className="tr-catalog-photo">
              <img src={asset(e)} alt={`${e.name} kiinduló helyzet`} />
              <span>{e.muscle}</span>
            </div>
            <div>
              <h3>{e.name}</h3>
              <small>{e.sessions} alkalom · képes útmutató</small>
              <strong>
                {e.best}
                <Icon name="arrow-up-right" size={16} />
              </strong>
            </div>
          </button>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title="Most nincs találat."
          description="Próbálj másik kifejezést vagy izomcsoportot."
          action="Szűrők törlése"
          onClick={() => {
            setQuery("");
            setMuscle("all");
            setFavorites(false);
          }}
        />
      )}
    </>
  );
}
function TechniqueStudy({ exercise }) {
  const [playing, setPlaying] = useState(false),
    [pose, setPose] = useState("a");
  return (
    <div className="tr-technique">
      <div className={`tr-technique-images ${playing ? "playing" : ""}`}>
        <img
          src={asset(exercise, pose)}
          alt={`${exercise.name}: ${pose === "a" ? "kiinduló" : "véghelyzet"}`}
        />
        {playing && (
          <img
            className="tr-technique-second"
            src={asset(exercise, "b")}
            alt={`${exercise.name}: véghelyzet`}
          />
        )}
        <span>
          {playing
            ? "Két helyzet váltakozása"
            : pose === "a"
              ? "01 · Kiinduló helyzet"
              : "02 · Véghelyzet"}
        </span>
      </div>
      <div className="tr-technique-controls">
        <button
          type="button"
          onClick={() => {
            setPose("a");
            setPlaying(!playing);
          }}
          aria-label={
            playing
              ? "Mozdulattanulmány szüneteltetése"
              : "Mozdulattanulmány lejátszása"
          }
        >
          <Icon name={playing ? "pause" : "play"} size={20} />
          {playing ? "Szünet" : "Lejátszás"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setPose(pose === "a" ? "b" : "a");
          }}
        >
          <Icon name="image" size={19} />
          Másik helyzet
        </button>
      </div>
      <small>Kétképes mozdulattanulmány · nem videófelvétel</small>
    </div>
  );
}
function Exercise({ api }) {
  const e = EXERCISES.find((x) => x.id === api.params.id),
    [tab, setTab] = useState("technique");
  if (!e) return <Empty api={api} />;
  const favorite = api.state.training.favorites.includes(e.id);
  return (
    <>
      <FlowHead
        eyebrow={`${e.muscle.toUpperCase()} · ${e.equipment === "gym" ? "TEREM" : "SÚLYZÓK"}`}
        title={e.name}
      />
      <TechniqueStudy exercise={e} />
      <button
        type="button"
        className="tr-favorite-filter"
        aria-pressed={favorite}
        onClick={() => {
          api.update("training", (s) => ({
            ...s,
            favorites: favorite
              ? s.favorites.filter((x) => x !== e.id)
              : [...s.favorites, e.id],
          }));
          api.toast(
            favorite ? "Kivéve a kedvencekből." : "Elmentve a kedvenceid közé.",
          );
        }}
      >
        <Icon name="heart" size={20} />
        {favorite ? "A kedvenceid között" : "Mentés a kedvencek közé"}
        {favorite && <Icon name="check" size={17} />}
      </button>
      <FlowTabs
        items={[
          ["technique", "Technika"],
          ["records", "Rekordjaim"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "technique" ? (
        <>
          <Section title="Három kapaszkodó">
            <ol className="tr-cues">
              {e.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          </Section>
          <div className="tr-prep">
            <Icon name="lightbulb" />
            <p>
              A képek két helyzetet mutatnak, a teljes mozgáspályát nem.
              Kényelmes tartományban, kontrollált tempóval gyakorolj.
            </p>
          </div>
        </>
      ) : (
        <>
          <Stats
            items={[
              [e.best, "legjobb sorozat"],
              [e.sessions, "alkalom"],
            ]}
          />
          <Section title="Az utolsó alkalmak">
            {[0, 1, 2].map((n) => (
              <FlowRow
                key={n}
                icon="dumbbell"
                title={["Szept. 4.", "Szept. 1.", "Aug. 28."][n]}
                subtitle={`${3} sorozat · naplózott edzés`}
                value={e.best}
                onClick={() =>
                  api.go("train-gym-detail", {
                    id: n === 0 ? "gym-2" : "gym-1",
                  })
                }
              />
            ))}
          </Section>
          <p className="evidence-note">
            A rekordtörténet szemléltető demóadat.
          </p>
        </>
      )}
      <Action
        secondary
        icon="message"
        onClick={() =>
          api.ask(`Segíts a ${e.name} gyakorlat technikáját átgondolni.`)
        }
      >
        Mezót kérdezem
      </Action>
    </>
  );
}
function Medals({ api }) {
  const [tab, setTab] = useState("earned"),
    s = api.state.training,
    medals = s.medals.filter((m) => m.earned === (tab === "earned"));
  return (
    <>
      <FlowHead
        eyebrow="MEDÁLOK"
        title="A munkád nyomot hagy."
        description="Egy súlylépcső, egy tisztább sorozat. A saját korábbi teljesítményedhez mérve."
      />
      <div className="tr-medal-hero" aria-hidden="true">
        <Icon name="medal" size={72} />
        <span>
          {s.medals.filter((m) => m.earned).length} személyes mérföldkő
        </span>
      </div>
      <FlowTabs
        items={[
          ["earned", "Megszerzett"],
          ["progress", "Következő célok"],
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="tr-medal-list">
        {medals.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => api.go("train-medal", { id: m.id })}
          >
            <span className={`tr-medal-seal ${m.earned ? "earned" : ""}`}>
              <Icon name={m.earned ? "medal" : "target"} size={28} />
            </span>
            <div>
              <small>{m.earned ? showDate(m.date) : "FOLYAMATBAN"}</small>
              <h3>{m.name}</h3>
              <p>{ex(m.exerciseId).name}</p>
              <strong>
                {m.earned
                  ? `${m.value} ${m.unit}`
                  : `${m.value} / ${m.target} ${m.unit}`}
              </strong>
              {!m.earned && (
                <div className="tr-meter">
                  <i style={{ width: `${(m.value / m.target) * 100}%` }} />
                </div>
              )}
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </div>
      <p className="evidence-note">
        Edzésmedálok és személyes célpéldák. Az Én terület életmódbeli
        kitüntetései külön gyűjteményt alkotnak.
      </p>
    </>
  );
}
function Medal({ api }) {
  const m = api.state.training.medals.find((x) => x.id === api.params.id);
  if (!m) return <Empty api={api} />;
  return (
    <>
      <div className={`tr-medal-detail ${m.earned ? "earned" : ""}`}>
        <Icon name={m.earned ? "medal" : "target"} size={85} />
        <span className="flow-kicker">
          {m.earned ? "MEGSZEREZTED" : "A KÖVETKEZŐ MÉRFÖLDKŐ"}
        </span>
        <h1>{m.name}</h1>
        <strong>
          {m.earned ? m.value : `${m.value} / ${m.target}`}
          <small>{m.unit}</small>
        </strong>
        <p>{ex(m.exerciseId).name}</p>
      </div>
      {m.earned ? (
        <Stats
          items={[
            [showDate(m.date), "elérés"],
            [m.previous, "előző legjobb"],
          ]}
        />
      ) : (
        <>
          <div className="tr-meter">
            <i style={{ width: `${(m.value / m.target) * 100}%` }} />
          </div>
          <p className="flow-copy">
            Még {m.target - m.value} {m.unit} választ el a célpéldától. Ez nem
            határidő vagy edzésutasítás.
          </p>
        </>
      )}
      <CompanionNote>
        {m.earned
          ? "Ezt a saját korábbi teljesítményedhez képest érted el. Érdemes egy pillanatra megállni mellette."
          : "A következő lépcső megvár. A technika és a jó edzésritmus most is számít."}
      </CompanionNote>
      <Action
        secondary
        onClick={() => api.go("train-exercise", { id: m.exerciseId })}
      >
        A gyakorlat és rekordjaim
      </Action>
      {m.earned && (
        <Action
          icon="sparkles"
          onClick={() => {
            api.celebrate();
            api.toast("Ez a te munkád. Szép mérföldkő!");
          }}
        >
          Egy pillanat az ünneplésre
        </Action>
      )}
    </>
  );
}
const PAGES = {
  train: TrainHub,
  "train-gym": Gym,
  "train-gym-detail": GymDetail,
  "train-cycles": Cycles,
  "train-build": MesoBuild,
  "train-draft": MesoDraft,
  "train-cycle": Cycle,
  "train-cycle-week": CycleWeek,
  "train-day": Day,
  "train-sport": Sport,
  "train-sport-schedule": SportSchedule,
  "train-sport-log": SportLog,
  "train-sport-detail": SportDetail,
  "train-recovery": Recovery,
  "train-running": Running,
  "train-run-build": RunBuild,
  "train-run-preview": RunPreview,
  "train-run-plan": RunPlan,
  "train-run-session": RunSession,
  "train-run-log": RunLog,
  "train-run-detail": RunDetail,
  "train-exercises": Exercises,
  "train-exercise": Exercise,
  "train-medals": Medals,
  "train-medal": Medal,
};
export default function TrainFlow({ page, api }) {
  const Page = PAGES[page];
  return (
    <div className="flow-page tr-page">
      {Page ? (
        <Page key={`${page}-${JSON.stringify(api.params || {})}`} api={api} />
      ) : (
        <Empty api={api} />
      )}
    </div>
  );
}
