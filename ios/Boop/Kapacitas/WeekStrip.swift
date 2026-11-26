import SwiftUI
import BoopCore
import BoopDesign

/// The week strip of the Átrendezés page and the Évad *A jövő heted* block (spike `KapWeekStrip`): each day's load
/// against what he can carry that day. The kit draws the bar on a 1.2 scale with the capacity tick at 1.0; the server's
/// ratio is the bar, so nothing is computed here.
struct KapWeekStrip: View {
    let week: KapacitasWeek
    var hue: Hue = kapacitasHue

    var body: some View {
        NKWeekLoadStrip(days: kapacitasStripDays(week).map {
            NKLoadDay(weekday: $0.weekday, date: $0.date, demand: min($0.ratio, 1.2), capacity: 1, word: $0.word)
        }, lit: kapacitasHardestDay(week), hue: hue)
    }
}
