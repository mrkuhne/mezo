import Foundation

// Day capacity wire types the generated client does not carry (B7 K2, `mezo-r36n9.17`), for the lenient
// `KapacitasClient`. Contract: `api/feature/capacity/capacity.yml`.

/// How an event felt, as the day page's three chips say it („Merít · Semleges · Feltölt"); `rawValue` is the wire's.
public enum KapacitasEffect: String, CaseIterable, Sendable, Identifiable {
    case drains, neutral, feeds

    public var id: String { rawValue }

    /// The chip's word.
    public var label: String {
        switch self {
        case .drains: "Merít"
        case .neutral: "Semleges"
        case .feeds: "Feltölt"
        }
    }
}

/// `PUT /api/capacity/event-feedback` body. The key travels in the body: device calendar ids may carry '/' and ':'.
struct KapacitasFeedbackBody: Encodable, Sendable {
    let eventKey: String
    let effect: String
}
