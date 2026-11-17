import SwiftUI
import Testing
@testable import BoopDesign

/// The SVG path reader. The body geometry is upstream path data, so this is the one piece
/// between the real anatomy and the screen — a bug here draws a wrong body silently, which is
/// why the odd corners of the format (no separators, implicit linetos, arc flags) are each a
/// test rather than a comment.
struct NKPathTests {
    func box(_ d: String) -> CGRect { NKPath.parse(d).boundingRect }

    func isClose(_ a: CGFloat, _ b: CGFloat, _ tolerance: CGFloat = 0.01) -> Bool { abs(a - b) <= tolerance }

    @Test func absoluteMoveAndLines() {
        let r = box("M10 10 L30 10 L30 50 Z")
        #expect(isClose(r.minX, 10) && isClose(r.minY, 10))
        #expect(isClose(r.maxX, 30) && isClose(r.maxY, 50))
    }

    @Test func relativeCommandsFollowTheCursor() {
        // The same triangle, drawn relatively.
        let r = box("m10 10 l20 0 l0 40 z")
        #expect(isClose(r.minX, 10) && isClose(r.minY, 10))
        #expect(isClose(r.maxX, 30) && isClose(r.maxY, 50))
    }

    @Test func aRepeatedPairAfterAMoveIsALine() {
        // SVG 9.3.3: "M10 10 20 20" is a move and then a LINE, not two moves. Reading it as two
        // moves would leave the shape as a dot — and the upstream body is full of this form.
        let r = box("M10 10 20 20 30 10")
        #expect(isClose(r.minX, 10) && isClose(r.maxX, 30))
        #expect(isClose(r.minY, 10) && isClose(r.maxY, 20))
    }

    @Test func numbersNeedNoSeparator() {
        // "77.5-.5" is two numbers, and ".5.5" is two more: the upstream data is minified this
        // way throughout, so a naive split on whitespace loses most of the body.
        let r = box("M0 0L77.5-.5.5.5")
        #expect(isClose(r.minX, 0) && isClose(r.maxX, 77.5))
        #expect(isClose(r.minY, -0.5) && isClose(r.maxY, 0.5))
    }

    @Test func curvesAreFollowed() {
        let r = box("M0 0c10 0 20 0 30 0")
        #expect(isClose(r.minX, 0) && isClose(r.maxX, 30))
    }

    @Test func smoothCurveReflectsThePreviousControl() {
        // The reflected control keeps the curve going the same way; drawn without the
        // reflection the second half would bend back and the shape would pinch.
        let reflected = box("M0 0 C0 -10 10 -10 10 0 S20 10 20 0")
        #expect(isClose(reflected.maxX, 20))
        #expect(reflected.maxY > 0)     // the second half bulges downward
        #expect(reflected.minY < 0)     // the first half bulged upward
    }

    @Test func quadraticAndSmoothQuadratic() {
        let r = box("M0 0 Q5 -10 10 0 T20 0")
        #expect(isClose(r.minX, 0) && isClose(r.maxX, 20))
        #expect(r.minY < 0 && r.maxY > 0)
    }

    @Test func arcFlagsMayHaveNoSeparator() {
        // "a.23.23 0 01-.19-.21" — radii, rotation, then the two flags glued together as "01",
        // then the endpoint. Reading "01" as the number 1 loses the rest of the shape, and this
        // exact form appears in the abs outline.
        let r = box("M311.02 531.71a.23.23 0 01-.19-.21")
        #expect(r.width > 0 && r.height > 0)
        #expect(isClose(r.maxX, 311.02, 0.05))
        #expect(isClose(r.minX, 310.83, 0.05))
    }

    @Test func aHalfCircleArcSpansItsDiameter() {
        // From (0,0) to (20,0) with radius 10: the arc bulges one way, and the sweep flag says
        // which. SVG's y grows downward, so sweep=1 (the positive-angle direction) passes
        // through the point ABOVE the line, and sweep=0 below it. Getting this pair the wrong
        // way round mirrors every curved shape in the body without changing its size.
        let sweepOne = box("M0 0 A10 10 0 0 1 20 0")
        let sweepZero = box("M0 0 A10 10 0 0 0 20 0")
        #expect(isClose(sweepOne.width, 20, 0.2) && isClose(sweepZero.width, 20, 0.2))
        #expect(sweepOne.minY < -9 && isClose(sweepOne.maxY, 0, 0.2))
        #expect(sweepZero.maxY > 9 && isClose(sweepZero.minY, 0, 0.2))
    }

    @Test func horizontalAndVerticalLines() {
        let r = box("M5 5 H25 V35 h-10 v-10")
        #expect(isClose(r.minX, 5) && isClose(r.maxX, 25))
        #expect(isClose(r.minY, 5) && isClose(r.maxY, 35))
    }

    @Test func anEmptyOrUnreadableStringIsAnEmptyPath() {
        #expect(NKPath.parse("").isEmpty)
        #expect(NKPath.parse("   ").isEmpty)
        // A command nobody knows stops the path instead of guessing at the rest.
        #expect(NKPath.parse("M0 0 L10 10 ?5 5 L99 99").boundingRect.maxX == 10)
    }

    // MARK: - The real body

    @Test func everyUpstreamShapeParsesToSomethingDrawable() {
        // The point of the whole file: all 44 shapes of the real geometry must come out with an
        // area. A shape that silently parses to nothing is an invisible hole in the body.
        for view in NKBodyView.allCases {
            for (slug, paths) in NKBodyGeometry.shapes(view) {
                let rect = NKPath.parse(paths).boundingRect
                #expect(rect.width > 0.5, "\(view.rawValue)/\(slug) has no width")
                #expect(rect.height > 0.5, "\(view.rawValue)/\(slug) has no height")
            }
        }
    }

    @Test func theTwoBodiesHaveTheirOwnFrames() {
        // Upstream draws front and back side by side in ONE canvas: the back body starts around
        // x = 760, not at the origin. Measuring each view's own box is what keeps the back body
        // on screen — a shared or hand-copied box clips it, and the clip looks deliberate.
        let front = NKBodyPaths.viewBox(.front)
        let back = NKBodyPaths.viewBox(.back)
        #expect(front.minX < back.minX - 100)
        // Both are a standing body: much taller than wide, and about the same height.
        for box in [front, back] {
            #expect(box.height > box.width * 1.5)
            #expect(box.width > 100 && box.height > 300)
        }
        #expect(isClose(front.height, back.height, 40))
    }

    @Test func everyMuscleTokenTheAppUsesLandsOnAShape() {
        // The mapping and the artwork must agree: a token with no shape is a muscle the body
        // can never light up, and it would fail silently.
        for token in NKBodyMapShapes.allTokens {
            let shapes = NKBodyMapShapes.shapes(for: token)
            #expect(!shapes.isEmpty, "\(token) maps to no shape")
            for (view, slug) in shapes {
                #expect(NKBodyGeometry.shapes(view)[slug] != nil, "\(token) → \(view.rawValue)/\(slug) does not exist")
            }
        }
    }
}
