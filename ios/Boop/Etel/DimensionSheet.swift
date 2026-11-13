import SwiftUI
import BoopCore
import BoopDesign

/// One dimension of a meal's score, explained: what it measures, why it scored what it did (the server's own
/// deterministic sentence), how much of the plate it could see, and the coach's note when there is one.
struct DimensionSheet: View {
    let selection: DimensionSelection
    @Environment(\.dismiss) private var dismiss

    private var explanation: DimensionExplanation? {
        selection.entry.dimension.map { dimensionExplanation($0, coachNote: selection.coachNote) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(height: 170)
                        .overlay { NKPhotoSky(hue: .fuel, photo: NKPhoto.konyha) }
                        .clipped()
                        .mask(LinearGradient(stops: [.init(color: .black, location: 0.34), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                    VStack(alignment: .leading, spacing: 6) {
                        NKMono("EGY SZEMPONT")
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(selection.entry.name).nkFont(28, design: .serif).foregroundStyle(.white).minimumScaleFactor(0.7)
                            Text(selection.entry.points.map(String.init) ?? "nincs adat")
                                .font(.custom(Lagy.outfitFamily, size: selection.entry.points == nil ? 15 : 26).weight(.light))
                                .foregroundStyle(.white.opacity(selection.entry.points == nil ? 0.6 : 1))
                        }
                        .accessibilityElement(children: .combine)
                    }
                    .padding(.horizontal, 22).padding(.bottom, 18)
                }
                VStack(alignment: .leading, spacing: 18) {
                    if let e = explanation {
                        block("MIT MÉR", e.what)
                        block("MIÉRT ENNYI", e.why)
                        if let c = e.coverage { block("MENNYIT LÁTTAM BELŐLE", c) }
                        if let n = e.note { block("BOOP JEGYZETE", n) }
                    } else {
                        block("MIÉRT NINCS ADAT", "Ennél az étkezésnél még nincs pontszám erre a szempontra — akkor jelenik meg, ha az étkezés pontozása megérkezik.")
                    }
                    Button { dismiss() } label: {
                        Text("Kész").nkFont(15, .semibold).foregroundStyle(NK.ground)
                            .frame(maxWidth: .infinity, minHeight: 48).background(Capsule().fill(.white.opacity(0.95)))
                    }
                    .buttonStyle(.plain).padding(.top, 6)
                }
                .padding(20).padding(.bottom, 30)
            }
        }
        .scrollIndicators(.hidden)
        .ignoresSafeArea(edges: .top)
        .background(NKGround(hue: .fuel))
        .presentationDetents([.large])
        .presentationBackground(NK.ground)
        .presentationCornerRadius(34)
        .presentationDragIndicator(.visible)
        .preferredColorScheme(.dark)
    }

    private func block(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            NKMono(label)
            Text(text).nkFont(15).lineSpacing(3).foregroundStyle(.white.opacity(0.88)).fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
