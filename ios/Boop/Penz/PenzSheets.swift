import SwiftUI
import BoopCore
import BoopDesign

// The Pénz area's sheets (L5). Every one but the cash capture is an **online** write he watches land: it says what
// went wrong in his words (`penzErrorText`) and keeps what he typed. The cash capture goes through the outbox, so
// it works on a plane.

// MARK: - Kiadás · cash, in a few seconds

struct PenzCaptureSheet: View {
    let onDone: (String?) -> Void
    @Environment(PenzStore.self) private var store: PenzStore?
    @Environment(RitmusEnvironment.self) private var ritmus: RitmusEnvironment?
    @State private var amount = ""
    @State private var category: String?
    @State private var note = ""
    @State private var saving = false
    @State private var error: String?
    @FocusState private var amountFocused: Bool

    private var minor: Int64? { penzParseFt(amount) }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz", title: "Kiadás") {
            if let account = store?.cashAccount {
                form(account)
            } else if store?.value == nil {
                NKNotLiveYet(hue: penzHue, title: "Ehhez egyszer net kell",
                             line: "Még nem tudom, melyik számládra írjam a készpénzt. Ha egyszer netre kapcsolódsz, megjegyzem, és utána net nélkül is rögzíthetsz.")
            } else {
                // No forint account at all yet (a fresh start): one tap makes the cash account, then the form appears.
                NKNotLiveYet(hue: penzHue, title: "Még nincs készpénz számlád",
                             line: "A készpénzt egy „Készpénz” nevű számlára írom. Egy érintéssel létrehozom, utána rögtön rögzíthetsz.")
                if let error {
                    Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, alignment: .leading)
                }
                NKPill(saving ? "Létrehozom…" : "Készpénz számla létrehozása", glyph: "plus-ink") {
                    Task {
                        saving = true
                        error = await store?.createCashAccount()
                        saving = false
                    }
                }
                .disabled(saving)
            }
        }
        // The one button rides above the keyboard, so the number pad never hides it.
        .safeAreaInset(edge: .bottom) {
            if let account = store?.cashAccount {
                VStack(spacing: 6) {
                    if let error {
                        Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    NKPill(saving ? "Rögzítem…" : "Rögzítem", glyph: "plus-ink") { Task { await save(account) } }
                        .disabled(minor == nil || saving)
                        .opacity(minor == nil ? 0.5 : 1)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .background(NK.ground.opacity(0.92))
            }
        }
        .onAppear { amountFocused = true }
    }

    @ViewBuilder private func form(_ account: PenzAccount) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono("MENNYI")
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("", text: $amount, prompt: Text("0").foregroundStyle(.white.opacity(0.3)))
                    .keyboardType(.numberPad)
                    .focused($amountFocused)
                    .font(.custom(Lagy.outfitFamily, size: 44).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit()
                    .onChange(of: amount) { _, new in
                        // Grouped as he types: "34500" reads "34 500".
                        if let m = penzParseFt(new) { let f = penzOutfit(penzFt(m)); if f != new { amount = f } }
                    }
                    .accessibilityLabel("Összeg forintban")
                Text("Ft").nkFont(18).foregroundStyle(.white.opacity(0.6))
            }
            Text("\(penzArticle(account.name)) \(account.name) számlára kerül, mai dátummal.").nkFont(12.5).foregroundStyle(.white.opacity(0.5))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

        VStack(alignment: .leading, spacing: 12) {
            NKMono("MIRE")
            PenzCategoryChips(categories: penzExpenseCategories(store?.categories ?? []), selected: $category)
            TextField("", text: $note, prompt: Text("Megjegyzés, ha kell (pl. piac)").foregroundStyle(.white.opacity(0.4)))
                .nkFont(15).foregroundStyle(.white)
                .padding(.horizontal, 16).frame(height: 48)
                .background(Capsule().fill(.white.opacity(0.08)))
                .overlay(Capsule().stroke(.white.opacity(0.12)))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

        Text("Net nélkül is megmarad: a telefonon vár, és elküldöm, amint lesz kapcsolat.")
            .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
    }

    private func save(_ account: PenzAccount) async {
        guard let minor, let ritmus else { error = "Most nem tudom elmenteni. Próbáld újra."; return }
        saving = true
        defer { saving = false }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = PenzExpensePayload(accountId: account.id, amountMinor: minor, currency: account.currency,
                                         categoryId: category, date: penzDay(Date()), note: trimmed.isEmpty ? nil : trimmed)
        do {
            try await ritmus.capturePenzExpense(payload)
            store?.setPending(await ritmus.outbox.queue)
            onDone("Kiadás rögzítve · \(penzFtUnit(minor))")
        } catch {
            self.error = "A telefon most nem tudta elmenteni. Próbáld újra."
        }
    }
}

// MARK: - Ellenőrzés · the bank messages Boop was not sure of

struct PenzReviewSheet: View {
    let store: PenzStore
    @State private var choice: [String: String?] = [:]
    @State private var saving: String?
    @State private var errors: [String: String] = [:]

    var body: some View {
        let rows = store.reviewRows
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Költés", title: "Ellenőrzés") {
            if rows.isEmpty {
                NKHighlight(hue: penzHue, label: "Kész", text: "Nincs több ellenőrizendő tétel",
                            sub: "Minden banki üzenet a helyén van.")
            } else {
                NKHueText("Ezeknél a banki üzeneteknél nem voltam biztos a kategóriában. Válaszd ki, hova valók, és nyomd meg a *Rendben*-t.",
                          hue: penzHue, size: 14, opacity: 0.75)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(rows) { t in row(t) }
            }
        }
    }

    @ViewBuilder private func row(_ t: PenzTransaction) -> some View {
        let cats = store.categories.filter { $0.kind == (t.kind == "income" ? "income" : "expense") }
            .sorted { $0.position < $1.position }
        let picked = choice[t.id] ?? t.categoryId
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(t.note ?? "Banki tétel").nkFont(16, .semibold).foregroundStyle(.white)
                    Text("\(penzDayTitle(t.date)) · \(penzSourceText(t, accounts: store.accounts))")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Text(penzOutfit(penzFt(t.amount.hufMinor))).font(.custom(Lagy.outfitFamily, size: 20).weight(.medium)).foregroundStyle(.white)
                Text("Ft").nkFont(12).foregroundStyle(.white.opacity(0.55))
            }
            PenzCategoryChips(categories: cats, selected: Binding(get: { picked }, set: { choice[t.id] = $0 }))
            if let e = errors[t.id] { Text(e).nkFont(13).foregroundStyle(.white.opacity(0.75)) }
            NKPill(saving == t.id ? "Mentem…" : "Rendben", glyph: "check-ink", primary: true, wide: true) {
                Task { await confirm(t, picked) }
            }
            .disabled(saving != nil)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func confirm(_ t: PenzTransaction, _ categoryId: String?) async {
        saving = t.id
        defer { saving = nil }
        if let e = await store.confirm(t, categoryId: categoryId) { errors[t.id] = e } else { errors[t.id] = nil }
    }
}

// MARK: - Egy sor módosítása · the savings target and Gyakorlás

struct PenzEditLinesSheet: View {
    let store: PenzStore
    let onSaved: () -> Void
    @State private var savings = ""
    @State private var practice = ""
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Honnan jön ez a szám", title: "Egy sor módosítása") {
            if let s = store.value?.settings {
                field("AMIT HAVONTA FÉLRETESZEL", "A megtakarítási cél — a befektetett összeg külön jön hozzá.", $savings)
                field("GYAKORLÁS", "A havi játékkeret. Külön sor, hogy ne a befektetésből menjen.", $practice)
                if let error { Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).frame(maxWidth: .infinity, alignment: .leading) }
                NKPill(saving ? "Mentem…" : "Mentés", glyph: "check-ink") { Task { await save() } }
                    .disabled(saving || parsed(savings) == nil || parsed(practice) == nil)
                Text("A többi sor — a bevétel, a fix kiadások, az előző hónap hiánya — a tételeidből jön, ezért ott nincs mit átírni.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
                    .onAppear {
                        if savings.isEmpty { savings = penzFt(s.savingsTargetHufMinor) }
                        if practice.isEmpty { practice = penzFt(s.practiceMonthlyHufMinor) }
                    }
            } else {
                NKNotLiveYet(hue: penzHue, title: "A beállításaidat most nem érem el",
                             line: "Ha lesz net, itt írhatod át a havi megtakarítást és a Gyakorlás keretét.")
            }
        }
    }

    /// "0" is a real choice here (no practice money this month); empty is not.
    private func parsed(_ text: String) -> Int64? {
        let digits = text.filter(\.isNumber)
        guard !digits.isEmpty, digits.count <= 11, let ft = Int64(digits) else { return nil }
        return ft * 100
    }

    private func field(_ label: String, _ sub: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono(label)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("", text: text).keyboardType(.numberPad)
                    .font(.custom(Lagy.outfitFamily, size: 32).weight(.light)).foregroundStyle(.white).monospacedDigit()
                Text("Ft / hó").nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
            Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    private func save() async {
        guard let s = parsed(savings), let p = parsed(practice) else { return }
        saving = true
        defer { saving = false }
        if let e = await store.saveSettings(savingsTargetHufMinor: s, practiceMonthlyHufMinor: p) { error = e } else { onSaved() }
    }
}

// MARK: - Hónap lezárása · he decides what happens to the leftover

struct PenzCloseSheet: View {
    let store: PenzStore
    @State private var saving: String?
    @State private var error: String?
    @State private var closed: String?

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Költés", title: "Hónap lezárása") {
            if let closed {
                NKHighlight(hue: penzHue, label: "Lezárva", text: "Lezártad \(penzArticle(closed).lowercased()) \(closed)",
                            sub: "A döntésed bekerült. A következő hónap már ezzel számol.")
            } else if let m = store.openMonths.filter({ !$0.closed }).min(by: { $0.month < $1.month }) {
                open(m)
            } else {
                NKHighlight(hue: penzHue, label: "Nincs teendő", text: "Nincs lezáratlan hónap",
                            sub: "Ha egy hónap véget ér, itt zárhatod le, és te döntöd el, mi legyen a maradékkal.")
            }
        }
    }

    @ViewBuilder private func open(_ m: PenzMonthClose) -> some View {
        let remaining = m.finalRemaining?.hufMinor ?? 0
        let deficit = m.deficit?.hufMinor ?? max(0, -remaining)
        let name = penzMonthWord(m.month).capitalizedFirst
        VStack(alignment: .leading, spacing: 10) {
            NKMono(name.uppercased())
            if remaining > 0 {
                Text(penzOutfit("\(penzFtUnit(remaining)) maradt")).font(.custom(Lagy.outfitFamily, size: 32).weight(.light)).foregroundStyle(.white)
                Text("Te döntöd el, mi legyen vele. Magától semmi nem történik.").nkFont(14).foregroundStyle(.white.opacity(0.7))
            } else {
                Text(penzOutfit(deficit > 0 ? "\(penzFtUnit(deficit))-tal csúsztál el" : "Pont kijött"))
                    .font(.custom(Lagy.outfitFamily, size: 28).weight(.light)).foregroundStyle(.white)
                Text(deficit > 0
                     ? "A hiány a következő hónap levezetésében külön sorként jelenik meg — nem tüntetem el, és nem írom felül a múltat."
                     : "Nincs maradék és nincs hiány, így nincs miről dönteni — csak lezárjuk.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        if let error { Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).frame(maxWidth: .infinity, alignment: .leading) }
        if remaining > 0 {
            NKPill(saving == "transferred" ? "Átvezetem…" : "Átteszem a megtakarításba", glyph: "star-sun") {
                Task { await close(m, "transferred") }
            }
            .disabled(saving != nil)
            NKPill(saving == "kept" ? "Lezárom…" : "Itt hagyom a folyószámlán", primary: false) { Task { await close(m, "kept") } }
                .disabled(saving != nil)
        } else {
            NKPill(saving == "none" ? "Lezárom…" : "Lezárom", glyph: "check-ink") { Task { await close(m, "none") } }
                .disabled(saving != nil)
        }
    }

    private func close(_ m: PenzMonthClose, _ action: String) async {
        saving = action
        defer { saving = nil }
        if let e = await store.closeMonth(m.month, leftoverAction: action) { error = e } else {
            closed = penzMonthWord(m.month, .accusative)
        }
    }
}

// MARK: - Keretek · read-only

struct PenzBudgetsSheet: View {
    let store: PenzStore
    var body: some View {
        let spend = penzSpendByCategory(store.transactions)
        let cats = penzExpenseCategories(store.categories)
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Költés", title: "Keretek") {
            if cats.isEmpty {
                NKNotLiveYet(hue: penzHue, title: "Még nincs kategóriád", line: "Ha lesznek kiadási kategóriáid, itt látod a havi keretüket és a költésüket.")
            } else {
                PenzSection(label: "KERETEK", trailing: penzMonthWord(store.today).capitalizedFirst) {
                    NKRowList(cats.map { c in
                        let spent = spend[c.id] ?? 0
                        let budget = c.monthlyBudgetHufMinor
                        return NKAreaRow(id: c.id, glyph: penzCategoryGlyph(c.name), title: c.name,
                                         sub: budget.map { "havi keret: \(penzFtUnit($0))" } ?? "nincs keret megadva",
                                         value: penzOutfit(penzFt(spent)), valueSub: "Ft",
                                         level: budget.map { penzLevel(spent, of: $0) })
                    }, hue: penzHue)
                }
                Text("A kereteket egyelőre nem itt állítod be — ez az oldal csak megmutatja, hol tartasz.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: - Cél vagy vásárlás hozzáadása

struct PenzAddGoalSheet: View {
    let store: PenzStore
    let onSaved: () -> Void
    @State private var name = ""
    @State private var purchase = false
    @State private var target = ""
    @State private var saved = ""
    @State private var hasDue = false
    @State private var due = Calendar.current.date(byAdding: .month, value: 6, to: Date()) ?? Date()
    @State private var saving = false
    @State private var error: String?
    /// One ref per sheet: a second tap after a lost answer is the same goal, not a second one.
    @State private var ref = UUID()

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz · Mire gyűjtök", title: "Új cél") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    kindChip("Cél", glyph: "star-sun", on: !purchase) { purchase = false }
                    kindChip("Vásárlás", glyph: "leaf-sage", on: purchase) { purchase = true }
                }
                TextField("", text: $name, prompt: Text(purchase ? "Mit vennél? (pl. futócipő)" : "Mire gyűjtesz? (pl. nyári út)")
                    .foregroundStyle(.white.opacity(0.4)))
                    .nkFont(16).foregroundStyle(.white)
                    .padding(.horizontal, 16).frame(height: 50)
                    .background(Capsule().fill(.white.opacity(0.08))).overlay(Capsule().stroke(.white.opacity(0.12)))
                amountField("MENNYI KELL", $target)
                amountField("EBBŐL MÁR MEGVAN (NEM KÖTELEZŐ)", $saved)
                Toggle(isOn: $hasDue) { Text("Van határideje").nkFont(15).foregroundStyle(.white) }.tint(penzHue.glow)
                if hasDue {
                    DatePicker("Határidő", selection: $due, in: Date()..., displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "hu_HU")).nkFont(15).foregroundStyle(.white)
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            if purchase {
                Text("Hogy melyik lehetőséget és melyik hónapban érdemes megvenni, azt Boop egy későbbi lépésben fogja megmondani. Most a gyűjtést követed.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).frame(maxWidth: .infinity, alignment: .leading)
            }
            if let error { Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.75)).frame(maxWidth: .infinity, alignment: .leading) }
            NKPill(saving ? "Mentem…" : "Hozzáadom", glyph: "plus-ink") { Task { await save() } }
                .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty || penzParseFt(target) == nil)
        }
    }

    private func kindChip(_ title: String, glyph: String, on: Bool, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 6) {
                NKGlyph(glyph, on ? NK.ground : .white, size: 14)
                Text(title).nkFont(14, .semibold).foregroundStyle(on ? NK.ground : .white)
            }
            .padding(.horizontal, 14).frame(height: 38)
            .background(Capsule().fill(on ? AnyShapeStyle(penzHue.glow) : AnyShapeStyle(Color.white.opacity(0.08))))
        }
        .buttonStyle(.plain)
    }

    private func amountField(_ label: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            NKMono(label)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("", text: text, prompt: Text("0").foregroundStyle(.white.opacity(0.3))).keyboardType(.numberPad)
                    .font(.custom(Lagy.outfitFamily, size: 28).weight(.light)).foregroundStyle(.white).monospacedDigit()
                Text("Ft").nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
        }
    }

    private func save() async {
        guard let t = penzParseFt(target) else { return }
        saving = true
        defer { saving = false }
        let request = PenzGoalRequest(clientRef: ref.uuidString.lowercased(), name: name.trimmingCharacters(in: .whitespaces),
                                      kind: purchase ? "purchase" : "goal", targetHufMinor: t, savedHufMinor: penzParseFt(saved),
                                      dueDate: hasDue ? penzDay(due) : nil, position: store.value?.goals?.count)
        if let e = await store.addGoal(request) { error = e } else { onSaved() }
    }
}

// MARK: - A hónap összes tétele

struct PenzMonthPage: View {
    let store: PenzStore
    let onBack: @MainActor @Sendable () -> Void

    var body: some View {
        let shown = penzShown(store.transactions)
        let days = penzByDay(shown)
        NKAreaSubPage(hue: penzHue, crumb: "Pénz", eyebrow: "Költés · \(penzMonthWord(store.today))",
                      title: "A hónap tételei",
                      sentence: shown.isEmpty ? "Ebben a hónapban még nincs tétel." : "\(shown.count) tétel, napok szerint.",
                      onBack: onBack) {
            ForEach(days, id: \.day) { d in
                NKBare(penzDayTitle(d.day), hue: penzHue) {
                    NKRowList(penzItems(d.rows, pending: [], categories: store.categories, accounts: store.accounts).map { penzRow($0) },
                              hue: penzHue)
                }
            }
        }
    }
}
