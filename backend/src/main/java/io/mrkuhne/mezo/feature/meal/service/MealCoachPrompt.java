package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Pure prompt assembly for {@link MealCoachService} (mezo-mr4n) — no Spring, no DB, so the
 * prompt's CONTENT (which is the real contract with the model) is unit-testable.
 *
 * <p>The honesty rule of the whole coach layer lives here: every meal block carries the day state
 * as of THAT meal's log time, never "now". That is what makes a verdict cacheable — the same meal
 * always produces the same prompt, so a breakfast read back in the evening is still judged against
 * the morning's numbers (spec §4).
 *
 * <p>A napi célok a GOAL-tudatos {@link DailyTargets}-ből jönnek (mezo-jcpt.19), nem a statikus
 * mezo.nutrition configból: cut alatt a próza korábban 3100 kcal-t idézhetett, miközben a
 * pontszám ~1500-hoz mért.
 */
final class MealCoachPrompt {

    private MealCoachPrompt() {
    }

    /**
     * One meal to narrate. {@code kcalBefore}/{@code pBefore}/{@code cBefore}/{@code fBefore} are
     * the day's totals BEFORE this meal; {@code indexInDay} is 1-based.
     */
    record MealBlock(UUID mealId, String name, String slot, LocalTime loggedAt, int indexInDay,
                     MealBreakdownJson breakdown, MealRole role,
                     BigDecimal kcalBefore, BigDecimal pBefore, BigDecimal cBefore,
                     BigDecimal fBefore, List<MealCoachStore.ItemLine> items) {

        /** The pre-glucose shape (no item lines) — the prompt then simply omits the TÉTELEK block. */
        MealBlock(UUID mealId, String name, String slot, LocalTime loggedAt, int indexInDay,
                  MealBreakdownJson breakdown, MealRole role,
                  BigDecimal kcalBefore, BigDecimal pBefore, BigDecimal cBefore, BigDecimal fBefore) {
            this(mealId, name, slot, loggedAt, indexInDay, breakdown, role, kcalBefore, pBefore,
                cBefore, fBefore, List.of());
        }
    }

    static String userMessage(LocalDate date, DailyTargets targets,
                              List<Window> workouts, List<MealBlock> meals) {
        return userMessage(date, targets, workouts, meals, null);
    }

    /**
     * With the PERSON block (owner, 2026-09-26) — the body, goal, sleep, medication and check-ins
     * that shape a glucose response. {@code person} null = omitted (no reader in the caller).
     */
    static String userMessage(LocalDate date, DailyTargets targets, List<Window> workouts,
                              List<MealBlock> meals, MealCoachContextReader.PersonContext person) {
        StringBuilder sb = new StringBuilder();
        sb.append("NAP: ").append(date).append('\n');
        sb.append("NAPI CÉLOK: ").append(targets.kcal()).append(" kcal · P ").append(targets.p())
          .append("g · C ").append(targets.c()).append("g · F ").append(targets.f()).append("g\n");

        sb.append("MAI EDZÉSEK: ");
        if (workouts.isEmpty()) {
            sb.append("nincs\n");
        } else {
            sb.append('\n');
            for (Window w : workouts) {
                sb.append("- ").append(w.start()).append('-').append(w.end())
                  .append(" · ").append(w.kind());
                if (w.label() != null && !w.label().isBlank()) {
                    sb.append(" · ").append(w.label());
                }
                sb.append(w.done() ? " · megvolt" : " · tervezett").append('\n');
            }
        }

        if (person != null) {
            appendPerson(sb, person);
        }

        for (MealBlock m : meals) {
            appendMeal(sb, targets, m);
            if (person != null) {
                appendCheckIns(sb, MealCoachContextReader.upTo(person.checkIns(),
                    m.loggedAt().toString().substring(0, 5)));
            }
        }
        return sb.toString();
    }

    /** Who eats — every field "nincs adat" when unknown; a gap is never a default person. */
    private static void appendPerson(StringBuilder sb, MealCoachContextReader.PersonContext p) {
        sb.append("\nA FELHASZNÁLÓ (a vércukor-tippekhez):\n");
        sb.append("- test: nem ").append(orNa("M".equals(p.sex()) ? "férfi" : "F".equals(p.sex()) ? "nő" : null))
          .append(" · életkor ").append(p.age() == null ? "nincs adat" : p.age() + " év")
          .append(" · magasság ").append(unit(p.heightCm(), " cm"))
          .append(" · testsúly ").append(unit(p.weightKg(), " kg"))
          .append(" · testzsír ").append(unit(p.bodyFatPct(), "%"))
          .append(" · hétköznapi mozgás ").append(orNa(activityLabel(p.activityLevel()))).append('\n');
        sb.append("- cél: ").append(orNa(trajectoryLabel(p.goalTrajectory())));
        if (!p.goalGuards().isEmpty()) {
            sb.append(" (megőrzendő: ").append(String.join(", ", p.goalGuards())).append(')');
        }
        sb.append('\n');
        MealCoachContextReader.Sleep s = p.sleep();
        sb.append("- legutóbbi alvás: ");
        if (s == null) {
            sb.append("nincs adat\n");
        } else {
            sb.append(s.date()).append(" · ").append(unit(s.durationH(), " óra"))
              .append(" · minőség ").append(s.quality() == null ? "nincs adat" : s.quality() + "/10")
              .append(" · felébredések ").append(s.awakenings() == null ? "nincs adat" : s.awakenings())
              .append('\n');
        }
        sb.append("- aktív gyógyszer: ").append(p.medication() == null ? "nincs rögzítve" : p.medication())
          .append('\n');
    }

    /** The check-ins up to this meal (1-10 scales) — stress and a flat day both move glucose. */
    private static void appendCheckIns(StringBuilder sb, List<MealCoachContextReader.CheckIn> upTo) {
        sb.append("Közérzet eddig a pontig: ");
        if (upTo.isEmpty()) {
            sb.append("nincs check-in\n");
            return;
        }
        MealCoachContextReader.CheckIn last = upTo.getLast();
        sb.append(last.slotTime()).append(" · energia ").append(scale(last.energy()))
          .append(" · stressz ").append(scale(last.stress()))
          .append(" · test ").append(scale(last.body()))
          .append(" · fej ").append(scale(last.mental())).append('\n');
    }

    private static String scale(Integer v) {
        return v == null ? "?" : v + "/10";
    }

    private static String orNa(String v) {
        return v == null || v.isBlank() ? "nincs adat" : v;
    }

    private static String unit(BigDecimal v, String unit) {
        return v == null ? "nincs adat" : v.stripTrailingZeros().toPlainString() + unit;
    }

    private static String activityLabel(String level) {
        if (level == null) {
            return null;
        }
        return switch (level) {
            case "DESK" -> "ülőmunka";
            case "MIXED" -> "vegyes";
            case "PHYSICAL" -> "fizikai munka";
            default -> level;
        };
    }

    private static String trajectoryLabel(String trajectory) {
        if (trajectory == null) {
            return null;
        }
        return switch (trajectory) {
            case "cut" -> "fogyás (szálkásítás)";
            case "bulk" -> "tömegelés";
            case "maintain" -> "szinten tartás";
            default -> trajectory;
        };
    }

    /** Assumed refined share when no line knows its sugar — the FE `glycemicBand` twin. */
    private static final BigDecimal ASSUMED_SUGAR_SHARE = new BigDecimal("0.3");

    /**
     * The glucose band the app SHOWS for this plate — a byte-for-byte twin of the FE
     * {@code glycemicBand.ts} derivation (load − brake, &lt; 12 low, &lt; 24 mid, else high), so the
     * tips never contradict the box they appear in. The internal index is not printed.
     */
    static String glucoseBand(List<MealCoachStore.ItemLine> items) {
        double c = 0;
        double fiber = 0;
        double p = 0;
        double f = 0;
        Double sugar = null;
        for (MealCoachStore.ItemLine i : items) {
            c += val(i.c());
            fiber += val(i.fiberG());
            p += val(i.p());
            f += val(i.f());
            if (i.sugarG() != null) {
                sugar = (sugar == null ? 0 : sugar) + i.sugarG().doubleValue();
            }
        }
        double s = sugar == null ? c * ASSUMED_SUGAR_SHARE.doubleValue() : sugar;
        double load = c * (0.6 + 0.4 * Math.min(1, s / Math.max(1, c)));
        double index = load - (fiber * 2 + p * 0.25 + f * 0.2);
        String level = index < 12 ? "alacsony" : index < 24 ? "közepes" : "magas";
        return sugar == null ? level + " (a cukor becsült)" : level;
    }

    private static double val(BigDecimal v) {
        return v == null ? 0 : v.doubleValue();
    }

    private static void appendMeal(StringBuilder sb, DailyTargets targets, MealBlock m) {
        sb.append("\n=== ÉTKEZÉS mealId=").append(m.mealId()).append(" ===\n");
        sb.append("Név: ").append(m.name() == null ? "-" : m.name())
          .append(" | slot: ").append(m.slot() == null ? "-" : m.slot())
          .append(" | idő: ").append(m.loggedAt())
          .append(" | a nap ").append(m.indexInDay()).append(". étkezése\n");
        sb.append("Szerep: ").append(roleLabel(m.role())).append('\n');
        sb.append("A NAP ÁLLAPOTA EDDIG A PONTIG: ").append(plain(m.kcalBefore())).append(" kcal · P ")
          .append(plain(m.pBefore())).append("g · C ").append(plain(m.cBefore())).append("g · F ")
          .append(plain(m.fBefore())).append("g (marad: ")
          .append(remaining(targets.kcal(), m.kcalBefore())).append(" kcal · P ")
          .append(remaining(targets.p(), m.pBefore())).append("g)\n");

        appendItems(sb, m.items());

        MealBreakdownJson b = m.breakdown();
        sb.append("DETERMINISZTIKUS BONTÁS (0-1, súlyozott) — érték ").append(b.value())
          .append(", megbízhatóság ").append(b.confidence()).append(":\n");
        for (Dimension d : b.dimensions()) {
            sb.append("- ").append(d.id()).append(" (").append(d.label()).append("): score ")
              .append(d.score()).append(", súly ").append(d.weight())
              .append(" — ").append(d.detail()).append('\n');
        }
    }

    /**
     * The plate's own lines — what the glucose tips (owner, 2026-09-26) build on. Unknown sugar /
     * fiber print as "?" rather than 0, so the model never reads a data gap as "sugar-free".
     */
    private static void appendItems(StringBuilder sb, List<MealCoachStore.ItemLine> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        sb.append("VÉRCUKOR-SÁV (az app számolta, ezt látja a felhasználó): ").append(glucoseBand(items))
          .append('\n');
        sb.append("TÉTELEK (a vércukor-tippekhez):\n");
        for (MealCoachStore.ItemLine i : items) {
            sb.append("- ").append(i.name()).append(' ').append(plain(i.amount()))
              .append(i.unit() == null ? "" : " " + i.unit())
              .append(" · C ").append(plain(i.c())).append("g · ebből cukor ").append(gramOrUnknown(i.sugarG()))
              .append(" · rost ").append(gramOrUnknown(i.fiberG()))
              .append(" · P ").append(plain(i.p())).append('g');
            if (i.f() != null) {
                sb.append(" · F ").append(plain(i.f())).append('g');
            }
            if (i.saturatedFatG() != null) {
                sb.append(" · telített zsír ").append(gramOrUnknown(i.saturatedFatG()));
            }
            if (i.kcal() != null) {
                sb.append(" · ").append(plain(i.kcal())).append(" kcal");
            }
            if (i.nova() != null) {
                sb.append(" · NOVA ").append(i.nova());
            }
            if (i.source() != null) {
                sb.append(" · forrás ").append(i.source());
            }
            sb.append('\n');
        }
    }

    private static String gramOrUnknown(BigDecimal v) {
        return v == null ? "?" : v.setScale(0, java.math.RoundingMode.HALF_UP).toPlainString() + "g";
    }

    /** The role as the prompt names it — the same tokens the scoring rubric uses. */
    private static String roleLabel(MealRole role) {
        return switch (role) {
            case PRE_WORKOUT -> "pre_workout (edzés előtti üzemanyag-ablak)";
            case POST_WORKOUT -> "post_workout (regenerációs ablak, az edzés megvolt)";
            case STANDARD -> "standard (nincs edzés-kontextus)";
        };
    }

    private static String plain(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }

    private static String remaining(int target, BigDecimal consumed) {
        BigDecimal left = BigDecimal.valueOf(target)
            .subtract(consumed == null ? BigDecimal.ZERO : consumed);
        return left.stripTrailingZeros().toPlainString();
    }
}
