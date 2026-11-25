import SwiftUI

/// Levél head: a nature photo (lake) under the area hue's painted sky, "pára" style — Képek variant A.
struct LevelHead: View {
    var verdict: String, sentence: String
    var m: EMetric
    @State private var motion = OrbMotion()
    var body: some View {
        let seam = m.top.mix(with: gBase, by: 0.55)
        Color.clear.frame(height: 356)
            .overlay {
                ZStack {
                    PaintedLandscape(sky: m.sky)
                    photo("aura-to.jpg").resizable().scaledToFill()
                        .saturation(0.7).brightness(-0.1).blur(radius: 22).scaleEffect(1.18)
                        .mask(LinearGradient(stops: [.init(color: .white, location: 0), .init(color: .white, location: 0.62),
                                                     .init(color: .white.opacity(0.35), location: 0.86), .init(color: .clear, location: 1)],
                                             startPoint: .top, endPoint: .bottom))
                }
            }
            .clipped()
            .overlay(LinearGradient(stops: [
                .init(color: m.top.opacity(0.88), location: 0), .init(color: m.top.opacity(0.42), location: 0.34),
                .init(color: m.sky[1].opacity(0.22), location: 0.56), .init(color: seam.opacity(0.5), location: 0.74),
                .init(color: seam.opacity(0.22), location: 0.9), .init(color: .clear, location: 1)],
                startPoint: .top, endPoint: .bottom))
            .mask(LinearGradient(stops: [.init(color: .white, location: 0), .init(color: .white, location: 0.88),
                                         .init(color: .white.opacity(0.55), location: 0.97), .init(color: .clear, location: 1)],
                                 startPoint: .top, endPoint: .bottom))
            .overlay(alignment: .top) {
                VStack(spacing: 0) {
                    ZStack {
                        LivingOrb(mood: .good, size: 92, motion: motion, palette: m.orb, glow: true, level: 0.58)
                            .allowsHitTesting(false)
                        LevelGlyph(color: .white, size: 34).shadow(color: .black.opacity(0.45), radius: 4)
                    }
                    Rectangle().fill(LinearGradient(colors: [.white.opacity(0), .white.opacity(0.42), .white.opacity(0)],
                                                    startPoint: .leading, endPoint: .trailing))
                        .frame(height: 1).padding(.horizontal, 30).padding(.top, 18)
                }.padding(.top, 104)
            }
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        LevelGlyph(color: .white.opacity(0.85), size: 18)
                        Text("LEVÉL").font(AuraFont.mono(12, .bold)).tracking(2).foregroundStyle(.white.opacity(0.8))
                        Spacer()
                    }
                    Text(verdict).font(AuraFont.serif(34)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                    Text(sentence).font(.system(size: 15.5)).lineSpacing(4).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }.padding(.horizontal, 20).padding(.bottom, 6)
            }
            .onDisappear { motion.stop() }
    }
}
