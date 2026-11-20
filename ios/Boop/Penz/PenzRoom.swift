import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Pénz area (L5, `mezo-r36n9.103`)

// **The build target is the approved Élet spike, round 11** (`BoopSpike/EletContent.swift` `penz` + `EletPenzKit.swift`,
// screenshots `penz-1-ma.png`, `penz-4-koltes.png`; spec `2026-11-13-boop-penz-design.md` §5.1/§5.3/§5.6). The owner
// does not want another visual round, so the order of the blocks is the spike's, and only what the server cannot know
// yet is said instead of drawn:
//   • the news digest at the bottom of Ma is L6 — Ma ends with the menu and the ask row;
//   • Ma's third number in the spike is "ennyit tudsz befektetni", which the server does not compute yet — it is the
//     engine's per-day figure instead, never an invented one;
//   • Pénzem and Gyakorlás have no data yet (L6/L7) and say so.
//
// Copy rules (§6): never urge, never promise a return, never say sell, „Ma nincs dolgod" is a complete answer, always
// say why. A negative figure is never lit in the hue (it would turn a loss green).

enum PenzTab: String, CaseIterable {
    case ma = "Ma", penzem = "Pénzem", koltes = "Költés", gyakorlas = "Gyakorlás"
}

/// The sheets the room opens.
enum PenzSheet: Identifiable, Equatable {
    case capture, review, editLines, close, budgets, addGoal
    case later(title: String, line: String)
    case info(title: String, body: String)
    var id: String {
        switch self {
        case .later(let t, _): "later-\(t)"
        case .info(let t, _): "info-\(t)"
        default: "\(self)"
        }
    }
}

struct PenzRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @Environment(\.openPlace) private var openPlace
    @Environment(PenzStore.self) private var store: PenzStore?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @SceneStorage("penz.tab") private var selected: String = PenzTab.ma.rawValue
    @State private var sheet: PenzSheet?
    @State private var monthList = false
    @State private var toast: String?
    /// A refused cash row he tapped: *Újra* or *Törlöm*.
    @State private var refusedCash: UUID?

    init(tab: PenzTab = .ma) {
        #if DEBUG
        let preview = UserDefaults.standard.string(forKey: "penzTab").flatMap(PenzTab.init(rawValue:))
        _selected = SceneStorage(wrappedValue: (preview ?? tab).rawValue, "penz.tab")
        #else
        _selected = SceneStorage(wrappedValue: tab.rawValue, "penz.tab")
        #endif
    }

    private let hue = penzHue
    private var tab: PenzTab { PenzTab(rawValue: selected) ?? .ma }
    private var allowance: PenzAllowance? { store?.allowance }

    private var head: (headline: String, sentence: String) {
        if let a = allowance, store?.isEmpty == false { return penzHead(a) }
        if store?.isEmpty == true {
            return ("A pénzed még üres", "Amint van egy számlád és az első tételed, itt látod a heti keretedet.")
        }
        if let p = store?.problem {
            return ("A pénzedet most nem érem el", p == .offline ? "Nincs net, és még nincs elmentett adatom." : "A szerver most nem válaszolt.")
        }
        return ("A pénzed", "Töltöm a heti keretedet…")
    }

    var body: some View {
        let h = head
        let reviewCount = store?.reviewRows.count ?? 0
        NKAreaPage(hue: hue, name: "Pénz", eyebrow: areaEyebrow(hue, tab: selected),
                   // The orb is the week's remaining against its budget; it never carries a number.
                   level: allowance.map { penzWeek($0).level }, display: nil,
                   headline: h.headline, sentence: h.sentence, glyph: areaGlyph(hue),
                   tabs: PenzTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .koltes ? reviewCount : 0) },
                   selectedTab: $selected,
                   actions: [NKAreaAction(glyph: "search-ink", label: "Keresés") { toast = soonToast("Keresés · Pénz") },
                             NKAreaAction(glyph: "repeat-deep", label: "Frissítés") { Task { await reload() } }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { openPlace(.boop) }) {
            content
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .background(RoomSwipeBack().frame(width: 0, height: 0).accessibilityHidden(true))
        .nkToast($toast)
        .task { await store?.load(); await syncPending() }
        // Deliveries, captures and refusals are followed app-wide by `PenzTriggers` (RootView), page open or not.
        .confirmationDialog("Ezt a tételt a szerver nem fogadta el", isPresented: Binding(get: { refusedCash != nil },
                                                                                       set: { if !$0 { refusedCash = nil } }),
                            titleVisibility: .visible, presenting: refusedCash) { id in
            Button("Újra küldöm") { Task { await ritmus?.retryPenz(id) } }
            Button("Törlöm a telefonról", role: .destructive) { Task { await ritmus?.removePenz(id) } }
            Button("Mégse", role: .cancel) {}
        } message: { _ in
            Text("Még nem került fel a szerverre. Küldd újra, vagy töröld, ha rosszul írtad be.")
        }
        .sheet(item: $sheet) { s in sheetView(s) }
        .fullScreenCover(isPresented: $monthList) {
            if let store { PenzMonthPage(store: store) { monthList = false } }
        }
        #if DEBUG
        .task {
            try? await Task.sleep(for: .seconds(1.6))
            switch UserDefaults.standard.string(forKey: "penzSheet") {
            case "capture": sheet = .capture
            case "review": sheet = .review
            case "edit": sheet = .editLines
            case "close": sheet = .close
            case "budgets": sheet = .budgets
            case "goal": sheet = .addGoal
            case "invest": sheet = investSheet
            case "month": monthList = true
            default: break
            }
            // `-penzPending 1890`: a cash expense typed now (with `-previewOffline YES` it waits in the outbox).
            if let ft = UserDefaults.standard.string(forKey: "penzPending").flatMap(penzParseFt), let ritmus,
               let account = store?.cashAccount {
                try? await ritmus.capturePenzExpense(PenzExpensePayload(
                    accountId: account.id, amountMinor: ft, categoryId: store?.categories.first { $0.name == "Élelmiszer" }?.id,
                    date: penzDay(Date()), note: "Piac"))
                await syncPending()
            }
        }
        #endif
    }

    private func reload() async {
        await store?.load(force: true)
        await syncPending()
    }

    private func syncPending() async {
        guard let ritmus, let store else { return }
        store.setPending(await ritmus.outbox.queue)
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .ma: PenzMa(store: store, open: { sheet = $0 }, ask: { openPlace(.boop) })
        case .koltes: PenzKoltes(store: store, open: { sheet = $0 }, openMonth: { monthList = true },
                                 onRefused: { refusedCash = $0 }, ask: { openPlace(.boop) })
        case .penzem:
            NKNotLiveYet(hue: hue, title: "Ami a pénzedből van",
                         line: "Itt lesz a három rekesz — a biztonsági tartalék (1–3 év), a középtáv (5–10 év) és a hosszú táv (10+ év) —, hogy melyik mennyit ér, és mire elég. Előbb a befektetéseidet kell rögzíteni; az a következő lépésben érkezik.")
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot a pénzedről") { openPlace(.boop) }
        case .gyakorlas:
            NKNotLiveYet(hue: hue, title: "Gyakorlás",
                         line: "Papíron kereskedés játékpénzzel, napló és heti visszanézés, hogy a sajátod előtt gyakorolhass. A havi keretét már most levonom a költhető pénzből — a Költés oldalon külön sor. Maga a gyakorlás egy későbbi lépésben érkezik.")
            NKAskRow(hue: hue, text: "Kérdezd meg Boopot a gyakorlásról") { openPlace(.boop) }
        }
    }

    private var investSheet: PenzSheet {
        .later(title: "Befektetnék", line: "Itt fogok felosztást javasolni: mennyi menjen a biztonsági, a közép- és a hosszú távú rekeszbe, két-három konkrét lehetőséggel és azzal, hogy miért. Ez egy későbbi lépésben érkezik — addig semmit nem javaslok, amit nem tudok alátámasztani.")
    }

    @ViewBuilder private func sheetView(_ s: PenzSheet) -> some View {
        switch s {
        case .capture:
            PenzCaptureSheet { done in sheet = nil; if let done { toast = done } }
                .penzSheetStyle([.large])
        case .review:
            if let store { PenzReviewSheet(store: store).penzSheetStyle() }
        case .editLines:
            if let store { PenzEditLinesSheet(store: store) { sheet = nil; toast = "Mentve" }.penzSheetStyle([.large]) }
        case .close:
            if let store { PenzCloseSheet(store: store).penzSheetStyle() }
        case .budgets:
            if let store { PenzBudgetsSheet(store: store).penzSheetStyle() }
        case .addGoal:
            if let store { PenzAddGoalSheet(store: store) { sheet = nil; toast = "Hozzáadva" }.penzSheetStyle([.large]) }
        case .later(let title, let line):
            NKSheetFrame(hue: hue, eyebrow: "Pénz", title: title) {
                NKNotLiveYet(hue: hue, title: "Később jön", line: line)
            }
            .penzSheetStyle([.medium])
        case .info(let title, let body):
            NKSheetFrame(hue: hue, eyebrow: "Pénz", title: title) {
                NKHueText(body, hue: hue, size: 15, opacity: 0.85)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(20).nkGlass()
            }
            .penzSheetStyle()
        }
    }
}

// MARK: - Shared wording of the page states

/// What a block says when the page has no answer: loading, or the problem with its retry.
@MainActor func penzBlockState(_ store: PenzStore?) -> NKBlockState {
    guard let store else { return .loading }
    if store.value != nil { return .ready }
    if let p = store.problem {
        let line = p == .offline ? "Nincs net, és még nincs elmentett adatom a pénzedről." : penzErrorText(p)
        return .failed(line) { Task { await store.load(force: true) } }
    }
    return .loading
}

/// The empty page's one honest card: how money arrives here.
struct PenzEmptyCard: View {
    var body: some View {
        NKHighlight(hue: penzHue, label: "Még üres", text: "Még nincs itt pénzmozgás",
                    sub: "A pénzed két úton érkezik ide: a banki SMS-ekből a parancsikonon át, és amit készpénzben kézzel beírsz. Az első készpénzes kiadásnál a *Kiadás* gomb egy érintéssel létrehozza a „Készpénz” számlát.")
    }
}
