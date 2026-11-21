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
    var body: some View {
        VStack(spacing: 1) {
            Text(value).nkFont(narrow ? 20 : 22, .medium).foregroundStyle(warn ? planWarn : .white)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(word).nkFont(narrow ? 10 : 11).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 6).padding(.vertical, 8)
        .modifier(CellBackground(own: own))
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
