import SwiftUI

/// The spine's bottom bar: Ma · Terv · Napló · Boop as icons only (names stay for VoiceOver) on a glass capsule,
/// and the "+" as its own glass circle beside it.
public struct NKSpineBar: View {
    public static let labels = ["Ma", "Terv", "Napló", "Boop"]
    private static let glyphs = ["sun-ink", "chart-deep", "book-sage"]
    @Binding var selected: Int
    let onPlus: () -> Void
    /// The selection capsule glides from icon to icon instead of jumping.
    @Namespace private var pill
    public init(selected: Binding<Int>, onPlus: @escaping () -> Void) { self._selected = selected; self.onPlus = onPlus }

    public var body: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 0) {
                    ForEach(Self.labels.indices, id: \.self) { i in
                        let on = i == selected
                        Button { withAnimation(.easeInOut(duration: 0.25)) { selected = i } } label: {
                            Group {
                                if i < Self.glyphs.count {
                                    NKGlyph(Self.glyphs[i], .white.opacity(on ? 1 : 0.45), size: 22)
                                } else {
                                    StillOrb(palette: Hue.forma.orb, size: 22, level: 0.8)
                                        .saturation(on ? 1 : 0.2).opacity(on ? 1 : 0.6)
                                }
                            }
                            .frame(maxWidth: .infinity).frame(height: 46)
                            .background {
                                if on {
                                    Capsule().fill(.white.opacity(0.12)).padding(.horizontal, 4)
                                        .matchedGeometryEffect(id: "pill", in: pill)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Self.labels[i])
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .padding(5)
                .glassEffect(.regular, in: .capsule)

                Button(action: onPlus) { NKGlyph("plus-ink", .white, size: 22).frame(width: 58, height: 58) }
                    .buttonStyle(.plain)
                    .glassEffect(.regular.interactive(), in: .circle)
                    .accessibilityLabel("Rögzítés")
            }
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 4)
        .sensoryFeedback(.selection, trigger: selected)
    }
}
