package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * THE one FX policy of Boop Pénz (L4, mezo-r36n9.102, spec §7) — the booking rate.
 *
 * <p>HUF twin = amount × the ECB reference rate {@code CUR→HUF} of the row's own date (frankfurter answers the
 * last rate published on or before it, so a weekend books Friday's rate), rounded HALF_UP to a whole minor unit
 * (minor = 1/100 of the major unit for every currency, HUF included, so the formula needs no rescaling). It is
 * computed ONCE at write time and STORED by the caller — never re-derived; a later rate never rewrites history.
 * HUF→HUF is rate 1, no fetch, and the fx columns stay null.
 *
 * <p>Rates are cached GLOBALLY in {@code penz_fx_rate} keyed by the date ASKED for (a future date asks today's),
 * so each (currency, date) is fetched over HTTP once, ever. Provider down or without a rate: the newest cached
 * rate asked within {@code mezo.penz.fx-fallback-days} days BEFORE the date is used (nothing is marked — the
 * stored rate date tells the truth); none → {@code PENZ_FX_UNAVAILABLE} (503) and the write fails.
 *
 * <p>Valuing a holding at today's rate is a different thing (L6) and does not go through here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzFxService {

    public static final String HUF = "HUF";

    private final PenzFxRateRepository rates;
    private final FrankfurterClient client;
    private final PenzProperties properties;

    /**
     * Books {@code amountMinor} of {@code currency} on {@code date} into HUF minor units.
     *
     * @param today the owner's today — a future-dated row asks today's rate (there is none for tomorrow yet).
     */
    @Transactional
    public Booking book(String currency, long amountMinor, LocalDate date, LocalDate today) {
        return bookInternal(currency, amountMinor, date, today);
    }

    /**
     * {@link #book} for a background write that must not fail the request it rides on (the recurring
     * materialization): empty instead of {@code PENZ_FX_UNAVAILABLE}. The failure is caught INSIDE this bean, so it
     * never crosses a transactional proxy and never marks the caller's transaction rollback-only.
     */
    @Transactional
    public Optional<Booking> tryBook(String currency, long amountMinor, LocalDate date, LocalDate today) {
        try {
            return Optional.of(bookInternal(currency, amountMinor, date, today));
        } catch (SystemRuntimeErrorException unavailable) {
            return Optional.empty();
        }
    }

    private Booking bookInternal(String currency, long amountMinor, LocalDate date, LocalDate today) {
        if (HUF.equals(currency)) {
            return new Booking(amountMinor, null, null);
        }
        LocalDate asked = date.isAfter(today) ? today : date;
        Rate rate = rateFor(currency, asked);
        return new Booking(toHufMinor(amountMinor, rate.rate()), rate.rate(), rate.publishedDate());
    }

    /**
     * {@code amountMinor × rate}, HALF_UP to a whole minor unit (the old app's half-away-from-zero for positives).
     * A twin beyond a {@code long} is a 400 on {@code amountMinor}, never a 500 (the contract caps amounts well below).
     */
    static long toHufMinor(long amountMinor, BigDecimal rate) {
        try {
            return BigDecimal.valueOf(amountMinor).multiply(rate).setScale(0, RoundingMode.HALF_UP).longValueExact();
        } catch (ArithmeticException overflow) {
            throw PenzErrors.field("amountMinor");
        }
    }

    private Rate rateFor(String currency, LocalDate asked) {
        Optional<PenzFxRateEntity> cached = rates.findByBaseAndQuoteAndRateDate(currency, HUF, asked);
        if (cached.isPresent()) {
            return Rate.of(cached.get());
        }
        Optional<FrankfurterClient.Quote> fetched;
        try {
            fetched = client.rate(currency, HUF, asked);
        } catch (SystemRuntimeErrorException providerDown) {
            fetched = Optional.empty();
        }
        if (fetched.isPresent()) {
            FrankfurterClient.Quote q = fetched.get();
            LocalDate published = q.publishedDate().isAfter(asked) ? asked : q.publishedDate();
            rates.insertIfAbsent(currency, HUF, asked, published, q.rate());
            // a concurrent fetch may have won the insert: the stored row is the truth for this date
            return rates.findByBaseAndQuoteAndRateDate(currency, HUF, asked).map(Rate::of)
                .orElse(new Rate(q.rate(), published));
        }
        return rates.findFirstByBaseAndQuoteAndRateDateBetweenOrderByRateDateDesc(currency, HUF,
                asked.minusDays(properties.fxFallbackDays()), asked.minusDays(1))
            .map(Rate::of)
            .orElseThrow(() -> {
                log.warn("no {}->HUF rate for {} (provider down, no cached rate within {} days)", currency, asked,
                    properties.fxFallbackDays());
                return new SystemRuntimeErrorException(SystemMessage.error("PENZ_FX_UNAVAILABLE").build(),
                    HttpStatus.SERVICE_UNAVAILABLE);
            });
    }

    /**
     * The HUF twin of one booked amount: {@code rate}/{@code rateDate} are null for HUF; otherwise HUF per one
     * unit and the ECB publication date of that rate.
     */
    public record Booking(long hufMinor, BigDecimal rate, LocalDate rateDate) {
    }

    private record Rate(BigDecimal rate, LocalDate publishedDate) {
        static Rate of(PenzFxRateEntity e) {
            return new Rate(e.getRate(), e.getPublishedDate());
        }
    }
}
