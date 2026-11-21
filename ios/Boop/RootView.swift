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
    @State private var food: FoodClient?
    @State private var train: TrainClient?
    /// The last-known-good read cache (B5): per user, beside the ledger and the outbox.
    @State private var cache: ServerCache?
    /// Where a workout in progress is kept — with the outbox, because it is his own unsent work.
    @State private var workoutFolder: URL?
    /// The Pénz area's data (L5): the area page and the cash capture read the same store.
    @State private var penz: PenzStore?
    /// The Évad page's data (B6, mezo-r36n9.16): the season overview, its cache and the season writes.
    @State private var evad: EvadStore?
    /// The day capacity's writes (B7, mezo-r36n9.17): his label of how an event felt.
    @State private var kapacitas: KapacitasClient?
    /// The season's load-vs-recovery read for the Évad page (B7 K2).
    @State private var kapacitasStore: KapacitasStore?

    var body: some View {
        Group {
            #if DEBUG
            // Simulator review of the shared area-page kit: every block on one page, no sign-in needed.
            if UserDefaults.standard.bool(forKey: "previewKit") {
                KitGallery()
            } else if UserDefaults.standard.bool(forKey: "previewEvesTerv") {
                // The Éves terv on fixtures (mezo-r36n9.113).
                EvesTervPreviewRoot()
            } else if UserDefaults.standard.bool(forKey: "previewBlokk") || UserDefaults.standard.bool(forKey: "previewUjBlokk") {
                // The block builder and the weekly review on fixtures (mezo-r36n9.83).
                PlanPreviewRoot()
            } else {
                shell
            }
            #else
            shell
            #endif
        }
    }

    @ViewBuilder private var shell: some View {
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
        .environment(\.foodClient, food)
        .environment(\.trainClient, train)
        .environment(\.planClient, session.planClient)
        .environment(\.serverCache, cache)
        .environment(\.workoutFolder, workoutFolder)
        .environment(penz)
        .environment(evad)
        .environment(\.kapacitasClient, kapacitas)
        .environment(kapacitasStore)
        .onChange(of: session.state, initial: true) { _, state in updateLink(state) }
        .background { if let link, case .ready = session.state { SyncTriggers(link: link) } }
        .background { if let ritmus, case .ready = session.state { RitmusTriggers(env: ritmus, morning: morning) } }
        .background { if let ritmus, let penz, case .ready = session.state { PenzTriggers(env: ritmus, store: penz) } }
    }

    /// One Health link and one morning brief store per signed-in user; refreshed on open once the shell shows.
    private func updateLink(_ state: Session.State) {
        let me: Me?
        switch state {
        case .needsOnboarding(let m), .ready(let m): me = m
        default: me = nil
        }
        // Signed out, or another user: the old daily loop stops sending at once (its queue stays on disk for that user;
        // the session's client already carries another token, or none).
        guard let me else {
            ritmus?.retire(); link = nil; morning = nil; ritmus = nil; food = nil; train = nil; cache = nil; workoutFolder = nil
            penz = nil; evad = nil; kapacitas = nil; kapacitasStore = nil
            BackgroundSyncHost.ritmus = nil; return
        }
        if link?.userId != me.id {
            ritmus?.retire()
            let signOut: @MainActor () -> Void = { [session] in session.signOut() }
            #if DEBUG
            if UserDefaults.standard.string(forKey: "preview") != nil {
                let preview = makeClient(tokens: MemoryTokenStore("preview"), transport: PreviewTransport())
                let previewTrain = TrainClient(client: preview)
                link = HealthLink(client: preview, userId: me.id)
                morning = MorningStore(client: preview, onUnauthorized: signOut)
                // One training client for the room AND the outbox sender: it is what remembers the server's
                // workout id, and the player's online calls read that memory.
                ritmus = .preview(client: preview, train: previewTrain)
                food = FoodClient(client: preview)
                train = previewTrain
                let previewCache = RitmusEnvironment.directories(for: me.id).cache
                cache = ServerCache(directory: previewCache)
                let previewPenz = PenzStore(client: PenzPreview.client, cache: cache)
                penz = previewPenz
                Task { await PenzPreview.primeCache(previewCache) }
                evad = EvadStore(client: EvadPreviewFixtures.client, cache: cache)
                Task { await EvadPreviewFixtures.primeCache(previewCache) }
                kapacitas = KapacitasClient(raw: RawJSONClient(transport: PreviewTransport(), baseURL: URL(string: "https://preview.invalid")!,
                                                               token: { "preview" }))
                let previewKap = KapacitasStore(client: kapacitas, cache: cache)
                kapacitasStore = previewKap
                Task { await previewKap.load() }
                let previewFolder = RitmusEnvironment.directories(for: me.id).outbox
                // A review launch starts the day over. The workout in progress is written to the user's own
                // folder, not to the preview's scratch root, so without this a workout left running on one
                // run sent the next one straight into the player — and the briefing could not be seen again.
                try? FileManager.default.removeItem(at: previewFolder.appendingPathComponent("workout.json"))
                workoutFolder = previewFolder
                BackgroundSyncHost.ritmus = ritmus
                return
            }
            #endif
            let liveTrain = TrainClient(client: session.client)
            link = HealthLink(client: session.client, userId: me.id)
            morning = MorningStore(client: session.client, onUnauthorized: signOut)
            ritmus = .live(client: session.client, health: HealthKitReader(), userId: me.id, train: liveTrain, raw: session.raw)
            food = FoodClient(client: session.client)
            train = liveTrain
            cache = ServerCache(directory: RitmusEnvironment.directories(for: me.id).cache)
            penz = PenzStore(client: PenzClient(raw: session.raw), cache: cache)
            evad = EvadStore(client: EvadClient(raw: session.raw), cache: cache)
            kapacitas = KapacitasClient(raw: session.raw)
            let liveKap = KapacitasStore(client: kapacitas, cache: cache)
            kapacitasStore = liveKap
            Task { await liveKap.load() }
            workoutFolder = RitmusEnvironment.directories(for: me.id).outbox
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

/// Pénz's upkeep, app-wide (L5 review): a cash expense queued, delivered or refused re-reads the outbox into the store,
/// and a delivery or a capture re-reads the server — whether or not the Pénz page is open. Without it an expense the
/// outbox delivered before the page was opened was neither pending nor among the transactions the store held, and the
/// Terv card never counted unsent cash.
private struct PenzTriggers: View {
    let env: RitmusEnvironment
    let store: PenzStore
    var body: some View {
        Color.clear
            .task { store.setPending(await env.outbox.queue) }
            .onChange(of: env.penzTick) {
                Task {
                    store.setPending(await env.outbox.queue)
                    await store.load(force: true)
                }
            }
            .onChange(of: env.refused.count) { Task { store.setPending(await env.outbox.queue) } }
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
