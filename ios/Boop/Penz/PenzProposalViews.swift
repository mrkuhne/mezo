import SwiftUI
import BoopCore
import BoopDesign

// Pénz L7 (`mezo-r36n9.105`): the proposal flow (spec §5.5, build notes §1.11–§1.16, §4) — the amount sheet, the
// proposal page (per sleeve: the amount he adjusts, the share, why, two or three options with what they cost and how
// they differ; *Elfogadom* with his numbers, then the plan he ticks), the "miért?" page on the shared `NKWhyBody`, the
// monthly strategy, and the Termékjegyzék (one-tap approve / decline, every fee with its checked date and source).
//
// The proposal card is the kit's `NKProposalCard` — no second card surface. Boop never buys and never moves money:
// every page that leads towards a purchase says so.

let penzNeverBuysLine = "Boop soha nem vesz és nem mozgat pénzt helyetted: a vételt te intézed a saját platformodon, itt csak a terv van."

// MARK: - The amount sheet (Befektetnék · Felosztást kérek · Nagyobb összeg)

struct PenzAmountSheet: View {
    let store: PenzStore
    let title: String
    let onProposal: (PenzProposal) -> Void
    @State private var amount = ""
    @State private var working = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var minor: Int64? { penzProposalAmount(amount) }

    var body: some View {
        NKSheetFrame(hue: penzHue, eyebrow: "Pénz", title: title) {
            VStack(alignment: .leading, spacing: 8) {
                NKMono("MENNYIT SZERETNÉL ELHELYEZNI")
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    TextField("", text: $amount, prompt: Text("0").foregroundStyle(.white.opacity(0.3)))
                        .keyboardType(.numberPad).focused($focused)
                        .font(.custom(Lagy.outfitFamily, size: 44).weight(.light)).foregroundStyle(.white).monospacedDigit()
                        .onChange(of: amount) { _, new in
                            if let m = penzParseFt(new) { let f = penzOutfit(penzFt(m)); if f != new { amount = f } }
                        }
                        .accessibilityLabel("Összeg forintban")
                    Text("Ft").nkFont(18).foregroundStyle(.white.opacity(0.6))
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            NKHueText("Megnézem, hogyan osztanám el a *három rekesz* között — biztonság (1–3 év), középtáv (5–10 év), hosszú táv (10+ év) —, és rekeszenként két-három lehetőséget mutatok a *jóváhagyott termékeid* közül, a költségükkel és azzal, hogy miért. Minden számot átírhatsz, mielőtt elfogadod.",
                      hue: penzHue, size: 14, opacity: 0.75)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(penzNeverBuysLine).nkFont(12.5).foregroundStyle(.white.opacity(0.5))
                .frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
        }
        .safeAreaInset(edge: .bottom) {
            PenzSheetBar(error: error, title: working ? "Számolok…" : "Kérek javaslatot", glyph: "star-sun",
                         ready: minor != nil && !working) { Task { await ask() } }
        }
        .onAppear { focused = true }
    }

    private func ask() async {
        guard let minor else { return }
        working = true; defer { working = false }
        switch await store.createProposal(.lumpSum(minor)) {
        case .success(let p): onProposal(p)
        case .failure(let r): error = r.text
        }
    }
}

// MARK: - The proposal page

struct PenzProposalPage: View {
    let store: PenzStore
    let proposalId: String
    let onBack: @MainActor @Sendable () -> Void
    let openCatalog: @MainActor @Sendable () -> Void
    let record: @MainActor @Sendable () -> Void
    @State private var drafts: [PenzSleeveDraft] = []
    @State private var typed: [String: String] = [:]
    @State private var busy = false
    @State private var error: String?
    @State private var why = false
    @State private var toast: String?
    @State private var info = false
    private let hue = penzHue

    private var proposal: PenzProposal? { store.proposal(id: proposalId) }

    var body: some View {
        let p = proposal
        NKAreaSubPage(hue: hue, crumb: "Pénz · Javaslat", eyebrow: p?.kind == "monthly" ? "Havi stratégia" : "Nagyobb összeg",
                      title: p?.title ?? "Javaslat", sentence: p?.sub ?? "", onBack: onBack) {
            if let p {
                content(p)
            } else {
                PenzL7Section(label: "A FELOSZTÁS", state: store.proposalsProblem.map { e in
                    .failed(e == .offline ? "A javaslatot most nem érem el — ha lesz net, itt lesz." : penzErrorText(e)) {
                        Task { await store.loadProposals(force: true) }
                    }
                } ?? .loading) { EmptyView() }
            }
        }
        .nkToast($toast)
        .task { await store.loadProposals() }
        .onAppear { if drafts.isEmpty, let p { drafts = penzSleeveDrafts(p) } }
        .onChange(of: proposal?.id) { _, _ in if drafts.isEmpty, let p = proposal { drafts = penzSleeveDrafts(p) } }
        .sheet(isPresented: $why) {
            if let p {
                PenzProposalWhySheet(proposal: p,
                                     onAccept: p.status == "proposed" ? { why = false; Task { await accept(p) } } : nil,
                                     onDismiss: p.status == "proposed" ? { why = false; Task { await dismiss(p) } } : nil)
            }
        }
        .sheet(isPresented: $info) {
            NKSheetFrame(hue: hue, eyebrow: "Pénz · Javaslat", title: "Honnan vannak a termékek?") {
                NKHueText(penzCatalogInfoText, hue: hue, size: 15, opacity: 0.85)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(20).nkGlass()
            }
            .penzSheetStyle()
        }
    }

    @ViewBuilder private func content(_ p: PenzProposal) -> some View {
        let total = penzDraftTotal(drafts)
        NKStatRow([
            NKStat(value: penzOutfit(penzFt(p.status == "proposed" ? total : p.amountHufMinor)), unit: "Ft",
                   label: p.status == "proposed" ? "amit most beállítottál" : "amit elfogadtál"),
            NKStat(value: penzOutfit(penzFt(p.amountHufMinor)), unit: "Ft", label: p.kind == "monthly" ? "a havi összeg" : "amit megadtál"),
        ], hue: hue)
        if !p.summary.isEmpty {
            NKHueText(p.summary, hue: hue, size: 15, opacity: 0.82).frame(maxWidth: .infinity, alignment: .leading)
        }
        switch p.status {
        case "proposed":
            ForEach(p.sleeves) { s in sleeve(s, proposal: p, total: total) }
            NKProposalCard(text: p.title, sub: "Összesen \(penzFtUnit(total)) a fenti számokkal. \(penzNeverBuysLine)",
                           state: .pending, compact: true,
                           onAccept: { Task { await accept(p) } }, onDismiss: { Task { await dismiss(p) } },
                           onWhy: { why = true })
                .opacity(busy ? 0.6 : 1).disabled(busy)
            if let error {
                Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case "accepted":
            NKProposalCard(text: p.title, sub: p.sub, state: .accepted(penzPlanProgressText(p)), compact: true,
                           onAccept: {}, onDismiss: {}, onWhy: { why = true })
            plan(p)
        default:
            NKProposalCard(text: p.title, sub: p.sub,
                           state: .dismissed(p.status == "superseded" ? "Egy újabb javaslat váltotta fel" : "Ezt félretetted"),
                           compact: true, onAccept: {}, onDismiss: {}, onWhy: { why = true })
        }
        NKInfoRow("Honnan vannak a termékek?", hue: hue) { info = true }
        PenzL7Section(label: "TERMÉKJEGYZÉK") {
            VStack(alignment: .leading, spacing: 0) {
                NKHueText("Csak olyan terméket javaslok, amit te jóváhagytál — minden díjjal, forrással és azzal a dátummal, amikor ellenőriztük.",
                          hue: hue, size: 13.5, opacity: 0.6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                PenzMoreLink(title: "A termékjegyzék") { openCatalog() }
            }
        }
    }

    // MARK: one sleeve

    private func sleeveLabel(_ s: PenzProposalSleeve) -> String {
        switch s.sleeve {
        case "short": "1–3 ÉV · BIZTONSÁG"
        case "mid": "5–10 ÉV · KÖZÉPTÁV"
        default: "10+ ÉV · HOSSZÚ TÁV"
        }
    }

    @ViewBuilder private func sleeve(_ s: PenzProposalSleeve, proposal p: PenzProposal, total: Int64) -> some View {
        let i = drafts.firstIndex { $0.sleeve == s.sleeve }
        let amount = i.map { drafts[$0].amountHufMinor } ?? s.amountHufMinor
        PenzL7Section(label: sleeveLabel(s), trailing: "\(penzDraftShare(amount, of: total))%") {
            VStack(alignment: .leading, spacing: 12) {
                stepper(s, amount: amount, index: i)
                Text(amount == s.amountHufMinor ? "Ennyit javaslok: \(penzFtUnit(s.amountHufMinor)) (\(penzPct(s.sharePct, decimals: 0, signed: false))%)."
                                                : "Én \(penzFtUnit(s.amountHufMinor))-ot javasoltam — te átírtad.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                if !s.why.isEmpty { NKHueText(s.why, hue: hue, size: 14, opacity: 0.8).frame(maxWidth: .infinity, alignment: .leading) }
                ForEach(s.options) { o in option(o, sleeve: s, amount: amount, index: i) }
                if let note = s.optionsNote, !note.isEmpty {
                    Button { openCatalog() } label: {
                        HStack(alignment: .top, spacing: 8) {
                            NKGlyph("book-sage", hue.glow, size: 14).padding(.top, 2)
                            NKHueText(note.prefix(1).uppercased() + note.dropFirst(), hue: hue, size: 13, opacity: 0.7)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.right").nkFont(11, .semibold).foregroundStyle(.white.opacity(0.4))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func stepper(_ s: PenzProposalSleeve, amount: Int64, index: Int?) -> some View {
        HStack(spacing: 10) {
            stepButton("minus", label: "10 000 Ft-tal kevesebb") { typed[s.sleeve] = nil; set(index, penzStepped(amount, by: -penzSleeveStepHufMinor)) }
            TextField("", text: Binding(get: { typed[s.sleeve] ?? penzOutfit(penzFt(amount)) },
                                        set: { new in
                                            typed[s.sleeve] = new
                                            let digits = new.filter(\.isNumber)
                                            set(index, digits.isEmpty ? 0 : (Int64(digits.prefix(11)) ?? 0) * 100)
                                        }))
                .keyboardType(.numberPad).multilineTextAlignment(.center)
                .font(.custom(Lagy.outfitFamily, size: 26).weight(.light)).foregroundStyle(.white).monospacedDigit()
                .frame(maxWidth: .infinity)
                .accessibilityLabel("\(penzSleeveTitle(s.sleeve)) összege forintban")
            Text("Ft").nkFont(14).foregroundStyle(.white.opacity(0.55))
            stepButton("plus", label: "10 000 Ft-tal több") { typed[s.sleeve] = nil; set(index, penzStepped(amount, by: penzSleeveStepHufMinor)) }
        }
        .padding(.horizontal, 6).frame(height: 54)
        .background(Capsule().fill(.white.opacity(0.06)))
        .overlay(Capsule().stroke(.white.opacity(0.12)))
        .disabled(proposal?.status != "proposed")
    }

    private func stepButton(_ symbol: String, label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol == "minus" ? "\u{2212}" : "+").nkFont(22, .medium).foregroundStyle(.white)
                .frame(width: 42, height: 42)
                .background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func set(_ index: Int?, _ value: Int64) {
        guard let index else { return }
        drafts[index].amountHufMinor = value
        error = nil
    }

    @ViewBuilder private func option(_ o: PenzProductOption, sleeve s: PenzProposalSleeve, amount: Int64, index: Int?) -> some View {
        let picked = index.map { drafts[$0].productId == o.productId } ?? false
        Button {
            if let index { drafts[index].productId = o.productId; error = nil }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 10) {
                    ZStack {
                        Circle().stroke(.white.opacity(picked ? 0 : 0.35), lineWidth: 1.5)
                        if picked { Circle().fill(hue.glow); NKGlyph("check-ink", NK.ground, size: 14) }
                    }
                    .frame(width: 22, height: 22).padding(.top, 1)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(o.name).nkFont(16, .semibold).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                        Text(penzOptionSub(kind: o.kind, currency: o.currency, distribution: o.distribution))
                            .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                    }
                    Spacer(minLength: 0)
                }
                if !o.whatItIs.isEmpty {
                    Text(o.whatItIs).nkFont(13.5).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
                }
                Text(penzOptionFeeLine(o, proposedHufMinor: s.amountHufMinor))
                    .nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                ForEach(o.differs, id: \.self) { d in
                    HStack(alignment: .top, spacing: 7) {
                        Circle().fill(hue.glow.opacity(0.6)).frame(width: 4, height: 4).padding(.top, 7)
                        Text(d).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                if let src = o.sourceName ?? store.catalog?.value.first(where: { $0.id == o.productId })?.sourceName {
                    Text("Forrás: \(src)").nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.4))
                }
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(picked ? 0.1 : 0.04))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(picked ? hue.glow.opacity(0.7) : .white.opacity(0.1), lineWidth: picked ? 1.2 : 1)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(proposal?.status != "proposed")
        .accessibilityAddTraits(picked ? .isSelected : [])
    }

    // MARK: the accepted plan

    @ViewBuilder private func plan(_ p: PenzProposal) -> some View {
        PenzL7Section(label: "A TERVED", trailing: penzPlanProgressText(p)) {
            VStack(alignment: .leading, spacing: 10) {
                NKHueText("Pipáld ki, amit már megvettél a saját platformodon. A pipa *nem rögzít semmit* a Pénzemben — a valódi vételt a *Befektetést rögzítek* gombbal írod be.",
                          hue: hue, size: 13.5, opacity: 0.65)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(p.plan) { step in
                    Button { Task { await tick(p, step) } } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().stroke(.white.opacity(step.done ? 0 : 0.35), lineWidth: 1.5)
                                if step.done { Circle().fill(hue.glow); NKGlyph("check-ink", NK.ground, size: 15) }
                            }
                            .frame(width: 26, height: 26)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(penzPlanStepTitle(step)).nkFont(15, .medium).foregroundStyle(.white.opacity(step.done ? 0.6 : 1))
                                    .strikethrough(step.done, color: .white.opacity(0.4))
                                if let at = step.doneAt { Text("Kipipálva: \(penzShortDate(String(at.prefix(10))))").nkFont(12).foregroundStyle(.white.opacity(0.45)) }
                            }
                            Spacer(minLength: 6)
                            Text(penzOutfit(penzFt(step.amountHufMinor))).font(.custom(Lagy.outfitFamily, size: 18)).foregroundStyle(.white)
                                .monospacedDigit()
                            Text("Ft").nkFont(12).foregroundStyle(.white.opacity(0.55))
                        }
                        .padding(.vertical, 6).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(busy)
                    .accessibilityAddTraits(step.done ? .isSelected : [])
                }
                if let error {
                    Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                }
                PenzMoreLink(title: "Befektetést rögzítek") { record() }
            }
        }
    }

    // MARK: writes

    private func accept(_ p: PenzProposal) async {
        if let problem = penzAcceptProblem(drafts, proposal: p) { error = problem; return }
        busy = true; defer { busy = false }
        if let e = await store.acceptProposal(id: p.id, drafts: drafts) { error = e } else {
            error = nil
            toast = "Elfogadtad · most jön a terv"
        }
    }

    private func dismiss(_ p: PenzProposal) async {
        busy = true; defer { busy = false }
        if let e = await store.dismissProposal(id: p.id) { error = e } else { onBack() }
    }

    private func tick(_ p: PenzProposal, _ step: PenzPlanStep) async {
        busy = true; defer { busy = false }
        error = await store.setStep(proposalId: p.id, index: step.index, done: !step.done)
    }
}

let penzCatalogInfoText = """
Boop csak a *termékjegyzékedből* javasol: egy listából, amit egyszer átnéztél és jóváhagytál. Új terméket kutatás alapján javasolhatok a listára, de javaslatba csak az kerül, amit te jóváhagytál.

Minden díjat — az éves költséget (TER) és a belépési díjat — egy megnevezett forrásból vettünk, és odaírom, *mikor ellenőriztük*. Az éves költség forintban mindig arra az összegre szól, ami a rekeszben szerepel.

A javaslat nem ígér hozamot, és nem sürget. A vételt te intézed a saját platformodon — Boop soha nem vesz és nem mozgat pénzt.
"""

// MARK: - "miért?"

struct PenzProposalWhySheet: View {
    let proposal: PenzProposal
    let onAccept: (() -> Void)?
    let onDismiss: (() -> Void)?

    var body: some View {
        let w = penzProposalWhy(proposal)
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                NKWhyBody(title: w.title, sub: penzPlainEmphasis(w.sub),
                          facts: w.facts.map { (value: $0.value, unit: $0.unit, label: $0.label) },
                          experts: w.notes.map { (label: $0.label, palette: penzHue.orb, text: penzPlainEmphasis($0.text), doubt: $0.doubt) },
                          closing: w.closing)
                Group {
                    if let onAccept, let onDismiss {
                        HStack(spacing: 10) {
                            NKPill("Megnézem és elfogadom", wide: false) { onAccept() }
                            NKPill("Most nem", primary: false, wide: false) { onDismiss() }
                        }
                    } else {
                        Text(proposal.status == "accepted" ? "Ezt már elfogadtad." : proposal.status == "proposed" ? "" : "Ezt most félretetted.")
                            .nkFont(14).foregroundStyle(.white.opacity(0.55))
                    }
                }
                .padding(.horizontal, 20).padding(.bottom, 40)
            }
        }
        .scrollIndicators(.hidden)
        .presentationDetents([.large])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }
}

/// `NKWhyBody` prints plain text: the server's `*emphasis*` marks are dropped, never shown as asterisks.
func penzPlainEmphasis(_ s: String) -> String { s.replacingOccurrences(of: "*", with: "") }

// MARK: - Havi stratégia

struct PenzStrategyPage: View {
    let store: PenzStore
    let onBack: @MainActor @Sendable () -> Void
    let onProposal: @MainActor @Sendable (String) -> Void
    @State private var working = false
    @State private var error: String?
    private let hue = penzHue

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Pénz · Ma", eyebrow: "Havi stratégia", title: "Havi stratégia",
                      sentence: "A fizetésedből és a tényleges költésedből: mennyit tudsz havonta befektetni.", onBack: onBack) {
            if let s = store.strategy {
                VStack(alignment: .leading, spacing: 0) {
                    NKMono("ENNYIT TUDSZ HAVONTA BEFEKTETNI")
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(penzOutfit(penzFt(max(0, s.availableHufMinor)))).font(.custom(Lagy.outfitFamily, size: 42).weight(.light))
                            .foregroundStyle(s.availableHufMinor > 0 ? hue.glow : .white).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text("Ft / hó").nkFont(15).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(.top, 10)
                    if !s.note.isEmpty {
                        NKHueText(s.note, hue: hue, size: 13, opacity: 0.65).padding(.top, 8)
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass(28)
                PenzL7Section(label: "HONNAN JÖN EZ A SZÁM") {
                    NKRowList(s.inputs.map { i in
                        NKAreaRow(id: i.key, glyph: penzStrategyGlyph(i.key), title: i.label,
                                  value: penzOutfit(penzFt(i.hufMinor)), valueSub: "Ft")
                    }, hue: hue)
                }
                if let current = s.current ?? store.openProposals.first(where: { $0.kind == "monthly" }), current.status == "proposed" {
                    NKProposalCard(text: current.title, sub: current.sub, state: .pending, compact: true,
                                   onAccept: { onProposal(current.id) }, onDismiss: { Task { await dismiss(current) } },
                                   onWhy: { onProposal(current.id) })
                }
                if s.availableHufMinor > 0 {
                    NKPill(working ? "Számolok…" : "Kérek javaslatot", glyph: "star-sun") { Task { await ask() } }
                        .disabled(working)
                } else {
                    NKHueText("Ebben a hónapban a számok szerint *nem marad befektethető pénz*. Ez nem hiba és nem teendő — ha változik a bevétel vagy a költés, itt látod.",
                              hue: hue, size: 14, opacity: 0.75)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let error {
                    Text(error).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).frame(maxWidth: .infinity, alignment: .leading)
                }
                Text("Csak akkor számolom újra, ha te kéred — nem küldök értesítést, és nem sürgetek. \(penzNeverBuysLine)")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                PenzL7Section(label: "HONNAN JÖN EZ A SZÁM", state: store.strategyProblem.map { e in
                    .failed(e == .offline ? "A havi stratégiához net kell — ezt mindig frissen számolom." : penzErrorText(e)) {
                        Task { await store.loadStrategy() }
                    }
                } ?? .loading) { EmptyView() }
            }
        }
        .task { await store.loadStrategy(); await store.loadProposals() }
    }

    private func ask() async {
        working = true; defer { working = false }
        switch await store.createProposal(.monthly) {
        case .success(let p): onProposal(p.id)
        case .failure(let r): error = r.text
        }
    }

    private func dismiss(_ p: PenzProposal) async {
        if let e = await store.dismissProposal(id: p.id) { error = e } else { await store.loadStrategy() }
    }
}

func penzStrategyGlyph(_ key: String) -> String {
    switch key {
    case let k where k.lowercased().contains("income"): "plus-ink"
    case let k where k.lowercased().contains("expense") || k.lowercased().contains("fixed"): "clock-ink"
    case let k where k.lowercased().contains("saving"): "star-sun"
    default: "scale-ink"
    }
}

// MARK: - Termékjegyzék

struct PenzCatalogPage: View {
    let store: PenzStore
    let crumb: String
    let onBack: @MainActor @Sendable () -> Void
    @State private var busy: String?
    @State private var errors: [String: String] = [:]
    @Environment(\.openURL) private var openURL
    private let hue = penzHue

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: crumb, eyebrow: "Termékjegyzék", title: "Amiből javasolhatok",
                      sentence: "Csak a jóváhagyott termékeid kerülhetnek javaslatba. Boop soha nem vesz és nem mozgat pénzt.",
                      onBack: onBack) {
            if let products = store.catalog?.value {
                let g = penzCatalogGroups(products)
                PenzL7Section(label: "BOOP JAVASLATAI", trailing: g.suggested.isEmpty ? nil : "\(g.suggested.count) db") {
                    VStack(alignment: .leading, spacing: 12) {
                        if g.suggested.isEmpty {
                            NKHueText("Most nincs új javaslatom a listára.", hue: hue, size: 13.5, opacity: 0.6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            NKHueText("Ezeket néztem meg neked, a díjukkal és a forrásukkal együtt. Hagyd jóvá, amiből javasolhatok — a többire mondd, hogy *nem kell*.",
                                      hue: hue, size: 13.5, opacity: 0.65)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(penzCatalogSuggestedBySleeve(g.suggested), id: \.sleeve) { group in
                            if !group.title.isEmpty {
                                Text(group.title.uppercased()).nkFont(11.5, .semibold, design: .monospaced)
                                    .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)
                                    .accessibilityAddTraits(.isHeader)
                            }
                            ForEach(group.products) { p in card(p) }
                        }
                    }
                }
                .nkStale(store.catalogOffline ? penzAgeText(store.catalog.map { Date().timeIntervalSince($0.fetchedAt) }).map { NKStale(age: $0, loud: true) } : nil)
                PenzL7Section(label: "JÓVÁHAGYOTT", trailing: "\(g.approved.count) db") {
                    VStack(alignment: .leading, spacing: 12) {
                        if g.approved.isEmpty {
                            NKHueText("Még nincs jóváhagyott terméked — amíg nincs, rekeszenként csak az összeget tudom javasolni.",
                                      hue: hue, size: 13.5, opacity: 0.6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        ForEach(g.approved) { p in card(p) }
                    }
                }
                if !g.declined.isEmpty {
                    PenzL7Section(label: "ELUTASÍTOTT", trailing: "\(g.declined.count) db") {
                        VStack(alignment: .leading, spacing: 12) { ForEach(g.declined) { p in card(p) } }
                    }
                }
                NKHueText(penzCatalogInfoText, hue: hue, size: 13, opacity: 0.55).frame(maxWidth: .infinity, alignment: .leading)
            } else {
                PenzL7Section(label: "JÓVÁHAGYOTT", state: store.catalogProblem.map { e in
                    .failed(e == .offline ? "Nincs net, és még nincs elmentett termékjegyzékem." : penzErrorText(e)) {
                        Task { await store.loadCatalog() }
                    }
                } ?? .loading) { EmptyView() }
            }
        }
        .task { await store.loadCatalog() }
    }

    @ViewBuilder private func card(_ p: PenzProduct) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top, spacing: 10) {
                NKGlyph(penzProductGlyph(p.kind), hue.glow, size: 18).padding(.top, 2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(p.name).nkFont(16, .semibold).foregroundStyle(.white.opacity(p.status == "declined" ? 0.6 : 1))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(penzProductSub(p)).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            if !p.whatItIs.isEmpty {
                Text(p.whatItIs).nkFont(13.5).foregroundStyle(.white.opacity(0.78)).fixedSize(horizontal: false, vertical: true)
            }
            Text(penzProductFeeLine(p)).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
            if let url = p.sourceUrl.flatMap(URL.init(string:)), url.scheme == "https" {
                Button { openURL(url) } label: {
                    HStack(spacing: 5) {
                        Text("A forrás megnyitása").nkFont(12.5, .semibold).foregroundStyle(hue.glow)
                        Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .semibold)).foregroundStyle(hue.glow)
                    }
                }
                .buttonStyle(.plain)
            }
            if let e = errors[p.id] { Text(e).nkFont(13).foregroundStyle(.white.opacity(0.8)) }
            switch p.status {
            case "suggested":
                HStack(spacing: 10) {
                    NKPill(busy == p.id ? "Mentem…" : "Jóváhagyom", glyph: "check-ink", wide: true) { Task { await approve(p) } }
                    NKPill("Nem kell", primary: false, wide: true) { Task { await decline(p) } }
                }
                .disabled(busy != nil).padding(.top, 4)
            case "declined":
                Button { Task { await approve(p) } } label: {
                    Text("Mégis jóváhagyom").nkFont(13.5, .semibold).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 6)
                }
                .buttonStyle(.plain).disabled(busy != nil)
            default:
                if let at = p.approvedAt {
                    Text("Jóváhagyva: \(penzLongDate(String(at.prefix(10))))\(p.suggestedBy == "owner" ? " · te adtad hozzá" : "")")
                        .nkFont(11.5, design: .monospaced).foregroundStyle(.white.opacity(0.45))
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
    }

    private func approve(_ p: PenzProduct) async {
        busy = p.id; defer { busy = nil }
        errors[p.id] = await store.approveProduct(id: p.id)
    }

    private func decline(_ p: PenzProduct) async {
        busy = p.id; defer { busy = nil }
        errors[p.id] = await store.declineProduct(id: p.id)
    }
}

func penzProductGlyph(_ kind: String) -> String {
    switch kind {
    case "state_bond", "deposit", "money_market": "scale-ink"
    case "bond_etf", "mixed_fund": "chart-deep"
    default: "star-sun"
    }
}
