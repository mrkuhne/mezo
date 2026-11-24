import SwiftUI
import BoopDesign

/// What a tap on the "+" sheet asks for: one of the daily loop's covers, the meal composer at an entrance, the cash
/// expense, one of the quick log's own sheets, or an area to open.
enum CapturePick: Equatable {
    case cover(RitmusCover)
    /// The meal composer, at an entrance (the "+" sheet's food chips and its free-text line).
    case meal(MealStart.Entrance, text: String)
    /// Pénz L5: a cash expense, through the outbox.
    case penzExpense
    /// One of the quick log's own sheets (`mezo-r36n9.154`, `QuickSheets.swift`).
    case quick(QuickLog)
    /// An area to open — the "Edzés indítása" tile lands on the Edzés room, where today's workout starts.
    case area(Hue)

    /// What the shell opens for a pick: the composer's start (nil for everything else).
    var mealStart: MealStart? {
        if case .meal(let entrance, let text) = self { MealStart(entrance: entrance, text: text) } else { nil }
    }
}

/// The quick log's own sheets: the web app's doors that are neither a cover, nor the composer, nor an area.
enum QuickLog: String, CaseIterable, Identifiable {
    case water, supplements, sport, weight, sleep, journal
    var id: String { rawValue }
}

/// Opens the meal composer from inside a page (Ma's Fuel quick actions); the sheet itself hangs on the shell.
private struct OpenMealKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (MealStart) -> Void = { _ in } }
extension EnvironmentValues {
    var openMeal: @MainActor @Sendable (MealStart) -> Void {
        get { self[OpenMealKey.self] }
        set { self[OpenMealKey.self] = newValue }
    }
}

/// Opens the "+" sheet from inside a page (the home screen's own quick-log button); the sheet hangs on the shell.
private struct OpenCaptureKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable () -> Void = {} }
extension EnvironmentValues {
    var openCapture: @MainActor @Sendable () -> Void {
        get { self[OpenCaptureKey.self] }
        set { self[OpenCaptureKey.self] = newValue }
    }
}

/// Opens one door of the quick log straight from a page (the home screen's quick doors, `mezo-r36n9.157`): the
/// shell handles the pick exactly as it handles a tap on the "+" sheet, only with no sheet to wait for.
private struct OpenPickKey: EnvironmentKey { static let defaultValue: @MainActor @Sendable (CapturePick) -> Void = { _ in } }
extension EnvironmentValues {
    var openPick: @MainActor @Sendable (CapturePick) -> Void {
        get { self[OpenPickKey.self] }
        set { self[OpenPickKey.self] = newValue }
    }
}

/// The global "+": everything the web app's quick log could record, on one sheet (owner 2026-11-24, `mezo-r36n9.154`).
/// The meal chips open the composer (B4); the nine doors below are the web's nine plus the cash expense (Pénz L5):
/// Check-in opens its cover, "Edzés indítása" opens the Edzés room, the rest are the quick log's own sheets.
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

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                ForEach(Self.doors, id: \.title) { door($0) }
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

    /// The web app's nine quick-log doors (`docs/features/today.md` §Quick capture, less Étkezés which is the card
    /// above) plus the cash expense — every one real.
    static let doors: [(glyph: String, title: String, sub: String, pick: CapturePick)] = [
        ("drop-sky", "Víz", "egy koppintás", .quick(.water)),
        ("leaf-sage", "Kiegészítők", "bevettem", .quick(.supplements)),
        ("dumbbell-ink", "Edzés indítása", "a mai terv szerint", .area(.mozgas)),
        ("ball-sun", "Sport", "a terven kívül", .quick(.sport)),
        ("scale-ink", "Súly", "mérés felvétele", .quick(.weight)),
        ("spark-cream", "Check-in", "fél perc", .cover(.checkin)),
        ("book-sage", "Napló", "egy sor, bármikor", .quick(.journal)),
        ("moon-cream", "Alvás", "éjszaka kézzel", .quick(.sleep)),
        ("e-penz", "Kiadás", "készpénz", .penzExpense),
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

    private func door(_ d: (glyph: String, title: String, sub: String, pick: CapturePick)) -> some View {
        Button { onPick(d.pick) } label: {
            VStack(alignment: .leading, spacing: 8) {
                NKGlyph(d.glyph, .white, size: 20)
                VStack(alignment: .leading, spacing: 1) {
                    Text(d.title).nkFont(14, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                    Text(d.sub).nkFont(11.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
                }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading).frame(height: 88).nkGlass(18)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(d.title) · \(d.sub)")
    }
}
