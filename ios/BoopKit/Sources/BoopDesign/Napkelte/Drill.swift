import SwiftUI

/// A domain drill-down: 360 pt painted head (glass back circle, crumb, orb with the hue's glow, eyebrow, serif headline,
/// one sentence), numbered glass sections below, floating lights and the mirrored land at the end.
///
/// A room with depth (Étel, Edzés) carries its own inner top tabs: pass `tabs` and `selectedTab` and an `NKTabStrip`
/// sits under the verdict block; the caller switches `content` on the selected tab. No tabs = a single-page room.
public struct NKDrillPage<Content: View>: View {
    let hue: Hue, crumb: String, eyebrow: String, headline: String, sentence: String, level: Double?
    let tabs: [String]
    let selectedTab: Binding<String>?
    let onBack: () -> Void
    let content: Content
    public init(hue: Hue, crumb: String, eyebrow: String, headline: String, sentence: String, level: Double?,
                tabs: [String] = [], selectedTab: Binding<String>? = nil,
                onBack: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.hue = hue; self.crumb = crumb; self.eyebrow = eyebrow; self.headline = headline; self.sentence = sentence
        self.level = level; self.tabs = tabs; self.selectedTab = selectedTab; self.onBack = onBack; self.content = content()
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ZStack(alignment: .top) {
                    Color.clear.frame(height: 360)
                        .overlay { PaintedLandscape(hue: hue) }
                        .clipped()
                        .mask(LinearGradient(stops: [.init(color: .black, location: 0.55), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                    VStack(spacing: 0) {
                        HStack(spacing: 10) {
                            Button(action: onBack) {
                                Image(systemName: "chevron.left").nkFont(17, .semibold).foregroundStyle(.white).frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .glassEffect(.clear.interactive(), in: .circle)
                            .accessibilityLabel("Vissza")
                            Text(crumb).nkFont(15, .medium).foregroundStyle(.white.opacity(0.85)).lineLimit(1)
                            Spacer()
                        }
                        .padding(.horizontal, 16).padding(.top, 58)
                        VStack(spacing: 8) {
                            if let level {
                                StillOrb(palette: hue.orb, size: 64, level: level).shadow(color: hue.glow.opacity(0.6), radius: 20)
                            }
                            NKMono(eyebrow.uppercased()).padding(.top, 6)
                            Text(headline).nkFont(38, design: .serif).foregroundStyle(.white).multilineTextAlignment(.center).minimumScaleFactor(0.6)
                            Text(sentence).nkFont(16).lineSpacing(3).multilineTextAlignment(.center)
                                .foregroundStyle(.white.opacity(0.85)).padding(.horizontal, 28)
                        }
                        .padding(.top, level == nil ? 70 : 34)
                        if drillPageShowsTabs(tabs, selected: selectedTab), let selectedTab {
                            NKTabStrip(tabs: tabs, selected: selectedTab).padding(.top, 22)
                        }
                    }
                }
                VStack(spacing: 14) { content }
                    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 40)
                    .background(FloatingLights(hue: hue).padding(.vertical, -100))
                MirroredLand(hue: hue).padding(.top, -20)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: hue))
        .preferredColorScheme(.dark)
    }
}

/// The inner tab row shows only when there are tabs and a selection to drive.
public func drillPageShowsTabs(_ tabs: [String], selected: Binding<String>?) -> Bool { !tabs.isEmpty && selected != nil }

/// One numbered glass section of a drill-down ("1  A SZINT").
public struct NKDrillSection<C: View>: View {
    let number: Int, label: String, content: C
    public init(number: Int, label: String, @ViewBuilder content: () -> C) { self.number = number; self.label = label; self.content = content() }
    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Text("\(number)").font(.custom(Lagy.outfitFamily, size: 15).weight(.medium)).foregroundStyle(.white.opacity(0.6))
                NKMono(label)
            }
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass()
    }
}
