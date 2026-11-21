import SwiftUI
import BoopCore
import BoopDesign

/// **Hatás** (screen 07, Évad S4, `mezo-r36n9.16`): experiments he starts or Boop proposes, one at a time, with honest
/// results. Boop's proposal as the highlight (Indulhat / Most nem), the running one with its day count, what is watched,
/// the overlaps and today's tick („Ma megvolt"), then the finished ones. Every verdict and number is the server's.
struct EvadEffectTab: View {
    let exp: EvadExperimentStore
    let openResult: @MainActor @Sendable (String) -> Void
    let openNew: @MainActor @Sendable () -> Void
    @State private var confirmStop = false

    var body: some View {
        Group {
            if let d = exp.data {
                content(d)
            } else if let p = exp.problem {
                NKBare("Kísérletek", hue: evadHue, glyph: "chart-deep", state: .failed(evadErrorText(p), {
                    Task { await exp.load(force: true) }
                })) { EmptyView() }
            } else {
                NKBare("Kísérletek", hue: evadHue, glyph: "chart-deep", state: .loading) { EmptyView() }
            }
        }
        .task { await exp.load() }
    }

    @ViewBuilder private func content(_ d: EvadExperiments) -> some View {
        if let age = exp.ageText { EvadLine(text: "Offline vagy, ez a \(age) állapot.") }
        if d.isEmpty {
            NKNote("Egy kísérletben két-három hétig kipróbálsz valamit, például egy esti sétát vagy egy új étrend-kiegészítőt. A végén megmutatom, változott-e az alvásod, a pulzusod vagy a közérzeted a korábbi napjaidhoz képest.", hue: evadHue)
        }
        if let p = d.proposal {
            NKHighlight(hue: evadHue, label: "Boop ötlete", text: evadProposalText(p), sub: evadCompareSentence(p),
                        actions: [NKHighlightAction("Indulhat", action: { Task { await exp.start(p.id) } }),
                                  NKHighlightAction("Most nem", weight: .secondary, action: { Task { await exp.dismiss(p.id) } })])
        }
        if let r = d.running { running(r) }
        if let problem = exp.actionProblem { EvadLine(text: problem) }
        if !d.past.isEmpty {
            NKBare("Korábbi kísérletek", hue: evadHue, glyph: "chart-deep") {
                NKRowList(d.past.map(row), hue: evadHue)
            }
        }
        NKActions([NKAction(glyph: "plus-ink", title: "Új kísérlet", primary: true, action: openNew)], hue: evadHue)
    }

    private func running(_ r: EvadExperiment) -> some View {
        let done = evadMarkedToday(r, today: exp.today)
        return NKBare("Folyamatban", hue: evadHue, glyph: "clock-ink", trailing: "egyszerre csak egy") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text(r.title).nkFont(19, design: .serif).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Text(evadDayCount(r)).font(.nkNumber(16)).foregroundStyle(evadHue.glow).lineLimit(1)
                }
                NKLevelBar(level: evadRunningLevel(r), hue: evadHue)
                Text(evadRunningLine(r))
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                ForEach(r.overlaps, id: \.self) { o in NKTag(o.text, warn: true) }
                HStack(spacing: 12) {
                    Button { Task { await exp.toggleToday() } } label: {
                        HStack(spacing: 7) {
                            NKGlyph(done ? "check-ink" : "plus-ink", done ? NK.ground : .white, size: 15)
                            Text("Ma megvolt").nkFont(14, done ? .semibold : .regular)
                        }
                        .foregroundStyle(done ? NK.ground : .white.opacity(0.88))
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(Capsule().fill(done ? .white.opacity(0.92) : .white.opacity(0.1)))
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(exp.busy || exp.offline)
                    .accessibilityAddTraits(done ? .isSelected : [])
                    .accessibilityHint(done ? "Visszaveszi a mai pipát" : "Kipipálja a mai napot")
                    Spacer(minLength: 0)
                    Button { confirmStop = true } label: {
                        Text("Leállítom").nkFont(13.5).foregroundStyle(.white.opacity(0.55))
                            .padding(.vertical, 9).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(exp.busy || exp.offline)
                }
                .padding(.top, 2)
            }
        }
        .confirmationDialog("Leállítod a kísérletet?", isPresented: $confirmStop, titleVisibility: .visible) {
            Button("Leállítom", role: .destructive) { Task { await exp.dismiss(r.id) } }
            Button("Mégsem", role: .cancel) {}
        } message: {
            Text("Nem lesz eredménye, és a korábbi kísérletek közé sem kerül.")
        }
    }

    private func row(_ e: EvadExperiment) -> NKAreaRow {
        let v = evadPastValue(e)
        let verdict = e.result?.verdict
        return NKAreaRow(id: e.id, glyph: evadSubjectGlyph(e.subjectKind), title: e.title, sub: evadPastSub(e),
                         value: v.value, valueSub: v.sub,
                         hot: verdict == "clear" && v.value != "–",
                         state: verdict == "insufficient" ? .skipped : .normal,
                         chips: e.kept ? ["Bekerült az évadba"] : [],
                         action: { openResult(e.id) })
    }
}

/// **Új kísérlet**: a title, a length (7 / 14 / 21 / 28 nap, 14 by default), „Indítom". While one runs, it says that
/// only one runs at a time and does not offer to start.
struct EvadNewExperimentPage: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var title = ""
    @State private var length = 14
    @FocusState private var focused: Bool

    var body: some View {
        let exp = store?.experiments
        let running = exp?.data?.running
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let canStart = running == nil && !name.isEmpty && name.count <= 80 && exp?.busy == false && exp?.offline == false
        NKAreaSubPage(hue: evadHue, crumb: "Hatás", eyebrow: "Új kísérlet", title: "Mit próbálsz ki?",
                      sentence: "Néhány hétig csinálod, és a végén megmutatom, *változott-e* valami a korábbi napjaidhoz képest.",
                      onBack: close) {
            NKBare("A kísérlet", hue: evadHue, glyph: "pen-sun") {
                VStack(alignment: .leading, spacing: 16) {
                    TextField("Például: esti séta vacsora után", text: $title)
                        .nkFont(15).foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .background(Capsule().fill(.white.opacity(0.08)))
                        .submitLabel(.done)
                        .focused($focused)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Meddig tartson?").nkFont(15).foregroundStyle(.white.opacity(0.85))
                        HStack(spacing: 8) {
                            ForEach([7, 14, 21, 28], id: \.self) { n in
                                let on = length == n
                                Button { length = n } label: {
                                    Text("\(n) nap").nkFont(13.5, on ? .semibold : .regular)
                                        .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                                        .frame(maxWidth: .infinity).frame(height: 36)
                                        .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.1)))
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(on ? .isSelected : [])
                            }
                        }
                    }
                    EvadLine(text: "Minden nap egy koppintással jelzed, hogy megvolt. Az eredményhez a napok legalább 70 százaléka kell (\(Int((0.7 * Double(length)).rounded(.up))) nap a \(length)-ből).")
                }
            }
            if let running {
                EvadLine(text: "Most fut egy kísérlet (\(running.title)). Egyszerre csak egy futhat, hogy tiszta legyen az eredmény: ha végzett, vagy leállítod, indíthatsz újat.")
            } else if exp?.offline == true {
                EvadLine(text: "Ehhez internet kell. Próbáld újra, ha lesz net.")
            }
            if let problem = exp?.actionProblem { EvadLine(text: problem) }
            NKActions([NKAction(glyph: "check-ink", title: "Indítom", primary: true, action: {
                guard canStart, let exp else { return }
                Task {
                    if await exp.create(EvadExperimentCreate(title: name, subjectKind: "habit", lengthDays: length)) { close() }
                }
            }), NKAction(title: "Mégsem", action: close)], hue: evadHue)
            .opacity(canStart ? 1 : 0.55)
        }
        .task { await exp?.load() }
        .onAppear { exp?.actionProblem = nil }
    }
}
