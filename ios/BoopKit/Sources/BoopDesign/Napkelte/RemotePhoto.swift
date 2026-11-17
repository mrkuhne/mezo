import SwiftUI

// A photo the server knows about — the exercise demo stills, today 124 of the 174 rows in the catalog.
//
// The Képek guideline (2026-11-13) says a photo belongs on a row or card that is **about a thing**; an exercise
// is exactly that, and the owner's own note on this round was that the pictures are what made the app feel
// finished. The rules from that guideline hold here too: the photo is toned the same way as every other, a
// gradient goes over it before any white type, and **every one of these views is correct with no photo at all** —
// an exercise with no still, a phone with no network and a URL that 404s all land on the same quiet glyph tile.

/// An exercise photo loaded from the server, square-ish, with the glyph tile as its fallback and its placeholder.
public struct NKRemoteThumb: View {
    let url: URL?
    let glyph: String
    let size: CGFloat
    let corner: CGFloat

    public init(_ url: URL?, glyph: String = "dumbbell-ink", size: CGFloat = 46, corner: CGFloat? = nil) {
        self.url = url; self.glyph = glyph; self.size = size; self.corner = corner ?? size * 0.3
    }

    public var body: some View {
        Group {
            if let url {
                AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill().nkPhotoTone()
                    default: fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        ZStack { Color.white.opacity(0.08); NKGlyph(glyph, .white.opacity(0.65), size: size * 0.4) }
    }
}

/// A wide exercise photo filling the top of a card, with the dark gradient the white type sits on.
public struct NKRemoteBanner: View {
    let url: URL?
    let hue: Hue
    let height: CGFloat
    let glyph: String

    public init(_ url: URL?, hue: Hue, height: CGFloat = 108, glyph: String = "dumbbell-ink") {
        self.url = url; self.hue = hue; self.height = height; self.glyph = glyph
    }

    public var body: some View {
        ZStack {
            if let url {
                AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill().nkPhotoTone()
                    default: fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .clipped()
        .overlay(alignment: .bottom) {
            LinearGradient(colors: [.clear, NK.deepGround(hue)[1].opacity(0.88)], startPoint: .top, endPoint: .bottom)
                .frame(height: height * 0.75)
        }
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        ZStack {
            LinearGradient(colors: NK.deepGround(hue), startPoint: .top, endPoint: .bottom)
            NKGlyph(glyph, .white.opacity(0.2), size: 44)
        }
    }
}
