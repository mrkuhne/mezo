import SwiftUI
import Charts

func photo(_ name: String) -> Image {
    Image(uiImage: UIImage(named: name) ?? UIImage())
}

/// Nap · Mai in the morning, Lágy skeleton: photo head → verdict → Boop speaks → the one deep card
/// (readiness, with the living orb) → A nap energiája → levels → next steps → observation → Boop card.
struct LagyMai: View {
    @State private var mood: Mood = Mood(rawValue: UserDefaults.standard.integer(forKey: "mood")) ?? .good
    @State private var motion = OrbMotion()
    @State private var typer = Typer()
    @State private var count = 0
    @State private var crowded = UserDefaults.standard.bool(forKey: "crowded")
    @State private var done: [Moment: String] = [:]
    @State private var openMoment: Moment? = Moment(rawValue: UserDefaults.standard.string(forKey: "open") ?? "")
    @State private var showOnboarding = UserDefaults.standard.string(forKey: "open") == "onboarding"
    @State private var sheet: String? = UserDefaults.standard.string(forKey: "sheet").flatMap { $0.isEmpty ? nil : $0 }
    @State private var scrolled = false
    @State private var obsAnswer: String?
    @State private var planned = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: 0) {
                    head
                    VStack(alignment: .leading, spacing: 0) {
                        verdict.padding(.horizontal, 20).padding(.top, 16).entrance(0.1)
                        voice.padding(.horizontal, 20).padding(.top, 12).entrance(0.2)
                        section("Készenlét", link: "Részletek", go: "sleep", delay: 0.3) { readinessCard }
                        section("A nap energiája", link: "Naptár", go: "day", delay: 0.4) {
                            LagyEnergyCurve(mood: mood, plan: crowded ? .ceo : .normal)
                        }
                        section("Mai szintek", delay: 0.5) { levels }
                        section("Utána jön", delay: 0.55) { nextSteps }
                        section("Észrevétel", link: "Mind", go: "patterns", delay: 0.6) { observation }
                        mezoCard.padding(.horizontal, 16).padding(.top, 26).entrance(0.65)
                        demo.padding(.horizontal, 16).padding(.top, 34)
                    }
                    .padding(.bottom, 120)
                    .background(
                        UnevenRoundedRectangle(topLeadingRadius: 34, topTrailingRadius: 34, style: .continuous)
                            .fill(Lagy.paper)
                    )
                    .offset(y: -32)
                    .padding(.bottom, -32)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > 380 } action: { _, v in
                withAnimation(.easeInOut(duration: 0.2)) { scrolled = v }
            }
            .background(Lagy.paper.ignoresSafeArea())

            compactBar
        }
        .environment(\.colorScheme, .light)
        .preferredColorScheme(scrolled ? .light : .dark)          // status bar: white on the photo, dark on paper
        .onAppear { Lagy.registerFonts(); speak() }
        .onChange(of: mood) { speak() }
        .onDisappear { motion.stop() }
        .sheet(item: Binding(get: { sheet.map(LagySheetID.init) }, set: { sheet = $0?.id })) { s in
            LagyDetail(kind: s.id, mood: mood)
                .presentationDetents([.medium, .large])
                .presentationBackground(Lagy.paper)
                .presentationCornerRadius(34)
                .environment(\.colorScheme, .light)
        }
        .fullScreenCover(item: $openMoment) { m in
            let finish: (String) -> Void = { summary in withAnimation(.spring) { done[m] = summary } }
            switch m {
            case .checkin: LagyCheckin(mood: mood, onDone: finish)
            case .intention: LagyIntention(mood: mood, onDone: finish)
            case .weight: LagyWeight(mood: mood, onDone: finish)
            case .meal: LagyMeal(mood: mood, onDone: finish)
            case .patterns: LagyPatterns(mood: mood, onDone: finish)
            case .sleep: EmptyView()
            }
        }
        .fullScreenCover(isPresented: $showOnboarding) { OnboardingFlow { } }
    }

    private func speak() {
        count = 0
        withAnimation(.easeOut(duration: 1.4)) { count = mood.readiness }
        typer.run(mood.verdict, motion: motion, instant: reduceMotion)
    }

    // MARK: photo head

    private var head: some View {
        ZStack(alignment: .bottomLeading) {
            Color.clear.frame(height: 440)
                .overlay { photo("reggelfeny.jpg").resizable().scaledToFill().saturation(0.94).brightness(-0.03) }
                .clipped()
            LinearGradient(stops: [
                .init(color: Color(hex: 0x141A16).opacity(0.5), location: 0), .init(color: Color(hex: 0x141A16).opacity(0.22), location: 0.18),
                .init(color: .clear, location: 0.34), .init(color: .clear, location: 0.46),
                .init(color: Color(hex: 0x141A16).opacity(0.5), location: 0.66), .init(color: Color(hex: 0x141A16).opacity(0.85), location: 1),
            ], startPoint: .top, endPoint: .bottom)
            LinearGradient(colors: [Color(hex: 0x141A16).opacity(0.35), .clear], startPoint: .leading, endPoint: .init(x: 0.6, y: 0.5))

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    LagyMark(size: 32)
                    Text("boop").font(.outfit(21, .bold)).foregroundStyle(.white)
                    Spacer()
                    glassCircle { Image(systemName: "plus").font(.system(size: 16, weight: .bold)) }
                    glassCircle { Glyph("bell", "cream", size: 20) }
                        .overlay(alignment: .topTrailing) {
                            Text("3").font(.manrope(11, .heavy)).foregroundStyle(.white)
                                .frame(width: 17, height: 17).background(Circle().fill(Lagy.peach)).offset(x: 2, y: -2)
                        }
                    glassCircle { Text("D").font(.outfit(15)) }
                }
                .padding(.top, 62)
                tabs.padding(.top, 14)
                Spacer()
                VStack(alignment: .leading, spacing: 7) {
                    Text("JÓ REGGELT · HÉTFŐ, 06:50").font(.manrope(12, .bold)).tracking(0.7).opacity(0.88)
                    Text("Kezdjük a napot").font(.outfit(31)).tracking(-0.8).shadow(color: .black.opacity(0.45), radius: 8, y: 2)
                    Text("Reggeli check-in, hat kérdés.").font(.manrope(13.5)).opacity(0.92)
                    Pill(title: "Kitöltöm", glyph: ("sun", "ink"), onPhoto: true) { openMoment = .checkin }
                        .padding(.top, 6)
                }
                .foregroundStyle(.white)
                .padding(.bottom, 50)
                .entrance(0.05)
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 440)
        .background(Lagy.photoGround)
    }

    private func glassCircle<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        Button {} label: {
            c().foregroundStyle(.white).frame(width: 40, height: 40)
                .background(Circle().fill(.white.opacity(0.18)).overlay(Circle().stroke(.white.opacity(0.28), lineWidth: 1)))
                .background(.ultraThinMaterial.opacity(0.4), in: Circle())
        }
        .buttonStyle(PressStyle())
    }

    private var tabs: some View {
        HStack(spacing: 4) {
            ForEach(["Mai", "A napom", "Beszélgetés", "Rutin"], id: \.self) { t in
                Text(t).font(.manrope(12.5, .bold)).lineLimit(1)
                    .frame(maxWidth: .infinity).frame(height: 40)
                    .foregroundStyle(t == "Mai" ? Lagy.ink : .white.opacity(0.86))
                    .background(Capsule().fill(t == "Mai" ? .white : .clear))
                    .overlay(alignment: .topTrailing) {
                        if t == "A napom" { Circle().fill(Lagy.peach).frame(width: 7, height: 7).offset(x: -10, y: 9) }
                    }
            }
        }
        .padding(4)
        .background(Capsule().fill(.white.opacity(0.14)).overlay(Capsule().stroke(.white.opacity(0.14), lineWidth: 1)))
        .background(.ultraThinMaterial.opacity(0.35), in: Capsule())
    }

    /// Large title collapsing into a frosted compact bar.
    private var compactBar: some View {
        VStack {
            HStack {
                Text("Mai").font(.outfit(17))
                Spacer()
                Text("Hétfő, 06:50").font(.manrope(13, .bold)).foregroundStyle(Lagy.ink2)
            }
            .padding(.horizontal, 20).padding(.top, 58).padding(.bottom, 10)
            .background(.ultraThinMaterial)
            .overlay(alignment: .bottom) { Rectangle().fill(Lagy.ink.opacity(0.08)).frame(height: 0.5) }
            Spacer()
        }
        .ignoresSafeArea(edges: .top)
        .opacity(scrolled ? 1 : 0)
        .allowsHitTesting(scrolled)
    }

    // MARK: verdict + Boop's voice

    private var verdict: some View {
        let h = mood.lagyHeadline
        return (Text(h.0) + Text(h.1).foregroundColor(Lagy.deep) + Text(h.2))
            .font(.outfit(28)).tracking(-0.7).lineSpacing(1)
            .foregroundStyle(Lagy.ink)
            .frame(maxWidth: 360, alignment: .leading)
    }

    private var voice: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    LivingOrb(mood: mood, size: 22, motion: motion, palette: Lagy.orbColors, glow: false, level: 0.92)
                        .allowsHitTesting(false)
                    Text("BOOP MONDJA").font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.deep)
                }
                Spacer()
                Button { typer.voiceOn.toggle() } label: {
                    Image(systemName: typer.voiceOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Lagy.deep)
                        .frame(width: 40, height: 40).background(Circle().fill(Lagy.sage3))
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(PressStyle())
                .accessibilityLabel(typer.voiceOn ? "Felolvasás kikapcsolása" : "Felolvasás bekapcsolása")
                Button { speak() } label: {
                    Label("Újra", systemImage: "arrow.counterclockwise").font(.manrope(13, .bold))
                        .foregroundStyle(Lagy.deep).padding(.horizontal, 14).frame(height: 40)
                        .background(Capsule().fill(Lagy.sage3))
                }
                .buttonStyle(PressStyle())
                .opacity(typer.shown >= typer.total ? 1 : 0.4)
                .disabled(typer.shown < typer.total)
            }
            LagyVoiceText(segs: mood.verdict, shown: typer.shown)
                .environment(\.openURL, OpenURLAction { url in sheet = url.host(); return .handled })
        }
    }

    // MARK: the one deep card: readiness with the living orb

    private var readinessCard: some View {
        HStack(spacing: 16) {
            ZStack {
                LivingOrb(mood: mood, size: 128, motion: motion, palette: Lagy.orbColors, glow: false)
                    .overlay(Circle().stroke(.white.opacity(0.16), lineWidth: 1))
                VStack(spacing: 0) {
                    Text("\(count)").font(.outfit(40)).monospacedDigit()
                        .contentTransition(.numericText(value: Double(count)))
                    Text("a 100-ból").font(.manrope(12, .bold)).opacity(0.85)
                }
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.35), radius: 8, y: 2)
                .allowsHitTesting(false)
            }
            VStack(alignment: .leading, spacing: 11) {
                Text(mood.headline).font(.outfit(17)).foregroundStyle(.white)
                ForEach(mood.lagyBars, id: \.label) { b in
                    LagyBar(label: b.label, glyph: b.glyph, value: b.value, unit: b.unit, frac: b.frac, onDeep: true, warn: b.warn)
                }
            }
        }
        .padding(16)
        .deepCard()
        .contentShape(Rectangle())
        .onTapGesture(count: 1) {}
    }

    // MARK: levels (level tubes, peach under 50 %)

    private var levels: some View {
        HStack(alignment: .bottom, spacing: 0) {
            tube("kalória", "0 / 2 350", 0.02)
            tube("fehérje", "0 / 165 g", 0.02)
            tube("alvás", "7 óra 12", 0.91)
            tube("mozgás", "0 / 1", 0.06)
        }
        .padding(.vertical, 18).padding(.horizontal, 8)
        .lagyCard(fill: Color(hex: 0xEAF4FB))
    }

    private func tube(_ label: String, _ value: String, _ frac: Double) -> some View {
        VStack(spacing: 8) {
            LevelTube(frac: frac)
            VStack(spacing: 1) {
                Text(value).font(.outfit(14)).foregroundStyle(Lagy.ink).monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
                Text(label).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: next steps (the morning moments; the hero's check-in is not repeated here)

    private var nextSteps: some View {
        VStack(spacing: 10) {
            stepRow(nil, "nap-ebredes-sq.jpg", "Alvás", ["7 óra 12 perc", "Sleep Cycle"], doneText: "beolvasva")
            stepRow(.intention, "nap-lista-sq.jpg", "Mai szándék", ["fókusz és 3 cél"])
            stepRow(.weight, "en-merleg-sq.jpg", "Mérlegelés", ["tegnap 82,6 kg"])
            stepRow(.meal, "omlett-sq.jpg", "Első étkezés", ["fotó vagy pár szó"])
            stepRow(.checkin, "kave-sq.jpg", "Check-in", ["hat kérdés"], hidden: done[.checkin] == nil)
        }
    }

    @ViewBuilder
    private func stepRow(_ m: Moment?, _ img: String, _ title: String, _ chips: [String], doneText: String? = nil, hidden: Bool = false) -> some View {
        if !hidden {
            let summary = m.flatMap { done[$0] }
            let isDone = m == nil || summary != nil
            Button { if let m { openMoment = m } else { sheet = "sleep" } } label: {
                HStack(spacing: 12) {
                    photo(img).resizable().scaledToFill().frame(width: 44, height: 44).clipShape(Circle())
                        .overlay(alignment: .bottomTrailing) {
                            if isDone { Glyph("check", "sage", size: 18).background(Circle().fill(.white).padding(-2)).offset(x: 3, y: 3) }
                        }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(title).font(.outfit(15)).foregroundStyle(Lagy.ink)
                        HStack(spacing: 6) {
                            if let summary { Chip(text: summary, style: .soft, small: true) }
                            else {
                                if let d = doneText { Chip(text: d, style: .soft, small: true) }
                                ForEach(chips, id: \.self) { Chip(text: $0, small: true) }
                            }
                        }
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Lagy.mute)
                }
                .padding(.vertical, 12).padding(.leading, 12).padding(.trailing, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lagyCard(22)
            }
            .buttonStyle(PressStyle())
        }
    }

    // MARK: observation (the patterns moment, Lágy card)

    private var observation: some View {
        VStack(alignment: .leading, spacing: 12) {
            Chip(text: "Gyűlik · 4 nap a 7-ből", style: .warm, glyph: ("moon", "sky"))
            (Text("Amikor ") + Text("23 óra után").foregroundColor(Lagy.deep) + Text(" fekszel le, másnap kevesebbet mozogsz, átlagosan 2 400 lépéssel."))
                .font(.outfit(16.5)).foregroundStyle(Lagy.ink).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                ForEach(Array([1, 1, 0, 1, 2, 1, 2].enumerated()), id: \.offset) { _, c in
                    Circle().fill(c == 1 ? Lagy.peach : (c == 0 ? Lagy.sage2 : Lagy.ink.opacity(0.1))).frame(width: 12, height: 12)
                }
                Text("az elmúlt hét éjszaka").font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2).padding(.leading, 4)
            }
            if let a = obsAnswer {
                HStack(spacing: 8) { Glyph("check", "sage", size: 18); Text("Köszönöm, \(a.lowercased()) · figyelem tovább") }
                    .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.deep)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            } else {
                HStack(spacing: 8) {
                    ForEach(["Igaz", "Nem rólam szól", "Majd meglátjuk"], id: \.self) { a in
                        Button { withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { obsAnswer = a } } label: {
                            Text(a).font(.manrope(13, .bold)).foregroundStyle(Lagy.ink).lineLimit(1).minimumScaleFactor(0.85)
                                .padding(.horizontal, 12).frame(height: 40)
                                .background(Capsule().fill(Lagy.paper))
                        }
                        .buttonStyle(PressStyle())
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard()
        .sensoryFeedback(.success, trigger: obsAnswer)
    }

    // MARK: Boop card: the orb is Boop's small figure

    private var mezoCard: some View {
        HStack(alignment: .bottom, spacing: 6) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) { Glyph("spark", "sage", size: 16); Text("BOOP") }
                    .font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.deep)
                (Text("Ebédnél ") + Text("45 g fehérje").foregroundColor(Lagy.deep) + Text(" kell, hogy az esti edzésre is maradjon erőd. Csirkés tál a kamrádból megoldja."))
                    .font(.outfit(15.5)).foregroundStyle(Lagy.ink).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
                Pill(title: planned ? "Betervezve" : "Betervezem", glyph: planned ? ("check", "deep") : nil, soft: true) {
                    withAnimation(.spring) { planned = true }
                }
                .padding(.top, 4).padding(.bottom, 18)
                .sensoryFeedback(.success, trigger: planned)
            }
            .padding(.leading, 18).padding(.top, 18)
            LivingOrb(mood: mood, size: 92, motion: motion, palette: Lagy.orbColors, glow: false, level: 0.92)
                .padding(.trailing, 10).padding(.bottom, 14)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [.white, Lagy.sage3], startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Lagy.ink.opacity(0.10), radius: 18, y: 12)
        )
    }

    // MARK: demo-only controls

    private var demo: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("DEMÓ · MILYEN A NAPOD").font(.manrope(12, .bold)).tracking(0.6).foregroundStyle(Lagy.mute)
            Picker("Állapot", selection: $mood) { ForEach(Mood.allCases) { Text($0.label).tag($0) } }
                .pickerStyle(.segmented)
            Toggle(isOn: $crowded.animation(.easeInOut)) {
                Text("Zsúfolt nap (20 esemény)").font(.manrope(14)).foregroundStyle(Lagy.ink)
            }
            .tint(Lagy.sage)
            Button { showOnboarding = true } label: {
                Text("Első indítás (belépés, engedélyek)").font(.manrope(14, .bold)).foregroundStyle(Lagy.deep)
                    .frame(maxWidth: .infinity).frame(height: 44).background(Capsule().fill(Lagy.sage3))
            }
            .buttonStyle(PressStyle())
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 22).stroke(Lagy.ink.opacity(0.1), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }

    private func section<C: View>(_ title: String, link: String? = nil, go: String? = nil, delay: Double, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: title, link: link) { if go == "patterns" { openMoment = .patterns } else if let go { sheet = go } }
            c()
        }
        .padding(.horizontal, 16).padding(.top, 26)
        .entrance(delay)
    }
}

// MARK: - Pieces

struct LevelTube: View {
    var frac: Double
    @State private var shown = false
    var body: some View {
        ZStack(alignment: .bottom) {
            Capsule().fill(.white)
            Capsule()
                .fill(LinearGradient(colors: frac < 0.5 ? [Lagy.peach2, Lagy.peach] : [Lagy.sage2, frac >= 1 ? Lagy.deep : Lagy.sage],
                                     startPoint: .top, endPoint: .bottom))
                .frame(height: shown ? max(8, 72 * frac) : 0)
        }
        .frame(width: 26, height: 72)
        .clipShape(Capsule())
        .shadow(color: Lagy.ink.opacity(0.08), radius: 6, y: 4)
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.4)) { shown = true } }
    }
}

/// Boop's spoken verdict, typed as it is said; accent phrases deep green and tappable.
struct LagyVoiceText: View {
    var segs: [Seg]
    var shown: Int
    var size: CGFloat = 15.5
    var body: some View {
        ZStack(alignment: .topLeading) {
            Text(build(Int.max)).hidden()
            Text(build(shown))
        }
        .font(.manrope(size, .medium))
        .lineSpacing(4)
        .foregroundStyle(Lagy.ink2)
        .tint(Lagy.deep)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private func build(_ n: Int) -> AttributedString {
        var out = AttributedString()
        var left = n
        for s in segs {
            guard left > 0 else { break }
            var a = AttributedString(String(s.text.prefix(left)))
            left -= s.text.count
            if let l = s.link {
                a.link = URL(string: "boop://\(l)")
                a.foregroundColor = Lagy.deep
                a.font = .manrope(size, .bold)
                a.underlineStyle = Text.LineStyle(pattern: .dot, color: Lagy.sage)
            }
            out += a
        }
        return out
    }
}

struct LagySheetID: Identifiable { let id: String }

/// What opens behind an accent phrase or a section link: photo strip, h2, chips, a graphic.
struct LagyDetail: View {
    var kind: String
    var mood: Mood
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: -12) {
                    ForEach(photos, id: \.self) { p in
                        photo(p).resizable().scaledToFill().frame(width: 52, height: 52).clipShape(Circle())
                            .overlay(Circle().stroke(Lagy.paper, lineWidth: 3))
                    }
                }
                .padding(.top, 26)
                Text(title).font(.outfit(26)).tracking(-0.6).foregroundStyle(Lagy.ink)
                HStack(spacing: 6) { ForEach(chips, id: \.self) { Chip(text: $0, small: true) } }
                content
            }
            .padding(.horizontal, 20).padding(.bottom, 30)
        }
    }

    private var photos: [String] {
        switch kind { case "sleep": ["nap-ebredes-sq.jpg", "reggelfeny-sq.jpg"]; case "heart": ["edz-sulyzo-sq.jpg", "nap-ebredes-sq.jpg"]; default: ["nap-lista-sq.jpg", "edz-huzodzkodas-sq.jpg", "gorog-sq.jpg"] }
    }
    private var title: String { switch kind { case "sleep": "Az éjszakád"; case "heart": "Nyugalmi pulzus"; default: "A mai napod" } }
    private var chips: [String] {
        switch kind { case "sleep": ["Sleep Cycle", "7 óra 12 perc"]; case "heart": ["Huawei óra", "57 · heti átlag 59"]; default: ["Google Naptár", "7 esemény"] }
    }

    @ViewBuilder private var content: some View {
        switch kind {
        case "sleep":
            let st: [(String, Int, Color)] = [("Mély", 84, Lagy.deep), ("REM", 98, Lagy.berry), ("Könnyű", 228, Lagy.sky), ("Ébren", 22, Lagy.peach)]
            VStack(alignment: .leading, spacing: 14) {
                Chart(st, id: \.0) { s in
                    BarMark(x: .value("Perc", s.1), stacking: .normalized).foregroundStyle(s.2)
                }
                .chartXAxis(.hidden).frame(height: 16).clipShape(Capsule())
                ForEach(st, id: \.0) { s in
                    HStack {
                        Circle().fill(s.2).frame(width: 10, height: 10)
                        Text(s.0).font(.manrope(15)).foregroundStyle(Lagy.ink)
                        Spacer()
                        Text("\(s.1 / 60) óra \(s.1 % 60) perc").font(.outfit(15)).monospacedDigit().foregroundStyle(Lagy.ink)
                    }
                }
            }
            .padding(18).lagyCard()
        case "heart":
            let vals: [(String, Int)] = [("K", 59), ("Sze", 60), ("Cs", 58), ("P", 59), ("Szo", 61), ("V", 59), ("H", 57)]
            Chart(vals, id: \.0) { d in
                AreaMark(x: .value("Nap", d.0), yStart: .value("a", 54), yEnd: .value("bpm", d.1))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(colors: [Lagy.sage2.opacity(0.7), Lagy.sage3.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Nap", d.0), y: .value("bpm", d.1)).interpolationMethod(.catmullRom)
                    .foregroundStyle(Lagy.deep).lineStyle(.init(lineWidth: 3))
                PointMark(x: .value("Nap", d.0), y: .value("bpm", d.1)).foregroundStyle(d.0 == "H" ? Lagy.deep : Lagy.sage2)
            }
            .chartYScale(domain: 54...63).frame(height: 160)
            .padding(18).lagyCard()
        default:
            VStack(spacing: 0) {
                ForEach(Demo.events) { e in
                    HStack(spacing: 12) {
                        Text(e.time).font(.outfit(14)).monospacedDigit().foregroundStyle(Lagy.ink2).frame(width: 48, alignment: .leading)
                        Circle().fill(e.kind.lagyTint).frame(width: 10, height: 10)
                        Text(e.title).font(.manrope(14.5)).foregroundStyle(Lagy.ink)
                        Spacer()
                    }
                    .padding(.vertical, 11)
                }
            }
            .padding(.horizontal, 18).padding(.vertical, 6).lagyCard()
        }
    }
}

extension Demo.Event.Kind {
    var lagyTint: Color {
        switch self { case .work: Lagy.sky; case .food: Lagy.sun; case .train: Lagy.sage; case .sleep: Lagy.berry; case .conflict: Lagy.peach }
    }
}

// MARK: - Mood words in the Lágy page

struct LagyBarData { let label: String; let glyph: (String, String); let value: String; let unit: String; let frac: Double; let warn: Bool }

extension Mood {
    var lagyHeadline: (String, String, String) {
        switch self {
        case .good: ("Jól aludtál: ", "7 óra 12 perc", ". Este szorít a naptár.")
        case .okay: ("Rendben aludtál, de ", "rövid volt a REM", ". Dolgos nap jön.")
        case .tired: ("Rövid éjszaka volt: ", "5 óra 40 perc", ". Ma kíméld magad.")
        }
    }
    var lagyBars: [LagyBarData] {
        switch self {
        case .good: [
            .init(label: "Alvás", glyph: ("moon", "sky"), value: "7 óra 12", unit: "", frac: 0.9, warn: false),
            .init(label: "Pulzus", glyph: ("heart", "berry"), value: "57", unit: "−2", frac: 0.82, warn: false),
            .init(label: "Mélyalvás", glyph: ("bolt", "sun"), value: "+18", unit: "perc", frac: 0.86, warn: false),
        ]
        case .okay: [
            .init(label: "Alvás", glyph: ("moon", "sky"), value: "6 óra 58", unit: "", frac: 0.82, warn: false),
            .init(label: "Pulzus", glyph: ("heart", "berry"), value: "59", unit: "átlag", frac: 0.62, warn: false),
            .init(label: "REM", glyph: ("bolt", "sun"), value: "−22", unit: "perc", frac: 0.44, warn: true),
        ]
        case .tired: [
            .init(label: "Alvás", glyph: ("moon", "sky"), value: "5 óra 40", unit: "", frac: 0.55, warn: false),
            .init(label: "Pulzus", glyph: ("heart", "berry"), value: "62", unit: "+5", frac: 0.3, warn: true),
            .init(label: "Mélyalvás", glyph: ("bolt", "sun"), value: "38", unit: "perc", frac: 0.35, warn: true),
        ]
        }
    }
}
