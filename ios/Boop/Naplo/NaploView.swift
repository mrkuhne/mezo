import SwiftUI
import BoopCore
import BoopDesign

/// Napló (spec §7.7): "Napok" — the last 14 days as glass rows, newest first; a day with nothing is simply absent.
/// Tap a day for its summary and energy curve. "Minták" stays a placeholder until Boop's patterns exist (B8).
struct NaploView: View {
    @Environment(RitmusEnvironment.self) private var env: RitmusEnvironment?
    @State private var open: OpenDay?

    private struct OpenDay: Identifiable { let id: String }

    var body: some View {
        PlacePage(hue: .alvas, title: "Napló", line: "Amit a napjaidból tanulunk") {
            if let env { days(env) } else { empty }
            VStack(alignment: .leading, spacing: 10) {
                NKMono("MINTÁK")
                Text("Amint elég napod összegyűlik, itt látod, mi hat mire.").nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        }
        // The daily loop arrives a moment after the first frame: the task starts again when it does.
        .task(id: env.map(ObjectIdentifier.init)) {
            await env?.refreshNaplo()
            #if DEBUG
            // Simulator review: `-previewOpen naploDay` opens yesterday's day.
            if UserDefaults.standard.string(forKey: "previewOpen") == "naploDay", let env, open == nil,
               let y = env.calendar.date(byAdding: .day, value: -1, to: env.clock()) { open = OpenDay(id: env.day(of: y)) }
            #endif
        }
        .sheet(item: $open) { day in
            if let env {
                NaploDayDetail(env: env, date: day.id)
                    .presentationDetents([.large])
                    .presentationBackground(NK.ground)
                    .presentationCornerRadius(34)
                    .presentationDragIndicator(.visible)
            }
        }
    }

    @ViewBuilder private func days(_ env: RitmusEnvironment) -> some View {
        let range = NaploDays.range(endingOn: env.today)
        let (closes, checkIns) = NaploDays.sources(from: NaploDays.days(from: range.from, to: range.to).map { env.ledger.ledger(for: $0) })
        let rows = NaploDays.rows(closes: closes, checkIns: checkIns, from: range.from, to: range.to)
        if rows.isEmpty {
            empty
        } else {
            VStack(alignment: .leading, spacing: 12) {
                NKMono("A NAPOK").padding(.leading, 4)
                ForEach(rows) { row in
                    Button { open = OpenDay(id: row.date) } label: { NaploDayRowView(row: row, today: env.today, calendar: env.calendar) }
                        .buttonStyle(PressStyle())
                }
            }
        }
    }

    private var empty: some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("A NAPOK")
            Text("A napjaid és Boop következtetései hamarosan itt gyűlnek.").nkFont(19, design: .serif).lineSpacing(3).foregroundStyle(.white)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}

/// "Szerda · nov. 12." for a `yyyy-MM-dd` date; today and yesterday say so.
enum NaploDate {
    static func label(_ date: String, today: String, calendar: Calendar) -> String {
        let p = date.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let d = calendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) else { return date }
        let f = DateFormatter()
        f.calendar = calendar; f.timeZone = calendar.timeZone; f.locale = Locale(identifier: "hu_HU")
        f.dateFormat = "EEEE · MMM d."
        let base = f.string(from: d)
        let days = NaploDays.days(from: min(date, today), to: max(date, today)).count - 1
        switch (date <= today, days) {
        case (true, 0): return "Ma · \(base)"
        case (true, 1): return "Tegnap · \(base)"
        default: return base
        }
    }
}

private struct NaploDayRowView: View {
    let row: NaploDayRow
    let today: String
    let calendar: Calendar

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(NaploDate.label(row.date, today: today, calendar: calendar).uppercased())
                    .nkFont(12, .medium, design: .monospaced).tracking(1.2).foregroundStyle(.white.opacity(0.65))
                Spacer(minLength: 8)
                if row.pending {
                    NKGlyph("offline", .white.opacity(0.6), size: 14)
                }
                if let word = row.ratingWord {
                    Text(word).nkFont(15, .medium).foregroundStyle(.white)
                }
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
            }
            if let goal = row.goalText {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(goal).nkFont(17, design: .serif).foregroundStyle(.white).lineLimit(2)
                    Spacer(minLength: 8)
                    if let outcome = row.goalOutcomeLabel {
                        Text(outcome).nkFont(13).foregroundStyle(.white.opacity(0.6))
                    }
                }
            }
            if !row.points.isEmpty {
                MiniEnergyLine(points: row.points, calendar: calendar).frame(height: 34)
            }
            if let line = row.journalLine {
                Text("„\(line)”").nkFont(14, design: .serif).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Megnyitja a napot")
    }
}

/// The day's energy answers as a small line with dots, on the energy curve's own geometry (06:00 → 24:00).
private struct MiniEnergyLine: View {
    let points: [CurvePoint]
    let calendar: Calendar

    var body: some View {
        GeometryReader { g in
            let pts = points.map { p in
                CGPoint(x: EnergyCurveGeometry.x(hour: EnergyCurveGeometry.hour(of: p.capturedAt, calendar: calendar), width: g.size.width),
                        y: 4 + (g.size.height - 8) * (1 - CGFloat(min(10, max(0, p.energy))) / 10))
            }
            ZStack {
                if pts.count > 1 {
                    Path { path in path.move(to: pts[0]); for q in pts.dropFirst() { path.addLine(to: q) } }
                        .stroke(.white.opacity(0.8), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                }
                ForEach(pts.indices, id: \.self) { i in
                    Circle().fill(points[i].pending ? Color.clear : Color.white)
                        .overlay { if points[i].pending { Circle().stroke(.white.opacity(0.8), style: StrokeStyle(lineWidth: 1.2, dash: [2, 2])) } }
                        .frame(width: 7, height: 7).position(pts[i])
                }
            }
        }
        .accessibilityHidden(true)
    }
}

/// One past day (spec §7.7): its "A MAI NAPOD" summary and the energy curve card, as the phone has them.
struct NaploDayDetail: View {
    let env: RitmusEnvironment
    let date: String
    @State private var selected: UUID?

    var body: some View {
        let day = env.ledger.ledger(for: date)
        ScrollView {
            VStack(spacing: 12) {
                Text(NaploDate.label(date, today: env.today, calendar: env.calendar))
                    .nkFont(30, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).padding(.vertical, 14)
                if let close = day.close {
                    ClosedDayCard(rows: EsteFlow.summaryRows(for: close), quote: EsteFlow.quote(for: close, in: day, voiceFailed: false))
                }
                if !day.curvePoints.isEmpty {
                    MaEnergyCard(day: day, predicted: [], now: nil,
                                 calendar: env.calendar, selected: $selected, title: "AZ ENERGIÁD")
                }
            }
            .padding(.horizontal, 16).padding(.top, 20).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .background(NKGround(hue: .alvas))
        .preferredColorScheme(.dark)
    }
}
