import SwiftUI
import BoopCore
import BoopDesign

/// **Új évad** (screen 12): five steps prefilled from the server's first-season draft (his live goal, running block,
/// weekly slots and sleep goal), the summary from the server's preview of that draft. Nothing is saved until
/// *Indulhat az évad* — then the season is created and activated in one go.
struct EvadNewSeason: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var draft: EvadDraft?
    @State private var preview: EvadPreview?
    @State private var loadProblem: String?
    @State private var problem: String?
    @State private var busy = false

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Új évad", title: "Jöhet a következő évad",
                      sentence: "A mostani súlycélodból és edzésblokkodból *már összeállítottam* egy javaslatot, csak nézd át.",
                      onBack: close) {
            if let d = draft {
                steps(d)
                if let problem { EvadLine(text: problem) }
                NKActions([NKAction(glyph: "check-deep", title: busy ? "Indul…" : "Indulhat az évad", primary: true, action: start),
                           NKAction(title: "Később", action: close)], hue: evadHue)
            } else if let loadProblem {
                NKBare("A javaslat", hue: evadHue, glyph: "star-ink",
                       state: .failed(loadProblem, { Task { await load() } })) { EmptyView() }
            } else {
                NKBare("A javaslat", hue: evadHue, glyph: "star-ink", state: .loading) { EmptyView() }
            }
        }
        .evadReviewAnchor()
        .task { if draft == nil { await load() } }
        .task(id: draft) {
            guard let draft else { return }
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled, let store else { return }
            do throws(PlanFetchError) {
                let p = try await store.previewDraft(draft)
                if draft == self.draft { preview = p; problem = nil }
            } catch {
                if draft == self.draft { problem = evadErrorText(error) }
            }
        }
    }

    private func load() async {
        guard let store else { return }
        loadProblem = nil
        do throws(PlanFetchError) {
            draft = try await store.firstDraft()
        } catch {
            loadProblem = evadErrorText(error)
        }
    }

    private func start() {
        guard let store, let d = draft, !busy, preview != nil else { return }
        busy = true
        Task {
            defer { busy = false }
            do throws(PlanFetchError) {
                try await store.start(d)
                close()
            } catch {
                problem = evadErrorText(error)
            }
        }
    }

    /// The goal switch: a new trajectory, a name to match, and a pace the engine can work with when none was set.
    private func setGoal(_ trajectory: String) {
        guard var d = draft, d.trajectory != trajectory else { return }
        d.trajectory = trajectory
        d.title = evadDefaultTitle(trajectory: trajectory, startDate: d.startDate)
        if trajectory == "maintain" {
            d.targetWeightKg = nil; d.kgPerWeek = nil; d.ratePctPerWeek = nil
        } else if d.kgPerWeek == nil && d.ratePctPerWeek == nil && d.targetWeightKg == nil {
            // the engine's usual pace (% of body weight a week); the summary shows what it means for him
            d.ratePctPerWeek = trajectory == "cut" ? 0.5 : 0.25
        }
        draft = d
    }

    // MARK: The five steps

    @ViewBuilder private func steps(_ d: EvadDraft) -> some View {
        let after = preview?.after
        step(1, "A cél", done: true) {
            HStack(spacing: 6) {
                ForEach(evadGoals, id: \.trajectory) { g in
                    let on = d.trajectory == g.trajectory
                    Button { setGoal(g.trajectory) } label: {
                        Text(g.name).nkFont(13.5, on ? .semibold : .regular).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                            .lineLimit(1).minimumScaleFactor(0.85)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            let goalLine = goalParts(d, after).joined(separator: " · ")
            if !goalLine.isEmpty {
                Text(goalLine).font(.nkNumber(15)).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            }
        }
        step(2, "Az edzés", done: true) {
            let sport = evadSportSummary(d.sport)
            Text([blockPhrase(d.block), "heti \(d.gymDays.count) edzés", sport.isEmpty ? nil : sport].compactMap { $0 }.joined(separator: " · "))
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            Text("Edzésblokkot csak évadhoz lehet indítani, így a hossza is az évadhoz igazodik.")
                .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
        }
        step(3, "Az étel", done: false) {
            Text(["A napi keret igazodik az edzésnapokhoz",
                  d.allowedRecipeIds.isEmpty ? nil : "\(d.allowedRecipeIds.count) kiválasztott recept"].compactMap { $0 }.joined(separator: " · "))
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
        }
        step(4, "Az alvás", done: false) {
            Text(after.map { "Az edzéshez \(evadHM($0.sleepNeedMin)) alvás kell · fekvés \($0.bedtime) körül" } ?? "Számolom…")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
        }
        step(5, "Összesítve", done: false) {
            Text(after.map(summary) ?? "Számolom…")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            if let warnings = preview?.warnings {
                ForEach(warnings, id: \.key) { EvadWarningBox(text: $0.text) }
            }
        }
    }

    private func goalParts(_ d: EvadDraft, _ after: EvadNumbers?) -> [String] {
        if d.trajectory == "maintain" {
            return [after?.band.map { "\(evadBandText($0)) között" }, "\(d.weeks) hét"].compactMap { $0 }
        }
        let pace = (after?.kgPerWeek ?? d.kgPerWeek).map { "heti \(evadKg(abs($0))) kg" }
        return [d.targetWeightKg.map { "\(evadKg($0)) kg a cél" }, "\(d.weeks) hét", pace, evadPaceWord(after?.paceVerdict)]
            .compactMap { $0 }
    }

    private func blockPhrase(_ b: EvadBlockChoice?) -> String? {
        switch b?.source {
        case "adopt": "a mostani blokkod folytatódik"
        case "rerun": "a legutóbbi blokkod újraindul"
        case "template": "sablonból indul új blokk"
        default: nil
        }
    }

    private func summary(_ n: EvadNumbers) -> String {
        let kcal = n.restDayKcal.map { "Edzésnapon \(evadKcal(n.trainDayKcal)), pihenőnapon \(evadKcal($0)) kcal, \(n.proteinG) g fehérje." }
            ?? "Edzésnapon \(evadKcal(n.trainDayKcal)) kcal, pihenőnap nincs, \(n.proteinG) g fehérje."
        if let date = n.targetDate { return kcal + " A célt \(evadShortDate(date)) körül éred el." }
        if let band = n.band { return kcal + " A súlyod a \(evadBandText(band))-os sávban marad." }
        return kcal
    }

    private func step(_ n: Int, _ title: String, done: Bool, @ViewBuilder _ body: () -> some View) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(done ? evadHue.glow : .white.opacity(0.1)).frame(width: 30, height: 30)
                Text("\(n)").font(.nkNumber(16)).foregroundStyle(done ? NK.ground : .white)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(title).nkFont(18, design: .serif).foregroundStyle(.white)
                body()
            }
            Spacer(minLength: 0)
        }
    }
}
