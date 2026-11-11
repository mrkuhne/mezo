import SwiftUI
import BoopDesign

/// Napló, for now: the frame of the past days and Boop's patterns, empty until they gather.
struct NaploView: View {
    var body: some View {
        PlacePage(hue: .alvas, title: "Napló", line: "Amit a napjaidból tanulunk") {
            VStack(alignment: .leading, spacing: 10) {
                NKMono("A NAPOK")
                Text("A napjaid és Boop következtetései hamarosan itt gyűlnek.").nkFont(19, design: .serif).lineSpacing(3).foregroundStyle(.white)
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
            VStack(alignment: .leading, spacing: 10) {
                NKMono("MINTÁK")
                Text("Amint elég napod összegyűlik, itt látod, mi hat mire.").nkFont(15).foregroundStyle(.white.opacity(0.6))
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
        }
    }
}
