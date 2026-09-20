package io.mrkuhne.mezo.feature.companion.service;

import org.springframework.test.context.TestPropertySource;

/** Same equivalence and next-turn checks on the conversation-first path. */
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class PersonalContextConversationIT extends PersonalContextAssemblerIT {}
