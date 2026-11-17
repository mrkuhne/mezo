import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Edzés room (B5)

// **The page is the shared area-page kit's, not ours** (`NKAreaPage`, step 3 of the shell
// programme): the head, the area's own bottom bar and its tabs all come from the kit, and this
// file only composes the blocks inside them.
//
// What this file adds is the data only the training API has: the real warmup/working split
// with the engine's per-set targets and its own reasoning, which muscles today's session
// loads, and where he is in the eight-week block.
//
// Three rules hold every line here:
//   • **No invented number.** Where the server said nothing, the screen says so, and a cached
//     answer always carries its age. There is no 0 standing in for "we do not know".
//   • **Nothing explains itself twice.** The engine's own sentence rides on the exercise it is
//     about (owner, 2026-11-17: „a mai edzés és az eligazítás kb ugyanaz") — there is no
//     second list repeating it, and anything worth saying on Ma goes through the wall's
//     `WallSource`, not onto a card surface here.
//   • **Every carousel has dots under it**, so a row that continues says so (owner, 2026-11-17).

/// Which tab of the room is open. The labels are the owner's (`Terv` became **`Blokk`** on
/// 2026-11-16) and they live **here, once**: `AreaRoom`'s tab set reads the same constants.
enum EdzesTab: String, CaseIterable {
    case ma = "Ma", blokk = "Blokk", gyakorlatok = "Gyakorlatok", elozmenyek = "Előzmények"
}

/// A sub-page of the room, opened from a card.
enum EdzesPage: String, Identifiable {
    case blockLoad
    var id: String { rawValue }
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
    @State private var page: EdzesPage?
    /// The day of the week the Blokk tab's carousel is showing.
    @State private var blockDay: String?

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
    private var block: BlockPlan? { store?.block?.value }

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
        // The sub-page is presented at page level (boop-ios.md §9) and over a room the ring
        // opened with no navigation stack under it.
        .fullScreenCover(item: $page) { p in
            switch p {
            case .blockLoad:
                if let block { BlockLoadPage(block: block, hue: hue, age: store?.blockAgeText) { page = nil } }
            }
        }
        .task {
            if store == nil { store = EdzesStore(client: train, cache: cache) }
            await store?.load()
            await store?.loadBlock()
            if blockDay == nil { blockDay = block?.days.first(where: \.isCurrent)?.day ?? block?.days.first?.day }
        }
    }

    /// The tab set and the badge are the page's own, unchanged: a session planned for today and
    /// not yet done is the one thing the bar marks.
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
        todaysLoad
        timeline
        exercises
        NKBare("AZ EDZÉS TERÜLET", hue: hue) { menu }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a mai edzésről") { openPlace(.boop) }
    }

    /// Today's session in a sentence. The brief's own title and time stay the source — it is
    /// what the rest of the app says about today.
    @ViewBuilder private var highlight: some View {
        if let s = brief?.day.session {
            NKHighlight(hue: hue, label: s.done ? "megvolt" : "ma", text: s.title, sub: highlightSub)
        } else if let w = workout, !w.isRestDay, let title = w.title {
            // The brief has no session but the training plan does (a day started across
            // midnight, or a brief that has not caught up): the plan is the honest thing.
            NKHighlight(hue: hue, label: "ma", text: title, sub: highlightSub)
        } else if let w = workout, w.isRestDay {
            NKHighlight(hue: hue, label: "ma", text: "Ma nincs edzés", sub: "A blokkod szerint ez pihenőnap.")
        } else if let c = brief.map({ maiCopy($0, .mozgas) }) {
            NKHighlight(hue: hue, label: "ma", text: c.headline, sub: c.sentence)
        }
    }

    /// „17:30 · 60 perc · 5 gyakorlat · 18 sorozat" — each part only when it is known.
    private var highlightSub: String {
        let s = edzesSummary(workout, brief: brief)
        return [brief?.day.session?.time ?? brief?.day.session?.plannedTime ?? workout?.dayLabel,
                s.minutes.map { "\($0) perc" },
                s.exercises.map { "\($0) gyakorlat" },
                s.workingSets.map { "\($0) sorozat" }]
            .compactMap { $0 }.joined(separator: " · ")
    }

    /// **A mai terhelés** — which muscles today's session works, on the body, with the day's
    /// three numbers beside it. The body is the one in the web app, from the same upstream
    /// artwork; the heat is today's working sets, read against the hardest-worked muscle.
    @ViewBuilder private var todaysLoad: some View {
        let heat = edzesBodyHeat(workout)
        if !heat.isEmpty {
            let s = edzesSummary(workout, brief: brief)
            NKBare("A MAI TERHELÉS", hue: hue, trailing: store?.ageText) {
                VStack(spacing: 16) {
                    // The three numbers run the whole width — the kit's own row, so they sit
                    // exactly as they do on every other page.
                    NKStatRow([
                        NKStat(value: s.exercises.map { "\($0)" }, label: "gyakorlat", hot: true),
                        NKStat(value: s.workingSets.map { "\($0)" }, label: "éles sorozat"),
                        NKStat(value: s.minutes.map { "\($0)" }, unit: "perc", label: "körülbelül"),
                    ], hue: hue)
                    HStack(alignment: .top, spacing: 16) {
                        NKBodyMap(heat, hue: hue)
                            .frame(maxHeight: 180)
                        // And the muscles themselves, each with what it gets today, filling
                        // the rest of the row instead of leaving a hole on the right.
                        VStack(spacing: 10) {
                            ForEach(muscleLoadRows, id: \.muscle) { row in
                                HStack(spacing: 10) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(muscleName(row.muscle).capitalizedFirst)
                                            .nkFont(13).foregroundStyle(.white.opacity(0.85))
                                        NKLevelBar(level: row.level, hue: hue)
                                    }
                                    Text("\(row.sets)")
                                        .nkFont(15, .medium, design: .monospaced)
                                        .foregroundStyle(.white.opacity(0.7))
                                        .frame(width: 22, alignment: .trailing)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    /// Today's muscles with the working sets each one gets, hardest first.
    private var muscleLoadRows: [(muscle: String, sets: Int, level: Double)] {
        guard let w = workout else { return [] }
        var sets: [String: Int] = [:]
        for e in w.exercises {
            let working = e.sets.filter { $0.kind == .working }.count
            sets[e.muscle, default: 0] += working > 0 ? working : e.workingCount
        }
        guard let top = sets.values.max(), top > 0 else { return [] }
        return sets.sorted { ($0.value, $1.key) > ($1.value, $0.key) }
            .prefix(5)
            .map { (muscle: $0.key, sets: $0.value, level: Double($0.value) / Double(top)) }
    }

    /// **Hol tartasz a blokkban** — the eight weeks as time, their height as difficulty, the
    /// week he is in lit and named.
    @ViewBuilder private var timeline: some View {
        let weeks = edzesTimeline(block)
        if !weeks.isEmpty, let b = block {
            NKBare("HOL TARTASZ", hue: hue, trailing: store?.blockAgeText) {
                NKBlockTimeline(weeks, hue: hue,
                                caption: "\(b.weeks) hetes blokk · \(b.currentWeek). hét · \(b.shortTitle)")
            }
        }
    }

    /// The session's exercises, one card each, swipeable — **with the engine's own sentence on
    /// the card it is about**. There is no separate „eligazítás" list: it was the same thing
    /// said twice.
    @ViewBuilder private var exercises: some View {
        if let w = workout, !w.exercises.isEmpty {
            NKBare("A MAI EDZÉS", hue: hue, trailing: store?.ageText) {
                NKCarousel(w.exercises, hue: hue, height: 190) { e in
                    ExerciseCard(exercise: e, hue: hue, done: isDone(e))
                }
            }
        } else if let e = brief?.day.session?.exercises, !e.isEmpty {
            // Offline with no cache: the brief still knows the names and the set counts.
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

    /// Done means the server has a logged set for it — not that the day is over.
    private func isDone(_ e: PlannedExercise) -> Bool {
        let sets = (workout?.open?.sets ?? []) + (workout?.completed?.sets ?? [])
        return sets.contains { $0.exerciseId == e.id && !$0.skipped }
    }

    /// The area's menu. „Blokk" is gone from it — it is one tap away in the bar below (owner,
    /// 2026-11-17) — and its place went to the one thing that had no way in at all.
    private var menu: some View {
        NKMenuGrid([
            NKMenuItem(glyph: "bolt-sun", name: "Indítás", sub: "Sorozatról sorozatra") { toast = soonToast("Edzés indítása") },
            NKMenuItem(glyph: "plus-ink", name: "Egyedi edzés", sub: "Saját összeállítás") { toast = soonToast("Egyedi edzés") },
            NKMenuItem(glyph: "ball-sun", name: "Gyakorlatok", sub: "A saját súlyaiddal") { selected = EdzesTab.gyakorlatok.rawValue },
            NKMenuItem(glyph: "book-sage", name: "Előzmények", sub: "Minden eddigi edzés") { selected = EdzesTab.elozmenyek.rawValue },
        ], hue: hue)
    }

    // MARK: - Blokk

    @ViewBuilder private var blokk: some View {
        if let b = block {
            blockLoadCard(b)
            weekCarousel(b)
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        } else if store?.blockProblem != nil {
            NKBare("A BLOKKOD", hue: hue) { NKNoFreshData("A blokkodat most nem érem el") }
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        } else {
            NKNotLiveYet(hue: hue, title: "Nincs futó blokkod",
                         line: "Amint elindítasz egy nyolchetes blokkot, itt fog állni, hányadik hetén jársz, mit hoz a hét, és melyik izomcsoport mennyit kap.")
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot az edzéstervedről") { openPlace(.boop) }
        }
    }

    /// The whole block's load in one card: the weeks, and what the muscles get. Tapping it
    /// opens the page that breaks it down muscle by muscle.
    private func blockLoadCard(_ b: BlockPlan) -> some View {
        NKBare("A BLOKK TERHELÉSE", hue: hue, trailing: store?.blockAgeText) {
            Button { page = .blockLoad } label: {
                VStack(alignment: .leading, spacing: 14) {
                    NKBlockTimeline(edzesTimeline(b), hue: hue,
                                    caption: "\(b.weeks) hetes blokk · \(b.currentWeek). hét · \(b.split)")
                    HStack(spacing: 10) {
                        Text(muscleSummary(b))
                            .nkFont(13).foregroundStyle(.white.opacity(0.7))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.45))
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint("Izomcsoportonkénti bontás")
        }
    }

    /// The same sentence the load page opens with, so the card and the page agree.
    private func muscleSummary(_ b: BlockPlan) -> String {
        guard !b.muscles.isEmpty else { return "Az izomcsoportok bontása még nem érkezett meg." }
        let summary = blockWeekSummary(muscleBands(b))
        return "\(summary.total) szett ezen a héten · \(summary.muscles) izomcsoport"
    }

    /// **A heted** — the week's days as a carousel: pick a day, see what it asks for. It moved
    /// here from Ma (owner, 2026-11-17): Ma is today, the week is the block's business.
    private func weekCarousel(_ b: BlockPlan) -> some View {
        NKBare("A HETED", hue: hue, trailing: store?.blockAgeText) {
            if b.days.isEmpty {
                NKNoFreshData("A blokk napjai még nem érkeztek meg")
            } else {
                NKCarousel(b.days, hue: hue, height: 150) { day in
                    DayCard(day: day, hue: hue, done: isDayDone(day), today: day.isCurrent)
                }
            }
        }
    }

    /// A day counts as done when this week has a finished session on it.
    private func isDayDone(_ day: BlockDay) -> Bool {
        guard let done = workout?.weekDoneDates, !done.isEmpty, let b = brief else { return false }
        let names = ["Hét", "Ke", "Sze", "Csü", "Pé", "Szo", "Vas"]
        guard let index = names.firstIndex(where: { day.day.hasPrefix($0) }),
              let dates = weekDates(of: b.date), index < dates.count else { return false }
        return done.contains(dates[index])
    }

    /// The seven `yyyy-MM-dd` of the Monday–Sunday week `ymd` is in, in the device's calendar.
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

    // MARK: - The two tabs their own stages fill

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

// MARK: - The cards

/// One exercise of today: its set plan, the weight the engine asks for, and **the engine's own
/// sentence about it**. The sentence is the reason this is one card and not two blocks.
private struct ExerciseCard: View {
    let exercise: PlannedExercise
    let hue: Hue
    let done: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // The muscle as a picture, not only a word: the same body, with this exercise's
            // muscle lit. It is the card's left rail, so every card reads the same way down.
            VStack(spacing: 6) {
                if NKBodyMark.canDraw(exercise.muscle) {
                    NKBodyMark(muscle: exercise.muscle, hue: hue, height: 62)
                }
                Text(muscleName(exercise.muscle))
                    .nkFont(10, .medium, design: .monospaced)
                    .tracking(0.6)
                    .foregroundStyle(.white.opacity(0.55))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(width: 54)

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 10) {
                    Text(exercise.name)
                        .nkFont(18, design: .serif)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                    if done { NKDoneTick(hue: hue) }
                }
                // What to lift, big — or nothing at all when the engine prescribed no weight.
                if let target = targetLine {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(target).nkFont(27, .medium).foregroundStyle(hue.glow)
                        if let reps = targetReps { Text("× \(reps)").nkFont(14).foregroundStyle(.white.opacity(0.6)) }
                    }
                    .padding(.top, 6)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(workingLine).nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.62))
                    if let warmupLine {
                        Text(warmupLine).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.42))
                    }
                }
                .padding(.top, targetLine == nil ? 6 : 2)
                if let reason = exercise.rationale ?? exercise.progression?.rationale, !reason.isEmpty {
                    Rectangle().fill(.white.opacity(0.1)).frame(height: 0.5).padding(.vertical, 10)
                    Text(reason)
                        .nkFont(13)
                        .foregroundStyle(.white.opacity(0.78))
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .nkGlass()
        .accessibilityElement(children: .combine)
    }

    /// The weight the first working set asks for — **only** when the server prescribed one.
    private var targetLine: String? {
        exercise.sets.first(where: { $0.kind == .working })?.targetKg.map { nkKg($0) }
    }

    private var targetReps: Int? {
        targetLine == nil ? nil : exercise.sets.first(where: { $0.kind == .working })?.targetReps
    }

    /// „3 sorozat · 6–10 ismétlés" — what he actually has to do, on its own line so the rep
    /// range never breaks in half.
    private var workingLine: String {
        let working = exercise.sets.filter { $0.kind == .working }.count
        let reps = exercise.repMin == exercise.repMax
            ? "\(exercise.repMin) ismétlés"
            : "\(exercise.repMin)–\(exercise.repMax) ismétlés"
        return "\(working > 0 ? working : exercise.workingCount) sorozat · \(reps)"
    }

    /// The warm-up, quieter and under it — it is preparation, not the work.
    private var warmupLine: String? {
        let warmups = exercise.sets.filter { $0.kind == .warmup }.count
        return warmups > 0 ? "+ \(warmups) bemelegítő" : nil
    }
}

/// One day of the block's week: what it is, what it works, and whether it is behind you.
private struct DayCard: View {
    let day: BlockDay
    let hue: Hue
    let done: Bool
    let today: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(day.day.uppercased())
                    .nkFont(11, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(today ? hue.glow : .white.opacity(0.5))
                if today {
                    Text("MA").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                        .foregroundStyle(NK.ground)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Capsule().fill(hue.glow))
                }
                Spacer(minLength: 0)
                if done { NKDoneTick(hue: hue) }
            }
            Text(day.type)
                .nkFont(19, design: .serif)
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(day.muscle).nkFont(13).foregroundStyle(.white.opacity(0.62)).lineLimit(2)
            Spacer(minLength: 0)
            Text("\(day.exerciseCount) gyakorlat")
                .nkFont(12, design: .monospaced)
                .foregroundStyle(.white.opacity(0.5))
            if let note = day.note, !note.isEmpty {
                Text(note).nkFont(12).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .nkGlass()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Words

/// A muscle group the way he says it, not the way the database spells it.
func muscleName(_ key: String) -> String {
    switch key.lowercased() {
    case "chest", "chest-mid", "chest-upper", "chest-lower": "mellkas"
    case "back", "back-wide", "back-mid", "back-lower", "lats": "hát"
    case "traps": "csuklyás"
    case "shoulder", "shoulders", "shoulder-front", "shoulder-side", "shoulder-rear", "rear-delt": "váll"
    case "biceps", "biceps-long", "biceps-short", "biceps-brachialis": "bicepsz"
    case "triceps", "triceps-long", "triceps-lateral", "triceps-medial": "tricepsz"
    case "arms": "kar"
    case "quad", "quads", "quadriceps": "comb eleje"
    case "ham", "hams", "hamstring": "comb hátulja"
    case "glute", "glutes", "gluteal": "fenék"
    case "calf", "calves": "vádli"
    case "core", "abs": "törzs"
    default: key
    }
}

/// A weight the way he reads it: „80 kg", „77,5 kg" — a Hungarian decimal comma, and no „.0".
func nkKg(_ kg: Double) -> String {
    let whole = kg.rounded() == kg
    let text = whole ? String(Int(kg)) : String(format: "%.1f", kg).replacingOccurrences(of: ".", with: ",")
    return "\(text) kg"
}
