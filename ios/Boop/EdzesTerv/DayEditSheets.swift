import SwiftUI
import Observation
import BoopCore
import BoopDesign

// The block builder's day editor (mezo-r36n9.116, spec 2026-11-20-boop-blokk-szerkeszto-design.md §6): the row's
// settings sheet, the add sheet (the sub-muscle dropdown, then up to five suggestions, then the full list — the
// multi-select look is the approved spike `spike/boop-izomreszek`, mezo-r36n9.127) and the swap sheet
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
    /// The small editors a row's ismétlés / tartalék cell opens (mezo-r36n9.138).
    case reps(String)
    case reserve(String)
    /// The day, the sub-muscles picked up front and the dropdown open (both simulator review only).
    case add(Int, muscles: Set<String> = [], open: Bool = false)
    case swap(String)

    var id: String {
        switch self {
        case .settings(let id): "s\(id)"
        case .reps(let id): "r\(id)"
        case .reserve(let id): "v\(id)"
        case .add(let d, _, _): "a\(d)"
        case .swap(let id): "w\(id)"
        }
    }

    /// The small editors' fixed height; nil = a full-height sheet.
    var compactHeight: CGFloat? {
        switch self {
        case .reps: 470
        case .reserve: 400
        default: nil
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
                // No warm-up field: the app never shows warm-ups (owner, 2026-11-25), and the row keeps the
                // server's own count untouched on save.
                if !row.overrides.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top, spacing: 9) {
                            Circle().fill(planHue.glow).frame(width: 7, height: 7).padding(.top, 6)
                            Text("Ezt te állítottad; az edzésmód nem írja felül.")
                                .nkFont(14).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                        }
                        Button { edit { $0.resetToStyle(day: at.day, at: at.index) } } label: {
                            Text("Visszaállítom az edzésmódra").nkFont(14, .semibold).foregroundStyle(.white)
                                .padding(.horizontal, 16).frame(minHeight: 44)
                                .background(Capsule().fill(.white.opacity(0.08)).overlay(Capsule().stroke(.white.opacity(0.16))))
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
                // The sheet's one primary: white, as in every card (NKCardActions; the hue is for Indítás).
                Button { dismiss() } label: {
                    Text("Kész").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(Capsule().fill(.white))
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

    /// One group of the sheet as a section card (spec 2026-11-27 §5.6): the kit's head, the „te állítottad" tag
    /// under it and a hue rim while the value is his own.
    private func field(_ title: String, note: String? = nil, mine: Bool, @ViewBuilder control: () -> some View) -> some View {
        NKSectionCard(title, hue: planHue) {
            VStack(alignment: .leading, spacing: 10) {
                if mine { mineTag }
                if let note { Text(note).nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true) }
                control()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 4)
        }
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(planHue.glow.opacity(mine ? 0.45 : 0), lineWidth: 1))
    }

    private var mineTag: some View {
        Text("TE ÁLLÍTOTTAD").nkFont(9, .semibold, design: .monospaced).tracking(1)
            .foregroundStyle(NK.ground)
            .padding(.horizontal, 6).padding(.vertical, 3)
            .background(Capsule().fill(planHue.glow))
            .fixedSize()
    }
}

// MARK: - The small editor of one value (mezo-r36n9.138)

/// What a row's ismétlés or tartalék cell opens: the value big, its steppers (ismétlés 1–30 as min–max, min ≤ max;
/// tartalék 0–4, 0 = bukásig), the own-value line with „Visszaállítom az edzésmódra" (only this field's key; the
/// settings sheet keeps its reset-all) and „Kész". Every tap goes through the draft's edit API.
struct DayEditValueSheet: View {
    enum Field { case reps, reserve }

    let model: BlockBuilderModel
    let rowId: String
    let field: Field
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let draft = model.draft, let at = draft.locate(rowId) {
            let row = draft.days[at.day].exercises[at.index]
            let reps = field == .reps
            let key = reps ? "repRange" : "targetRir"
            let own = row.overrides.contains(key)
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(reps ? "ISMÉTLÉS" : "TARTALÉK").nkFont(11, .semibold, design: .monospaced).tracking(1.4)
                        .foregroundStyle(planHue.glow)
                    Text(row.name).nkFont(24, design: .serif).foregroundStyle(.white)
                        .lineLimit(2).minimumScaleFactor(0.8)
                }
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(reps ? "\(row.repMin)–\(row.repMax)" : "\(row.targetRIR)")
                        .nkFont(48, .medium).foregroundStyle(!reps && row.targetRIR == 0 ? planWarn : .white)
                        .contentTransition(.numericText())
                    Text(reps ? "ismétlés" : (row.targetRIR == 0 ? "bukásig" : "tartalék"))
                        .nkFont(15).foregroundStyle(.white.opacity(0.6))
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
                VStack(spacing: 0) {
                    if reps {
                        line("Legalább", "\(row.repMin)", label: "Legkevesebb ismétlés",
                             down: { if row.repMin > 1 { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin - 1, max: row.repMax) } } },
                             up: { if row.repMin < 30 { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin + 1, max: max(row.repMax, row.repMin + 1)) } } })
                        Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                        line("Legfeljebb", "\(row.repMax)", label: "Legtöbb ismétlés",
                             down: { if row.repMax > 1 { edit { $0.setRepRange(day: at.day, at: at.index, min: min(row.repMin, row.repMax - 1), max: row.repMax - 1) } } },
                             up: { if row.repMax < 30 { edit { $0.setRepRange(day: at.day, at: at.index, min: row.repMin, max: row.repMax + 1) } } })
                    } else {
                        line("Tartalék ismétlés", "\(row.targetRIR)", label: "Tartalék",
                             down: { if row.targetRIR > 0 { edit { $0.setReserve(day: at.day, at: at.index, row.targetRIR - 1) } } },
                             up: { if row.targetRIR < 4 { edit { $0.setReserve(day: at.day, at: at.index, row.targetRIR + 1) } } })
                        Text("0 = bukásig").nkFont(12).foregroundStyle(.white.opacity(0.45))
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.bottom, 8)
                    }
                }
                .padding(.horizontal, 14)
                .nkInnerCard(radius: 18)
                if own {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .top, spacing: 6) {
                            Circle().fill(planHue.glow).frame(width: 6, height: 6).padding(.top, 6)
                            Text("Ezt te állítottad; az edzésmód nem írja felül.").nkFont(13).foregroundStyle(.white.opacity(0.7))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Button { edit { $0.resetToStyle(day: at.day, at: at.index, key: key) } } label: {
                            Text("Visszaállítom az edzésmódra").nkFont(14, .semibold).foregroundStyle(.white).underline()
                                .frame(minHeight: 44).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 0)
                Button { dismiss() } label: {
                    Text("Kész").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 24).padding(.top, 26).padding(.bottom, 12)
            .preferredColorScheme(.dark)
        }
    }

    private func edit(_ change: (inout BlockDraft) -> Void) {
        guard var d = model.draft else { return }
        change(&d)
        withAnimation(reduceMotion ? nil : .snappy) { model.draft = d }
    }

    private func line(_ title: String, _ text: String, label: String, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        HStack {
            Text(title).nkFont(15, .medium).foregroundStyle(.white.opacity(0.9))
            Spacer()
            DayEditStepper(text: text, label: label, down: down, up: up)
        }
        .frame(minHeight: 60)
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
    var header = "AJÁNLOM"
    let onPick: (WireCatalogItem, Prescription?) -> Void

    var body: some View {
        switch load {
        case .idle: EmptyView()
        case .loading:
            DayEditHeader(text: header)
            ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 90)
        case .failed:
            Text("Most nem érem el az ajánlásokat — a teljes listából választhatsz.")
                .nkFont(14).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .ready(let s):
            let picks = Array(s.suggestions.filter { !$0.exercise.isOn(taken) && $0.exercise.asCatalog != nil }.prefix(5))
            DayEditHeader(text: header)
            if picks.isEmpty { NKNoFreshData(empty) }
            ForEach(Array(picks.enumerated()), id: \.element.exercise.id) { i, p in
                Button { onPick(p.exercise, p.prescription) } label: { DayEditCard(s: p, first: i == 0) }.buttonStyle(.plain)
            }
        }
    }
}

private struct DayEditHeader: View {
    let text: String
    var body: some View {
        Text(text).nkFont(10, .medium, design: .monospaced).tracking(1.4)
            .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func dayEditRoleLine(_ item: WireCatalogItem) -> String {
    exerciseRoleLine(muscle: item.muscle ?? "", type: ExerciseType(wire: item.type))
}

private struct DayEditCard: View {
    let s: WireSuggestion
    let first: Bool

    var body: some View {
        ExercisePickCard(name: s.exercise.name, image: BoopConfig.mediaURL(s.exercise.imageStartUrl),
                         role: dayEditRoleLine(s.exercise), reason: s.reasonText,
                         last: s.lastTopSet.map { SwapSheet.lastText(kg: $0.weightKg, reps: $0.reps) },
                         first: first, hue: planHue)
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
        ExercisePickRow(name: item.name, image: BoopConfig.mediaURL(item.imageStartUrl), role: dayEditRoleLine(item),
                        quiet: label(item))
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
    /// The fine catalogue tokens picked in the dropdown; none = the week's under-band groups (the server's).
    @State private var picked: Set<String>
    @State private var open: Bool
    @State private var showAll = false
    @State private var query = ""
    @State private var load: DayEditSuggestLoad = .idle
    /// A re-read for the new selection is on its way: the cards on screen still belong to the old one.
    @State private var pending = false
    @State private var rowFrame: CGRect = .zero
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let space = "dayEditAdd"

    init(model: BlockBuilderModel, day: Int, muscles: Set<String> = [], open: Bool = false,
         onPick: @escaping (WireCatalogItem, Prescription?) -> Void) {
        self.model = model; self.day = day; self.onPick = onPick
        _picked = State(initialValue: muscles)
        _open = State(initialValue: open)
    }

    /// Coarse groups under their band this week (the evaluation's) — their „kevés" mark in the dropdown.
    private var under: Set<String> { Set(model.outside.filter { $0.fit == "below" }.map(\.muscle)) }

    var body: some View {
        let d = model.draft?.days[safe: day]
        let taken = dayEditTaken(d)
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                NKSheetFrame(hue: planHue, eyebrow: d?.name ?? "", title: "Mit tegyünk a napra?") {
                    content(taken)
                }
                .scrollDisabled(open)
                .accessibilityHidden(open)

                if open {
                    Color.black.opacity(0.45).ignoresSafeArea()
                        .onTapGesture { animate { open = false } }
                        .accessibilityHidden(true)
                        .transition(.opacity)
                    // The row stays lit above the dim, the panel hangs under it.
                    dropdownRow
                        .frame(width: rowFrame.width)
                        .offset(x: rowFrame.minX, y: rowFrame.minY)
                    DayEditMusclePanel(picked: $picked, under: under, done: { animate { open = false } })
                        .frame(width: rowFrame.width)
                        .frame(maxHeight: max(200, geo.size.height - rowFrame.maxY - 20))
                        .fixedSize(horizontal: false, vertical: true)
                        .offset(x: rowFrame.minX, y: rowFrame.maxY + 8)
                        .transition(.opacity.combined(with: .scale(scale: 0.97, anchor: .top)))
                }
            }
            .coordinateSpace(.named(Self.space))
        }
        .background(NK.ground)
        .task(id: picked) {
            // Ticks apply live: the cards already on screen stay while the next read is on its way.
            let first = load.suggestions == nil
            if first { load = .loading } else {
                try? await Task.sleep(for: .milliseconds(250))
                if Task.isCancelled { return }
            }
            do {
                let answer = try await model.suggest(mode: "add", day: day, muscles: picked)
                // A stale answer (a later tick cancelled this read) must not win.
                guard !Task.isCancelled else { return }
                load = .ready(answer)
                pending = false
            } catch {
                // A tick cancels this read: the next one is already on its way, not failed.
                if Task.isCancelled { return }
                load = .failed
                pending = false
            }
        }
        .onChange(of: picked) { pending = true }
    }

    @ViewBuilder private func content(_ taken: Set<String>) -> some View {
        let pool = dayEditPool(model, taken: taken)
        let none = picked.isEmpty
        dropdownRow
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(Self.space)) } action: { rowFrame = $0 }
            .opacity(open ? 0 : 1)

        if none {
            // Nothing picked: the server suggests for the week's under-band groups; with none of those, only the hint.
            let nothingLow = load.suggestions.map { $0.suggestions.isEmpty } ?? false
            Text(nothingLow ? "Válassz izmot, és ajánlok hozzá."
                 : "Válassz izmot, és ajánlok hozzá. Addig a hét kevés izmaira ajánlok.")
                .nkFont(14).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if !nothingLow {
                DayEditSuggestions(load: load, taken: taken, empty: "Most nincs jó ajánlásom — nézd meg a teljes listát",
                                   header: "AJÁNLOM · A HÉT KEVÉS IZMAIRA", onPick: pick)
                    .opacity(pending ? 0.4 : 1).disabled(pending)
            }
        } else {
            DayEditSuggestions(load: load, taken: taken,
                               empty: "Ezekre az izmokra most nincs jó ajánlásom — nézd meg a teljes listát", onPick: pick)
                .opacity(pending ? 0.4 : 1).disabled(pending)
        }
        let mine = none ? pool : pool.filter { picked.contains(($0.muscle ?? "").lowercased()) }
        DayEditFullList(showAll: $showAll, query: $query, forced: load == .failed,
                        items: mine, others: none ? [] : pool.filter { !picked.contains(($0.muscle ?? "").lowercased()) },
                        label: load.label, onPick: { pick($0, load.prescription(for: $0)) })
        Text("Az új gyakorlat a nap végére kerül, az edzésmód szerinti sorozatokkal. A döntés a tiéd — a teljes listából bármit választhatsz.")
            .nkFont(12).foregroundStyle(.white.opacity(0.45))
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// „Izmok  Hát · középső, Mell · felső ▾" — one line; too long → „Hát · középső +2"; nothing picked → „Minden izom".
    private var dropdownRow: some View {
        let parts = SubMuscles.summary(picked)
        return Button { animate { open.toggle() } } label: {
            HStack(spacing: 10) {
                Text("Izmok").nkFont(14).foregroundStyle(.white.opacity(0.55))
                Group {
                    if parts.isEmpty {
                        Text("Minden izom").foregroundStyle(.white.opacity(0.9))
                    } else {
                        ViewThatFits(in: .horizontal) {
                            Text(parts.joined(separator: ", ")).lineLimit(1).fixedSize()
                            if parts.count > 1 { Text("\(parts[0]) +\(parts.count - 1)").lineLimit(1).fixedSize() }
                            Text(SubMuscles.shortSummary(picked) ?? "").lineLimit(1)
                        }
                        .foregroundStyle(.white)
                    }
                }
                .nkFont(15, .medium)
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.down")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.6))
                    .rotationEffect(.degrees(open ? 180 : 0))
            }
            .padding(.horizontal, 16).frame(minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(white: open ? 0.17 : 0.12)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(open ? 0.3 : 0.16), lineWidth: 0.5))
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Izmok: \(parts.isEmpty ? "minden izom" : parts.joined(separator: ", "))")
        .accessibilityHint(open ? "Bezárja a listát" : "Megnyitja az izmok listáját")
    }

    private func animate(_ change: () -> Void) {
        if reduceMotion { change() } else { withAnimation(.snappy(duration: 0.22)) { change() } }
    }

    private func pick(_ item: WireCatalogItem, _ prescription: Prescription?) {
        onPick(item, prescription)
        dismiss()
    }
}

/// A drawn checkbox: an outline when off, the hue with a drawn tick when on, a dash when part of the group is on.
struct DayEditCheckbox: View {
    enum Mark { case off, on, partial }
    let mark: Mark
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .fill(mark == .off ? Color.clear : planHue.glow)
            RoundedRectangle(cornerRadius: size * 0.3, style: .continuous)
                .strokeBorder(mark == .off ? .white.opacity(0.42) : .clear, lineWidth: 1.5)
            switch mark {
            case .on:
                Path { p in
                    p.move(to: CGPoint(x: size * 0.26, y: size * 0.52))
                    p.addLine(to: CGPoint(x: size * 0.43, y: size * 0.69))
                    p.addLine(to: CGPoint(x: size * 0.75, y: size * 0.33))
                }
                .stroke(NK.ground, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round, lineJoin: .round))
            case .partial:
                Capsule().fill(NK.ground).frame(width: size * 0.5, height: size * 0.12)
            case .off: EmptyView()
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The dropdown panel: one block per group (a group checkbox, then its parts as checkbox pills), Törlés · Kész below.
/// „kevés" sits once on a group under its band — on a leg part, which is its own group, on the part.
struct DayEditMusclePanel: View {
    @Binding var picked: Set<String>
    let under: Set<String>
    let done: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ViewThatFits(in: .vertical) {
                groupsList
                ScrollView { groupsList }.scrollIndicators(.hidden)
            }
            Rectangle().fill(.white.opacity(0.1)).frame(height: 0.5)
            HStack {
                Button { picked = [] } label: {
                    Text("Törlés").nkFont(15, .medium).foregroundStyle(.white.opacity(picked.isEmpty ? 0.35 : 0.85))
                        .padding(.horizontal, 6).frame(minHeight: 44)
                }
                .buttonStyle(.plain).disabled(picked.isEmpty)
                Spacer()
                Button(action: done) {
                    Text("Kész").nkFont(15, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 26).frame(minHeight: 40)
                        .background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
        }
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(white: 0.115)))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.16), lineWidth: 0.5))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .black.opacity(0.55), radius: 24, y: 12)
    }

    private var groupsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(SubMuscles.groups.enumerated()), id: \.element.id) { i, g in
                if i > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, 50) }
                groupBlock(g)
            }
        }
        .padding(.vertical, 6)
    }

    private func mark(_ g: SubMuscles.Group) -> DayEditCheckbox.Mark {
        let n = g.parts.filter { picked.contains($0.id) }.count
        return n == 0 ? .off : n == g.parts.count ? .on : .partial
    }

    private func groupBlock(_ g: SubMuscles.Group) -> some View {
        let m = mark(g)
        let single = g.parts.count == 1
        let on = g.parts.filter { picked.contains($0.id) }.count
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                if m == .on { picked.subtract(g.parts.map(\.id)) } else { picked.formUnion(g.parts.map(\.id)) }
            } label: {
                HStack(spacing: 12) {
                    DayEditCheckbox(mark: m)
                    Text(g.name).nkFont(16, .medium).foregroundStyle(.white)
                    if SubMuscles.groupLow(g, under: under) { lowMark }
                    Spacer(minLength: 0)
                    if !single, m != .off {
                        Text("\(on)/\(g.parts.count)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                    }
                }
                .frame(minHeight: 36)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(single ? g.name : "\(g.name), egész csoport\(SubMuscles.groupLow(g, under: under) ? ", kevés" : "")")
            .accessibilityValue(m == .on ? "kijelölve" : m == .partial ? "részben" : "")
            if !single {
                NKFlowRow(spacing: 7, rowSpacing: 7) {
                    ForEach(g.parts) { p in partPill(g, p) }
                }
                .padding(.leading, 34)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
    }

    private var lowMark: some View {
        Text("kevés").nkFont(10, .semibold, design: .monospaced).foregroundStyle(planHue.glow)
    }

    private func partPill(_ g: SubMuscles.Group, _ p: SubMuscles.Part) -> some View {
        let on = picked.contains(p.id)
        let low = SubMuscles.partLow(g, p, under: under)
        return Button {
            if on { picked.remove(p.id) } else { picked.insert(p.id) }
        } label: {
            HStack(spacing: 7) {
                DayEditCheckbox(mark: on ? .on : .off, size: 18)
                Text(p.short).nkFont(14).foregroundStyle(.white.opacity(on ? 1 : 0.85)).lineLimit(1)
                if low { lowMark }
            }
            .padding(.leading, 8).padding(.trailing, 11).frame(minHeight: 36)
            .background(Capsule().fill(.white.opacity(on ? 0.13 : 0.06)))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(SubMuscles.name(p.id))\(low ? ", kevés" : "")")
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
            NKSheetFrame(hue: planHue, eyebrow: row.name, title: "Mire cseréljük a mezociklus végéig?") {
                DayEditSuggestions(load: load, taken: taken, empty: "Most nincs jó ajánlásom — nézd meg a teljes listát", onPick: pick)
                DayEditFullList(showAll: $showAll, query: $query, forced: load == .failed,
                                items: pool.filter { $0.coarse == row.muscle }, others: pool.filter { $0.coarse != row.muscle },
                                label: load.label, onPick: { pick($0, load.prescription(for: $0)) })
                Text("A csere a mezociklus hátralévő részére szól, a technika és amit te állítottál, marad. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .task(id: rowId) {
                load = .loading
                do {
                    let answer = try await model.suggest(mode: "replace", day: at.day, outgoing: row)
                    guard !Task.isCancelled else { return }
                    load = .ready(answer)
                } catch {
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
