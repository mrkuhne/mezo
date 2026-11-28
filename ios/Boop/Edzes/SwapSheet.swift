import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The reasoned swap (mezo-r36n9.66, spec §6.2)

// The look is the approved simulator spike (`spike/boop-gyakorlatcsere`, `CsereDemo.swift`, owner OK 2026-11-17):
// two optional chips, the server's ranked suggestions as cards (the first one lit), and the full catalogue behind
// *Minden gyakorlat*. Every suggestion, its reason and its last top set are the server's — the phone ranks nothing.
// The swap itself is still the player's one online write (`EdzesStore.swapExercise`).

/// What the swap sheet asks of the room. Closures rather than the store, like the rest of the player's inputs.
struct SwapActions {
    var gym: @MainActor () -> GymProfile = { GymProfile() }
    /// „Nem esik jól" already said today for this exercise of the workout.
    var discomforted: @MainActor (UUID) -> Bool = { _ in false }
    var substitutes: @MainActor (UUID) async -> Substitutes? = { _ in nil }
    /// The sentence to show when the change could not be saved, nil on success.
    var markMissing: @MainActor (MissingEdit) async -> String? = { _ in nil }
    var undoMissing: @MainActor (MissingEdit) async -> String? = { _ in nil }
    var setDiscomfort: @MainActor (Bool, UUID) async -> Bool = { _, _ in false }
}

struct SwapSheet: View {
    /// The workout's own row id of the exercise going out.
    let exerciseId: UUID
    let outgoing: SessionExercise?
    let catalog: [CatalogExercise]
    /// The names of today's exercises: none of them is offered again.
    let today: [String]
    let hue: Hue
    let actions: SwapActions
    let swapping: Bool
    let problem: String?
    /// True: the block's remaining days too; false: today only (owner, 2026-11-23 — the two are said apart).
    var wholeBlock = false
    let onPick: (CatalogExercise) -> Void
    let openGym: () -> Void

    private enum Load { case loading, ready(Substitutes), failed }
    @State private var load: Load = .loading
    @State private var showAll = false
    @State private var query = ""
    @State private var note: String?
    /// The undo of the last change; the sentence when it could not be undone, nil when it was.
    @State private var undo: (@MainActor () async -> String?)?
    /// A chip or *visszavonom* is talking to the server: a second tap waits (like the player's `swapping`).
    @State private var busy = false
    /// The kinds to choose from when the exercise needs several portable ones.
    @State private var asking: [EquipmentKind]?
    /// The chip lights at the tap, not when the server answers.
    @State private var discomfortPending: Bool?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var outRow: CatalogExercise? { catalogRow(named: outgoing?.name, in: catalog) }
    private var failed: Bool { if case .failed = load { true } else { false } }

    var body: some View {
        NKSheetFrame(hue: hue, eyebrow: outgoing?.name ?? "Gyakorlat",
                     title: wholeBlock ? "Mire cseréljük a mezociklus végéig?" : "Mit csinálsz ma helyette?") {
            VStack(alignment: .leading, spacing: 12) {
                // The chips need the outgoing exercise's catalogue row; a custom exercise has none, and then
                // neither chip has anything true to say.
                if let outRow { chips(outRow) }
                if let asking { askPick(asking) }
                if let note { noteLine(note) }
                if swapping {
                    Text("Cserélem…").nkFont(13).foregroundStyle(.white.opacity(0.6))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let problem { problemBox(problem) }
                suggestions
                fullList
                Text(wholeBlock ? "A csere a mezociklus végéig szól: a nap minden további alkalmán ez lesz. A döntés a tiéd — a teljes listából bármit választhatsz."
                                : "A csere csak a mai edzésre szól, a mezociklusod nem változik. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: openGym) {
                    Text("Mi van a termemben ›").nkFont(13, .medium).foregroundStyle(.white.opacity(0.8))
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .frameProbe("swap.gym")
            }
        }
        .task { await refresh() }
    }

    // MARK: The two chips

    @ViewBuilder private func chips(_ out: CatalogExercise) -> some View {
        let edit = missingEdit(for: out)
        let lacking = actions.gym().lacks(out)
        let sore = discomfortPending ?? actions.discomforted(exerciseId)
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { chipButtons(out, edit: edit, lacking: lacking, sore: sore) }
            VStack(alignment: .leading, spacing: 8) { chipButtons(out, edit: edit, lacking: lacking, sore: sore) }
        }
    }

    @ViewBuilder private func chipButtons(_ out: CatalogExercise, edit: MissingEdit?, lacking: Bool, sore: Bool) -> some View {
        // Bodyweight only: there is no kit to switch off.
        if edit != nil || lacking {
            chip("ehhez nincs eszközöm", on: lacking || asking != nil) { guarded { await toggleEquipment(out) } }
        }
        chip("nem esik jól", on: sore) { guarded { await toggleDiscomfort(!sore) } }
    }

    /// One server conversation at a time; a tap while one runs is dropped.
    private func guarded(_ work: @escaping @MainActor () async -> Void) {
        guard !busy else { return }
        busy = true
        Task { await work(); busy = false }
    }

    private func toggleEquipment(_ out: CatalogExercise) async {
        if asking != nil { asking = nil; return }
        let gym = actions.gym()
        if gym.lacks(out) {
            var failure: String?
            for e in gym.edits(blocking: out) {
                if let problem = await actions.undoMissing(e) { failure = problem }
            }
            note = failure; undo = nil
            await refresh()
            return
        }
        switch missingEdit(for: out) {
        case .ask(let kinds)?: asking = kinds
        case let edit?: await apply(edit, out)
        case nil: break
        }
    }

    private func apply(_ edit: MissingEdit, _ out: CatalogExercise) async {
        asking = nil
        if let failure = await actions.markMissing(edit) {
            note = failure; undo = nil
            return
        }
        switch edit {
        case .kind(let k): note = "„\(k.label)” kikapcsolva a termedben."
        case .exercise:
            note = (out.gear ?? []).contains(EquipmentKind.machine.rawValue)
                ? "Ez a gép hiányzik a termedből — a többi gép marad."
                : "Ez az eszköz hiányzik a termedből — a többi marad."
        case .ask: break
        }
        undo = { await actions.undoMissing(edit) }
        await refresh()
    }

    private func toggleDiscomfort(_ on: Bool) async {
        discomfortPending = on
        let ok = await actions.setDiscomfort(on, exerciseId)
        discomfortPending = nil
        guard ok else {
            note = "Most nem tudtam feljegyezni — ehhez internet kell."; undo = nil
            return
        }
        if on {
            note = "Feljegyeztem. Olyat ajánlok, ami kíméli."
            undo = {
                await actions.setDiscomfort(false, exerciseId) ? nil : "Most nem tudtam visszavonni — ehhez internet kell."
            }
        } else {
            note = nil; undo = nil
        }
        await refresh()
    }

    /// Without suggestions a chip would change nothing he can see (spec §6.2): disabled and dimmed then.
    private func chip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        let off = failed || swapping
        return Button(action: action) {
            Text(title).nkFont(13, .medium).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(on ? NK.ground : .white)
                .padding(.horizontal, 14).frame(minHeight: 38)
                .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
                .overlay(Capsule().strokeBorder(.white.opacity(on ? 0 : 0.18), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .disabled(off || busy)
        .opacity(off ? 0.4 : 1)
        .accessibilityAddTraits(on ? .isSelected : [])
        .frameProbe("swap.chip.\(title)")
    }

    /// The exercise needs several portable kinds: which one is missing? The bench, which rarely is, comes last.
    private func askPick(_ kinds: [EquipmentKind]) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Melyik hiányzik a termedből?").nkFont(13).foregroundStyle(.white.opacity(0.7))
            ForEach(kinds, id: \.self) { k in
                Button {
                    if let out = outRow { guarded { await apply(.kind(k), out) } }
                } label: {
                    HStack {
                        Text(k.label).nkFont(15).foregroundStyle(.white)
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.35))
                    }
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                    .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(busy || failed)
            }
        }
    }

    /// The line and its *visszavonom* side by side; a long kind name („Húzódzkodó és tolódzkodó állvány") puts
    /// the undo under the line instead of squeezing the sentence.
    private func noteLine(_ text: String) -> some View {
        let line = Text(text).nkFont(12).foregroundStyle(.white.opacity(0.7))
        return ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { line.fixedSize(); undoButton }
            VStack(alignment: .leading, spacing: 2) {
                line.fixedSize(horizontal: false, vertical: true)
                undoButton
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var undoButton: some View {
        if let undo {
            Button("visszavonom") {
                guarded {
                    if let problem = await undo() {
                        // Not undone: say so, and leave *visszavonom* to try again.
                        note = problem
                        return
                    }
                    note = nil; self.undo = nil
                    await refresh()
                }
            }
            .disabled(busy)
            .buttonStyle(.plain).font(.system(size: 12, weight: .semibold))
            .foregroundStyle(.white).underline()
            .frame(minHeight: 28)
        }
    }

    private func problemBox(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 9) {
            NKGlyph("bolt-peach", Color(hex: 0xE8A07A), size: 16)
            Text(text).nkFont(13).foregroundStyle(.white.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
    }

    // MARK: AJÁNLOM

    @ViewBuilder private var suggestions: some View {
        switch load {
        case .loading:
            header
            Text("Keresem…").nkFont(13).foregroundStyle(.white.opacity(0.6))
                .frame(maxWidth: .infinity, alignment: .leading)
        case .failed:
            Text("Most nem érem el az ajánlásokat — a teljes listából választhatsz.")
                .nkFont(13).foregroundStyle(.white.opacity(0.75))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .ready(let s):
            let taken = Set(today.map { $0.lowercased() })
            let picks = Array(s.suggestions.filter { !taken.contains($0.exercise.name.lowercased()) }.prefix(5))
            header
            if picks.isEmpty {
                NKNoFreshData("Ezekkel a feltételekkel nincs jó ajánlásom — nézd meg a teljes listát")
            }
            ForEach(Array(picks.enumerated()), id: \.element.id) { i, p in
                Button { onPick(p.exercise) } label: { card(p, first: i == 0) }
                    .buttonStyle(.plain)
                    .disabled(swapping)
                    .frameProbe("swap.pick.\(i)")
            }
        }
    }

    private var header: some View {
        Text("AJÁNLOM").nkFont(10, .medium, design: .monospaced).tracking(1.4)
            .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
    }

    private func card(_ p: Substitute, first: Bool) -> some View {
        ExercisePickCard(name: p.exercise.name, image: BoopConfig.mediaURL(p.exercise.imageStartURL),
                         role: roleLine(p.exercise), reason: p.reason,
                         last: p.lastTopSet.map { Self.lastText(kg: $0.kg, reps: $0.reps) }, first: first, hue: hue)
    }

    /// „60 kg × 10"; a bodyweight set (no weight) is „12 ismétlés" — never „0 kg".
    static func lastText(kg: Double?, reps: Int) -> String {
        guard let kg else { return "\(reps) ismétlés" }
        return "\(nkKg(kg)) × \(reps)"
    }

    private func roleLine(_ c: CatalogExercise) -> String { exerciseRoleLine(muscle: c.muscle, type: c.type) }

    static func typeName(_ t: ExerciseType) -> String {
        switch t {
        case .compound: "összetett"
        case .isolation: "izolált"
        case .plyo: "robbanékony"
        }
    }

    // MARK: Minden gyakorlat

    @ViewBuilder private var fullList: some View {
        if !failed {
            Button {
                if reduceMotion { showAll.toggle() } else { withAnimation(.easeInOut(duration: 0.2)) { showAll.toggle() } }
            } label: {
                HStack {
                    Text("Minden gyakorlat").nkFont(15, .medium).foregroundStyle(.white)
                    Spacer()
                    Image(systemName: showAll ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
                }
                .padding(.vertical, 12)
                .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
            .frameProbe("swap.all")
        }
        if showAll || failed {
            if catalog.isEmpty {
                NKNoFreshData("A gyakorlatlistát most nem érem el")
            } else {
                TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
                    .font(.system(size: 15)).foregroundStyle(.white)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                let all = swapList(catalog: catalog, muscle: outRow?.muscle ?? outgoing?.muscle ?? "",
                                   today: today, query: query)
                // Without a search the same muscle comes whole and the rest is cut short; a search reaches
                // the whole catalogue.
                let muscle = outRow?.muscle ?? outgoing?.muscle ?? ""
                let shown = query.isEmpty
                    ? all.filter { $0.muscle == muscle } + all.filter { $0.muscle != muscle }.prefix(30)
                    : all
                ForEach(shown) { c in
                    Button { onPick(c) } label: { plainRow(c) }
                        .buttonStyle(.plain)
                        .disabled(swapping)
                }
                if all.isEmpty { NKNoFreshData("Nincs ilyen gyakorlat a listában") }
            }
        }
    }

    /// A filtered-out exercise stays pickable and says why quietly (spec §6.2).
    private func label(_ c: CatalogExercise) -> String? {
        let server: SubstituteLabel? = if case .ready(let s) = load { s.labels[c.id] } else { nil }
        if server == .noEquipment || actions.gym().lacks(c) { return "nincs hozzá eszközöd" }
        if server == .hurtBefore { return "legutóbb fájt" }
        return nil
    }

    private func plainRow(_ c: CatalogExercise) -> some View {
        ExercisePickRow(name: c.name, image: BoopConfig.mediaURL(c.imageStartURL), role: roleLine(c), quiet: label(c))
    }

    // MARK: Loading

    private func refresh() async {
        if let fresh = await actions.substitutes(exerciseId) { load = .ready(fresh) } else { load = .failed }
    }
}

// MARK: - Shared by every exercise picker (the player's swap, the builder's add and swap — mezo-r36n9.127)

/// „hát · középső · összetett": the fine muscle (`SubMuscles`) and the movement type, under the exercise's name.
func exerciseRoleLine(muscle: String, type: ExerciseType) -> String {
    "\(SubMuscles.name(muscle).lowercased()) · \(SwapSheet.typeName(type))"
}

/// An AJÁNLOM card (approved spike `spike/boop-izomreszek`): the catalogue picture on the left (a quiet tile without
/// one), the name, the sub-muscle line under it, the server's reason, the last top set.
struct ExercisePickCard: View {
    let name: String
    let image: URL?
    let role: String
    let reason: String
    let last: String?
    let first: Bool
    let hue: Hue
    /// Replaces the last-top-set line (the block builder's coverage hint: „csütörtök · 3 × 10–15").
    var footnote: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            NKRemoteThumb(image, size: 44, corner: 12)
            VStack(alignment: .leading, spacing: 4) {
                Text(name).nkFont(17, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                    .fixedSize(horizontal: false, vertical: true)
                Text(role).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                Text(reason).nkFont(14).foregroundStyle(.white.opacity(0.82))
                    .fixedSize(horizontal: false, vertical: true).padding(.top, 2)
                if let footnote {
                    Text(footnote).nkFont(12, design: .monospaced).foregroundStyle(hue.glow)
                } else if let last {
                    Text("Legutóbb: \(last)").nkFont(12, design: .monospaced).foregroundStyle(hue.glow)
                } else {
                    Text("Ezt még nem csináltad").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(first ? 0.11 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .strokeBorder(.white.opacity(first ? 0.22 : 0), lineWidth: 0.5))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// A „Minden gyakorlat" row: the picture, the name, the sub-muscle line, the quiet label of a left-out exercise.
struct ExercisePickRow: View {
    let name: String
    let image: URL?
    let role: String
    let quiet: String?

    var body: some View {
        HStack(spacing: 12) {
            NKRemoteThumb(image, size: 44, corner: 12).opacity(quiet == nil ? 1 : 0.6)
            VStack(alignment: .leading, spacing: 3) {
                Text(name).nkFont(15).foregroundStyle(.white.opacity(quiet == nil ? 1 : 0.6)).lineLimit(1)
                Text(role).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45)).lineLimit(1)
            }
            Spacer(minLength: 0)
            if let quiet {
                Text(quiet).nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.05)))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
