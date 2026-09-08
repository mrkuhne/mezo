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
  const state = hydrateComplete(createPresence()).full;
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
        const html = renderToString(React.createElement(Flow, { page, api }));
        if (html.length < 20) throw Error("Empty");
      } catch (e) {
        fail++;
        console.log(page, e.message);
      }
    }
  console.log(
    `${Object.keys(COMPLETE_ROUTES).length} routes, ${checked} seeded/missing-ID renders, ${fail} failures`,
  );
  process.exitCode = fail ? 1 : 0;
} finally {
  await server.close();
}
