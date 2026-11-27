import SwiftUI
import BoopCore
import BoopDesign

/// Évad › **Kísérlet**: the hero is the running experiment's progress ring (or, with none running, the empty picture and
/// „Új kísérlet"); under it the experiments as they were on the old Hatás tab — Boop's proposal, the running one's day
/// ticks, the finished ones.
struct EvadKiserlet: View {
    let exp: EvadExperimentStore
    let open: @MainActor (EvadRoomSub) -> Void

    var body: some View {
        if let r = exp.data?.running {
            hero(r)
        } else if exp.data != nil {
            VStack(spacing: 14) {
                EvadEmptyIllustration().frame(height: 130)
                Text("Most nem fut kísérlet").nkFont(20, design: .serif).foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                EvadText("Két-három hétig kipróbálsz valamit, és Boop megmutatja, változott-e valami a korábbi napjaidhoz képest.")
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .nkGlass()
        }
        EvadEffectTab(exp: exp, openResult: { open(.experiment($0)) }, openNew: { open(.newExperiment) })
    }

    private func hero(_ r: EvadExperiment) -> some View {
        let level = evadRunningLevel(r)
        return HStack(spacing: 16) {
            ZStack {
                Circle().stroke(.white.opacity(0.12), lineWidth: 9)
                Circle().trim(from: 0, to: level)
                    .stroke(LinearGradient(colors: [evadHue.orb[1], evadHue.glow], startPoint: .top, endPoint: .bottom),
                            style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(r.dayIndex ?? 0)").font(.custom(Lagy.outfitFamily, size: 30).weight(.light)).foregroundStyle(.white)
                    Text("/ \(r.lengthDays) nap").nkFont(11).foregroundStyle(.white.opacity(0.6))
                }
            }
            .frame(width: 96, height: 96)
            VStack(alignment: .leading, spacing: 4) {
                NKMono("FUT · \(evadDayCount(r).uppercased())")
                Text(r.title).nkFont(18, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
        .accessibilityElement(children: .combine)
    }
}
