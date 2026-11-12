import SwiftUI

// Throwaway spike (mezo-r36n9.13): the 3-tap check-in. The approved Napkelte check-in look (painted sky, serif
// question, the orb is the answer) — but one tap on the level row answers AND moves on. Energy is always first
// (it feeds the dots on the energy curve), then at most two rotating items of the 14, one of them may carry
// Boop's "why I ask". Saved on the third tap (no "Kész" needed); then the payoff: the new dot on the day's curve
// with what the watch said at that moment, an optional spoken sentence, Boop's one line.

struct RitmusCheckin: View {
    var day: RitmusDay
    var startedFrom: String = "Ma"
    var onClose: () -> Void

    struct Q { let key, label, question: String; let hue: Int; var why: String? = nil }
    // the five core items every time (continuous curves) + ONE "question of the day" (slot / what Boop watches)
    private let qs: [Q] = [
        .init(key: "energy", label: "Energia", question: "Mennyi energia van benned most?", hue: 2),
        .init(key: "mood", label: "Hangulat", question: "Milyen a hangulatod?", hue: 4),
        .init(key: "stress", label: "Feszültség", question: "Mennyire vagy feszült?", hue: 0),
        .init(key: "body", label: "Test", question: "Hogy érzed a tested?", hue: 3),
        .init(key: "mental", label: "Fejtisztaság", question: "Mennyire tiszta a fejed?", hue: 1),
        .init(key: "motivation", label: "A nap kérdése", question: "Mennyire van kedved a ma esti röpihez?", hue: 4,
              why: "Edzésnap van — azt figyelem, a délutáni kedved megjósolja-e, milyen lesz a játék."),
    ]
    @State private var i = 0
    @State private var values: [String: Int] = [:]
    @State private var finished = RArg.open == "checkinDone"
    @State private var motion = OrbMotion()
    @State private var taps = 1                 // the tap that opened it
    @State private var started = Date()
    @State private var seconds = 0
    @State private var note: String? = nil
    @State private var selected: UUID? = nil
    @State private var dragStart: Int? = nil
    @State private var swipes = 0

    var body: some View {
        Group { if finished { done } else { question } }
            .onDisappear { motion.stop() }
            .preferredColorScheme(.dark)
            .onAppear { if finished { taps = 4; swipes = 3; seconds = 8; selected = day.checkins.last?.id } }
    }

    private var q: Q { qs[i] }

    private var question: some View {
        ZStack {
            PaintedLandscape(sky: PaintedLandscape.skies[q.hue]).ignoresSafeArea()
                .overlay(LinearGradient(colors: [.clear, gBase.opacity(0.9)], startPoint: .center, endPoint: .bottom).ignoresSafeArea())
                .animation(.easeInOut(duration: 0.6), value: i)
            VStack(spacing: 0) {
                HStack {
                    Button(action: onClose) {
                        Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    HStack(spacing: 6) {
                        ForEach(qs.indices, id: \.self) { k in
                            Capsule().fill(.white.opacity(k <= i ? 0.95 : 0.3)).frame(width: k == i ? 22 : 7, height: 7)
                        }
                    }
                    Spacer()
                    Group {
                        if i >= 1 {
                            Button("Most csak ennyi") { taps += 1; save() }
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                                .padding(.horizontal, 12).frame(height: 34).glassEffect(.clear.interactive(), in: .capsule)
                        } else {
                            Text("Délután · 16:02").font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.75)).fixedSize()
                        }
                    }
                    .frame(width: 130, alignment: .trailing)
                }
                .padding(.horizontal, 16).padding(.top, 8)

                VStack(spacing: 10) {
                    Text(q.label.uppercased()).font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.8))
                    Text(q.question).font(AuraFont.serif(34)).foregroundStyle(.white).multilineTextAlignment(.center)
                        .frame(minHeight: 90)
                    if let w = q.why {
                        HStack(alignment: .top, spacing: 8) {
                            StillOrb(colors: SunMetric.all[0].orb, size: 18, level: 0.8)
                            Text(w).font(.system(size: 14)).foregroundStyle(.white.opacity(0.78)).multilineTextAlignment(.leading)
                        }
                        .padding(.horizontal, 6)
                    }
                }
                .padding(.horizontal, 28).padding(.top, 30)
                .id(i).transition(.opacity)

                Spacer()

                // the orb is the answer: swipe up or down on it, the liquid follows; then tap Tovább
                ZStack {
                    Circle().fill(PaintedLandscape.skies[q.hue][2].opacity(0.35)).frame(width: 300).blur(radius: 60)
                    LivingOrb(mood: .good, size: 220, motion: motion, palette: SunMetric.all[q.hue].orb, glow: false,
                              level: max(0.04, Double(v) / 10))
                        .allowsHitTesting(false)
                    VStack(spacing: 0) {
                        Text("\(v)").font(.custom("Outfit", size: 78).weight(.light)).foregroundStyle(.white)
                            .contentTransition(.numericText(value: Double(v)))
                        Text("a 10-ből").font(.system(size: 13)).foregroundStyle(.white.opacity(0.75))
                    }
                    .shadow(color: .black.opacity(0.3), radius: 8)
                    .allowsHitTesting(false)
                }
                .frame(width: 300, height: 260)
                .contentShape(Circle())
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { g in
                            if dragStart == nil { dragStart = v; swipes += 1 }
                            let nv = max(1, min(10, (dragStart ?? 5) - Int((g.translation.height / 26).rounded())))
                            if nv != v { withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) { values[q.key] = nv } }
                        }
                        .onEnded { _ in dragStart = nil }
                )
                .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.45), trigger: v)
                Text(previous[q.key].map { "Húzd fel vagy le · legutóbb \($0) volt" } ?? "Húzd fel vagy le")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.65)).padding(.top, 4)

                Spacer()

                HStack(spacing: 10) {
                    Button { taps += 1; advance() } label: { AuraPill(text: "Kihagyom", primary: false) }
                        .buttonStyle(.plain).frame(width: 130)
                    Button { taps += 1; if values[q.key] == nil { values[q.key] = v }; advance() } label: {
                        AuraPill(text: i == qs.count - 1 ? "Kész" : "Tovább")
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20).padding(.bottom, 20)
            }
        }
    }

    /// Starts from the last answer of the day (energy: noon's 6), so "same as before" is one tap on Tovább.
    private var previous: [String: Int] {
        var d = ["energy": day.checkins.last?.energy ?? 5]
        for (l, v) in day.checkins.last?.others ?? [] { if let q = qs.first(where: { $0.label == l }) { d[q.key] = v } }
        return d
    }
    private var v: Int { values[q.key] ?? previous[q.key] ?? 5 }

    private func advance() {
        if i < qs.count - 1 { withAnimation(.easeInOut(duration: 0.45)) { i += 1 }; return }
        save()
    }

    private func save() {
        // third answer = saved (on the phone first; sent now, or later when offline)
        seconds = max(1, Int(Date().timeIntervalSince(started)))
        let others = qs.dropFirst().compactMap { q in values[q.key].map { (q.label, $0) } }
        day.addAfternoon(energy: values["energy"] ?? previous["energy"] ?? 5, others: others)
        selected = day.checkins.last?.id
        withAnimation(.easeInOut(duration: 0.5)) { finished = true }
    }

    private var done: some View {
        ScrollView {
            VStack(spacing: 14) {
                HStack {
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                    }.buttonStyle(.plain)
                }
                VStack(spacing: 8) {
                    Text("MENTVE · 16:02").font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                    Text("Ráesett a görbére").font(AuraFont.serif(36)).foregroundStyle(.white)
                    Text("Délutánra lejjebb mentél, mint jósoltam.").font(.system(size: 16)).foregroundStyle(.white.opacity(0.8))
                    if day.offline { ROfflineChip().padding(.top, 6) }
                }
                .padding(.bottom, 6)

                VStack(alignment: .leading, spacing: 14) {
                    GLabel("AZ ENERGIÁD MA")
                    REnergyCurve(day: day, now: 16.03, hue: SunMetric.all[2].glow, selected: $selected)
                }
                .padding(18).gCard()

                if let c = day.checkins.first(where: { $0.id == selected }) { RCheckinDetail(c: c).transition(.opacity) }

                VStack(alignment: .leading, spacing: 10) {
                    RVoiceRecorder(offline: day.offline, prompt: "Mondj hozzá egy mondatot",
                                   sample: "A második workshop után teljesen leeresztettem.", text: $note, onTap: { taps += 1 })
                }
                .padding(18).gCard()

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        LivingOrb(mood: .good, size: 22, motion: motion, palette: SunMetric.all[0].orb, glow: false, level: 0.85)
                        GLabel("BOOP")
                    }
                    Text(day.offline
                         ? "Megvan. Amint lesz net, megnézem a délutánodat, és szólok, mit egyél a röpi előtt."
                         : "Délben még 6 voltál, most \(day.checkins.last?.energy ?? 5), és a HRV-d is a szokott alatt. Egyél 17:30 körül egy banánt joghurttal, hogy a 19:00-s röpire maradjon erőd.")
                        .font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.9))
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()

                GPill(title: "Kész") { onClose() }.padding(.top, 4)
                RTapCount(taps: taps, swipes: swipes, seconds: seconds).padding(.top, 2)
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(SunMetric.all[2].top).ignoresSafeArea())
    }
}
