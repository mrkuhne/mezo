import SwiftUI
import BoopCore
import BoopDesign

/// Nap · Mai before the morning brief exists (S2.5): the Napkelte page with a still "még tanulom" orb and the right
/// state — not connected, syncing, learning (< 14 nights), no calendar, offline, ready. The brief arrives in S3.
struct NapView: View {
    @Environment(\.openURL) private var openURL
    @Environment(HealthLink.self) private var link: HealthLink?
    @Environment(Session.self) private var session
    @State private var connecting = false
    @State private var toast: String?
    @State private var motion = OrbMotion()

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

    var body: some View {
        let s = state, copy = napCopy(s)
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
                    .saturation(s == .offline ? 0.35 : 1)
                Text(copy.caps).font(.system(size: 14, weight: .semibold)).tracking(2.6).foregroundStyle(.white.opacity(0.85)).padding(.top, 22)
                Text(copy.title).font(.nkSerif(38)).foregroundStyle(.white).multilineTextAlignment(.center).minimumScaleFactor(0.7)
                    .padding(.horizontal, 20).padding(.top, 10)
                Text(copy.sentence).font(.system(size: 16)).lineSpacing(3).foregroundStyle(.white.opacity(0.82)).multilineTextAlignment(.center)
                    .padding(.horizontal, 30).padding(.top, 10)
                if let action = copy.action {
                    NKPill(action, wide: false) { act(s) }.padding(.top, 18)
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
        .nkToast($toast)
        // Read the flag here so the page re-renders when it flips (a binding passed down left the cover unpresented).
        .connectCover(link, isPresented: Binding(get: { [showing = connecting] in showing }, set: { connecting = $0 }))
        .onDisappear { motion.stop() }
        .onChange(of: link?.sync.phase) { _, p in if p == .failed(.unauthorized) { session.signOut() } }
    }

    private func act(_ s: NapEmptyState) {
        switch s {
        case .notConnected: connecting = true
        case .offline, .syncFailed: Task { await link?.syncNow() }
        default: break
        }
    }
}

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
