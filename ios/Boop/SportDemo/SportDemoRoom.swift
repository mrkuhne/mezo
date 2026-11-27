import SwiftUI
import BoopCore
import BoopDesign

// THROWAWAY SPIKE (mezo-r36n9.188) — the Sport area on invented fixtures, for the owner's simulator OK.
// Not for main. Launch flags (after the bundle id):
//   -previewHome sport            the ring already opened onto the Sport area (with -preview shell)
//   -previewSport YES             the Sport area alone, no sign-in
//   -sportTab Ma|Hét|Napló|Beosztás
//   -sportMoment before|after|done|skipped   the Ma hero's moment (before the game / the watch recorded it / logged / skipped)
//   -sportState ready|empty|loading|error|offline
//   -sportSheet log|skip          opens the log or the skip sheet

private let hue = Hue.sport

private enum Moment: String { case before, after, done, skipped }
private enum DemoState: String { case ready, empty, loading, error, offline }

struct SportDemoRoom: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.closeRoom) private var closeRoom
    @State private var tab: String
    @State private var moment: Moment
    @State private var state: DemoState
    @State private var sheet: SportDemoSheet?
    @State private var toast: String?

    init() {
        let d = UserDefaults.standard
        _tab = State(initialValue: d.string(forKey: "sportTab") ?? "Ma")
        _moment = State(initialValue: Moment(rawValue: d.string(forKey: "sportMoment") ?? "") ?? .before)
        _state = State(initialValue: DemoState(rawValue: d.string(forKey: "sportState") ?? "") ?? .ready)
        _sheet = State(initialValue: SportDemoSheet(rawValue: d.string(forKey: "sportSheet") ?? ""))
    }

    private var head: (String, String) {
        switch state {
        case .empty: return ("Még nincs sportod", "Add meg, mikor sportolsz, és mellé teszem a kondit.")
        case .loading: return ("A sportod", "Töltöm a hetedet…")
        case .error: return ("A sportodat most nem érem el", "A szerver most nem válaszolt.")
        case .offline, .ready:
            switch tab {
            case "Hét": return ("Négy röpi, öt kondi", "A hét két sávban: reggel kondi, este röpi.")
            case "Napló": return ("Egyenletes, kicsit keményebb", "Az elmúlt négy hétben 13 alkalom, átlagos megterhelés 6,4.")
            case "Beosztás": return ("Hétfő, kedd, szerda, péntek", "Esténként 18:00-kor, két órát. Itt állítod a heti rendet.")
            default:
                switch moment {
                case .before: return ("Ma este röpi", "Reggel kondi volt, este 18:00-kor röplabda. Elég idő van köztük.")
                case .after: return ("Az órád rögzítette a röpit", "Csak a megterhelést, a szetteket és a vállad jelöld.")
                case .done: return ("Kemény röpi volt", "Hetes megterhelés két órán át: ez a heti terhelésed legnagyobb napja.")
                case .skipped: return ("Ma kimarad a röpi", "Fáradt voltál. A heti egy szabad kihagyásod ez lett.")
                }
            }
        }
    }

    var body: some View {
        let h = head
        NKAreaPage(hue: hue, name: "Sport", eyebrow: "Sport · \(tab)",
                   level: state == .ready || state == .offline ? 0.5 : nil, display: state == .ready || state == .offline ? "2/4" : nil,
                   headline: h.0, sentence: h.1, glyph: "ball-sun",
                   tabs: [NKAreaTab("Ma", badge: moment == .after ? 1 : 0), NKAreaTab("Hét"), NKAreaTab("Napló"), NKAreaTab("Beosztás")],
                   selectedTab: $tab,
                   actions: [NKAreaAction(glyph: "plus-ink", label: "Sport rögzítése") { sheet = .log },
                             NKAreaAction(glyph: "clock-ink", label: "Beosztás") { tab = "Beosztás" }],
                   onBack: { if let closeRoom { closeRoom() } else { dismiss() } },
                   onAsk: { toast = "Boop: a próbaváltozatban nem válaszol" }) {
            if state == .offline {
                Text("Nincs net — a legutóbb látott hetedet mutatom. A rögzítés így is megy, később elküldöm.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14).nkGlass(20)
            }
            switch state {
            case .empty: SportEmpty { tab = "Beosztás"; state = .ready }
            case .loading: SportLoading()
            case .error: SportError { state = .ready }
            case .ready, .offline:
                switch tab {
                case "Hét": SportHet()
                case "Napló": SportNaplo()
                case "Beosztás": SportBeosztas { toast = $0 }
                default: SportMa(moment: $moment, open: { sheet = $0 })
                }
            }
            Color.clear.frame(height: 10)
        }
        .toolbar(.hidden, for: .navigationBar)
        .nkToast($toast)
        .sheet(item: $sheet) { s in
            Group {
                switch s {
                case .log: SportLogSheet(prefilled: moment == .after || moment == .done) { sheet = nil; moment = .done; toast = "Elmentve — a röpi bekerült a napodba" }
                case .skip: SportSkipSheet { sheet = nil; moment = .skipped; toast = "Kihagyva — Visszavonás a kártyán" }
                }
            }
            .presentationDetents([.large])
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
        }
    }
}

enum SportDemoSheet: String, Identifiable { case log, skip; var id: String { rawValue } }

// MARK: - Shared bits

@MainActor private func glassCard<C: View>(_ label: String, trailing: String? = nil, @ViewBuilder _ content: () -> C) -> some View {
    NKBare(label, hue: hue, trailing: trailing, content: content)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .nkGlass(24)
}

@MainActor private func bigNumber(_ value: String, _ label: String, lit: Bool = false) -> some View {
    VStack(alignment: .leading, spacing: 1) {
        Text(value).font(.custom(Lagy.outfitFamily, size: 24, relativeTo: .title2).weight(.medium))
            .foregroundStyle(lit ? hue.glow : .white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        Text(label).nkFont(12.5, .medium).foregroundStyle(.white.opacity(0.75))
    }
    .accessibilityElement(children: .combine)
}

private struct Chip: View {
    let text: String; var on = false; var kind: Color? = nil
    var body: some View {
        HStack(spacing: 5) {
            if let kind { Circle().fill(kind).frame(width: 7, height: 7) }
            Text(text).nkFont(12.5, on ? .semibold : .regular)
        }
        .foregroundStyle(on ? NK.ground : .white.opacity(0.9))
        .padding(.horizontal, 10).frame(minHeight: 28)
        .background(Capsule().fill(on ? hue.glow : .white.opacity(0.1)))
    }
}

/// The gym's colour in the two-lane pictures: the Edzés world's own glow, so the two read as two areas.
private let gymColor = Hue.mozgas.glow

// MARK: - Ma

private struct SportMa: View {
    @Binding var moment: Moment
    let open: (SportDemoSheet) -> Void

    var body: some View {
        hero
        dayStrip
        week
        glassCard("AMIRE FIGYELEK") {
            VStack(alignment: .leading, spacing: 10) {
                hint("Reggel lábnap volt, este röpi: 10 óra van köztük, ez bőven elég.", ok: true)
                hint("Holnap reggel guggolós nap jön a ma esti röpi után — ha fáj a lábad, a Könnyítés egy koppintás.", ok: false)
            }
        }
        NKAskRow(hue: hue, text: "Kérdezd meg Boopot a sportodról") {}
    }

    private func hint(_ text: String, ok: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            NKGlyph(ok ? "check-sage" : "bolt-peach", .white, size: 16).padding(.top, 2)
            Text(text).nkFont(14).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder private var hero: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 18) {
                ring
                VStack(alignment: .leading, spacing: 4) {
                    NKMono(moment == .done ? "MA · KÉSZ" : moment == .skipped ? "MA · KIHAGYVA" : "MA ESTE · 18:00")
                    Text("Röplabda").font(.nkSerif(30)).foregroundStyle(.white)
                    Text("2 óra · edzés · Sportcsarnok").nkFont(13.5).foregroundStyle(.white.opacity(0.7))
                }
                Spacer(minLength: 0)
            }
            switch moment {
            case .before:
                HStack(spacing: 22) { bigNumber("6 ó 20 p", "múlva kezdődik"); bigNumber("3/4", "e heti röpi", lit: true) }
                Text("Indítsd el az órádon a Röplabda edzést — utána innen töltöm ki a naplót.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    NKPill("Ma kihagyom", primary: false) { open(.skip) }
                    NKPill("Rögzítem most", glyph: "plus-ink") { open(.log) }
                }
            case .after:
                HStack(spacing: 22) { bigNumber("1 ó 57 p", "18:04–20:01"); bigNumber("812", "kcal az órádról", lit: true); bigNumber("138", "átlagpulzus") }
                NKPill("Kiegészítem", glyph: "check-ink") { open(.log) }
            case .done:
                HStack(spacing: 22) { bigNumber("819", "terhelés", lit: true); bigNumber("812", "kcal"); bigNumber("5", "szett"); bigNumber("6/10", "váll") }
                HStack(spacing: 8) { Chip(text: "megterhelés 7"); Chip(text: "1 ó 57 p"); Chip(text: "az órádról") }
            case .skipped:
                HStack(spacing: 8) { Chip(text: "Fáradt voltam", on: true); Chip(text: "a heti szabad kihagyás") }
                NKPill("Visszavonás", primary: false) { moment = .before }
            }
        }
        .padding(18)
        .nkGlass(28)
    }

    /// The week's sport: four planned evenings, the lit share is what is done.
    private var ring: some View {
        let done = moment == .done ? 3.0 : 2.0
        return ZStack {
            Circle().stroke(.white.opacity(0.10), lineWidth: 10)
            Circle().trim(from: 0, to: done / 4)
                .stroke(AngularGradient(colors: [hue.glow.opacity(0.6), hue.glow, Color(hex: 0xFFD7B0)], center: .center),
                        style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            NKGlyph("ball-sun", .white, size: 30)
        }
        .frame(width: 84, height: 84)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("A heti négy röpiből \(Int(done)) megvan")
    }

    /// The day as a time strip: the gym and the sport as two separate blocks on one day.
    private var dayStrip: some View {
        glassCard("A NAPOD", trailing: "kondi + sport") {
            VStack(alignment: .leading, spacing: 12) {
                GeometryReader { g in
                    let w = g.size.width
                    let x: (Double) -> CGFloat = { h in CGFloat((h - 6) / 17) * w }
                    ZStack(alignment: .topLeading) {
                        Capsule().fill(.white.opacity(0.08)).frame(height: 8).offset(y: 22)
                        block("Kondi", "07:00", from: x(7), to: x(8.2), color: gymColor, done: true)
                        block("Röpi", "18:00", from: x(18), to: x(20), color: hue.glow, done: moment == .done)
                        ForEach([6, 12, 18, 23], id: \.self) { h in
                            Text("\(h)").nkFont(10.5).foregroundStyle(.white.opacity(0.45)).offset(x: x(Double(h)) - 6, y: 40)
                        }
                    }
                }
                .frame(height: 56)
                HStack(spacing: 16) {
                    legend("Kondi · Láb + kar", gymColor, done: true)
                    legend("Röpi · 2 óra", hue.glow, done: moment == .done)
                }
            }
        }
    }

    private func block(_ name: String, _ time: String, from: CGFloat, to: CGFloat, color: Color, done: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(time).nkFont(11, .semibold).foregroundStyle(.white.opacity(0.8))
            RoundedRectangle(cornerRadius: 6).fill(done ? color : color.opacity(0.35))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: done ? 0 : 1.5))
                .frame(width: max(18, to - from), height: 14)
        }
        .offset(x: from, y: 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name) \(time), \(done ? "kész" : "később")")
    }

    private func legend(_ text: String, _ color: Color, done: Bool) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text).nkFont(12.5).foregroundStyle(.white.opacity(0.8))
            if done { NKGlyph("check-sage", .white, size: 12) }
        }
    }

    private var week: some View {
        VStack(alignment: .leading, spacing: 10) {
            NKMono("EZEN A HÉTEN").padding(.horizontal, 4)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(SportFixtures.week) { d in dayCard(d) }
                }
                .padding(.horizontal, 2)
            }
        }
    }

    private func dayCard(_ d: SportFixtures.Day) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(d.name).nkFont(15, .semibold).foregroundStyle(.white)
                Spacer()
                if d.today { Text("MA").font(.nkMono(10, .semibold)).foregroundStyle(hue.glow) }
            }
            if let g = d.gym { laneRow(g, gymColor, done: d.gymDone) }
            if let s = d.sport { laneRow(s, hue.glow, done: d.sportDone) }
            if d.gym == nil && d.sport == nil { Text("pihenő").nkFont(12.5).foregroundStyle(.white.opacity(0.5)) }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(width: 132, height: 112, alignment: .topLeading)
        .nkGlass(20)
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(d.today ? hue.glow.opacity(0.7) : .clear, lineWidth: 1.5))
        .accessibilityElement(children: .combine)
    }

    private func laneRow(_ text: String, _ color: Color, done: Bool) -> some View {
        HStack(spacing: 6) {
            Circle().fill(done ? color : color.opacity(0.3)).frame(width: 8, height: 8)
                .overlay(Circle().stroke(color, lineWidth: done ? 0 : 1))
            Text(text).nkFont(12).foregroundStyle(.white.opacity(done ? 0.95 : 0.7)).lineLimit(1).minimumScaleFactor(0.8)
        }
    }
}

// MARK: - Hét

private struct SportHet: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 22) { bigNumber("9 ó 40 p", "heti mozgás"); bigNumber("5 ó 50 p", "kondi"); bigNumber("3 ó 50 p", "sport", lit: true) }
            twoLanes
            HStack(spacing: 16) {
                HStack(spacing: 6) { Circle().fill(gymColor).frame(width: 8, height: 8); Text("kondi").nkFont(12.5).foregroundStyle(.white.opacity(0.8)) }
                HStack(spacing: 6) { Circle().fill(hue.glow).frame(width: 8, height: 8); Text("sport").nkFont(12.5).foregroundStyle(.white.opacity(0.8)) }
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 2).stroke(.white.opacity(0.6), lineWidth: 1).frame(width: 10, height: 8); Text("tervben").nkFont(12.5).foregroundStyle(.white.opacity(0.8)) }
            }
        }
        .padding(18).nkGlass(28)
        glassCard("TERHELÉS · 6 HÉT", trailing: "megterhelés × perc") { loadBars }
        glassCard("A HÉT NAPJAI") {
            VStack(spacing: 0) {
                ForEach(SportFixtures.week) { d in
                    HStack(alignment: .firstTextBaseline) {
                        Text(d.name).nkFont(14, .semibold).foregroundStyle(.white).frame(width: 34, alignment: .leading)
                        VStack(alignment: .leading, spacing: 3) {
                            if let g = d.gym { Text("07:00 Kondi · \(g)").nkFont(13.5).foregroundStyle(.white.opacity(0.85)) }
                            if let s = d.sport { Text("18:00 \(s) · 2 óra").nkFont(13.5).foregroundStyle(hue.glow) }
                            if d.gym == nil && d.sport == nil { Text("pihenőnap").nkFont(13.5).foregroundStyle(.white.opacity(0.5)) }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 9)
                    if d.id != SportFixtures.week.last?.id { Divider().overlay(.white.opacity(0.08)) }
                }
            }
        }
    }

    /// Each day two lanes: the gym on top, the sport under it; filled = done, outlined = planned.
    private var twoLanes: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ForEach(SportFixtures.week) { d in
                VStack(spacing: 5) {
                    lane(minutes: d.gym == nil ? 0 : 70, color: gymColor, done: d.gymDone)
                    lane(minutes: d.sport == nil ? 0 : 120, color: hue.glow, done: d.sportDone)
                    Text(d.name).nkFont(11.5, d.today ? .semibold : .regular).foregroundStyle(d.today ? hue.glow : .white.opacity(0.65))
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(d.name): \(d.gym.map { "kondi \($0)" } ?? "nincs kondi"), \(d.sport.map { "\($0)" } ?? "nincs sport")")
            }
        }
        .frame(height: 150)
    }

    private func lane(minutes: Double, color: Color, done: Bool) -> some View {
        let h = CGFloat(minutes / 120) * 52
        return ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.05)).frame(height: 52)
            if minutes > 0 {
                RoundedRectangle(cornerRadius: 6).fill(done ? color : color.opacity(0.18))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(color, lineWidth: done ? 0 : 1.2))
                    .frame(height: h)
            }
        }
    }

    private var loadBars: some View {
        let weeks: [(String, Double, Double)] = [("okt 26", 1900, 2100), ("nov 2", 2050, 900), ("nov 9", 2200, 0),
                                                  ("nov 16", 2300, 1500), ("nov 23", 2350, 2400), ("ez", 1400, 1640)]
        return HStack(alignment: .bottom, spacing: 10) {
            ForEach(weeks, id: \.0) { w in
                VStack(spacing: 4) {
                    VStack(spacing: 2) {
                        RoundedRectangle(cornerRadius: 4).fill(hue.glow).frame(height: CGFloat(w.2 / 5000) * 110)
                        RoundedRectangle(cornerRadius: 4).fill(gymColor).frame(height: CGFloat(w.1 / 5000) * 110)
                    }
                    .frame(height: 110, alignment: .bottom)
                    Text(w.0).nkFont(10.5).foregroundStyle(.white.opacity(w.0 == "ez" ? 0.95 : 0.55)).lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Heti terhelés hat hétre: a sport része november 9-én nulla volt, ezen a héten eddig 1640.")
    }
}

// MARK: - Napló

private struct SportNaplo: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 22) { bigNumber("13", "alkalom · 4 hét"); bigNumber("6,4", "átlag megterhelés", lit: true); bigNumber("5,8", "váll átlag") }
            spark
            Text("A vállad az utolsó két hétben 7 fölé ment kétszer — ha tovább nő, szólok a kondinál is.")
                .nkFont(13).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
        }
        .padding(18).nkGlass(28)
        ForEach(SportFixtures.log) { s in session(s) }
    }

    private var spark: some View {
        let v: [Double] = [5, 6, 6, 5, 7, 6, 6, 7, 5, 8, 6, 7, 7]
        return GeometryReader { g in
            Path { p in
                for (i, y) in v.enumerated() {
                    let pt = CGPoint(x: g.size.width * CGFloat(i) / CGFloat(v.count - 1), y: g.size.height * (1 - CGFloat(y - 3) / 7))
                    i == 0 ? p.move(to: pt) : p.addLine(to: pt)
                }
            }
            .stroke(hue.glow, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
        }
        .frame(height: 54)
        .accessibilityLabel("A megterhelés íve az utolsó 13 alkalomban, 5 és 8 között")
    }

    private func session(_ s: SportFixtures.Logged) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    NKMono(s.date)
                    Text(s.title).font(.nkSerif(21)).foregroundStyle(.white)
                }
                Spacer()
                Text("\(s.load)").font(.nkNumber(30)).foregroundStyle(hue.glow).monospacedDigit()
            }
            HStack(spacing: 6) {
                Chip(text: s.duration); Chip(text: "megterhelés \(s.rpe)")
                if let sets = s.sets { Chip(text: "\(sets) szett") }
                if let sh = s.shoulder { Chip(text: "váll \(sh)") }
            }
            Text(s.kcalLine).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
        }
        .padding(16).nkGlass(24)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Beosztás

private struct SportBeosztas: View {
    let toast: (String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKMono("A HETI REND")
            HStack(spacing: 6) {
                ForEach(Array(["H", "K", "Sz", "Cs", "P", "Sz", "V"].enumerated()), id: \.offset) { i, n in
                    let sport = [0, 1, 2, 4].contains(i)
                    let gym = i < 5
                    VStack(spacing: 6) {
                        Text(n).nkFont(12.5, .semibold).foregroundStyle(.white.opacity(0.8))
                        Circle().fill(gym ? gymColor : .white.opacity(0.08)).frame(width: 12, height: 12)
                        Circle().fill(sport ? hue.glow : .white.opacity(0.08)).frame(width: 12, height: 12)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.05)))
                }
            }
            Text("Felső pötty: kondi (az Évadban állítod) · alsó: sport (itt).").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
        }
        .padding(18).nkGlass(28)
        glassCard("RENDSZERES ALKALMAK", trailing: "4") {
            VStack(spacing: 0) {
                ForEach(["Hétfő", "Kedd", "Szerda", "Péntek"], id: \.self) { d in
                    Button { toast("Itt nyílik az alkalom szerkesztője") } label: {
                        HStack {
                            NKGlyph("ball-sun", .white, size: 18)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(d) 18:00 · Röplabda").nkFont(15, .medium).foregroundStyle(.white)
                                Text("2 óra · edzés · Sportcsarnok").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(.white.opacity(0.4))
                        }
                        .padding(.vertical, 10).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                NKPill("Új rendszeres alkalom", glyph: "plus-ink", primary: false) { toast("Sport · nap · idő · hossz · edzés vagy meccs · hely") }
                    .padding(.top, 8)
            }
        }
        glassCard("EGYSZERI ESEMÉNYEK", trailing: "1") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(spacing: 0) {
                        Text("DEC").font(.nkMono(10, .semibold)).foregroundStyle(hue.glow)
                        Text("13").font(.nkNumber(26)).foregroundStyle(.white)
                    }
                    .frame(width: 50, height: 54).background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.08)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Röpi torna · meccs").nkFont(15, .medium).foregroundStyle(.white)
                        Text("szombat 09:00 · 6 óra · Budaörs").nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                        Text("Aznap és előtte nem teszek nehéz lábnapot.").nkFont(12.5).foregroundStyle(hue.glow)
                    }
                }
                NKPill("Új esemény", glyph: "plus-ink", primary: false) { toast("Egy dátumos alkalom, például torna") }
            }
        }
        glassCard("MILYEN SPORTOT ÍRHATSZ BE") {
            FlowChips(items: ["Röplabda", "Futás", "Cross", "TRX", "Kerékpár", "Úszás", "Foci", "Kosár", "Tenisz", "Túra", "Egyéb"])
        }
    }
}

private struct FlowChips: View {
    let items: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(stride(from: 0, to: items.count, by: 4)), id: \.self) { i in
                HStack(spacing: 8) { ForEach(items[i..<min(i + 4, items.count)], id: \.self) { Chip(text: $0, on: $0 == "Röplabda") } }
            }
        }
    }
}

// MARK: - States

private struct SportEmpty: View {
    let start: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            NKGlyph("ball-sun", .white, size: 34)
            Text("Mikor sportolsz?").font(.nkSerif(26)).foregroundStyle(.white)
            Text("Írd be a heti rendedet — például röpi hétfőn 18:00-kor. Utána mellé teszem a kondit, és röpi után az órád adataiból kitöltöm a naplót.")
                .nkFont(14.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
            NKPill("Beosztás megadása", glyph: "plus-ink", action: start)
        }
        .padding(20).nkGlass(28)
    }
}

private struct SportLoading: View {
    var body: some View {
        ForEach(0..<3, id: \.self) { i in
            RoundedRectangle(cornerRadius: 24).fill(.white.opacity(0.06)).frame(height: i == 0 ? 220 : 110)
        }
        .redacted(reason: .placeholder)
        .accessibilityLabel("Töltöm")
    }
}

private struct SportError: View {
    let retry: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nem érem el a sportodat").font(.nkSerif(22)).foregroundStyle(.white)
            Text("A szerver most nem válaszolt. A rögzítés így is megy, elteszem és később elküldöm.").nkFont(14).foregroundStyle(.white.opacity(0.75))
            NKPill("Újra", primary: false, action: retry)
        }
        .padding(20).nkGlass(28)
    }
}

// MARK: - Sheets

private struct SportLogSheet: View {
    let prefilled: Bool
    let save: () -> Void
    @State private var sport = "Röplabda"
    @State private var rpe = 7
    @State private var sets = 5
    @State private var shoulder = 6
    @State private var note = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NKMono("SPORT RÖGZÍTÉSE")
                Text(prefilled ? "Röplabda · ma 18:04" : "Mit sportoltál?").font(.nkSerif(28)).foregroundStyle(.white)
                if prefilled {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) { NKGlyph("check-sage", .white, size: 14); Text("Az órádról").nkFont(13, .semibold).foregroundStyle(.white) }
                        HStack(spacing: 22) { bigNumber("1 ó 57 p", "18:04–20:01"); bigNumber("812", "kcal", lit: true); bigNumber("138", "átlagpulzus") }
                    }
                    .padding(16).nkGlass(22)
                } else {
                    FlowChips(items: ["Röplabda", "Futás", "Cross", "TRX", "Kerékpár", "Úszás", "Foci", "Kosár"])
                    row("Mennyi ideig?") { Text("1 ó 30 p").font(.nkNumber(24)).foregroundStyle(.white) }
                }
                row("Milyen nehéz volt?", sub: rpeWord) {
                    HStack(spacing: 4) {
                        ForEach(1...10, id: \.self) { n in
                            Button { rpe = n } label: {
                                Text("\(n)").nkFont(14, n == rpe ? .semibold : .regular)
                                    .foregroundStyle(n == rpe ? NK.ground : .white.opacity(0.85))
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(n == rpe ? hue.glow : .white.opacity(0.08)))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Megterhelés \(n)")
                            .accessibilityAddTraits(n == rpe ? .isSelected : [])
                        }
                    }
                }
                row("Hány szettet játszottál?") { NKInlineStepperDemo(value: $sets) }
                row("Hogy bírta a vállad?", sub: shoulder >= 7 ? "erősen terhelt" : "rendben") { NKInlineStepperDemo(value: $shoulder, range: 1...10) }
                row("Jegyzet") {
                    TextField("", text: $note, prompt: Text("például: sok ütés a hálónál").foregroundStyle(.white.opacity(0.4)))
                        .nkFont(15).foregroundStyle(.white).padding(12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.07)))
                }
                NKPill("Mentés", glyph: "check-ink", action: save).padding(.top, 6)
            }
            .padding(22)
        }
    }

    private var rpeWord: String { rpe <= 3 ? "könnyű" : rpe <= 6 ? "közepes" : rpe <= 8 ? "kemény" : "a határon" }

    private func row<C: View>(_ title: String, sub: String? = nil, @ViewBuilder _ c: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).nkFont(15.5, .medium).foregroundStyle(.white)
                Spacer()
                if let sub { Text(sub).nkFont(13).foregroundStyle(hue.glow) }
            }
            c()
        }
    }
}

private struct NKInlineStepperDemo: View {
    @Binding var value: Int
    var range: ClosedRange<Int> = 0...50
    var body: some View {
        HStack(spacing: 18) {
            step("−") { value = max(range.lowerBound, value - 1) }
            Text("\(value)").font(.nkNumber(30)).foregroundStyle(.white).frame(minWidth: 44)
            step("+") { value = min(range.upperBound, value + 1) }
            Spacer()
        }
    }
    private func step(_ t: String, _ a: @escaping () -> Void) -> some View {
        Button(action: a) {
            Text(t).font(.system(size: 22, weight: .medium)).foregroundStyle(.white)
                .frame(width: 48, height: 44).background(Circle().fill(.white.opacity(0.1)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(t == "+" ? "Több" : "Kevesebb")
    }
}

private struct SportSkipSheet: View {
    let done: () -> Void
    @State private var reason = "Fáradt vagyok"
    private let reasons = ["Beteg vagyok", "Gyomorpanasz", "Sérülés", "Utazom", "Fáradt vagyok", "Nincs időm", "Nincs kedvem", "Egyéb"]
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            NKMono("MA ESTE · RÖPLABDA")
            Text("Kihagyod a mai röpit?").font(.nkSerif(28)).foregroundStyle(.white)
            Text("Az ok nem kötelező, de segít: betegségnél nem számít kihagyásnak, és a kondit is ehhez igazítom.")
                .nkFont(14).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(stride(from: 0, to: reasons.count, by: 2)), id: \.self) { i in
                    HStack(spacing: 8) {
                        ForEach(reasons[i..<min(i + 2, reasons.count)], id: \.self) { r in
                            Button { reason = r } label: {
                                Text(r).nkFont(14.5, r == reason ? .semibold : .regular)
                                    .foregroundStyle(r == reason ? NK.ground : .white)
                                    .frame(maxWidth: .infinity, minHeight: 46)
                                    .background(Capsule().fill(r == reason ? hue.glow : .white.opacity(0.09)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            Spacer()
            NKPill("Kihagyom", action: done)
        }
        .padding(22)
    }
}

// MARK: - Fixtures (invented)

private enum SportFixtures {
    struct Day: Identifiable { let id: Int; let name: String; let gym: String?; let gymDone: Bool; let sport: String?; let sportDone: Bool; var today = false }
    struct Logged: Identifiable { let id: Int; let date: String; let title: String; let load: Int; let duration: String; let rpe: Int; let sets: Int?; let shoulder: Int?; let kcalLine: String }

    static let week: [Day] = [
        Day(id: 0, name: "Hé", gym: "Hát", gymDone: true, sport: "Röpi", sportDone: true),
        Day(id: 1, name: "Ke", gym: "Láb + kar", gymDone: true, sport: "Röpi", sportDone: true),
        Day(id: 2, name: "Sze", gym: "Mell + bicepsz", gymDone: true, sport: "Röpi", sportDone: false, today: true),
        Day(id: 3, name: "Csü", gym: "Bicepsz fókusz", gymDone: false, sport: nil, sportDone: false),
        Day(id: 4, name: "Pé", gym: "Tricepsz + core", gymDone: false, sport: "Röpi", sportDone: false),
        Day(id: 5, name: "Szo", gym: nil, gymDone: false, sport: nil, sportDone: false),
        Day(id: 6, name: "Va", gym: nil, gymDone: false, sport: nil, sportDone: false),
    ]

    static let log: [Logged] = [
        Logged(id: 0, date: "KEDD · NOV 24", title: "Röplabda", load: 780, duration: "2 ó", rpe: 6, sets: 5, shoulder: 7, kcalLine: "806 kcal az órádról · átlagpulzus 134"),
        Logged(id: 1, date: "HÉTFŐ · NOV 23", title: "Röplabda", load: 840, duration: "2 ó", rpe: 7, sets: 6, shoulder: 6, kcalLine: "841 kcal az órádról · átlagpulzus 141"),
        Logged(id: 2, date: "PÉNTEK · NOV 20", title: "Röplabda", load: 600, duration: "1 ó 40 p", rpe: 6, sets: 4, shoulder: 5, kcalLine: "520 kcal becslés"),
        Logged(id: 3, date: "SZERDA · NOV 18", title: "Futás", load: 225, duration: "45 p", rpe: 5, sets: nil, shoulder: nil, kcalLine: "410 kcal az órádról · átlagpulzus 152"),
    ]
}

#if DEBUG
/// `-previewSport YES`: the Sport area alone, no sign-in.
struct SportPreviewRoot: View {
    var body: some View { NavigationStack { SportDemoRoom() } }
}
#endif
