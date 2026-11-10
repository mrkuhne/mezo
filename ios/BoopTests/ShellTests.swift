import Testing
import BoopDesign
@testable import Boop

struct ShellTests {
    @Test func webTabsKeepTheirCopy() {
        #expect(WebOnlyTabView.Domain.edzes.boopLine.1 == "itt indulnak")
        #expect(WebOnlyTabView.Domain.fuel.boopLine.1 == "fotóból")
        #expect(WebOnlyTabView.Domain.boop.boopLine.1 == "ide költözik")
        #expect(WebOnlyTabView.Domain.edzes.tabs == ["Mai", "Terv", "Sport", "Terhelés", "Tár"])
    }

    @Test func webTabsHaveTheirHue() {
        #expect(WebOnlyTabView.Domain.edzes.hue == .mozgas)
        #expect(WebOnlyTabView.Domain.fuel.hue == .fuel)
        #expect(WebOnlyTabView.Domain.boop.hue == .forma)
    }

    @Test func backdropFollowsTheBarOrder() {
        #expect(domainIndex("Nap") == 0)
        #expect(domainIndex("Fuel") == 2)
        #expect(domainIndex("Én") == 4)
        #expect(domainIndex("valami") == 0)
    }

    @Test func eachDomainHasItsSky() {
        let panels = domainPanels([:])
        #expect(panels.map(\.hue) == [.forma, .mozgas, .fuel, .forma, .alvas])
        let napOnSleep = domainPanels(["Nap": NKBackdrop(hue: .alvas, heroHeight: 900, scrollY: 0)])
        #expect(napOnSleep[0].hue == .alvas)
        #expect(napOnSleep[0].heroHeight == 900)
    }
}
