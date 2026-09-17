export const PERSONAL_TODAY = "2026-09-08";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random()}`;
const validDate = (d) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d ?? "") &&
  !Number.isNaN(Date.parse(d)) &&
  new Date(d).toISOString().slice(0, 10) === d;
const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t ?? "");
const newest = (xs) => [...xs].sort((a, b) => b.date.localeCompare(a.date));
const upsert = (xs, x) =>
  xs.some((v) => v.id === x.id)
    ? xs.map((v) => (v.id === x.id ? x : v))
    : [x, ...xs];
export function sleepMinutes(bed, wake) {
  if (!validTime(bed) || !validTime(wake))
    throw new Error("Adj meg érvényes lefekvési és ébredési időt.");
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const value = (minutes(wake) - minutes(bed) + 1440) % 1440;
  if (!value) throw new Error("A lefekvés és az ébredés nem lehet ugyanaz.");
  return value;
}
export function saveSleep(s, input) {
  if (!validDate(input.date)) throw new Error("Válaszd ki az ébredés napját.");
  const minutes = sleepMinutes(input.bed, input.wake);
  const quality = Number(input.quality);
  if (!Number.isInteger(quality) || quality < 1 || quality > 5)
    throw new Error("Válassz 1 és 5 közötti alvásminőséget.");
  const sameDay = s.sleep.logs.find((x) => x.date === input.date);
  const entry = {
    ...input,
    id: input.id || sameDay?.id || uid(),
    minutes,
    quality,
    factors: input.factors || [],
    note: input.note || "",
  };
  const logs = newest(
    upsert(
      s.sleep.logs.filter((x) => x.date !== entry.date || x.id === entry.id),
      entry,
    ),
  );
  return { ...s, sleep: { ...s.sleep, logs, latest: logs[0] } };
}
export function saveWeight(s, input) {
  const value = Number(String(input.value).replace(",", "."));
  if (!validDate(input.date)) throw new Error("Válaszd ki a mérés napját.");
  if (!Number.isFinite(value) || value < 20 || value > 350)
    throw new Error("Adj meg egy testsúlyt 20 és 350 kg között.");
  const existing = s.weight.logs.find((x) => x.date === input.date);
  const entry = {
    ...input,
    id: input.id || existing?.id || uid(),
    value: Math.round(value * 10) / 10,
  };
  const logs = newest(
    upsert(
      s.weight.logs.filter((x) => x.date !== entry.date || x.id === entry.id),
      entry,
    ),
  );
  return { ...s, weight: { ...s.weight, logs, latest: logs[0].value } };
}
export function savePerson(s, input) {
  if (!input.name?.trim()) throw new Error("A név még hiányzik.");
  if (input.importantDates?.some((x) => !x.label.trim() || !validDate(x.date)))
    throw new Error("A fontos dátumhoz adj nevet és napot.");
  const existing = s.people.find((x) => x.id === input.id);
  const person = {
    contacts: [],
    events: [],
    importantDates: [],
    ...existing,
    ...input,
    id: input.id || uid(),
    name: input.name.trim(),
  };
  return { ...s, people: upsert(s.people, person) };
}
function updatePerson(s, id, update) {
  if (!s.people.some((p) => p.id === id))
    throw new Error("Ez a személy már nem található.");
  return { ...s, people: s.people.map((p) => (p.id === id ? update(p) : p)) };
}
export function addContact(s, id, input) {
  if (!validDate(input.date) || !input.type)
    throw new Error("A kapcsolódás napja és típusa szükséges.");
  return updatePerson(s, id, (p) => ({
    ...p,
    contacts: newest([{ ...input, id: input.id || uid() }, ...p.contacts]),
  }));
}
export function planEvent(s, id, input) {
  if (!validDate(input.date) || !validTime(input.time) || !input.title?.trim())
    throw new Error("Adj címet, dátumot és időpontot a közös tervnek.");
  return updatePerson(s, id, (p) => ({
    ...p,
    events: [
      {
        ...input,
        id: input.id || uid(),
        title: input.title.trim(),
        status: "planned",
      },
      ...p.events,
    ],
  }));
}
export function saveRoutine(s, input) {
  if (
    !input.title?.trim() ||
    !input.days?.length ||
    !input.steps?.length ||
    input.steps.some((x) => !x.title.trim()) ||
    !validTime(input.time)
  )
    throw new Error(
      "A rutinhoz adj nevet, időpontot, legalább egy napot és egy lépést.",
    );
  const existing = s.routines.find((x) => x.id === input.id);
  return {
    ...s,
    routines: upsert(s.routines, {
      checks: {},
      ...existing,
      ...input,
      id: input.id || uid(),
      title: input.title.trim(),
    }),
  };
}
export function toggleRoutineStep(s, id, stepId, date = PERSONAL_TODAY) {
  return {
    ...s,
    routines: s.routines.map((r) => {
      if (
        r.id !== id ||
        r.steps.find((x) => x.id === stepId)?.kind !== "manual"
      )
        return r;
      const checks = r.checks[date] || [];
      return {
        ...r,
        checks: {
          ...r.checks,
          [date]: checks.includes(stepId)
            ? checks.filter((x) => x !== stepId)
            : [...checks, stepId],
        },
      };
    }),
  };
}
export function filterNotifications(rows, kind = "all", unread = false) {
  return rows.filter(
    (x) => (kind === "all" || x.kind === kind) && (!unread || !x.read),
  );
}
export function markNotificationsRead(s, id) {
  return {
    ...s,
    notifications: s.notifications.map((x) =>
      !id || x.id === id ? { ...x, read: true } : x,
    ),
  };
}
export function createPersonalState() {
  const logs = [
    ["08", "23:10", "07:00", 4, ["Olvasás"]],
    ["07", "23:40", "07:10", 3, ["Késői vacsora"]],
    ["06", "22:50", "07:05", 5, ["Séta"]],
    ["05", "00:10", "07:15", 3, ["Képernyő"]],
    ["04", "23:00", "06:50", 4, ["Olvasás"]],
    ["03", "23:30", "06:45", 3, []],
    ["02", "22:55", "07:00", 4, ["Séta"]],
  ].map(([d, bed, wake, quality, factors]) => ({
    id: `s${d}`,
    date: `2026-09-${d}`,
    bed,
    wake,
    minutes: sleepMinutes(bed, wake),
    quality,
    factors,
    note:
      d === "08" ? "Nyugodtabb reggel. Este jó volt letenni a telefont." : "",
  }));
  const weightLogs = [
    ["08", 81.4],
    ["07", 81.6],
    ["06", 81.5],
    ["05", 81.8],
    ["04", 81.7],
    ["03", 81.9],
    ["02", 82],
    ["01", 81.9],
  ].map(([d, value]) => ({
    id: `w${d}`,
    date: `2026-09-${d}`,
    value,
    note: "",
  }));
  return {
    sleep: { logs, latest: logs[0], targetMinutes: 480 },
    weight: { logs: weightLogs, latest: 81.4, target: 78 },
    people: [
      {
        id: "anna",
        name: "Anna",
        relationship: "Párom",
        note: "A vasárnapi séták a mi időnk. Szereti, ha előre tervezünk.",
        importantDates: [{ label: "Évfordulónk", date: "2026-09-21" }],
        contacts: [
          {
            id: "ca",
            date: "2026-09-07",
            type: "Közös idő",
            note: "Séta a rakparton, telefon nélkül.",
            feeling: "Feltöltött",
          },
        ],
        events: [
          {
            id: "ea",
            title: "Vasárnapi séta",
            date: "2026-09-13",
            time: "10:00",
            place: "Margitsziget",
            status: "planned",
          },
        ],
      },
      {
        id: "mate",
        name: "Máté",
        relationship: "Barát",
        note: "Most kezdett új munkahelyen. Kérdezzek rá, milyen az első hét.",
        importantDates: [{ label: "Születésnap", date: "2026-10-14" }],
        contacts: [
          {
            id: "cm",
            date: "2026-09-03",
            type: "Beszélgetés",
            note: "Mesélt az új csapatról.",
            feeling: "Jólesett",
          },
        ],
        events: [],
      },
      {
        id: "anya",
        name: "Anya",
        relationship: "Család",
        note: "A kertben már érik a paradicsom.",
        importantDates: [],
        contacts: [
          {
            id: "cy",
            date: "2026-09-06",
            type: "Telefon",
            note: "Hosszú vasárnapi beszélgetés.",
            feeling: "Jólesett",
          },
        ],
        events: [],
      },
    ],
    routines: [
      {
        id: "morning",
        title: "Könnyű reggel",
        anchor: "Miután felkeltem",
        time: "07:10",
        days: [1, 2, 3, 4, 5],
        steps: [
          { id: "water", title: "Egy pohár víz", kind: "manual" },
          { id: "stretch", title: "Két perc nyújtás", kind: "manual" },
          {
            id: "weigh",
            title: "Reggeli mérés",
            kind: "derived",
            route: "me-weight-log",
          },
        ],
        checks: {
          "2026-09-08": ["water"],
          "2026-09-07": ["water", "stretch"],
          "2026-09-04": ["water", "stretch"],
          "2026-09-03": ["water"],
        },
      },
      {
        id: "evening",
        title: "Vissza magamhoz",
        anchor: "Miután elpakoltam a vacsorát",
        time: "21:30",
        days: [0, 1, 2, 3, 4, 5, 6],
        steps: [
          { id: "phone", title: "Telefon az asztalon marad", kind: "manual" },
          { id: "reading", title: "Tíz perc olvasás", kind: "manual" },
          {
            id: "journal",
            title: "Egy mondat a napról",
            kind: "derived",
            route: "journal",
          },
        ],
        checks: {
          "2026-09-07": ["phone", "reading"],
          "2026-09-06": ["phone", "reading"],
          "2026-09-05": ["phone"],
        },
      },
    ],
    notifications: [
      {
        id: "n1",
        title: "A heted egy kicsit nyugodtabb",
        body: "Három estén olvastál. Nézzük meg, hogyan alakult az alvásod.",
        route: "me-sleep",
        kind: "sleep",
        time: "08:10",
        day: "Ma",
        read: false,
      },
      {
        id: "n2",
        title: "Egy kis idő Mátéra",
        body: "Az új munkahelye szóba került legutóbb. Felírhatsz egy közös programot.",
        route: "me-person",
        params: { id: "mate" },
        kind: "people",
        time: "09:00",
        day: "Ma",
        read: false,
      },
      {
        id: "n3",
        title: "Készen van a heti összkép",
        body: "A következetes apróságok most szépen látszanak.",
        route: "week",
        kind: "insight",
        time: "07:30",
        day: "Ma",
        read: false,
      },
      {
        id: "n4",
        title: "Az esti rutinod vár",
        body: "Telefon félre, tíz perc olvasás. Ennyi ma is elég.",
        route: "me-routine",
        params: { id: "evening" },
        kind: "routine",
        time: "21:30",
        day: "Tegnap",
        read: true,
      },
      {
        id: "n5",
        title: "A következő edzésed",
        body: "Felsőtest A · a tervet bármikor átnézheted.",
        route: "train",
        kind: "training",
        time: "18:00",
        day: "Tegnap",
        read: true,
      },
    ],
    preferences: {
      enabled: true,
      categories: {
        sleep: true,
        people: true,
        insight: true,
        routine: true,
        training: true,
        fuel: true,
      },
      quietEnabled: true,
      quietStart: "22:00",
      quietEnd: "07:00",
    },
  };
}
