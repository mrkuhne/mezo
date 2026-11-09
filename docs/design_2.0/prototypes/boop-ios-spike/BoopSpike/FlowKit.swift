import SwiftUI

// MARK: - Shared frame for every morning screen

struct FlowScaffold<Content: View>: View {
    var eyebrow: String
    var title: String
    var mood: Mood
    @ViewBuilder var content: Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(colors: [mood.sky, Boop.night, Boop.night], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(eyebrow.uppercased())
                            .font(.caption.weight(.bold)).tracking(2)
                            .foregroundStyle(mood.colors[2])
                        Text(title)
                            .font(.system(size: 32, weight: .semibold, design: .serif))
                            .foregroundStyle(.white)
                    }
                    .padding(.top, 64)
                    content
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 48)
            }
            .scrollIndicators(.hidden)
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).frame(width: 36, height: 36)
            }
            .buttonStyle(.glass)
            .padding(.trailing, 18).padding(.top, 6)
            .accessibilityLabel("Bezárás")
        }
        .preferredColorScheme(.dark)
    }
}

/// Boop talking inside a screen: a small living orb + the typed (and spoken) text.
struct BoopSays: View {
    var segs: [Seg]
    var mood: Mood
    var title: String? = nil
    @State private var motion = OrbMotion()
    @State private var typer = Typer()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            LivingOrb(mood: mood, size: 46, motion: motion)
                .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 8) {
                Text(title ?? "BOOP").font(.caption.weight(.bold)).tracking(2).foregroundStyle(mood.colors[2])
                BoopVoice(segs: segs, shown: typer.shown)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 26).fill(.white.opacity(0.06)))
        .overlay(RoundedRectangle(cornerRadius: 26).stroke(.white.opacity(0.08)))
        .onAppear { typer.run(segs, motion: motion, instant: reduceMotion) }
    }
}

struct PrimaryButton: View {
    var title: String
    var icon: String = "arrow.right"
    var tint: Color = Boop.indigo
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.glassProminent)
        .tint(tint)
        .controlSize(.large)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 24).fill(.white.opacity(0.05)))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.08)))
    }
}

// MARK: - The morning path on the main screen

enum Moment: String, CaseIterable, Identifiable {
    case sleep, checkin, intention, weight, meal, patterns
    var id: String { rawValue }
    var title: String {
        switch self {
        case .sleep: "Alvás"
        case .checkin: "Hogy vagy?"
        case .intention: "Mai szándék"
        case .weight: "Mérlegelés"
        case .meal: "Első étkezés"
        case .patterns: "Boop észrevette"
        }
    }
    var icon: String {
        switch self {
        case .sleep: "moon.zzz.fill"
        case .checkin: "heart.text.square.fill"
        case .intention: "scope"
        case .weight: "scalemass.fill"
        case .meal: "fork.knife"
        case .patterns: "sparkles"
        }
    }
    var hint: String {
        switch self {
        case .sleep: "7ó 12p · Sleep Cycle-ből beolvasva"
        case .checkin: "Reggeli checkin · 6 kérdés"
        case .intention: "Fókusz és a mai 3 cél"
        case .weight: "Tegnap 82,6 kg"
        case .meal: "Fotó vagy pár szó"
        case .patterns: "2 új összefüggés"
        }
    }
}

struct MorningPath: View {
    var mood: Mood
    var done: [Moment: String]
    var open: (Moment) -> Void

    private var next: Moment? { Moment.allCases.first { done[$0] == nil } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHead(title: "A reggeled", color: .white.opacity(0.5)).padding(.bottom, 12)
            ForEach(Array(Moment.allCases.enumerated()), id: \.element) { i, m in
                let isDone = done[m] != nil
                let isNext = m == next
                Button { if m != .sleep { open(m) } } label: {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(isDone ? mood.colors[2].opacity(0.9) : .white.opacity(isNext ? 0.14 : 0.06))
                            Image(systemName: isDone ? "checkmark" : m.icon)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(isDone ? Boop.night : .white.opacity(isNext ? 1 : 0.6))
                        }
                        .frame(width: 38, height: 38)
                        .overlay(alignment: .bottom) {
                            if i < Moment.allCases.count - 1 {
                                Capsule().fill(.white.opacity(0.1)).frame(width: 2, height: 22).offset(y: 30)
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(m.title).font(.headline).foregroundStyle(.white.opacity(isDone || isNext ? 1 : 0.7))
                            Text(done[m] ?? m.hint).font(.subheadline).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                        }
                        Spacer()
                        if isNext {
                            Text("most").font(.caption.weight(.bold))
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Capsule().fill(mood.colors[0]))
                                .foregroundStyle(.white)
                        } else if !isDone && m != .sleep {
                            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.white.opacity(0.3))
                        }
                    }
                    .padding(.vertical, 8)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(20)
        .background(RoundedRectangle(cornerRadius: 28).fill(.white.opacity(0.05)))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.08)))
    }
}
