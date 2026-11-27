import SwiftUI
import UIKit
import BoopCore
import BoopDesign

/// Which dimension of which meal a sheet explains.
struct DimensionSelection: Identifiable {
    let entry: DimensionEntry
    let mealTitle: String
    let coachNote: String?
    var id: String { "\(mealTitle)-\(entry.id)" }
}

/// A logged meal: the owner's own photo on the card, the numbers, and all eight dimensions (owner decision 12) —
/// tapping one opens its own explanation. The coach's words and glucose tips come under them when they have arrived.
struct MealCard: View {
    let meal: BoopCore.Meal
    var slotLabel: String = ""
    /// The owner's photo; nil = none (the card is correct without it).
    var photo: UIImage? = nil
    var coach: MealCoach? = nil
    let onDimension: (DimensionSelection) -> Void

    private var title: String { mealTitle(meal, slotLabel: slotLabel) }

    private var timeText: String {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; f.locale = Locale(identifier: "hu_HU")
        return f.string(from: meal.loggedAt)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let photo { NKCardPhoto(Image(uiImage: photo), hue: .fuel) }
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Text("\(slotLabel.uppercased()) · \(timeText)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Spacer(minLength: 4)
                    if let points = mealPoints(meal) {
                        Text("\(points)").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium)).foregroundStyle(.white)
                        Text("/100").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    }
                }
                .accessibilityElement(children: .combine)
                Text(title).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                MealDetail(meal: meal, title: title, coach: coach, onDimension: onDimension)
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .nkGlass(22)
    }
}

/// What stands under a logged meal's name: its numbers, all eight dimensions (a tap explains one), the coach's
/// words and the glucose tips. The card and the Ma page's opened row both draw it.
struct MealDetail: View {
    let meal: BoopCore.Meal
    let title: String
    var coach: MealCoach? = nil
    let onDimension: (DimensionSelection) -> Void
    /// The meal's own page shows the numbers and the parts in cards of their own (`MealDetailPage`).
    var showNumbers = true
    var showParts = true

    /// The coach's sentence; before it arrives (or with the coach off), the envelope's own, if it has one.
    private var words: String? {
        [coach?.summary, coach?.tagline, meal.breakdown?.summary, meal.breakdown?.tagline].compactMap { $0 }.first { !$0.isEmpty }
    }

    private var tips: [GlucoseTip] { coach?.glucoseTips ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if showNumbers {
            Text("\(huInt(Int(meal.macros.kcal.rounded()))) kcal · F \(Int(meal.macros.p.rounded())) g · Sz \(Int(meal.macros.c.rounded())) g · Zs \(Int(meal.macros.f.rounded())) g")
                .nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(showParts ? recipePartGroups(meal) : [], id: \.recipeId) { group in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        NKGlyph("book-sage", .white.opacity(0.7), size: 13)
                        Text("\(group.name) receptből").nkFont(13, .medium).foregroundStyle(.white.opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityElement(children: .combine)
                    ForEach(Array(group.items.enumerated()), id: \.offset) { _, item in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(item.name).nkFont(13).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 6)
                            Text("\(huQuantity(item.amount, item.unit)) · \(huInt(Int(item.contribution.kcal.rounded()))) kcal")
                                .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                        }
                        .padding(.leading, 19)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            DimensionGrid(entries: dimensionRow(meal)) { entry in
                onDimension(DimensionSelection(entry: entry, mealTitle: title, coachNote: coach?.dimensionNotes[entry.id]))
            }
            if let words {
                Text(words).nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            }
            ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                HStack(alignment: .top, spacing: 8) {
                    NKGlyph("bolt-sun", .white.opacity(0.8), size: 14).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(tip.title).nkFont(13.5, .medium).foregroundStyle(.white.opacity(0.85))
                        Text(tip.body).nkFont(13.5).foregroundStyle(.white.opacity(0.7))
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

/// All eight dimensions, always: four across, two rows (two across at the narrowest widths, so no name is cut).
struct DimensionGrid: View {
    let entries: [DimensionEntry]
    let onTap: (DimensionEntry) -> Void
    @State private var width: CGFloat = 300

    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 8), count: width < 230 ? 2 : 4)
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(entries) { e in
                Button { onTap(e) } label: {
                    VStack(spacing: 5) {
                        Text(e.points.map(String.init) ?? "–").font(.custom(Lagy.outfitFamily, size: 17).weight(.medium))
                            .foregroundStyle(e.points == nil ? .white.opacity(0.45) : .white)
                        Capsule().fill(.white.opacity(0.1)).frame(height: 3)
                            .overlay(alignment: .leading) {
                                GeometryReader { g in
                                    Capsule().fill(Hue.fuel.glow.opacity(0.9)).frame(width: g.size.width * Double(e.points ?? 0) / 100)
                                }
                            }
                        Text(e.name).nkFont(9.5).foregroundStyle(.white.opacity(0.55)).lineLimit(2).minimumScaleFactor(0.7)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.vertical, 9).padding(.horizontal, 6).frame(maxWidth: .infinity)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.06)))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(e.name): \(e.points.map { "\($0) pont a százból" } ?? "nincs adat")")
                .accessibilityHint("Megnyitja a magyarázatát")
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }
}
