#if DEBUG
import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY simulator spike (spike/boop-nap-sorok): two looks for the exercise row of a day card in the block builder.
//   -previewNapSor YES  -previewNapSorVariant a|b
// a = „Címkesor": name, then one row of small pills (muscle · reps · reserve · technique), stepper + ⋯ at the right.
// b = „Értékoszlopok": name + muscle pill on the left, three labelled values (SOROZAT with the stepper, ISM., TART.)
//     as a compact block on the right. Static fixtures, nothing is wired. Nothing here ships.

struct NapSorDemoRoot: View {
    @State private var variant: String = UserDefaults.standard.string(forKey: "previewNapSorVariant") ?? "a"
    @State private var rows = NapSorRow.fixture
    @State private var width: CGFloat = 0
    private static let label = ["a": "A · Címkesor", "b": "B · Értékoszlopok", "c": "C · Mini táblázat"]

    var body: some View {
        ZStack(alignment: .top) {
            PlanSky(height: 360)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        Spacer()
                        ForEach(["a", "b", "c"], id: \.self) { v in
                            Button { withAnimation(.snappy) { variant = v } } label: {
                                Text(width < 400 && variant != v ? v.uppercased() : Self.label[v] ?? v).nkFont(12, .semibold).lineLimit(1).fixedSize()
                                    .foregroundStyle(variant == v ? NK.ground : .white)
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(Capsule().fill(variant == v ? Color.white : .white.opacity(0.12)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                    NapSorDayCard(variant: variant, rows: $rows, narrow: width > 0 && width < 400)
                }
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .preferredColorScheme(.dark)
    }
}

/// One fixture row of „Hétfő · Hát és bicepsz".
struct NapSorRow: Identifiable {
    enum Chip { case lock(String), open, technique(String, PlanMark.Kind, boop: Bool), challenge }
    let id: String
    let name: String
    let muscle: String
    var sets: Int
    let repMin: Int, repMax: Int
    let reserve: Int
    let chip: Chip
    /// He set the rep range himself (overrides the plan's default).
    var ownReps = false

    static let fixture: [NapSorRow] = [
        NapSorRow(id: "1", name: "Barbell Row", muscle: "back-mid", sets: 3, repMin: 6, repMax: 8, reserve: 2,
                  chip: .lock("szabadsúlyos alapgyakorlat")),
        NapSorRow(id: "2", name: "Lat Pulldown · Neutral", muscle: "back-wide", sets: 3, repMin: 8, repMax: 10, reserve: 2,
                  chip: .technique("Pihenős drop", .timer, boop: true)),
        NapSorRow(id: "3", name: "Cable Shrug", muscle: "traps", sets: 2, repMin: 10, repMax: 12, reserve: 1,
                  chip: .open, ownReps: true),
        NapSorRow(id: "4", name: "Preacher Curl", muscle: "biceps-short", sets: 3, repMin: 10, repMax: 15, reserve: 1,
                  chip: .challenge),
        NapSorRow(id: "5", name: "Incline DB Curl", muscle: "biceps-long", sets: 2, repMin: 8, repMax: 12, reserve: 2,
                  chip: .open),
        NapSorRow(id: "6", name: "Rear-Delt Row", muscle: "shoulder-rear", sets: 2, repMin: 12, repMax: 15, reserve: 0,
                  chip: .open),
    ]
}

private struct NapSorDayCard: View {
    let variant: String
    @Binding var rows: [NapSorRow]
    let narrow: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("HÉTFŐ").nkFont(11, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(planHue.glow)
                Text("Hát és bicepsz").nkFont(28, design: .serif).foregroundStyle(.white)
                NKFlowRow(spacing: 6, rowSpacing: 6) {
                    PlanPill("kb. 52 perc", mark: .timer)
                    PlanPill("aznap sport is", mark: .spark)
                    PlanPill("1 technika", color: planHue.glow, mark: .drop)
                }
                .padding(.top, 2)
            }
            NKFlowRow(spacing: 8, rowSpacing: 8) {
                chip("Hát", 8); chip("Bicepsz", 5); chip("Váll", 2)
            }
            VStack(spacing: 0) {
                ForEach($rows) { $row in
                    if row.id != rows.first?.id { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                    Group {
                        switch variant {
                        case "b": NapSorRowB(row: $row, narrow: narrow)
                        case "c": NapSorRowC(row: $row, narrow: narrow)
                        default: NapSorRowA(row: $row, narrow: narrow)
                        }
                    }
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                HStack(spacing: 12) {
                    Text("+").nkFont(19, .medium).foregroundStyle(planHue.glow)
                        .frame(width: 34, height: 34)
                        .background(Circle().strokeBorder(planHue.glow.opacity(0.6), lineWidth: 1))
                    Text("Gyakorlat hozzáadása").nkFont(16, .medium).foregroundStyle(.white.opacity(0.9))
                    Spacer()
                }
                .padding(.vertical, 12)
            }
            HStack(spacing: 6) {
                if variant != "a" {
                    Circle().fill(planHue.glow).frame(width: 5, height: 5)
                } else {
                    Text("TE").nkFont(8, .bold, design: .monospaced).foregroundStyle(NK.ground)
                        .padding(.horizontal, 4).padding(.vertical, 1.5).background(Capsule().fill(planHue.glow))
                }
                Text("= ezt az értéket te állítottad be").nkFont(12).foregroundStyle(.white.opacity(0.45))
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 22)
        .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(NK.ground.opacity(0.62)))
        .nkGlass(30)
        .padding(.horizontal, 14).padding(.bottom, 24)
    }

    private func chip(_ name: String, _ sets: Int) -> some View {
        HStack(spacing: 6) {
            Text(name).nkFont(12, .medium).foregroundStyle(.white.opacity(0.85))
            Text("\(sets)").nkFont(13, .semibold).foregroundStyle(planHue.glow)
        }
        .padding(.horizontal, 11).padding(.vertical, 6)
        .background(Capsule().fill(.white.opacity(0.08)))
    }
}

// MARK: - shared pieces

private struct DemoHandle: View {
    var body: some View {
        VStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { _ in Capsule().fill(.white.opacity(0.45)).frame(width: 16, height: 2) }
        }
        .frame(width: 20, height: 44)
    }
}

private struct DemoDots: View {
    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<3, id: \.self) { _ in Circle().fill(.white.opacity(0.75)).frame(width: 4, height: 4) }
        }
        .frame(width: 30, height: 44)
    }
}

/// The sub-muscle as a pill with a hue-tinted outline: „Hát · középső".
private struct MusclePill: View {
    let token: String
    /// Shrinks a little instead of overflowing a narrow name column.
    var scalable = false
    var body: some View {
        Text(SubMuscles.name(token)).nkFont(scalable ? 11 : 12, .medium).foregroundStyle(.white.opacity(0.9))
            .lineLimit(1).minimumScaleFactor(scalable ? 0.75 : 1).fixedSize(horizontal: !scalable, vertical: false)
            .padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(planHue.glow.opacity(0.10)))
            .overlay(Capsule().strokeBorder(planHue.glow.opacity(0.55), lineWidth: 1))
    }
}

/// A value pill: the number bright, the unit quiet, an optional „TE" when he set it himself.
private struct ValuePill: View {
    let value: String
    let unit: String
    var own = false
    var body: some View {
        HStack(spacing: 4) {
            Text(value).nkFont(12, .semibold).foregroundStyle(.white)
            if !unit.isEmpty { Text(unit).nkFont(12).foregroundStyle(.white.opacity(0.6)) }
            if own {
                Text("TE").nkFont(8, .bold, design: .monospaced).tracking(0.5).foregroundStyle(NK.ground)
                    .padding(.horizontal, 4).padding(.vertical, 1.5)
                    .background(Capsule().fill(planHue.glow))
            }
        }
        .lineLimit(1).fixedSize()
        .padding(.horizontal, 9).padding(.vertical, 4)
        .background(Capsule().fill(.white.opacity(0.09)))
        .overlay { if own { Capsule().strokeBorder(planHue.glow.opacity(0.35), lineWidth: 0.5) } }
    }
}

/// The technique / challenge pill, as today (tappable in the real app).
private struct DemoTechniqueChip: View {
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
        case .open:
            pill(mark: .keep, text: "+ technika vagy kihívás", color: .white.opacity(0.55))
        case .technique(let name, let mark, let boop):
            pill(mark: mark, text: name, color: planHue.glow, boop: boop)
        case .challenge:
            pill(mark: .flag, text: "Kihívás a végén", color: planWarn)
        }
    }

    private func pill(mark: PlanMark.Kind, text: String, color: Color, boop: Bool = false) -> some View {
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

private func reserveValue(_ r: Int) -> (String, String) { r == 0 ? ("bukásig", "") : ("\(r)", "tartalék") }

// MARK: - A · Címkesor

private struct NapSorRowA: View {
    @Binding var row: NapSorRow
    let narrow: Bool

    var body: some View {
        // The name shares its line with the stepper and ⋯; the pill row runs under all of them (the full width), so
        // muscle · reps · reserve stay on one line and only the technique pill takes a second one.
        HStack(alignment: .center, spacing: 8) {
            DemoHandle()
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .center, spacing: 8) {
                    Text(row.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .layoutPriority(1)
                    NapSorStepper(value: $row.sets, compact: narrow)
                    DemoDots()
                }
                NKFlowRow(spacing: 5, rowSpacing: 5) {
                    MusclePill(token: row.muscle)
                    ValuePill(value: "\(row.repMin)–\(row.repMax)", unit: "ism.", own: row.ownReps)
                    let r = reserveValue(row.reserve)
                    ValuePill(value: r.0, unit: r.1)
                    DemoTechniqueChip(chip: row.chip)
                }
            }
        }
    }
}

/// Today's stepper, a size smaller on a narrow phone.
private struct NapSorStepper: View {
    @Binding var value: Int
    var compact = false
    var body: some View {
        let d: CGFloat = compact ? 32 : 36
        VStack(spacing: 2) {
            HStack(spacing: compact ? 4 : 6) {
                round("−", d) { value = max(1, value - 1) }
                Text("\(value)").nkFont(compact ? 19 : 21, .medium).foregroundStyle(.white)
                    .frame(minWidth: 20).contentTransition(.numericText())
                round("+", d) { value = min(8, value + 1) }
            }
            Text("SOROZAT").nkFont(8, .semibold, design: .monospaced).tracking(1).foregroundStyle(.white.opacity(0.4))
        }
    }

    private func round(_ s: String, _ d: CGFloat, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(s).nkFont(17, .medium).foregroundStyle(.white.opacity(0.9))
                .frame(width: d, height: d).background(Circle().fill(.white.opacity(0.11)))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - B · Értékoszlopok

private struct NapSorRowB: View {
    @Binding var row: NapSorRow
    let narrow: Bool

    var body: some View {
        if narrow {
            // A narrow phone: the value block moves under the name, full width.
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 8) {
                    DemoHandle()
                    VStack(alignment: .leading, spacing: 6) {
                        name
                        NKFlowRow(spacing: 5, rowSpacing: 5) {
                            MusclePill(token: row.muscle)
                            DemoTechniqueChip(chip: row.chip)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    DemoDots()
                }
                ValueBlock(row: $row, stretch: true).padding(.leading, 28)
            }
        } else {
            // Name + muscle on the left, the values on the right; the technique pill under both.
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .center, spacing: 8) {
                    DemoHandle()
                    VStack(alignment: .leading, spacing: 6) {
                        name
                        MusclePill(token: row.muscle, scalable: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).layoutPriority(1)
                    ValueBlock(row: $row, stretch: false)
                    DemoDots()
                }
                DemoTechniqueChip(chip: row.chip).padding(.leading, 28)
            }
        }
    }

    private var name: some View {
        Text(row.name).nkFont(16, .medium).foregroundStyle(.white.opacity(0.95))
            .lineLimit(2).minimumScaleFactor(0.9).fixedSize(horizontal: false, vertical: true)
    }
}

/// SOROZAT (with − / +) · ISM. · TART. as mini columns: mono caps labels over big numerals.
private struct ValueBlock: View {
    @Binding var row: NapSorRow
    let stretch: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            column("SOROZAT", width: 68) {
                HStack(spacing: 2) {
                    tiny("−") { row.sets = max(1, row.sets - 1) }
                    Text("\(row.sets)").nkFont(stretch ? 22 : 20, .medium).foregroundStyle(.white).frame(minWidth: 16)
                        .contentTransition(.numericText())
                    tiny("+") { row.sets = min(8, row.sets + 1) }
                }
            }
            divider
            column("ISM.", own: row.ownReps, width: 54) {
                Text("\(row.repMin)–\(row.repMax)").nkFont(stretch ? 22 : 20, .medium).foregroundStyle(.white).fixedSize()
            }
            divider
            column("TART.", width: 30) {
                Text(row.reserve == 0 ? "0" : "\(row.reserve)").nkFont(stretch ? 22 : 20, .medium)
                    .foregroundStyle(row.reserve == 0 ? planWarn : .white).fixedSize()
            }
        }
        .padding(.horizontal, stretch ? 10 : 6).padding(.vertical, 7)
        .frame(maxWidth: stretch ? .infinity : nil)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.08), lineWidth: 0.5))
    }

    private var divider: some View { Rectangle().fill(.white.opacity(0.1)).frame(width: 0.5, height: 30).padding(.horizontal, stretch ? 0 : 4) }

    private func column<V: View>(_ label: String, own: Bool = false, width: CGFloat, @ViewBuilder _ value: () -> V) -> some View {
        VStack(spacing: 3) {
            HStack(spacing: 3) {
                Text(label).nkFont(8, .semibold, design: .monospaced).tracking(1).foregroundStyle(.white.opacity(0.45))
                if own { Circle().fill(planHue.glow).frame(width: 5, height: 5) }
            }
            .fixedSize()
            value().frame(height: stretch ? 32 : 28)
        }
        .frame(width: stretch ? nil : width)
        .frame(maxWidth: stretch ? .infinity : nil)
    }

    private func tiny(_ s: String, _ action: @escaping () -> Void) -> some View {
        Button { withAnimation(.snappy) { action() } } label: {
            Text(s).nkFont(15, .medium).foregroundStyle(.white.opacity(0.9))
                .frame(width: stretch ? 30 : 24, height: stretch ? 30 : 24).background(Circle().fill(.white.opacity(0.12)))
        }
        .buttonStyle(.plain)
    }
}
#endif
