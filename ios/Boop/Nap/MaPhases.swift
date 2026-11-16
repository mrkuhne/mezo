import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The day in three phases (B2 Gerinc, spike GerincMa)

/// The scroll anchor of a phase's section (the phase strip scrolls there).
func phaseSectionId(_ p: DayPhase) -> String {
    switch p {
    case .reggel: "reggel"
    case .napkozben: "napkozben"
    case .este: "este"
    }
}

/// The phase's clock range, the shipped rules (Reggel 04–10, Napközben 10–18, Este 18–04).
func phaseRange(_ p: DayPhase) -> String {
    switch p {
    case .reggel: "04:00 – 10:00"
    case .napkozben: "10:00 – 18:00"
    case .este: "18:00 – 04:00"
    }
}

/// The span the Napközben timeline really covers: the first station's time – the last one's (MOST and timeless
/// stations left out), e.g. "23:05 – 22:30"; nil on an empty day.
func timelineSpan(_ stations: [PathStation]) -> String? {
    let times = stations.filter { !$0.isNow }.map(\.time).filter { t in
        let p = t.split(separator: ":"); return p.count == 2 && p.allSatisfy { $0.count == 2 && Int($0) != nil }
    }
    guard let first = times.first, let last = times.last else { return nil }
    return "\(first) – \(last)"
}

/// The whole day's stations as quiet one-line rows (no card hangs off them).
func quietStations(_ steps: [PathStep]) -> [PathStation] {
    steps.map { PathStation(id: $0.id, time: $0.time, glyph: $0.glyph, title: $0.title, sub: $0.sub,
                            done: $0.done, isNow: $0.isNow, opens: false) }
}

/// Napközben's timeline: the full day in clock order as quiet rows; MOST opens (Boop's proposal cards hang there)
/// only when there is something to propose. `reminder` = the bedtime reminder's time while it is on.
func napkozbenStations(_ brief: Brief, now: Date, evening: Bool, hasProposals: Bool, reminder: String? = nil,
                       calendar: Calendar = .current) -> [PathStation] {
    let steps = withReminder(PathBuilder.steps(for: nil, brief: brief, now: now, evening: evening, calendar: calendar), time: reminder)
    return quietStations(steps).map { st in
        guard st.isNow else { return st }
        return PathStation(id: st.id, time: st.time, glyph: st.glyph, title: st.title, sub: st.sub,
                           done: st.done, isNow: true, opens: hasProposals)
    }
}

// MARK: Food on the timeline (B4 Task 15)

/// The plan's next window still to eat: the first one now or pending with nothing logged in it (a missed or skipped
/// window is not "next").
func etelNextWindow(_ plan: FuelPlan?) -> PlanWindow? {
    plan?.windows.first { ($0.state == .now || $0.state == .pending) && $0.loggedMealIds.isEmpty }
}

private func clockOrder(_ t: String) -> Bool {
    let p = t.split(separator: ":"); return p.count == 2 && p.allSatisfy { $0.count == 2 && Int($0) != nil }
}

/// A station goes after the last one that is not later than it (stations without a clock time are ignored).
private func inserting(_ st: PathStation, at clock: String?, into list: [PathStation]) -> [PathStation] {
    var out = list
    guard let clock else { out.append(st); return out }
    let at = out.lastIndex { clockOrder($0.time) && $0.time <= clock }.map { $0 + 1 } ?? 0
    out.insert(st, at: at)
    return out
}

/// Pointers into the Étel room on Ma's timeline: the next meal window and the supplement group still to take (or one
/// done line when all are). These are moments, not photos — the room itself holds the cards. All logic is the
/// room's own (`FuelPlan`, `SupplementGroup`, the taken set); nothing is re-derived here.
func etelStations(_ stations: [PathStation], plan: FuelPlan?, groups: [SupplementGroup], taken: Set<String>) -> [PathStation] {
    var out = stations
    let next = etelNextWindow(plan)
    if let w = next {
        let budget = w.budget.map { " · kb. \(huInt(Int($0.kcal.rounded()))) kcal" } ?? ""
        out = inserting(PathStation(id: "etel-window-\(w.slot)", time: w.from, glyph: "bowl-cream", title: w.label,
                                    sub: "\(w.from)–\(w.to)\(budget)", done: false, isNow: false, opens: false), at: w.from, into: out)
    }
    /// The group's clock: the meal window's start for a meal-linked daypart, else the daypart's indicative time; nil when
    /// the key is unknown. Said as "kb." in the sub line: it is a guess, not a schedule.
    func clock(_ key: String) -> String? {
        if let w = plan?.windows.first(where: { $0.slot == key && $0.kind == .meal }) { return w.from }
        return supplementDayparts.first { $0.key == key }?.clock
    }
    // A guessed clock never goes in the 42 pt time column (six characters would wrap): the sub line says "kb. 8:00".
    func guess(_ c: String?) -> String { c.map { "kb. " + ($0.hasPrefix("0") ? String($0.dropFirst()) : $0) + " · " } ?? "" }
    if let g = groups.first(where: { !taken.contains($0.key) }) {
        out = inserting(PathStation(id: "etel-supplements-\(g.key)", time: "", glyph: "spark-cream", title: g.label,
                                    sub: "\(guess(clock(g.key)))\(g.count) tétel · \(g.summary)", done: false, isNow: false, opens: false),
                         at: clock(g.key), into: out)
    } else if let last = groups.last {
        out = inserting(PathStation(id: "etel-supplements-done", time: "", glyph: "spark-cream", title: "Kiegészítők",
                                    sub: "\(guess(clock(last.key)))Mind bevéve", done: true, isNow: false, opens: false), at: clock(last.key), into: out)
    }
    return out
}

/// A moment of the day (BoopCore, pure) as a pin on the curve (BoopDesign). The two cannot see each other, so the
/// app carries the value across — the same bridge as `MetricKey` ↔ `Hue`.
func curveEvent(_ m: DayMoment) -> EnergyCurveEvent {
    EnergyCurveEvent(id: m.id, hour: m.hour, glyph: m.glyph, label: m.label, detail: m.detail)
}

/// Nothing on the day but MOST: the timeline gives way to the "nothing yet" line.
func isEmptyDay(_ stations: [PathStation]) -> Bool { stations.allSatisfy(\.isNow) }

/// The dismissed proposals' keys as stored (newline-joined, `Proposals.dismissKey`).
func dismissedSet(from raw: String) -> Set<String> {
    Set(raw.split(separator: "\n").map(String.init).filter { !$0.isEmpty })
}

func dismissedString(_ keys: Set<String>) -> String { keys.sorted().joined(separator: "\n") }

/// What a tap on a timeline station opens: its domain's drill-down, or the day sheet for the meetings.
enum StationTap: Equatable { case drill(Hue), daySheet }

func stationTap(_ id: String) -> StationTap? {
    let base = id.split(separator: "-").first.map(String.init) ?? id
    if id.hasPrefix("meal-") || base == "water" || base == "etel" { return .drill(.fuel) }
    if base == "session" || id.hasPrefix("dip-walk") || id.hasPrefix("easy-walk") { return .drill(.mozgas) }
    if ["sleep", "wake", "bedtime", "wind"].contains(base) { return .drill(.alvas) }
    if ["checkin", "intention", "observations"].contains(base) { return .drill(.forma) }
    if base == "breath" { return .drill(.pulzus) }
    if id.hasPrefix("busy-block") || base == "calendar" { return .daySheet }
    return nil
}

/// The "miért?" voices in their field's orb colour; the sceptic in grey.
func expertPalette(_ f: ExpertField) -> [Color] {
    switch f {
    case .alvas: Hue.alvas.orb
    case .mozgas: Hue.mozgas.orb
    case .etkezes: Hue.fuel.orb
    case .kozerzet: Hue.pulzus.orb
    case .szkeptikus: [Color(white: 0.75), Color(white: 0.55), Color(white: 0.38), Color(white: 0.25)]
    }
}

enum MaText {
    static let emptyDay = "Ma még nincs semmi a napodban. Ha jön egy edzés, egy étkezés vagy egy megbeszélés, itt sorakozik."
    static let dismissed = "Rendben, most nem"
    static let whyClosing = "Mindent összevetve megéri. De te döntesz: semmi nem változik, amíg nem bólintasz rá."
    static func planPast(_ n: Int) -> String { "A reggeli terv · \(n) pont" }
}

extension View {
    /// An invisible marker 130 pt above the section: scrolling to it leaves the title clear of the compact capsule.
    func phaseAnchor(_ p: DayPhase) -> some View {
        background(alignment: .top) { Color.clear.frame(height: 130).id(phaseSectionId(p)).padding(.top, -130) }
    }
}

// MARK: - Below the Ma hero

/// The selected orb's lens strip (its tiles + the door to its drill-down), then the day as one scroll: Reggel (the plan
/// to accept with the goal of the day, Boop mondja), Napközben (the energy of the day, the whole-day timeline, Boop's
/// proposals at MOST), Este (the door to the one-minute close, or the closed day).
/// Nothing changes without a tap: a proposal applies only on *Elfogadom*, *Most nem* hides it for today.
struct MaBelow: View {
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    /// The phase the clock is in.
    let phase: DayPhase
    /// Boop's proposals (shared with the rooms; the page presents their "miért?").
    let desk: ProposalDesk
    let onDrill: (Hue) -> Void
    /// A tappable phrase in Boop mondja, and the meetings station (the page presents the detail sheet).
    let onLink: (Brief.Link) -> Void

    @AppStorage("planAcceptedDate") private var planAcceptedDate = ""
    /// When the plan was accepted (seconds since 1970; the collapsed line shows its clock time).
    @AppStorage("planAcceptedAt") private var planAcceptedAt: Double = 0
    @State private var planOpen = false
    /// B3's daily loop: the day ledger, the goal, the covers (nil only outside the signed-in shell).
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @Environment(RitmusRouter.self) private var router: RitmusRouter?
    /// The dot selected on the energy curve (a past check-in row selects its own).
    @State private var curveSel: UUID?
    @State private var goalRecording = false
    /// The goal field's text (typed, or what the phone heard — the owner still sends it).
    @State private var goalDraft = ""
    /// B4: the food rows' data — the next window and the supplement group (the Étel room's own store, the light read).
    @Environment(\.foodClient) private var food
    /// A wall card's "Rögzítem" opens the meal composer at page level (boop-ios.md §9).
    @Environment(\.openMeal) private var openMeal
    /// The ask row under the observations sends him to Boop's own place.
    @Environment(\.openPlace) private var openPlace
    /// Is the day's timeline open? In the morning it is; later it is one row (owner decision #13).
    @State private var napodOpen: Bool?
    @State private var etel = EtelStore()
    @State private var foodSeen = false

    private var key: MetricKey { metricKey(for: ctx.hue) }

    // MARK: proposals

    private var shown: [(proposal: Proposal, state: NKProposalState)] { desk.shown(brief, now: ctx.now, conflictKept: store.conflictKept) }

    private var planAccepted: Bool { planAcceptedDate == brief.date }
    private var planCollapsed: Bool { (planAccepted || phase != .reggel) && !planOpen }
    /// In the morning the proposals sit in the open plan card; otherwise at MOST.
    private var proposalsInPlan: Bool { phase == .reggel && !planCollapsed }

    /// The phone's local day of the page's clock (the goal and the check-ins belong to it).
    private var today: String { ritmus?.day(of: ctx.now) ?? brief.date }
    private var ledgerDay: DayLedger? { ritmus?.ledger.ledger(for: today) }

    var body: some View {
        // The day page is the Élet spike's Ma screen (owner, 2026-11-16, `mezo-r36n9.56`): the shape of the day
        // first as one picture, then what Boop wants to say now, then everything else folded away.
        VStack(spacing: 30) {
            dayCurveCard.phaseAnchor(.napkozben)
            MaWall(brief: brief, ctx: ctx, etel: etel, ledgerDay: ledgerDay, heading: true, onDrill: onDrill,
                   onCheckIn: { router?.open(.checkin) },
                   onMeal: { openMeal(MealStart()) },
                   onEtelRoom: { onDrill(.fuel) })
            reggel.phaseAnchor(.reggel)
            napod
            notices
            este.phaseAnchor(.este)
        }
        .task(id: today) {
            guard let ritmus else { return }
            await ritmus.refreshCalendar()
            await ritmus.refreshDay(today)
            await ritmus.refreshPastGoals(today: today)
            await ritmus.refreshCloseLine(today)
        }
        .task(id: today) { await refreshFood() }
        // back from the Étel room: a supplement ticked or a meal logged there shows here at once
        .onAppear { if foodSeen { Task { await refreshFood() } }; foodSeen = true }
    }

    private func refreshFood() async {
        guard let food else { return }
        await etel.load(food: food, now: ctx.now, extras: false)
    }

    // MARK: lens strip — REMOVED with L0/b
    //
    // The per-area tiles and the "Alvás részletesen" door left this page: the ring of seven orbs is the app's
    // entrance now (decisions #32–#33) and every area is one tap from it, so a second door here was the same
    // menu twice. Kept in git history, not in the page.

    /// `range` nil = the phase's clock range; Napközben passes its timeline's real span ("" hides it).
    private func phaseHead(_ p: DayPhase, range: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(p.name).nkFont(28, design: .serif).foregroundStyle(.white)
            let r = range ?? phaseRange(p)
            if !r.isEmpty { Text(r).nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5)) }
            Spacer()
            if p == phase {
                HStack(spacing: 6) {
                    NowPulse(hue: ctx.hue).frame(width: 18)
                    Text("MOST").nkFont(11, .bold, design: .monospaced).foregroundStyle(.white)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: Reggel

    private var reggel: some View {
        let rows = DayPlan.rows(brief)
        // The morning is a fold now (the day page, 2026-11-16): the heading left with the phase tabs, and what
        // Boop said in the morning is one row by the afternoon — open by itself only while it is the morning.
        return VStack(alignment: .leading, spacing: 14) {
            if planCollapsed {
                Button { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planOpen = true } } label: {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(planAccepted ? .white.opacity(0.9) : .white.opacity(0.1))
                            NKGlyph(planAccepted ? "check-ink" : "clock-ink", planAccepted ? NK.ground : .white.opacity(0.8), size: 16)
                        }
                        .frame(width: 38, height: 38)
                        let summary = planSummary(accepted: planAccepted, acceptedAt: planAcceptedAt > 0 ? Date(timeIntervalSince1970: planAcceptedAt) : nil,
                                                  rows: rows.count, goal: ritmus?.goal(on: today)?.text, calendar: ritmus?.calendar ?? .current)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(summary.title).nkFont(16, .medium).foregroundStyle(.white)
                            if let sub = summary.sub {
                                Text(sub).nkFont(13.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(16).contentShape(Rectangle()).nkGlass()
                }
                .buttonStyle(.plain)
            } else {
                planCard(rows)
            }
            if !brief.brief.isEmpty {
                BoopSaysCard(lines: brief.brief, hue: ctx.hue, motion: ctx.motion, onLink: onLink)
            }
        }
    }

    private func planCard(_ rows: [PlanRow]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                StillOrb(palette: ctx.hue.orb, size: 22, level: 0.85)
                NKMono("A MAI TERVED")
                Spacer()
                if planAccepted || phase != .reggel {
                    Button { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { planOpen = false } } label: {
                        Image(systemName: "chevron.up").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Összecsukom")
                }
            }
            .padding(.bottom, 8)
            if rows.isEmpty {
                Text("Ma nincs tervezett pont.").nkFont(14).foregroundStyle(.white.opacity(0.6)).padding(.vertical, 9)
            }
            ForEach(Array(rows.enumerated()), id: \.element.id) { k, r in
                HStack(spacing: 14) {
                    Text(r.time).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.7)).frame(width: 46, alignment: .leading)
                    NKGlyph(r.glyph, .white, size: 17).frame(width: 22)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(r.title).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        if !r.sub.isEmpty { Text(r.sub).nkFont(13).foregroundStyle(.white.opacity(0.55)) }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 9)
                .accessibilityElement(children: .combine)
                if k < rows.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 60) }
            }
            if let ritmus {
                GoalBlock(goal: ritmus.goal(on: today)?.text, suggestions: ritmus.goalSuggestions(brief: brief, date: today),
                          draft: $goalDraft,
                          // only a transcript written on the phone fits a one-line field; without it, typing only
                          micEnabled: ritmus.voiceInputAvailable(ritmus.recorder), recording: goalRecording,
                          micHint: ritmus.recorder != nil && !ritmus.voiceInputAvailable(ritmus.recorder) ? RitmusEnvironment.voiceOfflineHint : nil,
                          onSet: { text in Task { await setGoal(text) } },
                          onCsere: { Task { await removeGoal() } },
                          onMic: goalMic,
                          onRetry: ritmus.goalRefusal(on: today).map { id in { Task { await ritmus.retry([id]) } } })
                    .padding(.top, 14)
            }
            if proposalsInPlan && !shown.isEmpty {
                proposalCards(compact: true).padding(.top, 12)
            }
            if !planAccepted && phase == .reggel {
                HStack(spacing: 10) {
                    NKPill("Elfogadom a napot", wide: false) {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                            planAcceptedDate = brief.date; planAcceptedAt = Date().timeIntervalSince1970; planOpen = false
                        }
                        ctx.toast("A nap terve elfogadva")
                    }
                    NKPill("Módosítom", primary: false, wide: false) { ctx.toast(soonToast("A terv módosítása")) }
                }
                .padding(.top, 16)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }

    // MARK: Napközben

    /// **Mai nap** — the shape of the day as one picture: Boop's energy curve with the day's own moments sitting
    /// on it as pins (`dayMoments`), and the way into the full list. It is the page's first block, because it is
    /// the one thing that is about the whole day; everything under it is about one piece of it.
    private var dayCurveCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Mai nap").nkFont(28, design: .serif).foregroundStyle(.white)
                Spacer()
                Button { withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { napodOpen = true } } label: {
                    HStack(spacing: 5) {
                        Text("A napod").nkFont(13.5, .semibold)
                        Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(ctx.hue.glow)
                }
                .buttonStyle(.plain)
            }
            .accessibilityElement(children: .contain)
            energyCard
        }
    }

    /// The day's energy, with the day's moments pinned on it. Without the ledger (outside the signed-in shell) the
    /// curve has nothing of his own on it, so the block stays away rather than showing an empty frame.
    @ViewBuilder private var energyCard: some View {
        if let ritmus, let day = ledgerDay {
            MaEnergyCard(day: day, predicted: brief.date == today ? brief.energy.hourly : [], now: ctx.now,
                         calendar: ritmus.calendar, selected: $curveSel, title: "",
                         refusal: { ritmus.refusal(forCheckIn: $0, date: today) },
                         onRetry: { id in Task { await ritmus.retry([id]) } },
                         events: brief.date == today ? dayMoments(brief).map(curveEvent) : [])
        }
    }

    /// **Amit ma észrevettem** — the cross-area observations as their own block (the spike's `notices`), with the
    /// *igaz / nem igaz* verdict they already carry, and one row into Boop's chat under them.
    @ViewBuilder private var notices: some View {
        if !brief.day.observations.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("Amit ma észrevettem").nkFont(26, design: .serif).foregroundStyle(.white)
                    Text("\(brief.day.observations.count)").nkFont(13, .semibold)
                        .foregroundStyle(.white.opacity(0.75))
                        .frame(minWidth: 22, minHeight: 22)
                        .background(Circle().fill(.white.opacity(0.12)))
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                ObservationStack(observations: brief.day.observations, hue: ctx.hue, motion: ctx.motion,
                                 decide: { id, verdict in
                                     await store.decide(observation: id, true: verdict)
                                     return store.problem == nil
                                 },
                                 toast: ctx.toast)
                NKAskRow(hue: ctx.hue, text: "Kérdezd meg Boopot, mit vett még észre") { openPlace(.boop) }
            }
        }
    }

    /// The day's timeline, folded into one row (owner decision #13): open in the morning, closed later, with
    /// everything still behind it. Nothing was dropped — it moved behind a chevron.
    private var napod: some View {
        let stations = timelineStations
        let done = stations.filter(\.done).count
        let left = stations.count - done
        return NKFoldRow("A napod", sub: stations.isEmpty ? "" : "\(done) megvolt, \(left) hátra",
                         hue: ctx.hue, open: Binding(get: { napodOpen ?? (phase == .reggel) },
                                                     set: { napodOpen = $0 })) {
            napkozben
        }
    }

    private var timelineStations: [PathStation] {
        let base = napkozbenStations(brief, now: ctx.now, evening: ctx.evening, hasProposals: !proposalsInPlan && !shown.isEmpty,
                                     reminder: ctx.reminder.isOn ? ctx.reminder.time : nil)
        let ritmic = ledgerDay.map { ritmusStations(base, day: $0, now: ctx.now, calendar: ritmus?.calendar ?? .current) } ?? base
        return etelStations(ritmic, plan: etel.plan, groups: etel.groups, taken: etel.taken)
    }

    private var napkozben: some View {
        let stations = timelineStations
        return VStack(alignment: .leading, spacing: 14) {
            if isEmptyDay(stations) {
                Text(MaText.emptyDay)
                    .nkFont(15).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                if !proposalsInPlan && !shown.isEmpty { proposalCards(compact: false) }
            } else {
                DayPath(stations: stations, hue: ctx.hue, onTap: tap, onAction: { _ in router?.open(.checkin) }) { _ in
                    proposalCards(compact: false)
                }
            }
        }
    }

    private func tap(_ st: PathStation) {
        if let day = ledgerDay, let t = ritmusTap(st, day: day, now: ctx.now, calendar: ritmus?.calendar ?? .current) {
            switch t {
            case .selectDot(let id): withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { curveSel = id }
            case .open(let cover): router?.open(cover)
            }
            return
        }
        switch stationTap(st.id) {
        case .drill(let h)?: onDrill(h)
        case .daySheet?: onLink(.day)
        case nil: break
        }
    }

    private func proposalCards(compact: Bool) -> some View {
        ProposalCards(items: shown, compact: compact, desk: desk, brief: brief, store: store, ctx: ctx)
    }

    // MARK: Este

    private var este: some View {
        VStack(alignment: .leading, spacing: 14) {
            phaseHead(.este)
            if let close = ledgerDay?.close {
                EsteClosedCard(close: close, line: ritmus?.closeLines[today], calendar: ritmus?.calendar ?? .current,
                               hue: ctx.hue, motion: ctx.motion) { router?.open(.este) }
            } else {
                EsteDoorCard(open: phase == .este, reminder: closeReminderTime(brief)) { router?.open(.este) }
            }
        }
        .padding(.bottom, 10)
    }

    // MARK: The goal of the day

    private func setGoal(_ text: String) async {
        guard let ritmus else { return }
        do { try await ritmus.setGoal(text, date: today) } catch { ctx.toast("A telefon most nem tudta eltenni a célt") }
    }

    /// "csere": the shown goal goes; the field and the chips come back.
    private func removeGoal() async {
        guard let ritmus else { return }
        do { try await ritmus.removeGoal(date: today) } catch { ctx.toast("A telefon most nem tudta eltenni a célt") }
    }

    /// One tap to talk, one to stop; what was heard fills the field (the owner sends it): the phone's transcript, or —
    /// online, when the phone cannot write Hungarian itself — the server's, asked for directly (nothing is queued).
    private func goalMic() {
        guard let ritmus, let recorder = ritmus.recorder else { return }
        if !goalRecording {
            Task {
                do { try await recorder.start(); goalRecording = true }
                catch { goalRecording = false; ctx.toast(MicCopy.line(for: error)) }
            }
            return
        }
        goalRecording = false
        Task {
            guard let capture = await recorder.stop() else { return }
            switch await ritmus.heardSpeech(capture, speechDenied: recorder.speechDenied) {
            case .text(let text): goalDraft = text
            case .problem(let line): ctx.toast(line)
            }
        }
    }
}
