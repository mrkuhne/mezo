import Testing
import UIKit
import SwiftUI
@testable import BoopDesign

@Test func spineBarHasFourLabelsAndPlus() {
    #expect(NKSpineBar.labels == ["Ma", "Terv", "Napló", "Boop"])
}

@Test @MainActor func spineBarRenders() {
    #expect(render(NKSpineBar(selected: .constant(0), onPlus: {}), height: 90) != nil)
}

@Test @MainActor func proposalCardRendersAllStates() {
    let states: [NKProposalState] = [.pending, .accepted("Az edzés 18:30-ra került"), .dismissed("Félretéve: told 18:30-ra")]
    for s in states {
        let card = NKProposalCard(text: "Told 18:30-ra az edzést", sub: "17:30-ig tele a naptárad.", state: s,
                                  onAccept: {}, onDismiss: {}, onWhy: {})
        let img = render(card, height: 260)
        #expect(img != nil)
        #expect(img?.cgImage != nil)
    }
}

@Test @MainActor func compactProposalCardRenders() {
    #expect(render(NKProposalCard(text: "x", sub: "y", state: .pending, compact: true, onAccept: {}, onDismiss: {}, onWhy: {}), height: 260) != nil)
}

@Test @MainActor func whyBodyRendersWithZeroExperts() {
    let v = NKWhyBody(title: "Told 18:30-ra az edzést", sub: "Mert tele a naptár.",
                      facts: [("17:30", "", "naptár vége"), ("32", "perc", "levegő")], experts: [], closing: "Te döntesz.")
    #expect(render(v, height: 800) != nil)
}

@Test @MainActor func whyBodyRendersWithExperts() {
    let v = NKWhyBody(title: "T", sub: "S", facts: [("1", "x", "l")],
                      experts: [("Alvás", Hue.alvas.orb, "Jó.", false), ("Szkeptikus", Hue.pulzus.orb, "Talán.", true)], closing: "C")
    #expect(render(v, height: 800) != nil)
}

@Test @MainActor func drillPageRenders() {
    let v = NKDrillPage(hue: .alvas, crumb: "Ma · Alvás", eyebrow: "Az éjszakád", headline: "Jó éjszaka", sentence: "Hét óra alvás.",
                        level: 0.8, onBack: {}) {
        NKDrillSection(number: 1, label: "A SZINT") { Text("7:12") }
    }
    #expect(render(v, height: 900) != nil)
    #expect(render(NKDrillPage(hue: .forma, crumb: "c", eyebrow: "e", headline: "h", sentence: "s", level: nil, onBack: {}) { Text("x") }, height: 900) != nil)
}

@Test @MainActor func titleRowRendersWithoutPlus() {
    #expect(render(NKTitleRow(onBell: {}, onAvatar: {}), height: 60) != nil)
}

@Test @MainActor func dayPathNowCardRendersWhenOpens() {
    func stations(opens: Bool) -> [PathStation] {
        [PathStation(id: "n", time: "13:40", glyph: "sun-ink", title: "Most", sub: "", done: false, isNow: true, opens: opens)]
    }
    func hasRed(_ img: UIImage) -> Bool {
        guard let cg = img.cgImage, let d = cg.dataProvider?.data, let p = CFDataGetBytePtr(d) else { return false }
        let bpp = cg.bitsPerPixel / 8
        for y in stride(from: 0, to: cg.height, by: 2) { for x in stride(from: 0, to: cg.width, by: 2) {
            let o = y * cg.bytesPerRow + x * bpp
            let c = [Int(p[o]), Int(p[o + 1]), Int(p[o + 2])]
            if c.max()! - c.min()! > 60 { return true }   // a saturated pixel, whatever the channel order
        } }
        return false
    }
    func card(_ s: PathStation) -> some View { Color(red: 1, green: 0, blue: 0).frame(height: 60) }
    let withCard = render(DayPath(stations: stations(opens: true), hue: .forma, card: card), height: 200)
    let without = render(DayPath(stations: stations(opens: false), hue: .forma, card: card), height: 200)
    #expect(render(Color.red, height: 60).map(hasRed) == true, "detector sanity")
    #expect(withCard.map(hasRed) == true)
    #expect(without.map(hasRed) == false)
}
