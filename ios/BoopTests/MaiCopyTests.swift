import Testing
import BoopCore
import BoopDesign
@testable import Boop

struct MaiCopyTests {
    private func copy(_ key: MetricKey, score: Int? = 74, display: String = "74", caption: String? = "jó formában",
                      learning: Bool = false) -> MaiCopy {
        maiCopy(key: key, score: score, display: display, caption: caption, headline: "Elég jó reggel",
                sentence: "Az edzésnapot bírni fogod.", learning: learning)
    }

    @Test func metricKeyAndHueBridgeBothWaysForAllFive() {
        let pairs: [(MetricKey, Hue)] = [(.forma, .forma), (.alvas, .alvas), (.mozgas, .mozgas), (.fuel, .fuel), (.pulzus, .pulzus)]
        for (k, h) in pairs {
            #expect(hue(for: k) == h)
            #expect(metricKey(for: h) == k)
        }
        #expect(MetricKey.allCases.map { hue(for: $0) } == Hue.allCases)
    }

    @Test func firstMetricIsCalledForma() {
        #expect(hue(for: .forma).name == "Forma")
        #expect(copy(.forma).caps == "FORMA")
        #expect(copy(.forma).name == "Forma")
    }

    @Test func nullScoreShowsDashNeverZero() {
        let c = copy(.fuel, score: nil, display: "0", caption: nil)
        #expect(c.orbDisplay == "–")
        #expect(c.miniValue == "–")
        #expect(c.score == nil)
        #expect(!c.orbDisplay.contains("0"))
    }

    @Test func learningHidesTheScoreAndSaysSo() {
        let c = copy(.forma, learning: true)
        #expect(c.score == nil)
        #expect(c.orbDisplay == "–")
        #expect(c.orbCaption == "még tanulom")
    }

    @Test func scoredMetricShowsItsDisplayInTheHeroAndTheScoreInTheMiniOrb() {
        let alvas = copy(.alvas, score: 78, display: "7ó 12p", caption: "mély 1ó 28p")
        #expect(alvas.orbDisplay == "7ó 12p")
        #expect(alvas.miniValue == "78")
        // Pulzus shows bpm in both orbs
        let pulzus = copy(.pulzus, score: 66, display: "57", caption: "nyugalmi")
        #expect(pulzus.orbDisplay == "57")
        #expect(pulzus.miniValue == "57")
    }

    @Test func formaDoneTurnsThePillIntoBoopSpeaking() {
        #expect(lensPill(nil).title == "Boop elmondja")
        #expect(lensPill(nil).speaks)
        let checkin = LensAction(glyph: "pen-sun", title: "Kitöltöm", kind: .checkin)
        #expect(lensPill(checkin).title == "Kitöltöm")
        #expect(!lensPill(checkin).speaks)
    }

    @Test func s4ActionsSayHamarosan() {
        #expect(soonToast("Kitöltöm") == "Kitöltöm · hamarosan")
    }

    @Test func noMezoAnywhereInTheMaiCopy() {
        var all: [String] = []
        for k in MetricKey.allCases {
            for learning in [false, true] {
                let c = copy(k, learning: learning)
                all += [c.name, c.caps, c.headline, c.sentence, c.orbDisplay, c.miniValue, c.orbCaption ?? ""]
                let n = copy(k, score: nil, display: "–", caption: nil, learning: learning)
                all += [n.headline, n.sentence, n.orbCaption ?? ""]
            }
        }
        let actions: [LensAction?] = [nil,
            LensAction(glyph: "pen-sun", title: "Kitöltöm", kind: .checkin),
            LensAction(glyph: "moon-cream", title: "Lefekvés 22:30 · Emlékeztess", kind: .bedtime),
            LensAction(glyph: "dumbbell-ink", title: "Edzés indítása", kind: .workout),
            LensAction(glyph: "camera-ink", title: "Lefotózom", kind: .photo),
            LensAction(glyph: "heart-cream", title: "Légzés · 1 perc", kind: .breath)]
        all += actions.map { lensPill($0).title }
        all += fuelChips.map(\.title) + workoutMenu(sessionTitle: "Vállak és hát")
        all += [MaiText.breathDone, MaiText.inhale, MaiText.exhale, MaiText.breathLine, MaiText.breathEnded,
                MaiText.mute, MaiText.unmute, MaiText.replay, MaiText.speak, soonToast("Lefotózom")]
        all += [MaiText.problemCaps, MaiText.problemTitle, MaiText.problemSentence, MaiText.retry]
        all += [loadingCopy.caps, loadingCopy.title, loadingCopy.sentence]
        for s in all { #expect(!s.localizedCaseInsensitiveContains("mezo"), "\(s)") }
    }
}
