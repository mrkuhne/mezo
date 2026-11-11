import Testing
import BoopDesign
@testable import Boop

struct ShellTabTests {
    @Test func restoresNewKeys() {
        #expect(ShellTab.restored("ma") == .ma)
        #expect(ShellTab.restored("terv") == .terv)
        #expect(ShellTab.restored("naplo") == .naplo)
        #expect(ShellTab.restored("boop") == .boop)
    }

    @Test func oldDomainValuesLandOnMa() {
        for old in ["Nap", "Edzés", "Fuel", "Boop", "Én", ""] { #expect(ShellTab.restored(old) == .ma) }
    }

    @Test func storageKeyRoundTrips() {
        for t in ShellTab.allCases { #expect(ShellTab.restored(t.storageKey) == t) }
        #expect(ShellTab.allCases.map(\.storageKey) == ["ma", "terv", "naplo", "boop"])
    }

    @Test func eachPlaceHasItsSky() {
        let panels = shellPanels([:])
        #expect(panels.map(\.hue) == [.forma, .fuel, .alvas, .forma])
        let maOnSleep = shellPanels([.ma: NKBackdrop(hue: .alvas, heroHeight: 900, scrollY: 0)])
        #expect(maOnSleep[0].hue == .alvas)
        #expect(maOnSleep[0].heroHeight == 900)
    }

    @Test func weightReadsInHungarian() {
        #expect(hungarianKg(82.4) == "82,4")
        #expect(hungarianKg(82) == "82,0")
    }
}
