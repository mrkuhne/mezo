package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * The booking rate (mezo-r36n9.102): its rounding, plus the four cases of the old app's
 * {@code src/data/fx.test.ts} ({@code getHufPerUnit}) ported 1:1 onto {@link PenzFxService#book} — HUF needs no
 * fetch, a cache miss fetches and caches, a cache hit does not fetch, a failed fetch fails the write (here: after
 * the 7-day cached fallback also comes up empty, as {@code PENZ_FX_UNAVAILABLE}). Rates are invented.
 */
class PenzFxServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 2);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 19);

    private PenzFxRateRepository rates;
    private FrankfurterClient client;
    private PenzFxService fx;

    @BeforeEach
    void setUp() {
        rates = mock(PenzFxRateRepository.class);
        client = mock(FrankfurterClient.class);
        fx = new PenzFxService(rates, client,
            new PenzProperties("http://fx.invalid", 1000, 1000, "test", 7, 2_000_000L, 20, 500));
    }

    private static PenzFxRateEntity cached(String rate) {
        PenzFxRateEntity e = new PenzFxRateEntity();
        e.setBase("EUR");
        e.setQuote("HUF");
        e.setRateDate(DAY);
        e.setPublishedDate(DAY);
        e.setRate(new BigDecimal(rate));
        return e;
    }

    @Test
    void roundsHalfUpToAWholeMinorUnit() {
        assertThat(PenzFxService.toHufMinor(1_250L, new BigDecimal("385.27"))).isEqualTo(481_588L); // .875 up
        assertThat(PenzFxService.toHufMinor(1L, new BigDecimal("0.5"))).isEqualTo(1L);
        assertThat(PenzFxService.toHufMinor(1L, new BigDecimal("0.49999999"))).isZero();
        assertThat(PenzFxService.toHufMinor(10_000L, new BigDecimal("331.5"))).isEqualTo(3_315_000L);
    }

    // it('returns 1 for HUF without fetching')
    @Test
    void hufIsRateOneWithoutFetching() {
        assertThat(fx.book("HUF", 1_299_000L, DAY, TODAY)).isEqualTo(new Booking(1_299_000L, null, null));
        verifyNoInteractions(rates, client);
    }

    // it('fetches on cache miss and caches the rate')
    @Test
    void aCacheMissFetchesAndCachesTheRate() {
        when(rates.findByBaseAndQuoteAndRateDate("EUR", "HUF", DAY))
            .thenReturn(Optional.empty(), Optional.of(cached("395.5")));
        when(client.rate("EUR", "HUF", DAY)).thenReturn(Optional.of(
            new FrankfurterClient.Quote(new BigDecimal("395.5"), DAY)));

        assertThat(fx.book("EUR", 10_000L, DAY, TODAY).hufMinor()).isEqualTo(3_955_000L);
        verify(client).rate("EUR", "HUF", DAY);
        verify(rates).insertIfAbsent("EUR", "HUF", DAY, DAY, new BigDecimal("395.5"));
    }

    // it('uses the cache on hit')
    @Test
    void aCacheHitDoesNotFetch() {
        when(rates.findByBaseAndQuoteAndRateDate("EUR", "HUF", DAY)).thenReturn(Optional.of(cached("400")));

        assertThat(fx.book("EUR", 10_000L, DAY, TODAY).hufMinor()).isEqualTo(4_000_000L);
        verifyNoInteractions(client);
        verify(rates, never()).insertIfAbsent(any(), any(), any(), any(), any());
    }

    // it('throws on a failed fetch')
    @Test
    void aFailedFetchFailsTheWrite() {
        when(rates.findByBaseAndQuoteAndRateDate("EUR", "HUF", DAY)).thenReturn(Optional.empty());
        when(rates.findFirstByBaseAndQuoteAndRateDateBetweenOrderByRateDateDesc(any(), any(), any(), any()))
            .thenReturn(Optional.empty());
        when(client.rate("EUR", "HUF", DAY)).thenThrow(new SystemRuntimeErrorException(
            SystemMessage.error("PENZ_FX_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> fx.book("EUR", 10_000L, DAY, TODAY))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        // the materialization's variant answers empty instead
        assertThat(fx.tryBook("EUR", 10_000L, DAY, TODAY)).isEmpty();
    }
}
