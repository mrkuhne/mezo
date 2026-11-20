import SwiftUI
import BoopCore
import BoopDesign

// Pénz L6 (`mezo-r36n9.104`): recording a buy or a sell he already made on his own platform, and adding a portfolio
// event. Both are **online** writes he watches land — straight to the server with a `clientRef` (a retry never doubles
// a holding or a buy), the server's refusal said in his words, and what he typed kept. Boop records; it never buys.

/// Single-choice chips over (id, name) pairs (wrapping, so nothing clips at 320 pt).
struct PenzChoiceChips: View {
    let options: [(id: String, name: String)]
    @Binding var selected: String?
    var body: some View {
        NKFlowRow(spacing: 8, rowSpacing: 8) {
            ForEach(options, id: \.id) { o in
                let on = selected == o.id
                Button { selected = o.id } label: {
                    Text(o.name).nkFont(13.5, .medium).foregroundStyle(on ? NK.ground : .white)
                        .lineLimit(1)
                        .padding(.horizontal, 12).frame(height: 36)
                        .background(Capsule().fill(on ? AnyShapeStyle(penzHue.glow) : AnyShapeStyle(Color.white.opacity(0.08))))
                        .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.14)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}

/// A text field in the sheets' capsule.
struct PenzField: View {
    let prompt: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var body: some View {
        TextField("", text: $text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.4)))
            .keyboardType(keyboard)
            .autocorrectionDisabled()
            .nkFont(15).foregroundStyle(.white)
            .padding(.horizontal, 16).frame(height: 48)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
    }
}

// MARK: - Befektetést rögzítek

struct PenzRecordSheet: View {
    let store: PenzStore
    let onDone: (String) -> Void

    @State private var mode: String?
    @State private var holdingId: String?
    // a new holding
    @State private var name = ""
    @State private var assetType: String? = "etf"
    @State private var symbol = ""
    @State private var platform: String? = "revolut"
    @State private var platformName = ""
    @State private var sleeve: String? = "long"
    @State private var currency: String? = "HUF"
    // the buy or sell
    @State private var side: String? = "buy"
    @State private var quantity = ""
    @State private var amount = ""
    @State private var date = Date()

    @State private var saving = false
    @State private var error: String?
    /// Kept for the sheet's life: a retry after a failure replays the same holding and the same buy.
    @State private var holdingRef = UUID()
    @State private var txnRef = UUID()

    private var choices: [PenzHoldingChoice] { penzHoldingChoices(store.portfolio?.value) }
    private var isNew: Bool { (mode ?? (choices.isEmpty ? "new" : "existing")) == "new" }
    private var chosen: PenzHoldingChoice? { choices.first { $0.id == holdingId } }
    private var unit: String { isNew ? (currency ?? "HUF") : (chosen?.currency ?? "HUF") }
    private var amountMinor: Int64? { penzParseAmount(amount) }
    private var ready: Bool {
        guard amountMinor != nil, quantity.isEmpty || penzParseQuantity(quantity) != nil else { return false }
        if isNew { return !name.trimmingCharacters(in: .whitespaces).isEmpty && assetType != nil && sleeve != nil && currency != nil && platform != nil }
        return chosen != nil
    }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Pénzem", title: "Befektetést rögzítek") {
            Text("Amit a saját platformodon már megvettél vagy eladtál. Boop csak feljegyzi — soha nem vesz és nem mozgat pénzt.")
                .nkFont(13).foregroundStyle(.white.opacity(0.6)).frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            card("MIBEN") {
                if !choices.isEmpty {
                    PenzChoiceChips(options: [("existing", "Meglévő"), ("new", "Új befektetés")],
                                    selected: Binding(get: { isNew ? "new" : "existing" }, set: { mode = $0 }))
                }
                if isNew { newHolding } else {
                    PenzChoiceChips(options: choices.map { ($0.id, $0.label) }, selected: $holdingId)
                }
            }
            card("MI TÖRTÉNT") {
                PenzChoiceChips(options: [("buy", "Vettem"), ("sell", "Eladtam")], selected: $side)
                VStack(alignment: .leading, spacing: 6) {
                    NKMono(side == "sell" ? "MENNYIT KAPTÁL ÉRTE" : "MENNYIBE KERÜLT ÖSSZESEN")
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        TextField("", text: $amount, prompt: Text("0").foregroundStyle(.white.opacity(0.3)))
                            .keyboardType(.decimalPad)
                            .font(.custom(Lagy.outfitFamily, size: 34).weight(.light)).foregroundStyle(.white).monospacedDigit()
                            .accessibilityLabel("Összeg")
                        Text(unit == "HUF" ? "Ft" : unit).nkFont(16).foregroundStyle(.white.opacity(0.6))
                    }
                    if unit != "HUF" {
                        Text("A forintértéket a szerver az aznapi hivatalos árfolyamon számolja ki.")
                            .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                PenzField(prompt: "Darabszám, ha van (pl. 12 vagy 3,5)", text: $quantity, keyboard: .decimalPad)
                DatePicker("Mikor", selection: $date, in: ...Date(), displayedComponents: .date)
                    .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 6) {
                if let error {
                    Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                NKPill(saving ? "Rögzítem…" : "Rögzítem", glyph: "plus-ink") { Task { await save() } }
                    .disabled(!ready || saving)
                    .opacity(ready ? 1 : 0.5)
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .background(NK.ground.opacity(0.92))
        }
    }

    @ViewBuilder private var newHolding: some View {
        PenzField(prompt: "Neve (pl. Világ-ETF, OTP részvény)", text: $name)
        NKMono("FAJTÁJA")
        PenzChoiceChips(options: penzAssetTypes.map { ($0.type, $0.name) }, selected: $assetType)
        PenzField(prompt: "Tőzsdei jel, ha van (pl. OTP.BD, VWCE.DE)", text: $symbol)
            .textInputAutocapitalization(.characters)
        Text("A jelből napi záróárat kérek. Ha üresen hagyod, a vételárán számolom (állampapírnál a kamatából).")
            .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
        NKMono("HOL VAN")
        PenzChoiceChips(options: penzPlatforms.map { ($0.platform, $0.name) }, selected: $platform)
        if platform == "other" { PenzField(prompt: "A platform neve", text: $platformName) }
        NKMono("MELYIK REKESZBE")
        PenzChoiceChips(options: PenzSleeveKey.allCases.map { ($0.rawValue, penzSleeveTitle($0.rawValue)) }, selected: $sleeve)
        NKMono("PÉNZNEME")
        PenzChoiceChips(options: penzCurrencies.map { ($0, $0 == "HUF" ? "Forint" : $0) }, selected: $currency)
    }

    private func card<C: View>(_ label: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono(label)
            content()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func save() async {
        guard let minor = amountMinor else { return }
        saving = true
        defer { saving = false }
        let trimmedSymbol = symbol.trimmingCharacters(in: .whitespaces)
        let newRequest: PenzHoldingRequest? = isNew ? PenzHoldingRequest(
            clientRef: holdingRef.uuidString.lowercased(), name: name.trimmingCharacters(in: .whitespaces),
            assetType: assetType ?? "etf", symbol: trimmedSymbol.isEmpty ? nil : trimmedSymbol, platform: platform ?? "other",
            platformName: platform == "other" && !platformName.isEmpty ? platformName : nil, sleeve: sleeve ?? "long",
            currency: currency ?? "HUF") : nil
        let txn = PenzInvestTxnRequest(clientRef: txnRef.uuidString.lowercased(), holdingId: "", side: side ?? "buy",
                                       quantity: penzParseQuantity(quantity), amountMinor: minor, date: penzDay(date))
        if let e = await store.recordInvestment(newHolding: newRequest, holdingId: isNew ? nil : holdingId, transaction: txn) {
            error = e
        } else {
            onDone(side == "sell" ? "Eladás rögzítve" : "Vétel rögzítve")
        }
    }
}

// MARK: - Esemény hozzáadása

struct PenzEventSheet: View {
    let store: PenzStore
    let onDone: (String) -> Void
    @State private var holdingId: String?
    @State private var kind: String? = "maturity"
    @State private var date = Date().addingTimeInterval(30 * 86_400)
    @State private var amount = ""
    @State private var saving = false
    @State private var error: String?
    @State private var ref = UUID()

    private var choices: [PenzHoldingChoice] { penzHoldingChoices(store.portfolio?.value) }
    private var chosen: PenzHoldingChoice? { choices.first { $0.id == holdingId } }
    private var ready: Bool { chosen != nil && kind != nil && (amount.isEmpty || penzParseAmount(amount) != nil) }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Pénzem", title: "Esemény hozzáadása") {
            if choices.isEmpty {
                NKNotLiveYet(hue: penzHue, title: "Előbb egy befektetés kell",
                             line: "Az esemény — lejárat, kamatforduló, osztalék — egy befektetésedhez tartozik. Rögzíts előbb egyet a „Befektetést rögzítek” gombbal.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    NKMono("MELYIK BEFEKTETÉS")
                    PenzChoiceChips(options: choices.map { ($0.id, $0.label) }, selected: $holdingId)
                    NKMono("MI LESZ")
                    PenzChoiceChips(options: penzEventKinds.map { ($0.kind, $0.name) }, selected: $kind)
                    DatePicker("Mikor", selection: $date, displayedComponents: .date)
                        .nkFont(15).foregroundStyle(.white).tint(penzHue.glow)
                    PenzField(prompt: "Várható összeg, ha tudod (\(chosen?.currency == nil || chosen?.currency == "HUF" ? "Ft" : chosen!.currency))",
                              text: $amount, keyboard: .decimalPad)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
                if let error {
                    Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
                }
                NKPill(saving ? "Mentem…" : "Hozzáadom", glyph: "plus-ink") { Task { await save() } }
                    .disabled(!ready || saving).opacity(ready ? 1 : 0.5)
            }
        }
    }

    private func save() async {
        guard let id = holdingId else { return }
        saving = true
        defer { saving = false }
        let request = PenzHoldingEventRequest(clientRef: ref.uuidString.lowercased(), holdingId: id, kind: kind ?? "other",
                                              date: penzDay(date), amountMinor: penzParseAmount(amount))
        if let e = await store.addEvent(request) { error = e } else { onDone("Esemény hozzáadva") }
    }
}
