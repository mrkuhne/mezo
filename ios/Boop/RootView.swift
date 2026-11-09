import SwiftUI
import BoopCore
import BoopDesign

/// Switches on the session: splash, sign-in, offline, onboarding or the shell.
struct RootView: View {
    @Environment(Session.self) private var session

    var body: some View {
        Group {
            switch session.state {
            case .loading: Splash()
            case .signedOut: AuthFlow()
            case .offline: OfflineView()
            case .needsOnboarding(let me): OnboardingFlow(me: me)
            case .ready(let me): ShellView(me: me)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: session.state)
    }
}

private struct Splash: View {
    var body: some View {
        ZStack { Lagy.paper.ignoresSafeArea(); LagyMark(size: 64, onPhoto: false) }
            .environment(\.colorScheme, .light)
    }
}

private struct OfflineView: View {
    @Environment(Session.self) private var session
    var body: some View {
        ZStack {
            Lagy.paper.ignoresSafeArea()
            ErrorCard(title: "Nem érem el a szervert.", text: "A belépésed megvan, csak most nem jön válasz. Nézd meg a netet, és próbáld újra.") {
                Task { await session.retry() }
            }
            .padding(.horizontal, 16)
        }
        .environment(\.colorScheme, .light)
    }
}
