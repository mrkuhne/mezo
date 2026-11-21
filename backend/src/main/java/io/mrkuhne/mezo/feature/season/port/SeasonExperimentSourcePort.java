package io.mrkuhne.mezo.feature.season.port;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * What the experiment proposal detector reads (Boop B6 Évad S4, consumer-owned port): a supplement newly in the
 * stack, a recipe or food eaten for the first time and again within a week, a journal line saying he started
 * something.
 */
public interface SeasonExperimentSourcePort {

    /** A first-time recipe / food counts when he ate it again within this many days. */
    int REPEAT_WITHIN_DAYS = 7;

    /** A pantry item newly in the live supplement stack, added on {@code since} (his local day). */
    record NewSupplement(UUID pantryItemId, String name, LocalDate since) {
    }

    /** A recipe ({@code recipe}) or pantry food ({@code food}) first eaten on {@code firstOn}, again on {@code againOn}. */
    record RepeatedFood(String kind, UUID ref, String name, LocalDate firstOn, LocalDate againOn) {
    }

    record JournalLine(LocalDate date, String text) {
    }

    /** Pantry items whose first time in the stack is on or after {@code since}. */
    List<NewSupplement> newSupplements(UUID owner, LocalDate since);

    /** Recipes / foods first ever eaten on or after {@code firstFrom} that he ate again within 7 days, up to {@code to}. */
    List<RepeatedFood> repeatedFirstFoods(UUID owner, LocalDate firstFrom, LocalDate to);

    /** Journal lines of {@code from..to}, newest first. */
    List<JournalLine> journalLines(UUID owner, LocalDate from, LocalDate to);
}
