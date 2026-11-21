package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonStaples;
import io.mrkuhne.mezo.api.dto.ShoppingItem;
import io.mrkuhne.mezo.api.dto.ShoppingListResponse;
import io.mrkuhne.mezo.api.dto.ShoppingListSummary;
import io.mrkuhne.mezo.api.dto.ShoppingStapleChip;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuMealEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuWeekEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonStapleEntity;
import io.mrkuhne.mezo.feature.season.entity.ShoppingItemEntity;
import io.mrkuhne.mezo.feature.season.entity.ShoppingListEntity;
import io.mrkuhne.mezo.feature.season.port.SeasonMenuSourcePort;
import io.mrkuhne.mezo.feature.season.repository.SeasonStapleRepository;
import io.mrkuhne.mezo.feature.season.repository.ShoppingItemRepository;
import io.mrkuhne.mezo.feature.season.repository.ShoppingListRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The shopping list of an approved menu week (Boop B6 Évad S3, spec §5.8): made on approval from
 * {@link ShoppingListBuilder}, ticked off server-side (survives a reinstall), his staples joining only on his tap, a
 * re-built list after a swap or a mid-week re-fit showing its differences as „változott" lines. Past lists are kept.
 */
@Service
@RequiredArgsConstructor
public class ShoppingListService {

    /** Offered until he sets his own staples. */
    static final List<String> DEFAULT_STAPLES = List.of("Olívaolaj", "Kávé", "Tojás", "Só", "Fűszerpaprika", "Citrom");
    private static final String STAPLE_KEY = "staple:";

    private final ShoppingListRepository lists;
    private final ShoppingItemRepository items;
    private final SeasonStapleRepository staples;
    private final SeasonMenuSourcePort source;

    // --- made from the menu --------------------------------------------------------------------------------------

    /** The list of a just-approved week (once; a second call keeps the existing list). */
    @Transactional
    public ShoppingListEntity create(UUID owner, SeasonMenuWeekEntity week, List<SeasonMenuMealEntity> meals) {
        ShoppingListEntity existing = lists.findByWeekId(week.getId()).orElse(null);
        if (existing != null) {
            return existing;
        }
        ShoppingListEntity list = new ShoppingListEntity();
        list.setCreatedBy(owner);
        list.setWeekId(week.getId());
        list.setWeekStart(week.getWeekStart());
        ShoppingListEntity saved = lists.save(list);
        for (ShoppingListBuilder.Item i : build(owner, meals)) {
            items.save(entity(owner, saved.getId(), i, false));
        }
        return saved;
    }

    /**
     * Re-builds an approved week's list after its meals moved: unchanged lines keep their tick, a line whose amount
     * moved or that is new is marked changed (a bigger amount is un-ticked), a line no longer needed stays as a
     * changed line with no amount (shown under „változott" as no longer needed). Staples are untouched.
     */
    @Transactional
    public void rebuild(UUID owner, SeasonMenuWeekEntity week, List<SeasonMenuMealEntity> meals) {
        ShoppingListEntity list = lists.findByWeekId(week.getId()).orElse(null);
        if (list == null) {
            create(owner, week, meals);
            return;
        }
        items.findByListId(list.getId()).stream().filter(ShoppingItemEntity::isChanged)
            .forEach(i -> i.setChanged(false)); // „változott" shows only the latest difference
        Map<String, ShoppingItemEntity> old = items.findByListId(list.getId()).stream()
            .filter(i -> !i.isStaple())
            .collect(Collectors.toMap(ShoppingItemEntity::getItemKey, Function.identity(), (a, b) -> a));
        for (ShoppingListBuilder.Item i : build(owner, meals)) {
            ShoppingItemEntity prev = old.remove(key(i.key()));
            if (prev == null) {
                items.save(entity(owner, list.getId(), i, true));
                continue;
            }
            boolean sameAmount = prev.getAmount() != null && prev.getAmount().compareTo(i.amount()) == 0;
            if (!sameAmount) {
                if (prev.getAmount() == null || i.amount().compareTo(prev.getAmount()) > 0) {
                    prev.setChecked(false);
                }
                prev.setAmount(i.amount());
                prev.setChanged(true);
            }
            prev.setForRecipes(new ArrayList<>(i.forRecipes()));
            prev.setUpdatedAt(Instant.now());
            items.save(prev);
        }
        for (ShoppingItemEntity gone : old.values()) {
            if (gone.getAmount() != null) {
                gone.setAmount(null);
                gone.setChanged(true);
                gone.setForRecipes(new ArrayList<>());
                gone.setUpdatedAt(Instant.now());
                items.save(gone);
            }
        }
        list.setUpdatedAt(Instant.now());
        lists.save(list);
    }

    // --- his reads and taps --------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ShoppingListResponse get(UUID owner, LocalDate weekStart) {
        return response(owner, lists.findByCreatedByAndWeekStart(owner, weekStart).orElseThrow(ShoppingListService::notFound));
    }

    @Transactional(readOnly = true)
    public List<ShoppingListSummary> lists(UUID owner) {
        return lists.findByCreatedByOrderByWeekStartDesc(owner).stream().map(l -> {
            List<ShoppingItemEntity> rows = items.findByListId(l.getId()).stream().filter(ShoppingListService::needed).toList();
            return ShoppingListSummary.builder().id(l.getId()).weekStart(l.getWeekStart())
                .itemCount(rows.size()).checkedCount((int) rows.stream().filter(ShoppingItemEntity::isChecked).count())
                .build();
        }).toList();
    }

    @Transactional
    public ShoppingItem check(UUID owner, UUID itemId, boolean checked) {
        ShoppingItemEntity i = items.findByIdAndCreatedBy(itemId, owner).orElseThrow(ShoppingListService::notFound);
        i.setChecked(checked);
        i.setUpdatedAt(Instant.now());
        return item(items.save(i));
    }

    /** One of his staples onto this list ({@code on}) or off it. A staple never joins a list without this tap. */
    @Transactional
    public ShoppingListResponse toggleStaple(UUID owner, UUID listId, String name, boolean on) {
        ShoppingListEntity list = lists.findByIdAndCreatedBy(listId, owner).orElseThrow(ShoppingListService::notFound);
        String clean = name == null ? "" : name.strip();
        if (clean.isEmpty() || clean.length() > 80) {
            throw new SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "name").build(),
                HttpStatus.BAD_REQUEST);
        }
        String key = key(STAPLE_KEY + clean.toLowerCase(Locale.ROOT));
        ShoppingItemEntity existing = items.findByListId(list.getId()).stream()
            .filter(i -> i.isStaple() && i.getItemKey().equals(key)).findFirst().orElse(null);
        if (on && existing == null) {
            ShoppingItemEntity e = new ShoppingItemEntity();
            e.setCreatedBy(owner);
            e.setListId(list.getId());
            e.setItemKey(key);
            e.setName(clean);
            e.setShelf(ShoppingListBuilder.SHELF_OTHER);
            e.setStaple(true);
            items.save(e);
        } else if (!on && existing != null) {
            items.delete(existing);
        }
        items.flush();
        return response(owner, list);
    }

    @Transactional(readOnly = true)
    public SeasonStaples staples(UUID owner) {
        List<SeasonStapleEntity> mine = staples.findByCreatedByOrderByPositionAsc(owner);
        boolean defaults = mine.isEmpty() && staples.countEver(owner) == 0;
        return SeasonStaples.builder()
            .names(new ArrayList<>(defaults ? DEFAULT_STAPLES : mine.stream().map(SeasonStapleEntity::getName).toList()))
            .defaults(defaults)
            .build();
    }

    @Transactional
    public SeasonStaples putStaples(UUID owner, List<String> names) {
        staples.deleteAll(staples.findByCreatedByOrderByPositionAsc(owner)); // soft: "set once" stays known
        int pos = 0;
        Set<String> seen = new LinkedHashSet<>();
        for (String n : names == null ? List.<String>of() : names) {
            String clean = n == null ? "" : n.strip();
            if (clean.isEmpty() || clean.length() > 80 || !seen.add(clean.toLowerCase(Locale.ROOT))) {
                continue;
            }
            SeasonStapleEntity e = new SeasonStapleEntity();
            e.setCreatedBy(owner);
            e.setName(clean);
            e.setPosition(pos++);
            staples.save(e);
        }
        if (pos == 0) {
            // an emptied list must still read as "he set it" (no defaults again): keep one deleted marker row
            SeasonStapleEntity marker = new SeasonStapleEntity();
            marker.setCreatedBy(owner);
            marker.setName("-");
            marker.setDeleted(true);
            staples.save(marker);
        }
        staples.flush();
        return staples(owner);
    }

    // --- internals -----------------------------------------------------------------------------------------------

    private List<ShoppingListBuilder.Item> build(UUID owner, List<SeasonMenuMealEntity> meals) {
        List<ShoppingListBuilder.Use> uses = meals.stream()
            .map(m -> new ShoppingListBuilder.Use(m.getRecipeId(), m.getServings())).toList();
        Set<UUID> recipeIds = meals.stream().map(SeasonMenuMealEntity::getRecipeId).filter(Objects::nonNull)
            .collect(Collectors.toSet());
        List<ShoppingListBuilder.Line> lines = recipeIds.isEmpty() ? List.of()
            : source.ingredients(owner, recipeIds).stream()
                .map(l -> new ShoppingListBuilder.Line(l.recipeId(), l.recipeName(), l.recipeServings(), l.catalogId(),
                    l.name(), l.amount(), l.unit(), l.category()))
                .toList();
        return ShoppingListBuilder.build(uses, lines);
    }

    private static ShoppingItemEntity entity(UUID owner, UUID listId, ShoppingListBuilder.Item i, boolean changed) {
        ShoppingItemEntity e = new ShoppingItemEntity();
        e.setCreatedBy(owner);
        e.setListId(listId);
        e.setItemKey(key(i.key()));
        e.setCatalogId(i.catalogId());
        e.setName(i.name().length() > 200 ? i.name().substring(0, 200) : i.name());
        e.setAmount(i.amount());
        e.setUnit(i.unit());
        e.setShelf(i.shelf());
        e.setForRecipes(new ArrayList<>(i.forRecipes()));
        e.setChanged(changed);
        return e;
    }

    /** The merge key as stored (≤ 80): a long one is shortened with a hash of the whole, so two never collide. */
    private static String key(String raw) {
        if (raw.length() <= 80) {
            return raw;
        }
        return raw.substring(0, 43) + "#" + UUID.nameUUIDFromBytes(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /** A line that still counts: a staple, or a recipe line with an amount (a "no longer needed" line does not). */
    private static boolean needed(ShoppingItemEntity i) {
        return i.isStaple() || i.getAmount() != null;
    }

    private ShoppingListResponse response(UUID owner, ShoppingListEntity list) {
        List<ShoppingItemEntity> rows = items.findByListId(list.getId()).stream()
            .sorted(Comparator.comparingInt((ShoppingItemEntity i) -> ShoppingListBuilder.SHELVES.indexOf(i.getShelf()))
                .thenComparing(i -> i.getName().toLowerCase(Locale.forLanguageTag("hu"))))
            .toList();
        Set<String> onList = rows.stream().filter(ShoppingItemEntity::isStaple)
            .map(i -> i.getName().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        List<ShoppingStapleChip> chips = staples(owner).getNames().stream()
            .map(n -> ShoppingStapleChip.builder().name(n).onList(onList.contains(n.toLowerCase(Locale.ROOT))).build())
            .toList();
        List<ShoppingItemEntity> counted = rows.stream().filter(ShoppingListService::needed).toList();
        return ShoppingListResponse.builder()
            .id(list.getId())
            .weekStart(list.getWeekStart())
            .items(new ArrayList<>(rows.stream().map(ShoppingListService::item).toList()))
            .staples(new ArrayList<>(chips))
            .itemCount(counted.size())
            .checkedCount((int) counted.stream().filter(ShoppingItemEntity::isChecked).count())
            .changedCount((int) rows.stream().filter(ShoppingItemEntity::isChanged).count())
            .build();
    }

    private static ShoppingItem item(ShoppingItemEntity i) {
        BigDecimal amount = i.getAmount();
        return ShoppingItem.builder()
            .id(i.getId())
            .name(i.getName())
            .amount(amount)
            .unit(i.getUnit())
            .amountText(ShoppingListBuilder.amountText(amount, i.getUnit()))
            .shelf(ShoppingItem.ShelfEnum.fromValue(i.getShelf()))
            .forRecipes(new ArrayList<>(i.getForRecipes() == null ? List.of() : i.getForRecipes()))
            .checked(i.isChecked())
            .changed(i.isChanged())
            .removed(!i.isStaple() && amount == null)
            .staple(i.isStaple())
            .build();
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
