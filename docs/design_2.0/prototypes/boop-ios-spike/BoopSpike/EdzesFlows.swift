import SwiftUI

// B5 Edzés spike — the sheets: swapping an exercise mid-workout, skipping with a reason, kímélő mode,
// the block builder, an exercise, the block report, comparing two blocks, the muscle map, a sport session.

/// The shared sheet frame: a short photo head, a title, then the content.
struct WSheetFrame<C: View>: View {
    let eyebrow: String, title: String
    var photoName: String? = WHue.mood
    @ViewBuilder let content: () -> C
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    WPhotoHead(photoName: photoName, height: 170)
                    VStack(spacing: 6) {
                        GLabel(eyebrow)
                        Text(title).font(AuraFont.serif(26)).foregroundStyle(.white)
                            .multilineTextAlignment(.center).padding(.horizontal, 24)
                    }
                    .padding(.top, 46)
                }
                VStack(spacing: 14) { content() }
                    .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(gPageBackground(WHue.top).ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

// MARK: - Swap an exercise mid-workout

struct WSwapSheet: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var scope = 0
    @State private var picked: String?

    private let options: [(String, String?, String)] = [
        ("Incline Dumbbell Press", "gyak-incline-db-press.jpg", "ugyanaz az izom, kézisúlyzóval"),
        ("Landmine Press", nil, "válltámogató, ha a gép foglalt"),
        ("Overhead Press", "gyak-overhead-press.jpg", "több váll, kevesebb mell"),
        ("Dumbbell Bench Press", nil, "ugyanaz, szabadabb mozgás"),
    ]

    var body: some View {
        WSheetFrame(eyebrow: "EDZÉS KÖZBEN", title: "Mire cseréljük?", photoName: "edz-oltozo.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                Text("A fekvenyomás helyett. Olyanokat ajánlok, amik ugyanazt az izmot viszik, és a súlyajánlás is átszámol.")
                    .font(.system(size: 14.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                    .padding(.horizontal, 2)

                VStack(spacing: 0) {
                    ForEach(Array(options.enumerated()), id: \.offset) { i, o in
                        if i > 0 { Divider().overlay(.white.opacity(0.09)).padding(.vertical, 11) }
                        Button { withAnimation { picked = o.0 } } label: {
                            HStack(spacing: 12) {
                                WThumb(name: o.1, size: 42)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(o.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                    Text(o.2).font(.system(size: 12)).foregroundStyle(.white.opacity(0.58))
                                }
                                Spacer(minLength: 0)
                                ZStack {
                                    Circle().stroke(.white.opacity(picked == o.0 ? 0 : 0.3), lineWidth: 1.5)
                                    if picked == o.0 {
                                        Circle().fill(.white)
                                        AuraGlyph("check-ink", gBase, size: 13)
                                    }
                                }
                                .frame(width: 24, height: 24)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                VStack(alignment: .leading, spacing: 10) {
                    GLabel("MEDDIG TARTSON")
                    HStack(spacing: 7) {
                        ForEach(Array(["Csak most", "A blokk végéig"].enumerated()), id: \.offset) { i, s in
                            let on = scope == i
                            Button { withAnimation { scope = i } } label: {
                                Text(s).font(.system(size: 13.5, weight: on ? .semibold : .regular))
                                    .foregroundStyle(on ? gBase : .white.opacity(0.85))
                                    .padding(.vertical, 11).frame(maxWidth: .infinity)
                                    .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Text(scope == 0 ? "Ma cserélünk, legközelebb visszaáll a fekvenyomás."
                                    : "A terv is átíródik: a blokk hátralévő Push napjain ez lesz.")
                        .font(.system(size: 13)).foregroundStyle(.white.opacity(0.62))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                GPill(title: "Cserélem", glyph: "repeat-deep") {
                    onToast(picked == nil ? "Válassz gyakorlatot" : "\(picked!) · \(scope == 0 ? "csak ma" : "a blokk végéig")")
                    if picked != nil { dismiss() }
                }
            }
        }
    }
}

// MARK: - Skip with a reason

struct WSkipSheet: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var reason: String?
    @State private var other = ""

    private let serious = ["Beteg vagyok", "Gyomorrontás", "Megsérültem", "Úton vagyok"]
    private let soft = ["Fáradt vagyok", "Nincs időm", "Nincs kedvem", "Más"]

    var body: some View {
        WSheetFrame(eyebrow: "MAI EDZÉS", title: "Kihagyod — miért?", photoName: "aura-hegy.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                Text("Már ki van hagyva, ezt csak azért kérdem, hogy tudjam, mit jelent. Nem kell indokolnod, és nem von le semmit.")
                    .font(.system(size: 14.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                    .padding(.horizontal, 2)

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("KOMOLY OK")
                    WChips(options: serious, selected: $reason)
                    Text("Ezeknél felajánlom a kímélő módot is, és a tervet elcsúsztatom, nem lemaradásnak veszem.")
                        .font(.system(size: 12.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.6))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("EGYSZERŰBB OK")
                    WChips(options: soft, selected: $reason)
                    if reason == "Más" {
                        TextField("", text: $other, prompt: Text("Írd le egy sorban").foregroundStyle(.white.opacity(0.4)))
                            .font(.system(size: 15)).foregroundStyle(.white)
                            .padding(13)
                            .background(RoundedRectangle(cornerRadius: 13).fill(.white.opacity(0.07)))
                    }
                    Text("A hét első ilyenje szabad — ebből nem lesz semmi. Utána is csak annyi történik, hogy tudom.")
                        .font(.system(size: 12.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.6))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                GPill(title: "Megvan", glyph: "check-ink") {
                    onToast(reason == nil ? "Kihagyva, ok nélkül" : "Kihagyva · \(reason!)")
                    dismiss()
                }
                Button { onToast("Kihagyva, ok nélkül"); dismiss() } label: {
                    Text("Nem mondom meg").font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6)).underline()
                }
                .buttonStyle(.plain).frame(maxWidth: .infinity)
            }
        }
    }
}

struct WChips: View {
    let options: [String]
    @Binding var selected: String?
    var body: some View {
        FlowRow(spacing: 7) {
            ForEach(options, id: \.self) { o in
                let on = selected == o
                Button { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { selected = on ? nil : o } } label: {
                    Text(o).font(.system(size: 13.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? gBase : .white.opacity(0.85))
                        .padding(.horizontal, 13).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Kímélő mode

struct WKimeloSheet: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var kind: String?
    @State private var days = 3

    var body: some View {
        WSheetFrame(eyebrow: "KÍMÉLŐ MÓD", title: "Mi történt?", photoName: "aura-hegy.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                Text("Amíg be van kapcsolva, nem várok tőled edzést, az étkezést sem értékelem szigorúan, és utána lépésenként hozlak vissza.")
                    .font(.system(size: 14.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                    .padding(.horizontal, 2)

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("AZ OK")
                    WChips(options: ["Beteg vagyok", "Gyomorrontás", "Megsérültem", "Úton vagyok"], selected: $kind)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                VStack(alignment: .leading, spacing: 12) {
                    GLabel("MEDDIG, SZERINTED")
                    HStack(spacing: 0) {
                        WStepButton(symbol: "minus") { days = max(1, days - 1) }
                        Spacer(minLength: 0)
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\(days)").font(.custom("Outfit", size: 40).weight(.medium))
                                .foregroundStyle(.white).monospacedDigit()
                            Text("nap").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer(minLength: 0)
                        WStepButton(symbol: "plus") { days = min(21, days + 1) }
                    }
                    Text("Nem kell eltalálnod. Bármikor leállíthatod azzal, hogy jobban vagy.")
                        .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.6))
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                VStack(alignment: .leading, spacing: 10) {
                    GLabel("AMI EZ ALATT TÖRTÉNIK")
                    WKimeloLine(text: "A \(days) napra eső edzések kimaradnak, és nem számítanak lemaradásnak.")
                    WKimeloLine(text: "A blokkod nem fut el: ahol tartasz, ott vár.")
                    WKimeloLine(text: "Ha mégis edzenél egy nap, azt egy koppintással engedem — könnyítve.")
                    WKimeloLine(text: "Visszatéréskor az első két edzés könnyebb: kevesebb sorozat, nagyobb tartalék.")
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                GPill(title: "Bekapcsolom", glyph: "heart-berry") {
                    onToast(kind == nil ? "Válassz okot" : "Kímélő mód be · \(days) nap")
                    if kind != nil { dismiss() }
                }
            }
        }
    }
}

struct WKimeloLine: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            AuraGlyph("check-ink", .white.opacity(0.6), size: 14).padding(.top, 1)
            Text(text).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.78))
        }
    }
}

// MARK: - The block builder

struct WMesoWizard: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var stepIdx = 0
    @State private var days = 5
    @State private var weeks = 8
    @State private var emphasis: Set<String> = ["Hát", "Bicepsz"]

    private let muscles = ["Mell", "Hát", "Váll", "Bicepsz", "Tricepsz", "Láb", "Törzs"]

    var body: some View {
        WSheetFrame(eyebrow: "ÚJ BLOKK · \(stepIdx + 1)/4", title: title, photoName: "edz-sulyzo.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                switch stepIdx {
                case 0:
                    WWizardText("Hány napot tudsz rászánni egy héten? Ebből jön ki, hogyan osztom szét az izomcsoportokat.")
                    WCountCard(label: "HETI EDZÉSNAP", value: days, unit: days == 1 ? "nap" : "nap",
                               down: { days = max(2, days - 1) }, up: { days = min(6, days + 1) })
                    WWizardNote(text: days >= 5 ? "Öt napnál minden izomcsoport kétszer kerül sorra — ez a leghatékonyabb osztás."
                                                : "Ennyi napnál összevontabb napok lesznek, több izom egy edzésen.")
                case 1:
                    WWizardText("Milyen hosszú legyen a blokk? A végére mindig teszek egy könnyű hetet, hogy ki tudd pihenni.")
                    WCountCard(label: "HETEK", value: weeks, unit: "hét",
                               down: { weeks = max(4, weeks - 1) }, up: { weeks = min(12, weeks + 1) })
                    WWizardNote(text: "\(weeks) hét: \(weeks - 1) hét emelkedő munka, az utolsó könnyű levezetés.")
                case 2:
                    WWizardText("Mit szeretnél leginkább fejleszteni? Legfeljebb kettőt válassz — ha mindent hangsúlyozunk, semmit nem hangsúlyozunk.")
                    VStack(alignment: .leading, spacing: 12) {
                        GLabel("HANGSÚLY · \(emphasis.count)/2")
                        WFlowChips(options: muscles, selected: $emphasis, max: 2)
                    }
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                    WWizardNote(text: emphasis.isEmpty ? "Hangsúly nélkül minden izom egyenlően fejlődik."
                                : "\(emphasis.sorted().joined(separator: " és ")) többet kap, a többi megtartó mennyiséget.")
                default:
                    WWizardText("Ezt állítottam össze. Minden napot és gyakorlatot átírhatsz, mielőtt elindítjuk.")
                    VStack(spacing: 0) {
                        ForEach(Array(["Upper", "Lower", "Push", "Pull", "Legs"].prefix(days).enumerated()), id: \.offset) { i, d in
                            if i > 0 { Divider().overlay(.white.opacity(0.09)).padding(.vertical, 11) }
                            HStack(spacing: 12) {
                                ZStack { Circle().fill(.white.opacity(0.08))
                                    Text("\(i + 1)").font(.custom("Outfit", size: 14).weight(.medium))
                                        .foregroundStyle(.white.opacity(0.8)) }
                                    .frame(width: 34, height: 34)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(d).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                                    Text("\(5 + (i % 2)) gyakorlat · \(16 + i) sorozat")
                                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.58))
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                        }
                    }
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
                    WWizardNote(text: "A gyakorlatokat a könyvtárból válogattam, a hangsúlyaid szerint. A súlyokat az első edzésen a korábbi adataidból számolom.")
                }

                HStack(spacing: 10) {
                    Spacer(minLength: 0)
                    if stepIdx > 0 {
                        GPill(title: "Vissza", primary: false) { withAnimation { stepIdx -= 1 } }
                    }
                    GPill(title: stepIdx == 3 ? "Elindítom" : "Tovább",
                          glyph: stepIdx == 3 ? "check-ink" : nil) {
                        if stepIdx == 3 { onToast("Blokk elindítva · \(weeks) hét, heti \(days) nap"); dismiss() }
                        else { withAnimation { stepIdx += 1 } }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.top, 4)
            }
        }
    }

    private var title: String {
        ["Hány nap egy héten?", "Milyen hosszan?", "Mire megy a hangsúly?", "Így néz ki"][stepIdx]
    }
}

struct WWizardText: View {
    let t: String
    init(_ t: String) { self.t = t }
    var body: some View {
        Text(t).font(.system(size: 14.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
            .padding(.horizontal, 2)
    }
}

struct WWizardNote: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            AuraGlyph("spark-sage", .white.opacity(0.75), size: 15)
            Text(text).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.75))
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06)))
    }
}

struct WCountCard: View {
    let label: String
    let value: Int
    let unit: String
    let down: () -> Void, up: () -> Void
    var body: some View {
        VStack(spacing: 10) {
            GLabel(label)
            HStack(spacing: 0) {
                WStepButton(symbol: "minus", action: down)
                Spacer(minLength: 0)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(value)").font(.custom("Outfit", size: 46).weight(.medium))
                        .foregroundStyle(.white).monospacedDigit()
                    Text(unit).font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.6))
                }
                Spacer(minLength: 0)
                WStepButton(symbol: "plus", action: up)
            }
        }
        .padding(20).frame(maxWidth: .infinity).gCard()
    }
}

struct WFlowChips: View {
    let options: [String]
    @Binding var selected: Set<String>
    let max: Int
    var body: some View {
        FlowRow(spacing: 7) {
            ForEach(options, id: \.self) { o in
                let on = selected.contains(o)
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                        if on { selected.remove(o) } else if selected.count < max { selected.insert(o) }
                    }
                } label: {
                    Text(o).font(.system(size: 13.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? gBase : .white.opacity(selected.count >= max ? 0.45 : 0.85))
                        .padding(.horizontal, 13).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - One exercise

struct WExerciseSheet: View {
    let onToast: (String) -> Void
    var body: some View {
        WSheetFrame(eyebrow: "GYAKORLAT", title: "Barbell Bench Press",
                    photoName: "gyak-barbell-bench-press.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                WSection(n: 1, label: "A TE SZÁMAID") {
                    VStack(spacing: 12) {
                        WFinishRow(label: "Legnagyobb munkasúly", value: "70 kg × 8")
                        WFinishRow(label: "Becsült 1 ismétlés maximum", value: "88,4 kg")
                        WFinishRow(label: "Összes sorozat", value: "64")
                        WFinishRow(label: "Legutóbb", value: "ma · 70 kg × 8")
                    }
                }
                WSection(n: 2, label: "A HALADÁS") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .bottom, spacing: 7) {
                            ForEach(Array([0.52, 0.58, 0.56, 0.64, 0.7, 0.68, 0.76, 0.82].enumerated()), id: \.offset) { _, v in
                                Capsule()
                                    .fill(LinearGradient(colors: [WHue.glow.opacity(0.9), WHue.sky[2].opacity(0.7)],
                                                         startPoint: .top, endPoint: .bottom))
                                    .frame(width: 16, height: 90 * v)
                            }
                        }
                        .frame(height: 96, alignment: .bottom)
                        Text("Nyolc hét alatt 60-ról 70 kg-ra. A sáv tetején mindig emelek, az alján tartok.")
                            .font(.system(size: 13)).lineSpacing(2).foregroundStyle(.white.opacity(0.62))
                    }
                }
                WSection(n: 3, label: "A SAJÁT JEGYZETED") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Lapockát hátra, a rúd a mellcsont alsó harmadára. A 3-as lyuk a padon.")
                            .font(.system(size: 15)).lineSpacing(2).foregroundStyle(.white.opacity(0.9))
                        Button { onToast("Jegyzet szerkesztése") } label: {
                            Text("Átírom").font(.system(size: 14, weight: .medium))
                                .foregroundStyle(.white.opacity(0.65)).underline()
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

// MARK: - The block report

struct WMesoReport: View {
    let onToast: (String) -> Void
    var body: some View {
        WSheetFrame(eyebrow: "LEZÁRT BLOKK", title: "Hypertrophy · Ősz", photoName: "edz-oltozo.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Hat hét, 23 edzés a tervezett 30-ból. A hát és a mell nőtt, a láb lemaradt — a kihagyott napok többsége lábnap volt.")
                        .font(AuraFont.serif(19)).lineSpacing(3).foregroundStyle(.white)
                    Text("Boop értékelése")
                        .font(AuraFont.mono(11)).tracking(1.4).foregroundStyle(.white.opacity(0.5))
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading).gCard()

                WSection(n: 1, label: "A SZÁMOK") {
                    VStack(spacing: 12) {
                        WFinishRow(label: "Megtartott edzések", value: "23 / 30")
                        WFinishRow(label: "Összes emelt súly", value: "164 tonna")
                        WFinishRow(label: "Új csúcsok", value: "5 gyakorlaton")
                        WFinishRow(label: "Átlagos edzéshossz", value: "1 ó 06 p")
                    }
                }

                WSection(n: 2, label: "MI NŐTT") {
                    VStack(spacing: 16) {
                        WGrowthRow(name: "Fekvenyomás", from: "60 kg", to: "70 kg", good: true)
                        WGrowthRow(name: "Evezés", from: "75 kg", to: "85 kg", good: true)
                        WGrowthRow(name: "Vállból nyomás", from: "40 kg", to: "42,5 kg", good: true)
                        WGrowthRow(name: "Guggolás", from: "95 kg", to: "95 kg", good: false)
                    }
                }

                WSection(n: 3, label: "MIT VIGYÜNK TOVÁBB") {
                    VStack(alignment: .leading, spacing: 12) {
                        WKimeloLine(text: "A lábnap kerüljön a hét elejére — pénteken rendre kimaradt.")
                        WKimeloLine(text: "A hát jól reagált a nagyobb mennyiségre: maradhat hangsúlyban.")
                        WKimeloLine(text: "A tricepsz utolsó sorozata rendszeresen elfogyott: eggyel kevesebb, de nehezebb.")
                    }
                }
            }
        }
    }
}

struct WGrowthRow: View {
    let name: String, from: String, to: String
    let good: Bool
    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                Text(good ? "nőtt" : "nem mozdult").font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.5))
            }
            Spacer(minLength: 0)
            HStack(spacing: 7) {
                Text(from).font(.custom("Outfit", size: 14)).foregroundStyle(.white.opacity(0.5))
                Image(systemName: "arrow.right").font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.4))
                Text(to).font(.custom("Outfit", size: 16).weight(.medium))
                    .foregroundStyle(good ? Color(hex: 0xF4C860) : .white.opacity(0.7))
            }
            .fixedSize()
        }
    }
}

// MARK: - Compare two blocks

struct WCompareSheet: View {
    var body: some View {
        WSheetFrame(eyebrow: "ÖSSZEHASONLÍTÁS", title: "Ősz és a mostani", photoName: "edz-oltozo.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                WSection(n: 1, label: "EGYMÁS MELLETT") {
                    VStack(spacing: 14) {
                        WCompareRow(label: "Megtartott edzések", a: "23 / 30", b: "3 / 10", better: 1)
                        WCompareRow(label: "Heti átlag", a: "3,8", b: "1,5", better: 0)
                        WCompareRow(label: "Összes emelt súly", a: "164 t", b: "28 t", better: 0)
                        WCompareRow(label: "Átlagos hossz", a: "1 ó 06 p", b: "1 ó 08 p", better: 1)
                    }
                }
                HStack(alignment: .top, spacing: 10) {
                    AuraGlyph("spark-sage", .white.opacity(0.8), size: 16)
                    Text("A mostani blokk még csak a 2. hetében van, úgyhogy a mennyiség nem hasonlítható. Ami összevethető: az ősszel átlag heti négy edzés volt, most másfél.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06)))
            }
        }
    }
}

struct WCompareRow: View {
    let label: String, a: String, b: String
    let better: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label).font(.system(size: 13)).foregroundStyle(.white.opacity(0.65))
            HStack(spacing: 10) {
                WCompareCell(title: "Ősz", value: a, win: better == 0)
                WCompareCell(title: "Most", value: b, win: better == 1)
            }
        }
    }
}

struct WCompareCell: View {
    let title: String, value: String
    let win: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(AuraFont.mono(10)).tracking(1.2).foregroundStyle(.white.opacity(0.5))
            Text(value).font(.custom("Outfit", size: 18).weight(.medium))
                .foregroundStyle(win ? Color(hex: 0xF4C860) : .white)
        }
        .padding(13).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(win ? 0.1 : 0.06)))
    }
}

// MARK: - The muscle map

struct WMuscleMapSheet: View {
    var body: some View {
        WSheetFrame(eyebrow: "IZOMTÉRKÉP", title: "Mi kapott sokat", photoName: "edz-oltozo.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                WSection(n: 1, label: "AZ ELMÚLT HÉT") {
                    VStack(spacing: 13) {
                        ForEach(Array(WData.volume.enumerated()), id: \.offset) { _, v in
                            let frac = Double(v.1) / Double(v.4)
                            HStack(spacing: 12) {
                                Text(v.0).font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                                    .frame(width: 72, alignment: .leading)
                                GeometryReader { g in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(.white.opacity(0.1))
                                        Capsule()
                                            .fill(LinearGradient(colors: [WHue.glow.opacity(0.85), WHue.sky[2].opacity(0.8)],
                                                                 startPoint: .leading, endPoint: .trailing))
                                            .frame(width: g.size.width * min(1, frac))
                                    }
                                }
                                .frame(height: 10)
                                Text("\(v.1)").font(.custom("Outfit", size: 14).weight(.medium))
                                    .foregroundStyle(.white).frame(width: 24, alignment: .trailing)
                            }
                        }
                    }
                }
                HStack(alignment: .top, spacing: 10) {
                    AuraGlyph("person-sage", .white.opacity(0.8), size: 16)
                    Text("A hát és a váll van a legközelebb a felső határához — ez a blokk hangsúlya, így van rendben. A láb a legalacsonyabb, mert a lábnapok maradtak ki.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06)))
            }
        }
    }
}

// MARK: - A sport session

struct WSportSheet: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var minutes = 90
    @State private var sets = 2
    @State private var effort = 7

    var body: some View {
        WSheetFrame(eyebrow: "SPORT", title: "Röplabda", photoName: "edz-ropi-terem-sq.jpg") {
            VStack(alignment: .leading, spacing: 14) {
                WCountCard(label: "HOSSZ", value: minutes, unit: "perc",
                           down: { minutes = max(15, minutes - 15) }, up: { minutes = min(240, minutes + 15) })
                WCountCard(label: "SZETTEK", value: sets, unit: "szett",
                           down: { sets = max(0, sets - 1) }, up: { sets = min(9, sets + 1) })
                VStack(alignment: .leading, spacing: 12) {
                    GLabel("MENNYIRE VOLT NEHÉZ")
                    HStack(spacing: 5) {
                        ForEach(1...10, id: \.self) { i in
                            Button { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { effort = i } } label: {
                                Text("\(i)").font(.system(size: 13, weight: i == effort ? .semibold : .regular))
                                    .foregroundStyle(i == effort ? gBase : .white.opacity(0.8))
                                    .frame(maxWidth: .infinity).frame(height: 38)
                                    .background(Capsule().fill(i == effort ? .white.opacity(0.95) : .white.opacity(0.1)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

                HStack(alignment: .top, spacing: 10) {
                    AuraGlyph("bolt-sun", .white.opacity(0.8), size: 16)
                    Text("Ebből körülbelül 620 kalóriát számolok, és beleveszem a mai keretedbe — vagyis ma többet ehetsz.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.8))
                }
                .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06)))

                GPill(title: "Rögzítem", glyph: "check-ink") {
                    onToast("Röplabda · \(minutes) perc rögzítve")
                    dismiss()
                }
            }
        }
    }
}
