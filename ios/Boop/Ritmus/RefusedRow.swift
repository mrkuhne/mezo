import SwiftUI
import BoopDesign

/// The quiet row for a write the server did not take (spec §7.1): "nem sikerült elküldeni" and *Újra* — never a
/// "waiting for the net" look, never silently dropped. The same row under a check-in, the goal and the closed day.
struct RefusedRow: View {
    var text = "Nem sikerült elküldeni"
    let onRetry: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button(action: onRetry) {
                Text("Újra").nkFont(14, .semibold).foregroundStyle(.white)
                    .padding(.horizontal, 14).frame(height: 32)
                    .background(Capsule().fill(.white.opacity(0.12)))
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Újra küldöm")
        }
        .accessibilityElement(children: .contain)
    }
}
