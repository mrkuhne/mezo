package io.mrkuhne.mezo.feature.pantry.mapper;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.PantryImportEntryResponse;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryMacros;
import io.mrkuhne.mezo.api.dto.PantryMicro;
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

    default void applyRequest(PantryItemEntity e, PantryItemRequest r) {
        PantryCatalogEntity c = e.getCatalog();
        c.setKind(r.getKind() == null ? null : r.getKind().getValue());
        c.setName(r.getName());
        c.setBrand(r.getBrand());
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        c.setCategory(r.getCategory() == null ? null : r.getCategory().getValue());
        e.setNotes(r.getNotes());
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
        e.setPriceHuf(r.getPrice());
        e.setPriceUnit(r.getPriceUnit());
        c.setPackageLabel(r.getPkg());
        c.setMicros(r.getMicros() == null ? null
            : r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        c.setNova(r.getNova() == null ? null : r.getNova().shortValue());
        e.setStockQty(r.getStockQty());
        e.setStockUnit(r.getStockUnit());
        e.setStockExpires(r.getStockExpires());
        e.setDose(r.getDose());
        c.setForm(r.getForm());
        e.setProtocol(r.getProtocol());
        e.setTiming(r.getTiming());
        c.setCaffeine(r.getCaffeine());
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
        PantryCatalogEntity c = e.getCatalog();
        if (r.getKind() != null) c.setKind(r.getKind().getValue());
        if (r.getName() != null) c.setName(r.getName());
        setIfPresent(r.getBrand(), c::setBrand);
        if (r.getSource() != null) c.setSource(r.getSource().getValue());
        if (r.getCategory() != null) c.setCategory(r.getCategory().getValue());
        setIfPresent(r.getNotes(), e::setNotes);
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
        setIfPresent(r.getPrice(), e::setPriceHuf);
        setIfPresent(r.getPriceUnit(), e::setPriceUnit);
        setIfPresent(r.getPkg(), c::setPackageLabel);
        if (r.getMicros() != null) c.setMicros(
            r.getMicros().stream().map(m -> new MicroFact(m.getName(), m.getPct())).toList());
        if (r.getNova() != null) c.setNova(r.getNova().shortValue());
        setIfPresent(r.getStockQty(), e::setStockQty);
        setIfPresent(r.getStockUnit(), e::setStockUnit);
        setIfPresent(r.getStockExpires(), e::setStockExpires);
        setIfPresent(r.getDose(), e::setDose);
        setIfPresent(r.getForm(), c::setForm);
        setIfPresent(r.getProtocol(), e::setProtocol);
        setIfPresent(r.getTiming(), e::setTiming);
        setIfPresent(r.getCaffeine(), c::setCaffeine);
    }

    private static <T> void setIfPresent(T value, java.util.function.Consumer<T> setter) {
        if (value != null) setter.accept(value);
    }

    default IngredientResponse toIngredientResponse(PantryItemEntity e) {
        PantryCatalogEntity c = e.getCatalog();
        return IngredientResponse.builder()
            .id(e.getId())
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
            .build();
    }

    default PantryItemResponse toItemResponse(PantryItemEntity e) {
        PantryCatalogEntity c = e.getCatalog();
        return PantryItemResponse.builder()
            .id(e.getId())
            .kind(PantryItemResponse.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
            .brand(c.getBrand())
            .source(c.getSource())
            .category(c.getCategory())
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
