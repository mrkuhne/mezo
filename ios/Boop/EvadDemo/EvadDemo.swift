#if DEBUG
import SwiftUI
import BoopDesign

// THROWAWAY simulator spike for B6 "Évad" (mezo-r36n9.16). Not for main.
// Launch: -previewEvad YES  [-evadTab Évad|Menü|Lista|Hatás]  [-evadOpen modositas|kiserlet|szabalyok|uj|ures]
// Every number here is an invented fixture ("például"), never his data.

let evadHue: Hue = .forma

// MARK: - The toy consequence model (the real one is the server's goal engine, run as a draft)

@Observable final class EvadDraft {
    var sessions = Int(UserDefaults.standard.string(forKey: "evadSessions") ?? "") ?? 4   // gym sessions per week
    var sport: Set<Int> = [1, 3]   // weekday index 0 = hétfő: kedd + csütörtök röplabda
    var tempo = Double(UserDefaults.standard.string(forKey: "evadTempo") ?? "") ?? 0.4   // kg per week
    let weight = 84.1, target = 82.0
    let baseTdee = 2_590.0

    struct Out: Equatable {
        var trainDayKcal: Int, restDayKcal: Int, protein: Int, carbsTrain: Int
        var sleepMin: Int, bedtime: String, weeks: Int, endDate: String
        var verdict: String, verdictWarn: Bool, warn: String?
    }

    static func compute(sessions: Int, sport: Int, tempo: Double, weight: Double, target: Double, tdee: Double) -> Out {
        let eatAvg = (Double(sessions) * 290 + Double(sport) * 360) / 7
        let deficit = tempo * 7_700 / 7
        let avg = tdee + eatAvg - deficit
        let activeDays = Double(min(7, sessions + sport))
        let train = avg + 170 * (7 - activeDays) / 7
        let rest = activeDays >= 7 ? train : (avg * 7 - train * activeDays) / (7 - activeDays)
        let sleep = min(510, 450 + sessions * 6 + sport * 6)
        let bedMin = 6 * 60 + 30 - sleep - 15 + 24 * 60
        let weeks = Int(((weight - target) / tempo).rounded(.up))
        let end = Calendar.current.date(byAdding: .weekOfYear, value: weeks, to: Date())!
        let f = DateFormatter(); f.locale = Locale(identifier: "hu_HU"); f.dateFormat = "MMM d."
        let pct = tempo / weight * 100
        let verdict = pct < 0.55 ? "Reális" : (pct <= 0.9 ? "Határeset" : "Túl gyors")
        var guardLine: String?
        if pct > 0.6 && sessions >= 5 { guardLine = "Ennyi edzés mellett ez a hiány az erődet kockáztatja: a nagy gyakorlatokban várhatóan megáll a fejlődés." }
        else if pct > 0.9 { guardLine = "Ilyen tempónál izmot is veszítenél, nem csak zsírt." }
        return Out(trainDayKcal: Int((train / 10).rounded() * 10), restDayKcal: Int((rest / 10).rounded() * 10),
                   protein: Int((weight * 2.0 / 5).rounded() * 5), carbsTrain: Int(((train * 0.45) / 4 / 5).rounded() * 5),
                   sleepMin: sleep, bedtime: String(format: "%02d:%02d", (bedMin / 60) % 24, bedMin % 60),
                   weeks: weeks, endDate: f.string(from: end), verdict: verdict, verdictWarn: pct >= 0.55, warn: guardLine)
    }

    var now: Out { Self.compute(sessions: 4, sport: 2, tempo: 0.4, weight: weight, target: target, tdee: baseTdee) }
    var new: Out { Self.compute(sessions: sessions, sport: sport.count, tempo: tempo, weight: weight, target: target, tdee: baseTdee) }
    var changed: Bool { sessions != 4 || sport != [1, 3] || tempo != 0.4 }
}

func hm(_ m: Int) -> String { m % 60 == 0 ? "\(m / 60) ó" : "\(m / 60) ó \(m % 60) p" }
func kcal(_ k: Int) -> String {
    let f = NumberFormatter(); f.numberStyle = .decimal; f.locale = Locale(identifier: "hu_HU"); f.groupingSeparator = " "
    return f.string(from: NSNumber(value: k)) ?? "\(k)"
}

enum EvadPage: String, Identifiable { case modositas, kiserlet, szabalyok, uj; var id: String { rawValue } }

// MARK: - Root: the Terv place of the spine, renamed Évad

struct EvadDemoRoot: View {
    @State private var tab = UserDefaults.standard.string(forKey: "evadTab") ?? "Évad"
    @State private var page: EvadPage? = EvadPage(rawValue: UserDefaults.standard.string(forKey: "evadOpen") ?? "")
    @State private var empty = UserDefaults.standard.string(forKey: "evadOpen") == "ures"
    @State private var spine = 1
    @State private var draft = EvadDraft()

    var body: some View {
        ZStack(alignment: .bottom) {
            NK.ground.ignoresSafeArea()
            if empty { EvadEmpty(start: { page = .uj }) } else {
                EvadPageView(tab: $tab, open: { page = $0 })
            }
            NKSpineBar(selected: $spine, onPlus: {})
        }
        .environment(draft)
        .environment(\.nkInitialScrollY, UserDefaults.standard.object(forKey: "previewScroll") == nil
                     ? nil : CGFloat(UserDefaults.standard.double(forKey: "previewScroll")))
        .fullScreenCover(item: $page) { p in
            switch p {
            case .modositas: EvadWhatIf(close: { page = nil })
            case .kiserlet: EvadExperimentResult(close: { page = nil })
            case .szabalyok: EvadSettings(close: { page = nil })
            case .uj: EvadNewSeason(close: { page = nil })
            }
        }
        .environment(draft)
        .preferredColorScheme(.dark)
    }
}

struct EvadPageView: View {
    @Binding var tab: String
    let open: @MainActor @Sendable (EvadPage) -> Void
    @Environment(EvadDraft.self) private var draft

    var body: some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Őszi szálkásítás · 7. hét a 12-ből", level: 7.0 / 12,
                   headline: "Egy irányba húz minden",
                   sentence: "Az edzés, az étel és az alvás együtt viszi a súlyodat a cél felé: *−0,4 kg/hét*, ahogy terveztük.",
                   glyph: "link-deep",
                   actions: [NKAreaAction(glyph: "spark-cream", label: "Szabályok és beállítások", action: { open(.szabalyok) })]) {
            NKAreaTabs(tabs: [NKAreaTab("Évad"), NKAreaTab("Menü", dot: true), NKAreaTab("Lista", badge: 23),
                              NKAreaTab("Hatás", badge: 1)], hue: evadHue, selected: $tab)
                .padding(.horizontal, -18)
            switch tab {
            case "Menü": EvadMenuTab()
            case "Lista": EvadListTab()
            case "Hatás": EvadEffectTab(open: open)
            default: EvadOverview(open: open)
            }
        }
    }
}

// MARK: - Évad tab: the system, the course, the four pillars, how it is going, what Boop learned

struct EvadOverview: View {
    let open: @MainActor @Sendable (EvadPage) -> Void
    @Environment(EvadDraft.self) private var draft

    var body: some View {
        let o = draft.now
        NKBare("Összefüggések", hue: evadHue, glyph: "link-deep", trailing: "érintsd meg") {
            EvadSystemMap(out: o)
        }
        NKBare("A súlyod útja", hue: evadHue, glyph: "scale-ink", trailing: "12 hét") {
            NKCurve(values: [86.9, 86.4, 86.2, 85.6, 85.3, 84.8, 84.4, 84.1, 83.7, 83.3, 82.9, 82.5, 82.1].map { $0 - 81 },
                    labels: ["1.", "", "", "", "", "", "7.", "", "", "", "", "", "12."],
                    hue: evadHue, target: 1, nowIndex: 7, height: 140, planAfterNow: true)
            NKStatRow([NKStat(value: "84,1", unit: "kg", label: "a trend most", trend: -1, hot: true),
                       NKStat(value: "82", unit: "kg", label: "a cél"),
                       NKStat(value: "−0,4", unit: "kg/hét", label: "tempó · \(o.verdict.lowercased())")], hue: evadHue)
        }
        NKBare("A négy pillér", hue: evadHue, glyph: "star-ink") {
            NKRowList([
                NKAreaRow(glyph: "dumbbell-ink", title: "Edzés · V-forma és kar", sub: "4 edzés hetente, a 4. hét a 6-ból · röplabda kedd, csütörtök",
                          value: "3/4", valueSub: "ezen a héten"),
                NKAreaRow(glyph: "bowl-sage", title: "Étel · \(kcal(o.trainDayKcal)) / \(kcal(o.restDayKcal)) kcal",
                          sub: "edzésnap / pihenőnap · \(o.protein) g fehérje · csak NOVA 1–2", value: "24", valueSub: "recept"),
                NKAreaRow(glyph: "moon-ink", title: "Alvás · \(hm(o.sleepMin))", sub: "lefekvés \(o.bedtime) körül, a 6:30-as keléshez",
                          value: "7 ó 20 p", valueSub: "átlag"),
                NKAreaRow(glyph: "scale-ink", title: "Súly · 82 kg, \(o.endDate)", sub: "cél: fogyás, közben az erő megtartása",
                          value: "−3,8", valueSub: "kg eddig"),
            ], hue: evadHue)
        }
        NKBare("Ahogy tartod", hue: evadHue, glyph: "check-ink", trailing: "elmúlt 7 nap") {
            NKStatRow([NKStat(value: "5", target: "7", label: "nap a kereten belül"),
                       NKStat(value: "3", target: "4", label: "edzés megvolt"),
                       NKStat(value: "4", target: "7", label: "éjszaka 7,5 ó fölött")], hue: evadHue)
            Text("A kímélő napok és a kihagyott napok indokkal nem számítanak bele. Ez nem pontszám, csak ami történt.")
                .nkFont(13).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
        }
        NKBare("Amit Boop tanult", hue: evadHue, glyph: "spark-cream") {
            NKList([
                (title: "A valódi energiaigényed", body: "A terv napi 2 650 kcal égetéssel számolt; a mérleged és az étkezéseid szerint inkább 2 580 körül vagy. Hétfőn ehhez igazítom a keretet — a módosítást megmutatom, mielőtt érvényes lesz."),
                (title: "A rövid éjszakák lassítanak", body: "A 7 óránál rövidebb éjszakák utáni napokon átlagosan 280 kcal-lal többet ettél. Az alvás itt a fogyás része."),
                (title: "Erre figyelek", body: "A mellizom heti munkája a sáv alján van. Ha a kalória tovább csökken, itt állhat meg először a fejlődés."),
            ], hue: evadHue)
        }
        NKBare("Ami jön", hue: evadHue, glyph: "clock-ink") {
            NKRowList([
                NKAreaRow(glyph: "repeat-deep", title: "10. hét · könnyítő hét", sub: "a blokk könnyít, ezért arra a hétre szinten tartó étel: +350 kcal naponta",
                          state: .future, chips: ["Boop javasolja"]),
                NKAreaRow(glyph: "star-ink", title: "12. hét · az évad vége", sub: "összefoglaló: mi működött, mi nem, és javaslat a következő évadra",
                          state: .future),
            ], hue: evadHue)
        }
        NKActions([NKAction(glyph: "pen-sun", title: "Módosítom", primary: true, action: { open(.modositas) }),
                   NKAction(glyph: "plus-ink", title: "Új évad", action: { open(.uj) }),
                   NKAction(glyph: "chart-deep", title: "Korábbi évadok", action: {})], hue: evadHue)
    }
}

/// The hero: four orbs, the links between them, each link saying what flows along it. A tap lights one pillar.
struct EvadSystemMap: View {
    let out: EvadDraft.Out
    @State private var lit: Int? = Int(UserDefaults.standard.string(forKey: "evadLit") ?? "")
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // 0 Edzés (top) · 1 Étel (left) · 2 Alvás (right) · 3 Súly (bottom)
    private let hues: [Hue] = [.mozgas, .fuel, .alvas, .forma]
    private let names = ["Edzés", "Étel", "Alvás", "Súly"]
    private var values: [String] { ["4 + 2 sport", "\(kcal(out.trainDayKcal)) kcal", hm(out.sleepMin), "84,1 → 82"] }
    private struct Link { let a: Int, b: Int, text: String }
    private var links: [Link] {
        [Link(a: 0, b: 1, text: "+290 kcal edzésnapon"), Link(a: 0, b: 2, text: "több alvás kell"),
         Link(a: 1, b: 3, text: "−0,4 kg/hét"), Link(a: 2, b: 3, text: "rövid éjjel: több evés"),
         Link(a: 1, b: 0, text: "szénhidrát a teljesítményhez"), Link(a: 2, b: 0, text: "regeneráció")]
    }
    private func pos(_ i: Int, _ s: CGSize) -> CGPoint {
        [CGPoint(x: s.width / 2, y: 44), CGPoint(x: 58, y: s.height / 2),
         CGPoint(x: s.width - 58, y: s.height / 2), CGPoint(x: s.width / 2, y: s.height - 54)][i]
    }
    private var detail: String {
        switch lit {
        case 0: "A heti 4 edzés és a 2 röplabda adja a kalóriád nagyját: edzésnapon \(kcal(out.trainDayKcal)), pihenőnapon \(kcal(out.restDayKcal)) kcal. Több edzés több ételt és több alvást kér."
        case 1: "Az étel viszi a súlyt: napi átlag 550 kcal hiány a −0,4 kg/héthez. A szénhidrát az edzésnapokra kerül, hogy legyen erőd."
        case 2: "\(hm(out.sleepMin)) kell ehhez a terheléshez. A rövid éjszakák után többet eszel és gyengébben edzel — itt dől el a hét."
        case 3: "A súly a másik három eredménye. Ha lassabban megy, Boop előbb az alvást és a tervhűséget nézi, csak utána a kalóriát."
        default: "Egy pillér a többit mozgatja. Érintsd meg bármelyiket, és megmutatom, mi függ tőle."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            TimelineView(.animation(paused: reduceMotion)) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                Canvas { ctx, s in
                    for (k, l) in links.enumerated() {
                        let p = pos(l.a, s), q = pos(l.b, s)
                        let bend: CGFloat = l.a > l.b ? -22 : 22
                        let mid = CGPoint(x: (p.x + q.x) / 2 + (q.y - p.y) / 260 * bend, y: (p.y + q.y) / 2 - (q.x - p.x) / 260 * bend)
                        var path = Path(); path.move(to: p); path.addQuadCurve(to: q, control: mid)
                        let on = lit == nil || lit == l.a || lit == l.b
                        ctx.stroke(path, with: .color(.white.opacity(on ? 0.28 : 0.07)), style: StrokeStyle(lineWidth: 1.2, dash: [3, 4]))
                        guard on else { continue }
                        // a light running from cause to effect
                        let u = CGFloat((t * 0.35 + Double(k) * 0.37).truncatingRemainder(dividingBy: 1))
                        let x = (1 - u) * (1 - u) * p.x + 2 * (1 - u) * u * mid.x + u * u * q.x
                        let y = (1 - u) * (1 - u) * p.y + 2 * (1 - u) * u * mid.y + u * u * q.y
                        ctx.fill(Path(ellipseIn: CGRect(x: x - 3, y: y - 3, width: 6, height: 6)), with: .color(hues[l.a].glow))
                    }
                }
            }
            .frame(height: 300)
            .overlay {
                GeometryReader { g in
                    ForEach(0..<4, id: \.self) { i in
                        let p = pos(i, g.size)
                        Button { withAnimation(.spring(response: 0.35)) { lit = lit == i ? nil : i } } label: {
                            VStack(spacing: 5) {
                                StillOrb(palette: hues[i].orb, size: lit == i ? 62 : 52, level: 0.75)
                                    .shadow(color: hues[i].glow.opacity(lit == i ? 0.9 : 0.45), radius: lit == i ? 22 : 12)
                                Text(names[i]).nkFont(13, .semibold).foregroundStyle(.white)
                                Text(values[i]).font(.nkNumber(14)).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
                            }
                            .opacity(lit == nil || lit == i ? 1 : 0.45)
                        }
                        .buttonStyle(.plain)
                        .position(x: p.x, y: p.y + 14)
                    }
                }
            }
            NKHueText(detail, hue: evadHue, size: 15, serif: true)
                .fixedSize(horizontal: false, vertical: true)
                .animation(.easeInOut, value: lit)
            // what flows along each link of the lit pillar, cause → effect
            if let lit {
                VStack(spacing: 0) {
                    ForEach(Array(links.enumerated()).filter { $0.element.a == lit || $0.element.b == lit }, id: \.offset) { _, l in
                        HStack(spacing: 10) {
                            Circle().fill(hues[l.a].glow).frame(width: 8, height: 8)
                            Text("\(names[l.a]) → \(names[l.b])").nkFont(13, .medium).foregroundStyle(.white.opacity(0.6))
                                .frame(width: 118, alignment: .leading)
                            Text(l.text).nkFont(14).foregroundStyle(.white)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 8)
                    }
                }
                .transition(.opacity)
            }
        }
    }
}

// MARK: - Menü tab: next week's menu, built from the allowed recipes and each day's own budget

struct EvadMenuTab: View {
    private struct Day { let name: String, kind: String, kcal: Int, meals: [(String, String, Int)] }
    private let days: [Day] = [
        Day(name: "Hétfő", kind: "edzésnap", kcal: 2_440, meals: [("Reggeli", "Zabkása, laktózmentes joghurt, áfonya", 600), ("Ebéd", "Csirkés rizstál brokkolival", 760), ("Uzsonna", "Túró, alma", 300), ("Vacsora", "Lazac, édesburgonya, saláta", 780)]),
        Day(name: "Kedd", kind: "röplabda", kcal: 2_440, meals: [("Reggeli", "Tojásrántotta, teljes kiőrlésű pirítós", 560), ("Ebéd", "Pulykás wok zöldségekkel", 780), ("Röplabda előtt", "Banán, rizskeksz", 300), ("Vacsora", "Marhagulyás leves, kenyér", 800)]),
        Day(name: "Szerda", kind: "pihenőnap", kcal: 2_270, meals: [("Reggeli", "Zabkása, laktózmentes joghurt, áfonya", 560), ("Ebéd", "Lencsefőzelék, főtt tojás", 700), ("Uzsonna", "Túró, alma", 300), ("Vacsora", "Csirkemell, sült zöldség", 710)]),
    ]
    var body: some View {
        NKHighlight(hue: evadHue, label: "Jövő hét · nov. 24–30.",
                    text: "Kész a heti menü a 24 engedett receptedből: edzésnapon több, a szerdai pihenőnapon kevesebb.",
                    sub: "Cserélhetsz bármit; csak a jóváhagyásod után lesz belőle bevásárlólista.",
                    actions: [NKHighlightAction("Jóváhagyom", action: {}), NKHighlightAction("Átnézem", weight: .secondary, action: {})])
        ForEach(days, id: \.name) { d in
            NKBare("\(d.name) · \(d.kind)", hue: evadHue, glyph: d.kind == "pihenőnap" ? "moon-ink" : d.kind == "röplabda" ? "ball-sun" : "dumbbell-ink",
                   trailing: "\(kcal(d.kcal)) kcal") {
                NKRowList(d.meals.map { m in
                    NKAreaRow(id: d.name + m.0, glyph: "bowl-sage", title: m.1, sub: m.0, value: "\(m.2)", valueSub: "kcal", action: {})
                }, hue: evadHue)
            }
        }
        Text("+ csütörtöktől vasárnapig még 4 nap").nkFont(13).foregroundStyle(.white.opacity(0.5))
        NKActions([NKAction(glyph: "repeat-deep", title: "Újratervezem", action: {}),
                   NKAction(glyph: "book-sage", title: "Engedett receptek", action: {})], hue: evadHue)
    }
}

// MARK: - Lista tab: the shopping list from the accepted menu, plus staples only on his tap

struct EvadListTab: View {
    @State private var got: Set<String> = ["Brokkoli", "Zabpehely"]
    @State private var staplesAdded: Set<String> = []
    private let groups: [(String, String, [(String, String, String)])] = [
        ("Zöldség, gyümölcs", "leaf-sage", [("Brokkoli", "2 fej", "Csirkés rizstál, Wok"), ("Édesburgonya", "1 kg", "Lazac"), ("Áfonya", "3 doboz", "Zabkása ×4"), ("Alma", "6 db", "Uzsonna")]),
        ("Hús, hal", "fish-peach", [("Csirkemell", "1,4 kg", "Rizstál, Vacsora ×2"), ("Lazacfilé", "2 × 250 g", "Hétfő, péntek"), ("Darált pulyka", "600 g", "Wok")]),
        ("Tejtermék", "drop-sky", [("Laktózmentes joghurt", "4 × 400 g", "Zabkása"), ("Túró", "3 × 250 g", "Uzsonna")]),
        ("Kamra", "plate-deep", [("Zabpehely", "1 kg", "Zabkása ×4"), ("Basmati rizs", "1 kg", "Rizstál, Wok"), ("Vörös lencse", "500 g", "Főzelék")]),
    ]
    var body: some View {
        NKBare("Bevásárlólista · nov. 24–30.", hue: evadHue, glyph: "check-ink", trailing: "\(got.count) / 12 megvan") {
            Text("A jóváhagyott heti menüből: ugyanaz a hozzávaló egy sorban, mellette, hogy mihez kell.")
                .nkFont(13).foregroundStyle(.white.opacity(0.55))
        }
        ForEach(groups, id: \.0) { g in
            NKBare(g.0, hue: evadHue, glyph: g.1) {
                VStack(spacing: 0) {
                    ForEach(g.2, id: \.0) { item in
                        let on = got.contains(item.0)
                        Button { if on { got.remove(item.0) } else { got.insert(item.0) } } label: {
                            HStack(spacing: 12) {
                                Circle().stroke(.white.opacity(on ? 0 : 0.4), lineWidth: 1.5)
                                    .background(Circle().fill(on ? evadHue.glow : .clear))
                                    .overlay { if on { Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(NK.ground) } }
                                    .frame(width: 22, height: 22)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.0).nkFont(15.5, .medium).foregroundStyle(.white.opacity(on ? 0.45 : 1)).strikethrough(on)
                                    Text(item.2).nkFont(12).foregroundStyle(.white.opacity(0.45))
                                }
                                Spacer()
                                Text(item.1).font(.nkNumber(15)).foregroundStyle(.white.opacity(on ? 0.4 : 0.8))
                            }
                            .padding(.vertical, 10).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        NKBare("Alapdolgok", hue: evadHue, glyph: "star-ink", trailing: "csak ha hozzáadod") {
            NKFlowRow {
                ForEach(["Olívaolaj", "Kávé", "Tojás", "Só", "Fűszerpaprika", "Citrom"], id: \.self) { s in
                    let on = staplesAdded.contains(s)
                    Button { if on { staplesAdded.remove(s) } else { staplesAdded.insert(s) } } label: {
                        Text(on ? "\(s) ✓" : "+ \(s)").nkFont(13.5, on ? .semibold : .regular)
                            .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                            .padding(.horizontal, 13).padding(.vertical, 8)
                            .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.1)))
                    }.buttonStyle(.plain)
                }
            }
        }
        NKActions([NKAction(glyph: "chat-ink", title: "Megosztom szövegként", primary: true, action: {}),
                   NKAction(glyph: "repeat-deep", title: "Előző listák", action: {})], hue: evadHue)
    }
}

// MARK: - Hatás tab: experiments he starts (or Boop proposes), one at a time, honest results

struct EvadEffectTab: View {
    let open: @MainActor @Sendable (EvadPage) -> Void
    var body: some View {
        NKHighlight(hue: evadHue, label: "Boop javasolja",
                    text: "Hétfő óta eszel esti magnéziumot. Megnézzük két hétig, hat-e az alvásodra?",
                    sub: "Alvás, mély alvás, pulzusváltozékonyság és a reggeli közérzeted — az előző két héttel összevetve.",
                    actions: [NKHighlightAction("Indítsuk", action: {}), NKHighlightAction("Most nem", weight: .secondary, action: {})])
        NKBare("Fut", hue: evadHue, glyph: "clock-ink", trailing: "egyszerre egy") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Este 21 után nincs képernyő").nkFont(19, design: .serif).foregroundStyle(.white)
                    Spacer()
                    Text("9 / 14 nap").font(.nkNumber(16)).foregroundStyle(evadHue.glow)
                }
                NKLevelBar(level: 9.0 / 14, hue: evadHue)
                Text("Figyelt jelek: elalvás ideje, alvás hossza, pulzusváltozékonyság. Eddig 8 napot jelöltél be; az eredményhez legalább 10 kell.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                NKTag("Közben új edzésblokk indult — ezt az eredménynél jelzem", warn: true)
            }
        }
        NKBare("Lezárt kísérletek", hue: evadHue, glyph: "chart-deep") {
            NKRowList([
                NKAreaRow(glyph: "shoe-cream", title: "Reggeli séta", sub: "14 nap · alvás: hosszabb, mint a szokásos ingadozásod",
                          value: "+22 p", valueSub: "alvás", hot: true, chips: ["Beépítve az évadba"], action: { open(.kiserlet) }),
                NKAreaRow(glyph: "bowl-sage", title: "Késő esti szénhidrát", sub: "14 nap · nem látszik egyértelmű különbség",
                          value: "–", valueSub: "", action: {}),
                NKAreaRow(glyph: "drop-sky", title: "Napi 3 liter víz", sub: "10 nap · túl kevés bejelölt nap, nem értékelhető",
                          value: "–", valueSub: "", state: .skipped, action: {}),
            ], hue: evadHue)
        }
        NKActions([NKAction(glyph: "plus-ink", title: "Új kísérlet", primary: true, action: {})], hue: evadHue)
    }
}

// MARK: - Módosítás: the live consequence preview

struct EvadWhatIf: View {
    let close: @MainActor @Sendable () -> Void
    @Environment(EvadDraft.self) private var draft
    private let weekdays = ["H", "K", "Sz", "Cs", "P", "Sz", "V"]

    var body: some View {
        @Bindable var d = draft
        let a = draft.now, b = draft.new
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Módosítás", title: "Mi lenne, ha…",
                      sentence: "Állíts bármit: Boop *azonnal* kiszámolja, mit mozdít a többin. Semmi nem változik, amíg el nem fogadod.",
                      onBack: close) {
            NKBare("Amit állítasz", hue: evadHue, glyph: "pen-sun") {
                VStack(spacing: 18) {
                    stepper("Edzés hetente", value: "\(d.sessions)", minus: { d.sessions = max(2, d.sessions - 1) }, plus: { d.sessions = min(6, d.sessions + 1) })
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Sportnapok").nkFont(15).foregroundStyle(.white.opacity(0.85))
                        HStack(spacing: 6) {
                            ForEach(0..<7, id: \.self) { i in
                                let on = d.sport.contains(i)
                                Button { if on { d.sport.remove(i) } else { d.sport.insert(i) } } label: {
                                    Text(weekdays[i]).nkFont(13.5, on ? .semibold : .regular)
                                        .foregroundStyle(on ? NK.ground : .white.opacity(0.8))
                                        .frame(maxWidth: .infinity).frame(height: 36)
                                        .background(Capsule().fill(on ? Hue.mozgas.glow : .white.opacity(0.08)))
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Fogyás tempója").nkFont(15).foregroundStyle(.white.opacity(0.85))
                            Spacer()
                            Text(String(format: "−%.2f kg/hét", d.tempo).replacingOccurrences(of: ".", with: ","))
                                .font(.nkNumber(18)).foregroundStyle(.white)
                        }
                        Slider(value: $d.tempo, in: 0.2...0.9, step: 0.05).tint(evadHue.glow)
                    }
                }
            }
            NKBare("Ami ezzel jár", hue: evadHue, glyph: "link-deep", trailing: draft.changed ? "élőben számolva" : "még nem változtattál") {
                NKCompareColumns(leftTitle: "Most", rightTitle: "Így lenne", lines: [
                    NKCompareLine(label: "Edzésnap", left: "\(kcal(a.trainDayKcal)) kcal", right: "\(kcal(b.trainDayKcal)) kcal", favours: b.trainDayKcal != a.trainDayKcal ? 1 : 0),
                    NKCompareLine(label: "Pihenőnap", left: "\(kcal(a.restDayKcal)) kcal", right: "\(kcal(b.restDayKcal)) kcal", favours: b.restDayKcal != a.restDayKcal ? 1 : 0),
                    NKCompareLine(label: "Szénhidrát edzésnapon", left: "\(a.carbsTrain) g", right: "\(b.carbsTrain) g", favours: b.carbsTrain != a.carbsTrain ? 1 : 0),
                    NKCompareLine(label: "Alvás-cél", left: hm(a.sleepMin), right: hm(b.sleepMin), favours: b.sleepMin != a.sleepMin ? 1 : 0),
                    NKCompareLine(label: "Lefekvés", left: a.bedtime, right: b.bedtime, favours: b.bedtime != a.bedtime ? 1 : 0),
                    NKCompareLine(label: "Cél elérése", left: a.endDate, right: b.endDate, favours: b.weeks != a.weeks ? 1 : 0),
                    NKCompareLine(label: "Tempó", left: a.verdict, right: b.verdict, favours: b.verdict != a.verdict ? 1 : 0),
                ], hue: evadHue)
                if let g = b.warn {
                    HStack(alignment: .top, spacing: 10) {
                        NKGlyph("bolt-ink", NK.under, size: 16)
                        Text(g).nkFont(13.5).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 16).fill(NK.under.opacity(0.12)))
                }
            }
            if draft.changed {
                NKBare("Amit neked kell változtatnod", hue: evadHue, glyph: "check-ink") {
                    NKList(todo(a, b), hue: evadHue)
                }
            }
            NKActions([NKAction(glyph: "check-deep", title: "Elfogadom", primary: true, action: close),
                       NKAction(title: "Mégsem", action: { d.sessions = 4; d.sport = [1, 3]; d.tempo = 0.4; close() })], hue: evadHue)
        }
        .animation(.easeInOut(duration: 0.25), value: b)
    }

    private func todo(_ a: EvadDraft.Out, _ b: EvadDraft.Out) -> [(title: String, body: String)] {
        var out: [(title: String, body: String)] = []
        if b.trainDayKcal > a.trainDayKcal + 40 { out.append(("Több étel edzésnapon", "A heti menübe edzésnapokra bekerül egy uzsonna (kb. +\(b.trainDayKcal - a.trainDayKcal) kcal). A bevásárlólista ehhez igazodik.")) }
        if b.trainDayKcal < a.trainDayKcal - 40 { out.append(("Kisebb adagok", "Az edzésnapi adagok kb. \(a.trainDayKcal - b.trainDayKcal) kcal-lal kisebbek lesznek a menüben.")) }
        if b.sleepMin > a.sleepMin { out.append(("Korábbi lefekvés", "\(b.bedtime) körül ágyban — a lefekvés-emlékeztető ehhez igazodik.")) }
        if draft.sessions != 4 { out.append(("Az edzésblokk", "A blokkot \(draft.sessions) napra kell átrendezni. Az Edzés → Blokk megnyitja a javaslatot, te hagyod jóvá.")) }
        if b.weeks != a.weeks { out.append(("Az évad hossza", "Az évad \(b.weeks > a.weeks ? "meghosszabbodik" : "rövidül"): a cél \(b.endDate) körül.")) }
        if draft.sport != [1, 3] { out.append(("Sportnapok", "A sportnapok reggelén több szénhidrát kerül a menübe, a pihenőnapok áttolódnak.")) }
        return out
    }

    private func stepper(_ label: String, value: String, minus: @escaping () -> Void, plus: @escaping () -> Void) -> some View {
        HStack {
            Text(label).nkFont(15).foregroundStyle(.white.opacity(0.85))
            Spacer()
            Button(action: minus) { Image(systemName: "minus").frame(width: 38, height: 38) }
                .buttonStyle(.plain).foregroundStyle(.white).background(Circle().fill(.white.opacity(0.1)))
            Text(value).font(.nkNumber(24)).foregroundStyle(.white).frame(width: 40)
            Button(action: plus) { Image(systemName: "plus").frame(width: 38, height: 38) }
                .buttonStyle(.plain).foregroundStyle(.white).background(Circle().fill(.white.opacity(0.1)))
        }
    }
}

// MARK: - One finished experiment

struct EvadExperimentResult: View {
    let close: @MainActor @Sendable () -> Void
    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Hatás", eyebrow: "Kísérlet · 14 nap", title: "Reggeli séta",
                      sentence: "Az alvásod *hosszabb lett*, és ez nagyobb, mint a szokásos napi ingadozásod.", onBack: close) {
            NKBare("Előtte és utána", hue: evadHue, glyph: "chart-deep", trailing: "14 nap · 14 nap") {
                NKCompareColumns(leftTitle: "Előtte", rightTitle: "Séta mellett", lines: [
                    NKCompareLine(label: "Alvás", left: "6 ó 50 p", right: "7 ó 12 p", favours: 1),
                    NKCompareLine(label: "Mély alvás", left: "58 p", right: "71 p", favours: 1),
                    NKCompareLine(label: "Pulzusvált.", left: "41 ms", right: "43 ms"),
                    NKCompareLine(label: "Nyugalmi pulzus", left: "54", right: "53"),
                    NKCompareLine(label: "Reggeli közérzet", left: "6,1", right: "6,8", favours: 1),
                ], hue: evadHue)
            }
            NKBare("Mit jelent", hue: evadHue, glyph: "spark-cream") {
                NKList([
                    (title: "Ami biztosan látszik", body: "Az alvás hossza és a mély alvás kiemelt sorai túllépik a szokásos napi ingadozásodat."),
                    (title: "Ami belefér az ingadozásba", body: "A pulzusváltozékonyság és a nyugalmi pulzus változása ennyi napból nem különböztethető meg a véletlentől."),
                    (title: "Mire figyelj", body: "Ez egy mintázat a te napjaidból, nem bizonyíték. A két hét alatt más nem változott (nem volt új blokk, betegség, utazás)."),
                ], hue: evadHue)
            }
            NKActions([NKAction(glyph: "check-deep", title: "Beépítem az évadba", primary: true, action: close),
                       NKAction(glyph: "repeat-deep", title: "Megismétlem", action: {})], hue: evadHue)
        }
    }
}

// MARK: - Rules and settings

struct EvadSettings: View {
    let close: @MainActor @Sendable () -> Void
    @State private var nova = true
    @State private var learned = true
    @State private var deloadMaintain = true
    @State private var proposeExp = true
    @State private var sundayMenu = true
    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Szabályok és beállítások", title: "Ahogy működik",
                      sentence: "Minden szabály, amihez Boop *mindenhol* tartja magát: a beszélgetésben, a reggeli összefoglalóban, az étkezések értékelésében.",
                      onBack: close) {
            NKBare("Étel", hue: evadHue, glyph: "bowl-sage") {
                toggle("Csak feldolgozatlan étel (NOVA 1–2)", $nova)
                NKRowList([
                    NKAreaRow(glyph: "book-sage", title: "Engedett receptek", sub: "a menü csak ezekből épül", value: "24 / 53", action: {}),
                    NKAreaRow(glyph: "plate-deep", title: "Napi ritmus", sub: "3 étkezés + 2 uzsonna", action: {}),
                    NKAreaRow(glyph: "leaf-sage", title: "Érzékenységek", sub: "laktóz: intolerancia", action: {}),
                ], hue: evadHue)
                toggle("Vasárnap este elkészíti a jövő heti menüt", $sundayMenu)
            }
            NKBare("Edzés", hue: evadHue, glyph: "dumbbell-ink") {
                NKRowList([
                    NKAreaRow(glyph: "clock-ink", title: "Blokk · V-forma és kar", sub: "6 hét, az évad 4–9. hete", action: {}),
                    NKAreaRow(glyph: "ball-sun", title: "Röplabda", sub: "kedd, csütörtök · 90 perc", action: {}),
                ], hue: evadHue)
                toggle("Könnyítő héten szinten tartó étel", $deloadMaintain)
            }
            NKBare("Alvás és súly", hue: evadHue, glyph: "moon-ink") {
                NKRowList([
                    NKAreaRow(glyph: "moon-ink", title: "Alvás-cél", sub: "az edzésterhelésből számolva · 8 ó 6 p", action: {}),
                    NKAreaRow(glyph: "scale-ink", title: "Súlycél", sub: "82 kg · −0,4 kg/hét", action: {}),
                ], hue: evadHue)
                toggle("A megtanult energiaigényt használja", $learned)
            }
            NKBare("Boop", hue: evadHue, glyph: "chat-ink") {
                toggle("Javasolhat kísérletet, ha valami újat lát", $proposeExp)
            }
        }
    }
    private func toggle(_ t: String, _ b: Binding<Bool>) -> some View {
        Toggle(isOn: b) { Text(t).nkFont(15).foregroundStyle(.white.opacity(0.9)) }.tint(evadHue.glow).padding(.vertical, 4)
    }
}

// MARK: - New season

struct EvadNewSeason: View {
    let close: @MainActor @Sendable () -> Void
    @State private var goal = "Fogyás"
    var body: some View {
        NKAreaSubPage(hue: evadHue, crumb: "Évad", eyebrow: "Új évad", title: "Mi legyen a következő?",
                      sentence: "Az eddigi súlycélodból és a futó blokkodból *már összeraktam* egy javaslatot — csak ellenőrizd.",
                      onBack: close) {
            step(1, "A cél", done: true) {
                HStack(spacing: 6) {
                    ForEach(["Fogyás", "Szinten tartás", "Tömegnövelés"], id: \.self) { g in
                        Button { goal = g } label: {
                            Text(g).nkFont(13.5, goal == g ? .semibold : .regular).foregroundStyle(goal == g ? NK.ground : .white.opacity(0.85))
                                .padding(.horizontal, 12).padding(.vertical, 8)
                                .background(Capsule().fill(goal == g ? .white.opacity(0.92) : .white.opacity(0.1)))
                        }.buttonStyle(.plain)
                    }
                }
                Text("84,1 kg → 80 kg · 12 hét · −0,4 kg/hét · reális").font(.nkNumber(15)).foregroundStyle(.white.opacity(0.75))
            }
            step(2, "Az edzés", done: true) {
                Text("V-forma és kar · 6 hetes blokk, heti 4 edzés · röplabda kedd, csütörtök").nkFont(14).foregroundStyle(.white.opacity(0.75))
                Text("Edzésblokk csak évadhoz indul: a blokk az évad része, a hossza az évadhoz igazodik.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
            step(3, "Az étel", done: false) {
                Text("Napi keret az edzésnapokhoz igazítva · 24 engedett recept · csak NOVA 1–2 · laktózmentes").nkFont(14).foregroundStyle(.white.opacity(0.75))
            }
            step(4, "Az alvás", done: false) {
                Text("A terhelésből: 8 ó 6 p · lefekvés 22:10 körül").nkFont(14).foregroundStyle(.white.opacity(0.75))
            }
            step(5, "Mit jelent ez", done: false) {
                Text("Edzésnap 2 440 kcal, pihenőnap 2 270 kcal, 170 g fehérje. A cél február közepe körül.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75))
            }
            NKActions([NKAction(glyph: "check-deep", title: "Indítom az évadot", primary: true, action: close),
                       NKAction(title: "Később", action: close)], hue: evadHue)
        }
    }
    private func step(_ n: Int, _ title: String, done: Bool, @ViewBuilder _ body: () -> some View) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(done ? evadHue.glow : .white.opacity(0.1)).frame(width: 30, height: 30)
                Text("\(n)").font(.nkNumber(16)).foregroundStyle(done ? NK.ground : .white)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(title).nkFont(18, design: .serif).foregroundStyle(.white)
                body()
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - No season yet

struct EvadEmpty: View {
    let start: @MainActor @Sendable () -> Void
    var body: some View {
        NKAreaPage(hue: evadHue, name: "Évad", eyebrow: "Még nincs évadod", level: nil,
                   headline: "Kezdjük egy évaddal",
                   sentence: "Egy évad *hetekre szól*: cél, edzésblokk, étel és alvás egyben, és minden a többihez igazodik.",
                   glyph: "link-deep") {
            NKNote("Az eddigi súlycélodból és a futó edzésblokkodból már összeraktam egy első javaslatot. Semmi nem indul el, amíg jóvá nem hagyod.", hue: evadHue)
            NKActions([NKAction(glyph: "plus-ink", title: "Megnézem a javaslatot", primary: true, action: start)], hue: evadHue)
        }
    }
}
#endif
