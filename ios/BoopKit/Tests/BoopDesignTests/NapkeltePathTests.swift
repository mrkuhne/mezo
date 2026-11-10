import Testing
import SwiftUI
@testable import BoopDesign

private func st(_ id: String, done: Bool = false, now: Bool = false) -> PathStation {
    PathStation(id: id, time: "", glyph: "sun-ink", title: id, sub: "", done: done, isNow: now)
}

@Test func litUpToNow() {
    let s = [st("a", done: true), st("b", done: true), st("now", now: true), st("c"), st("d")]
    #expect(pathLit(s) == [true, true, false, false, false])
}

@Test func emptyPathIsEmpty() { #expect(pathLit([]) == []) }

@Test func nowOnlyPath() { #expect(pathLit([st("now", now: true)]) == [false]) }

@Test func futureOnlyPathIsDark() { #expect(pathLit([st("a"), st("b")]) == [false, false]) }

@Test @MainActor func dayPathRenders() {
    let s = [st("a", done: true), st("now", now: true), st("b")]
    #expect(render(DayPath(stations: s, hue: .forma) { _ in EmptyView() }, height: 400) != nil)
}
