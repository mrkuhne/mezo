export function createDay() {
  return { water: 1250, xp: 760, coins: 1240, waterRewarded: false, intention: 'Ma figyelmesen, nem sietve.', journal: [], closed: false,
    checkins: { reggel: { energy: 7, stress: 3, body: 8, mind: 7 } },
    habits: [{ id: 'sleep', name: 'Alvás rögzítése', hint: '7 óra 42 perc · naplózva', done: true, derived: true }, { id: 'intention', name: 'Napi szándék', hint: 'A mai irányod már megvan', done: true, derived: true }, { id: 'sun', name: 'Reggeli fény', hint: 'Pár perc a szabadban', done: false, derived: false }, { id: 'winddown', name: 'Lassítás', hint: 'Tedd le, ami ráér holnapig', done: false, derived: false }] };
}
export function addWater(day) { day.water += 250; let earned = 0; if (day.water >= 2000 && !day.waterRewarded) { day.waterRewarded = true; day.xp += 25; earned = 25; } return earned; }
export function saveCheckin(day, slot, values) { day.checkins[slot] = { ...values }; }
export function toggleHabit(day, id) { const habit = day.habits.find(h => h.id === id); if (!habit || habit.derived) return false; habit.done = !habit.done; return true; }
