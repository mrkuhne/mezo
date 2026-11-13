import SwiftUI

// The pieces a room built on photographs needs (Képek guideline, 2026-11-13): a photo in the sky, a photo on the card,
// nothing in between. Étel is the first room to use them; Edzés reuses them with its own mood photo.
// Every one of them is correct with no photo at all — the painted landscape and the glyph are the fallback.

/// The one fixed mood photos of the colour worlds, bundled with the kit.
public enum NKPhoto {
    /// The Fuel world's mood photo (herbs on a kitchen board).
    public static let konyha: Image = Image("p-konyha", bundle: .module)
}

public extension View {
    /// Every photo is toned the same way (Képek §3.3): saturation 0.8, brightness −0.06.
    func nkPhotoTone() -> some View { saturation(0.8).brightness(-0.06) }
}

/// A room head's sky: the mood photo fills it, toned down, with the hue's own sky gradient over it — dark at the top,
/// thinning at the horizon, closing into the page ground at the bottom. `photo == nil` is the painted landscape.
public struct NKPhotoSky: View {
    let hue: Hue, photo: Image?
    public init(hue: Hue, photo: Image?) { self.hue = hue; self.photo = photo }
    public var body: some View {
        if let photo {
            ZStack {
                photo.resizable().scaledToFill().nkPhotoTone()
                LinearGradient(stops: [
                    .init(color: hue.sky[0].opacity(0.85), location: 0),
                    .init(color: hue.sky[1].opacity(0.42), location: 0.55),
                    .init(color: hue.sky[2].opacity(0.30), location: 0.72),
                    .init(color: NK.deepGround(hue)[0].opacity(0.92), location: 1),
                ], startPoint: .top, endPoint: .bottom)
            }
        } else {
            PaintedLandscape(hue: hue)
        }
    }
}

/// A dark pool behind the orb on a photo head: no photo detail may sit behind it, the orb stays the one focal point
/// (Képek §3.3 rule 5).
public struct NKOrbScrim: View {
    let hue: Hue
    public init(hue: Hue) { self.hue = hue }
    public var body: some View {
        RadialGradient(colors: [NK.deepGround(hue)[0].opacity(0.85), NK.deepGround(hue)[0].opacity(0)],
                       center: .center, startRadius: 10, endRadius: 86)
            .frame(width: 180, height: 180).blur(radius: 12)
    }
}

/// A photo band at the top of a card, with a dark gradient before any white type (Képek §3.3 rule 3).
public struct NKCardPhoto: View {
    let image: Image, height: CGFloat, hue: Hue
    public init(_ image: Image, hue: Hue, height: CGFloat = 124) { self.image = image; self.hue = hue; self.height = height }
    public var body: some View {
        image.resizable().scaledToFill().nkPhotoTone()
            .frame(height: height).frame(maxWidth: .infinity).clipped()
            .overlay(alignment: .bottom) {
                LinearGradient(colors: [.clear, NK.deepGround(hue)[1].opacity(0.75)], startPoint: .top, endPoint: .bottom)
                    .frame(height: height * 0.6)
            }
            .accessibilityHidden(true)
    }
}

/// A row thumbnail in place of the glyph circle (Képek §3.1): only for a row that is a thing; the glyph when it has
/// no photo.
public struct NKThumb: View {
    let image: Image?, glyph: String, size: CGFloat
    public init(image: Image?, glyph: String, size: CGFloat = 42) { self.image = image; self.glyph = glyph; self.size = size }
    public var body: some View {
        Group {
            if let image {
                image.resizable().scaledToFill().nkPhotoTone()
            } else {
                ZStack { Color.white.opacity(0.08); NKGlyph(glyph, .white, size: size * 0.42) }
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// A room's inner tabs as capsules — the selected one white with dark type (the approved Étel spike). The thin
/// underlined `NKTabStrip` stays for the page-level strips (the phases of Ma).
public struct NKCapsuleTabs: View {
    let tabs: [String]
    @Binding var selected: String
    public init(tabs: [String], selected: Binding<String>) { self.tabs = tabs; self._selected = selected }
    public var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs, id: \.self) { t in
                let on = t == selected
                Button { withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { selected = t } } label: {
                    Text(t).nkFont(14, on ? .semibold : .regular).lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                        .padding(.horizontal, 15).padding(.vertical, 9)
                        .background(Capsule().fill(on ? .white.opacity(0.95) : .white.opacity(0.1)))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(.horizontal, 10)
    }
}
