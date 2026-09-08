export const DIMENSIONS = [
  {
    id: "body",
    name: "Edzés és test",
    expert: "Edző",
    icon: "dumbbell",
    maturity: 72,
    portrait:
      "A követhető terv biztonságot ad. Az erőd akkor fejlődik egyenletesen, amikor a terhelés mellett a pihenést is megtervezed.",
  },
  {
    id: "sleep",
    name: "Alvás és ritmus",
    expert: "Szomnológus",
    icon: "moon",
    maturity: 64,
    portrait:
      "Az esték minősége sokszor másnap válik láthatóvá. A nyugodt átmenetekhez könnyebben kapcsolódsz, mint a szigorú lefekvési szabályokhoz.",
  },
  {
    id: "fuel",
    name: "Táplálkozás",
    expert: "Táplálkozó",
    icon: "utensils",
    maturity: 58,
    portrait:
      "A kiszámítható alapételek leveszik rólad a döntés terhét. Szívesen kísérletezel, ha az alapanyag már kéznél van.",
  },
  {
    id: "mind",
    name: "Belső világ",
    expert: "Pszichológus",
    icon: "brain",
    maturity: 43,
    portrait:
      "A saját tempód megtartása fontos. A rövid visszatekintések gyakran tisztábban mutatják, mire van szükséged.",
  },
  {
    id: "habits",
    name: "Szokások és döntések",
    expert: "Drill",
    icon: "target",
    maturity: 68,
    portrait:
      "A kis, könnyen elkezdhető lépésekből építesz tartós ritmust. Egy kihagyás után az újrakezdés módja fontosabb, mint a sorozat hossza.",
  },
  {
    id: "people",
    name: "Kapcsolatok",
    expert: "Antropológus",
    icon: "users",
    maturity: 39,
    portrait:
      "A közös programok több területen is feltöltenek. Ezt egyelőre kevés naplóbejegyzés alapján figyeljük.",
  },
  {
    id: "health",
    name: "Egészség és közérzet",
    expert: "Doki",
    icon: "heart",
    maturity: 46,
    portrait:
      "A közérzetedet a saját visszajelzéseidből próbálom megérteni. Ez a kép tájékozódást segít, nem diagnózis.",
  },
  {
    id: "self-audit",
    name: "A társ önvizsgálata",
    expert: "Szkeptikus",
    icon: "search",
    maturity: 51,
    meta: true,
    portrait:
      "A saját tévedéseimet is számon tartom. A visszautasított állítás és a be nem vált előrejelzés ugyanúgy tanulság.",
  },
  {
    id: "chapter",
    name: "Visszatérés a futáshoz",
    expert: "Mezo",
    icon: "run",
    maturity: 28,
    chapter: true,
    portrait:
      "Egy új fejezet alakul: a futás most ismét helyet keres az erősítés és a közös sport mellett.",
  },
];
export function createInsightState() {
  return {
    patterns: [
      {
        id: "walk-sleep",
        title: "Esti séta és hosszabb alvás",
        question: "Másképp alszol a sétálós estéken?",
        finding:
          "A sétálós estéket átlagosan 34 perccel hosszabb alvás követte.",
        status: "decide",
        domain: "Alvás",
        icon: "moon",
        days: 12,
        strength: "Ígéretes jel",
        values: [7.1, 7.5, 7.3, 7.8, 7.2, 7.7, 7.1, 7.6, 7.4, 7.8, 7.0, 7.7],
        source: "Alvásnapló + esti aktivitás",
        history: [
          "Szeptember 2. · Először volt elég páros nap.",
          "Szeptember 6. · A következő napokban is hasonló irány látszott.",
        ],
      },
      {
        id: "protein-training",
        title: "Fehérje és edzés utáni közérzet",
        question: "Mit érzel a fehérjedúsabb napok után?",
        finding:
          "Az edzést követő reggeleken jobb közérzetet jelöltél, amikor előző nap elérted a fehérjecélod.",
        status: "monitoring",
        domain: "Étkezés",
        icon: "utensils",
        days: 9,
        strength: "Még figyeljük",
        source: "Ételnapló + reggeli check-in",
        values: [5, 7, 6, 8, 6, 7, 8, 6, 7],
        history: ["Szeptember 4. · Megfigyelés alá helyezted."],
      },
      {
        id: "morning-plan",
        title: "Előre megtervezett edzések",
        question: "Könnyebb elkezdeni, ha előre eldöntötted?",
        finding: "Az előző este kiválasztott edzéseket gyakrabban fejezted be.",
        status: "confirmed",
        domain: "Edzés",
        icon: "dumbbell",
        days: 21,
        strength: "Többször visszatérő jel",
        source: "Edzésterv + edzésnapló",
        values: [3, 4, 3, 5, 4, 5, 6],
        history: [
          "Augusztus 30. · Megerősítetted.",
          "Szeptember 3. · Bekerült a Tudástárba.",
        ],
      },
      {
        id: "caffeine",
        title: "Délutáni kávé és elalvás",
        question: "Számít neked a kávé időpontja?",
        finding:
          "Még túl kevés összehasonlítható nap van. Most nem vonunk le következtetést.",
        status: "gathering",
        domain: "Alvás",
        icon: "coffee",
        days: 4,
        strength: "Adatot gyűjtünk",
        source: "Napló + alvás",
        values: [],
        history: ["Szeptember 5. · Elkezdtem figyelni."],
      },
      {
        id: "weekend",
        title: "Hétvégi edzés és energiaszint",
        question: "Tényleg más a hétvége?",
        finding: "Ebben a mintában nem látszott tartós kapcsolat.",
        status: "noRelationship",
        domain: "Edzés",
        icon: "activity",
        days: 18,
        strength: "Nem igazolódott",
        source: "Edzés + közérzet",
        values: [],
        history: ["Szeptember 7. · A kapcsolat nem állt fenn."],
      },
      {
        id: "late-meal",
        title: "Késői vacsora és ébredés",
        question: "Gyakrabban ébredsz késői vacsora után?",
        finding:
          "Jelezted, hogy a megfigyelés nem jellemző rád. Nem használom állandó tudásként.",
        status: "rejected",
        domain: "Étkezés",
        icon: "utensils",
        days: 10,
        strength: "Te vetetted el",
        source: "Ételnapló + visszajelzés",
        values: [],
        history: ["Szeptember 6. · Elvetetted."],
      },
    ],
    facts: [
      {
        id: "f1",
        text: "Rövid, konkrét lépések segítenek elindulni.",
        category: "Preferenciák",
        enabled: true,
        status: "confirmed",
        source: "Te mondtad · szeptember 4.",
        route: "journal",
      },
      {
        id: "f2",
        text: "Az előre kiválasztott edzést könnyebb elkezdened.",
        category: "Szokások",
        enabled: true,
        status: "confirmed",
        source: "Megerősített minta",
        patternId: "morning-plan",
      },
      {
        id: "f3",
        text: "Keddenként röplabdázol a barátaiddal.",
        category: "Kapcsolatok",
        enabled: false,
        status: "candidate",
        source: "Egy korábbi beszélgetésből",
        route: "me-people",
      },
      {
        id: "f4",
        text: "A túl késői értesítések kizökkentenek.",
        category: "Preferenciák",
        enabled: true,
        status: "confirmed",
        source: "Saját beállításod",
        route: "notification-settings",
      },
    ],
    predictions: [
      {
        id: "pred1",
        title: "Könnyebben indulhat a mai edzés",
        text: "A nyugodtabb éjszaka és a tervezett edzés együtt jó alapot adhat a mai Pull Day-hez.",
        range: "A mai délután",
        confidence: "Mérsékelt bizonyosság",
        status: "pending",
        patternId: "morning-plan",
        route: "train",
        actual: "",
      },
      {
        id: "pred2",
        title: "A séta után nyugodtabb lehet az estéd",
        text: "Az esti séta néhány korábbi napodon nyugodtabb lezárással járt együtt.",
        range: "Ma este",
        confidence: "Még tanulom",
        status: "pending",
        patternId: "walk-sleep",
        route: "me-routines",
        actual: "",
      },
      {
        id: "pred3",
        title: "Tartható volt az új edzésritmus",
        text: "Három tervezett alkalomból három teljesült.",
        range: "Az előző hét",
        confidence: "Lezárt megfigyelés",
        status: "validated",
        patternId: "morning-plan",
        route: "week",
        actual: "Mindhárom tervezett alkalmat elvégezted.",
      },
      {
        id: "pred4",
        title: "Korábbra kerülhet a lefekvés",
        text: "A hét végére korábbi lefekvést vártunk.",
        range: "Az előző hét",
        confidence: "Lezárt megfigyelés",
        status: "missed",
        patternId: "walk-sleep",
        route: "me-sleep",
        actual: "A pénteki és szombati lefekvés később volt.",
      },
    ],
    claims: [
      {
        id: "c1",
        dimension: "body",
        text: "Az előre tervezett, délutáni edzésekhez könnyebben kapcsolódsz.",
        confidence: "Valószínű",
        source: "6 edzés + 3 saját visszajelzés",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c2",
        dimension: "sleep",
        text: "Az esti lelassulást a rövid séta segítheti.",
        confidence: "Figyeljük",
        source: "12 nap alvás- és aktivitásnapló",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c3",
        dimension: "fuel",
        text: "Az ismert alapételek megkönnyítik a hétköznapi étkezést.",
        confidence: "Valószínű",
        source: "Ételnapló + receptválasztások",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c4",
        dimension: "mind",
        text: "A kevés, világos lehetőséget könnyebb kezelni, mint a hosszú listákat.",
        confidence: "Figyeljük",
        source: "Saját visszajelzésed",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c5",
        dimension: "habits",
        text: "Kihagyás után a kisebb visszatérő lépés segít.",
        confidence: "Valószínű",
        source: "Rutinok és napló",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c6",
        dimension: "people",
        text: "A közös sport találkozásként is fontos neked.",
        confidence: "Figyeljük",
        source: "Kapcsolati napló + sport",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c7",
        dimension: "health",
        text: "A közérzetedet a nap különböző pontjain eltérően értékeled.",
        confidence: "Figyeljük",
        source: "Check-inek",
        status: "active",
        feedback: null,
        correction: "",
      },
      {
        id: "c8",
        dimension: "self-audit",
        text: "A lefekvés idejét túl magabiztosan jeleztem előre.",
        confidence: "Megfigyelt hiba",
        source: "Egy be nem vált előrejelzés",
        status: "active",
        feedback: null,
        correction: "",
      },
    ],
    experiments: [
      {
        id: "exp1",
        title: "Tíz perc séta az este végén",
        description:
          "Hét este közül négyen tegyél egy rövid sétát. Reggel jelöld az alvásod és a közérzeted. A végén együtt nézzük meg, mi történt.",
        status: "proposed",
        days: 7,
        completed: [],
        patternId: "walk-sleep",
      },
      {
        id: "exp2",
        title: "Előkészített reggeli",
        description:
          "Három munkanapon készítsd elő este a reggelit. Figyeld meg, változik-e a reggeled terheltsége.",
        status: "active",
        days: 3,
        completed: [1],
        patternId: "protein-training",
      },
    ],
    feed: [
      {
        id: "obs1",
        expert: "Edző",
        text: "A tervezett edzések mellett következetesebb lett a heti ritmus.",
        dimension: "body",
        time: "Ma · 06:12",
      },
      {
        id: "obs2",
        expert: "Szkeptikus",
        text: "Az esti séta hatásához még több összehasonlítható nap kell.",
        dimension: "sleep",
        time: "Tegnap · 21:30",
      },
    ],
    communication: { tone: "Közvetlen", detail: "Rövid", checkIn: true },
    memoirLikes: {},
    feedback: {},
  };
}
export function decidePattern(state, id, status) {
  const p = state.patterns.find((p) => p.id === id);
  if (
    !p ||
    !["confirmed", "monitoring", "rejected"].includes(status) ||
    p.status === "gathering" ||
    p.status === "noRelationship"
  )
    return state;
  let facts = state.facts.map((f) =>
    f.patternId === id
      ? { ...f, enabled: status === "confirmed", status: "confirmed" }
      : f,
  );
  if (status === "confirmed" && !facts.some((f) => f.patternId === id))
    facts = [
      ...facts,
      {
        id: "fact-" + id,
        text: p.finding,
        category: "Minták",
        enabled: true,
        status: "confirmed",
        source: "Általad megerősített minta",
        patternId: id,
      },
    ];
  return {
    ...state,
    facts,
    patterns: state.patterns.map((x) =>
      x.id === id
        ? {
            ...x,
            status,
            history: [
              ...x.history,
              ...(x.status === status
                ? []
                : [
                    `Most · ${status === "confirmed" ? "Megerősítetted; a Tudástár használhatja." : status === "monitoring" ? "Tovább figyeljük." : "Elvetetted; nem használom tudásként."}`,
                  ]),
            ],
          }
        : x,
    ),
  };
}
export function saveFact(state, id, text, enabled) {
  if (!text.trim()) throw new Error("Írj legalább egy rövid mondatot.");
  return {
    ...state,
    facts: state.facts.map((f) =>
      f.id === id
        ? { ...f, text: text.trim(), enabled, status: "confirmed" }
        : f,
    ),
  };
}
export function judgeClaim(state, id, feedback, correction = "") {
  if (feedback === "refine" && !correction.trim())
    throw new Error("A pontosításhoz írd le, mi jellemző rád.");
  return {
    ...state,
    claims: state.claims.map((c) =>
      c.id === id
        ? {
            ...c,
            feedback,
            correction: correction.trim(),
            status: feedback === "reject" ? "retired" : "active",
          }
        : c,
    ),
  };
}
export function closePrediction(state, id, status, actual = "") {
  return {
    ...state,
    predictions: state.predictions.map((p) =>
      p.id === id ? { ...p, status, actual } : p,
    ),
  };
}
export function accuracy(predictions) {
  const closed = predictions.filter((p) => p.status !== "pending");
  return closed.length
    ? {
        closed: closed.length,
        hits: closed.filter((p) => p.status === "validated").length,
      }
    : null;
}
export function decideExperiment(state, id, status) {
  return {
    ...state,
    experiments: state.experiments.map((e) =>
      e.id === id ? { ...e, status } : e,
    ),
  };
}

export function patternFactId(state, id) {
  return state.facts.find((f) => f.patternId === id)?.id || null;
}
export function patternExperiment(state, id) {
  return state.experiments.find((e) => e.patternId === id) || null;
}
const WEEK_DAYS = [
  ["wed", "Szerda"],
  ["thu", "Csütörtök"],
  ["fri", "Péntek"],
  ["sat", "Szombat"],
  ["sun", "Vasárnap"],
  ["mon", "Hétfő"],
  ["tue", "Kedd"],
];
export function weekSnapshot(period = "current", state = {}, nutrition = {}) {
  const archived = period === "previous";
  const activities = archived
    ? [
        "Rövid teljes testes edzés",
        "Pihenőnap",
        "Teljes test B",
        "Közös séta",
        "Előkészített ételek",
        "Teljes test A",
        "Lassú esti séta",
      ]
    : [
        "Teljes testes edzés",
        "Közös séta",
        "Teljes test C",
        "Könnyű futás",
        "Lassabb nap",
        "Teljes test A",
        state.workoutFinished ? "Pull Day · teljesítve" : "Pull Day",
      ];
  const icons = archived
    ? ["dumbbell", "moon", "dumbbell", "users", "utensils", "dumbbell", "moon"]
    : [
        "dumbbell",
        "users",
        "dumbbell",
        "run",
        "utensils",
        "dumbbell",
        "dumbbell",
      ];
  const sleep = archived
    ? [420, 435, 440, 465, 470, 430, 450]
    : [485, 435, 470, 425, 495, 450, 470];
  const kcal = archived
    ? [2100, 2240, 2190, 2320, 2140, 2300, 2210]
    : [2150, 2300, 2250, 2480, 2120, 2380, Number(nutrition.kcal) || 0];
  const minutes = [32, 0, 42, 25, 0, 45, 15];
  const inWeek = (x) => x.date >= "2026-09-02" && x.date <= "2026-09-08";
  const gym = (state.training?.gymHistory || []).filter(inWeek),
    runs = (state.training?.runLogs || []).filter(inWeek),
    sports = (state.training?.sportLogs || []).filter(inWeek);
  const runningDistance =
    Math.round(
      runs.reduce((sum, x) => sum + (Number(x.distance) || 0), 0) * 10,
    ) / 10;
  const movementLogs = [
    ...gym.map((x) => ({
      ...x,
      title: x.name,
      icon: "dumbbell",
      route: "train-gym-detail",
    })),
    ...runs.map((x) => ({
      ...x,
      title: `Futás · ${Number(x.distance).toLocaleString("hu-HU")} km`,
      icon: "run",
      route: "train-run-detail",
    })),
    ...sports.map((x) => ({
      ...x,
      title: x.sport,
      icon: "activity",
      route: "train-sport-detail",
    })),
  ];
  const days = WEEK_DAYS.map(([id, weekday], i) => {
    const date = new Date(
      Date.UTC(2026, archived ? 7 : 8, (archived ? 26 : 2) + i),
    )
      .toISOString()
      .slice(0, 10);
    const loggedSleep = archived
      ? null
      : state.personal?.sleep?.logs?.find((s) => s.date === date);
    const movements = archived
      ? []
      : movementLogs
          .filter((x) => x.date === date)
          .map((x) => ({
            id: x.id,
            title: x.title,
            icon: x.icon,
            duration: Number(x.duration) || 0,
            route: x.route,
            params: { id: x.id },
          }));
    const route = archived
      ? null
      : movements[0]?.route || (i === 6 ? "workout" : null);
    const activity = archived
      ? activities[i]
      : movements.length
        ? movements.map((x) => x.title).join(" + ")
        : i === 6
          ? "Pull Day · tervezett edzés"
          : "Nincs naplózott mozgás";
    return {
      id,
      date,
      weekday,
      title: new Date(date + "T12:00:00").toLocaleDateString("hu-HU", {
        month: "long",
        day: "numeric",
      }),
      activity,
      icon: archived ? icons[i] : movements[0]?.icon || "calendar",
      sleepMinutes: loggedSleep?.minutes ?? sleep[i],
      kcal: kcal[i],
      movementMinutes: archived
        ? minutes[i]
        : movements.reduce((sum, x) => sum + x.duration, 0),
      movements,
      route,
      params: movements[0]?.params || {},
    };
  });
  return {
    period: archived ? "previous" : "current",
    archived,
    label: archived ? "AUG. 26. – SZEPT. 1." : "SZEPTEMBER 2–8.",
    title: archived
      ? "Az újrakezdés heted része lett."
      : "A kis lépésekből ritmus lett.",
    completed: archived ? 3 : gym.length,
    runningDistance: archived ? null : runningDistance,
    distance: archived
      ? "9,6"
      : runningDistance.toLocaleString("hu-HU", { maximumFractionDigits: 1 }),
    days,
  };
}

export function toggleMemoirLike(state, chapter) {
  return {
    ...state,
    memoirLikes: {
      ...state.memoirLikes,
      [chapter]: !state.memoirLikes?.[chapter],
    },
  };
}
