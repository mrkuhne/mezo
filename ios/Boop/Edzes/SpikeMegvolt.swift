import SwiftUI
import BoopCore
import BoopDesign

// SPIKE (throwaway): the gym catch-up — a past template day booked "Megvolt" with the plan's numbers.

struct WorkoutAsPlannedSpikeSheet: View {
    let onDone: (String?) -> Void
    @State private var planTime = true

    private let rows: [(name: String, sets: String)] = [
        ("Lehúzás széles fogással", "3 × 10 · 55 kg"),
        ("Döntött törzsű evezés", "3 × 8 · 60 kg"),
        ("Egykezes evezés", "3 × 12 · 26 kg"),
        ("Bicepsz állva", "3 × 12 · 14 kg"),
        ("Face pull", "3 × 15 · – kg · írd be"),
    ]

    var body: some View {
        NKSheetFrame(hue: .mozgas, eyebrow: "Edzés pótlása · tegnap", title: "Pull Day") {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 0) {
                    NKMono("A TERV SOROZATAI").padding(.bottom, 10)
                    ForEach(Array(rows.enumerated()), id: \.offset) { k, r in
                        if k > 0 { Rectangle().fill(.white.opacity(0.07)).frame(height: 0.5) }
                        HStack(spacing: 10) {
                            Text(r.name).nkFont(15, .medium).foregroundStyle(.white).lineLimit(1)
                            Spacer(minLength: 8)
                            Text(r.sets).nkFont(12.5, design: .monospaced)
                                .foregroundStyle(r.sets.contains("írd be") ? .white.opacity(0.5) : Hue.mozgas.glow)
                        }
                        .frame(minHeight: 40)
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        NKGlyph("clock-ink", .white.opacity(0.7), size: 14)
                        NKMono("MIKOR")
                        Spacer(minLength: 8)
                        Text("tegnap · 18:00").nkFont(13, .medium).foregroundStyle(Hue.mozgas.glow)
                    }
                    HStack(spacing: 8) {
                        chip("A terv ideje", on: planTime) { planTime = true }
                        chip("Más időpont", on: !planTime) { planTime = false }
                    }
                }
                .padding(14).frame(maxWidth: .infinity, alignment: .leading).nkGlass(16)
                Text("A terv számaival könyvelem; a súlyt gyakorlatonként itt átírhatod, utána már nem.")
                    .nkFont(12.5).foregroundStyle(.white.opacity(0.5)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .safeAreaInset(edge: .bottom) { QuickFoot(title: "Megvolt") { onDone("Edzés könyvelve · tegnap") } }
    }

    private func chip(_ text: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).nkFont(12.5, .medium).foregroundStyle(on ? NK.ground : .white.opacity(0.85))
                .padding(.horizontal, 12).frame(minHeight: 34)
                .background(Capsule().fill(on ? .white.opacity(0.92) : .white.opacity(0.08)))
        }
        .buttonStyle(.plain)
    }
}
