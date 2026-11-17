#if DEBUG
import SwiftUI
import BoopDesign

// THROWAWAY SPIKE (mezo-r36n9.63) — the look of „Ezt főztem" for the owner's OK, on invented fixture rows.
// Nothing here talks to a server or is kept: the build replaces this file with the real capture sheet and the
// extended RecipeReview. Review hooks: `-etelSheet cooked|cooked-review|cooked-other`.

/// One invented ingredient row of the spike.
private struct SpikeRow: Identifiable {
    enum State { case matched, confirm, missing }
    let id = UUID()
    var name: String
    var amount: Double
    var unit: String
    /// Per 100 g / ml, for a food added from this screen.
    var kcal: Double = 0, protein: Double = 0, carbs: Double = 0, fat: Double = 0
    /// The owner typed the facts himself: no longer an estimate.
    var ownFacts = false
    var said: String
    var state: State
    /// "felveszem a kamrádba": in the shared list, not on his shelf yet.
    var fromShared = false
    var doubt: String? = nil
    var alternatives: [String] = []
    var confirmed = false
    var estimated = false
    var removed = false
    var adding = false
}

struct CookedSpikeSheet: View {
    enum Stage { case input, working, review }
    @State var stage: Stage
    /// The row whose „Másik" list is open.
    @State private var picking: UUID?
    @State private var text = ""
    @State private var listening = false
    @State private var photos = ["CSOMAGOLÁS", "MÉRLEG", "CETLI"]
    @State private var name = "Kurkumás csirkés rizs"
    @State private var servings = 4
    @State private var rows: [SpikeRow] = [
        SpikeRow(name: "Csirkemell filé, friss", amount: 500, unit: "g", said: "fél kiló csirkemell", state: .matched),
        SpikeRow(name: "Jázmin rizs", amount: 300, unit: "g", said: "30 deka rizs", state: .matched, fromShared: true),
        SpikeRow(name: "Olívaolaj, extra szűz", amount: 2, unit: "ek", said: "két evőkanál olaj", state: .confirm,
                 alternatives: ["Napraforgóolaj", "Kókuszolaj, szűz"]),
        SpikeRow(name: "Vöröshagyma", amount: 1, unit: "db", said: "egy fej hagyma", state: .confirm,
                 doubt: "mennyiség?", alternatives: ["Lilahagyma", "Újhagyma"]),
        SpikeRow(name: "Kurkuma", amount: 1, unit: "tk", kcal: 354, protein: 7.8, carbs: 64.9, fat: 9.9, said: "egy teáskanál kurkuma", state: .missing),
        SpikeRow(name: "Kókusztej", amount: 400, unit: "ml", kcal: 185, protein: 1.8, carbs: 2.9, fat: 18.5, said: "egy doboz kókusztej", state: .missing,
                 alternatives: ["Kókusztejszín, 20%"]),
    ]

    init(stage: Stage = .input, openOther: Bool = false) {
        _stage = State(initialValue: stage)
        _openOther = State(initialValue: openOther)
    }
    @State private var openOther: Bool
    /// The freshly added food whose facts are open for typing.
    @State private var editingFacts: UUID?
    private let units = ["g", "ml", "db", "ek", "tk"]

    private let amber = Color(hex: 0xF4C860)

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "EZT FŐZTEM", title: stage == .review ? name : "Miből főztél?") {
            switch stage {
            case .input: input
            case .working: working
            case .review: review
            }
        }
        .task {
            if openOther, picking == nil { picking = rows[2].id }
        }
    }

    // MARK: capture

    private var input: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                NKMono("MONDD EL VAGY ÍRD LE")
                ZStack(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("Például: fél kiló csirkemell, 30 deka rizs, két evőkanál olaj, egy fej hagyma…")
                            .nkFont(14).foregroundStyle(.white.opacity(0.4)).padding(.horizontal, 14).padding(.vertical, 18)
                    }
                    TextEditor(text: $text).scrollContentBackground(.hidden).nkFont(14).foregroundStyle(.white)
                        .frame(minHeight: 120).padding(10)
                }
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
                Button {
                    if listening {
                        listening = false
                        text += (text.isEmpty ? "" : " ") + "Fél kiló csirkemell, 30 deka rizs, két evőkanál olaj, egy fej hagyma, egy teáskanál kurkuma, egy doboz kókusztej."
                    } else { listening = true }
                } label: {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(listening ? Color(hex: 0xF7A8C4).opacity(0.9) : .white.opacity(0.1))
                            NKGlyph("mic", listening ? NK.ground : .white, size: 17)
                        }
                        .frame(width: 44, height: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(listening ? "Hallgatlak… koppints, ha kész" : "Diktálok").nkFont(15, .medium).foregroundStyle(.white)
                            Text(listening ? "a szöveg a leállítás után jelenik meg" : "a telefon írja le, a hang nem megy sehova")
                                .nkFont(12.5).foregroundStyle(.white.opacity(0.55))
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    NKMono("FOTÓK")
                    Spacer()
                    Text("\(photos.count) / 6").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.5))
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(photos.enumerated()), id: \.offset) { i, label in
                            ZStack(alignment: .topTrailing) {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(LinearGradient(colors: [.white.opacity(0.22), .white.opacity(0.06)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .overlay(alignment: .bottomLeading) {
                                        Text(label).nkFont(9.5, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.7)).padding(8)
                                    }
                                Button { photos.remove(at: i) } label: {
                                    Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                                        .frame(width: 22, height: 22).background(Circle().fill(.black.opacity(0.45)))
                                }
                                .buttonStyle(.plain).padding(5)
                            }
                            .frame(width: 84, height: 84)
                        }
                        if photos.count < 6 {
                            Button { photos.append("PULT") } label: {
                                VStack(spacing: 6) {
                                    NKGlyph("camera-ink", .white.opacity(0.8), size: 20)
                                    Text("Hozzáadok").nkFont(11).foregroundStyle(.white.opacity(0.6))
                                }
                                .frame(width: 84, height: 84)
                                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.22), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                Text("Csomagolás, a mérleg kijelzője, egy cetli vagy a pult. A fotókat csak elolvasom, nem őrzöm meg. Amit a képen félreértenék, azt a szövegben kijavíthatod.")
                    .nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            NKPill("Elemzés") {
                stage = .working
                Task { try? await Task.sleep(for: .milliseconds(1600)); stage = .review }
            }
            .disabled(text.isEmpty && photos.isEmpty).opacity(text.isEmpty && photos.isEmpty ? 0.4 : 1)
        }
    }

    private var working: some View {
        HStack(spacing: 12) {
            ProgressView().tint(.white)
            Text("Összevetem a kamráddal…").nkFont(15).foregroundStyle(.white.opacity(0.8))
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }

    // MARK: review

    private var waiting: Int { rows.filter { $0.state == .confirm && !$0.confirmed && !$0.removed }.count }
    private var missing: Int { rows.filter { $0.state == .missing && !$0.removed }.count }

    private var review: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                TextField("", text: $name).nkFont(20, design: .serif).foregroundStyle(.white)
                Stepper(value: $servings, in: 1...12) {
                    Text("\(servings) adag").nkFont(14, design: .monospaced).foregroundStyle(.white.opacity(0.85))
                }
                .tint(.white)
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text(summary).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    if waiting > 1 {
                        Button { for i in rows.indices where rows[i].state == .confirm { rows[i].confirmed = true } } label: {
                            Text("Mind rendben").nkFont(13, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 14).frame(minHeight: 34)
                                .background(Capsule().fill(.white.opacity(0.95)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                ForEach($rows) { $row in
                    rowView($row)
                    if row.id != rows.last?.id { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            if waiting > 0 {
                Text("Még \(waiting) hozzávaló vár a megerősítésedre — addig nem mentem.").nkFont(13.5).foregroundStyle(.white.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            } else if missing > 0 {
                Text("\(missing) hozzávaló nincs a kamrádban. Ha nem veszed fel, kimarad a receptből, és a számok ennyivel kevesebbet mutatnak.")
                    .nkFont(13.5).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            }
            NKPill("Mentem a receptjeim közé") {}.disabled(waiting > 0).opacity(waiting > 0 ? 0.4 : 1)
            NKPill("Mentem, és rögzítem mára", primary: false) {}.disabled(waiting > 0).opacity(waiting > 0 ? 0.4 : 1)
        }
    }

    private var summary: String {
        var parts = ["\(rows.filter { !$0.removed }.count) hozzávaló"]
        if waiting > 0 { parts.append("\(waiting) megerősítésre vár") }
        if missing > 0 { parts.append("\(missing) nincs a kamrádban") }
        if waiting == 0 && missing == 0 { parts.append("mind a kamrádból") }
        return parts.joined(separator: " · ")
    }

    private func rowView(_ row: Binding<SpikeRow>) -> some View {
        let r = row.wrappedValue
        return VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 12) {
                stateDot(r)
                VStack(alignment: .leading, spacing: 3) {
                    Text(r.name).nkFont(15, .medium).foregroundStyle(.white.opacity(r.removed ? 0.4 : 1)).strikethrough(r.removed)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("„\(r.said)”").nkFont(12).foregroundStyle(.white.opacity(0.45)).fixedSize(horizontal: false, vertical: true)
                    FlowRow {
                        if r.fromShared && !r.removed { chip("felveszem a kamrádba", .white.opacity(0.65)) }
                        if r.estimated { chip(r.ownFacts ? "saját adat" : "becsült", r.ownFacts ? .white.opacity(0.65) : amber) }
                        if r.state == .confirm && !r.confirmed && !r.removed { chip(r.doubt ?? "ez az?", amber) }
                        if r.state == .missing && !r.removed { chip("nincs a kamrádban", .white.opacity(0.65)) }
                    }
                }
                Spacer(minLength: 4)
                amountField(row)
            }
            if r.removed {
                quiet("Visszateszem") { row.wrappedValue.removed = false }
            } else if r.state == .confirm && !r.confirmed {
                HStack(spacing: 10) {
                    solid("Ez az") { row.wrappedValue.confirmed = true; picking = nil }
                    quiet("Másik") { picking = picking == r.id ? nil : r.id }
                    quiet("Kiveszem") { row.wrappedValue.removed = true }
                }
            } else if r.state == .missing {
                HStack(spacing: 10) {
                    Button {
                        row.wrappedValue.adding = true
                        Task {
                            try? await Task.sleep(for: .milliseconds(900))
                            row.wrappedValue.adding = false; row.wrappedValue.state = .matched
                            row.wrappedValue.estimated = true; picking = nil
                        }
                    } label: {
                        HStack(spacing: 7) {
                            if r.adding { ProgressView().controlSize(.small).tint(NK.ground) } else { NKGlyph("plus-ink", NK.ground, size: 13) }
                            Text(r.adding ? "Felveszem…" : "Kamrába").nkFont(13, .semibold).foregroundStyle(NK.ground)
                        }
                        .padding(.horizontal, 14).frame(minHeight: 34).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain).disabled(r.adding)
                    quiet("Másik") { picking = picking == r.id ? nil : r.id }
                    quiet("Kiveszem") { row.wrappedValue.removed = true }
                }
            }
            if r.estimated && !r.removed { factsBlock(row) }
            if picking == r.id && !r.removed { otherList(row) }
        }
        .padding(.vertical, 2)
    }

    /// The amount, typeable, and its unit, pickable.
    private func amountField(_ row: Binding<SpikeRow>) -> some View {
        let off = row.wrappedValue.removed
        return HStack(spacing: 6) {
            TextField("", value: row.amount, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                .nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(off ? 0.35 : 0.9)).frame(width: 52)
                .padding(.vertical, 6).padding(.horizontal, 8).background(Capsule().fill(.white.opacity(0.1)))
            Menu {
                ForEach(units, id: \.self) { u in Button(u) { row.wrappedValue.unit = u } }
            } label: {
                HStack(spacing: 3) {
                    Text(row.wrappedValue.unit).nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(off ? 0.35 : 0.9))
                    Image(systemName: "chevron.up.chevron.down").font(.system(size: 9)).foregroundStyle(.white.opacity(0.45))
                }
                .padding(.vertical, 6).padding(.horizontal, 9).background(Capsule().fill(.white.opacity(0.1)))
            }
        }
        .disabled(off)
    }

    /// A food added from this screen: its facts per 100 g, estimated first, typeable by the owner.
    @ViewBuilder private func factsBlock(_ row: Binding<SpikeRow>) -> some View {
        let r = row.wrappedValue
        if editingFacts == r.id {
            VStack(alignment: .leading, spacing: 10) {
                NKMono("TÁPÉRTÉK · 100 G-BAN")
                HStack(spacing: 8) {
                    fact("kcal", row.kcal, row); fact("fehérje", row.protein, row); fact("szénh.", row.carbs, row); fact("zsír", row.fat, row)
                }
                Text(r.ownFacts ? "A saját adatod kerül a kamrába." : "Ezt Boop becsülte. Írd át, ha a csomagoláson más áll.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    solid("Kész") { editingFacts = nil }
                    quiet("Minden adat a kamrában") {}
                }
            }
            .padding(14).background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
        } else {
            quiet(r.ownFacts ? "Tápérték átírása" : "Tápérték megadása") { editingFacts = r.id }
        }
    }

    private func fact(_ label: String, _ value: Binding<Double>, _ row: Binding<SpikeRow>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).nkFont(11).foregroundStyle(.white.opacity(0.5))
            TextField("", value: Binding(get: { value.wrappedValue }, set: { value.wrappedValue = $0; row.wrappedValue.ownFacts = true }), format: .number)
                .keyboardType(.decimalPad).nkFont(14, design: .monospaced).foregroundStyle(.white)
                .padding(.vertical, 8).padding(.horizontal, 10).frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(.white.opacity(0.1)))
        }
    }

    private func num(_ v: Double) -> String { v == v.rounded() ? "\(Int(v))" : String(format: "%.1f", v).replacingOccurrences(of: ".", with: ",") }

    /// The „Másik" list: the runners-up, then a search of his pantry.
    private func otherList(_ row: Binding<SpikeRow>) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(row.wrappedValue.alternatives, id: \.self) { alt in
                Button {
                    row.wrappedValue.name = alt; row.wrappedValue.state = .matched; row.wrappedValue.confirmed = true
                    row.wrappedValue.estimated = false; picking = nil
                } label: {
                    HStack {
                        Text(alt).nkFont(14).foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "chevron.right").nkFont(11, .semibold).foregroundStyle(.white.opacity(0.35))
                    }
                    .frame(minHeight: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5)
            }
            HStack(spacing: 10) {
                NKGlyph("search-ink", .white.opacity(0.6), size: 15)
                Text("Keresek a kamrámban…").nkFont(14).foregroundStyle(.white.opacity(0.45))
                Spacer()
            }
            .frame(minHeight: 44)
        }
        .padding(.horizontal, 14).background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
    }

    @ViewBuilder private func stateDot(_ r: SpikeRow) -> some View {
        let done = r.state == .matched || (r.state == .confirm && r.confirmed)
        ZStack {
            Circle().fill(r.removed ? .white.opacity(0.05) : done ? .white.opacity(0.9) : r.state == .confirm ? amber.opacity(0.18) : .white.opacity(0.08))
            if r.removed { EmptyView() }
            else if done { NKGlyph("check-ink", NK.ground, size: 14) }
            else if r.state == .confirm { Text("?").nkFont(15, .semibold).foregroundStyle(amber) }
            else { NKGlyph("plus-ink", .white.opacity(0.75), size: 13) }
        }
        .frame(width: 32, height: 32)
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).nkFont(11, .medium).foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 4)
            .background(Capsule().fill(color.opacity(0.14)))
    }

    private func solid(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13, .semibold).foregroundStyle(NK.ground).padding(.horizontal, 14).frame(minHeight: 34)
                .background(Capsule().fill(.white.opacity(0.95)))
        }
        .buttonStyle(.plain)
    }

    private func quiet(_ title: String, _ action: @escaping () -> Void) -> some View {
        Button(title, action: action).nkFont(13).foregroundStyle(.white.opacity(0.7)).buttonStyle(.plain).frame(minHeight: 34)
    }
}
#endif
