import Testing
import UIKit
import SwiftUI
@testable import BoopDesign

/// Renders a view offscreen and returns the image (nil means SwiftUI could not render it).
@MainActor func render<V: View>(_ v: V, width: CGFloat = 390, height: CGFloat = 600) -> UIImage? {
    let r = ImageRenderer(content: v.frame(width: width, height: height))
    r.scale = 1
    return r.uiImage
}

/// The RGB of one pixel of an image.
func pixel(_ img: UIImage, x: Int, y: Int) -> (Int, Int, Int)? {
    guard let cg = img.cgImage, let data = cg.dataProvider?.data, let p = CFDataGetBytePtr(data) else { return nil }
    let bpp = cg.bitsPerPixel / 8, off = y * cg.bytesPerRow + x * bpp
    return (Int(p[off]), Int(p[off + 1]), Int(p[off + 2]))
}

@Test @MainActor func everyHueRendersALandscape() {
    for h in Hue.allCases {
        let img = render(PaintedLandscape(hue: h))
        #expect(img != nil)
        if let img, let c = pixel(img, x: 195, y: 150) {
            #expect(c != (0x0D, 0x12, 0x18), "landscape \(h.name) is blank")
        }
    }
}

@Test @MainActor func calmSkyRendersALandscape() {
    let img = render(PaintedLandscape(sky: .calm))
    #expect(img != nil)
    if let img, let c = pixel(img, x: 195, y: 150) { #expect(c != (0x0D, 0x12, 0x18)) }
}

@Test @MainActor func mirroredLandRenders() {
    #expect(render(MirroredLand(hue: .fuel), height: 300) != nil)
}

@Test @MainActor func outlinedGlyphsRender() {
    for n in ["check-ink", "clock-ink", "camera-ink", "book-sage", "sun-ink"] {
        #expect(render(NKGlyph(n, .white, size: 22), width: 22, height: 22) != nil, "glyph \(n)")
    }
}

@Test func outlinedSetCoversTheBlobbingGlyphs() {
    #expect(NKGlyph.outlined == ["check-ink", "clock-ink", "camera-ink", "book-sage"])
}

@Test @MainActor func pillRendersAtAccessibilitySize() {
    #expect(render(NKPill("Kitöltöm") {}.dynamicTypeSize(.accessibility3), width: 300, height: 80) != nil)
}

@Test @MainActor func glassCardRenders() {
    #expect(render(Text("x").padding().nkGlass(), width: 200, height: 100) != nil)
}

@Test @MainActor func tabStripRendersAtAccessibilitySize() {
    #expect(render(NKTabStrip(tabs: ["Mai", "A napom", "Beszélgetés", "Rutin"], selected: .constant("Mai"), dot: "A napom")
        .dynamicTypeSize(.accessibility3), width: 390, height: 60) != nil)
}

@Test @MainActor func flowFrameRenders() {
    #expect(render(NKFlowFrame(hue: .alvas, crumb: "Egészség és naptár", eyebrow: "Kössük össze", title: "Egészség és naptár",
                               sub: "Ebből tudom, milyen napod lesz.", onBack: {}) { Text("x") }, height: 800) != nil)
}

@Test @MainActor func tabPageRenders() {
    #expect(render(NKTabPage(hue: .forma, heroHeight: 500, compact: nil) { Text("hero") } content: { Text("body") }, height: 800) != nil)
}

@Test @MainActor func boopCardRenders() {
    #expect(render(NKBoopCard(pre: "A csapat üzenőfala ", em: "ide költözik", post: ".", action: "Megnyitom") {}, height: 200) != nil)
}

@Test @MainActor func glassFieldShowsItsProblem() {
    #expect(render(NKField("Meghívókód", text: .constant("BOOP-7Q2K"), kind: .code, problem: "Ezt a kódot már felhasználták."), height: 120) != nil)
    #expect(render(NKField("Jelszó", text: .constant("x"), kind: .password).dynamicTypeSize(.accessibility3), height: 140) != nil)
}

@Test @MainActor func skyScreenRenders() {
    #expect(render(NKSkyScreen(hue: .forma, onBack: nil) { Text("Jó újra látni") }, height: 800) != nil)
}

@Test @MainActor func rowWithTagsRenders() {
    #expect(render(NKRow(glyph: "heart-cream", title: "Apple Egészség",
                         tags: [NKTag("alvás, mozgás, pulzus"), NKTag("nincs engedély", warn: true)], chevron: true), height: 90) != nil)
}

@MainActor private func naturalWidth<V: View>(_ v: V) -> CGFloat {
    let r = ImageRenderer(content: v.fixedSize())
    r.scale = 1
    return r.uiImage?.size.width ?? 0
}

@Test @MainActor func scaledFontGrowsWithDynamicType() {
    for design in [Font.Design.default, .serif, .monospaced] {
        let small = naturalWidth(Text("Jó napod lesz").nkFont(17, design: design).dynamicTypeSize(.large))
        let big = naturalWidth(Text("Jó napod lesz").nkFont(17, design: design).dynamicTypeSize(.accessibility3))
        #expect(big > small * 1.3, "design \(design): \(small) → \(big)")
    }
}
