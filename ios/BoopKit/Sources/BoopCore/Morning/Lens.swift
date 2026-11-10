import Foundation

/// What the hero's primary pill does (spec §5.1a). The app maps `glyph` to a kit glyph and `kind` to a flow.
public struct LensAction: Sendable, Equatable {
    public enum Kind: Sendable, Equatable { case checkin, bedtime, workout, photo, breath, eveningCheckin, windDown }
    public let glyph: String
    public let title: String
    public let kind: Kind
    public init(glyph: String, title: String, kind: Kind) { self.glyph = glyph; self.title = title; self.kind = kind }
}
public typealias LensKind = LensAction.Kind

/// The orb is a lens: the selected metric decides the hero action (spec §5.1a, evening §10).
public enum Lens {
    /// `nil` = the metric has no pill right now: Forma once the check-in of the moment is done (the pill is
    /// then *Boop elmondja*, which the app owns).
    public static func action(for key: MetricKey, brief: Brief, now: Date, evening: Bool) -> LensAction? {
        let day = brief.day
        switch key {
        case .forma:
            let slot: Brief.Checkin.Slot = evening ? .evening : .morning
            if day.checkins.contains(where: { $0.slot == slot && $0.done }) { return nil }
            return evening
                ? LensAction(glyph: "moon-cream", title: "Esti check-in", kind: .eveningCheckin)
                : LensAction(glyph: "pen-sun", title: "Kitöltöm", kind: .checkin)
        case .alvas:
            if evening { return LensAction(glyph: "book-sage", title: "Esti levezetés", kind: .windDown) }
            let title = day.bedtimeTarget.map { "Lefekvés \($0) · Emlékeztess" } ?? "Lefekvés · Emlékeztess"
            return LensAction(glyph: "moon-cream", title: title, kind: .bedtime)
        case .mozgas:
            if day.recovery != nil { return LensAction(glyph: "shoe-cream", title: "Könnyű séta", kind: .workout) }
            if day.session == nil { return LensAction(glyph: "shoe-cream", title: "Séta indítása", kind: .workout) }
            return LensAction(glyph: "dumbbell-ink", title: "Edzés indítása", kind: .workout)
        case .fuel:
            return LensAction(glyph: "camera-ink", title: "Lefotózom", kind: .photo)
        case .pulzus:
            return LensAction(glyph: "heart-cream", title: "Légzés · 1 perc", kind: .breath)
        }
    }
}
