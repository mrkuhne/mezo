import Foundation

/// The three clock phases of the Ma screen: 04:00–09:59 reggel, 10:00–17:59 napközben, otherwise este
/// (18:00 through 03:59, the night still belongs to the evening).
public enum DayPhase: Int, CaseIterable, Sendable {
    case reggel, napkozben, este

    public var name: String {
        switch self {
        case .reggel: "Reggel"
        case .napkozben: "Napközben"
        case .este: "Este"
        }
    }

    public static func at(_ date: Date, calendar: Calendar = .current) -> DayPhase {
        switch calendar.component(.hour, from: date) {
        case 4..<10: .reggel
        case 10..<18: .napkozben
        default: .este
        }
    }
}
