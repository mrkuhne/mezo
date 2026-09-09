export const sportNames = { volleyball: 'Röplabda', cross: 'Cross', trx: 'TRX' };
export const days = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
export const runningPlan = [
  { key: 'mon', day: 0, title: 'Piramis · 15 / 30 / 45', rounds: 6, rpe: '7–8', time: '07:00', duration: 25 },
  { key: 'wed', day: 2, title: 'Sprint · 6 × 30 mp', rounds: 6, rpe: '8–9', time: '07:00', duration: 20 },
  { key: 'sat', day: 5, title: 'Piramis · 30 / 45 / 60', rounds: 9, rpe: '7–8', time: '09:00', duration: 30 },
];
export const initialTrain = () => ({
  day: 2, sportKind: 'volleyball', sportTab: 'plan', runTab: 'plan', mesoWeek: 3,
  meso: { title: 'Erőalap · Upper / Lower', week: 3, weeks: 6, phase: 'Építés' },
  sportSchedule: [{ day: 1, kind: 'trx', time: '17:00', duration: 45 }, { day: 2, kind: 'volleyball', time: '19:00', duration: 90 }, { day: 5, kind: 'cross', time: '10:00', duration: 45 }],
  sportLogs: [{ id: 'seed-trx', day: 1, kind: 'trx', duration: 45, rounds: 6, rpe: 7, notes: '' }],
  runLogs: [{ key: 'mon', rounds: 6, rpe: 7, recovery: 55, notes: 'Egyenletes tempó.' }],
  exerciseFilter: 'Összes', exerciseSearch: '',
});
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export function saveSport(world, input) {
  if (!sportNames[input.kind] || !integer(input.duration, 15, 600) || !integer(input.rpe, 1, 10) ||
      !integer(input.rounds, input.kind === 'volleyball' ? 0 : 1, 50) ||
      (input.kind === 'volleyball' && !integer(input.shoulder, 1, 10)))
    throw new Error('Ellenőrizd az időt (15–600), az RPE-t (1–10) és a szetteket/köröket.');
  return { ...world, sportLogs: [...world.sportLogs, { ...input, id: `sport-${world.sportLogs.length}`, day: 2, notes: String(input.notes || '').slice(0, 500) }] };
}
export function saveRun(world, input) {
  const session = runningPlan.find(r => r.key === input.key);
  if (!session || session.day > 2 || !integer(input.rounds, 0, 30) || !integer(input.rpe, 1, 10) || !integer(input.recovery, 0, 300))
    throw new Error('Körök: 0–30, RPE: 1–10, pulzus-megnyugvás: 0–300 mp.');
  return { ...world, runLogs: [...world.runLogs.filter(r => r.key !== input.key), { ...input, notes: String(input.notes || '').slice(0, 500) }] };
}
export function addSportSlot(world, slot) {
  if (!integer(slot.day, 0, 6) || !sportNames[slot.kind] || !integer(slot.duration, 15, 600) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time))
    throw new Error('Adj meg érvényes napot, időpontot és időtartamot.');
  return { ...world, sportSchedule: [...world.sportSchedule, { ...slot }] };
}
export function activateMeso(world, title, weeks) {
  if (!title.trim() || !integer(weeks, 3, 12)) throw new Error('Adj címet és 3–12 hetes időtartamot.');
  return { ...world, mesoWeek: 1, meso: { title: title.trim().slice(0, 70), week: 1, weeks, phase: 'Alapozás' } };
}
