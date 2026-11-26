import SwiftUI
import BoopCore
import BoopDesign

/// **Minden hatása** (spike `KapDetail`, screen 05): one proposal, every cross-effect — the server's compare rows
/// (Most → Utána), its effect lines by topic, why Boop proposes it, and where he will see it once accepted (fixed words
/// per step kind, `kapacitasWhereYouSee`). Read from the store, so it opens from the
/// cache too; the decision buttons show while the proposal is still open.
struct MindenHatasaPage: View {
    let proposalId: String
    let monday: String
    let close: @MainActor @Sendable () -> Void

    @Environment(KapacitasStore.self) private var store: KapacitasStore?

    var body: some View {
        let p = store?.weeks[monday]?.proposals.first { $0.id == proposalId }
        let kind = p.map(kapacitasKind)
        NKAreaSubPage(hue: kapacitasHue, crumb: "Átrendezés", eyebrow: "Javaslat · \(kind?.word ?? "")",
                      title: p?.title ?? "Javaslat",
                      sentence: "Ennyi minden mozdul vele. Csak erre a hétre szól, az Évad terve marad.",
                      onBack: close) {
            if let p, let store { content(p, store: store) }
        }
    }

    @ViewBuilder
    private func content(_ p: KapacitasProposal, store: KapacitasStore) -> some View {
        if !p.effects.isEmpty {
            NKBare("Mi változik", hue: kapacitasHue, glyph: "link-deep", trailing: "most · utána") {
                NKCompareColumns(leftTitle: "Most", rightTitle: "Utána", lines: p.effects.map {
                    // the kit's favours: -1 the left (Most) is better, 1 the right (Utána) — the server's sign
                    NKCompareLine(label: $0.label, left: $0.before, right: $0.after, favours: $0.favours)
                }, hue: kapacitasHue)
            }
            .nkStale(store.weekAgeText(monday).map { NKStale(age: $0) })
        }
        if !p.move.isEmpty || !p.effectLines.isEmpty {
            NKBare("Mire hat", hue: kapacitasHue, glyph: "spark-cream") {
                NKRowList(rows(p), hue: kapacitasHue)
            }
        }
        if !p.why.isEmpty {
            NKBare("Miért javaslom", hue: kapacitasHue, glyph: "bolt-ink") {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(p.why.indices, id: \.self) { i in
                        if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        NKHueText(p.why[i], hue: kapacitasHue, size: 14, opacity: 0.75)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                    }
                }
            }
        }
        if p.status == "open" && !store.queuedAccepts.contains(p.id) {
            let seen = kapacitasWhereYouSee(p)
            if !seen.isEmpty {
                NKBare("Ha jóváhagyod, itt látod", hue: kapacitasHue, glyph: "check-ink") {
                    NKList(seen, hue: kapacitasHue)
                }
            }
            NKActions([NKAction(glyph: "check-ink", title: ProposalCard.primaryTitle(p), primary: true, action: {
                           Task { await store.accept(p, monday: monday); close() }
                       }),
                       NKAction(title: "Most nem", action: {
                           Task { await store.decline(p, monday: monday); close() }
                       })], hue: kapacitasHue)
        }
    }

    /// The move first, then each effect line under its topic.
    private func rows(_ p: KapacitasProposal) -> [NKAreaRow] {
        var out: [NKAreaRow] = []
        if !p.move.isEmpty {
            out.append(NKAreaRow(id: "move", glyph: kapacitasKind(p).glyph, title: "Ami mozdul", sub: p.move, subLines: 3))
        }
        for (i, line) in p.effectLines.enumerated() {
            let t = kapacitasLineTopic(line)
            out.append(NKAreaRow(id: "e\(i)", glyph: t.glyph, title: t.topic, sub: line, subLines: 3))
        }
        return out
    }
}
