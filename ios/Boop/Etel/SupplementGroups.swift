import SwiftUI
import BoopCore
import BoopDesign

// The supplement list editor (B4 Task 14, spike ESupplementEdit, owner decision 18): the stack is stale, so he can
// add, remove and re-dose an item on the phone. The daypart groups and the one-tap tick live on the Ma tab (Task 9);
// this sheet changes what those groups hold. Results are said in a line on the sheet itself (a toast would sit under it).

struct SupplementEditSheet: View {
    let store: EtelStore
    @State private var editing: UUID?
    @State private var dose = ""
    @State private var adding = false
    @State private var newName = ""
    @State private var newDose = ""
    @State private var newSlot = "breakfast"
    @State private var message: String?
    @State private var busy = false
    @State private var confirming: SupplementRow?

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "KIEGÉSZÍTŐK", title: "A listád") {
            intro
            if let message { EtelNote(text: message) }
            list
            addCard
        }
        .confirmationDialog(confirming.map { "Kiveszed a \($0.name) nevű kiegészítőt a listádról?" } ?? "", isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
                            titleVisibility: .visible) {
            Button("Kiveszem", role: .destructive) { if let row = confirming { confirming = nil; Task { await remove(row) } } }
            Button("Mégse", role: .cancel) { confirming = nil }
        } message: {
            Text("Később az Új kiegészítő gombbal újra felveheted.")
        }
    }

    private var intro: some View {
        let n = store.protocolRows.count
        return Text(n == 0 ? "A listád üres. Vegyél fel, amit szedsz."
                           : "A listád \(n) tételt tartalmaz. Vedd ki, ami már nem aktuális, és írd át az adagot, ha változott.")
            .nkFont(13.5).lineSpacing(2).foregroundStyle(.white.opacity(0.7)).fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4).frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var list: some View {
        if !store.groupsLoaded {
            EtelCard { Text("A lista betöltése folyamatban").nkFont(14).foregroundStyle(.white.opacity(0.55)).redacted(reason: .placeholder) }
        } else if let problem = store.groupsProblem, store.protocolRows.isEmpty {
            EtelCard { EtelProblem(text: "A kiegészítőidet most nem látom, ezért nem is írom át őket.", detail: problem) }
        } else if !store.protocolRows.isEmpty {
            ForEach(store.groups) { group in
                EtelCard("\(group.label.uppercased()) · \(group.count)") {
                    VStack(spacing: 0) {
                        let rows = store.protocolRows.filter { $0.slotKey == group.key }
                        ForEach(Array(rows.enumerated()), id: \.element.id) { k, row in
                            rowView(row)
                            if k < rows.count - 1 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        }
                    }
                }
            }
        }
    }

    private func rowView(_ row: SupplementRow) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name).nkFont(15.5, .medium).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text(row.dose ?? "adag nélkül").nkFont(12.5).foregroundStyle(.white.opacity(0.55))
            }
            if editing == row.id {
                HStack(spacing: 8) {
                    TextField("", text: $dose, prompt: Text("pl. 2 g").foregroundStyle(.white.opacity(0.4)))
                        .nkFont(15).foregroundStyle(.white).tint(.white).submitLabel(.done)
                        .padding(.horizontal, 12).frame(minHeight: 40).background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.07)))
                        .accessibilityLabel("\(row.name) adagja")
                        .onSubmit { Task { await saveDose(row) } }
                    chip("Mentem", primary: true) { Task { await saveDose(row) } }
                    chip("Mégse", primary: false) { editing = nil }
                }
            } else {
                HStack(spacing: 8) {
                    chip("Adag", primary: false) { editing = row.id; dose = row.dose ?? "" }
                    chip("Kiveszem", primary: false) { confirming = row }
                }
            }
        }
        .padding(.vertical, 11).frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    private func chip(_ title: String, primary: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(13.5, primary ? .semibold : .regular).foregroundStyle(primary ? NK.ground : .white.opacity(0.8))
                .padding(.horizontal, 14).frame(minHeight: 34).background(Capsule().fill(primary ? .white.opacity(0.95) : .white.opacity(0.1)))
        }
        .buttonStyle(.plain).disabled(busy)
    }

    // MARK: new

    @ViewBuilder private var addCard: some View {
        if adding {
            EtelCard("ÚJ KIEGÉSZÍTŐ") {
                field("Név", $newName, prompt: "pl. Cink")
                field("Adag (nem kötelező)", $newDose, prompt: "pl. 15 mg")
                NKMono("MIKOR")
                EtelChoiceChips(options: supplementPlacements.map { (id: $0, label: supplementDaypartLabel($0)) }, selected: newSlot, minimum: 120) { newSlot = $0 }
                NKPill(busy ? "Felveszem…" : "Felveszem") { Task { await add() } }.disabled(busy)
            }
        } else {
            NKPill("Új kiegészítő", glyph: "plus-ink") { adding = true }
        }
    }

    private func field(_ label: String, _ text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            NKMono(label.uppercased())
            TextField("", text: text, prompt: Text(prompt).foregroundStyle(.white.opacity(0.4)))
                .nkFont(16).foregroundStyle(.white).tint(.white)
                .padding(.horizontal, 14).frame(minHeight: 46).background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.07)))
                .accessibilityLabel(label)
        }
    }

    // MARK: actions

    private func remove(_ row: SupplementRow) async {
        busy = true; defer { busy = false }
        message = await store.removeSupplement(row.id)
    }

    private func saveDose(_ row: SupplementRow) async {
        busy = true; defer { busy = false }
        let text = await store.setSupplementDose(row.id, dose: dose)
        message = text
        if text.hasPrefix("Az adag") { editing = nil }
    }

    private func add() async {
        busy = true; defer { busy = false }
        let text = await store.addSupplement(name: newName, dose: newDose, slotKey: newSlot)
        message = text
        if text.hasSuffix("a listádon") { newName = ""; newDose = ""; adding = false }
    }
}
