# Coding Agent Prompt — French Learning Hub v2

You are extending my existing personal language-learning web app into the central hub for a serious French A0→B1 learning system.

You have three sources of truth:

1. **The existing codebase** — source of truth for architecture, styling, navigation, storage patterns, SRS behavior, Texts, audio/TTS, Wiki, and conjugation UX.
2. **`french_month1_study_system_v2.md`** — source of truth for pedagogy, curriculum, exercise design, sprint structure, mastery logic, reference content, and LLM-assisted learning principles.
3. **The attached dashboard mockup** — visual direction for the new Dashboard. Treat it as a composition/reference, not a requirement to reproduce every pixel.

This is a personal tool used by one person. Optimize for learning value, speed, compactness, and maintainability. Do not turn it into a generic SaaS product.

---

## 0. Before coding

Read the entire study specification and inspect the codebase before making changes.

Understand:
- framework and routing
- current component/style system
- persistence/database
- SRS scheduling and answer history
- deck/card models
- Texts/annotation behavior
- TTS/audio implementation
- conjugation pages
- Wiki/reference structure
- existing OpenRouter/DeepSeek integration
- server/client boundary and secret handling

Write a short implementation plan internally, then proceed autonomously.

Do not stop for approval after every phase unless there is a genuinely consequential ambiguity.

Do not ask questions that can be answered by reading the code or the provided specification.

---

# 1. Product model

The system is **mastery-based and sprint-based**, not calendar-based.

Month 1 has four curated sprints:

- **Sprint 1 — Foundation:** sound system + first sentence engine
- **Sprint 2 — Generate:** productive sentence generation
- **Sprint 3 — Past & Speech:** usable past + spoken-French comprehension
- **Sprint 4 — Consolidate:** small working language + fluency

There is no:
- streak requirement
- scheduled backlog
- “you missed Tuesday”
- XP/coins
- leaderboard
- artificial completion pressure

I may study 20 minutes one day, skip two days, then study two hours.

Progress measures learning, not compliance.

Hardcoding the four sprints and their curated content is acceptable and preferable to premature abstraction.

---

# 2. New Dashboard

Add **Dashboard** as the first navigation item while preserving the app's current visual language.

The dashboard should feel like a compact desktop control panel.

## Header

Include:
- Sprint 1 / Sprint 2 / Sprint 3 / Sprint 4 switcher
- sprint title
- short mission
- previous/next controls if useful

Do not fill the page with explanatory prose.

## Progress Overview

Display compact progress cards/meters for:

- Vocabulary
- Core Verbs
- Pronunciation
- Grammar / Patterns
- Listening
- Speaking
- Reading where relevant
- Writing where relevant

These should reflect mastery/activity state, not simply lessons checked off.

Weights may vary by sprint.

## “Do Something Now”

Include an obvious but compact action for:

**Build a session**

with duration choices such as:
- 5 min
- 15 min
- 30 min
- Deep

If sufficient learner-state data exists, the session can be composed using the LLM rules below.

Also allow manual Activity Bank browsing.

## Activity Bank

Filters:

### Time
- 5 min
- 15 min
- 30 min
- Deep

### Skill
- All
- Vocabulary
- Pronunciation
- Grammar
- Listening
- Reading
- Speaking

Rows/cards should show only useful metadata:
- activity name
- category
- approximate duration
- target where useful
- start/open action

Examples:
- SRS Review
- /y/ vs /u/ discrimination
- Spanish → French
- Sentence transformations
- Dictation
- Audio comprehension
- Micro-dialogue
- Grammar workbook section
- Comprehensible-input video
- Text study
- Timed speaking

## Sprint Targets

Show current target state such as:

- 43 / 60 Core words
- 3 / 4 Core verbs
- 7 / 11 pronunciation targets
- listening progress
- output checks

## Mastery Test

Show:
- readiness estimate
- compact requirements
- previous attempt if available
- Start Mastery Test

Never require every progress meter to equal 100% before the next sprint.

Carry weak areas forward and continue recommending them.

## Quick Actions

Include compact access to things such as:
- Review Due
- Generate Drill
- Build a Session
- Open Text
- Add Cards
- Core Verbs
- Pronunciation
- References

Do not create a full chatbot panel on the dashboard in v1.

---

# 3. Structured curriculum/content layer

Keep the existing deck system usable, but extend it with structured learning metadata.

At minimum support vocabulary data similar to:

```json
{
  "id": "fr_vouloir",
  "french": "vouloir",
  "spanish": "querer",
  "english": "to want",
  "part_of_speech": "verb",
  "gender": null,
  "ipa": "/vulwaʁ/",
  "sprint": 2,
  "priority": 1,
  "status": "core",
  "frequency_band": "very_high",
  "example_fr": "Je veux partir.",
  "example_es": "Quiero irme.",
  "pattern": "vouloir + infinitif",
  "spanish_connection": "querer + infinitivo",
  "pronunciation_warning": null,
  "false_friend": false,
  "reference_links": []
}
```

For verbs additionally support:
- conjugations
- Spanish equivalents
- past participle
- auxiliary
- high-value constructions
- examples
- irregular family/pattern

Bulk structured import must be easy.

JSON should work. CSV is optional.

---

# 4. Vocabulary states and mastery

Support:

- **Core** — should become actively usable
- **Recognition** — should be understood; active production optional
- **Encountered** — captured naturally but not promoted automatically

Avoid one simplistic “known” boolean where practical.

Track enough dimensions to distinguish:
- written recognition
- audio recognition
- French production
- spoken production
- contextual use

The implementation can start pragmatic/simple, but preserve this conceptual model.

---

# 5. Exercise framework

Build a reusable activity/result schema so static, deterministic, and LLM-generated exercises all flow through the same scoring/mastery system.

Prioritize these formats:

1. French → Spanish recognition
2. Spanish → French production
3. Audio recognition
4. Cloze
5. Sentence transformation
6. Translation ladder
7. Pronunciation discrimination
8. Dictation
9. Listening ladder
10. Micro-dialogue
11. Cognate mining
12. Spanish-interference/error repair
13. Timed fluency
14. Text-derived exercises

### Sentence transformation is especially important.

Starting with:

`Je veux travailler demain.`

support prompts such as:
- change subject
- make negative
- make a question
- replace vouloir with pouvoir
- replace pouvoir with devoir
- change time expression
- later change tense/construction
- translate
- listen and reproduce

Do not create a separate silo for each tiny variant.

Use reusable transformation dimensions.

---

# 6. Exercise-quality rules

Apply these constraints to generated and curated practice.

## Known-language threshold
Aim for ~85–95% already-known language plus the intended target.

## One-primary-difficulty
Do not combine several unknown grammar/vocabulary problems into one beginner item.

## Naturalness
French should be:
- Metropolitan/France French
- idiomatic
- conversational by default
- concise
- plausible

## Controlled variation
Do not endlessly repeat one identical sentence.

Reuse the same target through new contexts and formats.

## Interest
Rotate contexts such as:
- daily life
- work
- friends/relationships
- technology
- travel
- media
- sports
- plans
- opinions

Avoid arbitrary “beginner vocabulary units” like zoo animals or kitchen objects unless naturally relevant.

## Error recycling
Recurring mistakes should return later through spaced targeted practice.

Do not immediately spam repeated correction.

---

# 7. Spanish is the bridge language

My French is A0.

My Spanish is approximately C1.

Use Spanish aggressively where it saves time.

Default learning mapping should often be:

**French ↔ Spanish**

with English available only when useful.

Examples:

`vouloir ↔ querer`

`venir de + infinitif ↔ acabar de + infinitivo`

`aller + infinitif ↔ ir a + infinitivo`

Support:
- cognate type
- false friend
- pronunciation mismatch
- parallel grammatical pattern
- nonparallel pattern

As proficiency rises, increase French-only comprehension and explanation.

---

# 8. Reference Library

Turn the Wiki/reference system into a permanent cross-linked French knowledge base.

Create and seed:

1. Pronunciation Master Sheet
2. Spelling → Sound Decoder
3. Spanish → French Transfer Map
4. Core Verb Atlas
5. Sentence Architecture
6. Questions & Conversation Repair
7. Articles, Gender & Prepositions
8. Tense / Time Map
9. Pronoun Map
10. Spoken French Decoder
11. Numbers, Time & Dates
12. Personal Interference Log

These are reference sheets, not textbook chapters.

Requirements:
- compact
- searchable
- scannable
- example-heavy
- audio-enabled when relevant
- deep-linkable by section

Cross-link them from:
- cards
- drills
- conjugations
- texts
- mastery-test feedback

Do not leave the Wiki isolated.

Seed real Month 1 content rather than placeholders.

---

# 9. Improve the existing Text system

Preserve the current Text functionality.

Where architecture permits, add:
- clickable word/phrase
- audio
- Spanish meaning
- optional English
- grammar info
- verb lookup
- add as Encountered
- manually Promote to Core
- notes
- generate exercise from selected sentence
- contextual reference links

Do not automatically make every clicked word a high-priority card.

---

# 10. External resources

Support external-resource activities tied to particular sprint objectives.

Seed the relevant resources from the study document, including:
- CLE Phonétique progressive du français
- CLE Grammaire progressive du français
- TV5MONDE Première classe
- French Comprehensible Input
- Alice Ayel where useful
- YouGlish French
- Forvo
- RFI for later phases

Do not make a generic links page the main experience.

A sprint task should link directly to the relevant resource/topic.

---

# 11. Seed the full Month 1 curriculum

Use `french_month1_study_system_v2.md` as the authority.

Do not invent a different sequence.

At minimum populate all four sprint configs, including:
- target vocabulary
- core verbs
- grammar/patterns
- pronunciation targets
- activity bank
- external links
- mastery criteria

## Sprint 1 verbs
- être
- avoir
- aller
- faire

## Sprint 2 additions
- vouloir
- pouvoir
- devoir
- savoir
- dire
- parler
- penser
- aimer

## Sprint 3 additions
- venir
- prendre
- mettre
- voir
- croire
- comprendre
- trouver
- donner
- demander
- répondre

## Sprint 4 selected additions
- vivre
- travailler
- rester
- partir
- arriver
- passer
- commencer
- finir
- essayer
- sentir

Use the vocabulary quantities and grammar/pronunciation sequence defined in the study document.

The result should be usable immediately for Sprint 1, not an empty framework.

---

# 12. OpenRouter / LLM architecture

The project already has an OpenRouter key/integration and commonly uses DeepSeek elsewhere.

Reuse existing infrastructure where sensible.

Keep keys server-side.

Never expose credentials in client JavaScript.

Create a learning-AI service abstraction rather than sprinkling raw model calls throughout components.

Conceptual APIs:

- `generateDrill(...)`
- `composeSession(...)`
- `explainFrench(...)`
- `analyzeConversation(...)`
- `analyzeText(...)`
- `generateMicroContent(...)`

Model choice should remain configurable.

---

# 13. Shared learner-context builder

Implement a reusable server-side function that produces task-specific structured learner context.

It may expose:
- active sprint
- Core vocabulary
- Recognition vocabulary
- recently learned vocabulary
- due vocabulary
- known verbs
- target verbs
- known grammar
- target grammar
- pronunciation targets
- recent results
- recurring mistakes
- weakest mastery dimensions
- sprint resources

Do not pass the entire database to the LLM.

Keep payloads compact and purpose-specific.

---

# 14. Structured LLM outputs and validation

For learning-related model calls, prefer structured JSON.

Validate before use.

For generated exercises validate:
- schema
- answer exists
- exercise type is supported
- requested target is actually present
- target belongs to permitted curriculum
- unknown-vocabulary budget is respected
- output is not obviously malformed

Reject/regenerate invalid items.

Do not make UI logic dependent on scraping prose from model responses.

---

# 15. Implement now: Generate Drill

Add a useful LLM-backed **Generate Drill** action.

Inputs can include:
- active sprint
- exercise type
- target words/verbs/grammar
- learner mastery
- allowed vocabulary
- difficulty
- count
- France French
- Spanish bridge

Initial LLM-generated formats:
- Spanish → French
- cloze
- sentence transformation
- translation ladder
- contextual vocabulary
- micro-dialogue
- error repair
- short reading/comprehension

Generated material must follow:
- ~85–95% known language
- one primary difficulty
- natural France French
- concise realistic contexts
- no unnecessary advanced vocabulary

Store generated exercises where practical.

They should submit results through the same mastery pipeline as static exercises.

Cache/reuse good generations rather than paying to regenerate everything.

---

# 16. Implement now or immediately after mastery data: Build a Session

Add:

**Build a Session**

with:
- 5 min
- 15 min
- 30 min
- Deep

The session composer can use the LLM to choose among valid existing activity types based on:
- due reviews
- weak skills
- active sprint
- recently introduced content
- skill balance
- available time

The LLM may compose the session.

It may **not invent new curriculum objectives**.

Example:

```json
{
  "duration": 15,
  "activities": [
    {"type": "srs_review", "minutes": 4},
    {"type": "pronunciation", "target": "/y_vs_u/", "minutes": 3},
    {"type": "sentence_transform", "targets": ["pouvoir", "devoir"], "minutes": 5},
    {"type": "listening_check", "minutes": 3}
  ]
}
```

This remains optional; manual activity selection always exists.

---

# 17. Prepare, but do not overbuild yet

Design interfaces/data so these can be added later without restructuring:

## Context-aware French tutor
Modes:
- controlled conversation
- conversation
- roleplay
- French only
- French + Spanish help
- Socratic tutor

It should know my actual known vocabulary/grammar and stay near that level.

Do not make this the main v1 dashboard feature.

## Post-conversation analysis
Return a small number of:
- important errors
- Spanish-interference errors
- useful reformulations
- pronunciation targets
- candidate cards

Feed recurring issues into Personal Interference Log and later drills.

## Smart Text analysis
Classify language relative to learner state:
- Known
- Recognition
- transparent via Spanish
- inferable
- unknown but useful
- unknown low-priority

Recommend promotions rather than auto-adding everything.

## Contextual Explain
Future inline actions:
- Explain
- Compare to Spanish
- Why this tense?
- More examples
- Pronunciation

Explanations should assume advanced Spanish.

## Personalized micro-content
Generate constrained short texts/dialogues from known language, then reuse them for:
- reading
- TTS
- comprehension
- cloze
- transformations
- retelling
- mining

## Later B1 practice
Conversation/writing simulations and trend feedback.

Do not claim official CEFR certification.

---

# 18. Mastery model

Implement something pragmatic, not over-engineered.

Possible inputs:
- SRS performance
- production vs recognition
- audio results
- drill accuracy
- recency
- repeated mistakes
- mastery tests

A learner can be:

- Vocabulary: strong
- Verbs: strong
- Pronunciation: adequate
- Listening: weak
- Speaking: adequate

and still move to the next sprint.

Weak dimensions should remain visible and influence recommendations.

---

# 19. Reliability/cost hierarchy for AI

Prefer:

1. curated content where correctness matters most
2. deterministic code where possible
3. cached validated model-generated content
4. fresh LLM calls when personalization/variation adds value

The app must remain useful if OpenRouter is temporarily unavailable.

Do not use an LLM for basic:
- navigation
- SRS scheduling
- conjugation lookup
- static references
- deterministic transformations that code can perform reliably

---

# 20. Implementation order

Use this order unless the codebase strongly suggests a better one.

## Phase 1 — Audit
Understand existing architecture and OpenRouter integration.

## Phase 2 — Data layer
Add sprint/content/activity/mastery/reference metadata while preserving existing data.

## Phase 3 — Dashboard
Implement sprint switcher, progress, activity bank, targets, mastery panel, quick actions, and session entry point.

## Phase 4 — Deterministic drill engine
Implement the core shared exercise/result framework and high-value formats.

## Phase 5 — LLM learning infrastructure
Implement:
- learner-context builder
- structured output schemas
- validation
- `generateDrill`
- caching

## Phase 6 — Reference library
Create and cross-link the seeded reference pages.

## Phase 7 — Seed Month 1
Populate real Sprint 1–4 curriculum and make Sprint 1 immediately usable.

## Phase 8 — Mastery/recommendations
Connect results to progress and weak-area prioritization.

## Phase 9 — Adaptive sessions
Implement or finalize `Build a Session` once mastery data is usable.

## Phase 10 — Integration/polish
Test persistence, navigation, generation failures, audio, Texts, external resources, responsive behavior if already supported, and visual consistency.

---

# 21. UX rules

Keep everything compact.

Prefer:

`/y/ vs /u/`
`12 items`
`5 min`
`Start`

over explanatory copy.

I know what the app is for.

The dashboard should look like a control panel, not an onboarding page.

Preserve the existing:
- dark theme
- teal/green header treatment
- compact sidebar
- subtle borders
- information density
- practical desktop-app feel

Use the supplied mockup as visual direction.

---

# 22. Do not overbuild

Do not add:
- authentication unless already present/required
- multiplayer/social
- streaks
- achievements
- leaderboards
- giant generic dictionary APIs
- B2/C1 curriculum
- full chatbot before core practice works
- fake accent scoring
- elaborate adaptive-learning ML
- excessive abstractions for hypothetical users

This is a personal tool.

---

# 23. Definition of done

I should be able to open the app and:

1. See my active sprint and what matters.
2. Switch between Sprint 1–4.
3. See real skill progress.
4. Pick a useful activity by available time.
5. Ask the app to build a session.
6. Review due vocabulary.
7. Learn curated Core vocabulary.
8. Practice pronunciation.
9. Practice verbs/conjugations.
10. Run deterministic and LLM-generated drills.
11. Practice sentence transformations and Spanish→French translation.
12. Do listening/dictation activities.
13. Open linked workbooks/videos/resources.
14. Study an imported French text without polluting Core SRS.
15. Jump to reference sheets from cards/drills/texts.
16. Take the Sprint 1 mastery test.
17. Continue into Sprint 2 with weak Sprint 1 skills still tracked.
18. Have all results persist.
19. Continue using the app even if the LLM endpoint is temporarily unavailable.

The result should feel like **one coherent French-learning environment**, not a dashboard glued onto disconnected old features.

---

# 24. Final deliverable from you

When implementation is complete, return:

- concise summary of what you implemented
- architecture/data-model changes
- important files/components added
- migrations
- OpenRouter/LLM integration details
- validation/caching strategy
- content seeded for each sprint
- anything intentionally deferred
- recommended next improvements after I have used Sprint 1 for a while

Proceed with the implementation.
