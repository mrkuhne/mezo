#if DEBUG
import SwiftUI
import BoopDesign

// THROWAWAY simulator spike for B7 "Napi kapacitás" (mezo-r36n9.17). Not for main.
// Launch: -previewKapacitas YES  [-kapOpen atrendezes|hatas|nap|evad|ma]  [-previewScroll N]
// Every number and event here is an invented fixture ("például"), never his data.

let kapHue: Hue = .pulzus   // Energia's hue: the day's capacity lives with energy

// MARK: - Fixtures

struct KapDay: Identifiable {
    let id: String          // "H"
    let date: String        // "nov. 24."
    let demand: Double      // 0…1.3 of capacity
    let capacity: Double    // 0…1 (drawn as the line)
    let what: String        // one line: what fills the day
}

enum KapWord {
    static func of(_ d: KapDay) -> String {
        let r = d.demand / d.capacity
        return r < 0.6 ? "laza" : r < 0.9 ? "rendben" : r <= 1.0 ? "szoros" : "túl sok"
    }
}

let kapWeek: [KapDay] = [
    KapDay(id: "H", date: "24.", demand: 0.62, capacity: 0.82, what: "3 megbeszélés · felsőtest"),
    KapDay(id: "K", date: "25.", demand: 0.55, capacity: 0.78, what: "röplabda este"),
    KapDay(id: "Sz", date: "26.", demand: 0.80, capacity: 0.80, what: "késő esti hívás 21:30-ig"),
    KapDay(id: "Cs", date: "27.", demand: 1.12, capacity: 0.70, what: "6 ó megbeszélés · lábnap · rövid éjszaka"),
    KapDay(id: "P", date: "28.", demand: 0.72, capacity: 0.76, what: "sprint review 16:00 · hát"),
    KapDay(id: "Sz", date: "29.", demand: 0.30, capacity: 0.85, what: "üres nap"),
    KapDay(id: "V", date: "30.", demand: 0.48, capacity: 0.84, what: "röplabda délelőtt"),
]

enum KapKind: String { case edzes = "EDZÉS", alvasEdzes = "ALVÁS + EDZÉS", naptar = "NAPTÁR · TEENDŐ", etel = "ÉTEL" }

struct KapProposal: Identifiable {
    let id: String
    let kind: KapKind
    let glyph: String
    let title: String
    let move: String                       // from → to, one line
    let effects: [(glyph: String, text: String)]
    let acceptedLine: String
}

let kapProposals: [KapProposal] = [
    KapProposal(id: "labnap", kind: .edzes, glyph: "dumbbell-ink",
                title: "A lábnapot tedd át szombatra",
                move: "csütörtök 18:00  →  szombat 10:00 (üres nap)",
                effects: [("bolt-ink", "A csütörtök túl sokból szorosra enyhül, a szombat laza helyett rendben lesz"),
                          ("bowl-sage", "A kalória vele megy: csütörtökön 2 350, szombaton 2 640 kcal"),
                          ("ball-sun", "A vasárnapi röplabda előtt egy pihenőnap marad"),
                          ("check-ink", "A heti 4 edzés megmarad, az Évad terve nem változik")],
                acceptedLine: "Lábnap: szombat 10:00"),
    KapProposal(id: "alvas", kind: .alvasEdzes, glyph: "moon-ink",
                title: "Szerdán feküdj később, a csütörtök reggeli edzés csússzon egy órát",
                move: "lefekvés 22:30 → 23:15  ·  csütörtök reggeli séta 6:45 → 7:45",
                effects: [("moon-ink", "A 21:30-ig tartó hívás után is meglesz a 7 óra 15 perc alvás"),
                          ("clock-ink", "Csütörtökön 8:30-kor kezdődik az első megbeszélés, így még belefér"),
                          ("bowl-sage", "A reggeli 7:45 helyett 8:15-re kerül, a keret nem változik")],
                acceptedLine: "Szerda: lefekvés 23:15, csütörtök séta 7:45"),
    KapProposal(id: "review", kind: .naptar, glyph: "clock-ink",
                title: "A pénteki sprint review-t tedd át 15:00-ra",
                move: "péntek 16:00–17:30  →  15:00–16:30",
                effects: [("dumbbell-ink", "A 17:30-as hátedzés előtt egy óra szünet marad, nem rohansz"),
                          ("bowl-sage", "Az edzés előtti uzsonna 16:30-ra kerül"),
                          ("link-deep", "A naptáradhoz nem nyúlok: te teszed át, én észreveszem")],
                acceptedLine: "Teendő: a sprint review → 15:00"),
    KapProposal(id: "etel", kind: .etel, glyph: "bowl-sage",
                title: "Csütörtökön egy nagyobb ebéd, kisebb vacsora",
                move: "ebéd 650 → 850 kcal  ·  vacsora 800 → 600 kcal",
                effects: [("bolt-ink", "A délutáni mélypont előtt több energiád lesz a megbeszélésekhez"),
                          ("moon-ink", "A könnyebb vacsora után jobban alszol a rövid éjszaka előtt"),
                          ("check-ink", "A napi keret ugyanannyi marad")],
                acceptedLine: "Csütörtök: nagyobb ebéd"),
]

// MARK: - Root

struct KapacitasDemoRoot: View {
    @State private var open = UserDefaults.standard.string(forKey: "kapOpen") ?? "atrendezes"
    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            switch open {
            case "hatas": KapDetail(back: { open = "atrendezes" })
            case "nap": KapDayPage(back: { open = "ma" })
            case "evad": KapSeasonPage()
            case "ma": KapMaPreview(openAtrendezes: { open = "atrendezes" }, openNap: { open = "nap" })
            default: KapAtrendezes(back: { open = "ma" }, detail: { open = "hatas" })
            }
        }
        .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                     ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
        .preferredColorScheme(.dark)
    }
}

// MARK: - The week strip: each day's load against what he can carry that day

struct KapWeekStrip: View {
    let days: [KapDay]
    var lit: Int? = 3
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(days.indices, id: \.self) { i in
                    let d = days[i]
                    let over = d.demand > d.capacity
                    VStack(spacing: 7) {
                        Text(KapWord.of(d)).nkFont(10.5, .medium)
                            .foregroundStyle(over ? NK.under : .white.opacity(0.55))
                            .lineLimit(1).minimumScaleFactor(0.7)
                        GeometryReader { g in
                            let h = g.size.height
                            ZStack(alignment: .bottom) {
                                RoundedRectangle(cornerRadius: 7).fill(.white.opacity(0.06))
                                RoundedRectangle(cornerRadius: 7)
                                    .fill(over ? NK.under.opacity(0.85) : .white.opacity(i == lit ? 0.75 : 0.42))
                                    .frame(height: min(h, h * d.demand / 1.2))
                                Rectangle().fill(kapHue.glow).frame(height: 2)
                                    .offset(y: -h * d.capacity / 1.2 + 1)
                            }
                        }
                        .frame(height: 96)
                        Text(d.id).nkFont(13, i == lit ? .semibold : .regular).foregroundStyle(.white.opacity(i == lit ? 1 : 0.7))
                        Text(d.date).font(.nkNumber(11)).foregroundStyle(.white.opacity(0.45))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 14) {
                legend(color: .white.opacity(0.6), text: "a nap terhe")
                legend(color: kapHue.glow, text: "amennyit aznap bírsz", line: true)
            }
        }
    }
    private func legend(color: Color, text: String, line: Bool = false) -> some View {
        HStack(spacing: 6) {
            if line { Rectangle().fill(color).frame(width: 14, height: 2) }
            else { RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 10, height: 10) }
            Text(text).nkFont(11.5).foregroundStyle(.white.opacity(0.55))
        }
    }
}

// MARK: - One proposal: what moves, every cross-effect in short, his decision

struct KapProposalCard: View {
    let p: KapProposal
    @Binding var state: String?   // nil pending · "ok" · "no"
    let more: () -> Void

    var body: some View {
        if let s = state { settled(ok: s == "ok") } else { pending }
    }

    private var pending: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                NKGlyph(p.glyph, .white.opacity(0.85), size: 16)
                NKMono(p.kind.rawValue)
                Spacer()
                Button(action: more) {
                    Text("minden hatása").nkFont(13.5, .semibold).foregroundStyle(.white).underline(pattern: .dot)
                }.buttonStyle(.plain)
            }
            Text(p.title).nkFont(20, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
            Text(p.move).font(.nkNumber(13.5)).foregroundStyle(kapHue.glow).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(p.effects.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: 10) {
                        NKGlyph(p.effects[i].glyph, .white.opacity(0.6), size: 14).padding(.top, 2)
                        Text(p.effects[i].text).nkFont(13.5).foregroundStyle(.white.opacity(0.75))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.top, 2)
            HStack(spacing: 10) {
                pill(p.kind == .naptar ? "Felírom teendőnek" : "Jóváhagyom", primary: true) { withAnimation { state = "ok" } }
                pill("Most nem", primary: false) { withAnimation { state = "no" } }
            }
            .padding(.top, 2)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(24)
    }

    private func settled(ok: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(ok ? .white : .white.opacity(0.1))
                NKGlyph(ok ? "check-ink" : "clock-ink", ok ? NK.ground : .white.opacity(0.7), size: 15)
            }.frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(ok ? p.acceptedLine : p.title).nkFont(14.5, .medium).foregroundStyle(.white.opacity(ok ? 1 : 0.6)).lineLimit(2)
                Text(ok ? (p.kind == .naptar ? "Várom, hogy átkerüljön a naptáradban" : "Átírtam mindenhol erre a hétre")
                        : "Nem teszem át. Ezt is feljegyzem.")
                    .nkFont(12.5).foregroundStyle(ok && p.kind == .naptar ? NK.under.opacity(0.9) : .white.opacity(0.45))
            }
            Spacer(minLength: 8)
            Button { withAnimation { state = nil } } label: {
                Text("vissza").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6))
            }.buttonStyle(.plain)
        }
        .padding(14)
        .nkGlass(20)
    }

    private func pill(_ t: String, primary: Bool, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            Text(t).nkFont(15, .semibold).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(primary ? NK.ground : .white)
                .padding(.horizontal, 18).frame(minHeight: 44)
                .background(Capsule().fill(primary ? .white : .white.opacity(0.1)))
        }.buttonStyle(.plain)
    }
}

// MARK: - Átrendezés: the new page

struct KapAtrendezes: View {
    let back: @MainActor @Sendable () -> Void
    let detail: @MainActor @Sendable () -> Void
    @State private var states: [String: String] = [:]

    var body: some View {
        NKAreaSubPage(hue: kapHue, crumb: "Ma", eyebrow: "Átrendezés · nov. 24–30.",
                      title: "A csütörtök túl sok lenne",
                      sentence: "Négy dolgot tennék át ezen a héten. Amíg jóvá nem hagyod, semmi sem mozdul, és az *Évad terve* sem változik.",
                      onBack: back) {
            NKBare("A heted", hue: kapHue, glyph: "chart-deep", trailing: "teher és bírás") {
                KapWeekStrip(days: kapWeek)
                Text("Csütörtök: 6 óra megbeszélés, ebből 4 szünet nélkül, este lábnap, előtte várhatóan 6 óra alvás.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            NKBare("Boop javaslatai", hue: kapHue, glyph: "spark-cream", trailing: "\(kapProposals.count - states.count) vár rád") {
                VStack(spacing: 12) {
                    ForEach(kapProposals) { p in
                        KapProposalCard(p: p, state: Binding(get: { states[p.id] }, set: { states[p.id] = $0 }), more: detail)
                    }
                }
            }
            NKBare("Ha mindet jóváhagyod", hue: kapHue, glyph: "link-deep") {
                NKCompareColumns(leftTitle: "Most", rightTitle: "Utána", lines: [
                    NKCompareLine(label: "Túl sok nap a héten", left: "1", right: "0", favours: 1),
                    NKCompareLine(label: "Szoros nap", left: "2", right: "3", favours: 0),
                    NKCompareLine(label: "Heti edzés", left: "4 + 2 röpi", right: "4 + 2 röpi"),
                    NKCompareLine(label: "Heti kalória", left: "17 920", right: "17 920"),
                    NKCompareLine(label: "Alvás a héten", left: "50 ó 40 p", right: "51 ó 25 p", favours: 1),
                    NKCompareLine(label: "Súlycél", left: "dec. 19.", right: "dec. 19."),
                ], hue: kapHue)
            }
            NKBare("Korábban áttettük", hue: kapHue, glyph: "repeat-deep", trailing: "és hogyan sült el") {
                NKRowList([
                    NKAreaRow(glyph: "dumbbell-ink", title: "Hátedzés: kedd → szerda", sub: "nov. 18. · két késő esti megbeszélés miatt",
                              value: "jól", valueSub: "megvolt", state: .done),
                    NKAreaRow(glyph: "moon-ink", title: "Lefekvés 23:30, reggeli edzés 8:00", sub: "nov. 13. · határidő miatt",
                              value: "félig", valueSub: "rövid edzés", state: .done),
                    NKAreaRow(glyph: "clock-ink", title: "Lábnap csütörtök → péntek", sub: "nov. 6. · nem tetted át",
                              value: "elmaradt", valueSub: "", state: .skipped, chips: ["Most nem"]),
                ], hue: kapHue)
            }
            NKBare("Ebből tanulok", hue: kapHue, glyph: "spark-deep", trailing: "11 mozgatásból") {
                NKList([
                    (title: "A sűrű csütörtökök", body: "Ha csütörtökön 4 óránál több a megbeszélés, az esti edzés 3 esetből 2-szer elmaradt. Ezért szólok most előre."),
                    (title: "A késő esti hívások", body: "21 óra utáni hívás után átlagosan 50 perccel kevesebbet alszol. A másnap reggeli edzést ilyenkor érdemes csúsztatni."),
                ], hue: kapHue)
            }
            NKActions([NKAction(glyph: "repeat-deep", title: "Kérek más javaslatot", primary: true, action: {}),
                       NKAction(glyph: "chat-ink", title: "Megbeszélem Boop-pal", action: {})], hue: kapHue)
        }
    }
}

// MARK: - Minden hatása: one proposal, every cross-effect

struct KapDetail: View {
    let back: @MainActor @Sendable () -> Void
    var body: some View {
        NKAreaSubPage(hue: kapHue, crumb: "Átrendezés", eyebrow: "Javaslat · edzés",
                      title: "Lábnap: csütörtök → szombat",
                      sentence: "Ennyi minden mozdul vele. Csak erre a hétre szól, az Évad terve marad.",
                      onBack: back) {
            NKBare("Mi változik", hue: kapHue, glyph: "link-deep", trailing: "most · utána") {
                NKCompareColumns(leftTitle: "Most", rightTitle: "Utána", lines: [
                    NKCompareLine(label: "Csütörtök terhe", left: "túl sok", right: "szoros", favours: 1),
                    NKCompareLine(label: "Szombat terhe", left: "laza", right: "rendben", favours: 0),
                    NKCompareLine(label: "Csütörtöki keret", left: "2 640 kcal", right: "2 350 kcal"),
                    NKCompareLine(label: "Szombati keret", left: "2 350 kcal", right: "2 640 kcal"),
                    NKCompareLine(label: "Pihenő a röpi előtt", left: "2 nap", right: "1 nap", favours: -1),
                    NKCompareLine(label: "Heti edzés", left: "4", right: "4"),
                    NKCompareLine(label: "Heti kalória", left: "17 920", right: "17 920"),
                    NKCompareLine(label: "Súlycél", left: "dec. 19.", right: "dec. 19."),
                ], hue: kapHue)
            }
            NKBare("Mire hat", hue: kapHue, glyph: "spark-cream") {
                NKList([
                    (title: "Edzés", body: "A blokk sorrendje: hát (P) → láb (Szo). A súlyok és ismétlések nem változnak."),
                    (title: "Étel", body: "A 290 kcal edzésnapi többlet szombatra kerül. A menüben a csütörtöki uzsonna szombatra vándorol, a bevásárlólista nem változik."),
                    (title: "Alvás", body: "Csütörtök este nem kell korán feküdnöd az edzés miatt: 22:30 helyett 23:00 is jó."),
                    (title: "Röplabda", body: "Vasárnap délelőtt egy nap pihenővel érkezel a lábnap után. Ez belefér, de a szombati vacsorába +30 g szénhidrát kerül."),
                    (title: "Évad", body: "Nem változik. A heti 4 edzés és a heti kalória ugyanannyi."),
                ], hue: kapHue)
            }
            NKBare("Miért javaslom", hue: kapHue, glyph: "bolt-ink") {
                NKList([
                    (title: "Amit a csütörtökön látok", body: "6 óra megbeszélés, ebből 9:00 és 13:00 között négy szünet nélkül. Szerdán 21:30-ig hívásod van, így várhatóan 6 órát alszol."),
                    (title: "Amit a múltból tudok", body: "Az utóbbi 3 hasonló csütörtökből 2-n elmaradt az esti edzés, egyszer pedig rövidebb lett."),
                    (title: "Amit a szombaton látok", body: "Üres a naptárad, és péntek este nincs semmi késői, így kipihenten érkezel."),
                ], hue: kapHue)
            }
            NKBare("Ha jóváhagyod, itt látod", hue: kapHue, glyph: "check-ink") {
                NKList([
                    (title: "Ma és a nap oldala", body: "Csütörtökön nem lesz edzés a napodon, szombaton ott lesz 10:00-kor."),
                    (title: "Edzés", body: "A heti napok között a lábnap szombatra kerül, a lejátszó szombaton kínálja fel."),
                    (title: "Étel", body: "A két nap kerete és menüje cserél."),
                ], hue: kapHue)
            }
            NKActions([NKAction(glyph: "check-deep", title: "Jóváhagyom", primary: true, action: back),
                       NKAction(title: "Most nem", action: back)], hue: kapHue)
        }
    }
}

// MARK: - A napod: the day page with the morning verdict, demand on the curve, what costs and what feeds

struct KapDayPage: View {
    let back: @MainActor @Sendable () -> Void
    @State private var sel: UUID?
    // the circadian template bent by the day: a deeper, earlier dip after the meeting block
    private let curve: [Double] = [0.30, 0.48, 0.62, 0.70, 0.66, 0.55, 0.42, 0.30, 0.26, 0.34, 0.46, 0.52, 0.47, 0.38, 0.30, 0.24, 0.20, 0.17, 0.15]
    var body: some View {
        NKAreaSubPage(hue: kapHue, crumb: "Ma", eyebrow: "A napod · csütörtök, nov. 27.",
                      title: "Szoros, de belefér",
                      sentence: "Délelőtt négy megbeszélés jön szünet nélkül, és rövid volt az éjszaka. *Délután 2 körül* leszel a legfáradtabb.",
                      onBack: back) {
            EnergyCurveCard(title: "Mai nap", trailing: "a terheddel számolva", predicted: curve, dots: [], now: 7.6,
                            hue: kapHue, selected: $sel, height: 160, events: [
                                EnergyCurveEvent(id: "m", hour: 9, glyph: "clock-ink", label: "4 megbeszélés", detail: "9:00–13:00, szünet nélkül"),
                                EnergyCurveEvent(id: "l", hour: 12.5, glyph: "bowl-sage", label: "ebéd"),
                                EnergyCurveEvent(id: "r", hour: 15, glyph: "clock-ink", label: "1:1", detail: "15:00–15:30"),
                                EnergyCurveEvent(id: "e", hour: 18, glyph: "dumbbell-ink", label: "lábnap"),
                            ])
            NKBare("Mennyit bírsz ma", hue: kapHue, glyph: "bolt-ink", trailing: "teher a bírásodhoz") {
                NKLevelBar(level: 0.94, hue: kapHue, ticks: [NKLevelTick(at: 0.9, label: "szoros"), NKLevelTick(at: 1.0, label: "határ")])
                Text("A mai terhed majdnem annyi, amennyit bírsz. Ha a lábnap marad, estére elfogysz.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            }
            NKBare("Mi visz el ma energiát", hue: kapHue, glyph: "clock-ink") {
                NKRowList([
                    NKAreaRow(glyph: "clock-ink", title: "Négy megbeszélés egymás után", sub: "9:00–13:00 · szellemi · szünet nélkül többe kerül",
                              value: "nagy", hot: true),
                    NKAreaRow(glyph: "dumbbell-ink", title: "Lábnap", sub: "18:00 · fizikai", value: "közepes"),
                    NKAreaRow(glyph: "person-sage", title: "1:1 Petrával", sub: "15:00 · emberek közt", value: "kicsi"),
                    NKAreaRow(glyph: "heart-cream", title: "Vacsora a családdal", sub: "19:30 · ez inkább feltölt", value: "tölt"),
                ], hue: kapHue)
            }
            NKBare("Amiből gazdálkodsz", hue: kapHue, glyph: "heart-cream") {
                NKRowList([
                    NKAreaRow(glyph: "moon-ink", title: "Alvás", sub: "6 ó 05 p · 50 perccel kevesebb a szokásosnál", value: "kevés"),
                    NKAreaRow(glyph: "heart-cream", title: "Pihenő pulzus", sub: "58 · 3-mal magasabb a szokásosnál", value: "kicsit fent"),
                    NKAreaRow(glyph: "dumbbell-ink", title: "Tegnapi edzés", sub: "pihenőnap volt", value: "jó"),
                    NKAreaRow(glyph: "bowl-sage", title: "Tegnapi evés", sub: "a keretben, elég fehérje", value: "jó"),
                    NKAreaRow(glyph: "spark-cream", title: "Reggeli bejelentkezés", sub: "energia 6 / 10 · fejtisztaság 5 / 10", value: "közepes"),
                ], hue: kapHue)
            }
            NKNote("Még tanulom, mennyit bírsz: 9 napnyi adatom van. Az esti „milyen volt a nap?” válaszaidból tudom meg, mennyire találtam el.", hue: kapHue)
            NKActions([NKAction(glyph: "repeat-deep", title: "Mit tennél át?", primary: true, action: {}),
                       NKAction(glyph: "chat-ink", title: "Kérdezem Boopot", action: {})], hue: kapHue)
        }
    }
}

// MARK: - The Ma wall card + the morning briefing line (shape only; the wall itself is the shipped one)

struct KapMaPreview: View {
    let openAtrendezes: @MainActor @Sendable () -> Void
    let openNap: @MainActor @Sendable () -> Void
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Ma · csütörtök").nkFont(34, design: .serif).foregroundStyle(.white).padding(.top, 70)
                NKMono("A REGGELI SOR")
                Button(action: openNap) {
                    HStack(spacing: 12) {
                        StillOrb(palette: kapHue.orb, size: 34, level: 0.94)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Szoros, de belefér").nkFont(17, .semibold).foregroundStyle(.white)
                            Text("rövid éjszaka · 4 megbeszélés délelőtt · lábnap este").nkFont(13).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(16).nkGlass(22)
                }.buttonStyle(.plain)
                NKMono("A MA FALON")
                NKHighlight(hue: kapHue, label: "Átrendezés",
                            text: "A csütörtök túl sok lenne. Négy dolgot tennék át a héten.",
                            sub: "Lábnap szombatra, később fekvés szerdán, a péntek délután és egy nagyobb ebéd.",
                            actions: [NKHighlightAction("Megnézem", action: openAtrendezes),
                                      NKHighlightAction("Most nem", weight: .secondary, action: {})])
                Text("A fal nem kap új kártyafajtát: ez a meglévő javaslatkártya, ami az Átrendezés oldalt nyitja.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.45))
            }
            .padding(.horizontal, 18)
        }
        .background(PaintedLandscape(hue: kapHue).ignoresSafeArea().opacity(0.6))
    }
}

// MARK: - Évad: the season's load against recovery, next week, what the moves taught

struct KapSeasonPage: View {
    private let load: [Double] = [0.55, 0.60, 0.64, 0.70, 0.78, 0.84, 0.88, 0.80, 0.82, 0.55, 0.80, 0.70]
    private let rest: [Double] = [0.70, 0.72, 0.70, 0.72, 0.70, 0.66, 0.62, 0.70, 0.72, 0.78, 0.72, 0.72]
    var body: some View {
        ZStack(alignment: .bottom) {
            NKAreaPage(hue: .forma, name: "Évad", eyebrow: "Őszi fogyás · 12 hétből a 7.", level: 7.0 / 12,
                       headline: "Jó úton vagy, de fáradsz",
                       sentence: "Az utóbbi három hétben a terhed gyorsabban nőtt, mint ahogy pihensz.",
                       glyph: "link-deep") {
                NKBare("Teher és pihenés", hue: .forma, glyph: "chart-deep", trailing: "hetente") {
                    KapLoadChart(load: load, rest: rest, now: 6)
                    Text("A teher az edzés és a naptárad együtt. A pihenés az alvásodból és a pulzusodból jön. A 7. hét után a terv, halványan.")
                        .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                }
                NKHighlight(hue: .forma, label: "Boop javaslata",
                            text: "Hozzuk előre a könnyebb hetet a 10.-ről a 8.-ra?",
                            sub: "A 8. héten amúgy is két késő esti határidőd van. A fogyás egy héttel később kezdődik újra, a célt dec. 26. körül éred el.",
                            actions: [NKHighlightAction("Megnézem a hatását", action: {}),
                                      NKHighlightAction("Most nem", weight: .secondary, action: {})])
                NKBare("A jövő heted", hue: .forma, glyph: "clock-ink", trailing: "nov. 24–30.") {
                    KapWeekStrip(days: kapWeek)
                    NKInfoRow("4 javaslatom van rá · Átrendezés", hue: .forma, action: {})
                }
                NKBare("Mennyit bírsz az évadban", hue: .forma, glyph: "bolt-ink") {
                    NKStatRow([NKStat(value: "2", label: "túl sok nap az elmúlt 4 hétben"),
                               NKStat(value: "11", label: "mozgatás az évadban", hot: true),
                               NKStat(value: "8", target: "11", label: "sült el jól")], hue: .forma)
                }
                NKBare("Amit a mozgatásokból tanultam", hue: .forma, glyph: "spark-cream") {
                    NKList([
                        (title: "A csütörtök a gyenge pontod", body: "Az évad 6 csütörtökéből 4 volt sűrű. A következő évadban a lábnapot eleve ne tegyük csütörtökre."),
                        (title: "A 4 edzés + 2 röpi most a határon van", body: "A sűrű heteken ebből rendre elmaradt egy. Ha a jövő hónap is ilyen, a következő évad heti 3 edzéssel reálisabb."),
                    ], hue: .forma)
                }
            }
            NKSpineBar(selected: .constant(1), onPlus: {})
        }
    }
}

/// Season weeks: load as bars, recovery as a line; the future (after `now`) faint.
struct KapLoadChart: View {
    let load: [Double], rest: [Double], now: Int
    var body: some View {
        VStack(spacing: 8) {
            GeometryReader { g in
                let w = g.size.width, h = g.size.height
                let step = w / CGFloat(load.count)
                ZStack(alignment: .bottomLeading) {
                    ForEach(load.indices, id: \.self) { i in
                        let over = load[i] > rest[i] && i <= now
                        RoundedRectangle(cornerRadius: 5)
                            .fill(over ? NK.under.opacity(0.8) : .white.opacity(i > now ? 0.14 : (i == now ? 0.7 : 0.4)))
                            .frame(width: step * 0.58, height: h * load[i])
                            .offset(x: step * CGFloat(i) + step * 0.21)
                    }
                    Path { p in
                        for i in rest.indices {
                            let pt = CGPoint(x: step * (CGFloat(i) + 0.5), y: h * (1 - rest[i]))
                            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                        }
                    }
                    .stroke(Hue.forma.glow, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                }
            }
            .frame(height: 120)
            HStack(spacing: 0) {
                ForEach(load.indices, id: \.self) { i in
                    Text("\(i + 1).").font(.nkNumber(10.5)).foregroundStyle(.white.opacity(i == now ? 1 : 0.45)).frame(maxWidth: .infinity)
                }
            }
            HStack(spacing: 14) {
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 3).fill(.white.opacity(0.5)).frame(width: 10, height: 10)
                    Text("teher").nkFont(11.5).foregroundStyle(.white.opacity(0.55)) }
                HStack(spacing: 6) { Rectangle().fill(Hue.forma.glow).frame(width: 14, height: 2)
                    Text("pihenés").nkFont(11.5).foregroundStyle(.white.opacity(0.55)) }
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 3).fill(NK.under.opacity(0.8)).frame(width: 10, height: 10)
                    Text("több, mint amit pihentél").nkFont(11.5).foregroundStyle(.white.opacity(0.55)) }
                Spacer(minLength: 0)
            }
        }
    }
}
#endif
