import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SPIKE round 2 (mezo-r36n9.177) — owner: the list was „puritán és béna"; every mezociklus is a card with
// its weeks' curve and the muscles it trains, and opening one shows it before anything starts.

// MARK: - Invented data

struct SpikeMezo: Identifiable, Hashable {
    enum Kind: Hashable { case running, planned, closed, template }
    let id = UUID()
    let kind: Kind
    let title: String
    let dates: String
    let split: String
    let weeks: Int
    var currentWeek: Int = 0
    /// Phase per week: 0 alap · 1 építés · 2 csúcs · 3 pihenő.
    var curve: [Int]
    var focus: [String: Double]
    var runs: Int = 0
    var adherence: Double? = nil
    var records: Int = 0
    var hasReport = true
    var note: String = ""

    func timeline() -> [NKBlockWeek] {
        curve.enumerated().map { i, p in
            let w = i + 1
            let state: NKBlockWeek.State = kind == .closed ? .past
                : (kind == .running ? (w < currentWeek ? .past : (w == currentWeek ? .current : .future)) : .future)
            return NKBlockWeek(week: w, load: [0.45, 0.72, 1.0, 0.3][p], phase: ["Alap", "Építés", "Csúcs", "Pihenőhét"][p],
                               state: state, isDeload: p == 3)
        }
    }
    var heat: [NKBodyHeat] { focus.map { NKBodyHeat(muscle: $0.key, level: $0.value) } }
}

private let upper: [String: Double] = ["chest": 0.9, "back": 0.8, "shoulders": 0.85, "biceps": 0.6, "triceps": 0.6, "quads": 0.3, "hamstrings": 0.25, "glutes": 0.3]
private let lower: [String: Double] = ["quads": 0.95, "hamstrings": 0.8, "glutes": 0.9, "calves": 0.6, "chest": 0.35, "back": 0.4]
private let even: [String: Double] = ["chest": 0.65, "back": 0.7, "shoulders": 0.6, "quads": 0.7, "hamstrings": 0.6, "glutes": 0.6, "biceps": 0.5]
private let curve6 = [0, 1, 1, 2, 2, 3], curve8 = [0, 0, 1, 1, 2, 2, 2, 3]

let spikeMezos: [SpikeMezo] = [
    SpikeMezo(kind: .planned, title: "Erő · Tél", dates: "jan. 5-től", split: "felső-alsó", weeks: 6, curve: curve6, focus: lower, note: "Az éves tervből"),
    SpikeMezo(kind: .closed, title: "Hipertrófia · Nyár", dates: "júl. 7. – aug. 17.", split: "push-pull-láb", weeks: 6, curve: curve6, focus: upper, adherence: 0.88, records: 4),
    SpikeMezo(kind: .closed, title: "Hipertrófia · Nyár", dates: "jún. 23. – júl. 4.", split: "push-pull-láb", weeks: 6, curve: curve6, focus: upper, adherence: 0.4, records: 0, note: "2 hét után újraindítva"),
    SpikeMezo(kind: .closed, title: "Váll és hát", dates: "máj. 5. – jún. 15.", split: "felső-alsó", weeks: 6, curve: curve6, focus: upper, adherence: 0.71, hasReport: false),
    SpikeMezo(kind: .template, title: "Hipertrófia · Ősz", dates: "", split: "5 napos", weeks: 8, curve: curve8, focus: even, runs: 3),
    SpikeMezo(kind: .template, title: "Erő · Tél", dates: "", split: "felső-alsó", weeks: 6, curve: curve6, focus: lower, runs: 0),
    SpikeMezo(kind: .template, title: "Váll és hát", dates: "", split: "felső-alsó", weeks: 6, curve: curve6, focus: upper, runs: 1),
]

func spikeRunning(_ b: BlockPlan) -> SpikeMezo {
    SpikeMezo(kind: .running, title: b.title, dates: "okt. 13-tól", split: b.split, weeks: b.weeks, currentWeek: b.currentWeek,
              curve: curve8, focus: even, adherence: 0.83)
}

// MARK: - The two tiles on the tab

struct MezoTilesSpike: View {
    let hue: Hue
    let current: BlockPlan?
    let onAll: () -> Void
    let onYear: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            tile(label: "ÖSSZES", title: "Mezociklusaim", sub: "3 sablon · 3 lezárt", action: onAll) {
                // Three cards fanned out, each with its own weeks' curve.
                ZStack {
                    ForEach(0..<3) { i in
                        miniCurve([curve6, curve8, curve6][i], lit: i == 2)
                            .padding(8)
                            .frame(width: 92, height: 54)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(white: 0.16 + Double(i) * 0.04)))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.14)))
                            .rotationEffect(.degrees(Double(i - 1) * 7))
                            .offset(x: CGFloat(i - 1) * 16, y: CGFloat(2 - i) * 4)
                    }
                }
            }
            tile(label: "ÉVES TERV", title: "Az év íve", sub: "4 mezociklus · 2 hátra", action: onYear) {
                // The year as a strip of blocks, with where he stands.
                GeometryReader { g in
                    let w = g.size.width
                    ZStack(alignment: .leading) {
                        HStack(spacing: 3) {
                            ForEach(Array([0.22, 0.18, 0.06, 0.22, 0.2, 0.12].enumerated()), id: \.offset) { i, f in
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(i == 3 ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(i < 3 ? 0.42 : 0.16)))
                                    .frame(width: max(4, (w - 15) * f), height: i == 2 ? 14 : 30)
                            }
                        }
                        Capsule().fill(.white).frame(width: 2, height: 44).offset(x: w * 0.56)
                    }
                    .frame(maxHeight: .infinity)
                }
                .frame(height: 54)
            }
        }
    }

    private func tile<G: View>(label: String, title: String, sub: String, action: @escaping () -> Void,
                               @ViewBuilder graphic: () -> G) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Text(label).nkFont(10.5, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                graphic().frame(maxWidth: .infinity).frame(height: 70)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(17, design: .serif).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
                    Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.6)).lineLimit(2)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 180, alignment: .topLeading)
            .nkGlass(22)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}

/// The weeks as little bars — the shape of a mezociklus at a glance.
func miniCurve(_ curve: [Int], lit: Bool, current: Int? = nil) -> some View {
    HStack(alignment: .bottom, spacing: 3) {
        ForEach(Array(curve.enumerated()), id: \.offset) { i, p in
            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                .fill(p == 3 ? AnyShapeStyle(Color.clear) : AnyShapeStyle(i + 1 == current ? Hue.mozgas.glow : .white.opacity(lit ? 0.75 : 0.4)))
                .overlay(p == 3 ? RoundedRectangle(cornerRadius: 2.5).stroke(.white.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [2, 2])) : nil)
                .frame(height: CGFloat([0.45, 0.72, 1.0, 0.3][p]) * 34)
        }
    }
    .frame(height: 34, alignment: .bottom)
}

/// A ring for „how much of it got done".
struct SpikeRing: View {
    let value: Double, hue: Hue, size: CGFloat
    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.12), lineWidth: size * 0.11)
            Circle().trim(from: 0, to: value).stroke(hue.glow, style: StrokeStyle(lineWidth: size * 0.11, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(value * 100))%").nkFont(size * 0.26, .semibold).foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Mezociklusaim page

struct MezociklusokPageSpike: View {
    let hue: Hue
    let running: BlockPlan?
    let onBack: () -> Void
    @State private var open: SpikeMezo?

    private var planned: [SpikeMezo] { spikeMezos.filter { $0.kind == .planned } }
    private var closed: [SpikeMezo] { spikeMezos.filter { $0.kind == .closed } }
    private var templates: [SpikeMezo] { spikeMezos.filter { $0.kind == .template } }

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Edzés · Mezociklus", eyebrow: "Mezociklusaim",
                      title: "Eddig 4 mezociklus, 26 hét edzés",
                      sentence: "Koppints bármelyikre: előbb megnézed, utána döntesz, hogy indítod, szerkeszted vagy csak átnézed.",
                      onBack: onBack) {
            if let running { hero(spikeRunning(running)) }
            if !planned.isEmpty {
                NKBare("KÖVETKEZIK", hue: hue, glyph: "clock-ink") {
                    ForEach(planned) { m in plannedCard(m) }
                }
            }
            NKBare("SABLONJAIM", hue: hue, glyph: "book-sage", trailing: "\(templates.count)") {
                NKCarousel(templates, hue: hue, height: 236, widthFraction: 0.62) { m in templateCard(m) }
            }
            NKBare("LEZÁRTAK", hue: hue, glyph: "check-ink") {
                VStack(spacing: 12) { ForEach(closed) { m in closedCard(m) } }
            }
        }
        .fullScreenCover(item: $open) { m in MezoDetailSpike(mezo: m, hue: hue, running: running) { open = nil } }
    }

    /// The running one, big: the weeks with today lit, the body it trains, and how it is going.
    private func hero(_ m: SpikeMezo) -> some View {
        Button { open = m } label: {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("MOST FUT").nkFont(10.5, .semibold, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                        Text(m.title).nkFont(26, design: .serif).foregroundStyle(.white)
                        Text("\(m.currentWeek). hét a \(m.weeks)-ból · \(m.split)").nkFont(13).foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer()
                    SpikeRing(value: m.adherence ?? 0, hue: hue, size: 62)
                }
                HStack(alignment: .bottom, spacing: 14) {
                    NKBlockTimeline(m.timeline(), hue: hue).frame(maxWidth: .infinity)
                    NKBodyMap(m.heat, hue: hue, views: .front).frame(width: 64, height: 110)
                }
            }
            .padding(18)
            .background {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(LinearGradient(colors: [hue.glow.opacity(0.28), .clear], startPoint: .topTrailing, endPoint: .bottomLeading))
            }
            .nkGlass(28)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20)
    }

    private func plannedCard(_ m: SpikeMezo) -> some View {
        Button { open = m } label: {
            HStack(spacing: 14) {
                VStack(spacing: 2) {
                    Text("JAN").nkFont(11, .semibold, design: .monospaced).foregroundStyle(hue.glow)
                    Text("5").nkFont(26, .semibold).foregroundStyle(.white)
                }
                .frame(width: 58, height: 64)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.title).nkFont(18, design: .serif).foregroundStyle(.white)
                    Text("\(m.weeks) hét · \(m.split) · \(m.note)").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
                Spacer(minLength: 6)
                miniCurve(m.curve, lit: false).frame(width: 64)
            }
            .padding(14).nkGlass(22)
        }
        .buttonStyle(.plain)
    }

    private func templateCard(_ m: SpikeMezo) -> some View {
        Button { open = m } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top) {
                    NKBodyMap(m.heat, hue: hue, views: .front).frame(width: 52, height: 88)
                    Spacer()
                    Text(m.runs == 0 ? "ÚJ" : "\(m.runs)×")
                        .nkFont(11, .semibold, design: .monospaced).foregroundStyle(m.runs == 0 ? NK.ground : .white)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Capsule().fill(m.runs == 0 ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(0.12))))
                }
                Spacer(minLength: 0)
                miniCurve(m.curve, lit: true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(m.title).nkFont(18, design: .serif).foregroundStyle(.white).lineLimit(1)
                    Text("\(m.weeks) hét · \(m.split)").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .nkGlass(24)
        }
        .buttonStyle(.plain)
    }

    private func closedCard(_ m: SpikeMezo) -> some View {
        Button { open = m } label: {
            HStack(spacing: 14) {
                SpikeRing(value: m.adherence ?? 0, hue: hue, size: 54)
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.title).nkFont(17, design: .serif).foregroundStyle(.white)
                    Text(m.dates).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                    HStack(spacing: 6) {
                        if m.records > 0 { NKTagSpike(text: "\(m.records) rekord", lit: true, hue: hue) }
                        if !m.note.isEmpty { NKTagSpike(text: m.note, lit: false, hue: hue) }
                        if !m.hasReport { NKTagSpike(text: "nincs jelentés", lit: false, hue: hue) }
                    }
                }
                Spacer(minLength: 4)
                miniCurve(m.curve, lit: false).frame(width: 52).opacity(0.8)
            }
            .padding(14).nkGlass(22)
        }
        .buttonStyle(.plain)
    }
}

struct NKTagSpike: View {
    let text: String, lit: Bool, hue: Hue
    var body: some View {
        Text(text).nkFont(11, .medium).foregroundStyle(lit ? NK.ground : .white.opacity(0.75)).lineLimit(1)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(lit ? AnyShapeStyle(hue.glow) : AnyShapeStyle(.white.opacity(0.1))))
    }
}

// MARK: - Opening one: look first, then decide

struct MezoDetailSpike: View {
    let mezo: SpikeMezo
    let hue: Hue
    let running: BlockPlan?
    let onBack: () -> Void
    @State private var confirmStart = false
    @State private var showReport = false

    private let days: [(String, String, String, Int)] = [
        ("HÉT", "Mell és váll", "mell · váll · tricepsz", 6), ("KE", "Láb", "comb · far · vádli", 5),
        ("CSÜ", "Hát és kar", "hát · bicepsz", 6), ("PÉ", "Felsőtest", "mell · hát · váll", 5), ("SZO", "Láb és törzs", "comb · has", 5),
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            NKAreaSubPage(hue: hue, crumb: "Mezociklusaim", eyebrow: eyebrow, title: mezo.title,
                          sentence: sentence, onBack: onBack) {
                NKBare("A HETEK ÍVE", hue: hue, glyph: "chart-deep") {
                    NKBlockTimeline(mezo.timeline(), hue: hue, caption: "\(mezo.weeks) hét · \(mezo.split) · a végén pihenőhét")
                }
                if mezo.kind == .closed, mezo.hasReport {
                    NKBare("HOGY SIKERÜLT", hue: hue, glyph: "medal-sun") {
                        Button { showReport = true } label: {
                            HStack(spacing: 16) {
                                SpikeRing(value: mezo.adherence ?? 0, hue: hue, size: 70)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(mezo.records) új rekord, a felsőtest nőtt a legtöbbet").nkFont(15, .semibold).foregroundStyle(.white)
                                    Text("Zárójelentés és Boop értékelése").nkFont(13).foregroundStyle(.white.opacity(0.6))
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.45))
                            }
                            .padding(16).nkGlass(22)
                        }
                        .buttonStyle(.plain)
                    }
                }
                NKBare("A HÉT NAPJAI", hue: hue, glyph: "dumbbell-ink") {
                    NKCarousel(days.map { SpikeDay(d: $0) }, hue: hue, height: 150, widthFraction: 0.46) { d in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(d.d.0).nkFont(11, .medium, design: .monospaced).tracking(1.4).foregroundStyle(hue.glow)
                            Text(d.d.1).nkFont(18, design: .serif).foregroundStyle(.white).lineLimit(2)
                            Text(d.d.2).nkFont(12.5).foregroundStyle(.white.opacity(0.6)).lineLimit(2)
                            Spacer(minLength: 0)
                            Text("\(d.d.3) gyakorlat").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                        }
                        .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading).nkGlass(22)
                    }
                }
                NKBare("MIT KAPNAK AZ IZMOK", hue: hue, glyph: "body-cream") {
                    HStack(spacing: 18) {
                        NKBodyMap(mezo.heat, hue: hue, views: .both).frame(height: 170)
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(mezo.focus.sorted { $0.value > $1.value }.prefix(3), id: \.key) { k, v in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(muscleName(k)).nkFont(13, .semibold).foregroundStyle(.white)
                                    NKLevelBar(level: v, hue: hue)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                Color.clear.frame(height: 110)
            }
            actionBar
        }
        .confirmationDialog("Elindítod: \(mezo.title)?", isPresented: $confirmStart, titleVisibility: .visible) {
            Button("Indítás ma") {}
            Button("Mégse", role: .cancel) {}
        } message: {
            if let running { Text("A most futó „\(running.title)\" lezárul, és zárójelentéssel a lezártak közé kerül.") }
            else { Text("Ma indul, az 1. héttől.") }
        }
        .fullScreenCover(isPresented: $showReport) { MezoReportSpike(mezo: mezo, hue: hue) { showReport = false } }
    }

    private var eyebrow: String {
        switch mezo.kind {
        case .running: "Most fut · \(mezo.currentWeek). hét"
        case .planned: "Következik · \(mezo.dates)"
        case .closed: "Lezárt · \(mezo.dates)"
        case .template: mezo.runs == 0 ? "Sablon · még nem futott" : "Sablon · \(mezo.runs)-szor futott"
        }
    }
    private var sentence: String {
        switch mezo.kind {
        case .template: "Nézd át nyugodtan: semmi nem indul el, amíg nem kéred."
        case .closed: "Így ment, és innen újra is futtathatod, ugyanezzel a tervvel."
        case .planned: "Az éves terved szerint ez jön. Elindíthatod korábban is."
        case .running: "Ez fut most."
        }
    }

    /// The decision lives at the bottom, after he has seen it.
    private var actionBar: some View {
        HStack(spacing: 10) {
            if mezo.kind != .running {
                Button { confirmStart = true } label: {
                    Text(mezo.kind == .closed ? "Újrafuttatás" : "Indítás").nkFont(16, .semibold).foregroundStyle(NK.ground)
                        .frame(maxWidth: .infinity, minHeight: 52).background(Capsule().fill(.white))
                }
                .buttonStyle(.plain)
            }
            if mezo.kind == .template || mezo.kind == .planned || mezo.kind == .running {
                Button {} label: {
                    Text("Szerkesztés").nkFont(16, .semibold).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Capsule().fill(.white.opacity(0.12)).overlay(Capsule().stroke(.white.opacity(0.2))))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 30)
        .background(LinearGradient(colors: [NK.ground.opacity(0), NK.ground.opacity(0.95), NK.ground], startPoint: .top, endPoint: .bottom))
    }

    private func muscleName(_ k: String) -> String {
        ["chest": "Mell", "back": "Hát", "shoulders": "Váll", "biceps": "Bicepsz", "triceps": "Tricepsz", "quads": "Comb elöl",
         "hamstrings": "Comb hátul", "glutes": "Far", "calves": "Vádli"][k] ?? k
    }
}

private struct SpikeDay: Identifiable { let id = UUID(); let d: (String, String, String, Int) }

// MARK: - Zárójelentés

struct MezoReportSpike: View {
    let mezo: SpikeMezo
    let hue: Hue
    let onBack: () -> Void
    var pending = false

    var body: some View {
        NKAreaSubPage(hue: hue, crumb: "Mezociklusaim", eyebrow: "Zárójelentés · \(mezo.dates)",
                      title: mezo.title, sentence: "6 hétből 6, 17 edzésből 15 kész. Négy gyakorlatban erősebb lettél.",
                      onBack: onBack) {
            HStack(spacing: 18) {
                SpikeRing(value: mezo.adherence ?? 0.88, hue: hue, size: 104)
                VStack(alignment: .leading, spacing: 12) {
                    stat("\(max(mezo.records, 4))", "új rekord")
                    stat("+12%", "volumen az elejéhez képest")
                }
                Spacer()
            }
            .padding(18).nkGlass(26).padding(.horizontal, 20)
            NKBare("A HETEK: TERV ÉS VALÓSÁG", hue: hue, glyph: "chart-deep") {
                HStack(alignment: .bottom, spacing: 8) {
                    ForEach(Array(zip([3, 3, 3, 2, 3, 1], [3, 3, 3, 3, 3, 2]).enumerated()), id: \.offset) { i, p in
                        VStack(spacing: 6) {
                            ZStack(alignment: .bottom) {
                                RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.1)).frame(height: CGFloat(p.1) * 30)
                                RoundedRectangle(cornerRadius: 6).fill(hue.glow).frame(height: CGFloat(p.0) * 30)
                            }
                            Text("\(i + 1)").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            NKBare("ERŐ", hue: hue, glyph: "dumbbell-ink") {
                VStack(spacing: 10) {
                    gain("Fekvenyomás", "például 80 → 85 kg × 8", 0.7)
                    gain("Guggolás", "például 100 → 107,5 kg × 6", 0.9)
                    gain("Evezés", "például 70 → 72,5 kg × 10", 0.4)
                }
            }
            NKBare("BOOP ÉRTÉKELÉSE", hue: hue, glyph: "chat-ink") {
                Group {
                    if pending {
                        HStack(spacing: 10) { ProgressView().tint(.white); Text("Boop még írja, pár perc…").nkFont(14).foregroundStyle(.white.opacity(0.7)) }
                    } else {
                        Text("A felsőtest szépen nőtt, a láb lemaradt a terv mögött: a következő mezociklusban érdemes ott eggyel több sorozat.")
                            .nkFont(15).foregroundStyle(.white.opacity(0.88))
                    }
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
            }
        }
    }

    private func stat(_ v: String, _ l: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v).nkFont(26, .semibold).foregroundStyle(.white)
            Text(l).nkFont(12).foregroundStyle(.white.opacity(0.6))
        }
    }
    private func gain(_ name: String, _ line: String, _ v: Double) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(name).nkFont(15, .semibold).foregroundStyle(.white)
                Text(line).nkFont(12).foregroundStyle(.white.opacity(0.55))
            }
            .frame(width: 170, alignment: .leading)
            NKLevelBar(level: v, hue: hue)
        }
    }
}
