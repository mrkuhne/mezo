#if DEBUG
import SwiftUI
import BoopDesign

// THROWAWAY simulator spike (mezo-r36n9.66) — the reasoned swap sheet and "Mi van a termemben".
// Launch: `-previewCsere YES`. Invented data, a toy ranker; nothing here ships.

private enum Kind: String, CaseIterable, Identifiable {
    case barbell, dumbbell, kettlebell, cable, machine, smith, bench, pullup, specialty
    var id: String { rawValue }
    var label: String {
        switch self {
        case .barbell: "Rúd és tárcsák"
        case .dumbbell: "Kézisúlyzók"
        case .kettlebell: "Kettlebell"
        case .cable: "Csiga (kábel)"
        case .machine: "Gépek"
        case .smith: "Smith-keret"
        case .bench: "Pad"
        case .pullup: "Húzódzkodó és tolódzkodó állvány"
        case .specialty: "Különleges eszközök"
        }
    }
    /// One missing machine is not "no machines": these are marked per exercise from the swap sheet.
    var perExercise: Bool { self == .machine || self == .smith || self == .specialty }
}

private struct Ex: Identifiable, Equatable {
    let id: String, name: String, muscle: String, compound: Bool
    let kinds: [Kind], joints: Set<String>, guided: Bool, freeWeight: Bool
    var last: String? = nil
    var pain: Int = 0          // 0 none · 1 enyhe · 2 erős (his own earlier answer)
}

private struct Slot: Identifiable {
    let id: String, out: Ex, pool: [Ex]
}

private let slots: [Slot] = [
    Slot(id: "bench",
         out: Ex(id: "bb-bench", name: "Barbell Bench Press", muscle: "mell", compound: true,
                 kinds: [.barbell, .bench], joints: ["váll", "csukló"], guided: false, freeWeight: true),
         pool: [
            Ex(id: "machine-press", name: "Machine Chest Press", muscle: "mell", compound: true,
               kinds: [.machine], joints: ["váll"], guided: true, freeWeight: false, last: "55 kg × 11"),
            Ex(id: "db-bench", name: "DB Bench Press", muscle: "mell", compound: true,
               kinds: [.dumbbell, .bench], joints: ["váll"], guided: false, freeWeight: true, last: "26 kg × 10"),
            Ex(id: "push-up", name: "Deficit Push-Up", muscle: "mell", compound: true,
               kinds: [], joints: ["váll", "csukló"], guided: false, freeWeight: false),
            Ex(id: "cable-fly", name: "Cable Fly", muscle: "mell", compound: false,
               kinds: [.cable], joints: [], guided: true, freeWeight: false, last: "14 kg × 14"),
            Ex(id: "pec-deck", name: "Pec Deck", muscle: "mell", compound: false,
               kinds: [.machine], joints: [], guided: true, freeWeight: false),
            Ex(id: "dip", name: "Weighted Dip", muscle: "mell", compound: true,
               kinds: [.pullup], joints: ["váll", "könyök"], guided: false, freeWeight: true, pain: 2),
         ]),
    Slot(id: "hack",
         out: Ex(id: "hack", name: "Hack Squat", muscle: "comb", compound: true,
                 kinds: [.machine], joints: ["térd"], guided: true, freeWeight: false),
         pool: [
            Ex(id: "leg-press", name: "Leg Press", muscle: "comb", compound: true,
               kinds: [.machine], joints: ["térd"], guided: true, freeWeight: false, last: "180 kg × 10"),
            Ex(id: "smith-squat", name: "Smith Machine Squat", muscle: "comb", compound: true,
               kinds: [.smith], joints: ["térd", "derék"], guided: true, freeWeight: false),
            Ex(id: "bb-squat", name: "Barbell Squat", muscle: "comb", compound: true,
               kinds: [.barbell], joints: ["térd", "derék"], guided: false, freeWeight: true, last: "90 kg × 8", pain: 1),
            Ex(id: "bss", name: "Bulgarian Split Squat", muscle: "comb", compound: true,
               kinds: [.dumbbell], joints: ["térd"], guided: false, freeWeight: true),
            Ex(id: "leg-ext", name: "Leg Extension", muscle: "comb", compound: false,
               kinds: [.machine], joints: ["térd"], guided: true, freeWeight: false, last: "50 kg × 13"),
         ]),
]

private enum Goal: String, CaseIterable, Identifiable {
    case izom = "Izomépítés", ero = "Erő"
    var id: String { rawValue }
}

private struct Pick: Identifiable {
    let ex: Ex, reason: String, score: Int
    var id: String { ex.id }
}

@MainActor @Observable private final class DemoModel {
    var offKinds: Set<Kind> = []
    var missing: Set<String> = []          // exercise ids marked "nincs a termemben"
    var discomfort: Set<String> = []       // exercise ids marked "nem esik jól" just now
    var goal: Goal = .izom

    func available(_ e: Ex) -> Bool { !missing.contains(e.id) && e.kinds.allSatisfy { !offKinds.contains($0) } }
    func hurt(_ e: Ex) -> Bool { e.pain >= 2 }

    func label(_ e: Ex) -> String? {
        if !available(e) { return "nincs hozzá eszközöd" }
        if hurt(e) { return "legutóbb fájt" }
        return nil
    }

    func picks(for slot: Slot) -> [Pick] {
        let out = slot.out
        let sore = discomfort.contains(out.id)
        return slot.pool.filter { available($0) && !hurt($0) }.map { e in
            var s = 0
            var why: [String] = []
            if e.compound == out.compound { s += 40 }
            let shared = !e.joints.isDisjoint(with: out.joints)
            if sore {
                if !shared { s += 30; why.append("nem terheli azt, ami most nem esett jól") }
                else if e.guided { s += 14; why.append("vezetett mozgás, kíméletesebb az ízületnek") }
                else { s -= 10 }
            }
            if e.pain == 1 { s -= 12 }
            switch goal {
            case .izom: if e.guided { s += 10; if !sore { why.append("stabil, könnyű benne terhelni — izomépítéshez jó") } }
            case .ero: if e.freeWeight && e.compound { s += 14; why.append("erőcélhoz a szabadsúlyos változat áll a legközelebb") }
            }
            if e.last != nil { s += 8; if why.isEmpty { why.append("ezt már csináltad, így látod, hol tartasz") } }
            if e.kinds.isEmpty, why.isEmpty { why.append("eszköz nélkül is megy") }
            let role = e.compound == out.compound
                ? "Ugyanazt a munkát végzi a tervben"
                : "Ugyanazt az izmot éri, de \(e.compound ? "összetett" : "izolált") mozgásként"
            var sentence = role
            if let first = why.first { sentence += ", \(first)" }
            if e.pain == 1 { sentence += "; legutóbb enyhén érezted" }
            if !available(out), why.isEmpty { sentence += ", és ehhez van eszközöd" }
            return Pick(ex: e, reason: sentence + ".", score: s)
        }
        .sorted { $0.score > $1.score }
        .prefix(5).map { $0 }
    }
}

struct CsereDemo: View {
    @State private var model = DemoModel()
    @State private var slotId = "bench"
    @State private var showSwap = false
    @State private var showGym = false
    @State private var toast: String?
    private let hue = Hue.mozgas

    private var slot: Slot { slots.first { $0.id == slotId } ?? slots[0] }

    var body: some View {
        ZStack {
            NK.ground.ignoresSafeArea()
            RadialGradient(colors: [hue.glow.opacity(0.22), .clear], center: .top, startRadius: 10, endRadius: 420)
                .ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                Text("BEMUTATÓ · GYAKORLATCSERE").nkFont(11, .medium, design: .monospaced).tracking(1.6)
                    .foregroundStyle(.white.opacity(0.6))
                Text(slot.out.name).nkFont(34, design: .serif).foregroundStyle(.white)
                Text("\(slot.out.muscle) · \(slot.out.compound ? "összetett" : "izolált") · 3 × 8–10")
                    .nkFont(13, design: .monospaced).foregroundStyle(.white.opacity(0.55))

                segmented("Melyik gyakorlatnál tartasz?", slots.map { ($0.id, $0.out.name) }, selection: $slotId)
                segmented("A blokk célja", Goal.allCases.map { ($0.rawValue, $0.rawValue) },
                          selection: Binding(get: { model.goal.rawValue }, set: { model.goal = Goal(rawValue: $0) ?? .izom }))

                Spacer()
                NKPill("Csere") { showSwap = true }
                NKPill("Mi van a termemben", primary: false) { showGym = true }
            }
            .padding(22)
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showSwap) {
            SwapSheet(model: model, slot: slot, hue: hue, openGym: { showSwap = false; showGym = true }) { name in
                showSwap = false
                toast = "\(name) — lecserélve"
            }
        }
        .sheet(isPresented: $showGym) { GymSheet(model: model, hue: hue) }
        .nkToast($toast)
        .onAppear {
            let d = UserDefaults.standard
            if let sl = d.string(forKey: "previewCsereSlot") { slotId = sl }
            switch d.string(forKey: "previewCsereChip") {
            case "kenyelem": model.discomfort.insert(slot.out.id)
            case "eszkoz": if slot.out.kinds.contains(where: { !$0.perExercise }) { model.offKinds.insert(.barbell) } else { model.missing.insert(slot.out.id) }
            default: break
            }
            switch UserDefaults.standard.string(forKey: "previewCsereOpen") {
            case "csere": showSwap = true
            case "terem": showGym = true
            default: break
            }
        }
    }

    private func segmented(_ title: String, _ items: [(String, String)], selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title.uppercased()).nkFont(10, .medium, design: .monospaced).tracking(1.2)
                .foregroundStyle(.white.opacity(0.5))
            HStack(spacing: 8) {
                ForEach(items, id: \.0) { item in
                    Button { selection.wrappedValue = item.0 } label: {
                        Text(item.1).nkFont(13, .medium).lineLimit(1).minimumScaleFactor(0.7)
                            .foregroundStyle(selection.wrappedValue == item.0 ? NK.ground : .white)
                            .padding(.horizontal, 14).frame(minHeight: 38)
                            .background(Capsule().fill(selection.wrappedValue == item.0 ? .white : .white.opacity(0.1)))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct SwapSheet: View {
    @Bindable var model: DemoModel
    let slot: Slot, hue: Hue
    let openGym: () -> Void
    let onPick: (String) -> Void
    @State private var showAll = false
    @State private var query = ""
    @State private var note: String?
    @State private var undo: (() -> Void)?

    var body: some View {
        let out = slot.out
        let picks = model.picks(for: slot)
        NKSheetFrame(hue: hue, eyebrow: out.name, title: "Mire cseréljük?") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    chip("ehhez nincs eszközöm", on: !model.available(out)) { toggleEquipment(out) }
                    chip("nem esik jól", on: model.discomfort.contains(out.id)) {
                        if model.discomfort.contains(out.id) { model.discomfort.remove(out.id); note = nil }
                        else {
                            model.discomfort.insert(out.id)
                            note = "Feljegyeztem. Olyat ajánlok, ami kíméli."
                            undo = { model.discomfort.remove(out.id) }
                        }
                    }
                }
                if let note {
                    HStack(spacing: 8) {
                        Text(note).nkFont(12).foregroundStyle(.white.opacity(0.7))
                        if let undo {
                            Button("visszavonom") { undo(); self.note = nil; self.undo = nil }
                                .buttonStyle(.plain).font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white).underline()
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Text("AJÁNLOM").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(.white.opacity(0.5)).padding(.top, 4)

                if picks.isEmpty {
                    NKNoFreshData("Ezekkel a feltételekkel nincs jó ajánlásom — nézd meg a teljes listát")
                }
                ForEach(Array(picks.enumerated()), id: \.element.id) { i, p in
                    Button { onPick(p.ex.name) } label: { card(p, first: i == 0) }.buttonStyle(.plain)
                }

                Button { withAnimation(.easeInOut(duration: 0.2)) { showAll.toggle() } } label: {
                    HStack {
                        Text("Minden gyakorlat").nkFont(15, .medium).foregroundStyle(.white)
                        Spacer()
                        Image(systemName: showAll ? "chevron.down" : "chevron.right")
                            .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.45))
                    }
                    .padding(.vertical, 12)
                    .overlay(alignment: .top) { Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5) }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if showAll {
                    TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
                        .font(.system(size: 15)).foregroundStyle(.white)
                        .padding(.horizontal, 14).frame(minHeight: 44)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
                    let all = slot.pool.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
                    ForEach(all) { e in
                        Button { onPick(e.name) } label: { plainRow(e) }.buttonStyle(.plain)
                    }
                    if all.isEmpty { NKNoFreshData("Nincs ilyen gyakorlat a listában") }
                }

                Text("A csere a mai edzésre szól. A döntés a tiéd — a teljes listából bármit választhatsz.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button(action: openGym) {
                    Text("Mi van a termemben ›").nkFont(13, .medium).foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.plain)
            }
        }
        .presentationDetents([.large])
    }

    private func toggleEquipment(_ out: Ex) {
        if !model.available(out) {
            model.missing.remove(out.id)
            out.kinds.forEach { model.offKinds.remove($0) }
            note = nil; undo = nil
            return
        }
        // Machines and specialty kit are marked per exercise; portable kinds switch the whole kind off.
        if let k = out.kinds.first(where: { !$0.perExercise && $0 != .bench }) ?? out.kinds.first(where: { !$0.perExercise }) {
            model.offKinds.insert(k)
            note = "„\(k.label)” kikapcsolva a termedben."
            undo = { model.offKinds.remove(k) }
        } else {
            model.missing.insert(out.id)
            note = "Ez a gép hiányzik a termedből — a többi gép marad."
            undo = { model.missing.remove(out.id) }
        }
    }

    private func chip(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13, .medium).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(on ? NK.ground : .white)
                .padding(.horizontal, 14).frame(minHeight: 38)
                .background(Capsule().fill(on ? .white : .white.opacity(0.1)))
                .overlay(Capsule().strokeBorder(.white.opacity(on ? 0 : 0.18), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }

    private func card(_ p: Pick, first: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(p.ex.name).nkFont(17, .medium).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 8)
                Text("\(p.ex.muscle) · \(p.ex.compound ? "összetett" : "izolált")")
                    .nkFont(10, design: .monospaced).foregroundStyle(.white.opacity(0.5))
            }
            Text(p.reason).nkFont(14).foregroundStyle(.white.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)
            if let last = p.ex.last {
                Text("Legutóbb: \(last)").nkFont(12, design: .monospaced).foregroundStyle(hue.glow)
            } else {
                Text("Ezt még nem csináltad").nkFont(12, design: .monospaced).foregroundStyle(.white.opacity(0.4))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(first ? 0.11 : 0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .strokeBorder(.white.opacity(first ? 0.22 : 0), lineWidth: 0.5))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func plainRow(_ e: Ex) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(e.name).nkFont(14).foregroundStyle(.white.opacity(model.label(e) == nil ? 1 : 0.6)).lineLimit(1)
                Text(e.muscle + " · " + (e.compound ? "összetett" : "izolált"))
                    .nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.45))
            }
            Spacer(minLength: 0)
            if let l = model.label(e) {
                Text(l).nkFont(10, .medium, design: .monospaced).foregroundStyle(.white.opacity(0.6))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Capsule().fill(.white.opacity(0.08)))
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.05)))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct GymSheet: View {
    @Bindable var model: DemoModel
    let hue: Hue

    var body: some View {
        NKSheetFrame(hue: hue, eyebrow: "Edzés · beállítások", title: "Mi van a termemben") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Amíg nem szólsz, mindent elérhetőnek veszek. Amit kikapcsolsz, azt nem ajánlom cserénél — a teljes listából továbbra is választhatod.")
                    .nkFont(14).foregroundStyle(.white.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true).padding(.bottom, 10)

                ForEach(Kind.allCases) { k in
                    Toggle(isOn: Binding(get: { !model.offKinds.contains(k) },
                                         set: { on in if on { model.offKinds.remove(k) } else { model.offKinds.insert(k) } })) {
                        Text(k.label).nkFont(16).foregroundStyle(.white)
                    }
                    .tint(hue.glow)
                    .padding(.vertical, 9)
                    .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }

                Text("AMI KONKRÉTAN HIÁNYZIK").nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(.white.opacity(0.5)).padding(.top, 18).padding(.bottom, 4)
                let gone = slots.flatMap { [$0.out] + $0.pool }.filter { model.missing.contains($0.id) }
                if gone.isEmpty {
                    Text("Még semmi. Ha egy gép nincs meg nálatok, a cserénél az „ehhez nincs eszközöm” gombbal jelezheted — ide kerül.")
                        .nkFont(13).foregroundStyle(.white.opacity(0.5))
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(gone) { e in
                    HStack {
                        Text(e.name).nkFont(15).foregroundStyle(.white)
                        Spacer()
                        Button("mégis van") { model.missing.remove(e.id) }
                            .buttonStyle(.plain).font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    .padding(.vertical, 10)
                    .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                }
            }
        }
        .presentationDetents([.large])
    }
}
#endif
