import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Edzés room (B5)

// **The page is the shared area-page kit's, not ours** (`NKAreaPage`, step 3 of the shell programme): the head,
// the area's own bottom bar and its tabs all come from the kit, and this file only composes the blocks inside
// them. The frame, the tab set, the badge and the way out are exactly what `AreaRoom` gave Edzés before this
// file existed — the owner has already seen that page, and nothing on it may move.
//
// What this file adds is the **data only the training API has**, which the morning brief does not carry: the real
// warmup/working split with the engine's per-set targets, its own Hungarian reasoning per exercise
// („Az eligazítás"), and which days of this week are finished.
//
// Two rules hold every line here:
//   • **No invented number.** Where the server said nothing, the screen says so (`NKNoFreshData`), and a cached
//     answer always carries its age. There is no 0 standing in for "we do not know".
//   • **Nothing explains itself twice.** The engine's own sentence is shown verbatim; this file writes no
//     reasoning of its own, and anything worth saying on Ma goes through the wall's `WallSource`, not onto a
//     second card surface here.

/// Which tab of the room is open. The labels are the owner's (`Terv` became **`Blokk`** on 2026-11-16) and they
/// live **here, once**: `AreaRoom`'s tab set reads the same constants, so a rename is one line.
enum EdzesTab: String, CaseIterable {
    case ma = "Ma", blokk = "Blokk", gyakorlatok = "Gyakorlatok", elozmenyek = "Előzmények"
}

/// Edzés as its own app, the way Étel is: its own data, on the shared page.
struct EdzesRoom: View {
    @Environment(\.dismiss) private var dismiss
    /// Set when the home screen's ring opened this room with no navigation stack around it.
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openPlace) private var openPlace
    @Environment(\.trainClient) private var train
    @Environment(\.serverCache) private var cache
    @Environment(MorningStore.self) private var morning: MorningStore?
    @SceneStorage("edzes.tab") private var selected: String = EdzesTab.ma.rawValue
    @State private var store: EdzesStore?
    @State private var toast: String?

    init(tab: EdzesTab = .ma) {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "edzesTab").flatMap(EdzesTab.init(rawValue:))
        _selected = SceneStorage(wrappedValue: (preview ?? tab).rawValue, "edzes.tab")
        #else
        _selected = SceneStorage(wrappedValue: tab.rawValue, "edzes.tab")
        #endif
    }

    private let hue = Hue.mozgas
    private var brief: Brief? { morning?.brief }
    private var workout: TodayWorkout? { store?.today?.value }

    var body: some View {
        let c = brief.map { maiCopy($0, .mozgas) }
        NKAreaPage(hue: hue, name: areaName(hue), eyebrow: areaEyebrow(hue, tab: selected),
                   level: c?.score.map { Double($0) / 100 }, display: c?.score.map { "\($0)" },
                   headline: c?.headline ?? "Még gyűjtöm a mai képet",
                   sentence: c?.sentence ?? "Amint megvan a mai terved, itt fog állni.",
                   photo: areaPhoto(hue), glyph: areaGlyph(hue),
                   tabs: tabs, selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "search-ink", label: "Keresés") { toast = soonToast("Keresés · Edzés") },
                             NKAreaAction(glyph: "repeat-deep", label: "Beállítások") { toast = soonToast("Edzés beállításai") }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openPlace(.boop) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        .task {
            if store == nil { store = EdzesStore(client: train, cache: cache) }
            await store?.load()
        }
    }

    /// The tab set and the badge are the page's own, unchanged: a session planned for today and not yet done is
    /// the one thing the bar marks.
    private var tabs: [NKAreaTab] {
        let pending = (brief?.day.session != nil && brief?.day.session?.done != true) ? 1 : 0
        return EdzesTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .ma ? pending : 0) }
    }

    @ViewBuilder private var content: some View {
        switch EdzesTab(rawValue: selected) ?? .ma {
        case .ma: ma
        case .blokk: blokk
        case .gyakorlatok: gyakorlatok
        case .elozmenyek: elozmenyek
        }
    }

    // MARK: - Ma

    @ViewBuilder private var ma: some View {
        highlight
        stats
        exercises
        briefing
        week
        NKBare("AZ EDZÉS TERÜLET", hue: hue) { menu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a mai edzésről") { openPlace(.boop) }
    }

    /// Today's session in a sentence. The brief's own title and time stay the source — it is what the rest of the
    /// app says about today — and the training read only adds what it alone knows (the real exercise count).
    @ViewBuilder private var highlight: some View {
        if let s = brief?.day.session {
            NKHighlight(hue: hue, label: s.done ? "megvolt" : "ma", text: s.title,
                        sub: [s.time ?? s.plannedTime, s.minutes.map { "\($0) perc" },
                              exerciseCount.map { "\($0) gyakorlat" }]
                            .compactMap { $0 }.joined(separator: " · "))
        } else if let w = workout, !w.isRestDay, let title = w.title {
            // The brief has no session but the training plan does (a day started across midnight, or a brief
            // that has not caught up): the plan is the honest thing to show.
            NKHighlight(hue: hue, label: "ma", text: title,
                        sub: [w.dayLabel, w.durationEst.map { "\($0) perc" },
                              exerciseCount.map { "\($0) gyakorlat" }]
                            .compactMap { $0 }.joined(separator: " · "))
        } else if let w = workout, w.isRestDay {
            NKHighlight(hue: hue, label: "ma", text: "Ma nincs edzés",
                        sub: "A blokkod szerint ez pihenőnap.")
        } else if let c = brief.map({ maiCopy($0, .mozgas) }) {
            NKHighlight(hue: hue, label: "ma", text: c.headline, sub: c.sentence)
        }
    }

    /// The exercise count is the training read's where it has one, else the brief's — never a 0 from an empty list.
    private var exerciseCount: Int? {
        if let w = workout, !w.exercises.isEmpty { return w.exercises.count }
        if let e = brief?.day.session?.exercises, !e.isEmpty { return e.count }
        return nil
    }

    /// The three numbers of the day, unchanged from the page the owner has seen — plus the age of the plan on the
    /// training one when it came from the cache.
    @ViewBuilder private var stats: some View {
        if let b = brief {
            NKStatRow([
                NKStat(value: b.day.steps.map { huInt($0) }, unit: "lépés",
                       label: "a napi \(huInt(b.day.stepsGoal))-ből", hot: true),
                NKStat(value: b.day.session?.doneMinutes.map { "\($0)" } ?? plannedMinutes,
                       unit: "perc", label: b.day.session?.done == true ? "a mai edzés" : "a tervezett edzés",
                       age: store?.ageText),
                NKStat(value: b.day.activeKcal.map { huInt($0) }, unit: "kcal", label: "aktív égetés"),
            ], hue: hue)
        }
    }

    private var plannedMinutes: String? {
        brief?.day.session?.minutes.map { "\($0)" } ?? workout?.durationEst.map { "\($0)" }
    }

    /// The session's exercises. With the engine on, each row carries its real set split and the weight it asks
    /// for; with the engine off there are only counts, and the row says just that. A row never shows a weight the
    /// server did not prescribe.
    @ViewBuilder private var exercises: some View {
        if let w = workout, !w.exercises.isEmpty {
            NKBare("A MAI EDZÉS", hue: hue, trailing: store?.ageText) {
                NKRowList(w.exercises.map { e in
                    NKAreaRow(id: e.id.uuidString, glyph: "dumbbell-ink", title: e.name,
                              sub: setsLine(e), value: targetLine(e) ?? "", valueSub: targetSub(e) ?? "",
                              state: isDone(e) ? .done : .normal,
                              chips: e.warning.map { [$0] } ?? [],
                              terms: [e.muscle])
                }, hue: hue)
            }
        } else if let e = brief?.day.session?.exercises, !e.isEmpty {
            // Offline with no cache: the brief still knows the names and the set counts, so they are shown and
            // the block says the detailed plan is not here.
            NKBare("A MAI EDZÉS", hue: hue, trailing: store?.ageText) {
                NKRowList(e.map { x in
                    NKAreaRow(glyph: "dumbbell-ink", title: x.name, sub: "\(x.sets) sorozat",
                              state: brief?.day.session?.done == true ? .done : .normal)
                }, hue: hue)
            }
        } else if store?.problem != nil {
            NKBare("A MAI EDZÉS", hue: hue) { NKNoFreshData("A mai edzésterved most nem érem el") }
        }
    }

    /// „2 bemelegítő · 3 sorozat · 6–10 ismétlés" — the real split, from the server's own per-set list.
    private func setsLine(_ e: PlannedExercise) -> String {
        let warmups = e.sets.filter { $0.kind == .warmup }.count
        let working = e.sets.filter { $0.kind == .working }.count
        var parts: [String] = []
        if warmups > 0 { parts.append("\(warmups) bemelegítő") }
        parts.append("\(working > 0 ? working : e.workingCount) sorozat")
        parts.append(e.repMin == e.repMax ? "\(e.repMin) ismétlés" : "\(e.repMin)–\(e.repMax) ismétlés")
        return parts.joined(separator: " · ")
    }

    /// The weight the first working set asks for — **only** when the server prescribed one.
    private func targetLine(_ e: PlannedExercise) -> String? {
        guard let kg = e.sets.first(where: { $0.kind == .working })?.targetKg else { return nil }
        return nkKg(kg)
    }

    private func targetSub(_ e: PlannedExercise) -> String? {
        guard targetLine(e) != nil, let reps = e.sets.first(where: { $0.kind == .working })?.targetReps
        else { return nil }
        return "× \(reps)"
    }

    /// Done means the server has a logged set for it in the open or finished workout — not that the day is over.
    private func isDone(_ e: PlannedExercise) -> Bool {
        let sets = (workout?.open?.sets ?? []) + (workout?.completed?.sets ?? [])
        return sets.contains { $0.exerciseId == e.id && !$0.skipped }
    }

    /// **Az eligazítás** — what the engine changed for today and why, in its own words. Every line is the
    /// server's `rationale`; nothing is written here, and when the engine is off the block is simply absent.
    @ViewBuilder private var briefing: some View {
        let lines = (workout?.exercises ?? []).compactMap { e -> (title: String, body: String)? in
            guard let r = e.rationale ?? e.progression?.rationale, !r.isEmpty else { return nil }
            return (title: e.name, body: r)
        }
        if !lines.isEmpty {
            NKBare("AZ ELIGAZÍTÁS", hue: hue, trailing: store?.ageText) {
                NKList(lines, hue: hue)
            }
        }
    }

    /// The week behind today: which days already have a finished gym session. Absent until the server says —
    /// an empty week is drawn as empty days, never as zeroes.
    @ViewBuilder private var week: some View {
        if let w = workout, let b = brief, !w.weekDoneDates.isEmpty || w.templateSessionId != nil {
            let days = weekRows(done: Set(w.weekDoneDates), today: b.date)
            if !days.isEmpty {
                NKBare("A HETED", hue: hue, trailing: store?.ageText) {
                    NKRowList(days, hue: hue)
                }
            }
        }
    }

    /// Monday to Sunday of the week `today` falls in, each row saying whether that day has a finished session.
    /// The days after today are drawn plain: nothing is claimed about a day that has not happened.
    private func weekRows(done: Set<String>, today: String) -> [NKAreaRow] {
        let names = ["Hét", "Ke", "Sze", "Csü", "Pé", "Szo", "Vas"]
        guard let dates = weekDates(of: today) else { return [] }
        return dates.enumerated().map { i, date in
            let isDone = done.contains(date)
            let isToday = date == today
            let isPast = date < today
            return NKAreaRow(id: date, glyph: isDone ? "check-sun" : "dumbbell-ink",
                             title: names[i] + (isToday ? " · ma" : ""),
                             sub: isDone ? "megvolt" : (isPast ? "nem volt edzés" : ""),
                             hot: isToday, state: rowState(done: isDone, past: isPast, today: isToday))
        }
    }

    /// Done · a past day with no session · today · a day still to come. Today is never drawn as "future": it is
    /// the day he is in, whether or not he has trained yet.
    private func rowState(done: Bool, past: Bool, today: Bool) -> NKRowState {
        if done { return .done }
        if past { return .skipped }
        return today ? .normal : .future
    }

    /// The seven `yyyy-MM-dd` of the Monday–Sunday week `ymd` is in, in the device's own calendar.
    private func weekDates(of ymd: String) -> [String]? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .autoupdatingCurrent
        cal.firstWeekday = 2
        let f = DateFormatter()
        f.calendar = cal; f.timeZone = cal.timeZone; f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        guard let date = f.date(from: ymd),
              let monday = cal.dateInterval(of: .weekOfYear, for: date)?.start else { return nil }
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: monday).map(f.string(from:)) }
    }

    /// The area's menu, unchanged. „Indítás" is the player's entrance and stays a promise until the player
    /// exists — it may not open a half-built session.
    private var menu: some View {
        NKMenuGrid([
            NKMenuItem(glyph: "bolt-sun", name: "Indítás", sub: "Sorozatról sorozatra") { toast = soonToast("Edzés indítása") },
            NKMenuItem(glyph: "clock-ink", name: "Blokk", sub: "A heteid egyben") { selected = EdzesTab.blokk.rawValue },
            NKMenuItem(glyph: "ball-sun", name: "Gyakorlatok", sub: "A saját súlyaiddal") { selected = EdzesTab.gyakorlatok.rawValue },
            NKMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés") { selected = EdzesTab.elozmenyek.rawValue },
        ], hue: hue)
    }

    // MARK: - The three tabs their own stages fill

    @ViewBuilder private var blokk: some View {
        NKNotLiveYet(hue: hue, title: "A nyolchetes blokkod",
                     line: "Itt fog állni, hányadik hetén jársz, mit hoz a hét, és mikor jön a könnyű hét. Az edzés-szakasz építi meg.")
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
    }

    @ViewBuilder private var gyakorlatok: some View {
        NKNotLiveYet(hue: hue, title: "A gyakorlataid",
                     line: "A súlyaid, a rekordjaid és minden gyakorlat egy helyen. Az edzés-szakasz hozza, a Watch-appal együtt.")
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot egy gyakorlatról") { openPlace(.boop) }
    }

    @ViewBuilder private var elozmenyek: some View {
        NKNotLiveYet(hue: hue, title: "Az eddigi edzéseid",
                     line: "A telefon ma csak a mai napot látja az edzésekből. A teljes előzmény az edzés-szakasszal érkezik.")
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a fejlődésedről") { openPlace(.boop) }
    }
}

/// A weight the way he reads it: „80 kg", „77,5 kg" — a Hungarian decimal comma, and no „.0".
func nkKg(_ kg: Double) -> String {
    let whole = kg.rounded() == kg
    let text = whole ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
    return "\(text) kg"
}
