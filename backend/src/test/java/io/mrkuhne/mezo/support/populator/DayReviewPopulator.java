package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewJson;
import io.mrkuhne.mezo.feature.companion.repository.DayReviewRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code day_review} rows (companion, mezo-jcpt.4). */
@TestComponent
@RequiredArgsConstructor
public class DayReviewPopulator {

    private final DayReviewRepository dayReviewRepository;

    /** A minimal-but-fully-populated envelope, useful when the test only cares about round-tripping. */
    public static DayReviewJson envelope(String narrativeLine) {
        return new DayReviewJson(
            List.of(narrativeLine),
            Map.of("nutrition", "Jó napod volt fehérjéből."),
            List.of(new DayReviewJson.Highlight("win", "Edzés bepipálva")),
            new DayReviewJson.Adjustment(2, "Konzisztens napló"),
            List.of(new DayReviewJson.ContextSignal("streak", "5 nap"))
        );
    }

    /** A cached day review stamped {@code computedAt} — pass a past instant to fake a stale row. */
    public DayReviewEntity dayReview(UUID createdBy, LocalDate date, String inputsHash, Instant computedAt) {
        DayReviewEntity entity = new DayReviewEntity();
        entity.setCreatedBy(createdBy);
        entity.setDate(date);
        entity.setEnvelope(envelope("Szolid nap volt, tartsd a ritmust."));
        entity.setInputsHash(inputsHash);
        entity.setComputedAt(computedAt.truncatedTo(ChronoUnit.MICROS));
        return dayReviewRepository.saveAndFlush(entity);
    }
}
