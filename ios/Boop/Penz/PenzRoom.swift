import SwiftUI
import BoopCore
import BoopDesign

// MARK: - The Pénz area (L5, `mezo-r36n9.103`)

// **The build target is the approved Élet spike, round 11** (`BoopSpike/EletContent.swift` `penz` + `EletPenzKit.swift`,
// screenshots `penz-1-ma.png`, `penz-4-koltes.png`; spec `2026-11-13-boop-penz-design.md` §5.1/§5.3/§5.6). The owner
// does not want another visual round, so the order of the blocks is the spike's, and only what the server cannot know
// yet is said instead of drawn:
//   • the news digest at the bottom of Ma, Pénzem, the analysis page and the sleeve page are L6 (`PenzPenzem.swift`);
//   • Ma's third number in the spike is "ennyit tudsz befektetni", which the server does not compute yet — it is the
//     engine's per-day figure instead, never an invented one;
//   • Gyakorlás, the proposal flow and the Termékjegyzék are L7 (`PenzGyakorlas.swift`, `PenzPracticeSheets.swift`,
//     `PenzProposalViews.swift`).
//
// Copy rules (§6): never urge, never promise a return, never say sell, „Ma nincs dolgod" is a complete answer, always
// say why. A negative figure is never lit in the hue (it would turn a loss green).

enum PenzTab: String, CaseIterable {
    case ma = "Ma", penzem = "Pénzem", koltes = "Költés", gyakorlas = "Gyakorlás"
}

/// The sheets the room opens.
enum PenzSheet: Identifiable, Equatable {
    case capture, review, editLines, close, budgets, addGoal
    /// L6: a buy / sell he made on his platform, and a portfolio event.
    case record, addEvent
    case later(title: String, line: String)
    case info(title: String, body: String)
    /// L7: a new paper-trade plan, one trade, the tags, the cap, the live switch.
    case newTrade, trade(String), practiceTags, practiceCap, practiceLive
    /// L7: the amount sheet that asks for a proposal (its title: Befektetnék / Felosztást kérek / Nagyobb összeg).
    case amount(String)
    /// L7: the "miért?" page of a proposal on Pénz Ma.
    case proposalWhy(String)
    var id: String {
        switch self {
        case .later(let t, _): "later-\(t)"
        case .info(let t, _): "info-\(t)"
        default: "\(self)"
        }
    }
}

/// The full-screen pages the room pushes (page-level, `boop-ios.md` §9).
enum PenzPage: Identifiable, Equatable {
    case month
    case news(PenzNewsCardModel)
    case sleeve(String)
    /// `mezo-r36n9.120`: one horizon's weekly long-horizon review.
    case weekly(PenzWeeklyRow)
    /// L7: the full practice journal, a proposal, the monthly strategy, the catalog (and the proposal it returns to).
    case journal
    case proposal(String)
    case strategy
    case catalog(returnTo: String?)
    var id: String {
        switch self {
        case .month: "month"
        case .news(let n): "news-\(n.id)"
        case .sleeve(let s): "sleeve-\(s)"
        case .weekly(let r): "weekly-\(r.id)"
        case .journal: "journal"
        case .proposal(let id): "proposal-\(id)"
        case .strategy: "strategy"
        case .catalog(let back): "catalog-\(back ?? "")"
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
    @State private var page: PenzPage?
    /// The running "fresh digest" round (one ask + two re-reads), cancelled when he leaves the room.
    @State private var digestRound: Task<Void, Never>?
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
        // the spike's badge on Gyakorlás: the week's trades he marked as a mistake
        let practiceBadge = store?.practice?.value.week.trades.filter(\.mistake).count ?? 0
        NKAreaPage(hue: hue, name: "Pénz", eyebrow: areaEyebrow(hue, tab: selected),
                   // The orb is the week's remaining against its budget; it never carries a number.
                   level: allowance.map { penzWeek($0).level }, display: nil,
                   headline: h.headline, sentence: h.sentence, glyph: areaGlyph(hue),
                   tabs: PenzTab.allCases.map { NKAreaTab($0.rawValue, badge: $0 == .koltes ? reviewCount
                                                                      : ($0 == .gyakorlas ? practiceBadge : 0)) },
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
        // L7: Gyakorlás and the proposals read when their tab is on screen (Pénzem's catalog row needs nothing).
        .task(id: selected) {
            switch tab {
            case .gyakorlas: await store?.loadPractice()
            case .ma: await store?.loadProposals()
            default: break
            }
        }
        // L6: ask for a fresh digest once when it is pending or quiet (or right after his first holding) and re-read it
        // twice; leaving the room cancels the round.
        .onChange(of: store?.shouldRefreshDigest ?? false, initial: true) { _, go in if go { startDigestRound() } }
        .onDisappear { digestRound?.cancel(); digestRound = nil }
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
        .fullScreenCover(item: $page) { p in pageView(p) }
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
            case "invest": sheet = .amount("Befektetnék")
            case "month": page = .month
            case "record": sheet = .record
            case "event": sheet = .addEvent
            case "allocation": sheet = .amount("Felosztást kérek")
            // L7
            case "newTrade": sheet = .newTrade
            case "tags": await store?.loadPractice(); sheet = .practiceTags
            case "cap": await store?.loadPractice(); sheet = .practiceCap
            case "live": sheet = .practiceLive
            case let t? where t.hasPrefix("trade"):
                // `trade` = the first open position, `trade-plan` the first plan, `trade-closed` the first closed one
                await store?.loadPractice(force: true)
                if let o = store?.practice?.value {
                    let pick = t == "trade-plan" ? o.planned.first : t == "trade-closed" ? o.week.trades.first : o.open.first
                    if let id = pick?.id { sheet = .trade(id) }
                }
            case "why":
                await store?.loadProposals(force: true)
                if let id = store?.openProposals.first?.id { sheet = .proposalWhy(id) }
            default: break
            }
            // `-penzPage news|news2|news3|sleeve|sleeve-short`: the analysis page of a digest item, or a sleeve page.
            switch UserDefaults.standard.string(forKey: "penzPage") {
            case let n? where n.hasPrefix("news"):
                let i = (Int(n.dropFirst(4)) ?? 1) - 1
                if case .items(let cards) = penzDigestView(digest: store?.digest?.value, problem: nil,
                                                           portfolio: store?.portfolio?.value), cards.indices.contains(i) {
                    page = .news(cards[i])
                }
            case "sleeve": page = .sleeve("long")
            case "sleeve-short": page = .sleeve("short")
            case "sleeve-mid": page = .sleeve("mid")
            // `weekly|weekly-short|weekly-mid`: one horizon's weekly review (default the long one)
            case let w? where w.hasPrefix("weekly"):
                let sleeve = w.hasPrefix("weekly-") ? String(w.dropFirst(7)) : "long"
                if case .rows(_, let rows) = penzWeeklyView(store?.weekly?.value), let r = rows.first(where: { $0.sleeve == sleeve }) {
                    page = .weekly(r)
                }
            // L7: `journal`, `proposal` (the first open one), `proposal-accepted`, `strategy`, `catalog`
            case "journal": page = .journal
            case "strategy": page = .strategy
            case "catalog": page = .catalog(returnTo: nil)
            case let p? where p.hasPrefix("proposal"):
                await store?.loadProposals(force: true)
                let list = p == "proposal-accepted" ? (store?.activePlans ?? []) : (store?.openProposals ?? [])
                if let id = list.first?.id { page = .proposal(id) }
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

    private func startDigestRound() {
        guard digestRound == nil, let store else { return }
        digestRound = Task { @MainActor in
            await store.refreshDigestRound()
            digestRound = nil
            // his first holding landed mid-round: one more round is owed
            if !Task.isCancelled, store.shouldRefreshDigest { startDigestRound() }
        }
    }

    private func reload() async {
        await store?.load(force: true)
        switch tab {
        case .gyakorlas: await store?.loadPractice(force: true)
        case .ma: await store?.loadProposals(force: true)
        default: break
        }
        await syncPending()
    }

    private func syncPending() async {
        guard let ritmus, let store else { return }
        store.setPending(await ritmus.outbox.queue)
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .ma: PenzMa(store: store, open: { sheet = $0 }, openNews: { page = .news($0) },
                         openPenzem: { selected = PenzTab.penzem.rawValue }, openPage: { page = $0 }, ask: { openPlace(.boop) })
        case .koltes: PenzKoltes(store: store, open: { sheet = $0 }, openMonth: { page = .month },
                                 onRefused: { refusedCash = $0 }, ask: { openPlace(.boop) })
        case .penzem:
            PenzPenzem(store: store, open: { sheet = $0 }, openSleeve: { page = .sleeve($0) },
                       openPractice: { selected = PenzTab.gyakorlas.rawValue },
                       openCatalog: { page = .catalog(returnTo: nil) }, openWeekly: { page = .weekly($0) },
                       ask: { openPlace(.boop) })
        case .gyakorlas:
            PenzGyakorlas(store: store, open: { sheet = $0 }, openJournal: { page = .journal }, ask: { openPlace(.boop) })
        }
    }

    /// Sheet → page: the sheet goes first, the page follows once it has slid away.
    private func then(_ next: PenzPage) {
        sheet = nil
        Task { @MainActor in try? await Task.sleep(for: .milliseconds(450)); page = next }
    }

    /// Page → sheet, the same way round.
    private func then(_ next: PenzSheet) {
        page = nil
        Task { @MainActor in try? await Task.sleep(for: .milliseconds(450)); sheet = next }
    }

    @ViewBuilder private func pageView(_ p: PenzPage) -> some View {
        switch p {
        case .month:
            if let store { PenzMonthPage(store: store) { page = nil } }
        case .news(let item):
            PenzNewsPage(item: item, onBack: { page = nil },
                         ask: { page = nil; openPlace(.boop) },
                         openPenzem: { page = nil; selected = PenzTab.penzem.rawValue })
        case .sleeve(let s):
            if let store {
                PenzSleevePage(store: store, sleeve: s, onBack: { page = nil }, record: {
                    page = nil
                    Task { @MainActor in try? await Task.sleep(for: .milliseconds(450)); sheet = .record }
                })
            }
        case .weekly(let row):
            PenzWeeklyPage(row: row) { page = nil }
        case .journal:
            if let store { PenzJournalPage(store: store) { page = nil } }
        case .proposal(let id):
            if let store {
                PenzProposalPage(store: store, proposalId: id, onBack: { page = nil },
                                 openCatalog: { page = .catalog(returnTo: id) }, record: { then(PenzSheet.record) })
            }
        case .strategy:
            if let store { PenzStrategyPage(store: store, onBack: { page = nil }, onProposal: { page = .proposal($0) }) }
        case .catalog(let back):
            if let store {
                PenzCatalogPage(store: store, crumb: back == nil ? "Pénz · Pénzem" : "Pénz · Javaslat") {
                    page = back.map { .proposal($0) }
                }
            }
        }
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
        case .record:
            if let store { PenzRecordSheet(store: store) { done in sheet = nil; toast = done }.penzSheetStyle([.large]) }
        case .addEvent:
            if let store { PenzEventSheet(store: store) { done in sheet = nil; toast = done }.penzSheetStyle([.large]) }
        case .later(let title, let line):
            NKSheetFrame(hue: hue, eyebrow: "Pénz", title: title) {
                NKNotLiveYet(hue: hue, title: "Később jön", line: line)
            }
            .penzSheetStyle([.medium])
        case .newTrade:
            if let store { PenzTradePlanSheet(store: store) { done in sheet = nil; toast = done }.penzSheetStyle([.large]) }
        case .trade(let id):
            if let store {
                PenzTradeSheet(store: store, tradeId: id) { done in sheet = nil; if let done { toast = done } }
                    .penzSheetStyle([.large])
            }
        case .practiceTags:
            if let store { PenzPracticeTagsSheet(store: store).penzSheetStyle() }
        case .practiceCap:
            if let store {
                PenzPracticeCapSheet(store: store) {
                    sheet = nil
                    Task { @MainActor in try? await Task.sleep(for: .milliseconds(450)); sheet = .editLines }
                }
                .penzSheetStyle()
            }
        case .practiceLive:
            PenzPracticeLiveSheet().penzSheetStyle()
        case .amount(let title):
            if let store {
                PenzAmountSheet(store: store, title: title) { p in then(PenzPage.proposal(p.id)) }.penzSheetStyle([.large])
            }
        case .proposalWhy(let id):
            if let store, let p = store.proposal(id: id) {
                PenzProposalWhySheet(proposal: p,
                                     onAccept: p.status == "proposed" ? { then(PenzPage.proposal(id)) } : nil,
                                     onDismiss: p.status == "proposed" ? {
                                         sheet = nil
                                         Task { if let e = await store.dismissProposal(id: id) { toast = e } else { toast = penzDismissedToast } }
                                     } : nil)
            }
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

/// The empty page's one honest card: how money arrives here — and, with no account at all (a fresh production start),
/// the one tap that makes the cash account right on the card, so he never has to hunt for it.
struct PenzEmptyCard: View {
    @Environment(PenzStore.self) private var store: PenzStore?
    @State private var creating = false
    @State private var error: String?

    var body: some View {
        let needsAccount = store?.value != nil && store?.cashAccount == nil
        NKHighlight(hue: penzHue, label: "Még üres", text: "Még nincs itt pénzmozgás",
                    sub: needsAccount
                        ? (error ?? "A pénzed két úton érkezik ide: a banki SMS-ekből a parancsikonon át, és amit készpénzben kézzel beírsz. A készpénzhez előbb egy „Készpénz” számla kell — egy érintés, és utána a *Kiadás* gombbal rögzíthetsz.")
                        : "A pénzed két úton érkezik ide: a banki SMS-ekből a parancsikonon át, és amit készpénzben kézzel beírsz a *Kiadás* gombbal.",
                    actions: needsAccount
                        ? [NKHighlightAction(creating ? "Létrehozom…" : "Készpénz számla létrehozása") {
                              guard !creating else { return }
                              Task { @MainActor in
                                  creating = true
                                  error = await store?.createCashAccount()
                                  creating = false
                              }
                          }]
                        : [])
    }
}
