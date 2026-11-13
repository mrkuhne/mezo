import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// Putting a food on the shelf (B4 Task 13, spike `Kamra` add chips): four routes — barcode, link, label photo, by hand —
// and ONE confirm every route ends in. What a route reads (a scanned product, a page, a label) is only ever a proposal:
// the owner sees the numbers, fills what is missing, and taps once. A route that cannot read says so and never invents.

/// The add flow's state and decisions, apart from any view.
@MainActor @Observable
final class PantryAddModel {
    enum Stage: Equatable { case route, reading, confirm }

    let route: PantryAddRoute
    /// The step the owner is on: an unknown barcode moves from the scan on to the label photo.
    private(set) var activeRoute: PantryAddRoute
    private(set) var stage: Stage
    var food: NewPantryFood
    private(set) var problem: String?
    /// The owner said "Jó így" to a reading that doubted itself.
    var looked = false
    private(set) var saving = false
    /// A barcode the owner scanned that nobody knew: it rides along with the label photo or the typed facts.
    private(set) var carriedCode: String?

    private let scraper: @Sendable (String) async throws -> NewPantryFood?
    private let labeler: @Sendable (Data) async throws -> NewPantryFood?
    private let saver: @Sendable (NewPantryFood) async throws -> PantryRow

    init(route: PantryAddRoute,
         scraper: @escaping @Sendable (String) async throws -> NewPantryFood?,
         labeler: @escaping @Sendable (Data) async throws -> NewPantryFood?,
         saver: @escaping @Sendable (NewPantryFood) async throws -> PantryRow) {
        self.route = route; self.activeRoute = route; self.scraper = scraper; self.labeler = labeler; self.saver = saver
        food = NewPantryFood(origin: .manual)
        stage = route == .manual ? .confirm : .route
    }

    convenience init(route: PantryAddRoute, food: FoodClient) {
        self.init(route: route, scraper: { try await food.scrapeFood(url: $0) }, labeler: { try await food.readLabel($0) },
                  saver: { try await food.addFood($0) })
    }

    /// Whether the confirm can save, and what holds it.
    var canSave: Bool { pantryAddReady(food) && (!pantryAddNeedsLook(food) || looked) && !saving }
    var needsLook: Bool { pantryAddNeedsLook(food) }
    var missingMacros: [String] { pantryAddMissing(food) }

    // MARK: routes

    /// A scanned or typed product the lookup found: straight to the confirm.
    func scanned(_ item: LookupItem) {
        food = NewPantryFood(scanned: item); looked = false; problem = nil; stage = .confirm
    }

    /// An unknown code goes on to the label photo, carrying the code.
    func carry(code: String, to next: PantryAddRoute) {
        carriedCode = code; activeRoute = next; problem = nil; stage = .route
    }

    /// An unknown code goes on with the owner's own words: the confirm opens empty, the code stays.
    func typeFacts(code: String?) {
        carriedCode = code
        var f = NewPantryFood(origin: .manual); f.barcode = code
        food = f; looked = false; problem = nil; stage = .confirm
    }

    func readLink(_ raw: String) async {
        let url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard url.lowercased().hasPrefix("http://") || url.lowercased().hasPrefix("https://"), url.count >= 12 else {
            problem = "Ez nem weboldal-cím — http:// vagy https:// kell az elejére."
            return
        }
        stage = .reading; problem = nil
        await read(nothing: "Az oldalon nem találtam tápérték-adatot. Próbálj másik oldalt, vagy fotózd le a címkét.") { try await self.scraper(url) }
    }

    /// The label photo, shrunk to what the server takes.
    func readLabel(_ data: Data?) async {
        guard let data, let jpeg = await Task.detached(operation: { MealPhoto.jpeg(from: data) }).value else {
            problem = "Ezt a képet nem tudtam megnyitni."
            return
        }
        stage = .reading; problem = nil
        await read(nothing: "A képen nem látok olvasható tápérték-táblát. Fotózd le élesebben, vagy vidd be kézzel.") { try await self.labeler(jpeg) }
    }

    private func read(nothing: String, _ work: () async throws -> NewPantryFood?) async {
        do {
            if var f = try await work() {
                if let code = carriedCode, f.barcode == nil { f.barcode = code }
                food = f; looked = false; stage = .confirm
            } else {
                stage = .route; problem = nothing
            }
        } catch FoodFetchError.offline {
            stage = .route; problem = "Nincs net — ehhez kell. Próbáld újra, ha van jel."
        } catch FoodFetchError.unavailable {
            stage = .route; problem = "Most nem tudom elolvasni — a szolgáltatás nem válaszolt. Próbáld újra, vagy vidd be kézzel."
        } catch FoodFetchError.rejected {
            stage = .route; problem = "Ezt nem tudom elolvasni. Próbálj másikat, vagy vidd be kézzel."
        } catch {
            stage = .route; problem = "Most nem sikerült. Próbáld újra."
        }
    }

    func back() { stage = .route; problem = nil }

    // MARK: the save

    /// The owner's tap. Returns the shelf row on success, nil with `problem` set when it did not go through.
    func save() async -> PantryRow? {
        guard canSave else { return nil }
        saving = true; problem = nil; defer { saving = false }
        do { return try await saver(food) }
        catch FoodFetchError.offline { problem = "Nincs net — a számok itt maradnak, próbáld újra, amint van." }
        catch FoodFetchError.rejected { problem = "A szerver nem fogadta el ezeket az adatokat. Nézd át a számokat." }
        catch FoodFetchError.unauthorized { problem = "Újra be kell jelentkezned, aztán mentsd újra." }
        catch { problem = "Nem sikerült felvenni — próbáld újra." }
        return nil
    }
}

// MARK: - The sheet

struct PantryAddSheet: View {
    let route: PantryAddRoute
    let profile: SensitivityProfile?
    let onSaved: (PantryRow) -> Void
    @Environment(\.foodClient) private var foodClient

    var body: some View {
        if let foodClient {
            PantryAddHost(route: route, food: foodClient, profile: profile, onSaved: onSaved)
        } else {
            NKSheetFrame(hue: .fuel, eyebrow: "KAMRA", title: "Most nem érem el") {
                Text("Jelentkezz be újra, és utána felvehetsz.").nkFont(15).foregroundStyle(.white.opacity(0.8))
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            }
        }
    }
}

private struct PantryAddHost: View {
    @State private var model: PantryAddModel
    @State private var scan: BarcodeScanModel
    @State private var url = ""
    @State private var showCamera = false
    @State private var showLibrary = false
    @FocusState private var typing: Bool
    let profile: SensitivityProfile?
    let onSaved: (PantryRow) -> Void
    @Environment(\.dismiss) private var dismiss

    init(route: PantryAddRoute, food: FoodClient, profile: SensitivityProfile?, onSaved: @escaping (PantryRow) -> Void) {
        _model = State(initialValue: PantryAddModel(route: route, food: food))
        _scan = State(initialValue: BarcodeScanModel(lookup: { code in try await food.lookup(barcode: code) }))
        self.profile = profile; self.onSaved = onSaved
    }

    private var title: String {
        switch model.stage {
        case .reading: "Egy pillanat"
        case .confirm: "Nézd át"
        case .route:
            switch model.activeRoute {
            case .barcode: "Vonalkód"
            case .link: "Link"
            case .label: "Címkefotó"
            case .manual: "Kézzel"
            }
        }
    }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "FELVESZEK EGYET", title: title) {
            switch model.stage {
            case .reading: reading
            case .confirm: PantryConfirm(model: model, profile: profile, onSaved: { onSaved($0) })
            case .route: routeView
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .mealPhotoLibrary(isPresented: $showLibrary) { data in Task { await model.readLabel(data) } }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(onPick: { data in showCamera = false; Task { await model.readLabel(data) } }, onCancel: { showCamera = false })
                .ignoresSafeArea()
        }
        .interactiveDismissDisabled(model.stage == .reading || model.saving)
    }

    @ViewBuilder private var routeView: some View {
        switch model.activeRoute {
        case .barcode:
            BarcodeScanView(model: scan, profile: profile,
                            onServing: { item, _, _ in model.scanned(item) },
                            onLabelPhoto: { code in model.carry(code: code, to: .label) },
                            onWords: { code in model.typeFacts(code: code) },
                            onBack: { dismiss() }, foundTitle: "Átnézem és felveszem")
        case .link:
            VStack(alignment: .leading, spacing: 14) {
                Text("Illeszd be egy termékoldal címét — kiolvasom belőle a tápértéket. A számokat te hagyod jóvá, mielőtt bármi a kamrádba kerülne.")
                    .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                TextField("", text: $url, prompt: Text("https://…").foregroundStyle(.white.opacity(0.45)), axis: .vertical)
                    .lineLimit(1...3).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .nkFont(15).foregroundStyle(.white).focused($typing).accessibilityLabel("A termékoldal címe")
                    .padding(.horizontal, 18).padding(.vertical, 14).background(Capsule().fill(.white.opacity(0.08)))
                    .overlay(Capsule().stroke(.white.opacity(0.12)))
                if let p = model.problem { problem(p) }
                primary("Kiolvasom", enabled: !url.trimmingCharacters(in: .whitespaces).isEmpty) { typing = false; Task { await model.readLink(url) } }
                secondary("Mégsem") { dismiss() }
            }
        case .label:
            VStack(alignment: .leading, spacing: 14) {
                Text("Fotózd le a termék tápérték-táblázatát — kiolvasom a számokat. Ha bizonytalan, szólok, és a döntés a tiéd.")
                    .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                if let p = model.problem { problem(p) }
                primary(PhotoCapture.cameraAvailable ? "Lefotózom a címkét" : "Kiválasztom a képet", enabled: true) {
                    if PhotoCapture.cameraAvailable { showCamera = true } else { showLibrary = true }
                }
                if PhotoCapture.cameraAvailable { secondary("Képet választok a képtárból") { showLibrary = true } }
                secondary("Mégsem") { dismiss() }
            }
        case .manual:
            EmptyView()
        }
    }

    private var reading: some View {
        HStack(spacing: 14) {
            ProgressView().tint(.white)
            Text(model.activeRoute == .link ? "Elolvasom az oldalt." : "Elolvasom a címkét.").nkFont(15).foregroundStyle(.white.opacity(0.85))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func problem(_ text: String) -> some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true).accessibilityLabel("Gond: \(text)")
    }

    private func primary(_ title: String, enabled: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(16, .semibold).foregroundStyle(NK.ground).frame(maxWidth: .infinity).frame(height: 50)
                .background(Capsule().fill(.white.opacity(enabled ? 0.95 : 0.3)))
        }
        .buttonStyle(.plain).disabled(!enabled)
    }

    private func secondary(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - The one confirm

/// What every route ends in: the food's name, its category and its facts per 100 g, all editable. Nothing is saved until
/// the owner taps; a macro left empty stays "nincs adat"; a reading that doubts itself must be looked at first.
private struct PantryConfirm: View {
    let model: PantryAddModel
    let profile: SensitivityProfile?
    let onSaved: (PantryRow) -> Void

    var body: some View {
        @Bindable var m = model
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 14) {
                field("Név", text: $m.food.name)
                field("Márka (nem kötelező)", text: Binding(get: { m.food.brand ?? "" }, set: { m.food.brand = $0.isEmpty ? nil : $0 }))
                HStack {
                    Text("Kategória").nkFont(14).foregroundStyle(.white.opacity(0.8))
                    Spacer(minLength: 6)
                    Picker("Kategória", selection: Binding(get: { m.food.category ?? "other" }, set: { m.food.category = $0 })) {
                        ForEach(NewPantryFood.categories, id: \.key) { Text($0.label).tag($0.key) }
                    }
                    .pickerStyle(.menu).tint(.white)
                }
                NKMono("A SZÁMOK 100 G-RA")
                number("Energia (kcal)", $m.food.kcal, required: true)
                number("Fehérje (g)", $m.food.proteinG)
                number("Szénhidrát (g)", $m.food.carbsG)
                number("Zsír (g)", $m.food.fatG)
                number("Rost (g)", $m.food.fiberG)
                number("Cukor (g)", $m.food.sugarG)
                number("Só (g)", $m.food.saltG)
                number("Telített zsír (g)", $m.food.saturatedFatG)
                HStack {
                    Text("NOVA").nkFont(14).foregroundStyle(.white.opacity(0.8))
                    Spacer(minLength: 6)
                    Picker("NOVA", selection: Binding(get: { m.food.nova ?? 0 }, set: { m.food.nova = $0 == 0 ? nil : $0 })) {
                        Text("nincs adat").tag(0)
                        ForEach(1...4, id: \.self) { Text("\($0)").tag($0) }
                    }
                    .pickerStyle(.menu).tint(.white)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            notes
            if let p = m.problem { Text(p).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true).accessibilityLabel("Gond: \(p)") }
            if m.needsLook {
                Button { m.looked.toggle() } label: {
                    HStack(spacing: 10) {
                        Image(systemName: m.looked ? "checkmark.circle.fill" : "circle").nkFont(18)
                        Text("Átnéztem a számokat — jó így").nkFont(14.5, .medium)
                    }
                    .foregroundStyle(.white).padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                    .background(Capsule().fill(.white.opacity(m.looked ? 0.2 : 0.1)))
                }
                .buttonStyle(.plain).accessibilityAddTraits(m.looked ? .isSelected : [])
            }
            Button { Task { if let row = await m.save() { onSaved(row) } } } label: {
                Text(m.saving ? "Felveszem…" : "Felveszem a kamrába").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity).frame(height: 50).background(Capsule().fill(.white.opacity(m.canSave ? 0.95 : 0.3)))
            }
            .buttonStyle(.plain).disabled(!m.canSave)
            if !m.canSave && !m.saving { Text(why(m)).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true) }
            if m.route != .manual {
                Button { m.back() } label: {
                    Text("Vissza").nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                        .background(Capsule().fill(.white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Why the button is grey, in one line.
    private func why(_ m: PantryAddModel) -> String {
        if m.food.name.trimmingCharacters(in: .whitespaces).isEmpty { return "Add meg a nevét." }
        if m.food.kcal == nil { return "Az energia (kcal) kell, hogy számolni tudjak vele." }
        if !pantryAddReady(m.food) { return "Valamelyik szám nem lehet negatív." }
        if m.needsLook && !m.looked { return "Ezt gép olvasta ki, és bizonytalan: nézd át a számokat, aztán jelöld meg fent." }
        return ""
    }

    @ViewBuilder private var notes: some View {
        let f = model.food
        VStack(alignment: .leading, spacing: 8) {
            if model.needsLook {
                Text("Ezt gép olvasta ki" + (f.confidence.map { " (\(Int(($0 * 100).rounded()))%-os biztonsággal)" } ?? "") + ", és bizonytalan. Nézd át a számokat a csomagoláson.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            }
            let missing = model.missingMacros
            if !missing.isEmpty && f.kcal != nil {
                Text("Hiányzik: \(missing.joined(separator: ", ")). Üresen hagyom, nem írok be nullát — a pontozás ezt \"nincs adat\"-nak veszi.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
            }
            let asRow = PantryRow(name: f.name, allergens: f.allergens)
            let lines = sensitivityLines(asRow, profile: profile)
            ForEach(lines, id: \.self) { Text($0).nkFont(13).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true) }
            if f.allergens.isEmpty && f.origin != .manual {
                Text("Ehhez nincs allergén-adat, ezért nem jelzek semmit — ez nem azt jelenti, hogy nincs benne.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
            if let code = f.barcode { Text("Vonalkód: \(code)").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.55)) }
        }
    }

    private func field(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
            TextField("", text: text).nkFont(16).foregroundStyle(.white).accessibilityLabel(label)
                .padding(.horizontal, 14).frame(minHeight: 44).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.08)))
        }
    }

    private func number(_ label: String, _ value: Binding<Double?>, required: Bool = false) -> some View {
        HStack(spacing: 10) {
            Text(label).nkFont(14).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 6)
            TextField("", value: value, format: .number, prompt: Text(required ? "kell" : "nincs adat").foregroundStyle(.white.opacity(0.35)))
                .keyboardType(.decimalPad).multilineTextAlignment(.trailing).nkFont(15, design: .monospaced).foregroundStyle(.white)
                .frame(width: 96).padding(.vertical, 6).padding(.horizontal, 10).background(Capsule().fill(.white.opacity(0.1)))
                .accessibilityLabel(label)
        }
    }
}
