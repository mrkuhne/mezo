import SwiftUI

// B4 Étel spike — the flows: the capture composer (five entrances, offline), the barcode scanner and
// its serving confirmation, the recipe-import review, the sensitivity settings, the skip sheet and
// the supplement editor.

/// The shared sheet frame: a photo head (Képek §3.1 — sheet heads get the mood photo), a title, content.
struct ESheetFrame<C: View>: View {
    var eyebrow: String
    var title: String
    var photoName: String? = EHue.mood
    @ViewBuilder var content: () -> C
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    EPhotoHead(photoName: photoName, height: 170)
                    VStack(alignment: .leading, spacing: 6) {
                        GLabel(eyebrow)
                        Text(title).font(AuraFont.serif(28)).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.horizontal, 22).padding(.bottom, 18)
                }
                VStack(alignment: .leading, spacing: 14) { content() }
                    .padding(20).padding(.bottom, 36)
            }
        }
        .scrollIndicators(.hidden)
        .background(gPageBackground(EHue.top).ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .preferredColorScheme(.dark)
    }
}

struct EPrimaryButton: View {
    let title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 15, weight: .semibold)).foregroundStyle(gBase)
                .frame(maxWidth: .infinity).frame(height: 50)
                .background(Capsule().fill(.white.opacity(0.95)))
        }
        .buttonStyle(.plain)
    }
}

/// The quiet offline chip (B3's pattern).
struct EOfflineChip: View {
    var text = "Nincs net · a telefonon van, elküldöm, amint lesz"
    var body: some View {
        HStack(spacing: 8) {
            Circle().stroke(.white.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])).frame(width: 12, height: 12)
            Text(text).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.7))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Capsule().fill(.white.opacity(0.07)))
    }
}

// MARK: - The composer: five entrances

struct EComposer: View {
    let onToast: (String) -> Void
    let onOpen: (String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var stage: Stage = .pick
    @State private var offline = false

    enum Stage { case pick, draft }

    var body: some View {
        ESheetFrame(eyebrow: "RÖGZÍTÉS · 17:28", title: stage == .pick ? "Mit ettél?" : "Ezt látom a képen") {
            if stage == .pick { picker } else { draft }
        }
    }

    private var picker: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                entrance("camera-ink", "Fotó", primary: true) { withAnimation { stage = .draft } }
                entrance("pen-sun", "Szöveg") { withAnimation { stage = .draft } }
                entrance("search-ink", "Vonalkód") { onOpen("barcode") }
            }
            HStack(spacing: 8) {
                entrance("book-sage", "Recept") { onToast("A receptjeid közül") }
                entrance("bowl-sage", "Kamra") { onToast("A kamrádból") }
                entrance("repeat-deep", "Szokásos") { onToast("A szokásos ételeid") }
            }
            HStack(spacing: 10) {
                TextField("", text: $text, prompt: Text("Mondd vagy írd: vacsora, csirke rizzsel…").foregroundStyle(.white.opacity(0.45)))
                    .font(.system(size: 15)).foregroundStyle(.white).submitLabel(.send)
                    .onSubmit { withAnimation { stage = .draft } }
                AuraGlyph("chat-ink", .white.opacity(0.8), size: 18)
            }
            .padding(.horizontal, 18).frame(height: 54)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))

            Toggle(isOn: $offline) {
                Text("Mutasd net nélkül").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
            }
            .tint(.white.opacity(0.4))
            if offline { EOfflineChip() }
        }
    }

    private var draft: some View {
        VStack(alignment: .leading, spacing: 14) {
            if offline {
                VStack(alignment: .leading, spacing: 12) {
                    photo("mezo-vacsora.jpg").resizable().scaledToFill().saturation(0.8).brightness(-0.06)
                        .frame(height: 150).frame(maxWidth: .infinity).clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    Text("A fotó a telefonodon van. Amint lesz net, kiszámolom, és egy koppintással jóváhagyod — addig semmi nem mentődik el.")
                        .font(.system(size: 14.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                    EOfflineChip()
                    EPrimaryButton(title: "Rendben") { dismiss() }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ECardPhoto(name: "mezo-vacsora.jpg", height: 140)
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                            HStack(spacing: 12) {
                                EThumb(name: l.3, glyph: "bowl-sage", size: 38)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(l.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                                    Text(l.1).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(0.6))
                                }
                                Spacer()
                                Text(l.2).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                            }
                        }
                        Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                        HStack {
                            Text("Összesen").font(.system(size: 14)).foregroundStyle(.white.opacity(0.8))
                            Spacer()
                            Text("612 kcal · F 44 g · Sz 48 g · Zs 23 g").font(AuraFont.mono(12.5)).foregroundStyle(.white)
                        }
                        EFlagBadge(flag: .nyomokban("szezámmag"))
                        Text("A kamrádból ismertem fel a csirkemellet és a rizst; a brokkolit megbecsültem.")
                            .font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                    }
                    .padding(18)
                }
                .frame(maxWidth: .infinity, alignment: .leading).gCard()
                HStack(spacing: 10) {
                    EPrimaryButton(title: "Mentem") { onToast("Vacsora rögzítve · 612 kcal"); dismiss() }
                    Button { withAnimation { stage = .pick } } label: {
                        Text("Javítok").font(.system(size: 15)).foregroundStyle(.white.opacity(0.85))
                            .padding(.horizontal, 20).frame(height: 50)
                            .background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private let lines: [(String, String, String, String?)] = [
        ("Csirkemell filé", "180 g · 297 kcal", "kamra", "csirke-sq.jpg"),
        ("Barna rizs, főtt", "150 g · 165 kcal", "kamra", nil),
        ("Brokkoli, párolt", "200 g · 68 kcal", "becslés", nil),
        ("Olívaolaj", "1 ek · 82 kcal", "kamra", nil),
    ]

    private func entrance(_ glyph: String, _ title: String, primary: Bool = false, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 7) {
                AuraGlyph(glyph, primary ? gBase : .white, size: 20)
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(primary ? gBase : .white)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity).frame(height: 70)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(primary ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Barcode

struct EBarcode: View {
    let onToast: (String) -> Void
    let onOpen: (String?) -> Void
    @State private var found = true

    var body: some View {
        ESheetFrame(eyebrow: "VONALKÓD", title: found ? "Megvan a termék" : "Ezt a kódot nem ismerem", photoName: nil) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.black.opacity(0.55))
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.85), style: StrokeStyle(lineWidth: 2, dash: [26, 14]))
                    .frame(width: 240, height: 120)
                Text("5998200312458").font(AuraFont.mono(15)).foregroundStyle(.white.opacity(0.9)).offset(y: 92)
            }
            .frame(height: 230)
            .overlay(alignment: .topTrailing) {
                Button { withAnimation { found.toggle() } } label: {
                    Text(found ? "Mutasd, ha nincs meg" : "Mutasd, ha megvan")
                        .font(.system(size: 12)).foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(Capsule().fill(.white.opacity(0.15)))
                }
                .buttonStyle(.plain).padding(12)
            }

            if found {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        EThumb(name: "joghurt-sq.jpg", size: 48)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Görög joghurt 2%").font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                            Text("Milli · 100 g: 73 kcal · F 9 g · Sz 4 g · Zs 2 g").font(AuraFont.mono(11.5))
                                .foregroundStyle(.white.opacity(0.65))
                        }
                    }
                    HStack(spacing: 6) {
                        EFlagBadge(flag: .laktoz("tej"))
                        EFlagBadge(flag: .nyomokban("diófélék"))
                    }
                    Text("Laktózt tartalmaz. Rögzíteni tudod, csak szólok — a tej a listádon intolerancia.")
                        .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.8))
                    EPrimaryButton(title: "Mennyit ettél belőle?") { onOpen("adag") }
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Se nálad, se a nyilvános adatbázisban nincs meg ez a kód. Fotózd le a tápértéktáblát, és abból kiszámolom — a kódot megjegyzem hozzá.")
                        .font(.system(size: 14.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.88))
                    EPrimaryButton(title: "Lefotózom a címkét") { onToast("Címkefotó · a kóddal együtt") }
                    Button { onToast("Kézi felvitel") } label: {
                        Text("Beírom kézzel").font(.system(size: 14.5)).foregroundStyle(.white.opacity(0.8))
                            .frame(maxWidth: .infinity).frame(height: 46)
                            .background(Capsule().fill(.white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
            }
        }
    }
}

// MARK: - Serving confirmation (always shown: OFF serving data is unreliable)

struct EServingConfirm: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var mode = 1
    @State private var grams: Double = 170

    var body: some View {
        ESheetFrame(eyebrow: "ADAG", title: "Mennyit ettél belőle?", photoName: "joghurt-sq.jpg") {
            VStack(alignment: .leading, spacing: 16) {
                Picker("", selection: $mode) {
                    Text("100 g").tag(0); Text("1 adag").tag(1); Text("Grammra").tag(2)
                }
                .pickerStyle(.segmented)
                if mode == 2 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("\(Int(grams)) g").font(.custom("Outfit", size: 32).weight(.light)).foregroundStyle(.white)
                        Slider(value: $grams, in: 20...500, step: 5).tint(.white.opacity(0.8))
                    }
                } else {
                    Text(mode == 0 ? "100 g" : "1 adag = 170 g (a csomagoláson)")
                        .font(.custom("Outfit", size: 32).weight(.light)).foregroundStyle(.white)
                }
                Text("\(kcal) kcal · F \(prot) g")
                    .font(AuraFont.mono(14)).foregroundStyle(.white.opacity(0.8))
                Text("A nyilvános adatbázis adagadata gyakran a teljes dobozra vonatkozik, ezért mindig megkérdezem.")
                    .font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.5))
                EPrimaryButton(title: "Hozzáadom") { onToast("Hozzáadtam az uzsonnához"); dismiss() }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
        }
    }

    private var amount: Double { mode == 0 ? 100 : (mode == 1 ? 170 : grams) }
    private var kcal: Int { Int(amount * 0.73) }
    private var prot: Int { Int(amount * 0.09) }
}

// MARK: - Recipe import review

struct ERecipeImport: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var url = "https://streetkitchen.hu/gorog-csirkesalata"

    private let lines: [(String, String, String?, Bool)] = [
        ("Csirkemell", "400 g", "csirke-sq.jpg", false),
        ("Görög joghurt", "150 g", "joghurt-sq.jpg", false),
        ("Uborka", "1 db → 200 g", nil, false),
        ("Koktélparadicsom", "250 g", nil, false),
        ("Feta sajt", "100 g", nil, true),
        ("Olívaolaj", "2 ek → 26 g", nil, false),
        ("Friss kapor", "egy csokor", nil, true),
    ]

    var body: some View {
        ESheetFrame(eyebrow: "RECEPT LINKRŐL", title: "Görög csirkesaláta", photoName: "gorog-sq.jpg") {
            HStack(spacing: 10) {
                AuraGlyph("link-deep", .white.opacity(0.6), size: 16)
                TextField("", text: $url).font(.system(size: 13)).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
            }
            .padding(.horizontal, 16).frame(height: 44)
            .background(Capsule().fill(.white.opacity(0.08)))

            VStack(alignment: .leading, spacing: 12) {
                Text("4 adag · 35 perc · a hozzávalókat a kamrádhoz párosítottam")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                ForEach(Array(lines.enumerated()), id: \.offset) { _, l in
                    HStack(spacing: 12) {
                        EThumb(name: l.2, glyph: "leaf-sage", size: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(l.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                            Text(l.1).font(AuraFont.mono(11.5)).foregroundStyle(.white.opacity(0.6))
                        }
                        Spacer()
                        if l.3 {
                            Text("ellenőrizd").font(.system(size: 11, weight: .medium)).foregroundStyle(Color(hex: 0xF4C860))
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(Capsule().fill(Color(hex: 0xF4C860).opacity(0.14)))
                        }
                    }
                }
                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
                EFlagBadge(flag: .laktoz("feta sajt"))
                Text("A feta laktózt tartalmaz. Tedd bele, cseréld laktózmentesre, vagy hagyd ki — a recept így is elmentődik.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.75))
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            VStack(alignment: .leading, spacing: 10) {
                GLabel("ELKÉSZÜLT SÚLY")
                Text("Nyersen 1 126 g — ha megméred a készt, grammra is tudod majd naplózni.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.65))
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            EPrimaryButton(title: "Mentem a receptjeim közé") { onToast("Görög csirkesaláta elmentve"); dismiss() }
        }
    }
}

// MARK: - Sensitivities

struct ESensitivitySettings: View {
    @State private var nova = true
    @State private var level = 2.0

    private let mine: [(String, String, String)] = [
        ("Laktóz", "Intolerancia", "Szólok, ha benne van, és megmondom, miben. Laktózmentes tej rendben."),
        ("Feldolgozott ételek", "Kerülöm", "Csak 1–2-es szintűt ajánlok. 3–4-esnél egy halk sort írok, ha az viszi a tányért."),
    ]
    private let eu14 = ["Glutén", "Rákfélék", "Tojás", "Hal", "Földimogyoró", "Szója", "Tej", "Diófélék",
                        "Zeller", "Mustár", "Szezámmag", "Kén-dioxid", "Csillagfürt", "Puhatestűek"]

    var body: some View {
        ESheetFrame(eyebrow: "BEÁLLÍTÁS", title: "Amit kerülök") {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(mine.enumerated()), id: \.offset) { _, m in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(m.0).font(.system(size: 16, weight: .medium)).foregroundStyle(.white)
                            Spacer()
                            Text(m.1).font(.system(size: 12.5, weight: .semibold)).foregroundStyle(gBase)
                                .padding(.horizontal, 11).padding(.vertical, 5)
                                .background(Capsule().fill(.white.opacity(0.9)))
                        }
                        Text(m.2).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading).gCard(20)
                }
            }

            VStack(alignment: .leading, spacing: 12) {
                Toggle(isOn: $nova) {
                    Text("Feldolgozottsági szabály").font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                }
                .tint(.white.opacity(0.4))
                Text("Csak \(Int(level))-es szintig ajánlok ételt.").font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.7))
                Slider(value: $level, in: 1...4, step: 1).tint(.white.opacity(0.8)).disabled(!nova)
                HStack {
                    ForEach(1...4, id: \.self) { n in
                        Text("\(n)").font(AuraFont.mono(11)).foregroundStyle(.white.opacity(0.45))
                        if n < 4 { Spacer() }
                    }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            VStack(alignment: .leading, spacing: 12) {
                GLabel("A 14 HIVATALOS ALLERGÉN")
                Text("Koppints rá, és állítsd be: allergia, intolerancia vagy kerülöm.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
                FlowChips(items: eu14)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            VStack(alignment: .leading, spacing: 8) {
                GLabel("SAJÁT ÉRZÉKENYSÉG")
                Text("Írhatsz olyat is, ami nincs a 14 között (pl. FODMAP). Ezeket név szerint keresem az összetevők között, ezért kevésbé pontos.")
                    .font(.system(size: 13)).foregroundStyle(.white.opacity(0.6))
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
        }
    }
}

struct FlowChips: View {
    let items: [String]
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { i in
                Text(i).font(.system(size: 13)).foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
    }
}

// MARK: - Skip + kímélő

struct ESkipSheet: View {
    let onToast: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var reason: String?
    private let reasons = ["Nem voltam éhes", "Nem értem rá", "Úton voltam", "Rosszul vagyok", "Elfelejtettem", "Egyéb"]

    var body: some View {
        ESheetFrame(eyebrow: "VACSORA · 20:00", title: "Kihagyod?") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Mondd meg, miért — így nem számolom hibának, és a kerete sem marad ott lógva.")
                    .font(.system(size: 14.5)).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                FlowChipsSelectable(items: reasons, selected: $reason)
                EPrimaryButton(title: "Kihagyom") {
                    onToast(reason == nil ? "Vacsora kihagyva" : "Vacsora kihagyva · \(reason!)"); dismiss()
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()

            VStack(alignment: .leading, spacing: 10) {
                GLabel("KÍMÉLŐ MÓD")
                Text("Ha beteg vagy, vagy úton, kapcsold be: nem adok kalóriacélt, és nem értékelem a napot. Egy koppintással kikapcsolod.")
                    .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.75))
                Button { onToast("Kímélő mód bekapcsolva"); dismiss() } label: {
                    Text("Bekapcsolom mára").font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).frame(height: 46)
                        .background(Capsule().fill(.white.opacity(0.12)))
                }
                .buttonStyle(.plain)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
        }
    }
}

struct FlowChipsSelectable: View {
    let items: [String]
    @Binding var selected: String?
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \.self) { i in
                let on = selected == i
                Button { withAnimation(.easeOut(duration: 0.2)) { selected = on ? nil : i } } label: {
                    Text(i).font(.system(size: 13.5, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? gBase : .white.opacity(0.85))
                        .padding(.horizontal, 12).padding(.vertical, 9)
                        .frame(maxWidth: .infinity)
                        .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Supplement editor

struct ESupplementEdit: View {
    let onToast: (String) -> Void
    @State private var items = EData.supplements.flatMap { g in g.1.map { ($0, g.0) } }

    var body: some View {
        ESheetFrame(eyebrow: "KIEGÉSZÍTŐK", title: "A listád") {
            VStack(alignment: .leading, spacing: 10) {
                Text("A listád 17 tételt tartalmaz, de az elmúlt hónapban egyet sem pipáltál ki. Vedd ki, ami már nem aktuális.")
                    .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
            }
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { k, it in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(it.0).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                            Text(it.1).font(.system(size: 12)).foregroundStyle(.white.opacity(0.5))
                        }
                        Spacer()
                        Button { items.remove(at: k); onToast("Kivéve: \(it.0)") } label: {
                            Text("Kiveszem").font(.system(size: 13)).foregroundStyle(.white.opacity(0.7))
                                .padding(.horizontal, 12).frame(height: 32)
                                .background(Capsule().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.vertical, 10)
                    if k < items.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
            Button { onToast("Új kiegészítő") } label: {
                HStack(spacing: 8) {
                    AuraGlyph("plus-ink", gBase, size: 15)
                    Text("Új kiegészítő").font(.system(size: 15, weight: .semibold)).foregroundStyle(gBase)
                }
                .frame(maxWidth: .infinity).frame(height: 48)
                .background(Capsule().fill(.white.opacity(0.95)))
            }
            .buttonStyle(.plain)
        }
    }
}
