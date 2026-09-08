export const ROLES = {
  home: {
    name: "Boop veled",
    short: "Otthon",
    eyebrow: "EGY TÁRS. A TELJES TÖRTÉNETED.",
    description: "A napod, a beszélgetésünk és ami most fontos.",
    icon: "sun",
    color: "#c38370",
    light: "#f6cdb8",
    shadow: "#a66050",
    tabs: [
      ["today", "Ma", "sun"],
      ["talk", "Beszélgetés", "message"],
      ["capture", "Rögzítés", "plus"],
    ],
  },
  movement: {
    name: "Mozgás",
    short: "Mozgás",
    eyebrow: "ERŐ, SPORT ÉS REGENERÁCIÓ",
    description: "A mezociklusod, a sportjaid és a közös terhelés.",
    icon: "dumbbell",
    color: "#627f9e",
    light: "#c6d9e6",
    shadow: "#3a5271",
    tabs: [
      ["today", "Ma", "sun"],
      ["gym", "Terem", "dumbbell"],
      ["sport", "Sport", "activity"],
      ["run", "Futás", "run"],
    ],
  },
  fuel: {
    name: "Táplálás",
    short: "Táplálás",
    eyebrow: "AMIBŐL A NAPOD ÉPÜL",
    description: "Étkezés és a mozgásodhoz igazodó célok.",
    icon: "utensils",
    color: "#b0813b",
    light: "#f0d7a6",
    shadow: "#866128",
    tabs: [
      ["today", "Ma", "sun"],
      ["log", "Napló", "book"],
      ["recipes", "Receptek", "chef"],
      ["pantry", "Kamra", "box"],
    ],
  },
  life: {
    name: "Életem",
    short: "Életem",
    eyebrow: "AHOGYAN BELÜL ÉS KÍVÜL VAGY",
    description: "Közérzet, napló, test, célok és kapcsolatok.",
    icon: "heart",
    color: "#8c779f",
    light: "#e0d2e8",
    shadow: "#655270",
    tabs: [
      ["today", "Ma", "sun"],
      ["journal", "Napló", "book"],
      ["body", "Testem", "moon"],
      ["goals", "Célok", "target"],
    ],
  },
  understanding: {
    name: "A közös kép",
    short: "Közös kép",
    eyebrow: "AMIT EGYÜTT ÉRTÜNK MEG",
    description: "Minták, emlékezet és a rólad alakuló kép.",
    icon: "sparkles",
    color: "#a36a72",
    light: "#efd1d0",
    shadow: "#774751",
    tabs: [
      ["patterns", "Minták", "chart"],
      ["memory", "Tudástár", "book"],
      ["profile", "Karakter", "brain"],
      ["outlook", "Kilátás", "sparkles"],
    ],
  },
};
export function createPresence() {
  return {
    role: "home",
    tabs: {
      home: "today",
      movement: "today",
      fuel: "today",
      life: "today",
      understanding: "patterns",
    },
    training: {
      cycle: {
        name: "Őszi építkezés",
        week: 3,
        weeks: 6,
        goal: "Hypertrophy",
        session: "Pull A",
        time: "17:30",
      },
      sportActive: true,
    },
    checkins: [
      {
        slot: "Reggel",
        mood: "good",
        note: "Jó volt nyugodtan kezdeni.",
        time: "07:40",
      },
      {
        slot: "Délben",
        mood: "busy",
        note: "Sok feladat, de haladok.",
        time: "12:20",
      },
    ],
    journal: "",
    gratitude: "",
    draft: "",
    messages: [
      {
        id: "welcome",
        role: "assistant",
        text: "Szia, Daniel. A reggeli nyugalmad után sűrűbb lett a nap. Itt van velem a mezociklusod, a mai étkezésed és az is, amit délben elmondtál. Honnan folytassuk?",
        sources: [
          "Déli check-in",
          "3/6. hét · hypertrophy",
          "Mai étkezési napló",
        ],
      },
    ],
    toolEvents: [],
  };
}
export function selectRole(s, role) {
  return ROLES[role] ? { ...s, role } : s;
}
export function selectTab(s, tab) {
  return ROLES[s.role].tabs.some(([id]) => id === tab)
    ? { ...s, tabs: { ...s.tabs, [s.role]: tab } }
    : s;
}
export function recordPresenceCheckin(s, mood, note) {
  if (!["good", "busy", "tired"].includes(mood)) return s;
  return {
    ...s,
    checkins: [
      ...s.checkins,
      {
        slot:
          ["Reggel", "Délben", "Délután", "Este"][s.checkins.length] ||
          "Napközben",
        mood,
        note: note.trim(),
        time: "16:40",
      },
    ],
  };
}
export function foodBudget(s) {
  const base = 2400,
    sport = s.training.sportActive ? 350 : 0,
    logged = 1440;
  return {
    base,
    sport,
    logged,
    target: base + sport,
    remaining: base + sport - logged,
  };
}
export function applyPresenceTool(s, tool) {
  if (tool === "cancel-sport" && s.training.sportActive)
    return {
      ...s,
      training: { ...s.training, sportActive: false },
      toolEvents: [
        ...s.toolEvents,
        {
          id: "sport-cancelled",
          label: "Mai röplabda elmarad",
          impact: "Étkezési keret: 2750 → 2400 kcal",
        },
      ],
    };
  return s;
}
export function presenceReply(text, s) {
  const t = text.toLocaleLowerCase("hu"),
    last = s.checkins.at(-1),
    budget = foodBudget(s);
  const sources = [
    `${last.slot} check-in`,
    `${s.training.cycle.week}/6. hét · hypertrophy`,
    "Mai étkezési napló",
  ];
  let answer = { text: "", sources, actions: [] };
  if (/röplabda/.test(t) && /elmarad|lemond|kihagy/.test(t)) {
    if (!s.training.sportActive) {
      return {
        ...answer,
        text: "A mai röplabda már elmaradtként szerepel. Az étkezési mintakereted ezt követi: 2400 kcal. A meglévő mezociklusodhoz nem nyúltunk.",
        actions: [
          { label: "A mostani étkezési keret", role: "fuel", tab: "today" },
        ],
      };
    }
    if (/vezesd át|rögzítsd|töröld/.test(t) && !/mi lenne|ha |\?/.test(t)) {
      answer.text = s.training.sportActive
        ? "Átvezettem a mai röplabda elmaradását a mintanapban. A sporthoz kapcsolt 350 kcal kikerült a keretből: így most 2400 kcal a napi cél. A hypertrophy mezociklusod változatlan."
        : "A mai röplabdát már elmaradtként tartjuk számon. A napi mintakeret továbbra is 2400 kcal; nem vontam le még egyszer.";
      answer.tool = "cancel-sport";
      answer.actions = [
        { label: "A friss étkezési keret", role: "fuel", tab: "today" },
      ];
    } else {
      answer.text =
        "Ha a mai röplabda elmaradna, a bemutatóban hozzá kapcsolt 350 kcal is kikerülne a keretből. A 2750 helyett 2400 kcal lenne a cél, a mezociklusod megtartásával. Egyelőre csak átbeszéljük; semmit nem módosítottam.";
      answer.suggestion = "A mai röplabda elmarad, vezesd át.";
    }
    return answer;
  }
  if (/edzés|mezocik|terhel|sport/.test(t)) {
    answer.text = `${last.mood === "tired" ? "Most fáradtabbnak érzed magad." : last.mood === "busy" ? "A legutóbbi bejelentkezésedben sűrűnek érezted a napot." : "A legutóbbi bejelentkezésed szerint jól vagy."} A meglévő hypertrophy blokkod 3. hetében jársz; ma Pull A szerepel benne.${s.training.sportActive ? " Emellett röplabda is van a napodban." : " A röplabda mára elmarad."} Ezt együtt nézzük a közérzeteddel és az étkezési kerettel. Először nézzünk rá a teljes napra; a programodat nem írtam át.`;
    answer.actions = [
      { label: "A meglévő mezociklusom", role: "movement", tab: "gym" },
      { label: "A hozzá kapcsolódó keret", role: "fuel", tab: "today" },
    ];
  } else if (/étel|étkez|kaja|egyek|kalória|keret|ebéd/.test(t)) {
    answer.text = `A mai mintakereted ${budget.target} kcal: ${budget.base} kcal alap és ${budget.sport} kcal sporthoz rendelt rész. Ebből ${budget.logged} kcal szerepel a naplóban. Az étkezésedet a tervezett mozgással és a személyes céljaiddal együtt nézzük; a napló önállóan is használható.`;
    answer.sources = [
      "Mai étkezési napló",
      s.training.sportActive
        ? "Mai röplabda · tervezett"
        : "Mai röplabda · elmarad",
      "Személyes alapkeret",
    ];
    answer.actions = [
      { label: "Étkezésem és céljaim", role: "fuel", tab: "today" },
    ];
  } else if (/emlé|tudsz|ismer|profil|minta|tanul/.test(t)) {
    answer.text =
      "A mai bejelentkezéseid a rövid távú kontextus részei. A naplózott eseményeket külön őrizzük, a visszatérő mintákat pedig megkülönböztetjük az általad megerősített tudástól. A rólad alakuló képben a fizikai, mentális, szociális, egészségi és lelki oldalad is helyet kap. Ez a prototípus előre megírt példákkal mutatja meg a különbséget.";
    answer.sources = [
      "Rétegzett memória · szemléltetés",
      "Saját visszajelzéseid",
    ];
    answer.actions = [
      {
        label: "Miből áll a közös tudás?",
        role: "understanding",
        tab: "memory",
      },
      { label: "A rólam alakuló kép", role: "understanding", tab: "profile" },
    ];
  } else {
    answer.text = `${s.journal ? `A mai naplódban ezt írtad: „${s.journal.slice(0, 180)}” ` : last.note ? `A legutóbbi szavaidat is idehozom: „${last.note}” ` : ""}${s.gratitude ? `A hálanaplódba pedig ez került: „${s.gratitude.slice(0, 120)}” ` : ""}Van hely annak is, amit a számok nem mondanak el. Maradhatunk annál, ami most foglalkoztat; nem kell rögtön teendővé alakítanunk. Mi volt ma a legnehezebb, vagy mi esett igazán jól?`;
    answer.sources = [
      `${last.slot} check-in`,
      s.journal ? "Mai saját napló" : "A mai beszélgetés",
    ];
    answer.actions = [
      { label: "Helyet adok neki a naplóban", role: "life", tab: "journal" },
    ];
  }
  return answer;
}
