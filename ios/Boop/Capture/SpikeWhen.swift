import SwiftUI
import BoopCore
import BoopDesign

// SPIKE (throwaway, `spike/boop-visszamenoleg-ital`): the "Mikor" row every capture sheet would carry — the composer's
// MealTimeRow lifted. Day form: Ma · Tegnap · Más nap. Time form: Most · Tegnap · Más időpont. The resolved day is
// always printed beside the eyebrow. Window: today and the previous six days, never the future.

struct SpikeWhenRow: View {
    let eyebrow: String
    let hue: Hue
    var withTime = false
    /// nil = now / today.
    @Binding var chosen: Date?
    @State private var picking = false

    /// `-previewWhen tegnap` opens the sheets on yesterday (screenshots).
    static var previewDefault: Date? {
        guard UserDefaults.standard.string(forKey: "previewWhen") == "tegnap" else { return nil }
        return Calendar.current.date(byAdding: .day, value: -1, to: Date())
    }

    private var cal: Calendar { .current }
    private var earliest: Date { cal.date(byAdding: .day, value: -6, to: cal.startOfDay(for: Date())) ?? Date() }
    private var resolved: Date { chosen ?? Date() }
    private var isYesterday: Bool { chosen.map { cal.isDateInYesterday($0) } ?? false }
    private var isNow: Bool { chosen == nil }

    private var label: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "hu_HU")
        if withTime {
            if isNow { return "most" }
            if cal.isDateInToday(resolved) { f.dateFormat = "'ma' · HH:mm" }
            else if cal.isDateInYesterday(resolved) { f.dateFormat = "'tegnap' · HH:mm" }
            else { f.dateFormat = "MMM d. · HH:mm" }
        } else {
            if isNow || cal.isDateInToday(resolved) { return "ma" }
            if cal.isDateInYesterday(resolved) { return "tegnap" }
            f.dateFormat = "MMM d. · EEEE"
        }
        return f.string(from: resolved)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                NKGlyph("clock-ink", .white.opacity(0.7), size: 14)
                NKMono(eyebrow)
                Spacer(minLength: 8)
                Text(label).nkFont(13, .medium).foregroundStyle(hue.glow)
            }
            HStack(spacing: 8) {
                chip(withTime ? "Most" : "Ma", on: isNow && !picking) { chosen = nil; picking = false }
                chip("Tegnap", on: isYesterday && !picking) {
                    chosen = cal.date(byAdding: .day, value: -1, to: Date()); picking = withTime
                }
                chip(withTime ? "Más időpont" : "Más nap", on: picking) {
                    picking.toggle(); if picking, chosen == nil { chosen = Date() }
                }
            }
            if picking {
                DatePicker("Mikor", selection: Binding(get: { resolved }, set: { chosen = min(Date(), max(earliest, $0)) }),
                           in: earliest...Date(), displayedComponents: withTime ? [.date, .hourAndMinute] : [.date])
                    .datePickerStyle(.compact).labelsHidden().colorScheme(.dark).tint(hue.glow)
                    .environment(\.locale, Locale(identifier: "hu_HU"))
                Text("Egy hétre visszamenőleg tudsz rögzíteni.").nkFont(12).foregroundStyle(.white.opacity(0.5))
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
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
