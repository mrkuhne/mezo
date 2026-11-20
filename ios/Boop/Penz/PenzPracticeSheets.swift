import SwiftUI
import BoopCore
import BoopDesign

// Pénz L7 (`mezo-r36n9.105`): the practice sheets — a new plan, and one trade (open it, write a last close, close it
// with the tags and one line, or let the plan go). Every write is online with what he typed kept on a refusal; the
// cap refusal says what still fits. Plan first: no stop, no trade.

/// A labelled glass card (the sheets' common block).
struct PenzCard<Content: View>: View {
    let label: String
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono(label)
            content()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}

/// A price field with its currency set apart.
struct PenzPriceField: View {
    let prompt: String
    @Binding var text: String
    let currency: String
    var body: some View {
        HStack(spacing: 8) {
            TextField("", text: $text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.4)))
                .keyboardType(.decimalPad).autocorrectionDisabled()
                .nkFont(15).foregroundStyle(.white).monospacedDigit()
            Text(currency == "HUF" ? "Ft" : currency).nkFont(14).foregroundStyle(.white.opacity(0.55))
        }
        .padding(.horizontal, 16).frame(height: 48)
        .background(Capsule().fill(.white.opacity(0.08)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
    }
}

/// The sheets' bottom bar: the error above the one button, riding over the keyboard.
struct PenzSheetBar: View {
    let error: String?
    let title: String
    let glyph: String
    let ready: Bool
    let action: () -> Void
    var body: some View {
        VStack(spacing: 6) {
            if let error {
                Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            NKPill(title, glyph: glyph) { action() }
                .disabled(!ready).opacity(ready ? 1 : 0.5)
        }
        .padding(.horizontal, 16).padding(.vertical, 10)
        .background(NK.ground.opacity(0.92))
    }
}

let penzPracticeCurrencies = ["HUF", "EUR", "USD"]

// MARK: - Új terv / Új kereskedés

struct PenzTradePlanSheet: View {
    let store: PenzStore
    let onDone: (String) -> Void
    @State private var instrument = ""
    @State private var direction: String? = "long"
    @State private var why = ""
    @State private var currency: String? = "HUF"
    @State private var quantity = ""
    @State private var plannedEntry = ""
    @State private var stop = ""
    @State private var target = ""
    @State private var enterNow = false
    @State private var entry = ""
    @State private var entryDate = Date()
    @State private var saving = false
    @State private var error: String?
    /// Kept for the sheet's life: a retry never makes a second plan.
    @State private var ref = UUID()

    private var cur: String { currency ?? "HUF" }
    private var problem: String? {
        let e = enterNow ? penzParseAmount(entry) : penzParseAmount(plannedEntry)
        if enterNow && e == nil { return "Írd be a belépő árát." }
        return penzPlanProblem(instrument: instrument, why: why, quantity: penzParseQuantity(quantity),
                               direction: direction ?? "long", stopMinor: penzParseAmount(stop), entryMinor: e)
    }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Gyakorlás", title: "Új terv") {
            NKHueText("Előbb a terv: *mit, miért, és hol lépsz ki*, ha rossz irányba megy. Papíron megy, valódi pénz nélkül — Boop semmit nem vesz és nem mozgat pénzt.",
                      hue: penzHue, size: 13.5, opacity: 0.7)
                .frame(maxWidth: .infinity, alignment: .leading)
            PenzCard(label: "MIT ÉS MIÉRT") {
                PenzField(prompt: "Mivel (pl. OTP, Nasdaq-ETF)", text: $instrument)
                PenzChoiceChips(options: [("long", "Hosszú · emelkedésre"), ("short", "Rövid · esésre")], selected: $direction)
                TextField("", text: $why, prompt: Text("Miért lépnél be? (egy mondat)").foregroundStyle(.white.opacity(0.4)),
                          axis: .vertical)
                    .lineLimit(2...4).nkFont(15).foregroundStyle(.white)
                    .padding(.horizontal, 16).padding(.vertical, 13)
                    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.08)))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.12)))
            }
            PenzCard(label: "A SZINTEK") {
                NKMono("PÉNZNEME")
                PenzChoiceChips(options: penzPracticeCurrencies.map { ($0, $0 == "HUF" ? "Forint" : $0) }, selected: $currency)
                PenzField(prompt: "Mennyiség (pl. 10 vagy 2,5)", text: $quantity, keyboard: .decimalPad)
                PenzPriceField(prompt: "Tervezett belépő", text: $plannedEntry, currency: cur)
                VStack(alignment: .leading, spacing: 6) {
                    PenzPriceField(prompt: "Kilépési szint (stop) — kötelező", text: $stop, currency: cur)
                    Text("Ha idáig megy ellened, kiszállsz. Nem én őrzöm: élő árfolyamot nem figyelek.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                }
                PenzPriceField(prompt: "Cél, ha van (nem kötelező)", text: $target, currency: cur)
            }
            PenzCard(label: "MOST LÉPEK BE") {
                Toggle(isOn: $enterNow) {
                    Text("Már be is léptem").nkFont(15).foregroundStyle(.white)
                }
                .tint(penzHue.glow)
                if enterNow {
                    PenzPriceField(prompt: "A belépő ára", text: $entry, currency: cur)
                    DatePicker("Mikor", selection: $entryDate, in: ...Date(), displayedComponents: .date)
                        .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
                    Text("A belépő a havi keretből fogy; ha nem fér bele, szólok, mennyi fér még.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            PenzSheetBar(error: error ?? (instrument.isEmpty && stop.isEmpty ? nil : problem),
                         title: saving ? "Mentem…" : (enterNow ? "Mentem és belépek" : "Mentem a tervet"),
                         glyph: "pen-sun", ready: problem == nil && !saving) { Task { await save() } }
        }
    }

    private func save() async {
        guard problem == nil, let stopMinor = penzParseAmount(stop), let qty = penzParseQuantity(quantity) else { return }
        saving = true
        defer { saving = false }
        let request = PenzTradeRequest(
            clientRef: ref.uuidString.lowercased(), instrument: instrument.trimmingCharacters(in: .whitespaces),
            direction: direction ?? "long", why: why.trimmingCharacters(in: .whitespacesAndNewlines), currency: cur,
            quantity: qty, plannedEntryMinor: penzParseAmount(plannedEntry), stopMinor: stopMinor,
            targetMinor: penzParseAmount(target), entryMinor: enterNow ? penzParseAmount(entry) : nil,
            entryDate: enterNow ? penzDay(entryDate) : nil)
        if let e = await store.createTrade(request) { error = e } else { onDone(enterNow ? "Belépve · papíron" : "Terv mentve") }
    }
}

// MARK: - One trade

struct PenzTradeSheet: View {
    let store: PenzStore
    let tradeId: String
    let onDone: (String?) -> Void
    @State private var mode: String? = "close"
    @State private var price = ""
    @State private var date = Date()
    @State private var tags: Set<String> = []
    @State private var mistake = false
    @State private var line = ""
    @State private var saving = false
    @State private var error: String?
    @State private var confirmCancel = false
    @State private var done: String?

    private var trade: PenzPaperTrade? { penzFindTrade(tradeId, in: store.practice?.value, journal: store.journal ?? []) }
    private var allTags: [PenzPracticeTag] {
        let t = store.practice?.value.tags ?? []
        return t.isEmpty ? penzPracticeDefaultTags : t
    }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Gyakorlás", title: trade.map { "\($0.instrument) · \(penzDirectionName($0.direction))" } ?? "Kereskedés") {
            if let done {
                NKHighlight(hue: penzHue, label: "Kész", text: done, sub: "A heti visszanézés ezzel számol tovább.")
            } else if let t = trade {
                plan(t)
                switch penzTradeKind(t) {
                case .planned: enter(t)
                case .open: openActions(t)
                case .closed: result(t)
                case .cancelled:
                    Text("Ezt a tervet elvetetted — nem lett belőle kereskedés.").nkFont(13.5).foregroundStyle(.white.opacity(0.6))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                NKNotLiveYet(hue: penzHue, title: "Ezt a kereskedést most nem találom",
                             line: "Lehet, hogy közben változott. Frissítsd a Gyakorlás oldalt.")
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let t = trade, done == nil { bar(t) }
        }
        .confirmationDialog("Elveted ezt a tervet?", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Elvetem", role: .destructive) { Task { await cancel() } }
            Button("Mégse", role: .cancel) {}
        } message: {
            Text("A terv a naplóban marad elvetettként, de nem lesz belőle kereskedés.")
        }
    }

    // MARK: the plan, shown first

    @ViewBuilder private func plan(_ t: PenzPaperTrade) -> some View {
        PenzCard(label: "A TERV") {
            if !t.why.isEmpty {
                NKHueText(t.why, hue: penzHue, size: 15.5, opacity: 0.9).frame(maxWidth: .infinity, alignment: .leading)
            }
            VStack(spacing: 0) {
                fact("Irány", t.direction == "short" ? "Rövid · esésre" : "Hosszú · emelkedésre")
                if let e = t.plannedEntry { fact("Tervezett belépő", penzPrice(e)) }
                fact("Kilépési szint (stop)", penzPrice(t.stop))
                if let g = t.target { fact("Cél", penzPrice(g)) }
                fact("Mennyiség", penzQuantityText(t.quantity))
                if let r = t.riskHufMinor { fact("Amit kockáztatsz", penzFtUnit(r)) }
                if let e = t.entry { fact("Belépő", penzPrice(e) + (t.entryDate.map { " · \(penzShortDate($0))" } ?? "")) }
            }
        }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).nkFont(13.5).foregroundStyle(.white.opacity(0.6))
            Spacer(minLength: 8)
            Text(value).nkFont(14.5, .medium).foregroundStyle(.white).multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 7)
    }

    // MARK: planned → Belépek / Elvetem

    @ViewBuilder private func enter(_ t: PenzPaperTrade) -> some View {
        PenzCard(label: "BELÉPEK") {
            PenzPriceField(prompt: "A belépő ára", text: $price, currency: t.currency)
                .onAppear { if price.isEmpty, let e = t.plannedEntry { price = penzPriceInput(e) } }
            DatePicker("Mikor", selection: $date, in: ...Date(), displayedComponents: .date)
                .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
            Text("A belépő a havi keretből fogy; ha nem fér bele, szólok, mennyi fér még.")
                .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
        }
        Button { confirmCancel = true } label: {
            Text("Elvetem a tervet").nkFont(14, .semibold).foregroundStyle(.white.opacity(0.7))
                .frame(maxWidth: .infinity).frame(height: 44)
        }
        .buttonStyle(.plain)
    }

    // MARK: open → Záróár / Lezárom

    @ViewBuilder private func openActions(_ t: PenzPaperTrade) -> some View {
        let row = penzTradeRow(t, tags: allTags)
        NKHueText(row.sub + " · \(row.value) \(row.valueSub)", hue: penzHue, size: 13, opacity: 0.65)
            .frame(maxWidth: .infinity, alignment: .leading)
        PenzChoiceChips(options: [("close", "Lezárom"), ("last", "Záróár beírása")], selected: $mode)
        if mode == "last" {
            PenzCard(label: "ZÁRÓÁR") {
                PenzPriceField(prompt: "A mai záróár", text: $price, currency: t.currency)
                DatePicker("Melyik napé", selection: $date, in: ...Date(), displayedComponents: .date)
                    .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
                Text("Ebből számolom, hol tart papíron. Élő árfolyamot nem figyelek.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        } else {
            PenzCard(label: "LEZÁROM") {
                PenzPriceField(prompt: "A kilépő ára", text: $price, currency: t.currency)
                DatePicker("Mikor", selection: $date, in: ...Date(), displayedComponents: .date)
                    .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
                NKMono("MI VOLT EZ? (LEGALÁBB EGY)")
                NKFlowRow(spacing: 8, rowSpacing: 8) {
                    ForEach(allTags) { tag in
                        let on = tags.contains(tag.key)
                        Button { if on { tags.remove(tag.key) } else { tags.insert(tag.key) } } label: {
                            Text(tag.label).nkFont(13.5, .medium).foregroundStyle(on ? NK.ground : .white)
                                .padding(.horizontal, 12).frame(height: 36)
                                .background(Capsule().fill(on ? AnyShapeStyle(penzHue.glow) : AnyShapeStyle(Color.white.opacity(0.08))))
                                .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.14)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                Toggle(isOn: $mistake) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hibának tartom").nkFont(15).foregroundStyle(.white)
                        Text("A heti visszanézés ezekből keresi a leggyakoribb hibát.").nkFont(12).foregroundStyle(.white.opacity(0.5))
                    }
                }
                .tint(penzHue.glow)
                VStack(alignment: .trailing, spacing: 4) {
                    PenzField(prompt: "Egy sor róla (pl. terv szerint zártam)", text: Binding(
                        get: { line }, set: { line = penzJournalLineTrimmed($0) }))
                    Text("\(line.count) / \(penzJournalLineLimit)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                }
            }
        }
    }

    // MARK: closed → the result

    @ViewBuilder private func result(_ t: PenzPaperTrade) -> some View {
        let row = penzTradeRow(t, tags: allTags)
        PenzCard(label: "AZ EREDMÉNY") {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(penzOutfit(row.value)).font(.custom(Lagy.outfitFamily, size: 38).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit()
                Text(row.valueSub).nkFont(15).foregroundStyle(.white.opacity(0.6))
                Spacer(minLength: 6)
                if let p = t.pnl {
                    Text(penzOutfit(penzSignedFt(p.hufMinor)) + "\u{00A0}Ft").nkFont(14).foregroundStyle(.white.opacity(0.6))
                }
            }
            Text(row.sub).nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            if !t.tags.isEmpty {
                Text(t.tags.map { penzTagLabel($0, tags: allTags) }.joined(separator: " · ")).nkFont(13).foregroundStyle(.white.opacity(0.55))
            }
            if let l = t.line, !l.isEmpty {
                Text("„\(l)”").nkFont(15, design: .serif).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: the button

    @ViewBuilder private func bar(_ t: PenzPaperTrade) -> some View {
        switch penzTradeKind(t) {
        case .planned:
            PenzSheetBar(error: error, title: saving ? "Belépek…" : "Belépek", glyph: "clock-ink",
                         ready: penzParseAmount(price) != nil && !saving) { Task { await openTrade(t) } }
        case .open where mode == "last":
            PenzSheetBar(error: error, title: saving ? "Mentem…" : "Beírom a záróárat", glyph: "pen-sun",
                         ready: penzParseAmount(price) != nil && !saving) { Task { await lastClose(t) } }
        case .open:
            PenzSheetBar(error: error ?? (penzParseAmount(price) != nil && tags.isEmpty ? "Válassz legalább egy címkét." : nil),
                         title: saving ? "Lezárom…" : "Lezárom", glyph: "check-ink",
                         ready: penzParseAmount(price) != nil && !tags.isEmpty && !saving) { Task { await close(t) } }
        default:
            EmptyView()
        }
    }

    private func openTrade(_ t: PenzPaperTrade) async {
        guard let m = penzParseAmount(price) else { return }
        saving = true; defer { saving = false }
        if let e = await store.openTrade(id: t.id, entryMinor: m, date: penzDay(date)) { error = e } else {
            error = nil; price = ""; done = "Beléptél · papíron"
        }
    }

    private func lastClose(_ t: PenzPaperTrade) async {
        guard let m = penzParseAmount(price) else { return }
        saving = true; defer { saving = false }
        if let e = await store.recordLastClose(id: t.id, closeMinor: m, date: penzDay(date)) { error = e } else {
            onDone("Záróár beírva")
        }
    }

    private func close(_ t: PenzPaperTrade) async {
        guard let m = penzParseAmount(price) else { return }
        saving = true; defer { saving = false }
        let request = PenzTradeCloseRequest(exitMinor: m, exitDate: penzDay(date),
                                            tags: allTags.map(\.key).filter(tags.contains), mistake: mistake,
                                            line: line.trimmingCharacters(in: .whitespaces))
        if let e = await store.closeTrade(id: t.id, request) { error = e } else { done = "Lezártad · papíron" }
    }

    private func cancel() async {
        saving = true; defer { saving = false }
        if let e = await store.cancelTrade(id: tradeId) { error = e } else { onDone("Terv elvetve") }
    }
}

/// `10`, `2,5` — a quantity with a decimal comma.
func penzQuantityText(_ q: Double) -> String {
    q.rounded() == q ? String(Int(q)) : String(format: "%g", q).replacingOccurrences(of: ".", with: ",")
}

/// A price prefilled into a field ("4120" / "4120,50").
func penzPriceInput(_ m: PenzMoney) -> String {
    let whole = m.minor / 100, cents = abs(m.minor % 100)
    return cents == 0 ? String(whole) : "\(whole),\(String(format: "%02d", cents))"
}
