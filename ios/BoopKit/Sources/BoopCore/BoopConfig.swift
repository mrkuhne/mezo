import Foundation

public enum BoopConfig {
    /// Production backend; the generated paths already start with `/api`.
    public static let apiBaseURL = URL(string: "https://46.225.112.172.sslip.io")!
    /// The web app (plans are set up there in v1).
    public static let webAppURL = URL(string: "https://46.225.112.172.sslip.io/")!
}

/// `yyyy-MM-dd` of `date` in the calendar's time zone (the user's local day).
public func localDay(_ date: Date, calendar: Calendar = .current) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = calendar.timeZone
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}
