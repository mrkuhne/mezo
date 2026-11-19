import SwiftUI
import BoopCore
import BoopDesign

// The small faces the Receptek and Kamra pages are drawn from (mezo-r36n9.101): a food's own score as a ring, its
// facts as pills, its macros as four tiles, its NOVA level as a scale, and one row per watched allergen. Each says
// one thing, so a row reads as parts and not as a sentence.

// MARK: - The score

/// A food's own score, 0…100, as a ring that fills in the area's hue. nil = no score: a quiet "–", never a 0.
struct EtelScoreRing: View {
    let points: Int?
    var size: CGFloat = 40
    private let hue = Hue.fuel

    var body: some View {
        let width = max(2.5, size * 0.085)
        ZStack {
            Circle().stroke(.white.opacity(0.12), lineWidth: width)
            if let points {
                Circle().trim(from: 0, to: min(1, max(0.02, Double(points) / 100)))
                    .stroke(hue.glow, style: StrokeStyle(lineWidth: width, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(points)").font(.custom(Lagy.outfitFamily, size: size * 0.4).weight(.medium))
                    .foregroundStyle(.white).monospacedDigit()
            } else {
                Text("–").font(.custom(Lagy.outfitFamily, size: size * 0.4).weight(.medium)).foregroundStyle(.white.opacity(0.4))
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel(points.map { "\($0) pont a százból" } ?? "nincs pontszám")
    }
}

/// 0…1 from the server as whole points; nil stays nil.
func etelPoints(_ value: Double?) -> Int? { value.map { Int(($0 * 100).rounded()) } }

// MARK: - Pills

/// One fact as a capsule. `.plain` is a neutral fact, `.hue` a good one worth seeing, `.warn` and `.stop` the two
/// strengths of a sensitivity flag, `.outline` a processed-food flag, `.muted` a gap ("nincs adat").
struct EtelPill: View {
    enum Tone: Equatable { case plain, hue, warn, stop, outline, muted }
    let text: String
    var glyph: String? = nil
    var tone: Tone = .plain
    private let amber = Color(red: 0.96, green: 0.78, blue: 0.38)

    private var ink: Color {
        switch tone {
        case .plain: .white.opacity(0.85)
        case .hue: Hue.fuel.glow
        case .warn, .outline: amber
        case .stop: NK.ground
        case .muted: .white.opacity(0.5)
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            if let glyph { NKGlyph(glyph, ink, size: 11) }
            Text(text).nkFont(11.5, .medium).foregroundStyle(ink).lineLimit(1)
        }
        .padding(.horizontal, 9).frame(minHeight: 24)
        .background {
            switch tone {
            case .plain: Capsule().fill(.white.opacity(0.09))
            case .hue: Capsule().fill(Hue.fuel.glow.opacity(0.15))
            case .warn: Capsule().fill(amber.opacity(0.16))
            case .stop: Capsule().fill(.white.opacity(0.92))
            case .outline: Capsule().stroke(amber.opacity(0.55), lineWidth: 1)
            case .muted: Capsule().stroke(.white.opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
            }
        }
        .fixedSize()
    }
}

extension EtelPill {
    /// A sensitivity or processed badge as a pill.
    init(badge: DraftBadge) {
        let tone: Tone = switch badge.tone { case .stop: .stop; case .warn: .warn; case .notice: .plain; case .processed: .outline }
        self.init(text: badge.text, glyph: badge.tone == .processed ? nil : "leaf-sage", tone: tone)
    }
}

// MARK: - Macros

/// Energy and the three macros as four tiles, with what they are measured for underneath.
struct EtelMacroTiles: View {
    let kcal: Double?, p: Double?, c: Double?, f: Double?

    var body: some View {
        HStack(spacing: 8) {
            tile(kcal.map { huInt(Int($0.rounded())) }, "kcal", "energia", lit: true)
            tile(p.map(grams), "g", "fehérje")
            tile(c.map(grams), "g", "szénhidrát")
            tile(f.map(grams), "g", "zsír")
        }
    }

    private func grams(_ v: Double) -> String {
        v >= 10 || v == v.rounded() ? "\(Int(v.rounded()))" : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",")
    }

    private func tile(_ value: String?, _ unit: String, _ label: String, lit: Bool = false) -> some View {
        VStack(spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value ?? "–").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium))
                    .foregroundStyle(value == nil ? .white.opacity(0.4) : (lit ? Hue.fuel.glow : .white)).monospacedDigit()
                    .lineLimit(1).minimumScaleFactor(0.7)
                if value != nil { Text(unit).nkFont(10.5).foregroundStyle(.white.opacity(0.5)) }
            }
            Text(label).nkFont(10.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.06)))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value.map { "\($0) \(unit)" } ?? "nincs adat")")
    }
}

// MARK: - NOVA

/// The four NOVA levels as a scale with the food's own lit, and the level in words. nil = never classified.
struct EtelNovaScale: View {
    let nova: Int?
    /// The owner's own limit, when he set one: levels above it read as over.
    var limit: Int? = nil
    private let amber = Color(red: 0.96, green: 0.78, blue: 0.38)
    private static let words = [1: "Feldolgozatlan", 2: "Kevéssé feldolgozott", 3: "Feldolgozott", 4: "Ultra-feldolgozott"]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 5) {
                ForEach(1...4, id: \.self) { level in
                    VStack(spacing: 5) {
                        Capsule().fill(color(level)).frame(height: 6)
                        Text("\(level)").nkFont(10.5, design: .monospaced).foregroundStyle(.white.opacity(level == nova ? 0.9 : 0.4))
                    }
                }
            }
            HStack(spacing: 8) {
                Text(nova.flatMap { Self.words[$0] } ?? "Nincs besorolás").nkFont(15, .medium)
                    .foregroundStyle(.white.opacity(nova == nil ? 0.55 : 0.95))
                if let nova, let limit, nova > limit { EtelPill(text: "a határod fölött", tone: .warn) }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(nova.map { "NOVA \($0), \(Self.words[$0] ?? "")" } ?? "NOVA nincs besorolás")
    }

    private func color(_ level: Int) -> Color {
        guard let nova, level <= nova else { return .white.opacity(0.1) }
        return nova >= 3 ? amber.opacity(nova == 4 ? 0.95 : 0.7) : Hue.fuel.glow.opacity(0.85)
    }
}

// MARK: - Sensitivity

/// What a food or recipe says about one allergen the owner watches.
struct EtelAllergenFact: Identifiable, Equatable {
    enum State: Equatable { case contains, traces, noData }
    let name: String
    let state: State
    var id: String { name }
}

/// One fact per watched allergen, in the owner's order. A key the food does not carry is `.noData` — never "free of".
func etelAllergenFacts(_ allergens: [String: AllergenState], profile: SensitivityProfile?) -> [EtelAllergenFact] {
    guard let profile else { return [] }
    return profile.items.filter(\.isStructured).map { item in
        let key = item.key.lowercased()
        let state: EtelAllergenFact.State = switch allergens[key] {
        case .contains?: .contains
        case .traces?: .traces
        case .unknown?, nil: .noData
        }
        return EtelAllergenFact(name: allergenName(key), state: state)
    }
}

/// The watched allergens as rows: the name on the left, its state as a pill on the right.
struct EtelAllergenRows: View {
    let facts: [EtelAllergenFact]

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(facts.enumerated()), id: \.element.id) { k, f in
                if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                HStack(spacing: 10) {
                    NKGlyph("leaf-sage", .white.opacity(f.state == .noData ? 0.4 : 0.85), size: 15)
                    Text(f.name).nkFont(14.5).foregroundStyle(.white.opacity(0.9))
                    Spacer(minLength: 8)
                    switch f.state {
                    case .contains: EtelPill(text: "tartalmazza", tone: .stop)
                    case .traces: EtelPill(text: "nyomokban", tone: .warn)
                    case .noData: EtelPill(text: "nincs adat", tone: .muted)
                    }
                }
                .padding(.vertical, 9)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: - Glyphs

/// The mark a pantry category wears (the kit's own glyph family; anything unknown gets the plate).
func etelCategoryGlyph(_ key: String?) -> String {
    switch key {
    case "vegetables", "fruits", "legumes": "leaf-sage"
    case "meat": "flame-peach"
    case "fish": "fish-peach"
    case "eggs": "sun-sun"
    case "dairy", "cheese", "beverages", "oils_fats": "drop-sky"
    case "grains", "pasta", "bakery": "bowl-cream"
    case "nuts_seeds", "condiments": "spark-cream"
    case "snacks": "honey-sun"
    default: "plate-deep"
    }
}

/// A glyph on a soft disc — the medallion of a row whose thing has no photo.
struct EtelMedallion: View {
    let glyph: String
    var size: CGFloat = 44
    var lit: Bool = false

    var body: some View {
        ZStack {
            Circle().fill(lit ? Hue.fuel.glow.opacity(0.18) : .white.opacity(0.08))
            NKGlyph(glyph, lit ? Hue.fuel.glow : .white.opacity(0.9), size: size * 0.4)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - A card inside a sheet

/// A labelled glass card of a detail sheet: a hue tick and a mono label, an optional note opposite, then the content.
struct EtelSheetCard<Content: View>: View {
    let label: String
    var trailing: String? = nil
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(Hue.fuel.glow).frame(width: 3, height: 13)
                NKMono(label)
                Spacer(minLength: 8)
                if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.5)) }
            }
            content
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}

/// A search field as a capsule (the Receptek and Kamra lists share it).
struct EtelSearchField: View {
    @Binding var query: String
    let prompt: String

    var body: some View {
        HStack(spacing: 10) {
            NKGlyph("search-ink", .white.opacity(0.6), size: 16)
            TextField("", text: $query, prompt: Text(prompt).foregroundStyle(.white.opacity(0.45)))
                .nkFont(15).foregroundStyle(.white).submitLabel(.search).accessibilityLabel(prompt)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Text("Törlés").nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.6)).frame(minHeight: 34)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16).frame(minHeight: 46)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
    }
}

/// A row of filter chips that scrolls sideways; the selected one is white.
struct EtelFilterChips: View {
    let chips: [(key: String?, label: String)]
    @Binding var selected: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(chips.enumerated()), id: \.offset) { _, c in
                    let on = selected == c.key
                    Button { selected = on ? nil : c.key } label: {
                        Text(c.label).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                            .padding(.horizontal, 12).frame(minHeight: 34)
                            .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(.vertical, 2)
        }
    }
}
