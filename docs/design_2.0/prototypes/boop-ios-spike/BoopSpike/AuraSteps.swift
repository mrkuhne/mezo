import SwiftUI

// Throwaway spike (mezo-r36n9.3): the morning steps in the painted-sky language.
// Check-in, Mai szándék, Mérlegelés, Első étkezés — opened from Mai › Utána jön.
// Launch: -aura YES -auraVariant 3 -auraOpen checkin|intention|weight|meal [-checkinDone YES] [-mealStage 0-3]

private let stepBase = Color(hex: 0x0D1218)

// MARK: - Shared pieces

struct AuraGlass: ViewModifier {
    var radius: CGFloat = 26
    func body(content: Content) -> some View {
        content.background(
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .fill(.white.opacity(0.07))
                .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(LinearGradient(colors: [.white.opacity(0.16), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
        )
    }
}
extension View { func auraGlass(_ r: CGFloat = 26) -> some View { modifier(AuraGlass(radius: r)) } }

struct AuraPill: View {
    var text: String
    var primary = true
    var body: some View {
        Text(text).font(.system(size: 16, weight: .semibold))
            .foregroundStyle(primary ? stepBase : .white)
            .frame(maxWidth: .infinity).padding(.vertical, 16)
            .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
    }
}

struct AuraMono: View {
    var text: String
    init(_ t: String) { text = t }
    var body: some View { Text(text).font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6)) }
}

/// Inner page frame: a painted head with back button + crumb, serif title, glass body.
struct AuraStepFrame<Content: View>: View {
    var sky: [Color]
    var crumb: String
    var eyebrow: String
    var title: String
    var sub: String
    var onClose: () -> Void
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    Color.clear.frame(height: 360)
                        .overlay { PaintedLandscape(sky: sky) }
                        .clipped()
                        .overlay(LinearGradient(stops: [.init(color: .clear, location: 0.45), .init(color: stepBase, location: 1)], startPoint: .top, endPoint: .bottom))
                    VStack(spacing: 0) {
                        HStack {
                            Button(action: onClose) {
                                Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                                    .frame(width: 44, height: 44).glassEffect(.clear, in: .circle)
                            }
                            .buttonStyle(.plain)
                            Spacer()
                            Text(crumb).font(.system(size: 14, weight: .medium)).foregroundStyle(.white.opacity(0.8))
                            Spacer()
                            Color.clear.frame(width: 44, height: 44)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 58)
                        VStack(spacing: 8) {
                            Text(eyebrow.uppercased()).font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.75))
                            Text(title).font(AuraFont.serif(40)).foregroundStyle(.white).multilineTextAlignment(.center)
                                .contentTransition(.opacity)
                            Text(sub).font(.system(size: 16)).foregroundStyle(.white.opacity(0.85)).multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 62)
                    }
                }
                VStack(spacing: 12) { content }
                    .padding(.horizontal, 16)
                    .padding(.top, -14)
                    .padding(.bottom, 60)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(stepBase.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

/// Boop speaks at the end of every step: small orb, mono label, serif sentence.
struct AuraBoopCard: View {
    var text: String
    var motion: OrbMotion
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                LivingOrb(mood: .good, size: 22, motion: motion, palette: SunMetric.all[0].orb, glow: false, level: 0.85)
                AuraMono("BOOP")
            }
            Text(text).font(AuraFont.serif(18)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .auraGlass()
    }
}

// MARK: - Check-in: the whole screen is the question; the orb is the answer

struct AuraCheckin: View {
    var onClose: () -> Void
    struct Q { let key, label, question: String; let hue: Int; var why: String? = nil }
    private let qs: [Q] = [
        .init(key: "energy", label: "Energia", question: "Mennyi energia van benned most?", hue: 2),
        .init(key: "mood", label: "Hangulat", question: "Milyen a hangulatod?", hue: 4),
        .init(key: "stress", label: "Feszültség", question: "Mennyire vagy feszült?", hue: 0),
        .init(key: "body", label: "Test", question: "Hogy érzed a tested?", hue: 3),
        .init(key: "mental", label: "Fejtisztaság", question: "Mennyire tiszta a fejed?", hue: 1),
        .init(key: "hunger", label: "A nap kérdése", question: "Mennyire vagy éhes ébredés után?", hue: 3,
              why: "Azt figyelem, összefügg-e a reggeli éhséged a tegnapi késő vacsorával."),
    ]
    @State private var i = 0
    @State private var values: [String: Int] = [:]
    @State private var finished = UserDefaults.standard.bool(forKey: "checkinDone")
    @State private var dragStart: Int? = nil
    @State private var motion = OrbMotion()
    @State private var note = ""

    var body: some View {
        Group {
            if finished { summary } else { question }
        }
        .onAppear { if finished && values.isEmpty { values = ["energy": 8, "mood": 8, "stress": 4, "body": 6, "mental": 8, "hunger": 4] } }
        .onDisappear { motion.stop() }
        .preferredColorScheme(.dark)
    }

    private var q: Q { qs[i] }
    private var v: Int { values[q.key] ?? 5 }

    private var question: some View {
        ZStack {
            PaintedLandscape(sky: PaintedLandscape.skies[q.hue]).ignoresSafeArea()
                .overlay(LinearGradient(colors: [.clear, stepBase.opacity(0.85)], startPoint: .center, endPoint: .bottom).ignoresSafeArea())
                .animation(.easeInOut(duration: 0.6), value: i)
            VStack(spacing: 0) {
                HStack {
                    Button(action: onClose) {
                        Image(systemName: "chevron.left").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
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
                    Button("Most csak ennyi") { withAnimation { finished = true } }
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                }
                .padding(.horizontal, 16).padding(.top, 8)

                VStack(spacing: 10) {
                    Text(q.label.uppercased()).font(AuraFont.mono(12)).tracking(1.6).foregroundStyle(.white.opacity(0.8))
                    Text(q.question).font(AuraFont.serif(34)).foregroundStyle(.white).multilineTextAlignment(.center)
                        .frame(minHeight: 90)
                    if let w = q.why {
                        Text(w).font(.system(size: 14)).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal, 28).padding(.top, 30)
                .id(i).transition(.opacity)

                Spacer()

                // the orb is the answer: drag up or down, the liquid follows
                ZStack {
                    Circle().fill(PaintedLandscape.skies[q.hue][2].opacity(0.35)).frame(width: 300).blur(radius: 60)
                    LivingOrb(mood: .good, size: 220, motion: motion, palette: SunMetric.all[orbFor(q.hue)].orb, glow: false,
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
                            if dragStart == nil { dragStart = v }
                            let nv = max(0, min(10, (dragStart ?? 5) - Int((g.translation.height / 30).rounded())))
                            if nv != v { values[q.key] = nv }
                        }
                        .onEnded { _ in dragStart = nil }
                )
                .sensoryFeedback(.selection, trigger: v)
                Text("Húzd fel vagy le").font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).padding(.top, 2)

                HStack(spacing: 8) {
                    ForEach([2, 4, 6, 8, 10], id: \.self) { x in
                        Button { withAnimation(.snappy) { values[q.key] = x } } label: {
                            Text("\(x)").font(.custom("Outfit", size: 17).weight(.medium))
                                .foregroundStyle(values[q.key] == x ? stepBase : .white)
                                .frame(maxWidth: .infinity).frame(height: 46)
                                .background(Capsule().fill(values[q.key] == x ? .white : .white.opacity(0.1)))
                                .glassEffect(.clear, in: .capsule)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20).padding(.top, 22)

                HStack(spacing: 10) {
                    Button { withAnimation(.easeInOut(duration: 0.4)) { if i > 0 { i -= 1 } } } label: { AuraPill(text: "Vissza", primary: false) }
                        .buttonStyle(.plain).opacity(i == 0 ? 0.4 : 1)
                    Button { next() } label: { AuraPill(text: "Kihagyom", primary: false) }.buttonStyle(.plain)
                    Button { if values[q.key] == nil { values[q.key] = v }; next() } label: { AuraPill(text: i == qs.count - 1 ? "Kész" : "Tovább") }
                        .buttonStyle(.plain)
                }
                .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 16)
            }
        }
    }

    private func orbFor(_ hue: Int) -> Int { [0, 1, 2, 3, 4][hue] }

    private func next() {
        withAnimation(.easeInOut(duration: 0.45)) {
            if i < qs.count - 1 { i += 1 } else { finished = true }
        }
    }

    private var summary: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[2], crumb: "Nap · Check-in", eyebrow: "Reggel · 06:42", title: "Köszönöm",
                      sub: "Így indul a napod.", onClose: onClose) {
            VStack(alignment: .leading, spacing: 0) {
                AuraMono("A REGGELED").padding(.bottom, 8)
                ForEach(qs, id: \.key) { q in
                    let val = values[q.key]
                    HStack(spacing: 14) {
                        StillOrb(colors: SunMetric.all[orbFor(q.hue)].orb, size: 34, level: Double(val ?? 0) / 10)
                            .saturation(val == nil ? 0 : 0.9)
                        Text(q.label).font(.system(size: 16)).foregroundStyle(.white)
                        Spacer()
                        Text(val.map { "\($0)" } ?? "kihagyva").font(val == nil ? .system(size: 13) : .custom("Outfit", size: 20))
                            .foregroundStyle(.white.opacity(val == nil ? 0.5 : 1))
                    }
                    .padding(.vertical, 9)
                }
            }
            .padding(20).auraGlass()

            VStack(alignment: .leading, spacing: 10) {
                AuraMono("GONDOLATOK")
                TextField("", text: $note, prompt: Text("ha valami még eszedbe jut").foregroundStyle(.white.opacity(0.4)), axis: .vertical)
                    .font(.system(size: 16)).foregroundStyle(.white)
            }
            .padding(20).auraGlass()

            AuraBoopCard(text: "Energiád 8, a fejed tiszta: jó alap a mai edzéshez. A feszültséged 4, ezért ebéd után tegyél be 10 perc sétát a megbeszélések közé.", motion: motion)

            Button(action: onClose) { AuraPill(text: "Mentem") }.buttonStyle(.plain).padding(.top, 6)
        }
    }
}

// MARK: - Mai szándék

struct AuraIntention: View {
    var onClose: () -> Void
    @State private var foci = ["Nyugodt tempó a megbeszéléseken", "45 g fehérje ebédre", ""]
    @State private var asked = UserDefaults.standard.bool(forKey: "intentionAsked")
    @State private var motion = OrbMotion()

    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[0], crumb: "Nap · Mai szándék", eyebrow: "Hétfő reggel", title: "Mire figyelsz ma?",
                      sub: "Egy mondat, ami vezet, és legfeljebb három fókusz.", onClose: onClose) {
            VStack(alignment: .leading, spacing: 12) {
                AuraMono("A HITVALLÁSOD")
                Text("„Minden döntésem a célom felé visz: szándékkal élek, nem sodródom.”")
                    .font(AuraFont.serif(22)).lineSpacing(4).foregroundStyle(.white)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).auraGlass()

            VStack(alignment: .leading, spacing: 4) {
                AuraMono("MAI FÓKUSZ").padding(.bottom, 6)
                ForEach(0..<3) { k in
                    HStack(alignment: .firstTextBaseline, spacing: 14) {
                        Text("\(k + 1)").font(.custom("Outfit", size: 22).weight(.light)).foregroundStyle(.white.opacity(0.7)).frame(width: 18)
                        TextField("", text: $foci[k], prompt: Text("például: lefekvés 23:00 előtt").foregroundStyle(.white.opacity(0.35)), axis: .vertical)
                            .font(.system(size: 16.5)).foregroundStyle(.white)
                        if asked && !foci[k].isEmpty {
                            Text(k == 0 ? "belefér" : "segíti a célod").font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(stepBase).padding(.horizontal, 9).padding(.vertical, 5).background(Capsule().fill(.white.opacity(0.85)))
                        }
                    }
                    .padding(.vertical, 12)
                    if k < 2 { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.leading, 32) }
                }
            }
            .padding(20).auraGlass()

            if asked {
                AuraBoopCard(text: "A nyugodt tempó jó választás: 9-től 17:30-ig hat megbeszélésed van. A 45 g fehérje ebédre segíti a 79 kilós célodat. Harmadiknak a 23:00 előtti lefekvést javaslom.", motion: motion)
                    .transition(.opacity)
                Button(action: onClose) { AuraPill(text: "Mentem") }.buttonStyle(.plain)
            } else {
                Button { withAnimation(.easeInOut) { asked = true } } label: { AuraPill(text: "Mit szól hozzá a Boop?") }.buttonStyle(.plain)
            }
        }
        .onDisappear { motion.stop() }
    }
}

// MARK: - Mérlegelés

struct AuraWeight: View {
    var onClose: () -> Void
    @State private var tenths = 824
    @State private var dragStart: Int? = nil
    @State private var saved = UserDefaults.standard.bool(forKey: "weightSaved")
    @State private var motion = OrbMotion()
    private let trend: [Double] = [83.4, 83.6, 83.1, 83.0, 83.3, 82.8, 82.9, 82.6, 82.7, 82.3, 82.5, 82.4]

    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[3], crumb: "Nap · Mérlegelés", eyebrow: "Reggel · 06:55",
                      title: saved ? "Jó irányba mész" : "Mennyi ma?", sub: saved ? "Heti −0,5 kiló, épp a terv szerint." : "Ébredés után, mosdó után.", onClose: onClose) {
            VStack(spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(String(format: "%.1f", Double(tenths) / 10).replacingOccurrences(of: ".", with: ","))
                        .font(.custom("Outfit", size: 64).weight(.light)).foregroundStyle(.white).monospacedDigit()
                        .contentTransition(.numericText(value: Double(tenths)))
                    Text("kiló").font(.system(size: 16)).foregroundStyle(.white.opacity(0.7))
                }
                ruler.frame(height: 64)
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 1)
                        .onChanged { g in
                            if dragStart == nil { dragStart = tenths }
                            tenths = max(600, min(1200, (dragStart ?? 824) - Int((g.translation.width / 9).rounded())))
                        }
                        .onEnded { _ in dragStart = nil })
                    .sensoryFeedback(.selection, trigger: tenths)
            }
            .padding(.vertical, 20).auraGlass()

            if saved {
                VStack(alignment: .leading, spacing: 4) {
                    AuraMono("TREND · 12 NAP")
                    GeometryReader { g in
                        let lo = 78.5, hi = 84.0
                        ZStack(alignment: .topLeading) {
                            GlowLine(points: trend.map { ($0 - lo) / (hi - lo) }, color: .white, nowAt: nil)
                            let gy = g.size.height * (1 - (79 - lo) / (hi - lo)) * 0.9 + 6
                            Path { p in p.move(to: CGPoint(x: 0, y: gy)); p.addLine(to: CGPoint(x: g.size.width, y: gy)) }
                                .stroke(.white.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            Text("cél 79 kiló").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.7)).offset(y: gy - 18)
                        }
                    }
                    .frame(height: 150).padding(.top, 12)
                }
                .padding(20).auraGlass()

                HStack(spacing: 12) {
                    stat("MA", "82,4"); stat("TREND", "82,2"); stat("HETI", "−0,5")
                }

                AuraBoopCard(text: "A mai szám egy kicsit a trend fölött van, ez a tegnapi sós vacsora vize. A trend a lényeg: heti fél kiló, így március elejére eléred a 79-et.", motion: motion)
                Button(action: onClose) { AuraPill(text: "Kész") }.buttonStyle(.plain)
            } else {
                Button { withAnimation(.easeInOut) { saved = true } } label: { AuraPill(text: "Mentem") }.buttonStyle(.plain)
            }
        }
        .onDisappear { motion.stop() }
    }

    private func stat(_ l: String, _ v: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            AuraMono(l)
            Text(v).font(.custom("Outfit", size: 26).weight(.light)).foregroundStyle(.white)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).auraGlass(22)
    }

    private var ruler: some View {
        Canvas { ctx, s in
            let mid = s.width / 2
            let step: CGFloat = 9
            let n = Int(mid / step) + 2
            for k in -n...n {
                let val = tenths + k
                let x = mid + CGFloat(k) * step
                let major = val % 10 == 0, half = val % 5 == 0
                let h: CGFloat = major ? 26 : (half ? 18 : 11)
                let fade = max(0, 1 - abs(CGFloat(k)) / CGFloat(n))
                var p = Path(); p.move(to: CGPoint(x: x, y: 4)); p.addLine(to: CGPoint(x: x, y: 4 + h))
                ctx.stroke(p, with: .color(.white.opacity(0.7 * fade)), lineWidth: major ? 1.6 : 1)
                if major {
                    ctx.draw(Text("\(val / 10)").font(AuraFont.mono(11)).foregroundColor(Color.white.opacity(0.7 * fade)), at: CGPoint(x: x, y: 46))
                }
            }
            var c = Path(); c.move(to: CGPoint(x: mid, y: 0)); c.addLine(to: CGPoint(x: mid, y: 36))
            ctx.stroke(c, with: .color(.white), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
        }
    }
}

// MARK: - Első étkezés

struct AuraMeal: View {
    var onClose: () -> Void
    enum Stage: Int { case capture, looking, draft, verdict }
    @State private var stage = Stage(rawValue: UserDefaults.standard.integer(forKey: "mealStage")) ?? .capture
    @State private var scan = false
    @State private var label = "Felismerem…"
    @State private var text = ""
    @State private var motion = OrbMotion()
    struct Item: Identifiable { let id: String; let photo: String?; var grams: Double; let kcal100, p100, c100, f100: Double }
    @State private var items: [Item] = [
        .init(id: "Zabpehely", photo: "zab-sq.jpg", grams: 60, kcal100: 375, p100: 13, c100: 60, f100: 7),
        .init(id: "Görög joghurt", photo: "joghurt-sq.jpg", grams: 150, kcal100: 73, p100: 10, c100: 4, f100: 2),
        .init(id: "Áfonya", photo: "gyumolcs-sq.jpg", grams: 80, kcal100: 57, p100: 0.7, c100: 14, f100: 0.3),
        .init(id: "Méz", photo: nil, grams: 15, kcal100: 304, p100: 0.3, c100: 82, f100: 0),
        .init(id: "Dió", photo: nil, grams: 15, kcal100: 654, p100: 15, c100: 14, f100: 65),
    ]
    private var total: (k: Double, p: Double, c: Double, f: Double) {
        items.reduce((0, 0, 0, 0)) { ($0.0 + $1.grams * $1.kcal100 / 100, $0.1 + $1.grams * $1.p100 / 100, $0.2 + $1.grams * $1.c100 / 100, $0.3 + $1.grams * $1.f100 / 100) }
    }

    var body: some View {
        AuraStepFrame(sky: PaintedLandscape.skies[2], crumb: "Nap · Első étkezés", eyebrow: "Reggeli · 07:35", title: title, sub: sub, onClose: onClose) {
            Group {
                switch stage {
                case .capture: capture
                case .looking: looking
                case .draft: draft
                case .verdict: verdict
                }
            }
            .animation(.spring(response: 0.5, dampingFraction: 0.86), value: stage)
        }
        .onDisappear { motion.stop() }
    }

    private var title: String { ["Mit eszel?", "Megnézem", "Zabkása bogyókkal", "Jó edzés előtti reggeli"][stage.rawValue] }
    private var sub: String { ["Fotó vagy pár szó elég.", "Pár másodperc.", "Állíts, ha nem stimmel.", "A napod és a heted fényében."][stage.rawValue] }

    private var capture: some View {
        VStack(spacing: 12) {
            Button { look() } label: {
                VStack(spacing: 12) {
                    AuraGlyph("camera-ink", .white, size: 34)
                        .frame(width: 76, height: 76).background(Circle().fill(.white.opacity(0.1)))
                    Text("Lefotózom").font(AuraFont.serif(24)).foregroundStyle(.white)
                    Text("a tányérról megmondom, mi van rajta").font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
                }
                .frame(maxWidth: .infinity).padding(.vertical, 34).auraGlass()
            }
            .buttonStyle(.plain)
            HStack {
                TextField("", text: $text, prompt: Text("vagy írd le: zabkása joghurttal").foregroundStyle(.white.opacity(0.4)))
                    .font(.system(size: 16)).foregroundStyle(.white)
                Image(systemName: "arrow.up").font(.system(size: 14, weight: .bold)).foregroundStyle(stepBase)
                    .frame(width: 34, height: 34).background(Circle().fill(.white))
                    .onTapGesture { look() }
            }
            .padding(.leading, 20).padding(.trailing, 8).padding(.vertical, 8)
            .background(Capsule().fill(.white.opacity(0.07))).overlay(Capsule().stroke(.white.opacity(0.14)))
        }
    }

    private func look() {
        withAnimation { stage = .looking }
        scan = false
        withAnimation(.easeInOut(duration: 1.1).repeatCount(2, autoreverses: true)) { scan = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) { label = "Elemzem…" }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { label = "Kész · 86% biztos" }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.9) { withAnimation { stage = .draft } }
    }

    private var looking: some View {
        Color.clear.frame(height: 340)
            .overlay { photo("zab.jpg").resizable().scaledToFill() }
            .overlay(alignment: .top) {
                GeometryReader { g in
                    LinearGradient(colors: [.clear, .white.opacity(0.75), .clear], startPoint: .top, endPoint: .bottom)
                        .frame(height: 60).offset(y: scan ? g.size.height - 60 : 0)
                }
            }
            .overlay(alignment: .bottom) {
                Text(label).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 8).glassEffect(.regular, in: .capsule).padding(16)
            }
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    private var draft: some View {
        VStack(spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(Int(total.k))").font(.custom("Outfit", size: 52).weight(.light)).foregroundStyle(.white)
                    .contentTransition(.numericText(value: total.k))
                Text("kalória").font(.system(size: 15)).foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
            .padding(.horizontal, 6)
            macroBar.padding(.horizontal, 6)
            VStack(spacing: 0) {
                ForEach(items.indices, id: \.self) { k in
                    HStack(spacing: 12) {
                        Group {
                            if let p = items[k].photo { photo(p).resizable().scaledToFill() }
                            else { AuraGlyph(items[k].id == "Méz" ? "honey-sun" : "leaf-sage", .white, size: 18).frame(maxWidth: .infinity, maxHeight: .infinity).background(.white.opacity(0.1)) }
                        }
                        .frame(width: 42, height: 42).clipShape(Circle())
                        Text(items[k].id).font(.system(size: 16)).foregroundStyle(.white)
                        Spacer()
                        HStack(spacing: 6) {
                            pm("minus") { items[k].grams = max(0, items[k].grams - 10) }
                            Text("\(Int(items[k].grams)) g").font(.custom("Outfit", size: 15)).foregroundStyle(.white).monospacedDigit().frame(width: 52)
                            pm("plus") { items[k].grams += 10 }
                        }
                    }
                    .padding(.vertical, 9)
                    if k < items.count - 1 { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.leading, 54) }
                }
            }
            .padding(16).auraGlass()
            Button { withAnimation { stage = .verdict } } label: { AuraPill(text: "Ez az") }.buttonStyle(.plain)
        }
    }

    private func pm(_ sym: String, _ act: @escaping () -> Void) -> some View {
        Button(action: { withAnimation(.snappy) { act() } }) {
            Image(systemName: sym).font(.system(size: 11, weight: .bold)).foregroundStyle(.white)
                .frame(width: 28, height: 28).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }

    private var macroBar: some View {
        let t = total, sum = max(1, t.p * 4 + t.c * 4 + t.f * 9)
        return VStack(alignment: .leading, spacing: 8) {
            GeometryReader { g in
                HStack(spacing: 3) {
                    Capsule().fill(.white).frame(width: g.size.width * t.p * 4 / sum)
                    Capsule().fill(.white.opacity(0.6)).frame(width: g.size.width * t.c * 4 / sum)
                    Capsule().fill(.white.opacity(0.3))
                }
            }
            .frame(height: 8)
            HStack(spacing: 14) {
                macro("fehérje", t.p, 1); macro("szénhidrát", t.c, 0.6); macro("zsír", t.f, 0.3)
            }
        }
    }

    private func macro(_ l: String, _ g: Double, _ o: Double) -> some View {
        HStack(spacing: 5) {
            Circle().fill(.white.opacity(o)).frame(width: 7, height: 7)
            Text("\(l) \(Int(g)) g").font(.system(size: 13)).foregroundStyle(.white.opacity(0.8))
        }
    }

    private var verdict: some View {
        VStack(spacing: 12) {
            HStack(spacing: 18) {
                ZStack {
                    LivingOrb(mood: .good, size: 120, motion: motion, palette: SunMetric.all[3].orb, glow: false, level: total.k / 2350 + 0.08)
                        .allowsHitTesting(false)
                    VStack(spacing: 0) {
                        Text("\(Int(total.k))").font(.custom("Outfit", size: 28).weight(.light)).foregroundStyle(.white)
                        Text("a 2 350-ből").font(.system(size: 10)).foregroundStyle(.white.opacity(0.8))
                    }
                    .shadow(color: .black.opacity(0.3), radius: 6)
                }
                VStack(alignment: .leading, spacing: 12) {
                    bar("fehérje", total.p, 165); bar("szénhidrát", total.c, 260); bar("zsír", total.f, 75)
                }
            }
            .padding(20).auraGlass()

            HStack(spacing: 8) {
                tag("7,8 pont", filled: true); tag("+20 g fehérje"); tag("fele annyi méz")
                Spacer(minLength: 0)
            }

            AuraBoopCard(text: "Jó edzés előtti reggeli: elég szénhidrát a 18:30-as edzéshez. A fehérje kevés, egy marék túró vagy még egy joghurt pont kiegészítené.", motion: motion)
            Button(action: onClose) { AuraPill(text: "Mentem") }.buttonStyle(.plain)
        }
    }

    private func bar(_ l: String, _ v: Double, _ goal: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack { Text(l).font(.system(size: 13)).foregroundStyle(.white.opacity(0.8)); Spacer(); Text("\(Int(v)) / \(Int(goal)) g").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.7)) }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.08))
                    Capsule().fill(.white.opacity(0.9)).frame(width: g.size.width * min(1, v / goal))
                }
            }
            .frame(height: 6)
        }
    }

    private func tag(_ t: String, filled: Bool = false) -> some View {
        Text(t).font(.system(size: 13.5, weight: .semibold)).foregroundStyle(filled ? stepBase : .white)
            .padding(.horizontal, 12).padding(.vertical, 8).background(Capsule().fill(filled ? .white : .white.opacity(0.1)))
    }
}
