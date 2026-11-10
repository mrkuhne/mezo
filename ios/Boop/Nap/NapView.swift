import SwiftUI
import BoopCore
import BoopDesign

/// Nap · Mai. With the morning brief in hand it is the Mai hero (`MaiView`, S3); before that, the Napkelte page with a
/// still orb and the right state — not connected, syncing, learning (< 14 nights), no calendar, offline, ready — or,
/// when the brief did not arrive, a calm retry.
struct NapView: View {
    @Environment(\.openURL) private var openURL
    @Environment(HealthLink.self) private var link: HealthLink?
    @Environment(MorningStore.self) private var morning: MorningStore?
    @Environment(Session.self) private var session
    @State private var connecting = false
    @State private var toast: String?
    @State private var motion = OrbMotion()
    /// The detail sheet behind a tapped Boop mondja phrase.
    @State private var sheet: DetailSheet? = NapView.initialSheet

    private var state: NapEmptyState {
        guard let link else { return .notConnected }
        var progress: Double?
        var online = true, failed = false
        switch link.sync.phase {
        case .running(let p): progress = p
        case .failed(.offline): online = false
        case .failed: failed = true
        default: break
        }
        let t = link.sync.totals ?? link.sync.lastSummary
        return .from(connected: link.connected, syncProgress: progress, nights: t?.nights ?? 0, calendarRows: t?.events ?? 0, online: online, syncFailed: failed)
    }

    /// Simulator review (`-preview shell`) always shows the brief (the preview user is never connected), unless
    /// `-previewEmpty YES` asks for the empty states.
    private var forceBrief: Bool {
        #if DEBUG
        if UserDefaults.standard.string(forKey: "preview") == "shell" { return !UserDefaults.standard.bool(forKey: "previewEmpty") }
        #endif
        return false
    }

    var body: some View {
        let s = state
        Group {
            switch napScreen(state: s, hasStore: morning != nil, hasBrief: morning?.brief != nil, loading: morning?.loading ?? false,
                             problem: morning?.problem, forceBrief: forceBrief) {
            case .mai:
                if let morning, let brief = morning.brief { MaiView(brief: brief) { ctx in cards(brief, morning, ctx) } }
            case .loading:
                page(s, copy: loadingCopy, offline: false) {}
            case .problem(let problem):
                page(s, copy: morningProblemCopy(problem), offline: problem == .offline) { Task { await morning?.load(date: Date()) } }
            case .empty(let e):
                page(e, copy: napCopy(e), offline: e == .offline) { act(e) }
            }
        }
        .nkToast($toast)
        // Read the flag here so the page re-renders when it flips (a binding passed down left the cover unpresented).
        .connectCover(link, isPresented: Binding(get: { [showing = connecting] in showing }, set: { connecting = $0 }))
        .onDisappear { motion.stop() }
        .onChange(of: link?.sync.phase) { old, new in
            if new == .failed(.unauthorized) { session.signOut() }
            // last night reached the server: fetch the brief again (the server regenerates when its inputs changed)
            if let new, reloadsBriefAfterSync(from: old, to: new) { Task { await morning?.load(date: Date()) } }
        }
        .background { if let morning { MorningTriggers(store: morning) } }
    }

    /// Below the hero: the selected orb's tiles, path and cards, then the Health row (sync status and "refresh now"
    /// stay one scroll away on every orb, as on the empty states).
    @ViewBuilder private func cards(_ brief: Brief, _ store: MorningStore, _ ctx: MaiContext) -> some View {
        MaiBelow(brief: brief, store: store, ctx: ctx) { link in sheet = DetailSheet(link) }
            .sheet(item: $sheet) { kind in
                DetailSheetView(kind: kind, brief: store.brief ?? brief, store: store, ctx: ctx) { sheet = nil }
            }
        if let link { ConnectCard(link: link) { connecting = true }.padding(.top, 8) }
        Color.clear.frame(height: 90)
    }

    /// Simulator review: `-previewSheet sleep|heart|day` opens that sheet (`-previewDetent large` at the large detent).
    private static var initialSheet: DetailSheet? {
        #if DEBUG
        if let k = UserDefaults.standard.string(forKey: "previewSheet").flatMap(Brief.Link.init(rawValue:)) { return DetailSheet(k) }
        #endif
        return nil
    }

    private func page(_ s: NapEmptyState, copy: NapCopy, offline: Bool, onAction: @escaping () -> Void) -> some View {
        NKTabPage(hue: .forma, heroHeight: nil, compact: NKCompact(palette: Hue.forma.orb, title: "Forma", value: copy.orb, line: copy.title)) {
            VStack(spacing: 0) {
                NKTitleRow(bellCount: 0, onBell: { toast = "Az értesítések hamarosan" }, onPlus: { toast = "A gyors hozzáadás hamarosan" },
                           onAvatar: { toast = "A beállítások hamarosan" })
                    .padding(.top, 54)
                NKTabStrip(tabs: ["Mai", "A napom", "Beszélgetés", "Rutin"],
                           selected: Binding(get: { "Mai" }, set: { if $0 != "Mai" { toast = "\($0) · hamarosan" } }))
                    .padding(.top, 10)
                RisingOrb(hue: .forma, score: nil, display: copy.orb, caption: copy.orbCaption, motion: motion)
                    .frame(height: 260).padding(.top, 20)
                    .saturation(offline ? 0.35 : 1)
                Text(copy.caps).nkFont(14, .semibold).tracking(2.6).foregroundStyle(.white.opacity(0.85)).padding(.top, 22)
                Text(copy.title).nkFont(38, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).minimumScaleFactor(0.7)
                    .padding(.horizontal, 20).padding(.top, 10)
                Text(copy.sentence).nkFont(16).lineSpacing(3).foregroundStyle(.white.opacity(0.82)).multilineTextAlignment(.center)
                    .padding(.horizontal, 30).padding(.top, 10)
                if let action = copy.action {
                    NKPill(action, wide: false, action: onAction).padding(.top, 18)
                }
                Spacer(minLength: 0)
            }
        } content: {
            if let link { ConnectCard(link: link) { connecting = true } }
            if s == .noCalendar {
                NKBoopCard(pre: "A naptárad még üres nálam. Add hozzá a Google-fiókod az iPhone-on: ",
                           em: "Beállítások › Naptár › Fiókok", post: ", és onnan én is látom.")
            }
            NKBoopCard(pre: "Az edzés- és étrendtervedet ", em: "a webes appban", post: " állítsd be ezzel a fiókkal, onnan én viszem.",
                       action: "Megnyitom") { openURL(BoopConfig.webAppURL) }
            Color.clear.frame(height: 90)
        }
    }

    private func act(_ s: NapEmptyState) {
        switch s {
        case .notConnected: connecting = true
        case .offline, .syncFailed: Task { await link?.syncNow() }
        default: break
        }
    }
}

/// Loads the brief of the device's day when the page appears and on every return to the foreground. Its own invisible
/// view, like the root's sync triggers: reading the scene phase on the page itself can stop presentations.
private struct MorningTriggers: View {
    let store: MorningStore
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Color.clear
            .task { await store.load(date: Date()) }
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store.load(date: Date()) } } }
            // left open past midnight: the new day's brief
            .onReceive(NotificationCenter.default.publisher(for: .NSCalendarDayChanged)) { _ in
                Task { await store.load(date: Date()) }
            }
    }
}

/// What Nap · Mai shows.
enum NapScreen: Equatable { case mai, loading, problem(MorningProblem), empty(NapEmptyState) }

/// A brief replaces every state except "not connected" (a refresh, a failed sync or a lost network leave the morning on
/// screen; the Health row reports them). Without a brief: syncing / sync failed / offline keep their pages; otherwise
/// the page waits calmly for the first load (never the "Holnap reggel…" promise), or offers a retry after a problem.
func napScreen(state s: NapEmptyState, hasStore: Bool, hasBrief: Bool, loading: Bool, problem: MorningProblem?,
               forceBrief: Bool) -> NapScreen {
    guard hasStore, forceBrief || s != .notConnected else { return .empty(s) }
    if hasBrief { return .mai }
    switch s {
    case .syncing, .syncFailed, .offline: return .empty(s)
    default: break
    }
    if !loading, let problem { return .problem(problem) }
    return .loading      // in flight, or about to start (the load fires on appear)
}

/// A Health sync that finished and sent something: the brief may now know last night.
func reloadsBriefAfterSync(from old: HealthSync.Phase?, to new: HealthSync.Phase) -> Bool {
    guard case .running = old, case .done(let s) = new else { return false }
    return s.nights + s.days + s.workouts > 0
}

/// While the brief is being put together.
let loadingCopy = NapCopy(orb: "", orbCaption: nil, caps: "EGY PILLANAT", title: "Boop összerakja a reggeledet…",
                          sentence: "Átnézem az éjszakádat és a mai napodat, pár másodperc.", action: nil)

/// The words and the orb label for each state.
struct NapCopy: Equatable { let orb: String, orbCaption: String?, caps: String, title: String, sentence: String, action: String? }

func napCopy(_ s: NapEmptyState) -> NapCopy {
    switch s {
    case .notConnected:
        NapCopy(orb: "–", orbCaption: nil, caps: "MÉG ÜRES", title: "Még üres a napod",
                sentence: "Kösd össze az Egészséget és a naptárat, és holnap reggeltől én viszem a napodat.", action: "Összekötöm")
    case .syncing(let p):
        NapCopy(orb: "\(Int((p * 100).rounded())) %", orbCaption: "betöltve", caps: "BEHÚZOM", title: "Olvasom az elmúlt 60 napot",
                sentence: "Pár perc, közben használhatod a telefont.", action: nil)
    case .syncFailed:
        NapCopy(orb: "–", orbCaption: nil, caps: "MEGAKADTAM", title: "Nem sikerült frissíteni",
                sentence: "Az utolsó frissítés közben hibát kaptam. Amit eddig behúztam, megvan; próbáljuk újra.", action: "Újra próbálom")
    case .learning(let n):
        NapCopy(orb: "\(n) / \(NapEmptyState.nightsNeeded)", orbCaption: "éjszaka", caps: "MÉG TANULOM", title: "Még tanulom a ritmusod",
                sentence: "\(n) éjszakát látok, \(NapEmptyState.nightsNeeded) kell, hogy pontos legyek. Addig is mutatom, amit már tudok, de pontszámot még nem adok.",
                action: nil)
    case .noCalendar:
        NapCopy(orb: "✓", orbCaption: nil, caps: "MAJDNEM KÉSZ", title: "Már csak a naptárad hiányzik",
                sentence: "Az alvásodat és a mozgásodat látom. A naptár nélkül nem tudom, mi fér bele a napodba.", action: nil)
    case .offline:
        NapCopy(orb: "–", orbCaption: nil, caps: "NINCS KAPCSOLAT", title: "Most nem érem el az adataidat",
                sentence: "Amit ma rögzítettél, megvan. Amint visszajön a net, frissítem a reggeledet.", action: "Újra próbálom")
    case .ready:
        NapCopy(orb: "✓", orbCaption: nil, caps: "KÉSZEN ÁLLOK", title: "Holnap reggel jön az első üzenetem",
                sentence: "Minden adatod megvan. Reggel elmondom, hogyan aludtál és mire lesz erőd.", action: nil)
    }
}
