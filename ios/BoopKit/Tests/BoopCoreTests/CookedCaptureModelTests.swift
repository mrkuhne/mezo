import Foundation
import Testing
@testable import BoopCore

/// A dictation that answers from a script.
private final class FakeDictation: Dictating, @unchecked Sendable {
    private let lock = NSLock()
    var startError: DictationError?
    var heard: String?
    private(set) var started = 0
    private(set) var stopped = 0
    init(heard: String? = "két evőkanál olaj", startError: DictationError? = nil) { self.heard = heard; self.startError = startError }
    func start() async throws {
        lock.withLock { started += 1 }
        if let startError { throw startError }
    }
    func stop() async -> String? {
        lock.withLock { stopped += 1 }
        return heard
    }
}

/// Counts the readings and answers from a script.
private final class Reader: @unchecked Sendable {
    private let lock = NSLock()
    private(set) var calls: [(text: String?, photos: Int)] = []
    var answer: Result<RecipeImportDraft?, FoodFetchError>
    var delay: Duration = .zero
    init(_ answer: Result<RecipeImportDraft?, FoodFetchError>) { self.answer = answer }
    func read(_ text: String?, _ photos: [Data]) async throws -> RecipeImportDraft? {
        lock.withLock { calls.append((text, photos.count)) }
        if delay > .zero { try? await Task.sleep(for: delay) }
        return try answer.get()
    }
}

private let draft = RecipeImportDraft(name: "Csirkés rizs", category: "lunch", servings: 4, steps: [],
                                      lines: [ImportedLine(name: "Rizs", amount: 300, unit: "g", catalogId: UUID(), confidence: 1, needsReview: false)],
                                      sourceUrl: nil, needsReview: false, cookedWeightG: nil)

/// The „Ezt főztem" capture (mezo-r36n9.63): text, dictation and up to six photos into one reading.
@MainActor
struct CookedCaptureModelTests {
    private func model(_ reader: Reader = Reader(.success(draft)), dictation: FakeDictation = FakeDictation()) -> CookedCaptureModel {
        CookedCaptureModel(reader: { try await reader.read($0, $1) }, dictation: dictation)
    }

    @Test func testCanAnalyse_needsTextOrPhoto() {
        let m = model()
        #expect(!m.canAnalyse)
        m.text = "   \n"
        #expect(!m.canAnalyse)
        m.text = "fél kiló csirkemell"
        #expect(m.canAnalyse)
        m.text = ""
        m.addPhoto(Data([1]))
        #expect(m.canAnalyse)
        m.removePhoto(at: 0)
        #expect(!m.canAnalyse)
    }

    @Test func testAddPhoto_stopsAtSix() {
        let m = model()
        for n in 0..<8 { m.addPhoto(Data([UInt8(n)])) }
        #expect(m.photos.count == 6 && m.photoSlotsLeft == 0)
        #expect(m.photos.last == Data([5]))
        m.addPhoto(Data())   // an unreadable picture is not a photo
        m.removePhoto(at: 0)
        m.removePhoto(at: 99)
        #expect(m.photos.count == 5 && m.photos.first == Data([1]) && m.photoSlotsLeft == 1)
    }

    @Test func testToggleMic_appendsTranscriptAfterStop() async {
        let mic = FakeDictation(heard: "  két evőkanál olaj ")
        let m = model(dictation: mic)
        m.text = "fél kiló csirkemell,"
        await m.toggleMic()
        #expect(m.mic == .listening && m.text == "fél kiló csirkemell,")   // nothing arrives while listening
        await m.toggleMic()
        #expect(m.mic == .idle)
        #expect(m.text == "fél kiló csirkemell, két evőkanál olaj")
        #expect(mic.started == 1 && mic.stopped == 1)

        // into an empty field there is no leading space; a silent recording changes nothing and says so
        let quiet = FakeDictation(heard: "egy fej hagyma")
        let empty = model(dictation: quiet)
        await empty.toggleMic(); await empty.toggleMic()
        #expect(empty.text == "egy fej hagyma" && !empty.heardNothing)
        quiet.heard = nil
        await empty.toggleMic(); await empty.toggleMic()
        #expect(empty.text == "egy fej hagyma" && empty.heardNothing && empty.mic == .idle)
    }

    @Test func testToggleMic_deniedLeavesTextUsable() async {
        let m = model(dictation: FakeDictation(startError: .denied))
        m.text = "30 deka rizs"
        await m.toggleMic()
        #expect(m.mic == .denied)
        #expect(m.text == "30 deka rizs" && m.canAnalyse)
        await m.analyse()
        #expect(m.stage == .review(draft))

        let none = model(dictation: FakeDictation(startError: .unavailable))
        await none.toggleMic()
        #expect(none.mic == .unavailable)
    }

    @Test func testAnalyse_nilDraftIsEmptyStage() async {
        let reader = Reader(.success(nil))
        let m = model(reader)
        m.text = " asdf "
        m.addPhoto(Data([1])); m.addPhoto(Data([2]))
        await m.analyse()
        #expect(m.stage == .empty)
        #expect(reader.calls.count == 1 && reader.calls[0].text == "asdf" && reader.calls[0].photos == 2)
        m.back()
        #expect(m.stage == .input && m.text == " asdf " && m.photos.count == 2)
    }

    @Test func testAnalyse_photosAloneSendNoText() async {
        let reader = Reader(.success(draft))
        let m = model(reader)
        m.addPhoto(Data([1]))
        await m.analyse()
        #expect(reader.calls[0].text == nil && m.stage == .review(draft))
    }

    @Test func testAnalyse_offlineKeepsTextAndPhotos() async {
        let reader = Reader(.failure(.offline))
        let m = model(reader)
        m.text = "fél kiló csirkemell"
        m.addPhoto(Data([1]))
        await m.analyse()
        #expect(m.stage == .failed("Nincs net. A szöveged megmarad, próbáld újra."))
        #expect(m.text == "fél kiló csirkemell" && m.photos.count == 1)
        m.back()
        reader.answer = .success(draft)
        await m.analyse()
        #expect(m.stage == .review(draft))

        reader.answer = .failure(.unavailable)
        m.back(); await m.analyse()
        #expect(m.stage == .failed("Most nem tudom elolvasni — Boop nem érhető el. Próbáld újra később."))
    }

    @Test func testAnalyse_secondTapWhileWorkingDoesNothing() async {
        let reader = Reader(.success(draft))
        reader.delay = .milliseconds(150)
        let m = model(reader)
        m.text = "rizs"
        async let first: Void = m.analyse()
        try? await Task.sleep(for: .milliseconds(30))
        #expect(m.stage == .working && !m.canAnalyse)
        await m.analyse()
        await first
        #expect(reader.calls.count == 1)
        #expect(m.stage == .review(draft))
    }

    @Test func testAnalyse_stopsAnOpenMicFirstAndTakesWhatItHeard() async {
        let reader = Reader(.success(draft))
        let m = model(reader, dictation: FakeDictation(heard: "egy fej hagyma"))
        m.text = "rizs,"
        await m.toggleMic()
        await m.analyse()
        #expect(m.mic == .idle)
        #expect(reader.calls[0].text == "rizs, egy fej hagyma")
    }
}
