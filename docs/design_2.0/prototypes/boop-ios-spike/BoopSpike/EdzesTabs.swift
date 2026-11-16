import SwiftUI

// B5 Edzés spike — the other three tabs: Blokk (the block, its weeks, its volume, the builder),
// Gyakorlatok (the catalog and the records), Előzmények (what happened, the block report, comparison).

// MARK: - Blokk

struct EdzesBlokk: View {
    let onOpen: (String) -> Void
    let onToast: (String) -> Void

    var body: some View {
        VStack(spacing: 14) {

            // 1 — The block that is running.
            VStack(alignment: .leading, spacing: 0) {
                WCardPhoto(name: "edz-oltozo.jpg", height: 120)
                VStack(alignment: .leading, spacing: 12) {
                    Text(WData.mesoTitle).font(AuraFont.serif(24)).foregroundStyle(.white).lineSpacing(2)
                    Text(WData.split).font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.7))
                    // The eight weeks as a row: where you are, and what each week asks of you.
                    HStack(spacing: 4) {
                        ForEach(Array(WData.phaseCurve.enumerated()), id: \.offset) { i, p in
                            let week = i + 1
                            let past = week < WData.mesoWeek
                            let now = week == WData.mesoWeek
                            VStack(spacing: 5) {
                                // Fixed-height slot, bottom-aligned, so every week number sits on one line
                                // however tall its bar is.
                                Capsule()
                                    .fill(now ? AnyShapeStyle(LinearGradient(colors: [WHue.glow, WHue.sky[2]],
                                                                             startPoint: .top, endPoint: .bottom))
                                          : AnyShapeStyle(Color.white.opacity(past ? 0.55 : 0.16)))
                                    .frame(height: p == "Deload" ? 14 : (p == "MRV" ? 34 : (p == "MAV" ? 26 : 20)))
                                    .frame(height: 34, alignment: .bottom)
                                Text("\(week)").font(.system(size: 10, weight: now ? .semibold : .regular))
                                    .foregroundStyle(.white.opacity(now ? 0.95 : 0.45))
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    Text("A 2. héten vagy. A mennyiség a 3. héttől emelkedik, a 8. hét könnyű levezetés.")
                        .font(.system(size: 13.5)).lineSpacing(2).foregroundStyle(.white.opacity(0.7))
                    HStack(spacing: 10) {
                        GPill(title: "Blokk szerkesztése", primary: false) { onToast("A blokk napjai és gyakorlatai") }
                        GPill(title: "Lezárom", primary: false) { onOpen("jelentes") }
                    }
                }
                .padding(20)
            }
            .frame(maxWidth: .infinity, alignment: .leading).gCard()

            // 2 — Per-muscle weekly volume, with the landmarks the engine ramps between.
            WSection(n: 2, label: "HETI MENNYISÉG IZOMCSOPORTONKÉNT") {
                VStack(spacing: 16) {
                    ForEach(Array(WData.volume.enumerated()), id: \.offset) { _, v in
                        WVolumeBar(name: v.0, current: v.1, mev: v.2, mav: v.3, mrv: v.4)
                    }
                    Text("A két vonás a két határ: az alsó alatt kevés a munka, a felső fölött már nem bírod kipihenni. A Boop ezen belül emeli hetente.")
                        .font(.system(size: 13)).lineSpacing(2).foregroundStyle(.white.opacity(0.62))
                }
            }

            // 3 — Which muscles you told it to favour.
            WSection(n: 3, label: "MIT HANGSÚLYOZUNK") {
                VStack(alignment: .leading, spacing: 12) {
                    WPriorityRow(name: "Hát", tier: "Hangsúly", strong: true)
                    WPriorityRow(name: "Bicepsz", tier: "Hangsúly", strong: true)
                    WPriorityRow(name: "Mell", tier: "Növelés", strong: false)
                    WPriorityRow(name: "Váll", tier: "Növelés", strong: false)
                    WPriorityRow(name: "Láb", tier: "Megtartás", strong: false)
                    Button { onToast("Hangsúlyok átállítása") } label: {
                        Text("Átállítom").font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.65)).underline()
                    }
                    .buttonStyle(.plain).padding(.top, 2)
                }
            }

            // 4 — The weekly clock: which day at what time.
            WSection(n: 4, label: "A HETI IDŐREND") {
                VStack(spacing: 11) {
                    ForEach(Array(zip(["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek"], WData.weekDays)), id: \.0) { day, name in
                        HStack(spacing: 12) {
                            Text(day).font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
                                .frame(width: 84, alignment: .leading)
                            Text(name).font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                            Spacer()
                            Text("18:00").font(.custom("Outfit", size: 14).weight(.medium))
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    Divider().overlay(.white.opacity(0.1))
                    HStack(spacing: 12) {
                        Text("Szombat").font(.system(size: 14)).foregroundStyle(.white.opacity(0.75))
                            .frame(width: 84, alignment: .leading)
                        HStack(spacing: 7) {
                            AuraGlyph("ball-sun", .white.opacity(0.8), size: 14)
                            Text("Röplabda").font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
                        }
                        Spacer()
                        Text("10:00").font(.custom("Outfit", size: 14).weight(.medium))
                            .foregroundStyle(.white.opacity(0.8))
                    }
                }
            }

            // 5 — Make something new.
            WSection(n: 5, label: "ÚJAT KEZDENÉK") {
                VStack(alignment: .leading, spacing: 14) {
                    WActionRow(glyph: "spark-sage", title: "Új blokk összeállítása",
                               sub: "a Boop megtervezi, te átszabod") { onOpen("varazslo") }
                    WActionRow(glyph: "repeat-deep", title: "Ez a blokk újra",
                               sub: "ugyanaz a terv, friss súlyokkal") { onToast("Újraindítva a következő hétfőtől") }
                    WActionRow(glyph: "dumbbell-berry", title: "Saját edzés most",
                               sub: "terv nélkül, egyszeri") { onToast("Üres edzés — add hozzá a gyakorlatokat") }
                    WActionRow(glyph: "book-sage", title: "Elmentett terveim",
                               sub: "2 terv") { onToast("Elmentett tervek") }
                }
            }
        }
    }
}

struct WPriorityRow: View {
    let name: String, tier: String
    let strong: Bool
    var body: some View {
        HStack {
            Text(name).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
            Spacer()
            Text(tier).font(.system(size: 12, weight: .medium))
                .foregroundStyle(strong ? gBase : .white.opacity(0.8))
                .padding(.horizontal, 11).padding(.vertical, 5)
                .background(Capsule().fill(strong ? .white.opacity(0.9) : .white.opacity(0.1)))
        }
    }
}

// MARK: - Gyakorlatok

struct EdzesGyakorlatok: View {
    let onOpen: (String) -> Void
    let onToast: (String) -> Void
    @State private var query = ""

    private var filtered: [(String, String?, String)] {
        query.isEmpty ? WData.catalog
            : WData.catalog.filter { $0.0.localizedCaseInsensitiveContains(query) || $0.2.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        VStack(spacing: 14) {

            // 1 — Your records. The reason to open this tab at all.
            WSection(n: 1, label: "A CSÚCSAID") {
                VStack(spacing: 13) {
                    ForEach(Array(WData.records.enumerated()), id: \.offset) { _, r in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                                    .lineLimit(1).minimumScaleFactor(0.8)
                                Text(r.1).font(.system(size: 11.5)).foregroundStyle(.white.opacity(0.55))
                            }
                            Spacer(minLength: 0)
                            Text(r.2).font(.custom("Outfit", size: 17).weight(.medium)).foregroundStyle(.white)
                                .fixedSize()
                        }
                    }
                }
            }

            // 2 — The catalog.
            WSection(n: 2, label: "GYAKORLATOK · \(WData.catalog.count) A KÖNYVTÁRBAN") {
                VStack(spacing: 0) {
                    HStack(spacing: 9) {
                        AuraGlyph("search-ink", .white.opacity(0.55), size: 15)
                        TextField("", text: $query, prompt: Text("Keresés").foregroundStyle(.white.opacity(0.4)))
                            .font(.system(size: 15)).foregroundStyle(.white).textInputAutocapitalization(.never)
                    }
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.07)))
                    .padding(.bottom, 6)

                    ForEach(Array(filtered.enumerated()), id: \.offset) { i, c in
                        if i > 0 { Divider().overlay(.white.opacity(0.09)).padding(.vertical, 11) }
                        Button { onOpen("gyakorlat") } label: {
                            HStack(spacing: 12) {
                                WThumb(name: c.1, size: 42)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(c.0).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                                        .lineLimit(1).minimumScaleFactor(0.8)
                                    Text(c.2).font(.system(size: 12)).foregroundStyle(.white.opacity(0.58))
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    if filtered.isEmpty {
                        Text("Nincs ilyen gyakorlat a könyvtárban. Felvehetsz újat.")
                            .font(.system(size: 13.5)).foregroundStyle(.white.opacity(0.6))
                            .padding(.vertical, 14)
                    }
                }
            }

            WActionRow(glyph: "plus-ink", title: "Új gyakorlat felvétele",
                       sub: "név, izomcsoport, saját jegyzet") { onToast("Új gyakorlat") }
                .padding(18).frame(maxWidth: .infinity, alignment: .leading).gCard()
        }
    }
}

// MARK: - Előzmények

struct EdzesElozmenyek: View {
    let onOpen: (String) -> Void
    let onToast: (String) -> Void

    var body: some View {
        VStack(spacing: 14) {

            // 1 — What actually happened, most recent first. Each row is a thing, so it gets a photo.
            WSection(n: 1, label: "AMI TÖRTÉNT") {
                VStack(spacing: 0) {
                    ForEach(Array(WData.history.enumerated()), id: \.offset) { i, h in
                        if i > 0 { Divider().overlay(.white.opacity(0.09)).padding(.vertical, 12) }
                        Button { onToast("\(h.1) · \(h.0)") } label: {
                            HStack(spacing: 12) {
                                WThumb(name: h.3, size: 44)
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 7) {
                                        Text(h.1).font(.system(size: 14.5, weight: .medium)).foregroundStyle(.white)
                                        Text(h.0).font(.custom("Outfit", size: 12).weight(.medium))
                                            .foregroundStyle(.white.opacity(0.55))
                                    }
                                    Text(h.2).font(.system(size: 12)).foregroundStyle(.white.opacity(0.58))
                                        .lineLimit(1).minimumScaleFactor(0.85)
                                }
                                Spacer(minLength: 0)
                                if h.4 > 0 {
                                    HStack(spacing: 4) {
                                        AuraGlyph("star-sun", Color(hex: 0xF4C860), size: 12)
                                        Text("\(h.4)").font(.custom("Outfit", size: 12).weight(.medium))
                                            .foregroundStyle(Color(hex: 0xF4C860))
                                    }
                                }
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.35))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            // 2 — The weekly load, four weeks back.
            WSection(n: 2, label: "A TERHELÉS NÉGY HETE") {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(Array([(("41. hét"), 0.55), (("42. hét"), 0.8), (("43. hét"), 0.35), (("44. hét"), 0.62)].enumerated()), id: \.offset) { i, w in
                            VStack(spacing: 7) {
                                Capsule()
                                    .fill(LinearGradient(colors: [WHue.glow.opacity(0.9), WHue.sky[2].opacity(0.75)],
                                                         startPoint: .top, endPoint: .bottom))
                                    .frame(width: 26, height: 90 * w.1)
                                Text(w.0).font(.system(size: 10.5)).foregroundStyle(.white.opacity(0.5))
                                    .lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity, alignment: .bottom)
                            .opacity(i == 2 ? 0.55 : 1)
                        }
                    }
                    .frame(height: 112, alignment: .bottom)
                    Text("A 43. hét kiesett: két edzés maradt el, utazás miatt. A Boop nem számolta hiánynak.")
                        .font(.system(size: 13)).lineSpacing(2).foregroundStyle(.white.opacity(0.62))
                }
            }

            // 3 — Deeper reads.
            WSection(n: 3, label: "MÉLYEBBEN") {
                VStack(alignment: .leading, spacing: 14) {
                    WActionRow(glyph: "chart-deep", title: "Az előző blokk jelentése",
                               sub: "Hypertrophy · Ősz · 6 hét") { onOpen("jelentes") }
                    WActionRow(glyph: "repeat-deep", title: "Két blokk összehasonlítása",
                               sub: "mi lett jobb, mi nem") { onOpen("osszehasonlit") }
                    WActionRow(glyph: "person-sage", title: "Izomtérkép",
                               sub: "mi kapott sokat, mi keveset") { onOpen("terkep") }
                }
            }
        }
    }
}
