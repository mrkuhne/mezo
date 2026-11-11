import SwiftUI

// Throwaway spike (mezo-r36n9.13): Este — the day closed in under a minute, on ONE page (no paging):
// 1 hogy vagy most (the evening check-in IS this step) · 2 your goal: sikerült / részben / nem (Boop's own goals
// are already ticked from the data) · 3 milyen volt a nap · 4 mesélj (voice, optional) → Lezárom.
// One record for the whole evening (replaces the three old evening stores). Offline: saved on the phone,
// Boop's one sentence arrives when there is net.

struct RitmusEste: View {
    var day: RitmusDay
    var onClose: () -> Void
    @State private var energy: Int? = nil
    @State private var outcome: Int? = nil
    @State private var rating = 0
    @State private var journal: String? = nil
    @State private var taps = 1
    @State private var started = Date()
    @State private var seconds = 0
    @State private var motion = OrbMotion()
    private let sky = PaintedLandscape.skies[4]
    private let palette = SunMetric.all[4].orb

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    GHead(sky: sky, height: 300)
                    VStack(spacing: 0) {
                        HStack {
                            Button(action: onClose) {
                                Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                                    .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                            }.buttonStyle(.plain)
                            Spacer()
                            Text("21:32").font(AuraFont.mono(13, .semibold)).foregroundStyle(.white.opacity(0.8))
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            Text(day.closed ? "LEZÁRVA · 21:33" : "ESTI ZÁRÁS · EGY PERC").font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.8))
                            Text(day.closed ? "Jó éjszakát" : "Zárjuk le a napot").font(AuraFont.serif(38)).foregroundStyle(.white)
                            if day.offline { ROfflineChip().padding(.top, 6) }
                        }
                        .padding(.top, 40)
                    }
                }
                VStack(spacing: 12) {
                    if day.closed { closedView } else { steps }
                }
                .padding(.horizontal, 16).padding(.top, -40).padding(.bottom, 50)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(SunMetric.all[4].top).ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
    }

    // MARK: the four steps

    private var steps: some View {
        VStack(spacing: 12) {
            step(1, "HOGY VAGY MOST?", done: energy != nil) {
                RLevelRow(palette: SunMetric.all[2].orb, value: energy, size: 26) { k in taps += 1; withAnimation { energy = k } }
            }
            step(2, "A NAP CÉLJA", done: outcome != nil) {
                VStack(alignment: .leading, spacing: 14) {
                    Text(day.goal ?? "Ügyfélprezentáció 14:00").font(AuraFont.serif(21)).foregroundStyle(.white)
                    HStack(spacing: 8) {
                        ForEach(0..<3, id: \.self) { k in
                            let on = outcome == k
                            Text(["Sikerült", "Részben", "Nem"][k]).font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(on ? gBase : .white)
                                .frame(maxWidth: .infinity).frame(height: 42)
                                .background(Capsule().fill(on ? .white : .white.opacity(0.08)))
                                .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.14)))
                                .onTapGesture { taps += 1; withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { outcome = k } }
                        }
                    }
                    .sensoryFeedback(.selection, trigger: outcome)
                    Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                    GLabel("BOOP CÉLJAI · MAGUKTÓL")
                    boopGoal("Fehérje legalább 140 g", "146 g", true)
                    boopGoal("Röpi 19:00", "90 perc · pulzus átl. 128", true)
                    boopGoal("Lefekvés 22:45", "még előtted", nil)
                }
            }
            step(3, "MILYEN VOLT A NAP?", done: rating > 0) {
                HStack(spacing: 0) {
                    ForEach(1...5, id: \.self) { k in
                        let on = k <= rating
                        VStack(spacing: 6) {
                            StillOrb(colors: palette, size: 38, level: Double(k) / 5)
                                .saturation(on ? 1 : 0.15).opacity(on ? 1 : 0.55)
                                .scaleEffect(k == rating ? 1.14 : 1)
                            Text(["Nehéz", "", "Rendben", "", "Remek"][k - 1]).font(.system(size: 11)).foregroundStyle(.white.opacity(0.55)).frame(height: 12)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                        .onTapGesture { taps += 1; withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { rating = k } }
                    }
                }
                .sensoryFeedback(.selection, trigger: rating)
            }
            step(4, "MESÉLJ", done: journal != nil, optional: true) {
                RVoiceRecorder(offline: day.offline, text: $journal, onTap: { taps += 1 })
            }
            VStack(spacing: 8) {
                GPill(title: "Lezárom a napot", glyph: "spark-cream") { close() }
                    .opacity(rating > 0 ? 1 : 0.45).disabled(rating == 0)
                HStack {
                    Text("A napot az értékelés zárja le, a többi elhagyható.").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                }
            }
            .padding(.top, 6)
        }
    }

    private func step<C: View>(_ n: Int, _ label: String, done: Bool, optional: Bool = false, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(done ? .white : .clear)
                    Circle().stroke(.white.opacity(done ? 0 : 0.35), lineWidth: 1.2)
                    if done { AuraGlyph("check-ink", gBase, size: 13) }
                    else { Text("\(n)").font(.custom("Outfit", size: 13).weight(.medium)).foregroundStyle(.white.opacity(0.8)) }
                }
                .frame(width: 24, height: 24)
                GLabel(label)
                Spacer()
                if optional { Text("ha van kedved").font(.system(size: 12)).foregroundStyle(.white.opacity(0.45)) }
            }
            c()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(24)
    }

    private func boopGoal(_ t: String, _ s: String, _ met: Bool?) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(met == true ? .white : .clear)
                Circle().stroke(.white.opacity(met == true ? 0 : 0.35), lineWidth: 1.2)
                if met == true { AuraGlyph("check-ink", gBase, size: 13) }
            }
            .frame(width: 22, height: 22)
            Text(t).font(.system(size: 15)).foregroundStyle(.white)
            Spacer()
            Text(s).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
        }
    }

    private func close() {
        taps += 1
        seconds = max(1, Int(Date().timeIntervalSince(started)))
        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
            day.eveningEnergy = energy; day.goalOutcome = outcome; day.dayRating = rating
            day.journal = journal; day.closed = true
        }
    }

    // MARK: closed

    private var closedView: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    LivingOrb(mood: .good, size: 22, motion: motion, palette: SunMetric.all[0].orb, glow: false, level: 0.85)
                    GLabel("BOOP")
                }
                if day.offline {
                    Text("A napod a telefonon van. Amint lesz net, elküldöm, és reggel elmondom, mit tanultam belőle.")
                        .font(AuraFont.serif(19)).lineSpacing(4).foregroundStyle(.white)
                } else {
                    Text("Jó nap volt: a prezentáció sikerült, a fehérje és a röpi is megvolt. Délután leeresztettél, de a banán után jól bírtad a játékot.")
                        .font(AuraFont.serif(19)).lineSpacing(4).foregroundStyle(.white)
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()

            VStack(alignment: .leading, spacing: 12) {
                GLabel("A MAI NAPOD")
                summaryRow("Értékelés", ["", "Nehéz", "Inkább nehéz", "Rendben", "Jó", "Remek"][max(0, min(5, day.dayRating))])
                summaryRow("A nap célja", day.goalOutcome.map { ["Sikerült", "Részben", "Nem"][$0] } ?? "–")
                summaryRow("Energia este", day.eveningEnergy.map { "\($0)" } ?? "–")
                summaryRow("Boop céljai", "2 / 3")
                if let j = day.journal {
                    Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                    Text(day.offline ? "Hangfelvétel · szöveggé alakítom, amint lesz net" : "„\(j)”")
                        .font(day.offline ? .system(size: 14) : AuraFont.serif(16)).foregroundStyle(.white.opacity(0.8))
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()

            HStack(spacing: 12) {
                AuraGlyph("bell-cream", .white, size: 18)
                VStack(alignment: .leading, spacing: 2) {
                    Text("22:15-kor szólok a lefekvés miatt").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Text("7 és fél óra alvásért").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
            }
            .padding(16).gCard(20)

            GPill(title: "Kész") { onClose() }.padding(.top, 6)
            if seconds > 0 { RTapCount(taps: taps, seconds: seconds) }
        }
    }

    private func summaryRow(_ l: String, _ v: String) -> some View {
        HStack {
            Text(l).font(.system(size: 15)).foregroundStyle(.white.opacity(0.7))
            Spacer()
            Text(v).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
        }
    }
}
