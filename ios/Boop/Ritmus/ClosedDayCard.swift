import SwiftUI
import BoopDesign

/// "A MAI NAPOD" (spec §5.4): the closed day's rows and the journal line on one glass card — the evening close's
/// summary, and Napló's day, are this one view.
struct ClosedDayCard: View {
    let rows: [EsteFlow.Row]
    let quote: EsteFlow.Quote?
    /// *Újra* on a recording that could not be written down; nil hides the button (a past day's card).
    var onRetry: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            NKMono("A MAI NAPOD")
            ForEach(rows, id: \.label) { row in
                HStack {
                    Text(row.label).nkFont(15).foregroundStyle(.white.opacity(0.7))
                    Spacer()
                    Text(row.value).nkFont(15, .medium).foregroundStyle(.white)
                }
                .accessibilityElement(children: .combine)
            }
            if let quote {
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                switch quote {
                case .text(let t):
                    Text("„\(t)”").nkFont(16, design: .serif).foregroundStyle(.white.opacity(0.8)).fixedSize(horizontal: false, vertical: true)
                case .waitingForTranscript:
                    Text("Hangfelvétel · szöveggé alakítom, amint lesz net").nkFont(14).foregroundStyle(.white.opacity(0.8))
                case .transcriptFailed:
                    HStack {
                        Text("Hangfelvétel · nem sikerült leírni").nkFont(14).foregroundStyle(.white.opacity(0.8))
                        Spacer()
                        if let onRetry {
                            Button(action: onRetry) {
                                Text("Újra").nkFont(14, .semibold).foregroundStyle(.white)
                                    .padding(.horizontal, 14).frame(height: 32)
                                    .background(Capsule().fill(.white.opacity(0.12)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
