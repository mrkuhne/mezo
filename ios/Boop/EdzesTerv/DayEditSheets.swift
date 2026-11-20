import SwiftUI
import Observation
import BoopCore
import BoopDesign

// The block builder's day editor (mezo-r36n9.116, spec 2026-11-20-boop-blokk-szerkeszto-design.md §6): the row's
// settings sheet, the add sheet (muscle first, then up to five suggestions, then the full list) and the swap sheet
// („Mire cseréljük a blokk végéig?"). The add and swap sheets wear the player's `SwapSheet` look. Every number and
// suggestion comes from the server; the sheets only call the draft's edit API.

/// The editor's transient screen state — the open ⋯ menu, the open sheet, the undo line, the drag, the confirm alert.
@MainActor @Observable
final class DayEditUI {
    var menuRow: String?
    var sheet: DayEditSheet?
    /// The row taken off last, where it was — the undo line puts it back.
    var deleted: (row: DraftExercise, day: Int, index: Int)?
    var confirm = false
    var dragging: String?
    var dragOffset: CGFloat = 0

    /// An add, swap or move on `day`: the undo line's index would point at another place there, so it goes. An edit on
    /// another day keeps it.
    func structuralEdit(day: Int) { if deleted?.day == day { deleted = nil } }
}

/// While a ⋯ menu is open, a tap here closes it instead of acting.
struct DayEditMenuBackdrop: ViewModifier {
    let ui: DayEditUI
    var active = true
    func body(content: Content) -> some View {
        content.overlay {
            if active, ui.menuRow != nil {
                Color.clear.contentShape(Rectangle())
                    .onTapGesture { withAnimation(.snappy(duration: 0.2)) { ui.menuRow = nil } }
                    .accessibilityHidden(true)
            }
        }
    }
}

enum DayEditSheet: Identifiable, Equatable {
    case settings(String)
    /// The day, and a muscle chosen up front (simulator review only).
    case add(Int, muscle: String?)
    case swap(String)

    var id: String {
        switch self {
        case .settings(let id): "s\(id)"
        case .add(let d, _): "a\(d)"
        case .swap(let id): "w\(id)"
        }
    }
}

extension BlockDraft {
    /// Where a row is now, by its stable key.
    func locate(_ id: String) -> (day: Int, index: Int)? {
        for (d, day) in days.enumerated() {
            if let i = day.exercises.firstIndex(where: { $0.id == id }) { return (d, i) }
        }
        return nil
    }
}

extension WireCatalogItem {
    /// The draft's add / replace take a catalogue row; nil for an id that is not a uuid.
    var asCatalog: CatalogExercise? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        return CatalogExercise(id: uuid, slug: "", name: name, muscle: muscle ?? "", type: ExerciseType(wire: type), stim: 0, fatigue: 0)
    }

    var coarse: String { coarseMuscle(muscle ?? "") }

    func isOn(_ taken: Set<String>) -> Bool { taken.contains(id.lowercased()) || taken.contains(name.lowercased()) }
}

/// „ezen a héten…" style reserve: 0 is „bukásig".
func dayEditReserve(_ n: Int) -> String { n == 0 ? "bukásig" : "\(n)" }

// MARK: - Settings of one row

struct DayEditSettingsSheet: View {
    let model: BlockBuilderModel
    let rowId: String
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let draft = model.draft, let at = draft.locate(rowId) {
            let row = draft.days[at.day].exercises[at.index]
            NKSheetFrame(hue: planHue, eyebrow: row.name, title: "Beállítások") {
                field("Ismétlés sorozatonként", mine: row.overrides.contains("repRange")) {
                    HStack(spacing: 10) {
                        DayEditStepper(text: "\(row.repMin)", label: "Legkevesebb ismétlés",
                                       down: { if row.repMin > 1 { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin - 1, max: row.repMax) } } },
                                       up: { if row.repMin < row.repMax { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin + 1, max: row.repMax) } } })
                        Text("–").nkFont(20, .medium).foregroundStyle(.white.opacity(0.5))
                        DayEditStepper(text: "\(row.repMax)", label: "Legtöbb ismétlés",
                                       down: { if row.repMax > row.repMin { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin, max: row.repMax - 1) } } },
                                       up: { if row.repMax < 30 { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin, max: row.repMax + 1) } } })
                    }
                }
                field("Tartalék a sorozat végén", note: "ennyi ismétlés marad benned", mine: row.overrides.contains("targetRir")) {
                    DayEditStepper(text: dayEditReserve(row.targetRIR), label: "Tartalék",
                                   down: { if row.targetRIR > 0 { edit { $0.setReserve(day: at.day, at: at.index, row.targetRIR - 1) } } },
                                   up: { if row.targetRIR < 4 { edit { $0.setReserve(day: at.day, at: at.index, row.targetRIR + 1) } } })
                }
                field("Kezdősúly", note: "nem kötelező", mine: false) {
                    if let kg = row.anchorWeightKg {
                        HStack(spacing: 14) {
                            DayEditStepper(text: nkKg(kg), label: "Kezdősúly",
                                           down: { edit { $0.setAnchor(day: at.day, at: at.index, max(0, kg - 0.5)) } },
                                           up: { edit { $0.setAnchor(day: at.day, at: at.index, kg + 0.5) } })
                            Button("törlöm") { edit { $0.setAnchor(day: at.day, at: at.index, nil) } }
                                .buttonStyle(.plain).font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.7)).underline()
                        }
                    } else {
                        Button { edit { $0.setAnchor(day: at.day, at: at.index, 20) } } label: {
                            Text("+ megadom").nkFont(14, .medium).foregroundStyle(.white)
                                .padding(.horizontal, 16).frame(minHeight: 38)
                                .background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                field("Bemelegítő sorozat", mine: false) {
                    DayEditStepper(text: "\(row.warmups)", label: "Bemelegítő sorozat",
                                   down: { edit { $0.setWarmups(day: at.day, at: at.index, row.warmups - 1) } },
                                   up: { edit { $0.setWarmups(day: at.day, at: at.index, row.warmups + 1) } })
                }
                if !row.overrides.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top, spacing: 9) {
                            Circle().fill(planHue.glow).frame(width: 7, height: 7).padding(.top, 6)
                            Text("Ezt te állítottad; az edzésmód nem írja felül.")
                                .nkFont(14).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                        }
                        Button { edit { $0.resetToStyle(day: at.day, at: at.index) } } label: {
                            Text("Visszaállítom az edzésmódra").nkFont(14, .semibold).foregroundStyle(.white)
                                .padding(.horizontal, 16).frame(minHeight: 40)
                                .background(Capsule().strokeBorder(.white.opacity(0.3), lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }
                Text("A változás a következő edzéstől él; ami már kész, nem változik.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { dismiss() } label: {
                    Text("Kész").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Capsule().fill(planHue.glow))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
    }

    private func edit(_ change: (inout BlockDraft) -> Void) {
        guard var d = model.draft else { return }
        change(&d)
        withAnimation(reduceMotion ? nil : .snappy) { model.draft = d }
    }

    private func field(_ title: String, note: String? = nil, mine: Bool, @ViewBuilder control: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title).nkFont(15, .medium).foregroundStyle(.white)
                if mine {
                    Text("TE ÁLLÍTOTTAD").nkFont(9, .semibold, design: .monospaced).tracking(1)
                        .foregroundStyle(NK.ground)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(Capsule().fill(planHue.glow))
                }
                Spacer(minLength: 0)
            }
            if let note { Text(note).nkFont(12).foregroundStyle(.white.opacity(0.5)).padding(.top, -6) }
            control()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(mine ? 0.1 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(planHue.glow.opacity(mine ? 0.45 : 0), lineWidth: 1))
    }
}

/// The builder's round stepper with any text in the middle.
struct DayEditStepper: View {
    let text: String
    let label: String
    let down: () -> Void
    let up: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            round("−", down)
            Text(text).nkFont(19, .medium).foregroundStyle(.white).lineLimit(1).fixedSize()
                .frame(minWidth: 30).contentTransition(.numericText())
            round("+", up)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(text)")
        .accessibilityAdjustableAction { $0 == .increment ? up() : down() }
    }

    private func round(_ symbol: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol).nkFont(19, .medium).foregroundStyle(.white.opacity(0.9))
                .frame(width: 38, height: 38)
                .background(Circle().fill(.white.opacity(0.11)))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Suggestions (shared by add and swap)

/// The state of one suggestions read.
enum DayEditSuggestLoad: Equatable {
    case idle, loading, ready(WireSuggestions), failed

    var suggestions: WireSuggestions? { if case .ready(let s) = self { s } else { nil } }

    /// A full-list pick that was also suggested keeps the style's prescription the server sent with it.
    func prescription(for item: WireCatalogItem) -> Prescription? {
        suggestions?.suggestions.first { $0.exercise.id.lowercased() == item.id.lowercased() }?.prescription
    }

    func label(_ item: WireCatalogItem) -> String? {
        guard let labels = suggestions?.labels else { return nil }
        switch labels[item.id] ?? labels.first(where: { $0.key.lowercased() == item.id.lowercased() })?.value {
        case "NO_EQUIPMENT": return "nincs hozzá eszközöd"
        case "HURT_BEFORE": return "legutóbb fájt"
        default: return nil
        }
    }
}

/// AJÁNLOM, up to five cards, or the one-line note when the read failed.
private struct DayEditSuggestions: View {
    let load: DayEditSuggestLoad
    let taken: Set<String>
    let empty: String
    let onPick: (WireCatalogItem, Prescription?) -> Void

    var body: some View {
        switch load {
        case .idle: EmptyView()
        case .loading:
            DayEditHeader()
            ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 90)
        case .failed:
            Text("Most nem érem el az ajánlásokat — a teljes listából választhatsz.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .ready(let s):
            let picks = Array(s.suggestions.filter { !$0.exercise.isOn(taken) && $0.exercise.asCatalog != nil }.prefix(5))
            DayEditHeader()
            if picks.isEmpty { NKNoFreshData(empty) }
            ForEach(Array(picks.enumerated()), id: \.element.exercise.id) { i, p in
                Button { onPick(p.exercise, p.prescription) } label: { DayEditCard(s: p, first: i == 0) }.buttonStyle(.plain)
            }
        }
    }
}

private struct DayEditHeader: View {
    var body: some View {
        Text("AJÁNLOM").nkFont(10, .medium, design: .monospaced).tracking(1.4)
            .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func dayEditRoleLine(_ item: WireCatalogItem) -> String {
    "\(planMuscleName(item.coarse)) · \(SwapSheet.typeName(ExerciseType(wire: item.type)))"
}

private struct DayEditCard: View {
    let s: WireSuggestion
    let first: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(s.exercise.name).nkFont(17, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                Spacer(minLength: 8)
                Text(dayEditRoleLine(s.exercise)).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
            }
            Text(s.reasonText).nkFont(14).foregroundStyle(.white.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)
            if let last = s.lastTopSet {
                Text("Legutóbb: \(SwapSheet.lastText(kg: last.weightKg, reps: last.reps))")
                    .nkFont(12, design: .monospaced).foregroundStyle(planHue.glow)
            } else {
                Text("Ezt még nem csináltad").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(first ? 0.11 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(first ? 0.22 : 0), lineWidth: 0.5))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// „Minden gyakorlat": the chosen muscle whole, a search across the whole catalogue, the quiet labels.
private struct DayEditFullList: View {
    @Binding var showAll: Bool
    @Binding var query: String
    /// Open without the toggle (the suggestions read failed).
    let forced: Bool
    let items: [WireCatalogItem]
    let others: [WireCatalogItem]
    let label: (WireCatalogItem) -> String?
    let onPick: (WireCatalogItem) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button {
            if reduceMotion { showAll.toggle() } else { withAnimation(.easeInOut(duration: 0.2)) { showAll.toggle() } }
        } label: {
            HStack {
                Text("Minden gyakorlat").nkFont(15, .medium).foregroundStyle(.white)
                Spacer()
                Image(systemName: showAll || forced ? "chevron.down" : "chevron.right")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.vertical, 12)
            .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(!forced)
        .accessibilityAddTraits(.isHeader)
        if showAll || forced {
            if items.isEmpty && others.isEmpty {
                NKNoFreshData("A gyakorlatlistát most nem érem el")
            } else {
                TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
                    .font(.system(size: 15)).foregroundStyle(.white)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                let shown = query.isEmpty ? items : (items + others).filter { $0.name.localizedCaseInsensitiveContains(query) }
                ForEach(shown, id: \.id) { item in
                    Button { onPick(item) } label: { plainRow(item) }.buttonStyle(.plain)
                }
                if shown.isEmpty { NKNoFreshData("Nincs ilyen gyakorlat a listában") }
            }
        }
    }

    private func plainRow(_ item: WireCatalogItem) -> some View {
        let quiet = label(item)
        return HStack(spacing: 10) {
            NKRemoteThumb(nil, size: 36).opacity(quiet == nil ? 1 : 0.6)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name).nkFont(14).foregroundStyle(.white.opacity(quiet == nil ? 1 : 0.6)).lineLimit(1)
                Text(dayEditRoleLine(item)).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
            Spacer(minLength: 0)
            if let quiet {
                Text(quiet).nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.05)))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// The catalogue rows that can land on the day: a uuid id, not already on it.
@MainActor private func dayEditPool(_ model: BlockBuilderModel, taken: Set<String>) -> [WireCatalogItem] {
    model.catalogList.filter { $0.asCatalog != nil && !$0.isOn(taken) }
        .sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
}

/// What is already on the day, by lower-cased catalogue id and name (both exclude it from the sheets).
private func dayEditTaken(_ day: DraftDay?) -> Set<String> {
    Set((day?.exercises ?? []).flatMap { [$0.catalogId?.lowercased(), $0.name.lowercased()].compactMap { $0 } })
}

// MARK: - Add

struct DayEditAddSheet: View {
    let model: BlockBuilderModel
    let day: Int
    let onPick: (WireCatalogItem, Prescription?) -> Void
    @State private var muscle: String?
    @State private var others = false
    @State private var showAll = false
    @State private var query = ""
    @State private var load: DayEditSuggestLoad = .idle
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: BlockBuilderModel, day: Int, muscle: String?, onPick: @escaping (WireCatalogItem, Prescription?) -> Void) {
        self.model = model; self.day = day; self.onPick = onPick
        _muscle = State(initialValue: muscle)
    }

    /// Muscles under their band this week (kevés) first, in body order.
    private var under: [String] { model.outside.filter { $0.fit == "below" }.map(\.muscle) }
    /// Then the banded muscles this day already trains.
    private var dayMuscles: [String] {
        let own = Set((model.draft?.days[safe: day]?.exercises ?? []).map(\.muscle))
        return model.bandedMuscles.map(\.muscle).filter { own.contains($0) && !under.contains($0) }
    }
    /// Everything else behind „Más izom".
    private var rest: [String] {
        var seen = Set(under + dayMuscles)
        return (model.bandedMuscles.map(\.muscle) + ["calf", "core"]).filter { seen.insert($0).inserted }
    }

    var body: some View {
        let d = model.draft?.days[safe: day]
        let taken = dayEditTaken(d)
        NKSheetFrame(hue: planHue, eyebrow: d?.name ?? "", title: "Mit tegyünk a napra?") {
            Text("MELYIK IZOMRA?").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                ForEach(under, id: \.self) { m in chip(m, low: true) }
                ForEach(dayMuscles, id: \.self) { m in chip(m, low: false) }
                Button { animate { others.toggle() } } label: {
                    HStack(spacing: 6) {
                        Text("Más izom").nkFont(13, .medium)
                        Image(systemName: others ? "chevron.up" : "chevron.down").font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 14).frame(minHeight: 38)
                    .background(Capsule().strokeBorder(.white.opacity(0.22), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                if others { ForEach(rest, id: \.self) { m in chip(m, low: false) } }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let muscle {
                let pool = dayEditPool(model, taken: taken)
                DayEditSuggestions(load: load, taken: taken, empty: "Erre az izomra most nincs jó ajánlásom — nézd meg a teljes listát",
                                   onPick: pick)
                DayEditFullList(showAll: $showAll, query: $query, forced: load == .failed,
                                items: pool.filter { $0.coarse == muscle }, others: pool.filter { $0.coarse != muscle },
                                label: load.label, onPick: { pick($0, load.prescription(for: $0)) })
            } else {
                Text("Válassz izmot, és mutatom, mi illik ide.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, alignment: .leading)
            }
            Text("Az új gyakorlat a nap végére kerül, az edzésmód szerinti sorozatokkal. A döntés a tiéd — a teljes listából bármit választhatsz.")
                .nkFont(12).foregroundStyle(.white.opacity(0.45))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .task(id: muscle) {
            guard let muscle else { load = .idle; return }
            load = .loading
            do { load = .ready(try await model.suggest(mode: "add", day: day, muscle: muscle)) } catch {
                // A chip switch cancels this read: the next one is already loading, not failed.
                if Task.isCancelled { return }
                load = .failed
            }
        }
    }

    private func animate(_ change: () -> Void) {
        if reduceMotion { change() } else { withAnimation(.snappy(duration: 0.2)) { change() } }
    }

    private func pick(_ item: WireCatalogItem, _ prescription: Prescription?) {
        onPick(item, prescription)
        dismiss()
    }

    private func chip(_ m: String, low: Bool) -> some View {
        let on = muscle == m
        return Button {
            animate { muscle = on ? nil : m; showAll = false; query = "" }
        } label: {
            HStack(spacing: 6) {
                Text(planMuscleName(m)).nkFont(13, .medium)
                if low {
                    Text("kevés").nkFont(10, .semibold, design: .monospaced)
                        .foregroundStyle(on ? NK.ground.opacity(0.7) : planHue.glow)
                }
            }
            .foregroundStyle(on ? NK.ground : .white)
            .padding(.horizontal, 14).frame(minHeight: 38)
            .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
            .overlay(Capsule().strokeBorder(.white.opacity(on ? 0 : 0.18), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - Swap

struct DayEditSwapSheet: View {
    let model: BlockBuilderModel
    let rowId: String
    let onPick: (WireCatalogItem, Prescription?) -> Void
    @State private var showAll = false
    @State private var query = ""
    @State private var load: DayEditSuggestLoad = .idle
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let draft = model.draft, let at = draft.locate(rowId) {
            let row = draft.days[at.day].exercises[at.index]
            let taken = dayEditTaken(draft.days[at.day])
            let pool = dayEditPool(model, taken: taken)
            NKSheetFrame(hue: planHue, eyebrow: row.name, title: "Mire cseréljük a blokk végéig?") {
                DayEditSuggestions(load: load, taken: taken, empty: "Most nincs jó ajánlásom — nézd meg a teljes listát", onPick: pick)
                DayEditFullList(showAll: $showAll, query: $query, forced: load == .failed,
                                items: pool.filter { $0.coarse == row.muscle }, others: pool.filter { $0.coarse != row.muscle },
                                label: load.label, onPick: { pick($0, load.prescription(for: $0)) })
                Text("A csere a blokk hátralévő részére szól, a technika és amit te állítottál, marad. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .task(id: rowId) {
                load = .loading
                do { load = .ready(try await model.suggest(mode: "replace", day: at.day, outgoing: row)) } catch {
                    if Task.isCancelled { return }
                    load = .failed
                }
            }
        }
    }

    private func pick(_ item: WireCatalogItem, _ prescription: Prescription?) {
        onPick(item, prescription)
        dismiss()
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
