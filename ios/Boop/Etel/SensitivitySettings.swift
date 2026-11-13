import SwiftUI
import BoopCore
import BoopDesign

// "Amit kerülök" (B4 Task 14, spike ESensitivitySettings): the EU-14 allergens and the owner's own words, each at one of
// three levels, and the processing-level (NOVA) rule. This is where "lactose intolerant" and "nothing above processing
// level 2" are recorded — every badge in the room reads them. Nothing here is saved until he taps Mentem, and rules that
// could not be read are never shown as an empty list he could then save over the real one.

/// The 14 official allergens in the server's keys, in the order the chips show them.
let eu14Keys = ["gluten", "crustaceans", "eggs", "fish", "peanuts", "soybeans", "milk", "nuts", "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs"]

/// A key as the owner reads it: the Hungarian allergen name, or his own word with a capital (the server lowercases it).
func sensitivityName(_ key: String) -> String {
    eu14Keys.contains(key) ? allergenName(key) : (key.prefix(1).uppercased() + key.dropFirst())
}

/// The chip label: milk also says lactose, the rule the owner actually keeps.
private func sensitivityChip(_ key: String) -> String { key == "milk" ? "Tej · laktóz" : allergenName(key) }

func sensitivityLevelName(_ level: SensitivityLevel) -> String {
    switch level { case .allergy: "Allergia"; case .intolerance: "Intolerancia"; case .avoid: "Kerülöm" }
}

/// What Boop does at each level, in the words of the block rule (`SensitivityRules`).
func sensitivityLevelSentence(_ level: SensitivityLevel, key: String) -> String {
    if !eu14Keys.contains(key) {
        return "Név szerint keresem az összetevők között, ezért kevésbé pontos. Ha benne látom, szólok."
    }
    switch level {
    case .allergy: return "Szólok, ha benne van, ha nyomokban benne lehet, és akkor is, ha a termékről nincs adat."
    case .intolerance:
        return key == "milk" ? "Szólok, ha benne van, és megmondom, miben. Nyomokban csak halkan jelzem. Laktózmentes tej rendben."
                             : "Szólok, ha benne van, és megmondom, miben. Nyomokban csak halkan jelzem."
    case .avoid: return "Szólok, ha benne van. Nyomokban nem jelzek."
    }
}

@MainActor @Observable
final class SensitivityEditor {
    private(set) var draft: SensitivityProfile?
    private(set) var saved: SensitivityProfile?
    private(set) var problem: FoodFetchError?
    private(set) var loading = false
    private(set) var saving = false
    private let food: FoodClient

    init(food: FoodClient) { self.food = food }

    var dirty: Bool { draft != nil && draft != saved }
    var freeText: [SensitivityItem] { draft?.items.filter { !eu14Keys.contains($0.key) } ?? [] }

    func load() async {
        loading = true; defer { loading = false }
        do { let p = try await food.sensitivity(); draft = p; saved = p; problem = nil }
        catch let e as FoodFetchError { problem = e }
        catch { problem = .server }
    }

    func level(for key: String) -> SensitivityLevel? { draft?.items.first { $0.key == key }?.level }

    /// Sets (or, with nil, clears) the level of one key. A note the server kept on the item stays.
    func setLevel(_ level: SensitivityLevel?, for key: String) {
        guard var d = draft else { return }
        let at = d.items.firstIndex { $0.key == key }
        switch (level, at) {
        case (let l?, let i?): d.items[i].level = l
        case (let l?, nil): d.items.append(SensitivityItem(key: key, level: l, note: nil))
        case (nil, let i?): d.items.remove(at: i)
        case (nil, nil): break
        }
        draft = d
    }

    func setNova(enabled: Bool, maxLevel: Int) {
        draft?.novaRule = NovaRule(enabled: enabled, maxLevel: min(4, max(1, maxLevel)))
    }

    /// Adds one of his own words (lowercased, like the server keeps it). Returns the reason when it was not added.
    func addFreeText(_ raw: String) -> String? {
        let word = raw.split(whereSeparator: \.isWhitespace).joined(separator: " ").lowercased()
        guard draft != nil else { return "Előbb be kell töltenem a szabályaidat" }
        guard !word.isEmpty else { return "Írd be, mit kerülsz" }
        guard word.count <= 60 else { return "Ez túl hosszú — rövidebben írd le" }
        if eu14Keys.contains(word) || EtelAllergenWords.names.values.contains(word) {
            return "Ez a 14 allergén között van — állítsd be fent a gombjánál"
        }
        guard !(draft?.items.contains { $0.key == word } ?? false) else { return "Ez már a listádon van" }
        draft?.items.append(SensitivityItem(key: word, level: .avoid, note: nil))
        return nil
    }

    /// Saves the draft. The sentence is for the owner; `dirty` is false afterwards only when the server took it.
    func save() async -> String {
        guard let draft else { return "Előbb be kell töltenem a szabályaidat — próbáld újra" }
        saving = true; defer { saving = false }
        do {
            saved = try await food.setSensitivity(draft)
            self.draft = saved
            return "Elmentettem — innentől ezek szerint jelzek."
        } catch FoodFetchError.offline { return "Nincs net — a változtatások itt maradnak, próbáld újra, amint van."
        } catch FoodFetchError.rejected { return "A szerver nem fogadta el ezt a listát — nézd át."
        } catch { return "Nem sikerült elmenteni — próbáld újra." }
    }
}

/// The lowercase Hungarian names of the EU-14 (so typing "tej" is pointed at the chip, not saved as free text).
private enum EtelAllergenWords {
    static let names: [String: String] = Dictionary(uniqueKeysWithValues: eu14Keys.map { ($0, allergenName($0).lowercased()) })
}

struct SensitivitySheet: View {
    let food: FoodClient?
    let onSaved: (SensitivityProfile, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editor: SensitivityEditor?
    @State private var picked: String?
    @State private var typed = ""
    @State private var message: String?
    @State private var confirming: String?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "BEÁLLÍTÁS", title: "Amit kerülök") {
            if let e = editor {
                content(e)
            } else {
                EtelCard { EtelProblem(text: "A szabályaidat most nem érem el.", detail: .unauthorized) }
            }
        }
        .confirmationDialog(confirming.map { "Kiveszed a(z) \(sensitivityName($0)) szót a listádról?" } ?? "",
                            isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }), titleVisibility: .visible) {
            Button("Kiveszem", role: .destructive) { if let key = confirming { editor?.setLevel(nil, for: key); confirming = nil } }
            Button("Mégse", role: .cancel) { confirming = nil }
        } message: {
            Text("Csak akkor számít, ha a Mentem gombbal elmented.")
        }
        .task {
            guard editor == nil, let food else { return }
            let e = SensitivityEditor(food: food)
            editor = e
            await e.load()
        }
    }

    @ViewBuilder private func content(_ e: SensitivityEditor) -> some View {
        if e.loading && e.draft == nil {
            EtelCard { Text("A szabályaid betöltése folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder) }
        } else if e.draft == nil {
            EtelCard {
                EtelProblem(text: "A szabályaidat most nem látom, ezért nem is írom át őket.", detail: e.problem, retry: { Task { await e.load() } })
            }
        } else {
            mine(e)
            novaCard(e)
            chips(e)
            ownWords(e)
            if let message { EtelNote(text: message) }
            NKPill(e.saving ? "Mentem…" : "Mentem", primary: e.dirty && !e.saving) {
                guard e.dirty, !e.saving else { return }
                Task {
                    let text = await e.save()
                    if e.dirty { message = text } else if let p = e.draft { onSaved(p, text); dismiss() }
                }
            }
            .disabled(!e.dirty || e.saving)
        }
    }

    // MARK: what is set

    @ViewBuilder private func mine(_ e: SensitivityEditor) -> some View {
        let items = e.draft?.items ?? []
        if items.isEmpty {
            EtelCard("MIT KERÜLSZ") {
                Text("Még nincs megadva semmi. Alább koppints egy allergénre, vagy írd be a sajátodat.").nkFont(14)
                    .foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        } else {
            ForEach(items, id: \.key) { item in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(sensitivityName(item.key)).nkFont(16, .medium).foregroundStyle(.white)
                        Spacer(minLength: 8)
                        Text(sensitivityLevelName(item.level)).nkFont(12.5, .semibold).foregroundStyle(NK.ground)
                            .padding(.horizontal, 11).padding(.vertical, 5).background(Capsule().fill(.white.opacity(0.9)))
                    }
                    Text(sensitivityLevelSentence(item.level, key: item.key)).nkFont(13.5).lineSpacing(2)
                        .foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                    if !eu14Keys.contains(item.key) {
                        Button { confirming = item.key } label: {
                            Text("Kiveszem").nkFont(13).foregroundStyle(.white.opacity(0.75))
                                .padding(.horizontal, 14).frame(minHeight: 34).background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
                .accessibilityElement(children: .contain)
            }
        }
    }

    // MARK: the processing-level rule

    private func novaCard(_ e: SensitivityEditor) -> some View {
        let rule = e.draft?.novaRule ?? NovaRule(enabled: false, maxLevel: 4)
        return EtelCard {
            Toggle(isOn: Binding(get: { rule.enabled }, set: { e.setNova(enabled: $0, maxLevel: rule.maxLevel) })) {
                Text("Feldolgozottsági szabály").nkFont(15, .medium).foregroundStyle(.white)
            }
            .tint(.white.opacity(0.4))
            Text(rule.enabled ? "Csak \(rule.maxLevel)-es szintig ajánlok ételt. Efölött egy halk sort írok, ha az viszi a tányért."
                              : "Kikapcsolva: a feldolgozottság miatt nem jelzek.")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            Slider(value: Binding(get: { Double(rule.maxLevel) }, set: { e.setNova(enabled: rule.enabled, maxLevel: Int($0.rounded())) }),
                   in: 1...4, step: 1)
                .tint(.white.opacity(0.8)).disabled(!rule.enabled)
                .accessibilityLabel("Legfeljebb ekkora feldolgozottsági szint").accessibilityValue("\(rule.maxLevel)")
            HStack {
                ForEach(1...4, id: \.self) { n in
                    Text("\(n)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    if n < 4 { Spacer() }
                }
            }
            .accessibilityHidden(true)
        }
    }

    // MARK: the 14 allergens

    private func chips(_ e: SensitivityEditor) -> some View {
        EtelCard("A 14 HIVATALOS ALLERGÉN") {
            Text("Koppints rá, és állítsd be: allergia, intolerancia vagy kerülöm.").nkFont(13).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], alignment: .leading, spacing: 8) {
                ForEach(eu14Keys, id: \.self) { key in
                    let level = e.level(for: key)
                    Button { picked = picked == key ? nil : key } label: {
                        VStack(spacing: 1) {
                            Text(sensitivityChip(key)).nkFont(13, level == nil ? .regular : .semibold).lineLimit(1).minimumScaleFactor(0.7)
                            if let level { Text(sensitivityLevelName(level).lowercased()).nkFont(10.5).lineLimit(1).minimumScaleFactor(0.7) }
                        }
                        .foregroundStyle(level == nil ? .white.opacity(0.85) : NK.ground)
                        .padding(.horizontal, 8).padding(.vertical, 8).frame(maxWidth: .infinity, minHeight: 42)
                        .background(Capsule().fill(level == nil ? .white.opacity(0.08) : .white.opacity(0.92)))
                        .overlay(Capsule().stroke(picked == key ? .white.opacity(0.9) : .clear, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(sensitivityChip(key))
                    .accessibilityValue(level.map(sensitivityLevelName) ?? "nincs megadva")
                }
            }
            if let key = picked { levelPicker(e, key) }
        }
    }

    private func levelPicker(_ e: SensitivityEditor, _ key: String) -> some View {
        let current = e.level(for: key)
        return VStack(alignment: .leading, spacing: 10) {
            Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
            Text(sensitivityChip(key)).nkFont(15, .medium).foregroundStyle(.white)
            EtelChoiceChips(options: [(id: "none", label: "Nincs")] + SensitivityLevel.allCases.map { (id: $0.rawValue, label: sensitivityLevelName($0)) },
                            selected: current?.rawValue ?? "none", minimum: 96) { id in
                e.setLevel(SensitivityLevel(rawValue: id), for: key)
            }
            if let current {
                Text(sensitivityLevelSentence(current, key: key)).nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: his own words

    private func ownWords(_ e: SensitivityEditor) -> some View {
        EtelCard("SAJÁT ÉRZÉKENYSÉG") {
            Text("Írhatsz olyat is, ami nincs a 14 között (pl. FODMAP). Ezeket név szerint keresem az összetevők között, ezért kevésbé pontos.")
                .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                TextField("", text: $typed, prompt: Text("pl. FODMAP").foregroundStyle(.white.opacity(0.4)))
                    .nkFont(16).foregroundStyle(.white).tint(.white).submitLabel(.done)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(.horizontal, 14).frame(minHeight: 46)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
                    .accessibilityLabel("Saját érzékenység")
                    .onSubmit { add(e) }
                Button { add(e) } label: {
                    Text("Felveszem").nkFont(14, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 16).frame(minHeight: 46).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func add(_ e: SensitivityEditor) {
        if let reason = e.addFreeText(typed) { message = reason } else { typed = ""; message = nil }
    }
}
