import SwiftUI

// B5 Edzés spike — the in-workout player. A full-screen cover at page level (boop-ios.md §9), never a push,
// because the spine bar must be gone and the screen must survive the phone locking in a gym.
//
// The four states the owner sees: the briefing, the set, the rest, the debrief — then the close.

enum WPlayerStep: Int { case briefing, set, rest, debrief, finish }

struct WPlayer: View {
    let offline: Bool
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var step: WPlayerStep = WPlayerStep(rawValue: WArg.int("edzesPlayerStep", 0, 4)) ?? .briefing
    @State private var exercises = WData.exercises()
    @State private var exIdx = 0
    @State private var setIdx = 3          // the first two warmups and one working set are already logged
    @State private var kg: Double = 70
    @State private var reps = 8
    @State private var rir = 2
    @State private var restLeft = 150
    @State private var swap = false
    /// How many logged sets are still sitting on the phone waiting for a network.
    @State private var queued = 4

    private var ex: WExercise { exercises[exIdx] }

    var body: some View {
        ZStack {
            gPageBackground(WHue.top).ignoresSafeArea()
            // The head photo sits behind the HEADER only, not behind the scrolling content: a 300 pt photo
            // under a scroll view left card labels sitting on bright dumbbells and unreadable.
            WPhotoHead(photoName: step == .rest ? nil : WData.todayPhoto, height: 210)
                .frame(maxHeight: .infinity, alignment: .top)
                .ignoresSafeArea(edges: .top)
            VStack(spacing: 0) {
                header
                ScrollView {
                    Group {
                        switch step {
                        case .briefing: briefing
                        case .set: setPage
                        case .rest: restPage
                        case .debrief: debrief
                        case .finish: finish
                        }
                    }
                    .padding(.horizontal, 16).padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $swap) { WSwapSheet(onToast: onToast) }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white).frame(width: 44, height: 44)
                }
                .buttonStyle(.plain).glassEffect(.clear.interactive(), in: .circle)
                Text(step == .briefing ? "Eligazítás" : "\(WData.todayTitle) · \(exIdx + 1)/\(exercises.count)")
                    .font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.85))
                Spacer()
                if offline {
                    // The queue is visible the whole time, so nothing feels lost.
                    HStack(spacing: 6) {
                        AuraGlyph("repeat-peach", Color(hex: 0xF4C860), size: 13)
                        Text("\(queued) vár").font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(hex: 0xF4C860))
                    }
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Capsule().fill(Color(hex: 0xF4C860).opacity(0.14)))
                }
            }
            .padding(.horizontal, 16).padding(.top, 54)
            if step != .briefing && step != .finish {
                // Where we are in the session: one thin bar per working set, filled as it is logged.
                HStack(spacing: 3) {
                    ForEach(Array(exercises.enumerated()), id: \.element.id) { i, e in
                        ForEach(0..<e.workingCount, id: \.self) { s in
                            Capsule()
                                .fill(i < exIdx || (i == exIdx && s < max(0, setIdx - (e.sets.count - e.workingCount)))
                                      ? Color.white.opacity(0.85) : Color.white.opacity(0.18))
                                .frame(height: 3)
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Briefing

    private var briefing: some View {
        VStack(spacing: 14) {
            VStack(spacing: 8) {
                StillOrb(colors: WHue.orb, size: 64, level: 0.68).shadow(color: WHue.glow.opacity(0.6), radius: 20)
                    .background(RadialGradient(colors: [gBase.opacity(0.85), gBase.opacity(0)],
                                               center: .center, startRadius: 10, endRadius: 86)
                        .frame(width: 180, height: 180).blur(radius: 12))
                Text("Push · 16 sorozat").font(AuraFont.serif(30)).foregroundStyle(.white)
                Text("Végigmegyünk együtt. Minden sorozat után megmondom, mi jön.")
                    .font(.system(size: 15)).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 20)
                if offline {
                    WStaleChip(text: "Keddi terv · nincs net", loud: true).padding(.top, 2)
                }
            }
            .padding(.top, 20).padding(.bottom, 14)

            WSection(n: 1, label: "A MAI GYAKORLATOK") {
                VStack(spacing: 0) {
                    ForEach(Array(exercises.enumerated()), id: \.element.id) { i, e in
                        if i > 0 { Divider().overlay(.white.opacity(0.1)).padding(.vertical, 12) }
                        HStack(spacing: 12) {
                            WThumb(name: e.photo, size: 44)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(e.name).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                                    .lineLimit(1).minimumScaleFactor(0.8)
                                Text("\(e.workingCount) sorozat · \(fmt(e.sets.last?.kg ?? 0)) kg × \(e.sets.last?.reps ?? 0)")
                                    .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.62))
                            }
                            Spacer(minLength: 0)
                            Text(e.zone).font(.system(size: 11)).foregroundStyle(.white.opacity(0.45))
                                .lineLimit(1).fixedSize()
                        }
                    }
                }
            }

            WSection(n: 2, label: "AMI MA MÁS") {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(WData.briefing.enumerated()), id: \.offset) { _, b in
                        WBriefRow(title: b.0, text: b.1)
                    }
                }
            }

            GPill(title: "Első sorozat", glyph: "dumbbell-ink") {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.9)) { step = .set }
            }
            .padding(.top, 4)
        }
    }

    // MARK: - The set

    private var setPage: some View {
        VStack(spacing: 14) {
            VStack(spacing: 10) {
                Text(ex.name).font(AuraFont.serif(28)).foregroundStyle(.white)
                    .multilineTextAlignment(.center).padding(.horizontal, 16)
                Text("\(setIdx - (ex.sets.count - ex.workingCount) + 1). munkasorozat a \(ex.workingCount)-ből")
                    .font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
            }
            .padding(.top, 18).padding(.bottom, 6)

            // The three numbers, big, each with its own ± . This is what the gym needs: thumb-sized targets.
            VStack(spacing: 16) {
                WStepper(label: "SÚLY", value: fmt(kg), unit: "kg",
                         down: { kg = max(0, kg - 2.5) }, up: { kg += 2.5 })
                WStepper(label: "ISMÉTLÉS", value: "\(reps)", unit: nil,
                         down: { reps = max(1, reps - 1) }, up: { reps += 1 })
                WStepper(label: "TARTALÉK", value: "\(rir)", unit: "RIR",
                         down: { rir = max(0, rir - 1) }, up: { rir = min(5, rir + 1) })
            }
            .padding(20).gCard()

            // Why this weight — the engine's own sentence, never an AI guess.
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    AuraGlyph("bolt-sun", .white, size: 16)
                    Text(ex.why).font(.system(size: 14)).lineSpacing(2).foregroundStyle(.white.opacity(0.85))
                }
                Divider().overlay(.white.opacity(0.1))
                HStack(spacing: 8) {
                    AuraGlyph("clock-ink", .white.opacity(0.6), size: 14)
                    Text(ex.last).font(.system(size: 13)).foregroundStyle(.white.opacity(0.62))
                    Spacer()
                }
                if let n = ex.note {
                    HStack(alignment: .top, spacing: 8) {
                        AuraGlyph("pen-sun", .white.opacity(0.6), size: 14)
                        Text(n).font(.system(size: 13)).lineSpacing(2).foregroundStyle(.white.opacity(0.62))
                    }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            GPill(title: "Megvan", glyph: "check-ink") { logSet() }

            HStack(spacing: 18) {
                Button { swap = true } label: {
                    Text("Gyakorlat cseréje").font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65)).underline()
                }
                Button { nextExercise() } label: {
                    Text("Kihagyom ezt").font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.65)).underline()
                }
            }
            .buttonStyle(.plain)
            .padding(.top, 2)

            // What is already in the bag for this exercise.
            if ex.doneCount > 0 {
                WSection(n: 1, label: "EDDIG EBBŐL A GYAKORLATBÓL") {
                    VStack(spacing: 10) {
                        ForEach(ex.sets.filter(\.isDone)) { s in
                            HStack(spacing: 10) {
                                Text(s.kind.label).font(.system(size: 12))
                                    .foregroundStyle(.white.opacity(0.5)).frame(width: 78, alignment: .leading)
                                Text("\(fmt(s.doneKg ?? 0)) kg × \(s.doneReps ?? 0)")
                                    .font(.custom("Outfit", size: 15).weight(.medium)).foregroundStyle(.white)
                                Text("RIR \(s.doneRir ?? 0)").font(.system(size: 12))
                                    .foregroundStyle(.white.opacity(0.5))
                                Spacer()
                                if offline {
                                    AuraGlyph("repeat-peach", Color(hex: 0xF4C860).opacity(0.8), size: 13)
                                } else {
                                    AuraGlyph("check-ink", .white.opacity(0.5), size: 13)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - The rest

    private var restPage: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 30)
            // Napkelte has no progress rings (a circle is a real clock only): the orb drains instead.
            StillOrb(colors: WHue.orb, size: 190, level: Double(restLeft) / 150.0)
                .shadow(color: WHue.glow.opacity(0.5), radius: 40)
            Text(clock(restLeft)).font(.custom("Outfit", size: 56).weight(.medium))
                .foregroundStyle(.white).monospacedDigit()
            Text("Pihenő a következő sorozatig").font(.system(size: 15))
                .foregroundStyle(.white.opacity(0.75))

            VStack(spacing: 6) {
                Text("Következik").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.55))
                Text("\(ex.name) · \(fmt(kg)) kg × \(reps)")
                    .font(.system(size: 17, weight: .medium)).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 6)

            HStack(spacing: 10) {
                GPill(title: "Kezdem", glyph: "dumbbell-ink") {
                    withAnimation { step = .set }
                }
                GPill(title: "+30 mp", primary: false) { restLeft += 30 }
            }
            Spacer(minLength: 20)
        }
        // The rest page is the one screen you look at from across the room: it fills the height and
        // centres, instead of hugging the top of the scroll view.
        .frame(maxWidth: .infinity, minHeight: 640)
        .onAppear { tick() }
    }

    private func tick() {
        guard step == .rest else { return }
        Task {
            try? await Task.sleep(for: .seconds(1))
            if step == .rest {
                if restLeft > 0 { restLeft -= 1; tick() } else { withAnimation { step = .set } }
            }
        }
    }

    // MARK: - The debrief

    private var debrief: some View {
        VStack(spacing: 14) {
            VStack(spacing: 8) {
                Text("Hogy ment a \(ex.name.components(separatedBy: " ").first ?? "")?")
                    .font(AuraFont.serif(26)).foregroundStyle(.white).multilineTextAlignment(.center)
                Text("Három kérdés, aztán jön a következő gyakorlat. Át is ugorhatod.")
                    .font(.system(size: 14.5)).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.78)).padding(.horizontal, 20)
            }
            .padding(.top, 20).padding(.bottom, 8)

            WPicker(label: "BEPUMPÁLTSÁG", options: ["Semmi", "Kevés", "Jó", "Nagyon"], initial: 2)
            WPicker(label: "ÍZÜLETI FÁJDALOM", options: ["Nincs", "Érezhető", "Zavaró"], initial: 0)
            WPicker(label: "MUNKA MENNYISÉGE", options: ["Kevés volt", "Pont jó", "Sok volt"], initial: 1)

            GPill(title: "Mehet a következő", glyph: "check-ink") { nextExercise() }
            Button { nextExercise() } label: {
                Text("Átugrom").font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6)).underline()
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - The close

    private var finish: some View {
        VStack(spacing: 14) {
            VStack(spacing: 10) {
                StillOrb(colors: WHue.orb, size: 84, level: 0.92).shadow(color: WHue.glow.opacity(0.6), radius: 26)
                    .background(RadialGradient(colors: [gBase.opacity(0.85), gBase.opacity(0)],
                                               center: .center, startRadius: 10, endRadius: 100)
                        .frame(width: 200, height: 200).blur(radius: 12))
                Text("Kész: 16 sorozat, 58 perc").font(AuraFont.serif(28)).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text("A fekvenyomás 70 kg-on ment végig, ez új csúcs ebben a blokkban. A váll extra sorozata is megvolt.")
                    .font(.system(size: 15)).lineSpacing(3).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 18)
            }
            .padding(.top, 16).padding(.bottom, 8)

            WSection(n: 1, label: "AMI MA TÖRTÉNT") {
                VStack(spacing: 12) {
                    WFinishRow(label: "Összes emelt súly", value: "8 240 kg")
                    WFinishRow(label: "Munkasorozatok", value: "16 / 16")
                    WFinishRow(label: "Aktív idő", value: "58 perc")
                    WFinishRow(label: "Új csúcs", value: "Fekvenyomás · 70 kg × 8")
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                GLabel("EGY MONDAT MAGADNAK")
                Text("A váll a végén elfogyott, de a mell erős volt.")
                    .font(.system(size: 15)).foregroundStyle(.white.opacity(0.9))
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.07)))
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            if offline {
                HStack(alignment: .top, spacing: 10) {
                    AuraGlyph("repeat-peach", Color(hex: 0xF4C860), size: 16)
                    Text("A 16 sorozat a telefonon van, és magától felmegy, amint lesz net. Nem kell tenned semmit.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(Color(hex: 0xF4C860).opacity(0.95))
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color(hex: 0xF4C860).opacity(0.1)))
            }

            GPill(title: "Lezárom", glyph: "check-ink") {
                onToast(offline ? "Lezárva — felmegy, amint lesz net" : "Lezárva")
                dismiss()
            }
        }
    }

    // MARK: - Moves

    private func logSet() {
        exercises[exIdx].sets[setIdx].doneKg = kg
        exercises[exIdx].sets[setIdx].doneReps = reps
        exercises[exIdx].sets[setIdx].doneRir = rir
        if offline { queued += 1 }
        let isLastOfExercise = setIdx >= ex.sets.count - 1
        withAnimation(.spring(response: 0.4, dampingFraction: 0.9)) {
            if isLastOfExercise {
                step = .debrief
            } else {
                setIdx += 1
                restLeft = 150
                step = .rest
            }
        }
    }

    private func nextExercise() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.9)) {
            if exIdx >= exercises.count - 1 {
                step = .finish
            } else {
                exIdx += 1
                let e = exercises[exIdx]
                setIdx = 0
                kg = e.sets[0].kg; reps = e.sets[0].reps; rir = e.sets[0].rir
                restLeft = 150
                step = .rest
            }
        }
    }
}

// MARK: - Pieces

/// One big number with a ± on each side. Nothing to type, nothing small to hit with chalky hands.
struct WStepper: View {
    let label: String, value: String
    let unit: String?
    let down: () -> Void, up: () -> Void
    var body: some View {
        VStack(spacing: 8) {
            GLabel(label)
            HStack(spacing: 0) {
                WStepButton(symbol: "minus", action: down)
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(value).font(.custom("Outfit", size: 44).weight(.medium))
                        .foregroundStyle(.white).monospacedDigit()
                    if let unit {
                        Text(unit).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.6))
                    }
                }
                Spacer(minLength: 0)
                WStepButton(symbol: "plus", action: up)
            }
        }
    }
}

struct WStepButton: View {
    let symbol: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 19, weight: .semibold))
                .foregroundStyle(.white).frame(width: 56, height: 56)
                .background(Circle().fill(.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
    }
}

/// The debrief's three questions: a row of capsules, one tap each.
struct WPicker: View {
    let label: String
    let options: [String]
    let initial: Int
    @State private var pick: Int?
    init(label: String, options: [String], initial: Int) {
        self.label = label; self.options = options; self.initial = initial
        _pick = State(initialValue: initial)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            GLabel(label)
            HStack(spacing: 7) {
                ForEach(Array(options.enumerated()), id: \.offset) { i, o in
                    let on = pick == i
                    Button { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { pick = i } } label: {
                        Text(o).font(.system(size: 13.5, weight: on ? .semibold : .regular))
                            .lineLimit(1).minimumScaleFactor(0.75)
                            .foregroundStyle(on ? gBase : .white.opacity(0.85))
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .frame(maxWidth: .infinity)
                            .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
    }
}

struct WFinishRow: View {
    let label: String, value: String
    var body: some View {
        HStack {
            Text(label).font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
            Spacer()
            Text(value).font(.custom("Outfit", size: 15).weight(.medium)).foregroundStyle(.white)
        }
    }
}

// MARK: - Small helpers

func fmt(_ d: Double) -> String {
    d == d.rounded() ? String(Int(d)) : String(format: "%.1f", d).replacingOccurrences(of: ".", with: ",")
}

func clock(_ s: Int) -> String { String(format: "%d:%02d", s / 60, s % 60) }
