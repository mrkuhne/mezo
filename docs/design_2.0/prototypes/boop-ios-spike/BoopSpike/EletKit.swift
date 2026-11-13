import SwiftUI

// Round 4 (owner, 2026-11-13): "a területek mögötti részek nagyon unalmasak, csak listák — pedig feature-gazdag
// az étel, az edzés, a pénzügyek, a levelezés. A saját terület legyen olyan, mint egy app."
// This file is the richer visual vocabulary that makes an area page feel like its own product:
// stat tiles, real charts, composition bars, menu grids, badges, ranked rows, heat strips.

// MARK: - Badge (how much there is to look at)

struct EBadge: View {
    var n: Int
    var hue: Color
    var body: some View {
        Text("\(n)")
            .font(.custom("Outfit", size: 13).weight(.semibold))
            .foregroundStyle(gBase)
            .frame(minWidth: 22, minHeight: 22)
            .padding(.horizontal, 5)
            .background(Capsule().fill(hue))
            .shadow(color: hue.opacity(0.6), radius: 7)
    }
}

// MARK: - Stat tiles (the row of numbers at the top of an area)

struct EStat: Identifiable {
    let id = UUID()
    let value: String, unit: String, label: String
    var trend: Int = 0            // -1 down · 0 flat · 1 up
    var hot: Bool = false         // draw it as the lit one
}

struct EStatRow: View {
    var stats: [EStat]
    var hue: Color
    var body: some View {
        HStack(spacing: 9) {
            ForEach(stats) { s in
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(s.value).font(.custom("Outfit", size: 23).weight(.light)).foregroundStyle(.white)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(s.unit).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
                        if s.trend != 0 {
                            Image(systemName: s.trend > 0 ? "arrow.up.right" : "arrow.down.right")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(hue)
                        }
                    }
                    Text(s.label).font(.system(size: 11)).lineSpacing(1).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12).padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(s.hot ? hue.opacity(0.16) : .white.opacity(0.06))
                        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(s.hot ? hue.opacity(0.45) : .white.opacity(0.1), lineWidth: 1))
                )
            }
        }
    }
}

// MARK: - A real curve, with a target line and the day shaded behind it

struct ECurve: View {
    var values: [Double]            // 0…1
    var labels: [String]
    var hue: Color
    var target: Double? = nil
    var nowIndex: Int? = nil
    var height: CGFloat = 126

    var body: some View {
        VStack(spacing: 7) {
            Canvas { ctx, s in
                guard values.count > 1 else { return }
                let w = s.width, h = s.height
                let peak = max(0.0001, max(values.max() ?? 1, target ?? 0))
                let k = 0.94 / peak                     // fill the box whatever the range
                func y(_ v: Double) -> CGFloat { h - 6 - (h - 14) * CGFloat(min(1, v * k)) }
                func pt(_ i: Int) -> CGPoint {
                    CGPoint(x: w * CGFloat(i) / CGFloat(values.count - 1), y: y(values[i]))
                }
                // smooth path
                var line = Path()
                line.move(to: pt(0))
                for i in 1..<values.count {
                    let a = pt(i - 1), b = pt(i)
                    let mx = (a.x + b.x) / 2
                    line.addCurve(to: b, control1: CGPoint(x: mx, y: a.y), control2: CGPoint(x: mx, y: b.y))
                }
                var fill = line
                fill.addLine(to: CGPoint(x: w, y: h)); fill.addLine(to: CGPoint(x: 0, y: h)); fill.closeSubpath()
                ctx.fill(fill, with: .linearGradient(
                    Gradient(colors: [hue.opacity(0.45), hue.opacity(0.02)]),
                    startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
                ctx.stroke(line, with: .color(hue), style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))

                if let t = target {
                    let ty = y(t)
                    var d = Path(); d.move(to: CGPoint(x: 0, y: ty)); d.addLine(to: CGPoint(x: w, y: ty))
                    ctx.stroke(d, with: .color(.white.opacity(0.55)), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                if let n = nowIndex, n < values.count {
                    let p = pt(n)
                    var v = Path(); v.move(to: CGPoint(x: p.x, y: 0)); v.addLine(to: CGPoint(x: p.x, y: h))
                    ctx.stroke(v, with: .color(.white.opacity(0.22)), style: StrokeStyle(lineWidth: 1))
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)), with: .color(hue))
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)), with: .color(.white))
                }
            }
            .frame(height: height)
            HStack(spacing: 0) {
                ForEach(labels.indices, id: \.self) { i in
                    Text(labels[i]).font(AuraFont.mono(10)).foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Composition: one bar split into named parts

struct EPart: Identifiable { let id = UUID(); let name: String; let value: Double; let color: Color }

struct EComposition: View {
    var parts: [EPart]
    var body: some View {
        let total = max(0.0001, parts.reduce(0) { $0 + $1.value })
        return VStack(alignment: .leading, spacing: 12) {
            GeometryReader { g in
                HStack(spacing: 2.5) {
                    ForEach(parts) { p in
                        RoundedRectangle(cornerRadius: 4)
                            .fill(p.color)
                            .frame(width: max(5, (g.size.width - CGFloat(parts.count - 1) * 2.5) * p.value / total))
                    }
                }
            }
            .frame(height: 14)
            FlowRow(spacing: 10, rowSpacing: 7) {
                ForEach(parts) { p in
                    HStack(spacing: 6) {
                        Circle().fill(p.color).frame(width: 7, height: 7)
                        Text(p.name).font(.system(size: 12)).foregroundStyle(.white.opacity(0.75))
                        Text("\(Int(round(p.value / total * 100)))%").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
        }
    }
}

/// Minimal wrapping row so legends and chips never clip at 320 pt.
struct FlowRow: Layout {
    var spacing: CGFloat = 8
    var rowSpacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > maxW { x = 0; y += rowH + rowSpacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: maxW, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += rowH + rowSpacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}

// MARK: - A menu grid: what else this area can do

struct EMenuItem: Identifiable {
    let id = UUID()
    let glyph: String, name: String, sub: String
    var badge: Int = 0
}

struct EMenuGrid: View {
    var items: [EMenuItem]
    var hue: Color
    var onTap: (String) -> Void
    private let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    var body: some View {
        LazyVGrid(columns: cols, spacing: 10) {
            ForEach(items) { it in
                Button { onTap(it.name) } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            EGlyph(it.glyph, .white, size: 19).frame(width: 36, height: 36)
                                .background(Circle().fill(.white.opacity(0.1)))
                            Spacer()
                            if it.badge > 0 { EBadge(n: it.badge, hue: hue) }
                        }
                        Text(it.name).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(.white)
                        Text(it.sub).font(.system(size: 11.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.52))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
                    .padding(13)
                    .background(
                        RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.06))
                            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(.white.opacity(0.1)))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - A ranked / detailed row list (merchants, meals, exercises, senders)

struct ERow: Identifiable {
    let id = UUID()
    let glyph: String, title: String, sub: String, right: String, rightSub: String
    var level: Double? = nil
    var badge: Int = 0
    var hot: Bool = false
    /// Képek variant B: a photo of the THING this row is about. nil = the glyph stays (a moment, not a thing).
    var photo: String? = nil
}

struct ERowList: View {
    var rows: [ERow]
    var hue: Color
    var warm: Bool = false
    var onTap: ((String) -> Void)? = nil
    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 48) }
                Button { onTap?(r.title) } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            if warm, let ph = r.photo {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(.white.opacity(0.08))
                                    .overlay {
                                        photo(ph).resizable().scaledToFill()
                                            .saturation(0.8).brightness(-0.06)
                                    }
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.12)))
                            } else {
                                Circle().fill(r.hot ? hue.opacity(0.22) : .white.opacity(0.08))
                                EGlyph(r.glyph, r.hot ? hue : .white.opacity(0.9), size: 16)
                            }
                        }
                        .frame(width: warm ? 40 : 36, height: warm ? 40 : 36)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 7) {
                                Text(r.title).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                                if r.badge > 0 { EBadge(n: r.badge, hue: hue) }
                            }
                            Text(r.sub).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                            if let l = r.level { ELevelBar(level: l, hue: hue).padding(.top, 2).padding(.trailing, 6) }
                        }
                        Spacer(minLength: 6)
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(r.right).font(.custom("Outfit", size: warm ? 17 : 16).weight(.medium))
                                .foregroundStyle(warm && r.hot ? hue : .white)
                            if !r.rightSub.isEmpty {
                                Text(r.rightSub).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5))
                            }
                        }
                    }
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - A week/month heat strip

struct EHeat: View {
    var cells: [(String, Double)]
    var hue: Color
    var note: String = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 5) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, c in
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(c.1 <= 0 ? AnyShapeStyle(Color.white.opacity(0.06))
                                           : AnyShapeStyle(hue.opacity(0.22 + 0.78 * c.1)))
                            .frame(height: 38)
                            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(.white.opacity(0.08)))
                        Text(c.0).font(.system(size: 10.5)).foregroundStyle(.white.opacity(0.5))
                    }
                }
            }
            if !note.isEmpty {
                Text(note).font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - The one thing worth saying in this area today

struct EHighlight: View {
    var label: String, text: String, sub: String
    var hue: Color
    var orb: [Color]
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                StillOrb(colors: orb, size: 22, level: 0.85)
                Text(label).font(AuraFont.mono(11, .bold)).tracking(1.5).foregroundStyle(.white.opacity(0.75))
                Spacer()
            }
            Text(text).font(AuraFont.serif(21)).lineSpacing(3).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            Text(sub).font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true).padding(.top, 6)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(LinearGradient(colors: [hue.opacity(0.22), hue.opacity(0.06)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.opacity(0.35)))
        )
    }
}

// MARK: - Small inline chips used by the morning briefing

struct EChip: View {
    var glyph: String, text: String
    var orb: [Color]? = nil
    var body: some View {
        HStack(spacing: 7) {
            if let orb { StillOrb(colors: orb, size: 15, level: 0.8) }
            else { EGlyph(glyph, .white.opacity(0.9), size: 13) }
            Text(text).font(.system(size: 12.5, weight: .medium)).foregroundStyle(.white.opacity(0.9)).lineLimit(1)
        }
        .padding(.horizontal, 10).frame(height: 30)
        .background(Capsule().fill(.white.opacity(0.12)))
        .overlay(Capsule().stroke(.white.opacity(0.14)))
    }
}
