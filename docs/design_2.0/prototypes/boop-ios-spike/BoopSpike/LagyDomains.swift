import SwiftUI
import Charts

// MARK: - Edzés · Mai (today's session: Push Day at 18:00, matches the Nap page)

struct LagyEdzesMai: View {
    private let muscles: [(String, Int, Color)] = [("Mell", 7, Lagy.sage2), ("Váll · elülső", 3, Lagy.sky), ("Váll · oldalsó", 3, Lagy.peach), ("Tricepsz", 3, Lagy.sun)]
    private let ex: [(String, String, String, String, String?)] = [
        ("Fekvenyomás", "gyak-barbell-bench-press.jpg", "4 × 6–8", "80 kg", nil),
        ("Ferde nyomás kézisúlyzóval", "gyak-incline-db-press.jpg", "3 × 8–10", "26 kg", nil),
        ("Vállból nyomás", "gyak-overhead-press.jpg", "3 × 8–10", "45 kg", "kímélve"),
        ("Oldalemelés", "gyak-lateral-raise.jpg", "3 × 12–15", "10 kg", nil),
        ("Tricepsz letolás", "gyak-tricep-pushdown.jpg", "3 × 10–12", "25 kg", nil),
    ]
    private let week: [(String, String)] = [("H", "today"), ("K", "plan"), ("Sze", "plan"), ("Cs", "plan"), ("P", "plan"), ("Szo", "sport"), ("V", "rest")]

    var body: some View {
        LagyTabPage(head: TabHead(photo: "edz-sulyzotarto.jpg", tabs: ["Mai", "Terv", "Sport", "Terhelés", "Tár"], on: "Mai",
                                  eyebrow: "Ma · 18:00 · Hypertrophy 04 · 3. hét / 6", title: "Push Day",
                                  sub: "Öt gyakorlat · 16 szett · körülbelül 60 perc", pill: "Indítsuk", pillGlyph: ("bolt", "ink")),
                    verdict: ("Ma ", "mell és váll", " jön, nehéz fekvenyomással."),
                    lead: "A vállból nyomás könnyített súllyal megy, amíg a jobb vállad érzékeny.") {
            TabSection(title: "A mai edzés", delay: 0.2) {
                HStack(spacing: 16) {
                    SegRing(segs: muscles.map { (Double($0.1) / 16, $0.2) }, val: "16", unit: "szett ma")
                    VStack(spacing: 11) {
                        ForEach(muscles, id: \.0) { m in
                            LagyBar(label: m.0, glyph: ("dumbbell", "berry"), value: "\(m.1)", unit: "szett", frac: Double(m.1) / 7, onDeep: true)
                        }
                    }
                }
                .padding(16).deepCard()
            }
            TabSection(title: "A heted", link: "A terv", delay: 0.3) {
                HStack(spacing: 0) {
                    ForEach(week, id: \.0) { d in
                        VStack(spacing: 6) {
                            ZStack {
                                Circle().fill(d.1 == "today" ? Lagy.ink : Lagy.paper)
                                if d.1 == "today" { Text("9").font(.outfit(15)).foregroundStyle(.white) }
                                else if d.1 == "sport" { Glyph("ball", "sun", size: 20) }
                                else if d.1 == "rest" { Glyph("moon", "sky", size: 18) }
                                else { Glyph("dumbbell", "ink", size: 18).opacity(0.6) }
                            }
                            .frame(width: 40, height: 40)
                            Text(d.0).font(.manrope(12, .bold)).foregroundStyle(d.1 == "today" ? Lagy.ink : Lagy.ink2)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.vertical, 14).lagyCard()
            }
            TabSection(title: "A gyakorlatok", delay: 0.35) {
                VStack(spacing: 10) {
                    ForEach(ex, id: \.0) { e in
                        PhotoRow(img: e.1, title: e.0, chips: [Chip(text: e.2, style: .soft, glyph: ("repeat", "deep"), small: true), Chip(text: e.3, small: true)]
                                 + (e.4.map { [Chip(text: $0, style: .warm, glyph: ("bolt", "peach"), small: true)] } ?? []))
                    }
                }
            }
            TabSection(title: "Mai állapot", delay: 0.4) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .bottom, spacing: 0) {
                        ForEach([("Kipihentség", 8), ("Izomláz", 3), ("Kedv", 7)], id: \.0) { s in
                            VStack(spacing: 6) {
                                JarTube(frac: Double(s.1) / 10, w: 26, h: 72, warm: false).background(RoundedRectangle(cornerRadius: 18).fill(.white).padding(-1))
                                Text("\(s.1) / 10").font(.outfit(14)).foregroundStyle(Lagy.ink)
                                Text(s.0).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    Text("A reggeli check-inből").font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2).frame(maxWidth: .infinity)
                }
                .padding(16).lagyCard(fill: Color(hex: 0xEAF4FB))
            }
            TabSection(title: "Előtte jön", delay: 0.45) {
                PhotoRow(img: "nap-lista-sq.jpg", title: "Ügyfélhívás · 17:30", chips: [Chip(text: "utána csak 30 perc", style: .warm, glyph: ("clock", "peach"), small: true)])
            }
            TabSection(title: "A mozgásod ma", delay: 0.5) {
                Trio(items: [("flame", "deep", "≈ 480", "kalória az edzés"), ("shoe", "cream", "≈ 6 000", "lépés eddig"), ("clock", "sky", "≈ 60", "perc mozgás")])
            }
            BoopCard(pre: "A hívás 17:30-kor kezdődik, ezért ", em: "18:30-ra tenném az edzést", post: ". Előtte egy banán, és a fekvenyomás nehéz szettjei is jól mennek majd.", action: "Áttolom 18:30-ra")
        }
    }
}

// MARK: - Fuel · Mai (morning: nothing eaten yet)

struct LagyFuelMai: View {
    @State private var openMeal = false
    private let cP = Color(hex: 0xE09A6A), cC = Color(hex: 0xE2B24A), cF = Color(hex: 0x8FBF9F), cW = Color(hex: 0x6FAEDC)
    private let windows: [(String, String, String?, String, String, Bool)] = [
        ("07:30", "Reggeli", "zab-sq.jpg", "Túrós zabkása · áfonyával", "640 kalória keret", true),
        ("12:30", "Ebéd", "csirke-sq.jpg", "Csirke, édesburgonya, spenót", "900 kalória · 45 g fehérje", false),
        ("16:30", "Uzsonna", nil, "Túró · áfonya · méz", "420 kalória keret", false),
        ("19:30", "Vacsora", "lazac-sq.jpg", "Lazac, barna rizs, brokkoli", "818 kalória · edzés után", false),
    ]

    var body: some View {
        LagyTabPage(head: TabHead(photo: "zab.jpg", tabs: ["Mai", "Kiegészítők", "Trendek", "Konyha"], on: "Mai",
                                  eyebrow: "Következik · Reggeli · 07:30", title: "Túrós zabkása",
                                  sub: "689 kalória · 2 350 a mai keret", pill: "Logolom", pillGlyph: ("plus", "ink")),
                    verdict: ("Tiszta lap: ", "2 350 kalória", " és 165 g fehérje a mai keret."),
                    lead: "Este Push Day jön, ezért a fehérje nagyja ebédre és vacsorára esik.",
                    pillAction: { openMeal = true }) {
            TabSection(title: "Ma eddig", link: "Részletek", delay: 0.2) {
                HStack(spacing: 16) {
                    LagyRing(p: 0.01, val: "0", unit: "a 2 350-ből")
                    VStack(spacing: 11) {
                        LagyBar(label: "fehérje", glyph: ("fish", "peach"), value: "0 / 165", unit: "g", frac: 0.01, onDeep: true)
                        LagyBar(label: "szénhidrát", glyph: ("bowl", "sun"), value: "0 / 260", unit: "g", frac: 0.01, onDeep: true)
                        LagyBar(label: "zsír", glyph: ("leaf", "sage"), value: "0 / 75", unit: "g", frac: 0.01, onDeep: true)
                        LagyBar(label: "víz", glyph: ("drop", "sky"), value: "0,3 / 2,5", unit: "l", frac: 0.12, onDeep: true)
                    }
                }
                .padding(16).deepCard()
            }
            TabSection(title: "A napod", link: "Tegnap", delay: 0.3) {
                VStack(spacing: 0) {
                    ForEach(windows, id: \.0) { w in
                        HStack(spacing: 12) {
                            Text(w.0).font(.outfit(14)).monospacedDigit().foregroundStyle(Lagy.ink2).frame(width: 46, alignment: .leading)
                            Group {
                                if let p = w.2 { photo(p).resizable().scaledToFill() }
                                else { Glyph("moon", "sky", size: 22).frame(maxWidth: .infinity, maxHeight: .infinity).background(Lagy.sage3) }
                            }
                            .frame(width: 44, height: 44).clipShape(Circle())
                            .overlay(Circle().stroke(w.5 ? Lagy.sage : .clear, lineWidth: 2.5).padding(-3))
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(w.1) · \(w.3)").font(.outfit(14.5)).foregroundStyle(Lagy.ink).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                                Text(w.4).font(.manrope(12.5, .bold)).foregroundStyle(w.5 ? Lagy.deep : Lagy.ink2)
                            }
                            Spacer(minLength: 2)
                            Image(systemName: w.5 ? "plus" : "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(w.5 ? Lagy.deep : Lagy.mute)
                        }
                        .padding(.vertical, 10)
                        .overlay(alignment: .bottom) { if w.0 != "19:30" { Rectangle().fill(Lagy.ink.opacity(0.06)).frame(height: 1) } }
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 6).lagyCard()
            }
            TabSection(title: "Logolás", delay: 0.35) {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
                    ForEach([("Fotó", "camera", "ink"), ("Recept", "book", "sage"), ("Kamra", "bowl", "sage"), ("Gyors", "bolt", "sun"), ("Diktálás", "chat", "ink"), ("Szokásosak", "repeat", "peach")], id: \.0) { m in
                        Button { openMeal = true } label: {
                            VStack(spacing: 6) { Glyph(m.1, m.2, size: 28); Text(m.0).font(.manrope(13, .bold)).foregroundStyle(Lagy.ink) }
                                .frame(maxWidth: .infinity).frame(height: 84).lagyCard(20)
                        }
                        .buttonStyle(PressStyle())
                    }
                }
            }
            TabSection(title: "Estére ajánlom", link: "A recept", delay: 0.4) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 230)
                        .overlay { photo("lazac.jpg").resizable().scaledToFill() }
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .top, endPoint: .bottom)
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("VACSORA · 19:30 · 23 PERC").font(.manrope(12, .bold)).tracking(0.5).opacity(0.85)
                        Text("Lazac, barna rizs, brokkoli").font(.outfit(20))
                        Text("Minden a kamrádban. 818 kalória, 49 g fehérje.").font(.manrope(13)).opacity(0.9)
                        Pill(title: "Betervezem", onPhoto: true).padding(.top, 6)
                    }
                    .foregroundStyle(.white).padding(16)
                }
                .shadow(color: Lagy.ink.opacity(0.15), radius: 16, y: 10)
            }
            BoopCard(pre: "Ebédre a csirkés tál, vacsorára a lazac: így a ", em: "165 g fehérje", post: " kijön, és az esti edzésre is lesz energiád.", action: "Betervezem")
        }
        .fullScreenCover(isPresented: $openMeal) { LagyMeal(mood: .good) { _ in } }
    }
}

// MARK: - Boop · Üzenőfal (the team wall; the companion is Boop)

struct LagyBoopWall: View {
    @State private var answered: String?
    private let team: [(String, String, Int, String)] = [("Alvás", "moon", 92, "rád vár"), ("Étkezés", "bowl", 84, "döntés kell"), ("Közérzet", "heart", 54, "kérése van"), ("Mozgás", "shoe", 40, "sejtés · 5 / 8"), ("Boop", "spark", 22, "csendben")]

    var body: some View {
        LagyTabPage(head: TabHead(photo: "mezo-vacsora.jpg", tabs: ["Üzenőfal", "A csapat", "Rólad", "Emlékek"], on: "Üzenőfal",
                                  eyebrow: "Reggeli kiadás · hétfő 06:50", title: "Egy beszélgetésben várnak rád",
                                  sub: "A csapat tegnap este óta 9 bejegyzést írt.", pill: "Megnézem", pillGlyph: ("chat", "ink")),
                    verdict: ("Az Alvás ", "a te szavadra", " vár."),
                    lead: "Egy közös ügy a vacsoráról. A többi csak olvasnivaló.") {
            TabSection(title: "Ma ennyi mondanivalójuk van", link: "A csapat", delay: 0.2) {
                HStack(spacing: 16) {
                    LagyRing(d: 96, p: answered == nil ? 0.5 : 0.04, color: Lagy.peach, val: answered == nil ? "1" : "0", unit: answered == nil ? "vár rád" : "minden kész")
                    VStack(spacing: 10) {
                        ForEach(team, id: \.0) { t in
                            LagyBar(label: t.0, glyph: (t.1, "cream"), value: t.3, frac: Double(t.2) / 100, onDeep: true, warn: t.2 > 80)
                        }
                    }
                }
                .padding(16).deepCard()
            }
            TabSection(title: "Élőben", delay: 0.25) {
                HStack(spacing: 12) {
                    Circle().fill(Lagy.peach).frame(width: 10, height: 10).padding(15).background(Circle().fill(Lagy.peach2))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Élőben · a csapat beszél").font(.outfit(15)).foregroundStyle(Lagy.ink)
                        Text("az esti lefekvés ügye · 1 új üzenet").font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(Lagy.mute)
                }
                .padding(14).lagyCard(22)
            }
            TabSection(title: "Rád vár", delay: 0.3) {
                post(who: "Alvás", glyph: ("moon", "sky"), time: "tegnap 20:30 · közös ügy · Étkezés, Szkeptikus", img: "mezo-tanyer-sq.jpg",
                     h: "Lehet, hogy nem az edzés tolja el az estédet.",
                     x: "A késői vacsorák inkább a későn befejezett napok mellé esnek, és utánuk rendre rosszabb az éjszakád. Az edzés-estéket külön néztem: azok után nem látom ugyanezt.") {
                    VStack(spacing: 8) {
                        compare("késői vacsora után", "6,0", 0.42, Lagy.sun)
                        compare("korai vacsora után", "7,5", 0.8, Lagy.sage)
                        HStack(spacing: 6) { Chip(text: "másfél pont különbség", style: .soft, small: true); Chip(text: "11 este mellette", small: true) }
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    if let a = answered {
                        HStack(spacing: 8) { Glyph("check", "sage", size: 18); Text("Köszönöm: \(a.lowercased()) · továbbviszem") }
                            .font(.manrope(13.5, .bold)).foregroundStyle(Lagy.deep)
                    } else {
                        HStack(spacing: 8) {
                            ForEach(["Igaz", "Nem rólam szól", "Majd meglátjuk"], id: \.self) { a in
                                Button { withAnimation(.spring) { answered = a } } label: {
                                    Text(a).font(.manrope(13, .bold)).foregroundStyle(Lagy.ink).lineLimit(1).minimumScaleFactor(0.85)
                                        .padding(.horizontal, 12).frame(height: 40).background(Capsule().fill(Lagy.paper))
                                }
                                .buttonStyle(PressStyle())
                            }
                        }
                    }
                }
                .sensoryFeedback(.success, trigger: answered)
            }
            TabSection(title: "Ma", delay: 0.35) {
                post(who: "Közérzet", glyph: ("heart", "berry"), time: "ma 06:40 · kérés", img: "nap-baratok-sq.jpg",
                     h: "Két hétből csak 4 estéről tudom, hogy érezted magad.",
                     x: "Ha ma este bejelentkezel (tényleg egy perc), hétvégére meg tudom mutatni, mi mozgatja az energiádat. A sejtésem: az alvásoddal függ össze, nem a munkával.") {
                    HStack(spacing: 4) {
                        ForEach(0..<14, id: \.self) { i in Capsule().fill([1, 4, 8, 11].contains(i) ? Lagy.sage : Lagy.ink.opacity(0.1)).frame(height: 18) }
                    }
                    Pill(title: "Bejelentkezem · 1 perc", soft: true)
                }
            }
            BoopCard(pre: "Ennyi történt tegnap este óta. A folyamatban lévő ügyeket ", em: "közben tovább figyeljük", post: ", és este újra jelentkezünk.", action: "Rendben")
        }
    }

    private func compare(_ l: String, _ v: String, _ f: Double, _ c: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(l).font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2); Spacer(); Text(v).font(.outfit(14)).foregroundStyle(Lagy.ink) }
            GeometryReader { g in
                ZStack(alignment: .leading) { Capsule().fill(Lagy.ink.opacity(0.08)); Capsule().fill(c).frame(width: g.size.width * f) }
            }
            .frame(height: 8)
        }
    }

    private func post<E: View>(who: String, glyph: (String, String), time: String, img: String, h: String, x: String, @ViewBuilder extra: () -> E) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Glyph(glyph.0, glyph.1, size: 22).frame(width: 40, height: 40).background(Circle().fill(Lagy.sage3))
                VStack(alignment: .leading, spacing: 2) {
                    Text(who).font(.outfit(15)).foregroundStyle(Lagy.ink)
                    Text(time).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2).lineLimit(1)
                }
                Spacer()
                photo(img).resizable().scaledToFill().frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 12))
            }
            Text(h).font(.outfit(17)).foregroundStyle(Lagy.ink).fixedSize(horizontal: false, vertical: true)
            Text(x).font(.manrope(14, .medium)).foregroundStyle(Lagy.ink2).lineSpacing(2).fixedSize(horizontal: false, vertical: true)
            extra()
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .lagyCard()
    }
}

// MARK: - Én · Hol tartok

struct LagyEnHub: View {
    private let weeks: [Double] = [85.6, 85.3, 85.0, 84.6, 84.4, 84.0, 83.8, 83.5, 83.2, 82.9, 82.6, 82.4]
    var body: some View {
        LagyTabPage(head: TabHead(photo: "en-futam.jpg", tabs: ["Hol tartok", "Súly", "Alvás", "Célok", "Napló"], on: "Hol tartok",
                                  eyebrow: "Nov. 2–8. · lezárt hét", title: "Az egyensúly hete",
                                  sub: "78 pont · +4 az előző héthez", pill: "A heti történet", pillGlyph: ("book", "sage")),
                    verdict: ("Jól ment: ", "fehérjecél öt napon", ", stabil alvás. Figyelj a két késői vacsorára.")) {
            HStack(spacing: 12) {
                Text("D").font(.outfit(20)).foregroundStyle(.white).frame(width: 52, height: 52)
                    .background(Circle().fill(LinearGradient(colors: [Lagy.sage, Lagy.deep], startPoint: .topLeading, endPoint: .bottomTrailing)))
                VStack(alignment: .leading, spacing: 6) {
                    Text("Dani · A kitartó").font(.outfit(16)).foregroundStyle(Lagy.ink)
                    HStack(spacing: 6) {
                        Chip(text: "12. szint", style: .soft, small: true); Chip(text: "3 140 XP", small: true); Chip(text: "6 napos sorozat", small: true)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(14).lagyCard(22).padding(.horizontal, 16).padding(.top, 20).entrance(0.15)

            TabSection(title: "A hét", link: "A heti történet", delay: 0.2) {
                HStack(spacing: 16) {
                    LagyRing(d: 96, p: 0.78, color: Lagy.sun, val: "78", unit: "a 100-ból")
                    VStack(spacing: 9) {
                        LagyBar(label: "Étkezés", glyph: ("bowl", "cream"), value: "84", frac: 0.84, onDeep: true)
                        LagyBar(label: "Alvás", glyph: ("moon", "cream"), value: "7 óra 19", frac: 0.74, onDeep: true)
                        LagyBar(label: "Edzés", glyph: ("dumbbell", "berry"), value: "3 / 4", frac: 0.75, onDeep: true)
                        LagyBar(label: "Hangulat", glyph: ("heart", "cream"), value: "6,8", frac: 0.68, onDeep: true, warn: true)
                    }
                }
                .padding(16).deepCard()
            }
            TabSection(title: "Életvonal", link: "A súlyod", delay: 0.3) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("−3,2 kiló").font(.outfit(26, .heavy)).foregroundStyle(Lagy.ink)
                        Text("12 hét · heti átlagok").font(.manrope(12.5, .bold)).foregroundStyle(Lagy.ink2)
                    }
                    Chart {
                        ForEach(Array(weeks.enumerated()), id: \.offset) { i, v in
                            AreaMark(x: .value("Hét", i), yStart: .value("a", 78), yEnd: .value("kg", v))
                                .foregroundStyle(LinearGradient(colors: [Lagy.sage2.opacity(0.6), Lagy.sage3.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                                .interpolationMethod(.catmullRom)
                            LineMark(x: .value("Hét", i), y: .value("kg", v)).foregroundStyle(Lagy.deep).lineStyle(.init(lineWidth: 3)).interpolationMethod(.catmullRom)
                        }
                        ForEach([3, 7], id: \.self) { i in
                            PointMark(x: .value("Hét", i), y: .value("kg", weeks[i])).foregroundStyle(Lagy.sun).symbolSize(90)
                        }
                        RuleMark(y: .value("Cél", 79)).foregroundStyle(Lagy.peach).lineStyle(.init(lineWidth: 1.5, dash: [4, 5]))
                            .annotation(position: .top, alignment: .trailing) { Text("cél 79,0").font(.manrope(12, .bold)).foregroundStyle(Lagy.peachInk) }
                    }
                    .chartYScale(domain: 78...86.5).chartXAxis(.hidden).chartYAxis(.hidden)
                    .frame(height: 150)
                    HStack(spacing: 6) {
                        Chip(text: "Első 2 kiló", style: .soft, glyph: ("star", "sun"), small: true)
                        Chip(text: "84 alatt", style: .soft, glyph: ("star", "sun"), small: true)
                    }
                    Text("A következő állomás: 79,0 kiló, még 3,4 kiló.").font(.manrope(13.5, .semibold)).foregroundStyle(Lagy.ink2)
                }
                .padding(18).lagyCard()
            }
            TabSection(title: "Célok állása", link: "Mind", delay: 0.35) {
                VStack(spacing: 10) {
                    goal("en-merleg-sq.jpg", "Súlycél · 85,6 → 79 kiló", nil, "48%", "úton")
                    goal("edz-izom-sq.jpg", "Kockahas", [1, 1, 0, 1, 1, 0, 1], "3 / 5", "tartja")
                    goal("kave-sq.jpg", "Mellékprojekt", [1, 0, 1, 1, 0, 1, 1], "2 / 3", "emelkedik")
                    goal("nap-baratok-sq.jpg", "Több idő a barátokkal", [0, 0, 1, 0, 1, 1, 0], "1 / 2", "emelkedik")
                }
            }
            TabSection(title: "Tovább", delay: 0.4) {
                HStack(spacing: 10) {
                    tile("en-futam-sq.jpg", "Fejlődés", "12. szint · 82% fegyelem")
                    tile("nap-baratok-sq.jpg", "Emberek", "Petra 3× a héten")
                }
            }
            BoopCard(pre: "Ha a ", em: "vacsora 20 óra elé", post: " kerül, a jövő héten a 80 pont is meglehet.", action: "Így legyen")
        }
    }

    private func goal(_ img: String, _ t: String, _ dots: [Int]?, _ v: String, _ dir: String) -> some View {
        HStack(spacing: 12) {
            photo(img).resizable().scaledToFill().frame(width: 44, height: 44).clipShape(Circle())
            VStack(alignment: .leading, spacing: 6) {
                Text(t).font(.outfit(15)).foregroundStyle(Lagy.ink)
                if let dots {
                    HStack(spacing: 4) { ForEach(Array(dots.enumerated()), id: \.offset) { Circle().fill($0.element == 1 ? Lagy.sage : Lagy.ink.opacity(0.1)).frame(width: 9, height: 9) } }
                } else { Chip(text: "3,4 kiló a célig", style: .soft, small: true) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(v).font(.outfit(15)).foregroundStyle(Lagy.ink)
                Text(dir).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
            }
        }
        .padding(12).lagyCard(22)
    }

    private func tile(_ img: String, _ t: String, _ s: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Color.clear.frame(height: 96).overlay { photo(img).resizable().scaledToFill() }.clipShape(RoundedRectangle(cornerRadius: 16))
            Text(t).font(.outfit(15)).foregroundStyle(Lagy.ink)
            Text(s).font(.manrope(12, .bold)).foregroundStyle(Lagy.ink2)
        }
        .padding(10).frame(maxWidth: .infinity, alignment: .leading).lagyCard(22)
    }
}
