package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.WaterLogRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.meal.service.MealService;
import io.mrkuhne.mezo.feature.meal.service.WaterLogService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Boop B4 (mezo-r36n9.14): the phone's offline outbox retries writes. A repeat with the same
 * {@code (owner, clientRef)} returns the existing row on all three shared write paths, two overlapping
 * requests end in one row (no unique-index 500), and {@code capturedAt} is the record's own moment.
 * Not class-transactional: the race needs real, separately committing transactions.
 */
class ClientRefIdempotencyIT extends AbstractIntegrationTest {

    @Autowired private MealService meals;
    @Autowired private WaterLogService water;
    @Autowired private IntakeService intakes;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private OwnerZoneProperties ownerZone;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlatformTransactionManager transactionManager;

    private UUID owner(String email) {
        return databasePopulator.populateUser(email);
    }

    private long count(String sql, UUID owner) {
        return jdbc.queryForObject(sql, Long.class, owner);
    }

    private MealRequest mealReq(PantryItemEntity food, UUID ref, OffsetDateTime capturedAt) {
        MealItemRequest item = new MealItemRequest();
        item.setSource("pantry");
        item.setPantryItemId(food.getId());
        item.setAmount(new BigDecimal("150"));
        item.setUnit("g");
        return new MealRequest().slot("dinner").title("Vacsora").items(List.of(item))
            .clientRef(ref).capturedAt(capturedAt);
    }

    @Test
    void repeatedCreateWithSameRefCreatesOneRow() {
        UUID owner = owner("ref-repeat@test.local");
        UUID other = owner("ref-other@test.local");
        PantryItemEntity food = pantryPopulator.createFood(owner, "Rizs", LocalDate.now().plusDays(3));
        UUID ref = UUID.randomUUID();

        MealResponse m1 = meals.create(owner, mealReq(food, ref, null));
        MealResponse m2 = meals.create(owner, mealReq(food, ref, null));
        assertThat(m2.getId()).isEqualTo(m1.getId());
        assertThat(m2.getItems()).hasSameSizeAs(m1.getItems());
        assertThat(count("select count(*) from meal where created_by = ?", owner)).isEqualTo(1);
        assertThat(count("select count(*) from meal_item where created_by = ?", owner)).isEqualTo(1);
        // the ref is scoped per owner: someone else's identical ref is a different meal
        PantryItemEntity otherFood = pantryPopulator.createFood(other, "Rizs", LocalDate.now().plusDays(3));
        assertThat(meals.create(other, mealReq(otherFood, ref, null)).getId()).isNotEqualTo(m1.getId());
        // no ref -> never deduplicated (web behaviour)
        meals.create(owner, mealReq(food, null, null));
        meals.create(owner, mealReq(food, null, null));
        assertThat(count("select count(*) from meal where created_by = ?", owner)).isEqualTo(3);

        UUID wref = UUID.randomUUID();
        var w1 = water.logWater(owner, new WaterLogRequest().amountMl(250).clientRef(wref));
        var w2 = water.logWater(owner, new WaterLogRequest().amountMl(250).clientRef(wref));
        assertThat(w2.getId()).isEqualTo(w1.getId());
        assertThat(count("select count(*) from water_log where created_by = ?", owner)).isEqualTo(1);

        PantryItemEntity supp = pantryPopulator.createSupplement(owner, "Kreatin");
        UUID iref = UUID.randomUUID();
        var i1 = intakes.logIntake(owner, new IntakeRequest().pantryItemId(supp.getId()).clientRef(iref));
        var i2 = intakes.logIntake(owner, new IntakeRequest().pantryItemId(supp.getId()).clientRef(iref));
        assertThat(i2.getId()).isEqualTo(i1.getId());
        assertThat(count("select count(*) from supplement_intake where created_by = ?", owner)).isEqualTo(1);
    }

    @Test
    void capturedAtIsStoredAsTheMoment() {
        UUID owner = owner("ref-captured@test.local");
        PantryItemEntity food = pantryPopulator.createFood(owner, "Rizs", LocalDate.now().plusDays(3));
        ZoneId zone = ownerZone.zoneId();
        OffsetDateTime yesterday1940 = OffsetDateTime.now(zone).minusDays(1)
            .withHour(19).withMinute(40).withSecond(0).withNano(0);

        MealResponse meal = meals.create(owner, mealReq(food, UUID.randomUUID(), yesterday1940));

        assertThat(meal.getLoggedAt().toInstant()).isEqualTo(yesterday1940.toInstant());
        assertThat(meal.getMealDate()).isEqualTo(yesterday1940.toLocalDate());
        assertThat(count("select count(*) from meal where created_by = ? and meal_date = '"
            + yesterday1940.toLocalDate() + "'", owner)).isEqualTo(1);

        var w = water.logWater(owner, new WaterLogRequest().amountMl(300).capturedAt(yesterday1940));
        assertThat(w.getDate()).isEqualTo(yesterday1940.toLocalDate());

        PantryItemEntity supp = pantryPopulator.createSupplement(owner, "Kreatin");
        var i = intakes.logIntake(owner, new IntakeRequest().pantryItemId(supp.getId()).capturedAt(yesterday1940));
        assertThat(i.getTakenAt().toInstant()).isEqualTo(yesterday1940.toInstant());
        assertThat(i.getTakenDate()).isEqualTo(yesterday1940.toLocalDate());
    }

    @Test
    void capturedAtOutsideTheWindowIsRejected() {
        UUID owner = owner("ref-window@test.local");
        PantryItemEntity food = pantryPopulator.createFood(owner, "Rizs", LocalDate.now().plusDays(3));
        OffsetDateTime tooOld = OffsetDateTime.now(ownerZone.zoneId()).minusDays(9);
        OffsetDateTime future = OffsetDateTime.now(ownerZone.zoneId()).plusHours(2);
        for (OffsetDateTime bad : List.of(tooOld, future)) {
            assertThatThrownBy(() -> meals.create(owner, mealReq(food, UUID.randomUUID(), bad)))
                .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                    ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
            assertThatThrownBy(() -> water.logWater(owner, new WaterLogRequest().amountMl(200).capturedAt(bad)))
                .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                    ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        }
        assertThat(count("select count(*) from meal where created_by = ?", owner)).isZero();
    }

    /** A real race: B's create with the same ref starts while A's transaction holds its fresh, uncommitted
     *  rows. B waits on the unique index, then reads A's committed meal back — one row, no 500. */
    @Test
    void concurrentCreatesWithOneRefKeepOneRow() throws Exception {
        UUID owner = owner("ref-race@test.local");
        PantryItemEntity food = pantryPopulator.createFood(owner, "Rizs", LocalDate.now().plusDays(3));
        UUID ref = UUID.randomUUID();
        CountDownLatch aWrote = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<MealResponse> a = pool.submit(() -> new TransactionTemplate(transactionManager).execute(st -> {
                MealResponse r = meals.create(owner, mealReq(food, ref, null));
                water.logWater(owner, new WaterLogRequest().amountMl(100).clientRef(ref));
                aWrote.countDown();
                try {
                    Thread.sleep(500); // keep A uncommitted while B races it
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
                return r;
            }));
            assertThat(aWrote.await(30, TimeUnit.SECONDS)).isTrue();
            Future<MealResponse> b = pool.submit(() -> meals.create(owner, mealReq(food, ref, null)));
            Future<?> bw = pool.submit(() -> water.logWater(owner, new WaterLogRequest().amountMl(100).clientRef(ref)));
            assertThat(b.get(30, TimeUnit.SECONDS).getId()).isEqualTo(a.get(30, TimeUnit.SECONDS).getId());
            bw.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("select count(*) from meal where created_by = ?", owner)).isEqualTo(1);
        assertThat(count("select count(*) from meal_item where created_by = ?", owner)).isEqualTo(1);
        assertThat(count("select count(*) from water_log where created_by = ?", owner)).isEqualTo(1);
    }
}
