import AppKit
import WebKit

/// WKWebView that remembers the last mouse-down, so the page can ask for a
/// window drag (see `dragWindow` in NativeBridge.js).
final class DragWebView: WKWebView {
    var lastMouseDown: NSEvent?
    override func mouseDown(with event: NSEvent) {
        lastMouseDown = event
        super.mouseDown(with: event)
    }
}

/// The one window. Closing it only hides it, so the relay connection (and
/// notifications) keep running; a Dock click or a notification brings it back.
final class MainWindow: NSObject, NSWindowDelegate {
    static let shared = MainWindow()

    private(set) var window: NSWindow!
    private var activity: NSObjectProtocol?

    func create() {
        let web = WebController.shared.webView
        let effect = NSVisualEffectView()
        effect.material = .sidebar
        effect.blendingMode = .behindWindow
        effect.state = .active
        web.autoresizingMask = [.width, .height]
        effect.addSubview(web)

        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 780),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                              backing: .buffered, defer: false)
        window.contentView = effect
        web.frame = effect.bounds
        window.title = "Weave"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = false
        window.contentMinSize = NSSize(width: 480, height: 360)
        window.isReleasedWhenClosed = false
        window.delegate = self
        if !window.setFrameUsingName("WeaveMainWindow") { window.center() }
        window.setFrameAutosaveName("WeaveMainWindow")
        self.window = window

        let nc = NotificationCenter.default
        for name in [NSWindow.didResizeNotification, NSWindow.willEnterFullScreenNotification, NSWindow.didEnterFullScreenNotification,
                     NSWindow.willExitFullScreenNotification, NSWindow.didExitFullScreenNotification] {
            nc.addObserver(self, selector: #selector(layoutChanged), name: name, object: window)
        }
        WebController.shared.onPageLoad = { [weak self] in self?.layoutChanged() }

        // Keep the connection from being throttled while the window is hidden.
        activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiatedAllowingIdleSystemSleep],
                                                         reason: "Keeping the WeeChat relay connection alive")
        show()
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    // Close hides.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    /// Follows the page's chosen theme (nil = follow the system).
    func setAppearance(dark: Bool?) {
        window.appearance = dark.map { NSAppearance(named: $0 ? .darkAqua : .aqua) } ?? nil
    }

    func titlebarDoubleClick() {
        switch UserDefaults.standard.string(forKey: "AppleActionOnDoubleClick") {
        case "Minimize": window.miniaturize(nil)
        case "None": break
        default: window.zoom(nil)
        }
    }

    func dragWindow() {
        if let event = (WebController.shared.webView as? DragWebView)?.lastMouseDown {
            window.performDrag(with: event)
        }
    }

    @objc private func layoutChanged() {
        let full = window.styleMask.contains(.fullScreen)
        let top = full ? 0 : max(0, window.frame.height - window.contentLayoutRect.height)
        let lights = (window.standardWindowButton(.zoomButton)?.frame.maxX ?? 66) + 12
        WebController.shared.webView.evaluateJavaScript(
            "window.__weaveMacLayout && window.__weaveMacLayout({top:\(top),lights:\(lights),fullscreen:\(full)})")
    }
}
