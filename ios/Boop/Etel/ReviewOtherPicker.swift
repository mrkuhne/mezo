import SwiftUI
import BoopCore
import BoopDesign

/// „Másik" on a review row (mezo-r36n9.63): the foods the row could be instead — the server's runners-up first, then a
/// search of his own shelf and the shared list behind it. A tap binds the row to the picked food; nothing is written
/// until the recipe is saved. Drawn inside the row's tile, so it needs no presentation of its own.
struct ReviewOtherPicker: View {
    let alternatives: [FoodChoice]
    let search: (String) async throws -> [PantryRow]
    let onChoice: (FoodChoice) -> Void
    let onRow: (PantryRow) -> Void
    @State private var query = ""
    @State private var hits: [PantryRow] = []
    @State private var searching = false
    @State private var problem = false

    private var typed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !alternatives.isEmpty {
                NKMono("LEHET, HOGY EZ")
                VStack(spacing: 0) {
                    ForEach(Array(alternatives.enumerated()), id: \.element.id) { k, a in
                        if k > 0 { divider }
                        row(a.name, sub: a.brand, pills: []) { onChoice(a) }
                    }
                }
            }
            NKMono(alternatives.isEmpty ? "KERESEK EGYET" : "VAGY KERESEK EGYET")
            EtelSearchField(query: $query, prompt: "Keresés a kamrában és a katalógusban")
            if typed.count >= 2 {
                if searching && hits.isEmpty {
                    note("Keresem…")
                } else if problem {
                    note("Most nem érem el a kamrádat. Próbáld újra egy kicsit később.")
                } else if hits.isEmpty {
                    note("Ilyet nem találok. Ha új étel, vedd fel a „Kamrába” gombbal.")
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(hits.enumerated()), id: \.element.rowKey) { k, r in
                            if k > 0 { divider }
                            row(r.name, sub: r.brand, pills: pills(r)) { onRow(r) }
                        }
                    }
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.06)))
        .task(id: typed) { await run() }
    }

    private var divider: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }

    private func note(_ text: String) -> some View {
        Text(text).nkFont(13).foregroundStyle(.white.opacity(0.6)).fixedSize(horizontal: false, vertical: true)
    }

    private func pills(_ r: PantryRow) -> [(String, EtelPill.Tone)] {
        var out: [(String, EtelPill.Tone)] = [r.onShelf ? ("a polcodon", .plain) : ("katalógus", .muted)]
        if r.estimated { out.append(("becsült", .warn)) }
        return out
    }

    private func row(_ name: String, sub: String?, pills: [(String, EtelPill.Tone)], _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(name).nkFont(14.5, .medium).foregroundStyle(.white).multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    if let sub, !sub.isEmpty { Text(sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1) }
                    if !pills.isEmpty {
                        NKFlowRow(spacing: 6, rowSpacing: 6) { ForEach(pills, id: \.0) { EtelPill(text: $0.0, tone: $0.1) } }
                    }
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(.white.opacity(0.35))
            }
            .padding(.vertical, 9).frame(minHeight: 44).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(name): ezt választom")
    }

    private func run() async {
        guard typed.count >= 2 else { hits = []; searching = false; problem = false; return }
        searching = true; problem = false
        try? await Task.sleep(for: .milliseconds(350))
        guard !Task.isCancelled else { return }
        do {
            let found = try await search(typed)
            guard !Task.isCancelled else { return }
            hits = found
        } catch {
            guard !Task.isCancelled else { return }
            hits = []; problem = true
        }
        searching = false
    }
}
