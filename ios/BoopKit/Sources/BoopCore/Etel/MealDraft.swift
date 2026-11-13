import Foundation
import ImageIO
import UniformTypeIdentifiers

/// What the phone keeps of a meal captured without the net (B4): the words, the barcode and the id of the photo stored
/// beside the queue. This is the outbox payload — the image bytes are never inside it.
public struct MealCapture: Codable, Equatable, Sendable {
    public var text: String?
    public var barcode: String?
    /// The stored photo's id (`FoodOutbox.storePhoto`); the file is `meal-<id>.jpg` next to the queue.
    public var photoRef: UUID?
    public init(text: String?, barcode: String? = nil, photoRef: UUID? = nil) {
        self.text = text; self.barcode = barcode; self.photoRef = photoRef
    }
}

/// Where a captured meal stands (decision 9: nothing is saved without the owner's tap).
public struct PendingDraft: Identifiable, Equatable, Sendable {
    public enum State: Equatable, Sendable {
        /// On the phone, to be computed when the network is there (a flaky net keeps retrying quietly).
        case waiting
        /// Will not be sent without the owner's *Újra* (a refusal, out of tries, older than 7 days); its values stay.
        case failed(String)
        /// Computed: a confirmation card — one tap saves it. The photo stays beside the queue (`photoData`).
        case ready(MealDraft)
    }
    public let id: UUID
    /// The instant of capture, with the phone's own day (never UTC's).
    public let capturedAt: Date
    /// The local day, `yyyy-MM-dd`.
    public let date: String
    public var text: String?
    public var barcode: String?
    /// The photo stored beside the queue, if the capture has one.
    public var photoRef: UUID?
    public var state: State
    public var hasPhoto: Bool { photoRef != nil }
}

public enum FoodOutboxError: Error, Equatable, Sendable { case unreadablePhoto }

/// Meal photos as the server takes them: JPEG (its image store reads JPEG and PNG, no WebP), long edge at most 1600 px.
public enum MealPhoto {
    public static let longEdge = 1600

    /// The picture as JPEG with its orientation baked in and the long edge shrunk to `longEdge` (never enlarged);
    /// nil when the bytes are not an image.
    public static func jpeg(from data: Data, longEdge: Int = MealPhoto.longEdge, quality: Double = 0.8) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let w = props[kCGImagePropertyPixelWidth] as? Int, let h = props[kCGImagePropertyPixelHeight] as? Int,
              w > 0, h > 0 else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: min(longEdge, max(w, h)),
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? out as Data : nil
    }
}
