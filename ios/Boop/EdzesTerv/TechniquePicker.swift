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
                VStack(spacing: 8) {
                    ForEach(SetTechnique.allCases, id: \.self) { t in row(t) }
                }
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)

            if exercise.challenge {
                Text("Ez a nap kihívása: a végén félismétlések jönnek. Ha technikát választasz, a kihívás lekerül róla.")
                    .nkFont(12).foregroundStyle(planWarn.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.horizontal, 22).padding(.top, 22).padding(.bottom, 12)
        .presentationDetents([.medium, .large])
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
