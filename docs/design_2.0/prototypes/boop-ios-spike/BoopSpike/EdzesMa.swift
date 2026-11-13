import SwiftUI

// B5 Edzés spike — the "Ma" tab: today's session, the briefing, the week, and what you can do about it.

struct EdzesMa: View {
    let offline: Bool
    let onOpen: (String) -> Void
    let onToast: (String) -> Void

    var body: some View {
        VStack(spacing: 14) {

            // 1 — Today's session. The one thing this screen exists for.
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topTrailing) {
                    WCardPhoto(name: WData.todayPhoto, height: 132)
                    if offline {
                        WStaleChip(text: "2 napos terv", loud: true).padding(12)
                    }
                }
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(WData.todayTitle).font(AuraFont.serif(26)).foregroundStyle(.white)
                        Text("· \(WData.todayTime)").font(.custom("Outfit", size: 17).weight(.medium))
                            .foregroundStyle(.white.opacity(0.65))
                        Spacer()
                    }
                    Text("5 gyakorlat · 16 sorozat · kb. 1 óra")
                        .font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))

                    if offline {
                        // The honest sentence. Not hidden in grey, because acting on it is a training decision.
                        HStack(alignment: .top, spacing: 10) {
                            AuraGlyph("bolt-ink", Color(hex: 0xF4C860), size: 16)
                            Text("Most nincs net, ezért a keddi tervet mutatom. A súlyok azóta változhattak — a szerda esti edzésed még nem számolódott bele.")
                                .font(.system(size: 13.5)).lineSpacing(2)
                                .foregroundStyle(Color(hex: 0xF4C860).opacity(0.95))
                        }
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Color(hex: 0xF4C860).opacity(0.1)))
                    }

                    HStack(spacing: 10) {
                        GPill(title: "Kezdjük el", glyph: "dumbbell-ink") { onOpen("player") }
                        GPill(title: "Könnyítés", primary: false) { onToast("Ma könnyítve: minden gyakorlat tartás, egy sorozattal kevesebb") }
                    }
                    Button { onOpen("kihagyas") } label: {
                        Text("Ma kihagyom").font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6)).underline()
                    }
                    .buttonStyle(.plain)
                }
                .padding(20)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .gCard()

            // 2 — The briefing: what the engine changed since the last Push day, and why.
            WSection(n: 2, label: "AZ ELIGAZÍTÁS") {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(Array(WData.briefing.enumerated()), id: \.offset) { _, b in
                        WBriefRow(title: b.0, text: b.1)
                    }
                    Divider().overlay(.white.opacity(0.12))
                    HStack(alignment: .top, spacing: 10) {
                        AuraGlyph("heart-berry", .white.opacity(0.8), size: 16)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("A reggeli jelentkezésed alapján").font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.9))
                            Text("Jól vagy: alvás rendben, a vállad nem jelzett. Nem javaslok könnyítést.")
                                .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
                        }
                    }
                }
            }

            // 3 — The week: what is done and what is left of the five days.
            WSection(n: 3, label: "A HÉT · \(WData.mesoWeek). HÉT A \(WData.mesoWeeks)-BŐL") {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        ForEach(Array(WData.weekDays.enumerated()), id: \.offset) { i, d in
                            let done = WData.weekDone[i]
                            let today = i == 2
                            VStack(spacing: 7) {
                                ZStack {
                                    Circle().fill(done ? .white.opacity(0.9) : .white.opacity(0.1))
                                    if done { AuraGlyph("check-ink", gBase, size: 15) }
                                    if today {
                                        Circle().stroke(WHue.glow, lineWidth: 2)
                                    }
                                }
                                .frame(width: 34, height: 34)
                                Text(d).font(.system(size: 11, weight: today ? .semibold : .regular))
                                    .foregroundStyle(.white.opacity(today ? 0.95 : 0.6))
                                    .lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    Text("Két edzés megvan, a mai a harmadik. A blokk most a könnyebb szakaszában van — a mennyiség a 3. héten kezd komolyan emelkedni.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
                }
            }

            // 4 — Boop's proposal for today, with the "why" behind it. Nothing applies without a tap.
            WSection(n: 4, label: "MIT TEHETSZ") {
                VStack(alignment: .leading, spacing: 14) {
                    WProposal(
                        text: "Tedd a vállat a gyakorlatsor végére ma",
                        sub: "A fekvenyomás ma nehezebb lett; ha a váll előbb elfárad, a mell kapja a kevesebbet.",
                        onAccept: { onToast("Rendben: a váll a sor végére került") },
                        onWhy: { onToast("Mert a mell a blokk elsődleges célja, a váll a második") },
                        onToast: onToast)
                    WActionRow(glyph: "ball-sun", title: "Röplabda rögzítése", sub: "szett, hossz, nehézség") { onOpen("sport") }
                    WActionRow(glyph: "heart-berry", title: "Kímélő mód", sub: "ha beteg vagy, vagy megsérültél") { onOpen("kimelo") }
                }
            }
        }
    }
}

/// Boop's proposal card: one sentence, one primary action, a secondary, and "miért?" (spec §3).
struct WProposal: View {
    let text: String, sub: String
    let onAccept: () -> Void
    let onWhy: () -> Void
    let onToast: (String) -> Void
    @State private var state = 0   // 0 open · 1 accepted · 2 dismissed

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Képek §3.1 allows a photo band here, but this proposal is about the ORDER of the exercises —
            // not a thing a photograph can show. "A near-miss photo is worse than a glyph", so it has none.
            VStack(alignment: .leading, spacing: 12) {
                Text(text).font(AuraFont.serif(19)).foregroundStyle(.white).lineSpacing(2)
                Text(sub).font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.72))
                if state == 0 {
                    HStack(spacing: 10) {
                        GPill(title: "Elfogadom") { withAnimation { state = 1 }; onAccept() }
                        GPill(title: "Most nem", primary: false) { withAnimation { state = 2 } }
                        Spacer()
                        Button(action: onWhy) {
                            Text("miért?").font(.system(size: 14, weight: .medium))
                                .foregroundStyle(.white.opacity(0.65)).underline()
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    HStack(spacing: 7) {
                        AuraGlyph(state == 1 ? "check-ink" : "clock-ink", .white.opacity(0.7), size: 14)
                        Text(state == 1 ? "Elfogadtad" : "Félretettük").font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22).fill(.white.opacity(0.07)))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.1), lineWidth: 1))
    }
}

/// A plain action row — a moment, not a thing, so it keeps its glyph (Képek §3.1).
struct WActionRow: View {
    let glyph: String, title: String, sub: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ZStack { Circle().fill(.white.opacity(0.08)); AuraGlyph(glyph, .white, size: 17) }
                    .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 15, weight: .medium)).foregroundStyle(.white)
                    Text(sub).font(.system(size: 12.5)).foregroundStyle(.white.opacity(0.6))
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .buttonStyle(.plain)
    }
}
