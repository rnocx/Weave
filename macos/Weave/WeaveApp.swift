import SwiftUI

@main
struct WeaveApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let web = WebController.shared

    // The window itself is AppKit (MainWindow.swift); SwiftUI only provides the menus.
    var body: some Scene {
        Settings { EmptyView() }
            .commands {
                // ⌘, opens Weave's own settings, not an empty system window.
                CommandGroup(replacing: .appSettings) {
                    Button("Settings…") { web.action("settings") }.keyboardShortcut(",")
                }
                CommandGroup(replacing: .newItem) {
                    Button("Disconnect") { web.action("disconnect") }
                    Divider()
                    Button("Forget Trusted Certificates") { CertTrust.shared.forgetAll() }
                }
                CommandGroup(after: .textEditing) {
                    Divider()
                    Button("Find in Buffer") { web.action("search") }.keyboardShortcut("f")
                }
                CommandGroup(after: .toolbar) {
                    Button("Show/Hide Member List") { web.action("members") }.keyboardShortcut("m", modifiers: [.command, .option])
                    Button("Toggle Light/Dark") { web.action("theme") }.keyboardShortcut("d", modifiers: [.command, .shift])
                    Divider()
                    Button("Reload") { web.reload() }.keyboardShortcut("r")
                    Divider()
                    Button("Actual Size") { web.setZoom(1) }.keyboardShortcut("0")
                    Button("Zoom In") { web.zoom(by: 0.1) }.keyboardShortcut("+")
                    Button("Zoom Out") { web.zoom(by: -0.1) }.keyboardShortcut("-")
                }
                CommandMenu("Go") {
                    Button("Jump to Buffer…") { web.action("switcher") }.keyboardShortcut("k")
                    Button("Command Palette…") { web.action("palette") }.keyboardShortcut("p", modifiers: [.command, .shift])
                    Divider()
                    Button("Previous Buffer") { web.action("prev") }.keyboardShortcut(.upArrow, modifiers: .option)
                    Button("Next Buffer") { web.action("next") }.keyboardShortcut(.downArrow, modifiers: .option)
                    Button("Next Buffer with Activity") { web.action("unread") }.keyboardShortcut("a", modifiers: .option)
                    Divider()
                    Button("Mark All as Read") { web.action("markAll") }.keyboardShortcut(.escape, modifiers: .shift)
                }
            }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        Notifier.shared.setUp()
        MainWindow.shared.create()
    }

    // Closing the window hides it; the app (and the relay connection) keep running.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    // Dock icon clicked.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        MainWindow.shared.show()
        return false
    }
}
