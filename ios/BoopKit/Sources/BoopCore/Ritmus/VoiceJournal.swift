import AVFoundation
import Foundation
import Speech

/// What one recording became: the transcript (heard on the phone; the audio is already gone) or the recording itself,
/// kept in the outbox folder for a `voice` item — uploaded to the server's transcription once there is net (spec §7.1).
public enum VoiceCapture: Equatable, Sendable {
    case transcript(String)
    case recording(fileName: String)
}

public enum VoiceJournalError: Error, Equatable {
    /// The owner said no to the microphone (Settings can change it).
    case microphoneDenied
}

/// The microphone, behind a seam (tests write a fake file).
@MainActor
public protocol AudioRecording: AnyObject {
    /// Asks for the microphone when not decided yet; true = allowed.
    func requestPermission() async -> Bool
    func start(to url: URL) throws
    func stop()
}

/// Speech-to-text on the phone, behind a seam (tests use a scripted one).
public protocol SpeechTranscribing: Sendable {
    /// Hungarian can be recognised without the net on this phone.
    var supportsOnDevice: Bool { get }
    /// Asks for speech recognition when not decided yet; true = allowed.
    func authorize() async -> Bool
    /// The transcript of the file, recognised on the phone only.
    func transcribe(_ url: URL) async throws -> String
}

/// Boop's voice capture (B3 Task 10, spec §5.4, §7.1): one tap records an m4a into the outbox folder, the next stops it.
/// When Hungarian on-device recognition is available (and allowed) the phone writes the transcript and deletes the audio;
/// otherwise — or when the phone heard nothing — the recording is kept and the caller queues it as a `voice` item, which
/// `RitmusClient` uploads to `POST /api/companion/transcribe` when there is net. The audio is never sent anywhere else.
@MainActor
public final class VoiceJournal {
    private let directory: URL
    private let recorder: AudioRecording
    private let transcriber: SpeechTranscribing
    private var current: URL?

    public init(directory: URL, recorder: AudioRecording? = nil, transcriber: SpeechTranscribing = OnDeviceSpeech()) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        self.directory = directory
        self.recorder = recorder ?? SystemAudioRecorder()
        self.transcriber = transcriber
    }

    /// True when a transcript can come back right away (no net needed).
    public var transcribesOnDevice: Bool { transcriber.supportsOnDevice }

    /// Starts a new recording (asks for the microphone the first time).
    public func start() async throws {
        if current != nil { stopRecorder() }
        guard await recorder.requestPermission() else { throw VoiceJournalError.microphoneDenied }
        let url = directory.appendingPathComponent("voice-\(UUID().uuidString).m4a")
        try recorder.start(to: url)
        current = url
    }

    /// Stops; the transcript when the phone could write it, else the kept recording (nil: nothing was recorded).
    public func stop() async -> VoiceCapture? {
        guard let url = stopRecorder(), FileManager.default.fileExists(atPath: url.path) else { return nil }
        if transcriber.supportsOnDevice, await transcriber.authorize(),
           let text = try? await transcriber.transcribe(url).trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
            try? FileManager.default.removeItem(at: url)
            return .transcript(text)
        }
        return .recording(fileName: url.lastPathComponent)
    }

    /// Throws away a kept recording (e.g. the goal field, which takes only a transcript).
    public func discard(_ capture: VoiceCapture) {
        guard case .recording(let name) = capture else { return }
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(name))
    }

    @discardableResult
    private func stopRecorder() -> URL? {
        guard let url = current else { return nil }
        recorder.stop()
        current = nil
        return url
    }
}

// MARK: - The real microphone and recogniser

/// AAC in an m4a (mono, 16 kHz: speech, small files), recorded with the audio session in record mode.
@MainActor
public final class SystemAudioRecorder: AudioRecording {
    private var recorder: AVAudioRecorder?

    public init() {}

    public func requestPermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .denied: return false
        default: return await AVAudioApplication.requestRecordPermission()
        }
    }

    public func start(to url: URL) throws {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .default)
        try session.setActive(true)
        #endif
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC), AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let r = try AVAudioRecorder(url: url, settings: settings)
        guard r.record() else { throw CocoaError(.fileWriteUnknown) }
        recorder = r
    }

    public func stop() {
        recorder?.stop()
        recorder = nil
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}

/// `SFSpeechRecognizer(locale: hu-HU)`, on-device only (`requiresOnDeviceRecognition`): nothing leaves the phone here.
public struct OnDeviceSpeech: SpeechTranscribing {
    private static let locale = Locale(identifier: "hu-HU")

    public init() {}

    public var supportsOnDevice: Bool { SFSpeechRecognizer(locale: Self.locale)?.supportsOnDeviceRecognition ?? false }

    public func authorize() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .notDetermined:
            return await withCheckedContinuation { c in
                SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
            }
        default: return false
        }
    }

    public func transcribe(_ url: URL) async throws -> String {
        guard let recognizer = SFSpeechRecognizer(locale: Self.locale), recognizer.isAvailable else {
            throw CocoaError(.featureUnsupported)
        }
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = false
        let once = Once()
        return try await withCheckedThrowingContinuation { (c: CheckedContinuation<String, Error>) in
            // The recogniser is kept alive by the task's handler until the final result.
            let task = recognizer.recognitionTask(with: request) { result, error in
                if let result, result.isFinal {
                    if once.claim() { c.resume(returning: result.bestTranscription.formattedString) }
                } else if let error {
                    if once.claim() { c.resume(throwing: error) }
                }
            }
            once.keep(task, recognizer)
        }
    }

    /// Resumes the continuation exactly once; holds the task and its recogniser while it runs.
    private final class Once: @unchecked Sendable {
        private let lock = NSLock()
        private var done = false
        private var kept: [AnyObject] = []
        func claim() -> Bool {
            lock.withLock {
                guard !done else { return false }
                done = true
                kept = []
                return true
            }
        }
        func keep(_ objects: AnyObject...) { lock.withLock { if !done { kept = objects } } }
    }
}
