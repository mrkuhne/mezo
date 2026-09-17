// Hibrid tanulmány — Titanium struktúra + Mozaik fény + Boop karakter.
// Öt terület, területenként négy kontextuális cél (a Titanium handoff §6 szerint).

export const DOMAINS = {
  nap: {
    name: "Nap",
    eyebrow: "A NAPOD, EGY HELYEN",
    tone: "coral",
    clay: { light: "#f6cdb8", body: "#c38370", shadow: "#a66050" },
    dests: [
      ["mai", "Mai", "i-nap"],
      ["beszelgetes", "Beszélgetés", "i-mezo"],
      ["rutin", "Rutin", "i-rend"],
      ["napzaras", "Napzárás", "i-hold"],
    ],
  },
  edzes: {
    name: "Edzés",
    eyebrow: "ERŐ ÉS TERHELÉS",
    tone: "sky",
    clay: { light: "#c6d9e6", body: "#627f9e", shadow: "#3a5271" },
    dests: [
      ["mai", "Mai", "i-edzes"],
      ["terheles", "Terhelés", "i-heti"],
      ["naplo", "Napló", "i-naplo"],
      ["tervek", "Tervek", "i-meso"],
    ],
  },
  fuel: {
    name: "Fuel",
    eyebrow: "AMIBŐL A NAPOD ÉPÜL",
    tone: "gold",
    clay: { light: "#f0d7a6", body: "#b0813b", shadow: "#866128" },
    dests: [
      ["mai", "Mai", "i-fuel"],
      ["receptek", "Receptek", "i-recept"],
      ["kamra", "Kamra", "i-kamra"],
      ["kiegeszitok", "Kiegészítők", "i-stack"],
    ],
  },
  mezo: {
    name: "Mezo",
    eyebrow: "AMIT EGYÜTT ÉRTÜNK MEG",
    tone: "lav",
    clay: { light: "#e0d2e8", body: "#8c779f", shadow: "#655270" },
    dests: [
      ["felfedezesek", "Felfedezések", "i-minta"],
      ["elorejelzesek", "Előrejelzések", "i-kristaly"],
      ["karakter", "Karakter", "i-mezo"],
      ["tudastar", "Tudástár", "i-tudas"],
    ],
  },
  en: {
    name: "Én",
    eyebrow: "AHOGYAN BELÜL ÉS KÍVÜL VAGY",
    tone: "rose",
    clay: { light: "#efd1d0", body: "#a36a72", shadow: "#774751" },
    dests: [
      ["attekintes", "Áttekintés", "i-eletjel"],
      ["suly", "Súly", "i-suly"],
      ["alvas", "Alvás", "i-alvas"],
      ["naplo", "Napló", "i-memoar"],
    ],
  },
};

export const DOMAIN_ORDER = ["nap", "edzes", "fuel", "mezo", "en"];

// Explicit fiktív mintanap — 2026. szeptember 8., kedd, délután.
export const DEMO = {
  dateLabel: "Kedd · szeptember 8.",
  daypart: "delutan",
  name: "Daniel",
  water: { logged: 1.25, goal: 2.5, step: 0.25 },
  sleep: { text: "7ó 45p", note: "nyugodt éjszaka" },
  fuel: {
    goal: 2250,
    eaten: 1430,
    burned: 430,
    macros: [
      ["Fehérje", 86, 140, "sage"],
      ["Szénh.", 128, 240, "gold"],
      ["Zsír", 36, 75, "coral"],
      ["Rost", 18, 30, "lav"],
    ],
    meals: [
      ["i-reggeli", "Zabkása áfonyával", "Reggeli · 8:10", 420],
      ["i-ebed", "Csirkés rizsbowl", "Ebéd · 12:45", 680],
      ["i-snack", "Joghurt és banán", "Snack · 15:30", 330],
    ],
  },
  train: {
    done: true,
    title: "Pull Day",
    detail: "kész · 52 perc",
    exercises: [
      ["Húzódzkodás", "4 × 8"],
      ["Egykaros evezés", "4 × 10"],
      ["Rúdlehúzás", "3 × 12"],
    ],
  },
  routine: { done: 3, total: 5, note: "az esti lánc hátravan" },
  journal: { count: 1, note: "reggeli hála" },
};

export function greeting(daypart, name) {
  const g = {
    reggel: [
      `Jó reggelt, ${name}!`,
      "Nyugodt éjszakán vagy túl — kezdjük vízzel és a reggeli lánccal.",
    ],
    delutan: [
      `Szép délutánt, ${name}!`,
      "Az edzés megvan, a vized fele még hátravan.",
    ],
    este: [
      `Csendes estét, ${name}!`,
      "Két rutinlépés maradt, aztán jöhet a napzárás.",
    ],
  };
  return g[daypart] || g.delutan;
}

export function addWater(state) {
  return {
    ...state,
    logged: Math.min(state.goal, Math.round((state.logged + state.step) * 100) / 100),
  };
}
