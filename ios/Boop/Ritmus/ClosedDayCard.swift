import SwiftUI
import BoopDesign

/// "A MAI NAPOD" (spec §5.4): the closed day's rows and the journal line on one glass card — the evening close's
/// summary, and Napló's day, are this one view.
struct ClosedDayCard: View {
    let rows: [EsteFlow.Row]
    let quote: EsteFlow.Quote?
    /// *Újra* on a recording that could not be written down; nil hides the button (a past day's card).
    var onRetry: (() -> Void)?
    /// The close (or its typed line) was refused by the server: "nem sikerült elküldeni" with this *Újra*; nil = none.
    var onRetrySend: (() -> Void)?

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
                    if let onRetry {
                        RefusedRow(text: "Hangfelvétel · nem sikerült leírni", onRetry: onRetry)
                    } else {
                        Text("Hangfelvétel · nem sikerült leírni").nkFont(14).foregroundStyle(.white.opacity(0.8))
                    }
                }
            }
            if let onRetrySend {
                Rectangle().fill(.white.opacity(0.08)).frame(height: 0.5)
                RefusedRow(text: "A zárás · nem sikerült elküldeni", onRetry: onRetrySend)
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).nkGlass()
    }
}
