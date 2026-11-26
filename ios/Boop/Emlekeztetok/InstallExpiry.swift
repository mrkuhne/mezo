import Foundation

/// A free-team install stops opening after seven days, and its alarms stop with it. The date is in the app's own
/// provisioning profile (`embedded.mobileprovision`, a CMS-signed plist); a simulator or App Store build has none.
enum InstallExpiry {
    static let notificationId = "boop.expiry"
    static let title = "Holnap lejár a Boop telepítése"
    static let body = "Telepítsd újra, különben az ébresztők sem szólnak."

    static func date(bundle: Bundle = .main) -> Date? {
        guard let url = bundle.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url) else { return nil }
        return expirationDate(inProfile: data)
    }

    /// The `ExpirationDate` of the plist embedded in the signed blob: the bytes from `<?xml` to `</plist>`.
    static func expirationDate(inProfile data: Data) -> Date? {
        guard let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex) else { return nil }
        let plist = data[start.lowerBound..<end.upperBound]
        guard let object = try? PropertyListSerialization.propertyList(from: Data(plist), options: [], format: nil),
              let dict = object as? [String: Any] else { return nil }
        return dict["ExpirationDate"] as? Date
    }

    /// 10:00 the day before the expiry, in the calendar's zone; nil when that moment has already passed.
    static func reminderTime(expiry: Date, now: Date, calendar: Calendar) -> Date? {
        guard let dayBefore = calendar.date(byAdding: .day, value: -1, to: expiry),
              let at = calendar.date(bySettingHour: 10, minute: 0, second: 0, of: dayBefore), at > now else { return nil }
        return at
    }

    /// Queues (or, with no date to warn about, removes) the one notification. Called on every launch / foreground.
    static func reschedule(center: ReminderCenter, bundle: Bundle = .main, now: Date = Date(), calendar: Calendar = .current) async {
        guard let expiry = date(bundle: bundle), let at = reminderTime(expiry: expiry, now: now, calendar: calendar) else {
            center.cancel(id: notificationId)
            return
        }
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: at)
        try? await center.scheduleOnce(id: notificationId, on: DateComponents(year: c.year, month: c.month, day: c.day),
                                       hour: c.hour ?? 10, minute: c.minute ?? 0, title: title, body: body, route: ReminderScheduler.route)
    }
}
