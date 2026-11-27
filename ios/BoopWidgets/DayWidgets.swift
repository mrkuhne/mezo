import BoopDesign
import BoopShared
import SwiftUI
import WidgetKit

// Boop's Home and Lock Screen widgets (`mezo-r36n9.172`, spec §7.2, spike shots 08–09). All read one snapshot the app
// writes into the shared Keychain; each timeline entry picks what is still ahead at its moment (`WidgetDay`).

struct DayEntry: TimelineEntry {
    let date: Date
    let day: WidgetDay
}

struct DayProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry { DayEntry(date: .now, day: Self.sample) }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        let s = WidgetSnapshotStore.load()
        completion(DayEntry(date: .now, day: context.isPreview && s == nil ? Self.sample : WidgetDay.make(s, at: .now, calendar: .current)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        let s = WidgetSnapshotStore.load()
        let entries = WidgetDay.timeline(s, now: .now, calendar: .current)
            .map { DayEntry(date: $0, day: WidgetDay.make(s, at: $0, calendar: .current)) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    /// The widget gallery's example: real-looking, invented.
    static var sample: WidgetDay {
        let cal = Calendar.current, now = Date.now
        let day = WidgetDay.dayString(now, cal)
        let s = WidgetSnapshot(writtenAt: now, day: day, hasPlan: true,
                               items: [WidgetSnapshot.Item(at: now.addingTimeInterval(80 * 60), title: "Ebéd", hue: 3),
                                       WidgetSnapshot.Item(at: now.addingTimeInterval(4 * 3600), title: "Push nap", hue: 2)],
                               reminders: [WidgetSnapshot.ReminderRow(key: "a", day: day, at: now.addingTimeInterval(-600), title: "Vitamin", done: true, supplement: true),
                                           WidgetSnapshot.ReminderRow(key: "b", day: day, at: now.addingTimeInterval(110 * 60), title: "Fogorvos", done: false, supplement: false)])
        return WidgetDay.make(s, at: now, calendar: cal)
    }
}

// MARK: - Shared pieces

enum WidgetCopy {
    static let stale = "Nyisd meg a Boopot a mai tervhez"
    static let empty = "Mára nincs több teendő"

    static func clock(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

/// The painted sky behind a widget: the hue's gradient, darkened at the bottom for the type (no shader, no glass).
struct WidgetSky: View {
    let hue: Hue
    var body: some View {
        ZStack {
            LinearGradient(colors: [hue.top, hue.sky[1], hue.sky[2].opacity(0.85)], startPoint: .top, endPoint: .bottom)
            LinearGradient(colors: [.black.opacity(0.05), .black.opacity(0.35)], startPoint: .center, endPoint: .bottom)
        }
    }
}

/// The little orb beside a widget's label.
struct WidgetOrbDot: View {
    let hue: Hue
    var body: some View {
        Circle()
            .fill(RadialGradient(colors: [hue.orb[2], hue.orb[1], hue.orb[0]], center: .init(x: 0.35, y: 0.3), startRadius: 0, endRadius: 9))
            .frame(width: 14, height: 14)
            .accessibilityHidden(true)
    }
}

struct WidgetLabel: View {
    let text: String
    var body: some View {
        Text(text).font(.nkMono(11)).tracking(1.6).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
    }
}

extension WidgetThing {
    var sky: Hue { Hue(rawValue: hue) ?? .forma }
}

// MARK: - Következő (small)

struct NextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "boop.next", provider: DayProvider()) { entry in
            NextFace(entry: entry)
        }
        .configurationDisplayName("Következő")
        .description("A nap következő teendője, és mennyi idő van még addig.")
        .supportedFamilies([.systemSmall])
    }
}

struct NextFace: View {
    let entry: DayEntry
    private var thing: WidgetThing? { entry.day.next }
    private var hue: Hue { thing?.sky ?? .forma }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                WidgetOrbDot(hue: hue)
                WidgetLabel(text: "KÖVETKEZŐ")
            }
            Spacer(minLength: 4)
            if let thing {
                Text(WidgetCopy.clock(thing.at)).font(.nkNumber(46)).monospacedDigit().foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(thing.title).font(.nkSerif(20)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                Text(entry.day.state == .stale ? WidgetCopy.stale : WidgetDay.timeLeft(to: thing.at, from: entry.date))
                    .font(.system(size: 12)).foregroundStyle(.white.opacity(0.75)).lineLimit(2)
            } else {
                Text(entry.day.state == .stale ? WidgetCopy.stale : WidgetCopy.empty)
                    .font(.nkSerif(17)).foregroundStyle(.white).lineLimit(3).minimumScaleFactor(0.8)
                if entry.day.state == .empty, let t = entry.day.tomorrowFirst {
                    Text("holnap \(WidgetCopy.clock(t.at)) · \(t.title)").font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.75)).lineLimit(1).padding(.top, 4)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .containerBackground(for: .widget) { WidgetSky(hue: hue) }
    }
}

// MARK: - Mai nap (medium)

struct DayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "boop.day", provider: DayProvider()) { entry in
            DayFace(entry: entry)
        }
        .configurationDisplayName("Mai nap")
        .description("A nap következő teendői és a mai emlékeztetők — pipálni is lehet.")
        .supportedFamilies([.systemMedium])
    }
}

struct DayFace: View {
    let entry: DayEntry

    /// Up to three reminders: the open ones first by clock, then the ticked ones.
    private var reminders: [WidgetSnapshot.ReminderRow] {
        Array((entry.day.reminders.filter { !$0.done } + entry.day.reminders.filter(\.done)).prefix(3))
            .sorted { $0.at < $1.at }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 9) {
                WidgetLabel(text: "MA")
                switch entry.day.state {
                case .normal:
                    ForEach(Array(entry.day.upcoming.prefix(3).enumerated()), id: \.offset) { _, t in
                        HStack(spacing: 10) {
                            Text(WidgetCopy.clock(t.at)).font(.nkNumber(17)).monospacedDigit().frame(width: 46, alignment: .leading)
                            Text(t.title).font(.system(size: 15)).lineLimit(1)
                        }
                        .foregroundStyle(.white)
                        .accessibilityElement(children: .combine)
                    }
                case .stale:
                    Text(WidgetCopy.stale).font(.nkSerif(16)).foregroundStyle(.white).lineLimit(3)
                case .empty:
                    Text(WidgetCopy.empty).font(.nkSerif(16)).foregroundStyle(.white).lineLimit(2)
                    if let t = entry.day.tomorrowFirst {
                        Text("holnap \(WidgetCopy.clock(t.at)) · \(t.title)").font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.75)).lineLimit(1)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if !reminders.isEmpty {
                Rectangle().fill(.white.opacity(0.18)).frame(width: 1).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 8) {
                    WidgetLabel(text: "EMLÉKEZTETŐK")
                    ForEach(reminders, id: \.key) { r in
                        Button(intent: WidgetReminderTickIntent(key: r.key, wasDone: r.done)) {
                            HStack(spacing: 8) {
                                ZStack {
                                    Circle().strokeBorder(.white.opacity(0.85), lineWidth: 1.5)
                                    if r.done {
                                        Circle().fill(.white)
                                        Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(.black)
                                    }
                                }
                                .frame(width: 22, height: 22)
                                Text(r.title).font(.system(size: 15)).lineLimit(1)
                                    .strikethrough(r.done).foregroundStyle(.white.opacity(r.done ? 0.55 : 1))
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(r.title)
                        .accessibilityValue(r.done ? "kész" : "nincs kész")
                        .accessibilityHint(r.done ? "Visszanyitja" : (r.supplement ? "Bevettem" : "Kész"))
                    }
                }
                .frame(maxWidth: 150, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { WidgetSky(hue: .forma) }
    }
}

// MARK: - Zárolt képernyő (accessory)

struct LockWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "boop.lock", provider: DayProvider()) { entry in
            LockFace(entry: entry)
        }
        .configurationDisplayName("Boop · Következő")
        .description("A következő teendő és a következő emlékeztető a zárolt képernyőn.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

struct LockFace: View {
    let entry: DayEntry
    @Environment(\.widgetFamily) private var family

    /// The next unticked reminder, when it is not already the next thing.
    private var reminderLine: String? {
        guard let r = entry.day.nextReminder, !(entry.day.next?.isReminder == true && entry.day.next?.at == r.at && entry.day.next?.title == r.title)
        else { return nil }
        return "\(WidgetCopy.clock(r.at))  \(r.title) · még nincs kész"
    }

    var body: some View {
        Group {
            if family == .accessoryInline {
                if let t = entry.day.next { Text("\(WidgetCopy.clock(t.at)) \(t.title)") } else { Text(entry.day.state == .stale ? "Boop" : WidgetCopy.empty) }
            } else {
                VStack(alignment: .leading, spacing: 1) {
                    Text("BOOP · KÖVETKEZŐ").font(.system(size: 11, weight: .medium)).opacity(0.8)
                    if let t = entry.day.next {
                        Text("\(WidgetCopy.clock(t.at))  \(t.title)").font(.system(size: 16, weight: .semibold)).lineLimit(1)
                        if let line = reminderLine { Text(line).font(.system(size: 13)).lineLimit(1).opacity(0.85) }
                    } else {
                        Text(entry.day.state == .stale ? WidgetCopy.stale : WidgetCopy.empty).font(.system(size: 14, weight: .semibold)).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
        }
        .containerBackground(for: .widget) { AccessoryWidgetBackground() }
    }
}
