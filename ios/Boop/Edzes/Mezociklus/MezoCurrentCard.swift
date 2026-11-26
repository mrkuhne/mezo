import SwiftUI
import BoopCore
import BoopDesign

/// The running mezociklus at the top of the Mezociklus tab: where he is, and what he can do with it
/// (mezo-r36n9.177, spike `MezoCurrentCardSpike`). The builder zooms out of the Szerkesztés pill.
struct MezoCurrentCard: View {
    let title: String
    let week: Int
    let weeks: Int
    let split: String
    let hue: Hue
    let zoom: Namespace.ID
    /// Set while the server cannot be reached: the buttons that write say why they do nothing.
    var offlineReason: String?
    let onEdit: () -> Void
    let onRestart: () -> Void
    let onClose: () -> Void
    let onSaveTemplate: () -> Void

    var body: some View {
        NKBare("A MEZOCIKLUSOD", hue: hue, glyph: "cycle-ink") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).nkFont(22, .semibold).foregroundStyle(.white)
                        Text("\(week). hét \(mezoOf(weeks)) · \(split)")
                            .nkFont(13).foregroundStyle(.white.opacity(0.65))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                    Menu {
                        Button { onSaveTemplate() } label: { Label("Mentés a sablonba", systemImage: "square.and.arrow.down") }
                    } label: {
                        Image(systemName: "ellipsis").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Circle().fill(.white.opacity(0.10)).overlay(Circle().stroke(.white.opacity(0.18))))
                    }
                    .accessibilityLabel("Továbbiak")
                    .accessibilityHint("Mentés a sablonba")
                }
                NKLevelBar(level: Double(week) / Double(max(weeks, 1)), hue: hue)
                    .accessibilityHidden(true)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) { pills }
                    VStack(spacing: 8) { pills }
                }
                if let offlineReason {
                    Text(offlineReason).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
        }
    }

    @ViewBuilder private var pills: some View {
        pill("Szerkesztés", primary: true, action: onEdit)
            .matchedTransitionSource(id: PlanZoom.builder, in: zoom)
        pill("Újraindítás", action: onRestart)
        pill("Lezárás", action: onClose)
    }

    private func pill(_ title: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14.5, .semibold).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(primary ? NK.ground : .white)
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background {
                    if primary { Capsule().fill(.white) }
                    else { Capsule().fill(.white.opacity(0.10)).overlay(Capsule().stroke(.white.opacity(0.18))) }
                }
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

/// No running mezociklus, but one is planned: it shows here, and the only move is to look at it first.
struct MezoPlannedCard: View {
    let card: MezoCard
    let hue: Hue
    let onOpen: () -> Void

    var body: some View {
        NKBare("KÖVETKEZIK", hue: hue, glyph: "cycle-ink") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(card.title).nkFont(22, .semibold).foregroundStyle(.white)
                        Text([card.dateText, mezoLine(card)].filter { !$0.isEmpty }.joined(separator: " · "))
                            .nkFont(13).foregroundStyle(.white.opacity(0.65))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    MezoMiniCurve(loads: card.loads).frame(width: 64)
                }
                .accessibilityElement(children: .combine)
                MezoButton(title: "Megnézem", action: onOpen)
                    .accessibilityHint("Előbb megnézed, utána döntesz az indításról")
            }
        }
    }
}

/// The two tiles under the week: every mezociklus, and the year.
struct MezoTiles: View {
    let hue: Hue
    let groups: MezoGroups
    /// Nil while the year plan is unknown or absent.
    let year: WireYearPlan?
    let onAll: () -> Void
    let onYear: () -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { allTile; yearTile }
            VStack(spacing: 12) { allTile; yearTile }
        }
    }

    private var allSub: String {
        let parts = [groups.templates.isEmpty ? nil : "\(groups.templates.count) sablon",
                     groups.closed.isEmpty ? nil : "\(groups.closed.count) lezárt"].compactMap { $0 }
        return parts.isEmpty ? "A futó, a következők és a sablonjaid" : parts.joined(separator: " · ")
    }

    private var allTile: some View {
        tile(label: "ÖSSZES", title: "Mezociklusaim", sub: allSub, action: onAll) {
            // Up to three cards fanned out, each with its own weeks' curve.
            let curves = Array((groups.templates + groups.closed).prefix(3).map(\.loads))
            let shown = curves.isEmpty ? [[0.45, 0.72, 0.72, 1.0, 1.0, 0.3]] : curves
            ZStack {
                ForEach(Array(shown.enumerated()), id: \.offset) { i, loads in
                    let k = Double(i) - Double(shown.count - 1) / 2
                    MezoMiniCurve(loads: loads, lit: i == shown.count - 1)
                        .padding(8)
                        .frame(width: 92, height: 54)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(white: 0.16 + Double(i) * 0.04)))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.14)))
                        .rotationEffect(.degrees(k * 7))
                        .offset(x: CGFloat(k) * 16, y: CGFloat(-k) * 4)
                }
            }
        }
        .accessibilityLabel("Mezociklusaim, \(allSub)")
    }

    private var yearSub: String {
        guard let year else { return "Melyik mezociklus mikor jön" }
        let blocks = year.blocks.filter { !$0.isConsolidation }
        let left = blocks.filter { $0.status == "planned" }.count
        return "\(blocks.count) mezociklus · \(left) hátra"
    }

    private var yearTile: some View {
        tile(label: "ÉVES TERV", title: "Az év íve", sub: yearSub, action: onYear) {
            // The year as a strip of its blocks, the running one lit.
            let blocks = year?.blocks ?? []
            let total = max(1, blocks.reduce(0) { $0 + $1.weeks })
            GeometryReader { g in
                HStack(spacing: 3) {
                    if blocks.isEmpty {
                        ForEach(0..<5, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 4, style: .continuous).fill(.white.opacity(0.14)).frame(height: 30)
                        }
                    } else {
                        ForEach(Array(blocks.enumerated()), id: \.offset) { _, b in
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .fill(b.status == "running" ? AnyShapeStyle(hue.glow)
                                      : AnyShapeStyle(.white.opacity(b.status == "done" ? 0.42 : 0.16)))
                                .frame(width: max(4, (g.size.width - CGFloat(blocks.count - 1) * 3) * CGFloat(b.weeks) / CGFloat(total)),
                                       height: b.isConsolidation ? 14 : 30)
                        }
                    }
                }
                .frame(maxHeight: .infinity)
            }
            .frame(height: 54)
        }
        .accessibilityLabel("Éves terv, \(yearSub)")
    }

    private func tile<G: View>(label: String, title: String, sub: String, action: @escaping () -> Void,
                               @ViewBuilder graphic: () -> G) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Text(label).nkFont(10.5, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                graphic().frame(maxWidth: .infinity).frame(height: 70).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(17, design: .serif).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.6)).lineLimit(3)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
            .nkGlass(22)
            .contentShape(RoundedRectangle(cornerRadius: 22))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
    }
}
