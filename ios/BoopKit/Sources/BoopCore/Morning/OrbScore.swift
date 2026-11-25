/// What an area's orb may show while the brief is "learning" (`mezo-r36n9.152`).
///
/// The server says `learning` whenever it cannot compute **Forma** — last night's sleep is missing, or fewer nights
/// are known than it needs. Forma is the only score that state is about: Alvás, Étel, Edzés and Energia keep what
/// they have, so the ring and the hero never blank an area that has data. A missing score stays missing either way.
public func visibleScore(_ score: Int?, key: MetricKey, learning: Bool) -> Int? {
    learning && key == .forma ? nil : score
}
