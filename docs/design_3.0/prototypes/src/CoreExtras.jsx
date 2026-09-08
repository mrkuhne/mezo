import React, { useState, useEffect } from "react";
import { FlowHead, FlowRow, FlowTabs } from "./flows/FlowUI.jsx";
import { BoopIcon as Icon } from "./BoopIdentity.jsx";
import { ContourSurface } from "./ContourSurface.jsx";
import {
  saveLifeGoal,
  logSessionSet,
  finishSession,
  closeCycle,
} from "./complete-model.mjs";
import { EXERCISES, DAYS } from "./flows/train-state.mjs";
const Field = ({ label, children, ...props }) => (
  <label className="flow-field">
    {label}
    {children || <input {...props} />}
  </label>
);
const Button = ({ children, onClick, secondary = false, ...props }) => (
  <button
    className={secondary ? "secondary-button" : "primary-button"}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);
export const EXTRA_ROUTES = {
  goals: { title: "Célok" },
  "goal-new": { title: "Új életcél" },
  "goal-detail": { title: "Életcél" },
  "goal-edit": { title: "Cél szerkesztése" },
  "goal-signals": { title: "A cél jelei" },
  "weight-goal": { title: "Testsúlycél" },
  workout: { title: "Aktív edzés" },
  "workout-review": { title: "Edzés összegzése" },
  "train-templates": { title: "Sablonok" },
  "train-close": { title: "Mezociklus lezárása" },
  "train-report": { title: "Blokkriport" },
  "train-compare": { title: "Blokkok összevetése" },
  "train-muscle": { title: "Izomcsoport" },
  "knowledge-new": { title: "Új tény" },
  "core-index": { title: "Minden funkció" },
};
export function GoalsFlow({ page, api }) {
  const goal = api.state.lifeGoals.find((g) => g.id === api.params.id);
  const [filter, setFilter] = useState("active"),
    [form, setForm] = useState(
      goal
        ? structuredClone(goal)
        : {
            title: "",
            dimension: "fizikai",
            note: "",
            pillars: [
              { title: "", target: 3, value: 0, unit: "alkalom / hét" },
            ],
          },
    ),
    [error, setError] = useState(""),
    [target, setTarget] = useState(api.state.personal.weight.target);
  function save(e) {
    e.preventDefault();
    try {
      api.change((f) => saveLifeGoal(f, form));
      api.go("goals");
      api.toast("Cél mentve");
    } catch (e) {
      setError(e.message);
    }
  }
  if (page === "weight-goal")
    return (
      <>
        <FlowHead eyebrow="TESTSÚLY · CÉL" title="Milyen irányba tartasz?" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(String(target).replace(",", "."));
            if (n < 30 || n > 300 || !Number.isFinite(n))
              return setError("30 és 300 kg közötti értéket adj meg.");
            api.update("personal", (p) => ({
              ...p,
              weight: { ...p.weight, target: n },
            }));
            api.go("me-weight");
          }}
        >
          <Field
            label="Cél testsúly · kg"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
          />
          <p className="flow-copy">
            Jelenlegi mérés: {api.state.personal.weight.latest} kg. A cél a
            súlynézetben is megjelenik.
          </p>
          {error && <p role="alert">{error}</p>}
          <Button type="submit">Cél mentése</Button>
        </form>
      </>
    );
  if (page === "goal-new" || page === "goal-edit")
    return (
      <>
        <FlowHead
          eyebrow="ÉLETCÉL · SAJÁT SZÁNDÉK"
          title={goal ? "Alakítsd tovább." : "Miért szeretnél tenni?"}
          description="A pillérek teszik követhetővé a célodat."
        />
        <form onSubmit={save}>
          <Field
            label="Cél neve"
            value={form.title}
            required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Field label="Életterület">
            <select
              value={form.dimension}
              onChange={(e) => setForm({ ...form, dimension: e.target.value })}
            >
              {[
                "fizikai",
                "mentális",
                "kapcsolatok",
                "lelki",
                "eredmény",
                "elmélyülés",
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Miért fontos neked?">
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          {form.pillars.map((p, i) => (
            <section className="core-pillar" key={i}>
              <Field
                label={`${i + 1}. pillér`}
                value={p.title}
                required
                onChange={(e) =>
                  setForm({
                    ...form,
                    pillars: form.pillars.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <Field
                label="Heti célérték"
                type="number"
                min="1"
                value={p.target}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pillars: form.pillars.map((x, j) =>
                      j === i ? { ...x, target: e.target.value } : x,
                    ),
                  })
                }
              />
              {form.pillars.length > 1 && (
                <Button
                  secondary
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      pillars: form.pillars.filter((_, j) => j !== i),
                    })
                  }
                >
                  Pillér eltávolítása
                </Button>
              )}
            </section>
          ))}
          <Button
            secondary
            type="button"
            disabled={form.pillars.length >= 5}
            onClick={() =>
              setForm({
                ...form,
                pillars: [...form.pillars, { title: "", target: 3, value: 0 }],
              })
            }
          >
            Új pillér · {form.pillars.length}/5
          </Button>
          {error && <p role="alert">{error}</p>}
          <Button type="submit">Cél mentése</Button>
        </form>
      </>
    );
  if (page === "goal-detail" || page === "goal-signals") {
    if (!goal) return <p>Ez a cél nem található.</p>;
    return (
      <>
        <FlowHead
          eyebrow={`${goal.dimension} · ${goal.status === "active" ? "AKTÍV" : "ARCHIVÁLT"}`}
          title={goal.title}
          description={goal.note}
        />
        <FlowTabs
          items={[
            ["goal-detail", "Pillérek"],
            ["goal-signals", "Jelek"],
          ]}
          value={page}
          onChange={(p) => api.go(p, { id: goal.id })}
        />
        {goal.pillars.map((p) => (
          <section key={p.id} className="core-pillar">
            <h2>{p.title}</h2>
            <div className="core-large">
              {p.value || 0}
              <small> / {p.target}</small>
            </div>
            <progress value={p.value || 0} max={p.target} />
            <p className="flow-copy">
              {p.unit || "alkalom / hét"} · kézi jelzés a bemutatóban
            </p>
            <div className="core-actions">
              <Button
                secondary
                disabled={!p.value}
                onClick={() =>
                  api.change((f) => ({
                    ...f,
                    lifeGoals: f.lifeGoals.map((g) =>
                      g.id === goal.id
                        ? {
                            ...g,
                            pillars: g.pillars.map((x) =>
                              x.id === p.id
                                ? { ...x, value: Math.max(0, x.value - 1) }
                                : x,
                            ),
                          }
                        : g,
                    ),
                  }))
                }
              >
                − Visszavonom
              </Button>
              <Button
                onClick={() =>
                  api.change((f) => ({
                    ...f,
                    lifeGoals: f.lifeGoals.map((g) =>
                      g.id === goal.id
                        ? {
                            ...g,
                            pillars: g.pillars.map((x) =>
                              x.id === p.id
                                ? { ...x, value: (x.value || 0) + 1 }
                                : x,
                            ),
                          }
                        : g,
                    ),
                  }))
                }
              >
                + Megvolt
              </Button>
            </div>
          </section>
        ))}
        <Field label="Cél állapota">
          <select
            value={goal.status}
            onChange={(e) =>
              api.change((f) => ({
                ...f,
                lifeGoals: f.lifeGoals.map((g) =>
                  g.id === goal.id ? { ...g, status: e.target.value } : g,
                ),
              }))
            }
          >
            {[
              ["active", "Aktív"],
              ["parked", "Pihentetem"],
              ["done", "Elértem"],
              ["archived", "Archivált"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <FlowRow
          title="Cél és pillérek szerkesztése"
          icon="edit"
          onClick={() => api.go("goal-edit", { id: goal.id })}
        />
        <Button
          secondary
          onClick={() =>
            api.change((f) => ({
              ...f,
              lifeGoals: f.lifeGoals.map((g) =>
                g.id === goal.id
                  ? {
                      ...g,
                      status: g.status === "active" ? "archived" : "active",
                    }
                  : g,
              ),
            }))
          }
        >
          {goal.status === "active" ? "Archiválás" : "Újra aktív"}
        </Button>
      </>
    );
  }
  return (
    <>
      <FlowHead eyebrow="AMERRE TARTASZ" title="Amiért jó elindulni." />
      <Button onClick={() => api.go("goal-new")}>Új életcél</Button>
      <FlowTabs
        items={[
          ["active", "Aktív"],
          ["parked", "Pihenő"],
          ["done", "Elért"],
          ["archived", "Archív"],
        ]}
        value={filter}
        onChange={setFilter}
      />
      {api.state.lifeGoals
        .filter((g) => g.status === filter)
        .map((g) => (
          <FlowRow
            key={g.id}
            title={g.title}
            subtitle={`${g.dimension} · ${g.pillars.length} pillér`}
            icon="target"
            onClick={() => api.go("goal-detail", { id: g.id })}
          />
        ))}
      <FlowRow
        title="Testsúlycél"
        subtitle={`${api.state.personal.weight.target} kg`}
        icon="scale"
        onClick={() => api.go("weight-goal")}
      />
      <FlowRow
        title="Kapcsolataim"
        icon="users"
        onClick={() => api.go("me-people")}
      />
    </>
  );
}
export function SessionFlow({ api, review = false }) {
  const session = api.state.session;
  const [error, setError] = useState(""),
    [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!session)
    return (
      <>
        <FlowHead title="Indíts egy edzést." />
        <Button onClick={() => api.go("workout")}>Edzés indítása</Button>
      </>
    );
  const records = session.exercises.flatMap((e) => e.records),
    done = records.filter((r) => r.done).length;
  const isDone = session.status === "completed";
  function setRecord(ei, si, patch) {
    try {
      api.change((f) =>
        logSessionSet(f, ei, si, {
          ...f.session.exercises[ei].records[si],
          ...patch,
        }),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <FlowHead
        eyebrow={isDone ? "EDZÉS · MEGŐRIZVE" : "EDZÉS · MOST"}
        title={session.title}
        description={`${done} / ${records.length} sorozat · ${Math.floor(((session.endedAt || tick) - session.startedAt) / 60000)} perc`}
      />
      {isDone && (
        <section className="core-summary">
          <div className="core-large">
            {done}
            <small> sorozat</small>
          </div>
          <p>
            {records
              .filter((r) => r.done)
              .reduce((n, r) => n + r.kg * r.reps, 0)}{" "}
            kg összvolumen
          </p>
        </section>
      )}
      {session.exercises.map((e, ei) => (
        <section className="core-exercise" key={`${e.id}-${ei}`}>
          <FlowRow
            title={e.name}
            subtitle="Gyakorlat és technika"
            onClick={() => api.go("train-exercise", { id: e.id })}
          />
          <div className="core-set-labels">
            <span>Szett</span>
            <span>kg</span>
            <span>Ism.</span>
            <span>RIR</span>
            <span>Kész</span>
          </div>
          {e.records.map((r, si) => (
            <div className={`core-set ${r.done ? "done" : ""}`} key={si}>
              <span>{si + 1}</span>
              {["kg", "reps", "rir"].map((field) => (
                <input
                  key={field}
                  aria-label={`${e.name}, ${si + 1}. sorozat, ${field}`}
                  type="number"
                  min="0"
                  max={field === "rir" ? 10 : undefined}
                  value={r[field]}
                  disabled={isDone}
                  onChange={(ev) =>
                    setRecord(ei, si, { [field]: ev.target.value })
                  }
                />
              ))}
              <button
                aria-label={`${e.name}, ${si + 1}. sorozat ${r.done ? "visszavonása" : "kész"}`}
                aria-pressed={r.done}
                disabled={isDone}
                onClick={() => setRecord(ei, si, { done: !r.done })}
              >
                {r.done ? "✓" : "○"}
              </button>
            </div>
          ))}
          {!isDone && (
            <button
              className="text-button"
              onClick={() =>
                api.change((f) => ({
                  ...f,
                  session: {
                    ...f.session,
                    exercises: f.session.exercises.map((x, i) =>
                      i === ei
                        ? {
                            ...x,
                            records: [
                              ...x.records,
                              { kg: 0, reps: 10, rir: 2, done: false },
                            ],
                          }
                        : x,
                    ),
                  },
                }))
              }
            >
              + Sorozat
            </button>
          )}
        </section>
      ))}
      {!isDone && session.restUntil > tick && (
        <div className="core-rest" role="status">
          <Icon name="clock" />
          Pihenő · {Math.ceil((session.restUntil - tick) / 1000)} mp
          <button
            onClick={() =>
              api.change((f) => ({
                ...f,
                session: { ...f.session, restUntil: null },
              }))
            }
          >
            Kihagyás
          </button>
        </div>
      )}
      {!isDone && (
        <Field label="Gyakorlat hozzáadása">
          <select
            value=""
            onChange={(event) => {
              const e = EXERCISES.find((x) => x.id === event.target.value);
              if (e)
                api.change((f) => ({
                  ...f,
                  session: {
                    ...f.session,
                    exercises: [
                      ...f.session.exercises,
                      {
                        id: e.id,
                        name: e.name,
                        records: [{ kg: 0, reps: 10, rir: 2, done: false }],
                      },
                    ],
                  },
                }));
            }}
          >
            <option value="">Válassz gyakorlatot…</option>
            {EXERCISES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Saját megjegyzés">
        <textarea
          disabled={isDone}
          value={session.notes}
          onChange={(e) =>
            api.change((f) => ({
              ...f,
              session: { ...f.session, notes: e.target.value },
            }))
          }
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      {!isDone ? (
        <>
          <Button
            onClick={() => {
              try {
                api.change((f) => finishSession(f));
                api.go("workout-review");
                api.toast("Edzés elmentve");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Edzés lezárása
          </Button>
          <Button secondary onClick={() => api.go("train-gym")}>
            Félreteszem · később folytatom
          </Button>
        </>
      ) : (
        <Button onClick={() => api.go("train-gym")}>Edzésnaplóm</Button>
      )}
    </>
  );
}
export function MesoExtras({ page, api }) {
  const c =
    api.state.training.cycles.find((c) => c.id === api.params.id) ||
    api.state.training.cycles[0];
  const [note, setNote] = useState(""),
    [selected, setSelected] = useState([]);
  if (page === "train-templates")
    return (
      <>
        <FlowHead title="A bevált terveid." eyebrow="MEZOCIKLUS · SABLONOK" />
        <Button onClick={() => api.go("train-build")}>Új terv készítése</Button>
        {[...api.state.templates, ...api.state.training.cycles].map((t, i) => (
          <section className="core-pillar" key={`${t.id}-${i}`}>
            <h2>{t.title}</h2>
            <p>
              {t.weeks} hét · {t.days.length} edzésnap
            </p>
            <Button
              secondary
              onClick={() => {
                api.update("training", (s) => ({
                  ...s,
                  draft: {
                    ...structuredClone(t),
                    status: "draft",
                    currentWeek: 1,
                  },
                }));
                api.go("train-draft");
              }}
            >
              Előnézet és indítás
            </Button>
          </section>
        ))}
      </>
    );
  if (page === "train-compare")
    return (
      <>
        <FlowHead
          title="Két blokk egymás mellett."
          description="Válassz két lezárt mezociklust. Új blokkot a mezociklus részletében zárhatsz le."
        />
        {api.state.training.cycles
          .filter((c) => c.status === "archived")
          .map((c) => (
            <label className="flow-checkline" key={c.id}>
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                disabled={!selected.includes(c.id) && selected.length === 2}
                onChange={() =>
                  setSelected(
                    selected.includes(c.id)
                      ? selected.filter((id) => id !== c.id)
                      : [...selected, c.id],
                  )
                }
              />
              {c.title}
            </label>
          ))}
        <div className="core-compare">
          {selected.map((id) => {
            const x = api.state.training.cycles.find((c) => c.id === id);
            const logs =
              api.state.cycleReports[id]?.workouts ||
              api.state.training.gymHistory.filter((l) => l.cycleId === id);
            return (
              <section key={id}>
                <h2>{x.title}</h2>
                <p>{x.weeks} hét</p>
                <p>{x.days.length} nap / hét</p>
                <p>{logs.length} naplózott edzés</p>
                <p>
                  {logs.reduce((n, l) => n + (l.volume || 0), 0)} kg összvolumen
                </p>
              </section>
            );
          })}
        </div>
      </>
    );
  if (!c) return <p>Még nincs mezociklus.</p>;
  if (page === "train-close")
    return (
      <>
        <FlowHead
          title="Mit viszel tovább?"
          description="Lezáráskor az edzésnapló és a saját értékelés pillanatképe a riportba kerül."
        />
        <Field label="Saját értékelés">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button
          onClick={() => {
            api.change((f) => closeCycle(f, c.id, note));
            api.go("train-report", { id: c.id });
          }}
        >
          Lezárom a blokkot
        </Button>
      </>
    );
  if (page === "train-muscle") {
    const muscle = api.params.muscle;
    const entries = c.days.flatMap((d) =>
      d.exercises
        .filter((e) => EXERCISES.find((x) => x.id === e.id)?.muscle === muscle)
        .map((e) => ({ ...e, day: d.name })),
    );
    return (
      <>
        <FlowHead
          eyebrow={`${c.title} · HETI TERHELÉS`}
          title={muscle || "Izomcsoport"}
        />
        {entries.map((e, i) => (
          <FlowRow
            key={i}
            title={EXERCISES.find((x) => x.id === e.id)?.name}
            subtitle={`${e.day} · ${e.sets} × ${e.reps}`}
            onClick={() => api.go("train-exercise", { id: e.id })}
          />
        ))}
      </>
    );
  }
  const report = api.state.cycleReports[c.id];
  return (
    <>
      <FlowHead
        title={c.title}
        eyebrow="MEZOCIKLUS · RIPORT"
        description={
          report
            ? "Lezáráskori pillanatkép"
            : "Még nincs lezárt riport ehhez a blokkhoz."
        }
      />
      {report && (
        <>
          <div className="core-large">
            {report.workouts.length}
            <small> rögzített edzés</small>
          </div>
          <blockquote>
            {report.note || "Nem adtál saját értékelést."}
          </blockquote>
          {report.workouts.map((w) => (
            <FlowRow
              key={w.id}
              title={w.title}
              subtitle={`${w.sets} sorozat · ${w.volume} kg`}
              onClick={() => api.go("train-gym-detail", { id: w.id })}
            />
          ))}
        </>
      )}
      <Button
        secondary
        onClick={() => {
          api.update("training", (t) => ({
            ...t,
            draft: { ...structuredClone(c), status: "draft", currentWeek: 1 },
          }));
          api.go("train-draft");
        }}
      >
        Újrafuttatás előnézettel
      </Button>
    </>
  );
}
