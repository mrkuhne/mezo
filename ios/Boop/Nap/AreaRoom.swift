import SwiftUI
import BoopCore
import BoopDesign

// MARK: - An area as its own app (step 3, `mezo-r36n9.57`)

// **The build target is the Élet spike, screen by screen** — `BoopSpike/EletRooms.swift` + `EletContent.swift`,
// which the owner approved and against which he rejected this page once already. What makes an area its own app
// there is not the shared frame: it is that **each area has its own menu** — its own bottom bar, with its own
// tabs and their badges — and its own composed blocks. So:
//
//   • the tab set of every area is the spike's, name for name (Edzés's "Terv" is "Blokk", owner 2026-11-16);
//   • the blocks of every tab are the spike's, in the spike's order;
//   • what the app has no data for is **said**, not invented (`NKNotLiveYet`) — the spike was drawn with
//     made-up numbers, this page may only show his own.
//
// Nothing here computes a verdict: the brief, the day ledger and the food store already carry them.

/// The tabs of one area, exactly as the spike has them.
struct AreaTabs {
    let names: [String]
    /// Badge per tab name (0 = none).
    let badges: [String: Int]
}

/// The tab set of each area the ring opens (Étel is its own room since B4 and keeps its own).
func areaTabs(_ hue: Hue, brief: Brief) -> AreaTabs {
    switch hue {
    case .alvas:
        AreaTabs(names: ["Ma", "Hét", "Előzmények"], badges: [:])
    case .pulzus:
        AreaTabs(names: ["Ma", "Check-inek", "Minták"],
                 badges: ["Ma": brief.day.checkins.contains { !$0.done } ? 1 : 0])
    case .mozgas:
        // Edzés has its own room (B5) and its tab labels live in `EdzesTab`, once: „Terv" became **„Blokk"**
        // (owner, 2026-11-16) and a further rename stays a one-line change.
        AreaTabs(names: EdzesTab.allCases.map(\.rawValue),
                 badges: [EdzesTab.ma.rawValue: (brief.day.session != nil && brief.day.session?.done != true) ? 1 : 0])
    case .forma:
        AreaTabs(names: ["Ma", "Mi hat rá"], badges: [:])
    case .fuel:
        AreaTabs(names: ["Ma", "Receptek", "Kamra", "Hét"], badges: [:])
    // The two areas the spike drew but no data exists for yet (L1/L4). Their tab set is the spike's, so the
    // page he approved is there — each tab says what will be in it instead of showing an invented number.
    case .penz:
        AreaTabs(names: ["Ma", "Pénzem", "Költés", "Gyakorlás"], badges: [:])
    case .level:
        AreaTabs(names: ["Ma", "Figyelt", "Szabályok", "Fiókok"], badges: [:])
    case .suly:
        AreaTabs(names: ["Ma", "Test", "Napló"], badges: [:])
    case .sport:
        AreaTabs(names: ["Ma", "Hét", "Napló", "Beosztás"], badges: [:])
    }
}

/// The eyebrow over an area's verdict: the area and the tab he is on, the way the spike writes it.
func areaEyebrow(_ hue: Hue, tab: String) -> String { "\(areaName(hue)) · \(tab)" }

/// The area's name as the owner knows it from the ring (Pulzus is **Energia**, Mozgás is **Edzés**).
func areaName(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "Alvás"
    case .pulzus: "Energia"
    case .mozgas: "Edzés"
    case .forma: "Forma"
    case .fuel: "Étel"
    case .penz: "Pénz"
    case .level: "Levél"
    case .suly: "Súly"
    case .sport: "Sport"
    }
}

/// The glyph an area wears in its own eyebrow and in a list.
func areaGlyph(_ hue: Hue) -> String {
    switch hue {
    case .alvas: "moon-cream"
    case .fuel: "bowl-cream"
    case .mozgas: "dumbbell-ink"
    case .pulzus: "heart-cream"
    case .forma: "spark-cream"
    case .penz: "e-penz"
    case .level: "e-level"
    case .suly: "scale-ink"
    case .sport: "ball-sun"
    }
}

/// The area's mood photo, where one exists. Alvás, Energia and Edzés have none yet (`mezo-r36n9.60`): their head
/// is the painted sky, which the B3/b rule allows — no photo is better than the wrong photo.
func areaPhoto(_ hue: Hue) -> Image? { hue == .forma ? NKPhoto.hegy : nil }

/// The "hogyan működik" sheet an area page can open.
struct AreaInfo: Identifiable {
    let id = UUID()
    let title: String, body: String
}

// MARK: - The page

/// An area's own page: the head with its verdict, **its own bottom bar**, and the spike's blocks under it.
struct AreaRoom: View {
    let hue: Hue
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    let desk: ProposalDesk
    let onLink: (Brief.Link) -> Void
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openPlace) private var openPlace
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    @State private var selected = "Ma"
    @State private var curveSel: UUID?
    @State private var info: AreaInfo?

    private var key: MetricKey { metricKey(for: hue) }
    private var tabs: AreaTabs { areaTabs(hue, brief: brief) }
    private var today: String { ritmus?.day(of: ctx.now) ?? brief.date }
    private var ledgerDay: DayLedger? { ritmus?.ledger.ledger(for: today) }

    /// The head's words. The five metric areas read them from the brief; Pénz and Levél have no metric, so they
    /// say plainly where they are.
    private var head: (score: Int?, headline: String, sentence: String) {
        switch hue {
        case .penz:
            (nil, "A pénzed még nem él",
             "Ez a terület a keretedet, a költéseidet és a befektetéseidet fogja mutatni. Előbb a banki adatok kellenek hozzá.")
        default:
            { let c = maiCopy(brief, key); return (c.score, c.headline, c.sentence) }()
        }
    }

    var body: some View {
        let c = head
        NKAreaPage(hue: hue, name: areaName(hue), eyebrow: areaEyebrow(hue, tab: selected),
                   level: c.score.map { Double($0) / 100 }, display: c.score.map { "\($0)" },
                   headline: c.headline, sentence: c.sentence, photo: areaPhoto(hue), glyph: areaGlyph(hue),
                   tabs: tabs.names.map { NKAreaTab($0, badge: tabs.badges[$0] ?? 0) },
                   selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "search-ink", label: "Keresés") { ctx.toast(soonToast("Keresés · \(areaName(hue))")) },
                             NKAreaAction(glyph: "repeat-deep", label: "Beállítások") { ctx.toast(soonToast("\(areaName(hue)) beállításai")) }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openPlace(.boop) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .sheet(item: $info) { i in
            NKSheetFrame(hue: hue, eyebrow: areaName(hue), title: i.title) {
                Text(i.body).nkFont(15).lineSpacing(5).foregroundStyle(.white.opacity(0.85))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(20).nkGlass()
            }
            .presentationDetents([.medium])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder private var content: some View {
        switch (hue, selected) {
        case (.alvas, "Ma"): alvasMa
        case (.alvas, "Hét"): alvasHet
        case (.alvas, _): alvasElozmenyek

        case (.pulzus, "Ma"): energiaMa
        case (.pulzus, "Check-inek"): energiaCheckinek
        case (.pulzus, _): energiaMintak

        case (.forma, "Ma"): formaMa
        case (.forma, _): formaMiHatRa

        case (.penz, _): plannedTab
        default: formaMiHatRa
        }
        if hue != .penz {
            NKBare("MIT TEHETSZ", hue: hue) { actions }
        }
    }

    // MARK: - Alvás

    @ViewBuilder private var alvasMa: some View {
        let s = brief.day.sleep
        NKHighlight(hue: hue, label: "az éjszaka", text: maiCopy(brief, .alvas).headline, sub: nightSub,
                    actions: [NKHighlightAction("Az éjszaka részletei") { onLink(.sleep) }])
        NKStatRow([
            NKStat(value: s.map { hoursMinutes($0.totalMin) }, label: "alvás", hot: true),
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
        NKBare("AZ ALVÁS TERÜLET", hue: hue) { alvasMenu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az alvásodról") { openPlace(.boop) }
    }

    private var alvasMenu: some View {
        let bedtime: String = ctx.reminder.isOn ? "Emlékeztető \(ctx.reminder.time ?? "")-kor" : "Emlékeztető kikapcsolva"
        return NKMenuGrid([
            NKMenuItem(glyph: "bell-cream", name: "Lefekvés", sub: bedtime) { ctx.toggleReminder() },
            NKMenuItem(glyph: "chart-deep", name: "Előzmények", sub: "A hét napjai") { selected = "Előzmények" },
            NKMenuItem(glyph: "heart-cream", name: "Pulzus", sub: "Nyugalmi és napi pulzus") { ctx.drill(.pulzus) },
            NKMenuItem(glyph: "moon-cream", name: "Mi hat rá", sub: "Amit a számaidban látok") { selected = "Hét" },
        ], hue: hue)
    }

    @ViewBuilder private var alvasHet: some View {
        NKBare("MÉLYALVÁS · 7 NAP", hue: hue) { weekBars(brief.day.deepSleepWeek, unit: "p") }
        if !brief.day.observations.isEmpty {
            NKBare("AMI HATOTT RÁ", hue: hue) { NKList(observationItems, hue: hue) }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot, mitől alszol jobban") { openPlace(.boop) }
    }

    @ViewBuilder private var alvasElozmenyek: some View {
        daysBehind
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a hosszú távú alvásodról") { openPlace(.boop) }
    }

    private var nightSub: String {
        guard let s = brief.day.sleep else { return maiCopy(brief, .alvas).sentence }
        let deep: String = s.deepMin.map { ", ebből *\($0) perc mély*" } ?? ""
        let bed: String = s.bedtime.map { ". \($0)-kor aludtál el" } ?? ""
        return "\(hoursMinutes(s.totalMin))\(deep)\(bed). \(maiCopy(brief, .alvas).sentence)"
    }

    private func deepTrend(_ deep: Int?, week: [Int?]) -> Int {
        guard let deep, let delta = deepDelta(deep: deep, week: week) else { return 0 }
        return delta == 0 ? 0 : (delta > 0 ? 1 : -1)
    }

    private var restingHr: Int? { brief.day.restingHrWeek.last ?? nil }

    // MARK: - Energia

    @ViewBuilder private var energiaMa: some View {
        NKHighlight(hue: hue, label: checkinDue == nil ? "ahogy ma érezted magad" : "kérdezek",
                    text: checkinLine, sub: checkinSub,
                    actions: checkinDue == nil
                        ? [NKHighlightAction("A pulzusod részletei", weight: .secondary) { onLink(.heart) }]
                        : [NKHighlightAction("Kitöltöm") { router?.open(.checkin) },
                           NKHighlightAction("A pulzusod részletei", weight: .link) { onLink(.heart) }])
        NKStatRow(energiaStats, hue: hue)
        if let ritmus, let day = ledgerDay {
            NKBare("A NAP ENERGIÁJA", hue: hue) {
                MaEnergyCard(day: day, predicted: brief.date == today ? brief.energy.hourly : [], now: ctx.now,
                             calendar: ritmus.calendar, selected: $curveSel, title: "",
                             refusal: { ritmus.refusal(forCheckIn: $0, date: today) },
                             onRetry: { id in Task { await ritmus.retry([id]) } })
            }
        }
        if !calendarCells.isEmpty {
            NKBare("A NAPTÁRAD SŰRŰSÉGE", hue: hue) {
                NKHeatStrip(cells: calendarCells, hue: hue)
                Text(calendarNote).nkFont(13).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        NKBare("AZ ENERGIA TERÜLET", hue: hue) { energiaMenu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a közérzetedről") { openPlace(.boop) }
    }

    private var energiaMenu: some View {
        let open: @MainActor @Sendable () -> Void = { [router] in router?.open(.checkin) }
        return NKMenuGrid([
            NKMenuItem(glyph: "pen-sun", name: "Check-in", sub: "Három kérdés, fél perc",
                       badge: checkinDue == nil ? 0 : 1, action: open),
            NKMenuItem(glyph: "chart-deep", name: "Check-inek", sub: "A mai körök") { selected = "Check-inek" },
            NKMenuItem(glyph: "spark-cream", name: "Minták", sub: "Amit a számaidban látok") { selected = "Minták" },
            NKMenuItem(glyph: "heart-cream", name: "Pulzus", sub: "A nap pulzusa") { onLink(.heart) },
        ], hue: hue)
    }

    @ViewBuilder private var energiaCheckinek: some View {
        NKBare("A MAI KÖRÖK", hue: hue) { NKRowList(checkinRows, hue: hue) }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az energiádról") { openPlace(.boop) }
    }

    @ViewBuilder private var energiaMintak: some View {
        if brief.day.observations.isEmpty {
            NKNotLiveYet(hue: hue, title: "Még nincs mintám rólad",
                         line: "Ehhez több hét check-in és alvás kell. Amint összeáll egy összefüggés, itt lesz.")
        } else {
            NKBare("AMIT ÉSZREVETTEM", hue: hue) { NKList(observationItems, hue: hue) }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a mintáidról") { openPlace(.boop) }
    }

    private var energiaStats: [NKStat] {
        if let v = ledgerDay?.checkIns.last?.values, !v.isEmpty {
            return [
                NKStat(value: v["energy"].map { "\($0)" }, unit: "/10", label: "energia"),
                NKStat(value: v["mood"].map { "\($0)" }, unit: "/10", label: "hangulat"),
                NKStat(value: v["stress"].map { "\($0)" }, unit: "/10", label: "feszültség", hot: true),
            ]
        }
        return [
            NKStat(value: restingHr.map { "\($0)" }, unit: "bpm", label: "nyugalmi pulzus", hot: true),
            NKStat(value: brief.day.hrToday?.min.map { "\($0)" }, unit: "bpm", label: "mai legalacsonyabb"),
            NKStat(value: brief.day.hrToday?.max.map { "\($0)" }, unit: "bpm", label: "mai legmagasabb"),
        ]
    }

    /// The calendar's quarter hours folded into one cell per hour (08:00–20:00) — how full each hour is.
    private var calendarCells: [(String, Double)] {
        let slots = brief.day.calendar.busySlots
        guard slots.contains(true) else { return [] }
        var out: [(String, Double)] = []
        var i = 0
        while i < min(72, slots.count) {
            let hour = 6 + i / 4
            if (8...20).contains(hour) {
                let part = slots[i..<min(i + 4, slots.count)].filter { $0 }.count
                out.append(("\(hour)", Double(part) / 4))
            }
            i += 4
        }
        return out
    }

    private var calendarNote: String {
        "\(brief.day.calendar.count) esemény a mai napodban. A sötétebb óra a sűrűbb."
    }

    private var checkinDue: Brief.Checkin? { brief.day.checkins.first { !$0.done } }

    private var checkinLine: String {
        checkinDue == nil ? "Ma már minden kört kitöltöttél." : "Hogy vagy most?"
    }

    private var checkinSub: String {
        if let due = checkinDue { return "Három kérdés, fél perc — a \(due.time)-s körre." }
        return brief.day.checkins.compactMap(\.summary).last ?? maiCopy(brief, .pulzus).sentence
    }

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

    // MARK: - Edzés
    //
    // Edzés is **not** served by this page any more: it has its own room (`ios/Boop/Edzes/EdzesRoom.swift`, B5),
    // branched beside Étel's in `NapView`, because it has its own data — the engine's per-set targets, its own
    // reasoning, the week's finished days. Its blocks lived here until 2026-11-16; keeping a second copy would
    // have left two Edzés pages, and a later reader editing the dead one. Its tab labels are still shared, from
    // `EdzesTab` above.

    // MARK: - Forma

    @ViewBuilder private var formaMa: some View {
        let c = maiCopy(brief, .forma)
        if let o = brief.day.observations.max(by: { $0.strength < $1.strength }) {
            let p = observationParts(o)
            NKHighlight(hue: hue, label: "amit észrevettem", text: "\(p.lead)*\(o.bold)*\(p.tail)", photo: NKPhoto.hegy)
        } else {
            NKHighlight(hue: hue, label: "a mai formád", text: c.headline, sub: c.sentence, photo: NKPhoto.hegy)
        }
        NKStatRow([
            NKStat(value: c.score.map { "\($0)" }, target: "100", label: "ma", hot: true),
            NKStat(value: brief.day.weight.map { String(format: "%.1f", $0.kg) }, unit: "kg", label: "testsúly",
                   trend: brief.day.weight.map { $0.trendKg > 0.05 ? 1 : ($0.trendKg < -0.05 ? -1 : 0) } ?? 0),
            NKStat(value: brief.nightsKnown > 0 ? "\(brief.nightsKnown)" : nil, unit: "éjszaka", label: "amit már ismerek"),
        ], hue: hue)
        NKBare("MI HAT RÁ MA", hue: hue) { NKRowList(otherAreas, hue: hue) }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a formádról") { openPlace(.boop) }
    }

    @ViewBuilder private var formaMiHatRa: some View {
        NKBare("A NAP ENERGIÁJA", hue: hue) {
            NKCurve(values: brief.energy.hourly, labels: ["06", "09", "12", "15", "18", "21", "24"], hue: hue, height: 120)
            Text("Ahogy Boop a mai napodat előre látja.")
                .nkFont(13).foregroundStyle(.white.opacity(0.6))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        if !brief.day.observations.isEmpty {
            NKBare("AMIT ÉSZREVETTEM", hue: hue) { NKList(observationItems, hue: hue) }
        }
        NKInfoRow("Hogyan számolom a Formát?", hue: hue) {
            info = AreaInfo(title: "Hogyan számolom a Formát?",
                            body: "A Forma nem orvosi mérőszám, hanem a saját előzményeidhez méri, mire vagy ma képes: az alvásodból, a nyugalmi pulzusodból és annak változékonyságából, az elmúlt napok terheléséből és abból, amit a check-inekben mondasz. Ezért mozdul el egy rossz éjszaka után, és ezért nem hasonlítható össze a másokéval.")
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot, mi befolyásolja") { openPlace(.boop) }
    }

    /// The other four areas as rows, each with its own score — Forma is the sum of them, so this is the one place
    /// where seeing them together is the point.
    private var otherAreas: [NKAreaRow] {
        [Hue.alvas, .fuel, .mozgas, .pulzus].map { h in
            let c = maiCopy(brief, metricKey(for: h))
            return NKAreaRow(glyph: areaGlyph(h), title: areaName(h), sub: c.headline,
                             value: c.score.map { "\($0)" } ?? "–",
                             level: c.score.map { Double($0) / 100 },
                             action: { ctx.drill(h) })
        }
    }

    // MARK: - The planned areas (Pénz, Levél)

    /// Each tab of a planned area says what will be in it, in his words, and nothing else. No invented number
    /// ever reaches this page — the spike's figures were drawn, not measured.
    @ViewBuilder private var plannedTab: some View {
        let t = plannedText
        NKNotLiveYet(hue: hue, title: t.title, line: t.line)
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a pénzedről") { openPlace(.boop) }
    }

    private var plannedText: (title: String, line: String) {
        switch (hue, selected) {
        case (.penz, "Ma"):
            ("Mi a dolgod ma a pénzeddel", "A heti kereted, a hónap állása és minden, ami lejár. A bank összekötése után él.")
        case (.penz, "Pénzem"):
            ("Ami a pénzedből van", "A három rekesz — a biztonsági tartalék, a középtáv és a hosszú táv — és hogy melyik hol tart.")
        case (.penz, "Költés"):
            ("Mire megy el", "A mai tételek, a heti keret és az, hogy belefér-e, amit épp vennél.")
        case (.penz, _):
            ("Gyakorlás", "Játékpénzes kereskedés, hogy a sajátod előtt gyakorolhass. A pénz-szakasszal jön.")
        default:
            ("", "")
        }
    }

    // MARK: - Shared blocks

    /// Today's observations as a titled list (the spike's `.list`): the bold phrase is the title, the sentence
    /// around it is the body.
    private var observationItems: [(title: String, body: String)] {
        brief.day.observations.map { o in
            let p = observationParts(o)
            return (title: o.bold, body: "\(p.lead)\(o.bold)\(p.tail)")
        }
    }

    @ViewBuilder private var daysBehind: some View {
        let rows = Array(drillDays(hue, brief).reversed())       // today on top
        if rows.isEmpty {
            NKNotLiveYet(hue: hue, title: "Még nincs mit sorba tennem",
                         line: "Néhány nap adat után itt sorakoznak a napjaid, a legfrissebb elöl.")
        } else {
            NKBare("A NAPOK MÖGÖTTE", hue: hue) {
                NKRowList(rows.map { r in
                    NKAreaRow(id: "day-\(r.day)", glyph: areaGlyph(hue), title: r.day, value: r.value,
                              level: r.fill, hot: r.today)
                }, hue: hue)
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

    // MARK: - Mit tehetsz — Boop's proposals for this area, then the area's own short path

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
