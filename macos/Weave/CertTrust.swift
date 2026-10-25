import AppKit
import CryptoKit
import Security

/// Self-signed (or otherwise untrusted) relay certificates: trust on first use.
/// The first time a relay presents a certificate macOS doesn't trust, the user
/// sees its fingerprint and can accept it; it's then pinned per host:port, and
/// a different certificate later gets a warning instead of being accepted.
@MainActor
final class CertTrust {
    static let shared = CertTrust()

    private let defaultsKey = "trustedCertificates"   // ["host:port": SHA-256 hex]
    /// Requests waiting for the answer to a prompt that's already showing.
    private var waiting: [String: [CheckedContinuation<Bool, Never>]] = [:]
    /// Certificates the user declined, so reconnect attempts don't ask again (until relaunch or "Forget").
    private var declined: Set<String> = []

    private var pinned: [String: String] {
        get { UserDefaults.standard.dictionary(forKey: defaultsKey) as? [String: String] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: defaultsKey) }
    }

    func forgetAll() {
        pinned = [:]
        declined = []
    }

    func handle(_ challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        let space = challenge.protectionSpace
        guard space.authenticationMethod == NSURLAuthenticationMethodServerTrust, let trust = space.serverTrust else {
            return (.performDefaultHandling, nil)
        }
        var error: CFError?
        if SecTrustEvaluateWithError(trust, &error) { return (.performDefaultHandling, nil) }
        guard let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first else {
            return (.cancelAuthenticationChallenge, nil)
        }
        let fp = SHA256.hash(data: SecCertificateCopyData(leaf) as Data).map { String(format: "%02X", $0) }.joined()
        let site = "\(space.host):\(space.port)"
        if pinned[site] == fp { return (.useCredential, URLCredential(trust: trust)) }
        if declined.contains(site + fp) { return (.cancelAuthenticationChallenge, nil) }

        // The handshake request and the WebSocket can ask at the same time: one prompt.
        let ok: Bool
        if waiting[site + fp] != nil {
            ok = await withCheckedContinuation { waiting[site + fp]?.append($0) }
        } else {
            waiting[site + fp] = []
            ok = await ask(site: site, fingerprint: fp, certificate: leaf, reason: error)
            waiting.removeValue(forKey: site + fp)?.forEach { $0.resume(returning: ok) }
        }
        if ok {
            pinned[site] = fp
            return (.useCredential, URLCredential(trust: trust))
        }
        declined.insert(site + fp)
        return (.cancelAuthenticationChallenge, nil)
    }

    private func ask(site: String, fingerprint: String, certificate: SecCertificate, reason: CFError?) async -> Bool {
        let changed = pinned[site] != nil
        let subject = SecCertificateCopySubjectSummary(certificate) as String? ?? "unknown"
        let pretty = stride(from: 0, to: fingerprint.count, by: 2).map { i -> String in
            let a = fingerprint.index(fingerprint.startIndex, offsetBy: i)
            return String(fingerprint[a..<fingerprint.index(a, offsetBy: 2)])
        }.joined(separator: ":")
        let why = (reason.map { CFErrorCopyDescription($0) as String }) ?? "macOS doesn't trust it."

        let alert = NSAlert()
        alert.alertStyle = changed ? .critical : .warning
        alert.messageText = changed ? "The certificate for \(site) has changed" : "Trust the certificate for \(site)?"
        alert.informativeText = (changed
            ? "You trusted a different certificate for this relay before. If you didn't replace it yourself, someone may be intercepting the connection.\n\n"
            : "The relay's certificate isn't trusted by macOS — normal for a self-signed certificate. Check that the fingerprint matches your relay's before trusting it.\n\n")
            + "Certificate: \(subject)\nSHA-256: \(pretty)\n\n\(why)"
        alert.addButton(withTitle: changed ? "Trust New Certificate" : "Trust")
        alert.addButton(withTitle: "Cancel")
        alert.buttons.last?.keyEquivalent = "\u{1b}"
        if changed { alert.buttons.first?.keyEquivalent = "" ; alert.buttons.last?.keyEquivalent = "\r" }

        MainWindow.shared.show()
        guard let window = WebController.shared.webView.window else { return alert.runModal() == .alertFirstButtonReturn }
        return await withCheckedContinuation { cont in
            alert.beginSheetModal(for: window) { cont.resume(returning: $0 == .alertFirstButtonReturn) }
        }
    }
}
