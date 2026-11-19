import Foundation

/// Dictation into a text field: start listening, stop, and get what was heard as text (nil = nothing heard).
public protocol Dictating: Sendable {
    func start() async throws
    func stop() async -> String?
}

public enum DictationError: Error, Equatable, Sendable {
    /// The owner said no to the microphone or to speech recognition (Settings can change it).
    case denied
    /// This phone cannot write Hungarian speech down by itself, and the sound never leaves the phone.
    case unavailable
}

/// On-device dictation for „Ezt főztem" (mezo-r36n9.63): `VoiceJournal`'s recorder and recogniser, with one rule of its
/// own — the sound never leaves the phone. A recording the phone could not write down is deleted, not uploaded; the
/// recording that was written down is deleted by the journal. The transcript arrives after stop, not live.
public struct VoiceDictation: Dictating {
    private let journal: VoiceJournal
    private let transcriber: SpeechTranscribing

    @MainActor
    public init(directory: URL = FileManager.default.temporaryDirectory.appendingPathComponent("boop-dictation", isDirectory: true),
                recorder: AudioRecording? = nil, transcriber: SpeechTranscribing = OnDeviceSpeech()) {
        self.transcriber = transcriber
        journal = VoiceJournal(directory: directory, recorder: recorder, transcriber: transcriber)
    }

    public func start() async throws {
        guard transcriber.supportsOnDevice else { throw DictationError.unavailable }
        guard await transcriber.authorize() else { throw DictationError.denied }
        do { try await journal.start() }
        catch VoiceJournalError.microphoneDenied { throw DictationError.denied }
    }

    public func stop() async -> String? {
        guard let capture = await journal.stop() else { return nil }
        switch capture {
        case .transcript(let text): return text
        case .recording:
            await journal.discard(capture)
            return nil
        }
    }
}
