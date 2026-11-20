#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike (mezo-r36n9.116, spec §6.1 settings, §6.2 add and swap). The add and swap sheets copy the look of
// the player's `SwapSheet`: suggestions as cards (the first one lit), then *Minden gyakorlat* with search and quiet
// labels.

// MARK: - Settings of one row

struct SzSettingsSheet: View {
    let model: SzModel
    let rowId: UUID
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let at = model.row(rowId) {
            let row = model.days[at.day].rows[at.index]
            NKSheetFrame(hue: planHue, eyebrow: row.name, title: "Beállítások") {
                field("Ismétlés sorozatonként", mine: row.overrides.contains("repRange")) {
                    HStack(spacing: 10) {
                        SzStepper(text: "\(row.repMin)", label: "Legkevesebb ismétlés",
                                  down: { edit { if $0.repMin > 1 { $0.repMin -= 1; $0.overrides.insert("repRange") } } },
                                  up: { edit { if $0.repMin < $0.repMax { $0.repMin += 1; $0.overrides.insert("repRange") } } })
                        Text("–").nkFont(20, .medium).foregroundStyle(.white.opacity(0.5))
                        SzStepper(text: "\(row.repMax)", label: "Legtöbb ismétlés",
                                  down: { edit { if $0.repMax > $0.repMin { $0.repMax -= 1; $0.overrides.insert("repRange") } } },
                                  up: { edit { if $0.repMax < 30 { $0.repMax += 1; $0.overrides.insert("repRange") } } })
                    }
                }
                field("Tartalék a sorozat végén", note: "ennyi ismétlés marad benned", mine: row.overrides.contains("targetRir")) {
                    SzStepper(text: row.reserve == 0 ? "bukásig" : "\(row.reserve)", label: "Tartalék",
                              down: { edit { if $0.reserve > 0 { $0.reserve -= 1; $0.overrides.insert("targetRir") } } },
                              up: { edit { if $0.reserve < 4 { $0.reserve += 1; $0.overrides.insert("targetRir") } } })
                }
                field("Kezdősúly", note: "nem kötelező", mine: false) {
                    if let kg = row.startKg {
                        HStack(spacing: 14) {
                            SzStepper(text: nkKg(kg), label: "Kezdősúly",
                                      down: { edit { $0.startKg = max(0, ($0.startKg ?? 0) - 0.5) } },
                                      up: { edit { $0.startKg = ($0.startKg ?? 0) + 0.5 } })
                            Button("törlöm") { edit { $0.startKg = nil } }
                                .buttonStyle(.plain).font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.7)).underline()
                        }
                    } else {
                        Button { edit { $0.startKg = 20 } } label: {
                            Text("+ megadom").nkFont(14, .medium).foregroundStyle(.white)
                                .padding(.horizontal, 16).frame(minHeight: 38)
                                .background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                field("Bemelegítő sorozat", mine: false) {
                    SzStepper(text: "\(row.warmups)", label: "Bemelegítő sorozat",
                              down: { edit { $0.warmups = max(0, $0.warmups - 1) } },
                              up: { edit { $0.warmups = min(4, $0.warmups + 1) } })
                }
                if !row.overrides.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top, spacing: 9) {
                            Circle().fill(planHue.glow).frame(width: 7, height: 7).padding(.top, 6)
                            Text("Ezt te állítottad; az edzésmód nem írja felül.")
                                .nkFont(14).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                        }
                        Button { withAnimation(.snappy) { model.resetToStyle(rowId) } } label: {
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

    private func edit(_ change: (inout SzRow) -> Void) { withAnimation(.snappy) { model.update(rowId, change) } }

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

/// The builder's round stepper, with any text in the middle.
struct SzStepper: View {
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

// MARK: - Add

struct SzAddSheet: View {
    let model: SzModel
    let day: Int
    @State private var muscle: String?
    @State private var others = false
    @State private var showAll = false
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    init(model: SzModel, day: Int, preset: String?) {
        self.model = model; self.day = day
        _muscle = State(initialValue: preset)
    }

    private var under: [String] { model.under }
    /// kevés first, then the day's own muscles, then everything else behind „Más izom".
    private var dayMuscles: [String] {
        let own = model.days[day].rows.map(\.coarse)
        return SzModel.bands.map(\.muscle).filter { own.contains($0) && !under.contains($0) }
    }
    private var rest: [String] {
        (SzModel.bands.map(\.muscle) + ["calf", "core"]).filter { !under.contains($0) && !dayMuscles.contains($0) }
    }
    private var taken: Set<String> { Set(model.days[day].rows.map(\.name)) }

    var body: some View {
        NKSheetFrame(hue: planHue, eyebrow: model.days[day].name, title: "Mit tegyünk a napra?") {
            Text("MELYIK IZOMRA?").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                .foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                ForEach(under, id: \.self) { m in chip(m, low: true) }
                ForEach(dayMuscles, id: \.self) { m in chip(m, low: false) }
                Button { withAnimation(.snappy(duration: 0.2)) { others.toggle() } } label: {
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
                let picks = SzCatalog.forMuscle(muscle, under: under.contains(muscle), excluding: taken)
                SzHeader()
                if picks.isEmpty { NKNoFreshData("Erre az izomra most nincs jó ajánlásom — nézd meg a teljes listát") }
                ForEach(Array(picks.enumerated()), id: \.element.id) { i, s in
                    Button { pick(s.pick) } label: { SzCard(s: s, first: i == 0) }.buttonStyle(.plain)
                }
                SzFullList(showAll: $showAll, query: $query,
                           items: SzCatalog.all.filter { szCoarse($0.muscle) == muscle && !taken.contains($0.name) },
                           others: SzCatalog.all.filter { szCoarse($0.muscle) != muscle && !taken.contains($0.name) },
                           onPick: pick)
            } else {
                Text("Válassz izmot, és mutatom, mi illik ide.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, alignment: .leading)
            }
            Text("Az új gyakorlat a nap végére kerül, az edzésmód szerinti sorozatokkal. A döntés a tiéd — a teljes listából bármit választhatsz.")
                .nkFont(12).foregroundStyle(.white.opacity(0.45))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func pick(_ p: SzPick) {
        withAnimation(.snappy) { model.add(p, day: day) }
        dismiss()
    }

    private func chip(_ m: String, low: Bool) -> some View {
        let on = muscle == m
        return Button {
            withAnimation(.snappy(duration: 0.2)) { muscle = on ? nil : m; showAll = false; query = "" }
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

struct SzSwapSheet: View {
    let model: SzModel
    let rowId: UUID
    @State private var showAll = false
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let at = model.row(rowId) {
            let row = model.days[at.day].rows[at.index]
            let taken = Set(model.days[at.day].rows.map(\.name))
            NKSheetFrame(hue: planHue, eyebrow: row.name, title: "Mire cseréljük a blokk végéig?") {
                let picks = SzCatalog.replacements(for: row, excluding: taken)
                SzHeader()
                ForEach(Array(picks.enumerated()), id: \.element.id) { i, s in
                    Button { pick(s.pick) } label: { SzCard(s: s, first: i == 0) }.buttonStyle(.plain)
                }
                SzFullList(showAll: $showAll, query: $query,
                           items: SzCatalog.all.filter { $0.muscle == row.muscle && !taken.contains($0.name) },
                           others: SzCatalog.all.filter { $0.muscle != row.muscle && !taken.contains($0.name) },
                           onPick: pick)
                Text("A csere a blokk hátralévő részére szól, a technika és amit te állítottál, marad. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func pick(_ p: SzPick) {
        withAnimation(.snappy) { model.swap(rowId, to: p) }
        dismiss()
    }
}

// MARK: - Shared pieces (SwapSheet's look)

struct SzHeader: View {
    var body: some View {
        Text("AJÁNLOM").nkFont(10, .medium, design: .monospaced).tracking(1.4)
            .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private func szRoleLine(_ p: SzPick) -> String {
    "\(planMuscleName(szCoarse(p.muscle))) · \(p.isolation ? "izolált" : "összetett")"
}

struct SzCard: View {
    let s: SzSuggestion
    let first: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(s.pick.name).nkFont(17, .medium).foregroundStyle(.white).lineLimit(2).minimumScaleFactor(0.8)
                Spacer(minLength: 8)
                Text(szRoleLine(s.pick)).nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
            }
            Text(s.reason).nkFont(14).foregroundStyle(.white.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)
            if let last = s.last {
                Text("Legutóbb: \(last)").nkFont(12, design: .monospaced).foregroundStyle(planHue.glow)
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

struct SzFullList: View {
    @Binding var showAll: Bool
    @Binding var query: String
    let items: [SzPick]
    let others: [SzPick]
    let onPick: (SzPick) -> Void

    var body: some View {
        Button { withAnimation(.easeInOut(duration: 0.2)) { showAll.toggle() } } label: {
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
        if showAll {
            TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
                .font(.system(size: 15)).foregroundStyle(.white)
                .autocorrectionDisabled()
                .padding(.horizontal, 14).frame(minHeight: 44)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
            let shown = query.isEmpty ? items : (items + others).filter { $0.name.localizedCaseInsensitiveContains(query) }
            ForEach(shown) { p in
                Button { onPick(p) } label: { plainRow(p) }.buttonStyle(.plain)
            }
            if shown.isEmpty { NKNoFreshData("Nincs ilyen gyakorlat a listában") }
        }
    }

    private func plainRow(_ p: SzPick) -> some View {
        let quiet = SzCatalog.quiet[p.name]
        return HStack(spacing: 10) {
            NKRemoteThumb(nil, size: 36).opacity(quiet == nil ? 1 : 0.6)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.name).nkFont(14).foregroundStyle(.white.opacity(quiet == nil ? 1 : 0.6)).lineLimit(1)
                Text(szRoleLine(p)).nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
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
    }
}
#endif
