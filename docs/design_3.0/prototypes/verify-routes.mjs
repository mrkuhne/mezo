import { createServer } from "vite";
import { renderToString } from "react-dom/server";
import React from "react";
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { default: Flow, COMPLETE_ROUTES } = await server.ssrLoadModule(
    "/src/CompleteFlow.jsx",
  );
  const { hydrateComplete } = await server.ssrLoadModule(
    "/src/complete-model.mjs",
  );
  const { createPresence } = await server.ssrLoadModule(
    "/src/presence-model.mjs",
  );
  const { nutrition } = await server.ssrLoadModule("/src/model.mjs");
  const rootState = hydrateComplete(createPresence());
  const state = rootState.full;
  const noop = () => {};
  const api = {
    state,
    params: {},
    variant: "companion",
    nutrition: nutrition(state),
    remaining: 1000,
    go: noop,
    back: noop,
    toast: noop,
    ask: noop,
    change: noop,
    update: noop,
    notify: noop,
    water: noop,
    addMeal: noop,
  };
  const ids = new Set();
  function collect(v) {
    if (!v || typeof v !== "object") return;
    if (v.id) ids.add(v.id);
    Object.values(v).forEach(collect);
  }
  collect(state);
  let fail = 0,
    checked = 0;
  for (const page of Object.keys(COMPLETE_ROUTES))
    for (const id of [undefined, "missing", ...ids]) {
      api.params = {
        id,
        day: state.training.cycles[0].days[0].id,
        week: 1,
        muscle: "Mell",
      };
      checked++;
      try {
        const html = renderToString(
          React.createElement(Flow, {
            page,
            api,
            visual: process.env.BOOP_VISUAL,
          }),
        );
        if (html.length < 20) throw Error("Empty");
      } catch (e) {
        fail++;
        console.log(page, e.message);
      }
    }
  console.log(
    `${Object.keys(COMPLETE_ROUTES).length} routes, ${checked} seeded/missing-ID renders, ${fail} failures`,
  );
  if (process.env.BOOP_VISUAL === "rpg") {
    const { default: RpgScreen } =
      await server.ssrLoadModule("/src/RpgStudy.jsx");
    const { foodBudget } = await server.ssrLoadModule(
      "/src/presence-model.mjs",
    );
    for (const role of ["home", "movement", "fuel", "life"]) {
      const s = { ...rootState, role };
      const shellApi = {
        ...api,
        s,
        budget: foodBudget(s),
        core: api,
        setS: noop,
        navigate: noop,
        goFeature: noop,
        celebrate: noop,
      };
      const html = renderToString(
        React.createElement(RpgScreen, {
          api: shellApi,
          feature: null,
          coreApi: api,
          fallback: null,
        }),
      );
      if (!html.includes("rpg-content"))
        throw Error(`Missing RPG dashboard: ${role}`);
    }
    console.log("4 RPG dashboards render successfully");
  }
  process.exitCode = fail ? 1 : 0;
} finally {
  await server.close();
}
