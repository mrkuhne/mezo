import SwiftUI
import BoopDesign

/// Boop, for now: his greeting and the field the conversation will live in (B7 brings it to life).
struct BoopTabView: View {
    @State private var toast: String?

    var body: some View {
        PlacePage(hue: .forma, title: "Boop", line: "Kérdezz bármit, mindent lát, amit te") {
            HStack(alignment: .top, spacing: 10) {
                StillOrb(palette: Hue.forma.orb, size: 28, level: 0.8)
                Text("Szia! Itt bármit kérdezhetsz: az alvásodról, az edzésről, arról, hogy mit egyél. Látom a napodat és a terveidet.")
                    .nkFont(15.5).lineSpacing(3).foregroundStyle(.white.opacity(0.9))
                    .padding(14)
                    .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white.opacity(0.07)))
                Spacer(minLength: 20)
            }
            Button { toast = soonToast("Beszélgetés") } label: {
                HStack {
                    Text("Írj a Boopnak…").nkFont(15).foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    StillOrb(palette: Hue.forma.orb, size: 24, level: 0.8)
                }
                .padding(.horizontal, 18).padding(.vertical, 14)
                .background(Capsule().fill(.white.opacity(0.08)))
                .overlay(Capsule().stroke(.white.opacity(0.12)))
            }
            .buttonStyle(.plain)
            .opacity(0.8)
        }
        .nkToast($toast)
    }
}
