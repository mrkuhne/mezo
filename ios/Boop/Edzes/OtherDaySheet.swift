import SwiftUI
import BoopCore
import BoopDesign

/// „Melyik napot csinálod ma?" (mezo-r36n9.163, owner 2026-11-25): the week's open training days, the missed ones
/// first. A pick turns the Ma card into that day; „Indítás" then starts it with the usual briefing and player.
struct OtherDaySheet: View {
    let choices: [OtherDayChoice]
    let hue: Hue
    let onPick: (UUID) -> Void

    var body: some View {
        NKSheetFrame(hue: hue, eyebrow: "Másik nap", title: "Melyik napot csinálod ma?") {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(choices) { c in
                    Button { onPick(c.id) } label: { row(c) }
                        .buttonStyle(.plain)
                }
                Text("A választott nap terve indul, a mai nap a héten nyitva marad — később ugyanitt megcsinálhatod.")
                    .nkFont(12).foregroundStyle(.white.opacity(0.45))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func row(_ c: OtherDayChoice) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("\(c.weekday.uppercased()) · \(c.when == .missed ? "KIMARADT" : "KÉSŐBB")")
                    .nkFont(10, .medium, design: .monospaced).tracking(1.4)
                    .foregroundStyle(c.when == .missed ? hue.glow : .white.opacity(0.5))
                Text(c.title).nkFont(19, design: .serif).foregroundStyle(.white).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                if !c.muscle.isEmpty {
                    Text(c.muscle).nkFont(13).foregroundStyle(.white.opacity(0.62)).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.35))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .nkGlass()
        .accessibilityElement(children: .combine)
        .accessibilityHint("Ma ezt a napot csinálod")
    }
}
