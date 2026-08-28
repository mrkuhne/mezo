// ============================================================
// Mezo · humanizeCron (mezo-d20.5.7, spec §5 "humán cron-idők")
// A memória-konnektorok NÉZET-oldali cron-fordítója: a backend
// nyers 6 mezős Spring-cronját ("0 20 2 * * *") emberi idővé
// alakítja ("minden éjjel 02:20"). Csak a két valós formát érti
// (napi fix idő · heti egy napon fix idő) — minden mást ŐSZINTÉN
// nyersen ad vissza, nem tippel (honest fallback, sosem kitalált).
// ============================================================

const DOW_HU: Record<string, string> = {
  SUN: 'vasárnap', MON: 'hétfő', TUE: 'kedd', WED: 'szerda',
  THU: 'csütörtök', FRI: 'péntek', SAT: 'szombat',
  '0': 'vasárnap', '1': 'hétfő', '2': 'kedd', '3': 'szerda',
  '4': 'csütörtök', '5': 'péntek', '6': 'szombat', '7': 'vasárnap',
}

const isNum = (s: string) => /^\d{1,2}$/.test(s)
const pad2 = (s: string) => s.padStart(2, '0')

/** Spring 6 mezős cron → emberi magyar idő; ha nem érti, a nyers stringet adja vissza. */
export function humanizeCron(cron: string): string {
  const f = cron.trim().split(/\s+/)
  if (f.length !== 6) return cron
  const [sec, min, hour, dom, month, dow] = f
  if (!isNum(sec) || !isNum(min) || !isNum(hour)) return cron
  if (Number(min) > 59 || Number(hour) > 23) return cron
  if (!(dom === '*' || dom === '?') || month !== '*') return cron

  const time = `${pad2(hour)}:${pad2(min)}`
  if (dow === '*' || dow === '?') {
    // 05:00 előtt a társ éjjel dolgozik — így is mondjuk
    return Number(hour) < 5 ? `minden éjjel ${time}` : `minden nap ${time}`
  }
  const day = DOW_HU[dow.toUpperCase()]
  return day ? `${day} ${time}` : cron
}
