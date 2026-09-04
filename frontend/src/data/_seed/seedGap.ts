// ============================================================
// Mezo · seedGap — determinisztikus hídnapok a mock-seedekhez (mezo-7vdm #6).
//
// A mock-seedek fix, kézzel írt sorozatai a 2026-05-22-i „mock-korszakkal" érnek véget, a
// dátum-relatív „mai" sor viszont a valós órához igazodik. Valós időben ezért LYUK tátong a
// kettő közt — ma már több hónapos —, és a /me/suly heti csoportosítása egyelemű legfrissebb
// hetet mutat. Ezek a függvények töltik ki a lyukat, determinisztikusan: nincs `Math.random`,
// nincs `Date` olvasás, ugyanaz a bemenet mindig ugyanazt adja.
//
// FONTOS a vizuális kapunak: a fagyasztott órájú futásokban (2026-05-21) a fix farok MÁR
// lefedi a mai napot, tehát `gapDays` üreset ad, és egyetlen golden sem mozdul ettől.
// Pure: nincs React, nincs olvasás.
// ============================================================

/** Egy ISO nap (`YYYY-MM-DD`) UTC-ben, a hónap-/évhatárt a Date aritmetikájára bízva. */
function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A két dátum KÖZÖTTI napok, növekvő sorrendben — egyik végpont sem tartozik bele.
 *  Azonos vagy fordított sorrendű végekre üres (sosem dob, sosem végtelen ciklus). */
export function gapDays(afterIso: string, beforeIso: string): string[] {
  const out: string[] = []
  for (let d = shift(afterIso, 1); d < beforeIso; d = shift(d, 1)) out.push(d)
  return out
}

/** `count` darab érték a két végpont KÖZÖTT, egyenletesen, egy tizedesre kerekítve.
 *  A végpontok maguk nem szerepelnek — azokat a hívó sorozata már tartalmazza. */
export function lerpSeries(from: number, to: number, count: number): number[] {
  if (count <= 0) return []
  const step = (to - from) / (count + 1)
  return Array.from({ length: count }, (_, i) => Math.round((from + step * (i + 1)) * 10) / 10)
}
