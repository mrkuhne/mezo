import SwiftUI

// Throwaway spike (mezo-r36n9.13, B3 Napi ritmus, 2026-11-11): the daily loop on top of B2's spine.
// Shared state + parts: the day model, one-tap level rows, the energy-of-the-day curve with the owner's own dots,
// the biomarker snapshot, the voice recorder, the offline chip, the tap counter. Fake data, no networking.
// Launch: -ritmus YES [-ritmusTab 0–3] [-ritmusPhase 0|1|2] [-ritmusOffline YES]
//         [-ritmusOpen checkin|checkinDone|este|esteDone|chat|lock|widget] [-ritmusScroll reggel|napkozben|este]

enum RArg {
    static var offline: Bool { UserDefaults.standard.bool(forKey: "ritmusOffline") }
    static var open: String? { GArg.str("ritmusOpen") }
}

/// What the watch / phone said at the moment of a check-in (B1 keeps the samples; B3 freezes them on save).
struct RSnapshot: Equatable {
    var hr: Int, hrv: Int, hrvUsual: Int, steps: Int, sleep: String
}

struct RCheckin: Identifiable, Equatable {
    let id = UUID()
    let t: Double, time: String, slot: String
    var energy: Int
    var others: [(String, Int)]
    var note: String? = nil
    var snap: RSnapshot
    var pending = false            // saved on the phone, not sent yet (offline)
    static func == (a: RCheckin, b: RCheckin) -> Bool { a.id == b.id && a.energy == b.energy && a.pending == b.pending }
}

@Observable final class RitmusDay {
    var offline = RArg.offline
    var goal: String? = nil
    var goalOutcome: Int? = nil                 // 0 sikerült · 1 részben · 2 nem
    var planAccepted = false
    var closed = false
    var dayRating = 0
    var eveningEnergy: Int? = nil
    var journal: String? = nil
    var checkins: [RCheckin] = [
        RCheckin(t: 7.33, time: "07:20", slot: "Reggel", energy: 7, others: [("Hangulat", 8), ("Feszültség", 3), ("Test", 7), ("Fejtisztaság", 8), ("Kipihentség", 7)],
                 snap: RSnapshot(hr: 61, hrv: 52, hrvUsual: 50, steps: 320, sleep: "7ó 12p")),
        RCheckin(t: 12.67, time: "12:40", slot: "Délben", energy: 6, others: [("Hangulat", 7), ("Feszültség", 5), ("Test", 6), ("Fejtisztaság", 6), ("Éhség", 7)],
                 note: "Hosszú volt a workshop, kicsit leeresztettem.",
                 snap: RSnapshot(hr: 74, hrv: 41, hrvUsual: 50, steps: 4_860, sleep: "7ó 12p")),
    ]

    /// Boop's prediction for the day, 06:00 → 24:00 hourly (0…1) — the dashed line the dots are compared with.
    let predicted: [Double] = [0.52, 0.68, 0.78, 0.82, 0.80, 0.74, 0.66, 0.60, 0.62, 0.66, 0.62, 0.56, 0.62, 0.66, 0.56, 0.46, 0.38, 0.30, 0.24]

    func predictedAt(_ t: Double) -> Double {
        let x = min(17.999, max(0, t - 6)); let i = Int(x); let f = x - Double(i)
        return predicted[i] * (1 - f) + predicted[min(18, i + 1)] * f
    }

    init() {
        let o = RArg.open
        if o == "checkinDone" { addAfternoon(energy: 5, others: [("Hangulat", 6), ("Feszültség", 6), ("Test", 6), ("Fejtisztaság", 4), ("A nap kérdése", 7)]) }
        if o == "esteDone" || o == "checkinDone" { goal = "Ügyfélprezentáció 14:00"; planAccepted = true }
        if o == "esteDone" { addAfternoon(energy: 5, others: [("Hangulat", 6), ("Feszültség", 6), ("Test", 6), ("Fejtisztaság", 4), ("A nap kérdése", 7)])
            closed = true; dayRating = 4; goalOutcome = 0; eveningEnergy = 4
            journal = "Jól ment a prezentáció, a röpi után kellemesen elfáradtam. A vacsora kicsit késő lett." }
    }

    func addAfternoon(energy: Int, others: [(String, Int)], note: String? = nil) {
        checkins.append(RCheckin(t: 16.0, time: "16:02", slot: "Délután", energy: energy, others: others, note: note,
                                 snap: RSnapshot(hr: 78, hrv: 38, hrvUsual: 50, steps: 7_420, sleep: "7ó 12p"), pending: offline))
    }
}

// MARK: - One tap = one answer: ten small level orbs under the question

struct RLevelRow: View {
    var palette: [Color]
    var value: Int?
    var count = 10
    var size: CGFloat = 30
    var motion: OrbMotion? = nil          // living orbs (the default Napkelte look) when given
    var onPick: (Int) -> Void
    var body: some View {
        HStack(spacing: 0) {
            ForEach(1...count, id: \.self) { k in
                let on = value.map { k <= $0 } ?? false
                VStack(spacing: 5) {
                    orb(k)
                        .saturation(on ? 1 : 0.15).opacity(on ? 1 : 0.5)
                        .scaleEffect(value == k ? 1.18 : 1)
                    Text("\(k)").font(.custom("Outfit", size: 13).weight(value == k ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(value == k ? 1 : 0.55))
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { onPick(k) }
                .accessibilityLabel("\(k)")
                .accessibilityAddTraits(.isButton)
            }
        }
        .sensoryFeedback(.selection, trigger: value)
    }
    @ViewBuilder private func orb(_ k: Int) -> some View {
        let lv = Double(k) / Double(count)
        if let motion { LivingOrb(mood: .good, size: size, motion: motion, palette: palette, glow: false, level: lv).allowsHitTesting(false) }
        else { StillOrb(colors: palette, size: size, level: lv) }
    }
}

// MARK: - New glyph: microphone (Napkelte outline family, 64-unit grid) — goes on the "új ikonok" list

struct RMicGlyph: View {
    var color: Color = .white
    var size: CGFloat = 22
    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
            let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
            ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 23, y: 8, width: 18, height: 32), cornerSize: CGSize(width: 9, height: 9)) }, with: .color(color), style: st)
            ctx.stroke(P { $0.addArc(center: CGPoint(x: 32, y: 30), radius: 16, startAngle: .degrees(0), endAngle: .degrees(180), clockwise: false) }, with: .color(color), style: st)
            ctx.stroke(P { $0.move(to: CGPoint(x: 32, y: 46)); $0.addLine(to: CGPoint(x: 32, y: 56)); $0.move(to: CGPoint(x: 24, y: 56)); $0.addLine(to: CGPoint(x: 40, y: 56)) }, with: .color(color), style: st)
        }
        .frame(width: size, height: size).accessibilityHidden(true)
    }
}

/// New glyph: cloud with a slash — "nincs net" (offline). Outline family.
struct ROfflineGlyph: View {
    var color: Color = .white
    var size: CGFloat = 16
    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
            let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
            ctx.stroke(P {
                $0.move(to: CGPoint(x: 18, y: 48)); $0.addLine(to: CGPoint(x: 46, y: 48))
                $0.addArc(center: CGPoint(x: 46, y: 38), radius: 10, startAngle: .degrees(90), endAngle: .degrees(-60), clockwise: true)
                $0.addArc(center: CGPoint(x: 32, y: 28), radius: 14, startAngle: .degrees(-20), endAngle: .degrees(-170), clockwise: true)
                $0.addArc(center: CGPoint(x: 18, y: 38), radius: 10, startAngle: .degrees(-100), endAngle: .degrees(90), clockwise: true)
            }, with: .color(color), style: st)
            ctx.stroke(P { $0.move(to: CGPoint(x: 10, y: 10)); $0.addLine(to: CGPoint(x: 54, y: 56)) }, with: .color(color), style: st)
        }
        .frame(width: size, height: size).accessibilityHidden(true)
    }
}

/// "Saved on the phone, sent when there is net" — one quiet line, never a blocker.
struct ROfflineChip: View {
    var text = "Nincs net · a telefonon van, elküldöm, amint lesz"
    var body: some View {
        HStack(spacing: 8) {
            ROfflineGlyph(color: .white.opacity(0.8), size: 16)
            Text(text).font(.system(size: 13, weight: .medium)).foregroundStyle(.white.opacity(0.8))
        }
        .padding(.horizontal, 14).frame(height: 34)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
    }
}

/// Spike-only: the tap count of a flow, shown where it ends (the design goal is counted, not guessed).
struct RTapCount: View {
    var taps: Int
    var swipes = 0
    var seconds: Int? = nil
    var body: some View {
        let g = swipes > 0 ? "\(swipes) húzás · \(taps) koppintás" : "\(taps) koppintás"
        Text(seconds.map { "\(g) · \($0) mp" } ?? g)
            .font(AuraFont.mono(11, .semibold)).tracking(1).foregroundStyle(.white.opacity(0.5))
    }
}

// MARK: - Biomarker snapshot: what the watch said at that moment

struct RSnapRow: View {
    var s: RSnapshot
    var compact = false
    var body: some View {
        HStack(spacing: compact ? 12 : 0) {
            cell("heart-cream", "\(s.hr)", "pulzus")
            cell("spark-cream", "\(s.hrv)", s.hrv < s.hrvUsual - 5 ? "HRV · lejjebb" : "HRV")
            cell("shoe-cream", s.steps.formatted(.number.locale(Locale(identifier: "hu_HU"))), "lépés")
            cell("moon-cream", s.sleep, "alvás")
        }
    }
    private func cell(_ g: String, _ v: String, _ l: String) -> some View {
        VStack(spacing: 3) {
            HStack(spacing: 5) {
                AuraGlyph(g, .white.opacity(0.8), size: 13)
                Text(v).font(.system(size: compact ? 15 : 17, weight: .medium, design: .rounded)).foregroundStyle(.white)
            }
            Text(l).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
        }
        .frame(maxWidth: compact ? nil : .infinity)
    }
}

// MARK: - The energy of the day: Boop's dashed prediction + the owner's own dots (the payoff of every check-in)

struct REnergyCurve: View {
    var day: RitmusDay
    var now: Double
    var hue: Color
    @Binding var selected: UUID?
    var height: CGFloat = 150

    var body: some View {
        VStack(spacing: 10) {
            GeometryReader { g in
                let W = g.size.width, H = g.size.height - 18
                let x: (Double) -> CGFloat = { CGFloat(($0 - 6) / 18) * W }
                let y: (Double) -> CGFloat = { H - CGFloat($0) * (H - 10) }
                ZStack(alignment: .topLeading) {
                    // prediction: soft fill + dashed line
                    let line = Path { p in
                        for k in 0...72 { let t = 6 + Double(k) * 0.25
                            let pt = CGPoint(x: x(t), y: y(day.predictedAt(t)))
                            if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) } }
                    }
                    Path { p in p.addPath(line); p.addLine(to: CGPoint(x: W, y: H)); p.addLine(to: CGPoint(x: 0, y: H)); p.closeSubpath() }
                        .fill(LinearGradient(colors: [hue.opacity(0.28), hue.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                    line.stroke(.white.opacity(0.45), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                    // the owner's line through the dots
                    let pts = day.checkins.map { CGPoint(x: x($0.t), y: y(Double($0.energy) / 10)) }
                    if pts.count > 1 {
                        Path { p in p.move(to: pts[0]); for q in pts.dropFirst() { p.addLine(to: q) } }
                            .stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                            .shadow(color: hue.opacity(0.9), radius: 6)
                    }
                    // now
                    Rectangle().fill(.white.opacity(0.35)).frame(width: 1, height: H).offset(x: x(now))
                    Text("most").font(AuraFont.mono(10, .semibold)).foregroundStyle(.white.opacity(0.6))
                        .offset(x: x(now) + 4, y: 0)
                    ForEach(day.checkins) { c in
                        let on = selected == c.id
                        ZStack {
                            Circle().fill(.white).frame(width: on ? 30 : 24)
                            Text("\(c.energy)").font(.custom("Outfit", size: 13).weight(.semibold)).foregroundStyle(gBase)
                        }
                        .overlay { if c.pending { Circle().stroke(.white.opacity(0.6), style: StrokeStyle(lineWidth: 1.2, dash: [2, 2])).frame(width: 34) } }
                        .shadow(color: hue.opacity(0.8), radius: on ? 10 : 6)
                        .position(x: x(c.t), y: y(Double(c.energy) / 10))
                        .onTapGesture { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { selected = on ? nil : c.id } }
                    }
                    // hour labels
                    ForEach([6, 9, 12, 15, 18, 21, 24], id: \.self) { h in
                        Text(String(format: "%02d", h % 24)).font(AuraFont.mono(10)).foregroundStyle(.white.opacity(0.4))
                            .position(x: min(W - 8, max(8, x(Double(h)))), y: H + 12)
                    }
                }
            }
            .frame(height: height)
            HStack(spacing: 14) {
                legend(dashed: true, "Boop jóslata")
                legend(dashed: false, "amit te mondtál")
                Spacer()
            }
        }
    }

    private func legend(dashed: Bool, _ t: String) -> some View {
        HStack(spacing: 6) {
            Path { p in p.move(to: CGPoint(x: 0, y: 4)); p.addLine(to: CGPoint(x: 18, y: 4)) }
                .stroke(.white.opacity(dashed ? 0.5 : 1), style: StrokeStyle(lineWidth: dashed ? 1.5 : 2, dash: dashed ? [3, 3] : []))
                .frame(width: 18, height: 8)
            Text(t).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6))
        }
    }
}

/// The detail under the curve for the tapped dot: the answers + the watch at that moment.
struct RCheckinDetail: View {
    var c: RCheckin
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                GLabel("\(c.slot.uppercased()) · \(c.time)")
                Spacer()
                if c.pending { ROfflineGlyph(color: .white.opacity(0.6), size: 14); Text("még a telefonon").font(.system(size: 12)).foregroundStyle(.white.opacity(0.6)) }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), alignment: .leading, spacing: 10) {
                answer("Energia", c.energy)
                ForEach(c.others, id: \.0) { answer($0.0, $0.1) }
            }
            if let n = c.note {
                Text("„\(n)”").font(AuraFont.serif(16)).foregroundStyle(.white.opacity(0.85))
            }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            GLabel("AZ ÓRÁD EKKOR")
            RSnapRow(s: c.snap)
        }
        .padding(18).gCard(22)
    }
    private func answer(_ l: String, _ v: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(v)").font(.custom("Outfit", size: 24).weight(.light)).foregroundStyle(.white)
            Text(l).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55))
        }
    }
}

// MARK: - Voice: one tap to talk, one tap to stop; Boop writes it down (later, when offline)

struct RVoiceRecorder: View {
    var offline: Bool
    var prompt = "Mesélj a napodról"
    var sample = "Jól ment a prezentáció, a röpi után kellemesen elfáradtam. A vacsora kicsit késő lett."
    @Binding var text: String?
    var onTap: () -> Void = {}
    @State private var recording = false
    @State private var writing = false
    @State private var elapsed = 0
    @State private var typed = ""
    @State private var draft = ""
    @FocusState private var typing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Button {
                    onTap()
                    if recording { stop() } else if text == nil { start() }
                } label: {
                    ZStack {
                        Circle().fill(recording ? .white : .white.opacity(0.1))
                        Circle().stroke(.white.opacity(0.25))
                        if recording { RoundedRectangle(cornerRadius: 4).fill(gBase).frame(width: 18, height: 18) }
                        else { RMicGlyph(color: .white, size: 26) }
                    }
                    .frame(width: 62, height: 62)
                }
                .buttonStyle(.plain)
                .disabled(text != nil && !recording)
                VStack(alignment: .leading, spacing: 4) {
                    if recording {
                        RWave().frame(height: 26)
                        Text(String(format: "0:%02d · koppints, ha kész", elapsed)).font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.6))
                    } else if writing {
                        Text("Leírom…").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    } else if text != nil {
                        Text(typedByHand ? "Elmentve" : (offline ? "Felvétel elmentve" : "Leírtam")).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                        Text(typedByHand ? "a nap mellé kerül" : (offline ? "szöveggé alakítom, amint lesz net" : "a nap mellé kerül")).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                    } else {
                        Text(prompt).font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                        Text("ha van kedved · mondd be vagy írd le").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                    }
                }
                Spacer()
            }
            if text == nil && !recording && !writing {
                // typing is as good as talking: the same text lands on the day
                HStack(spacing: 10) {
                    TextField("", text: $draft, prompt: Text("Vagy írd be…").foregroundStyle(.white.opacity(0.45)), axis: .vertical)
                        .lineLimit(1...5).font(.system(size: 15)).foregroundStyle(.white).tint(.white)
                        .focused($typing).submitLabel(.done)
                        .onSubmit { commitTyped() }
                    if !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button { commitTyped() } label: {
                            Image(systemName: "arrow.up").font(.system(size: 14, weight: .bold)).foregroundStyle(gBase)
                                .frame(width: 32, height: 32).background(Circle().fill(.white))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.leading, 16).padding(.trailing, 6).padding(.vertical, 8)
                .frame(minHeight: 46)
                .background(RoundedRectangle(cornerRadius: 23, style: .continuous).fill(.white.opacity(0.08)))
                .transition(.opacity)
            }
            if !typed.isEmpty {
                Text("„\(typed)”").font(AuraFont.serif(17)).lineSpacing(3).foregroundStyle(.white.opacity(0.9))
                    .transition(.opacity)
            }
        }
        .task(id: recording) {
            guard recording else { return }
            while recording && !Task.isCancelled { try? await Task.sleep(for: .seconds(1)); if recording { elapsed += 1 } }
        }
        .onAppear { if let t = text, !offline { typed = t } }
    }

    private func commitTyped() {
        let t = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        onTap(); typing = false
        withAnimation { typed = t; text = t; draft = ""; typedByHand = true }
    }
    @State private var typedByHand = false
    private func start() { withAnimation { recording = true; elapsed = 0; typing = false } }
    private func stop() {
        withAnimation { recording = false }
        if offline { text = sample; return }
        writing = true
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            writing = false; text = sample
            for w in sample.split(separator: " ") {
                try? await Task.sleep(for: .milliseconds(70))
                withAnimation(.easeOut(duration: 0.1)) { typed += (typed.isEmpty ? "" : " ") + w }
            }
        }
    }
}

struct RWave: View {
    var body: some View {
        TimelineView(.animation) { tl in
            let t = tl.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<26, id: \.self) { i in
                    let v = 0.25 + 0.75 * abs(sin(t * 5 + Double(i) * 0.7) * cos(t * 2.3 + Double(i) * 0.31))
                    Capsule().fill(.white.opacity(0.85)).frame(width: 3, height: 26 * v)
                }
            }
        }
    }
}
