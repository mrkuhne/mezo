import SwiftUI
import WidgetKit

/// TEMPORARY free-team probe widget (`mezo-r36n9.172` Task 11): shows whether the App Group and the shared Keychain
/// reach the extension. Removed once the probe is recorded.
struct ProbeWidget: Widget {
    struct Entry: TimelineEntry { let date: Date; let lines: [String] }

    struct Provider: TimelineProvider {
        func placeholder(in context: Context) -> Entry { Entry(date: .now, lines: ["próba"]) }
        func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
            completion(Entry(date: .now, lines: SharedProbe.read()))
        }
        func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
            completion(Timeline(entries: [Entry(date: .now, lines: SharedProbe.read())], policy: .after(.now.addingTimeInterval(300))))
        }
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "boop.probe", provider: Provider()) { entry in
            VStack(alignment: .leading, spacing: 6) {
                Text("PRÓBA").font(.caption2.monospaced())
                ForEach(entry.lines, id: \.self) { Text($0).font(.caption2).lineLimit(3) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Boop próba")
        .description("Ideiglenes próba.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
