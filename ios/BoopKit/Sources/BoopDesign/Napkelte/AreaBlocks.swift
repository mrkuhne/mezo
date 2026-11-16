import SwiftUI

// The blocks an area page is composed from (life-dashboard spec §3.3). Every one of them is correct with no
// photo and with no data, and none of the four quiet ones (stats, curve, composition, rows) draws a card around
// itself — the warm treatment of owner decision #12. Wrap them in `NKBare` to give them a label.

// MARK: - The one thing worth reading today

/// What a highlight can offer: a filled primary button, an outlined secondary, or a plain text link.
public struct NKHighlightAction: Identifiable {
    public enum Weight: Sendable { case primary, secondary, link }
    public let id = UUID()
    let title: String, weight: Weight
    let action: @MainActor @Sendable () -> Void
    public init(_ title: String, weight: Weight = .primary, action: @escaping @MainActor @Sendable () -> Void) {
        self.title = title; self.weight = weight; self.action = action
    }
}

/// The highlight: the one thing worth reading in this area today, in a tinted card — and, when the area wants to
/// be acted on from it (today's training session is the case that forced this), a photo band of the thing and up
/// to three actions under the words. One per page, at the top; with the menu grid, the only block that keeps a
/// card.
public struct NKHighlight: View {
    let hue: Hue, label: String, text: String, sub: String
    let photo: Image?
    let actions: [NKHighlightAction]
    public init(hue: Hue, label: String, text: String, sub: String = "", photo: Image? = nil,
                actions: [NKHighlightAction] = []) {
        self.hue = hue; self.label = label; self.text = text; self.sub = sub
        self.photo = photo; self.actions = actions
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let photo {
                NKCardPhoto(photo, hue: hue, height: 128)
                    .padding(.bottom, 14)
            }
            HStack(spacing: 9) {
                StillOrb(palette: hue.orb, size: 22, level: 0.85)
                NKMono(label.uppercased())
                Spacer()
            }
            .padding(.horizontal, photo == nil ? 0 : 18)
            NKHueText(text, hue: hue, size: 21, serif: true, opacity: 1)
                .padding(.top, 10).padding(.horizontal, photo == nil ? 0 : 18)
            if !sub.isEmpty {
                NKHueText(sub, hue: hue, size: 13.5, opacity: 0.72)
                    .padding(.top, 6).padding(.horizontal, photo == nil ? 0 : 18)
            }
            if !actions.isEmpty {
                buttons.padding(.top, 16).padding(.horizontal, photo == nil ? 0 : 18)
            }
        }
        .padding(photo == nil ? 18 : 0)
        .padding(.bottom, photo == nil ? 0 : 18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(LinearGradient(colors: [hue.glow.opacity(0.22), hue.glow.opacity(0.06)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(hue.glow.opacity(0.35)))
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    /// The filled and outlined buttons share a row; the text links sit under them, so three actions never crowd a
    /// small phone.
    private var buttons: some View {
        let strong = actions.filter { $0.weight != .link }
        let links = actions.filter { $0.weight == .link }
        return VStack(alignment: .leading, spacing: 10) {
            if !strong.isEmpty {
                NKFlowRow(spacing: 10, rowSpacing: 10) {
                    ForEach(strong) { a in
                        Button(action: a.action) {
                            Text(a.title).nkFont(15, .semibold)
                                .foregroundStyle(a.weight == .primary ? NK.ground : .white)
                                .padding(.horizontal, 20).frame(height: 44)
                                .background {
                                    if a.weight == .primary { Capsule().fill(.white.opacity(0.95)) }
                                    else { Capsule().stroke(.white.opacity(0.45)) }
                                }
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            ForEach(links) { a in
                Button(action: a.action) {
                    Text(a.title).nkFont(14, .medium).foregroundStyle(.white.opacity(0.7))
                        .underline(true, pattern: .dot)
                        .frame(minHeight: 34)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Stat tiles

/// One number of an area: the value, its unit, what it is, which way it is moving, and whether it is the one
/// that matters today.
public struct NKStat: Identifiable, Equatable, Sendable {
    public let id: String
    /// nil when there is nothing to show: the tile reads "–", never a 0.
    public let value: String?
    /// What the value is measured against — most training numbers are "13 / 16", not a bare figure.
    public let target: String?
    public let unit: String, label: String
    /// -1 down · 0 flat · 1 up.
    public let trend: Int
    /// The lit one: bigger, in the area's hue.
    public let hot: Bool
    /// How fresh this one number is, when the tile is drawn from a cache ("2 napja").
    public let age: String?
    public init(value: String?, target: String? = nil, unit: String = "", label: String, trend: Int = 0,
                hot: Bool = false, age: String? = nil) {
        self.id = label + (value ?? "–"); self.value = value; self.target = target; self.unit = unit
        self.label = label; self.trend = trend; self.hot = hot; self.age = age
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
                        Text(s.value ?? "–")
                            .font(.custom(Lagy.outfitFamily, size: s.hot ? 27 : 23).weight(s.hot ? .medium : .light))
                            .foregroundStyle(s.value == nil ? .white.opacity(0.45) : (s.hot ? hue.glow : .white))
                            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                        if let t = s.target, s.value != nil {
                            Text("/ \(t)").font(.custom(Lagy.outfitFamily, size: s.hot ? 19 : 17).weight(.light))
                                .foregroundStyle(.white.opacity(0.45)).monospacedDigit()
                        }
                        if !s.unit.isEmpty { Text(s.unit).nkFont(11).foregroundStyle(.white.opacity(0.6)) }
                        // green up / pink down is the shipped vocabulary for better-or-worse: a direction arrow in the
                        // area hue would lose its valence
                        if s.trend != 0, s.value != nil { Trend(up: s.trend > 0) }
                    }
                    Text(s.value == nil ? "nincs friss adat" : s.label).nkFont(11)
                        .foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true)
                    if let age = s.age, s.value != nil {
                        Text(age).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                    }
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
/// Where a row stands when a list shows a past, a present and a future at once — the training week's five days
/// show all three, and a badge alone cannot carry that.
public enum NKRowState: Sendable {
    /// The ordinary row.
    case normal
    /// Behind him: the medallion is filled, the row reads at full strength.
    case done
    /// He skipped it: dimmed, and its reason belongs in a chip.
    case skipped
    /// Still to come: dimmed, with an outlined medallion rather than a filled one.
    case future

    var dim: Double { self == .normal || self == .done ? 1 : 0.55 }
    var outlined: Bool { self == .future }
}

public struct NKAreaRow: Identifiable {
    public let id: String
    let glyph: String, title: String, sub: String, value: String, valueSub: String
    let level: Double?
    let ticks: [NKLevelTick]
    let badge: Int
    let dot: Bool
    let hot: Bool
    let state: NKRowState
    /// A second sub-line of small capsules — a skip reason, a tag, a warning.
    let chips: [String]
    let photo: Image?
    /// What a search should also match besides the title and the sub — an exercise's muscle zone, a merchant's
    /// category. Never shown.
    let terms: [String]
    let action: (@MainActor @Sendable () -> Void)?
    public init(id: String? = nil, glyph: String, title: String, sub: String = "", value: String = "",
                valueSub: String = "", level: Double? = nil, ticks: [NKLevelTick] = [], badge: Int = 0,
                dot: Bool = false, hot: Bool = false, state: NKRowState = .normal, chips: [String] = [],
                photo: Image? = nil, terms: [String] = [],
                action: (@MainActor @Sendable () -> Void)? = nil) {
        self.id = id ?? title; self.glyph = glyph; self.title = title; self.sub = sub; self.value = value
        self.valueSub = valueSub; self.level = level; self.ticks = ticks; self.badge = badge; self.dot = dot
        self.hot = hot; self.state = state; self.chips = chips
        self.photo = photo; self.terms = terms; self.action = action
    }

    /// Does this row answer that search? Case- and accent-insensitive over the title, the sub and the extra terms.
    public func matches(_ query: String) -> Bool { nkRowMatches(self, query) }
}

/// Apart from the view so it can be unit-tested.
public func nkRowMatches(_ row: NKAreaRow, _ query: String) -> Bool {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !q.isEmpty else { return true }
    let needle = q.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "hu_HU"))
    return ([row.title, row.sub] + row.terms).contains {
        $0.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "hu_HU"))
            .contains(needle)
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
                } else if r.state.outlined {
                    Circle().stroke(.white.opacity(0.22), lineWidth: 1)
                    NKGlyph(r.glyph, .white.opacity(0.75), size: 16)
                } else {
                    Circle().fill(r.hot ? hue.glow.opacity(0.22) : .white.opacity(0.08))
                    NKGlyph(r.glyph, r.hot ? hue.glow : .white.opacity(0.9), size: 16)
                }
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 7) {
                    Text(r.title).nkFont(14.5, .medium).foregroundStyle(.white).lineLimit(1)
                    if r.dot { NKBadge(dot: true, hue: hue) } else { NKBadge(r.badge, hue: hue) }
                }
                if !r.sub.isEmpty {
                    Text(r.sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
                if !r.chips.isEmpty {
                    NKFlowRow(spacing: 6, rowSpacing: 5) {
                        ForEach(r.chips, id: \.self) { c in
                            Text(c).nkFont(10.5, .medium).foregroundStyle(.white.opacity(0.7))
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(Capsule().fill(.white.opacity(0.1)))
                        }
                    }
                    .padding(.top, 2)
                }
                if let l = r.level {
                    NKLevelBar(level: l, hue: hue, ticks: r.ticks).padding(.top, 2).padding(.trailing, 6)
                }
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
        .opacity(r.state.dim)
        .contentShape(Rectangle())

        if let action = r.action {
            Button(action: action) { body }.buttonStyle(.plain)
                .accessibilityElement(children: .combine)
        } else {
            body.accessibilityElement(children: .combine)
        }
    }
}

/// A landmark on a level bar: the fraction it sits at and what it is called. Weekly training volume means nothing
/// without MEV and MAV marked — the number only reads against the two landmarks it sits between.
public struct NKLevelTick: Identifiable, Sendable {
    public let id: String
    public let at: Double, label: String
    public init(at: Double, label: String) { self.id = label; self.at = at; self.label = label }
}

/// How full one row's own bar is, with optional landmarks on it. `labelTicks` writes their names under the bar
/// (a block of its own); inside a row the ticks are marks only, so the row stays one line tall.
public struct NKLevelBar: View {
    let level: Double, hue: Hue, ticks: [NKLevelTick], labelTicks: Bool
    public init(level: Double, hue: Hue, ticks: [NKLevelTick] = [], labelTicks: Bool = false) {
        self.level = level; self.hue = hue; self.ticks = ticks; self.labelTicks = labelTicks
    }
    public var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.12))
                    Capsule().fill(hue.glow.opacity(0.85))
                        .frame(width: max(3, g.size.width * clamped(level)))
                    ForEach(ticks) { t in
                        Rectangle().fill(.white.opacity(0.75)).frame(width: 1.5)
                            .offset(x: g.size.width * clamped(t.at))
                    }
                }
            }
            .frame(height: labelTicks ? 8 : 4)
            if labelTicks, !ticks.isEmpty {
                GeometryReader { g in
                    ForEach(ticks) { t in
                        Text(t.label).nkFont(9.5, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                            .fixedSize()
                            .offset(x: max(0, g.size.width * clamped(t.at) - 10))
                    }
                }
                .frame(height: 12)
            }
        }
        .accessibilityHidden(true)
    }
    private func clamped(_ v: Double) -> Double { min(1, max(0, v)) }
}

// MARK: - How old this is

/// What a block says about the age of the data it is drawn from. A read cache is honest about it: `loud` is for a
/// number you could act on wrongly (a two-day-old training prescription), and is amber on the face of the block.
public struct NKStale: Equatable, Sendable {
    public let age: String
    public let loud: Bool
    public init(age: String, loud: Bool = false) { self.age = age; self.loud = loud }
    static let amber = Color(hex: 0xE8A33D)
}

public extension View {
    /// Marks a block as drawn from older data. Quiet: a grey mono line under it. Loud: an amber capsule on its
    /// top-right corner, over the number itself.
    func nkStale(_ stale: NKStale?) -> some View {
        modifier(NKStaleBadge(stale: stale))
    }
}

struct NKStaleBadge: ViewModifier {
    let stale: NKStale?
    func body(content: Content) -> some View {
        if let stale {
            VStack(alignment: .leading, spacing: 6) {
                // The loud capsule sits ABOVE the block, never over it: overlaid on the top-right it landed on the
                // last stat of a three-stat row, which is exactly the row a stale block has.
                if stale.loud {
                    HStack(spacing: 5) {
                        Circle().fill(NKStale.amber).frame(width: 6, height: 6)
                        Text(stale.age).nkFont(11, .semibold, design: .monospaced)
                            .foregroundStyle(NKStale.amber)
                    }
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(Capsule().fill(NKStale.amber.opacity(0.16))
                        .overlay(Capsule().stroke(NKStale.amber.opacity(0.45))))
                    .frame(maxWidth: .infinity, alignment: .trailing)
                }
                content
                if !stale.loud {
                    Text(stale.age).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityHint(stale.loud ? "Régi adat: \(stale.age)" : stale.age)
        } else {
            content
        }
    }
}

/// What a block shows instead of a number when there is nothing fresh to show. Visibly not a zero: a dash and a
/// line, never "0".
public struct NKNoFreshData: View {
    let line: String
    public init(_ line: String = "Nincs friss adat") { self.line = line }
    public var body: some View {
        HStack(spacing: 10) {
            Text("–").font(.custom(Lagy.outfitFamily, size: 27).weight(.medium)).foregroundStyle(.white.opacity(0.5))
            Text(line).nkFont(13).foregroundStyle(.white.opacity(0.55))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Stepped bars

/// One step of a discrete series: a training week, a planned block, a month.
public struct NKStepBar: Identifiable, Sendable {
    public let id: String
    public let label: String, value: Double
    /// Drawn faint, with its reason under the strip (a deload week, a week he was ill).
    public let dimmed: Bool
    public let note: String?
    public init(label: String, value: Double, dimmed: Bool = false, note: String? = nil) {
        self.id = label; self.label = label; self.value = value; self.dimmed = dimmed; self.note = note
    }
}

/// A discrete series on one baseline — a training block's weeks, a month's loads — with the current step lit.
/// Not a curve (these are steps, not a continuum) and not a heat strip (height carries the value, not colour).
public struct NKSteppedBars: View {
    let bars: [NKStepBar], hue: Hue, current: Int?, height: CGFloat
    public init(_ bars: [NKStepBar], hue: Hue, current: Int? = nil, height: CGFloat = 86) {
        self.bars = bars; self.hue = hue; self.current = current; self.height = height
    }
    public var body: some View {
        let peak = max(0.0001, bars.map(\.value).max() ?? 1)
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(bars.enumerated()), id: \.element.id) { i, b in
                    let on = i == current
                    VStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(on ? AnyShapeStyle(hue.glow)
                                     : AnyShapeStyle(hue.glow.opacity(b.dimmed ? 0.18 : 0.42)))
                            .frame(height: max(4, height * b.value / peak))
                            .overlay(alignment: .top) {
                                if on {
                                    Circle().fill(.white).frame(width: 5, height: 5).offset(y: -9)
                                }
                            }
                        Text(b.label).nkFont(10.5, on ? .semibold : .regular, design: .monospaced)
                            .foregroundStyle(.white.opacity(on ? 0.9 : 0.45))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: height + 20, alignment: .bottom)
            ForEach(bars.filter { $0.note != nil }) { b in
                Text("\(b.label) · \(b.note ?? "")").nkFont(11.5).foregroundStyle(.white.opacity(0.55))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(bars.map { "\($0.label) \(Int(round($0.value)))" }.joined(separator: ", "))
    }
}

// MARK: - Comparing two of something

/// One line of a two-column comparison.
public struct NKCompareLine: Identifiable, Sendable {
    public let id: String
    public let label: String, left: String, right: String
    /// -1 the left one is the better, 1 the right one, 0 neither.
    public let favours: Int
    public init(label: String, left: String, right: String, favours: Int = 0) {
        self.id = label; self.label = label; self.left = left; self.right = right; self.favours = favours
    }
}

/// Two of the same kind of thing side by side — two training blocks, two weeks, two months.
public struct NKCompareColumns: View {
    let leftTitle: String, rightTitle: String, lines: [NKCompareLine], hue: Hue
    public init(leftTitle: String, rightTitle: String, lines: [NKCompareLine], hue: Hue) {
        self.leftTitle = leftTitle; self.rightTitle = rightTitle; self.lines = lines; self.hue = hue
    }
    public var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 10) {
                Color.clear.frame(width: 86, height: 1)
                Text(leftTitle).nkFont(12.5, .semibold).foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity).lineLimit(2).multilineTextAlignment(.center)
                Text(rightTitle).nkFont(12.5, .semibold).foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity).lineLimit(2).multilineTextAlignment(.center)
            }
            .padding(.bottom, 10)
            ForEach(Array(lines.enumerated()), id: \.element.id) { i, l in
                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                HStack(spacing: 10) {
                    Text(l.label).nkFont(11.5).foregroundStyle(.white.opacity(0.55))
                        .frame(width: 86, alignment: .leading).fixedSize(horizontal: false, vertical: true)
                    value(l.left, lit: l.favours < 0)
                    value(l.right, lit: l.favours > 0)
                }
                .padding(.vertical, 9)
                .accessibilityElement(children: .combine)
            }
        }
    }
    private func value(_ text: String, lit: Bool) -> some View {
        Text(text).font(.custom(Lagy.outfitFamily, size: 16).weight(lit ? .medium : .light))
            .foregroundStyle(lit ? hue.glow : .white.opacity(0.9))
            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            .frame(maxWidth: .infinity)
    }
}

/// A long list that carries its own search — the exercise catalog is 166 rows, and the head's search box is the
/// page's, not the block's. Rows render lazily, so the length costs nothing until it is scrolled to.
public struct NKSearchableRowList: View {
    let rows: [NKAreaRow], hue: Hue, placeholder: String
    @State private var query = ""
    @FocusState private var focused: Bool
    public init(_ rows: [NKAreaRow], hue: Hue, placeholder: String = "Keresés") {
        self.rows = rows; self.hue = hue; self.placeholder = placeholder
    }
    public var body: some View {
        let shown = rows.filter { $0.matches(query) }
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                NKGlyph("search-ink", .white.opacity(0.6), size: 15)
                TextField(placeholder, text: $query)
                    .nkFont(14.5).foregroundStyle(.white).tint(.white)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.search)
                if !query.isEmpty {
                    Button { query = ""; focused = false } label: {
                        Image(systemName: "xmark.circle.fill").nkFont(15).foregroundStyle(.white.opacity(0.45))
                    }
                    .buttonStyle(.plain).accessibilityLabel("Keresés törlése")
                }
            }
            .padding(.horizontal, 14).frame(height: 42)
            .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.12))))
            .padding(.bottom, 6)

            if shown.isEmpty {
                Text("Nincs találat erre: „\(query)”").nkFont(13).foregroundStyle(.white.opacity(0.55))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 18)
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { i, r in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 52) }
                        NKRowList([r], hue: hue)
                    }
                }
            }
        }
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
