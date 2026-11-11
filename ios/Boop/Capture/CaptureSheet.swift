import SwiftUI
import BoopDesign

/// The global "+": what to record. Every item answers a "hamarosan" toast until its slice (B3 food, B4 training) wires it.
struct CaptureSheet: View {
    let onPick: (String) -> Void
    @State private var text = ""

    var body: some View {
        NKSheetFrame(hue: .forma, eyebrow: "Rögzítés", title: "Mit rögzítesz?") {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    NKGlyph("bowl-cream", .white, size: 24)
                        .frame(width: 48, height: 48).background(Circle().fill(.white.opacity(0.1)))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Étkezés").nkFont(17, .semibold).foregroundStyle(.white)
                        Text("Boop kiszámolja, és megmondja, belefér-e").nkFont(13).foregroundStyle(.white.opacity(0.55))
                    }
                }
                HStack(spacing: 8) {
                    chip("camera-ink", "Fotó"); chip("pen-sun", "Szöveg"); chip("search-ink", "Vonalkód"); chip("book-sage", "Recept")
                }
            }
            .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass()

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                tile("spark-cream", "Check-in", "fél perc")
                tile("book-sage", "Napló", "egy sor, szóval is")
                tile("scale-ink", "Súly", "mérés felvétele")
                tile("dumbbell-ink", "Edzés indítása", "a mai terv szerint")
            }

            HStack(spacing: 10) {
                TextField("", text: $text, prompt: Text("Mondd vagy írd: ebéd, csirke rizzsel…").foregroundStyle(.white.opacity(0.45)))
                    .nkFont(15).foregroundStyle(.white)
                    .submitLabel(.send)
                    .onSubmit { onPick("Szöveges rögzítés") }
                StillOrb(palette: Hue.forma.orb, size: 26, level: 0.8)
            }
            .padding(.horizontal, 18).frame(height: 54)
            .background(Capsule().fill(.white.opacity(0.08)))
            .overlay(Capsule().stroke(.white.opacity(0.12)))
        }
    }

    private func chip(_ glyph: String, _ title: String) -> some View {
        Button { onPick(title) } label: {
            VStack(spacing: 6) {
                NKGlyph(glyph, .white, size: 18)
                Text(title).nkFont(12.5, .semibold).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity).frame(height: 62)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }

    private func tile(_ glyph: String, _ title: String, _ sub: String) -> some View {
        Button { onPick(title) } label: {
            VStack(alignment: .leading, spacing: 10) {
                NKGlyph(glyph, .white, size: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).nkFont(15.5, .semibold).foregroundStyle(.white)
                    Text(sub).nkFont(12.5).foregroundStyle(.white.opacity(0.55)).lineLimit(1)
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading).nkGlass(20)
        }
        .buttonStyle(.plain)
    }
}
