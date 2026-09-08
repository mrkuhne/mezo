import React, { useState } from "react";
import FuelFlow, { FUEL_ROUTES } from "./flows/FuelFlow.jsx";
import TrainFlow, { TRAIN_ROUTES } from "./flows/TrainFlow.jsx";
import PersonalFlow, { PERSONAL_ROUTES } from "./flows/PersonalFlow.jsx";
import InsightFlow, { INSIGHT_ROUTES } from "./flows/InsightFlow.jsx";
import {
  EXTRA_ROUTES,
  GoalsFlow,
  SessionFlow,
  MesoExtras,
} from "./CoreExtras.jsx";
import {
  updateComplete,
  hydrateComplete,
  startSession,
  removeBodyLog,
} from "./complete-model.mjs";
import { addNotification, addExplorationMeal } from "./exploration-model.mjs";
import { nutrition } from "./model.mjs";
import { FlowHead, FlowRow } from "./flows/FlowUI.jsx";
import { IdentityContext } from "./shared.jsx";
import { BoopIcon } from "./BoopIdentity.jsx";
import { EXERCISES } from "./flows/train-state.mjs";
import "./complete.css";
export const COMPLETE_ROUTES = {
  ...FUEL_ROUTES,
  ...TRAIN_ROUTES,
  ...PERSONAL_ROUTES,
  ...INSIGHT_ROUTES,
  ...EXTRA_ROUTES,
};
export const COMPLETE_TABS = {
  movement: { gym: "train-gym", sport: "train-sport", run: "train-running" },
  fuel: { log: "fuel", recipes: "fuel-recipes", pantry: "fuel-pantry" },
  life: { goals: "goals" },
  understanding: {
    patterns: "patterns",
    memory: "knowledge",
    profile: "character",
    outlook: "predictions",
  },
};
export function featureLocation(page) {
  if (page.startsWith("train") || page.startsWith("workout"))
    return {
      role: "movement",
      tab: page.includes("sport")
        ? "sport"
        : page.includes("run-") || page === "train-running"
          ? "run"
          : "gym",
    };
  if (page.startsWith("fuel"))
    return {
      role: "fuel",
      tab:
        page.includes("pantry") ||
        page.includes("item") ||
        page.includes("stock") ||
        page.includes("shopping")
          ? "pantry"
          : page.includes("recipe") || page.includes("cook")
            ? "recipes"
            : "log",
    };
  if (
    page.startsWith("me-") ||
    page.startsWith("goal") ||
    page === "weight-goal" ||
    page.startsWith("notification")
  )
    return {
      role: "life",
      tab: page.includes("goal")
        ? "goals"
        : page.includes("weight") || page.includes("sleep")
          ? "body"
          : "today",
    };
  return {
    role: "understanding",
    tab:
      page.startsWith("knowledge") ||
      page === "fact" ||
      page === "communication" ||
      page === "memory"
        ? "memory"
        : page.startsWith("predict")
          ? "outlook"
          : page.startsWith("character") ||
              [
                "dimensions",
                "dimension",
                "claim",
                "team",
                "expert",
                "conference",
              ].includes(page)
            ? "profile"
            : "patterns",
  };
}
export function makeCompleteApi(api, params, go) {
  const full = api.s.full;
  let working = full;
  const change = (fn) => {
    working = fn(working);
    const next = working;
    api.setS((v) =>
      updateComplete(
        { ...hydrateComplete(v), full: next },
        "training",
        next.training,
      ),
    );
  };
  return {
    variant: "companion",
    state: full,
    params,
    back: api.back,
    toast: api.toast,
    celebrate: api.celebrate,
    ask: api.ask,
    nutrition: nutrition(full),
    remaining: Math.max(0, full.fuel.targets.kcal - nutrition(full).kcal),
    change,
    go: (page, p = {}) => {
      if (page === "chat") return api.ask();
      if (page === "home") return api.navigate("home", "today");
      if (page === "journal") return api.navigate("life", "journal");
      if (page === "avatar") return api.navigate("home", "today");
      if (page === "me") return api.navigate("life", "today");
      if (page === "mezo") return api.navigate("understanding", "patterns");
      if (page === "workout") {
        change((f) => startSession(f, { ...params, ...p }));
      }
      go(page, p);
    },
    update: (domain, fn) => {
      const next = updateComplete({ ...api.s, full: working }, domain, fn);
      working = next.full;
      api.setS((v) => ({ ...v, full: next.full, training: next.training }));
    },
    notify: (n) => change((f) => addNotification(f, n)),
    addMeal: (m) => change((f) => addExplorationMeal(f, m)),
    water: () => change((f) => ({ ...f, water: f.water + 250 })),
  };
}
function KnowledgeNew({ api }) {
  const [text, setText] = useState("");
  return (
    <>
      <FlowHead title="Amit fontos tudnom." eyebrow="TUDÁSTÁR · SAJÁT TÉNY" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const id = crypto.randomUUID();
          api.update("insight", (s) => ({
            ...s,
            facts: [
              {
                id,
                text: text.trim(),
                category: "Preferenciák",
                status: "confirmed",
                enabled: true,
                source: "Te adtad hozzá · ma",
              },
              ...s.facts,
            ],
          }));
          api.go("fact", { id });
        }}
      >
        <label className="flow-field">
          A saját szavaiddal
          <textarea
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
          />
        </label>
        <button className="primary-button" type="submit">
          Megőrzöm a Tudástárban
        </button>
      </form>
    </>
  );
}
function Shortcuts({ page, api }) {
  const c =
    api.state.training.cycles.find((c) => c.id === api.params.id) ||
    api.state.training.cycles.find((c) => c.status === "active");
  return (
    <div className="core-shortcuts">
      {["me-weight-log", "me-sleep-log"].includes(page) && api.params.id && (
        <FlowRow
          title="Bejegyzés törlése"
          icon="trash"
          onClick={() => {
            const domain = page.includes("weight") ? "weight" : "sleep";
            api.change((f) => removeBodyLog(f, domain, api.params.id));
            api.go(`me-${domain}`);
            api.toast("Bejegyzés törölve");
          }}
        />
      )}
      {page === "me-weight" && (
        <FlowRow
          title="Testsúlycél módosítása"
          icon="target"
          onClick={() => api.go("weight-goal")}
        />
      )}
      {["train", "train-gym", "train-cycles"].includes(page) && (
        <>
          <FlowRow
            title="Mezociklusok"
            icon="layers"
            onClick={() => api.go("train-cycles")}
          />
          <FlowRow
            title="Sablonok"
            icon="book"
            onClick={() => api.go("train-templates")}
          />
          <FlowRow
            title="Gyakorlatok és technika"
            icon="dumbbell"
            onClick={() => api.go("train-exercises")}
          />
          <FlowRow
            title="Medálok"
            icon="medal"
            onClick={() => api.go("train-medals")}
          />
          <FlowRow
            title="Blokkok összevetése"
            icon="chart"
            onClick={() => api.go("train-compare")}
          />
        </>
      )}
      {page === "fuel-meal" && api.params.id && (
        <FlowRow
          title="Étkezés törlése"
          icon="trash"
          onClick={() => {
            api.update("meals", (m) => m.filter((x) => x.id !== api.params.id));
            api.go("fuel");
            api.toast("Étkezés törölve");
          }}
        />
      )}
      {page === "train-cycle" && c && (
        <>
          <FlowRow
            title="Sablonként megőrzöm"
            icon="book"
            onClick={() => {
              api.change((f) => ({
                ...f,
                templates: [
                  ...f.templates,
                  {
                    ...structuredClone(c),
                    id: crypto.randomUUID(),
                    status: "template",
                  },
                ],
              }));
              api.toast("Sablon elmentve");
            }}
          />
          <FlowRow
            title={
              c.status === "archived" ? "Lezárt riport" : "Mezociklus lezárása"
            }
            icon="check-circle"
            onClick={() =>
              api.go(c.status === "archived" ? "train-report" : "train-close", {
                id: c.id,
              })
            }
          />
        </>
      )}
      {page === "train-cycle-week" &&
        c &&
        [
          ...new Set(
            c.days.flatMap((d) =>
              d.exercises.map(
                (e) => EXERCISES.find((x) => x.id === e.id)?.muscle,
              ),
            ),
          ),
        ]
          .filter(Boolean)
          .map((m) => (
            <FlowRow
              key={m}
              title={`${m} · izomrészlet`}
              icon="activity"
              onClick={() => api.go("train-muscle", { id: c.id, muscle: m })}
            />
          ))}
      {page === "knowledge" && (
        <FlowRow
          title="Saját tény hozzáadása"
          icon="plus"
          onClick={() => api.go("knowledge-new")}
        />
      )}
    </div>
  );
}
export default function CompleteFlow({ page, api }) {
  let content;
  if (page === "core-index")
    content = (
      <>
        <FlowHead
          title="Az egész Boop."
          description="A működő nézetek térképe. Az űrlapok változtatásai helyben megmaradnak."
        />
        {Object.entries(COMPLETE_ROUTES)
          .filter(([p]) => p !== "core-index")
          .map(([p, r]) => (
            <FlowRow
              key={p}
              title={r.title}
              subtitle={p}
              onClick={() => api.go(p)}
            />
          ))}
      </>
    );
  else if (page === "workout" || page === "workout-review")
    content = <SessionFlow api={api} review={page === "workout-review"} />;
  else if (page.startsWith("goal") || page === "weight-goal")
    content = <GoalsFlow page={page} api={api} />;
  else if (page === "knowledge-new") content = <KnowledgeNew api={api} />;
  else if (EXTRA_ROUTES[page]) content = <MesoExtras page={page} api={api} />;
  else if (FUEL_ROUTES[page]) content = <FuelFlow page={page} api={api} />;
  else if (TRAIN_ROUTES[page]) content = <TrainFlow page={page} api={api} />;
  else if (PERSONAL_ROUTES[page])
    content = <PersonalFlow page={page} api={api} />;
  else if (INSIGHT_ROUTES[page])
    content = <InsightFlow page={page} api={api} />;
  else content = <p>Ez a nézet nem található.</p>;
  return (
    <IdentityContext.Provider value={{ Icon: BoopIcon, name: "Boop" }}>
      <div className="boop-complete" key={page + JSON.stringify(api.params)}>
        {content}
        <Shortcuts page={page} api={api} />
      </div>
    </IdentityContext.Provider>
  );
}
