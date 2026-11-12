import SwiftUI
import BoopCore
import BoopDesign

// MARK: - B3 Napi ritmus on Ma (spec §5.1, §5.3, §5.4; spike RitmusMa)

/// The plan card's collapsed line: "A nap terve elfogadva" over "07:42 · a nap célja: …" (spec §5.1); an unaccepted
/// past plan keeps its "A reggeli terv · n pont" and shows the goal under it when there is one.
@MainActor
func planSummary(accepted: Bool, acceptedAt: Date?, rows: Int, goal: String?, calendar: Calendar = .current) -> (title: String, sub: String?) {
    let goalPart = goal.map { "a nap célja: \($0)" }
    guard accepted else { return (MaText.planPast(rows), goalPart) }
    let time = acceptedAt.map { CheckinFlow.clock($0, calendar) }
    let sub = [time, goalPart ?? "\(rows) pont"].compactMap { $0 }.joined(separator: " · ")
    return ("A nap terve elfogadva", sub)
}

/// The timeline's check-in stations (brief slot) → the slot id the phone keeps them under.
private let checkinStationSlots = ["checkin-morning": "06:30", "checkin-midday": "10:00", "checkin-afternoon": "14:00"]

/// "Energia 7 · hangulat 8 · feszültség 3": the first three core answers of a check-in.
@MainActor
func checkinSummary(_ c: LedgerCheckIn) -> String {
    let parts = CheckinDone.coreOrder.compactMap { key in c.values[key].map { "\(CheckinDone.coreLabels[key] ?? key) \($0)" } }.prefix(3)
    return parts.enumerated().map { $0.offset == 0 ? $0.element : $0.element.lowercased() }.joined(separator: " · ")
}

/// The timeline with what the phone knows (spec §5.3): a check-in kept on the phone marks its row done with its clock
/// time and answers; the row of the moment the clock is in (`CheckInMoment.moment(at: now)`, the slot a check-in saved
/// now would get) offers *Kitöltöm* while that slot is still empty — a missed earlier moment never does; the evening row
/// is done once the day is closed.
@MainActor
func ritmusStations(_ stations: [PathStation], day: DayLedger, now: Date, calendar: Calendar = .current) -> [PathStation] {
    let current = CheckInMoment.moment(at: now, calendar: calendar).slotId
    return stations.map { st in
        if st.id == "checkin-evening" {
            return day.close == nil ? st : PathStation(id: st.id, time: st.time, glyph: st.glyph, title: st.title, sub: st.sub,
                                                       done: true, isNow: false, opens: false)
        }
        guard let slot = checkinStationSlots[st.id] else { return st }
        if let c = day.checkIns.last(where: { $0.slot == slot }) {
            return PathStation(id: st.id, time: CheckinFlow.clock(c.capturedAt, calendar), glyph: st.glyph, title: st.title,
                               sub: checkinSummary(c), done: true, isNow: false, opens: false)
        }
        guard slot == current, !st.done else { return st }
        return PathStation(id: st.id, time: st.time, glyph: st.glyph, title: st.title, sub: st.sub, done: false, isNow: false,
                           opens: st.opens, action: "Kitöltöm")
    }
}

/// What a tap on a check-in row does: a row held on the phone selects its dot on the curve, the current moment's empty
/// row opens the check-in, the evening row opens the close. nil = anything else (the B2 drill-down applies), including
/// a missed or later moment's row.
enum RitmusStationTap: Equatable { case selectDot(UUID), open(RitmusCover) }

func ritmusTap(_ st: PathStation, day: DayLedger, now: Date, calendar: Calendar = .current) -> RitmusStationTap? {
    if st.id == "checkin-evening" { return .open(.este) }
    guard let slot = checkinStationSlots[st.id] else { return nil }
    if let c = day.checkIns.last(where: { $0.slot == slot }) { return .selectDot(c.id) }
    return !st.done && slot == CheckInMoment.moment(at: now, calendar: calendar).slotId ? .open(.checkin) : nil
}

/// The hero pill with what the phone knows: once the current moment's check-in is on the phone, the Forma pill stops
/// offering *Kitöltöm* at once (nil = *Boop elmondja*), without waiting for the brief to learn it.
func heroAction(_ action: LensAction?, day: DayLedger?, now: Date, calendar: Calendar = .current) -> LensAction? {
    guard let action, action.kind == .checkin, let day else { return action }
    let current = CheckInMoment.moment(at: now, calendar: calendar).slotId
    return day.checkIns.contains { $0.slot == current } ? nil : action
}

/// The day's check-ins among its three moments (the evening close's 20:00 is not one of them).
func filledCount(_ day: DayLedger) -> Int {
    Set(day.checkIns.map(\.slot)).intersection(CheckInMoment.allCases.map(\.slotId)).count
}

func filledLabel(_ day: DayLedger) -> String { "\(filledCount(day)) / 3 kitöltés" }

/// When Boop calls for the close: bedtime target − 75 min, else 21:30 (the reminder rule of spec §7.8).
func closeReminderTime(_ brief: Brief) -> String {
    let p = brief.day.bedtimeTarget?.split(separator: ":").compactMap { Int($0) } ?? []
    guard p.count == 2 else { return "21:30" }
    let m = ((p[0] * 60 + p[1] - 75) % 1440 + 1440) % 1440
    return String(format: "%02d:%02d", m / 60, m % 60)
}

// MARK: - Reggel: the goal of the day

/// "MI MA A LEGFONTOSABB?" in the plan card (spec §5.1, spike `goalBlock`): a set goal is a row with the star and
/// "csere"; otherwise the one-line field with the mic and up to three of Boop's chips — one tap sets the goal.
struct GoalBlock: View {
    let goal: String?
    let suggestions: [GoalSuggestion]
    /// The spoken goal arrives with Task 10's recorder; until then the mic is dimmed and typing works.
    let micEnabled: Bool
    let onSet: (String) -> Void
    let onCsere: () -> Void
    let onMic: () -> Void
    @State private var draft = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("MI MA A LEGFONTOSABB?")
            if let goal {
                HStack(spacing: 12) {
                    NKGlyph("star-sun", .white, size: 18)
                    Text(goal).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Button(action: onCsere) {
                        Text("csere").nkFont(13).foregroundStyle(.white.opacity(0.5)).padding(.vertical, 10).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("A nap célja: csere")
                }
                .padding(.horizontal, 16).frame(minHeight: 52)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.1)))
                .transition(.opacity)
            } else {
                HStack(spacing: 10) {
                    TextField("", text: $draft, prompt: Text("Egy dolog, amin ma múlik…").foregroundStyle(.white.opacity(0.45)))
                        .nkFont(15).foregroundStyle(.white)
                        .submitLabel(.done)
                        .onSubmit { set(draft) }
                    Button(action: onMic) { NKGlyph("mic", .white.opacity(micEnabled ? 0.8 : 0.3), size: 20).frame(width: 32, height: 32) }
                        .buttonStyle(.plain)
                        .disabled(!micEnabled)
                        .accessibilityLabel("Mondd be")
                }
                .padding(.horizontal, 16).frame(height: 48)
                .background(Capsule().fill(.white.opacity(0.08)))
                .overlay(Capsule().stroke(.white.opacity(0.12)))
                if !suggestions.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 8) { ForEach(suggestions) { chip($0) } }
                    }
                    .scrollIndicators(.hidden)
                    .scrollClipDisabled()
                }
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: goal)
    }

    private func set(_ text: String) {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        onSet(t)
        draft = ""
    }

    private func chip(_ s: GoalSuggestion) -> some View {
        Button { set(s.text) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(s.text).nkFont(14, .semibold).foregroundStyle(.white).lineLimit(1)
                Text(s.why).nkFont(11.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Beállítja a nap céljának")
    }
}

// MARK: - Napközben: the energy of the day

/// "AZ ENERGIÁD MA · n / 3 kitöltés" on top of Napközben (spec §5.3): Boop's dashed prediction (the brief's curve), the
/// owner's dots from the phone; a tapped dot opens its detail under the card.
struct MaEnergyCard: View {
    let day: DayLedger
    let predicted: [Double]
    let now: Date
    let calendar: Calendar
    @Binding var selected: UUID?

    private func hour(_ d: Date) -> Double { EnergyCurveGeometry.hour(of: d, calendar: calendar) }

    var body: some View {
        VStack(spacing: 12) {
            EnergyCurveCard(title: "AZ ENERGIÁD MA", trailing: filledLabel(day), predicted: predicted,
                            dots: day.checkIns.compactMap { c in
                                c.values["energy"].map { EnergyCurveDot(id: c.id, hour: hour(c.capturedAt), energy: $0, pending: c.pending) }
                            },
                            now: hour(now), hue: .mozgas, selected: $selected, height: 130)
            if let c = day.checkIns.first(where: { $0.id == selected }) {
                CheckInDetail(heading: "\(CheckinDone.slotName(c.slot).uppercased()) · \(CheckinFlow.clock(c.capturedAt, calendar))",
                              pending: c.pending, answers: CheckinDone.answers(c), note: c.note, snapshot: CheckinDone.figures(c))
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: selected)
    }
}

// MARK: - Este: the door to the close, and the closed day

/// Before the close (spec §5.4, spike `este`): what the minute holds, and *Lezárom a napot* opening the full-screen close.
struct EsteDoorCard: View {
    let open: Bool
    let reminder: String
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            NKMono(open ? "ZÁRD LE A NAPOT · 1 PERC" : "\(reminder)-KOR SZÓLOK · 1 PERC")
            ChipFlow(spacing: 10) {
                ForEach(["Hogy vagy", "A nap célja", "Milyen volt", "Mesélj"], id: \.self) { t in
                    Text(t).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75))
                        .padding(.horizontal, 10).frame(height: 28)
                        .background(Capsule().fill(.white.opacity(0.08)))
                }
            }
            .accessibilityElement(children: .combine)
            NKPill("Lezárom a napot", glyph: "spark-cream", wide: false, action: onClose)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .opacity(open ? 1 : 0.62)
    }
}

/// A closed day on Ma (spec §5.4): "LEZÁRVA · HH:mm" and Boop's sentence; tap → the summary.
struct EsteClosedCard: View {
    let close: LedgerClose
    let line: String?
    let calendar: Calendar
    let hue: Hue
    let motion: OrbMotion
    let onOpen: () -> Void

    private var text: String {
        if close.pending { return "A napod a telefonon van — Boop válasza akkor jön, ha lesz net." }
        return line ?? "A napod lezárva. Boop mondata mindjárt itt lesz."
    }

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    LivingOrb(palette: hue.orb, size: 22, level: 0.85, glow: false, motion: motion).allowsHitTesting(false)
                    NKMono("LEZÁRVA · \(CheckinFlow.clock(close.capturedAt, calendar))")
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                }
                Text(text).nkFont(19, design: .serif).lineSpacing(4).foregroundStyle(.white)
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .nkGlass()
        }
        .buttonStyle(.plain)
        .accessibilityHint("A mai napod összefoglalója")
    }
}
