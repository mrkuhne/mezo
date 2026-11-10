import SwiftUI

// Throwaway spike (mezo-r36n9.3): the orb as a lens. The selected metric decides the hero's main action
// and the cards below it (owner, 2026-11-10): Készenlét = morning ritual, Alvás = tonight, Mozgás = start
// training, Fuel = quick food log, Pulzus = calm down.

private let lensBase = Color(hex: 0x0D1218)

// MARK: - The hero action: one white pill that melts into the next metric's action + Boop's voice button

struct AuraLensAction: View {
    var sel: Int
    var orb: [Color]
    var motion: OrbMotion
    var breathing: Bool
    @Binding var reminderSet: Bool
    var onPrimary: (String) -> Void
    var onSpeak: () -> Void
    @Namespace private var ns

    private var label: (String, String) {
        switch sel {
        case 1: reminderSet ? ("check-ink", "Emlékeztetlek 22:15-kor") : ("moon-cream", "Lefekvés 22:45 · Emlékeztess")
        case 2: ("dumbbell-ink", "Edzés indítása")
        case 3: ("camera-ink", "Lefotózom")
        case 4: breathing ? ("check-ink", "Kész") : ("heart-cream", "Légzés · 1 perc")
        default: ("pen-sun", "Kitöltöm")
        }
    }

    var body: some View {
        VStack(spacing: 12) {
            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 10) {
                    primary
                    Button(action: onSpeak) {
                        LivingOrb(mood: .good, size: 24, motion: motion, palette: orb, glow: false, level: 0.85)
                            .allowsHitTesting(false)
                            .frame(width: 50, height: 50)
                    }
                    .buttonStyle(.plain)
                    .glassEffect(.clear.interactive(), in: .circle)
                    .glassEffectID("voice", in: ns)
                    .accessibilityLabel("Boop elmondja")
                }
            }
            if sel == 3 {
                HStack(spacing: 8) {
                    chip("Szokásos reggeli", "bowl-cream", "Szokásos reggeli · 523 kcal")
                    chip("Kávé", "drop-sky", "Kávé · 5 kcal")
                    chip("Víz +250 ml", "drop-sky", "Víz · +250 ml")
                }
                .transition(.opacity.combined(with: .offset(y: 8)))
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.85), value: sel)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: reminderSet)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: breathing)
    }

    @ViewBuilder private var primary: some View {
        let core = Button { onPrimary(["checkin", "bedtime", "workout", "meal", "breath"][sel]) } label: {
            HStack(spacing: 8) {
                AuraGlyph(label.0, lensBase, size: 17)
                Text(label.1).font(.system(size: 16, weight: .semibold)).foregroundStyle(lensBase)
                    .contentTransition(.interpolate)
            }
            .padding(.horizontal, 22).frame(height: 50)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.tint(.white).interactive(), in: .capsule)
        .glassEffectID("primary", in: ns)
        if sel == 2 {
            core.contextMenu {
                Button { onPrimary("workout") } label: { Label("Mai edzés · Felsőtest", systemImage: "chevron.right") }
                Button { onPrimary("run") } label: { Label("Futás", systemImage: "chevron.right") }
                Button { onPrimary("walk") } label: { Label("Séta", systemImage: "chevron.right") }
            }
        } else {
            core
        }
    }

    private func chip(_ t: String, _ g: String, _ toast: String) -> some View {
        Button { onPrimary("log:" + toast) } label: {
            HStack(spacing: 5) {
                AuraGlyph(g, .white, size: 13)
                Text(t).font(.system(size: 13, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
            }
            .padding(.horizontal, 12).frame(height: 36)
        }
        .buttonStyle(.plain)
        .glassEffect(.clear.interactive(), in: .capsule)
    }
}

// MARK: - Cards that belong to a lens

struct LensCard<Content: View>: View {
    var label: String
    var trailing: String? = nil
    var onTrailing: (() -> Void)? = nil
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                AuraMono(label)
                Spacer()
                if let t = trailing {
                    Button { onTrailing?() } label: {
                        HStack(spacing: 3) { Text(t); Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold)) }
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                }
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .auraGlass()
    }
}

/// Boop's observations as a stack you swipe like notifications: right = Igaz, left = Nem rólam szól.
struct ObservationStack: View {
    struct Obs: Identifiable { let id: Int; let lead: String; let bold: String; let tail: String; let dots: Int }
    @State private var cards: [Obs] = [
        .init(id: 0, lead: "Amikor 23:00 előtt fekszel le, ", bold: "másnap 9 ponttal jobb a készenléted", tail: ". 4-ből 4 alkalommal így volt.", dots: 4),
        .init(id: 1, lead: "Az edzésnapokon ", bold: "délután 3-kor mélyebb a hullámvölgyed", tail: ", ha ebédre kevés a fehérje.", dots: 3),
        .init(id: 2, lead: "Hétfőnként ", bold: "a feszültséged átlagosan 2-vel magasabb", tail: " a hét többi napjánál.", dots: 3),
    ]
    @State private var drag: CGFloat = 0
    @State private var decided = 0
    var orb: [Color]
    var motion: OrbMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                AuraMono("BOOP ÉSZREVETTE")
                Spacer()
                Text(cards.isEmpty ? "mind átnézve" : "\(cards.count) új").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
            }
            .padding(.horizontal, 4)
            ZStack {
                if cards.isEmpty {
                    Text("Köszönöm, ezekből tanulok.").font(AuraFont.serif(18)).foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity, minHeight: 150).auraGlass()
                }
                ForEach(Array(cards.enumerated().reversed()), id: \.element.id) { idx, c in
                    let top = idx == 0
                    card(c, top: top)
                        .scaleEffect(1 - CGFloat(idx) * 0.05, anchor: .bottom)
                        .offset(y: CGFloat(idx) * 10)
                        .offset(x: top ? drag : 0)
                        .rotationEffect(.degrees(top ? Double(drag / 22) : 0))
                        .opacity(idx > 2 ? 0 : 1)
                        .gesture(top ? DragGesture()
                            .onChanged { drag = $0.translation.width }
                            .onEnded { v in
                                if abs(v.translation.width) > 110 {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { drag = v.translation.width > 0 ? 500 : -500 }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                        cards.removeFirst(); drag = 0; decided += 1
                                    }
                                } else {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) { drag = 0 }
                                }
                            } : nil)
                }
            }
            .padding(.bottom, CGFloat(min(2, max(0, cards.count - 1))) * 10)
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: decided)
            Text("Jobbra: igaz · balra: nem rólam szól").font(.system(size: 12)).foregroundStyle(.white.opacity(0.45))
                .frame(maxWidth: .infinity)
        }
    }

    private func card(_ c: Obs, top: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 20, motion: motion, palette: orb, glow: false, level: 0.85).allowsHitTesting(false)
                HStack(spacing: 4) { ForEach(0..<5) { k in Circle().fill(.white.opacity(k < c.dots ? 0.85 : 0.2)).frame(width: 6, height: 6) } }
                Spacer()
                if top && abs(drag) > 30 {
                    Text(drag > 0 ? "IGAZ" : "NEM RÓLAM SZÓL").font(AuraFont.mono(11, .bold))
                        .foregroundStyle(drag > 0 ? lensBase : .white)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(Capsule().fill(drag > 0 ? .white : .white.opacity(0.18)))
                        .opacity(min(1, Double(abs(drag) - 30) / 60))
                }
            }
            (Text(c.lead) + Text(c.bold).bold().foregroundColor(.white) + Text(c.tail))
                .font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.78))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color(hex: 0x1A2027)))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(0.12), lineWidth: 1))
    }
}

/// Today's session: photo cards you swipe sideways.
struct WorkoutPreview: View {
    private let ex: [(String, String, String)] = [
        ("gyak-barbell-bench-press.jpg", "Fekvenyomás", "4 × 8 · 80 kg"),
        ("gyak-incline-db-press.jpg", "Ferde pados nyomás", "3 × 10 · 28 kg"),
        ("gyak-overhead-press.jpg", "Vállból nyomás", "3 × 8 · 45 kg"),
        ("gyak-lateral-raise.jpg", "Oldalemelés", "3 × 15 · 10 kg"),
        ("gyak-tricep-pushdown.jpg", "Tricepsz letolás", "3 × 12 · 30 kg"),
    ]
    var body: some View {
        LensCard(label: "MAI EDZÉS · 18:30") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Felsőtest · nyomás").font(AuraFont.serif(24)).foregroundStyle(.white)
                Text("5 gyakorlat · kb. 60 perc · 3. hét, 2. nap").font(.system(size: 14)).foregroundStyle(.white.opacity(0.65))
            }
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(ex.indices, id: \.self) { i in
                        VStack(alignment: .leading, spacing: 8) {
                            photo(ex[i].0).resizable().scaledToFill().frame(width: 128, height: 96).clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            Text(ex[i].1).font(.system(size: 14, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                            Text(ex[i].2).font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.6))
                        }
                        .frame(width: 128)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
            .scrollIndicators(.hidden)
            .padding(.horizontal, -20).contentMargins(.horizontal, 20)
        }
    }
}

struct StepsCard: View {
    var body: some View {
        LensCard(label: "LÉPÉSEK MA") {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("5 580").font(.custom("Outfit", size: 36).weight(.light)).foregroundStyle(.white)
                Text("/ 9 000").font(.system(size: 15)).foregroundStyle(.white.opacity(0.6))
                Spacer()
                Text("310 aktív kcal").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.7))
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(.white.opacity(0.9)).frame(width: g.size.width * 0.62)
                }
            }
            .frame(height: 8)
            Text("Egy 20 perces séta ebéd után a célod felét hozza.").font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
        }
    }
}

struct MacroOrbs: View {
    var body: some View {
        LensCard(label: "MAI TÁPANYAGOK", trailing: "820 / 2 350 kcal") {
            HStack(spacing: 0) {
                one("Fehérje", 38, 165, [Color(hex: 0x5A0F2E), Color(hex: 0xD8467A), Color(hex: 0xF7A8C4), Color(hex: 0xF7C27A)])
                one("Szénhidrát", 120, 260, [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)])
                one("Zsír", 30, 75, SunMetric.all[3].orb)
            }
        }
    }
    private func one(_ n: String, _ v: Double, _ goal: Double, _ c: [Color]) -> some View {
        VStack(spacing: 8) {
            ZStack {
                StillOrb(colors: c, size: 74, level: v / goal)
                Text("\(Int(v))g").font(.custom("Outfit", size: 17).weight(.medium)).foregroundStyle(.white).shadow(color: .black.opacity(0.4), radius: 4)
            }
            Text(n).font(.system(size: 13)).foregroundStyle(.white)
            Text("/ \(Int(goal)) g").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity)
    }
}

struct MealsTimeline: View {
    var body: some View {
        LensCard(label: "MAI ÉTKEZÉSEK") {
            row("07:35", "zab-sq.jpg", "Reggeli · zabkása bogyókkal", "523 kcal · 25 g fehérje", done: true)
            row("10:30", nil, "Kávé tejjel", "45 kcal", done: true)
            row("12:30", "lazac-sq.jpg", "Ebéd · Boop javaslata", "lazac rizzsel · 42 g fehérje", done: false)
        }
    }
    private func row(_ t: String, _ p: String?, _ title: String, _ sub: String, done: Bool) -> some View {
        HStack(spacing: 12) {
            Text(t).font(AuraFont.mono(12)).foregroundStyle(.white.opacity(0.6)).frame(width: 44, alignment: .leading)
            Group {
                if let p { photo(p).resizable().scaledToFill() } else { AuraGlyph("drop-sky", .white, size: 16).frame(maxWidth: .infinity, maxHeight: .infinity).background(.white.opacity(0.1)) }
            }
            .frame(width: 40, height: 40).clipShape(Circle())
            .overlay(Circle().stroke(.white.opacity(done ? 0 : 0.5), style: StrokeStyle(lineWidth: 1, dash: [3, 3])))
            .opacity(done ? 1 : 0.7)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(done ? 1 : 0.75))
                Text(sub).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
            }
            Spacer()
        }
    }
}

struct TensionCard: View {
    var body: some View {
        LensCard(label: "FESZÜLTSÉG · CHECK-IN") {
            HStack(spacing: 14) {
                ZStack {
                    StillOrb(colors: SunMetric.all[0].orb, size: 64, level: 0.4)
                    Text("4").font(.custom("Outfit", size: 24).weight(.light)).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text("Közepes, ma reggel 06:42").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Text("Hétfőn szokott magasabb lenni. Egy perc légzés a megbeszélések előtt sokat segít.")
                        .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.65))
                }
            }
        }
    }
}

/// The slim "Utána jön" strip: the morning steps as glass capsules you scroll sideways.
struct NextStrip: View {
    var onOpen: (String) -> Void
    private let items: [(String, String, String, Bool)] = [
        ("checkin", "pen-sun", "Check-in", false), ("intention", "spark-cream", "Mai szándék", false),
        ("weight", "scale-ink", "Mérlegelés", false), ("meal", "camera-ink", "Első étkezés", false), ("", "moon-cream", "Alvás", true)]
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AuraMono("UTÁNA JÖN").padding(.horizontal, 4)
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(items.indices, id: \.self) { i in
                        let it = items[i]
                        Button { if !it.0.isEmpty { onOpen(it.0) } } label: {
                            HStack(spacing: 7) {
                                AuraGlyph(it.3 ? "check-ink" : it.1, .white.opacity(it.3 ? 0.55 : 1), size: 15)
                                Text(it.2).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(it.3 ? 0.55 : 1))
                            }
                            .padding(.horizontal, 14).frame(height: 40)
                        }
                        .buttonStyle(.plain)
                        .glassEffect(.clear.interactive(), in: .capsule)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .padding(.horizontal, -16).contentMargins(.horizontal, 16)
        }
    }
}
