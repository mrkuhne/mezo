import SwiftUI
import UIKit
import BoopCore
import BoopDesign

// The Levél pieces the shared kit does not carry (the approved spike's `LevelCards.swift`): the date-mark row, the
// score chip, one deal card, the plain row of "A többi". Everything else on the Levél pages is a kit block.

/// The one amber of the page: a mail Boop did not score, and the stalled mailbox.
let levelAmber = Color(hex: 0xE8C25A)

/// The Levél glyph — an envelope whose flap is a soft wave, the morning sun rising over its top edge. Drawn the
/// same way the kit draws its outlined glyphs (`NKGlyph` "e-level"); this view is for the head's orb, where the
/// kit's glyph slot (the eyebrow) is too small to carry it.
struct LevelGlyph: View {
    var color: Color
    var size: CGFloat = 18
    var body: some View { NKGlyph("e-level", color, size: size) }
}

/// A hairline between two rows (the kit's own, 52 pt in).
struct LevelHairline: View {
    var inset: CGFloat = 52
    var body: some View { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5).padding(.leading, inset) }
}

/// "7/10": the server's score for a deal, in the hue.
struct LevelScoreChip: View {
    let n: Int
    var body: some View {
        HStack(spacing: 3) {
            Text("\(n)").font(.custom(Lagy.outfitFamily, size: 19).weight(.medium)).foregroundStyle(.white)
            Text("/10").nkFont(11).foregroundStyle(.white.opacity(0.5)).padding(.top, 5)
        }
        .padding(.horizontal, 10).frame(height: 34)
        .background(Capsule().fill(levelHue.glow.opacity(0.22)))
        .overlay(Capsule().stroke(levelHue.glow.opacity(0.5)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(n) a tízből")
    }
}

/// A row with a date mark on the right: "ma" / "holnap" are filled in the hue, later days are outlined.
struct LevelMarkRowView: View {
    let row: LevelMarkRow
    var onOpen: (() -> Void)?
    private var hue: Color { levelHue.glow }
    var body: some View {
        let content = HStack(spacing: 12) {
            ZStack {
                Circle().fill(row.soon ? hue.opacity(0.22) : .white.opacity(0.08))
                NKGlyph(row.glyph, row.soon ? hue : .white.opacity(0.9), size: 16)
            }
            .frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title).nkFont(14.5, .medium).foregroundStyle(.white).lineLimit(1)
                if !row.sub.isEmpty { Text(row.sub).nkFont(12).foregroundStyle(.white.opacity(0.55)).lineLimit(1) }
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 4) {
                if !row.mark.isEmpty {
                    Text(row.mark).nkFont(12, .semibold)
                        .foregroundStyle(row.soon ? NK.ground : .white.opacity(0.85))
                        .padding(.horizontal, 10).frame(height: 24)
                        .background(Capsule().fill(row.soon ? AnyShapeStyle(hue) : AnyShapeStyle(Color.clear)))
                        .overlay(Capsule().stroke(row.soon ? .clear : .white.opacity(0.25)))
                }
                if !row.markSub.isEmpty {
                    Text(row.markSub).font(.custom(Lagy.outfitFamily, size: 14).weight(.medium))
                        .foregroundStyle(row.soon ? hue : .white.opacity(0.8)).monospacedDigit()
                }
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
        if let onOpen {
            Button(action: onOpen) { content }.buttonStyle(.plain).accessibilityElement(children: .combine)
        } else {
            content.accessibilityElement(children: .combine)
        }
    }
}

/// One deal: sender, the server's headline, the score chip (or none), why it may interest him, érdekel / nem
/// érdekel, Gmail. A flagged mail gets the amber warning instead of the score and the buttons.
struct LevelDealCard: View {
    let face: LevelDealFace
    var pick: LevelVerdict?
    var scoreless = false
    var onVerdict: (LevelVerdict) -> Void
    var onOpen: () -> Void
    private var hue: Color { levelHue.glow }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    NKMono(face.from)
                    Text(face.title).nkFont(20, design: .serif).lineSpacing(3).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 10)
                if face.warning {
                    Text("nem pontoztam").nkFont(11, .semibold).foregroundStyle(levelAmber)
                        .padding(.horizontal, 10).frame(height: 30)
                        .background(Capsule().fill(levelAmber.opacity(0.14))).overlay(Capsule().stroke(levelAmber.opacity(0.5)))
                } else if let s = face.score, !scoreless {
                    LevelScoreChip(n: s)
                } else {
                    Text("nincs pontszám").nkFont(11).foregroundStyle(.white.opacity(0.55))
                        .padding(.horizontal, 10).frame(height: 30).overlay(Capsule().stroke(.white.opacity(0.2)))
                }
            }
            if !face.left.isEmpty {
                Text(face.left).nkFont(12.5, .semibold).foregroundStyle(hue).padding(.top, 8)
            }
            if face.warning {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle").nkFont(14, .semibold).foregroundStyle(levelAmber)
                    Text(face.why.isEmpty ? "Gyanús levél. Nem pontoztam, és ne kattints rá." : face.why)
                        .nkFont(13.5).lineSpacing(3).foregroundStyle(.white.opacity(0.88))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(12).padding(.trailing, 2)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(levelAmber.opacity(0.1)))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(levelAmber.opacity(0.4)))
                .padding(.top, 12)
            } else if !face.why.isEmpty {
                HStack(alignment: .top, spacing: 10) {
                    StillOrb(palette: Hue.forma.orb, size: 20, level: 0.85)
                    Text(face.why).nkFont(13.5).lineSpacing(3).foregroundStyle(.white.opacity(0.85))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 12)
            }
            if !face.warning {
                HStack(spacing: 8) {
                    button(pick == .interest ? "Érdekel, megjegyeztem" : "Érdekel", on: pick == .interest, primary: true) { onVerdict(.interest) }
                    button(pick == .nope ? "Nem érdekel, elteszem" : "Nem érdekel", on: pick == .nope, primary: false) { onVerdict(.nope) }
                    Spacer(minLength: 0)
                }
                .padding(.top, 14)
            }
            Button(action: onOpen) {
                HStack(spacing: 6) {
                    Text("Megnyitás a Gmailben").nkFont(13.5, .semibold)
                    Image(systemName: "arrow.up.right").nkFont(11, .bold)
                }
                .foregroundStyle(face.warning ? .white.opacity(0.55) : hue)
                .frame(minHeight: 44, alignment: .leading).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading).nkGlass(22)
    }

    private func button(_ title: String, on: Bool, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14.5, .semibold).lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(primary ? (on ? .white : NK.ground) : .white)
                .padding(.horizontal, 15).frame(height: 44)
                .background(Capsule().fill(primary ? (on ? AnyShapeStyle(hue.opacity(0.4)) : AnyShapeStyle(Color.white))
                                                   : AnyShapeStyle(Color.white.opacity(on ? 0.2 : 0.1))))
                .overlay(Capsule().stroke(primary && on ? hue : .clear))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// One category of "A többi": its name and how many mails the server put there; with lines under it, a tap unfolds
/// one line per mail (collapsed by default, as in the spike).
struct LevelRestRow: View {
    let category: String, count: Int
    let lines: [LevelRestItem]
    let open: Bool
    var onToggle: () -> Void
    private var hue: Color { levelHue.glow }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                HStack(spacing: 12) {
                    Text(category).nkFont(15, .medium).foregroundStyle(.white)
                    Spacer()
                    Text("\(count)").font(.custom(Lagy.outfitFamily, size: 17).weight(.medium)).foregroundStyle(.white).monospacedDigit()
                    Image(systemName: "chevron.right").nkFont(12, .semibold).foregroundStyle(.white.opacity(lines.isEmpty ? 0 : 0.5))
                        .rotationEffect(.degrees(open ? 90 : 0))
                }
                .padding(.vertical, 14).contentShape(Rectangle())
            }
            .buttonStyle(.plain).allowsHitTesting(!lines.isEmpty)
            .accessibilityElement(children: .combine)
            .accessibilityHint(lines.isEmpty ? "" : (open ? "Összecsukja" : "Kinyitja"))
            if open {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(lines) { l in
                        HStack(alignment: .top, spacing: 12) {
                            Capsule().fill(hue.opacity(0.7)).frame(width: 2.5, height: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(levelPlain(l.title)).nkFont(14, .semibold).foregroundStyle(.white)
                                    .fixedSize(horizontal: false, vertical: true)
                                if !l.summary.isEmpty {
                                    Text(levelPlain(l.summary)).nkFont(12.5).foregroundStyle(.white.opacity(0.6))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.bottom, 14).padding(.leading, 4)
            }
        }
    }
}

/// Opens a link, trying each in order until one opens (the Gmail app's message link, the app, the web).
@MainActor func levelOpen(_ urls: [URL]) {
    guard let first = urls.first else { return }
    UIApplication.shared.open(first) { ok in
        if !ok { Task { @MainActor in levelOpen(Array(urls.dropFirst())) } }
    }
}
