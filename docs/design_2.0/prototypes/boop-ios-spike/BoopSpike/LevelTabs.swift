import SwiftUI

// MARK: - Ma

struct LevelMa: View {
    var m: EMetric
    var state: LevelState
    private var hue: Color { m.glow }

    var body: some View {
        switch state {
        case .disconnected: disconnected
        case .loading: loading
        case .empty: empty
        default: full
        }
    }

    // The normal day (also failed / rulesOnly, which change single blocks).
    @ViewBuilder private var full: some View {
        if state == .rulesOnly {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "list.bullet.indent").font(.system(size: 14, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
                Text("Ma már nem pontoztam tovább — a többit szabályok szerint rendeztem.")
                    .font(.system(size: 13.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.8))
            }
            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.12)))
        }
        highlight
        EStatRowWarm(stats: [EStat(value: "34", unit: "levél", label: "érkezett reggel óta"),
                             EStat(value: "31", unit: "", label: "elintéztem helyetted"),
                             EStat(value: "2", unit: "", label: "megér egy percet", hot: true)], hue: hue).padding(.vertical, 2)
        heat
        people
        due.id("hatar")
        parcels.id("csomag")
        deals.id("akcio")
        rest.id("tobbi")
        EAskRow(text: "Kérdezd meg Boopot a leveleidről") {}
    }

    private var highlight: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                StillOrb(colors: m.orb, size: 22, level: 0.85)
                Text("MEGÉR EGY PERCET").font(AuraFont.mono(11, .bold)).tracking(1.5).foregroundStyle(hue)
                Spacer()
                if state != .rulesOnly { EScore(n: 9, hue: hue) }
            }
            Text("Futócipő −32% · ma éjfélig").font(AuraFont.serif(23)).lineSpacing(3).foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 10)
            EHueText(text: "A *30 590 Ft* a legjobb ár, amit a figyelt cipődre láttam. A mostanit már 780 km-t futottad.",
                     hue: hue, size: 14, opacity: 0.78).padding(.top, 7)
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(LinearGradient(colors: [hue.opacity(0.26), hue.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
            .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(hue.opacity(0.4))))
    }

    private var heat: some View {
        EBare(label: "MIKOR ÉRKEZIK", hue: hue, glyph: "clock-ink") {
            EHeat(cells: [("0", 0.02), ("2", 0.03), ("4", 0.05), ("6", 0.12), ("8", 0.95), ("10", 0.5),
                          ("12", 0.3), ("14", 0.55), ("16", 0.25), ("18", 0.15), ("20", 0.08), ("22", 0.03)],
                  hue: hue, note: "A legtöbb levél 8 és 10 között jön — ezért nézek bele reggel 08:00-kor.")
        }
    }

    private var people: some View {
        EBare(label: "ELŐSZÖR EZEK", hue: hue, glyph: "person-sage") {
            VStack(spacing: 0) {
                row(glyph: "person-sage", title: "Kiss Réka írt", sub: "Személyes levél · 07:42", right: "olvasatlan", hot: true)
                LevelDivider()
                row(glyph: "scale-ink", title: "A bankod írt", sub: "Nem olvastam el · megnyitás a Gmailben", right: "07:15", hot: false)
            }
        }
    }

    private func row(glyph: String, title: String, sub: String, right: String, hot: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack { Circle().fill(hot ? hue.opacity(0.22) : .white.opacity(0.08)); EGlyph(glyph, hot ? hue : .white.opacity(0.9), size: 16) }
                .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                Text(sub).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
            }
            Spacer(minLength: 6)
            Text(right).font(.system(size: 12, weight: .medium)).foregroundStyle(hot ? hue : .white.opacity(0.5))
            Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
        }.padding(.vertical, 10)
    }

    @ViewBuilder private var due: some View {
        EBare(label: "HATÁRIDŐS", hue: hue, glyph: "clock-ink") {
            if state == .failed { LevelFailed(text: "A határidőket most nem tudtam betölteni.", hue: hue) }
            else {
                VStack(spacing: 0) {
                    LevelDueRow(glyph: "clock-ink", title: "Tanfolyam-jelentkezés", sub: "Lezárul 23:59-kor", mark: "ma", markSub: "", hue: hue, soon: true)
                    LevelDivider()
                    LevelDueRow(glyph: "e-penz", title: "Áramszámla", sub: "Esedékes · átutalással", mark: "holnap", markSub: "14 820 Ft", hue: hue, soon: true)
                    LevelDivider()
                    LevelDueRow(glyph: "star-sun", title: "Szállásfoglalás · Balaton", sub: "Bejelentkezés 14:00-tól", mark: "péntek", markSub: "", hue: hue)
                    LevelDivider()
                    LevelDueRow(glyph: "spark-cream", title: "Koncert", sub: "Kapunyitás 19:00 · jegy a levélben", mark: "szombat", markSub: "20:00", hue: hue)
                }
            }
        }
    }

    @ViewBuilder private var parcels: some View {
        EBare(label: "CSOMAGOK", hue: hue, glyph: "plate-deep") {
            VStack(spacing: 0) {
                LevelDueRow(glyph: "bolt-ink", title: "Futóbolt · futózokni", sub: "GLS · kiszállítás 10–14 óra között", mark: "ma érkezik", markSub: "", hue: hue, soon: true)
                LevelDivider()
                LevelDueRow(glyph: "check-ink", title: "Könyvrendelés", sub: "Csomagpont · még 3 napig vár", mark: "átvehető", markSub: "", hue: hue)
                LevelDivider()
                LevelDueRow(glyph: "clock-ink", title: "Okosmérleg", sub: "Postával · tegnap indult", mark: "úton", markSub: "", hue: hue)
            }
        }
    }

    @ViewBuilder private var deals: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Capsule().fill(hue).frame(width: 3, height: 13)
                EGlyph("star-sun", hue.opacity(0.9), size: 14)
                Text("AKCIÓK ÉS LEHETŐSÉGEK").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
            if state == .failed { LevelFailed(text: "Az akciókat most nem tudtam betölteni.", hue: hue) }
            else {
                let sl = state == .rulesOnly
                LevelDealCard(deal: LevelDeal(from: "Futóbolt", title: "A kinézett futócipő 32%-kal olcsóbb",
                                              why: "Ez a cipő van a figyelőlistádon, és a mostanit 780 km után cserélned kell.",
                                              score: 9, left: "Ma éjfélig"), hue: hue, scoreless: sl)
                LevelDealCard(deal: LevelDeal(from: "Fehérjebolt", title: "Akció a szokásos fehérjeporodra",
                                              why: "Pontosan annyiba kerül, mint márciusban. Három hétre elég még a zacskód.", score: 5),
                              hue: hue, scoreless: sl)
                LevelDealCard(deal: LevelDeal(from: "Prémium Utazás Klub", title: "Maldív-szigetek, 70% kedvezmény",
                                              why: "Gyanús levél: a link nem oda vezet, ahová írja. Nem pontoztam, és ne kattints rá.",
                                              score: nil, phishing: true), hue: hue)
            }
        }
    }

    private var rest: some View {
        EBare(label: "A TÖBBI", hue: hue, glyph: "e-level") {
            VStack(spacing: 0) {
                LevelFold(title: "Hírlevelek", count: 12, hue: hue,
                          lines: [("Heti Receptek", "Öt vacsora, egyik sem a terved része"),
                                  ("Futónaptár", "Őszi versenyek a megyében"),
                                  ("Tech Reggeli", "Napi összefoglaló")], open: true)
                LevelDivider().padding(.leading, 0)
                LevelFold(title: "Értesítők", count: 9, hue: hue, lines: [], open: false)
                LevelDivider().padding(.leading, 0)
                LevelFold(title: "Közösségi", count: 6, hue: hue, lines: [], open: false)
            }
        }
    }

    // MARK: States

    private var empty: some View {
        Group {
            HStack(spacing: 14) {
                StillOrb(colors: m.orb, size: 34, level: 0.9)
                Text("Reggel óta nem jött levél, ami rád várna. Jó nap, nincs mit nézned.")
                    .font(AuraFont.serif(19)).lineSpacing(3).foregroundStyle(.white)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [hue.opacity(0.2), hue.opacity(0.03)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(hue.opacity(0.35))))
            EStatRowWarm(stats: [EStat(value: "12", unit: "levél", label: "érkezett reggel óta"),
                                 EStat(value: "12", unit: "", label: "elintéztem helyetted"),
                                 EStat(value: "0", unit: "", label: "megér egy percet", hot: true)], hue: hue)
            heat
            EBare(label: "HATÁRIDŐS", hue: hue, glyph: "clock-ink") {
                Text("Nincs közelgő határidő.").font(.system(size: 14.5)).foregroundStyle(.white.opacity(0.65))
            }
            rest
            EAskRow(text: "Kérdezd meg Boopot a leveleidről") {}
        }
    }

    private var loading: some View {
        Group {
            ForEach(["ELŐSZÖR EZEK", "HATÁRIDŐS", "CSOMAGOK"], id: \.self) { l in
                EBare(label: l, hue: hue) { LevelSkeleton(rows: l == "ELŐSZÖR EZEK" ? 2 : 3) }
            }
            RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.06)).frame(height: 150)
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.1)))
        }
    }

    private var disconnected: some View {
        Group {
            VStack(alignment: .leading, spacing: 12) {
                Text("A Boop még nem lát postát").font(AuraFont.serif(23)).foregroundStyle(.white)
                Text("Egy külön Gmail-fiókba továbbítod a leveleidet, a Boop onnan olvas. A jelszavadat soha nem kérem.")
                    .font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.8))
                HStack(spacing: 8) {
                    Text("Fiókok megnyitása").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(gBase)
                    Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold)).foregroundStyle(gBase)
                }
                .padding(.horizontal, 18).frame(height: 44).background(Capsule().fill(.white)).padding(.top, 4)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: [hue.opacity(0.24), hue.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(hue.opacity(0.4))))
            EAskRow(text: "Kérdezd meg Boopot a leveleidről") {}
        }
    }
}

// MARK: - Figyelt (not live yet)

struct LevelFigyelt: View {
    var m: EMetric
    var body: some View {
        EBare(label: "AMIT FIGYELSZ", hue: m.glow, glyph: "search-ink") {
            VStack(alignment: .leading, spacing: 12) {
                Text("MÉG NEM ÉL").font(AuraFont.mono(11, .bold)).tracking(1.4).foregroundStyle(m.glow)
                    .padding(.horizontal, 10).frame(height: 26)
                    .background(Capsule().fill(m.glow.opacity(0.16))).overlay(Capsule().stroke(m.glow.opacity(0.4)))
                Text("Itt fogod látni a termékeket, amiket figyelek neked, és az áraikat. Akkor szólok, ha az ár tényleg alacsonyabb, mint máshol — nem akkor, ha csak rá van írva, hogy akció.")
                    .font(.system(size: 14.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.8))
                Text("Ez egy későbbi kiadással jön.").font(.system(size: 13)).foregroundStyle(.white.opacity(0.55))
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
        }
    }
}

// MARK: - Szabályok

struct LevelSzabalyok: View {
    var m: EMetric
    @State private var never = ["Városi Fogászat"]
    @State private var always = ["Kiss Réka", "Futóbolt"]
    @State private var quiet = ["Hétvégi Divat", "Játékhíradó", "Olcsó Telefon Bolt"]
    @State private var proposalDone = false
    @State private var newSender = ""
    private var hue: Color { m.glow }

    var body: some View {
        EBare(label: "AMIT GÉP SOHA NEM OLVAS", hue: hue, glyph: "scale-ink") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(["Bank", "Biztosító", "Hivatal", "Egészségügy", "Belépőkódok"], id: \.self) { n in
                    HStack(spacing: 12) {
                        Image(systemName: "lock").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.6)).frame(width: 24)
                        Text(n).font(.system(size: 15)).foregroundStyle(.white)
                        Spacer()
                        Text("mindig").font(.system(size: 12)).foregroundStyle(.white.opacity(0.4))
                    }.padding(.vertical, 11)
                    LevelDivider().padding(.leading, 36)
                }
                ForEach(never, id: \.self) { n in removable(n, sub: "te tetted ide") { never.removeAll { $0 == n } } }
                HStack(spacing: 10) {
                    TextField("", text: $newSender, prompt: Text("Feladó, akit se olvassak").foregroundStyle(.white.opacity(0.4)))
                        .font(.system(size: 14.5)).foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(height: 42)
                        .background(Capsule().fill(.white.opacity(0.08))).overlay(Capsule().stroke(.white.opacity(0.14)))
                    Text("Ezt se olvasd").font(.system(size: 14, weight: .semibold)).foregroundStyle(gBase)
                        .lineLimit(1).fixedSize().padding(.horizontal, 14).frame(height: 42).background(Capsule().fill(.white))
                }.padding(.top, 14)
            }
        }
        EBare(label: "AMIT MINDIG MEGMUTATOK", hue: hue, glyph: "star-sun") {
            VStack(spacing: 0) {
                ForEach(always, id: \.self) { n in removable(n, sub: "érdekel volt") { always.removeAll { $0 == n } } }
            }
        }
        EBare(label: "AMIT CSENDBEN ELTESZEK", hue: hue, glyph: "plate-deep") {
            VStack(spacing: 0) {
                ForEach(quiet, id: \.self) { n in removable(n, sub: "nem érdekel volt") { quiet.removeAll { $0 == n } } }
            }
        }
        if !proposalDone {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 9) {
                    StillOrb(colors: m.orb, size: 22, level: 0.85)
                    Text("JAVASLAT").font(AuraFont.mono(11, .bold)).tracking(1.5).foregroundStyle(hue)
                }
                Text("A Hétvégi Divat leveleit háromszor dobtad el — tegyem csendben félre?")
                    .font(AuraFont.serif(20)).lineSpacing(3).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Button { withAnimation { quiet.append("Hétvégi Divat"); proposalDone = true } } label: {
                    Text("Igen, tedd félre").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(gBase)
                        .padding(.horizontal, 18).frame(height: 40).background(Capsule().fill(.white))
                }.buttonStyle(.plain)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [hue.opacity(0.24), hue.opacity(0.04)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(hue.opacity(0.4))))
        }
        EBare(label: "MIKOR CSENGET A TELEFON", hue: hue, glyph: "clock-ink") {
            EHueText(text: "Csak akkor szólok, ha valami *ma vagy holnap lejár*. Naponta legfeljebb egy-két értesítést küldök, és ezen a Boop többi része is osztozik — nem lesz tőlem több.",
                     hue: hue, size: 14.5, opacity: 0.8)
        }
    }

    private func removable(_ name: String, sub: String, remove: @escaping () -> Void) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ZStack { Circle().fill(.white.opacity(0.08)); EGlyph("person-sage", .white.opacity(0.9), size: 14) }.frame(width: 32, height: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.system(size: 15)).foregroundStyle(.white)
                    Text(sub).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                }
                Spacer()
                Button(action: remove) {
                    Text("Töröl").font(.system(size: 12.5, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 12).frame(height: 30).background(Capsule().fill(.white.opacity(0.1)))
                }.buttonStyle(.plain)
            }.padding(.vertical, 10)
            LevelDivider().padding(.leading, 44)
        }
    }
}

// MARK: - Fiókok

struct LevelFiokok: View {
    var m: EMetric
    var state: LevelState
    var stalled: Bool
    @State private var address = ""
    @State private var secret = ""
    private var hue: Color { m.glow }

    var body: some View {
        if state == .disconnected { guide; form.id("form") } else { connected }
    }

    private let steps: [(String, String)] = [
        ("Új Gmail-fiók csak Boopnak", "Hozz létre egy teljesen új Gmail-fiókot. A saját fiókodhoz ne nyúlj."),
        ("Kétlépcsős azonosítás", "A Google-fiók biztonsági beállításaiban kapcsold be."),
        ("Alkalmazásjelszó", "Ugyanott kérj egy alkalmazásjelszót. Ez az, amit alább beírsz — nem a fiók jelszava."),
        ("Továbbítás a Gmailből", "A saját Gmailedben állítsd be, hogy a levelek az új fiókba is menjenek."),
        ("Továbbítás az iCloudból", "Az iCloud-levelezésnél ugyanez, ha használod."),
        ("A Boop-fiók hozzáadása a Gmail-apphoz", "Így a „Megnyitás a Gmailben” gomb egyenesen a levelet nyitja meg."),
    ]

    private var guide: some View {
        EBare(label: "HAT LÉPÉS", hue: hue, glyph: "check-ink") {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { i, s in
                    HStack(alignment: .top, spacing: 14) {
                        Text("\(i + 1)").font(.custom("Outfit", size: 18).weight(.medium)).foregroundStyle(hue)
                            .frame(width: 34, height: 34).background(Circle().fill(hue.opacity(0.16))).overlay(Circle().stroke(hue.opacity(0.4)))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(s.0).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                            Text(s.1).font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.62))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }.padding(.vertical, 12)
                    if i < steps.count - 1 { LevelDivider().padding(.leading, 48) }
                }
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("ÖSSZEKÖTÉS").font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.6))
            field("Boop-fiók címe", text: $address, secure: false)
            field("Alkalmazásjelszó", text: $secret, secure: true)
            Text("A saját jelszavadat soha nem kérem. Az alkalmazásjelszót bármikor visszavonhatod, és akkor a Boop azonnal elveszti a hozzáférést.")
                .font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            Text("Összekötés").font(.system(size: 16, weight: .semibold)).foregroundStyle(gBase)
                .frame(maxWidth: .infinity).frame(height: 50).background(Capsule().fill(.white))
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
    }

    private func field(_ p: String, text: Binding<String>, secure: Bool) -> some View {
        Group {
            if secure { SecureField("", text: text, prompt: Text(p).foregroundStyle(.white.opacity(0.4))) }
            else { TextField("", text: text, prompt: Text(p).foregroundStyle(.white.opacity(0.4))).textInputAutocapitalization(.never).keyboardType(.emailAddress) }
        }
        .font(.system(size: 15.5)).foregroundStyle(.white).padding(.horizontal, 16).frame(height: 48)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(.white.opacity(0.14)))
    }

    private var connected: some View {
        Group {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    ZStack { Circle().fill(hue.opacity(0.22)); LevelGlyph(color: hue, size: 20) }.frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("boop.posta@example.com").font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                        Text("Utolsó átnézés: ma 08:00 · 34 levél").font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                    }
                }
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                HStack(alignment: .top, spacing: 10) {
                    Circle().fill(stalled ? levelAmber : Color(hex: 0x5FD08A)).frame(width: 9, height: 9).padding(.top, 5)
                    Text(stalled ? "Két futás óta nem jött levél — lehet, hogy a továbbítás leállt."
                                 : "Rendben")
                        .font(.system(size: 14.5, weight: .semibold)).lineSpacing(3)
                        .foregroundStyle(stalled ? levelAmber : Color(hex: 0x5FD08A))
                        .fixedSize(horizontal: false, vertical: true)
                }
                if stalled {
                    Text("Nézd meg a Gmailben, hogy a továbbítás még be van-e kapcsolva.")
                        .font(.system(size: 13)).lineSpacing(3).foregroundStyle(.white.opacity(0.6))
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard(22)
            HStack(spacing: 10) {
                Text("Átnézés most").font(.system(size: 15, weight: .semibold)).foregroundStyle(gBase)
                    .frame(maxWidth: .infinity).frame(height: 48).background(Capsule().fill(.white))
                Text("Lecsatolás").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).frame(height: 48).background(Capsule().fill(.white.opacity(0.1)))
                    .overlay(Capsule().stroke(.white.opacity(0.2)))
            }
            Text("A lecsatolás törli a tárolt alkalmazásjelszót. A már átnézett levelek összefoglalói megmaradnak.")
                .font(.system(size: 12.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.5))
        }
    }
}
