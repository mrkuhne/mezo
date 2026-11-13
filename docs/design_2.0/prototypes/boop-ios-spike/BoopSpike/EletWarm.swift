import SwiftUI

// Round 5 (owner, 2026-11-13): he compared the old Lágy screen with ours and said ours reads "hideg és dobozolós".
// Diagnosis in the reply: of the four things that make Lágy feel warmer, TWO are free to borrow —
//   (1) a real photograph in the head (already his decision today, Képek variant A), and
//   (2) colour inside the content, not only in the sky and the orbs —
// and one is my own fault: six to eight identical rounded rectangles stacked.
// The other two (light paper, coloured illustrated icons) he rejected on 2026-11-10 and today, so they stay out.
//
// This file is the WARM variant of the area page, switched by `-eletWarm YES`, so the two can be shot side by side.

enum EWarm {
    /// Owner decision 2026-11-13: the warm variant IS the look. `-eletHideg YES` still shows the
    /// pre-decision version for comparison.
    static var on: Bool { !UserDefaults.standard.bool(forKey: "eletHideg") }

    /// One fixed mood photo per colour world (Képek §3.2: quiet nature, dark-leaning, no faces).
    ///
    /// The spike's photo folder is still the old Lágy library: only three of the seven worlds have a photo that
    /// satisfies the guideline. Everything else returns nil and keeps the painted landscape — which the guideline
    /// itself allows ("never load-bearing; the painted landscape stays in the kit as the fallback").
    /// Gap filed as a follow-up: Edzés, Energia, Pénz and Levél need their own mood photo.
    static func moodPhoto(_ metric: Int) -> String? {
        switch metric {
        case 0: return "aura-hegy.jpg"      // Forma · mountain dusk
        case 1: return "aura-alkony.jpg"    // Alvás · dusk over water
        case 3: return "konyha.jpg"         // Étel  · vegetables on a board (stands in for the decided deszka.jpg)
        case 5: return "aura-hegy.jpg"      // Pénz  · borrowed from Forma until it has its own
        default: return nil                // Edzés, Energia, Nap, Levél · painted landscape until a photo exists
        }
    }
}

/// Képek variant A: the photo fills the head and the hue's own gradient sits over it —
/// dark at the top, thinning at the horizon band, closing to the ground at the bottom (Képek §3.3).
struct EPhotoHead: View {
    var metric: Int
    var height: CGFloat = 330
    var body: some View {
        let m = EMetric.all[metric]
        Color.clear.frame(height: height)
            .overlay {
                if let name = EWarm.moodPhoto(metric) {
                    photo(name).resizable().scaledToFill()
                        .saturation(0.8).brightness(-0.06)
                } else {
                    PaintedLandscape(sky: EMetric.all[metric].sky)
                }
            }
            .clipped()
            .overlay(
                EWarm.moodPhoto(metric) == nil ? nil :
                LinearGradient(stops: [
                    .init(color: m.top.opacity(0.88), location: 0),
                    .init(color: m.top.opacity(0.42), location: 0.34),
                    .init(color: m.sky[1].opacity(0.22), location: 0.56),
                    .init(color: gBase.opacity(0.72), location: 0.84),
                    .init(color: gBase, location: 1),
                ], startPoint: .top, endPoint: .bottom)
            )
            .overlay(Rectangle().fill(m.glow).opacity(0.07).blendMode(.color))
    }
}

/// Colour inside the content: *marked* spans take the area's own hue, as the green numbers did on Lágy.
/// Everything outside the marks stays white — the canon still holds for the page, just not for the key numbers.
struct EHueText: View {
    var text: String
    var hue: Color
    var size: CGFloat = 15
    var weight: Font.Weight = .regular
    var opacity: Double = 0.85
    /// true inside a serif headline, so the lit span does not jump to another family
    var serif: Bool = false

    var body: some View {
        Text(build())
            .font(serif ? AuraFont.serif(size) : .system(size: size, weight: weight))
            .lineSpacing(serif ? 3 : 5)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func build() -> AttributedString {
        var out = AttributedString()
        var lit = false
        for part in text.components(separatedBy: "*") {
            if part.isEmpty { lit.toggle(); continue }
            var a = AttributedString(part)
            if lit {
                a.foregroundColor = hue
                a.font = serif ? AuraFont.serif(size, .semibold) : .system(size: size, weight: .semibold)
            } else {
                a.foregroundColor = .white.opacity(opacity)
            }
            out.append(a)
            lit.toggle()
        }
        return out
    }
}

/// Stat tiles, warm: no box around the quiet ones — the lit one is a filled hue chip,
/// the others are bare numbers on the page with a hairline between them.
struct EStatRowWarm: View {
    var stats: [EStat]
    var hue: Color
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(stats.enumerated()), id: \.element.id) { i, s in
                if i > 0 {
                    Rectangle().fill(.white.opacity(0.1)).frame(width: 1, height: 38).padding(.horizontal, 2)
                }
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(s.value)
                            .font(.custom("Outfit", size: s.hot ? 27 : 23).weight(s.hot ? .medium : .light))
                            .foregroundStyle(s.hot ? hue : .white)
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(s.unit).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
                        if s.trend != 0 {
                            Image(systemName: s.trend > 0 ? "arrow.up.right" : "arrow.down.right")
                                .font(.system(size: 9, weight: .bold)).foregroundStyle(hue)
                        }
                    }
                    Text(s.label).font(.system(size: 11)).lineSpacing(1).foregroundStyle(.white.opacity(0.55))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 10)
            }
        }
    }
}

/// A section head used where the warm variant drops the card: a label with a hue tick, content straight on the page.
struct EBare<C: View>: View {
    var label: String
    var hue: Color
    @ViewBuilder var content: () -> C
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Capsule().fill(hue).frame(width: 3, height: 13)
                Text(label).font(AuraFont.mono(12)).tracking(1.4).foregroundStyle(.white.opacity(0.7))
                Spacer()
            }
            content()
        }
        .padding(.vertical, 4)
    }
}
