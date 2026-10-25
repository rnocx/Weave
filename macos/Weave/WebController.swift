import AppKit
import UniformTypeIdentifiers
import WebKit

/// Owns the single WKWebView that runs Weave, and the native hooks around it.
final class WebController: NSObject {
    static let shared = WebController()

    let webView: WKWebView
    /// Called after each page load (to push native layout facts into the page).
    var onPageLoad: (() -> Void)?
    private let scheme = AppSchemeHandler()
    private var titleObservation: NSKeyValueObservation?
    private var zoomLevel: CGFloat = 1

    override init() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(scheme, forURLScheme: AppSchemeHandler.scheme)
        config.websiteDataStore = .default()
        if let url = Bundle.main.url(forResource: "NativeBridge", withExtension: "js"),
           let source = try? String(contentsOf: url, encoding: .utf8) {
            let prelude = "window.__weaveMacAccent = '\(Self.accentHex())';\n"
            config.userContentController.addUserScript(
                WKUserScript(source: prelude + source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let webView = DragWebView(frame: .zero, configuration: config)
        // Transparent, so the sidebar's vibrancy shows through.
        webView.setValue(false, forKey: "drawsBackground")
        webView.underPageBackgroundColor = .clear
        self.webView = webView
        super.init()
        NotificationCenter.default.addObserver(forName: NSColor.systemColorsDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.webView.evaluateJavaScript("window.__weaveMacSetAccent && window.__weaveMacSetAccent('\(Self.accentHex())')")
        }
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "weave")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        // Safari's Develop menu / Web Inspector, so the page can be debugged.
        webView.isInspectable = true
        if scheme.isLive { NSLog("Weave: loading the web app live from the repo") }

        // The page title is "(N) buffer · Weave", with N the unread mentions.
        titleObservation = webView.observe(\.title, options: [.new]) { [weak self] wv, _ in
            self?.updateBadge(from: wv.title ?? "")
        }
        webView.load(URLRequest(url: AppSchemeHandler.startURL))
    }

    /// The Mac's accent colour as #rrggbb, for the "System" accent swatch.
    static func accentHex() -> String {
        let c = NSColor.controlAccentColor.usingColorSpace(.sRGB) ?? .systemBlue
        return String(format: "#%02x%02x%02x", Int(round(c.redComponent * 255)), Int(round(c.greenComponent * 255)), Int(round(c.blueComponent * 255)))
    }

    // MARK: Menu actions

    /// Runs a menu-bar action in the page (see NativeBridge.js).
    func action(_ name: String) {
        webView.evaluateJavaScript("window.__weaveMacAction && window.__weaveMacAction('\(name)')")
    }

    func reload() { webView.reload() }
    func setZoom(_ z: CGFloat) { zoomLevel = min(3, max(0.5, z)); webView.pageZoom = zoomLevel }
    func zoom(by delta: CGFloat) { setZoom(zoomLevel + delta) }

    // MARK: Native → page

    func notificationClicked(_ id: Int) {
        webView.evaluateJavaScript("window.__weaveNotificationClick && window.__weaveNotificationClick(\(id))")
    }

    private func updateBadge(from title: String) {
        var label = ""
        if title.hasPrefix("("), let end = title.firstIndex(of: ")"),
           let n = Int(title[title.index(after: title.startIndex)..<end]), n > 0 {
            label = String(n)
        }
        NSApp.dockTile.badgeLabel = label.isEmpty ? nil : label
    }
}

// MARK: - Page → native (Notification shim)

extension WebController: WKScriptMessageHandlerWithReply {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
            replyHandler(nil, "bad message"); return
        }
        switch type {
        case "permissionStatus":
            Task { replyHandler(await Notifier.shared.status(), nil) }
        case "requestPermission":
            Task { replyHandler(await Notifier.shared.requestPermission(), nil) }
        case "show":
            Notifier.shared.show(id: body["id"] as? Int ?? 0, title: body["title"] as? String ?? "",
                                 body: body["body"] as? String ?? "", tag: body["tag"] as? String ?? "")
            replyHandler(nil, nil)
        case "appearance":
            let mode = body["mode"] as? String
            MainWindow.shared.setAppearance(dark: mode.map { $0 == "dark" })
            replyHandler(nil, nil)
        case "dragWindow":
            MainWindow.shared.dragWindow()
            replyHandler(nil, nil)
        case "titlebarDoubleClick":
            MainWindow.shared.titlebarDoubleClick()
            replyHandler(nil, nil)
        case "close":
            Notifier.shared.close(id: body["id"] as? Int ?? 0, tag: body["tag"] as? String ?? "")
            replyHandler(nil, nil)
        // Remembered relay password (Keychain). Off the main thread: the keychain may ask the user.
        case "secretGet", "secretSet", "secretDelete":
            guard let account = body["account"] as? String, !account.isEmpty else { replyHandler(nil, "no account"); return }
            let value = body["value"] as? String ?? ""
            Task.detached {
                switch type {
                case "secretGet": replyHandler(Keychain.get(account), nil)
                case "secretSet": Keychain.set(account, value) ? replyHandler(nil, nil) : replyHandler(nil, "keychain error")
                default: Keychain.delete(account); replyHandler(nil, nil)
                }
            }
        default:
            replyHandler(nil, "unknown message")
        }
    }
}

// MARK: - Navigation and UI delegates

extension WebController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onPageLoad?()
        #if DEBUG
        // Debug helpers: WEAVE_DEBUG_JS runs after load and logs its result; WEAVE_SNAPSHOT writes a PNG of the page
        // (after WEAVE_SNAPSHOT_DELAY seconds, default 1.5).
        let env = ProcessInfo.processInfo.environment
        if let js = env["WEAVE_DEBUG_JS"] {
            webView.evaluateJavaScript(js) { NSLog("Weave debug: %@", String(describing: $0 ?? $1 ?? "nil")) }
        }
        if let path = env["WEAVE_SNAPSHOT"] {
            let delay = Double(env["WEAVE_SNAPSHOT_DELAY"] ?? "") ?? 1.5
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                webView.takeSnapshot(with: nil) { image, _ in
                    guard let tiff = image?.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else { return }
                    try? png.write(to: URL(fileURLWithPath: path))
                    NSLog("Weave snapshot written")
                }
            }
        }
        #endif
    }

    // TLS to the relay: self-signed certificates are trusted on first use (CertTrust.swift).
    func webView(_ webView: WKWebView, respondTo challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        await CertTrust.shared.handle(challenge)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if url.scheme == AppSchemeHandler.scheme { return .allow }
        // Links in chat open in the default browser, never inside the app.
        if ["http", "https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return .cancel
    }

    // target="_blank" and window.open()
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["http", "https"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }

    // <input type="file"> (the 📎 upload button)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo) async -> [URL]? {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        guard let window = webView.window else { return panel.runModal() == .OK ? panel.urls : nil }
        return await withCheckedContinuation { cont in
            panel.beginSheetModal(for: window) { cont.resume(returning: $0 == .OK ? panel.urls : nil) }
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async {
        let alert = NSAlert(); alert.messageText = message; alert.runModal()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo) async -> Bool {
        let alert = NSAlert(); alert.messageText = message
        alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
