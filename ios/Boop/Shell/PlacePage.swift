import SwiftUI
import BoopDesign

/// The light placeholder skeleton of Terv, Napló and Boop: a 330 pt painted head with the wordmark, a serif title and
/// one line, then glass cards, and room for the bar.
struct PlacePage<Content: View>: View {
    let hue: Hue, title: String, line: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        NKTabPage(hue: hue, heroHeight: 330, compact: nil) {
            VStack(spacing: 6) {
                Text("boop").font(.custom(Lagy.outfitFamily, size: 22).weight(.light)).tracking(3).foregroundStyle(.white.opacity(0.8))
                Text(title).nkFont(40, design: .serif).foregroundStyle(.white).padding(.top, 50)
                Text(line).nkFont(15).foregroundStyle(.white.opacity(0.8)).multilineTextAlignment(.center).padding(.horizontal, 24)
            }
            .padding(.top, 62)
        } content: {
            VStack(spacing: 16) { content() }.padding(.top, -20)
            Color.clear.frame(height: 110)
        }
    }
}
