import SwiftUI

// The blocks an area page is composed from (life-dashboard spec §3.3). Every one of them is correct with no
// photo and with no data, and none of the four quiet ones (stats, curve, composition, rows) draws a card around
// itself — the warm treatment of owner decision #12. Wrap them in `NKBare` to give them a label.

// MARK: - The one thing worth reading today

/// The highlight: Boop's line about this area, in a tinted card. One per page, at the top — the only block
/// besides the menu grid that keeps a card.
public struct NKHighlight: View {
    let hue: Hue, label: String, text: String, sub: String
    public init(hue: Hue, label: String, text: String, sub: String = "") {
        self.hue = hue; self.label = label; self.text = text; self.sub = sub
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                StillOrb(palette: hue.orb, size: 22, level: 0.85)
                NKMono(label.uppercased())
                Spacer()
            }
            NKHueText(text, hue: hue, size: 21, serif: true, opacity: 1)
                .padding(.top, 10)
            if !sub.isEmpty {
                NKHueText(sub, hue: hue, size: 13.5, opacity: 0.72).padding(.top, 6)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(LinearGradient(colors: [hue.glow.opacity(0.22), hue.glow.opacity(0.06)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.glow.opacity(0.35)))
        )
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Stat tiles

/// One number of an area: the value, its unit, what it is, which way it is moving, and whether it is the one
/// that matters today.
public struct NKStat: Identifiable, Equatable, Sendable {
    public let id: String
    public let value: String, unit: String, label: String
    /// -1 down · 0 flat · 1 up.
    public let trend: Int
    /// The lit one: bigger, in the area's hue.
    public let hot: Bool
    public init(value: String, unit: String = "", label: String, trend: Int = 0, hot: Bool = false) {
        self.id = label + value; self.value = value; self.unit = unit; self.label = label
        self.trend = trend; self.hot = hot
    }
}

/// Two or three numbers side by side: no boxes, hairlines between them, the lit one in the area's hue.
public struct NKStatRow: View {
    let stats: [NKStat], hue: Hue
    public init(_ stats: [NKStat], hue: Hue) { self.stats = stats; self.hue = hue }
    public var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { i, s in
                if i > 0 {
                    Rectangle().fill(.white.opacity(0.1)).frame(width: 1, height: 38).padding(.horizontal, 2)
                }
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(s.value)
                            .font(.custom(Lagy.outfitFamily, size: s.hot ? 27 : 23).weight(s.hot ? .medium : .light))
                            .foregroundStyle(s.hot ? hue.glow : .white)
                            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                        if !s.unit.isEmpty { Text(s.unit).nkFont(11).foregroundStyle(.white.opacity(0.6)) }
                        if s.trend != 0 { Trend(up: s.trend > 0).foregroundStyle(hue.glow) }
                    }
                    Text(s.label).nkFont(11).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 10)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: - The curve

/// A smooth auto-scaled curve with an optional dashed target line and a "now" marker. The scale follows the data
/// (and the target), so a flat day and a wild one both fill the box.
public struct NKCurve: View {
    let values: [Double], labels: [String], hue: Hue
    let target: Double?, nowIndex: Int?, height: CGFloat
    public init(values: [Double], labels: [String] = [], hue: Hue, target: Double? = nil,
                nowIndex: Int? = nil, height: CGFloat = 132) {
        self.values = values; self.labels = labels; self.hue = hue
        self.target = target; self.nowIndex = nowIndex; self.height = height
    }

    public var body: some View {
        VStack(spacing: 7) {
            Canvas { ctx, s in
                guard values.count > 1 else { return }
                let w = s.width, h = s.height
                let peak = max(0.0001, max(values.max() ?? 1, target ?? 0))
                let k = 0.94 / peak
                func y(_ v: Double) -> CGFloat { h - 6 - (h - 14) * CGFloat(min(1, v * k)) }
                func pt(_ i: Int) -> CGPoint {
                    CGPoint(x: w * CGFloat(i) / CGFloat(values.count - 1), y: y(values[i]))
                }
                var line = Path()
                line.move(to: pt(0))
                for i in 1..<values.count {
                    let a = pt(i - 1), b = pt(i), mx = (a.x + b.x) / 2
                    line.addCurve(to: b, control1: CGPoint(x: mx, y: a.y), control2: CGPoint(x: mx, y: b.y))
                }
                var fill = line
                fill.addLine(to: CGPoint(x: w, y: h)); fill.addLine(to: CGPoint(x: 0, y: h)); fill.closeSubpath()
                ctx.fill(fill, with: .linearGradient(Gradient(colors: [hue.glow.opacity(0.42), hue.glow.opacity(0.02)]),
                                                     startPoint: .zero, endPoint: CGPoint(x: 0, y: h)))
                ctx.stroke(line, with: .color(hue.glow),
                           style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
                if let t = target {
                    let ty = y(t)
                    var d = Path(); d.move(to: CGPoint(x: 0, y: ty)); d.addLine(to: CGPoint(x: w, y: ty))
                    ctx.stroke(d, with: .color(.white.opacity(0.55)), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                if let n = nowIndex, n >= 0, n < values.count {
                    let p = pt(n)
                    var v = Path(); v.move(to: CGPoint(x: p.x, y: 0)); v.addLine(to: CGPoint(x: p.x, y: h))
                    ctx.stroke(v, with: .color(.white.opacity(0.22)), style: StrokeStyle(lineWidth: 1))
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)), with: .color(hue.glow))
                    ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)), with: .color(.white))
                }
            }
            .frame(height: height)
            if !labels.isEmpty {
                HStack(spacing: 0) {
                    ForEach(labels.indices, id: \.self) { i in
                        Text(labels[i]).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Composition

/// One named part of a whole.
public struct NKPart: Identifiable, Sendable {
    public let id: String
    public let name: String, value: Double
    public let color: Color
    public init(name: String, value: Double, color: Color) {
        self.id = name; self.name = name; self.value = value; self.color = color
    }
}

/// One bar split into named parts, with a legend that wraps instead of clipping on a small phone.
public struct NKComposition: View {
    let parts: [NKPart]
    public init(_ parts: [NKPart]) { self.parts = parts }
    public var body: some View {
        let total = max(0.0001, parts.reduce(0) { $0 + $1.value })
        VStack(alignment: .leading, spacing: 12) {
            GeometryReader { g in
                HStack(spacing: 2.5) {
                    ForEach(parts) { p in
                        RoundedRectangle(cornerRadius: 4).fill(p.color)
                            .frame(width: max(5, (g.size.width - CGFloat(max(0, parts.count - 1)) * 2.5) * p.value / total))
                    }
                }
            }
            .frame(height: 14)
            NKFlowRow(spacing: 10, rowSpacing: 7) {
                ForEach(parts) { p in
                    HStack(spacing: 6) {
                        Circle().fill(p.color).frame(width: 7, height: 7)
                        Text(p.name).nkFont(12).foregroundStyle(.white.opacity(0.75))
                        Text("\(Int(round(p.value / total * 100)))%")
                            .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }
}

/// A row that wraps, so legends and chips never clip at 320 pt.
public struct NKFlowRow: Layout {
    let spacing: CGFloat, rowSpacing: CGFloat
    public init(spacing: CGFloat = 8, rowSpacing: CGFloat = 8) { self.spacing = spacing; self.rowSpacing = rowSpacing }
    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > maxW { x = 0; y += rowH + rowSpacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: maxW, height: y + rowH)
    }
    public func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += rowH + rowSpacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}

// MARK: - Row list

/// One row of an area's list — a meal, an exercise, a merchant, a sender. `photo` is Képek variant B: a photo of
/// the **thing** the row is about; a row that is a moment rather than a thing keeps its glyph.
public struct NKAreaRow: Identifiable {
    public let id: String
    let glyph: String, title: String, sub: String, value: String, valueSub: String
    let level: Double?
    let badge: Int
    let hot: Bool
    let photo: Image?
    let action: (@MainActor @Sendable () -> Void)?
    public init(id: String? = nil, glyph: String, title: String, sub: String = "", value: String = "",
                valueSub: String = "", level: Double? = nil, badge: Int = 0, hot: Bool = false,
                photo: Image? = nil, action: (@MainActor @Sendable () -> Void)? = nil) {
        self.id = id ?? title; self.glyph = glyph; self.title = title; self.sub = sub; self.value = value
        self.valueSub = valueSub; self.level = level; self.badge = badge; self.hot = hot
        self.photo = photo; self.action = action
    }
}

/// A list of rows on the page itself: a photo thumbnail or a glyph medallion, two lines, an optional level bar,
/// and the number in weight on the right. No card, hairlines between the rows.
public struct NKRowList: View {
    let rows: [NKAreaRow], hue: Hue
    public init(_ rows: [NKAreaRow], hue: Hue) { self.rows = rows; self.hue = hue }
    public var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, r in
                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 52) }
                row(r)
            }
        }
    }

    @ViewBuilder private func row(_ r: NKAreaRow) -> some View {
        let body = HStack(spacing: 12) {
            ZStack {
                if let photo = r.photo {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.08))
                        .overlay { photo.resizable().scaledToFill().nkPhotoTone() }
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.12)))
                } else {
                    Circle().fill(r.hot ? hue.glow.opacity(0.22) : .white.opacity(0.08))
                    NKGlyph(r.glyph, r.hot ? hue.glow : .white.opacity(0.9), size: 16)
                }
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(r.title).nkFont(14.5, .medium).foregroundStyle(.white).lineLimit(1)
                    NKBadge(r.badge, hue: hue)
                }
                if !r.sub.isEmpty {
                    Text(r.sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
                if let l = r.level { NKLevelBar(level: l, hue: hue).padding(.top, 2).padding(.trailing, 6) }
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 2) {
                if !r.value.isEmpty {
                    Text(r.value).font(.custom(Lagy.outfitFamily, size: 17).weight(.medium))
                        .foregroundStyle(r.hot ? hue.glow : .white).monospacedDigit()
                }
                if !r.valueSub.isEmpty {
                    Text(r.valueSub).nkFont(11).foregroundStyle(.white.opacity(0.5))
                }
            }
            if r.action != nil {
                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.35))
            }
        }
        .padding(.vertical, 11)
        .contentShape(Rectangle())

        if let action = r.action {
            Button(action: action) { body }.buttonStyle(.plain)
                .accessibilityElement(children: .combine)
        } else {
            body.accessibilityElement(children: .combine)
        }
    }
}

/// How full one row's own bar is.
public struct NKLevelBar: View {
    let level: Double, hue: Hue
    public init(level: Double, hue: Hue) { self.level = level; self.hue = hue }
    public var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.12))
                Capsule().fill(hue.glow.opacity(0.85))
                    .frame(width: max(3, g.size.width * min(1, max(0, level))))
            }
        }
        .frame(height: 4)
        .accessibilityHidden(true)
    }
}

// MARK: - Heat strip

/// A week or a day by hour: one cell each, darker where there was less. `cells` is (label, 0…1); a cell at 0 or
/// below is empty, not black.
public struct NKHeatStrip: View {
    let cells: [(String, Double)], hue: Hue, note: String
    public init(cells: [(String, Double)], hue: Hue, note: String = "") {
        self.cells = cells; self.hue = hue; self.note = note
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 5) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, c in
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .fill(c.1 <= 0 ? AnyShapeStyle(Color.white.opacity(0.06))
                                           : AnyShapeStyle(hue.glow.opacity(0.22 + 0.78 * min(1, c.1))))
                            .frame(height: 38)
                            .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(.white.opacity(0.08)))
                        Text(c.0).nkFont(10.5).foregroundStyle(.white.opacity(0.5))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
            }
            if !note.isEmpty {
                NKHueText(note, hue: hue, size: 12.5, opacity: 0.6)
            }
        }
    }
}

// MARK: - Menu grid

/// One thing else this area can do.
public struct NKMenuItem: Identifiable {
    public let id: String
    let glyph: String, name: String, sub: String
    let badge: Int
    let action: @MainActor @Sendable () -> Void
    public init(glyph: String, name: String, sub: String, badge: Int = 0,
                action: @escaping @MainActor @Sendable () -> Void) {
        self.id = name; self.glyph = glyph; self.name = name; self.sub = sub; self.badge = badge; self.action = action
    }
}

/// "What else this area can do", two per row. Keeps its card — it is a set of doors, not data.
public struct NKMenuGrid: View {
    let items: [NKMenuItem], hue: Hue
    public init(_ items: [NKMenuItem], hue: Hue) { self.items = items; self.hue = hue }
    private let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
    public var body: some View {
        LazyVGrid(columns: cols, spacing: 10) {
            ForEach(items) { it in
                Button(action: it.action) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            NKGlyph(it.glyph, .white, size: 19).frame(width: 36, height: 36)
                                .background(Circle().fill(.white.opacity(0.1)))
                            Spacer()
                            NKBadge(it.badge, hue: hue)
                        }
                        Text(it.name).nkFont(14.5, .semibold).foregroundStyle(.white)
                        Text(it.sub).nkFont(11.5).foregroundStyle(.white.opacity(0.52))
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
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: - Ask row

/// The way from an area into a Boop thread that already holds this area's data.
public struct NKAskRow: View {
    let hue: Hue, text: String
    let action: @MainActor @Sendable () -> Void
    public init(hue: Hue, text: String, action: @escaping @MainActor @Sendable () -> Void) {
        self.hue = hue; self.text = text; self.action = action
    }
    public var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                StillOrb(palette: hue.orb, size: 26, level: 0.8)
                Text(text).nkFont(14.5).foregroundStyle(.white.opacity(0.9))
                    .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(0.4))
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                Capsule().fill(.white.opacity(0.07))
                    .overlay(Capsule().stroke(.white.opacity(0.12)))
            )
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}
