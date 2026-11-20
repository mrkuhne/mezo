import SwiftUI
import BoopCore
import BoopDesign

// The Pénz area's own faces (L5), drawn to the approved Élet spike (round 11, `EletPenzKit.swift` +
// `EletRooms.swift`): the two-button row under every verdict (`EActionRow`) and the week's level card (`.level`).
// They live here, not in the kit: the kit's `NKActions` is a wrapping row of white pills other areas already wear,
// and the spike's money row is two equal capsules with the hue on the primary one.

let penzHue = Hue.penz

/// The spike's section glyphs (`EAreaContent.sectionGlyph`), for the labels this page uses. Every one is in the kit
/// (`e-penz` is drawn by `NKGlyph`).
func penzSectionGlyph(_ label: String) -> String? {
    switch label {
    case "HONNAN JÖN EZ A SZÁM": "scale-ink"
    case "MIRE MEGY EL": "chart-deep"
    case "A MAI TÉTELEK", "EZEN A HÉTEN": "e-penz"
    case "MIRE GYŰJTÖK": "star-sun"
    case "A PÉNZ TERÜLET": "plate-deep"
    case "A HÓNAP SZÁMOKBAN", "MA": "chart-deep"
    case "KERETEK": "repeat-deep"
    case "A HÓNAP LEZÁRÁSA": "check-ink"
    case "ELLENŐRZÉSRE VÁR": "search-ink"
    default: nil
    }
}

/// One of the two buttons.
struct PenzAction: Identifiable {
    let id = UUID()
    let glyph: String, title: String
    var primary = false
    var enabled = true
    let action: @MainActor () -> Void
}

/// Two buttons on one line, equal width: the primary filled with the hue, the other quiet (the spike's `EActionRow`).
struct PenzActionRow: View {
    let actions: [PenzAction]
    var body: some View {
        HStack(spacing: 10) {
            ForEach(actions) { a in
                Button { a.action() } label: {
                    HStack(spacing: 7) {
                        NKGlyph(a.glyph, a.primary ? NK.ground : .white, size: 15)
                        Text(a.title).nkFont(14.5, .semibold)
                            .lineLimit(1).minimumScaleFactor(0.75)
                            .foregroundStyle(a.primary ? NK.ground : .white)
                    }
                    .padding(.horizontal, 10)
                    .frame(maxWidth: .infinity).frame(height: 46)
                    .background(Capsule().fill(a.primary ? AnyShapeStyle(penzHue.glow) : AnyShapeStyle(Color.white.opacity(0.1))))
                    .overlay(Capsule().stroke(.white.opacity(a.primary ? 0 : 0.14)))
                    .opacity(a.enabled ? 1 : 0.5)
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(!a.enabled)
            }
        }
    }
}

/// The week's level card (the spike's `.level`): label, the big figure, how many days are left, the bar with the
/// days-left marker, and the per-day note with its emphasis lit.
struct PenzLevelCard: View {
    let label: String
    let big: String
    let right: String
    let note: String
    let value: Double
    let marker: Double?
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                if let g = penzSectionGlyph(label) { NKGlyph(g, penzHue.glow.opacity(0.9), size: 14) }
                NKMono(label)
                Spacer(minLength: 0)
            }
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(big).font(.custom(Lagy.outfitFamily, size: 38).weight(.light)).foregroundStyle(.white)
                    .monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
                Text("Ft").nkFont(15).foregroundStyle(.white.opacity(0.6))
                Spacer(minLength: 6)
                Text(right).nkFont(13).foregroundStyle(.white.opacity(0.55)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .padding(.top, 10)
            PenzLevelBar(level: value, marker: marker).padding(.top, 10)
            if !note.isEmpty {
                NKHueText(note, hue: penzHue, size: 12.5, opacity: 0.6).padding(.top, 8)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .nkGlass(28)
        .accessibilityElement(children: .combine)
    }
}

/// The spike's `ELevelBar`: a 10 pt capsule filled to the level, with an optional white marker.
struct PenzLevelBar: View {
    let level: Double
    var marker: Double?
    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(.white.opacity(0.1))
                Capsule()
                    .fill(LinearGradient(colors: [penzHue.glow.opacity(0.65), penzHue.glow], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(8, g.size.width * min(1, max(0, level))))
                if let marker {
                    Rectangle().fill(.white.opacity(0.85)).frame(width: 2)
                        .offset(x: g.size.width * min(1, max(0, marker)) - 1)
                }
            }
        }
        .frame(height: 10)
        .accessibilityHidden(true)
    }
}

/// A "more" link under a section (the spike's hue-coloured text with a chevron).
struct PenzMoreLink: View {
    let title: String
    let action: @MainActor () -> Void
    var body: some View {
        Button { action() } label: {
            HStack(spacing: 7) {
                Text(title).nkFont(14, .semibold).foregroundStyle(penzHue.glow)
                Image(systemName: "chevron.right").nkFont(11, .bold).foregroundStyle(penzHue.glow)
                Spacer()
            }
            .padding(.top, 14).contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// A section with its glyph (the spike's mapping) and the block's own state.
struct PenzSection<Content: View>: View {
    let label: String
    var trailing: String? = nil
    var state: NKBlockState = .ready
    @ViewBuilder let content: () -> Content
    var body: some View {
        NKBare(label, hue: penzHue, glyph: penzSectionGlyph(label), trailing: trailing, state: state, content: content)
    }
}

/// The sheets' common chrome (the room's info sheet look).
extension View {
    func penzSheetStyle(_ detents: Set<PresentationDetent> = [.medium, .large]) -> some View {
        presentationDetents(detents)
            .presentationBackground(NK.ground)
            .presentationCornerRadius(34)
            .presentationDragIndicator(.visible)
    }
}

/// A row of category chips (single choice).
struct PenzCategoryChips: View {
    let categories: [PenzCategory]
    @Binding var selected: String?
    var body: some View {
        NKFlowRow(spacing: 8, rowSpacing: 8) {
            ForEach(categories) { c in
                let on = selected == c.id
                Button { selected = on ? nil : c.id } label: {
                    HStack(spacing: 6) {
                        NKGlyph(penzCategoryGlyph(c.name), on ? NK.ground : .white.opacity(0.85), size: 13)
                        Text(c.name).nkFont(13.5, .medium).foregroundStyle(on ? NK.ground : .white)
                    }
                    .padding(.horizontal, 12).frame(height: 36)
                    .background(Capsule().fill(on ? AnyShapeStyle(penzHue.glow) : AnyShapeStyle(Color.white.opacity(0.08))))
                    .overlay(Capsule().stroke(.white.opacity(on ? 0 : 0.14)))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }
}
