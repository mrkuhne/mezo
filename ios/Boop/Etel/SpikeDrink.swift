import SwiftUI
import BoopCore
import BoopDesign

// SPIKE (throwaway): the drink entrance — the owner's usual drinks one tap away, his own words, when he drank it.

struct DrinkSpikeSheet: View {
    let onDone: (String?) -> Void
    @State private var text = ""
    @State private var when: Date? = SpikeWhenRow.previewDefault
    @State private var chosen: String?

    private let usuals: [(name: String, kcal: Int)] = [
        ("Fehérjeturmix", 180), ("Fekete kávé", 0), ("Gombakávé zabtejjel mézzel", 95), ("Kakaó zabtejjel", 140),
    ]

    var body: some View {
        NKSheetFrame(hue: .fuel, eyebrow: "Ital", title: "Mit ittál?") {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    NKMono("SZOKÁSOS ITALAID")
                    FlowChips(items: usuals.map { "\($0.name) · \($0.kcal) kcal" }, chosen: $chosen)
                    Text("Boop abból tanulja, amit rögzítesz; a második alkalomtól pontosan azt hozza.")
                        .nkFont(12).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
                VStack(alignment: .leading, spacing: 10) {
                    NKMono("VAGY ÍRD LE")
                    HStack(spacing: 10) {
                        TextField("", text: $text, prompt: Text("gombakávé zabtejjel mézzel…").foregroundStyle(.white.opacity(0.4)))
                            .nkFont(16).foregroundStyle(.white)
                        Button {} label: {
                            NKGlyph("camera-ink", .white, size: 18).frame(width: 40, height: 40)
                                .background(Circle().fill(.white.opacity(0.1)))
                        }
                        .buttonStyle(.plain).accessibilityLabel("Fotó")
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
                SpikeWhenRow(eyebrow: "MIKOR ITTAD", hue: .fuel, withTime: true, chosen: $when)
                Text("Beszámít a napi keretbe és a görbébe, de étkezési ablakot nem foglal, és pontot sem kap.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .safeAreaInset(edge: .bottom) {
            QuickFoot(title: chosen != nil ? "Mentem" : "Kiszámolom", disabled: chosen == nil && text.isEmpty) {
                onDone("Ital rögzítve")
            }
        }
    }
}

/// Chips that wrap onto new lines.
private struct FlowChips: View {
    let items: [String]
    @Binding var chosen: String?

    var body: some View {
        var width: CGFloat = 0
        var height: CGFloat = 0
        return GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(items, id: \.self) { item in
                    chip(item)
                        .alignmentGuide(.leading) { d in
                            if abs(width - d.width) > geo.size.width { width = 0; height -= d.height + 8 }
                            let result = width
                            if item == items.last { width = 0 } else { width -= d.width + 8 }
                            return result
                        }
                        .alignmentGuide(.top) { _ in
                            let result = height
                            if item == items.last { height = 0 }
                            return result
                        }
                }
            }
        }
        .frame(height: 136)
    }

    private func chip(_ text: String) -> some View {
        let on = chosen == text
        return Button { chosen = on ? nil : text } label: {
            Text(text).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }
}
