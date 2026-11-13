import SwiftUI
import BoopCore
import BoopDesign

// "Étrend-beállítások" (B4 Task 14): the macro split (a preset or his own), the protein tier, water and fibre — with the
// live preview the web editor has: while he changes a setting he sees the day targets it WOULD give (the server's own
// projection, nothing stored). Saving is a separate tap; the server then re-evaluates the active goal.

let dietPresets: [(id: String, label: String)] = [
    ("balanced", "Kiegyensúlyozott"), ("low_fat", "Alacsony zsír"), ("low_carb", "Alacsony szénhidrát"), ("high_carb", "Magas szénhidrát"), ("custom", "Egyéni"),
]
let dietTiers: [(id: String, label: String)] = [("low", "Alacsony"), ("moderate", "Mérsékelt"), ("high", "Magas")]

@MainActor @Observable
final class DietSettingsModel {
    var draft: DietSettings?
    private(set) var saved: DietSettings?
    private(set) var problem: FoodFetchError?
    private(set) var loading = false
    private(set) var saving = false
    private(set) var preview: DietPreview?
    /// The draft the preview was computed for: a preview of an older draft is never shown as current.
    private(set) var previewDraft: DietSettings?
    private(set) var previewProblem: FoodFetchError?
    private(set) var previewing = false
    private let food: FoodClient

    init(food: FoodClient) { self.food = food }

    var dirty: Bool { draft != nil && draft != saved }
    var previewIsCurrent: Bool { preview != nil && previewDraft == draft }

    /// A custom split must add up to exactly 100,0 % (tenths of a percent on the wire).
    var splitProblem: String? {
        guard let d = draft, d.splitPreset == "custom" else { return nil }
        let sum = (d.proteinPctX10 ?? 0) + (d.carbsPctX10 ?? 0) + (d.fatPctX10 ?? 0)
        return sum == 1000 ? nil : "Az arányoknak 100%-ra kell összegződniük (most \(huPct(sum)))."
    }
    var canSave: Bool { draft != nil && splitProblem == nil && !saving }

    func load() async {
        loading = true; defer { loading = false }
        do {
            var d = try await food.dietSettings()
            // a custom split opens on the values he saved; the first time it starts from an even-ish default
            if d.splitPreset != "custom" { d.proteinPctX10 = d.proteinPctX10 ?? 300; d.carbsPctX10 = d.carbsPctX10 ?? 400; d.fatPctX10 = d.fatPctX10 ?? 300 }
            draft = d; saved = d; problem = nil
        } catch let e as FoodFetchError { problem = e } catch { problem = .server }
    }

    /// Asks the server what today would be under the current draft. Skipped while the split cannot be saved.
    func refreshPreview() async {
        guard let asked = draft else { return }
        guard splitProblem == nil else { preview = nil; previewProblem = nil; return }
        previewing = true
        defer { if draft == asked { previewing = false } }
        do {
            let p = try await food.previewDietSettings(asked)
            // a slower answer for an older draft must not overwrite the one for the current draft
            guard draft == asked else { return }
            preview = p; previewDraft = asked; previewProblem = nil
        } catch {
            guard draft == asked else { return }
            preview = nil; previewDraft = nil
            previewProblem = error as? FoodFetchError ?? .server
        }
    }

    func save() async -> String {
        guard let draft else { return "Előbb be kell töltenem a beállításaidat — próbáld újra" }
        guard splitProblem == nil else { return splitProblem ?? "" }
        saving = true; defer { saving = false }
        do {
            saved = try await food.setDietSettings(draft)
            self.draft = saved
            return "Elmentettem — a célokat újraszámolom."
        } catch FoodFetchError.offline { return "Nincs net — a változtatások itt maradnak, próbáld újra, amint van."
        } catch FoodFetchError.rejected { return "A szerver nem fogadta el ezeket a számokat — nézd át az arányokat."
        } catch { return "Nem sikerült elmenteni — próbáld újra." }
    }
}

/// `300` → "30,0%".
func huPct(_ x10: Int) -> String { "\(x10 / 10),\(abs(x10) % 10)%" }

struct DietSettingsSheet: View {
    let food: FoodClient?
    let onSaved: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var model: DietSettingsModel?
    @State private var message: String?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "BEÁLLÍTÁS", title: "Étrend-beállítások") {
            if let m = model { content(m) } else { EtelCard { EtelProblem(text: "A beállításaidat most nem érem el.", detail: .unauthorized) } }
        }
        .task {
            guard model == nil, let food else { return }
            let m = DietSettingsModel(food: food)
            model = m
            await m.load()
            await m.refreshPreview()
        }
    }

    @ViewBuilder private func content(_ m: DietSettingsModel) -> some View {
        if m.loading && m.draft == nil {
            EtelCard { Text("A beállítások betöltése folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder) }
        } else if m.draft == nil {
            EtelCard { EtelProblem(text: "A beállításaidat most nem látom, ezért nem is írom át őket.", detail: m.problem, retry: { Task { await m.load(); await m.refreshPreview() } }) }
        } else {
            previewCard(m)
            splitCard(m)
            tierCard(m)
            targetsCard(m)
            if let message { EtelNote(text: message) }
            NKPill(m.saving ? "Mentem…" : "Mentem", primary: m.dirty && m.canSave) {
                guard m.dirty, m.canSave else { return }
                Task {
                    let text = await m.save()
                    if m.dirty { message = text } else { onSaved(text); dismiss() }
                }
            }
            .disabled(!m.dirty || !m.canSave)
            // every change asks for a fresh projection, once the owner stops tapping
            .task(id: m.draft) {
                guard m.dirty else { return }
                try? await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled else { return }
                await m.refreshPreview()
            }
        }
    }

    // MARK: the preview

    private func previewCard(_ m: DietSettingsModel) -> some View {
        EtelCard("A MAI CÉLOD EZ ALAPJÁN") {
            if let p = m.preview {
                let kcalMacro = Double(p.proteinG * 4 + p.carbsG * 4 + p.fatG * 9)
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(huInt(p.kcal)).font(.nkNumber(46)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
                        Text("kcal").nkFont(14, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    }
                    HStack(spacing: 8) {
                        macroTile("Fehérje", p.proteinG, share: kcalMacro > 0 ? Double(p.proteinG * 4) / kcalMacro : 0)
                        macroTile("Szénhidrát", p.carbsG, share: kcalMacro > 0 ? Double(p.carbsG * 4) / kcalMacro : 0)
                        macroTile("Zsír", p.fatG, share: kcalMacro > 0 ? Double(p.fatG * 9) / kcalMacro : 0)
                    }
                    Text(m.previewIsCurrent ? (m.dirty ? "Előnézet: mentésre válik élessé." : "Ezt a célt adja most a beállításod.") : "Számolom az új értékeket…")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                    if !p.fromGoal {
                        Text("Nincs aktív célod vagy testadatod, amiből számolhatnék, ezért ez az alapértelmezett számítás.")
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                .opacity(m.previewIsCurrent ? 1 : 0.55)
                .accessibilityElement(children: .combine)
            } else if m.splitProblem != nil {
                Text("Amíg az arányok nem adnak ki 100%-ot, nem tudom kiszámolni.").nkFont(14).foregroundStyle(.white.opacity(0.7))
            } else if m.previewProblem != nil {
                EtelProblem(text: "Az előnézetet most nem tudom kiszámolni. Menteni ettől még lehet.", detail: m.previewProblem, retry: { Task { await m.refreshPreview() } })
            } else {
                Text("Az előnézet számítása folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder)
            }
        }
    }

    private func macroTile(_ name: String, _ grams: Int, share: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(name).nkFont(12).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
            Text("\(grams) g").nkFont(17, .semibold, design: .monospaced).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
            Text("\(Int((share * 100).rounded()))%").nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.5))
        }
        .padding(10).frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.06)))
    }

    // MARK: the split

    private func splitCard(_ m: DietSettingsModel) -> some View {
        EtelCard("MAKRÓPROFIL") {
            EtelChoiceChips(options: dietPresets, selected: m.draft?.splitPreset) { m.draft?.splitPreset = $0 }
            if m.draft?.splitPreset == "custom" {
                pctStepper("Fehérje", get: { m.draft?.proteinPctX10 ?? 0 }, set: { m.draft?.proteinPctX10 = $0 })
                pctStepper("Szénhidrát", get: { m.draft?.carbsPctX10 ?? 0 }, set: { m.draft?.carbsPctX10 = $0 })
                pctStepper("Zsír", get: { m.draft?.fatPctX10 ?? 0 }, set: { m.draft?.fatPctX10 = $0 })
                if let problem = m.splitProblem {
                    Text(problem).nkFont(13).foregroundStyle(Color(hex: 0xF7A8C4)).fixedSize(horizontal: false, vertical: true)
                }
                Text("A fehérje-cél testsúly szerint védett; az eltérést a szénhidrát nyeli el.").nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func pctStepper(_ name: String, get: @escaping () -> Int, set: @escaping (Int) -> Void) -> some View {
        Stepper(value: Binding(get: get, set: set), in: 0...1000, step: 5) {
            HStack {
                Text(name).nkFont(15).foregroundStyle(.white.opacity(0.9))
                Spacer(minLength: 6)
                Text(huPct(get())).nkFont(14.5, design: .monospaced).foregroundStyle(.white)
            }
        }
        .accessibilityValue(huPct(get()))
    }

    // MARK: the protein tier, water and fibre

    private func tierCard(_ m: DietSettingsModel) -> some View {
        EtelCard("FEHÉRJE-SZINT") {
            EtelChoiceChips(options: dietTiers, selected: m.draft?.proteinTier, minimum: 96) { m.draft?.proteinTier = $0 }
            Text("A testsúlyod és a zsírmentes tömeged szerinti számítást is állítja; a cél a kettő közül a nagyobb, egy felső korláttal.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func targetsCard(_ m: DietSettingsModel) -> some View {
        EtelCard("VÍZ ÉS ROST") {
            Stepper(value: Binding(get: { m.draft?.waterMl ?? 2500 }, set: { m.draft?.waterMl = $0 }), in: 500...8000, step: 100) {
                HStack {
                    Text("Víz-cél").nkFont(15).foregroundStyle(.white.opacity(0.9))
                    Spacer(minLength: 6)
                    Text("\(huInt(m.draft?.waterMl ?? 0)) ml").nkFont(14.5, design: .monospaced).foregroundStyle(.white)
                }
            }
            Stepper(value: Binding(get: { m.draft?.fiberG ?? 30 }, set: { m.draft?.fiberG = $0 }), in: 10...80, step: 1) {
                HStack {
                    Text("Rost-cél").nkFont(15).foregroundStyle(.white.opacity(0.9))
                    Spacer(minLength: 6)
                    Text("\(m.draft?.fiberG ?? 0) g").nkFont(14.5, design: .monospaced).foregroundStyle(.white)
                }
            }
        }
    }
}
