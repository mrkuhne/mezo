import SwiftUI
import BoopCore
import BoopDesign

// MARK: - An area as its own app (step 3, `mezo-r36n9.57`)

// The Élet spike worked out what each area's own page looks like (`elet-9-edzes.png`, `elet-10-alvas.png`, …):
// a photographed head with the area's verdict, its own top tabs, and under them the shared blocks — a highlight,
// a row of numbers, a curve, lists. Étel proved the frame in B4; this is the same frame for the four areas the
// brief already has data for. **Nothing here invents a number**: every value comes from the brief, the day
// ledger or the food store, exactly as the old `MaDrill` rooms read them.
//
// What an area may NOT do: grow its own block. When the kit falls short, the kit grows (BoopDesign/Napkelte),
// so the next area inherits it — that is the whole reason the frame was built before B5.

/// Which tabs an area has. Only tabs that can be filled with real data exist: a tab that would be empty is not a
/// tab, it is a promise.
enum AreaTab: String, CaseIterable {
    case ma = "Ma", het = "Hét", elozmenyek = "Előzmények"
}

func areaTabs(_ hue: Hue, brief: Brief) -> [AreaTab] {
    switch hue {
    case .alvas: [.ma, .het, .elozmenyek]
    case .pulzus: [.ma, .het, .elozmenyek]
    case .mozgas: [.ma]
    case .forma: [.ma, .het]
    case .fuel: [.ma]          // Étel has its own room (B4); never routed here
    }
}

/// The tab row an area draws. One tab is not a choice, so an area with a single tab shows none — the page is
/// simply its own content.
func areaTabRow(_ hue: Hue, brief: Brief) -> [NKAreaTab] {
    let tabs = areaTabs(hue, brief: brief)
    return tabs.count > 1 ? tabs.map { NKAreaTab($0.rawValue) } : []
}

/// The eyebrow over an area's verdict.
func areaEyebrow(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "Alvás · ma éjjel"
    case .pulzus: "Energia · ma"
    case .mozgas: "Edzés · ma"
    case .forma: "Forma · ma"
    case .fuel: "Étkezés · ma"
    }
}

/// The area's name as the owner knows it from the ring (Pulzus is **Energia**, Mozgás is **Edzés**).
func areaName(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "Alvás"
    case .pulzus: "Energia"
    case .mozgas: "Edzés"
    case .forma: "Forma"
    case .fuel: "Étel"
    }
}

/// The area's mood photo, where one exists. Alvás, Energia and Edzés have none yet (`mezo-r36n9.60`): their head
/// is the painted sky, which the B3/b rule allows — no photo is better than the wrong photo.
func areaPhoto(_ hue: Hue) -> Image? {
    hue == .forma ? NKPhoto.hegy : nil
}

// MARK: - The page

/// An area's own page: the head with its verdict, its tabs, and the blocks of the shared kit under them. The
/// back button and the swipe return to the ring (or pop the stack when Ma pushed it).
struct AreaRoom: View {
    let hue: Hue
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    let desk: ProposalDesk
    /// The detail sheets (the page level presents them).
    let onLink: (Brief.Link) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @State private var selected = AreaTab.ma.rawValue
    @State private var curveSel: UUID?

    private var key: MetricKey { metricKey(for: hue) }
    private var tab: AreaTab { AreaTab(rawValue: selected) ?? .ma }
    private var today: String { ritmus?.day(of: ctx.now) ?? brief.date }
    private var ledgerDay: DayLedger? { ritmus?.ledger.ledger(for: today) }

    var body: some View {
        let c = maiCopy(brief, key)
        NKAreaPage(hue: hue, name: areaName(hue), eyebrow: areaEyebrow(hue),
                   level: c.score.map { Double($0) / 100 }, display: c.score.map { "\($0)" },
                   headline: c.headline, sentence: c.sentence, photo: areaPhoto(hue),
                   tabs: areaTabRow(hue, brief: brief),
                   selectedTab: $selected,
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } }) {
            switch tab {
            case .ma: ma
            case .het: het
            case .elozmenyek: elozmenyek
            }
            Color.clear.frame(height: 20)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
    }

    // MARK: Ma — what this area says about today, then what he can do about it

    @ViewBuilder private var ma: some View {
        switch hue {
        case .alvas: alvasMa
        case .pulzus: energiaMa
        case .mozgas: edzesMa
        default: formaMa
        }
        NKBare("MIT TEHETSZ", hue: hue) { actions }
    }

    // MARK: Alvás

    @ViewBuilder private var alvasMa: some View {
        let s = brief.day.sleep
        NKHighlight(hue: hue, label: "az éjszaka", text: nightLine, sub: nightSub,
                    actions: [NKHighlightAction("Az éjszaka részletei") { onLink(.sleep) }])
        NKStatRow([
            NKStat(value: s.map { hoursMinutes($0.totalMin) }, label: "alvás", trend: 0, hot: true),
            NKStat(value: s?.deepMin.map { "\($0) p" }, label: "mély alvás",
                   trend: deepTrend(s?.deepMin, week: brief.day.deepSleepWeek)),
            NKStat(value: restingHr.map { "\($0)" }, unit: "bpm", label: "nyugalmi pulzus"),
        ], hue: hue)
        if let s, roomShowsHypnogram(s) {
            NKBare("AZ ÉJSZAKA MENETE", hue: hue) {
                VStack(spacing: 6) {
                    Hypnogram(segments: s.hypnogram.map { (stage: $0.stage, minutes: Double($0.minutes)) })
                        .frame(height: 110)
                    HStack { Text(s.bedtime ?? "–"); Spacer(); Text(s.wakeup ?? "–") }
                        .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    Text("A magasabb szakaszok a mély alvás.")
                        .nkFont(13).foregroundStyle(.white.opacity(0.6))
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 2)
                }
            }
        }
        if let target = brief.day.bedtimeTarget {
            NKRowList([NKAreaRow(glyph: "moon-cream", title: "Ma este", sub: brief.tonightTip,
                                 value: target, valueSub: "cél")], hue: hue)
        }
    }

    /// "7ó 12p alvás, ebből *88 p mély*" — the night in its own numbers, so the card is not the head said twice.
    private var nightLine: String {
        guard let s = brief.day.sleep else { return maiCopy(brief, .alvas).headline }
        let deep = s.deepMin.map { ", ebből *\($0) p mély*" } ?? ""
        return "\(hoursMinutes(s.totalMin)) alvás\(deep)"
    }

    private var nightSub: String {
        guard let s = brief.day.sleep, let bed = s.bedtime, let wake = s.wakeup else {
            return maiCopy(brief, .alvas).sentence
        }
        return "\(bed)-kor aludtál el, \(wake)-kor keltél. \(maiCopy(brief, .alvas).sentence)"
    }

    /// The check-in that is due now (nil = none is).
    private var checkinDue: Brief.Checkin? {
        brief.day.checkins.first { !$0.done }
    }

    private var checkinLine: String {
        checkinDue == nil ? "Ma már háromszor megkérdeztelek." : "Hogy vagy most?"
    }

    private var checkinSub: String {
        if let due = checkinDue { return "Három kérdés, fél perc — a \(due.time)-s körre." }
        return brief.day.checkins.compactMap(\.summary).last ?? maiCopy(brief, .pulzus).sentence
    }

    /// Up, flat or down against the week behind it (the same reading the tiles use).
    private func deepTrend(_ deep: Int?, week: [Int?]) -> Int {
        guard let deep, let delta = deepDelta(deep: deep, week: week) else { return 0 }
        return delta == 0 ? 0 : (delta > 0 ? 1 : -1)
    }

    private var restingHr: Int? { brief.day.restingHrWeek.last ?? nil }

    // MARK: Energia

    @ViewBuilder private var energiaMa: some View {
        NKHighlight(hue: hue, label: checkinDue == nil ? "ahogy ma érezted magad" : "kérdezek",
                    text: checkinLine, sub: checkinSub,
                    actions: checkinDue == nil
                        ? [NKHighlightAction("A pulzusod részletei", weight: .secondary) { onLink(.heart) }]
                        : [NKHighlightAction("Kitöltöm") { router?.open(.checkin) },
                           NKHighlightAction("A pulzusod részletei", weight: .link) { onLink(.heart) }])
        NKStatRow([
            NKStat(value: restingHr.map { "\($0)" }, unit: "bpm", label: "nyugalmi pulzus", hot: true),
            NKStat(value: brief.day.hrToday?.min.map { "\($0)" }, unit: "bpm", label: "mai legalacsonyabb"),
            NKStat(value: brief.day.hrToday?.max.map { "\($0)" }, unit: "bpm", label: "mai legmagasabb"),
        ], hue: hue)
        if let ritmus, let day = ledgerDay {
            NKBare("AZ ENERGIÁD MA", hue: hue) {
                MaEnergyCard(day: day, predicted: brief.date == today ? brief.energy.hourly : [], now: ctx.now,
                             calendar: ritmus.calendar, selected: $curveSel, title: "",
                             refusal: { ritmus.refusal(forCheckIn: $0, date: today) },
                             onRetry: { id in Task { await ritmus.retry([id]) } })
            }
        }
        NKRowList(checkinRows, hue: hue)
    }

    /// Today's check-ins as rows: answered ones carry the tick and their own summary, the rest open the check-in.
    private var checkinRows: [NKAreaRow] {
        var out: [NKAreaRow] = []
        let open: @MainActor @Sendable () -> Void = { [router] in router?.open(.checkin) }
        for c in brief.day.checkins {
            let name: String = CheckinDone.slotName(c.slot.rawValue)
            let sub: String = c.summary ?? (c.done ? "Kitöltve" : "Még nincs kitöltve")
            let state: NKRowState = c.done ? .done : .normal
            out.append(NKAreaRow(id: "checkin-" + c.slot.rawValue, glyph: "pen-sun", title: name, sub: sub,
                                 value: c.time, state: state, action: c.done ? nil : open))
        }
        return out
    }

    // MARK: Edzés

    @ViewBuilder private var edzesMa: some View {
        let c = maiCopy(brief, .mozgas)
        if let s = brief.day.session {
            NKHighlight(hue: hue, label: s.done ? "megvolt" : "ma", text: s.title,
                        sub: [s.time ?? s.plannedTime, s.minutes.map { "\($0) perc" },
                              s.exercises.isEmpty ? nil : "\(s.exercises.count) gyakorlat"]
                            .compactMap { $0 }.joined(separator: " · "))
        } else {
            NKHighlight(hue: hue, label: "ma", text: c.headline, sub: c.sentence)
        }
        NKStatRow([
            NKStat(value: brief.day.steps.map { huInt($0) }, unit: "lépés",
                   label: "a napi \(huInt(brief.day.stepsGoal))-ből", hot: true),
            NKStat(value: brief.day.session?.doneMinutes.map { "\($0)" } ?? brief.day.session?.minutes.map { "\($0)" },
                   unit: "perc", label: brief.day.session?.done == true ? "a mai edzés" : "a tervezett edzés"),
            NKStat(value: brief.day.activeKcal.map { huInt($0) }, unit: "kcal", label: "aktív égetés"),
        ], hue: hue)
        if let s = brief.day.session, !s.exercises.isEmpty {
            NKBare("A MAI EDZÉS", hue: hue) {
                NKRowList(s.exercises.map { e in
                    NKAreaRow(glyph: "dumbbell-ink", title: e.name, sub: "\(e.sets) sorozat",
                              state: s.done ? .done : .normal)
                }, hue: hue)
            }
        }
    }

    // MARK: Forma

    @ViewBuilder private var formaMa: some View {
        let c = maiCopy(brief, .forma)
        if let o = brief.day.observations.max(by: { $0.strength < $1.strength }) {
            let p = observationParts(o)
            NKHighlight(hue: hue, label: "amit észrevettem", text: "\(p.lead)*\(o.bold)*\(p.tail)",
                        photo: NKPhoto.hegy)
        } else {
            NKHighlight(hue: hue, label: "ma", text: c.headline, sub: c.sentence, photo: NKPhoto.hegy)
        }
        NKStatRow([
            NKStat(value: c.score.map { "\($0)" }, target: "100", label: "forma", hot: true),
            NKStat(value: brief.day.weight.map { String(format: "%.1f", $0.kg) }, unit: "kg", label: "testsúly",
                   trend: brief.day.weight.map { $0.trendKg > 0.05 ? 1 : ($0.trendKg < -0.05 ? -1 : 0) } ?? 0),
            NKStat(value: brief.nightsKnown > 0 ? "\(brief.nightsKnown)" : nil, unit: "éjszaka", label: "amit már ismerek"),
        ], hue: hue)
        NKBare("A TÖBBI TERÜLET MA", hue: hue) {
            NKRowList(otherAreas, hue: hue)
        }
    }

    /// The other four areas as rows, each with its own score — Forma is the sum of them, so this is the one place
    /// where seeing them together is the point (the ring shows them, but not next to each other).
    private var otherAreas: [NKAreaRow] {
        [Hue.alvas, .fuel, .mozgas, .pulzus].map { h in
            let c = maiCopy(brief, metricKey(for: h))
            return NKAreaRow(glyph: areaGlyph(h), title: areaName(h), sub: c.headline,
                             value: c.score.map { "\($0)" } ?? "–",
                             level: c.score.map { Double($0) / 100 },
                             action: { ctx.drill(h) })
        }
    }

    // MARK: Hét

    @ViewBuilder private var het: some View {
        switch hue {
        case .alvas:
            NKBare("MÉLYALVÁS · 7 NAP", hue: hue) { weekBars(brief.day.deepSleepWeek, unit: "p") }
        case .pulzus:
            NKBare("NYUGALMI PULZUS · 7 NAP", hue: hue) { weekBars(brief.day.restingHrWeek, unit: "bpm") }
        default:
            NKBare("A HÉT", hue: hue) {
                NKCurve(values: brief.energy.hourly, labels: ["06", "12", "18", "24"], hue: hue, height: 120)
                Text("A mai energiagörbéd, ahogy Boop előre látja.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder private func weekBars(_ values: [Int?], unit: String) -> some View {
        let labels = weekLabels(endingOn: brief.date, count: values.count)
        let bars = values.enumerated().compactMap { k, v in
            v.map { NKStepBar(label: labels.indices.contains(k) ? labels[k] : "", value: Double($0)) }
        }
        if bars.isEmpty {
            SheetEmptyLine(text: DrillText.noWeek)
        } else {
            NKSteppedBars(bars, hue: hue, current: bars.count - 1, height: 120)
            Text("Balról jobbra a hét napjai; az utolsó oszlop a mai.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                .frame(maxWidth: .infinity, alignment: .leading)
            weekNumbers(values, unit: unit)
        }
    }

    /// The three numbers a week of anything is really read by: the average, the best day and today against them.
    @ViewBuilder private func weekNumbers(_ values: [Int?], unit: String) -> some View {
        let known = values.compactMap { $0 }
        if !known.isEmpty {
            let average = Int((Double(known.reduce(0, +)) / Double(known.count)).rounded())
            let best = known.max() ?? 0
            let today = values.last ?? nil
            NKStatRow([
                NKStat(value: "\(average)", unit: unit, label: "heti átlag"),
                NKStat(value: "\(best)", unit: unit, label: "a hét legjobbja"),
                NKStat(value: today.map { "\($0)" }, unit: unit, label: "ma",
                       trend: today.map { $0 == average ? 0 : ($0 > average ? 1 : -1) } ?? 0, hot: true),
            ], hue: hue)
        }
    }

    // MARK: Előzmények

    @ViewBuilder private var elozmenyek: some View {
        let rows = Array(drillDays(hue, brief).reversed())       // today on top
        if rows.isEmpty {
            SheetEmptyLine(text: DrillText.noDays)
        } else {
            NKBare("A NAPOK MÖGÖTTE", hue: hue) {
                NKRowList(rows.map { r in
                    NKAreaRow(id: "day-\(r.day)", glyph: hue == .alvas ? "moon-cream" : "heart-ink",
                              title: r.day, value: r.value, level: r.fill, hot: r.today)
                }, hue: hue)
            }
        }
    }

    // MARK: Mit tehetsz — Boop's proposals for this area, then the area's own short path

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

/// The glyph an area wears in a list (the ring's orbs carry the colour; a row carries a line drawing).
func areaGlyph(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "moon-cream"
    case .fuel: "bowl-cream"
    case .mozgas: "dumbbell-ink"
    case .pulzus: "heart-ink"
    case .forma: "spark-cream"
    }
}
