import SwiftUI
import CoreText

// MARK: - Lágy tokens (IRANY.md §2, kept exactly)

enum Lagy {
    static let paper = Color(hex: 0xF6F4EF)
    static let card = Color.white
    static let ink = Color(hex: 0x1E2321)
    static let ink2 = Color(hex: 0x5A635E)
    static let mute = Color(hex: 0x8E968F)
    static let sage = Color(hex: 0x5FB08A)
    static let sage2 = Color(hex: 0xA8D5BA)
    static let sage3 = Color(hex: 0xE6F2EA)
    static let deep = Color(hex: 0x2E6B52)
    static let deepDark = Color(hex: 0x1E4A39)
    static let peach = Color(hex: 0xF0B48C)
    static let peach2 = Color(hex: 0xFBE6D6)
    static let peachInk = Color(hex: 0x9A5B2E)
    static let berry = Color(hex: 0x8E5BB5)
    static let sky = Color(hex: 0x8CC3E8)
    static let skyTint = Color(hex: 0xE9F3FA)
    static let sun = Color(hex: 0xF4C860)
    static let photoGround = Color(hex: 0x26302B)

    /// Orb liquid inside the deep-green card: sage family with a sun glint.
    static let orbColors: [Color] = [Color(hex: 0x2E6B52), Color(hex: 0x5FB08A), Color(hex: 0xA8D5BA), Color(hex: 0xF4C860)]

    static func registerFonts() {
        for name in ["Outfit", "Manrope"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

extension Font {
    /// Display + numbers.
    static func outfit(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .custom("Outfit", size: size).weight(weight) }
    /// Body.
    static func manrope(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .custom("Manrope", size: size).weight(weight) }
}

// MARK: - Glyph family (generated from the Lágy G() table)

struct Glyph: View {
    var name: String
    var pal: String
    var size: CGFloat = 22
    init(_ name: String, _ pal: String, size: CGFloat = 22) { self.name = name; self.pal = pal; self.size = size }
    var body: some View {
        Image("g-\(name)-\(pal)").resizable().scaledToFit().frame(width: size, height: size).accessibilityHidden(true)
    }
}

// MARK: - The logo mark: rounded square, two arches, a small sun dot

struct LagyMark: View {
    var size: CGFloat = 32
    var onPhoto = true
    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            let r = CGRect(x: 4 * k, y: 4 * k, width: 56 * k, height: 56 * k)
            let sq = Path(roundedRect: r, cornerRadius: 18 * k)
            if onPhoto { ctx.fill(sq, with: .color(.white.opacity(0.18))) }
            else { ctx.fill(sq, with: .linearGradient(Gradient(colors: [Lagy.sage2, Lagy.deep]), startPoint: .zero, endPoint: CGPoint(x: s.width, y: s.height))) }
            var p = Path()
            for x0 in [16.0, 32.0] {
                p.move(to: CGPoint(x: x0 * k, y: 44 * k))
                p.addLine(to: CGPoint(x: x0 * k, y: 32 * k))
                p.addArc(center: CGPoint(x: (x0 + 8) * k, y: 32 * k), radius: 8 * k, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
                p.addLine(to: CGPoint(x: (x0 + 16) * k, y: 44 * k))
            }
            ctx.stroke(p, with: .color(.white), style: StrokeStyle(lineWidth: 5 * k, lineCap: .round))
            ctx.fill(Path(ellipseIn: CGRect(x: 46 * k, y: 16 * k, width: 8 * k, height: 8 * k)), with: .color(Color(hex: 0xFDE6A6)))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Boop")
    }
}

// MARK: - Chips, pills, cards

struct Chip: View {
    enum Style { case plain, soft, warm, ink }
    var text: String
    var style: Style = .plain
    var glyph: (String, String)? = nil
    var small = false
    var body: some View {
        HStack(spacing: 5) {
            if let g = glyph { Glyph(g.0, g.1, size: small ? 14 : 15) }
            Text(text).font(.manrope(12.5, .bold)).lineLimit(1)
        }
        .padding(.leading, glyph == nil ? (small ? 9 : 11) : 7)
        .padding(.trailing, small ? 9 : 11)
        .frame(height: small ? 26 : 28)
        .foregroundStyle(fg)
        .background(Capsule().fill(bg))
        .shadow(color: style == .plain ? .black.opacity(0.12) : .clear, radius: 7, y: 6)
    }
    private var fg: Color { switch style { case .plain: Lagy.ink; case .soft: Lagy.deep; case .warm: Lagy.peachInk; case .ink: .white } }
    private var bg: Color { switch style { case .plain: .white; case .soft: Lagy.sage3; case .warm: Lagy.peach2; case .ink: Lagy.ink } }
}

struct Pill: View {
    var title: String
    var glyph: (String, String)? = nil
    var soft = false
    var onPhoto = false
    var action: () -> Void = {}
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let g = glyph { Glyph(g.0, g.1, size: 18) }
                Text(title).font(.manrope(14, .bold))
            }
            .padding(.horizontal, 18)
            .frame(height: onPhoto ? 44 : 46)
            .foregroundStyle(soft ? Lagy.deep : (onPhoto ? Lagy.ink : .white))
            .background(Capsule().fill(soft ? Lagy.sage3 : (onPhoto ? .white : Lagy.ink)))
            .shadow(color: soft ? .clear : .black.opacity(onPhoto ? 0.35 : 0.3), radius: 12, y: 10)
        }
        .buttonStyle(PressStyle())
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension View {
    /// White card, one soft shadow, generous radius.
    func lagyCard(_ radius: CGFloat = 26, fill: Color = .white) -> some View {
        background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(fill)
            .shadow(color: Color(hex: 0x1E2321).opacity(0.10), radius: 18, y: 12))
    }
    /// The one deep-green card of a page.
    func deepCard() -> some View {
        background(RoundedRectangle(cornerRadius: 26, style: .continuous)
            .fill(LinearGradient(colors: [Color(hex: 0x2F6E54), Lagy.deepDark], startPoint: .topLeading, endPoint: .bottomTrailing))
            .shadow(color: Lagy.deepDark.opacity(0.45), radius: 18, y: 14))
    }
}

struct SectionHeader: View {
    var title: String
    var link: String? = nil
    var action: () -> Void = {}
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.outfit(18)).tracking(-0.36).foregroundStyle(Lagy.ink)
            Spacer()
            if let l = link {
                Button(action: action) {
                    HStack(spacing: 3) { Text(l); Image(systemName: "chevron.right").font(.system(size: 11, weight: .bold)) }
                        .font(.manrope(13, .bold)).foregroundStyle(Lagy.deep)
                        .padding(.vertical, 10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 4)
    }
}

/// Thin bar with label and value ("Alvás 84 %").
struct LagyBar: View {
    var label: String
    var glyph: (String, String)
    var value: String
    var unit: String = ""
    var frac: Double
    var onDeep = false
    var warn = false
    @State private var shown = false
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                HStack(spacing: 5) { Glyph(glyph.0, glyph.1, size: 15); Text(label) }
                    .font(.manrope(12.5, .bold)).foregroundStyle(onDeep ? .white.opacity(0.82) : Lagy.ink2)
                Spacer(minLength: 4)
                (Text(value).font(.outfit(14)) + Text(unit.isEmpty ? "" : " \(unit)").font(.manrope(12, .bold)).foregroundColor(onDeep ? .white.opacity(0.6) : Lagy.mute))
                    .foregroundStyle(onDeep ? .white : Lagy.ink).monospacedDigit()
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(onDeep ? .white.opacity(0.14) : Lagy.ink.opacity(0.08))
                    Capsule().fill(warn ? Lagy.peach : Lagy.sage2).frame(width: shown ? g.size.width * min(1, frac) : 0)
                }
            }
            .frame(height: 6)
        }
        .onAppear { withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 1.1).delay(0.3)) { shown = true } }
    }
}
