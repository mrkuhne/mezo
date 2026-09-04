package io.mrkuhne.mezo.feature.pantry.mapper;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryImportEntryResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryMacros;
import io.mrkuhne.mezo.api.dto.PantryMicro;
import io.mrkuhne.mezo.api.dto.PantrySharedFrom;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.api.dto.PantryStock;
import io.mrkuhne.mezo.api.dto.SupplementStashResponse;
import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryImportEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.mapstruct.Mapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Mapper(componentModel = "spring")
public interface PantryMapper {

    /** Expiry is "low" when within 3 days. */
    int LOW_EXPIRY_DAYS = 3;

    Logger LOG = LoggerFactory.getLogger(PantryMapper.class);

    // ==== write side: DEFINITION (shared catalog row) vs STATE (the caller's shelf row) ====
    //
    // S4 (mezo-qw37.4): the old applyRequest/applyRequestPartial wrote BOTH halves through
    // e.getCatalog(), so one user's PUT silently rewrote a definition sitting on other users'
    // shelves (or a loader master row). The split exists so PantryService can run the
    // author-or-OWNER gate BEFORE any definition setter fires — a refused edit must leave the
    // managed catalog entity untouched, otherwise Hibernate's dirty check flushes it anyway.

    /** Full write of the DEFINITION half (create path). Name/brand are trimmed — the natural key is trimmed too. */
    default void applyDefinition(PantryCatalogEntity c, PantryItemRequest r) {
        c.setKind(r.getKind() == null ? null : r.getKind().getValue());
        c.setName(r.getName() == null ? null : r.getName().strip());
        c.setBrand(r.getBrand() == null ? null : r.getBrand().strip());
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        c.setCategory(r.getCategory() == null ? null : r.getCategory().getValue());
        c.setServingAmount(r.getPer());
        c.setServingUnit(r.getUnit());
        c.setKcal(r.getKcal());
        c.setProteinG(r.getProteinG());
        c.setCarbsG(r.getCarbsG());
        c.setFatG(r.getFatG());
        c.setFiberG(r.getFiberG());
        c.setSugarG(r.getSugarG());
        c.setSaltG(r.getSaltG());
        c.setSaturatedFatG(r.getSaturatedFatG());
        c.setPackageLabel(r.getPkg());
        c.setMicros(r.getMicros() == null ? null
            : r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        c.setNova(r.getNova() == null ? null : r.getNova().shortValue());
        c.setForm(r.getForm());
        c.setCaffeine(r.getCaffeine());
    }

    /**
     * PATCH-style merge of the DEFINITION half: null = leave unchanged (same contract as before the
     * split). The generated request DTO cannot distinguish an omitted field from an explicit null,
     * and there is no clear-a-field UX, so this mirrors the FE mock merge
     * ({@code input.x ?? existing.x} in {@code pantryHooks.ts}).
     */
    default void applyDefinitionPartial(PantryCatalogEntity c, PantryItemRequest r) {
        if (r.getKind() != null) c.setKind(r.getKind().getValue());
        if (r.getName() != null) c.setName(r.getName().strip());
        if (r.getBrand() != null) c.setBrand(r.getBrand().strip());
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        if (r.getCategory() != null) c.setCategory(r.getCategory().getValue());
        setIfPresent(r.getPer(), c::setServingAmount);
        setIfPresent(r.getUnit(), c::setServingUnit);
        setIfPresent(r.getKcal(), c::setKcal);
        setIfPresent(r.getProteinG(), c::setProteinG);
        setIfPresent(r.getCarbsG(), c::setCarbsG);
        setIfPresent(r.getFatG(), c::setFatG);
        setIfPresent(r.getFiberG(), c::setFiberG);
        setIfPresent(r.getSugarG(), c::setSugarG);
        setIfPresent(r.getSaltG(), c::setSaltG);
        setIfPresent(r.getSaturatedFatG(), c::setSaturatedFatG);
        setIfPresent(r.getPkg(), c::setPackageLabel);
        if (r.getMicros() != null) c.setMicros(
            r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        if (r.getNova() != null) c.setNova(r.getNova().shortValue());
        setIfPresent(r.getForm(), c::setForm);
        setIfPresent(r.getCaffeine(), c::setCaffeine);
    }

    /**
     * True when any definition field the request CARRIES differs from the stored definition. This is
     * the 403 trigger: the edit sheet always echoes the whole definition back, so an unchanged echo
     * must still pass for a user who may not edit the shared row.
     */
    default boolean definitionDiffers(PantryCatalogEntity c, PantryItemRequest r) {
        return (r.getKind() != null && !r.getKind().getValue().equals(c.getKind()))
            // Both sides stripped, always: a legacy row stored as "Túró " (the pre-split mapper never
            // trimmed and the split migration copies `name` verbatim) must not read as a definition
            // CHANGE when the edit sheet echoes the displayed "Túró" back — that would 403 a
            // non-author out of editing their own price/stock/notes forever.
            || (r.getName() != null && !r.getName().strip().equals(c.getName() == null ? "" : c.getName().strip()))
            || (r.getBrand() != null
                && !r.getBrand().strip().equals(c.getBrand() == null ? "" : c.getBrand().strip()))
            || (r.getSource() != null && !r.getSource().getValue().equals(c.getSource()))
            || (r.getCategory() != null && !r.getCategory().getValue().equals(c.getCategory()))
            || numDiffers(r.getPer(), c.getServingAmount())
            || (r.getUnit() != null && !r.getUnit().equals(c.getServingUnit()))
            || numDiffers(r.getKcal(), c.getKcal()) || numDiffers(r.getProteinG(), c.getProteinG())
            || numDiffers(r.getCarbsG(), c.getCarbsG()) || numDiffers(r.getFatG(), c.getFatG())
            || numDiffers(r.getFiberG(), c.getFiberG()) || numDiffers(r.getSugarG(), c.getSugarG())
            || numDiffers(r.getSaltG(), c.getSaltG()) || numDiffers(r.getSaturatedFatG(), c.getSaturatedFatG())
            || (r.getPkg() != null && !r.getPkg().equals(c.getPackageLabel()))
            || (r.getMicros() != null
                && !r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList()
                    .equals(c.getMicros() == null ? List.of() : c.getMicros()))
            || (r.getNova() != null && !Short.valueOf(r.getNova().shortValue()).equals(c.getNova()))
            || (r.getForm() != null && !r.getForm().equals(c.getForm()))
            || (r.getCaffeine() != null && !r.getCaffeine().equals(c.getCaffeine()));
    }

    private static boolean numDiffers(BigDecimal requested, BigDecimal stored) {
        if (requested == null) return false;
        return stored == null || requested.compareTo(stored) != 0;
    }

    /** Full write of the STATE half — always the caller's own shelf row, never gated. */
    default void applyUserFields(PantryItemEntity e, PantryItemRequest r) {
        e.setNotes(r.getNotes());
        e.setPriceHuf(r.getPrice());
        e.setPriceUnit(r.getPriceUnit());
        e.setStockQty(r.getStockQty());
        e.setStockUnit(r.getStockUnit());
        e.setStockExpires(r.getStockExpires());
        e.setDose(r.getDose());
        e.setProtocol(r.getProtocol());
        e.setTiming(r.getTiming());
    }

    /** PATCH-style merge of the STATE half — null = leave unchanged. */
    default void applyUserFieldsPartial(PantryItemEntity e, PantryItemRequest r) {
        setIfPresent(r.getNotes(), e::setNotes);
        setIfPresent(r.getPrice(), e::setPriceHuf);
        setIfPresent(r.getPriceUnit(), e::setPriceUnit);
        setIfPresent(r.getStockQty(), e::setStockQty);
        setIfPresent(r.getStockUnit(), e::setStockUnit);
        setIfPresent(r.getStockExpires(), e::setStockExpires);
        setIfPresent(r.getDose(), e::setDose);
        setIfPresent(r.getProtocol(), e::setProtocol);
        setIfPresent(r.getTiming(), e::setTiming);
    }

    private static <T> void setIfPresent(T value, java.util.function.Consumer<T> setter) {
        if (value != null) setter.accept(value);
    }

    default IngredientResponse toIngredientResponse(PantryItemEntity e, String sharedFromName, boolean catalogEditable) {
        PantryCatalogEntity c = e.getCatalog();
        return IngredientResponse.builder()
            .id(e.getId())
            // The shared definition's kind, on the wire since mezo-4orh: the client used to
            // re-derive it from `category`, and a FOOD row categorised 'supplement' then echoed
            // kind='supplement' back on every save — tripping definitionDiffers into a 403 for a
            // non-author and a silent rewrite of the SHARED row for the author/OWNER.
            .kind(IngredientResponse.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand() == null ? "" : c.getBrand())
            .source(toIngredientSource(c.getSource()))
            .category(c.getCategory() == null ? "" : c.getCategory())
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .macros(PantryMacros.builder()
                .kcal(nz(c.getKcal())).p(nz(c.getProteinG())).c(nz(c.getCarbsG())).f(nz(c.getFatG())).build())
            .price(e.getPriceHuf() == null ? BigDecimal.ZERO : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit() == null ? "" : e.getPriceUnit())
            .pkg(c.getPackageLabel() == null ? "" : c.getPackageLabel())
            .micros(c.getMicros() == null ? List.of()
                : c.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            // Honest null since mezo-32ko — the old `null -> 1` default dressed unclassified
            // items up as NOVA 1 on the Kamra UI while the score engine honestly degraded.
            .nova(c.getNova() == null ? null : c.getNova().intValue())
            .stock(toStock(e))
            .fiberG(c.getFiberG())
            .sugarG(c.getSugarG())
            .saltG(c.getSaltG())
            .saturatedFatG(c.getSaturatedFatG())
            .lastUsed("—")          // derived from logging — out of scope this slice
            .usedInRecipes(0)        // derived from recipes — out of scope this slice
            .catalogId(c.getId())
            .sharedFrom(sharedFromName == null ? null : PantrySharedFrom.builder().authorName(sharedFromName).build())
            .catalogEditable(catalogEditable)
            .build();
    }

    default PantryStock toStock(PantryItemEntity e) {
        if (e.getStockQty() == null) return null;
        LocalDate exp = e.getStockExpires();
        return PantryStock.builder()
            .qty(e.getStockQty())
            .unit(e.getStockUnit() == null ? "" : e.getStockUnit())
            .expires(exp == null ? null : exp.toString())
            .lowExpiry(exp != null && ChronoUnit.DAYS.between(LocalDate.now(), exp) <= LOW_EXPIRY_DAYS)
            .build();
    }

    default SupplementStashResponse toSupplementResponse(PantryItemEntity e, String sharedFromName, boolean catalogEditable) {
        PantryCatalogEntity c = e.getCatalog();
        return SupplementStashResponse.builder()
            .id(e.getId())
            .name(c.getName())
            .brand(c.getBrand() == null ? "" : c.getBrand())
            .type(SupplementStashResponse.TypeEnum.fromValue(typeFromKind(c.getKind())))
            .category(c.getCategory() == null ? "" : c.getCategory())
            .dose(e.getDose() == null ? "" : e.getDose())
            .form(c.getForm() == null ? "" : c.getForm())
            .stock(e.getStockQty())
            .stockUnit(e.getStockUnit())
            .protocol(e.getProtocol() == null ? "" : e.getProtocol())
            .timing(e.getTiming() == null ? "" : e.getTiming())
            .taken(e.isTaken())
            .caffeine(c.getCaffeine())
            // Nutrition + commerce (mezo-1za9): supplements carry macros/nutrients/price to the UI
            // too. macros stays null for pure dose/protocol items (kcal unset) so the detail view
            // hides the Makrók block; nz() zero-fills a partial macro row when kcal is present.
            .source(c.getSource() == null ? null : toStashSource(c.getSource()))
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .macros(c.getKcal() == null ? null : PantryMacros.builder()
                .kcal(nz(c.getKcal())).p(nz(c.getProteinG())).c(nz(c.getCarbsG())).f(nz(c.getFatG())).build())
            .price(e.getPriceHuf() == null ? null : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit())
            .pkg(c.getPackageLabel())
            .micros(c.getMicros() == null ? null
                : c.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            .nova(c.getNova() == null ? null : c.getNova().intValue())
            .fiberG(c.getFiberG())
            .sugarG(c.getSugarG())
            .saltG(c.getSaltG())
            .saturatedFatG(c.getSaturatedFatG())
            .catalogId(c.getId())
            .sharedFrom(sharedFromName == null ? null : PantrySharedFrom.builder().authorName(sharedFromName).build())
            .catalogEditable(catalogEditable)
            .build();
    }

    default PantryItemResponse toItemResponse(PantryItemEntity e) {
        PantryCatalogEntity c = e.getCatalog();
        return PantryItemResponse.builder()
            .id(e.getId())
            .catalogId(c.getId())
            .kind(PantryItemResponse.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand())
            .source(c.getSource())
            .category(c.getCategory())
            .build();
    }

    /** One shared definition as a search hit; {@code authorName} is null for loader master rows. */
    default PantryCatalogEntry toCatalogEntry(PantryCatalogEntity c, String authorName) {
        return PantryCatalogEntry.builder()
            .id(c.getId())
            .kind(PantryCatalogEntry.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand())
            .source(toIngredientSource(c.getSource()))
            .category(c.getCategory())
            .per(c.getServingAmount())
            .unit(c.getServingUnit())
            .kcal(c.getKcal()).proteinG(c.getProteinG()).carbsG(c.getCarbsG()).fatG(c.getFatG())
            .fiberG(c.getFiberG()).sugarG(c.getSugarG()).saltG(c.getSaltG()).saturatedFatG(c.getSaturatedFatG())
            .nova(c.getNova() == null ? null : c.getNova().intValue())
            .form(c.getForm())
            .caffeine(c.getCaffeine())
            .authorName(authorName)
            .build();
    }

    /** Import-feed row -> the pinned FE PantryImport shape (P6, mezo-bka). */
    default PantryImportEntryResponse toImportEntry(PantryImportEntity e) {
        return PantryImportEntryResponse.builder()
            .id(e.getId())
            .source(PantrySource.fromValue(e.getSource()))
            .when(e.getImportedAt().atOffset(ZoneOffset.UTC))
            .items(e.getItemCount())
            .status(PantryImportEntryResponse.StatusEnum.fromValue(e.getStatus()))
            .ofWhat(e.getItemName())
            .build();
    }

    /**
     * Defensive source mapping (mezo-w3o): the generated enums throw on any DB value outside the
     * contract enum, turning one drifted row into a 500 on the WHOLE pantry read. The allow-lists
     * are kept in lockstep (DB CHECK == contract enum), so this fallback should never fire — but
     * if they ever drift, degrade that row's source to "manual" and log, never 500.
     */
    default PantrySource toIngredientSource(String value) {
        try {
            return PantrySource.fromValue(value);
        } catch (IllegalArgumentException ex) {
            LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
            return PantrySource.MANUAL;
        }
    }

    /**
     * See {@link #toIngredientSource(String)} — same guard for the stash projection. The stash
     * enum is nullable in the contract, so its generated {@code fromValue} returns null instead
     * of throwing; both drift shapes degrade to manual.
     */
    default PantrySource toStashSource(String value) {
        try {
            PantrySource mapped = PantrySource.fromValue(value);
            if (mapped == null) {
                LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
                return PantrySource.MANUAL;
            }
            return mapped;
        } catch (IllegalArgumentException ex) {
            LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
            return PantrySource.MANUAL;
        }
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    private static String typeFromKind(String kind) {
        return switch (kind) {
            case "stim" -> "stimulant";
            case "med" -> "medication";
            default -> "supplement";
        };
    }
}
