import SwiftUI
import BoopCore
import BoopDesign

/// The Súly room (`mezo-r36n9.158`, owner 2026-11-24): the ninth area, built the way Pénz is — the shared area page
/// in its own gold world, Ma · Test · Napló · Boop in the bar, the head's orb carrying the pace score (how well the
/// weight follows the season's plan). Data: `SulyStore` — the season, the trend, the weigh-ins, the body samples.
struct SulyRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openDestination) private var openDestination
    @Environment(\.openPick) private var openPick
    @Environment(SulyStore.self) private var store: SulyStore?
    @SceneStorage("suly.tab") private var selected: String = "Ma"
    @State private var toast: String?
    @State private var info: SulyInfo?

    init() {
        #if DEBUG
        // Simulator review: `-sulyTab Test|Napló` opens the room on that tab.
        let preview = UserDefaults.standard.string(forKey: "sulyTab")
        _selected = SceneStorage(wrappedValue: preview ?? "Ma", "suly.tab")
        #endif
    }

    private var head: (headline: String, sentence: String) {
        if let store, store.snapshot != nil { let h = store.head; return (h.headline, h.sentence) }
        if let p = store?.problem {
            return ("A súlyodat most nem érem el", p == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.")
        }
        return ("A súlyod", "Töltöm a trendedet…")
    }

    var body: some View {
        let h = head
        let score = store?.score
        NKAreaPage(hue: sulyHue, name: "Súly", eyebrow: areaEyebrow(sulyHue, tab: selected),
                   level: score.map { Double($0) / 100 }, display: score.map { "\($0)" },
                   headline: h.headline, sentence: h.sentence, glyph: areaGlyph(sulyHue),
                   tabs: ["Ma", "Test", "Napló"].map { NKAreaTab($0) }, selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "plus-ink", label: "Súly rögzítése") { openPick(.quick(.weight)) },
                             NKAreaAction(glyph: "repeat-deep", label: "Frissítés") { Task { await store?.load(force: true) } }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openDestination(.chat) }) {
            switch selected {
            case "Test": SulyTest(store: store, openInfo: { info = $0 }, ask: { openDestination(.chat) })
            case "Napló": SulyNaplo(store: store, capture: { openPick(.quick(.weight)) })
            default: SulyMa(store: store, openInfo: { info = $0 }, openEvad: { openDestination(.room(RoomEntry(.evad))) },
                            capture: { openPick(.quick(.weight)) }, ask: { openDestination(.chat) })
            }
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        // Opening the room reads again: the scale's morning weigh-in reaches the server through the Health sync, which
        // bumps no tick. A weigh-in queued on the phone is followed by the ring under this room (`weightTick`).
        .task { await store?.load(force: true) }
        // page-level presentation (boop-ios.md §9)
        .sheet(item: Binding(get: { [i = info] in i }, set: { info = $0 })) { i in
            NKSheetFrame(hue: sulyHue, eyebrow: "Súly", title: i.title) {
                ((try? AttributedString(markdown: i.body, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))).map(Text.init)
                 ?? Text(i.body))
                    .nkFont(15).foregroundStyle(.white.opacity(0.85)).lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(18).nkGlass()
            }
            .presentationDetents([.medium, .large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }
}
