import SwiftUI
import BoopCore
import BoopDesign

// A day's catch-ups on its Napló sheet (`mezo-r36n9.159`, spec §3.4): the missing check-in moments, the gym day and
// the close — and the day's journal lines (A NAP SORAI), so a line written for a past day is visible where it was put.

/// What the day's sheet needs beyond the ledger: the block's template day for the weekday and whether it was done
/// that date (the training client), the day's journal lines (ledger + server) and, for a close, that day's brief.
@MainActor @Observable
final class NaploCatchUpModel {
    let date: String
    private(set) var catchUps: NaploCatchUps = .nothing
    private(set) var doneSlots: Set<String> = []
    private(set) var journalLines: [JournalLineLite] = []
    private(set) var brief: Brief?
    private(set) var loading = true
    /// The gym door's title: the template day's own, once the training client said it.
    private(set) var gymTitle: String?
    private(set) var gymTemplateId: UUID?

    @ObservationIgnored private let env: RitmusEnvironment
    @ObservationIgnored private let train: TrainClient?
    @ObservationIgnored private let morning: MorningStore?
    /// What the training client said about the day (the block's template day and whether it was done that date), kept
    /// so a ledger change (a merge, a catch-up) recomputes the block without another read.
    @ObservationIgnored private var template: (id: UUID, title: String)?
    @ObservationIgnored private var completed = false
    @ObservationIgnored private var serverLines: [JournalLineLite] = []

    init(env: RitmusEnvironment, date: String, train: TrainClient?, morning: MorningStore?) {
        self.env = env; self.date = date; self.train = train; self.morning = morning
    }

    static let dayLabels = ["Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas"]

    /// The server's weekday label of a `yyyy-MM-dd` day (Monday first), nil for a malformed day.
    static func weekdayLabel(of day: String, calendar: Calendar) -> String? {
        guard let noon = noon(day, calendar: calendar) else { return nil }
        let weekday = calendar.component(.weekday, from: noon) // 1 = Sunday
        return dayLabels[(weekday + 5) % 7]
    }

    static func noon(_ day: String, calendar: Calendar) -> Date? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12))
    }

    /// The day's journal lines: the phone's own (pending or not) first by id, the server's for the rest, newest first.
    static func mergedLines(local: [JournalLineLite], server: [JournalLineLite]) -> [JournalLineLite] {
        var seen = Set<UUID>()
        var out: [JournalLineLite] = []
        for line in local + server where !seen.contains(line.id) {
            seen.insert(line.id); out.append(line)
        }
        return out.sorted { $0.createdAt > $1.createdAt }
    }

    func load() async {
        loading = true
        let today = env.today
        template = nil; completed = false
        if date != today, let train, let noon = Self.noon(date, calendar: env.calendar),
           let label = Self.weekdayLabel(of: date, calendar: env.calendar) {
            if let plan = try? await train.blockPlan(), let day = plan.days.first(where: { $0.day == label }), let id = day.id {
                let title = (try? await train.todayWorkout(templateSessionId: id))?.title ?? day.type
                template = (id, title.isEmpty ? "edzés" : title)
            }
            if let history = try? await train.history(from: noon, to: noon) {
                let id = template?.id
                completed = history.contains { $0.status == .completed && $0.templateSessionId == id }
            }
        }
        serverLines = (try? await env.journalLines(on: date)) ?? []
        recompute()
        if catchUps.canClose, brief == nil { brief = try? await morning?.brief(for: date) }
        loading = false
    }

    /// The block and the lines from the ledger as it is now — again whenever the day's ledger changes (the Napló's
    /// merge landing after the sheet opened, a catch-up just saved).
    func recompute() {
        let ledger = env.ledger.ledger(for: date)
        doneSlots = Set(ledger.checkIns.map(\.slot))
        catchUps = NaploCatchUps.compute(date: date, today: env.today, now: env.clock(), checkIns: ledger.checkIns,
                                         closed: ledger.close != nil, templateDay: template, completedThatDay: completed,
                                         calendar: env.calendar)
        gymTitle = catchUps.gymTitle; gymTemplateId = catchUps.gymTemplateId
        let local = ledger.journal.compactMap { j in
            j.text.flatMap { $0.isEmpty ? nil : JournalLineLite(id: j.id, text: $0, occurredOn: date, createdAt: j.capturedAt) }
        }
        journalLines = Self.mergedLines(local: local, server: serverLines)
    }
}

/// The PÓTLÁS block: the three moments with their marks, one door per missing moment, the gym day, the close.
struct NaploCatchUpBlock: View {
    let model: NaploCatchUpModel
    let onCheckIn: (CheckInMoment) -> Void
    let onGym: () -> Void
    let onClose: () -> Void

    var body: some View {
        if !model.catchUps.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                NKMono("PÓTLÁS")
                HStack(spacing: 8) {
                    ForEach(CheckInMoment.allCases, id: \.self) { m in
                        moment(m, done: model.doneSlots.contains(m.slotId))
                    }
                }
                ForEach(model.catchUps.missingMoments, id: \.self) { m in
                    row("check-ink", "Check-in pótlása: \(m.catchUpName.lowercased(with: Locale(identifier: "hu_HU")))") { onCheckIn(m) }
                }
                if let title = model.gymTitle, model.gymTemplateId != nil {
                    row("bolt-sun", "Edzés pótlása: \(title)") { onGym() }
                }
                if model.catchUps.canClose {
                    Text("A nap még nincs lezárva.").nkFont(13).foregroundStyle(.white.opacity(0.55))
                    row("spark-cream", "Lezárom a napot") { onClose() }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        }
    }

    private func moment(_ m: CheckInMoment, done: Bool) -> some View {
        HStack(spacing: 5) {
            Text(m.catchUpName.lowercased(with: Locale(identifier: "hu_HU"))).nkFont(12.5, .medium).foregroundStyle(done ? .white : .white.opacity(0.55))
            if done { NKGlyph("check-ink", Hue.forma.glow, size: 12) } else { Text("–").nkFont(12.5).foregroundStyle(.white.opacity(0.4)) }
        }
        .padding(.horizontal, 10).frame(height: 32).background(Capsule().fill(.white.opacity(done ? 0.1 : 0.05)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(CheckinFlow.momentName(m)): \(done ? "megvolt" : "kimaradt")")
    }

    private func row(_ glyph: String, _ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                NKGlyph(glyph, .white, size: 18).frame(width: 36, height: 36).background(Circle().fill(.white.opacity(0.1)))
                Text(title).nkFont(15.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// A NAP SORAI: the day's journal lines as the owner wrote them.
struct NaploJournalLines: View {
    let lines: [JournalLineLite]

    var body: some View {
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                NKMono("A NAP SORAI")
                ForEach(lines) { line in
                    Text("„\(line.text)”").nkFont(15, design: .serif).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        }
    }
}

/// An empty day of the current week in the Napló's list: the date and one quiet line.
struct NaploEmptyDayRow: View {
    let date: String
    let today: String
    let calendar: Calendar

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(NaploDate.label(date, today: today, calendar: calendar).uppercased())
                    .nkFont(12, .medium, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.65))
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            Text("Erről a napról még nincs semmi.").nkFont(14).foregroundStyle(.white.opacity(0.55))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a napot")
    }
}

/// The gym catch-up door's sheet: the Megvolt sheet for that day's template day (`mezo-r36n9.161`).
struct NaploGymCover: View {
    let templateSessionId: UUID
    let date: String
    let title: String
    let onDone: (String?) -> Void
    @Environment(\.trainClient) private var train

    var body: some View {
        WorkoutAsPlannedSheet(templateSessionId: templateSessionId, date: date, title: title, train: train, onDone: onDone)
    }
}
