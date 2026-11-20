import SwiftUI
import BoopCore
import BoopDesign

/// **Szabályok** (screen 11): the season's switches — saved on the tap (no kcal effect, so no preview) — and the
/// season's facts they sit beside. A row the server has no data for is left out.
struct EvadRulesPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var rules: EvadRules?
    @State private var problem: String?

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Az évad szabályai", title: "Szabályok",
                      sentence: "Boop *mindenhol* ezekhez igazodik: beszélgetés közben, a reggeli összefoglalóban és az étkezések értékelésénél.",
                      onBack: close) {
            if let o = store?.overview, let r = rules {
                if let problem { EvadLine(text: problem) }
                NKBare("Étel", hue: evadHue, glyph: "bowl-sage") {
                    toggle("Csak kevéssé feldolgozott ételek", r.processedFoodMaxNova < 4) { on in
                        var n = r; n.processedFoodMaxNova = on ? 2 : 4; return n
                    }
                    let food = foodRows(o)
                    if !food.isEmpty { NKRowList(food, hue: evadHue) }
                    toggle("Vasárnap este kérem a jövő heti menüt", r.menuDay != nil) { on in
                        var n = r; n.menuDay = on ? 6 : nil; return n
                    }
                }
                NKBare("Edzés", hue: evadHue, glyph: "dumbbell-ink") {
                    let training = trainingRows(o)
                    if !training.isEmpty { NKRowList(training, hue: evadHue) }
                    toggle("Könnyebb edzéshéten ne fogyjak", r.deloadMaintain) { on in
                        var n = r; n.deloadMaintain = on; return n
                    }
                }
                NKBare("Alvás és súly", hue: evadHue, glyph: "moon-ink") {
                    let rows = sleepWeightRows(o)
                    if !rows.isEmpty { NKRowList(rows, hue: evadHue) }
                    toggle("A valódi égetésemmel számoljon", r.useLearnedExpenditure) { on in
                        var n = r; n.useLearnedExpenditure = on; return n
                    }
                }
                NKBare("Boop", hue: evadHue, glyph: "chat-ink") {
                    toggle("Ajánljon kísérletet, ha valami újat kezdek", r.proposeExperiments) { on in
                        var n = r; n.proposeExperiments = on; return n
                    }
                }
            } else {
                NKBare("Szabályok", hue: evadHue, state: .failed("Az évadod most nem érhető el.", close)) { EmptyView() }
            }
        }
        .evadReviewAnchor()
        .onAppear { if rules == nil { rules = store?.overview?.season.rules } }
    }

    /// A switch that saves its new rules at once; a refusal puts the switch back and says why.
    private func toggle(_ title: String, _ on: Bool, _ next: @escaping (Bool) -> EvadRules) -> some View {
        Toggle(isOn: Binding(get: { on }, set: { save(next($0)) })) {
            Text(title).nkFont(15).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
        }
        .tint(evadHue.glow).padding(.vertical, 4)
    }

    private func save(_ new: EvadRules) {
        guard let store, let old = rules else { return }
        rules = new; problem = nil
        Task {
            do throws(PlanFetchError) {
                try await store.putRules(new)
            } catch {
                rules = old; problem = evadErrorText(error)
            }
        }
    }

    private func foodRows(_ o: EvadOverview) -> [NKAreaRow] {
        let f = o.pillars.food
        guard let allowed = f.allowedCount, allowed > 0 || f.recipeCount != nil else { return [] }
        return [NKAreaRow(id: "recipes", glyph: "book-sage", title: "Kiválasztott receptek", sub: "a menü csak ezekből áll össze",
                          value: f.recipeCount.map { "\(allowed) / \($0)" } ?? "\(allowed)")]
    }

    private func trainingRows(_ o: EvadOverview) -> [NKAreaRow] {
        let b = o.pillars.block
        var rows: [NKAreaRow] = []
        if let title = b.title {
            let length = b.blockWeeks.map { "\($0) hetes" }
            let when: String? = if let from = b.fromWeek, let to = b.toWeek { "az évad \(from)–\(to). hetében" } else { nil }
            rows.append(NKAreaRow(id: "block", glyph: "clock-ink", title: "Blokk · \(title)",
                                  sub: [length, when].compactMap { $0 }.joined(separator: ", ")))
        }
        var sports: [String] = []
        for s in b.sport where !sports.contains(s.sport) { sports.append(s.sport) }
        for sport in sports {
            let slots = b.sport.filter { $0.sport == sport }
            let name = evadSportName(sport)
            rows.append(NKAreaRow(id: "sport-\(sport)", glyph: "ball-sun", title: name.prefix(1).uppercased() + name.dropFirst(),
                                  sub: "\(evadDayList(slots.map(\.dayOfWeek))), \(slots[0].durationMin) perc"))
        }
        return rows
    }

    private func sleepWeightRows(_ o: EvadOverview) -> [NKAreaRow] {
        var rows: [NKAreaRow] = []
        if let need = o.pillars.sleep.needMin {
            rows.append(NKAreaRow(id: "sleep", glyph: "moon-ink", title: "Alvásigény", sub: "az edzésből számolva · \(evadHM(need))"))
        }
        let w = o.pillars.weight
        if o.head.trajectory == "maintain" {
            if let band = w.band ?? o.weight.band {
                rows.append(NKAreaRow(id: "weight", glyph: "scale-ink", title: "Súlycél", sub: "\(evadBandText(band)) között tartod"))
            }
        } else if let target = w.targetKg {
            let pace = (w.kgPerWeek ?? o.weight.kgPerWeek).map { "heti \(evadKg(abs($0))) kg" }
            rows.append(NKAreaRow(id: "weight", glyph: "scale-ink", title: "Súlycél",
                                  sub: ["\(evadKg(target)) kg", pace].compactMap { $0 }.joined(separator: " · ")))
        }
        return rows
    }
}
