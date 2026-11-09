import SwiftUI

// MARK: - Fake but realistic morning data (throwaway spike)

enum Demo {
    static let dateLine = "Hétfő, november 9."
    static let greeting = "Jó reggelt, Dani"
    static let readiness = 78
    static let readinessWord = "Jó napod lesz"
    static let verdict = "Jól aludtál: a mélyalvás 18 perccel a heti átlagod felett, a nyugalmi pulzusod pedig két ütéssel lejjebb ment, vagyis a szombati edzést kiheverted. A naptárad 9-től 17:30-ig tele, a 18:00-s edzés belefér, de a hívás után csak fél órád marad. Ha teheted, told 18:30-ra. Ebédnél egyél legalább 45 g fehérjét, és este 22:45-re feküdj le, hogy holnap is ilyen formában ébredj."
    static let sleepTotal = "7ó 12p"
    static let sleepScore = 84
    static let restingHR = 57
    static let hrDelta = "−2 a heti átlaghoz"
    static let kcalTarget = 2350
    static let proteinTarget = 165
    static let moveKcal = 620
    static let weight = 82.4
    static let weightGoal = 79.0

    struct Stage: Identifiable { let id = UUID(); let name: String; let minutes: Int; let color: Color }
    static let stages: [Stage] = [
        .init(name: "Mély", minutes: 84, color: Boop.indigo),
        .init(name: "REM", minutes: 98, color: Boop.violet),
        .init(name: "Könnyű", minutes: 228, color: Boop.sky),
        .init(name: "Ébren", minutes: 22, color: Boop.peach),
    ]

    struct Event: Identifiable {
        let id = UUID(); let time: String; let title: String; let kind: Kind
        enum Kind { case work, food, train, sleep, conflict }
    }
    static let events: [Event] = [
        .init(time: "09:00", title: "Napi egyeztetés", kind: .work),
        .init(time: "10:30", title: "Termék workshop · 1ó 30p", kind: .work),
        .init(time: "12:30", title: "Ebéd · 45 g fehérje a cél", kind: .food),
        .init(time: "14:00", title: "Fejlesztés · fókusz blokk", kind: .work),
        .init(time: "17:30", title: "Ügyfélhívás · csúszhat", kind: .conflict),
        .init(time: "18:00", title: "Edzés · Push nap, 60 perc", kind: .train),
        .init(time: "22:45", title: "Lefekvés · 7ó 30p alvásért", kind: .sleep),
    ]
}

// MARK: - Palette

enum Boop {
    static let ink = Color(red: 0.10, green: 0.11, blue: 0.14)
    static let mute = Color(red: 0.45, green: 0.47, blue: 0.53)
    static let paper = Color(red: 0.97, green: 0.97, blue: 0.98)
    static let indigo = Color(red: 0.35, green: 0.36, blue: 0.85)
    static let violet = Color(red: 0.62, green: 0.45, blue: 0.95)
    static let sky = Color(red: 0.45, green: 0.72, blue: 0.98)
    static let mint = Color(red: 0.36, green: 0.82, blue: 0.66)
    static let peach = Color(red: 1.00, green: 0.66, blue: 0.48)
    static let sun = Color(red: 1.00, green: 0.80, blue: 0.40)
    static let night = Color(red: 0.05, green: 0.06, blue: 0.10)
}

// MARK: - The orb: a glass sphere (Metal shader) with flowing colour and a liquid that fills to `level`

struct Orb: View {
    var colors: [Color]
    var size: CGFloat = 220
    var level: Double = 1.0
    var glow: Bool = true
    @State private var start = Date()

    var body: some View {
        TimelineView(.animation) { tl in
            let e = tl.date.timeIntervalSince(start)
            let p = min(1.0, e / 1.8)
            let fill = level * (1 - pow(1 - p, 3))                    // ease-out fill on appear
            let c = colors + Array(repeating: colors.last ?? .white, count: max(0, 4 - colors.count))
            Rectangle()
                .frame(width: size, height: size)
                .colorEffect(ShaderLibrary.orb(
                    .float2(size, size), .float(Float(e)),
                    .color(c[0]), .color(c[1]), .color(c[2]), .color(c[3]),
                    .float(Float(fill)), .float(0), .float(0), .float(9), .float(0)))
                .scaleEffect(1 + 0.012 * sin(e * 1.9))               // barely-there breathing
                .background {
                    if glow {
                        Circle()
                            .fill(RadialGradient(colors: [c[2].opacity(0.55), c[0].opacity(0.25), .clear],
                                                 center: .center, startRadius: size * 0.2, endRadius: size * 0.75))
                            .frame(width: size * 1.5, height: size * 1.5)
                            .blur(radius: size * 0.12)
                            .opacity(0.75 + 0.2 * sin(e * 1.1))
                    }
                }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - A capsule that fills when it appears

struct FillCapsule: View {
    var value: Double          // 0...1
    var color: Color
    var label: String
    var amount: String
    var height: CGFloat = 120
    var track: Color = .black.opacity(0.06)
    var text: Color = Boop.ink
    @State private var shown = false

    var body: some View {
        VStack(spacing: 10) {
            ZStack(alignment: .bottom) {
                Capsule().fill(track)
                Capsule()
                    .fill(LinearGradient(colors: [color.opacity(0.75), color], startPoint: .top, endPoint: .bottom))
                    .frame(height: shown ? height * value : 0)
                    .overlay(alignment: .top) {
                        Capsule().fill(.white.opacity(0.35)).frame(height: 6).padding(.horizontal, 6).padding(.top, 5)
                    }
            }
            .frame(width: 44, height: height)
            .clipShape(Capsule())
            VStack(spacing: 2) {
                Text(amount).font(.system(.subheadline, design: .rounded).weight(.semibold)).foregroundStyle(text)
                Text(label).font(.caption).foregroundStyle(text.opacity(0.6))
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
        }
        .onAppear { withAnimation(.spring(response: 1.1, dampingFraction: 0.75).delay(0.25)) { shown = true } }
    }
}

// MARK: - Small helpers

struct SectionHead: View {
    var title: String
    var color: Color = Boop.mute
    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.semibold)).tracking(1.2)
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CheckinChips: View {
    var dark = false
    @State private var picked: Int? = nil
    let items = [("battery.25", "Fáradt"), ("face.smiling", "Rendben"), ("bolt.fill", "Szuper")]
    var body: some View {
        HStack(spacing: 10) {
            ForEach(items.indices, id: \.self) { i in
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { picked = i }
                } label: {
                    Label(items[i].1, systemImage: items[i].0)
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                        .background(Capsule().fill(picked == i ? Boop.indigo : (dark ? .white.opacity(0.08) : .black.opacity(0.05))))
                        .foregroundStyle(picked == i ? .white : (dark ? .white : Boop.ink))
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.selection, trigger: picked)
            }
        }
    }
}

extension Demo.Event.Kind {
    var icon: String {
        switch self {
        case .work: "briefcase"
        case .food: "fork.knife"
        case .train: "figure.strengthtraining.traditional"
        case .sleep: "moon.zzz"
        case .conflict: "exclamationmark.triangle"
        }
    }
    var tint: Color {
        switch self {
        case .work: Boop.sky
        case .food: Boop.sun
        case .train: Boop.mint
        case .sleep: Boop.violet
        case .conflict: Boop.peach
        }
    }
}
