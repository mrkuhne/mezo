import SwiftUI
import BoopCore
import BoopDesign

/// **One finished experiment** (screen 10, Évad S4, `mezo-r36n9.16`): the honest verdict, the signals before and during
/// it with the day counts, what it means (always „nem bizonyíték", with the overlaps), and „Megtartom szokásnak" (a
/// season rule line) / „Újra kipróbálom". `id` nil = the newest finished one (simulator review).
struct EvadExperimentPage: View {
    let id: String?
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?

    var body: some View {
        let exp = store?.experiments
        let e = id.flatMap { exp?.experiment($0) } ?? (id == nil ? exp?.data?.past.first : nil)
        Group {
            if let e, let exp {
                page(e, exp: exp)
            } else {
                NKAreaSubPage(hue: evadHue, crumb: "Hatás", eyebrow: "Kísérlet", title: exp?.data == nil ? "Töltöm" : "Nem találom",
                              onBack: close) {
                    if let p = exp?.problem {
                        NKBare("Az eredmény", hue: evadHue, glyph: "chart-deep", state: .failed(evadErrorText(p), {
                            Task { await exp?.load(force: true) }
                        })) { EmptyView() }
                    } else if exp?.data == nil {
                        NKBare("Az eredmény", hue: evadHue, glyph: "chart-deep", state: .loading) { EmptyView() }
                    } else {
                        EvadLine(text: "Ezt a kísérletet már nem találom.")
                    }
                }
            }
        }
        .task { await exp?.load() }
    }

    private func page(_ e: EvadExperiment, exp: EvadExperimentStore) -> some View {
        let rows = e.result.map(evadSignalRows) ?? []
        return NKAreaSubPage(hue: evadHue, crumb: "Hatás", eyebrow: "Kísérlet · \(e.lengthDays) nap", title: e.title,
                             sentence: evadVerdictSentence(e), onBack: close) {
            if let age = exp.ageText { EvadLine(text: "Offline vagy, ez a \(age) állapot.") }
            NKBare("Előtte és utána", hue: evadHue, glyph: "chart-deep", trailing: evadCompareDays(e)) {
                if rows.isEmpty {
                    EvadLine(text: "Ezekre a napokra nem volt elég mért adat az összevetéshez.")
                } else {
                    NKCompareColumns(leftTitle: "Előtte", rightTitle: "Közben", lines: rows.map {
                        NKCompareLine(label: $0.label, left: $0.before, right: $0.after, favours: $0.favours)
                    }, hue: evadHue)
                }
            }
            NKBare("Mit jelent ez?", hue: evadHue, glyph: "spark-cream") {
                NKList(evadMeaning(e), hue: evadHue)
            }
            if e.kept {
                HStack(spacing: 10) {
                    NKGlyph("check-ink", evadHue.glow, size: 18)
                    Text("Bekerült az évad szabályai közé").nkFont(15).foregroundStyle(.white.opacity(0.85))
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)
            }
            if let problem = exp.actionProblem { EvadLine(text: problem) }
            NKActions(actions(e, exp: exp), hue: evadHue)
                .disabled(exp.busy)
        }
        .evadReviewAnchor()
        .onAppear { exp.actionProblem = nil }
    }

    private func actions(_ e: EvadExperiment, exp: EvadExperimentStore) -> [NKAction] {
        var out: [NKAction] = []
        if !e.kept {
            out.append(NKAction(glyph: "check-deep", title: "Megtartom szokásnak", primary: true, action: {
                Task { await exp.keep(e.id) }
            }))
        }
        out.append(NKAction(glyph: "repeat-deep", title: "Újra kipróbálom", primary: e.kept, action: {
            Task {
                let again = EvadExperimentCreate(title: e.title, subjectKind: e.subjectKind, subjectRef: e.subjectRef,
                                                 lengthDays: e.lengthDays)
                if await exp.create(again) { close() }
            }
        }))
        return out
    }
}
