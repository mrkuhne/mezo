import Foundation
import Testing
@testable import BoopCore

/// Writes a fake m4a where the journal asks, and remembers what happened.
@MainActor
private final class FakeAudio: AudioRecording {
    var allowed = true
    private(set) var recordingTo: URL?
    private(set) var stopped = 0
    func requestPermission() async -> Bool { allowed }
    func start(to url: URL) throws {
        recordingTo = url
        try Data("fake-m4a".utf8).write(to: url)
    }
    func stop() { stopped += 1 }
}

/// A recognizer that answers from a script.
private final class FakeRecognizer: SpeechTranscribing, @unchecked Sendable {
    let supportsOnDevice: Bool
    let authorized: Bool
    let answer: Result<String, Error>
    let delay: Duration
    private let lock = NSLock()
    private var asked: [URL] = []
    init(onDevice: Bool, authorized: Bool = true, answer: Result<String, Error> = .success("Jól ment a prezentáció."),
         delay: Duration = .zero) {
        supportsOnDevice = onDevice; self.authorized = authorized; self.answer = answer; self.delay = delay
    }
    var calls: [URL] { lock.withLock { asked } }
    func authorize() async -> Bool { authorized }
    func transcribe(_ url: URL) async throws -> String {
        lock.withLock { asked.append(url) }
        if delay > .zero { try? await Task.sleep(for: delay) }
        return try answer.get()
    }
}

/// The evening voice journal (B3 Task 10, spec §5.4 / §7.1): an m4a in the outbox folder, a transcript on the phone when
/// Hungarian on-device recognition is there (the audio then goes), otherwise the recording waits for the upload.
@MainActor
final class VoiceJournalTests {
    let dir = temporaryDirectory()
    deinit { try? FileManager.default.removeItem(at: dir) }

    private func files() -> [String] {
        ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []).filter { $0.hasSuffix(".m4a") }
    }

    @Test func audioDeletedAfterTranscript() async throws {
        let audio = FakeAudio()
        let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: FakeRecognizer(onDevice: true))
        try await journal.start()
        let url = try #require(audio.recordingTo)
        #expect(url.pathExtension == "m4a" && url.deletingLastPathComponent().standardizedFileURL == dir.standardizedFileURL)
        #expect(FileManager.default.fileExists(atPath: url.path))
        let result = await journal.stop()
        #expect(result == .transcript("Jól ment a prezentáció."))
        #expect(audio.stopped == 1)
        #expect(files().isEmpty)                  // never kept after a transcript
        #expect(journal.transcribesOnDevice)
    }

    @Test func noOnDeviceFallsBackToUpload() async throws {
        let audio = FakeAudio()
        let recognizer = FakeRecognizer(onDevice: false)
        let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: recognizer)
        try await journal.start()
        let result = await journal.stop()
        let name = try #require(audio.recordingTo?.lastPathComponent)
        #expect(result == .recording(fileName: name))
        #expect(files() == [name])                // kept for the outbox's `voice` item
        #expect(recognizer.calls.isEmpty)         // nothing sent anywhere from here
        #expect(!journal.transcribesOnDevice)
    }

    @Test func failedOrSilentOnDeviceRecognitionKeepsTheRecording() async throws {
        struct Boom: Error {}
        for answer: Result<String, Error> in [.failure(Boom()), .success("   ")] {
            let audio = FakeAudio()
            let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: FakeRecognizer(onDevice: true, answer: answer))
            try await journal.start()
            let name = try #require(audio.recordingTo?.lastPathComponent)
            #expect(await journal.stop() == .recording(fileName: name))
            #expect(files().contains(name))
        }
    }

    @Test func speechNotAllowedKeepsTheRecording() async throws {
        let audio = FakeAudio()
        let recognizer = FakeRecognizer(onDevice: true, authorized: false)
        let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: recognizer)
        try await journal.start()
        guard case .recording = await journal.stop() else { Issue.record("expected the recording"); return }
        #expect(recognizer.calls.isEmpty)
    }

    @Test func slowOnDeviceRecognitionTimesOutToTheUpload() async throws {
        let audio = FakeAudio()
        let journal = VoiceJournal(directory: dir, recorder: audio,
                                   transcriber: FakeRecognizer(onDevice: true, delay: .seconds(5)), timeout: .milliseconds(50))
        try await journal.start()
        let name = try #require(audio.recordingTo?.lastPathComponent)
        let started = ContinuousClock.now
        #expect(await journal.stop() == .recording(fileName: name))
        #expect(ContinuousClock.now - started < .seconds(2))
        #expect(files().contains(name))
    }

    @Test func speechDenialIsRemembered() async throws {
        let journal = VoiceJournal(directory: dir, recorder: FakeAudio(), transcriber: FakeRecognizer(onDevice: true, authorized: false))
        try await journal.start()
        _ = await journal.stop()
        #expect(journal.speechDenied)
    }

    @Test func deniedMicrophoneThrowsAndRecordsNothing() async {
        let audio = FakeAudio()
        audio.allowed = false
        let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: FakeRecognizer(onDevice: true))
        await #expect(throws: VoiceJournalError.microphoneDenied) { try await journal.start() }
        #expect(audio.recordingTo == nil)
        #expect(await journal.stop() == nil)
    }

    @Test func discardDeletesAKeptRecording() async throws {
        let audio = FakeAudio()
        let journal = VoiceJournal(directory: dir, recorder: audio, transcriber: FakeRecognizer(onDevice: false))
        try await journal.start()
        let result = try #require(await journal.stop())
        journal.discard(result)
        #expect(files().isEmpty)
    }
}
