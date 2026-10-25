// Draws the Weave mark (same geometry as LOGO_STRANDS in ../weave.js) into the
// app icon set.   swiftc -o /tmp/make-icon tools/make-icon.swift && /tmp/make-icon
import AppKit

let out = "Weave/Assets.xcassets/AppIcon.appiconset"
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)

let strands: [([(Double, Double)], Double)] = [
    ([(14.86, 10), (20.75, 22), (25.5, 10)], 0.55),
    ([(6.5, 10), (11.25, 22), (17.14, 10)], 1),
]

/// A superellipse, close to the continuous-corner shape macOS icons use.
func squircle(in r: CGRect, n: Double = 4.6) -> CGPath {
    let path = CGMutablePath()
    let cx = r.midX, cy = r.midY, a = r.width / 2, b = r.height / 2
    let steps = 360
    for i in 0...steps {
        let t = Double(i) / Double(steps) * 2 * .pi
        let c = cos(t), sn = sin(t)
        let x = cx + a * (c < 0 ? -1 : 1) * pow(abs(c), 2 / n)
        let y = cy + b * (sn < 0 ? -1 : 1) * pow(abs(sn), 2 / n)
        i == 0 ? path.move(to: CGPoint(x: x, y: y)) : path.addLine(to: CGPoint(x: x, y: y))
    }
    path.closeSubpath()
    return path
}

func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8, samplesPerPixel: 4,
                               hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    let s = Double(px)
    // macOS icons leave ~10% margin around the shape.
    let body = s * 0.8125, inset = (s - body) / 2
    let rect = CGRect(x: inset, y: inset, width: body, height: body)
    let shape = squircle(in: rect)
    let rgb = CGColorSpaceCreateDeviceRGB()

    // Soft drop shadow under the tile.
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.03, color: NSColor.black.withAlphaComponent(0.35).cgColor)
    ctx.addPath(shape); ctx.setFillColor(NSColor(red: 0.30, green: 0.34, blue: 0.85, alpha: 1).cgColor); ctx.fillPath()
    ctx.restoreGState()

    // Gradient fill, lighter at the top.
    ctx.saveGState()
    ctx.addPath(shape); ctx.clip()
    let grad = CGGradient(colorsSpace: rgb, colors: [
        NSColor(red: 0x82 / 255, green: 0x8c / 255, blue: 0xff / 255, alpha: 1).cgColor,
        NSColor(red: 0x58 / 255, green: 0x63 / 255, blue: 0xe6 / 255, alpha: 1).cgColor,
    ] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(grad, start: CGPoint(x: s / 2, y: inset + body), end: CGPoint(x: s / 2, y: inset), options: [])
    ctx.restoreGState()

    // Thin inner highlight along the top edge.
    ctx.saveGState()
    ctx.addPath(shape); ctx.clip()
    ctx.addPath(shape)
    ctx.setLineWidth(max(1, s * 0.004) * 2)
    let hl = CGGradient(colorsSpace: rgb, colors: [NSColor.white.withAlphaComponent(0.45).cgColor, NSColor.white.withAlphaComponent(0).cgColor] as CFArray, locations: [0, 0.5])!
    ctx.replacePathWithStrokedPath(); ctx.clip()
    ctx.drawLinearGradient(hl, start: CGPoint(x: s / 2, y: inset + body), end: CGPoint(x: s / 2, y: inset + body * 0.5), options: [])
    ctx.restoreGState()

    // The mark: bigger and bolder than the web logo, so it survives at 16–32 px.
    let k = body / 32, grow = 1.12
    ctx.setLineWidth(3.5 * k * grow); ctx.setLineCap(.round); ctx.setLineJoin(.round)
    for (pts, alpha) in strands {
        // SVG y runs down; CoreGraphics y runs up. Scale about the tile's centre.
        let p = pts.map { CGPoint(x: inset + (16 + ($0.0 - 16) * grow) * k, y: inset + (16 - ($0.1 - 16) * grow) * k) }
        ctx.saveGState()
        if alpha == 1 { ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.006), blur: s * 0.014, color: NSColor.black.withAlphaComponent(0.25).cgColor) }
        ctx.setStrokeColor(NSColor.white.withAlphaComponent(alpha == 1 ? 1 : 0.6).cgColor)
        ctx.move(to: p[0]); p.dropFirst().forEach { ctx.addLine(to: $0) }
        ctx.strokePath()
        ctx.restoreGState()
    }
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

var images: [[String: String]] = []
for base in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let name = "icon_\(base)x\(base)\(scale == 2 ? "@2x" : "").png"
        try! render(base * scale).write(to: URL(fileURLWithPath: "\(out)/\(name)"))
        images.append(["size": "\(base)x\(base)", "idiom": "mac", "scale": "\(scale)x", "filename": name])
    }
}
let json: [String: Any] = ["images": images, "info": ["version": 1, "author": "xcode"]]
try! JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted, .sortedKeys])
    .write(to: URL(fileURLWithPath: "\(out)/Contents.json"))
try! #"{"info":{"version":1,"author":"xcode"}}"#.write(toFile: "Weave/Assets.xcassets/Contents.json", atomically: true, encoding: .utf8)
