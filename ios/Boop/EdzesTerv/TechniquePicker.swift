import SwiftUI
import BoopCore
import BoopDesign

// The technique picker (mezo-r36n9.94, owner 2026-11-19): tapping an exercise's technique pill on Napok opens this
// sheet instead of cycling through the techniques. Every technique is listed; the ones this exercise may not carry are
// dimmed with the reason. The round „i" button shows a short description under each.

/// Which exercise the picker is open for.
struct TechniquePick: Identifiable, Equatable {
    let day: Int
    let exercise: Int
    var id: String { "\(day)-\(exercise)" }
}

struct TechniquePicker: View {
    let exercise: DraftExercise
    let choose: (SetTechnique) -> Void
    /// Puts the day's challenge on this exercise (true) or takes it off (false).
    let challenge: (Bool) -> Void
    let onClose: () -> Void
    /// DEBUG review: `-previewBlokkPickerInfo YES` opens with the descriptions shown.
    @State private var showInfo = UserDefaults.standard.bool(forKey: "previewBlokkPickerInfo")
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("TECHNIKA · AZ UTOLSÓ SOROZATON").nkFont(10, .semibold, design: .monospaced).tracking(1.3)
                        .foregroundStyle(planHue.glow)
                    Text(exercise.name).nkFont(24, design: .serif).foregroundStyle(.white)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Button { withAnimation(reduceMotion ? nil : .snappy) { showInfo.toggle() } } label: {
                    Text("i").nkFont(17, .semibold, design: .serif)
                        .foregroundStyle(showInfo ? NK.ground : .white)
                        .frame(width: 38, height: 38)
                        .background(Circle().fill(showInfo ? Color.white : .white.opacity(0.14)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showInfo ? "Leírások elrejtése" : "Mit jelentenek?")
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(SetTechnique.allCases, id: \.self) { t in row(t) }
                    Text("A NAP KIHÍVÁSA").nkFont(10, .semibold, design: .monospaced).tracking(1.3)
                        .foregroundStyle(planWarn).padding(.top, 10)
                    challengeRow
                    if exercise.pickedByBoop {
                        Text("A mostani választást Boop tette ide a heti javaslatban. Ha átállítod, a te döntésed lesz.")
                            .nkFont(12).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 6)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)

        }
        .padding(.horizontal, 22).padding(.top, 22).padding(.bottom, 12)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(NK.ground.opacity(0.96))
        .preferredColorScheme(.dark)
    }

    private func row(_ t: SetTechnique) -> some View {
        let reason = exercise.unavailableReason(t)
        let on = exercise.technique == t && !(exercise.challenge && t == .none)
        return Button {
            guard reason == nil else { return }
            choose(t)
            onClose()
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    PlanMark(mark(t), color: on ? NK.ground : (reason == nil ? planHue.glow : .white.opacity(0.3)), size: 20)
                        .frame(width: 36, height: 36)
                        .background(RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(on ? Color.white : planHue.glow.opacity(reason == nil ? 0.14 : 0.04)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(t.name).nkFont(16, .semibold).foregroundStyle(.white.opacity(reason == nil ? 0.97 : 0.4))
                        if let reason {
                            Text(reason).nkFont(12).foregroundStyle(.white.opacity(0.4)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 6)
                    if on && exercise.pickedByBoop { boopTag }
                    if on { PlanMark(.check, color: planGood, size: 18) }
                }
                if showInfo {
                    Text(t.about).nkFont(13).foregroundStyle(.white.opacity(reason == nil ? 0.7 : 0.4))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.leading, 48)
                        .transition(.opacity)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(on ? 0.1 : 0.05)))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(on ? planGood.opacity(0.5) : .white.opacity(0.06), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(reason != nil)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityHint(reason ?? t.about)
        .sensoryFeedback(.selection, trigger: on)
    }

    private var boopTag: some View {
        Text("BOOP").nkFont(9, .semibold, design: .monospaced).tracking(0.8).foregroundStyle(NK.ground)
            .padding(.horizontal, 6).padding(.vertical, 3).background(Capsule().fill(planHue.glow))
    }

    /// The day's challenge as a row of its own: half reps after the last set, one exercise a day.
    private var challengeRow: some View {
        let reason = exercise.challengeUnavailableReason
        let on = exercise.challenge
        return Button {
            guard reason == nil else { return }
            challenge(!on)
            onClose()
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    PlanMark(.flag, color: on ? NK.ground : (reason == nil ? planWarn : .white.opacity(0.3)), size: 20)
                        .frame(width: 36, height: 36)
                        .background(RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(on ? planWarn : planWarn.opacity(reason == nil ? 0.14 : 0.04)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(on ? "Kihívás · koppints a levételhez" : "Kihívás a végén").nkFont(16, .semibold)
                            .foregroundStyle(.white.opacity(reason == nil ? 0.97 : 0.4))
                        if let reason {
                            Text(reason).nkFont(12).foregroundStyle(.white.opacity(0.4)).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer(minLength: 6)
                    if on && exercise.pickedByBoop { boopTag }
                    if on { PlanMark(.check, color: planGood, size: 18) }
                }
                if showInfo {
                    Text("Az utolsó sorozat után félismétlések a nyújtott helyzetben, amennyi megy — egy szám, amit legközelebb megdöntesz. Naponta egy gyakorlaton; ha másikra teszed, innen lekerül, és helyette nincs más technika.")
                        .nkFont(13).foregroundStyle(.white.opacity(reason == nil ? 0.7 : 0.4))
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.leading, 48)
                        .transition(.opacity)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(on ? 0.1 : 0.05)))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(on ? planWarn.opacity(0.5) : .white.opacity(0.06), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(reason != nil)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityHint(reason ?? "A nap kihívása: félismétlések az utolsó sorozat után.")
    }

    private func mark(_ t: SetTechnique) -> PlanMark.Kind {
        switch t {
        case .none: .keep
        case .restDrop: .timer
        case .drop: .drop
        case .myo: .myo
        case .partials: .partials
        }
    }
}
