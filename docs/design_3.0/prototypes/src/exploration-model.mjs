import { createState, nutrition, EXERCISES } from "./model.mjs";
import { createFuelState } from "./flows/fuel-state.mjs";
import { createTrainState } from "./flows/train-state.mjs";
import { createPersonalState } from "./flows/personal-state.mjs";
import { createInsightState } from "./flows/insight-state.mjs";
export function createExplorationState() {
  return {
    ...createState(),
    fuel: createFuelState(),
    training: createTrainState(),
    personal: createPersonalState(),
    insight: createInsightState(),
    companion: {
      checkin: null,
      adjusted: false,
      avatarTone: "coral",
      intent: "arrive",
      reactions: [],
    },
  };
}
export function updateSlice(state, domain, updater) {
  return {
    ...state,
    [domain]: typeof updater === "function" ? updater(state[domain]) : updater,
  };
}
export function routeUrl(page, params = {}) {
  const search = new URLSearchParams(params).toString();
  return "#" + page + (search ? "?" + search : "");
}
export function parseRoute(hash) {
  const [page, query = ""] = hash.replace(/^#/, "").split("?");
  return {
    page: page || "home",
    params: Object.fromEntries(new URLSearchParams(query)),
  };
}
export function recordCheckIn(state, checkin) {
  return {
    ...state,
    companion: { ...state.companion, checkin, adjusted: false },
  };
}
export function companionSuggestion(state) {
  if (state.workoutFinished)
    return {
      page: "fuel",
      icon: "utensils",
      title: "Az edzésed megvan. Jöhet a feltöltődés.",
      body: "A mozgás után most az étkezés és a levezetés kerülhet előtérbe.",
      action: "Megnézem az étkezéseimet",
    };
  if (state.companion.checkin === "tired")
    return {
      page: "train-recovery",
      icon: "moon",
      title: state.companion.adjusted
        ? "Ma könnyebben folytatjuk."
        : "Vegyünk vissza egy kicsit?",
      body: state.companion.adjusted
        ? "Megőriztem a szándékodat. A mai következő lépés a regeneráció áttekintése."
        : "A naplód mellé most odakerült az is, ahogy érzed magad. Nézzük meg együtt, mi fér bele.",
      action: state.companion.adjusted
        ? "Terhelés és pihenés"
        : "Átnézem a terhelésemet",
    };
  if (state.companion.checkin === "busy")
    return {
      page: "fuel-log",
      icon: "scan",
      title: "Legyen most egyetlen könnyű lépés.",
      body: "Egy rövid ételleírással is naplózhatsz. A részleteket utána együtt átnézzük.",
      action: "Elmondom, mit ettem",
    };
  return {
    page: "workout",
    icon: "dumbbell",
    title: "Jó alapokról indulhat a Pull Day.",
    body: "A következő lépés az előkészített edzés. Közben a sorozatokra figyelhetsz; a nap többi része megvár.",
    action: "Kezdjük az edzést",
  };
}
export function addNotification(state, n) {
  const pref = state.personal.preferences;
  if (!pref.enabled || pref.categories[n.kind || "insight"] === false)
    return state;
  return {
    ...state,
    personal: {
      ...state.personal,
      notifications: [
        {
          ...n,
          id: n.id || crypto.randomUUID(),
          time: "Most",
          day: "Ma",
          kind: n.kind || "insight",
          read: false,
        },
        ...state.personal.notifications,
      ],
    },
  };
}
export function addExplorationMeal(state, food) {
  if (state.meals.some((m) => m.id === food.id)) return state;
  return { ...state, meals: [...state.meals, food] };
}
export function contextualReply(text, state) {
  const t = text.toLocaleLowerCase("hu");
  const enabled = state.insight.facts.filter(
    (f) => f.enabled && f.status === "confirmed",
  );
  const style = state.insight.communication;
  const short = style.detail === "Rövid";
  const mood = state.companion.checkin === "tired";
  const actions = [];
  let content = "";
  if (/karakter|állítás|dimenzió/.test(t)) {
    content =
      "A rólad alakuló képet a naplóid és a saját visszajelzéseid alapján bontjuk dimenziókra. Az állításokat pontosíthatod vagy visszautasíthatod; a saját nézőpontod nem vész el a számok között.";
    actions.push(
      { label: "Megnézem a Karaktert", page: "character" },
      { label: "A közös tudásunk", page: "knowledge" },
    );
  } else if (/minta|sét|alvás|alvásom/.test(t)) {
    const p = state.insight.patterns[0];
    content = `A séta és az alvás kapcsolatát ${p.days} mintanapon figyeljük. ${p.status === "confirmed" ? (enabled.some((f) => f.patternId === p.id) ? "Megerősítetted, így a Tudástárban is használható." : "Megerősítetted a mintát, de a kapcsolódó tudást kikapcsoltad. Nem használom személyes útmutatáshoz.") : p.status === "rejected" ? "Jelezted, hogy nem jellemző rád, ezért nem használom biztos tudásként." : "Egyelőre együttjárás, nem bizonyított ok. A saját tapasztalatod is kell hozzá."}`;
    actions.push(
      {
        label: "A minta és a bizonyíték",
        page: "pattern",
        params: { id: p.id },
      },
      { label: "Alvás naplózása", page: "me-sleep-log" },
    );
  } else if (/fár|terhel|pihen/.test(t)) {
    content = mood
      ? "Jelezted, hogy fáradtabb vagy. A korábbi jó alvásadat ezt nem írja felül. Nézzük meg a heti terhelést, mielőtt választasz a mai lehetőségek közül."
      : "A pihenést az edzés, a futás és a közérzet mellett érdemes nézni. Megnyithatjuk a terhelésedet, vagy rögzítheted, hogyan aludtál.";
    actions.push(
      { label: "Terhelés és regeneráció", page: "train-recovery" },
      { label: "Alvásnapló", page: "me-sleep" },
    );
  } else if (/egyek|enni|étel|étkez|kaja|recept|kamra|fehér|ebéd/.test(t)) {
    content = `A naplódban ${nutrition(state).kcal} kcal és ${nutrition(state).protein} g fehérje szerepel. ${mood ? "Ma a könnyen elkészíthető étel lehet kényelmesebb." : "Nézzünk olyan receptet, amihez már van otthon alapanyag."}`;
    actions.push(
      { label: "AI ételnapló", page: "fuel-log" },
      { label: "Receptek a kamrából", page: "fuel-recipes" },
      { label: "Ételeim értékelése", page: "fuel-evaluation" },
    );
  } else if (/heti|hét|hetem|halad/.test(t)) {
    content = `Az elmúlt hét napban ${state.workoutFinished ? 4 : 3} erősítő edzés szerepel a bemutatóban. A heti nézetből a napokra, a futásokra és az étkezésekre is tovább tudunk menni.`;
    actions.push(
      { label: "Heti történet", page: "week" },
      { label: "A következő edzésterv", page: "train-cycles" },
    );
  } else if (/ember|kapcsol|barát|találkoz/.test(t)) {
    content =
      "A közös időnek is lehet helye a napodban. Egy tervezett találkozás külön marad a már megtörtént kapcsolódástól.";
    actions.push({ label: "Az embereim", page: "me-people" });
  } else if (/mezocik|edzés|futás|sport/.test(t)) {
    content = `${state.workoutFinished ? "A mai Pull Day-t már lezártad." : "A mai Pull Day mellett a teljes heti terhelés is számít."} Az erősítést, a futást és a sportot közös tervben nézhetjük.`;
    actions.push(
      { label: "Edzés és heti terv", page: "train" },
      { label: "Mezociklus építése", page: "train-build" },
      { label: "Futás", page: "train-running" },
    );
  } else {
    content =
      "Itt vagyok. Választhatunk egy konkrét feladatot, vagy hagyhatunk helyet annak, ami most foglalkoztat. A prototípusban előre megírt válaszokkal és működő mintafolyamatokkal tudsz beszélgetni.";
    actions.push(
      { label: "Egy gondolat a naplóba", page: "journal" },
      { label: "A mai lehetőségeim", page: "home" },
    );
  }
  if (!short)
    content +=
      "\n\nA következő lépést te választod. A lenti lehetőségekkel közvetlenül a megfelelő részlethez juthatsz.";
  return {
    text: content,
    actions,
    source: enabled.length
      ? `${enabled.length} használható tény · a mai mintanapló`
      : "A mai mintanapló",
    tone: style.tone,
  };
}

export function workoutRecord(state) {
  const exercises = EXERCISES.map((ex, i) => ({
    name: ex.name,
    sets: state.completedSets
      .filter((key) => key.startsWith(i + "-"))
      .map((key) => ({
        weight: state.setValues?.[key]?.weight ?? ex.weight,
        reps: state.setValues?.[key]?.reps ?? ex.reps,
      })),
  })).filter((e) => e.sets.length);
  return {
    id: "gym-today",
    name: "Pull Day",
    date: "2026-09-08",
    duration: 45,
    sets: state.completedSets.length,
    volume: String(
      exercises
        .flatMap((e) => e.sets)
        .reduce((sum, s) => sum + s.weight * s.reps, 0),
    ),
    exercises,
  };
}
