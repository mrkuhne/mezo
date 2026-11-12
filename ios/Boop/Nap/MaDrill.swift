import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The days behind a room (section 3)

/// One row of "A napok mögötte": the day's name, its value, how full its bar is (0–1), and whether it is today.
struct DrillDay: Equatable {
    let day: String, value: String, fill: Double, today: Bool
}

/// The week behind an orb, oldest first, today last. Alvás reads the deep-sleep week ("96 p"), Pulzus the resting
/// pulse ("57 bpm"); the bars are relative to the week's highest day. A missing day reads "–" with an empty bar; a
/// week with no value at all, and the other orbs, have no rows.
func drillDays(_ hue: Hue, _ brief: Brief) -> [DrillDay] {
    let week: [Int?], unit: String
    switch hue {
    case .alvas: week = brief.day.deepSleepWeek; unit = "p"
    case .pulzus: week = brief.day.restingHrWeek; unit = "bpm"
    default: return []
    }
    guard let top = week.compactMap({ $0 }).max() else { return [] }
    let names = weekdayNames(endingOn: brief.date, count: week.count)
    return week.enumerated().map { k, v in
        DrillDay(day: names[k], value: v.map { "\($0) \(unit)" } ?? "–",
                 fill: v.map { top > 0 ? Double($0) / Double(top) : 0 } ?? 0, today: k == week.count - 1)
    }
}

/// "ALVÁS · MA ÉJJEL" above the room's headline.
func drillEyebrow(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "\(hue.name) · ma éjjel"
    case .pulzus: "\(hue.name) · nyugalmi"
    default: "\(hue.name) · ma"
    }
}

/// The label of a room's week section.
func drillWeekLabel(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "MÉLYALVÁS · 7 NAP"
    case .pulzus: "NYUGALMI PULZUS · 7 NAP"
    case .forma: "AZ ENERGIÁD · MA"
    default: "A HÉT"
    }
}

enum DrillText {
    static let noWeek = "Ehhez még nem gyűjtök heti képet — hamarosan."
    static let noDays = "Ezen a héten még nincs mit sorba tennem."
    static let noEnergy = "A mai energiagörbédet még nem látom."
    static let sleepDetail = "Az éjszaka részletei"
    static let pulseDetail = "A pulzusod részletei"
}

// MARK: - The room

/// Alvás's room draws the night's hypnogram once, in section 1 (owner, 2026-11-12); the night card on the path
/// below then carries no second copy — it only speaks when there are no stages to draw.
func roomShowsHypnogram(_ sleep: Brief.Sleep) -> Bool { !sleep.hypnogram.isEmpty }

/// An orb's room (the domain drill-down): the orb's own painted head with its verdict, then 1 A szint (the level,
/// the orb's tiles, Alvás's hypnogram), 2 A hét, 3 A napok mögötte, 4 Mit tehetsz (Boop's proposal for this orb,
/// then the orb's short path with its cards). The glass back button and the swipe pop back to Ma.
struct MaDrill: View {
    let hue: Hue
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    let desk: ProposalDesk
    /// The detail sheets (the page level presents them).
    let onLink: (Brief.Link) -> Void
    @Environment(\.dismiss) private var dismiss

    private var key: MetricKey { metricKey(for: hue) }

    var body: some View {
        let c = maiCopy(brief, key)
        NKDrillPage(hue: hue, crumb: "Ma · \(hue.name)", eyebrow: drillEyebrow(hue), headline: c.headline, sentence: c.sentence,
                    level: c.score.map { Double($0) / 100 }, onBack: { dismiss() }) {
            NKDrillSection(number: 1, label: "A SZINT") { level(c) }
            NKDrillSection(number: 2, label: drillWeekLabel(hue)) { week }
            NKDrillSection(number: 3, label: "A NAPOK MÖGÖTTE") { days }
            NKDrillSection(number: 4, label: "MIT TEHETSZ") { actions }
            Color.clear.frame(height: 20)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
    }

    // MARK: 1 A szint

    @ViewBuilder private func level(_ c: MaiCopy) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(c.orbDisplay).font(.nkNumber(48)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.5)
                .fontWeight(c.orbDisplay == "–" ? .medium : nil)       // the light dash alone reads as a hairline
            if let caption = c.orbCaption { Text(caption).nkFont(14).foregroundStyle(.white.opacity(0.65)) }
        }
        .accessibilityElement(children: .combine)
        if hue == .alvas, let s = brief.day.sleep, roomShowsHypnogram(s) {
            VStack(spacing: 6) {
                Hypnogram(segments: s.hypnogram.map { (stage: $0.stage, minutes: Double($0.minutes)) }).frame(height: 100)
                HStack { Text(s.bedtime ?? "–"); Spacer(); Text(s.wakeup ?? "–") }
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.top, 4)
        }
        MaiTiles(tiles: maiTiles(key, TileInputs(brief))) { ctx.toast(soonToast("Víz +250 ml")) }
        switch hue {
        case .alvas: detailRow(DrillText.sleepDetail, .sleep)
        case .pulzus: detailRow(DrillText.pulseDetail, .heart)
        default: EmptyView()
        }
    }

    private func detailRow(_ title: String, _ link: Brief.Link) -> some View {
        Button { onLink(link) } label: {
            HStack {
                Text(title).nkFont(15, .medium).foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.top, 6).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: 2 A hét

    @ViewBuilder private var week: some View {
        switch hue {
        case .alvas, .pulzus:
            let values = hue == .alvas ? brief.day.deepSleepWeek : brief.day.restingHrWeek
            if let series = weekSeries(values) {
                WeekBars(values: series.values, average: series.average, unit: hue == .alvas ? "p" : "",
                         labels: weekLabels(endingOn: brief.date, count: values.count))
                    .frame(height: 140)
            } else {
                SheetEmptyLine(text: DrillText.noWeek)
            }
        case .forma:
            if brief.energy.hourly.count > 1 {
                GlowLine(points: brief.energy.hourly, glow: hue.glow).frame(height: 90)
                HStack { Text("06:00"); Spacer(); Text("15:00"); Spacer(); Text("24:00") }
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            } else {
                SheetEmptyLine(text: DrillText.noEnergy)
            }
        default:
            SheetEmptyLine(text: DrillText.noWeek)
        }
    }

    // MARK: 3 A napok mögötte

    @ViewBuilder private var days: some View {
        let rows = Array(drillDays(hue, brief).reversed())       // today on top
        if rows.isEmpty {
            SheetEmptyLine(text: hue == .alvas || hue == .pulzus ? DrillText.noDays : DrillText.noWeek)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { k, r in
                    HStack(spacing: 12) {
                        Text(r.day).nkFont(15, r.today ? .semibold : .regular).foregroundStyle(.white)
                        Spacer()
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.08))
                                Capsule().fill(.white.opacity(r.today ? 0.95 : 0.5)).frame(width: g.size.width * min(1, r.fill))
                            }
                        }
                        .frame(width: 70, height: 6)
                        Text(r.value).nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.8))
                            .frame(width: 74, alignment: .trailing)
                    }
                    .padding(.vertical, 11)
                    .accessibilityElement(children: .combine)
                    if k < rows.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
        }
    }

    // MARK: 4 Mit tehetsz

    private var actions: some View {
        let mine = desk.shown(brief, now: ctx.now, conflictKept: store.conflictKept).filter { proposalHue($0.proposal.kind) == hue }
        return VStack(alignment: .leading, spacing: 14) {
            if !mine.isEmpty {
                ProposalCards(items: mine, compact: true, desk: desk, brief: brief, store: store, ctx: ctx)
            }
            OrbPathCards(hue: hue, brief: brief, store: store, ctx: ctx)
        }
    }
}
