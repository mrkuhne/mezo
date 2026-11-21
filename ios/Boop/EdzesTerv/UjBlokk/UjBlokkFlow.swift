import SwiftUI
import BoopCore
import BoopDesign

// The new-block flow (mezo-r36n9.113), ported from the approved spike (`spike/boop-eves-terv`, screens 2–3b): Alapok
// (length, session minutes, the season's days, the muscle tiers with the heti keret) → Jelöltek (1–3 flawless split
// candidates, or the closest one with what would make it fit) → „Ezzel kezdem". Every number is the server's
// (`NewBlockModel`). Presented by the Edzés room at page level (boop-ios.md §9); after the block is created the room
// opens the builder on it.

struct UjBlokkFlow: View {
    enum Step: Equatable { case alapok, jeloltek }

    @State var model: NewBlockModel
    let onClose: () -> Void
    /// The block is created: the room opens the builder on it, with the intake's session minutes as its target.
    let onCreated: (_ minutes: Int) -> Void
    /// Sends him to the Évad tab; the note (if any) is shown there as a one-line toast.
    let onOpenSeason: (_ note: String?) -> Void
    @State private var step: Step
    /// The raise he just tried that the budget or the Hangsúly cap does not allow.
    @State private var blocked: UjBlokkBlocked?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(model: NewBlockModel, step: Step = .alapok, blocked: UjBlokkBlocked? = nil, onClose: @escaping () -> Void,
         onCreated: @escaping (_ minutes: Int) -> Void, onOpenSeason: @escaping (_ note: String?) -> Void) {
        _model = State(initialValue: model)
        _step = State(initialValue: step)
        _blocked = State(initialValue: blocked)
        self.onClose = onClose
        self.onCreated = onCreated
        self.onOpenSeason = onOpenSeason
    }

    var body: some View {
        Group {
            if model.phase == .needsSeason {
                PlanStateView(title: "Előbb egy évad kell", text: planErrorText(.conflict("SEASON_REQUIRED")), mark: .calendar,
                              action: ("Az Évad oldalra", { onOpenSeason(nil) }), onClose: onClose)
            } else {
                switch step {
                case .alapok:
                    UjBlokkAlapok(model: model, blocked: $blocked, onClose: onClose) { step = .jeloltek }
                        .transition(.opacity)
                case .jeloltek:
                    UjBlokkJeloltek(model: model, onBack: { step = .alapok }, onOpenSeason: onOpenSeason)
                        .transition(.opacity)
                }
            }
        }
        .overlay { if model.phase == .creating { creating } }
        .animation(reduceMotion ? nil : .smooth(duration: 0.3), value: step)
        .onChange(of: model.phase) { _, phase in if case .created = phase { onCreated(model.minutes) } }
        .task { if model.phase == .editing { await model.refresh() } }
        .preferredColorScheme(.dark)
    }

    /// „Ezzel kezdem" on its way: the AI picks the exercises, then the block is saved and started.
    private var creating: some View {
        ZStack {
            NK.ground.opacity(0.82).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView().tint(.white).controlSize(.large)
                Text("Összerakom a blokkot").nkFont(22, design: .serif).foregroundStyle(.white)
                Text("Kiválasztom a gyakorlatokat, és elindítom.").nkFont(14).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 32)
        }
        .transition(.opacity)
        .accessibilityElement(children: .combine)
    }
}

struct UjBlokkBlocked: Equatable {
    let muscle: String
    let text: String
}

// MARK: - Shared pieces of the flow (the spike's ET* pieces)

/// The head of a step: a round button, the scope line, the serif title, an optional sentence.
struct UjBlokkHead: View {
    let eyebrow: String
    let title: String
    var sentence: String? = nil
    var back = false
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Button(action: onClose) {
                    Image(systemName: back ? "chevron.left" : "chevron.down").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Circle().fill(.white.opacity(0.14)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(back ? "Vissza" : "Bezárás")
                Text(eyebrow).nkFont(10, .semibold, design: .monospaced).tracking(1.3).foregroundStyle(.white.opacity(0.75))
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            Text(title).nkFont(30, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            if let sentence {
                Text(sentence).nkFont(15).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A section label: the area's tick and mono caps.
struct UjBlokkLabel: View {
    let text: String
    var trailing: String? = nil
    init(_ text: String, trailing: String? = nil) { self.text = text; self.trailing = trailing }
    var body: some View {
        HStack(spacing: 8) {
            Capsule().fill(planHue.glow).frame(width: 3, height: 13)
            Text(text.uppercased()).nkFont(11, .medium, design: .monospaced).tracking(1.4).foregroundStyle(.white.opacity(0.6))
                .lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 6)
            if let trailing { Text(trailing).nkFont(12).foregroundStyle(.white.opacity(0.5)).lineLimit(1) }
        }
    }
}

/// The one primary button at the bottom of a step, over a fade into the ground.
struct UjBlokkBottomBar: View {
    let title: String
    var enabled = true
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).nkFont(16, .semibold).foregroundStyle(NK.ground).lineLimit(1).minimumScaleFactor(0.75)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(planHue.glow.opacity(enabled ? 1 : 0.45)))
                .contentShape(Capsule())
        }
        .buttonStyle(PressStyle())
        .disabled(!enabled)
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 4)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95)], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
    }
}

/// A choice pill (weeks, minutes, start): white when chosen.
struct UjBlokkChoice: View {
    let text: String
    let on: Bool
    var sub: String? = nil
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 1) {
                Text(text).nkFont(17, .medium).foregroundStyle(on ? NK.ground : .white).lineLimit(1).minimumScaleFactor(0.7)
                if let sub { Text(sub).nkFont(10, design: .monospaced).foregroundStyle(on ? NK.ground.opacity(0.7) : .white.opacity(0.5)) }
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(on ? Color.white : .white.opacity(0.09)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// One „why" line: a drawn mark in the tone's colour and the sentence.
struct UjBlokkWhyLine: View {
    let tone: PlanTone
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            PlanMark(tone.mark, color: tone.color, size: 14).padding(.top, 2)
            Text(text).nkFont(13.5).foregroundStyle(tone == .warn ? planWarn : .white.opacity(tone == .good ? 0.88 : 0.68))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A quiet card inside a step: loading, or a failure with „Újra".
struct UjBlokkNotice: View {
    let title: String
    let text: String
    var loading = false
    var retry: (() -> Void)? = nil
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if loading { ProgressView().tint(.white) } else { PlanMark(.shield, color: planHue.glow, size: 24) }
            Text(title).nkFont(20, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.72)).fixedSize(horizontal: false, vertical: true)
            if let retry {
                Button(action: retry) {
                    Text("Újra").nkFont(15, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 24).frame(minHeight: 44).background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(26)
    }
}

/// The week as seven columns: each training day's minutes as a bar against the limit line, rest days as a dash.
struct UjBlokkDayBars: View {
    /// Minutes per weekday (0 = Monday … 6), nil = rest day.
    let minutes: [Int?]
    let limit: Int
    /// The scale's top: the limit or the longest day, whichever is higher, plus a tenth — a 90-minute limit still reads.
    private var top: CGFloat { CGFloat(max(limit, minutes.compactMap { $0 }.max() ?? 0)) * 1.1 }

    var body: some View {
        HStack(alignment: .bottom, spacing: 5) {
            ForEach(Array(minutes.enumerated()), id: \.offset) { i, m in
                VStack(spacing: 5) {
                    if let m {
                        Text("\(m)").nkFont(12, .medium).foregroundStyle(m > limit ? planWarn : .white.opacity(0.9))
                            .lineLimit(1).fixedSize()
                    }
                    ZStack(alignment: .bottom) {
                        RoundedRectangle(cornerRadius: 4).fill(.white.opacity(0.05)).frame(height: 44)
                        if let m {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(m > limit ? planWarn.opacity(0.85) : .white.opacity(0.32))
                                .frame(height: max(6, 44 * CGFloat(m) / top))
                        }
                    }
                    .frame(height: 44)
                    Text(planWeekdayShort[i]).nkFont(10, .semibold, design: .monospaced)
                        .foregroundStyle(.white.opacity(m == nil ? 0.3 : 0.65)).lineLimit(1).fixedSize()
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(m.map { "\(planWeekdayShort[i]): kb. \($0) perc" } ?? "\(planWeekdayShort[i]): pihenőnap")
            }
        }
        .overlay(alignment: .bottom) {
            // The limit line across the bars, at the limit's height above the bars' floor (day label 12 + spacing 5).
            Rectangle().fill(.white.opacity(0.45))
                .frame(height: 1)
                .mask(HStack(spacing: 3) { ForEach(0..<40, id: \.self) { _ in Rectangle().frame(width: 4) } })
                .padding(.bottom, 17 + 44 * CGFloat(limit) / top)
                .accessibilityHidden(true)
        }
        .padding(.top, 4)
    }

    /// A candidate's week: each evaluated day's minutes on its weekday.
    static func minutes(_ evaluation: WireEvaluation) -> [Int?] {
        var out = [Int?](repeating: nil, count: 7)
        for d in evaluation.days where d.minutesEstimate > 0 {
            if let i = planWeekdayIndex(d.day) { out[i] = d.minutesEstimate }
        }
        return out
    }
}

extension WireCandidate {
    /// The longest session of the week, in minutes.
    var longest: Int { evaluation.days.map(\.minutesEstimate).max() ?? 0 }
    /// „felső · alsó · felső · alsó" — the day types in week order, when the template names them; „minden nap: teljes
    /// test" when every day is the same.
    var dayLine: String? {
        let types = (template.json["days"]?.array ?? []).compactMap { $0["type"]?.string?.lowercased() }
        if types.isEmpty { return nil }
        // Every day the same (full body): say it once.
        if Set(types).count == 1, types.count > 1 { return "minden nap: \(types[0])" }
        return types.joined(separator: " · ")
    }
}
