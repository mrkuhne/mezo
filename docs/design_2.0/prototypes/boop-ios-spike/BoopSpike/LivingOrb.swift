import SwiftUI
import CoreMotion
import Observation
import AVFoundation

// MARK: - Mood: the day's state drives colour, level and words

enum Mood: Int, CaseIterable, Identifiable {
    case good, okay, tired
    var id: Int { rawValue }
    var label: String { ["Jó", "Közepes", "Fáradt"][rawValue] }
    var readiness: Int { [78, 58, 34][rawValue] }
    var headline: String { ["Jó napod lesz", "Átlagos nap jön", "Kíméld ma magad"][rawValue] }
    var colors: [Color] {
        switch self {
        case .good:  [Boop.indigo, Boop.violet, Boop.sky, Boop.mint]
        case .okay:  [Color(red: 0.16, green: 0.55, blue: 0.62), Boop.mint, Boop.sun, Boop.sky]
        case .tired: [Color(red: 0.80, green: 0.36, blue: 0.20), Boop.peach, Color(red: 0.92, green: 0.42, blue: 0.52), Boop.sun]
        }
    }
    var sky: Color {
        switch self {
        case .good:  Color(red: 0.13, green: 0.10, blue: 0.28)
        case .okay:  Color(red: 0.06, green: 0.16, blue: 0.20)
        case .tired: Color(red: 0.22, green: 0.10, blue: 0.10)
        }
    }

    /// What Boop says. A segment with a `link` is emphasised and tappable.
    var verdict: [Seg] {
        switch self {
        case .good: [
            .init("Jól aludtál: a mélyalvás "), .init("18 perccel a heti átlagod felett", "sleep"),
            .init(", a nyugalmi pulzusod pedig "), .init("két ütéssel lejjebb ment", "heart"),
            .init(", vagyis a szombati edzést kiheverted. A naptárad 9-től 17:30-ig tele, a 18:00-s edzés belefér, de a hívás után csak fél órád marad. Ha teheted, "),
            .init("told 18:30-ra", "day"),
            .init(". Ebédnél egyél legalább 45 g fehérjét, és este 22:45-re feküdj le, hogy holnap is ilyen formában ébredj."),
        ]
        case .okay: [
            .init("Az alvásod rendben volt, de "), .init("a REM rövidebb lett a szokásosnál", "sleep"),
            .init(". A pulzusod az átlagodon van. Dolgos nap jön, ezért az edzést tartsd meg, csak "),
            .init("egy sorozattal kevesebbel", "day"), .init(". Délután 3 körül várható egy mélypont, oda tegyél egy rövid sétát."),
        ]
        case .tired: [
            .init("Rövid és nyugtalan éjszaka volt: "), .init("csak 5 óra 40 perc alvás", "sleep"),
            .init(", és a nyugalmi pulzusod "), .init("öt ütéssel magasabb", "heart"),
            .init(" a szokásosnál. Ma ne erőltesd az edzést: "), .init("cseréld le egy laza sétára", "day"),
            .init(", igyál sok vizet, és este korán feküdj le."),
        ]
        }
    }
}

struct Seg { let text: String; let link: String?; init(_ t: String, _ l: String? = nil) { text = t; link = l } }

// MARK: - Physics + sensors behind the orb

@Observable final class OrbMotion {
    var tilt: Double = 0                 // surface slope, springy
    var speak: Double = 0                // 0...1, eases toward `talking`
    var talking = false
    var rippleX: Double = 0
    var rippleDate = Date.distantPast
    var dragTarget: Double? = nil

    @ObservationIgnored private var vel: Double = 0
    @ObservationIgnored private var gravityTarget: Double = 0
    @ObservationIgnored private let motion = CMMotionManager()
    @ObservationIgnored private var timer: Timer?

    func start() {
        guard timer == nil else { return }
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 60
            motion.startDeviceMotionUpdates(to: .main) { [weak self] m, _ in
                guard let self, let g = m?.gravity else { return }
                self.gravityTarget = max(-0.55, min(0.55, g.x * 0.8))
            }
        }
        let t = Timer(timeInterval: 1.0 / 60, repeats: true) { [weak self] _ in self?.step() }
        RunLoop.main.add(t, forMode: .common)      // keep sloshing while the page scrolls
        timer = t
    }

    func stop() { timer?.invalidate(); timer = nil; motion.stopDeviceMotionUpdates() }

    func tap(atX x: Double) { rippleX = x; rippleDate = Date() }

    /// A spoken word: a small surge in the liquid.
    func kick() { speak = min(1.4, speak + 0.45) }

    private func step() {
        let target = dragTarget ?? gravityTarget
        let acc = 34 * (target - tilt) - 2.6 * vel   // under-damped spring → slosh and settle
        vel += acc / 60
        tilt += vel / 60
        speak += ((talking ? 0.7 : 0) - speak) * 0.07
    }
}

// MARK: - The living orb

struct LivingOrb: View {
    var mood: Mood
    var size: CGFloat = 260
    var motion: OrbMotion
    @State private var start = Date()
    @State private var taps = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { tl in
            let e = tl.date.timeIntervalSince(start)
            let p = min(1.0, e / 1.8)
            let fill = Double(mood.readiness) / 100 * (1 - pow(1 - p, 3))
            let c = mood.colors
            Rectangle()
                .frame(width: size, height: size)
                .colorEffect(ShaderLibrary.orb(
                    .float2(size, size), .float(Float(e)),
                    .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
                    .float(Float(fill)), .float(Float(motion.tilt)),
                    .float(Float(motion.rippleX)), .float(Float(tl.date.timeIntervalSince(motion.rippleDate))),
                    .float(Float(motion.speak))))
                .scaleEffect(1 + 0.012 * sin(e * 1.9) + 0.02 * motion.speak)
                .background {
                    Circle()
                        .fill(RadialGradient(colors: [c[2].opacity(0.55), c[0].opacity(0.25), .clear],
                                             center: .center, startRadius: size * 0.2, endRadius: size * 0.75))
                        .frame(width: size * 1.5, height: size * 1.5)
                        .blur(radius: size * 0.12)
                        .opacity(0.7 + 0.2 * sin(e * 1.1) + 0.25 * motion.speak)
                }
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 6)
                .onChanged { v in motion.dragTarget = max(-0.55, min(0.55, v.translation.width / size * 1.1)) }
                .onEnded { _ in motion.dragTarget = nil }
        )
        .simultaneousGesture(
            SpatialTapGesture().onEnded { v in
                motion.tap(atX: Double(v.location.x / size) * 2 - 1)
                taps += 1
            }
        )
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.7), trigger: taps)
        .onChange(of: mood) { start = Date() }     // refill when the state changes
        .onAppear { motion.start() }
        .accessibilityLabel("Készenlét \(mood.readiness) százalék")
    }
}

// MARK: - Boop's voice: typed out, key phrases emphasised and tappable

@Observable final class Typer: NSObject, AVSpeechSynthesizerDelegate {
    var shown = 0
    var total = 0
    var voiceOn = UserDefaults.standard.object(forKey: "voiceOn") as? Bool ?? true {
        didSet { UserDefaults.standard.set(voiceOn, forKey: "voiceOn"); if !voiceOn { synth.stopSpeaking(at: .word) } }
    }
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var text: [Character] = []
    @ObservationIgnored private let synth = AVSpeechSynthesizer()
    @ObservationIgnored private weak var motion: OrbMotion?

    override init() { super.init(); synth.delegate = self }

    /// Best Hungarian voice on the device (premium > enhanced > default).
    private static var voice: AVSpeechSynthesisVoice? {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("hu") }
            .max { $0.quality.rawValue < $1.quality.rawValue }
            ?? AVSpeechSynthesisVoice(language: "hu-HU")
    }

    func run(_ segs: [Seg], motion: OrbMotion, instant: Bool) {
        timer?.invalidate()
        synth.stopSpeaking(at: .immediate)
        self.motion = motion
        let full = segs.map(\.text).joined()
        text = Array(full)
        total = text.count
        if instant { shown = total; return }
        shown = 0
        motion.talking = true
        if voiceOn, let v = Self.voice {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try? AVAudioSession.sharedInstance().setActive(true)
            let u = AVSpeechUtterance(string: full)
            u.voice = v
            u.rate = AVSpeechUtteranceDefaultSpeechRate * 1.02
            u.pitchMultiplier = 1.05
            u.preUtteranceDelay = 0.6          // let the orb fill first
            synth.speak(u)                      // the delegate drives the typing, word by word
        } else {
            schedule(motion)
        }
    }

    // Typing follows the voice exactly: each spoken word appears as it is said.
    func speechSynthesizer(_ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString r: NSRange, utterance: AVSpeechUtterance) {
        let end = min(total, r.location + r.length)
        DispatchQueue.main.async {
            self.shown = max(self.shown, end)
            self.motion?.kick()
        }
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) { finish() }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) { finish() }
    private func finish() {
        DispatchQueue.main.async {
            self.shown = self.total
            self.motion?.talking = false
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func schedule(_ motion: OrbMotion) {
        guard shown < total else { motion.talking = false; return }
        let ch = text[shown]
        let delay = ",.:".contains(ch) ? 0.16 : 0.018
        let t = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
            guard let self else { return }
            self.shown = min(self.total, self.shown + 2)
            self.schedule(motion)
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }
}

struct BoopVoice: View {
    var segs: [Seg]
    var shown: Int

    var body: some View {
        ZStack(alignment: .topLeading) {
            Text(build(Int.max)).hidden()                 // reserve the final height: no jumping
            Text(build(shown))
        }
        .font(.system(size: 19, weight: .regular, design: .serif))
        .lineSpacing(5)
        .foregroundStyle(.white.opacity(0.78))
        .tint(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func build(_ n: Int) -> AttributedString {
        var out = AttributedString()
        var left = n
        for s in segs {
            guard left > 0 else { break }
            var a = AttributedString(String(s.text.prefix(left)))
            left -= s.text.count
            if let l = s.link {
                a.link = URL(string: "boop://\(l)")
                a.foregroundColor = .white
                a.font = .system(size: 19, weight: .semibold, design: .serif)
                a.underlineStyle = Text.LineStyle(pattern: .dot, color: .white.opacity(0.45))
            }
            out += a
        }
        return out
    }
}
