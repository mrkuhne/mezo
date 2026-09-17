export const FOODS = [
  {
    id: "salmon",
    name: "Lazac, rizs és zöldek",
    kcal: 540,
    protein: 36,
    carbs: 48,
    fat: 22,
    kind: "salmon",
    time: "19:00",
  },
  {
    id: "bowl",
    name: "Csirkés Buddha-tál",
    kcal: 620,
    protein: 52,
    carbs: 64,
    fat: 17,
    kind: "bowl",
    time: "12:30",
  },
  {
    id: "oats",
    name: "Áfonyás zabkása",
    kcal: 460,
    protein: 28,
    carbs: 58,
    fat: 13,
    kind: "oats",
    time: "08:00",
  },
  {
    id: "yogurt",
    name: "Görög joghurt",
    kcal: 180,
    protein: 12,
    carbs: 20,
    fat: 6,
    kind: "oats",
    time: "15:00",
  },
  {
    id: "banana",
    name: "Banán és mandula",
    kcal: 220,
    protein: 5,
    carbs: 30,
    fat: 10,
    kind: "bowl",
    time: "16:00",
  },
];
export const EXERCISES = [
  {
    name: "Széles lehúzás",
    muscle: "Hát · bemelegítés után",
    weight: 50,
    reps: 12,
    last: "50 kg × 10",
    sets: 3,
  },
  {
    name: "Evezés csigán",
    muscle: "Hát · kontrollált visszaengedés",
    weight: 45,
    reps: 12,
    last: "45 kg × 11",
    sets: 3,
  },
  {
    name: "Face pull",
    muscle: "Hátsó váll · vállmagasságig",
    weight: 20,
    reps: 15,
    last: "20 kg × 14",
    sets: 3,
  },
  {
    name: "Bicepsz kézisúlyzóval",
    muscle: "Kar · váltott fogás",
    weight: 12,
    reps: 12,
    last: "12 kg × 12",
    sets: 3,
  },
];
export function createState() {
  return {
    water: 1750,
    meals: [
      { ...FOODS[2], id: "breakfast" },
      { ...FOODS[1], id: "lunch" },
      { ...FOODS[3], id: "snack" },
    ],
    completedSets: [],
    workoutFinished: false,
    routineDone: false,
    patternConfirmed: false,
    daypart: "day",
    journal: "",
    messages: [
      {
        id: "welcome",
        role: "assistant",
        text: "Szia Daniel! Ma jól kipihented magad, és 17:30-kor Pull Day vár. Az ebéd már megvan — most van egy kis tér magadra. Miben segítsek?",
      },
    ],
  };
}
export function nutrition(state) {
  return state.meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
export function reduce(state, action) {
  switch (action.type) {
    case "setValue":
      return {
        ...state,
        setValues: {
          ...state.setValues,
          [action.key]: {
            ...state.setValues?.[action.key],
            [action.field]: action.value,
          },
        },
      };
    case "food":
      return {
        ...state,
        meals: [
          ...state.meals,
          {
            ...action.food,
            id: `meal-${state.meals.length}-${action.food.id}`,
          },
        ],
      };
    case "water":
      return { ...state, water: state.water + 250 };
    case "set":
      return {
        ...state,
        completedSets: state.completedSets.includes(action.key)
          ? state.completedSets.filter((k) => k !== action.key)
          : [...state.completedSets, action.key],
      };
    case "finish":
      return { ...state, workoutFinished: true };
    case "routine":
      return { ...state, routineDone: true };
    case "confirm":
      return { ...state, patternConfirmed: true };
    case "daypart":
      return { ...state, daypart: action.value };
    case "journal":
      return { ...state, journal: action.text };
    case "message":
      return action.text.trim()
        ? {
            ...state,
            messages: [
              ...state.messages,
              {
                id: `message-${state.messages.length}`,
                role: action.role,
                text: action.text.trim(),
              },
            ],
          }
        : state;
    default:
      return state;
  }
}
export function replyTo(text, state) {
  const t = text.toLocaleLowerCase("hu");
  const remaining = Math.max(0, 2400 - nutrition(state).kcal);
  if (/egyek|enni|étel|étkez|kaja|vacs|ebéd|fehér/.test(t))
    return `A mai napló alapján még ${Math.max(0, 2400 - nutrition(state).kcal)} kcal van a keretedben. ${remaining >= 540 ? "A mintamenüből a lazacos rizstál 36 g fehérjével egy lehetséges következő étkezés." : remaining >= 180 ? "Ha egy kisebb falatot keresel, a mintamenüben a görög joghurt 180 kcal és 12 g fehérje." : "A tervezett napi keretet már elérted vagy megközelítetted. A következő étkezésnél a közérzetedet és az éhségedet is érdemes figyelembe venni."} Megnézhetjük az összetevőit, vagy választhatunk valami gyorsabbat.\n\nA mai étkezéseid és az edzésterved alapján állítottam össze ezt a próba-választ.`;
  if (/edz|pull|terem|soroz/.test(t))
    return state.workoutFinished
      ? "A Pull Day-t már lezártad. Szép munka! A mai edzés bekerült a heti összképbe. A következő lépés lehet egy nyugodt vacsora és egy rövid séta."
      : "Ma Pull Day következik: négy gyakorlat, tizenkét sorozat. A lehúzásnál legutóbb 50 kg × 10 ment; most ugyanazzal a súllyal próbáljuk meg a 12 ismétlést, ha a mozdulat végig kontrollált.\n\nIndulás előtt hagyjunk pár percet a bemelegítésre.";
  if (/alv|sét|fár|pihen/.test(t))
    return "Az elmúlt 12 megfigyelt napban az esti sétával járó estéken átlagosan 34 perccel többet aludtál. Ez egy együttjárás, még nem bizonyítja, hogy a séta okozta. Ha ma belefér, kipróbálhatunk egy könnyű, tízperces sétát.\n\nHogy érzed magad most?";
  if (/heti|hetem|heted|hét|halad/.test(t))
    return `Az elmúlt hét napban ${state.workoutFinished ? 4 : 3} edzés és 18,4 km mozgás került a naplódba. Az alvásod átlaga 7 óra 28 perc. A legszebb változás a kiszámíthatóbb esti ritmus. A heti visszatekintésben együtt is megnézhetjük.`;
  return "Értem. Egy pillanatra álljunk meg ennél. Mi az, ami most a legtöbb figyelmet kér tőled?\n\nEz a prototípus előre megírt válaszokat használ. Az étkezésről, edzésről, alvásról és a hetedről tudsz konkrét próba-beszélgetést indítani.";
}
