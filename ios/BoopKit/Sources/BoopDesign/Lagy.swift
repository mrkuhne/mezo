import SwiftUI
import CoreText

/// Lágy tokens (`.claude/skills/lagy/IRANY.md` §2, kept exactly) and shared helpers.
public enum Lagy {
    public static let paper = Color(hex: 0xF6F4EF)
    public static let card = Color.white
    public static let ink = Color(hex: 0x1E2321)
    public static let ink2 = Color(hex: 0x5A635E)
    public static let mute = Color(hex: 0x8E968F)
    public static let sage = Color(hex: 0x5FB08A)
    public static let sage2 = Color(hex: 0xA8D5BA)
    public static let sage3 = Color(hex: 0xE6F2EA)
    public static let deep = Color(hex: 0x2E6B52)
    public static let deepDark = Color(hex: 0x1E4A39)
    public static let peach = Color(hex: 0xF0B48C)
    public static let peach2 = Color(hex: 0xFBE6D6)
    public static let peachInk = Color(hex: 0x9A5B2E)
    public static let berry = Color(hex: 0x8E5BB5)
    public static let sky = Color(hex: 0x8CC3E8)
    public static let skyTint = Color(hex: 0xEAF4FB)
    public static let sunTint = Color(hex: 0xFDF3D8)
    public static let sun = Color(hex: 0xF4C860)
    public static let photoGround = Color(hex: 0x26302B)
    public static let scrim = Color(hex: 0x141A16)

    /// The orb's liquid: sage family with a sun glint.
    public static let orbColors: [Color] = [Color(hex: 0x2E6B52), Color(hex: 0x5FB08A), Color(hex: 0xA8D5BA), Color(hex: 0xF4C860)]

    public static let outfitFamily = "Outfit"
    public static let manropeFamily = "Manrope"

    /// Registers the bundled variable fonts once per process.
    public static func registerFonts() {
        guard !registered else { return }
        registered = true
        for name in [outfitFamily, manropeFamily] {
            if let url = Bundle.module.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
    nonisolated(unsafe) private static var registered = false
}

public extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

public extension Font {
    /// Display + numbers.
    static func outfit(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .custom(Lagy.outfitFamily, size: size).weight(weight) }
    /// Body.
    static func manrope(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .custom(Lagy.manropeFamily, size: size).weight(weight) }
}

/// One decimal with a Hungarian comma: 82.4 → "82,4".
public func hu1(_ v: Double) -> String {
    v.formatted(.number.precision(.fractionLength(1)).locale(Locale(identifier: "hu_HU")))
}
