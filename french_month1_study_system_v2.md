# French A0 → B1 Study System — v2
## Month 1 curriculum, exercise design, reference library, learning-method specification, and LLM-assisted practice architecture

**Learner profile:** A0 French; C1 Spanish; native English; Metropolitan/Paris-area French target  
**Long-term target:** functional B1 around May 2027  
**Month 1 target:** establish a pronunciation-first, communication-first foundation that makes later French input, tutoring, reading, and conversation much more productive  
**Study pattern:** irregular but consistent overall; typically 20–30 minutes on many days, occasional skipped days, occasional long sessions  
**Design constraint:** no daily calendar, streak, or “you are behind” logic. Progress is sprint- and mastery-based.

---

# 1. Design philosophy

This should not behave like a conventional beginner course.

The system should optimize for:

1. **Communication from the beginning**
2. **High-frequency, high-combinability language**
3. **Pronunciation and listening before bad habits fossilize**
4. **Aggressive use of Spanish as a bridge**
5. **Fast transition toward French-only input**
6. **Retrieval and generation rather than passive review**
7. **Flexible study sessions rather than fixed daily assignments**
8. **Repeated contact with the same language in varied formats**
9. **Personal relevance and interesting content**
10. **Mastery demonstrated through performance, not completed lessons**

The central principle is:

> **Measure what the learner can understand and produce, not how many minutes, lessons, or streak days have been accumulated.**

A “week” in this document means a **sprint**. A sprint might take five days, eight days, or twelve days. The learner moves forward after meeting its core mastery targets.

---

# 2. Research basis

This curriculum combines several well-supported ideas from second-language acquisition and memory research.

## 2.1 The Four Strands: avoid becoming a flashcard-only learner

Paul Nation’s Four Strands framework separates language learning into:

- meaning-focused input,
- meaning-focused output,
- language-focused learning,
- fluency development.

Nation argues that a well-designed language program should eventually give substantial attention to all four. For an absolute beginner, perfect balance is not practical immediately because the learner does not yet know enough French for much genuinely comprehensible input. Month 1 can therefore start heavier on explicit language-focused study and gradually rebalance.

Suggested design emphasis:

| Sprint | Language-focused learning | Meaning-focused input | Meaning-focused output | Fluency development |
|---|---:|---:|---:|---:|
| 1 | ~45% | ~30% | ~15% | ~10% |
| 2 | ~35% | ~30% | ~20% | ~15% |
| 3 | ~30% | ~30% | ~25% | ~15% |
| 4 | ~25% | ~30% | ~25% | ~20% |

These are **curriculum proportions**, not timers the learner has to obey.

**Practical implication:** every sprint must contain listening/reading, deliberate study, speaking/writing, and some increasingly fast reuse of known language.

Source: Paul Nation, “The Four Strands,” *Innovation in Language Learning and Teaching* (2007).  
https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2007-Four-strands.pdf

---

## 2.2 Spacing and retrieval should drive memory

A 2022 meta-analysis of 48 experiments found medium-to-large benefits of spaced practice for second-language learning, with longer spacing tending to help delayed retention more than short spacing.

The app should therefore separate two ideas:

- **spacing decides when an item returns**
- **exercise variation decides how the item returns**

A word should not appear forever as the same front/back card.

Example progression for **vouloir**:

1. French → recognize Spanish meaning
2. Spanish → recall French lemma
3. Audio → recognize meaning
4. Cloze: *Je ___ partir.*
5. Spanish sentence → French sentence
6. Change person: *Je veux* → *Nous voulons*
7. Negate it
8. Turn it into a question
9. Hear a question containing it and answer orally
10. Use it freely in a micro-conversation

This creates repeated retrieval without mindless repetition.

Source: Kim & Webb, “The Effects of Spaced Practice on Second Language Learning: A Meta-Analysis” (2022).  
https://onlinelibrary.wiley.com/doi/10.1111/lang.12479

---

## 2.3 Repeated encounters matter, especially when engagement changes

A meta-analysis of incidental vocabulary learning found a meaningful positive relationship between number of encounters and vocabulary learning, with results affected by factors such as spacing, engagement, and visual support.

The important design conclusion is not simply “repeat words.” It is:

> **Encounter important words repeatedly in different meaningful contexts.**

A high-value item such as **encore** should appear in:
- an SRS card,
- a sentence,
- a listening clip,
- a text,
- a cloze,
- a dialogue,
- and eventually spontaneous output.

Source: Uchihara, Webb & Yanagisawa, “The Effects of Repetition on Incidental Vocabulary Learning” (2019).  
https://onlinelibrary.wiley.com/doi/full/10.1111/lang.12343

---

## 2.4 Pronunciation begins with perception

The learner explicitly prioritizes pronunciation, so pronunciation cannot be an occasional side exercise.

A 2025 meta-analysis of 79 studies found medium-to-large effects of high-variability phonetic training on L2 speech perception and evidence of retention and some generalization. High variability means that contrasts are heard across different speakers and phonetic contexts rather than memorized from one recording.

This supports an early pronunciation system built around:

- auditory discrimination,
- minimal and near-minimal contrasts,
- multiple voices,
- multiple words and sentence contexts,
- immediate feedback,
- then production.

Month 1 should prioritize the French contrasts and connected-speech features that English and Spanish do not prepare the learner to hear automatically.

Source: Uchihara, Karas & Thomson, “High variability phonetic training: a meta-analysis of L2 perceptual training studies” (2025).  
https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6

---

## 2.5 Spanish should be used as an accelerator

For this learner, Spanish is not interference to eliminate; it is an existing linguistic system that can reduce the cost of acquiring French.

A 2024 experimental study with Spanish-speaking university students learning previously unknown French vocabulary found strong evidence of cross-linguistic assistance, especially for cognates and written similarities. Participants generally found French easier than a typologically distant comparison language and reported that prior Spanish helped substantially.

This does **not** mean that French can simply be “translated from Spanish.” It means that useful structural and lexical parallels should be made explicit while false friends and pronunciation mismatches are deliberately flagged.

Source: Flores-Salgado & Gutiérrez-Koyoc, “Working Memory and Cross-Linguistic Influence on Vocabulary Acquisition” (2024).  
https://www.mdpi.com/2076-3425/14/8/796

### Spanish bridge data for a lexical item

A useful item schema:

```json
{
  "french": "penser",
  "spanish": "pensar",
  "english": "to think",
  "cognate_type": "strong",
  "pattern_fr": "penser que + proposition",
  "pattern_es": "pensar que + oración",
  "pronunciation_warning": "Do not pronounce final -er like Spanish -er.",
  "false_friend": false
}
```

Spanish should be used most heavily in:
- vocabulary mapping,
- grammar comparison,
- translation drills,
- cognate families,
- false-friend warnings,
- explanations of structures.

It should be used **less and less** for ordinary comprehension as French becomes understandable.

---

## 2.6 Formulaic language matters, but not phrasebook memorization

Research on formulaic sequences suggests that learners benefit from building a repertoire of recurring multiword units.

That does **not** justify memorizing hundreds of tourist phrases.

Instead, Month 1 should teach **productive frames** that can generate many utterances:

- *je veux + infinitif*
- *je peux + infinitif*
- *je dois + infinitif*
- *je vais + infinitif*
- *je pense que…*
- *parce que…*
- *est-ce que… ?*
- *il y a…*
- *j’ai besoin de…*
- *je ne sais pas*
- *ça dépend*
- *je viens de + infinitif*

These should be treated as sentence architecture.

Source: Boers & Lindstromberg, review of formulaic sequence instruction (2012).  
https://www.cambridge.org/core/journals/annual-review-of-applied-linguistics/article/abs/experimental-and-intervention-studies-on-formulaic-sequences-in-a-second-language/A2ACDF54604CFAC4443240748360C403

---

## 2.7 CEFR should inform outcomes, not dictate the interface

The CEFR defines proficiency using “can-do” descriptors. This is appropriate for mastery gates because it measures communicative ability rather than course completion.

Month 1 is not expected to produce B1. Its role is to build toward the later B1 target by establishing early A1 abilities and the phonological/lexical foundation for rapid progression.

Official CEFR resources:  
https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors

---

# 3. Month 1 target state

At the end of Sprint 4, the target is approximately:

| Area | Target |
|---|---|
| Core active vocabulary | ~240–300 items |
| Passive / recognition vocabulary | ~350–500+ items |
| High-value verbs | ~20–25 actively usable |
| Pronunciation | reasonable prediction of pronunciation from spelling; major sound contrasts perceptually distinguished |
| Grammar | present, negation, common questions, future proche, introductory passé composé |
| Listening | understand the gist and many details of slow A1 material on familiar topics |
| Speaking | sustain ~5 minutes of constrained basic conversation with pauses |
| Reading | understand short A1 texts without translating every word |
| Writing | produce short connected descriptions/messages using known structures |
| Instruction language | increasingly French-first, with Spanish available as a bridge |
| Metalinguistic knowledge | understands the major differences between French sound/spelling and Spanish sound/spelling |

This is deliberately **not** “finish the A1 textbook.”

---

# 4. Vocabulary strategy

## 4.1 Do not learn a raw top-500 list mechanically

Frequency should be a major input to selection, but not the only criterion.

A word receives higher priority when it is:

- frequent,
- usable in many contexts,
- structurally important,
- common in speech,
- easy to combine with known words,
- relevant to ordinary self-expression,
- useful for comprehending other input,
- especially easy to acquire through Spanish transfer.

A current broad frequency reference is:

James Law & Yvon Le Bras, *A Frequency Dictionary of French: Core Vocabulary for Learners*, 2nd ed. (2026), based on a large modern corpus and organized around 5,000 common word families.  
https://www.routledge.com/A-Frequency-Dictionary-of-French-Core-Vocabulary-for-Learners/Law-LeBras/p/book/9781032741178

### Month 1 vocabulary buckets

**A. Function / glue words**
- pronouns
- articles
- conjunctions
- prepositions
- question words
- negation words
- adverbs
- discourse markers

**B. Core verbs**
High-combinability verbs that generate sentences.

**C. Core adjectives**
good, bad, big, small, new, old, important, possible, different, same, etc.

**D. Core nouns**
Only enough to make ordinary conversation possible:
people, work, place, time, day, thing, language, problem, question, friend, family, city, etc.

**E. Personally useful nouns**
Selected from real life and interests.

**F. Recognition-first cognates**
French words whose Spanish similarity can cheaply expand reading comprehension.

---

## 4.2 Three vocabulary statuses

Every lexical item should have one of these statuses:

### Core
Must be actively retrievable and usable.

### Recognition
Must be understood when seen/heard; production is optional.

### Encountered
Collected from real input. Promoted to Core or Recognition only when worthwhile.

This prevents an interesting but low-value word encountered in a poem from receiving the same review priority as **pouvoir**.

---

## 4.3 Active vs passive mastery

A word can have independent scores:

- **meaning recognition**
- **audio recognition**
- **written production**
- **spoken production**
- **sentence-use confidence**

This is preferable to one binary “known” flag.

Example:

```json
{
  "lemma": "encore",
  "recognition": 0.96,
  "audio_recognition": 0.84,
  "written_recall": 0.72,
  "spoken_recall": 0.58,
  "status": "core"
}
```

The exercise generator can select the weakest dimension.

---

# 5. Verb strategy

Verbs should be learned as **systems and usable frames**, not just tables.

For each core verb, learn:

1. infinitive
2. Spanish equivalent
3. meaning distinctions if needed
4. present-tense forms
5. sound patterns
6. one or two high-frequency sentence frames
7. common complement/preposition
8. past participle when relevant
9. eventually auxiliary and compound tense behavior

### Productive-person priority

All standard forms should be visible, but early production can prioritize:

1. **je**
2. **tu**
3. **on**
4. **vous**
5. **il/elle**
6. **ils/elles**

**nous** should still be recognized and learned, but conversational **on** deserves early emphasis because of its everyday spoken frequency.

---

# 6. Pronunciation syllabus

The goal is not a theatrical “perfect Parisian accent.” The goals are:

- hear meaningful contrasts,
- pronounce common words intelligibly,
- build accurate sound categories,
- predict pronunciation from spelling,
- understand connected speech,
- avoid applying Spanish grapheme rules to French.

## 6.1 High-priority sound areas

### Vowels

Especially:

- /i/ vs /y/ vs /u/
- /e/ vs /ɛ/
- /ø/ vs /œ/
- schwa /ə/
- major nasal vowels /ɑ̃/, /ɔ̃/, /ɛ̃/

### Consonants

Especially:

- /ʁ/
- /ʃ/
- /ʒ/
- /ɲ/
- semivowels /j/, /w/, /ɥ/

### Orthography-to-sound patterns

High-value patterns:

- **ou**
- **u**
- **oi**
- **eau / au**
- **é / -er / -ez**
- **è / ê / ai / ais / ait**
- **eu / œu**
- **ch**
- **j / ge**
- **gn**
- **an / en**
- **on**
- **in / ain / ein**
- common silent final consonants
- final **-ent** in verb forms
- elision

### Connected speech

Introduce early:

- syllable timing/rhythm,
- enchaînement,
- basic liaison,
- elision,
- reduction of **ne** in informal speech,
- the fact that written word boundaries do not map cleanly to heard word boundaries.

### Later / reference-only in Month 1

- detailed liaison classifications,
- *h aspiré* vs *h muet* edge cases,
- regional vowel variation,
- highly colloquial reductions.

These should exist in the reference library without becoming Sprint 1 memorization burdens.

---

# 7. The four Month 1 sprints

# Sprint 1 — Crack the sound system and build the first sentence engine

## Mission

Make French stop looking like opaque spelling.

At the end of the sprint, the learner should:
- understand the basic sound system,
- decode common spellings,
- use the most important subject pronouns,
- ask/answer extremely basic questions,
- create simple sentences with four core verbs,
- recognize enough glue words to begin understanding beginner input.

## Core verbs

1. **être** — ser / estar
2. **avoir** — tener / haber
3. **aller** — ir
4. **faire** — hacer

## Vocabulary target

Approximately **55–65 Core items**, with extra cognates as Recognition items.

Prioritize:

### Pronouns / determiners
- je
- tu
- il
- elle
- on
- nous
- vous
- ils
- elles
- ce / ça
- le / la / les
- un / une / des

### Question words
- qui
- quoi
- où
- quand
- comment
- pourquoi
- quel / quelle

### Glue
- et
- ou
- mais
- parce que
- avec
- sans
- pour
- de
- à
- dans
- sur
- chez

### High-frequency adverbs
- oui
- non
- bien
- mal
- très
- vraiment
- aussi
- ici
- là
- maintenant
- aujourd’hui
- demain
- hier
- toujours
- jamais
- encore
- déjà
- beaucoup
- un peu

### Early conversational frames
- c’est…
- il y a…
- je suis…
- j’ai…
- je vais…
- je fais…
- je ne sais pas
- d’accord
- merci
- bonjour / salut
- pardon / désolé
- comment… ?
- qu’est-ce que… ? (recognition at minimum)

## Grammar

- subject pronouns
- noun gender as a concept
- definite/indefinite articles
- present tense of four core verbs
- **c’est**
- **il y a**
- basic adjective agreement concept
- simple negation **ne…pas**
- recognition that everyday speech frequently drops **ne**
- yes/no intonation questions
- **est-ce que**
- basic question words

## Pronunciation

This is the heaviest pronunciation sprint.

Study:
- core IPA symbols only
- /i y u/
- nasal vowels
- /ʁ/
- /ʃ ʒ ɲ/
- main high-frequency spelling patterns
- silent endings
- elision
- first exposure to liaison

## Input target

Several short beginner inputs where the learner understands the **message**, not every form.

Good candidates:
- TV5MONDE Première classe beginner clips
- French Comprehensible Input A1 absolute beginner material
- very short dialogues from CLE materials

## Output target

- 45–90 second self-introduction
- answer basic personal questions
- produce simple “I am / I have / I go / I do” sentences
- ask at least five useful questions
- repair communication with one or two phrases

## Sprint 1 mastery gate

Suggested pass conditions:

### Vocabulary
- ≥85% recognition on Core items across two separated review sessions
- ≥70% Spanish → French recall on the most important 40–50 items

### Verbs
- present forms understood for all persons
- rapid production of **je / tu / on / vous**
- ≥80% on mixed contextual verb drills

### Pronunciation
- ≥80% on target sound-discrimination items using unseen examples
- reasonable pronunciation of 20 unseen beginner words
- learner can explain the difference between French **u** and **ou**
- learner recognizes nasal-vowel spelling families

### Communication
- 60-second self-introduction
- respond appropriately to ~10 basic spoken questions
- no English required for the rehearsed content

---

# Sprint 2 — Generate useful sentences instead of memorizing phrases

## Mission

Turn a small vocabulary into a much larger set of things the learner can say.

## Add core verbs

5. **vouloir** — querer
6. **pouvoir** — poder
7. **devoir** — deber / tener que
8. **savoir** — saber
9. **dire** — decir
10. **parler** — hablar
11. **penser** — pensar
12. **aimer** — gustar / querer

Also introduce regular **-er** conjugation as a productive system.

## Vocabulary target

Add roughly **65–75 Core items**.

Focus on language for:

- self-description
- work / study
- places
- interests
- people
- everyday plans
- time
- frequency
- opinions
- ability
- desire
- necessity

Increase the number of useful adjectives and adverbs rather than collecting concrete object nouns.

## Grammar / patterns

- regular **-er** present
- modal + infinitive
- **aller + infinitif** (future proche)
- adjective position basics
- possessive determiners
- **à / de / en / chez**
- contractions **au / aux / du / des**
- stronger question formation
- negation with already-known verbs
- *on* as everyday “we”

## Productive frames

- je veux + infinitif
- je peux + infinitif
- je dois + infinitif
- je vais + infinitif
- je sais + infinitif / je sais que…
- je pense que…
- j’aime + noun / infinitive
- je parle + language
- je veux aller à…
- je dois faire…

## Pronunciation

Shift from isolated sounds toward:
- word-level decoding,
- sentence rhythm,
- linking,
- hearing function words in connected speech,
- **tu / tout**, **dessus / dessous** type contrast work where appropriate,
- recognizing sound changes created by liaison.

## Input

Input should now be French-first.

Recommended pattern:
1. listen without text,
2. answer a gist question,
3. listen with French transcript,
4. click Spanish gloss only if needed,
5. listen again.

## Output

- two-minute self-description
- describe plans
- express likes/dislikes
- explain what you want/can/have to do
- basic back-and-forth question answering

## First focused conversation session

A 30–45 minute session can occur in Sprint 2 or early Sprint 3.

It can be with a tutor or fluent partner.

Its purpose is **not** “teach me French.”

Use a narrow brief:

1. 10 minutes pronunciation correction
2. 15 minutes controlled questions using known grammar
3. 10 minutes reformulation/correction
4. record 5–10 recurring errors or useful phrases
5. feed only high-value corrections back into the app

## Sprint 2 mastery gate

- 2-minute unscripted introduction and description of present life
- describe at least three future plans with **aller + infinitif**
- respond to ~20 randomized beginner questions
- distinguish common target vowel contrasts in novel words
- transform affirmative ↔ negative ↔ question sentences
- use at least six of the new verbs in spontaneous answers

---

# Sprint 3 — Add a usable past and improve real-speech comprehension

## Mission

Allow the learner to describe what happened, while beginning to recognize why spoken French sounds different from textbook French.

## Add core verbs

13. **venir** — venir
14. **prendre** — tomar / coger
15. **mettre** — poner
16. **voir** — ver
17. **croire** — creer
18. **comprendre** — comprender / entender
19. **trouver** — encontrar / parecer in some contexts
20. **donner** — dar
21. **demander** — preguntar / pedir
22. **répondre** — responder

## Vocabulary target

Add approximately **65–75 Core items**.

Focus on:
- sequencing,
- time reference,
- experiences,
- actions,
- movement,
- conversation,
- basic evaluation,
- describing what happened.

Useful sequencing/discourse items:
- puis
- après
- avant
- alors
- donc
- d’abord
- enfin
- peut-être
- en fait

## Grammar

### Introduce passé composé

Start with **avoir + past participle** and a small set of high-value verbs.

Map explicitly to Spanish where useful:

- *j’ai travaillé* ↔ *he trabajado / trabajé*
- *j’ai vu* ↔ *he visto / vi*
- *j’ai fait* ↔ *he hecho / hice*

Do not attempt a complete literary treatment of French past tense.

Add a limited introduction to:
- common **être** auxiliary movement verbs as encountered,
- agreement as recognition first,
- past participles of core verbs.

### Introduce

**venir de + infinitif**  
↔ **acabar de + infinitivo**

### Object pronouns

Only the most useful first layer:
- me
- te
- le
- la
- les

Do not let pronoun complexity derail the core sprint.

## Spoken French recognition

Begin teaching **recognition** of ordinary spoken reductions.

Examples of concepts:
- **ne** commonly disappears in speech
- **il y a** may be highly compressed
- common words join across boundaries
- function words can become acoustically weak
- learners cannot expect one visible written word = one clearly separated heard word

The target is listening comprehension, not forced imitation of slang.

## Pronunciation

More sentence-level work:
- liaison recognition
- enchaînement
- weak syllables / schwa
- rhythmic groups
- dictation of short known-vocabulary phrases

## Output

- explain what happened yesterday
- describe a recent activity
- narrate a simple sequence
- ask what another person did
- combine past + present + future in one short response

## Sprint 3 mastery gate

- tell a 2–3 minute story about yesterday / a recent day
- answer follow-up questions
- produce common passé composé forms without constructing each one from scratch
- complete short dictations using mostly known vocabulary
- understand a slow dialogue before viewing its transcript
- identify several examples of linking/reduction in audio

---

# Sprint 4 — Consolidate into a small working language

## Mission

Stop collecting new rules and force existing French to interact.

## Add selected verbs

Choose approximately 5–8 depending on need:

- **vivre**
- **travailler**
- **rester**
- **partir**
- **arriver**
- **passer**
- **commencer**
- **finir**
- **essayer**
- **sentir**

Not all have to become equally productive immediately.

## Vocabulary target

Add roughly **50–65 Core items**, but this is intentionally lighter than the middle sprints.

The extra study time should be spent **connecting and retrieving** existing language.

## Grammar

No large new grammar unit is required.

Consolidate:

### Present
*Je travaille.*

### Near future
*Je vais travailler.*

### Passé composé
*J’ai travaillé.*

Also consolidate:
- questions
- negation
- articles/prepositions
- adjective agreement
- direct object pronouns already introduced

### Imparfait

Optional **recognition-level preview only**, especially if it appears in input.

Do not devote a large Month 1 block to mastering the passé composé/imparfait distinction.

## Fluency development

Sprint 4 should contain more timed reuse.

Examples:
- say the same 60-second story three times with fewer pauses,
- answer 10 known question types quickly,
- 4/3/2-style shortened retelling,
- rapid sentence transformation,
- speed recognition of high-frequency words,
- short shadowing with completely understood text.

## Input

Begin trying slightly less pedagogically controlled French.

The goal is not to understand everything.

Use:
- beginner comprehensible-input videos,
- simple dialogues,
- very short authentic clips if context makes them understandable,
- transcript-assisted listening.

## Output

The learner should now be able to discuss:
- who they are,
- what they do,
- where they live,
- what they like,
- what they can/want/have to do,
- what they are going to do,
- what they recently did,
- simple reasons and opinions.

## Month 1 mastery gate

### Speaking
Sustain approximately five minutes of constrained conversation in French.

Pauses, errors, circumlocution, and requests for repetition are acceptable.

Switching to English because sentence formation is uncomfortable should not be the default escape.

### Reading
Read a new A1 passage aloud with reasonable decoding, then explain its meaning.

### Listening
Listen to a short slow beginner clip:
1. without transcript,
2. report gist,
3. answer basic comprehension questions,
4. listen with transcript,
5. identify previously missed words.

### Writing
Write ~100–150 words about self, current life, recent activity, and future plans.

### System mastery
Demonstrate usable control over:
- ~240–300 Core words,
- ~20–25 key verbs,
- basic pronunciation rules,
- present / near future / introductory past,
- questions and negation.

---

# 8. Activity taxonomy

The app should contain many exercise types, but they should all draw from the same sprint content.

An activity can be selected by:
- time available,
- skill,
- input/output preference,
- device context,
- weakest mastery dimension,
- random variety.

## 8.1 Lexical retrieval

### A. Recognition
French → Spanish meaning.

Use mainly for new items.

### B. Production
Spanish → French.

Harder and more useful for active vocabulary.

### C. Audio recognition
Hear French → select or recall meaning.

### D. Audio production cue
Hear Spanish or a French definition → say French aloud.

### E. Cloze
*Je ___ partir maintenant.*

### F. Context selection
Choose which target word fits a short dialogue.

### G. Semantic contrast
Distinguish two close words.

Example:
- *savoir* vs *connaître* later
- *voir* vs *regarder*
- *écouter* vs *entendre*

---

# 8.2 Sentence transformation drills

This should be one of the app’s central systems.

A base sentence is transformed along one dimension at a time.

Example base:

**Je veux travailler demain.**

Possible transformations:

### Person
- Tu…
- Elle…
- Nous…
- Ils…

### Polarity
- Make it negative.

### Time
- Change tomorrow → today / yesterday.

### Tense / construction
- Present intention → future proche.
- Later, past.

### Question
- Ask whether the person wants to work.

### Modality
- want → can → must

### Object
- replace a noun with a pronoun

### Translation direction
- Spanish → French
- French → Spanish
- audio French → spoken French response

### Prompt form
- typed
- multiple choice
- reorder blocks
- oral
- dictation

This lets one small pool of language generate a large amount of varied practice.

---

# 8.3 “Translation ladder”

A particularly useful Spanish-bridge exercise.

Example:

1. **Quiero ir.**
2. produce: *Je veux aller.*
3. **No quiero ir.**
4. produce: *Je ne veux pas aller.*
5. **¿Quieres ir?**
6. produce: *Tu veux aller ? / Est-ce que tu veux aller ?*
7. **Queremos ir mañana.**
8. produce equivalent.

The same construction is explored structurally rather than memorized once.

---

# 8.4 Minimal-pair / sound discrimination

Possible formats:

### AB choice
Hear one item and choose A or B.

### AX
Hear a model, then decide whether the second item matches.

### Odd-one-out
Hear three items, identify the different vowel.

### Grapheme prediction
See a word and choose likely sound.

### Sound → spelling
Hear a target sound/word and select spelling.

### Multi-speaker variation
Use multiple speakers whenever possible.

The drill should mix:
- trained words,
- untrained words,
- different positions,
- different voices.

That tests sound-category learning rather than memorized recordings.

---

# 8.5 Pronunciation production

### Listen → record → compare
Play model, record learner, replay both.

### Delayed repeat
Audio disappears before learner repeats, forcing phonological memory.

### Read unseen word
Tests spelling-to-sound decoding.

### Sentence rhythm
Mark rhythmic groups and read.

### Shadowing
Use only when meaning is already fully understood.

Shadowing incomprehensible audio is low-value mimicry.

---

# 8.6 Dictation

Extremely useful because it combines:

- auditory segmentation,
- spelling,
- morphology,
- function-word perception.

Difficulty progression:

1. isolated known words
2. short known phrases
3. one sentence
4. two linked sentences
5. short dialogue excerpt

Allow:
- replay,
- slow mode sparingly,
- transcript reveal after attempt,
- highlighted error comparison.

---

# 8.7 Listening ladder

Every short clip can create several activities:

1. **Listen once — gist only**
2. choose topic
3. listen again — details
4. answer questions
5. fill missing words
6. reveal transcript
7. click unknown items
8. listen while reading
9. hide transcript and listen again
10. optionally retell or respond

Do not show text before the first listen by default.

---

# 8.8 Micro-dialogues

Generate short branching conversations around known vocabulary.

Example:

> — Tu travailles aujourd’hui ?  
> — ___

Possible learner goals:
- answer affirmatively,
- answer negatively,
- add a reason,
- ask a follow-up.

The generator should not care about producing one exact sentence if multiple known-language answers are valid.

---

# 8.9 Story reconstruction

Given 4–8 short events, learner:
- orders them,
- listens to the original,
- retells using connectors.

Excellent for:
- sequence language,
- past tense,
- listening,
- output.

---

# 8.10 “Same meaning, different form”

Show or play two sentences and ask whether they communicate effectively the same meaning.

This is useful for:
- pronouns,
- question forms,
- *on* vs *nous*,
- formal vs conversational variants,
- negative forms.

---

# 8.11 Cognate mining

Give a short French paragraph containing several Spanish-transparent cognates.

Task:
- infer meanings before translation,
- mark confidence,
- reveal Spanish equivalents,
- flag pronunciation mismatches.

Purpose:
teach the learner to exploit Spanish automatically without assuming spelling = pronunciation.

---

# 8.12 False-friend traps

Occasional contrast tasks should explicitly target interference.

These should be rare enough not to create paranoia, but memorable enough to prevent recurring mistakes.

The learner’s personal mistakes can automatically populate a **Spanish Interference** deck.

---

# 8.13 Timed fluency rounds

Only use known language.

Examples:
- 10 rapid personal questions
- 60-second topic response
- retell same story in 60 sec → 45 sec → 30 sec
- rapid conjugation in a sentence context
- rapid audio recognition

Fluency work should reduce retrieval latency, not introduce new content.

---

# 8.14 Text mining

The existing text system is especially valuable.

For every imported text:

- clickable word/phrase
- audio playback
- French definition eventually
- Spanish equivalent
- grammar / conjugation lookup
- add to Encountered deck
- “promote to Core” manually
- notes
- sentence extraction

Possible workflow:

1. read for gist without clicking everything,
2. mark only words blocking comprehension,
3. revisit marked language,
4. re-read,
5. listen if audio exists,
6. optionally generate exercises from selected sentences.

Avoid turning reading into dictionary lookup line by line.

---

# 9. Exercise generation rules

AI-generated exercises can become repetitive, unnatural, or accidentally too difficult. Generation needs constraints.

## 9.1 Vocabulary coverage rule

A generated exercise should be approximately:

- **85–95% known language**
- plus the intended target item(s)

Do not introduce five unknown words merely to practice one verb.

---

## 9.2 One-primary-difficulty rule

Most drills should manipulate **one main difficulty**.

Bad:
- new vocabulary + new tense + unfamiliar pronoun + complex idiom.

Better:
- known vocabulary + one new tense,
or
- known grammar + one new lexical item.

This keeps errors diagnostically meaningful.

---

## 9.3 Sentence-naturalness rule

Generated French should be:
- idiomatic,
- short,
- plausible,
- Metropolitan French by default,
- conversational unless the exercise explicitly targets formal writing.

Do not create textbook nonsense just because a grammatical form fits.

---

## 9.4 Personal-interest rotation

Exercise content should rotate through contexts such as:

- ordinary daily life,
- work/study,
- travel,
- relationships/friends,
- culture/media,
- sports/hobbies,
- technology,
- plans,
- opinions.

The learner can define preferred domains.

The same grammar should appear in multiple domains so it does not become context-bound.

---

## 9.5 Novelty rule

Do not repeat the exact same sentence excessively.

A learned item should return through:
- different subjects,
- different complements,
- different modalities,
- audio,
- reading,
- dialogue,
- translation,
- free response.

---

## 9.6 Error recycling

Mistakes should become future exercises.

If the learner repeatedly writes:

> *je suis 24 ans*

the system should create later contrasts around:
- *j’ai 24 ans*
- Spanish *tengo 24 años*
- other **avoir** expressions.

But it should not immediately spam ten identical corrections.

Schedule the error for spaced recycling.

---

## 9.7 Confidence-aware difficulty

If an item is weak:
- provide more context,
- recognition,
- partial cues.

If an item is strong:
- remove cues,
- require production,
- add speed,
- place it in free composition.

---

# 10. Making the exercises interesting

The system should avoid gamification for its own sake. No arbitrary coins, XP, or mascots are needed.

Interest should come from **meaning, variety, and visible skill growth**.

## 10.1 Use micro-content rather than random word categories

Instead of “learn kitchen vocabulary,” use:

> You are explaining what you did this morning.

Only introduce nouns needed to communicate that idea.

Concrete vocabulary enters because the learner encounters or needs it, not because a beginner syllabus says “Week 4: vegetables.”

---

## 10.2 Generate mini situations

Examples:

- explain why you cannot do something tonight
- tell someone what you did yesterday
- ask a stranger where something is
- disagree politely
- describe what you are going to do this weekend
- tell a friend what you think about something
- explain a simple work problem
- plan a trip
- react to a short message

Each situation can have:
- listening,
- comprehension,
- sentence-building,
- spoken response.

---

## 10.3 Controlled randomness

The app should have a “Surprise me” mode, but randomness should occur **within the active sprint syllabus**.

Do not let random generation introduce arbitrary B2 vocabulary.

---

## 10.4 Multiple valid answers

Where possible, output exercises should accept multiple natural answers.

For free production:
- compare meaning,
- grammar,
- target construction,
- pronunciation separately.

Do not punish a correct response for differing from a single answer key.

---

## 10.5 Short real-world media fragments

As comprehension improves, link exercises to:
- a 20-second clip,
- a headline,
- a short dialogue,
- a social post,
- a simple paragraph.

The goal is to create frequent moments of:

> “I can actually understand this now.”

That is more motivating than abstract progress points.

---

# 11. Flexible activity bank

The dashboard should not say:

> Tuesday: complete grammar chapter 3.

Instead it should offer tasks tagged by duration.

## 5-minute activities

- due SRS
- 10 audio-recognition cards
- one minimal-pair set
- five rapid sentence transformations
- short dictation
- 5-question speed round
- one pronunciation target

## 10–15 minute activities

- focused vocabulary acquisition
- one pronunciation lesson
- short listening ladder
- workbook subsection
- micro-dialogue set
- translation ladder
- one short text

## 20–30 minute activities

- grammar concept + generated drills
- full beginner listening lesson
- pronunciation training + recording
- reading + text mining
- controlled speaking session
- mixed review

## Deep session: 45–120+ minutes

- several workbook chapters
- tutor / partner session
- extended input session
- text study
- sprint mastery test
- app/content maintenance
- create or clean a reference sheet
- review weak areas discovered by analytics

Long sessions should simply complete more sprint objectives. Missing a day should never create a backlog of dated tasks.

---

# 12. Progress and mastery model

Progress bars should measure **mastery state**, not checked boxes alone.

Suggested sprint dimensions:

- Vocabulary
- Core Verbs
- Pronunciation
- Grammar / Patterns
- Listening
- Reading
- Speaking
- Writing (can be de-emphasized visually in Sprint 1)

Possible weighting can change per sprint.

Example:

### Sprint 1
- Pronunciation: 25%
- Vocabulary: 20%
- Verbs: 20%
- Grammar: 15%
- Listening: 10%
- Speaking: 10%

### Sprint 4
- Vocabulary: 20%
- Grammar/verbs: 20%
- Listening: 20%
- Speaking: 20%
- Reading: 10%
- Pronunciation: 10%

The learner should be allowed to enter a later sprint while one earlier dimension is imperfect, but the dashboard should visibly retain weak carry-over skills.

---

# 13. External resource stack

Keep the stack small. External resources should supplement the hub rather than become competing curricula.

## 13.1 Primary pronunciation workbook

### CLE International — *Phonétique progressive du français, niveau débutant*

Why:
- A1-oriented,
- 56 chapters,
- progressive,
- designed for self-study/class use,
- recorded exercises,
- exercises plus communicative activities.

Use:
- Sprint 1 heavily,
- then targeted chapters based on weak sounds.

Official page:  
https://progressive.cle-international.com/9782090384550

---

## 13.2 Primary grammar workbook

### CLE International — *Grammaire progressive du français, niveau débutant A1*

Why:
- adult learner focus,
- 60 A1 grammar chapters,
- explanation + practice,
- approximately 250 interactive exercises in current edition,
- self-correcting tests and audio-supported communicative material.

Do **not** proceed front-to-back mechanically.

The app’s sprint should link directly to the relevant chapter/topic.

Official page:  
https://www.cle-international.com/grammaire-progressive-du-francais-niveau-debutant-a1-livre-audio-telechargeable-appli-web-9782090398502

---

## 13.3 Beginner video/exercise bank

### TV5MONDE — Apprendre le français / Première classe

Why:
- designed for absolute beginners,
- 500+ exercises,
- A1 material has multilingual support including Spanish,
- subtitles/transcripts and translated beginner support,
- useful on phone.

Use:
- as an optional activity source,
- not as the master curriculum.

Info:  
https://support-apprendre.tv5monde.com/fr/support/solutions/articles/61000298788-par-o%C3%B9-commencer-

---

## 13.4 French-only comprehensible input

### French Comprehensible Input

Why:
- explicit absolute-beginner/A1 playlists,
- French is presented in context,
- useful for the desired early transition toward French-only comprehension.

Beginner page:  
https://sites.google.com/view/frenchcomprehensibleinput/beginners

YouTube absolute-beginner example:  
https://www.youtube.com/watch?v=c2SUQVjklVA

### Alice Ayel — optional second source

Story-based comprehensible input with material designed for very early learners.

Site:  
https://www.aliceayel.com/

Use one source consistently at first rather than collecting ten channels.

---

## 13.5 Pronunciation in real speech

### YouGlish French

Search a word/phrase and hear it in many real YouTube clips.

Especially useful for:
- multiple speakers,
- connected speech,
- checking whether a pronunciation learned in isolation matches real usage.

https://youglish.com/french

### Forvo French

Native-speaker word/phrase recordings.

Useful for:
- lexical pronunciation,
- comparing multiple speakers.

https://forvo.com/languages/fr/

Neither should be treated as the sole phonetic authority; use them as exposure and examples.

---

## 13.6 Later listening resource

### RFI — Le français facile / Journal en français facile

RFI provides a daily approximately 10-minute news program with transcription and learning support.

This will probably be too difficult to use efficiently at literal A0, but it should be stored as a **later A2/B1 resource**, not forgotten.

RFI information brochure:  
https://s.francaisfacile.rfi.fr/media/display/492a1bbe-2e52-11ef-8329-005056a90284/RFI_fran%C3%A7ais_facile_BROCHURE_210x210-HD-PourAffichageEcran.pdf

---

# 14. Evergreen reference library for the app

Yes: the app should contain a small permanent **French reference library**.

These are not “lessons to complete.” They are reusable pages that can be opened from multiple locations.

The coding agent should eventually store them as first-class content and allow deep links to specific sections.

## Reference 01 — Pronunciation Master Sheet

**Filename suggestion:** `reference/pronunciation-master.md`

Contents:

1. compact French IPA inventory relevant to the learner
2. mouth-position notes
3. /i y u/ comparison
4. oral vs nasal vowels
5. /ø œ ə/
6. French R
7. semivowels
8. common grapheme → sound mappings
9. silent final-letter patterns
10. final verb **-ent**
11. elision
12. liaison
13. enchaînement
14. schwa
15. rhythmic groups
16. *h muet* vs *h aspiré* reference
17. Spanish pronunciation traps
18. minimal-pair examples
19. audio links / generated playback

This should be accessible from:
- Wiki → Pronunciation
- pronunciation drills
- vocabulary cards
- text annotations
- mastery-test feedback

---

## Reference 02 — French Spelling → Sound Decoder

**Filename:** `reference/spelling-to-sound.md`

A quick-scanning sheet organized around spellings:

- ou
- u
- oi
- eau
- au
- ai
- ais
- ait
- é
- er
- ez
- eu
- œu
- an/en
- on
- in/ain/ein
- gn
- ch
- j/ge
- ill
- final consonants

This page should be shorter than the full pronunciation master sheet.

It is the page to open while trying to read an unfamiliar French word.

---

## Reference 03 — Spanish → French Transfer Map

**Filename:** `reference/spanish-french-transfer.md`

This could become one of the most valuable pages in the entire site.

Sections:

### Structural parallels
- future proche ↔ *ir a + infinitivo*
- venir de ↔ *acabar de + infinitivo*
- modal + infinitive
- gender/agreement
- compound past parallels
- subjunctive later
- object-pronoun parallels later

### Common lexical/cognate correspondences
List recurring patterns, carefully labeled as tendencies rather than absolute rules.

### Pronunciation traps
Words that look obvious from Spanish but sound very different.

### False friends
Only useful/high-frequency items.

### “Same concept, different structure”
Examples where Spanish transfer creates errors.

This should grow based on actual learner mistakes.

---

## Reference 04 — Core Verb Atlas

**Filename:** `reference/core-verbs.md`

Not simply a conjugation table.

For every core verb:

- meaning
- Spanish equivalent(s)
- pronunciation/audio
- present forms
- past participle
- auxiliary
- high-value constructions
- example sentence
- common collocations
- irregular pattern family
- relevant prepositions

The existing conjugation page can be the interactive implementation of this reference.

---

## Reference 05 — Sentence Architecture

**Filename:** `reference/sentence-architecture.md`

Quick visual reference for:

- basic SVO order
- adjective placement basics
- negation
- question structures
- modal + infinitive
- future proche
- passé composé
- object pronoun position
- adverb placement basics

Use arrows/blocks more than prose.

---

## Reference 06 — Questions & Conversation Repair

**Filename:** `reference/questions-repair.md`

High-frequency:

- qui
- quoi
- où
- quand
- pourquoi
- comment
- combien
- quel
- intonation questions
- est-ce que
- qu’est-ce que

Repair language:

- Pardon ?
- Tu peux répéter ?
- Vous pouvez répéter ?
- Plus lentement, s’il te plaît.
- Qu’est-ce que ça veut dire ?
- Comment on dit ___ en français ?
- Je ne comprends pas.
- Je veux dire…
- Je ne sais pas encore.

These are “phrases,” but they directly enable communication and therefore deserve early memorization.

---

## Reference 07 — Articles, Gender & Prepositions

**Filename:** `reference/articles-prepositions.md`

Include:

- le / la / les
- un / une / des
- partitives later
- à / de
- au / aux
- du / des
- en
- chez
- country/city basics later
- gender heuristics clearly labeled as heuristics

---

## Reference 08 — Tense / Time Map

**Filename:** `reference/tense-map.md`

Visually map French to Spanish:

### Present
*je travaille* ↔ *trabajo*

### Near future
*je vais travailler* ↔ *voy a trabajar*

### Passé composé
*j’ai travaillé* ↔ *he trabajado / trabajé* depending context

### Recent past
*je viens de travailler* ↔ *acabo de trabajar*

### Imparfait
Add later when taught.

The point is conceptual orientation, not exhaustive conjugation.

---

## Reference 09 — Pronoun Map

**Filename:** `reference/pronouns.md`

Month 1:
- subject pronouns
- tonic pronouns as encountered
- direct objects: me/te/le/la/les

Later:
- indirect objects
- y
- en
- pronoun chains

This page should grow with the curriculum rather than exposing all complexity on day one.

---

## Reference 10 — Spoken French Decoder

**Filename:** `reference/spoken-french.md`

Purpose: explain why heard French differs from careful written French.

Eventually include:

- dropped *ne*
- liaison
- enchaînement
- schwa loss
- common contractions/reductions
- *on* vs *nous*
- frequently heard colloquial forms
- formal vs neutral vs casual register

Month 1 should show only the first few essentials.

---

## Reference 11 — Numbers, Time & Dates

**Filename:** `reference/numbers-time.md`

This is worth a reusable reference rather than forcing the learner to master all number complexity in one session.

Include:
- 0–100
- higher-number construction
- dates
- clock time
- days/months
- frequency language
- common time phrases

---

## Reference 12 — Personal Interference Log

**Filename:** dynamic, not static

A learner-specific table:

| Error | Correct | Spanish source | Explanation | Next review |
|---|---|---|---|---|

Examples should be generated from actual mistakes.

This can become one of the highest-value personalized components over time.

---

# 15. How reference content should be linked

Reference pages should not live in an isolated Wiki that the learner forgets exists.

Use deep links from:

### Vocabulary card
“Why does this sound like that?” → pronunciation subsection

### Drill feedback
“You placed the object pronoun incorrectly.” → pronoun-position section

### Conjugation
Link to tense concept.

### Text annotation
Click a structure → reference.

### Sprint dashboard
Show “Reference” links beside active targets.

### Search
Global search should search:
- reference pages,
- verbs,
- vocabulary,
- imported texts.

### Mastery test
Incorrect answer feedback should point to the relevant reference section.

The long-term goal is for the app to become a **personal French knowledge base**, not just an SRS interface.

---

# 16. Reference-page design principle

Reference pages should be:

- compact,
- visual,
- example-heavy,
- searchable,
- linkable at heading level,
- audio-enabled where pronunciation matters,
- bilingual only when Spanish comparison adds real value.

Avoid long beginner textbook prose.

A reference should answer:

> “I forgot how this works; show me in 20 seconds.”

The longer academic explanation can exist behind an expandable “More” section if useful.

---

# 17. Suggested structured content schema

A generic learning object can look like:

```json
{
  "id": "fr_vouloir",
  "type": "lexeme",
  "french": "vouloir",
  "spanish": "querer",
  "english": "to want",
  "part_of_speech": "verb",
  "priority": 1,
  "status": "core",
  "sprint": 2,
  "frequency_band": "very_high",
  "ipa": "/vulwaʁ/",
  "audio": true,
  "cognate_type": "none",
  "false_friend": false,
  "patterns": [
    {
      "fr": "vouloir + infinitif",
      "es": "querer + infinitivo"
    }
  ],
  "examples": [
    {
      "fr": "Je veux partir.",
      "es": "Quiero irme."
    }
  ],
  "reference_links": [
    "core-verbs#vouloir",
    "sentence-architecture#modal-infinitive"
  ],
  "tags": ["month1", "sprint2", "core-verb", "modal"]
}
```

Activity templates then consume these objects rather than storing separate hard-coded copies of the same language.

---

# 18. Suggested activity object

```json
{
  "id": "s2_transform_modal_01",
  "sprint": 2,
  "skill": ["grammar", "speaking"],
  "format": "sentence_transform",
  "duration_minutes": 8,
  "targets": ["vouloir", "negation", "present"],
  "known_vocab_threshold": 0.9,
  "mode": "spanish_to_french",
  "difficulty": 2,
  "generator": {
    "template_family": "modal_infinitive",
    "transformations": ["person", "polarity", "question"]
  },
  "mastery_effect": {
    "verbs": 0.4,
    "grammar": 0.4,
    "speaking": 0.2
  }
}
```

The first implementation does not need generalized infrastructure for everything. Sprint content can be hardcoded while the data format remains consistent enough to expand later.

---

# 19. What should be hardcoded vs dynamic initially

## Good to hardcode sprint-by-sprint

- target vocabulary
- target verbs
- target grammar
- target pronunciation concepts
- resource links
- mastery requirements
- reference-page sections
- a curated set of good example sentences
- a curated first set of minimal pairs

## Good to generate dynamically

- sentence transformations
- cloze variants
- Spanish→French prompts
- person/tense/polarity variations
- micro-dialogue variants
- review mixes
- text questions
- targeted error recycling
- contextual example sentences
- practice based on weakest mastery dimension

Do not delegate the **curriculum sequence** itself to random AI generation.

The curriculum should be curated; practice can be generative.

---

# 20. What not to build yet

Avoid feature creep before actual French study exposes a need.

Do not prioritize:

- social functionality
- leaderboards
- streak systems
- elaborate achievements
- huge generic dictionary duplication
- full CEFR curriculum engine
- automatic scraping of thousands of lessons
- every tense/conjugation at once
- a fully featured open-ended tutor chatbot before the core exercise system works
- authoritative-sounding CEFR or accent scoring that the system cannot genuinely support
- LLM calls for deterministic tasks that can be handled cheaply and reliably in code

Start with:

1. sprint dashboard
2. structured content import
3. SRS
4. varied deterministic drill engine
5. a shared learner-context layer for LLM use
6. constrained LLM-generated drills that output validated structured data
7. text annotation
8. pronunciation reference
9. core reference library
10. progress/mastery calculations
11. optional adaptive session composition once enough learner-state data exists

Then learn French with it and iterate.

The first LLM features should make the existing learning system more varied and adaptive; they should not replace the curriculum or become the product's organizing principle.

---

# 21. Sprint dashboard content model

Each sprint dashboard can vary slightly.

Core sections:

## Sprint header
- sprint number/name
- short mission
- optional target window
- previous / next sprint

## Progress overview
- vocabulary
- verbs
- pronunciation
- grammar
- listening
- speaking
- reading where relevant

## “Do something now”
Activity bank with:
- 5 min
- 15 min
- 30 min
- deep session

Skill filters:
- vocabulary
- pronunciation
- grammar
- listening
- reading
- speaking

## Current sprint targets
Checklist/progress:
- learn X core words
- master X verbs
- complete pronunciation targets
- understand grammar patterns
- pass listening checks
- pass output checks

## Mastery test
- readiness %
- requirements
- start test
- previous attempts
- weak areas

## Quick actions
- Review due
- Start mixed drill
- Open current text
- Core verbs
- Pronunciation
- Reference
- Add/import material

---

# 22. A good default study session

The system should **suggest**, not require, a compact mixed session.

Example 25-minute session:

1. **5 min** due retrieval
2. **7 min** active sprint skill
3. **8 min** listening/reading
4. **5 min** output

But the user can ignore this and choose any activity.

A longer session can repeat the cycle rather than becoming a single 90-minute grammar block.

---

# 23. Tutor / fluent-partner integration

The learner’s fluent partner is a bonus, not a required daily component.

For deliberate sessions, the app should generate a simple briefing:

## Session brief
**Known vocabulary:** [list]  
**Known grammar:** [list]  
**Target sounds:** [list]  
**Conversation themes:** [list]  
**Please correct:** pronunciation + major grammar only  
**Do not overcorrect:** tiny style issues outside level

Afterward, record:

- recurring error
- useful natural reformulation
- pronunciation issue
- new high-value word

Only high-value corrections should become study items.

This prevents a conversation session from dumping 30 random new expressions into the deck.

---

# 24. Month 1 assessment philosophy

The learner should never fail a sprint because of one arbitrary numeric threshold.

Use a **profile**.

Example:

- vocabulary: strong
- verbs: strong
- pronunciation: adequate
- listening: weak
- speaking: adequate

The learner may begin Sprint 2 while carrying “listening” as an active weak area.

The system should then preferentially surface listening activities.

This is more useful than locking the next sprint behind 100% completion.

---

# 25. Proposed Month 1 content quantities

These are intentionally approximate.

| Sprint | New Core vocab | New core verbs | Main grammar | Pronunciation emphasis |
|---|---:|---:|---|---|
| 1 | 55–65 | 4 | sentence basics, questions, negation | phoneme categories + spelling |
| 2 | 65–75 | ~8 | regular -er, modals, future proche | word/sentence decoding |
| 3 | 65–75 | ~10 | passé composé, recent past, basic objects | connected speech + dictation |
| 4 | 50–65 | 5–8 selected | consolidation | fluency + real speech |
| **Total** | **235–280** | **~20–25 active** | | |

Recognition vocabulary should exceed Core vocabulary because Spanish cognates and input will make many additional items understandable before they are actively produced.

---

# 26. What should happen after Month 1

Month 2 should shift toward:

- regular conversation/tutoring,
- larger amounts of comprehensible input,
- graded reading,
- broader everyday vocabulary,
- deeper passé composé,
- imparfait,
- object pronouns,
- more spontaneous output,
- increased French-only instruction.

The app should gradually stop feeling like a beginner study tool and increasingly become a place to:

- consume,
- annotate,
- retrieve,
- practice,
- and create French.

By B1, much of the learning should originate in real French content rather than a predetermined vocabulary syllabus.

---

# 27. Research and resource bibliography

## Curriculum / SLA

**Nation, P. (2007). The Four Strands.**  
Framework balancing meaning-focused input, meaning-focused output, deliberate language study, and fluency development.  
https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2007-Four-strands.pdf

**Kim, S. K., & Webb, S. (2022). The Effects of Spaced Practice on Second Language Learning: A Meta-Analysis.**  
48 experiments; supports spaced practice for L2 retention.  
https://onlinelibrary.wiley.com/doi/10.1111/lang.12479

**Uchihara, T., Webb, S., & Yanagisawa, A. (2019). The Effects of Repetition on Incidental Vocabulary Learning: A Meta-Analysis.**  
Supports repeated encounters, with effects moderated by engagement and learning conditions.  
https://onlinelibrary.wiley.com/doi/full/10.1111/lang.12343

**Uchihara, T., Karas, M., & Thomson, R. I. (2025). High Variability Phonetic Training: A Meta-Analysis.**  
79 studies; supports varied perceptual phonetic training.  
https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/high-variability-phonetic-training-hvpt-a-metaanalysis-of-l2-perceptual-training-studies/6ABB8C1F32D88D53EA8D05A4565E76F6

**Flores-Salgado, E., & Gutiérrez-Koyoc, A. F. (2024). Working Memory and Cross-Linguistic Influence on Vocabulary Acquisition.**  
Includes Spanish-speaking learners acquiring French and supports exploiting typological/cognate overlap.  
https://www.mdpi.com/2076-3425/14/8/796

**Boers, F., & Lindstromberg, S. (2012). Experimental and Intervention Studies on Formulaic Sequences in a Second Language.**  
Review supporting deliberate attention to useful recurring multiword sequences.  
https://www.cambridge.org/core/journals/annual-review-of-applied-linguistics/article/abs/experimental-and-intervention-studies-on-formulaic-sequences-in-a-second-language/A2ACDF54604CFAC4443240748360C403

**Council of Europe — CEFR descriptors and Companion Volume.**  
Official communicative “can-do” framework.  
https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors

## Lexical frequency

**Law, J., & Le Bras, Y. (2026). A Frequency Dictionary of French: Core Vocabulary for Learners, 2nd ed.**  
Modern 5,000-word-family frequency reference.  
https://www.routledge.com/A-Frequency-Dictionary-of-French-Core-Vocabulary-for-Learners/Law-LeBras/p/book/9781032741178

## Learning resources

**CLE — Phonétique progressive du français, débutant.**  
https://progressive.cle-international.com/9782090384550

**CLE — Grammaire progressive du français, débutant A1.**  
https://www.cle-international.com/grammaire-progressive-du-francais-niveau-debutant-a1-livre-audio-telechargeable-appli-web-9782090398502

**TV5MONDE — Première classe / beginner French.**  
https://support-apprendre.tv5monde.com/fr/support/solutions/articles/61000298788-par-o%C3%B9-commencer-

**French Comprehensible Input — Beginner playlists.**  
https://sites.google.com/view/frenchcomprehensibleinput/beginners

**Alice Ayel — French the Natural Way.**  
https://www.aliceayel.com/

**YouGlish French.**  
https://youglish.com/french

**Forvo French pronunciation dictionary.**  
https://forvo.com/languages/fr/

**RFI — Le français facile / Journal en français facile.**  
https://s.francaisfacile.rfi.fr/media/display/492a1bbe-2e52-11ef-8329-005056a90284/RFI_fran%C3%A7ais_facile_BROCHURE_210x210-HD-PourAffichageEcran.pdf

---

# 28. Immediate next content work

Before treating the dashboard as complete, the study content and AI contracts should be concretized in this order:

1. **Sprint 1 Core vocabulary dataset**
2. **Sprint 1 verb dataset**
3. **Pronunciation Master Sheet**
4. **Spelling → Sound Decoder**
5. **Spanish → French Transfer Map, v1**
6. **Sprint 1 pronunciation exercise bank**
7. **Sprint 1 deterministic drill templates**
8. **Structured schema for LLM-generated drills**
9. **Learner-context payload schema**
10. **Sprint 1 external-resource links**
11. **Sprint 1 mastery test**
12. **Adaptive session-composer contract**
13. then repeat the curriculum/content process for Sprints 2–4

The curriculum and reference pages are the source of truth. The coding agent should implement them, not ask an LLM to invent the learning sequence.

---

# 29. LLM-assisted learning architecture

The site already has access to OpenRouter and can use a model such as DeepSeek. LLMs can add substantial value, but only when they sit **on top of the structured curriculum and learner model**.

The architectural rule is:

> **Curriculum + learner state + deterministic constraints → LLM**

not:

> **LLM → decides what the learner should learn**

The curriculum, vocabulary status, grammar sequence, pronunciation sequence, and mastery requirements should remain curated and inspectable.

The LLM is best used for:
- variation,
- contextualization,
- adaptive selection,
- explanation,
- error analysis,
- and generating fresh practice inside known boundaries.

---

## 29.1 Shared learner-context builder

Create one reusable server-side mechanism that can produce a compact learning-state payload for any AI feature.

Possible fields:

```json
{
  "active_sprint": 2,
  "bridge_language": "es",
  "target_variant": "fr-FR",
  "core_vocab_known": ["être", "avoir", "aller"],
  "core_vocab_learning": ["vouloir", "pouvoir"],
  "recognition_vocab": [],
  "known_grammar": ["present", "basic_negation", "est_ce_que"],
  "target_grammar": ["modal_infinitive", "future_proche"],
  "known_verbs": ["être", "avoir", "aller", "faire"],
  "target_verbs": ["vouloir", "pouvoir"],
  "pronunciation_targets": ["/y_vs_u/"],
  "recent_errors": [],
  "weak_dimensions": ["audio_recognition"],
  "due_review_count": 14
}
```

Do not send all user data or the entire database to every call.

The context should be task-specific and compact.

---

## 29.2 Structured-output rule

Learning-related LLM calls should normally return validated structured data.

Do not make core app logic depend on parsing arbitrary prose.

For a generated drill, require fields such as:

```json
{
  "exercise_type": "sentence_transform",
  "target_ids": ["fr_vouloir"],
  "instructions": "Change the sentence to the negative.",
  "prompt": "Je veux partir.",
  "accepted_answers": ["Je ne veux pas partir."],
  "explanation_es": "La negación rodea al verbo conjugado: ne + veux + pas.",
  "difficulty": 2,
  "new_language": []
}
```

Validate:
- required fields,
- valid exercise type,
- target belongs to active curriculum,
- answer is present,
- no excessive unknown vocabulary,
- requested construction is actually present.

Invalid generations should be retried or discarded.

---

## 29.3 LLM-generated drill engine

This is the highest-value initial LLM feature.

The user chooses or the system supplies:
- exercise type,
- active sprint,
- target vocabulary,
- target verb/grammar,
- desired count,
- difficulty,
- learner state.

The LLM generates fresh exercises inside those boundaries.

Best initial formats:
1. Spanish → French
2. cloze
3. sentence transformation
4. translation ladder
5. contextual vocabulary choice
6. micro-dialogue
7. error correction
8. short reading + comprehension

The generated exercises must obey the existing exercise-generation principles:

- ~85–95% known language,
- one primary difficulty,
- France French,
- natural sentences,
- varied contexts,
- no arbitrary advanced vocabulary.

LLM output should feed the **same activity/result schema** as deterministic exercises, so mastery tracking does not care whether an exercise was static, algorithmic, or model-generated.

---

## 29.4 Cache useful generated material

Fresh generation is useful, but constant regeneration is wasteful.

A generated exercise can be stored with:
- generator parameters,
- model,
- prompt/schema version,
- target IDs,
- learner-level assumptions,
- quality/validation status,
- answer history.

Good items can reappear after sufficient spacing.

The learner should not receive the exact same sentence continuously, but the system also should not pay to regenerate a perfectly good exercise every time.

---

## 29.5 Adaptive “Build me a session”

Once the app has enough mastery data, an LLM can compose an optional session.

User selects:
- 5 minutes
- 15 minutes
- 30 minutes
- Deep session

Inputs may include:
- due reviews,
- weak dimensions,
- current sprint targets,
- recently introduced material,
- skill balance,
- available activity types.

Example output:

```json
{
  "duration": 15,
  "activities": [
    {"type": "srs_review", "minutes": 4},
    {"type": "phoneme_discrimination", "target": "/y_vs_u/", "minutes": 3},
    {"type": "sentence_transform", "targets": ["pouvoir", "devoir"], "minutes": 5},
    {"type": "listening_check", "minutes": 3}
  ]
}
```

The LLM may **choose among valid activities**, but must not invent a new curriculum objective.

This can power a dashboard action such as:

> **Build a session**

or:

> **Do something now**

---

## 29.6 Context-aware French tutor — later phase

A future conversational tutor becomes much more valuable when it knows the learner model.

It should receive:
- current sprint,
- active vocabulary,
- known grammar,
- recent mistakes,
- conversation mode.

Possible modes:
- controlled conversation,
- normal conversation,
- roleplay,
- French only,
- French + Spanish help,
- Socratic explanation.

The tutor should try to stay close to the learner’s available language while still exposing a small amount of comprehensible novelty.

It should not casually use B2 grammar with an A1 learner simply because a general-purpose chatbot can.

---

## 29.7 Post-conversation analysis

After an AI, tutor, or partner conversation, an LLM can analyze the transcript.

Return only high-value items:

```json
{
  "important_errors": [],
  "spanish_interference": [],
  "useful_reformulations": [],
  "pronunciation_targets": [],
  "candidate_cards": []
}
```

Be selective.

Three recurring errors are more useful than thirty stylistic suggestions.

Recurring issues should enter:
- Personal Interference Log,
- spaced error-recycling queue,
- future drill generation.

---

## 29.8 Contextual “Explain” actions

Any French item or structure may eventually expose actions such as:

- Explain
- Compare to Spanish
- Why this tense?
- More examples
- Pronunciation

The model should know the learner has advanced Spanish.

Example:

**venir de + infinitif**

Preferred explanation:

> French **venir de + infinitif** corresponds closely to Spanish **acabar de + infinitivo**: *Je viens de manger* → *Acabo de comer.*

Avoid generic beginner explanations when a precise Spanish parallel makes the structure immediately obvious.

---

## 29.9 Smart text analysis

For imported French text, an LLM can compare the text to learner state.

Useful classifications:

- Known
- Recognition
- Transparent through Spanish
- Likely inferable
- Unknown but useful
- Unknown and low priority

This supports a better question than:

> “Which words are unknown?”

The useful question is:

> “Which unknown language is actually worth spending retrieval practice on?”

The system may recommend promotions, but should not automatically dump every unknown word into SRS.

---

## 29.10 Personalized micro-content generation

Once the learner knows enough language, LLMs can generate short comprehensible texts and dialogues.

Inputs:
- known vocabulary,
- permitted novelty,
- required target words,
- required grammar,
- topic,
- target length.

Example constraint:

> Produce a 160-word dialogue containing `venir`, `prendre`, and passé composé, with at least 92% of lexical items drawn from the learner’s known/recognition vocabulary.

One generated object can then produce:
- reading,
- TTS,
- comprehension questions,
- cloze,
- sentence transformations,
- retelling prompts,
- vocabulary mining.

This is a strong bridge from artificial drills to sustained French input.

---

## 29.11 AI-assisted assessment — later phase

At higher A1/A2 and toward B1, the model may simulate:
- conversational interviews,
- scenario tasks,
- short writing tasks,
- opinion questions.

Evaluation can track trends in:
- comprehensibility,
- grammatical control,
- lexical range,
- interaction,
- fluency.

Do not claim official CEFR certification.

The value is repeated practice plus longitudinal weakness detection.

---

## 29.12 Model and security principles

- Keep OpenRouter API keys server-side.
- Never expose keys in browser/client code.
- Reuse the project’s existing OpenRouter abstraction where sensible.
- Keep model choice configurable rather than hardcoding DeepSeek everywhere.
- Centralize learning-AI calls behind functions such as:
  - `generateDrill`
  - `composeSession`
  - `explainFrench`
  - `analyzeConversation`
  - `analyzeText`
  - `generateMicroContent`
- Version prompts/schemas where practical.
- Log failures without storing unnecessary personal conversation content.

---

## 29.13 Cost and reliability hierarchy

Prefer, in order:

1. curated static content when correctness matters most,
2. deterministic generation when code can do the job,
3. cached validated LLM content,
4. fresh LLM calls when personalization or variation adds real value.

An LLM should not be required for basic navigation, existing SRS review, conjugation lookup, or static reference pages.

The app should remain useful if the model endpoint is temporarily unavailable.

---

# 30. Final principle

The app should make it easy to do one of two things at any moment:

> **Learn something worth knowing.**

or

> **Use something already learned in a slightly harder way.**

Everything else is secondary.
