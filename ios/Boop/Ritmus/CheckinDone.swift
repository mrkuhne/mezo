import SwiftUI
import BoopCore
import BoopDesign

/// The payoff after a check-in (spec §5.2, spike `RitmusCheckin.done`): "MENTVE · 16:02 / Ráesett a görbére", the
/// energy of the day with the new dot selected, its detail with what the watch said, "Mondj hozzá egy mondatot"
/// (voice or typed — the check-in's note), Boop's one line (online) or the calm line (offline), *Kész*.
struct CheckinDone: View {
    let env: RitmusEnvironment
    let flow: CheckinFlow
    let motion: OrbMotion
    let onClose: () -> Void
    @Environment(MorningStore.self) private var morning: MorningStore?
    @State private var selected: UUID?
    @State private var voice: VoiceRowPhase = .idle
    @State private var micProblem: String?

    private var day: DayLedger { env.ledger.ledger(for: flow.date) }
    private var savedId: UUID? { flow.saved?.checkIn.id }
    private var predicted: [Double] {
        guard let brief = morning?.brief, brief.date == flow.date else { return [] }
        return brief.energy.hourly
    }
    private func hour(_ date: Date) -> Double { EnergyCurveGeometry.hour(of: date, calendar: env.calendar) }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                HStack {
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Bezárom")
                }
                heading
                EnergyCurveCard(title: "AZ ENERGIÁD MA", predicted: predicted, dots: dots, now: hour(env.clock()),
                                hue: .mozgas, selected: $selected)
                if let c = day.checkIns.first(where: { $0.id == selected }) {
                    detail(c).transition(.opacity)
                }
                VStack(alignment: .leading, spacing: 10) {
                    VoiceRecorderRow(phase: voice, prompt: "Mondj hozzá egy mondatot", micEnabled: env.recorder != nil,
                                     onMic: mic, onTyped: typed)
                    if let problem = micProblem ?? flow.saveProblem {
                        Text(problem).nkFont(13).foregroundStyle(Color(hex: 0xF7A8C4)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                boopCard
                NKPill("Kész", wide: false, action: onClose).padding(.top, 4)
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
            .animation(.easeInOut(duration: 0.3), value: flow.line)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .background(NKGround(hue: .mozgas))
        .onAppear { selected = savedId }
        .onDisappear {
            if case .recording = voice, let recorder = env.recorder { Task { if let c = await recorder.stop() { recorder.discard(c) } } }
        }
    }

    private var heading: some View {
        VStack(spacing: 8) {
            Text(flow.savedTimeLabel ?? "MENTVE").nkFont(12, .medium, design: .monospaced).tracking(1.6).foregroundStyle(.white.opacity(0.75))
            Text("Ráesett a görbére").nkFont(36, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center)
            if let saved = flow.saved, let energy = saved.checkIn.values["energy"],
               let verdict = CheckinFlow.verdict(energy: energy, hour: hour(saved.checkIn.capturedAt), predicted: predicted, moment: flow.moment) {
                Text(verdict).nkFont(16).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center)
            }
            if flow.offline { OfflineChip().padding(.top, 6) }
        }
        .padding(.bottom, 6)
    }

    private var dots: [EnergyCurveDot] {
        day.checkIns.compactMap { c in
            c.values["energy"].map { EnergyCurveDot(id: c.id, hour: hour(c.capturedAt), energy: $0, pending: c.pending) }
        }
    }

    private func detail(_ c: LedgerCheckIn) -> some View {
        CheckInDetail(
            heading: "\(Self.slotName(c.slot).uppercased()) · \(CheckinFlow.clock(c.capturedAt, env.calendar))",
            pending: c.pending, answers: Self.answers(c), note: c.note, snapshot: Self.figures(c))
    }

    @ViewBuilder private var boopCard: some View {
        let text: String? = switch flow.line {
        case .line(let s), .offline(let s): s
        case .waiting, .none: nil
        }
        if let text {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    LivingOrb(palette: Hue.forma.orb, size: 22, level: 0.85, glow: false, motion: motion).allowsHitTesting(false)
                    NKMono("BOOP")
                }
                Text(text).nkFont(18, design: .serif).lineSpacing(4).foregroundStyle(.white.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            .accessibilityElement(children: .combine)
            .transition(.opacity)
        }
    }

    // MARK: - The sentence

    /// The row shows "Elmentve" only once the phone has kept the sentence.
    private func typed(_ text: String) {
        Task { if await flow.addNote(text) { voice = .saved(text: text, typed: true) } }
    }

    /// One tap to talk, one to stop. The phone's transcript becomes the note right away; a recording it could not write
    /// down waits as a `voice` item and becomes the note once the server has written it (spec §7.2, Task 10 ruling).
    private func mic() {
        guard let recorder = env.recorder else { return }
        switch voice {
        case .idle:
            micProblem = nil
            Task {
                do { try await recorder.start(); voice = .recording(seconds: 0); tick() }
                catch { voice = .idle; micProblem = MicCopy.line(for: error) }
            }
        case .recording:
            voice = .transcribing
            Task {
                switch await recorder.stop() {
                case .transcript(let raw)?:
                    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                    voice = await flow.addNote(text) ? .saved(text: text, typed: false) : .idle
                case .recording(let name)?:
                    switch await flow.addVoiceNote(fileName: name) {
                    case .transcribed(let text): voice = .saved(text: text.isEmpty ? nil : text, typed: false)
                    case .waiting: voice = .saved(text: nil, typed: false)
                    case .failed: voice = .idle
                    }
                case nil:
                    voice = .idle
                }
            }
        default: break
        }
    }

    /// The recording's seconds.
    private func tick() {
        Task {
            while case .recording(let s) = voice {
                try? await Task.sleep(for: .seconds(1))
                if case .recording = voice { voice = .recording(seconds: s + 1) }
            }
        }
    }

    // MARK: - Copy

    static let coreLabels = ["energy": "Energia", "mood": "Hangulat", "stress": "Feszültség", "body": "Test", "mental": "Fejtisztaság"]
    static let coreOrder = ["energy", "mood", "stress", "body", "mental"]

    /// The asked items in ask order (rows from the web carry none: their answered items), the question of the day as
    /// "A nap kérdése"; an asked item without an answer is "—".
    static func answers(_ c: LedgerCheckIn) -> [CheckInDetailAnswer] {
        var keys = c.askedItems
        if keys.isEmpty {
            keys = coreOrder.filter { c.values[$0] != nil } + c.values.keys.filter { !coreOrder.contains($0) }.sorted()
            if c.pain != nil { keys.append("pain") }
        }
        return keys.map { key in
            let value: String? = key == "pain"
                ? (c.pain == false ? "Nem" : c.painIntensity.map(String.init))
                : c.values[key].map(String.init)
            let chosen = key == "pain" ? (c.pain == true ? c.painRegions : []) : key == "craving" ? c.cravingKinds : []
            let labels = optionLabels(key)
            let detail = chosen.isEmpty ? nil : chosen.map { labels[$0] ?? $0 }.joined(separator: ", ")
            return CheckInDetailAnswer(label: coreLabels[key] ?? "A nap kérdése", value: value, detail: detail)
        }
    }

    /// The Hungarian labels of an item's chips (pain regions, craving kinds).
    private static func optionLabels(_ key: String) -> [String: String] {
        let q = CheckInQuestions.questions(plan: CheckInPlanLite(slot: "", adaptiveItem: key, adaptiveWhy: nil)).last
        guard let q, q.key == key else { return [:] }
        return Dictionary(uniqueKeysWithValues: q.options.map { ($0.id, $0.label) })
    }

    /// What the watch said at that check-in (any dot: its own snapshot); steps grouped like everywhere in Boop.
    static func figures(_ c: LedgerCheckIn) -> CheckInSnapshotFigures {
        guard let s = c.snapshot else { return CheckInSnapshotFigures() }
        return CheckInSnapshotFigures(hr: s.hrBpm, hrv: s.hrvMs, hrvUsual: s.hrvUsualMs, steps: s.steps.map(grouped),
                                      sleepMinutes: s.sleepMinutes)
    }

    /// The slot's moment name: "Reggel", "Délben", "Délután"; the evening slot "Este".
    static func slotName(_ slot: String) -> String {
        if let m = CheckInMoment.allCases.first(where: { $0.slotId == slot }) { return CheckinFlow.momentName(m) }
        return slot == "20:00" ? "Este" : slot
    }
}
