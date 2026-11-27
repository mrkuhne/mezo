import SwiftUI
import BoopCore
import BoopDesign

// A logged meal's own page (mezo-r36n9.184, spec §5.3): the photo head, the numbers, what it was made of, Boop's
// evaluation; Javítás · Törlés at the bottom. Javítás opens the composer pre-filled from this page; Törlés closes the
// page and the room takes the meal off with a few seconds of Visszavonás.

struct MealDetailPage: View {
    let store: EtelStore
    /// The meal as it was when the page opened; after a correction the page reads it again from the day by id.
    let initial: BoopCore.Meal
    let label: String
    /// The composer saved over the meal: the room reloads the day (the page shows the toast itself).
    let onSaved: () -> Void
    /// Törlés: the page is already closing; the room starts the deferred delete.
    let onDelete: (BoopCore.Meal, String) -> Void
    let onClose: () -> Void
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var composer: MealStart?
    /// The page is a full-screen cover: the room's sheets and toast cannot show over it, so it keeps its own.
    @State private var dimension: DimensionSelection?
    @State private var toast: String?
    private let hue = Hue.fuel

    private var meal: BoopCore.Meal { store.day?.meals.first { $0.id == initial.id } ?? initial }
    private var title: String { mealTitle(meal, slotLabel: label) }
    private var online: Bool { ritmus?.online ?? true }
    private var photo: Image? { store.photos[meal.id].map { Image(uiImage: $0) } }
    private var time: String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU"); return f.string(from: meal.loggedAt)
    }

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Étel", eyebrow: "\(label) · \(time)", title: title,
                      sentence: mealPoints(meal).map { "\($0) pont Boop értékelésében" } ?? "", photo: photo, onBack: onClose) {
            VStack(spacing: 16) {
                numbers
                if !meal.items.isEmpty { ingredients }
                evaluation
                Color.clear.frame(height: online ? 90 : 120)
            }
        }
        .overlay(alignment: .bottom) { actionBar }
        .sheet(item: Binding(get: { [c = composer] in c }, set: { composer = $0 })) { start in
            MealComposerSheet(start: start) { line in
                composer = nil
                if let line { toast = line }
                onSaved()
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
        .sheet(item: Binding(get: { [d = dimension] in d }, set: { dimension = $0 })) { d in
            DimensionSheet(selection: d)
        }
        .nkToast($toast)
    }

    private var numbers: some View {
        HStack(spacing: 0) {
            stat(huInt(Int(meal.macros.kcal.rounded())), "kcal", lit: false)
            stat("\(Int(meal.macros.p.rounded())) g", "fehérje", lit: true)
            stat("\(Int(meal.macros.c.rounded())) g", "szénhidrát", lit: false)
            stat("\(Int(meal.macros.f.rounded())) g", "zsír", lit: false)
        }
        .padding(.vertical, 16).padding(.horizontal, 8)
        .nkGlass(24)
    }

    private func stat(_ v: String, _ l: String, lit: Bool) -> some View {
        VStack(spacing: 3) {
            Text(v).font(.custom(Lagy.outfitFamily, size: 22, relativeTo: .title3).weight(.medium))
                .foregroundStyle(lit ? hue.glow : .white).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(l).nkFont(11.5).foregroundStyle(.white.opacity(0.6)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    /// What it was made of: the recipe parts under their recipe's name, then the foods logged on their own.
    private var ingredients: some View {
        let groups = recipePartGroups(meal)
        let loose = meal.items.filter { !($0.source == "pantry" && $0.recipeId != nil) }   // what the groups leave out
        return VStack(alignment: .leading, spacing: 10) {
            Text("MIBŐL ÁLLT").nkFont(11.5, .semibold, design: .monospaced).tracking(2).foregroundStyle(.white.opacity(0.6))
                .accessibilityAddTraits(.isHeader)
            ForEach(groups, id: \.recipeId) { group in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        NKGlyph("book-sage", .white.opacity(0.7), size: 13)
                        Text("\(group.name) receptből").nkFont(13.5, .medium).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                    ForEach(Array(group.items.enumerated()), id: \.offset) { _, item in itemRow(item).padding(.leading, 19) }
                }
            }
            ForEach(Array(loose.enumerated()), id: \.offset) { _, item in itemRow(item) }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
    }

    private func itemRow(_ item: MealItem) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(item.name).nkFont(14.5).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Text("\(huQuantity(item.amount, item.unit)) · \(huInt(Int(item.contribution.kcal.rounded()))) kcal")
                .nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.6))
        }
        .accessibilityElement(children: .combine)
    }

    private var evaluation: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                NKGlyph("star-sun", hue.glow, size: 16)
                Text("BOOP ÉRTÉKELÉSE").nkFont(11.5, .semibold, design: .monospaced).tracking(2).foregroundStyle(.white.opacity(0.6))
            }
            .accessibilityElement(children: .combine).accessibilityAddTraits(.isHeader)
            MealDetail(meal: meal, title: title, coach: store.coach[meal.id], onDimension: { dimension = $0 },
                       showNumbers: false, showParts: false)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(24)
    }

    private var actionBar: some View {
        VStack(spacing: 8) {
            if !online {
                Text(etelEditOfflineLine).nkFont(13).foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 10) {
                Button { composer = MealStart(entrance: .edit, editing: meal) } label: {
                    Label("Javítás", systemImage: "pencil").nkFont(15, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 50).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
                .accessibilityHint("Megnyitja a rögzítőt kitöltve, és erre az étkezésre ment")
                Button {
                    let m = meal, t = title
                    onClose()
                    onDelete(m, t)
                } label: {
                    Label("Törlés", systemImage: "trash").nkFont(15, .medium).foregroundStyle(Color(red: 1, green: 0.62, blue: 0.58))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))))
                }
                .buttonStyle(.plain)
                .accessibilityHint("Törli az étkezést; néhány másodpercig visszavonható")
            }
            .disabled(!online)
            .opacity(online ? 1 : 0.45)
        }
        .padding(.horizontal, 18).padding(.top, 12).padding(.bottom, 8)
        .background(LinearGradient(colors: [.clear, NK.ground.opacity(0.9)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

/// Correction and delete need the net in this slice (no outbox path for them).
let etelEditOfflineLine = "Javítani és törölni net kell — most nincs."
