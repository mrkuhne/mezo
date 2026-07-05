package io.mrkuhne.mezo.feature.pantry.mapper;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryImportEntryResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryMacros;
import io.mrkuhne.mezo.api.dto.PantryMicro;
import io.mrkuhne.mezo.api.dto.PantryStock;
import io.mrkuhne.mezo.api.dto.SupplementStashResponse;
import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
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

    default void applyRequest(PantryItemEntity e, PantryItemRequest r) {
        e.setKind(r.getKind() == null ? null : r.getKind().getValue());
        e.setName(r.getName());
        e.setBrand(r.getBrand());
        if (r.getSource() != null) e.setSource(r.getSource().getValue());
        e.setCategory(r.getCategory() == null ? null : r.getCategory().getValue());
        e.setNotes(r.getNotes());
        e.setServingAmount(r.getPer());
        e.setServingUnit(r.getUnit());
        e.setKcal(r.getKcal());
        e.setProteinG(r.getProteinG());
        e.setCarbsG(r.getCarbsG());
        e.setFatG(r.getFatG());
        e.setFiberG(r.getFiberG());
        e.setSugarG(r.getSugarG());
        e.setSaltG(r.getSaltG());
        e.setSaturatedFatG(r.getSaturatedFatG());
        e.setPriceHuf(r.getPrice());
        e.setPriceUnit(r.getPriceUnit());
        e.setPackageLabel(r.getPkg());
        e.setMicros(r.getMicros() == null ? null
            : r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        e.setNova(r.getNova() == null ? null : r.getNova().shortValue());
        e.setStockQty(r.getStockQty());
        e.setStockUnit(r.getStockUnit());
        e.setStockExpires(r.getStockExpires());
        e.setDose(r.getDose());
        e.setForm(r.getForm());
        e.setProtocol(r.getProtocol());
        e.setTiming(r.getTiming());
        e.setCaffeine(r.getCaffeine());
    }

    /**
     * Partial (PATCH-style) merge for updates: applies only the fields the request carries,
     * leaving every omitted field untouched — null means "leave unchanged", not "clear".
     * <p>The generated request DTO cannot distinguish an omitted field from an explicit null,
     * and there is no clear-a-field UX, so this mirrors the FE mock merge ({@code input.x ?? existing.x}
     * in {@code pantryHooks.ts}) and keeps real-mode behaviour identical to mock. A future
     * clear-field feature would need a real PATCH contract (JsonNullable / explicit-null support).
     * {@code kind} and {@code name} are required and always sent, so a rename/retype still applies.
     */
    default void applyRequestPartial(PantryItemEntity e, PantryItemRequest r) {
        if (r.getKind() != null) e.setKind(r.getKind().getValue());
        if (r.getName() != null) e.setName(r.getName());
        setIfPresent(r.getBrand(), e::setBrand);
        if (r.getSource() != null) e.setSource(r.getSource().getValue());
        if (r.getCategory() != null) e.setCategory(r.getCategory().getValue());
        setIfPresent(r.getNotes(), e::setNotes);
        setIfPresent(r.getPer(), e::setServingAmount);
        setIfPresent(r.getUnit(), e::setServingUnit);
        setIfPresent(r.getKcal(), e::setKcal);
        setIfPresent(r.getProteinG(), e::setProteinG);
        setIfPresent(r.getCarbsG(), e::setCarbsG);
        setIfPresent(r.getFatG(), e::setFatG);
        setIfPresent(r.getFiberG(), e::setFiberG);
        setIfPresent(r.getSugarG(), e::setSugarG);
        setIfPresent(r.getSaltG(), e::setSaltG);
        setIfPresent(r.getSaturatedFatG(), e::setSaturatedFatG);
        setIfPresent(r.getPrice(), e::setPriceHuf);
        setIfPresent(r.getPriceUnit(), e::setPriceUnit);
        setIfPresent(r.getPkg(), e::setPackageLabel);
        if (r.getMicros() != null) e.setMicros(
            r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        if (r.getNova() != null) e.setNova(r.getNova().shortValue());
        setIfPresent(r.getStockQty(), e::setStockQty);
        setIfPresent(r.getStockUnit(), e::setStockUnit);
        setIfPresent(r.getStockExpires(), e::setStockExpires);
        setIfPresent(r.getDose(), e::setDose);
        setIfPresent(r.getForm(), e::setForm);
        setIfPresent(r.getProtocol(), e::setProtocol);
        setIfPresent(r.getTiming(), e::setTiming);
        setIfPresent(r.getCaffeine(), e::setCaffeine);
    }

    private static <T> void setIfPresent(T value, java.util.function.Consumer<T> setter) {
        if (value != null) setter.accept(value);
    }

    default IngredientResponse toIngredientResponse(PantryItemEntity e) {
        return IngredientResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .brand(e.getBrand() == null ? "" : e.getBrand())
            .source(toIngredientSource(e.getSource()))
            .category(e.getCategory() == null ? "" : e.getCategory())
            .per(e.getServingAmount())
            .unit(e.getServingUnit())
            .macros(PantryMacros.builder()
                .kcal(nz(e.getKcal())).p(nz(e.getProteinG())).c(nz(e.getCarbsG())).f(nz(e.getFatG())).build())
            .price(e.getPriceHuf() == null ? BigDecimal.ZERO : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit() == null ? "" : e.getPriceUnit())
            .pkg(e.getPackageLabel() == null ? "" : e.getPackageLabel())
            .micros(e.getMicros() == null ? List.of()
                : e.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            // Honest null since mezo-32ko — the old `null -> 1` default dressed unclassified
            // items up as NOVA 1 on the Kamra UI while the score engine honestly degraded.
            .nova(e.getNova() == null ? null : e.getNova().intValue())
            .stock(toStock(e))
            .fiberG(e.getFiberG())
            .sugarG(e.getSugarG())
            .saltG(e.getSaltG())
            .saturatedFatG(e.getSaturatedFatG())
            .lastUsed("—")          // derived from logging — out of scope this slice
            .usedInRecipes(0)        // derived from recipes — out of scope this slice
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

    default SupplementStashResponse toSupplementResponse(PantryItemEntity e) {
        return SupplementStashResponse.builder()
            .id(e.getId())
            .name(e.getName())
            .brand(e.getBrand() == null ? "" : e.getBrand())
            .type(SupplementStashResponse.TypeEnum.fromValue(typeFromKind(e.getKind())))
            .category(e.getCategory() == null ? "" : e.getCategory())
            .dose(e.getDose() == null ? "" : e.getDose())
            .form(e.getForm() == null ? "" : e.getForm())
            .stock(e.getStockQty())
            .stockUnit(e.getStockUnit())
            .protocol(e.getProtocol() == null ? "" : e.getProtocol())
            .timing(e.getTiming() == null ? "" : e.getTiming())
            .taken(e.isTaken())
            .caffeine(e.getCaffeine())
            // Nutrition + commerce (mezo-1za9): supplements carry macros/nutrients/price to the UI
            // too. macros stays null for pure dose/protocol items (kcal unset) so the detail view
            // hides the Makrók block; nz() zero-fills a partial macro row when kcal is present.
            .source(e.getSource() == null ? null : toStashSource(e.getSource()))
            .per(e.getServingAmount())
            .unit(e.getServingUnit())
            .macros(e.getKcal() == null ? null : PantryMacros.builder()
                .kcal(nz(e.getKcal())).p(nz(e.getProteinG())).c(nz(e.getCarbsG())).f(nz(e.getFatG())).build())
            .price(e.getPriceHuf() == null ? null : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit())
            .pkg(e.getPackageLabel())
            .micros(e.getMicros() == null ? null
                : e.getMicros().stream().map(m -> PantryMicro.builder().name(m.name()).pct(m.pct()).build()).toList())
            .nova(e.getNova() == null ? null : e.getNova().intValue())
            .fiberG(e.getFiberG())
            .sugarG(e.getSugarG())
            .saltG(e.getSaltG())
            .saturatedFatG(e.getSaturatedFatG())
            .build();
    }

    default PantryItemResponse toItemResponse(PantryItemEntity e) {
        return PantryItemResponse.builder()
            .id(e.getId())
            .kind(PantryItemResponse.KindEnum.fromValue(e.getKind()))
            .name(e.getName())
            .brand(e.getBrand())
            .source(e.getSource())
            .category(e.getCategory())
            .build();
    }

    /** Import-feed row -> the pinned FE PantryImport shape (P6, mezo-bka). */
    default PantryImportEntryResponse toImportEntry(PantryImportEntity e) {
        return PantryImportEntryResponse.builder()
            .id(e.getId())
            .source(PantryImportEntryResponse.SourceEnum.fromValue(e.getSource()))
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
    default IngredientResponse.SourceEnum toIngredientSource(String value) {
        try {
            return IngredientResponse.SourceEnum.fromValue(value);
        } catch (IllegalArgumentException ex) {
            LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
            return IngredientResponse.SourceEnum.MANUAL;
        }
    }

    /**
     * See {@link #toIngredientSource(String)} — same guard for the stash projection. The stash
     * enum is nullable in the contract, so its generated {@code fromValue} returns null instead
     * of throwing; both drift shapes degrade to manual.
     */
    default SupplementStashResponse.SourceEnum toStashSource(String value) {
        try {
            SupplementStashResponse.SourceEnum mapped = SupplementStashResponse.SourceEnum.fromValue(value);
            if (mapped == null) {
                LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
                return SupplementStashResponse.SourceEnum.MANUAL;
            }
            return mapped;
        } catch (IllegalArgumentException ex) {
            LOG.warn("pantry_item.source '{}' outside the contract enum — degrading to manual (mezo-w3o)", value);
            return SupplementStashResponse.SourceEnum.MANUAL;
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
