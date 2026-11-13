import SwiftUI
import VisionKit
import BoopCore
import BoopDesign

// Barcode scanning (B4 Task 11, spike `EBarcode`): the camera reads an EAN/UPC code, Boop looks it up, and a found product
// goes on to the serving confirmation. A code nobody knows is an honest screen offering the label photo — carrying the code.

enum BarcodeCode {
    /// A typed or scanned code reduced to its digits; nil unless it can be a barcode (the server treats 8+ digits as one).
    static func clean(_ raw: String) -> String? {
        let digits = raw.filter(\.isNumber)
        guard digits.count == raw.filter({ !$0.isWhitespace && $0 != "-" }).count, (8...14).contains(digits.count) else { return nil }
        return digits
    }
}

/// The lookup's state, apart from any view: scanning → looking → found / miss / failed.
@MainActor @Observable
final class BarcodeScanModel {
    enum State: Equatable {
        case scanning
        case looking(code: String)
        case found(LookupItem, LookupSource, code: String)
        /// Looked up, and neither the owner's catalog nor the public database knows it.
        case miss(code: String)
        /// Could not look it up at all (no net, upstream down) — not the same as "unknown".
        case failed(code: String, offline: Bool)

        /// The barcode the label photo should carry — only an unknown code offers it.
        var labelPhotoCode: String? { if case .miss(let c) = self { c } else { nil } }
    }

    private(set) var state: State = .scanning
    private(set) var problem: String?
    private let lookup: @Sendable (String) async throws -> LookupResult

    init(lookup: @escaping @Sendable (String) async throws -> LookupResult) { self.lookup = lookup }

    func submit(_ raw: String) async {
        if case .looking = state { return }
        guard let code = BarcodeCode.clean(raw) else {
            problem = "Ez nem vonalkód — 8–14 számjegy kell."
            return
        }
        problem = nil; state = .looking(code: code)
        do {
            let result = try await lookup(code)
            if result.source != .none, let hit = result.results.first { state = .found(hit, result.source, code: code) }
            else { state = .miss(code: code) }
        } catch FoodFetchError.offline {
            state = .failed(code: code, offline: true)
        } catch {
            state = .failed(code: code, offline: false)
        }
    }

    func reset() { problem = nil; state = .scanning }
}

/// VisionKit's live scanner, restricted to the codes food carries. `onCode` fires for the first code only; the host moves on.
struct BarcodeScanner: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    /// The scanner needs the hardware and the owner's camera permission (`isAvailable` is false when it was denied).
    @MainActor static var isAvailable: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce])],
            qualityLevel: .balanced, recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false, isPinchToZoomEnabled: true, isGuidanceEnabled: false, isHighlightingEnabled: true)
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        context.coordinator.onCode = onCode
        // Scanning can only start once the controller is in a window; every update retries until it takes.
        if !scanner.isScanning { try? scanner.startScanning() }
    }

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var onCode: (String) -> Void
        private var delivered = false
        init(onCode: @escaping (String) -> Void) { self.onCode = onCode }

        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !delivered else { return }
            for case .barcode(let code) in addedItems {
                if let value = code.payloadStringValue, let clean = BarcodeCode.clean(value) {
                    delivered = true
                    scanner.stopScanning()
                    onCode(clean)
                    return
                }
            }
        }
    }
}

/// The scan screen's content (the composer's sheet frame is around it).
struct BarcodeScanView: View {
    let model: BarcodeScanModel
    let profile: SensitivityProfile?
    let onServing: (LookupItem, LookupSource, String) -> Void
    let onLabelPhoto: (String) -> Void
    let onWords: (String) -> Void
    let onBack: () -> Void
    @State private var typed = ""
    @State private var scannerOn = false
    @FocusState private var typing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            switch model.state {
            case .scanning: scanning
            case .looking(let code): looking(code)
            case .found(let item, _, let code): found(item, code)
            case .miss(let code): miss(code)
            case .failed(let code, let offline): failed(code, offline: offline)
            }
        }
        .onAppear {
            scannerOn = BarcodeScanner.isAvailable
            #if DEBUG
            // Simulator review (no camera): `-previewCode <digits>` looks that code up as if typed; `-previewServing YES`
            // then goes straight on to the serving confirmation.
            if let code = UserDefaults.standard.string(forKey: "previewCode"), model.state == .scanning {
                Task {
                    await model.submit(code)
                    if UserDefaults.standard.bool(forKey: "previewServing"), case .found(let item, let source, let c) = model.state { onServing(item, source, c) }
                }
            }
            #endif
        }
        .onChange(of: model.state) { _, new in if new == .scanning { scannerOn = BarcodeScanner.isAvailable } }
    }

    // MARK: Scanning

    private var scanning: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.black.opacity(0.55))
                if scannerOn {
                    BarcodeScanner { code in Task { await model.submit(code) } }
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .accessibilityLabel("Kamera: tartsd a vonalkódot a keretbe")
                } else {
                    VStack(spacing: 8) {
                        NKGlyph("search-ink", .white.opacity(0.7), size: 26).accessibilityHidden(true)
                        Text("A kamera most nem érhető el, ezért a kódot beírhatod alul. Ha engedélyezni akarod, a Beállítások › Boop alatt kapcsolhatod be.")
                            .nkFont(13).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 20)
                    }
                }
                if scannerOn {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(.white.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [26, 14]))
                        .frame(width: 240, height: 120).allowsHitTesting(false).accessibilityHidden(true)
                }
            }
            .frame(height: 230)
            Text(scannerOn ? "Tartsd a vonalkódot a keretbe — magától felismeri." : "Írd be a termék vonalkódját (a csíkok alatti számok).")
                .nkFont(13.5).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                TextField("", text: $typed, prompt: Text("Vonalkód, pl. 5998200312458").foregroundStyle(.white.opacity(0.45)))
                    .keyboardType(.numberPad).nkFont(15, design: .monospaced).foregroundStyle(.white).focused($typing)
                    .accessibilityLabel("Vonalkód beírása")
                Button { typing = false; Task { await model.submit(typed) } } label: {
                    Text("Megkeresem").nkFont(14, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 16).frame(minHeight: 38).background(Capsule().fill(.white.opacity(typed.isEmpty ? 0.3 : 0.95)))
                }
                .buttonStyle(.plain).disabled(typed.isEmpty)
            }
            .padding(.leading, 18).padding(.trailing, 8).padding(.vertical, 6).frame(minHeight: 54)
            .background(Capsule().fill(.white.opacity(0.08))).overlay(Capsule().stroke(.white.opacity(0.12)))
            if let p = model.problem { Text(p).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).accessibilityLabel("Gond: \(p)") }
            secondary("Vissza", onBack)
        }
    }

    private func looking(_ code: String) -> some View {
        HStack(spacing: 14) {
            ProgressView().tint(.white)
            Text("Megkeresem a \(code) kódot.").nkFont(15).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    // MARK: Found

    private func found(_ item: LookupItem, _ code: String) -> some View {
        let badges = draftBadges(for: ServingConfirmation(facts: item).line(), profile: profile)
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    NKThumb(image: nil, glyph: "bowl-cream", size: 48)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.name).nkFont(16, .medium).foregroundStyle(.white).lineLimit(2)
                        Text(factsLine(item)).nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.65))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                if !badges.isEmpty {
                    HStack(spacing: 6) { ForEach(badges) { badge($0) } }
                }
                if let line = scanSensitivityLine(item, profile: profile) {
                    Text(line).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                }
                primary("Mennyit ettél belőle?") { onServing(item, lookupSource(), code) }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            secondary("Másik kód") { typed = ""; model.reset() }
        }
    }

    private func lookupSource() -> LookupSource {
        if case .found(_, let s, _) = model.state { return s }
        return .off
    }

    private func factsLine(_ item: LookupItem) -> String {
        guard let kcal = item.kcal else { return "Ehhez a termékhez nincs tápérték-adat" }
        let unit = "\(item.per == item.per.rounded() ? String(Int(item.per)) : String(item.per)) \(item.unit)"
        return "\(unit): \(Int(kcal.rounded())) kcal · F \(Int((item.proteinG ?? 0).rounded())) g · Sz \(Int((item.carbsG ?? 0).rounded())) g · Zs \(Int((item.fatG ?? 0).rounded())) g"
    }

    private func badge(_ b: DraftBadge) -> some View {
        Text(b.text).nkFont(11.5, .semibold)
            .foregroundStyle(b.tone == .stop ? NK.ground : .white.opacity(0.9))
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(b.tone == .stop ? .white.opacity(0.92) : .white.opacity(b.tone == .warn ? 0.22 : 0.1)))
            .overlay(Capsule().stroke(.white.opacity(b.tone == .processed ? 0.35 : 0), lineWidth: 1))
    }

    // MARK: Miss and failure

    private func miss(_ code: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                Text(code).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                Text("Se nálad, se a nyilvános adatbázisban nincs meg ez a kód. Fotózd le a tápértéktáblát, és abból kiszámolom — a kódot is odateszem a vázlathoz.")
                    .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                primary("Lefotózom a címkét") { onLabelPhoto(code) }
                secondary("Leírom szavakkal") { onWords(code) }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            secondary("Másik kód") { typed = ""; model.reset() }
        }
    }

    private func failed(_ code: String, offline: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                Text(code).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                Text(offline
                     ? "Nincs net, ezért a kódot most nem tudom megkeresni. Ez nem azt jelenti, hogy nincs meg — csak nem értem el. Próbáld újra, ha van jel, vagy írd le szavakkal, mit ettél."
                     : "A kódot most nem tudtam megkeresni, a szolgáltatás nem válaszolt. Ez nem azt jelenti, hogy nincs meg. Próbáld újra, vagy írd le szavakkal, mit ettél.")
                    .nkFont(14.5).lineSpacing(3).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
                primary("Újra") { Task { await model.submit(code) } }
                secondary("Leírom szavakkal") { onWords(code) }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            secondary("Másik kód") { typed = ""; model.reset() }
        }
    }

    // MARK: Pieces

    private func primary(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(16, .semibold).foregroundStyle(NK.ground).frame(maxWidth: .infinity).frame(height: 50)
                .background(Capsule().fill(.white.opacity(0.95)))
        }
        .buttonStyle(.plain)
    }

    private func secondary(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(15).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity).frame(height: 46)
                .background(Capsule().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}
