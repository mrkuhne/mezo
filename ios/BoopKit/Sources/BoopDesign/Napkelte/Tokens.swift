import SwiftUI

/// Napkelte look (spec docs/superpowers/specs/2026-11-10-boop-napkelte-design.md §4.1): a near-black ground, colour only in
/// the painted backdrop and the orbs, everything else white on glass.
public enum NK {
    public static let ground = Color(hex: 0x0D1218)

    /// The page never goes black: the deepest shade of the hue, as a soft vertical gradient (top, middle, bottom).
    public static func deepGround(_ h: Hue) -> [Color] {
        [h.top.mix(with: ground, by: 0.55), h.top.mix(with: ground, by: 0.78), h.top.mix(with: ground, by: 0.7)]
    }
}

/// The five metrics and their colour worlds, in display order. "Készenlét" is called Forma (owner, 2026-11-10).
public enum Hue: Int, CaseIterable, Sendable {
    case forma, alvas, mozgas, fuel, pulzus

    public var name: String { ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus"][rawValue] }

    /// Sky gradient: top, middle, horizon.
    public var sky: [Color] {
        switch self {
        case .forma: [Color(hex: 0x24308A), Color(hex: 0x6A6FE0), Color(hex: 0xF3B7CF)]
        case .alvas: [Color(hex: 0x0A2152), Color(hex: 0x2C6CC4), Color(hex: 0x9FD6F5)]
        case .mozgas: [Color(hex: 0x2F57B0), Color(hex: 0xF09A55), Color(hex: 0xFFD98C)]
        case .fuel: [Color(hex: 0x15567A), Color(hex: 0x4FB9A2), Color(hex: 0xE9F3B4)]
        case .pulzus: [Color(hex: 0x45277A), Color(hex: 0xD86E9C), Color(hex: 0xFFC6A6)]
        }
    }

    /// The orb shader's four colours (always four: three crash the shader).
    public var orb: [Color] {
        switch self {
        case .forma: [Color(hex: 0x2A1E6E), Color(hex: 0x6A4FD8), Color(hex: 0x9FB8FF), Color(hex: 0xF08BB4)]
        case .alvas: [Color(hex: 0x0B2C4F), Color(hex: 0x2A78C8), Color(hex: 0x8ED0F7), Color(hex: 0x6FD3B0)]
        case .mozgas: [Color(hex: 0x6B2A0E), Color(hex: 0xE0702E), Color(hex: 0xF7C27A), Color(hex: 0xF0508C)]
        case .fuel: [Color(hex: 0x0E3B2E), Color(hex: 0x2E9C74), Color(hex: 0xA6E8C8), Color(hex: 0xF4C860)]
        case .pulzus: [Color(hex: 0x5A0F2E), Color(hex: 0xD8467A), Color(hex: 0xF7A8C4), Color(hex: 0xF7C27A)]
        }
    }

    /// Glow around the orb, the path's lit line, floating lights.
    public var glow: Color {
        [Color(hex: 0x8B6CF0), Color(hex: 0x4BA8E6), Color(hex: 0xF29A4A), Color(hex: 0x4CC79A), Color(hex: 0xF06A9A)][rawValue]
    }

    /// The hue's dark top, the base of the deep ground.
    public var top: Color {
        [Color(hex: 0x2E2470), Color(hex: 0x0F3552), Color(hex: 0x4A2810), Color(hex: 0x123F33), Color(hex: 0x4A1630)][rawValue]
    }
}

public extension Font {
    /// Headlines and Boop's voice (system New York).
    static func nkSerif(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .serif) }
    /// Labels and eyebrows: monospaced caps.
    static func nkMono(_ size: CGFloat, _ weight: Font.Weight = .medium) -> Font { .system(size: size, weight: weight, design: .monospaced) }
    /// Numbers: Outfit Light.
    static func nkNumber(_ size: CGFloat) -> Font { .custom(Lagy.outfitFamily, size: size).weight(.light) }
}
