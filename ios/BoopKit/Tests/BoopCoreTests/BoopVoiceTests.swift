import Foundation
import Testing
@testable import BoopCore

@MainActor
final class FakeSynth: SpeechSynthesizing {
    var hasVoice = true
    private(set) var spoken: [String] = []
    private(set) var stops = 0
    var onWord: (@MainActor (Int) -> Void)?
    var onFinish: (@MainActor () -> Void)?
    func speak(_ text: String, onWord: @escaping @MainActor (Int) -> Void, onFinish: @escaping @MainActor () -> Void) {
        spoken.append(text); self.onWord = onWord; self.onFinish = onFinish
    }
    func stop() { stops += 1 }
}

@MainActor
struct BoopVoiceTests {
    let segs = [Brief.Line(text: "Jó reggelt. ", link: nil), Brief.Line(text: "Az alvásod ", link: .sleep), Brief.Line(text: "rendben volt.", link: nil)]

    func voice(_ synth: FakeSynth, muted: Bool = false, interval: Duration = .milliseconds(1)) -> BoopVoice {
        let d = UserDefaults(suiteName: "BoopVoiceTests-\(UUID().uuidString)")!
        d.set(muted, forKey: BoopVoice.mutedKey)
        return BoopVoice(synthesizer: synth, defaults: d, silentWordInterval: interval)
    }

    @Test func segmentsJoinIntoTheSpokenText() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: false)
        #expect(s.spoken == ["Jó reggelt. Az alvásod rendben volt."])
        #expect(v.shown.isEmpty)
        s.onWord?(10)                      // "Jó reggelt" spoken
        #expect(v.shown == "Jó reggelt")
        #expect(v.isSpeaking)
        s.onFinish?()
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
        #expect(!v.isSpeaking)
    }

    @Test func instantWhenReducedMotion() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: true)
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
        #expect(s.spoken.isEmpty)
        #expect(!v.isSpeaking)
    }

    @Test func mutedDoesNotSpeak() async {
        let s = FakeSynth(); let v = voice(s, muted: true)
        v.speak(segments: segs, reduceMotion: false)
        #expect(s.spoken.isEmpty)
        for _ in 0..<200 where v.isSpeaking { try? await Task.sleep(for: .milliseconds(10)) }
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
    }

    @Test func noHungarianVoiceRevealsSilently() async {
        let s = FakeSynth(); s.hasVoice = false; let v = voice(s)
        v.speak(segments: segs, reduceMotion: false)
        for _ in 0..<200 where v.isSpeaking { try? await Task.sleep(for: .milliseconds(10)) }
        #expect(s.spoken.isEmpty)
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
    }

    @Test func replayRestartsFromTheBeginning() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: false)
        s.onWord?(20)
        #expect(!v.shown.isEmpty)
        v.replay()
        #expect(v.shown.isEmpty)
        #expect(s.spoken.count == 2)
        #expect(s.stops >= 1)
    }

    @Test func staleCallbacksOfAReplacedUtteranceAreIgnored() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: false)
        let oldFinish = s.onFinish
        v.replay()
        oldFinish?()                        // the cancelled utterance reports back late
        #expect(v.shown.isEmpty)
        #expect(v.isSpeaking)
    }

    @Test func mutedPersists() {
        let s = FakeSynth()
        let d = UserDefaults(suiteName: "BoopVoiceTests-\(UUID().uuidString)")!
        let v = BoopVoice(synthesizer: s, defaults: d)
        v.muted = true
        #expect(BoopVoice(synthesizer: s, defaults: d).muted)
    }
}
