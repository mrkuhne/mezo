import SwiftUI

/// An SVG path string turned into a SwiftUI `Path`.
///
/// The body geometry (`BodyGeometry.gen.swift`) is upstream SVG path data, so the phone needs
/// to read the same `d` strings the web does rather than a redrawn copy — one upstream body,
/// two renderers. This is the whole of that reader: the eleven SVG commands in their absolute
/// and relative forms, including elliptical arcs.
///
/// It is deliberately forgiving in one direction only: an unreadable command **stops** the
/// subpath instead of guessing at it, so a malformed shape draws as far as it was understood
/// and never as something invented.
public enum NKPath {
    /// Parse one SVG `d` string. Returns an empty path if nothing could be read.
    public static func parse(_ d: String) -> Path {
        var path = Path()
        var scanner = Scanner(d)
        var cursor = CGPoint.zero
        var start = CGPoint.zero
        /// The previous curve's second control point, for the smooth forms (S/s, T/t).
        var lastCubicControl: CGPoint?
        var lastQuadControl: CGPoint?
        var command: Character?

        while true {
            scanner.skipSeparators()
            if scanner.atEnd { break }
            if let c = scanner.peekCommand() {
                command = c
                scanner.advance()
            } else if command == nil {
                break   // numbers before any command: nothing to do with them
            }
            guard let cmd = command else { break }
            let relative = cmd.isLowercase

            switch cmd {
            case "M", "m":
                guard let p = scanner.point(relativeTo: relative ? cursor : .zero) else { return path }
                path.move(to: p)
                cursor = p; start = p
                lastCubicControl = nil; lastQuadControl = nil
                // After a moveto, repeated coordinate pairs are implicit linetos (SVG 9.3.3).
                command = relative ? "l" : "L"
            case "L", "l":
                guard let p = scanner.point(relativeTo: relative ? cursor : .zero) else { return path }
                path.addLine(to: p); cursor = p
                lastCubicControl = nil; lastQuadControl = nil
            case "H", "h":
                guard let x = scanner.number() else { return path }
                cursor = CGPoint(x: relative ? cursor.x + x : x, y: cursor.y)
                path.addLine(to: cursor)
                lastCubicControl = nil; lastQuadControl = nil
            case "V", "v":
                guard let y = scanner.number() else { return path }
                cursor = CGPoint(x: cursor.x, y: relative ? cursor.y + y : y)
                path.addLine(to: cursor)
                lastCubicControl = nil; lastQuadControl = nil
            case "C", "c":
                let origin = relative ? cursor : .zero
                guard let c1 = scanner.point(relativeTo: origin),
                      let c2 = scanner.point(relativeTo: origin),
                      let p = scanner.point(relativeTo: origin) else { return path }
                path.addCurve(to: p, control1: c1, control2: c2)
                cursor = p; lastCubicControl = c2; lastQuadControl = nil
            case "S", "s":
                let origin = relative ? cursor : .zero
                guard let c2 = scanner.point(relativeTo: origin),
                      let p = scanner.point(relativeTo: origin) else { return path }
                // The reflection of the previous second control point; the cursor itself when
                // the previous command was not a cubic.
                let c1 = lastCubicControl.map { CGPoint(x: 2 * cursor.x - $0.x, y: 2 * cursor.y - $0.y) } ?? cursor
                path.addCurve(to: p, control1: c1, control2: c2)
                cursor = p; lastCubicControl = c2; lastQuadControl = nil
            case "Q", "q":
                let origin = relative ? cursor : .zero
                guard let c = scanner.point(relativeTo: origin),
                      let p = scanner.point(relativeTo: origin) else { return path }
                path.addQuadCurve(to: p, control: c)
                cursor = p; lastQuadControl = c; lastCubicControl = nil
            case "T", "t":
                let origin = relative ? cursor : .zero
                guard let p = scanner.point(relativeTo: origin) else { return path }
                let c = lastQuadControl.map { CGPoint(x: 2 * cursor.x - $0.x, y: 2 * cursor.y - $0.y) } ?? cursor
                path.addQuadCurve(to: p, control: c)
                cursor = p; lastQuadControl = c; lastCubicControl = nil
            case "A", "a":
                guard let rx = scanner.number(), let ry = scanner.number(), let rotation = scanner.number(),
                      let largeArc = scanner.flag(), let sweep = scanner.flag(),
                      let p = scanner.point(relativeTo: relative ? cursor : .zero) else { return path }
                addArc(&path, from: cursor, to: p, rx: rx, ry: ry, rotation: rotation,
                       largeArc: largeArc, sweep: sweep)
                cursor = p; lastCubicControl = nil; lastQuadControl = nil
            case "Z", "z":
                path.closeSubpath()
                cursor = start
                lastCubicControl = nil; lastQuadControl = nil
            default:
                return path     // a command we do not know: stop rather than guess
            }
        }
        return path
    }

    /// Every path of a shape as one `Path`.
    public static func parse(_ ds: [String]) -> Path {
        var out = Path()
        for d in ds { out.addPath(parse(d)) }
        return out
    }

    /// An elliptical arc, endpoint parameterisation → centre parameterisation (SVG F.6.5), then
    /// drawn as a transformed circular arc. Degenerate cases (a zero radius, or the two points
    /// being the same) fall back to a straight line, which is what the spec asks for.
    private static func addArc(_ path: inout Path, from p0: CGPoint, to p1: CGPoint,
                               rx rxIn: CGFloat, ry ryIn: CGFloat, rotation: CGFloat,
                               largeArc: Bool, sweep: Bool) {
        guard p0 != p1 else { return }
        var rx = abs(rxIn), ry = abs(ryIn)
        guard rx > 0, ry > 0 else { path.addLine(to: p1); return }

        let phi = rotation * .pi / 180
        let cosPhi = cos(phi), sinPhi = sin(phi)
        let dx = (p0.x - p1.x) / 2, dy = (p0.y - p1.y) / 2
        let x1 = cosPhi * dx + sinPhi * dy
        let y1 = -sinPhi * dx + cosPhi * dy

        // Scale the radii up when they are too small to span the two points (F.6.6).
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 { let s = sqrt(lambda); rx *= s; ry *= s }

        let sign: CGFloat = largeArc == sweep ? -1 : 1
        let numerator = max(0, rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1)
        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        let coefficient = denominator == 0 ? 0 : sign * sqrt(numerator / denominator)
        let cx1 = coefficient * rx * y1 / ry
        let cy1 = -coefficient * ry * x1 / rx
        let center = CGPoint(x: cosPhi * cx1 - sinPhi * cy1 + (p0.x + p1.x) / 2,
                             y: sinPhi * cx1 + cosPhi * cy1 + (p0.y + p1.y) / 2)

        func angle(_ ux: CGFloat, _ uy: CGFloat) -> CGFloat { atan2(uy, ux) }
        let startAngle = angle((x1 - cx1) / rx, (y1 - cy1) / ry)
        var endAngle = angle((-x1 - cx1) / rx, (-y1 - cy1) / ry)
        if sweep, endAngle < startAngle { endAngle += 2 * .pi }
        if !sweep, endAngle > startAngle { endAngle -= 2 * .pi }

        // A unit circle, scaled to the radii, rotated and moved into place: `addArc` only draws
        // circles, and this is the transform that makes it the ellipse the path asked for.
        let transform = CGAffineTransform(translationX: center.x, y: center.y)
            .rotated(by: phi)
            .scaledBy(x: rx, y: ry)
        var arc = Path()
        arc.addArc(center: .zero, radius: 1, startAngle: .radians(startAngle),
                   endAngle: .radians(endAngle), clockwise: !sweep)
        path.addPath(arc, transform: transform)
    }
}

/// A tiny cursor over a path string: numbers, coordinate pairs, arc flags and commands.
private struct Scanner {
    private let chars: [Character]
    private var i = 0
    init(_ s: String) { chars = Array(s) }

    var atEnd: Bool { i >= chars.count }
    mutating func advance() { i += 1 }

    /// Whitespace and commas carry no meaning in a path string.
    mutating func skipSeparators() {
        while i < chars.count, chars[i] == " " || chars[i] == "," || chars[i] == "\n"
            || chars[i] == "\r" || chars[i] == "\t" { i += 1 }
    }

    mutating func peekCommand() -> Character? {
        guard i < chars.count else { return nil }
        let c = chars[i]
        return "MmLlHhVvCcSsQqTtAaZz".contains(c) ? c : nil
    }

    /// The next number. SVG allows a sign or a decimal point to end the previous one
    /// ("0.5.5" is two numbers, "1-2" is two numbers), which is why this is hand-rolled.
    mutating func number() -> CGFloat? {
        skipSeparators()
        var out = ""
        if i < chars.count, chars[i] == "+" || chars[i] == "-" { out.append(chars[i]); i += 1 }
        var seenDot = false
        while i < chars.count {
            let c = chars[i]
            if c.isNumber { out.append(c); i += 1 }
            else if c == ".", !seenDot { seenDot = true; out.append(c); i += 1 }
            else if c == "e" || c == "E" {
                out.append(c); i += 1
                if i < chars.count, chars[i] == "+" || chars[i] == "-" { out.append(chars[i]); i += 1 }
            } else { break }
        }
        guard let value = Double(out) else { return nil }
        return CGFloat(value)
    }

    /// An arc flag is a single character, `0` or `1`, and may be written with no separator at
    /// all ("a1 1 0 010-.2" is five numbers and two flags).
    mutating func flag() -> Bool? {
        skipSeparators()
        guard i < chars.count else { return nil }
        switch chars[i] {
        case "0": i += 1; return false
        case "1": i += 1; return true
        default: return nil
        }
    }

    mutating func point(relativeTo origin: CGPoint) -> CGPoint? {
        guard let x = number(), let y = number() else { return nil }
        return CGPoint(x: origin.x + x, y: origin.y + y)
    }
}
