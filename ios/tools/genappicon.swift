// Boop app icon generator (mezo-r36n9.34).
//
//   swift ios/tools/genappicon.swift <out-dir> [direction]
//
// Renders the Napkelte app icon at 1024x1024 with SwiftUI + ImageRenderer on macOS. The look is the canon of
// docs/superpowers/specs/2026-11-10-boop-napkelte-design.md: a painted sky over hazy ridges, the orb rising as the
// morning sun. Colours and the ridge algorithm are copied from ios/BoopKit/Sources/BoopDesign/Napkelte/{Tokens,
// Landscape}.swift — BoopDesign itself cannot be imported here because it is iOS-only (CoreMotion).
//
// Directions (the owner picks one; see the spec's icon section):
//   napkelte  the full Mai scene: painted sky, four ridges, the orb cresting the horizon
//   arc       Boop's face alone: the marbled orb on the near-black ground, with its glow
//   horizont  minimal sunrise: a two-band sky, one clean horizon, the orb's upper half
// Variants per direction: -light (the icon), -dark (iOS 18 dark), -tinted (iOS 18 grayscale).

import SwiftUI
import AppKit

// MARK: - Napkelte tokens (copied from Tokens.swift)

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}

/// Forma — the app's own hue: the orb on Ma is Forma, so the icon is Forma.
let skyTop = Color(hex: 0x24308A), skyMid = Color(hex: 0x6A6FE0), skyLow = Color(hex: 0xF3B7CF)
let orbPal = [Color(hex: 0x2A1E6E), Color(hex: 0x6A4FD8), Color(hex: 0x9FB8FF), Color(hex: 0xF08BB4)]
let glowColor = Color(hex: 0x8B6CF0)
let ground = Color(hex: 0x0D1218)
let deepTop = Color(hex: 0x2E2470)

// MARK: - Pieces

/// The four hazy ridges of PaintedLandscape, seeded like Forma (seed = 0), darkened for icon contrast.
struct Ridges: View {
    var body: some View {
        Canvas { ctx, s in
            let w = s.width, h = s.height
            let layers: [(Double, Double, Double, Double, Double)] = [
                (0.62, 0.05, 2.1, 0.4, 0.42), (0.70, 0.06, 3.3, 1.9, 0.60),
                (0.80, 0.05, 2.6, 3.1, 0.76), (0.92, 0.04, 4.2, 0.7, 0.90)]
            for (k, l) in layers.enumerated() {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: h))
                for xi in stride(from: 0.0, through: w, by: 2) {
                    let t = xi / w * .pi * 2, ph = l.3
                    let y = h * (l.0 - l.1 * (0.65 * sin(t * l.2 + ph) + 0.3 * sin(t * l.2 * 2.1 + ph * 1.7)
                                              + 0.05 * sin(t * l.2 * 4.7)))
                    p.addLine(to: CGPoint(x: xi, y: y))
                }
                p.addLine(to: CGPoint(x: w, y: h)); p.closeSubpath()
                var c = ctx
                c.addFilter(.blur(radius: CGFloat(3 - k) * 2.2))
                c.fill(p, with: .color(skyMid))
                c.fill(p, with: .color(.black.opacity(l.4)))
                c.fill(p, with: .linearGradient(Gradient(colors: [skyLow.opacity(0.5 * (1 - l.4)), .clear]),
                                                startPoint: CGPoint(x: 0, y: h * (l.0 - l.1)),
                                                endPoint: CGPoint(x: 0, y: h * (l.0 + 0.07))))
            }
        }
    }
}

/// The marbled liquid orb, built for icon scale: a deep violet glass shell with a warm sunrise liquid in it — the
/// warm half is what separates Boop's face from the cool sky at 60 pt. No shader noise; at that size it reads as mud.
struct IconOrb: View {
    var d: CGFloat
    var fill: Double = 0.58
    var body: some View {
        ZStack {
            // deep glass shell
            Circle().fill(RadialGradient(colors: [Color(hex: 0x3A2A96), Color(hex: 0x1A1052)],
                                         center: .init(x: 0.36, y: 0.26), startRadius: 0, endRadius: d * 0.78))
            // the liquid: warm, bright, filling the lower part
            Circle()
                .fill(LinearGradient(stops: [
                    .init(color: .clear, location: max(0, 1 - fill - 0.10)),
                    .init(color: Color(hex: 0x9FB8FF).opacity(0.95), location: 1 - fill + 0.02),
                    .init(color: Color(hex: 0xF08BB4), location: 1 - fill * 0.35),
                    .init(color: Color(hex: 0xFFD2A8), location: 1.0)], startPoint: .top, endPoint: .bottom))
                .blur(radius: d * 0.03)
            // marbled streaks in the liquid
            Ellipse().fill(Color(hex: 0xFFE3C0).opacity(0.7)).frame(width: d * 0.55, height: d * 0.17)
                .blur(radius: d * 0.055).offset(x: -d * 0.12, y: d * 0.21)
            Ellipse().fill(Color(hex: 0xC9A8FF).opacity(0.35)).frame(width: d * 0.46, height: d * 0.13)
                .blur(radius: d * 0.07).offset(x: d * 0.16, y: d * 0.03)
            // the waterline catches a little light
            Capsule().fill(.white.opacity(0.22)).frame(width: d * 0.78, height: d * 0.008)
                .blur(radius: d * 0.03).offset(y: d * (0.5 - fill))
            // glass: a lit rim at the top-left, a soft shadow at the bottom-right
            Circle().strokeBorder(AngularGradient(stops: [
                .init(color: .white.opacity(0.75), location: 0.0), .init(color: .white.opacity(0.10), location: 0.28),
                .init(color: .white.opacity(0.35), location: 0.62), .init(color: .white.opacity(0.75), location: 1.0)],
                center: .center, angle: .degrees(205)), lineWidth: d * 0.014)
            Ellipse().fill(.white.opacity(0.5)).frame(width: d * 0.26, height: d * 0.13)
                .blur(radius: d * 0.045).offset(x: -d * 0.17, y: -d * 0.27)
        }
        .frame(width: d, height: d)
        .clipShape(Circle())
    }
}

/// A halo that fades to nothing, so it lights the orb without flooding the page.
func glowHalo(_ d: CGFloat, strength: Double = 0.5) -> some View {
    Circle()
        .fill(RadialGradient(stops: [.init(color: glowColor.opacity(strength), location: 0.22),
                                     .init(color: glowColor.opacity(strength * 0.35), location: 0.45),
                                     .init(color: .clear, location: 1.0)],
                             center: .center, startRadius: 0, endRadius: d * 0.9))
        .frame(width: d * 1.8, height: d * 1.8)
}

// MARK: - Directions

enum Variant { case light, dark, tinted }

/// 1 - Napkelte: the Mai scene itself, the orb cresting the ridges.
struct DirNapkelte: View {
    var v: Variant
    var body: some View {
        let S: CGFloat = 1024, d = S * 0.50, cy = S * 0.54
        let dim = v == .dark ? 0.40 : 0.0
        ZStack {
            LinearGradient(stops: [.init(color: Color(hex: 0x121A5C), location: 0),
                                   .init(color: skyTop, location: 0.26),
                                   .init(color: skyMid, location: 0.56),
                                   .init(color: skyLow, location: 0.74)], startPoint: .top, endPoint: .bottom)
            Ellipse().fill(skyLow.opacity(0.75)).frame(width: S * 0.9, height: S * 0.24)
                .blur(radius: S * 0.08).offset(y: S * 0.09)
            glowHalo(d).offset(y: cy - S / 2)
            Ridges().frame(width: S, height: S)
            IconOrb(d: d).offset(y: cy - S / 2)
            if dim > 0 { Color.black.opacity(dim) }
        }
        .frame(width: S, height: S)
    }
}

/// 2 - Boop arca: the orb alone on the deep ground.
struct DirArc: View {
    var v: Variant
    var body: some View {
        let S: CGFloat = 1024
        ZStack {
            RadialGradient(colors: [Color(hex: 0x1C1A4E), Color(hex: 0x0D1218)],
                           center: .init(x: 0.5, y: 0.46), startRadius: 0, endRadius: S * 0.7)
            glowHalo(S * 0.72, strength: v == .dark ? 0.28 : 0.42)
            IconOrb(d: S * 0.64, fill: 0.60)
            if v == .dark { Color.black.opacity(0.22) }
        }
        .frame(width: S, height: S)
    }
}

/// 3 - Horizont: one clean horizon, the orb cresting it.
struct DirHorizont: View {
    var v: Variant
    var body: some View {
        let S: CGFloat = 1024, hz: CGFloat = S * 0.70, d = S * 0.56
        let dim = v == .dark ? 0.38 : 0.0
        ZStack {
            LinearGradient(stops: [.init(color: Color(hex: 0x0E1450), location: 0),
                                   .init(color: skyTop, location: 0.28),
                                   .init(color: skyMid, location: 0.54),
                                   .init(color: skyLow, location: 0.64)], startPoint: .top, endPoint: .bottom)
            glowHalo(d, strength: 0.55).offset(y: hz - S / 2 - d * 0.34)
            IconOrb(d: d, fill: 0.68).offset(y: hz - S / 2 - d * 0.34)
            VStack(spacing: 0) {
                Color.clear.frame(height: hz)
                LinearGradient(colors: [Color(hex: 0x241C58), Color(hex: 0x0D1218)], startPoint: .top, endPoint: .bottom)
            }
            VStack(spacing: 0) {
                Color.clear.frame(height: hz - S * 0.006)
                LinearGradient(colors: [Color(hex: 0xFFD2A8).opacity(0.95), .clear], startPoint: .top, endPoint: .bottom)
                    .frame(height: S * 0.035)
                Spacer(minLength: 0)
            }
            if dim > 0 { Color.black.opacity(dim) }
        }
        .frame(width: S, height: S)
    }
}

@MainActor func render(_ view: some View, to url: URL, tinted: Bool) {
    let r = ImageRenderer(content: view.frame(width: 1024, height: 1024))
    r.scale = 1
    guard var img = r.nsImage, let tiff = img.tiffRepresentation,
          var rep = NSBitmapImageRep(data: tiff) else { fatalError("render failed: \(url.lastPathComponent)") }
    if tinted {
        let ci = CIImage(bitmapImageRep: rep)!
        let mono = ci.applyingFilter("CIPhotoEffectMono").applyingFilter(
            "CIColorControls", parameters: [kCIInputContrastKey: 1.15, kCIInputBrightnessKey: 0.05])
        rep = NSBitmapImageRep(ciImage: mono)
        img = NSImage(size: .init(width: 1024, height: 1024))
    }
    guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("png failed") }
    try! png.write(to: url)
    print("wrote \(url.lastPathComponent)")
}

// MARK: - main

let args = CommandLine.arguments
let outDir = URL(fileURLWithPath: args.count > 1 ? args[1] : ".")
let only = args.count > 2 ? args[2] : nil
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

MainActor.assumeIsolated {
    for (name, make) in [
        ("napkelte", { (v: Variant) in AnyView(DirNapkelte(v: v)) }),
        ("arc", { (v: Variant) in AnyView(DirArc(v: v)) }),
        ("horizont", { (v: Variant) in AnyView(DirHorizont(v: v)) }),
    ] {
        if let only, only != name { continue }
        render(make(.light), to: outDir.appendingPathComponent("\(name)-light.png"), tinted: false)
        render(make(.dark), to: outDir.appendingPathComponent("\(name)-dark.png"), tinted: false)
        render(make(.light), to: outDir.appendingPathComponent("\(name)-tinted.png"), tinted: true)
    }
}
