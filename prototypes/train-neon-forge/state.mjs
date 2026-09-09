export const exercises = [
  { name: 'Fekvenyomás', muscle: 'Mell · tricepsz · váll', kg: 60, reps: 10, skill: 'Erő', previous: '57,5 kg × 10', color: 'lime' },
  { name: 'Evezés csigán', muscle: 'Hát · bicepsz', kg: 45, reps: 12, skill: 'Kontroll', previous: '42,5 kg × 12', color: 'cyan' },
  { name: 'Vállból nyomás', muscle: 'Váll · tricepsz', kg: 20, reps: 10, skill: 'Stabilitás', previous: '17,5 kg × 10', color: 'purple' },
];
export const initialState = () => ({ xp: 860, coins: 1240, logs: [], finished: false, claimed: false, aura: false });
export function logSet(state, kg, reps) {
  if (state.finished || state.logs.length >= 9) throw new Error('Ez az edzés már teljesült.');
  if (!Number.isFinite(kg) || kg < 0 || kg > 500 || !Number.isInteger(reps) || reps < 1 || reps > 100)
    throw new Error('Súly: 0–500 kg. Ismétlés: 1–100 egész szám.');
  return { ...state, xp: state.xp + 35, coins: state.coins + 5,
    logs: [...state.logs, { exercise: Math.floor(state.logs.length / 3), kg, reps }] };
}
export function finishWorkout(state) {
  if (!state.logs.length) throw new Error('Előbb logolj legalább egy sorozatot.');
  return { ...state, finished: true };
}
export function claimReward(state) {
  if (!state.finished) throw new Error('Előbb zárd le az edzést.');
  return state.claimed ? state : { ...state, claimed: true, xp: state.xp + 200, coins: state.coins + 60 };
}
export function buyAura(state) {
  if (state.aura) return state;
  if (state.coins < 250) throw new Error('Még nincs elég Forge-érméd.');
  return { ...state, coins: state.coins - 250, aura: true };
}
export const totals = state => ({ volume: state.logs.reduce((n, s) => n + s.kg * s.reps, 0),
  level: 12 + Math.floor(state.xp / 1200), progress: (state.xp % 1200) / 12,
  earnedXP: state.logs.length * 35 + (state.claimed ? 200 : 0),
  earnedCoins: state.logs.length * 5 + (state.claimed ? 60 : 0) });
