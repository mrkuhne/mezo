import SwiftUI
import UIKit
import BoopCore
import BoopDesign

/// The captures still in the owner's hands (decision 9), above the day: waiting for the net with their values, failed
/// with *Újra*, and — the point of it all — drafts Boop computed later, as a card that asks for one tap. Nothing here
/// is a saved meal until he taps *Mentem*.
struct PendingMealCards: View {
    let store: EtelStore
    let onSave: (PendingDraft) -> Void
    let onEdit: (PendingDraft) -> Void
    let onRetry: (PendingDraft) -> Void
    let onDiscard: (PendingDraft) -> Void

    var body: some View {
        ForEach(store.pending) { card in
            VStack(alignment: .leading, spacing: 0) {
                if let image = store.pendingPhotos[card.id] { NKCardPhoto(Image(uiImage: image), hue: .fuel, height: 120) }
                VStack(alignment: .leading, spacing: 12) {
                    header(card)
                    if let title = headline(card) { Text(title).nkFont(18, design: .serif).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true) }
                    if case .ready(let d) = card.state {
                        let t = d.total
                        Text("\(huInt(Int(t.kcal.rounded()))) kcal · F \(Int(t.p.rounded())) g · Sz \(Int(t.c.rounded())) g · Zs \(Int(t.f.rounded())) g")
                            .nkFont(12.5, design: .monospaced).foregroundStyle(.white.opacity(0.75)).fixedSize(horizontal: false, vertical: true)
                        if let notice = draftNotice(d) { Text(notice).nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true) }
                    }
                    if case .failed(let why) = card.state {
                        Text(why).nkFont(13).foregroundStyle(.white.opacity(0.65)).fixedSize(horizontal: false, vertical: true)
                    }
                    Text(pendingCardLine(card)).nkFont(14).lineSpacing(2).foregroundStyle(.white.opacity(0.85)).fixedSize(horizontal: false, vertical: true)
                    if case .waiting = card.state { OfflineChip() }
                    actions(card)
                }
                .padding(18)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .nkGlass(22)
            .accessibilityElement(children: .contain)
        }
    }

    private func header(_ card: PendingDraft) -> some View {
        let f = DateFormatter(); f.dateFormat = "MMM d. HH:mm"; f.locale = Locale(identifier: "hu_HU")
        let label: String = switch card.state { case .waiting: "A TELEFONON VAN"; case .failed: "NEM SIKERÜLT ELKÜLDENI"; case .ready: "JÓVÁHAGYÁSRA VÁR" }
        return HStack(spacing: 8) {
            Text("\(label) · \(f.string(from: card.capturedAt))").nkFont(11, design: .monospaced).foregroundStyle(.white.opacity(0.55))
                .lineLimit(1).minimumScaleFactor(0.7)
        }
    }

    private func headline(_ card: PendingDraft) -> String? {
        switch card.state {
        case .ready(let d): draftTitle(d)
        case .waiting, .failed:
            if let t = card.text, !t.isEmpty { t } else { card.hasPhoto ? "Fotó az étkezésről" : "Étkezés" }
        }
    }

    @ViewBuilder private func actions(_ card: PendingDraft) -> some View {
        HStack(spacing: 8) {
            switch card.state {
            case .ready:
                pill("Mentem", primary: true) { onSave(card) }
                pill("Átnézem", primary: false) { onEdit(card) }
                pill("Elvetem", primary: false) { onDiscard(card) }
            case .failed:
                pill("Újra", primary: true) { onRetry(card) }
                pill("Elvetem", primary: false) { onDiscard(card) }
            case .waiting:
                pill("Elvetem", primary: false) { onDiscard(card) }
            }
            Spacer(minLength: 0)
        }
    }

    private func pill(_ title: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).nkFont(14, primary ? .semibold : .regular).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(primary ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 16).frame(minHeight: 38)
                .background(Capsule().fill(primary ? .white.opacity(0.95) : .white.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}
