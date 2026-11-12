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
    if id.hasPrefix("meal-") || base == "water" { return .drill(.fuel) }
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
        VStack(spacing: 34) {
            lensStrip
            reggel.phaseAnchor(.reggel)
            napkozben.phaseAnchor(.napkozben)
            este.phaseAnchor(.este)
        }
        .task(id: today) {
            guard let ritmus else { return }
            await ritmus.refreshCalendar()
            await ritmus.refreshDay(today)
            await ritmus.refreshPastGoals(today: today)
            await ritmus.refreshCloseLine(today)
        }
    }

    // MARK: lens strip

    private var lensStrip: some View {
        VStack(spacing: 10) {
            VStack(spacing: 10) {
                MaiTiles(tiles: maiTiles(key, TileInputs(brief))) { ctx.toast(soonToast("Víz +250 ml")) }
                Button { onDrill(ctx.hue) } label: {
                    HStack(spacing: 8) {
                        Text("\(ctx.hue.name) részletesen").nkFont(15, .medium).foregroundStyle(.white)
                        Spacer(minLength: 8)
                        Text("a napok mögötte").nkFont(13).foregroundStyle(.white.opacity(0.5))
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(.horizontal, 18).frame(height: 50)
                    .contentShape(Rectangle())
                    .nkGlass(18)
                }
                .buttonStyle(.plain)
            }
            .id(ctx.hue)
            .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 28)), removal: .opacity))
        }
        .animation(.spring(response: 0.7, dampingFraction: 0.82), value: ctx.hue)
    }

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
        return VStack(alignment: .leading, spacing: 14) {
            phaseHead(.reggel)
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
                BoopSaysCard(lines: brief.brief, hue: ctx.hue, motion: ctx.motion, voice: ctx.voice, speak: ctx.speak, onLink: onLink)
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
                          micEnabled: ritmus.recorder != nil,
                          onSet: { text in Task { await setGoal(text) } },
                          onCsere: { Task { await removeGoal() } },
                          onMic: goalMic)
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

    private var napkozben: some View {
        let base = napkozbenStations(brief, now: ctx.now, evening: ctx.evening, hasProposals: !proposalsInPlan && !shown.isEmpty,
                                     reminder: ctx.reminder.isOn ? ctx.reminder.time : nil)
        let stations = ledgerDay.map { ritmusStations(base, day: $0, now: ctx.now, calendar: ritmus?.calendar ?? .current) } ?? base
        return VStack(alignment: .leading, spacing: 14) {
            phaseHead(.napkozben, range: timelineSpan(stations) ?? "")
            if let ritmus, let day = ledgerDay {
                MaEnergyCard(day: day, predicted: brief.date == today ? brief.energy.hourly : [], now: ctx.now,
                             calendar: ritmus.calendar, selected: $curveSel)
            }
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

    /// One tap to talk, one to stop; the sentence becomes the goal.
    private func goalMic() {
        guard let recorder = ritmus?.recorder else { return }
        if !goalRecording {
            do { try recorder.start(); goalRecording = true } catch { goalRecording = false }
            return
        }
        goalRecording = false
        Task {
            if let text = await recorder.stop()?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty { await setGoal(text) }
        }
    }
}
