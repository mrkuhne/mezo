import SwiftUI
import BoopCore
import BoopDesign

// Nothing fits (spike screen 3b): no split passes every rule with these settings. The server's fixes as buttons
// („Legyen 75 perc", „Egy izom Hangsúly helyett Építés", „Legyen 5 nap"), and the closest plan kept apart, grey, never
// offered as a normal choice.

struct UjBlokkNemFer: View {
    let model: NewBlockModel
    let candidates: WireCandidates
    let onOpenSeason: (_ note: String?) -> Void
    @State private var showClosest = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var closest: WireCandidate? { candidates.candidates.first }

    var body: some View {
        card
        if let closest { closestCard(closest) }
    }

    private var card: some View {
        let longest = closest?.longest ?? 0
        let overTime = longest > model.minutes
        let fixes = candidates.fixes.compactMap { f in planFixTitle(f, days: model.days.count).map { (f, $0) } }
        return VStack(alignment: .leading, spacing: 14) {
            PlanMark(.timer, color: planHue.glow, size: 26)
            Text(overTime ? "Ebbe az időbe most nem fér bele jó terv" : "Így most nem fér bele jó terv")
                .nkFont(23, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text((overTime ? "A legrövidebb felosztásnál is kb. \(longest) perc lenne egy nap, a határod \(model.minutes) perc. " : "")
                 + "Hibás tervet nem ajánlok, inkább megmutatom, min múlik.")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            if !fixes.isEmpty {
                Text("EZ MEGOLDANÁ").nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                    .padding(.top, 4)
                VStack(spacing: 8) {
                    ForEach(Array(fixes.enumerated()), id: \.offset) { _, item in
                        fixButton(item.1, sub(item.0)) { apply(item.0) }
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(26)
    }

    private func sub(_ fix: WireFix) -> String {
        switch fix.code {
        case "more_minutes": "újra megnézem vele"
        case "fewer_emphasis": model.fewerEmphasisMuscle(fix).map { "\(SubMuscles.groupName($0)) Építésre megy" } ?? "az Alapoknál állíthatod"
        default: "az Évad oldalon"
        }
    }

    private func apply(_ fix: WireFix) {
        if model.applyFix(fix) == .needsSeasonDays {
            onOpenSeason("Az edzésnapok számát az évadodnál állíthatod át.")
        }
    }

    private func fixButton(_ title: String, _ sub: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(reduceMotion ? nil : .snappy) { action() } } label: {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15, .semibold).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.5))
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.08)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// The closest plan, kept apart and grey.
    private func closestCard(_ c: WireCandidate) -> some View {
        let longer = c.longest - model.minutes
        return VStack(alignment: .leading, spacing: 12) {
            Button { withAnimation(reduceMotion ? nil : .snappy) { showClosest.toggle() } } label: {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("a legközelebbi, ha mégis kéred").nkFont(13).foregroundStyle(.white.opacity(0.55))
                        Text("\(c.splitLabel) · ~\(c.longest) perc" + (longer > 0 ? " · \(longer) perccel hosszabb" : ""))
                            .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 6)
                    Image(systemName: showClosest ? "chevron.up" : "chevron.down").font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showClosest {
                UjBlokkDayBars(minutes: UjBlokkDayBars.minutes(c.evaluation), limit: model.minutes)
                Button { Task { await model.choose(c) } } label: {
                    Text("Mégis ezt kérem").nkFont(14, .medium).foregroundStyle(.white.opacity(0.7))
                        .padding(.horizontal, 18).frame(minHeight: 40)
                        .background(Capsule().stroke(.white.opacity(0.25), lineWidth: 1))
                }
                .buttonStyle(.plain)
                if let e = model.createError {
                    Text("Nem sikerült elindítani. \(planErrorText(e))").nkFont(13).foregroundStyle(planWarn)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.1), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
        .opacity(0.85)
    }
}
