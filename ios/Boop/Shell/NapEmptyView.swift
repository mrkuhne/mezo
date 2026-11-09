import SwiftUI
import BoopCore
import BoopDesign

/// Nap · Mai in its "üres nap" state: data and the morning brief arrive in S2/S3.
struct NapEmptyView: View {
    @Environment(\.openURL) private var openURL
    @Environment(HealthLink.self) private var link: HealthLink?
    @State private var connecting = false
    var body: some View {
        LagyTabPage(head: TabHead(photo: "kave.jpg", tabs: ["Mai", "A napom", "Beszélgetés", "Rutin"], on: "Mai",
                                  eyebrow: "\(greeting()) · \(hungarianNow())", title: "Még üres a napod",
                                  sub: "Az első adatokkal indul minden.", pill: "Hamarosan", pillEnabled: false,
                                  compactTrailing: hungarianNow()),
                    verdict: ("Még nincs adat mára. ", "Holnaptól", " az alvásod és a naptárad is ide fut be.")) {
            TabSection(title: "Utána jön", delay: 0.2) {
                VStack(spacing: 10) {
                    if let link { ConnectCard(link: link) { connecting = true } }
                    PhotoRow(img: nil, glyph: ("spark", "sage"), title: "A reggeli üzenetem",
                             chips: [Chip(text: "Boop · hamarosan", style: .soft, small: true)], chevron: false)
                }
            }
            BoopCard(pre: "Az edzés- és étrendtervedet ", em: "a webes appban", post: " állítsd be ezzel a fiókkal, onnan én viszem.",
                     action: "Megnyitom") { openURL(BoopConfig.webAppURL) }
                .padding(.horizontal, 16).padding(.top, 26).entrance(0.3)
        }
        // Read the flag here so this page re-renders when it flips: passing only `$connecting` down
        // left the cover unpresented in the simulator (the tap fired, nothing showed).
        .connectCover(link, isPresented: Binding(get: { [showing = connecting] in showing }, set: { connecting = $0 }))
    }
}
