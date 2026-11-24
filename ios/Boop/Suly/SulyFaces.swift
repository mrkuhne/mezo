import SwiftUI
import BoopCore
import BoopDesign

/// The Súly area's colour world (`mezo-r36n9.158`): gold, the brass of a scale.
let sulyHue = Hue.suly

/// The room's information sheet („Honnan tudom, hogy pályán vagy?").
struct SulyInfo: Identifiable, Equatable {
    let title: String
    let body: String
    var id: String { title }
}

let sulyRuleInfo = SulyInfo(title: "Honnan tudom, hogy pályán vagy?", body: """
A mérleg napról napra ugrál, ezért nem egy mérést nézek, hanem a **trendedet**: a méréseid kisimított vonalát, amit a szerver minden mérés után újraszámol.

A szám az orbon azt mondja, **mennyire tartod az évad tervezett ütemét**. A trended elmúlt négy hetének heti változását hasonlítom a terv heti üteméhez:

- pont a terv ütemén → **100**
- fele olyan gyorsan → **50**
- ha áll a súlyod, vagy rossz irányba megy → **0**
- ha gyorsabb a tervnél, az feleannyit von le, mint ha lassabb lenne — hogy nem túl gyors-e, azt az évad őrei nézik (az erőd és az izmod).

Tartó évadnál a sáv közepétől mért távolság adja a számot: a sávban 80–100, kívül egyre kevesebb.

Évad nélkül nincs mit követni: akkor „–” áll az orbon, a trended és a méréseid viszont itt vannak. A célt az Évadban állítod.
""")

let sulyBodyInfo = SulyInfo(title: "Honnan jön a testzsír és az izom?", body: """
A Feelfit mérleg minden méréskor az Apple Egészségbe írja a testzsír százalékot és az izomtömeget; Boop onnan olvassa, a telefonon.

Egy mérés sosem a te tested: a mérleg a lábadon átfolyó áram ellenállásából becsül, és ezt a hidratáltság is mozgatja. Ezért a **90 napos vonalat** nézd, nem egy pontot. Harminc napnál régebbi mérést már nem mondok „mostaninak”.

A BMI a trended súlyából és a profilod magasságából számolt szám — tájékoztató, izmos testnél félrevezet.
""")

/// Today in the phone's own calendar, `yyyy-MM-dd` (the weigh-ins carry server days, which are his days).
func sulyTodayString(_ calendar: Calendar = .current, now: Date = Date()) -> String {
    let f = DateFormatter(); f.calendar = calendar; f.timeZone = calendar.timeZone; f.dateFormat = "yyyy-MM-dd"
    return f.string(from: now)
}

/// The phone's calendar with the week starting on Monday, as his weeks run.
func sulyCalendar() -> Calendar {
    var c = Calendar.current; c.firstWeekday = 2; return c
}

/// A season's weeks count for a curve's trailing label, else the trend's eight weeks.
func sulyCurveTrailing(_ season: EvadOverview?) -> String {
    season.map { "\($0.head.weeks) hét" } ?? "8 hét"
}

/// A weigh-in row: the weekday, the date and the source, the kilograms.
func sulyLogRow(_ log: SulyLog, calendar: Calendar) -> NKAreaRow {
    NKAreaRow(id: log.id, glyph: log.note == nil ? "scale-ink" : "pen-sun",
              title: "\(sulyLogTitle(log, calendar: calendar)) · \(sulyShortDate(log.date))",
              sub: log.note ?? "mérés", value: sulyKg(log.kg), valueSub: "kg")
}

/// A line of the room when there is nothing to draw: quiet, never an invented number.
@MainActor func sulyQuietLine(_ text: String) -> some View {
    Text(text).nkFont(14).foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, alignment: .leading)
}
