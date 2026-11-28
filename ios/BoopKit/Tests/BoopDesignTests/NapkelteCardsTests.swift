import Testing
@testable import BoopDesign

// The shared card pieces of the Edzés redesign (mezo-r36n9.197.1, spec 2026-11-27 §5.1).

@MainActor @Test func pagedHeroHidesDotsForOnePage() {
    #expect(NKPagedHero.showsDots(pageCount: 1) == false)
    #expect(NKPagedHero.showsDots(pageCount: 2) == true)
    #expect(NKPagedHero.showsDots(pageCount: 3) == true)
}

@MainActor @Test func pagedHeroStacksAtAccessibilitySizesAndUnderVoiceOver() {
    #expect(NKPagedHero.stacks(accessibilitySize: false, voiceOver: false) == false)
    #expect(NKPagedHero.stacks(accessibilitySize: true, voiceOver: false))
    #expect(NKPagedHero.stacks(accessibilitySize: false, voiceOver: true))
}

@MainActor @Test func cardActionsAllowAtMostTwoQuiet() { #expect(NKCardActions.maxQuiet == 2) }
