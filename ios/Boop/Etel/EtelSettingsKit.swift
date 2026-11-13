import SwiftUI
import BoopCore
import BoopDesign

// The small pieces the Étel settings sheets share (B4 Task 14): a glass card, wrapping choice chips, a quiet problem
// line and the loading / could-not-read states. Kept apart so the five sheets say the same thing the same way.

struct EtelCard<Content: View>: View {
    let label: String?
    let content: Content
    init(_ label: String? = nil, @ViewBuilder content: () -> Content) { self.label = label; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let label { NKMono(label) }
            content
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}

/// One-of-many chips that wrap (320 pt friendly). `selected == nil` means nothing chosen.
struct EtelChoiceChips<ID: Hashable>: View {
    let options: [(id: ID, label: String)]
    let selected: ID?
    var minimum: CGFloat = 110
    let onPick: (ID) -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(options, id: \.id) { o in
                let on = selected == o.id
                Button { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { onPick(o.id) } } label: {
                    Text(o.label).nkFont(13.5, on ? .semibold : .regular).lineLimit(2).minimumScaleFactor(0.8).multilineTextAlignment(.center)
                        .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                        .padding(.horizontal, 10).padding(.vertical, 9).frame(maxWidth: .infinity, minHeight: 40)
                        .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

/// A sentence that says what went wrong, with an optional retry.
struct EtelProblem: View {
    let text: String
    var detail: FoodFetchError?
    var retry: (() -> Void)?
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            if let detail { Text(etelProblemLine(detail)).nkFont(13).foregroundStyle(.white.opacity(0.55)) }
            if let retry {
                Button(action: retry) {
                    Text("Újra").nkFont(14, .semibold).foregroundStyle(NK.ground)
                        .padding(.horizontal, 18).frame(minHeight: 38).background(Capsule().fill(.white.opacity(0.95)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// The result line of a sheet action that did not close the sheet (a refused save, a failed removal).
struct EtelNote: View {
    let text: String
    var body: some View {
        Text(text).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 16).padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading).nkGlass(18)
            .accessibilityAddTraits(.updatesFrequently)
    }
}

/// A sheet's own presentation: large, on the room's ground (boop-ios.md §9).
extension View {
    func etelSheetStyle() -> some View {
        presentationDetents([.large]).presentationBackground(NK.ground).presentationCornerRadius(34).presentationDragIndicator(.visible)
    }
}
