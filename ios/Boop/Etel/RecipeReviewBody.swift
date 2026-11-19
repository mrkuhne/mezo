import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// The review every recipe route ends in (a link, pasted text, a photo, the workshop, „Ezt főztem" — mezo-r36n9.63):
// name and servings, then one tile per ingredient with its three faces — megvan · erősítsd meg · nincs a kamrában —
// and the two exits. The view draws `reviewRowFace`; every decision is the model's.

// MARK: - Small shared controls

/// A minus / value / plus capsule (the composer's amount row): the value is typeable, the unit a fixed label.
struct EtelStepper: View {
    let value: Double
    let unit: String
    let step: Double
    let label: String
    let onChange: (Double) -> Void

    var body: some View {
        HStack(spacing: 0) {
            button("−", "\(label): kevesebb") { onChange(value - step) }
            HStack(spacing: 4) {
                TextField("", value: Binding(get: { value }, set: { onChange($0) }), format: .number)
                    .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    .font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white)
                    .frame(width: 56).accessibilityLabel(label)
                Text(unit).nkFont(13).foregroundStyle(.white.opacity(0.6)).frame(minWidth: 26, alignment: .leading).lineLimit(1)
            }
            .padding(.horizontal, 4)
            button("+", "\(label): több") { onChange(value + step) }
        }
        .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))))
    }

    private func button(_ sign: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(sign).font(.custom(Lagy.outfitFamily, size: 20).weight(.medium)).foregroundStyle(.white)
                .frame(width: 40, height: 40).contentShape(Rectangle())
        }
        .buttonStyle(.plain).accessibilityLabel(label)
    }
}

/// The primary action of an Étel sheet: a white-to-hue capsule; grey while it cannot be used.
struct EtelPrimaryButton: View {
    let title: String
    var glyph: String? = nil
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let glyph { NKGlyph(glyph, NK.ground, size: 16) }
                Text(title).nkFont(16, .semibold).foregroundStyle(NK.ground).lineLimit(1).minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 14).frame(maxWidth: .infinity).frame(height: 52)
            .background(Capsule().fill(enabled
                ? AnyShapeStyle(LinearGradient(colors: [.white, Hue.fuel.glow.opacity(0.9)], startPoint: .leading, endPoint: .trailing))
                : AnyShapeStyle(.white.opacity(0.25))))
        }
        .buttonStyle(.plain).disabled(!enabled)
    }
}

/// The second action under it: an outlined capsule of the same height.
struct EtelSecondaryButton: View {
    let title: String
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).nkFont(15, .medium).foregroundStyle(.white.opacity(enabled ? 0.95 : 0.4)).lineLimit(1).minimumScaleFactor(0.8)
                .padding(.horizontal, 14).frame(maxWidth: .infinity).frame(height: 50)
                .background(Capsule().fill(.white.opacity(enabled ? 0.1 : 0.05)).overlay(Capsule().stroke(.white.opacity(enabled ? 0.18 : 0.08))))
        }
        .buttonStyle(.plain).disabled(!enabled)
    }
}

// MARK: - The pantry form over the review

extension View {
    /// The pantry form a review row can open (a name the quick add may not bind; „Minden adat a kamrában"), presented
    /// at the sheet's own level — the host attaches this to its frame and the flag is read here (boop-ios.md §9).
    func reviewFoodForm(_ model: RecipeImportModel?, profile: SensitivityProfile?) -> some View {
        modifier(ReviewFoodFormSheet(model: model, profile: profile))
    }
}

private struct ReviewFoodFormSheet: ViewModifier {
    let model: RecipeImportModel?
    let profile: SensitivityProfile?

    func body(content: Content) -> some View {
        content.sheet(item: Binding(get: { [form = model?.foodForm] in form }, set: { model?.foodForm = $0 })) { form in
            Group {
                switch form {
                case .add(let line, let name):
                    PantryAddSheet(route: .manual, profile: profile, prefillName: name) { row in model?.formAdded(line, row: row) }
                case .replace(let line, let row):
                    PantryAddSheet(route: .manual, profile: profile, replacing: row) { saved in model?.formReplaced(line, row: saved) }
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }
}

// MARK: - The review

/// The reviewed draft: name, servings, the ingredient tiles with their faces, the weight and the two exits.
struct ReviewBody: View {
    @Bindable var model: RecipeImportModel
    var profile: SensitivityProfile? = nil
    let onSaved: (Recipe) -> Void
    /// „Mentem, és rögzítem mára": saved, and one serving goes into today. nil hides the button.
    var onSavedLog: ((Recipe) -> Void)? = nil
    /// The row whose „Másik" list is open, and the row whose facts are open for typing.
    @State private var picking: UUID?
    @State private var editing: UUID?
    @State private var facts = FoodFacts(kcal: 0, proteinG: 0, carbsG: 0, fatG: 0)
    @FocusState private var typing: Bool

    private let amber = Color(red: 0.96, green: 0.78, blue: 0.38)
    private let categories: [(key: String, label: String)] = [("breakfast", "Reggeli"), ("lunch", "Ebéd"), ("dinner", "Vacsora"), ("snack", "Nasi")]

    var body: some View {
        if let review = model.review {
            VStack(spacing: 12) {
                headCard(review)
                ingredientsCard(review)
                allergenCard(review)
                weightCard(review)
                leftOutCard(review)
                if let blocker = review.saveBlocker {
                    Text(blocker).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                }
                if let problem = model.saveProblem {
                    Text(problem).nkFont(13.5).foregroundStyle(Color(hex: 0xF7A8C4)).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
                }
                let open = review.canSave && !model.saving
                EtelPrimaryButton(title: model.saving ? "Mentem…" : "Mentem a receptjeim közé", glyph: "check-ink", enabled: open) {
                    typing = false
                    Task { if let recipe = await model.save() { onSaved(recipe) } }
                }
                if let onSavedLog {
                    EtelSecondaryButton(title: "Mentem, és rögzítem mára", enabled: open) {
                        typing = false
                        Task { if let recipe = await model.save() { onSavedLog(recipe) } }
                    }
                }
            }
            #if DEBUG
            .task { await debugOpen() }
            #endif
        }
    }

    #if DEBUG
    /// Review hook `-etelReview other|added|facts`: opens the „Másik" list of the first doubtful row / adds the first
    /// missing row / opens its facts — states that otherwise need a tap.
    private func debugOpen() async {
        guard let which = UserDefaults.standard.string(forKey: "etelReview"), let review = model.review else { return }
        try? await Task.sleep(for: .milliseconds(300))
        switch which {
        case "other": picking = review.lines.first { $0.awaitsConfirmation }?.id
        case "added", "facts":
            guard let id = review.lines.first(where: { !$0.isMatched })?.id else { return }
            await model.quickAdd(id)
            if which == "facts" { openFacts(id) }
        default: break
        }
    }
    #endif

    // MARK: head

    private func headCard(_ review: RecipeReview) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            TextField("", text: Binding(get: { review.name }, set: { model.review?.name = $0 }), prompt: Text("A recept neve").foregroundStyle(.white.opacity(0.4)),
                      axis: .vertical)
                .lineLimit(1...3).nkFont(22, design: .serif).foregroundStyle(.white).focused($typing).accessibilityLabel("A recept neve")
            Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
            HStack(spacing: 10) {
                Text("Adag").nkFont(13).foregroundStyle(.white.opacity(0.6))
                Spacer(minLength: 6)
                EtelStepper(value: Double(review.servings), unit: "adag", step: 1, label: "Adagok száma") { v in
                    model.review?.servings = min(12, max(1, Int(v.rounded())))
                }
            }
            HStack(spacing: 10) {
                Text("Étkezés").nkFont(13).foregroundStyle(.white.opacity(0.6))
                Spacer(minLength: 6)
                Menu {
                    ForEach(categories, id: \.key) { c in Button(c.label) { model.review?.category = c.key } }
                } label: {
                    HStack(spacing: 6) {
                        Text(categories.first { $0.key == review.category }?.label ?? "Ebéd").nkFont(14, .medium).foregroundStyle(.white.opacity(0.9))
                        Image(systemName: "chevron.up.chevron.down").font(.system(size: 10, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(.horizontal, 14).frame(minHeight: 40)
                    .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))))
                }
                .accessibilityLabel("Étkezés típusa")
            }
            if let url = review.sourceUrl {
                HStack(spacing: 8) {
                    NKGlyph("link-deep", .white.opacity(0.55), size: 14)
                    Text(url).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1).truncationMode(.middle)
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    // MARK: ingredients

    private func ingredientsCard(_ review: RecipeReview) -> some View {
        EtelSheetCard(label: "HOZZÁVALÓK", trailing: review.steps.isEmpty ? nil : "\(review.steps.count) lépés") {
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                ForEach(reviewSummaryPills(review)) { EtelPill(text: $0.text, glyph: $0.glyph, tone: $0.tone) }
            }
            if review.confirmableCount > 1 {
                Button { model.confirmAll(); picking = nil } label: {
                    HStack(spacing: 7) {
                        NKGlyph("check-ink", NK.ground, size: 13)
                        Text("Mind rendben").nkFont(13.5, .semibold).foregroundStyle(NK.ground)
                    }
                    .padding(.horizontal, 16).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain).accessibilityHint("Minden megerősítésre váró hozzávalót jóváhagy")
            }
            VStack(spacing: 10) {
                ForEach(review.lines) { tile($0) }
            }
            if let note = review.leftOutNote {
                Text(note).nkFont(13).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// One ingredient = one tile with clear rows: what it is and what he said; its facts as pills; how much (the unit is
    /// the food's own once it has a food); what he can do. A row that needs his look wears the amber border.
    private func tile(_ l: ReviewLine) -> some View {
        let face = reviewRowFace(l)
        let badges = reviewLineBadges(l, profile: profile)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                dot(face.dot)
                VStack(alignment: .leading, spacing: 4) {
                    Text(l.line.name).nkFont(16, .medium).foregroundStyle(.white.opacity(l.removed ? 0.45 : 1)).strikethrough(l.removed)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    if let said = face.said {
                        Text("„\(said)”").nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
            }
            if !face.pills.isEmpty || !badges.isEmpty {
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    ForEach(face.pills) { EtelPill(text: $0.text, glyph: $0.glyph, tone: $0.tone) }
                    ForEach(badges) { EtelPill(badge: $0) }
                }
            }
            if !l.removed {
                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                HStack(spacing: 10) {
                    Text("Mennyiség").nkFont(13).foregroundStyle(.white.opacity(0.6))
                    Spacer(minLength: 6)
                    EtelStepper(value: l.line.amount, unit: face.unit, step: ["g", "ml"].contains(face.unit.lowercased()) ? 10 : 0.5,
                                label: "\(l.line.name) mennyisége") { model.setAmount(l.id, $0) }
                }
            }
            actions(l, face)
            if let problem = model.addProblems[l.id] {
                Text(problem).nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            }
            if let link = face.factsLink {
                if editing == l.id { factsBlock(l) } else {
                    Button { openFacts(l.id) } label: {
                        Text(link).nkFont(13, .medium).foregroundStyle(.white.opacity(0.8)).underline(true, color: .white.opacity(0.3))
                            .frame(minHeight: 32).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            if picking == l.id && !l.removed {
                ReviewOtherPicker(alternatives: l.line.alternatives.filter { $0.id != l.line.catalogId },
                                  search: { try await model.search($0) },
                                  onChoice: { model.relink(l.id, to: $0); close(l.id) },
                                  onRow: { model.relink(l.id, to: $0); close(l.id) })
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(l.removed ? 0.025 : 0.05)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(face.needsLook ? amber.opacity(0.5) : .white.opacity(0.1)))
    }

    private func close(_ id: UUID) {
        picking = nil
        if editing == id { editing = nil }
    }

    /// The state of the row at a glance: a tick (it is in), an amber question (look at it), a plus (not in the pantry).
    private func dot(_ d: ReviewRowFace.Dot) -> some View {
        ZStack {
            switch d {
            case .done:
                Circle().fill(.white.opacity(0.92))
                NKGlyph("check-ink", NK.ground, size: 15)
            case .ask:
                Circle().fill(amber.opacity(0.18))
                Text("?").font(.custom(Lagy.outfitFamily, size: 18).weight(.semibold)).foregroundStyle(amber)
            case .add:
                Circle().stroke(.white.opacity(0.28), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                NKGlyph("plus-ink", .white.opacity(0.8), size: 14)
            case .off:
                Circle().fill(.white.opacity(0.05))
            }
        }
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func actions(_ l: ReviewLine, _ face: ReviewRowFace) -> some View {
        NKFlowRow(spacing: 8, rowSpacing: 8) {
            ForEach(Array(face.actions.enumerated()), id: \.offset) { _, a in
                switch a {
                case .confirm:
                    solid("Ez az", glyph: "check-ink", label: "\(l.line.name): ez az") { model.confirm(l.id); if picking == l.id { picking = nil } }
                case .quickAdd:
                    let busy = model.adding.contains(l.id)
                    let failed = model.addProblems[l.id] != nil
                    Button { Task { await model.quickAdd(l.id) } } label: {
                        HStack(spacing: 7) {
                            if busy { ProgressView().controlSize(.small).tint(NK.ground) } else { NKGlyph("plus-ink", NK.ground, size: 13) }
                            Text(busy ? "Felveszem…" : failed ? "Újra" : "Kamrába").nkFont(13.5, .semibold).foregroundStyle(NK.ground)
                        }
                        .padding(.horizontal, 14).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain).disabled(busy).accessibilityLabel("\(l.line.name) felvétele a kamrába")
                case .other:
                    outline(picking == l.id ? "Bezárom" : "Másik", label: "\(l.line.name): másik ételt választok") {
                        picking = picking == l.id ? nil : l.id
                    }
                case .remove:
                    outline("Kiveszem", quiet: true, label: "\(l.line.name) kivétele") { model.remove(l.id); close(l.id) }
                case .restore:
                    outline("Visszateszem", label: "\(l.line.name) visszatétele") { model.restore(l.id) }
                }
            }
        }
    }

    private func solid(_ title: String, glyph: String? = nil, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let glyph { NKGlyph(glyph, NK.ground, size: 13) }
                Text(title).nkFont(13.5, .semibold).foregroundStyle(NK.ground)
            }
            .padding(.horizontal, 14).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
        }
        .buttonStyle(.plain).accessibilityLabel(label)
    }

    private func outline(_ title: String, quiet: Bool = false, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13.5, .medium).foregroundStyle(.white.opacity(quiet ? 0.65 : 0.9))
                .padding(.horizontal, 14).frame(minHeight: 38)
                .background(Capsule().fill(.white.opacity(quiet ? 0 : 0.08)).overlay(Capsule().stroke(.white.opacity(quiet ? 0.2 : 0.16))))
        }
        .buttonStyle(.plain).accessibilityLabel(label)
    }

    // MARK: the facts of a food added from this screen

    private func openFacts(_ id: UUID) {
        guard let now = model.facts(of: id) else { return }
        facts = now; editing = id; picking = nil
    }

    /// kcal and the three macros on the food's own basis, prefilled with what the food has now. Typing any of them makes
    /// it his own data; nothing here is shown on the row itself.
    private func factsBlock(_ l: ReviewLine) -> some View {
        let row = model.added[l.id]
        let basis = (row?.unit ?? "g").lowercased() == "ml" ? "ML-BEN" : "G-BAN"
        let busy = model.savingFacts.contains(l.id)
        return VStack(alignment: .leading, spacing: 12) {
            NKMono("TÁPÉRTÉK · \(huNumber(row?.per ?? 100)) \(basis)")
            HStack(spacing: 8) {
                fact("kcal", $facts.kcal); fact("fehérje", $facts.proteinG); fact("szénh.", $facts.carbsG); fact("zsír", $facts.fatG)
            }
            Text(l.ownFacts ? "A saját adatod áll a kamrában." : "Ezt Boop becsülte. Írd át, ha a csomagoláson más áll.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            if let problem = model.factsProblems[l.id] {
                Text(problem).nkFont(12.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            }
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                solid(busy ? "Mentem…" : "Kész", label: "A tápérték kész") {
                    typing = false
                    Task { if await model.saveFacts(l.id, facts) { editing = nil } }
                }
                outline("Minden adat a kamrában", quiet: true, label: "\(l.line.name) minden adata a kamrában") {
                    if let row { model.foodForm = .replace(line: l.id, row: row) }
                }
            }
            .disabled(busy)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
    }

    private func fact(_ label: String, _ value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).nkFont(11).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
            TextField("", value: value, format: .number).keyboardType(.decimalPad).focused($typing)
                .font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white)
                .padding(.vertical, 9).padding(.horizontal, 8).frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.1)))
                .accessibilityLabel(label)
        }
    }

    // MARK: allergens, the left-out share, the weight

    /// What the owner's rules find in the draft, before he saves; rows with no allergen data say so, never "free of".
    @ViewBuilder private func allergenCard(_ review: RecipeReview) -> some View {
        let warnings = reviewAllergenWarnings(review, profile: profile)
        let silent = reviewNoDataLines(review, profile: profile)
        if !warnings.isEmpty || !silent.isEmpty {
            EtelSheetCard(label: "ALLERGÉNEK") {
                ForEach(warnings) { w in
                    VStack(alignment: .leading, spacing: 6) {
                        EtelPill(text: w.text, glyph: "leaf-sage", tone: w.severity == .block ? .stop : (w.severity == .warn ? .warn : .plain))
                        Text(w.lineNames.joined(separator: ", ")).nkFont(13.5).foregroundStyle(.white.opacity(0.8))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if !warnings.isEmpty {
                    Text("Tedd bele, cseréld, vagy hagyd ki — a recept így is elmentődik.").nkFont(13).foregroundStyle(.white.opacity(0.7))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !silent.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        EtelPill(text: "nincs allergén-adat", tone: .muted)
                        Text("\(silent.joined(separator: ", ")). Ez nem azt jelenti, hogy nincs benne semmi — csak nem tudom.")
                            .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    /// A large share of the rows is not in the recipe: say so plainly and make the owner own it.
    @ViewBuilder private func leftOutCard(_ review: RecipeReview) -> some View {
        if let warning = review.leftOutWarning {
            VStack(alignment: .leading, spacing: 10) {
                Text(warning).nkFont(14, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Button { model.acknowledgeLeftOut(!review.leftOutAcknowledged) } label: {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle().stroke(.white.opacity(0.5), lineWidth: 1.5)
                            if review.leftOutAcknowledged {
                                Circle().fill(.white.opacity(0.92))
                                NKGlyph("check-ink", NK.ground, size: 11)
                            }
                        }
                        .frame(width: 22, height: 22)
                        Text("Tudom, így is mentem").nkFont(14, .medium)
                    }
                    .foregroundStyle(.white.opacity(review.leftOutAcknowledged ? 1 : 0.8)).frame(minHeight: 44)
                }
                .buttonStyle(.plain).accessibilityAddTraits(review.leftOutAcknowledged ? .isSelected : [])
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(amber.opacity(review.leftOutAcknowledged ? 0 : 0.45)))
        }
    }

    private func weightCard(_ review: RecipeReview) -> some View {
        EtelSheetCard(label: "ELKÉSZÜLT SÚLY") {
            if review.cookedWeightIsEstimate {
                Text("Nyersen \(huInt(Int(review.rawWeightG.rounded()))) g. Amit nem lehet grammban mérni (darab, csokor), az nincs benne.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("A forrás szerint az elkészült étel \(huInt(Int(review.cookedWeightG.rounded()))) g.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
