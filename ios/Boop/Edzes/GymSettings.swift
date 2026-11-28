import SwiftUI
import BoopCore
import BoopDesign

// MARK: - „Mi van a termemben" (mezo-r36n9.66, spec §6.1)

// The look is the approved simulator spike (`spike/boop-gyakorlatcsere`, `GymSheet`, owner OK 2026-11-17): the intro
// sentence, nine switches, *AMI KONKRÉTAN HIÁNYZIK* with *mégis van* per row.
//
// **One source of truth: `EdzesStore.gym`.** The editor never owns the profile — it shows a copy, sends every change
// through the store (which reads the profile from the server before writing the whole of it back, and takes a failed
// save back itself) and then re-reads the store's profile. So the swap sheet's chip and this page cannot drift.
// Every switch saves at once; a failed save puts the switch back and shows the quiet *„Nem sikerült elmenteni · Újra"*.

/// The name of a missing exercise. With no catalogue at hand (offline, not read yet) nothing is known, so the label is
/// neutral; „Törölt gyakorlat" only when the catalogue is there and truly lacks the id.
func missingName(_ id: UUID, in catalog: [CatalogExercise]) -> String {
    if let row = catalog.first(where: { $0.id == id }) { return row.name }
    return catalog.isEmpty ? "Gyakorlat" : "Törölt gyakorlat"
}

@MainActor @Observable
final class GymEditor {
    private(set) var profile: GymProfile
    /// True while the last change could not be saved: the row with *Újra* shows.
    private(set) var failed = false
    private(set) var loading = false
    private var inFlight = 0
    private var lastChange: ((GymProfile) -> GymProfile)?

    private let current: @MainActor () -> GymProfile
    private let ready: @MainActor () -> Bool
    private let load: @MainActor () async -> Void
    /// Applies one change through the store; the sentence when it could not be saved, nil on success.
    private let save: @MainActor (@escaping (GymProfile) -> GymProfile) async -> String?

    init(current: @escaping @MainActor () -> GymProfile, ready: @escaping @MainActor () -> Bool,
         load: @escaping @MainActor () async -> Void,
         save: @escaping @MainActor (@escaping (GymProfile) -> GymProfile) async -> String?) {
        self.current = current; self.ready = ready; self.load = load; self.save = save
        profile = current()
    }

    /// The profile as the server last said it. False when it could not be read: the switches would then show a
    /// default he never set, and saving over the real one would wipe it.
    var loaded: Bool { ready() }

    func start() async {
        loading = true; defer { loading = false }
        await load()
        profile = current()
    }

    func isOn(_ kind: EquipmentKind) -> Bool { !profile.offKinds.contains(kind.rawValue) }

    func setKind(_ kind: EquipmentKind, on: Bool) async {
        await run { on ? $0.reverting(.kind(kind)) : $0.applying(.kind(kind)) }
    }

    /// *mégis van*.
    func restore(_ id: UUID) async { await run { $0.reverting(.exercise(id)) } }

    /// *Újra*: the same change once more, or the read when nothing was ever loaded.
    func retry() async {
        if !loaded { await start(); failed = false; return }
        if let lastChange { await run(lastChange) }
    }

    private func run(_ change: @escaping (GymProfile) -> GymProfile) async {
        // While the first read is in flight there is nothing to save yet and nothing to apologise for.
        if loading { return }
        guard loaded else { failed = true; lastChange = change; return }
        let before = profile
        profile = change(profile)
        failed = false
        lastChange = change
        inFlight += 1
        let problem = await save(change)
        inFlight -= 1
        if problem != nil { failed = true; if inFlight > 0 { profile = before } }
        // Only the last of several quick taps reads the truth back, so an earlier answer cannot undo a later tap.
        if inFlight == 0 { profile = current() }
    }
}

struct GymSheet: View {
    let store: EdzesStore
    let hue: Hue
    @State private var editor: GymEditor

    init(store: EdzesStore, hue: Hue) {
        self.store = store; self.hue = hue
        _editor = State(initialValue: GymEditor(current: { store.gym }, ready: { store.gymLoaded },
                                                 load: { await store.loadGym() },
                                                 save: { await store.saveGym($0) }))
    }

    /// Missing exercises in the catalogue's own naming; one the catalogue no longer has still gets a row to undo.
    private var gone: [(id: UUID, name: String)] {
        editor.profile.missing.map { id in (id, missingName(id, in: store.catalog)) }
            .sorted { $0.name < $1.name }
    }

    var body: some View {
        NKSheetFrame(hue: hue, eyebrow: "Edzés · beállítások", title: "Mi van a termemben") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Amíg nem szólsz, mindent elérhetőnek veszek. Amit kikapcsolsz, azt nem ajánlom cserénél — a teljes listából továbbra is választhatod.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true).padding(.bottom, 10)

                if editor.failed { failureRow }
                if editor.loaded || editor.loading { switches } else if !editor.failed { loadFailedRow }
            }
        }
        .task { await editor.start() }
        .presentationDetents([.large])
    }

    private var switches: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(EquipmentKind.allCases, id: \.self) { kind in
                    Toggle(isOn: Binding(get: { editor.isOn(kind) },
                                         set: { on in Task { await editor.setKind(kind, on: on) } })) {
                        Text(kind.label).nkFont(16).foregroundStyle(.white)
                    }
                    .tint(hue.glow)
                    .disabled(!editor.loaded || editor.loading)
                    .padding(.vertical, 9)
                    .frame(minHeight: 44)
                    .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    .frameProbe("gym.\(kind.label)")
                }
            }
            .workoutCard(h: 8, v: 4)

            // The second card; its top gap sits outside it, so the layout is the one it always was.
            VStack(alignment: .leading, spacing: 4) {
                Text("AMI KONKRÉTAN HIÁNYZIK").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(.white.opacity(0.5)).padding(.bottom, 4)
                if gone.isEmpty {
                    Text("Még semmi. Ha egy gép nincs meg nálatok, a cserénél az „ehhez nincs eszközöm” gombbal jelezheted — ide kerül.")
                        .nkFont(13).foregroundStyle(.white.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(gone, id: \.id) { e in
                    HStack {
                        Text(e.name).nkFont(15).foregroundStyle(.white)
                        Spacer()
                        Button { Task { await editor.restore(e.id) } } label: {
                            Text("mégis van").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                                .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .frameProbe("gym.restore.\(e.name)")
                    }
                    .padding(.vertical, 2)
                    .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
            .workoutCard(h: 8, v: 4)
            .padding(.top, 18)
        }
    }

    /// The quiet row used across Ritmus: one sentence, one *Újra*.
    private var failureRow: some View {
        HStack {
            Text("Nem sikerült elmenteni").nkFont(13, .medium).foregroundStyle(.white.opacity(0.75))
            Text("·").foregroundStyle(.white.opacity(0.4))
            Button { Task { await editor.retry() } } label: {
                Text("Újra").nkFont(13, .semibold).foregroundStyle(.white).frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var loadFailedRow: some View {
        HStack {
            Text("Most nem érem el a termed beállításait").nkFont(13, .medium).foregroundStyle(.white.opacity(0.75))
            Text("·").foregroundStyle(.white.opacity(0.4))
            Button { Task { await editor.retry() } } label: {
                Text("Újra").nkFont(13, .semibold).foregroundStyle(.white).frame(minHeight: 44)
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }
}
