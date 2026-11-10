import SwiftUI

// Throwaway spike (mezo-r36n9.3, plan S2.5 Task 0): the screens the owner has not seen yet, in the Napkelte look.
// Launch: -aura YES -auraFrame index   (a list; tap a row to open it)  or  -auraFrame <name>
// names: login register offline profile weight greeting permissions backfill napEmpty learning napOffline
//        plus notifications settings evening kimelo bodymap observations

private let fb = Color(hex: 0x0D1218)

struct AuraFrameRoot: View {
    @State private var open: String? = {
        let v = UserDefaults.standard.string(forKey: "auraFrame") ?? "index"
        return v == "index" ? nil : v
    }()
    static let screens: [(String, String, String)] = [
        ("login", "Bejelentkezés", "Belépés a Boop-fiókkal"),
        ("register", "Regisztráció", "meghívókóddal, egy hibás mezővel"),
        ("offline", "Nincs kapcsolat", "amikor a szerver nem érhető el"),
        ("profile", "Pár adat rólad", "bemutatkozás 1/3"),
        ("weight", "Az első mérés", "bemutatkozás 2/3"),
        ("greeting", "Szia, Boop vagyok", "bemutatkozás 3/3"),
        ("permissions", "Egészség és naptár", "engedélyek"),
        ("backfill", "60 nap betöltése", "haladás"),
        ("napEmpty", "Nap · még üres", "nincs bekötve"),
        ("learning", "Nap · még tanulom", "14 éjszaka alatt"),
        ("napOffline", "Nap · nincs net", "hibaállapot"),
        ("plus", "„+” gyors hozzáadás", "lap a fejlécből"),
        ("notifications", "Értesítések", "a csengő mögött"),
        ("settings", "Beállítások", "az avatar mögött"),
        ("evening", "Esti Mai", "este 21:10"),
        ("kimelo", "Kímélő mód", "2. nap · megfázás"),
        ("bodymap", "„Fáj valami?”", "check-in kérdés"),
        ("observations", "Boop észrevette", "a teljes lista"),
    ]

    var body: some View {
        ZStack {
            fb.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Új képernyők").font(AuraFont.serif(36)).foregroundStyle(.white).padding(.top, 20)
                    Text("Koppints bármelyikre. Vissza: bal felső nyíl, vagy lehúzás.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.6))
                        .padding(.bottom, 10)
                    ForEach(Self.screens, id: \.0) { s in
                        Button { open = s.0 } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.1).font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                                    Text(s.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                            }
                            .padding(16).auraGlass(20)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 40)
            }
        }
        .preferredColorScheme(.dark)
        .fullScreenCover(item: Binding(get: { open.map(FrameID.init) }, set: { open = $0?.id })) { f in
            screen(f.id) { open = nil }
        }
    }

    struct FrameID: Identifiable { let id: String }

    @ViewBuilder func screen(_ id: String, close: @escaping () -> Void) -> some View {
        switch id {
        case "login": FrameAuth(register: false, onClose: close)
        case "register": FrameAuth(register: true, onClose: close)
        case "offline": FrameOffline(onClose: close)
        case "profile": FrameProfile(onClose: close)
        case "weight": FrameWeight(onClose: close)
        case "greeting": FrameGreeting(onClose: close)
        case "permissions": FramePermissions(onClose: close)
        case "backfill": FrameBackfill(onClose: close)
        case "napEmpty": FrameNapState(state: 0, onClose: close)
        case "learning": FrameNapState(state: 1, onClose: close)
        case "napOffline": FrameNapState(state: 2, onClose: close)
        case "plus": FramePlus(onClose: close)
        case "notifications": FrameNotifications(onClose: close)
        case "settings": FrameSettings(onClose: close)
        case "evening": FrameMaiMode(mode: "evening", onClose: close)
        case "kimelo": FrameMaiMode(mode: "kimelo", onClose: close)
        case "bodymap": FrameBodyMap(onClose: close)
        default: FrameObservations(onClose: close)
        }
    }
}

// MARK: - Shared bits

private struct BackButton: View {
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
        }
        .buttonStyle(.plain)
    }
}

/// A glass text field: mono label, value, optional problem line under it.
struct GlassField: View {
    var label: String
    var value: String
    var placeholder = false
    var problem: String? = nil
    var secure = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased()).font(AuraFont.mono(11)).tracking(1.2).foregroundStyle(.white.opacity(0.6))
            HStack {
                Text(secure ? String(repeating: "•", count: value.count) : value)
                    .font(.system(size: 17)).foregroundStyle(.white.opacity(placeholder ? 0.35 : 1))
                Spacer()
            }
            .padding(.horizontal, 16).frame(height: 52)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(problem == nil ? .white.opacity(0.12) : Color(hex: 0xF06A9A).opacity(0.9), lineWidth: 1))
            if let p = problem {
                HStack(spacing: 6) {
                    Circle().fill(Color(hex: 0xF06A9A)).frame(width: 6, height: 6)
                    Text(p).font(.system(size: 13)).foregroundStyle(Color(hex: 0xF7A8C4))
                }
            }
        }
    }
}

/// Full-screen painted sky with the content floating over it (auth, greeting).
private struct SkyScreen<Content: View>: View {
    var hue: Int
    var onClose: () -> Void
    @ViewBuilder var content: Content
    var body: some View {
        ZStack(alignment: .topLeading) {
            PaintedLandscape(sky: PaintedLandscape.skies[hue]).ignoresSafeArea()
                .overlay(LinearGradient(colors: [.clear, fb.opacity(0.92)], startPoint: .init(x: 0.5, y: 0.35), endPoint: .bottom).ignoresSafeArea())
            ScrollView { content.padding(.horizontal, 20).padding(.bottom, 40) }.scrollIndicators(.hidden)
            BackButton(action: onClose).padding(.leading, 16).padding(.top, 4)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - Auth

struct FrameAuth: View {
    var register: Bool
    var onClose: () -> Void
    @State private var motion = OrbMotion()
    var body: some View {
        SkyScreen(hue: 0, onClose: onClose) {
            VStack(spacing: 0) {
                Text("boop").font(.custom("Outfit", size: 30).weight(.light)).tracking(4).foregroundStyle(.white).padding(.top, 70)
                LivingOrb(mood: .good, size: register ? 96 : 130, motion: motion, palette: SunMetric.all[0].orb, glow: true, level: 0.8)
                    .allowsHitTesting(false).padding(.top, 26)
                Text(register ? "Új fiók" : "Boop").font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75)).padding(.top, 26)
                Text(register ? "Kezdjük el" : "Jó újra látni").font(AuraFont.serif(40)).foregroundStyle(.white).padding(.top, 6)
                Text(register ? "A meghívókóddal regisztrálsz." : "Lépj be a Boop-fiókoddal.").font(.system(size: 16)).foregroundStyle(.white.opacity(0.8)).padding(.top, 6)
                VStack(spacing: 14) {
                    if register { GlassField(label: "A neved", value: "Dani") }
                    GlassField(label: "E-mail cím", value: "dani@example.hu")
                    GlassField(label: register ? "Jelszó · legalább 8 karakter" : "Jelszó", value: "jelszo123", secure: true)
                    if register { GlassField(label: "Meghívókód", value: "BOOP-7Q2K", problem: "Ezt a kódot már felhasználták. Kérj újat.") }
                }
                .padding(.top, 28)
                Text(register ? "Regisztrálok" : "Belépek").font(.system(size: 16, weight: .semibold)).foregroundStyle(fb)
                    .frame(maxWidth: .infinity).frame(height: 54).background(Capsule().fill(.white)).padding(.top, 24)
                Text(register ? "Már van fiókom" : "Van meghívókódom").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                    .padding(.top, 18)
            }
        }
        .onDisappear { motion.stop() }
    }
}

struct FrameOffline: View {
    var onClose: () -> Void
    var body: some View {
        SkyScreen(hue: 1, onClose: onClose) {
            VStack(spacing: 14) {
                Spacer(minLength: 220)
                StillOrb(colors: SunMetric.all[1].orb, size: 110, level: 0.3).saturation(0.3)
                Text("Nem érem el a szervert.").font(AuraFont.serif(32)).foregroundStyle(.white).multilineTextAlignment(.center).padding(.top, 10)
                Text("Nézd meg, van-e net. Amit eddig rögzítettél, megvan, és újra küldöm, amint visszajön a kapcsolat.")
                    .font(.system(size: 15.5)).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                Text("Újra próbálom").font(.system(size: 16, weight: .semibold)).foregroundStyle(fb)
                    .frame(maxWidth: .infinity).frame(height: 54).background(Capsule().fill(.white)).padding(.top, 14)
            }
        }
    }
}

// MARK: - Onboarding

struct FrameProfile: View {
    var onClose: () -> Void
    @State private var sex = 1
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[0], crumb: "Bemutatkozás · 1/3", eyebrow: "Szia, Dani", title: "Pár adat rólad",
                      sub: "Ebből számolom a keretedet.", onClose: onClose) {
            VStack(alignment: .leading, spacing: 16) {
                GlassField(label: "Születési dátum", value: "1989. április 12.")
                VStack(alignment: .leading, spacing: 8) {
                    AuraMono("NEM")
                    HStack(spacing: 8) {
                        ForEach(Array(["Nő", "Férfi", "Nem mondom meg"].enumerated()), id: \.offset) { i, t in
                            Text(t).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(sex == i ? fb : .white)
                                .padding(.horizontal, 14).frame(height: 40)
                                .background(Capsule().fill(sex == i ? .white : .white.opacity(0.1)))
                                .onTapGesture { sex = i }
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 4) {
                    AuraMono("MAGASSÁG")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("182").font(.custom("Outfit", size: 52).weight(.light)).foregroundStyle(.white)
                        Text("centi").font(.system(size: 15)).foregroundStyle(.white.opacity(0.7))
                    }
                    MiniRuler(center: 182).frame(height: 54)
                }
            }
            .padding(20).auraGlass()
            AuraPill(text: "Tovább").padding(.top, 6)
        }
    }
}

struct FrameWeight: View {
    var onClose: () -> Void
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[3], crumb: "Bemutatkozás · 2/3", eyebrow: "Az első mérés", title: "Mennyi ma?",
                      sub: "Ébredés után, mosdó után a legpontosabb.", onClose: onClose) {
            VStack(spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("82,4").font(.custom("Outfit", size: 64).weight(.light)).foregroundStyle(.white)
                    Text("kiló").font(.system(size: 16)).foregroundStyle(.white.opacity(0.7))
                }
                MiniRuler(center: 82).frame(height: 54)
                Text("Húzd oldalra · tizedenként rezeg").font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.vertical, 22).auraGlass()
            AuraPill(text: "Rögzítem").padding(.top, 6)
        }
    }
}

struct MiniRuler: View {
    var center: Int
    var body: some View {
        Canvas { ctx, s in
            let mid = s.width / 2, step: CGFloat = 9
            let n = Int(mid / step) + 2
            for k in -n...n {
                let x = mid + CGFloat(k) * step
                let major = k % 10 == 0, half = k % 5 == 0
                let h: CGFloat = major ? 24 : (half ? 16 : 10)
                let fade = max(0, 1 - abs(CGFloat(k)) / CGFloat(n))
                var p = Path(); p.move(to: CGPoint(x: x, y: 2)); p.addLine(to: CGPoint(x: x, y: 2 + h))
                ctx.stroke(p, with: .color(.white.opacity(0.7 * fade)), lineWidth: major ? 1.6 : 1)
                if major { ctx.draw(Text("\(center + k / 10)").font(AuraFont.mono(11)).foregroundColor(Color.white.opacity(0.7 * fade)), at: CGPoint(x: x, y: 42)) }
            }
            var c = Path(); c.move(to: CGPoint(x: mid, y: 0)); c.addLine(to: CGPoint(x: mid, y: 32))
            ctx.stroke(c, with: .color(.white), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
        }
    }
}

struct FrameGreeting: View {
    var onClose: () -> Void
    @State private var motion = OrbMotion()
    var body: some View {
        SkyScreen(hue: 0, onClose: onClose) {
            VStack(spacing: 0) {
                LivingOrb(mood: .good, size: 220, motion: motion, palette: SunMetric.all[0].orb, glow: true, level: 0.85)
                    .allowsHitTesting(false).padding(.top, 110)
                Text("BEMUTATKOZÁS · 3/3").font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75)).padding(.top, 34)
                Text("Szia, Boop vagyok").font(AuraFont.serif(42)).foregroundStyle(.white).padding(.top, 8)
                Text("Innentől én viszem a reggeleidet.").font(.system(size: 16)).foregroundStyle(.white.opacity(0.85)).padding(.top, 6)
                Text("Minden reggel elmondom, hogyan aludtál, mire lesz erőd, és mi fér bele a napodba. Ez a gömb vagyok én: minél jobb a napod, annál magasabbra kelek.")
                    .font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center).padding(.top, 20)
                Text("Kezdjük el").font(.system(size: 16, weight: .semibold)).foregroundStyle(fb)
                    .frame(maxWidth: .infinity).frame(height: 54).background(Capsule().fill(.white)).padding(.top, 30)
            }
        }
        .onDisappear { motion.stop() }
    }
}

struct FramePermissions: View {
    var onClose: () -> Void
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[1], crumb: "Egészség és naptár", eyebrow: "Kössük össze", title: "Egészség és naptár",
                      sub: "Ebből tudom, milyen napod lesz.", onClose: onClose) {
            VStack(spacing: 0) {
                row("heart-cream", "Apple Egészség", "alvás, pulzus, lépések, edzések", done: true)
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.leading, 58)
                row("clock-ink", "Naptár", "a mai és a holnapi eseményeid", done: false)
            }
            .padding(16).auraGlass()
            HStack(alignment: .top, spacing: 10) {
                AuraGlyph("spark-cream", .white.opacity(0.8), size: 16)
                Text("Amikor az iPhone megkérdezi, mennyi adatot adjon, a teljeset válaszd — így látom mind a 60 napot.")
                    .font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
            }
            .padding(16).auraGlass(20)
            AuraPill(text: "Engedélyezem").padding(.top, 6)
        }
    }
    private func row(_ g: String, _ t: String, _ sub: String, done: Bool) -> some View {
        HStack(spacing: 14) {
            AuraGlyph(g, .white, size: 18).frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.1)))
            VStack(alignment: .leading, spacing: 2) {
                Text(t).font(.system(size: 16.5, weight: .medium)).foregroundStyle(.white)
                Text(sub).font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
            }
            Spacer()
            Text(done ? "Bekötve" : "Még nincs").font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(done ? fb : .white.opacity(0.8))
                .padding(.horizontal, 10).padding(.vertical, 6).background(Capsule().fill(done ? .white : .white.opacity(0.1)))
        }
        .padding(.vertical, 8)
    }
}

struct FrameBackfill: View {
    var onClose: () -> Void
    @State private var motion = OrbMotion()
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[1], crumb: "Egészség és naptár", eyebrow: "Beérkezett adatok", title: "Behúzom az elmúlt 60 napot",
                      sub: "Pár perc, közben használhatod a telefont.", onClose: onClose) {
            VStack(spacing: 18) {
                ZStack {
                    LivingOrb(mood: .good, size: 150, motion: motion, palette: SunMetric.all[1].orb, glow: true, level: 0.62).allowsHitTesting(false)
                    Text("62 %").font(.custom("Outfit", size: 40).weight(.light)).foregroundStyle(.white).shadow(color: .black.opacity(0.3), radius: 6)
                }
                VStack(spacing: 0) {
                    count("moon-cream", "Alvás", "35 éjszaka")
                    count("shoe-cream", "Napok", "61 nap")
                    count("dumbbell-ink", "Edzések", "16 edzés")
                    count("clock-ink", "Naptár", "várakozik…", dim: true)
                }
            }
            .padding(20).auraGlass()
        }
        .onDisappear { motion.stop() }
    }
    private func count(_ g: String, _ t: String, _ v: String, dim: Bool = false) -> some View {
        HStack(spacing: 12) {
            AuraGlyph(g, .white.opacity(dim ? 0.5 : 1), size: 16)
            Text(t).font(.system(size: 15)).foregroundStyle(.white.opacity(dim ? 0.5 : 0.9))
            Spacer()
            Text(v).font(.custom("Outfit", size: 17).weight(.light)).foregroundStyle(.white.opacity(dim ? 0.5 : 1))
        }
        .padding(.vertical, 9)
    }
}

// MARK: - Nap states (empty / learning / offline)

struct FrameNapState: View {
    var state: Int          // 0 not connected, 1 learning, 2 offline
    var onClose: () -> Void
    @State private var motion = OrbMotion()
    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(colors: [SunMetric.all[0].top.mix(with: fb, by: 0.55), SunMetric.all[0].top.mix(with: fb, by: 0.78)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        Color.clear.frame(height: 640).overlay { PaintedLandscape(sky: PaintedLandscape.skies[0]).saturation(state == 2 ? 0.35 : 0.75) }.clipped()
                            .mask(LinearGradient(stops: [.init(color: .black, location: 0.6), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                        VStack(spacing: 0) {
                            HStack {
                                AuraGlyph("bell-cream", .white, size: 20).frame(width: 40, height: 40)
                                Spacer()
                                Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white)
                                Spacer()
                                AuraGlyph("plus-ink", .white, size: 18).frame(width: 40, height: 40)
                                AuraGlyph("person-sage", .white, size: 18).frame(width: 40, height: 40).glassEffect(.clear, in: .circle)
                            }
                            .padding(.horizontal, 16).padding(.top, 54)
                            HStack(spacing: 0) {
                                ForEach(["Mai", "A napom", "Beszélgetés", "Rutin"], id: \.self) { t in
                                    VStack(spacing: 7) {
                                        Text(t).font(.system(size: 15, weight: t == "Mai" ? .semibold : .regular)).foregroundStyle(.white.opacity(t == "Mai" ? 1 : 0.62))
                                        Capsule().fill(.white).frame(height: 1).opacity(t == "Mai" ? 1 : 0).padding(.horizontal, 6)
                                    }
                                    .fixedSize().frame(maxWidth: .infinity)
                                }
                            }
                            .padding(.horizontal, 12).padding(.top, 10)
                            ZStack {
                                StillOrb(colors: SunMetric.all[0].orb, size: 150, level: state == 1 ? 0.64 : 0.25).saturation(state == 1 ? 0.6 : 0.2)
                                VStack(spacing: 2) {
                                    Text(state == 1 ? "9 / 14" : "–").font(.custom("Outfit", size: state == 1 ? 34 : 48).weight(.light)).foregroundStyle(.white)
                                    if state == 1 { Text("éjszaka").font(.system(size: 12)).foregroundStyle(.white.opacity(0.75)) }
                                }
                                .shadow(color: .black.opacity(0.3), radius: 6)
                            }
                            .padding(.top, 80)
                            Text(["MÉG ÜRES", "MÉG TANULOM", "NINCS KAPCSOLAT"][state]).font(.system(size: 14, weight: .semibold)).tracking(2.6)
                                .foregroundStyle(.white.opacity(0.85)).padding(.top, 34)
                            Text(["Még üres a napod", "Még tanulom a ritmusod", "Most nem érem el az adataidat"][state])
                                .font(AuraFont.serif(state == 2 ? 32 : 38)).foregroundStyle(.white).multilineTextAlignment(.center).padding(.top, 10).padding(.horizontal, 20)
                            Text(["Kösd össze az Egészséget és a naptárat, és holnap reggeltől én viszem a napodat.",
                                  "9 éjszakát látok, 14 kell, hogy pontos legyek. Addig is mutatom, amit már tudok, de pontszámot még nem adok.",
                                  "Amit ma rögzítettél, megvan. Amint visszajön a net, frissítem a reggeledet."][state])
                                .font(.system(size: 16)).lineSpacing(3).foregroundStyle(.white.opacity(0.82)).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 10)
                            Text(["Összekötöm", "Mit tudok már?", "Újra próbálom"][state]).font(.system(size: 16, weight: .semibold)).foregroundStyle(fb)
                                .padding(.horizontal, 24).frame(height: 50).background(Capsule().fill(.white)).padding(.top, 18)
                        }
                    }
                    if state == 1 {
                        HStack(spacing: 10) {
                            LensTile(label: "ALVÁS", value: "7ó 12p", sub: "ma éjjel") { NightArc() }
                            LensTile(label: "LÉPÉSEK", value: "5 580", sub: "tegnap 8 920") { StepTrail(progress: 0.62) }
                            LensTile(label: "PULZUS", value: "57", sub: "nyugalmi") { GlowLine(points: [0.55, 0.5, 0.62, 0.42, 0.35, 0.42, 0.2], color: .white, nowAt: nil) }
                        }
                        .padding(.horizontal, 16).padding(.top, 10)
                    }
                    if state == 0 {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 12) {
                                AuraGlyph("heart-cream", .white, size: 18).frame(width: 44, height: 44).background(Circle().fill(.white.opacity(0.1)))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Kössük össze").font(.system(size: 16.5, weight: .medium)).foregroundStyle(.white)
                                    Text("Apple Egészség és naptár · 1 perc").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                                }
                                Spacer()
                            }
                            Text("Az edzés- és étrendtervedet a webes appban állítsd be ezzel a fiókkal, onnan én viszem.")
                                .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.7))
                        }
                        .padding(18).auraGlass().padding(.horizontal, 16).padding(.top, 10)
                    }
                    Spacer(minLength: 120)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            BackButton(action: onClose).padding(.leading, 16).padding(.top, 4)
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - "+" sheet, notifications, settings

struct FramePlus: View {
    var onClose: () -> Void
    var body: some View {
        ZStack(alignment: .bottom) {
            FrameNapState(state: 1, onClose: onClose).blur(radius: 2).overlay(Color.black.opacity(0.35)).allowsHitTesting(false)
            VStack(alignment: .leading, spacing: 16) {
                Capsule().fill(.white.opacity(0.3)).frame(width: 40, height: 5).frame(maxWidth: .infinity).padding(.top, 8)
                Text("Mit rögzítsünk?").font(AuraFont.serif(28)).foregroundStyle(.white)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    big("drop-sky", "Víz", "+250 ml")
                    big("camera-ink", "Étel", "fotó vagy szó")
                    big("scale-ink", "Súly", "82,4 tegnap")
                    big("dumbbell-ink", "Edzés", "Felsőtest")
                    big("pen-sun", "Napló", "pár sor")
                    big("pen-sun", "Check-in", "reggeli")
                }
                AuraMono("LEGUTÓBB")
                HStack(spacing: 8) {
                    chip("Szokásos reggeli"); chip("Kávé tejjel"); chip("Görög joghurt")
                }
                Text("Bezárom").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity).padding(.top, 4).onTapGesture { onClose() }
            }
            .padding(.horizontal, 20).padding(.bottom, 30)
            .background(UnevenRoundedRectangle(topLeadingRadius: 34, topTrailingRadius: 34, style: .continuous).fill(Color(hex: 0x161B24)).ignoresSafeArea())
        }
        .preferredColorScheme(.dark)
    }
    private func big(_ g: String, _ t: String, _ s: String) -> some View {
        VStack(spacing: 8) {
            AuraGlyph(g, .white, size: 22).frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.1)))
            Text(t).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
            Text(s).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 16).auraGlass(22)
    }
    private func chip(_ t: String) -> some View {
        Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
            .padding(.horizontal, 12).frame(height: 36).glassEffect(.clear, in: .capsule)
    }
}

struct FrameNotifications: View {
    var onClose: () -> Void
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[0], crumb: "Értesítések", eyebrow: "3 új", title: "Értesítések", sub: "Amit Boop szólt neked.", onClose: onClose) {
            group("MA", [
                ("spark-cream", "Elkészült a reggeli üzeneted", "Jó napod lesz — told 18:30-ra az edzést.", "06:58", true),
                ("pen-sun", "Reggeli check-in", "Fél perc, hat kérdés.", "07:00", true),
                ("drop-sky", "Igyál egy pohár vizet", "1,25 l-nél tartasz a 2,5-ből.", "10:30", true)])
            group("TEGNAP", [
                ("moon-cream", "Lefekvés 22:45", "21:30 után képernyő nélkül.", "22:15", false),
                ("dumbbell-ink", "Edzés kész", "Felsőtest · 58 perc · 9 tonna.", "19:32", false)])
        }
    }
    private func group(_ t: String, _ rows: [(String, String, String, String, Bool)]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            AuraMono(t).padding(.bottom, 8)
            ForEach(rows.indices, id: \.self) { i in
                let r = rows[i]
                HStack(alignment: .top, spacing: 12) {
                    AuraGlyph(r.0, .white, size: 16).frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.1)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.1).font(.system(size: 15.5, weight: r.4 ? .semibold : .regular)).foregroundStyle(.white)
                        Text(r.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 6) {
                        Text(r.3).font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.5))
                        if r.4 { Circle().fill(.white).frame(width: 7, height: 7) }
                    }
                }
                .padding(.vertical, 10)
            }
        }
        .padding(18).auraGlass()
    }
}

struct FrameSettings: View {
    var onClose: () -> Void
    @State private var voice = true
    @State private var morning = true
    @State private var evening = true
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[0], crumb: "Beállítások", eyebrow: "Fiók", title: "Dani", sub: "dani@example.hu · Boop-fiók", onClose: onClose) {
            section("BOOP HANGJA") {
                toggle("Felolvassa a reggeli üzenetet", $voice)
                line("Hang", "Magyar · fejlett")
            }
            section("ÉRTESÍTÉSEK") {
                toggle("Reggeli üzenet és check-in", $morning)
                toggle("Esti lefekvés-emlékeztető", $evening)
            }
            section("ADATOK") {
                line("Apple Egészség", "Bekötve · 35 éjszaka")
                line("Naptár", "Nincs Google-fiók az iPhone-on")
                line("Edzés- és étrendterv", "a webes appban ›")
            }
            Text("Kijelentkezem").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color(hex: 0xF7A8C4))
                .frame(maxWidth: .infinity).frame(height: 52).background(Capsule().fill(.white.opacity(0.08)))
        }
    }
    private func section<C: View>(_ t: String, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) { AuraMono(t).padding(.bottom, 6); c() }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).auraGlass()
    }
    private func toggle(_ t: String, _ b: Binding<Bool>) -> some View {
        Toggle(isOn: b) { Text(t).font(.system(size: 15.5)).foregroundStyle(.white) }.tint(.white.opacity(0.85)).padding(.vertical, 6)
    }
    private func line(_ t: String, _ v: String) -> some View {
        HStack { Text(t).font(.system(size: 15.5)).foregroundStyle(.white); Spacer(); Text(v).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.6)) }
            .padding(.vertical, 9)
    }
}

// MARK: - Evening Mai and kímélő Mai

struct FrameMaiMode: View {
    var mode: String
    var onClose: () -> Void
    @State private var motion = OrbMotion()
    private var evening: Bool { mode == "evening" }
    var body: some View {
        let sky: [Color] = evening ? [Color(hex: 0x1B1640), Color(hex: 0x5A3A7A), Color(hex: 0xE9A27A)] : [Color(hex: 0x2A3A4E), Color(hex: 0x6E8FA0), Color(hex: 0xD6E4DC)]
        let orb: [Color] = evening ? SunMetric.all[0].orb : [Color(hex: 0x29404F), Color(hex: 0x5F8FA0), Color(hex: 0xBFD9D2), Color(hex: 0xF4E9C8)]
        ZStack(alignment: .topLeading) {
            LinearGradient(colors: [sky[0].mix(with: fb, by: 0.55), sky[0].mix(with: fb, by: 0.8)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    ZStack(alignment: .top) {
                        Color.clear.frame(height: 700).overlay { PaintedLandscape(sky: sky) }.clipped()
                            .mask(LinearGradient(stops: [.init(color: .black, location: 0.62), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                        VStack(spacing: 0) {
                            Text("boop").font(.custom("Outfit", size: 26).weight(.light)).tracking(3).foregroundStyle(.white).padding(.top, 60)
                            if !evening {
                                HStack(spacing: 8) {
                                    AuraGlyph("heart-cream", .white, size: 14)
                                    Text("Kímélő mód · 2. nap · megfázás").font(.system(size: 13.5, weight: .semibold)).foregroundStyle(.white)
                                    Text("Kilépek").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                                }
                                .padding(.horizontal, 14).frame(height: 36).glassEffect(.clear, in: .capsule).padding(.top, 14)
                            }
                            ZStack {
                                LivingOrb(mood: .good, size: 150, motion: motion, palette: orb, glow: true, level: evening ? 0.78 : 0.42).allowsHitTesting(false)
                                Text(evening ? "78" : "42").font(.custom("Outfit", size: 56).weight(.light)).foregroundStyle(.white).shadow(color: .black.opacity(0.3), radius: 8)
                            }
                            .padding(.top, evening ? 120 : 90)
                            Text(evening ? "FORMA · ESTE" : "FORMA · KÍMÉLŐ").font(.system(size: 14, weight: .semibold)).tracking(2.6).foregroundStyle(.white.opacity(0.85)).padding(.top, 40)
                            Text(evening ? "Szép nap volt" : "Ma csak pihenj").font(AuraFont.serif(42)).foregroundStyle(.white).padding(.top, 10)
                            Text(evening ? "Megvolt az edzés és 9 200 lépés. Egy esti check-in és 22:45-kor ágy, hogy holnap is így ébredj."
                                         : "A pulzusod még öt ütéssel magasabb. Edzés helyett ma víz, alvás és egy rövid séta, ha jólesik.")
                                .font(.system(size: 16.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center).padding(.horizontal, 30).padding(.top, 10)
                            Text(evening ? "Esti check-in" : "Hogy vagy ma?").font(.system(size: 16, weight: .semibold)).foregroundStyle(fb)
                                .padding(.horizontal, 24).frame(height: 50).background(Capsule().fill(.white)).padding(.top, 18)
                        }
                    }
                    modePath(evening: evening).padding(.horizontal, 16).padding(.top, 10)
                    Spacer(minLength: 120)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            BackButton(action: onClose).padding(.leading, 16).padding(.top, 4)
        }
        .preferredColorScheme(.dark)
        .onDisappear { motion.stop() }
    }

    private func modePath(evening: Bool) -> some View {
        let rows: [(String, String, String, Bool)] = evening ? [
            ("18:30", "Felsőtest edzés", "58 perc · kész", true), ("20:00", "Vacsora", "lazac salátával · 450 kcal", true),
            ("21:10", "MOST", "", true), ("21:30", "Esti check-in", "napzárás · a nap kérdése", false), ("22:45", "Lefekvés", "emlékeztető 22:15-kor", false)]
            : [("08:40", "MOST", "", true), ("", "Hogy vagy ma?", "rövid check-in: láz, torok, energia", false),
               ("", "Víz", "2,5 l ma · 0,5 l-nél tartasz", false), ("15:00", "Séta, ha jólesik", "10 perc a napon", false),
               ("", "Edzés szünetel", "kímélő mód · holnap újra megnézzük", false), ("22:00", "Korai lefekvés", "a regeneráció itt történik", false)]
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(rows.indices, id: \.self) { i in
                let r = rows[i]
                HStack(alignment: .top, spacing: 12) {
                    Text(r.0).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(r.1 == "MOST" ? 1 : (r.3 ? 0.45 : 0.7))).frame(width: 42, alignment: .trailing).padding(.top, 2)
                    ZStack(alignment: .top) {
                        Rectangle().fill(r.3 && i < rows.count - 1 && rows[i + 1].3 ? .white : .white.opacity(0.16)).frame(width: 2, height: 58).offset(y: 10)
                            .opacity(i == rows.count - 1 ? 0 : 1)
                        Circle().fill(r.1 == "MOST" ? .white : (r.3 ? .white : fb)).frame(width: r.1 == "MOST" ? 12 : 20, height: r.1 == "MOST" ? 12 : 20)
                            .overlay(Circle().stroke(.white.opacity(r.3 ? 0 : 0.4), lineWidth: 1.2))
                    }
                    .frame(width: 24, height: 58, alignment: .top)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.1).font(r.1 == "MOST" ? AuraFont.mono(11, .bold) : .system(size: 15.5, weight: r.3 ? .regular : .medium))
                            .foregroundStyle(.white.opacity(r.3 && r.1 != "MOST" ? 0.6 : 1))
                        if !r.2.isEmpty { Text(r.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55)) }
                    }
                    Spacer()
                }
            }
        }
    }
}

// MARK: - Check-in: "Fáj valami?"

struct FrameBodyMap: View {
    var onClose: () -> Void
    @State private var picked: Set<String> = ["váll · jobb", "térd · bal"]
    private let zones: [(String, CGRect)] = [
        ("fej", CGRect(x: 0.43, y: 0.02, width: 0.14, height: 0.1)), ("nyak", CGRect(x: 0.45, y: 0.12, width: 0.1, height: 0.04)),
        ("váll · bal", CGRect(x: 0.27, y: 0.16, width: 0.13, height: 0.07)), ("váll · jobb", CGRect(x: 0.6, y: 0.16, width: 0.13, height: 0.07)),
        ("hát", CGRect(x: 0.4, y: 0.2, width: 0.2, height: 0.2)), ("csukló", CGRect(x: 0.16, y: 0.42, width: 0.1, height: 0.06)),
        ("csípő", CGRect(x: 0.38, y: 0.42, width: 0.24, height: 0.08)), ("térd · bal", CGRect(x: 0.38, y: 0.64, width: 0.1, height: 0.07)),
        ("térd · jobb", CGRect(x: 0.52, y: 0.64, width: 0.1, height: 0.07)), ("boka", CGRect(x: 0.38, y: 0.9, width: 0.24, height: 0.06))]
    var body: some View {
        ZStack {
            PaintedLandscape(sky: PaintedLandscape.skies[4]).ignoresSafeArea()
                .overlay(LinearGradient(colors: [.clear, fb.opacity(0.88)], startPoint: .center, endPoint: .bottom).ignoresSafeArea())
            VStack(spacing: 0) {
                HStack {
                    BackButton(action: onClose)
                    Spacer()
                    HStack(spacing: 6) { ForEach(0..<7) { k in Capsule().fill(.white.opacity(k <= 3 ? 0.95 : 0.3)).frame(width: k == 3 ? 22 : 7, height: 7) } }
                    Spacer()
                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.horizontal, 16).padding(.top, 8)
                Text("TEST").font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.8)).padding(.top, 26)
                Text("Fáj valami?").font(AuraFont.serif(36)).foregroundStyle(.white).padding(.top, 8)
                Text("Koppints oda, ahol érzed. Többet is választhatsz.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.75)).padding(.top, 6)
                GeometryReader { g in
                    let w = min(g.size.width, g.size.height * 0.5), h = w * 2
                    let ox = (g.size.width - w) / 2
                    ZStack(alignment: .topLeading) {
                        BodySilhouette().fill(.white.opacity(0.08)).frame(width: w, height: h).offset(x: ox)
                        BodySilhouette().stroke(.white.opacity(0.5), lineWidth: 1.4).frame(width: w, height: h).offset(x: ox)
                        ForEach(zones, id: \.0) { z in
                            let on = picked.contains(z.0)
                            Ellipse().fill(on ? Color(hex: 0xF06A9A).opacity(0.55) : .white.opacity(0.001))
                                .overlay(Ellipse().stroke(on ? Color(hex: 0xF7A8C4) : .clear, lineWidth: 1.2))
                                .shadow(color: on ? Color(hex: 0xF06A9A) : .clear, radius: 10)
                                .frame(width: z.1.width * w, height: z.1.height * h)
                                .offset(x: ox + z.1.minX * w, y: z.1.minY * h)
                                .onTapGesture { if on { picked.remove(z.0) } else { picked.insert(z.0) } }
                        }
                    }
                }
                .frame(height: 360).padding(.top, 14)
                HStack(spacing: 8) {
                    ForEach(Array(picked).sorted(), id: \.self) { p in
                        Text(p).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).frame(height: 34).glassEffect(.clear, in: .capsule)
                    }
                }
                .padding(.top, 12)
                Spacer()
                HStack(spacing: 10) {
                    AuraPill(text: "Nem fáj semmi", primary: false)
                    AuraPill(text: "Tovább")
                }
                .padding(.horizontal, 20).padding(.bottom, 16)
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct BodySilhouette: Shape {
    func path(in r: CGRect) -> Path {
        let w = r.width, h = r.height
        func P(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: r.minX + x * w, y: r.minY + y * h) }
        var p = Path()
        p.addEllipse(in: CGRect(x: r.minX + 0.43 * w, y: r.minY + 0.02 * h, width: 0.14 * w, height: 0.1 * h))
        p.move(to: P(0.46, 0.12)); p.addLine(to: P(0.54, 0.12)); p.addLine(to: P(0.55, 0.15))
        p.addQuadCurve(to: P(0.72, 0.19), control: P(0.68, 0.15))
        p.addLine(to: P(0.8, 0.44)); p.addLine(to: P(0.74, 0.46)); p.addLine(to: P(0.66, 0.26))
        p.addLine(to: P(0.63, 0.46)); p.addLine(to: P(0.62, 0.95)); p.addLine(to: P(0.53, 0.95)); p.addLine(to: P(0.5, 0.56))
        p.addLine(to: P(0.47, 0.95)); p.addLine(to: P(0.38, 0.95)); p.addLine(to: P(0.37, 0.46)); p.addLine(to: P(0.34, 0.26))
        p.addLine(to: P(0.26, 0.46)); p.addLine(to: P(0.2, 0.44)); p.addLine(to: P(0.28, 0.19))
        p.addQuadCurve(to: P(0.45, 0.15), control: P(0.32, 0.15)); p.closeSubpath()
        return p
    }
}

// MARK: - Boop észrevette: the full list

struct FrameObservations: View {
    var onClose: () -> Void
    @State private var states: [Int: String] = [:]
    private let items: [(String, String, String, Int, String)] = [
        ("Amikor 23:00 előtt fekszel le, ", "másnap 9 ponttal jobb a Formád", ". 4-ből 4 alkalommal így volt.", 4, "alvás"),
        ("Az edzésnapokon ", "délután 3-kor mélyebb a hullámvölgyed", ", ha ebédre kevés a fehérje.", 3, "étkezés"),
        ("Hétfőnként ", "a feszültséged 2-vel magasabb", " a hét többi napjánál.", 3, "közérzet"),
        ("Ha este 20:00 után eszel, ", "rövidebb a mélyalvásod", " átlagosan 14 perccel.", 2, "alvás"),
        ("A 9 000 lépéses napokon ", "nyugodtabb a pulzusod", " másnap reggel.", 2, "mozgás")]
    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[0], crumb: "Nap · Boop észrevette", eyebrow: "5 megfigyelés", title: "Boop észrevette",
                      sub: "Amit a napjaidból tanulok. Te döntöd el, mit figyeljek tovább.", onClose: onClose) {
            ForEach(items.indices, id: \.self) { i in
                let it = items[i]
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        HStack(spacing: 4) { ForEach(0..<5) { k in Circle().fill(.white.opacity(k < it.3 ? 0.85 : 0.2)).frame(width: 6, height: 6) } }
                        Text(it.3 >= 4 ? "erős minta" : (it.3 == 3 ? "kirajzolódik" : "még kevés adat")).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                        Spacer()
                        Text(it.4.uppercased()).font(AuraFont.mono(10.5)).tracking(1.2).foregroundStyle(.white.opacity(0.5))
                    }
                    (Text(it.0) + Text(it.1).bold().foregroundColor(.white) + Text(it.2))
                        .font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.78))
                    if let s = states[i] {
                        Text(s).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
                    } else {
                        HStack(spacing: 8) {
                            btn("Figyeljem tovább", filled: true) { states[i] = "Figyelem tovább ✓" }
                            btn("Elengedem", filled: false) { states[i] = "Elengedve" }
                        }
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).auraGlass()
                .opacity(states[i] == "Elengedve" ? 0.5 : 1)
            }
        }
    }
    private func btn(_ t: String, filled: Bool, _ a: @escaping () -> Void) -> some View {
        Button(action: { withAnimation { a() } }) {
            Text(t).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(filled ? fb : .white)
                .padding(.horizontal, 13).padding(.vertical, 8).background(Capsule().fill(filled ? .white : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}
