import SwiftUI

/// The Lágy glyph family (vector assets generated from the prototype's `G()` table by `ios/tools/genglyphs.mjs`).
public struct Glyph: View {
    public let name: String
    public let pal: String
    public let size: CGFloat
    public init(_ name: String, _ pal: String, size: CGFloat = 22) { self.name = name; self.pal = pal; self.size = size }

    public var body: some View {
        Image("g-\(name)-\(pal)", bundle: .module).resizable().scaledToFit()
            .frame(width: size, height: size).accessibilityHidden(true)
    }

    /// Every `name-pal` the app uses; a test checks each one exists.
    public static let catalog = [
        "sun-sun", "sun-ink", "moon-sky", "bowl-sage", "dumbbell-berry", "plate-deep", "spark-deep", "spark-sage",
        "person-sage", "check-sage", "check-deep", "bell-cream", "scale-sage", "scale-ink", "star-sun", "clock-sky",
        "book-sage", "heart-berry", "repeat-peach", "plus-ink", "chat-ink",
    ]
}

/// The logo mark: rounded square, two arches, a small sun dot.
public struct LagyMark: View {
    public var size: CGFloat
    public var onPhoto: Bool
    public init(size: CGFloat = 32, onPhoto: Bool = true) { self.size = size; self.onPhoto = onPhoto }

    public var body: some View {
        Canvas { ctx, s in
            let k = s.width / 64
            let sq = Path(roundedRect: CGRect(x: 4 * k, y: 4 * k, width: 56 * k, height: 56 * k), cornerRadius: 18 * k)
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
