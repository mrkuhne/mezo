import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// „Ezt főztem" (mezo-r36n9.63, spec 2026-11-17-boop-ezt-foztem-design.md §4): he says or types what he cooked from
// and how much, adds up to six photos, taps „Elemzés" — and lands in the same review every recipe route ends in, with
// its three row faces. Approved look: the simulator spike + docs/superpowers/specs/assets/ezt-foztem/*.jpg.

/// How the sheet opens (review hooks open it further along).
enum CookedStart: Equatable {
    case input
    #if DEBUG
    /// Text and three photos already in it.
    case filled
    /// Read straight away: the review.
    case review
    #endif
}

/// Holds the capture and, once read, the review model for the life of the sheet (the content closure re-runs; these must not).
struct CookedCaptureSheet: View {
    @State private var capture: CookedCaptureModel
    @State private var review: RecipeImportModel?
    @State private var showCamera = false
    @State private var showLibrary = false
    @FocusState private var typing: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let food: FoodClient?
    private let profile: SensitivityProfile?
    private let start: CookedStart
    let onSaved: (Recipe) -> Void
    let onSavedLog: (Recipe) -> Void

    init(food: FoodClient?, profile: SensitivityProfile?, start: CookedStart = .input,
         onSaved: @escaping (Recipe) -> Void, onSavedLog: @escaping (Recipe) -> Void) {
        _capture = State(initialValue: CookedCaptureModel(
            reader: { text, photos in
                guard let food else { throw FoodFetchError.unauthorized }
                return try await food.cooked(text: text, photos: photos)
            },
            dictation: VoiceDictation()))
        self.food = food; self.profile = profile; self.start = start
        self.onSaved = onSaved; self.onSavedLog = onSavedLog
    }

    private var title: String {
        if case .review = capture.stage, let r = review?.review { return r.name.isEmpty ? "Új recept" : r.name }
        return "Miből főztél?"
    }

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "EZT FŐZTEM", title: title, closable: !(capture.stage == .working || review?.saving == true)) {
            switch capture.stage {
            case .input: input
            case .working:
                MealScanView(image: capture.photos.first.flatMap(UIImage.init(data:)), reduceMotion: reduceMotion,
                             phrases: capture.photos.isEmpty
                                ? ["Olvasom, amit mondtál…", "Összevetem a kamráddal…", "Kiszámolom a mennyiségeket…"]
                                : ["Megnézem a képeket…", "Kiolvasom a hozzávalókat…", "Összevetem a kamráddal…"],
                             footnote: "A fotókat csak elolvasom, nem őrzöm meg. Semmi nem mentődik, amíg át nem nézted.")
            case .review:
                if let review {
                    backLink
                    ReviewBody(model: review, profile: profile, onSaved: onSaved, onSavedLog: onSavedLog)
                }
            case .empty:
                notice("Ebből nem tudtam hozzávalókat kiolvasni.",
                       "Írd le egyszerűbben, mit és mennyit használtál — például: „fél kiló csirkemell, 30 deka rizs” —, vagy fotózd le a csomagolást.",
                       action: "Újra próbálom")
            case .failed(let line):
                notice("Nem sikerült elolvasni.", line, action: "Vissza")
            }
        }
        .reviewFoodForm(review, profile: profile)
        .scrollDismissesKeyboard(.interactively)
        .photoLibrary(isPresented: $showLibrary, limit: capture.photoSlotsLeft) { picked in
            Task { for data in picked { await add(data) } }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(onPick: { data in showCamera = false; Task { await add(data) } }, onCancel: { showCamera = false })
                .ignoresSafeArea()
        }
        .onChange(of: capture.stage) { _, stage in
            if case .review(let draft) = stage {
                review = RecipeImportModel(mode: .text, food: food, review: RecipeReview(draft: draft), eyebrow: "EZT FŐZTEM")
            }
        }
        .interactiveDismissDisabled(capture.stage == .working || review?.saving == true)
        #if DEBUG
        .task { await debugStart() }
        #endif
    }

    private func add(_ data: Data) async {
        guard let jpeg = await Task.detached(operation: { MealPhoto.jpeg(from: data) }).value else { return }
        capture.addPhoto(jpeg)
    }

    #if DEBUG
    private func debugStart() async {
        guard start != .input, capture.stage == .input, capture.text.isEmpty else { return }
        capture.text = "Fél kiló csirkemell, 30 deka rizs, két evőkanál olaj, egy fej hagyma, egy teáskanál kurkuma, egy doboz kókusztej."
        for (n, label) in ["CSOMAGOLÁS", "MÉRLEG", "CETLI"].enumerated() { capture.addPhoto(Self.samplePhoto(n, label)) }
        if start == .review { await capture.analyse() }
    }

    /// A stand-in photo for the simulator review: a warm gradient with a label.
    static func samplePhoto(_ n: Int, _ label: String) -> Data {
        let size = CGSize(width: 600, height: 600)
        return UIGraphicsImageRenderer(size: size).jpegData(withCompressionQuality: 0.8) { ctx in
            let hues: [(CGFloat, CGFloat, CGFloat)] = [(0.78, 0.6, 0.4), (0.55, 0.62, 0.5), (0.7, 0.55, 0.62)]
            let c = hues[n % hues.count]
            let colors = [UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1).cgColor, UIColor(red: c.0 * 0.5, green: c.1 * 0.5, blue: c.2 * 0.5, alpha: 1).cgColor]
            if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1]) {
                ctx.cgContext.drawLinearGradient(g, start: .zero, end: CGPoint(x: size.width, y: size.height), options: [])
            }
            (label as NSString).draw(at: CGPoint(x: 40, y: 520), withAttributes: [.font: UIFont.monospacedSystemFont(ofSize: 40, weight: .medium),
                                                                                  .foregroundColor: UIColor.white.withAlphaComponent(0.8)])
        }
    }
    #endif

    // MARK: capture

    private var input: some View {
        VStack(spacing: 12) {
            EtelSheetCard(label: "MONDD EL VAGY ÍRD LE") {
                TextField("", text: $capture.text,
                          prompt: Text("Például: fél kiló csirkemell, 30 deka rizs, két evőkanál olaj, egy fej hagyma…").foregroundStyle(.white.opacity(0.4)),
                          axis: .vertical)
                    .lineLimit(4...10).nkFont(15).foregroundStyle(.white).focused($typing)
                    .padding(.horizontal, 16).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(typing ? Hue.fuel.glow.opacity(0.6) : .white.opacity(0.12)))
                    .accessibilityLabel("Miből főztél, és mennyit használtál")
                micRow
            }
            EtelSheetCard(label: "FOTÓK", trailing: "\(capture.photos.count) / \(CookedCaptureModel.maxPhotos)") {
                photoStrip
                Text("Csomagolás, a mérleg kijelzője, egy cetli vagy a pult. A fotókat csak elolvasom, nem őrzöm meg. Amit a képen félreértenék, azt a szövegben kijavíthatod.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            EtelPrimaryButton(title: "Elemzés", glyph: "spark-cream", enabled: capture.canAnalyse) {
                typing = false
                Task { await capture.analyse() }
            }
            if !capture.canAnalyse {
                Text("Írj vagy mondj valamit, vagy tegyél hozzá egy fotót.").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            }
        }
    }

    /// The mic: one tap listens, the next stops; the phone writes it down after the stop and adds it to the field.
    private var micRow: some View {
        let listening = capture.mic == .listening, working = capture.mic == .transcribing
        let blocked = capture.mic == .denied || capture.mic == .unavailable
        return Button { typing = false; Task { await capture.toggleMic() } } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(listening ? Hue.fuel.glow.opacity(0.9) : .white.opacity(blocked ? 0.05 : 0.1))
                    if working { ProgressView().tint(.white) } else { NKGlyph("mic", listening ? NK.ground : .white.opacity(blocked ? 0.4 : 1), size: 17) }
                }
                .frame(width: 44, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(listening ? "Hallgatlak… koppints, ha kész" : working ? "Leírom, amit mondtál…" : "Diktálok")
                        .nkFont(15, .medium).foregroundStyle(.white)
                    Text(micNote).nkFont(12.5).foregroundStyle(.white.opacity(blocked ? 0.75 : 0.55)).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain).disabled(working)
        .accessibilityLabel(listening ? "Diktálás leállítása" : "Diktálás indítása")
    }

    private var micNote: String {
        switch capture.mic {
        case .listening: "a szöveg a leállítás után jelenik meg"
        case .transcribing: "a hang nem megy sehova"
        case .denied: "A diktáláshoz engedélyezd a mikrofont és a beszédfelismerést a Beállításokban. Addig írd be a mezőbe."
        case .unavailable: "Ez a telefon nem tud magyarul diktálni a hang elküldése nélkül. Írd be a mezőbe."
        case .idle: capture.heardNothing ? "Nem hallottam semmit — próbáld újra, közelebbről." : "a telefon írja le, a hang nem megy sehova"
        }
    }

    private var photoStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(Array(capture.photos.enumerated()), id: \.offset) { i, data in
                    ZStack(alignment: .topTrailing) {
                        Color.clear.frame(width: 88, height: 88)
                            .overlay { if let image = UIImage(data: data) { Image(uiImage: image).resizable().scaledToFill().nkPhotoTone() } }
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.14)))
                        Button { capture.removePhoto(at: i) } label: {
                            Text("Törlöm").nkFont(10.5, .semibold).foregroundStyle(.white)
                                .padding(.horizontal, 8).frame(minHeight: 24).background(Capsule().fill(.black.opacity(0.55)))
                                .padding(5).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain).accessibilityLabel("A(z) \(i + 1). fotó törlése")
                    }
                }
                if capture.photoSlotsLeft > 0 {
                    Menu {
                        if PhotoCapture.cameraAvailable { Button("Fotózok") { showCamera = true } }
                        Button("Képtárból") { showLibrary = true }
                    } label: {
                        VStack(spacing: 6) {
                            NKGlyph("camera-ink", Hue.fuel.glow, size: 20)
                            Text("Hozzáadok").nkFont(11.5, .medium).foregroundStyle(.white.opacity(0.75))
                        }
                        .frame(width: 88, height: 88)
                        .background {
                            let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
                            shape.fill(Hue.fuel.glow.opacity(0.08)).overlay(shape.stroke(Hue.fuel.glow.opacity(0.5), style: StrokeStyle(lineWidth: 1.2, dash: [5, 4])))
                        }
                    }
                    .accessibilityLabel("Fotó hozzáadása")
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var backLink: some View {
        Button { capture.back(); review = nil } label: {
            HStack(spacing: 6) { Image(systemName: "chevron.left"); Text("Vissza a leíráshoz") }
                .nkFont(14).foregroundStyle(.white.opacity(0.8)).frame(minHeight: 40)
        }
        .buttonStyle(.plain).frame(maxWidth: .infinity, alignment: .leading)
    }

    private func notice(_ head: String, _ body: String, action: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(head).nkFont(19, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text(body).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                if !capture.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { EtelPill(text: "a szöveged megmaradt", tone: .plain) }
                if !capture.photos.isEmpty { EtelPill(text: "\(capture.photos.count) fotó megmaradt", tone: .plain) }
            }
            EtelSecondaryButton(title: action) { capture.back() }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
