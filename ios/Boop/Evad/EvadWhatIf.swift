import SwiftUI
import BoopCore
import BoopDesign

/// **Módosítás** (screens 08–09): the live consequence preview. He moves the sessions per week, the sport days or the
/// weekly pace; 300 ms after he stops, the server's engine answers what would change (Most | Utána), how the running
/// block's week is re-arranged when the gym days move (mezo-r36n9.122), what it warns about and what he would have to
/// do. One Elfogadom moves all of it together. Nothing changes until *Elfogadom*; a preview that went stale in between is
/// recomputed once and said so.
struct EvadWhatIf: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadStore.self) private var store: EvadStore?
    @State private var base: EvadDraft?
    @State private var draft: EvadDraft?
    @State private var preview: EvadPreview?
    /// The draft `preview` was made for: Elfogadom only sends a fingerprint that belongs to the draft on screen.
    @State private var previewFor: EvadDraft?
    @State private var problem: String?
    @State private var note: String?
    @State private var busy = false
    private let weekdays = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]

    private var changed: Bool { draft != nil && draft != base }
    private var acceptable: Bool { evadCanAccept(previewOf: previewFor, current: draft) }

    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Módosítás", title: "Mi változna?",
                      sentence: "Állíts át bármit, és Boop *azonnal* megmutatja, mire hat. Amíg nem fogadod el, semmi sem változik.",
                      onBack: close) {
            if let draft {
                settings(draft)
                consequences
                if changed, let week = preview?.block {
                    NKBare("A mezociklusod új hete", hue: evadHue, glyph: "dumbbell-ink", trailing: week.title) {
                        NKList(evadBlockWeekRows(week), hue: evadHue)
                    }
                }
                if changed, let todo = preview?.todo, !todo.isEmpty {
                    NKBare("Ehhez ezt kell tenned", hue: evadHue, glyph: "check-ink") {
                        NKList(todo.map { (title: $0.title, body: $0.body) }, hue: evadHue)
                    }
                }
                if let note { NKNote(note, hue: evadHue) }
                if let problem { EvadLine(text: problem) }
                NKActions([NKAction(glyph: "check-deep", title: busy ? "Elfogadom…" : (changed && !acceptable ? "Számolom…" : "Elfogadom"),
                                     primary: true, action: accept),
                           NKAction(title: "Mégsem", action: close)], hue: evadHue)
            } else {
                NKBare("Beállítások", hue: evadHue, glyph: "pen-sun", state: .failed("Ezt az évadot most nem tudom betölteni.", close)) {
                    EmptyView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: preview?.after)
        .evadReviewAnchor()
        .onAppear(perform: start)
        // the debounce: a change restarts the wait, and only a draft that stood still for 300 ms is asked about
        .task(id: draft) {
            guard let draft else { return }
            try? await Task.sleep(for: .milliseconds(300))
            guard !Task.isCancelled else { return }
            await runPreview(draft)
            #if DEBUG
            // Simulator review: `-evadAutoAccept YES` taps Elfogadom once the first changed preview is in (with
            // `-evadStale YES` it shows the recompute note).
            if UserDefaults.standard.bool(forKey: "evadAutoAccept"), changed, note == nil, preview != nil {
                try? await Task.sleep(for: .seconds(1.5)); accept()
            }
            #endif
        }
    }

    private func start() {
        guard base == nil, let d = store?.overview?.season.draft else { return }
        base = d
        var edit = d
        #if DEBUG
        // Simulator review: `-evadSessions 5`, `-evadPace 0.6` pre-set the page (screens 08–09).
        if let n = Int(UserDefaults.standard.string(forKey: "evadSessions") ?? "") {
            edit.gymDays = evadAdjustGymDays(edit.gymDays, to: n, avoiding: edit.sport.map(\.dayOfWeek))
        }
        if let pace = Double(UserDefaults.standard.string(forKey: "evadPace") ?? "") { edit.kgPerWeek = pace; edit.ratePctPerWeek = nil }
        #endif
        draft = edit
    }

    private func runPreview(_ d: EvadDraft) async {
        guard let store else { return }
        do throws(PlanFetchError) {
            let p = try await store.preview(d)
            guard d == draft else { return }
            preview = p; previewFor = d; problem = nil
        } catch {
            guard d == draft else { return }
            problem = evadErrorText(error)
        }
    }

    private func accept() {
        guard let store, let d = draft, !busy else { return }
        guard changed else { close(); return }
        // a tap inside the debounce (or after a failed re-preview): ask about this draft first, then let him look
        guard acceptable, let fingerprint = preview?.fingerprint else {
            Task { await runPreview(d) }
            return
        }
        busy = true
        Task {
            defer { busy = false }
            do throws(PlanFetchError) {
                try await store.apply(d, fingerprint: fingerprint)
                close()
            } catch .conflict("SEASON_PREVIEW_STALE") {
                // something moved since the preview (a weigh-in, a slot): recompute once and let him look again
                await runPreview(d)
                note = "Közben változott valami, újraszámoltam."
            } catch {
                problem = evadErrorText(error)
            }
        }
    }

    // MARK: Beállítások

    private func settings(_ d: EvadDraft) -> some View {
        NKBare("Beállítások", hue: evadHue, glyph: "pen-sun") {
            VStack(spacing: 18) {
                HStack {
                    Text("Edzések hetente").nkFont(15).foregroundStyle(.white.opacity(0.85))
                    Spacer()
                    EvadStepButton(plus: false, label: "Kevesebb edzés") { setSessions(d.gymDays.count - 1) }
                    Text("\(d.gymDays.count)").font(.nkNumber(24)).foregroundStyle(.white).frame(width: 40)
                    EvadStepButton(plus: true, label: "Több edzés") { setSessions(d.gymDays.count + 1) }
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("Sportnapok").nkFont(15).foregroundStyle(.white.opacity(0.85))
                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { i in
                            let on = d.sport.contains { $0.dayOfWeek == i }
                            Button { toggleSport(i) } label: {
                                Text(weekdays[i]).nkFont(13.5, on ? .semibold : .regular)
                                    .foregroundStyle(on ? NK.ground : .white.opacity(0.8))
                                    .frame(maxWidth: .infinity).frame(height: 36)
                                    .background(Capsule().fill(on ? Hue.mozgas.glow : .white.opacity(0.08)))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(evadDayOn(i))
                            .accessibilityAddTraits(on ? .isSelected : [])
                        }
                    }
                }
                if d.trajectory != "maintain", let pace = d.kgPerWeek ?? store?.overview?.weight.kgPerWeek.map(abs) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text(d.trajectory == "bulk" ? "Heti hízás" : "Heti fogyás").nkFont(15).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                            Text(evadPaceText(pace)).font(.nkNumber(18)).foregroundStyle(.white)
                        }
                        Slider(value: Binding(get: { pace }, set: { v in
                            draft?.kgPerWeek = (v * 20).rounded() / 20; draft?.ratePctPerWeek = nil
                        }), in: d.trajectory == "bulk" ? 0.1...0.5 : 0.2...0.9, step: 0.05)
                        .tint(evadHue.glow)
                    }
                }
            }
        }
    }

    private func setSessions(_ n: Int) {
        guard let d = draft, (1...6).contains(n) else { return }
        draft?.gymDays = evadAdjustGymDays(d.gymDays, to: n, avoiding: d.sport.map(\.dayOfWeek))
    }

    private func toggleSport(_ day: Int) {
        guard let d = draft else { return }
        if d.sport.contains(where: { $0.dayOfWeek == day }) {
            draft?.sport.removeAll { $0.dayOfWeek == day }
        } else {
            // a new sport day copies the sport he already plays (its time and length)
            let like = d.sport.first ?? base?.sport.first
            draft?.sport.append(EvadSportSlot(dayOfWeek: day, time: like?.time ?? "18:00", durationMin: like?.durationMin ?? 90,
                                              sport: like?.sport ?? "volleyball"))
            draft?.sport.sort { $0.dayOfWeek < $1.dayOfWeek }
        }
    }

    // MARK: Ennyi változna

    @ViewBuilder private var consequences: some View {
        let trailing = changed ? "azonnal frissül" : "még nem állítottál semmit"
        if let p = preview {
            NKBare("Ennyi változna", hue: evadHue, glyph: "link-deep", trailing: trailing) {
                NKCompareColumns(leftTitle: "Most", rightTitle: "Utána", lines: compareLines(p.before, p.after), hue: evadHue)
                ForEach(p.warnings, id: \.key) { EvadWarningBox(text: $0.text) }
            }
        } else if let problem {
            NKBare("Ennyi változna", hue: evadHue, glyph: "link-deep",
                   state: .failed(problem, { Task { if let draft { await runPreview(draft) } } })) { EmptyView() }
        } else {
            NKBare("Ennyi változna", hue: evadHue, glyph: "link-deep", trailing: trailing, state: .loading) { EmptyView() }
        }
    }

    private func compareLines(_ a: EvadNumbers, _ b: EvadNumbers) -> [NKCompareLine] {
        evadCompareRows(a, b).map { NKCompareLine(label: $0.label, left: $0.left, right: $0.right, favours: $0.changed ? 1 : 0) }
    }
}
