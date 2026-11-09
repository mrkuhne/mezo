import SwiftUI
import EventKit
import BoopCore
import BoopDesign

/// Switches on the session: splash, sign-in, offline, onboarding or the shell.
struct RootView: View {
    @Environment(Session.self) private var session
    @State private var link: HealthLink?

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
        .environment(link)
        .onChange(of: session.state, initial: true) { _, state in updateLink(state) }
        .background { if let link, case .ready = session.state { SyncTriggers(link: link) } }
    }

    /// One Health link per signed-in user; refreshed on open once the shell shows.
    private func updateLink(_ state: Session.State) {
        let me: Me?
        switch state {
        case .needsOnboarding(let m), .ready(let m): me = m
        default: me = nil
        }
        guard let me else { link = nil; return }
        if link?.userId != me.id {
            #if DEBUG
            if UserDefaults.standard.string(forKey: "preview") != nil {
                link = HealthLink(client: makeClient(tokens: MemoryTokenStore("preview"), transport: PreviewTransport()), userId: me.id)
                return
            }
            #endif
            link = HealthLink(client: session.client, userId: me.id)
        }
        if case .ready = state { Task { await link?.syncIfStale() } }
    }
}

/// Refresh on return to the foreground (10-minute debounce) and on calendar changes. Kept in its own
/// invisible view: reading the scene phase on the root view itself stopped sheets and dialogs presenting.
private struct SyncTriggers: View {
    let link: HealthLink
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Color.clear
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await link.syncIfStale() } } }
            .onReceive(NotificationCenter.default.publisher(for: .EKEventStoreChanged)) { _ in
                Task { await link.calendarChanged() }
            }
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
