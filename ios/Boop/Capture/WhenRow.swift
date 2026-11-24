import SwiftUI
import BoopCore
import BoopDesign

/// The app's binding of the kit's `NKWhenRow` to BoopCore's `WhenChoice` (`mezo-r36n9.159`): the row shows the
/// resolved day in the owner's words, the chips set the choice, the picker keeps it inside today and the previous
/// six days.
struct WhenRow: View {
    let eyebrow: String
    let hue: Hue
    var withTime = false
    @Binding var choice: WhenChoice
    var now: () -> Date = { BoopClock.now() }
    var calendar: Calendar = .current

    private var pick: NKWhenRow.Pick {
        switch choice {
        case .now: .now
        case .yesterday: .yesterday
        case .other: .other
        }
    }

    var body: some View {
        let current = now()
        NKWhenRow(
            eyebrow: eyebrow, hue: hue, withTime: withTime,
            label: whenLabel(choice, now: current, withTime: withTime, calendar: calendar),
            pick: pick,
            picked: Binding(get: { whenResolved(choice, now: current, calendar: calendar) },
                            set: { choice = .other(whenClamp($0, now: current, calendar: calendar)) }),
            range: whenEarliest(now: current, calendar: calendar)...current,
            onNow: { choice = .now },
            onYesterday: { choice = .yesterday },
            onOther: { if case .now = choice { choice = .other(current) } })
    }
}
