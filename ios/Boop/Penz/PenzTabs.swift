import SwiftUI
import BoopCore
import BoopDesign

// MARK: - Ma · „mi a dolgom ma?" — and on most days the answer is nothing

struct PenzMa: View {
    let store: PenzStore?
    let open: (PenzSheet) -> Void
    let ask: () -> Void
    private let hue = penzHue

    var body: some View {
        if store?.isEmpty == true {
            PenzEmptyCard()
            actions
        } else if let store, let a = store.allowance {
            let v = store.verdict
            let copy = penzVerdictCopy(v, allowance: a)
            NKHighlight(hue: hue, label: "Ami ma számít", text: copy.text, sub: copy.sub, actions: verdictActions(v))
                .nkStale(store.ageText.map { NKStale(age: $0, loud: store.offline) })
            actions
            NKStatRow(penzMaStats(a), hue: hue)
            NKInfoRow("Honnan tudom, van-e dolgod?", hue: hue) {
                open(.info(title: "Honnan tudom, van-e dolgod?", body: penzVerdictRuleText))
            }
            menu
        } else {
            PenzSection(label: "MA", state: penzBlockState(store)) { EmptyView() }
            actions
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a pénzedről") { ask() }
    }

    /// The one thing, with its button — the verdict's own; "Ma nincs dolgod" needs none.
    private func verdictActions(_ v: PenzVerdict) -> [NKHighlightAction] {
        switch v {
        case .review: [NKHighlightAction("Átnézem") { open(.review) }]
        case .close: [NKHighlightAction("Lezárom") { open(.close) }]
        case .calm: []
        }
    }

    private var actions: some View {
        PenzActionRow(actions: [
            PenzAction(glyph: "plus-ink", title: "Kiadás", primary: true, enabled: store?.cashAccount != nil) { open(.capture) },
            PenzAction(glyph: "star-sun", title: "Befektetnék") {
                open(.later(title: "Befektetnék", line: "Itt fogok felosztást javasolni: mennyi menjen a biztonsági, a közép- és a hosszú távú rekeszbe, két-három konkrét lehetőséggel és azzal, hogy miért. Ez egy későbbi lépésben érkezik — addig semmit nem javaslok, amit nem tudok alátámasztani."))
            },
        ])
    }

    private var menu: some View {
        PenzSection(label: "A PÉNZ TERÜLET") {
            NKMenuGrid([
                NKMenuItem(glyph: "plus-ink", name: "Kiadás", sub: "Készpénz, pár másodperc") { open(.capture) },
                NKMenuItem(glyph: "star-sun", name: "Nagyobb összeg", sub: "Boop kutat és javasol felosztást") {
                    open(.later(title: "Nagyobb összeg", line: "Ha egy nagyobb összeget szeretnél elhelyezni, itt fogok utánanézni és felosztást javasolni, a miértekkel együtt. Ez egy későbbi lépésben érkezik."))
                },
                NKMenuItem(glyph: "repeat-deep", name: "Havi stratégia", sub: "A fizetésedből és a költésedből") {
                    open(.later(title: "Havi stratégia", line: "Egy havi rend a fizetésedből és a költésedből: mennyi menjen félre, mennyi befektetésbe, és mi marad. Ez egy későbbi lépésben érkezik."))
                },
                NKMenuItem(glyph: "book-sage", name: "Kimutatás", sub: "Hónapok, évek, letöltés") {
                    open(.later(title: "Kimutatás", line: "A hónapjaid és éveid áttekintése, letölthető formában. Ez egy későbbi lépésben érkezik."))
                },
            ], hue: hue)
        }
    }
}

/// Ma's three numbers: what is left of the week (lit), of the month with the days it must last, and the per-day figure.
/// The spike's third number ("ennyit tudsz befektetni") is not computed by the server yet — never invented.
func penzMaStats(_ a: PenzAllowance) -> [NKStat] {
    let w = penzWeek(a)
    let monthLeft = a.month.remaining.hufMinor
    return [
        NKStat(value: penzOutfit(penzFt(w.remaining)), unit: "Ft", label: "ennyi maradt a hétből", hot: w.remaining >= 0),
        NKStat(value: penzOutfit(penzFt(monthLeft)), unit: "Ft", label: "a hónapból, \(penzDaysLeftInMonth(a.date)) napra"),
        NKStat(value: penzOutfit(penzFt(w.perDay)), unit: "Ft", label: "ennyi jut ma egy napra"),
    ]
}

let penzVerdictRuleText = """
Minden reggel ugyanazt a szabályt nézem, ebben a sorrendben, és csak *egy* dolgot írok ki:

1. Van-e banki üzenet, aminél nem voltam biztos a kategóriában? Ha van, azt kérem, hogy nézd át.
2. Van-e véget ért, de le nem zárt hónap? Ha van, szólok, hogy lezárhatod — a maradékról te döntesz.
3. Ha egyik sincs, akkor *ma nincs dolgod a pénzeddel*. Ez a leggyakoribb válasz, és teljes válasz.

A számokat nem én találom ki: a heti keretet és a napi összeget a rendszer számolja a tételeidből. Soha nem sürgetlek, és soha nem mondom, hogy adj el valamit.
"""

// MARK: - Költés · the weekly remainder is the headline, its derivation one tap away

struct PenzKoltes: View {
    let store: PenzStore?
    let open: (PenzSheet) -> Void
    let openMonth: () -> Void
    let ask: () -> Void
    private let hue = penzHue

    var body: some View {
        if store?.isEmpty == true {
            PenzEmptyCard()
        } else if let store, let a = store.allowance {
            let w = penzWeek(a)
            PenzLevelCard(label: "EZEN A HÉTEN", big: penzOutfit(penzFt(w.remaining)), right: penzDaysLeftText(w.daysLeft),
                          note: penzWeekNote(w), value: w.level, marker: w.marker)
                .nkStale(store.ageText.map { NKStale(age: $0, loud: store.offline) })
            PenzActionRow(actions: [
                PenzAction(glyph: "plus-ink", title: "Kiadás", primary: true, enabled: store.cashAccount != nil) { open(.capture) },
                reviewAction(store.reviewRows.count),
            ])
            derivation(a, store)
            NKStatRow(koltesStats(a), hue: hue)
            breakdown(store)
            todayItems(store)
            goals(store)
            PenzActionRow(actions: [
                PenzAction(glyph: "check-ink", title: "Hónap lezárása") { open(.close) },
                PenzAction(glyph: "repeat-deep", title: "Keretek") { open(.budgets) },
            ])
            NKInfoRow("Mi történik a hónap végén?", hue: hue) {
                open(.info(title: "Mi történik a hónap végén?", body: penzMonthEndText))
            }
        } else {
            PenzSection(label: "EZEN A HÉTEN", state: penzBlockState(store)) { EmptyView() }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot, belefér-e valami") { ask() }
    }

    private func reviewAction(_ n: Int) -> PenzAction {
        n > 0 ? PenzAction(glyph: "search-ink", title: "\(n) tétel ellenőrzése") { open(.review) }
              : PenzAction(glyph: "check-ink", title: "Nincs ellenőrizendő", enabled: false) {}
    }

    @ViewBuilder private func derivation(_ a: PenzAllowance, _ store: PenzStore) -> some View {
        let prevOpen = store.openMonths.contains { $0.month == penzPreviousMonth(a.month.month) && !$0.closed }
        PenzSection(label: "HONNAN JÖN EZ A SZÁM") {
            VStack(alignment: .leading, spacing: 0) {
                NKRowList(penzDerivation(a, previousMonthOpen: prevOpen).map { r in
                    NKAreaRow(id: r.id, glyph: r.glyph, title: r.title, sub: r.sub, value: penzOutfit(penzFtSigned(r.amount, sign: r.sign)),
                              valueSub: "Ft", hot: r.key == .free && r.amount >= 0)
                }, hue: hue)
                PenzMoreLink(title: "Egy sor módosítása") { open(.editLines) }
            }
        }
    }

    private func koltesStats(_ a: PenzAllowance) -> [NKStat] {
        let left = a.month.remaining.hufMinor
        return [
            NKStat(value: penzOutfit(penzFt(a.month.spent.hufMinor)), unit: "Ft", label: "elköltve a hónapban"),
            NKStat(value: penzOutfit(penzFt(left)), unit: "Ft", label: "ami még maradt", hot: left >= 0),
            NKStat(value: penzOutfit(penzFt(penzPace(a))), unit: "Ft/nap", label: "a mostani tempód", trend: penzPaceTrend(a)),
        ]
    }

    @ViewBuilder private func breakdown(_ store: PenzStore) -> some View {
        let slices = penzBreakdown(store.transactions, categories: store.categories)
        PenzSection(label: "MIRE MEGY EL", state: store.transactionsFailed && slices.isEmpty
                    ? .failed("A hónap tételeit most nem érem el.") { Task { await store.load(force: true) } } : .ready) {
            if slices.isEmpty {
                Text("Ebben a hónapban még nincs napi költésed.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    NKComposition(slices.enumerated().map { i, s in
                        NKPart(name: s.name, value: Double(s.amount), color: penzSliceColors[min(i, penzSliceColors.count - 1)])
                    })
                    if let note = penzBreakdownNote(slices) { NKHueText(note, hue: hue, size: 13, opacity: 0.65) }
                }
            }
        }
    }

    @ViewBuilder private func todayItems(_ store: PenzStore) -> some View {
        let items = store.todayItems
        let review = store.reviewRows
        let reviewSum = review.reduce(Int64(0)) { $0 + $1.amount.hufMinor }
        PenzSection(label: "A MAI TÉTELEK") {
            VStack(alignment: .leading, spacing: 0) {
                if items.isEmpty && review.isEmpty {
                    NKHueText("Ma még nincs tétel. Ami a bankból jön, magától megjelenik; a készpénzt a *Kiadás* gombbal írod be.",
                              hue: hue, size: 13.5, opacity: 0.6)
                }
                NKRowList(items.map { penzRow($0) } + (review.isEmpty ? [] : [
                    NKAreaRow(id: "review", glyph: "search-ink",
                              title: review.count == 1 ? "Egy üzenet ellenőrzésre vár" : "\(review.count) üzenet ellenőrzésre vár",
                              sub: "Nem tudtam biztosan, melyik kategória", value: penzOutfit(penzFt(reviewSum)), valueSub: "Ft",
                              badge: review.count, hot: true, action: { open(.review) }),
                ]), hue: hue)
                PenzMoreLink(title: "A hónap összes tétele · \(store.transactions.count) db") { openMonth() }
            }
        }
    }

    @ViewBuilder private func goals(_ store: PenzStore) -> some View {
        let goals = store.value?.goals
        PenzSection(label: "MIRE GYŰJTÖK", state: goals == nil && !store.offline
                    ? .failed("A céljaidat most nem érem el.") { Task { await store.load(force: true) } } : .ready) {
            VStack(alignment: .leading, spacing: 0) {
                if let goals, !goals.isEmpty {
                    NKRowList(goals.sorted { $0.position < $1.position }.map { g in
                        NKAreaRow(id: g.id, glyph: g.kind == "purchase" ? "leaf-sage" : "star-sun", title: g.name,
                                  sub: penzGoalSub(g, today: store.today), value: penzOutfit(penzFt(g.saved.hufMinor)),
                                  valueSub: "a \(penzFt(g.target.hufMinor))-\(penzFromSuffix(g.target.hufMinor))",
                                  level: penzLevel(g.saved.hufMinor, of: g.target.hufMinor))
                    }, hue: hue)
                } else {
                    Text("Még nincs célod. Ha gyűjtesz valamire — tartalékra, egy útra, egy nagyobb vásárlásra —, itt látod, hol tartasz.")
                        .nkFont(13.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                }
                PenzMoreLink(title: "Cél vagy vásárlás hozzáadása") { open(.addGoal) }
            }
        }
    }
}

/// The composition's colours — the spike's greens with the one warm slice second.
let penzSliceColors: [Color] = [Color(hex: 0x2E8B57), Color(hex: 0xF2994A), Color(hex: 0x4FBF86), Color(hex: 0x8FDCB4),
                                Color(hex: 0xC9EFD9)]

/// One item as a row (a pending cash row is drawn "still to come": outlined, dimmed, and its sub says it waits).
func penzRow(_ i: PenzItem) -> NKAreaRow {
    NKAreaRow(id: i.id, glyph: i.glyph, title: i.title, sub: i.sub, value: penzOutfit(i.value), valueSub: "Ft",
              dot: i.needsReview, state: i.pending ? .future : .normal)
}

let penzMonthEndText = """
A hónapot nem zárom le magamtól. Amikor véget ér, a *Hónap lezárása* gombbal te döntöd el, mi legyen a maradékkal: *átteszed* a megtakarítási számládra, vagy *itt hagyod*. Semmi nem történik magától.

Ha mínuszban zártál, a hiány a következő hónap levezetésében külön sorként jelenik meg — nem tüntetem el, és nem írom felül a múltat.

A hónapok sorban zárulnak: mindig a legrégebbi nyitottal kezdjük, mert a következő hónap a lezárt számot viszi tovább.
"""
