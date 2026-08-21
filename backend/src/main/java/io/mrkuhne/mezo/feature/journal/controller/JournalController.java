package io.mrkuhne.mezo.feature.journal.controller;

import io.mrkuhne.mezo.api.controller.JournalApi;
import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.journal.service.DecisionService;
import io.mrkuhne.mezo.feature.journal.service.GratitudeService;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/journal surface (bd mezo-b3pp.1) — thin delegation, ownership from the principal;
 * gated on {@code JOURNAL_SWITCH} (off ⇒ the whole surface 404s and no journal beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
public class JournalController implements JournalApi {

    private final JournalService journalService;
    private final DecisionService decisionService;
    private final GratitudeService gratitudeService;
    private final CurrentUserId currentUserId;

    @Override
    public JournalEntryResponse createJournalEntry(CreateJournalEntryRequest createJournalEntryRequest) {
        return journalService.create(currentUserId.get(), createJournalEntryRequest);
    }

    @Override
    public void deleteJournalEntry(UUID id) {
        journalService.delete(currentUserId.get(), id);
    }

    @Override
    public List<JournalEntryResponse> listJournalEntries(LocalDate from, LocalDate to) {
        return journalService.list(currentUserId.get(), from, to);
    }

    @Override
    public JournalEntryResponse updateJournalEntry(UUID id, UpdateJournalEntryRequest updateJournalEntryRequest) {
        return journalService.update(currentUserId.get(), id, updateJournalEntryRequest);
    }

    // Decision journal (bd mezo-b3pp.4): the generated JournalApi bundles every Journal-tagged
    // operation (skipDefaultInterface=true, no default methods), so a second @RestController
    // implementing the same interface for just these three methods cannot coexist with this one —
    // they are folded in here instead, delegating to the separate DecisionService.
    @Override
    public DecisionEntryResponse createDecisionEntry(CreateDecisionEntryRequest createDecisionEntryRequest) {
        return decisionService.create(currentUserId.get(), createDecisionEntryRequest);
    }

    @Override
    public List<DecisionEntryResponse> listDecisionEntries() {
        return decisionService.list(currentUserId.get());
    }

    @Override
    public DecisionEntryResponse reviewDecisionEntry(UUID id, ReviewDecisionRequest reviewDecisionRequest) {
        return decisionService.review(currentUserId.get(), id, reviewDecisionRequest);
    }

    // Gratitude (bd mezo-b3pp.3)
    @Override
    public GratitudeEntryResponse createGratitudeEntry(CreateGratitudeEntryRequest createGratitudeEntryRequest) {
        return gratitudeService.create(currentUserId.get(), createGratitudeEntryRequest);
    }

    @Override
    public List<GratitudeEntryResponse> listGratitudeEntries(LocalDate from, LocalDate to) {
        return gratitudeService.list(currentUserId.get(), from, to);
    }

    @Override
    public void deleteGratitudeEntry(UUID id) {
        gratitudeService.delete(currentUserId.get(), id);
    }
}
