import SwiftUI

/// The „Mikor" row every capture sheet carries (`mezo-r36n9.159`, spec §3.1): the composer's time row lifted into the
/// kit. Day form — **Ma · Tegnap · Más nap**; time form — **Most · Tegnap · Más időpont**. The resolved day is always
/// printed at the row's right edge, so the owner sees where the capture goes; „Más…" opens the compact picker,
/// bounded to the caller's `range` (today and the previous six days). In the time form a „Tegnap" tap opens the
/// picker too, so the time can be moved in one more tap.
///
/// The kit knows no dates' meaning: the caller gives the resolved `label`, which chip is on, the picker's binding and
/// its range (BoopCore's `whenLabel`/`whenResolved`/`whenEarliest` — the app's `WhenRow` wires them).
public struct NKWhenRow: View {
    public enum Pick: Equatable, Sendable { case now, yesterday, other }

    let eyebrow: String
    let hue: Hue
    let withTime: Bool
    let label: String
    let pick: Pick
    @Binding var picked: Date
    let range: ClosedRange<Date>
    let onNow: () -> Void
    let onYesterday: () -> Void
    let onOther: () -> Void
    @State private var picking = false

    public init(eyebrow: String, hue: Hue, withTime: Bool = false, label: String, pick: Pick, picked: Binding<Date>,
                range: ClosedRange<Date>, onNow: @escaping () -> Void, onYesterday: @escaping () -> Void,
                onOther: @escaping () -> Void) {
        self.eyebrow = eyebrow; self.hue = hue; self.withTime = withTime; self.label = label; self.pick = pick
        self._picked = picked; self.range = range; self.onNow = onNow; self.onYesterday = onYesterday; self.onOther = onOther
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                NKGlyph("clock-ink", .white.opacity(0.7), size: 14)
                NKMono(eyebrow)
                Spacer(minLength: 8)
                Text(label).nkFont(13, .medium).foregroundStyle(hue.glow)
            }
            HStack(spacing: 8) {
                chip(withTime ? "Most" : "Ma", on: pick == .now && !picking) { picking = false; onNow() }
                chip("Tegnap", on: pick == .yesterday && !picking) { picking = withTime; onYesterday() }
                chip(withTime ? "Más időpont" : "Más nap", on: picking) {
                    picking.toggle()
                    if picking { onOther() }
                }
            }
            if picking {
                DatePicker("Mikor", selection: $picked, in: range,
                           displayedComponents: withTime ? [.date, .hourAndMinute] : [.date])
                    .datePickerStyle(.compact).labelsHidden().colorScheme(.dark).tint(hue.glow)
                    .environment(\.locale, Locale(identifier: "hu_HU"))
                Text("Egy hétre visszamenőleg tudsz rögzíteni.").nkFont(12).foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(eyebrow): \(label)")
    }

    private func chip(_ text: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
