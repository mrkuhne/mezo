package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonAdherence;
import io.mrkuhne.mezo.api.dto.SeasonInsight;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonExperimentRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The season's rules as a short Hungarian block for every AI context (spec §5.10) — the chat snapshot
 * ({@code ContextSnapshotAssembler}, both variants), the morning brief ({@code BoopPrompts}), the meal coach and the
 * {@code get_season} tool, each through its own consumer-owned port ({@link SeasonContextAdapter}).
 *
 * <p>{@link #render}: {@code ""} without an active season, else lines starting {@code "[Évad] "} — title + week, goal
 * + pace or band, the week's gym / sport days, training / rest-day kcal + protein, the allowed-recipe rule (only with
 * allowed recipes), the NOVA rule (only under 4 — NOVA 4 allows everything), sleep need + bedtime. Every number is the
 * engine's for the season as it stands ({@link SeasonPreviewService#compute}); when it cannot compute (no profile),
 * the number lines are left out, never guessed. {@link #overview}: week, course, last week's adherence, insights.
 *
 * <p>Never throws: a context renderer must not break a chat turn, so a failure logs and renders nothing. Not
 * transactional on purpose — it joins the caller's transaction and calls no proxied method that throws by design.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeasonContextRenderer {

    static final String PREFIX = "[Évad] ";
    private static final int NOVA_ALL = 4;
    private static final List<String> DAYS = List.of("hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat",
        "vasárnap");

    private final SeasonRepository seasonRepository;
    private final SeasonAllowedRecipeRepository allowedRepository;
    private final SeasonPreviewService previewService;
    private final SeasonOverviewService overviewService;
    private final SeasonExperimentRepository experimentRepository;

    /** The season's rules; {@code ""} without an active season. */
    public String render(UUID owner, LocalDate today) {
        try {
            return seasonRepository.findActive(owner).map(s -> rules(owner, s, today)).orElse("");
        } catch (RuntimeException e) {
            log.warn("Season context: rules unavailable for {}", owner, e);
            return "";
        }
    }

    /** Where the season stands; {@code ""} without an active season. */
    public String overview(UUID owner, LocalDate today) {
        try {
            Optional<SeasonEntity> s = seasonRepository.findActive(owner);
            if (s.isEmpty()) {
                return "";
            }
            // The overview needs the engine's numbers; without them (no profile) it would throw through a
            // transactional proxy and poison the caller's transaction — say only the week then.
            if (compute(owner, s.get(), previewService.currentDraft(owner, s.get())).isEmpty()) {
                return PREFIX + title(s.get().getTitle()) + " · " + SeasonOverviewService.weekOf(s.get(), today) + ". hét / "
                    + s.get().getWeeks();
            }
            return standing(overviewService.overview(owner));
        } catch (RuntimeException e) {
            log.warn("Season context: overview unavailable for {}", owner, e);
            return "";
        }
    }

    private String rules(UUID owner, SeasonEntity s, LocalDate today) {
        SeasonDraftJson draft = previewService.currentDraft(owner, s);
        Optional<SeasonPreviewService.Computed> computed = compute(owner, s, draft);
        List<String> lines = new ArrayList<>();
        lines.add(title(s.getTitle()) + " · " + SeasonOverviewService.weekOf(s, today) + ". hét / " + s.getWeeks());
        lines.add(goal(draft, computed));
        lines.add(training(draft));
        computed.map(SeasonPreviewService.Computed::numbers).ifPresent(n -> lines.add(food(n)));
        long allowed = allowedRepository.countBySeasonId(s.getId());
        if (allowed > 0) {
            lines.add("Recept-szabály: csak a kiválasztott %d recept".formatted(allowed));
        }
        Integer nova = s.getProcessedFoodMaxNova();
        if (nova != null && nova < NOVA_ALL) {
            lines.add("Étel-szabály: csak kevéssé feldolgozott ételek (NOVA ≤ %d)".formatted(nova));
        }
        sleep(s, computed).ifPresent(lines::add);
        lines.addAll(experiments(owner, s, today));
        return lines.stream().map(l -> PREFIX + l).collect(Collectors.joining("\n"));
    }

    /** Évad S4: each kept experiment as a habit rule, and the running one with its day (never throws: a failure
     *  leaves the lines out). */
    private List<String> experiments(UUID owner, SeasonEntity s, LocalDate today) {
        try {
            List<String> out = new ArrayList<>();
            for (SeasonExperimentEntity e : experimentRepository.findBySeasonIdAndKeptTrueOrderByCreatedAtAsc(s.getId())) {
                out.add("Szokás (kísérletből megtartva): " + title(e.getTitle()));
            }
            experimentRepository.findBySeasonIdAndStatus(s.getId(), SeasonExperimentEntity.STATUS_RUNNING).stream()
                .filter(e -> e.getStartDate() != null)
                .findFirst()
                .ifPresent(e -> out.add("Kísérlet fut: " + title(e.getTitle()) + " (" + ExperimentService.dayIndex(e, today)
                    + ". nap / " + e.getLengthDays() + ")"));
            return out;
        } catch (RuntimeException e) {
            log.warn("Season context: experiments unavailable for {}", owner, e);
            return List.of();
        }
    }

    private Optional<SeasonPreviewService.Computed> compute(UUID owner, SeasonEntity s, SeasonDraftJson draft) {
        try {
            return Optional.of(previewService.compute(owner, s, draft));
        } catch (RuntimeException e) {
            log.debug("Season context: no numbers for {} ({})", owner, e.getMessage());
            return Optional.empty();
        }
    }

    private static String goal(SeasonDraftJson draft, Optional<SeasonPreviewService.Computed> computed) {
        String trajectory = draft.trajectory();
        StringBuilder b = new StringBuilder("Cél: ").append(trajectoryHu(trajectory));
        SeasonNumbersJson n = computed.map(SeasonPreviewService.Computed::numbers).orElse(null);
        if ("maintain".equals(trajectory)) {
            if (n != null && n.bandLowKg() != null && n.bandHighKg() != null) {
                b.append(", sáv ").append(kg1(n.bandLowKg())).append('–').append(kg1(n.bandHighKg())).append(" kg");
            }
            return b.toString();
        }
        BigDecimal target = computed.map(c -> c.goal().targetWeightKg()).orElse(draft.targetWeightKg());
        if (target != null) {
            b.append(", ").append(plain(target)).append(" kg");
        }
        LocalDate targetDate = computed.map(SeasonPreviewService.Computed::goal).map(SeasonGoalPort.GoalFields::targetDate)
            .orElse(null);
        if (targetDate != null) {
            b.append(" (").append(targetDate).append("-ig)");
        }
        if (n != null && n.kgPerWeek() != null) {
            b.append(", heti ").append(plain(n.kgPerWeek().setScale(2, RoundingMode.HALF_UP))).append(" kg");
        }
        return b.toString();
    }

    private static String training(SeasonDraftJson d) {
        List<String> parts = new ArrayList<>();
        if (!d.gymDaysOrEmpty().isEmpty()) {
            parts.add("edzőterem " + d.gymDaysOrEmpty().stream().sorted().map(DAYS::get).collect(Collectors.joining(", "))
                + (d.gymTime() == null ? "" : " " + d.gymTime()));
        }
        for (SeasonDraftJson.SportSlot s : d.sportOrEmpty()) {
            parts.add(sportHu(s.sport()) + " " + DAYS.get(s.dayOfWeek()) + (s.time() == null ? "" : " " + s.time()));
        }
        return "E heti edzések: " + (parts.isEmpty() ? "nincs tervezett edzés" : String.join("; ", parts));
    }

    private static String food(SeasonNumbersJson n) {
        return "Edzésnapon " + SeasonFormat.kcal(n.trainDayKcal())
            + (n.trainSportDayKcal() == null ? "" : ", edzés + sport napon " + SeasonFormat.kcal(n.trainSportDayKcal()))
            + (n.restDayKcal() == null ? ", pihenőnap nincs" : ", pihenőnapon " + SeasonFormat.kcal(n.restDayKcal()))
            + ", fehérje " + n.proteinG() + " g";
    }

    private static Optional<String> sleep(SeasonEntity s, Optional<SeasonPreviewService.Computed> computed) {
        Optional<SeasonNumbersJson> n = computed.map(SeasonPreviewService.Computed::numbers);
        Integer need = n.map(SeasonNumbersJson::sleepNeedMin).orElse(s.getSleepNeedMin());
        if (need == null) {
            return Optional.empty();
        }
        String bedtime = n.map(SeasonNumbersJson::bedtime).orElse(null);
        return Optional.of("Alvásigény " + SeasonFormat.hoursMinutes(need) + (bedtime == null ? "" : ", lefekvés " + bedtime));
    }

    private static String standing(SeasonOverview o) {
        List<String> lines = new ArrayList<>();
        lines.add(title(o.getHead().getTitle()) + " · " + o.getHead().getWeek() + ". hét / " + o.getHead().getWeeks() + ", "
            + trajectoryHu(o.getHead().getTrajectory().getValue()));
        lines.add("Haladás: " + statusHu(o.getHead().getStatus().getValue()));
        SeasonAdherence a = o.getAdherence();
        if (a == null) {
            lines.add("Az elmúlt 7 nap: még nincs mit értékelni");
        } else {
            lines.add("Az elmúlt 7 nap: étel a kereten belül " + a.getFoodInBand() + "/" + a.getFoodJudged()
                + " értékelt napon"
                + (a.getTrainingPlanned() > 0 ? ", edzés " + a.getTrainingDone() + "/" + a.getTrainingPlanned() : "")
                + (a.getSportPlanned() > 0 ? ", sport " + a.getSportDone() + "/" + a.getSportPlanned() : "")
                + ", elég alvás " + a.getNightsOk() + "/" + a.getNightsJudged() + " éjszakán"
                + (a.getExcusedDays() > 0 ? ", kímélő nap: " + a.getExcusedDays() : ""));
        }
        for (SeasonInsight i : o.getInsights()) {
            lines.add("Észrevétel: " + i.getTitle() + " — " + i.getBody());
        }
        return lines.stream().map(l -> PREFIX + l).collect(Collectors.joining("\n"));
    }

    /** The user-typed title as one inert line: no brackets (no fake [Block] tag), whitespace collapsed. */
    static String title(String raw) {
        return raw == null ? "" : raw.replaceAll("[\\[\\]]", "").replaceAll("\\s+", " ").strip();
    }

    private static String trajectoryHu(String trajectory) {
        return switch (trajectory == null ? "" : trajectory) {
            case "cut" -> "fogyás";
            case "bulk" -> "tömegnövelés";
            case "maintain" -> "tartás";
            default -> trajectory;
        };
    }

    private static String statusHu(String status) {
        return switch (status) {
            case "on_course" -> "a terv szerint halad";
            case "slower" -> "lassabban halad a tervnél";
            case "faster" -> "gyorsabban halad a tervnél";
            case "in_band" -> "a súly a sávon belül van";
            case "out_of_band" -> "a súly a sávon kívül van";
            default -> "még kevés a mérés, nem látszik";
        };
    }

    private static String sportHu(String sport) {
        return switch (sport == null ? "" : sport) {
            case "volleyball" -> "röplabda";
            case "trx" -> "TRX";
            case "cross" -> "cross";
            default -> sport;
        };
    }

    private static String kg1(BigDecimal kg) {
        return kg.setScale(1, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString().replace('.', ',');
    }
}
