import SwiftUI
import BoopCore
import BoopDesign

// Jelöltek (spike screen 3): the server's 1–3 flawless split candidates, the recommended one first, each with its week
// of session minutes against his limit and the reasons in his words; when nothing fits, the 3b content
// (`UjBlokkNemFer`). „Ezzel kezdem" generates, saves and starts the chosen one.

struct UjBlokkJeloltek: View {
    let model: NewBlockModel
    let onBack: () -> Void
    let onOpenSeason: (_ note: String?) -> Void
    /// The candidates on screen: kept while a refresh or the start is on its way.
    @State private var shown: WireCandidates?
    @State private var chosen = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            PlanSky(height: 260)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    content
                }
                .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
            .modifier(PlanInitialScroll())
        }
        .sensoryFeedback(.selection, trigger: chosen)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if let c = shown, !c.nothingFits, c.candidates.indices.contains(chosen) {
                VStack(spacing: 0) {
                    UjBlokkBottomBar(title: "Ezzel kezdem", enabled: model.phase != .creating) {
                        Task { await model.choose(c.candidates[chosen]) }
                    }
                    if let e = model.createError { UjBlokkStartError(error: e).background(NK.ground.opacity(0.95)) }
                }
            }
        }
        .onChange(of: model.phase, initial: true) { _, phase in
            guard case .candidates(let c) = phase else { return }
            if shown?.candidates.map(\.splitKey) != c.candidates.map(\.splitKey) {
                chosen = c.candidates.firstIndex { $0.recommended } ?? 0
            }
            shown = c
        }
        .task { if model.phase == .editing { await model.refresh() } }
    }

    @ViewBuilder private var content: some View {
        if case .failed(let e) = model.phase {
            head(title: "Most nem megy", sentence: nil)
            UjBlokkNotice(title: "Nem érem el a lehetőségeket", text: planErrorText(e)) { Task { await model.retry() } }
        } else if let c = shown {
            if c.nothingFits {
                head(title: "Nincs jó lehetőség", sentence: nothingFitsSentence)
                UjBlokkNemFer(model: model, candidates: c, onOpenSeason: onOpenSeason)
            } else {
                head(title: title(c.candidates.count),
                     sentence: "\(model.days.count) nap, legfeljebb \(model.minutes) perc, \(model.weeks) hét. Csak olyat mutatok, ami minden szabálynak megfelel.")
                ForEach(Array(c.candidates.enumerated()), id: \.element.splitKey) { i, candidate in
                    UjBlokkCandidateCard(candidate: candidate, limit: model.minutes, selected: chosen == i) {
                        withAnimation(reduceMotion ? nil : .snappy) { chosen = i }
                    }
                }
                startChoice
                Text("A percek pihenővel és bemelegítéssel együtt értendők. \(c.candidates.count > 1 ? "Mindegyikben" : "Ebben") minden izom legalább kétszer kap munkát hetente, és egy izom sem kap két egymást követő napon nehéz adagot.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).padding(.horizontal, 4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else {
            head(title: "Lehetőségek", sentence: nil)
            UjBlokkNotice(title: "Keresem a jó felosztásokat", text: "Egy pillanat, végignézem, mi fér bele a napjaidba és az idődbe.", loading: true)
        }
    }

    private func head(title: String, sentence: String?) -> some View {
        UjBlokkHead(eyebrow: "ÚJ BLOKK · 2/2", title: title, sentence: sentence, back: true, onClose: onBack)
    }

    private func title(_ n: Int) -> String {
        switch n {
        case 1: "Egy jó lehetőség"
        case 2: "Két jó lehetőség"
        default: "Három jó lehetőség"
        }
    }

    private var nothingFitsSentence: String {
        let emphasized = model.tiers.values.filter { $0 == "emphasize" }.count
        return "\(model.days.count) nap, legfeljebb \(model.minutes) perc, \(model.weeks) hét"
            + (emphasized > 0 ? ", \(emphasized) izom Hangsúlyon." : ".")
    }

    /// When the block starts: next Monday (planned) or today (active).
    private var startChoice: some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Mikor kezdjük")
            HStack(spacing: 6) {
                UjBlokkChoice(text: "Jövő hétfőn", on: model.startChoice == .nextMonday) { model.startChoice = .nextMonday }
                UjBlokkChoice(text: "Ma", on: model.startChoice == .today) { model.startChoice = .today }
            }
        }
        .padding(.top, 4)
    }
}

/// Why „Ezzel kezdem" did not go through, under the button that tries again.
struct UjBlokkStartError: View {
    let error: PlanFetchError
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            PlanMark(.shield, color: planWarn, size: 14).padding(.top, 2)
            Text("Nem sikerült elindítani. \(planErrorText(error))").nkFont(13).foregroundStyle(planWarn)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24).padding(.bottom, 6)
        .accessibilityElement(children: .combine)
    }
}

struct UjBlokkCandidateCard: View {
    let candidate: WireCandidate
    let limit: Int
    let selected: Bool
    let select: () -> Void

    private var over: Bool { candidate.longest > limit }

    var body: some View {
        Button(action: select) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 10) {
                    VStack(alignment: .leading, spacing: 5) {
                        if candidate.recommended {
                            Text("AJÁNLOTT").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                                .foregroundStyle(NK.ground)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Capsule().fill(planHue.glow))
                        } else if over {
                            Text("TÚLLÉPI A \(limit) PERCET").nkFont(9, .semibold, design: .monospaced).tracking(1.2)
                                .foregroundStyle(planWarn)
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(Capsule().fill(planWarn.opacity(0.16)))
                        }
                        Text(candidate.splitLabel).nkFont(22, design: .serif).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        if let line = candidate.dayLine {
                            Text(line).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 0) {
                        Text("~\(candidate.longest)").font(.nkNumber(34)).foregroundStyle(over ? planWarn : .white)
                        Text("perc").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                    }
                    selectMark
                }
                UjBlokkDayBars(minutes: UjBlokkDayBars.minutes(candidate.evaluation), limit: limit)
                let lines = candidate.reasons.compactMap { planReasonLine($0, target: limit) }
                if !lines.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, l in UjBlokkWhyLine(tone: l.tone, text: l.text) }
                    }
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(.white.opacity(selected ? 0.1 : 0.04)))
            .nkGlass(26)
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(selected ? 0.85 : 0), lineWidth: 1.5))
            .contentShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var selectMark: some View {
        ZStack {
            Circle().stroke(.white.opacity(selected ? 0 : 0.3), lineWidth: 1.5)
            if selected {
                Circle().fill(.white)
                PlanMark(.check, color: NK.ground, size: 13)
            }
        }
        .frame(width: 24, height: 24)
    }
}
