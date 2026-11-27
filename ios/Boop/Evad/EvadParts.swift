import SwiftUI
import BoopCore
import BoopDesign

// The Évad room's own pieces (`mezo-r36n9.196` step 2), ported from the approved spike (`58e2d7126`, never merged):
// one glass card with a mono head, the navigable row, the labelled bar, the seven day dots, the empty illustration and
// the compact system map.

/// A glass card with a mono head (hue tick, glyph, label, trailing word, an optional chevron) — the room's one card.
struct EvadCard<Content: View>: View {
    let label: String, glyph: String?, trailing: String?, chevron: Bool
    let action: (@MainActor () -> Void)?
    let content: Content
    init(_ label: String, glyph: String? = nil, trailing: String? = nil, chevron: Bool = false,
         action: (@MainActor () -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.label = label; self.glyph = glyph; self.trailing = trailing; self.chevron = chevron
        self.action = action; self.content = content()
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(evadHue.glow).frame(width: 3, height: 13)
                if let glyph { NKGlyph(glyph, evadHue.glow.opacity(0.95), size: 15) }
                NKMono(label.uppercased()).lineLimit(2)
                Spacer(minLength: 8)
                if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1) }
                if chevron || action != nil {
                    Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.45))
                }
            }
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .contentShape(RoundedRectangle(cornerRadius: 26))
        .onTapGesture { action?() }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(action == nil ? [] : .isButton)
    }
}

/// A plain explanation line in white 72 %.
struct EvadText: View {
    let text: String
    var size: CGFloat = 14
    var opacity: Double = 0.72
    init(_ text: String, size: CGFloat = 14, opacity: Double = 0.72) { self.text = text; self.size = size; self.opacity = opacity }
    var body: some View {
        Text(text).nkFont(size).foregroundStyle(.white.opacity(opacity))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A row inside a card: glyph, title + sub, an optional value; a chevron only when it goes somewhere.
struct EvadRow: View {
    let glyph: String, title: String, sub: String
    var value: String? = nil
    var action: (@MainActor () -> Void)? = nil
    var body: some View {
        let row = HStack(spacing: 12) {
            NKGlyph(glyph, evadHue.glow, size: 18)
                .frame(width: 38, height: 38)
                .background(Circle().fill(.white.opacity(0.07)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                if !sub.isEmpty {
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 6)
            if let value, !value.isEmpty { Text(value).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8)) }
            if action != nil {
                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        if let action {
            Button(action: action) { row.contentShape(Rectangle()) }.buttonStyle(.plain)
                .accessibilityElement(children: .combine)
        } else {
            row.accessibilityElement(children: .combine)
        }
    }
}

/// A labelled bar: name, the fill, and „3 / 4 nap a kereten belül". Large text puts the count under the name — never a
/// word broken mid-way.
struct EvadBarRow: View {
    let bar: EvadMostBar
    private var glyph: String { ["etel": "bowl-cream", "edzes": "dumbbell-ink", "alvas": "moon-cream"][bar.key] ?? "check-ink" }
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { title; Spacer(minLength: 6); count }
                VStack(alignment: .leading, spacing: 4) { title; count }
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.10))
                    Capsule().fill(LinearGradient(colors: [evadHue.orb[1], evadHue.glow], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(8, g.size.width * Double(bar.done) / Double(max(1, bar.of))))
                }
            }
            .frame(height: 8)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(bar.name): \(bar.done) a \(bar.of)-ből, \(bar.label)")
    }
    private var title: some View {
        HStack(spacing: 8) {
            NKGlyph(glyph, .white.opacity(0.85), size: 15)
            Text(bar.name).nkFont(15, .medium).foregroundStyle(.white).fixedSize()
        }
    }
    private var count: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("\(bar.done) / \(bar.of)").font(.custom(Lagy.outfitFamily, size: 18).weight(.light)).foregroundStyle(.white).fixedSize()
            Text(bar.label).nkFont(12).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Seven day dots, Monday to Sunday, with a legend. A tap on a lived day opens it.
struct EvadDayDotsView: View {
    let dots: [EvadDayDot]
    var onDay: (@MainActor (String) -> Void)? = nil
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 0) {
                ForEach(dots, id: \.date) { d in
                    VStack(spacing: 8) {
                        dot(d.state)
                        Text(d.letter).nkFont(11, .medium, design: .monospaced)
                            .foregroundStyle(.white.opacity(d.state == .future ? 0.4 : 0.75))
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .onTapGesture { if d.state != .future { onDay?(d.date) } }
                }
            }
            HStack(spacing: 14) {
                legend(.inPlan, "tervben"); legend(.out, "kicsúszott"); legend(.kimelo, "kímélő")
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("A hét napjai: \(evadDayDotsSpoken(dots))")
    }

    @ViewBuilder private func dot(_ s: EvadDayState, size: CGFloat = 30) -> some View {
        switch s {
        case .inPlan:
            Circle().fill(LinearGradient(colors: [evadHue.orb[2], evadHue.orb[1]], startPoint: .top, endPoint: .bottom))
                .frame(width: size, height: size).shadow(color: evadHue.glow.opacity(0.6), radius: 6)
        case .out:
            Circle().stroke(NK.under.opacity(0.85), lineWidth: 2.5).frame(width: size - 3, height: size - 3)
        case .kimelo:
            Circle().fill(Color(hex: 0x6E8FA0).opacity(0.55)).frame(width: size, height: size)
                .overlay(Capsule().fill(.white.opacity(0.7)).frame(width: size * 0.45, height: 2.5))
        case .unjudged:
            Circle().fill(.white.opacity(0.08)).frame(width: size - 3, height: size - 3)
        case .today:
            Circle().stroke(.white, lineWidth: 2.5).frame(width: size - 3, height: size - 3)
                .overlay(Circle().fill(.white).frame(width: 7, height: 7))
        case .future:
            Circle().stroke(.white.opacity(0.22), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])).frame(width: size - 4, height: size - 4)
        }
    }

    private func legend(_ s: EvadDayState, _ word: String) -> some View {
        HStack(spacing: 6) {
            dot(s, size: 11)
            Text(word).nkFont(11.5).foregroundStyle(.white.opacity(0.6))
        }
    }
}

/// The empty state's picture: a path of weeks rising to the evening sun, nothing on it yet.
struct EvadEmptyIllustration: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height, hue = evadHue
            let sun = CGPoint(x: w * 0.68, y: h * 0.45)
            ctx.fill(Path(ellipseIn: CGRect(x: sun.x - 46, y: sun.y - 46, width: 92, height: 92)),
                     with: .radialGradient(Gradient(colors: [hue.orb[3], hue.orb[1].opacity(0.6), .clear]), center: sun, startRadius: 4, endRadius: 60))
            ctx.fill(Path { p in
                p.move(to: CGPoint(x: 0, y: h * 0.72))
                p.addCurve(to: CGPoint(x: w, y: h * 0.62), control1: CGPoint(x: w * 0.3, y: h * 0.55), control2: CGPoint(x: w * 0.6, y: h * 0.78))
                p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.closeSubpath()
            }, with: .color(hue.orb[0].opacity(0.9)))
            for i in 0..<8 {
                let t = CGFloat(i) / 7
                let x = w * (0.12 + t * 0.5), y = h * (0.9 - t * 0.28)
                ctx.stroke(Path(roundedRect: CGRect(x: x - 7, y: y - 7, width: 14, height: 14), cornerRadius: 4),
                           with: .color(.white.opacity(0.35 + 0.05 * Double(i))), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
            }
        }
        .accessibilityHidden(true)
    }
}

/// The compact system map on Terv's „Mi mire hat" card: Évad in the middle feeding Étel, Edzés and Alvás, all three
/// flowing into Súly. The large, live one is `EvadSystemMap` on its own page.
struct EvadMapMark: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height, hue = evadHue
            let c = CGPoint(x: w / 2, y: h * 0.42)
            let r = min(w, h) * 0.36
            let nodes: [(CGPoint, Hue)] = [
                (CGPoint(x: c.x - r, y: c.y - r * 0.55), .fuel), (CGPoint(x: c.x + r, y: c.y - r * 0.55), .mozgas),
                (CGPoint(x: c.x - r * 0.95, y: c.y + r * 0.7), .alvas), (CGPoint(x: c.x + r * 0.95, y: c.y + r * 0.7), .suly),
            ]
            for (i, n) in nodes.enumerated() where i < 3 {
                ctx.stroke(Path { p in p.move(to: c); p.addLine(to: n.0) }, with: .color(hue.glow.opacity(0.75)),
                           style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                ctx.stroke(Path { p in
                    p.move(to: n.0)
                    p.addQuadCurve(to: nodes[3].0, control: CGPoint(x: (n.0.x + nodes[3].0.x) / 2, y: max(n.0.y, nodes[3].0.y) + r * 0.35))
                }, with: .color(.white.opacity(0.22)), style: StrokeStyle(lineWidth: 1, lineCap: .round))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 13, y: c.y - 13, width: 26, height: 26)),
                     with: .radialGradient(Gradient(colors: [hue.orb[2], hue.orb[1], hue.orb[0]]), center: c, startRadius: 0, endRadius: 13))
            for n in nodes {
                let col = n.1.orb
                ctx.fill(Path(ellipseIn: CGRect(x: n.0.x - 8, y: n.0.y - 8, width: 16, height: 16)),
                         with: .radialGradient(Gradient(colors: [col[2], col[1], col[0]]), center: n.0, startRadius: 0, endRadius: 8))
            }
        }
        .accessibilityHidden(true)
    }
}
