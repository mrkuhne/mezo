import Foundation
import Observation

/// What the capture sheet says when the reading did not come back.
public func cookedProblemLine(_ e: FoodFetchError) -> String {
    switch e {
    case .offline: "Nincs net. A szöveged megmarad, próbáld újra."
    case .unauthorized: "A belépésed lejárt — lépj be újra."
    case .rejected: "Ezt így nem tudom beolvasni: a szöveg túl hosszú, vagy valamelyik kép túl nagy. JPEG vagy PNG kell."
    case .unavailable: "Most nem tudom elolvasni — Boop nem érhető el. Próbáld újra később."
    default: "Most nem jön válasz. Próbáld újra egy kicsit később."
    }
}

/// The „Ezt főztem" capture (mezo-r36n9.63), apart from any view: what he typed or dictated, up to six photos, and one
/// reading that turns them into a review draft. Nothing is stored by the reading; a failure keeps the text and the photos.
@MainActor @Observable
public final class CookedCaptureModel {
    public enum Stage: Equatable {
        case input
        case working
        case review(RecipeImportDraft)
        /// Nothing in the text or on the photos could be read as an ingredient.
        case empty
        case failed(String)
    }
    public enum Mic: Equatable {
        case idle, listening, transcribing
        /// The microphone or speech recognition is not allowed: the field still works.
        case denied
        /// This phone cannot write Hungarian down by itself: the field still works.
        case unavailable
    }

    public private(set) var stage: Stage = .input
    public var text: String
    /// JPEG bytes, in the order he added them.
    public private(set) var photos: [Data] = []
    public private(set) var mic: Mic = .idle
    /// The last dictation heard nothing (cleared by the next one).
    public private(set) var heardNothing = false

    public static let maxPhotos = 6
    public static let maxText = 4000

    private let reader: @Sendable (String?, [Data]) async throws -> RecipeImportDraft?
    private let dictation: Dictating

    public init(text: String = "", reader: @escaping @Sendable (String?, [Data]) async throws -> RecipeImportDraft?, dictation: Dictating) {
        self.text = text; self.reader = reader; self.dictation = dictation
    }

    private var words: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Some text or at least one photo, and no reading in flight.
    public var canAnalyse: Bool { stage != .working && (!words.isEmpty || !photos.isEmpty) }
    public var photoSlotsLeft: Int { max(0, Self.maxPhotos - photos.count) }

    /// Ignored at the cap.
    public func addPhoto(_ jpeg: Data) {
        guard photos.count < Self.maxPhotos, !jpeg.isEmpty else { return }
        photos.append(jpeg)
    }

    public func removePhoto(at index: Int) {
        guard photos.indices.contains(index) else { return }
        photos.remove(at: index)
    }

    /// Starts listening; or stops and appends what was heard to the text (the transcript comes after stop, not live).
    public func toggleMic() async {
        switch mic {
        case .transcribing: return
        case .listening:
            mic = .transcribing
            let heard = await dictation.stop()?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if heard.isEmpty {
                heardNothing = true
            } else {
                let joined = words.isEmpty ? heard : text.trimmingCharacters(in: .whitespacesAndNewlines) + " " + heard
                text = String(joined.prefix(Self.maxText))
            }
            mic = .idle
        case .idle, .denied, .unavailable:
            heardNothing = false
            do { try await dictation.start(); mic = .listening }
            catch DictationError.unavailable { mic = .unavailable }
            catch { mic = .denied }
        }
    }

    /// One reading. A second tap while it runs does nothing; a failure keeps the text and the photos.
    public func analyse() async {
        guard canAnalyse else { return }
        if mic == .listening { await toggleMic() }
        stage = .working
        let said = words.isEmpty ? nil : String(words.prefix(Self.maxText))
        do {
            if let draft = try await reader(said, photos) { stage = .review(draft) } else { stage = .empty }
        } catch let e as FoodFetchError {
            stage = .failed(cookedProblemLine(e))
        } catch {
            stage = .failed(cookedProblemLine(.server))
        }
    }

    /// Back to the capture, with the text and the photos as they were.
    public func back() { stage = .input }
}
