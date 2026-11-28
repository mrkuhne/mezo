import SwiftUI
import BoopCore
import BoopDesign

/// What the Mezociklus hero shows (Edzés redesign, spec 2026-11-27 §5.2 and §6.1, mezo-r36n9.197.2). A block — fresh
/// or cached — always wins; without one, the hero waits calmly until the first answer decided, so a cold start never
/// flashes „Nincs futó mezociklusod" before the block arrives.
enum MezoHeroState: Equatable {
    case loading
    case running(BlockPlan)
    case none(planned: MezoCard?)
    case failed(String)

    static func resolve(block: BlockPlan?, firstAnswerArrived: Bool, failure: String?, planned: MezoCard?) -> MezoHeroState {
        if let block { return .running(block) }
        if let failure { return .failed(failure) }
        return firstAnswerArrived ? .none(planned: planned) : .loading
    }
}

/// **The hero of the Mezociklus tab** — the page's one point: the running mezociklus with its weeks' arc and
/// Szerkesztés; its rarer actions (Újraindítás, Lezárás, Mentés a sablonba) in the head's „…" menu (#129). Without a
/// running one it says so, with the planned one (if any) as its body and Új mezociklus as its action.
struct MezoHero: View {
    let state: MezoHeroState
    let hue: Hue
    /// The namespace the builder zooms out of (from the Szerkesztés capsule).
    let zoom: Namespace.ID
    /// Set while the server cannot be reached: the actions that write say why they do nothing.
    var offlineReason: String?
    /// Whether a new mezociklus can be started from here.
    var canCreate = true
    var onEdit: () -> Void = {}
    var onRestart: () -> Void = {}
    var onClose: () -> Void = {}
    var onSaveTemplate: () -> Void = {}
    var onNew: () -> Void = {}
    var onOpenPlanned: (MezoCard) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            head
            switch state {
            case .loading:
                HStack(spacing: 10) {
                    ProgressView().tint(.white.opacity(0.6)).controlSize(.small)
                    Text("Töltöm a mezociklusodat…").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
                .accessibilityElement(children: .combine)
            case .running(let b):
                running(b)
            case .none(let planned):
                none(planned)
            case .failed(let line):
                NKNoFreshData(line)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
    }

    private var head: some View {
        HStack(spacing: 8) {
            Capsule().fill(hue.glow).frame(width: 3, height: 13)
            NKGlyph("cycle-ink", hue.glow.opacity(0.9), size: 14)
            // The hero's own label wraps instead of being cut (the „…" button shares its row).
            Text("A MEZOCIKLUSOD").nkFont(12, .medium, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.6))
                .dynamicTypeSize(...DynamicTypeSize.accessibility2)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            if case .running = state {
                NKMoreMenu {
                    Button { onRestart() } label: { Label("Újraindítás", systemImage: "arrow.counterclockwise") }
                    Button(role: .destructive) { onClose() } label: { Label("Lezárás", systemImage: "flag.checkered") }
                    Button { onSaveTemplate() } label: { Label("Mentés a sablonba", systemImage: "square.and.arrow.down") }
                }
                .accessibilityHint("Újraindítás, lezárás, mentés a sablonba")
            }
        }
        .frame(minHeight: 44)
    }

    @ViewBuilder private func running(_ b: BlockPlan) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            title(b.title)
            Text("\(b.currentWeek). hét \(mezoOf(b.weeks)) · \(b.split)")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.65))
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        EdzesWeeksArc(weeks: edzesTimeline(b), hue: hue)
        NKCardActions(primary: NKCardAction("Szerkesztés", action: onEdit))
            .matchedTransitionSource(id: PlanZoom.builder, in: zoom)
        if let offlineReason {
            Text(offlineReason).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder private func none(_ planned: MezoCard?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            title("Nincs futó mezociklusod")
            if planned == nil {
                Text("Amint elindítasz egyet, itt áll, hányadik hetén jársz, mit hoz a hét, és melyik izomcsoport mennyit kap.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
        }
        if let planned {
            // The planned one is the hero's body: look at it first, then decide about starting it.
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("KÖVETKEZIK").nkFont(10.5, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                    Text(planned.title).nkFont(19, .semibold).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text([planned.dateText, mezoLine(planned)].filter { !$0.isEmpty }.joined(separator: " · "))
                        .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                MezoMiniCurve(loads: planned.loads).frame(width: 64).accessibilityHidden(true)
            }
            .padding(14)
            .nkInnerCard()
            .accessibilityElement(children: .combine)
        }
        if let (primary, quiet) = noneActions(planned) {
            NKCardActions(primary: primary, quiet: quiet)
        }
    }

    /// Új mezociklus leads; the planned one's Megnézem sits beside it (before starting, he looks at it first).
    private func noneActions(_ planned: MezoCard?) -> (NKCardAction, [NKCardAction])? {
        let look = planned.map { p in NKCardAction("Megnézem") { onOpenPlanned(p) } }
        if canCreate { return (NKCardAction("Új mezociklus", action: onNew), look.map { [$0] } ?? []) }
        return look.map { ($0, []) }
    }

    /// The block's title: wraps between words, shrinks a little before it would break inside one, and stops growing
    /// past the first accessibility size (spike glitch „Hypertrop / hy").
    private func title(_ text: String) -> some View {
        Text(text).nkFont(24, .semibold).foregroundStyle(.white)
            .lineLimit(3).minimumScaleFactor(0.8)
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .fixedSize(horizontal: false, vertical: true)
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
