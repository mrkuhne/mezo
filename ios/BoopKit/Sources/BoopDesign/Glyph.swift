import SwiftUI

/// The Lágy glyph family (vector assets generated from the prototype's `G()` table by `ios/tools/genglyphs.mjs`).
public struct Glyph: View {
    public let name: String
    public let pal: String
    public let size: CGFloat
    public init(_ name: String, _ pal: String, size: CGFloat = 22) { self.name = name; self.pal = pal; self.size = size }

    public var body: some View {
        Image("g-\(name)-\(pal)", bundle: .module).resizable().scaledToFit()
            .frame(width: size, height: size).accessibilityHidden(true)
    }

    /// Every `name-pal` the app uses; a test checks each one exists.
    public static let catalog = [
        "sun-sun", "sun-ink", "moon-sky", "bowl-sage", "dumbbell-berry", "plate-deep", "spark-deep", "spark-sage",
        "person-sage", "check-sage", "check-deep", "bell-cream", "scale-sage", "scale-ink", "star-sun", "clock-sky",
        "book-sage", "heart-berry", "repeat-peach", "plus-ink", "chat-ink",
    ]
}
