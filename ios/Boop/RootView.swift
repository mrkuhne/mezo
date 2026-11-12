import SwiftUI
import EventKit
import BoopCore
import BoopDesign

/// Switches on the session: splash, sign-in, offline, onboarding or the shell.
struct RootView: View {
    @Environment(Session.self) private var session
    @State private var link: HealthLink?
    @State private var morning: MorningStore?
    @State private var ritmus: RitmusEnvironment?

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
        .environment(morning)
        .environment(ritmus)
        .onChange(of: session.state, initial: true) { _, state in updateLink(state) }
        .background { if let link, case .ready = session.state { SyncTriggers(link: link) } }
        .background { if let ritmus, case .ready = session.state { RitmusTriggers(env: ritmus, morning: morning) } }
    }

    /// One Health link and one morning brief store per signed-in user; refreshed on open once the shell shows.
    private func updateLink(_ state: Session.State) {
        let me: Me?
        switch state {
        case .needsOnboarding(let m), .ready(let m): me = m
        default: me = nil
        }
        guard let me else { link = nil; morning = nil; ritmus = nil; BackgroundSyncHost.ritmus = nil; return }
        if link?.userId != me.id {
            let signOut: @MainActor () -> Void = { [session] in session.signOut() }
            #if DEBUG
            if UserDefaults.standard.string(forKey: "preview") != nil {
                let preview = makeClient(tokens: MemoryTokenStore("preview"), transport: PreviewTransport())
                link = HealthLink(client: preview, userId: me.id)
                morning = MorningStore(client: preview, onUnauthorized: signOut)
                ritmus = .preview(client: preview)
                BackgroundSyncHost.ritmus = ritmus
                return
            }
            #endif
            link = HealthLink(client: session.client, userId: me.id)
            morning = MorningStore(client: session.client, onUnauthorized: signOut)
            ritmus = .live(client: session.client, health: HealthKitReader(), userId: me.id)
            BackgroundSyncHost.ritmus = ritmus
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

/// The daily loop's app-wide upkeep, in an invisible view for the same reason as `SyncTriggers`: on return to the
/// foreground the outbox is flushed (backoff ignored) and the reminders are re-planned; every ledger change (a check-in
/// or close saved here, or merged from the server), a new bedtime target or a new day re-plans them too. The first
/// saved check-in or close of a day is when the notification permission is asked for — never at launch.
private struct RitmusTriggers: View {
    let env: RitmusEnvironment
    let morning: MorningStore?
    @Environment(\.scenePhase) private var scenePhase
    @State private var foregrounds = 0

    private struct Plan: Hashable { let done: [String]; let closed: Bool; let target: String?; let saved: Bool; let day: String; let foregrounds: Int }
    // saved = a check-in or the close is on the day: the moment the notification permission is first asked for

    private var plan: Plan {
        let day = env.today
        let ledger = env.ledger.ledger(for: day)
        return Plan(done: ledger.checkIns.map(\.slot).sorted(), closed: ledger.close != nil,
                    target: morning?.brief?.day.bedtimeTarget, saved: !ledger.checkIns.isEmpty || ledger.close != nil, day: day, foregrounds: foregrounds)
    }

    var body: some View {
        let p = plan
        Color.clear
            .onAppear { env.flushOnTrigger() }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                env.flushOnTrigger()
                foregrounds += 1
            }
            .task(id: p) {
                await env.reminders.refresh(ledger: env.ledger, bedtimeTarget: p.target, askPermission: p.saved)
            }
    }
}

private struct Splash: View {
    var body: some View {
        ZStack {
            NKGround(hue: .forma)
            StillOrb(palette: Hue.forma.orb, size: 96, level: 0.8)
        }
        .preferredColorScheme(.dark)
    }
}

private struct OfflineView: View {
    @Environment(Session.self) private var session
    var body: some View {
        NKSkyScreen(hue: .alvas, onBack: nil) {
            VStack(spacing: 14) {
                Spacer(minLength: 220)
                StillOrb(palette: Hue.alvas.orb, size: 110, level: 0.3).saturation(0.3)
                Text("Nem érem el a szervert.").nkFont(32, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).padding(.top, 10)
                Text("A belépésed megvan, csak most nem jön válasz. Nézd meg a netet, és próbáld újra.")
                    .nkFont(15.5).foregroundStyle(.white.opacity(0.75)).multilineTextAlignment(.center)
                NKPill("Újra próbálom") { Task { await session.retry() } }.padding(.top, 14)
            }
        }
    }
}
