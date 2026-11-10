import Foundation
import Observation
import AVFoundation

/// The speech engine behind Boop's voice. A seam so tests inject a fake; callbacks are delivered on the main actor.
@MainActor
public protocol SpeechSynthesizing: AnyObject {
    /// False when the device has no Hungarian voice at all: the caller then reveals the text silently.
    var hasVoice: Bool { get }
    /// Speaks `text`. `onWord` receives the UTF-16 offset reached after each spoken word; `onFinish` fires when the
    /// utterance ends or is cancelled. A new `speak` or a `stop` replaces any running utterance.
    func speak(_ text: String, onWord: @escaping @MainActor (Int) -> Void, onFinish: @escaping @MainActor () -> Void)
    func stop()
}

/// Boop reads the morning brief aloud (Hungarian) and reveals the text word by word, in step with the voice.
/// Port of the spike's `Typer`. `isSpeaking` is true while Boop is "talking" — audible or silent reveal.
@MainActor @Observable
public final class BoopVoice {
    public static let mutedKey = "boop.voice.muted"

    /// The revealed prefix of the spoken text.
    public private(set) var shown = ""
    public private(set) var isSpeaking = false
    public var muted: Bool {
        didSet {
            defaults.set(muted, forKey: Self.mutedKey)
            if muted, isSpeaking { stop() }     // muting mid-sentence ends the voice and reveals the rest
        }
    }

    @ObservationIgnored private let synth: any SpeechSynthesizing
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let silentWordInterval: Duration
    @ObservationIgnored private var fullText = ""
    @ObservationIgnored private var reduceMotion = false
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var silentTask: Task<Void, Never>?

    public init(synthesizer: any SpeechSynthesizing? = nil, defaults: UserDefaults = .standard,
                silentWordInterval: Duration = .milliseconds(170)) {
        self.synth = synthesizer ?? AVSpeechSynthesizerAdapter()
        self.defaults = defaults
        self.silentWordInterval = silentWordInterval
        self.muted = defaults.bool(forKey: Self.mutedKey)
    }

    /// The spoken text is all segments joined (the links only mark phrases for the UI).
    public func speak(segments: [Brief.Line], reduceMotion: Bool) {
        fullText = segments.map(\.text).joined()
        self.reduceMotion = reduceMotion
        start()
    }

    /// Starts the same text over from the first word.
    public func replay() { start() }

    /// Ends speech immediately; the whole text stays visible.
    public func stop() {
        cancelRunning()
        shown = fullText
        isSpeaking = false
        deactivateAudio()
    }

    private func start() {
        cancelRunning()
        guard !fullText.isEmpty else { shown = ""; isSpeaking = false; return }
        if reduceMotion { shown = fullText; isSpeaking = false; return }
        shown = ""
        isSpeaking = true
        let gen = generation
        if !muted, synth.hasVoice {
            activateAudio()
            synth.speak(
                fullText,
                onWord: { [weak self] end in
                    guard let self, self.generation == gen else { return }
                    self.reveal(utf16: end)
                },
                onFinish: { [weak self] in
                    guard let self, self.generation == gen else { return }
                    self.shown = self.fullText
                    self.isSpeaking = false
                    self.deactivateAudio()
                })
        } else {
            revealSilently(gen)
        }
    }

    private func cancelRunning() {
        generation += 1                      // late callbacks of the replaced utterance carry the old generation
        silentTask?.cancel(); silentTask = nil
        synth.stop()
    }

    private func reveal(utf16 end: Int) {
        let units = fullText.utf16
        let clamped = min(max(end, 0), units.count)
        let idx = units.index(units.startIndex, offsetBy: clamped)
        let next = String(fullText[..<idx])
        if next.count > shown.count { shown = next }     // never moves backwards
    }

    private func revealSilently(_ gen: Int) {
        let text = fullText
        // end offsets (UTF-16) of every word, with the character that closes it
        var ends: [(Int, Character)] = []
        var offset = 0
        var inWord = false
        var last: Character = " "
        for ch in text {
            if ch.isWhitespace { if inWord { ends.append((offset, last)); inWord = false } } else { inWord = true; last = ch }
            offset += String(ch).utf16.count
        }
        if inWord { ends.append((offset, last)) }
        let interval = silentWordInterval
        silentTask = Task { [weak self] in
            for (end, closing) in ends {
                guard let self, self.generation == gen, !Task.isCancelled else { return }
                self.reveal(utf16: end)
                let pause = ",.:;!?".contains(closing) ? interval * 2 : interval
                try? await Task.sleep(for: pause)
            }
            guard let self, self.generation == gen, !Task.isCancelled else { return }
            self.shown = self.fullText
            self.isSpeaking = false
        }
    }

    // Ambient: respects the silent switch and mixes with other audio, so Boop never blasts in a meeting.
    private func activateAudio() {
        #if os(iOS)
        let s = AVAudioSession.sharedInstance()
        try? s.setCategory(.ambient, mode: .default, options: [])
        try? s.setActive(true)
        #endif
    }
    private func deactivateAudio() {
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }
}

/// AVSpeechSynthesizer behind `SpeechSynthesizing`. The delegate callbacks arrive on an arbitrary queue; they are
/// `nonisolated`, carry only Sendable values (an `ObjectIdentifier`, an offset) and hop to the main actor, where
/// the handlers live. No `@unchecked` needed.
@MainActor
final class AVSpeechSynthesizerAdapter: NSObject, SpeechSynthesizing, AVSpeechSynthesizerDelegate {
    private let synth = AVSpeechSynthesizer()
    private var current: ObjectIdentifier?
    private var onWord: (@MainActor (Int) -> Void)?
    private var onFinish: (@MainActor () -> Void)?

    override init() { super.init(); synth.delegate = self }

    var hasVoice: Bool { Self.bestVoice != nil }

    /// Best Hungarian voice: premium, then enhanced, then default.
    static var bestVoice: AVSpeechSynthesisVoice? {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("hu") }
            .max { $0.quality.rawValue < $1.quality.rawValue }
            ?? AVSpeechSynthesisVoice(language: "hu-HU")
    }

    func speak(_ text: String, onWord: @escaping @MainActor (Int) -> Void, onFinish: @escaping @MainActor () -> Void) {
        stop()
        guard let voice = Self.bestVoice else { onFinish(); return }
        let u = AVSpeechUtterance(string: text)
        u.voice = voice
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 1.02
        u.pitchMultiplier = 1.05
        u.preUtteranceDelay = 0.6               // let the orb fill first
        current = ObjectIdentifier(u)
        self.onWord = onWord
        self.onFinish = onFinish
        synth.speak(u)
    }

    func stop() {
        current = nil; onWord = nil; onFinish = nil   // detach first: the cancel callback must not report
        synth.stopSpeaking(at: .immediate)
    }

    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString r: NSRange, utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance), end = r.location + r.length
        Task { @MainActor in if id == self.current { self.onWord?(end) } }
    }
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { finished(utterance) }
    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) { finished(utterance) }
    private nonisolated func finished(_ utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in
            guard id == self.current else { return }
            let done = self.onFinish
            self.current = nil; self.onWord = nil; self.onFinish = nil
            done?()
        }
    }
}
