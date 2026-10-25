import Foundation
import WebKit

/// Serves Weave's three files at weave://app/…, from the app bundle, or (Debug
/// builds) straight from the repo so edits to the web app show up on reload.
final class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "weave"
    static let startURL = URL(string: "weave://app/index.html")!

    private static let types = ["index.html": "text/html", "weave.css": "text/css", "weave.js": "text/javascript", "mac.css": "text/css"]

    /// Folder to read from, and whether it's the live repo.
    private let root: URL
    let isLive: Bool

    override init() {
        let dev = (Bundle.main.object(forInfoDictionaryKey: "WeaveDevWebRoot") as? String) ?? ""
        let devURL = URL(fileURLWithPath: dev).standardizedFileURL
        if !dev.isEmpty, FileManager.default.fileExists(atPath: devURL.appendingPathComponent("weave.js").path) {
            root = devURL
            isLive = true
        } else {
            root = Bundle.main.resourceURL!
            isLive = false
        }
        super.init()
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        let name = task.request.url.map { $0.path == "/" ? "index.html" : String($0.path.dropFirst()) } ?? ""
        // Only the known files: nothing else in the folder is reachable.
        // mac.css belongs to the Mac app, so in a live (Debug) run it comes from macos/Weave/.
        let dir = (name == "mac.css" && isLive) ? root.appendingPathComponent("macos/Weave") : root
        guard let type = Self.types[name], let data = try? Data(contentsOf: dir.appendingPathComponent(name)),
              let url = task.request.url else {
            let url = task.request.url ?? Self.startURL
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: nil, headerFields: nil)!)
            task.didFinish()
            return
        }
        let headers = ["Content-Type": "\(type); charset=utf-8", "Content-Length": "\(data.count)", "Cache-Control": "no-store"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}
}
