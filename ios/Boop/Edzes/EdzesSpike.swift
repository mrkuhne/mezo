import SwiftUI
import BoopCore
import BoopDesign

// SPIKE (mezo-r36n9.197) — THROWAWAY. The Edzés redesign's simulator spike: section cards, the hero, in-card actions.
// Launch flags: -spikeMenu rejtett|gombok · -spikeSky 1|2 (read in BoopKit Tokens).

enum EdzesSpike {
    static var menuHidden: Bool { UserDefaults.standard.string(forKey: "spikeMenu") != "gombok" }
}

/// The section card: the small-caps head on the card, the block's own states inside; optional whole-card tap.
struct SpikeCard<C: View>: View {
    let label: String
    let hue: Hue
    var trailing: String? = nil
    var glyph: String? = nil
    var state: NKBlockState = .ready
    var action: (() -> Void)? = nil
    @ViewBuilder let content: () -> C

    var body: some View {
        let card = NKBare(label, hue: hue, glyph: glyph, trailing: trailing, state: state) {
            if let action {
                Button(action: action) {
                    HStack(alignment: .center, spacing: 10) {
                        content().frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.45))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                content()
            }
        }
        card
            .padding(.horizontal, 16).padding(.vertical, 12)
            .nkGlass(24)
    }
}

/// The hero frame: a bigger glass card, no head tick — the page's one point.
struct SpikeHero<C: View>: View {
    @ViewBuilder let content: () -> C
    var body: some View {
        content()
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .nkGlass(28)
    }
}

/// The weeks' arc, hero size: one bar per week, the current lit and named, the deload dashed, past weeks ticked.
struct SpikeWeeksArc: View {
    let weeks: [NKBlockWeek]
    let hue: Hue
    var height: CGFloat = 132

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(weeks) { w in
                VStack(spacing: 6) {
                    if w.state == .current {
                        Text(w.phase.uppercased()).nkFont(9.5, .semibold, design: .monospaced).tracking(1.2)
                            .foregroundStyle(hue.glow).fixedSize()
                    }
                    ZStack(alignment: .top) {
                        RoundedRectangle(cornerRadius: 7)
                            .fill(fill(w))
                            .overlay {
                                if w.isDeload {
                                    RoundedRectangle(cornerRadius: 7)
                                        .strokeBorder(hue.glow.opacity(0.7), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                                }
                            }
                            .shadow(color: w.state == .current ? hue.glow.opacity(0.55) : .clear, radius: 10)
                        if w.state == .past {
                            Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white.opacity(0.8)).padding(.top, 6)
                        }
                    }
                    .frame(height: max(14, (height - 34) * w.load))
                    Text("\(w.week)").nkFont(12, w.state == .current ? .semibold : .regular, design: .monospaced)
                        .foregroundStyle(.white.opacity(w.state == .current ? 0.95 : 0.45))
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: height, alignment: .bottom)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
    }

    private func fill(_ w: NKBlockWeek) -> Color {
        if w.isDeload { return .clear }
        switch w.state {
        case .past: return .white.opacity(0.28)
        case .current: return hue.glow
        case .future: return .white.opacity(0.10)
        }
    }

    private var label: String {
        guard let c = weeks.first(where: { $0.state == .current }) else { return "A mezociklus hetei" }
        return "\(weeks.count) hetes mezociklus, a \(c.week). héten jársz: \(c.phase)"
    }
}

/// In-card actions: one primary capsule and up to two quiet ones; a column at large type.
struct SpikeActions: View {
    struct Item: Identifiable { let title: String; let action: () -> Void; var id: String { title } }
    let primary: Item
    var quiet: [Item] = []

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { buttons }
            VStack(spacing: 8) { buttons }
        }
    }

    @ViewBuilder private var buttons: some View {
        capsule(primary, primary: true)
        ForEach(quiet) { capsule($0, primary: false) }
    }

    private func capsule(_ item: Item, primary: Bool) -> some View {
        Button(action: item.action) {
            Text(item.title).nkFont(15, .semibold).lineLimit(1)
                .foregroundStyle(primary ? NK.ground : .white)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background {
                    if primary { Capsule().fill(.white) }
                    else { Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))) }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// The „…" button for the hero head.
struct SpikeMoreMenu<M: View>: View {
    @ViewBuilder let items: () -> M
    var body: some View {
        Menu { items() } label: {
            Image(systemName: "ellipsis").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(.white.opacity(0.10)).overlay(Circle().stroke(.white.opacity(0.18))))
        }
        .accessibilityLabel("Továbbiak")
    }
}

/// This week's top muscles as slim bars: sets this week against the plan's ceiling.
struct SpikeMuscleBars: View {
    let bands: [MuscleBand]
    let hue: Hue
    var limit = 5

    var body: some View {
        let top = Array(bands.sorted { $0.current > $1.current }.prefix(limit))
        let most = max(1, top.map(\.ceiling).max() ?? 1)
        VStack(alignment: .leading, spacing: 11) {
            ForEach(top) { b in
                HStack(spacing: 10) {
                    Text(muscleName(b.muscle).capitalizedFirst).nkFont(14).foregroundStyle(.white.opacity(0.85))
                        .frame(width: 92, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
                    GeometryReader { g in
                        ZStack(alignment: .leading) {
                            Capsule().fill(.white.opacity(0.08))
                                .frame(width: g.size.width * CGFloat(b.ceiling) / CGFloat(most))
                            Capsule().fill(hue.glow.opacity(0.9))
                                .frame(width: g.size.width * CGFloat(b.current) / CGFloat(most))
                        }
                    }
                    .frame(height: 8)
                    Text("\(b.current)").font(.nkNumber(18)).foregroundStyle(.white).monospacedDigit()
                        .frame(width: 28, alignment: .trailing)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(muscleName(b.muscle)): \(b.current) szett ezen a héten")
            }
            if bands.count > limit {
                Text("+\(bands.count - limit) további izomcsoport").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
            }
        }
    }
}

/// A big number with its word under it, for hero stat rows.
struct SpikeStat: View {
    let number: String
    let word: String
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(number).font(.nkNumber(30)).foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
            Text(word).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

extension View {
    /// A card that sits inside a section card: a faint fill, no second glass.
    func spikeInner(_ r: CGFloat = 20) -> some View {
        background(RoundedRectangle(cornerRadius: r, style: .continuous).fill(.white.opacity(0.06))
            .overlay(RoundedRectangle(cornerRadius: r, style: .continuous).stroke(.white.opacity(0.08))))
            .clipShape(RoundedRectangle(cornerRadius: r, style: .continuous))
    }
}
