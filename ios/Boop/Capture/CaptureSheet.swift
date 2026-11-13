import SwiftUI
import BoopDesign

/// What a tap on the "+" sheet asks for: one of the daily loop's covers, or a "hamarosan" toast naming the item.
enum CapturePick: Equatable {
    case cover(RitmusCover)
    case soon(String)
    /// The meal composer, at an entrance (the "+" sheet's food chips and its free-text line).
    case meal(MealStart.Entrance, text: String)

    /// What the shell opens for a pick: the composer's start (nil for the covers and the "hamarosan" items).
    var mealStart: MealStart? {
        if case .meal(let entrance, let text) = self { MealStart(entrance: entrance, text: text) } else { nil }
    }
}

/// Opens the meal composer from inside a page (Ma's Fuel quick actions); the sheet itself hangs on the shell.
private struct OpenMealKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (MealStart) -> Void = { _ in } }
extension EnvironmentValues {
    var openMeal: @MainActor @Sendable (MealStart) -> Void {
        get { self[OpenMealKey.self] }
        set { self[OpenMealKey.self] = newValue }
    }
}

/// The global "+": what to record. B3 wires the check-in and the journal line (the evening close's voice-or-type row);
/// the meal chips open the composer (B4); every other item answers a "hamarosan" toast until its slice (B4 food, B5 training) wires it.
struct CaptureSheet: View {
    let onPick: (CapturePick) -> Void
    @State private var text = ""

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: "Rögzítés", title: "Mit rögzítesz?") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    NKGlyph("bowl-cream", .white, size: 24)
                        .frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.1)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Étkezés").nkFont(17, .semibold).foregroundStyle(.white)
                        Text("Boop kiszámolja, és megmondja, belefér-e").nkFont(13).foregroundStyle(.white.opacity(0.55))
                    }
                }
                HStack(spacing: 8) {
                    ForEach(Self.foodChips, id: \.title) { chip($0.glyph, $0.title, $0.pick) }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                tile("spark-cream", "Check-in", "fél perc", .cover(.checkin))
                tile("book-sage", "Napló", "egy sor, szóval is", .cover(.este))
                tile("scale-ink", "Súly", "mérés felvétele", .soon("Súly"))
                tile("dumbbell-ink", "Edzés indítása", "a mai terv szerint", .soon("Edzés indítása"))
            }

            HStack(spacing: 10) {
                TextField("", text: $text, prompt: Text("Mondd vagy írd: ebéd, csirke rizzsel…").foregroundStyle(.white.opacity(0.45)))
                    .nkFont(15).foregroundStyle(.white)
                    .submitLabel(.send)
                    .onSubmit {
                        let words = text.trimmingCharacters(in: .whitespacesAndNewlines)
                        onPick(.meal(.text, text: words))
                    }
                StillOrb(palette: Hue.forma.orb, size: 26, level: 0.8)
            }
            .padding(.horizontal, 18).frame(height: 54)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
        }
    }

    /// The meal chips, all real: each opens the composer at its entrance (the barcode one lands on the scanner).
    static let foodChips: [(glyph: String, title: String, pick: CapturePick)] = [
        ("camera-ink", "Fotó", .meal(.photo, text: "")), ("pen-sun", "Szöveg", .meal(.text, text: "")),
        ("search-ink", "Vonalkód", .meal(.barcode, text: "")), ("book-sage", "Recept", .meal(.recipe, text: "")),
        ("bowl-sage", "Kamra", .meal(.pantry, text: "")),
    ]

    private func chip(_ glyph: String, _ title: String, _ pick: CapturePick) -> some View {
        Button { onPick(pick) } label: {
            VStack(spacing: 6) {
                NKGlyph(glyph, .white, size: 18)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity).frame(height: 62)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func tile(_ glyph: String, _ title: String, _ sub: String, _ pick: CapturePick) -> some View {
        Button { onPick(pick) } label: {
            VStack(alignment: .leading, spacing: 10) {
                NKGlyph(glyph, .white, size: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15.5, .semibold).foregroundStyle(.white)
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
        }
        .buttonStyle(.plain)
    }
}
