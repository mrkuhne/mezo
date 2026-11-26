import BoopCore
import SwiftUI
import BoopDesign

/// Ma's quiet fold „Emlékeztetők” (spike shot 01): today's rows — open ones by time, ticked ones sunk and dim — and
/// „Mind” to the page. Hidden when nothing rings today. Sits under the wall.
struct MaReminders: View {
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    let now: Date
    private var calendar: Calendar { .current }

    var body: some View {
        if let store = ReminderHub.store {
            let sections = reminderSections(store.file, now: now, calendar: calendar)
            if sections.foldVisible {
                let today = ReminderPlanner.dayString(now, calendar: calendar)
                NKBare("Emlékeztetők", hue: .forma, glyph: "bell-cream", trailing: "\(sections.doneCount) / \(sections.today.count) kész") {
                    VStack(spacing: 0) {
                        ForEach(Array(sections.today.enumerated()), id: \.element.id) { i, row in
                            if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                            ReminderTodayRow(row: row, today: today, arm: reminderArmState(row.reminder), onTick: {
                                if row.done { store.untick(row.key) } else { store.tick(row.key) }
                            }, onOpen: { router?.openReminders() })
                        }
                        Button { router?.openReminders() } label: {
                            HStack(spacing: 6) {
                                Spacer()
                                Text("Mind").nkFont(16, .medium)
                                Image(systemName: "chevron.right").nkFont(13, .semibold)
                            }
                            .foregroundStyle(.white).frame(minHeight: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Mind az emlékeztető")
                        .padding(.top, 4)
                    }
                }
            }
        }
    }
}
