import AppKit
import UserNotifications

/// System notifications for the page's `Notification` calls (see NativeBridge.js).
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    private var center: UNUserNotificationCenter { .current() }

    func setUp() {
        center.delegate = self
    }

    func status() async -> String {
        switch await center.notificationSettings().authorizationStatus {
        case .authorized, .provisional: return "granted"
        case .denied: return "denied"
        default: return "default"
        }
    }

    func requestPermission() async -> String {
        _ = try? await center.requestAuthorization(options: [.alert, .sound])
        return await status()
    }

    func show(id: Int, title: String, body: String, tag: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["id": id]
        // The same tag replaces the earlier notification (one per buffer).
        let req = UNNotificationRequest(identifier: tag.isEmpty ? "weave-\(id)" : tag, content: content, trigger: nil)
        center.add(req)
    }

    func close(id: Int, tag: String) {
        center.removeDeliveredNotifications(withIdentifiers: [tag.isEmpty ? "weave-\(id)" : tag])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let id = response.notification.request.content.userInfo["id"] as? Int else { return }
        await MainActor.run {
            MainWindow.shared.show()
            WebController.shared.notificationClicked(id)
        }
    }
}
