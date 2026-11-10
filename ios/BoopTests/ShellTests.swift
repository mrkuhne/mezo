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

    @Test func panFollowsTheBarOrder() {
        #expect(domainDirection(from: "Nap", to: "Fuel") == 1)
        #expect(domainDirection(from: "Én", to: "Edzés") == -1)
        #expect(domainDirection(from: "Boop", to: "Fuel") == -1)
        #expect(domainDirection(from: "Edzés", to: "Boop") == 1)
    }
}
