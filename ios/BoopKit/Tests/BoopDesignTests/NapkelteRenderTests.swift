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

@Test @MainActor func mirroredLandRenders() {
    #expect(render(MirroredLand(hue: .fuel), height: 300) != nil)
}
