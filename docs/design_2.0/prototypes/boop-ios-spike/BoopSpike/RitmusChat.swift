import SwiftUI

// Throwaway spike (mezo-r36n9.13): the Boop tab — chat that already knows today. A thin "Boop látja" strip says
// what it sees right now (sleep, HRV, today's sport, check-ins, food, the goal), a few ready questions for today,
// answers that name the data they stand on. Composer: text + mic. Offline: the question waits on the phone.

struct RitmusChat: View {
    var day: RitmusDay
    @State private var messages: [(Bool, String)] = []
    @State private var typing = false
    @State private var input = ""
    @State private var motion = OrbMotion()
    private let sky = PaintedLandscape.skies[0]

    private let answers: [String: String] = [
        "Miért vagyok fáradtabb, mint tegnap?":
            "Három dolog együtt: az éjjel 6ó 10 percet aludtál, tegnap 7ó 40-et, és ebből 38 perccel kevesebb volt a mély. A HRV-d 41, a szokásos 50 alatt. Délben már 6-os energiát mondtál a workshop után. Nem vagy beteg — kevesebb a tartalék, ma este korábban feküdj le.",
        "Mennyit egyek a röpi előtt?":
            "A röpi 19:00-kor kezdődik, eddig 1 240 kcal-t ettél a mai 2 450-ből. 17:30 körül egyél 40–60 g szénhidrátot kis fehérjével: egy banán és egy pohár joghurt elég. A vacsora a játék után jöjjön, 21:00 előtt.",
        "Mire figyeljek ma az edzésen?":
            "A HRV-d lejjebb van, a délutáni energiád 5. Az első 20 percben ne ugorj maximális erővel, a bemelegítés legyen hosszabb. Ha a második szettnél a pulzusod 165 fölött ragad, vegyél vissza.",
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 0) {
                        ZStack(alignment: .top) {
                            GHead(sky: sky, height: 250)
                            VStack(spacing: 8) {
                                StillOrb(colors: SunMetric.all[0].orb, size: 54, level: 0.8).padding(.top, 70)
                                Text("Boop").font(AuraFont.serif(32)).foregroundStyle(.white)
                                Text("Kérdezz bármit a mai napodról — tudom, mi történt.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
                            }
                        }
                        VStack(alignment: .leading, spacing: 16) {
                            sees
                            if messages.isEmpty { suggestions }
                            ForEach(Array(messages.enumerated()), id: \.offset) { _, m in bubble(m.0, m.1) }
                            if typing { bubble(true, "…") }
                            Color.clear.frame(height: 150).id("end")
                        }
                        .padding(.horizontal, 16).padding(.top, -30)
                    }
                }
                .scrollIndicators(.hidden)
                .ignoresSafeArea(edges: .top)
                .onChange(of: messages.count) { withAnimation { proxy.scrollTo("end", anchor: .bottom) } }
            }
            composer.padding(.bottom, 92)
        }
        .background(gPageBackground(SunMetric.all[0].top).ignoresSafeArea())
        .onAppear { if RArg.open == "chatAnswer" { messages = [(false, "Miért vagyok fáradtabb, mint tegnap?"), (true, answers["Miért vagyok fáradtabb, mint tegnap?"]!)] } }
        .onDisappear { motion.stop() }
    }

    private var sees: some View {
        VStack(alignment: .leading, spacing: 10) {
            GLabel("BOOP LÁTJA · MOST")
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    chip("moon-cream", "Alvás 6ó 10p", "tegnap 7ó 40p")
                    chip("spark-cream", "HRV 41", "szokott 50")
                    chip("ball-sun", "Röpi 19:00", "90 perc")
                    chip("pen-sun", "\(day.checkins.count) kitöltés", "energia \(day.checkins.last?.energy ?? 0)")
                    chip("bowl-cream", "1 240 kcal", "a 2 450-ből")
                    chip("star-sun", "A nap célja", day.goal ?? "Ügyfélprezentáció")
                    chip("clock-ink", "Naptár", "még 2 esemény")
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    private func chip(_ g: String, _ t: String, _ s: String) -> some View {
        HStack(spacing: 8) {
            AuraGlyph(g, .white.opacity(0.85), size: 16)
            VStack(alignment: .leading, spacing: 1) {
                Text(t).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                Text(s).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .gCard(16)
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 10) {
            GLabel("MA KÉRDEZHETED")
            ForEach(Array(answers.keys).sorted(), id: \.self) { q in
                Button { ask(q) } label: {
                    HStack {
                        Text(q).font(.system(size: 15.5, weight: .medium)).foregroundStyle(.white).multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "arrow.up").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.horizontal, 16).frame(minHeight: 50).gCard(18)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func bubble(_ boop: Bool, _ t: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if boop { StillOrb(colors: SunMetric.all[0].orb, size: 26, level: 0.8).padding(.top, 4) } else { Spacer(minLength: 50) }
            Text(t)
                .font(boop ? AuraFont.serif(17) : .system(size: 15.5))
                .lineSpacing(boop ? 4 : 2)
                .foregroundStyle(.white)
                .padding(boop ? 0 : 14)
                .background { if !boop { RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.12)) } }
            if boop { Spacer(minLength: 10) }
        }
        .transition(.opacity.combined(with: .offset(y: 10)))
    }

    private var composer: some View {
        VStack(spacing: 8) {
            if day.offline { ROfflineChip(text: "Nincs net · a kérdésed elküldöm, amint lesz") }
            HStack(spacing: 10) {
                TextField("", text: $input, prompt: Text("Kérdezd Boopot…").foregroundStyle(.white.opacity(0.45)))
                    .font(.system(size: 16)).foregroundStyle(.white)
                    .onSubmit { if !input.isEmpty { ask(input); input = "" } }
                RMicGlyph(color: .white.opacity(0.8), size: 22)
            }
            .padding(.horizontal, 18).frame(height: 52)
            .glassEffect(.regular, in: .capsule)
        }
        .padding(.horizontal, 16)
    }

    private func ask(_ q: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { messages.append((false, q)) }
        if day.offline { return }
        typing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            typing = false
            withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
                messages.append((true, answers[q] ?? "Ezt még átgondolom a mai adataid alapján."))
            }
        }
    }
}
