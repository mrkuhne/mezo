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

    /// Reduce Motion is about movement, not sound (final review I4): the text appears at once, no typing,
    /// but Boop still speaks; `isSpeaking` holds until the voice ends, so mute and "Mondd újra" behave the same.
    @Test func reducedMotionStillSpeaks() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: true)
        #expect(s.spoken == ["Jó reggelt. Az alvásod rendben volt."])
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
        #expect(v.isSpeaking)
        s.onWord?(10)                      // word callbacks do not re-type the text
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
        s.onFinish?()
        #expect(!v.isSpeaking)
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
    }

    @Test func reducedMotionWhenMutedShowsInstantlyInSilence() {
        let s = FakeSynth(); let v = voice(s, muted: true)
        v.speak(segments: segs, reduceMotion: true)
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
        #expect(s.spoken.isEmpty)
        #expect(!v.isSpeaking)
    }

    @Test func reducedMotionMuteMidSentenceStopsTheVoice() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: true)
        v.muted = true
        #expect(!v.isSpeaking)
        #expect(s.stops >= 1)
        #expect(v.shown == "Jó reggelt. Az alvásod rendben volt.")
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

    @Test func staleWordCallbackAfterReplayDoesNotChangeShown() {
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: segs, reduceMotion: false)
        let oldWord = s.onWord
        v.replay()
        oldWord?(20)
        #expect(v.shown.isEmpty)
    }

    @Test func multiUnitTextRevealsWholeWords() {
        let s = FakeSynth(); let v = voice(s)
        // "ű" and "ő" are single UTF-16 units; the last word uses a combining accent (o + U+0301 = 2 units, 1 Character)
        let text = "Tűrő hűvös reggel és o\u{301}"
        v.speak(segments: [Brief.Line(text: text, link: nil)], reduceMotion: false)
        s.onWord?(4);  #expect(v.shown == "Tűrő")
        s.onWord?(10); #expect(v.shown == "Tűrő hűvös")
        s.onWord?(2);  #expect(v.shown == "Tűrő hűvös")          // never backwards
        s.onWord?(text.utf16.count - 1)                           // lands between o and its combining mark: no crash
        #expect(text.unicodeScalars.starts(with: v.shown.unicodeScalars))
        s.onWord?(9999)                                           // beyond the end clamps
        #expect(v.shown == text)
    }

    @Test func wholeSentenceLinesAreJoinedWithOneSpace() {
        let lines = [Brief.Line(text: "Nyugodt napnak nézel elébe.", link: .sleep), Brief.Line(text: "A nyugalmi pulzusod rendben.", link: nil),
                     Brief.Line(text: "Ma edzés van. ", link: .day), Brief.Line(text: "Szép napot!", link: nil)]
        #expect(BoopVoice.spokenText(lines) == "Nyugodt napnak nézel elébe. A nyugalmi pulzusod rendben. Ma edzés van. Szép napot!")
        let s = FakeSynth(); let v = voice(s)
        v.speak(segments: lines, reduceMotion: false)
        #expect(s.spoken.first?.contains("elébe. A") == true)
    }
}
