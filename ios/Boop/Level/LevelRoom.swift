import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Levél area (mezo-r36n9.39, plan Task 12)

// **The build target is the approved simulator spike** (`BoopSpike/Level{Spike,Tabs,Cards,Head}.swift`, screenshots
// `level-*.png`, owner OK 2026-11-21; spec `2026-11-21-boop-level-posta-design.md`), rebuilt on the shared area kit.
// The order of the blocks is the spike's. What the server cannot tell is said instead of drawn:
//   • Figyelt (the watched products and their prices) is a later slice — `NKNotLiveYet`, no number;
//   • a deal card shows only what the server wrote (title, summary, why); there is no price comparison;
//   • "A többi" lists the categories and their counts — the digest carries no mails under them, so nothing unfolds.
//
// Copy rules: every number is the server's count; every word about a mail is the server's word; a flagged or
// unknown-screen mail is never scored, never offered a button, and a sensitive one is shown as its sender only.

struct LevelRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openPlace) private var openPlace
    @Environment(\.scenePhase) private var scenePhase
    @Environment(LevelStore.self) private var store: LevelStore?
    @SceneStorage("level.tab") private var selected: String = LevelTab.ma.rawValue
    @State private var toast: String?
    /// The Lecsatolás confirm lives here, at page level, not inside the scrolling content.
    @State private var confirmDetach = false

    init(tab: LevelTab = .ma) {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "levelTab").flatMap(LevelTab.init(rawValue:))
        _selected = SceneStorage(wrappedValue: (preview ?? tab).rawValue, "level.tab")
        #else
        _selected = SceneStorage(wrappedValue: tab.rawValue, "level.tab")
        #endif
    }

    private let hue = levelHue
    private var tab: LevelTab { LevelTab(rawValue: selected) ?? .ma }

    var body: some View {
        let words = levelHeadWords(tab: tab, mailbox: store?.mailbox, digest: store?.digest,
                                   digestState: store?.digestState ?? .idle)
        let mode = levelMailboxMode(store?.mailbox)
        let badge: Int = { if case .connected = mode { return store?.digest?.worthAMinute ?? 0 } else { return 0 } }()
        NKAreaPage(hue: hue, name: "Levél", eyebrow: areaEyebrow(hue, tab: selected),
                   // The orb is how much of the post is dealt with; it never carries a number.
                   level: levelOrbLevel(store?.digest), display: nil,
                   headline: words.verdict, sentence: words.sentence, glyph: areaGlyph(hue),
                   tabs: LevelTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .ma ? badge : 0) },
                   selectedTab: $selected,
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openPlace(.boop) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        .confirmationDialog("Lecsatolod a postafiókot?", isPresented: $confirmDetach, titleVisibility: .visible) {
            Button("Lecsatolás", role: .destructive) { Task { await detach() } }
            Button("Mégse", role: .cancel) {}
        } message: {
            Text("A tárolt alkalmazásjelszó törlődik, és a Boop többé nem lát leveleket. A már átnézett levelek összefoglalói megmaradnak.")
        }
        .task { await store?.refresh() }
        // The rules are read when their tab is on screen.
        .task(id: selected) { if tab == .szabalyok { await store?.loadRules() } }
        // Coming back to the app: the digest may have been made while it was away.
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store?.refresh() } } }
    }

    @ViewBuilder private var content: some View {
        if let store {
            switch tab {
            case .ma:
                LevelMa(store: store, now: Date(), onFiokok: { withAnimation { selected = LevelTab.fiokok.rawValue } },
                        onAsk: { openPlace(.boop) }, toast: { toast = $0 })
            case .figyelt:
                NKNotLiveYet(hue: hue, title: "Amit figyelsz",
                             line: "Termékek és árak, amiket kérsz, hogy tartsak szemmel — és szólok, ha tényleg olcsóbb.")
                NKAskRow(hue: hue, text: "Kérdezd meg Boopot a leveleidről") { openPlace(.boop) }
            case .szabalyok:
                LevelSzabalyok(store: store, toast: { toast = $0 })
            case .fiokok:
                LevelFiokok(store: store, now: Date(), toast: { toast = $0 }, onDetach: { confirmDetach = true })
            }
        } else {
            NKBare("Levél", hue: hue, glyph: "e-level",
                   state: .failed("A leveleket most nem érem el.", {})) { EmptyView() }
        }
    }

    private func detach() async {
        guard let store else { return }
        switch await store.disconnect() {
        case .done: toast = "Lecsatoltam a postafiókot"
        case .failed(let e): toast = levelErrorText(e)
        default: break
        }
    }
}
