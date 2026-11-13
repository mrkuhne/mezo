import SwiftUI

// Throwaway curiosity spike (mezo-r36n9.33, "Boop Élet", 2026-11-13): what Boop looks like once it also
// carries MONEY and MAIL (and later life goals), with one AI that sees everything and keeps threads.
// Four ideas on screen: (1) the orb lens grows from 5 body metrics to 7 life metrics, (2) money and mail
// are rooms with the same grammar as sleep, (3) Terv's top level becomes the life goal all six areas hang
// under, (4) the Boop tab becomes a thread list you can open from any card.
// Fake data, no networking, nothing shipped.
// Launch: -elet YES [-eletTab 0–3] [-eletMetric 0–6] [-eletOpen penz|level|szal|cel]

enum EArg {
    static let d = UserDefaults.standard
    static func int(_ k: String, _ lo: Int, _ hi: Int, _ def: Int = 0) -> Int {
        guard d.object(forKey: k) != nil else { return def }
        return min(hi, max(lo, d.integer(forKey: k)))
    }
    static func str(_ k: String) -> String? { d.string(forKey: k).flatMap { $0.isEmpty ? nil : $0 } }
}

// MARK: - The seven life metrics (five body + money + mail)

struct EMetric {
    let name: String, value: Int, glyph: String
    let top: Color, glow: Color, orb: [Color]
    let sky: [Color]
    let headline: String, sentence: String
    /// true for the two new areas — they get the hand-drawn glyphs below, not the body sprite
    let isNew: Bool

    static let all: [EMetric] = [
        EMetric(name: "Forma", value: 78, glyph: "spark-cream",
                top: Color(hex: 0x2E2470), glow: Color(hex: 0x8B6CF0),
                orb: [Color(hex: 0x2A1E6E), Color(hex: 0x6A4FD8), Color(hex: 0x9FB8FF), Color(hex: 0xF08BB4)],
                sky: PaintedLandscape.skies[0],
                headline: "Jó napod lesz",
                sentence: "Kipihent vagy, a pénzed a havi kereten belül, és két dolog jött, amit érdemes megnézned.",
                isNew: false),
        EMetric(name: "Alvás", value: 84, glyph: "moon-cream",
                top: Color(hex: 0x0F3552), glow: Color(hex: 0x4BA8E6),
                orb: [Color(hex: 0x0B2C4F), Color(hex: 0x2A78C8), Color(hex: 0x8ED0F7), Color(hex: 0x6FD3B0)],
                sky: PaintedLandscape.skies[1],
                headline: "Kipihented magad",
                sentence: "7 óra 12 perc, ebből 1 óra 36 perc mély. 22:48-kor aludtál el.",
                isNew: false),
        EMetric(name: "Mozgás", value: 62, glyph: "shoe-cream",
                top: Color(hex: 0x4A2810), glow: Color(hex: 0xF29A4A),
                orb: [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)],
                sky: PaintedLandscape.skies[2],
                headline: "Van még benne több",
                sentence: "1 240 lépésnél tartasz. Egy 20 perces séta ebéd után a napi cél felét hozza.",
                isNew: false),
        EMetric(name: "Fuel", value: 71, glyph: "bowl-cream",
                top: Color(hex: 0x123F33), glow: Color(hex: 0x4CC79A),
                orb: [Color(hex: 0x0E3B2E), Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8), Color(hex: 0xF4C860)],
                sky: PaintedLandscape.skies[3],
                headline: "Jó úton jársz",
                sentence: "A fehérje 38 g-nál tart a 165-ből. Ebédnél egyél legalább 45 grammot.",
                isNew: false),
        EMetric(name: "Közérzet", value: 69, glyph: "heart-cream",
                top: Color(hex: 0x45277A), glow: Color(hex: 0xD86E9C),
                orb: [Color(hex: 0x3A1E66), Color(hex: 0xB0529A), Color(hex: 0xF6B8D0), Color(hex: 0xFFD3A8)],
                sky: PaintedLandscape.skies[4],
                headline: "Kicsit feszült vagy",
                sentence: "A délelőtti check-inben 4-es feszültséget jelöltél. Hat megbeszélés van a naptáradban.",
                isNew: false),
        EMetric(name: "Pénz", value: 74, glyph: "e-penz",
                top: Color(hex: 0x11351F), glow: Color(hex: 0x5FD08A),
                orb: [Color(hex: 0x0C2B1A), Color(hex: 0x2E8B57), Color(hex: 0xBFE8A8), Color(hex: 0xF2C94C)],
                sky: [Color(hex: 0x14532D), Color(hex: 0x4CA06B), Color(hex: 0xEADFA0)],
                headline: "A kereten belül vagy",
                sentence: "A hónapból 13 nap telt el, a havi keret 46%-át költötted el. Két nagyobb tétel jön még.",
                isNew: true),
        EMetric(name: "Levél", value: 58, glyph: "e-level",
                top: Color(hex: 0x241F55), glow: Color(hex: 0x8E82F0),
                orb: [Color(hex: 0x1E1A4A), Color(hex: 0x5B4BC4), Color(hex: 0xB3A8F5), Color(hex: 0x7FD8E8)],
                sky: [Color(hex: 0x1B1C5E), Color(hex: 0x5E5BD0), Color(hex: 0xC9BEF2)],
                headline: "Két dolgot nézz meg",
                sentence: "34 levél jött reggel óta. 31-et elintéztem helyetted, kettő megér egy percet.",
                isNew: true),
    ]
}

// MARK: - Two hand-drawn glyphs for the two new areas (the sprite has no coin and no envelope)

/// Outline glyphs on the 64-unit grid, same stroke weight as the sprite's outlined set.
struct EGlyph: View {
    var name: String
    var color: Color
    var size: CGFloat = 18
    init(_ name: String, _ color: Color, size: CGFloat = 18) { self.name = name; self.color = color; self.size = size }

    var body: some View {
        if name.hasPrefix("e-") {
            Canvas { ctx, s in
                let k = s.width / 64
                func P(_ f: (inout Path) -> Void) -> Path { var p = Path(); f(&p); return p.applying(CGAffineTransform(scaleX: k, y: k)) }
                let st = StrokeStyle(lineWidth: 5 * k, lineCap: .round, lineJoin: .round)
                switch name {
                case "e-penz":
                    // a coin seen slightly from the side: circle + the forint's two bars
                    ctx.stroke(P { $0.addEllipse(in: CGRect(x: 8, y: 8, width: 48, height: 48)) }, with: .color(color), style: st)
                    ctx.stroke(P { p in p.move(to: CGPoint(x: 36, y: 18)); p.addLine(to: CGPoint(x: 26, y: 18))
                                   p.addLine(to: CGPoint(x: 26, y: 46)) }, with: .color(color), style: st)
                    ctx.stroke(P { p in p.move(to: CGPoint(x: 19, y: 29)); p.addLine(to: CGPoint(x: 39, y: 29)) }, with: .color(color), style: st)
                    ctx.stroke(P { p in p.move(to: CGPoint(x: 19, y: 38)); p.addLine(to: CGPoint(x: 39, y: 38)) }, with: .color(color), style: st)
                default:
                    // an envelope whose flap is a soft wave, so it reads as Napkelte, not as a mail-client icon
                    ctx.stroke(P { $0.addRoundedRect(in: CGRect(x: 7, y: 15, width: 50, height: 34), cornerSize: CGSize(width: 8, height: 8)) },
                               with: .color(color), style: st)
                    ctx.stroke(P { p in p.move(to: CGPoint(x: 11, y: 21))
                                   p.addCurve(to: CGPoint(x: 32, y: 36), control1: CGPoint(x: 19, y: 25), control2: CGPoint(x: 25, y: 36))
                                   p.addCurve(to: CGPoint(x: 53, y: 21), control1: CGPoint(x: 39, y: 36), control2: CGPoint(x: 45, y: 25)) },
                               with: .color(color), style: st)
                }
            }
            .frame(width: size, height: size)
            .accessibilityHidden(true)
        } else {
            AuraGlyph(name, color, size: size)
        }
    }
}

// MARK: - Root

struct EletRoot: View {
    @State private var tab = EArg.int("eletTab", 0, 3)
    @State private var plus = false
    @State private var toast: String?
    @State private var maPath: [String] = {
        switch EArg.str("eletOpen") {
        case "penz": return ["m5"]
        case "level": return ["m6"]
        case let s? where s.hasPrefix("m"): return [s]
        default: return []
        }
    }()

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch tab {
                case 1: EletTerv(onToast: show)
                case 2: EletNaplo()
                case 3: EletBoopTab(onToast: show)
                default: EletMa(path: $maPath, onToast: show)
                }
            }
            .transition(.opacity)

            if maPath.isEmpty || tab != 0 {
                GerincTabBar(tab: $tab, onPlus: { plus = true })
                    .padding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: maPath.isEmpty)
        .animation(.easeInOut(duration: 0.25), value: tab)
        .preferredColorScheme(.dark)
        .overlay(alignment: .top) {
            if let t = toast {
                HStack(spacing: 8) {
                    AuraGlyph("check-ink", .white, size: 15)
                    Text(t).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                }
                .padding(.horizontal, 16).frame(height: 42)
                .glassEffect(.regular, in: .capsule)
                .padding(.top, 6)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sensoryFeedback(.success, trigger: toast)
        .sheet(isPresented: $plus) {
            EletPlusSheet(onPick: { t in plus = false; show(t) })
                .presentationDetents([.height(520)])
                .presentationBackground(gBase)
                .presentationCornerRadius(34)
                .presentationDragIndicator(.visible)
        }
    }

    private func show(_ t: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { toast = t }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
            if toast == t { withAnimation(.easeInOut) { toast = nil } }
        }
    }
}

/// The "+" grows by two rows — a cost and a question — but stays one sheet.
struct EletPlusSheet: View {
    var onPick: (String) -> Void
    private let rows: [(String, String, String)] = [
        ("camera-ink", "Étkezés", "fotó, szöveg vagy vonalkód"),
        ("pen-sun", "Check-in", "három kérdés, fél perc"),
        ("dumbbell-ink", "Edzés indítása", "a mai felsőtest"),
        ("scale-ink", "Testsúly", "a reggeli mérés"),
        ("e-penz", "Kiadás", "kézzel — a banki SMS-t magától elkapja"),
        ("chat-ink", "Kérdezek Boopot", "új szál, a mai nappal a kezében"),
    ]
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Mit rögzítesz?").font(AuraFont.serif(26)).foregroundStyle(.white)
                .padding(.top, 24).padding(.bottom, 18).padding(.horizontal, 22)
            ForEach(Array(rows.enumerated()), id: \.offset) { k, r in
                Button { onPick(r.1 + " · megnyílik") } label: {
                    HStack(spacing: 14) {
                        EGlyph(r.0, .white, size: 20).frame(width: 40, height: 40)
                            .background(Circle().fill(.white.opacity(0.1)))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.1).font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                            Text(r.2).font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                    }
                    .padding(.horizontal, 22).padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if k == 3 {
                    Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5).padding(.horizontal, 22).padding(.vertical, 8)
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(gBase)
    }
}

// MARK: - Small shared pieces

/// The one grammar: a verdict sentence over a level bar, used by every area including money and mail.
struct ELevelBar: View {
    var level: Double
    var hue: Color
    var marker: Double? = nil
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.1))
                Capsule()
                    .fill(LinearGradient(colors: [hue.opacity(0.65), hue], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(8, g.size.width * level))
                if let marker {
                    Rectangle().fill(.white.opacity(0.85)).frame(width: 2)
                        .offset(x: g.size.width * marker - 1)
                }
            }
        }
        .frame(height: 10)
    }
}

/// "kérdezz erről" — the door from any card into a Boop thread that already holds the card's data.
struct EAskRow: View {
    var text: String
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                AuraGlyph("chat-ink", .white.opacity(0.85), size: 16)
                Text(text).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white.opacity(0.9))
                Spacer()
                Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.horizontal, 16).frame(height: 46)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
    }
}

/// Like GPill but it never wraps — proposal cards live in a narrow gutter-indented column.
struct EPill: View {
    var title: String
    var primary = true
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 14.5, weight: .semibold))
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                .foregroundStyle(primary ? gBase : .white)
                .padding(.horizontal, 15).frame(height: 40)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}

struct EScore: View {
    var n: Int
    var hue: Color
    var body: some View {
        HStack(spacing: 3) {
            Text("\(n)").font(.custom("Outfit", size: 19).weight(.medium)).foregroundStyle(.white)
            Text("/10").font(.system(size: 11)).foregroundStyle(.white.opacity(0.5)).padding(.top, 5)
        }
        .padding(.horizontal, 10).frame(height: 34)
        .background(Capsule().fill(hue.opacity(0.22)))
        .overlay(Capsule().stroke(hue.opacity(0.5)))
    }
}
