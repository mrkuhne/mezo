import SwiftUI

// B3 Napi ritmus parts (spec docs/superpowers/specs/2026-11-11-boop-b3-napi-ritmus-design.md §5.2–§5.4, approved spike
// `RitmusParts.swift`): the energy-of-the-day curve, the check-in detail with what the watch said, the one-tap level row,
// the offline chip and the voice-or-type row. Pure views: the app hands them its values.

// MARK: - Energy curve geometry

/// Where things sit on the energy-of-the-day curve: 06:00 → 24:00 across the width, a 0…1 level up the height.
public enum EnergyCurveGeometry {
    public static let startHour = 6.0
    public static let endHour = 24.0
    /// Room above a full 10 so its dot is not cut by the card's top.
    static let topInset: CGFloat = 10

    /// The x of an hour of the day (fractional), kept on the card at both ends.
    public static func x(hour: Double, width: CGFloat) -> CGFloat {
        let t = (min(endHour, max(startHour, hour)) - startHour) / (endHour - startHour)
        return CGFloat(t) * width
    }

    /// The y of a 0…1 level in a plot of `height` (0 at the bottom, 1 just under the top).
    public static func y(level: Double, height: CGFloat) -> CGFloat {
        height - CGFloat(min(1, max(0, level))) * (height - topInset)
    }

    /// The clock time of `date` as a fractional hour (16:03 → 16.05).
    public static func hour(of date: Date, calendar: Calendar) -> Double {
        let c = calendar.dateComponents([.hour, .minute, .second], from: date)
        return Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60 + Double(c.second ?? 0) / 3600
    }

    /// Boop's prediction at `hour`, linear between the brief's hourly values (06:00 … 24:00); nil without a prediction.
    public static func predicted(_ hourly: [Double], at hour: Double) -> Double? {
        guard !hourly.isEmpty else { return nil }
        let x = min(Double(hourly.count - 1), max(0, hour - startHour))
        let i = Int(x), f = x - Double(i)
        return hourly[i] * (1 - f) + hourly[min(hourly.count - 1, i + 1)] * f
    }
}

/// One of the owner's answers on the curve.
public struct EnergyCurveDot: Identifiable, Equatable, Sendable {
    public let id: UUID
    /// Fractional hour of the capture.
    public let hour: Double
    /// 1–10.
    public let energy: Int
    /// Still on the phone (a dashed ring).
    public let pending: Bool
    public init(id: UUID, hour: Double, energy: Int, pending: Bool) {
        self.id = id; self.hour = hour; self.energy = energy; self.pending = pending
    }
}

/// The energy of the day (spec §5.3): Boop's dashed prediction over a soft fill, the owner's solid line through white
/// numbered dots, a "most" line, hour ticks and a legend, on a glass card. Tapping a dot selects it (again: clears).
public struct EnergyCurveCard: View {
    let title: String, predicted: [Double], dots: [EnergyCurveDot], now: Double?, hue: Hue, height: CGFloat
    @Binding var selected: UUID?

    public init(title: String, predicted: [Double], dots: [EnergyCurveDot], now: Double?, hue: Hue = .mozgas,
                selected: Binding<UUID?>, height: CGFloat = 150) {
        self.title = title; self.predicted = predicted; self.dots = dots; self.now = now; self.hue = hue
        self._selected = selected; self.height = height
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono(title)
            VStack(spacing: 10) {
                GeometryReader { g in plot(width: g.size.width, plotHeight: g.size.height - 18) }
                    .frame(height: height)
                HStack(spacing: 14) {
                    legend(dashed: true, "Boop jóslata")
                    legend(dashed: false, "amit te mondtál")
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }

    @ViewBuilder private func plot(width w: CGFloat, plotHeight h: CGFloat) -> some View {
        let x = { (t: Double) in EnergyCurveGeometry.x(hour: t, width: w) }
        let y = { (l: Double) in EnergyCurveGeometry.y(level: l, height: h) }
        ZStack(alignment: .topLeading) {
            if !predicted.isEmpty {
                let line = Path { p in
                    for k in 0...72 {
                        let t = EnergyCurveGeometry.startHour + Double(k) * 0.25
                        let pt = CGPoint(x: x(t), y: y(EnergyCurveGeometry.predicted(predicted, at: t) ?? 0))
                        if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                    }
                }
                Path { p in p.addPath(line); p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.closeSubpath() }
                    .fill(LinearGradient(colors: [hue.glow.opacity(0.28), hue.glow.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                line.stroke(.white.opacity(0.45), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            }
            let pts = dots.map { CGPoint(x: x($0.hour), y: y(Double($0.energy) / 10)) }
            if pts.count > 1 {
                Path { p in p.move(to: pts[0]); for q in pts.dropFirst() { p.addLine(to: q) } }
                    .stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .shadow(color: hue.glow.opacity(0.9), radius: 6)
            }
            if let now, (EnergyCurveGeometry.startHour...EnergyCurveGeometry.endHour).contains(now) {
                Rectangle().fill(.white.opacity(0.35)).frame(width: 1, height: h).offset(x: x(now))
                Text("most").nkFont(10, .semibold, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    .offset(x: x(now) + 4, y: 0)
            }
            ForEach(dots) { d in
                let on = selected == d.id
                ZStack {
                    Circle().fill(.white).frame(width: on ? 30 : 24)
                    Text("\(d.energy)").font(.custom(Lagy.outfitFamily, size: 13).weight(.semibold)).foregroundStyle(NK.ground)
                }
                .overlay {
                    if d.pending {
                        Circle().stroke(.white.opacity(0.7), style: StrokeStyle(lineWidth: 1.2, dash: [2, 2])).frame(width: (on ? 30 : 24) + 12, height: (on ? 30 : 24) + 12)
                    }
                }
                .shadow(color: hue.glow.opacity(0.8), radius: on ? 10 : 6)
                .frame(width: 44, height: 44).contentShape(Circle())
                .position(x: x(d.hour), y: y(Double(d.energy) / 10))
                .onTapGesture { withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { selected = on ? nil : d.id } }
                .accessibilityElement()
                .accessibilityLabel("energia \(d.energy)\(d.pending ? ", még a telefonon" : "")")
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
            ForEach([6, 9, 12, 15, 18, 21, 24], id: \.self) { hr in
                Text(String(format: "%02d", hr % 24)).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                    .position(x: min(w - 8, max(8, x(Double(hr)))), y: h + 12)
                    .accessibilityHidden(true)
            }
        }
    }

    private func legend(dashed: Bool, _ text: String) -> some View {
        HStack(spacing: 6) {
            Path { p in p.move(to: CGPoint(x: 0, y: 4)); p.addLine(to: CGPoint(x: 18, y: 4)) }
                .stroke(.white.opacity(dashed ? 0.5 : 1), style: StrokeStyle(lineWidth: dashed ? 1.5 : 2, dash: dashed ? [3, 3] : []))
                .frame(width: 18, height: 8)
            Text(text).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
    }
}

// MARK: - Check-in detail

/// One answer in the detail grid; `value` nil = asked but not answered ("—").
public struct CheckInDetailAnswer: Equatable, Sendable {
    public let label: String
    public let value: String?
    public init(label: String, value: String?) { self.label = label; self.value = value }
}

/// What the watch / phone said at the moment of a check-in; every figure may be missing ("—").
public struct CheckInSnapshotFigures: Equatable, Sendable {
    public var hr: Int?, hrv: Double?, hrvUsual: Double?, steps: Int?, sleepMinutes: Int?
    public init(hr: Int? = nil, hrv: Double? = nil, hrvUsual: Double? = nil, steps: Int? = nil, sleepMinutes: Int? = nil) {
        self.hr = hr; self.hrv = hrv; self.hrvUsual = hrvUsual; self.steps = steps; self.sleepMinutes = sleepMinutes
    }
}

/// "HRV · lejjebb" when the reading is below the owner's usual (14-day median), else "HRV".
func snapshotHrvLabel(hrv: Double?, usual: Double?) -> String {
    if let hrv, let usual, hrv < usual { return "HRV · lejjebb" }
    return "HRV"
}

/// Sleep minutes as "7ó 12p"; "—" when unknown.
func snapshotSleep(minutes: Int?) -> String {
    guard let minutes else { return "—" }
    return "\(minutes / 60)ó \(minutes % 60)p"
}

/// The detail of one check-in (spec §5.2): its answers in three columns, the optional sentence, then "AZ ÓRÁD EKKOR":
/// pulzus · HRV (with "lejjebb") · lépés · alvás.
public struct CheckInDetail: View {
    let heading: String, pending: Bool, answers: [CheckInDetailAnswer], note: String?, snapshot: CheckInSnapshotFigures

    public init(heading: String, pending: Bool, answers: [CheckInDetailAnswer], note: String?, snapshot: CheckInSnapshotFigures) {
        self.heading = heading; self.pending = pending; self.answers = answers; self.note = note; self.snapshot = snapshot
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                NKMono(heading)
                Spacer(minLength: 0)
                if pending {
                    NKGlyph("offline", .white.opacity(0.6), size: 14)
                    Text("még a telefonon").nkFont(12).foregroundStyle(.white.opacity(0.6))
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .leading), count: 3), alignment: .leading, spacing: 10) {
                ForEach(answers.indices, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(answers[i].value ?? "—").font(.nkNumber(24)).foregroundStyle(.white)
                        Text(answers[i].label).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            if let note, !note.isEmpty {
                Text("„\(note)”").nkFont(16, design: .serif).foregroundStyle(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
            NKMono("AZ ÓRÁD EKKOR")
            HStack(spacing: 0) {
                cell("heart-cream", snapshot.hr.map(String.init) ?? "—", "pulzus")
                cell("spark-cream", snapshot.hrv.map { String(Int($0.rounded())) } ?? "—",
                     snapshotHrvLabel(hrv: snapshot.hrv, usual: snapshot.hrvUsual))
                cell("shoe-cream", snapshot.steps.map { $0.formatted(.number.locale(Locale(identifier: "hu_HU"))) } ?? "—", "lépés")
                cell("moon-cream", snapshotSleep(minutes: snapshot.sleepMinutes), "alvás")
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(22)
    }

    private func cell(_ glyph: String, _ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            HStack(spacing: 5) {
                NKGlyph(glyph, .white.opacity(0.8), size: 13)
                Text(value).nkFont(17, .medium).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            }
            Text(label).nkFont(11).foregroundStyle(.white.opacity(0.5)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - One tap = one answer

/// Ten small living level orbs with their numbers; a tap picks one (the evening's energy, the day's rating).
public struct LevelRow: View {
    let palette: [Color], value: Int?, count: Int, size: CGFloat, motion: OrbMotion, onPick: (Int) -> Void

    public init(palette: [Color], value: Int?, count: Int = 10, size: CGFloat = 30, motion: OrbMotion, onPick: @escaping (Int) -> Void) {
        self.palette = palette; self.value = value; self.count = count; self.size = size; self.motion = motion; self.onPick = onPick
    }

    public var body: some View {
        HStack(spacing: 0) {
            ForEach(1...max(1, count), id: \.self) { k in
                let on = value.map { k <= $0 } ?? false
                VStack(spacing: 5) {
                    LivingOrb(palette: palette, size: size, level: Double(k) / Double(count), glow: false, motion: motion)
                        .allowsHitTesting(false)
                        .saturation(on ? 1 : 0.15).opacity(on ? 1 : 0.5)
                        .scaleEffect(value == k ? 1.18 : 1)
                    Text("\(k)").font(.custom(Lagy.outfitFamily, size: 13).weight(value == k ? .semibold : .regular))
                        .foregroundStyle(.white.opacity(value == k ? 1 : 0.55))
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
                .onTapGesture { onPick(k) }
                .accessibilityElement()
                .accessibilityLabel("\(k)")
                .accessibilityAddTraits(value == k ? [.isButton, .isSelected] : .isButton)
            }
        }
        .sensoryFeedback(.selection, trigger: value)
    }
}

// MARK: - Offline

/// "Saved on the phone, sent when there is net" — one quiet line, never a blocker.
public struct OfflineChip: View {
    let text: String
    public init(_ text: String = "Nincs net · a telefonon van, elküldöm, amint lesz") { self.text = text }
    public var body: some View {
        HStack(spacing: 8) {
            NKGlyph("offline", .white.opacity(0.8), size: 16)
            Text(text).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8)).lineLimit(2).multilineTextAlignment(.leading)
        }
        .padding(.horizontal, 14).padding(.vertical, 8).frame(minHeight: 34)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Voice or type

/// Where the voice-or-type row is.
public enum VoiceRowPhase: Equatable, Sendable {
    case idle
    case recording(seconds: Int)
    /// The recording is being written down.
    case transcribing
    /// The sentence is in: typed by hand or spoken (`text` nil while a recording waits for the net to be written down).
    case saved(text: String?, typed: Bool)
}

/// One tap to talk, one to stop — or type it in the "Vagy írd be…" field under the mic (spec §5.4); typed text needs no
/// transcription. The row only shows the phase; the app owns the recording.
public struct VoiceRecorderRow: View {
    let phase: VoiceRowPhase, prompt: String, micEnabled: Bool, onMic: () -> Void, onTyped: (String) -> Void
    @State private var draft = ""
    @FocusState private var typing: Bool

    public init(phase: VoiceRowPhase, prompt: String, micEnabled: Bool = true, onMic: @escaping () -> Void,
                onTyped: @escaping (String) -> Void) {
        self.phase = phase; self.prompt = prompt; self.micEnabled = micEnabled; self.onMic = onMic; self.onTyped = onTyped
    }

    private var recording: Bool { if case .recording = phase { true } else { false } }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Button {
                    typing = false
                    onMic()
                } label: {
                    ZStack {
                        Circle().fill(recording ? .white : .white.opacity(0.1))
                        Circle().stroke(.white.opacity(0.25))
                        if recording { RoundedRectangle(cornerRadius: 4).fill(NK.ground).frame(width: 18, height: 18) }
                        else { NKGlyph("mic", .white, size: 26) }
                    }
                    .frame(width: 62, height: 62)
                }
                .buttonStyle(PressStyle())
                .disabled(!micEnabled || !(phase == .idle || recording))
                .opacity(micEnabled ? 1 : 0.45)
                .accessibilityLabel(recording ? "Felvétel leállítása" : "Felvétel indítása")
                VStack(alignment: .leading, spacing: 4) { caption }
                Spacer(minLength: 0)
            }
            if phase == .idle {
                HStack(spacing: 10) {
                    TextField("", text: $draft, prompt: Text("Vagy írd be…").foregroundStyle(.white.opacity(0.45)), axis: .vertical)
                        .lineLimit(1...5).nkFont(15).foregroundStyle(.white).tint(.white)
                        .focused($typing).submitLabel(.done)
                        .onSubmit(commitTyped)
                    if !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button(action: commitTyped) {
                            Image(systemName: "arrow.up").font(.system(size: 14, weight: .bold)).foregroundStyle(NK.ground)
                                .frame(width: 32, height: 32).background(Circle().fill(.white))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Elküldöm")
                    }
                }
                .padding(.leading, 16).padding(.trailing, 6).padding(.vertical, 8)
                .frame(minHeight: 46)
                .background(RoundedRectangle(cornerRadius: 23, style: .continuous).fill(.white.opacity(0.08)))
                .transition(.opacity)
            }
            if case .saved(let text?, _) = phase {
                Text("„\(text)”").nkFont(17, design: .serif).lineSpacing(3).foregroundStyle(.white.opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: phase)
    }

    @ViewBuilder private var caption: some View {
        switch phase {
        case .recording(let seconds):
            VoiceWave().frame(height: 26)
            Text(String(format: "%d:%02d · koppints, ha kész", seconds / 60, seconds % 60))
                .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.6))
        case .transcribing:
            Text("Leírom…").nkFont(15, .medium).foregroundStyle(.white)
        case .saved(let text, let typed):
            Text(typed ? "Elmentve" : (text == nil ? "Felvétel elmentve" : "Leírtam")).nkFont(15, .medium).foregroundStyle(.white)
            Text(text == nil ? "szöveggé alakítom, amint lesz net" : "a nap mellé kerül").nkFont(13).foregroundStyle(.white.opacity(0.55))
        case .idle:
            Text(prompt).nkFont(16, .medium).foregroundStyle(.white)
            Text("ha van kedved · mondd be vagy írd le").nkFont(13).foregroundStyle(.white.opacity(0.55))
        }
    }

    private func commitTyped() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        typing = false
        draft = ""
        onTyped(text)
    }
}

/// The recording's moving bars (still under reduced motion).
struct VoiceWave: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let t = reduceMotion ? 1.0 : tl.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<26, id: \.self) { i in
                    let v = 0.25 + 0.75 * abs(sin(t * 5 + Double(i) * 0.7) * cos(t * 2.3 + Double(i) * 0.31))
                    Capsule().fill(.white.opacity(0.85)).frame(width: 3, height: 26 * v)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
