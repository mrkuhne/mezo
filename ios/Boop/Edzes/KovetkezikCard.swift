import SwiftUI
import BoopCore
import BoopDesign

// The Következik card (mezo-r36n9.113, spike screen 7): at the top of the Edzés room's Ma tab, the year plan's next
// block — what it focuses, how long, from when, which of the year's blocks it is — with „Indítás" (the new-block intake
// pre-filled from it) and „Éves terv". Every number and date is the server's (`WireYearPlan.next` and its block); the
// room shows the card only for a freshly loaded plan, never a cached one [RF 5].

/// What the card says, read from the plan. nil when the plan names no next block (or one it does not list).
struct KovetkezikContent: Equatable {
    let blockId: String
    let block: WireYearBlock
    let consolidation: Bool
    let title: String
    /// „6 hét · dec. 14-től · 3. blokk a 8-ból".
    let meta: String
    /// nil for a reason this build does not know.
    let sentence: String?
    /// „Mell, váll" beside the Hangsúly pill; nil for the consolidation.
    let emphasized: String?
    /// The block's weeks as the timeline's heights (a picture of the climb, not a number on screen); empty for the
    /// consolidation.
    let loads: [Double]
    /// The last week is the light one (more than one week).
    let deloadLast: Bool
    let caption: String?

    /// `today` is `yyyy-MM-dd` in his calendar.
    init?(plan: WireYearPlan, today: String) {
        guard let next = plan.next, let block = plan.blocks.first(where: { $0.id == next.blockId }) else { return nil }
        blockId = next.blockId
        self.block = block
        consolidation = block.isConsolidation
        let focus = evesGroupOrder.filter(block.focus.contains) + block.focus.filter { !evesGroupOrder.contains($0) }
        // A due block starts today (the server's no_block start): „mától".
        let from = next.startsOn == today ? "mától" : evesFrom(next.startsOn)
        if consolidation {
            title = "Év végi lezárás"
            meta = "\(block.weeks) hét · \(from) · lezárás"
            sentence = "Az év végi lezárás: minden izom Tartáson, könnyű szinten."
            emphasized = nil
            loads = []
            deloadLast = false
            caption = nil
        } else {
            title = evesFocusTitle(block)
            let m = plan.loadingBlocks
            meta = "\(block.weeks) hét · \(from) · \(block.ordinal). blokk \(evesNumArticle(m)) \(m)-\(evesBolBol(m))"
            let list = evesList(focus)
            switch next.reason {
            case "last_week":
                // The running year block's last day; when the running block is not the year's, the day before the next.
                let end = plan.blocks.first { $0.status == "running" && !$0.isConsolidation }?.lastDay
                    ?? evesAdding(days: -1, to: next.startsOn) ?? next.startsOn
                sentence = "A mostani blokkod \(kovetkezikEndDay(end, today: today)) ér véget. Most \(list) kerül fókuszba, minden más Tartáson marad."
            case "no_block":
                sentence = "Most nincs futó blokkod. A terv szerint \(list) jön, minden más Tartáson marad."
            default:
                sentence = nil
            }
            emphasized = focus.isEmpty ? nil : evesPlainList(focus)
            let w = max(1, block.weeks)
            let heavy = w > 1 ? w - 1 : w
            loads = (0..<w).map { i in
                if w > 1 && i == w - 1 { return 0.4 }
                return heavy > 1 ? 0.5 + 0.45 * Double(i) / Double(heavy - 1) : 0.7
            }
            deloadLast = w > 1
            caption = w > 1 ? "\(w - 1) terhelő hét + 1 könnyítő" : "1 terhelő hét"
        }
    }
}

/// Today as `yyyy-MM-dd` in his calendar.
func kovetkezikToday(_ now: Date = Date(), calendar: Calendar = .current) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: now)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

private let kovetkezikWeekdays = ["vasárnap", "hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton"]

/// When the running block ends, said as he would: „ma", „holnap", „vasárnap", or a date further than a week out
/// („dec. 6-án"). A day already past reads „ma" (the block runs over, it ends now).
func kovetkezikEndDay(_ ymd: String, today: String) -> String {
    guard let days = evesDays(from: today, to: ymd), let p = evesParts(ymd) else { return evesDate(ymd) }
    if days <= 0 { return "ma" }
    if days == 1 { return "holnap" }
    if days <= 6 {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        guard let date = c.date(from: DateComponents(year: p.year, month: p.month, day: p.day)) else { return evesDate(ymd) }
        return kovetkezikWeekdays[c.component(.weekday, from: date) - 1]
    }
    // „dec. 6." → „dec. 6-án".
    return "\(evesDate(ymd).dropLast())-\(kovetkezikAnEn(p.day))"
}

/// „-án / -én / -jén" after a day number (elsején, másodikán, hatodikán, tizedikén, huszadikán).
func kovetkezikAnEn(_ day: Int) -> String {
    if day == 1 { return "jén" }
    switch day % 10 {
    case 2, 3, 6, 8: return "án"
    case 0: return day == 10 ? "én" : "án"
    default: return "én"
    }
}

/// The new-block intake's head sentence when it opens from a year block.
func ujBlokkYearSentence(_ p: YearBlockPrefill) -> String {
    if p.consolidation { return "Az éves terved lezárása. A hossza és a szintek a tervből jönnek." }
    let ordered = evesGroupOrder.filter(p.focus.contains) + p.focus.filter { !evesGroupOrder.contains($0) }
    let title = ordered.first.map { ([evesMuscle($0)] + ordered.dropFirst().map(evesMuscleLower)).joined(separator: " + ") }
    let named = [p.ordinal > 0 ? "Az éves terved \(p.ordinal). blokkja" : "Az éves terved blokkja", title].compactMap { $0 }
    return named.joined(separator: ": ") + ". Kitöltöttem, amit tudok; átállíthatod."
}

/// A start-day choice's pill: „dec. 14-től", „Jövő hétfőn", „Ma".
func ujBlokkStartText(_ choice: NewBlockModel.StartChoice) -> String {
    switch choice {
    case .planned(let day): evesFrom(day)
    case .nextMonday: "Jövő hétfőn"
    case .today: "Ma"
    }
}

struct KovetkezikCard: View {
    let content: KovetkezikContent
    let hue: Hue
    let onStart: () -> Void
    let onYear: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Text("KÖVETKEZIK").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                Text("· AZ ÉVES TERVBŐL").nkFont(10, .medium, design: .monospaced).tracking(1.4).foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .accessibilityElement(children: .combine)
            Text(content.title).nkFont(27, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text(content.meta).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                .fixedSize(horizontal: false, vertical: true)
            if let s = content.sentence {
                Text(s).nkFont(14).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
            }
            if !content.loads.isEmpty {
                NKBlockTimeline(content.loads.enumerated().map { i, load in
                    NKBlockWeek(week: i + 1, load: load, phase: "", state: .future,
                                isDeload: content.deloadLast && i == content.loads.count - 1)
                }, hue: hue, caption: content.caption)
            }
            NKFlowRow(spacing: 6, rowSpacing: 6) {
                if let e = content.emphasized {
                    HStack(spacing: 6) { PlanTierPill(tier: .emphasize); Text(e).nkFont(12).foregroundStyle(.white.opacity(0.8)) }
                        .fixedSize()
                }
                HStack(spacing: 6) {
                    PlanTierPill(tier: .maintain)
                    Text(content.consolidation ? "minden izom" : "a többi").nkFont(12).foregroundStyle(.white.opacity(0.8))
                }
                // Each pill and its words stay whole; the row wraps instead of squeezing them (smallest iPhone).
                .fixedSize()
            }
            Button(action: onStart) {
                HStack(spacing: 8) {
                    NKGlyph("bolt-ink", NK.ground, size: 16)
                    Text("Indítás").nkFont(16, .semibold).foregroundStyle(NK.ground)
                }
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(Capsule().fill(hue.glow))
                .contentShape(Capsule())
            }
            .buttonStyle(PressStyle())
            Button(action: onYear) {
                HStack(spacing: 6) {
                    Text("Éves terv").nkFont(14, .medium)
                    Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.white.opacity(0.75))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }
}
