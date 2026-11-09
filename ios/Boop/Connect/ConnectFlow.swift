import SwiftUI
import BoopCore
import BoopDesign

/// Permissions → 60-day backfill. Used after the first weigh-in and from the Nap card.
struct ConnectFlow: View {
    let link: HealthLink
    var showsBack = false
    let onDone: () -> Void
    @State private var step: Step = .permissions
    enum Step { case permissions, backfill }

    var body: some View {
        Group {
            switch step {
            case .permissions:
                PermissionsStep(link: link, showsBack: showsBack, onSkip: onDone) {
                    step = .backfill
                    Task { await link.syncNow() }
                }
            case .backfill:
                BackfillStep(link: link, onDone: onDone)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: step)
    }
}
