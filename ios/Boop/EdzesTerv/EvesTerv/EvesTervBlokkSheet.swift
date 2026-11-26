import SwiftUI
import BoopCore
import BoopDesign

// 6b · One block of the year (mezo-r36n9.113, the approved spike's screen 6b): change its focus, move it a week,
// move it in the order (controller call 8: *Sorrend*), skip it — with what skipping costs (`skipConsequence`). Every
// edit goes to the server, which answers with the whole re-dated plan; the sheet reads its block from that answer. A
// running or finished block shows no edit controls; a planned block already linked to a planned run offers only the
// skip (the block builder edits the run).

struct EvesTervBlokkSheet: View {
    let model: YearPlanModel
    let blockId: String
    @Environment(\.dismiss) private var dismiss

    private var plan: WireYearPlan? {
        if case .ready(let p, _) = model.phase { return p }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                if let plan, let block = plan.block(blockId) {
                    content(block, plan: plan)
                        .padding(.horizontal, 22).padding(.top, 28).padding(.bottom, 20)
                } else {
                    Text("Ezt a mezociklust már nem találom.").nkFont(15).foregroundStyle(.white.opacity(0.7))
                        .padding(28)
                }
            }
            .scrollIndicators(.hidden)
            UjBlokkBottomBar(title: "Kész") { dismiss() }
        }
        .preferredColorScheme(.dark)
    }

    private func content(_ block: WireYearBlock, plan: WireYearPlan) -> some View {
        let status = EvesStatus(block, plan: plan)
        return VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                Text("\(block.ordinal). BLOKK · \(evesKindText(block)) · \(status.text.uppercased())")
                    .nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(planHue.glow)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Text(evesFocusTitle(block)).nkFont(30, design: .serif).foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(evesRange(block)) · \(block.weeks) hét (\(max(0, block.weeks - 1)) + 1 könnyítő)")
                    .nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
            if let e = model.actionError {
                Text(evesErrorText(e)).nkFont(13.5).foregroundStyle(planWarn).fixedSize(horizontal: false, vertical: true)
            }
            if status.isLocked {
                Text(status == .done ? "Ez a mezociklus lezárult, már nem változik." : "Ez a mezociklus most fut, ezért nem módosítható. A fókuszát a mezociklus oldalán állíthatod.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            } else if status == .skipped {
                skip(block, status: status)
            } else if let linked = evesLinkedPlannedText(block) {
                // Linked to a planned run: its focus, length and place are the run's — the block builder changes them.
                Text(linked).nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                skip(block, status: status)
            } else {
                focus(block)
                timing(block, plan: plan)
                order(block, plan: plan)
                skip(block, status: status)
            }
        }
        .disabled(model.saving)
    }

    // MARK: Fókusz

    private func focus(_ block: WireYearBlock) -> some View {
        let options = block.kind == "lower" ? evesLower : evesUpper
        let on = Set(block.focus)
        return VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Fókusz", trailing: "legfeljebb kettő")
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                ForEach(options, id: \.self) { g in
                    let selected = on.contains(g)
                    EvesChip(text: evesMuscle(g), on: selected, enabled: selected || on.count < YearPlanModel.focusMax) {
                        let next = selected ? block.focus.filter { $0 != g } : block.focus + [g]
                        guard (1...YearPlanModel.focusMax).contains(next.count), let id = block.id else { return }
                        Task { await model.setFocus(id, evesGroupOrder.filter(next.contains)) }
                    }
                }
            }
            Text("A fókusz Hangsúlyt kap, minden más Tartást: nullára egyik izom sem megy.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Időpont

    private func timing(_ block: WireYearBlock, plan: WireYearPlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Időpont")
            HStack(spacing: 8) {
                moveButton(left: true, "Egy héttel előbb", enabled: block.canMoveEarlier) {
                    if let id = block.id { Task { await model.shift(id, by: -1) } }
                }
                moveButton(left: false, "Egy héttel később", enabled: true) {
                    if let id = block.id { Task { await model.shift(id, by: 1) } }
                }
            }
            Text(plan.bufferWeeks > 0
                 ? "Ami utána jön, vele együtt mozog. A csúszást először \(evesNumArticle(plan.bufferWeeks)) \(plan.bufferWeeks) tartalék hét nyeli el, a lezárás marad az év végén."
                 : "Ami utána jön, vele együtt mozog. Tartalék hét már nincs: a csúszás a lezárást rövidíti, aztán az év végét tolja ki.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Sorrend

    private func order(_ block: WireYearBlock, plan: WireYearPlan) -> some View {
        let movable: (Int) -> Bool = { target in
            guard (1...max(1, plan.loadingBlocks)).contains(target),
                  let other = plan.blocks.first(where: { !$0.isConsolidation && $0.ordinal == target }) else { return false }
            return other.status == "planned" || other.status == "skipped"
        }
        return VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Sorrend")
            HStack(spacing: 8) {
                moveButton(left: true, "Előrébb a sorban", enabled: movable(block.ordinal - 1)) {
                    if let id = block.id { Task { await model.move(id, by: -1) } }
                }
                moveButton(left: false, "Hátrébb a sorban", enabled: movable(block.ordinal + 1)) {
                    if let id = block.id { Task { await model.move(id, by: 1) } }
                }
            }
            Text("Helyet cserél a szomszédjával; a dátumok a sorrendet követik.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Kihagyás

    private func skip(_ block: WireYearBlock, status: EvesStatus) -> some View {
        let lost = block.skipConsequence
        return VStack(alignment: .leading, spacing: 12) {
            UjBlokkLabel("Kihagyás")
            if status == .skipped {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Ezt a mezociklust kihagytad; a következők előrébb jöttek.").nkFont(13.5).foregroundStyle(.white.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                    Button { if let id = block.id { Task { await model.skip(id, false) } } } label: {
                        Text("Visszaveszem").nkFont(15, .semibold).foregroundStyle(.white)
                            .padding(.horizontal, 22).frame(minHeight: 44)
                            .background(Capsule().fill(.white.opacity(0.1)))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.06)))
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    if lost.isEmpty {
                        Text("Ha kihagyod, a következő mezociklusok előrébb jönnek, és minden izom máskor is sorra kerül.")
                            .nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    } else {
                        HStack(alignment: .top, spacing: 10) {
                            PlanMark(.flame, color: planWarn, size: 18).padding(.top, 1)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(lostTitle(lost)).nkFont(15, .semibold).foregroundStyle(planWarn)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(lost.count == 1
                                     ? "Ha kihagyod ezt a mezociklust, idén más mezociklus nem teszi fókuszba: egész évben Tartáson marad."
                                     : "Ha kihagyod ezt a mezociklust, idén más mezociklus nem teszi fókuszba őket: egész évben Tartáson maradnak.")
                                    .nkFont(13).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    Button { if let id = block.id { Task { await model.skip(id, true) } } } label: {
                        Text("Kihagyom").nkFont(15, .semibold).foregroundStyle(planWarn)
                            .padding(.horizontal, 22).frame(minHeight: 44)
                            .background(Capsule().stroke(planWarn.opacity(0.6), lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(planWarn.opacity(lost.isEmpty ? 0.05 : 0.1)))
            }
        }
    }

    /// „A vádli idén nem kapna fókuszt" / „A vádli és a far idén nem kapna fókuszt" (if he skipped it).
    private func lostTitle(_ lost: [String]) -> String {
        let list = evesList(lost)
        return list.prefix(1).uppercased() + list.dropFirst() + " idén nem kapna fókuszt"
    }

    private func moveButton(left: Bool, _ title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if left { Image(systemName: "chevron.left").font(.system(size: 12, weight: .semibold)) }
                Text(title).nkFont(14, .medium).lineLimit(1).minimumScaleFactor(0.7)
                if !left { Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)) }
            }
            .foregroundStyle(.white.opacity(enabled ? 1 : 0.3))
            .frame(maxWidth: .infinity, minHeight: 46)
            .background(Capsule().fill(.white.opacity(enabled ? 0.1 : 0.04)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}
