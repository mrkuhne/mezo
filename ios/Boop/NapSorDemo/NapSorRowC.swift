#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY spike, variant C · „Mini táblázat": the muscle pill above the name, three equal cells under it
// (sorozat · ismétlés · tartalék, big numeral over the written-out word), the technique pill under the cells.

struct NapSorRowC: View {
    @Binding var row: NapSorRow
    let narrow: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            NapSorMusclePillC(token: row.muscle).padding(.leading, 28)
            HStack(alignment: .center, spacing: 8) {
                handle
                Text(row.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                dots
            }
            HStack(spacing: narrow ? 6 : 8) {
                SetCell(value: $row.sets, narrow: narrow)
                InfoCell(value: "\(row.repMin)–\(row.repMax)", word: "ismétlés", own: row.ownReps, narrow: narrow)
                InfoCell(value: "\(row.reserve)", word: "tartalék", warn: row.reserve == 0, narrow: narrow)
            }
            .padding(.leading, 28)
            NapSorTechniqueChipC(chip: row.chip).padding(.leading, 28).padding(.top, 1)
        }
    }

    private var handle: some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
        }
        .frame(width: 20, height: 30)
    }

    private var dots: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
        }
        .frame(width: 30, height: 30)
    }
}

private struct CellBackground: ViewModifier {
    var own = false
    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(.white.opacity(0.09), lineWidth: 0.5))
            .overlay(alignment: .topTrailing) {
                if own { Circle().fill(planHue.glow).frame(width: 6, height: 6).padding(7) }
            }
    }
}

/// A read-only cell: big numeral, the word written out under it.
private struct InfoCell: View {
    let value: String
    let word: String
    var own = false
    var warn = false
    let narrow: Bool
    /// Variant D: the cell opens its editor — a small chevron after the word says so.
    var edit: (() -> Void)? = nil
    var body: some View {
        if let edit {
            Button(action: edit) { content }.buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        VStack(spacing: 1) {
            Text(value).nkFont(narrow ? 20 : 22, .medium).foregroundStyle(warn ? planWarn : .white)
                .lineLimit(1).minimumScaleFactor(0.7)
            HStack(spacing: 3) {
                Text(word).nkFont(narrow ? 10 : 11).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
                if edit != nil {
                    Image(systemName: "chevron.down").font(.system(size: narrow ? 7 : 8, weight: .bold))
                        .foregroundStyle(.white.opacity(0.45))
                }
            }
        }
        .padding(.horizontal, 6).padding(.vertical, 8)
        .modifier(CellBackground(own: own))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// The sorozat cell is itself the stepper: its left half is −, its right half is + (each ≥ 44 pt wide even at
/// 375 pt), the marks on the edges, the numeral and the word in the middle.
private struct SetCell: View {
    @Binding var value: Int
    let narrow: Bool
    var body: some View {
        ZStack {
            HStack(spacing: 0) {
                half("−", .leading, "Egy sorozattal kevesebb") { value = max(1, value - 1) }
                half("+", .trailing, "Egy sorozattal több") { value = min(8, value + 1) }
            }
            VStack(spacing: 1) {
                Text("\(value)").nkFont(narrow ? 20 : 22, .medium).foregroundStyle(.white).contentTransition(.numericText())
                Text("sorozat").nkFont(narrow ? 10 : 11).foregroundStyle(.white.opacity(0.55))
            }
            .allowsHitTesting(false)
        }
        .modifier(CellBackground())
        .sensoryFeedback(.impact(weight: .light), trigger: value)
    }

    private func half(_ mark: String, _ edge: Alignment, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(mark).nkFont(narrow ? 15 : 17, .medium).foregroundStyle(.white.opacity(0.85))
                .frame(width: narrow ? 20 : 24, height: narrow ? 20 : 24)
                .background(Circle().fill(.white.opacity(0.10)))
                .padding(.horizontal, narrow ? 5 : 7)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: edge)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - D · C revised: ≡ name ⋯ · the three cells (reps and reserve open an editor) · muscle + technique pills

struct NapSorRowD: View {
    enum Editing: String, Identifiable { case reps, reserve; var id: String { rawValue } }

    @Binding var row: NapSorRow
    let narrow: Bool
    @State private var editing: Editing?

    init(row: Binding<NapSorRow>, narrow: Bool) {
        _row = row
        self.narrow = narrow
        // Simulator review: -previewNapSorEdit reps opens Cable Shrug's reps; reserve opens Rear-Delt Row's reserve.
        let flag = UserDefaults.standard.string(forKey: "previewNapSorEdit")
        let open: Editing? = switch (flag, row.wrappedValue.id) {
        case ("reps", "3"): .reps
        case ("reserve", "6"): .reserve
        default: nil
        }
        _editing = State(initialValue: open)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                VStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
                }
                .frame(width: 20, height: 30)
                Text(row.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
                }
                .frame(width: 30, height: 30)
            }
            HStack(spacing: narrow ? 6 : 8) {
                SetCell(value: $row.sets, narrow: narrow)
                InfoCell(value: "\(row.repMin)–\(row.repMax)", word: "ismétlés", own: row.ownReps, narrow: narrow) { editing = .reps }
                InfoCell(value: "\(row.reserve)", word: "tartalék", own: row.ownReserve, warn: row.reserve == 0, narrow: narrow) { editing = .reserve }
            }
            .padding(.leading, 28)
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                Text(SubMuscles.name(row.muscle)).nkFont(12, .medium).foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1).fixedSize()
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .overlay(Capsule().strokeBorder(planHue.glow.opacity(0.35), lineWidth: 1))
                NapSorTechniqueChipC(chip: row.chip)
            }
            .padding(.leading, 28).padding(.top, 1)
        }
        .sheet(item: $editing) { which in
            NapSorValueEditor(row: $row, which: which) { editing = nil }
                .presentationDetents([.height(which == .reps ? 470 : 400)])
                .presentationBackground(Color(hex: 0x161B22).opacity(0.96))
                .presentationCornerRadius(30)
                .presentationDragIndicator(.visible)
        }
    }
}

/// The small editor of one value: ismétlés (min–max, 1–30) or tartalék (0–4, 0 = bukásig).
private struct NapSorValueEditor: View {
    @Binding var row: NapSorRow
    let which: NapSorRowD.Editing
    let done: () -> Void

    private var own: Bool { which == .reps ? row.ownReps : row.ownReserve }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(which == .reps ? "ISMÉTLÉS" : "TARTALÉK").nkFont(11, .semibold, design: .monospaced).tracking(1.4)
                    .foregroundStyle(planHue.glow)
                Text(row.name).nkFont(24, design: .serif).foregroundStyle(.white)
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(which == .reps ? "\(row.repMin)–\(row.repMax)" : "\(row.reserve)")
                    .nkFont(48, .medium).foregroundStyle(which == .reserve && row.reserve == 0 ? planWarn : .white)
                    .contentTransition(.numericText())
                Text(which == .reps ? "ismétlés" : (row.reserve == 0 ? "bukásig" : "tartalék"))
                    .nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity)
            VStack(spacing: 0) {
                if which == .reps {
                    line("Legalább", row.repMin,
                         down: { set { $0.repMin = max(1, $0.repMin - 1) } },
                         up: { set { $0.repMin = min(30, $0.repMin + 1); $0.repMax = max($0.repMax, $0.repMin) } })
                    Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                    line("Legfeljebb", row.repMax,
                         down: { set { $0.repMax = max(1, $0.repMax - 1); $0.repMin = min($0.repMin, $0.repMax) } },
                         up: { set { $0.repMax = min(30, $0.repMax + 1) } })
                } else {
                    line("Tartalék ismétlés", row.reserve,
                         down: { set { $0.reserve = max(0, $0.reserve - 1) } },
                         up: { set { $0.reserve = min(4, $0.reserve + 1) } })
                    Text("0 = bukásig").nkFont(12).foregroundStyle(.white.opacity(0.45))
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.bottom, 4)
                }
            }
            .padding(.horizontal, 14)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.06)))
            if own {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Circle().fill(planHue.glow).frame(width: 6, height: 6)
                        Text("Ezt te állítottad; az edzésmód nem írja felül.").nkFont(13).foregroundStyle(.white.opacity(0.7))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Button("Visszaállítom az edzésmódra") {
                        withAnimation(.snappy) {
                            if which == .reps { row.repMin = row.planRepMin; row.repMax = row.planRepMax; row.ownReps = false }
                            else { row.reserve = row.planReserve; row.ownReserve = false }
                        }
                    }
                    .buttonStyle(.plain).nkFont(14, .semibold).foregroundStyle(.white).underline()
                }
            }
            Spacer(minLength: 0)
            Button(action: done) {
                Text("Kész").nkFont(16, .semibold).foregroundStyle(NK.ground)
                    .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(.white))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 24).padding(.top, 26).padding(.bottom, 12)
        .preferredColorScheme(.dark)
    }

    private func set(_ change: (inout NapSorRow) -> Void) {
        withAnimation(.snappy) {
            change(&row)
            if which == .reps { row.ownReps = true } else { row.ownReserve = true }
        }
    }

    private func line(_ title: String, _ value: Int, down: @escaping () -> Void, up: @escaping () -> Void) -> some View {
        HStack {
            Text(title).nkFont(15, .medium).foregroundStyle(.white.opacity(0.9))
            Spacer()
            PlanSetStepper(value: value, name: title, down: down, up: up)
        }
        .frame(minHeight: 60)
    }
}

/// Same look as the A/B muscle pill (those are file-private there).
private struct NapSorMusclePillC: View {
    let token: String
    var body: some View {
        Text(SubMuscles.name(token)).nkFont(12, .medium).foregroundStyle(.white.opacity(0.9))
            .lineLimit(1).fixedSize()
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(planHue.glow.opacity(0.10)))
            .overlay(Capsule().strokeBorder(planHue.glow.opacity(0.55), lineWidth: 1))
    }
}

private struct NapSorTechniqueChipC: View {
    let chip: NapSorRow.Chip
    var body: some View {
        switch chip {
        case .lock(let text):
            HStack(spacing: 5) {
                PlanMark(.shield, color: .white.opacity(0.4), size: 12)
                Text(text).nkFont(12, .medium).foregroundStyle(.white.opacity(0.4)).lineLimit(1)
            }
            .fixedSize()
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(.white.opacity(0.06)))
        case .open: pill(.keep, "+ technika vagy kihívás", .white.opacity(0.55))
        case .technique(let name, let mark, let boop): pill(mark, name, planHue.glow, boop: boop)
        case .challenge: pill(.flag, "Kihívás a végén", planWarn)
        }
    }

    private func pill(_ mark: PlanMark.Kind, _ text: String, _ color: Color, boop: Bool = false) -> some View {
        HStack(spacing: 5) {
            PlanMark(mark, color: color, size: 12)
            Text(text).nkFont(12, .medium).foregroundStyle(color).lineLimit(1)
            if boop {
                Text("Boop").nkFont(9, .semibold, design: .monospaced).tracking(0.8).foregroundStyle(NK.ground)
                    .padding(.horizontal, 5).padding(.vertical, 2).background(Capsule().fill(planHue.glow))
            }
        }
        .fixedSize()
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(Capsule().fill(.white.opacity(0.09)))
    }
}
#endif
