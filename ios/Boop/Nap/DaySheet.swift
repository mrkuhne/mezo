import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The energy magnifier, as pure functions (spec §9.5, §10.3)

/// What the magnifier reads: the hourly energy (06:00 … 24:00, one value per hour), the 72 busy quarter hours from 06:00,
/// today's session and meals.
struct MagnifierInput {
    struct Session { let title: String, time: String; let minutes: Int? }
    struct Meal { let time: String, title: String }
    let hourly: [Double]
    let busy: [Bool]
    let session: Session?
    let meals: [Meal]
}

extension MagnifierInput {
    init(_ b: Brief) {
        let d = b.day
        self.init(hourly: b.energy.hourly, busy: d.calendar.busySlots,
                  session: d.session.flatMap { s in (s.time ?? s.plannedTime).map { Session(title: s.title, time: $0, minutes: s.minutes) } },
                  meals: d.meals.map { Meal(time: $0.time, title: $0.title) })
    }
}

struct MagnifierReading: Equatable {
    /// Minutes from midnight, snapped to the quarter hour, 360…1440.
    let minutes: Int
    let time: String
    /// The energy at that time 0…1; nil without a curve.
    let level: Double?
    let percent: Int?
    /// What is on: "Edzés · Vállak és hát", "Megbeszélés", a meal, or "Szabad idő".
    let what: String
    /// The hour the reading is in (a soft haptic per change).
    let hour: Int
}

/// The position of a time on the hourly curve: 06:00 = 0 … 24:00 = 18 (clamped).
func energyIndex(minutes: Int) -> Double { min(18, max(0, Double(minutes - 360) / 60)) }

/// The curve at a time, linear between the hourly values; past the last value it holds the end. nil without a curve.
func energyLevel(_ hourly: [Double], minutes: Int) -> Double? {
    guard !hourly.isEmpty else { return nil }
    let f = min(Double(hourly.count - 1), energyIndex(minutes: minutes))
    let i = Int(f), j = min(hourly.count - 1, i + 1)
    return hourly[i] + (hourly[j] - hourly[i]) * (f - Double(i))
}

private func clockMinutes(_ hhmm: String) -> Int? {
    let p = hhmm.split(separator: ":")
    guard p.count == 2, let h = Int(p[0]), let m = Int(p[1]) else { return nil }
    return h * 60 + m
}

/// The reading under a finger at `fraction` (0 = 06:00, 1 = 24:00) of the curve's width.
func magnifierReading(fraction: Double, _ x: MagnifierInput) -> MagnifierReading {
    let f = min(1, max(0, fraction))
    let minutes = 360 + Int((f * 72 + 1e-9).rounded(.down)) * 15      // 72 quarter hours; epsilon keeps 15:30 at 15:30
    let time = minutes == 1440 ? "24:00" : String(format: "%02d:%02d", minutes / 60, minutes % 60)
    let level = energyLevel(x.hourly, minutes: minutes)
    var what: [String] = []
    if let s = x.session, let start = clockMinutes(s.time), (start..<(start + (s.minutes ?? 60))).contains(minutes) {
        what.append("Edzés · \(s.title)")
    }
    for m in x.meals {
        if let start = clockMinutes(m.time), (start..<(start + 30)).contains(minutes) { what.append(m.title) }
    }
    let slot = (minutes - 360) / 15
    if x.busy.indices.contains(slot), x.busy[slot] { what.append("Megbeszélés") }
    return MagnifierReading(minutes: minutes, time: time, level: level,
                            percent: level.map { Int((min(1, max(0, $0)) * 100).rounded()) },
                            what: what.isEmpty ? "Szabad idő" : what.joined(separator: " · "), hour: minutes / 60)
}

/// Where "now" sits on the 06:00–24:00 curve; nil outside it.
func nowFraction(minutes: Int) -> Double? {
    (360...1440).contains(minutes) ? Double(minutes - 360) / 1080 : nil
}

/// The sheet's headline from the calendar.
func dayTitle(events: Int, conflict: Bool) -> String {
    if conflict { return "Szoros, de belefér" }
    return events == 0 ? "Szabad napod van" : "Belefér minden"
}

// MARK: - The sheet (spec §5.4 A napod, spike AuraSheets + EnergyCurve's magnifier)

/// Today: the energy curve with a press-and-drag magnifier, the busy ribbon, the conflict card (move / keep), Boop.
struct DaySheet: View {
    let brief: Brief
    let store: MorningStore
    let ctx: MaiContext
    let close: () -> Void
    @State private var kept = false

    private var conflict: Brief.Conflict? {
        guard !kept, let c = brief.conflict else { return nil }
        let s = brief.day.session
        return sessionMoved(planned: s?.plannedTime, time: s?.time) ? nil : c
    }

    var body: some View {
        let d = brief.day
        let eyebrow = weekdayName(brief.date).map { "\($0) · a napod" } ?? "A napod"
        NKSheetFrame(hue: .mozgas, eyebrow: eyebrow, title: dayTitle(events: d.calendar.count, conflict: conflict != nil)) {
            SheetCard(title: "ENERGIA ÉS NAPTÁR") {
                if brief.energy.hourly.count > 1 {
                    EnergyMagnifier(input: MagnifierInput(brief)).frame(height: 120).padding(.top, 14)
                } else {
                    SheetEmptyLine(text: "Az energiagörbédet még nem tudom megrajzolni.")
                }
                BusyRibbon(slots: d.calendar.busySlots.map { $0 ? 1 : 0 }, trainingSlot: trainingSlot(d.session))
                    .frame(height: 14).padding(.top, 8)
                HStack {
                    ForEach(Array([6, 9, 12, 15, 18, 21, 24].enumerated()), id: \.offset) { i, h in
                        if i > 0 { Spacer() }
                        Text("\(h)")
                    }
                }
                .nkFont(11, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.45)).padding(.top, 6)
                Text(d.calendar.count == 0 ? "Ma nincs esemény a naptáradban" : "\(d.calendar.count) esemény · Naptár")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5)).padding(.top, 8)
                if brief.energy.hourly.count > 1 {
                    Text("Tartsd lenyomva a görbét, és húzd végig").nkFont(12).foregroundStyle(.white.opacity(0.4))
                }
            }
            if let conflict { conflictCard(conflict).transition(.opacity.combined(with: .scale(scale: 0.96))) }
            if let dip = brief.energy.dipHour {
                NKBoopCard(pre: "\(dip):00 körül jön egy mélypont: ", em: "oda tegyél egy rövid sétát",
                           post: ", ne egy újabb kávét. " + brief.tonightTip)
            } else if !brief.tonightTip.isEmpty {
                NKBoopCard(pre: "", em: "", post: brief.tonightTip)
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: kept)
    }

    private func conflictCard(_ c: Brief.Conflict) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                NKGlyph("clock-ink", .white, size: 16)
                NKMono("ÜTKÖZÉS")
            }
            Text(c.text).nkFont(15.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                NKPill(moveButtonTitle(c.suggestedTime), wide: false) { move(to: c.suggestedTime) }
                NKPill("Marad így", primary: false, wide: false) { kept = true }
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    /// The sheet closes so the page's toast (with its undo) is in view; the move runs on the page's store.
    private func move(to time: String) {
        let planned = brief.day.session?.plannedTime
        close()
        Task { @MainActor in
            await moveSession(store, to: time, planned: planned, toast: ctx.toast, undoToast: ctx.undoToast)
        }
    }
}

// MARK: - The curve with the magnifier

/// The energy curve; press, hold and drag to read time · energy % · what is on, a soft haptic per hour.
private struct EnergyMagnifier: View {
    let input: MagnifierInput
    @State private var fraction: Double?
    @State private var now = Date()

    private var nowAt: Double? {
        let c = Calendar.current.dateComponents([.hour, .minute], from: now)
        return nowFraction(minutes: (c.hour ?? 0) * 60 + (c.minute ?? 0))
    }

    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            ZStack(alignment: .topLeading) {
                GlowLine(points: input.hourly, nowAt: fraction == nil && debugFraction == nil ? nowAt : nil, glow: Hue.mozgas.glow)
                    .id(fraction == nil && debugFraction == nil)    // Canvas keeps its drawing otherwise; MOST hides under the lens
                if let f = fraction ?? debugFraction { lens(magnifierReading(fraction: f, input), w: w, h: h) }
            }
            .contentShape(Rectangle())
            .gesture(
                LongPressGesture(minimumDuration: 0.2)
                    .sequenced(before: DragGesture(minimumDistance: 0))
                    .onChanged { v in
                        if case .second(true, let d?) = v { fraction = max(0, min(1, d.location.x / max(1, w))) }
                    }
                    .onEnded { _ in withAnimation(.easeOut(duration: 0.2)) { fraction = nil } }
            )
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.45), trigger: fraction.map { magnifierReading(fraction: $0, input).hour })
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Energiagörbe")
        .accessibilityValue(spokenCurve)
    }

    /// VoiceOver: the curve read at a few hours.
    private var spokenCurve: String {
        [9, 12, 15, 18, 21].map { hh in
            let r = magnifierReading(fraction: Double(hh * 60 - 360) / 1080, input)
            return "\(hh) óra: \(r.percent.map { "\($0) százalék" } ?? "nincs adat")"
        }.joined(separator: ", ")
    }

    /// Simulator review: `-previewScrub 15.5` holds the magnifier at 15:30.
    private var debugFraction: Double? {
        #if DEBUG
        let hh = UserDefaults.standard.double(forKey: "previewScrub")
        if hh > 0 { return (hh - 6) / 18 }
        #endif
        return nil
    }

    @ViewBuilder private func lens(_ r: MagnifierReading, w: CGFloat, h: CGFloat) -> some View {
        let sx = w * Double(r.minutes - 360) / 1080
        // the same mapping GlowLine draws with
        let py = r.level.map { h * (1 - min(1, max(0, $0))) * 0.9 + 6 }
        let cardW: CGFloat = 196
        ZStack(alignment: .topLeading) {
            Capsule().fill(.white).frame(width: 1.5, height: h).offset(x: sx - 0.75)
            if let py {
                Circle().fill(.white).frame(width: 12, height: 12).shadow(color: Hue.mozgas.glow, radius: 8).offset(x: sx - 6, y: py - 6)
            }
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(r.time).font(.nkNumber(20)).foregroundStyle(.white)
                    Spacer(minLength: 6)
                    Text(r.percent.map { "energia \($0)%" } ?? "energia –").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.85))
                }
                Text(r.what).nkFont(12.5).foregroundStyle(.white.opacity(r.what == "Szabad idő" ? 0.6 : 0.9)).lineLimit(2)
            }
            .padding(12)
            .frame(width: cardW, alignment: .leading)
            .glassEffect(.regular.tint(.black.opacity(0.3)), in: .rect(cornerRadius: 16))
            // over the curve (spike); where the curve is high the card drops below the dot so it never hides it
            .offset(x: min(max(0, sx - cardW / 2), w - cardW), y: (py ?? 100) < 64 ? (py ?? 0) + 14 : -8)
        }
        .allowsHitTesting(false)
        .transition(.opacity)
    }
}
