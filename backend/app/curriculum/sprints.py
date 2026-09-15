"""The four Month-1 sprints: mission, targets, weights, resources, activity bank,
mastery-gate criteria. Vocabulary / verbs / pronunciation banks live in their
own modules and are referenced by id here.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.curriculum.pronunciation import targets_for_sprint as pron_for_sprint
from app.curriculum.verbs import verbs_for_sprint
from app.curriculum.vocab import items_for_sprint

DIMENSIONS = ("vocabulary", "verbs", "pronunciation", "grammar", "listening", "speaking", "reading", "writing")
SKILLS = ("vocabulary", "verbs", "pronunciation", "grammar", "listening", "reading", "speaking")


@dataclass(frozen=True)
class GrammarTarget:
    id: str
    label: str
    ref: str
    es: str = ""  # the Spanish parallel, one line
    formats: tuple[str, ...] = ()  # exercise formats that evidence it
    recognition_only: bool = False

    def as_dict(self) -> dict:
        return {"id": self.id, "label": self.label, "ref": self.ref, "es": self.es,
                "recognition_only": self.recognition_only}


@dataclass(frozen=True)
class Resource:
    id: str
    name: str
    url: str
    skill: str
    note: str = ""
    minutes: int = 15
    section: str = ""  # chapter / playlist / topic to open

    def as_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "url": self.url, "skill": self.skill, "note": self.note,
                "minutes": self.minutes, "section": self.section}


@dataclass(frozen=True)
class Activity:
    id: str
    name: str
    skill: str
    minutes: int  # approximate; bucketed client-side (5 / 15 / 30 / deep)
    kind: str  # drill | srs | external | self | text | test | llm
    format: str = ""  # exercise format for drill / llm kinds
    target: str = ""  # compact target label shown in the row
    params: dict = field(default_factory=dict)
    resource: str = ""  # Resource id for external kind
    dims: dict = field(default_factory=dict)  # mastery effect weights

    def as_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "skill": self.skill, "minutes": self.minutes, "kind": self.kind,
                "format": self.format, "target": self.target, "params": self.params, "resource": self.resource,
                "dims": self.dims}


@dataclass(frozen=True)
class Criterion:
    dimension: str
    label: str  # compact, e.g. "≥85% recognition on Core items"
    metric: str  # machine key used by the mastery test scorer


@dataclass(frozen=True)
class Sprint:
    number: int
    title: str
    mission: str
    weights: dict[str, float]
    grammar: tuple[GrammarTarget, ...]
    resources: tuple[Resource, ...]
    activities: tuple[Activity, ...]
    criteria: tuple[Criterion, ...]
    output_targets: tuple[str, ...]  # speaking / writing checks (self-graded)
    listening_target: int = 5  # listening exercises to complete
    output_target: int = 2  # output checks to complete

    @property
    def vocab(self):
        return items_for_sprint(self.number)

    @property
    def core_vocab(self):
        return [i for i in self.vocab if i.status == "core"]

    @property
    def verbs(self):
        return verbs_for_sprint(self.number)

    @property
    def pronunciation(self):
        return pron_for_sprint(self.number)

    def as_dict(self) -> dict:
        return {
            "number": self.number,
            "title": self.title,
            "mission": self.mission,
            "weights": self.weights,
            "grammar": [g.as_dict() for g in self.grammar],
            "resources": [r.as_dict() for r in self.resources],
            "activities": [a.as_dict() for a in self.activities],
            "criteria": [{"dimension": c.dimension, "label": c.label, "metric": c.metric} for c in self.criteria],
            "output_targets": list(self.output_targets),
            "listening_target": self.listening_target,
            "output_target": self.output_target,
            "verbs": [v.as_dict() for v in self.verbs],
            "pronunciation": [t.as_dict() for t in self.pronunciation],
            "vocab_count": len(self.vocab),
            "core_count": len(self.core_vocab),
        }


# ---------------------------------------------------------------------------
# shared resources (referenced per sprint)
# ---------------------------------------------------------------------------
R = {
    "phonetique": Resource("phonetique", "CLE Phonétique progressive (débutant)",
                           "https://progressive.cle-international.com/9782090384550", "pronunciation",
                           note="Workbook + audio. Sprint 1: sounds chapters; later: weak sounds only.", minutes=20),
    "grammaire": Resource("grammaire", "CLE Grammaire progressive A1",
                          "https://www.cle-international.com/grammaire-progressive-du-francais-niveau-debutant-a1-livre-audio-telechargeable-appli-web-9782090398502",
                          "grammar", note="Open the chapter matching the target — never front-to-back.", minutes=20),
    "tv5": Resource("tv5", "TV5MONDE Première classe",
                    "https://apprendre.tv5monde.com/fr/niveaux/a1-debutant", "listening",
                    note="A1 clips with ES support. Listen first, transcript after.", minutes=15),
    "fci": Resource("fci", "French Comprehensible Input · beginners",
                    "https://sites.google.com/view/frenchcomprehensibleinput/beginners", "listening",
                    note="French-only. Watch for the message, not the words.", minutes=15),
    "fci_yt": Resource("fci_yt", "FCI · absolute beginner video",
                       "https://www.youtube.com/watch?v=c2SUQVjklVA", "listening", note="Start here.", minutes=15),
    "alice": Resource("alice", "Alice Ayel · stories", "https://www.aliceayel.com/", "listening",
                      note="Optional second CI source. Pick one channel and stick with it.", minutes=15),
    "youglish": Resource("youglish", "YouGlish French", "https://youglish.com/french", "pronunciation",
                         note="Hear a word in many real clips. Check isolation pronunciation vs real speech.", minutes=5),
    "forvo": Resource("forvo", "Forvo French", "https://forvo.com/languages/fr/", "pronunciation",
                      note="Native recordings, several speakers per word.", minutes=5),
    "rfi": Resource("rfi", "RFI · Journal en français facile",
                    "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/", "listening",
                    note="Too hard for now — parked for A2/B1.", minutes=10),
}


def _r(rid: str, section: str = "", minutes: int | None = None) -> Resource:
    base = R[rid]
    return Resource(base.id, base.name, base.url, base.skill, base.note, minutes or base.minutes, section)


# ---------------------------------------------------------------------------
# Sprint 1 — Foundation
# ---------------------------------------------------------------------------
S1_GRAMMAR = (
    GrammarTarget("subject_pronouns", "Subject pronouns", "pronouns#subject", es="Always present — never dropped like Spanish.",
                  formats=("verb_drill", "sentence_transform")),
    GrammarTarget("articles", "le/la/les · un/une/des", "articles#definite", es="des is required where Spanish has nothing.",
                  formats=("cloze", "es_to_fr")),
    GrammarTarget("present_core4", "Present: être · avoir · aller · faire", "core-verbs", es="ser/estar · tener · ir · hacer",
                  formats=("verb_drill", "sentence_transform", "es_to_fr")),
    GrammarTarget("cest", "c'est + …", "sentence-architecture#cest", es="es (identificar / comentar)", formats=("es_to_fr", "cloze")),
    GrammarTarget("il_y_a", "il y a", "sentence-architecture#il-y-a", es="hay", formats=("es_to_fr", "cloze")),
    GrammarTarget("negation", "ne … pas", "sentence-architecture#negation", es="no + verbo → ne + verbo + pas",
                  formats=("sentence_transform", "es_to_fr")),
    GrammarTarget("questions_yesno", "Intonation · est-ce que", "questions#est-ce-que", es="¿…? sube la voz / est-ce que + frase",
                  formats=("sentence_transform", "es_to_fr")),
    GrammarTarget("question_words", "qui · quoi · où · quand · comment · pourquoi", "questions#words",
                  formats=("es_to_fr", "cloze")),
    GrammarTarget("avoir_expressions", "avoir faim / soif / … ans", "core-verbs#avoir", es="tener hambre / sed / años",
                  formats=("es_to_fr", "error_repair")),
    GrammarTarget("gender_agreement", "Gender + adjective agreement (concept)", "articles#gender", recognition_only=True),
)

S1_RESOURCES = (
    _r("phonetique", "Ch. 1–12 (voyelles, nasales, r)"),
    _r("grammaire", "Ch. être / avoir · les articles · la négation"),
    _r("tv5", "A1 · Première classe · Se présenter"),
    _r("fci_yt", "Absolute beginner #1"),
    _r("fci", "Beginners playlist"),
    _r("youglish", "tu / tout / vous"),
    _r("forvo", "any card"),
)

S1_ACTIVITIES = (
    Activity("s1_srs", "Review due", "vocabulary", 5, "srs", target="due cards", dims={"vocabulary": 1}),
    Activity("s1_y_u", "/y/ vs /u/", "pronunciation", 5, "drill", format="pronunciation_ab", target="tu / tout",
             params={"target": "y_vs_u", "count": 12}, dims={"pronunciation": 1}),
    Activity("s1_i_y", "/i/ vs /y/", "pronunciation", 5, "drill", format="pronunciation_ab", target="vie / vue",
             params={"target": "i_vs_y", "count": 10}, dims={"pronunciation": 1}),
    Activity("s1_nasals", "Nasal vowels", "pronunciation", 5, "drill", format="pronunciation_odd", target="an · on · in",
             params={"target": "nasals", "count": 10}, dims={"pronunciation": 1}),
    Activity("s1_sh_zh", "/ʃ/ vs /ʒ/", "pronunciation", 5, "drill", format="pronunciation_ab", target="chou / joue",
             params={"target": "sh_zh", "count": 10}, dims={"pronunciation": 1}),
    Activity("s1_s_z", "/s/ vs /z/", "pronunciation", 5, "drill", format="pronunciation_ab", target="poisson / poison",
             params={"target": "s_vs_z", "count": 10}, dims={"pronunciation": 1}),
    Activity("s1_decode", "Spelling → sound", "pronunciation", 5, "drill", format="grapheme", target="eau · oi · u · ou",
             params={"target": "grapheme_decoding", "count": 12}, dims={"pronunciation": 0.7, "reading": 0.3}),
    Activity("s1_silent", "Silent finals + -ent", "pronunciation", 5, "drill", format="grapheme", target="CaReFuL",
             params={"target": "silent_finals", "count": 10, "extra": ["final_ent"]}, dims={"pronunciation": 1}),
    Activity("s1_liaison", "ils ont / ils sont", "pronunciation", 5, "drill", format="pronunciation_ab", target="/z/ liaison",
             params={"target": "liaison_intro", "count": 8}, dims={"pronunciation": 0.6, "listening": 0.4}),
    Activity("s1_r", "French R · read aloud", "pronunciation", 5, "drill", format="read_aloud", target="/ʁ/",
             params={"target": "r_production", "count": 8}, dims={"pronunciation": 0.7, "speaking": 0.3}),
    Activity("s1_fr_es", "French → Spanish", "vocabulary", 5, "drill", format="fr_to_es", target="Sprint 1 core",
             params={"count": 12}, dims={"vocabulary": 1}),
    Activity("s1_es_fr", "Spanish → French", "vocabulary", 10, "drill", format="es_to_fr", target="Sprint 1 core",
             params={"count": 10}, dims={"vocabulary": 0.8, "writing": 0.2}),
    Activity("s1_audio", "Audio recognition", "listening", 5, "drill", format="audio_recognition", target="hear → meaning",
             params={"count": 10}, dims={"listening": 0.6, "vocabulary": 0.4}),
    Activity("s1_verbs", "Verb drill · être/avoir/aller/faire", "verbs", 8, "drill", format="verb_drill", target="je · tu · on · vous",
             params={"count": 12}, dims={"verbs": 1}),
    Activity("s1_transform", "Sentence transformations", "grammar", 8, "drill", format="sentence_transform",
             target="negation · question · person", params={"count": 8}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s1_cloze", "Cloze", "vocabulary", 5, "drill", format="cloze", target="glue words", params={"count": 10},
             dims={"vocabulary": 0.6, "grammar": 0.4}),
    Activity("s1_dictation", "Dictation · words & short phrases", "listening", 8, "drill", format="dictation",
             target="known words", params={"count": 6, "level": 1}, dims={"listening": 0.7, "writing": 0.3}),
    Activity("s1_comprehension", "Audio comprehension", "listening", 5, "drill", format="audio_comprehension",
             target="one sentence → meaning", params={"count": 8}, dims={"listening": 1}),
    Activity("s1_ladder", "Translation ladder", "grammar", 8, "drill", format="translation_ladder", target="je suis / j'ai / je vais",
             params={"count": 2}, dims={"grammar": 0.5, "verbs": 0.3, "writing": 0.2}),
    Activity("s1_repair", "Interference repair", "grammar", 5, "drill", format="error_repair", target="je suis 30 ans → j'ai",
             params={"count": 6}, dims={"grammar": 1}),
    Activity("s1_questions", "10 spoken questions", "speaking", 8, "drill", format="timed_fluency", target="answer aloud",
             params={"count": 10}, dims={"speaking": 0.7, "listening": 0.3}),
    Activity("s1_intro", "Self-introduction · 60 s", "speaking", 10, "self", target="record & self-rate",
             params={"task": "self_intro"}, dims={"speaking": 1}),
    Activity("s1_llm_dialogue", "Micro-dialogue (AI)", "speaking", 10, "llm", format="micro_dialogue", target="Sprint 1 frames",
             params={"count": 4}, dims={"speaking": 0.5, "grammar": 0.5}),
    Activity("s1_llm_esfr", "Spanish → French (AI, fresh)", "grammar", 10, "llm", format="es_to_fr", target="new contexts",
             params={"count": 8}, dims={"grammar": 0.5, "vocabulary": 0.5}),
    Activity("s1_tv5", "TV5 · Se présenter", "listening", 15, "external", resource="tv5", target="1 clip, gist first",
             dims={"listening": 1}),
    Activity("s1_fci", "FCI · absolute beginner", "listening", 15, "external", resource="fci_yt", target="1 video",
             dims={"listening": 1}),
    Activity("s1_phon", "Phonétique progressive", "pronunciation", 20, "external", resource="phonetique", target="1–2 chapters",
             dims={"pronunciation": 1}),
    Activity("s1_gram", "Grammaire progressive", "grammar", 20, "external", resource="grammaire", target="être/avoir · articles",
             dims={"grammar": 1}),
    Activity("s1_text", "Text study", "reading", 20, "text", target="one short text", dims={"reading": 1}),
    Activity("s1_test", "Sprint 1 mastery test", "grammar", 30, "test", target="all dimensions"),
)

S1_CRITERIA = (
    Criterion("vocabulary", "≥85% recognition · ≥70% ES→FR on Core", "vocab"),
    Criterion("verbs", "présent of être/avoir/aller/faire · ≥80% mixed drill", "verbs"),
    Criterion("pronunciation", "≥80% discrimination on unseen words · 20 unseen words read", "pronunciation"),
    Criterion("grammar", "negation · questions · c'est / il y a", "grammar"),
    Criterion("listening", "5 listening exercises · dictation of known words", "listening"),
    Criterion("speaking", "60 s self-intro · ~10 spoken questions", "speaking"),
)

# ---------------------------------------------------------------------------
# Sprint 2 — Generate
# ---------------------------------------------------------------------------
S2_GRAMMAR = (
    GrammarTarget("regular_er", "Regular -er present", "core-verbs#parler", es="-ar/-er/-ir → one pattern: e·es·e·ons·ez·ent",
                  formats=("verb_drill", "sentence_transform")),
    GrammarTarget("modal_infinitive", "vouloir / pouvoir / devoir + infinitif", "sentence-architecture#modal",
                  es="querer / poder / tener que + infinitivo", formats=("sentence_transform", "translation_ladder", "es_to_fr")),
    GrammarTarget("futur_proche", "aller + infinitif", "tense-map#near-future", es="ir a + infinitivo (sin 'a')",
                  formats=("sentence_transform", "translation_ladder", "es_to_fr")),
    GrammarTarget("adjective_position", "Adjective position", "sentence-architecture#adjectives",
                  es="after the noun, except petit/grand/bon/nouveau/beau…", formats=("es_to_fr", "cloze")),
    GrammarTarget("possessives", "mon/ma/mes · ton · son", "pronouns#possessive", es="agrees with the noun, not the owner",
                  formats=("cloze", "es_to_fr")),
    GrammarTarget("prepositions_places", "à / de / en / chez", "articles#places", es="a / de / en / en casa de",
                  formats=("cloze", "es_to_fr")),
    GrammarTarget("contractions", "au / aux / du / des", "articles#contractions", es="al / del", formats=("cloze", "es_to_fr")),
    GrammarTarget("negation_modals", "Negation with modals", "sentence-architecture#negation", es="ne + modal + pas + infinitif",
                  formats=("sentence_transform",)),
    GrammarTarget("questions_stronger", "Questions: words + est-ce que", "questions#words", formats=("sentence_transform", "es_to_fr")),
    GrammarTarget("on_we", "on = nous", "pronouns#on", es="nosotros (hablado)", formats=("sentence_transform",)),
    GrammarTarget("aimer_article", "aimer + le/la/les", "transfer#aimer-gustar", es="me gusta X → j'aime le X",
                  formats=("es_to_fr", "error_repair")),
)

S2_RESOURCES = (
    _r("grammaire", "Ch. verbes en -er · aller + infinitif · les possessifs · au/du"),
    _r("phonetique", "Ch. liaison · rythme · e/è"),
    _r("tv5", "A1 · Parler de soi · Les loisirs"),
    _r("fci", "Beginners · daily routine / likes"),
    _r("youglish", "je veux / je peux / je dois"),
)

S2_ACTIVITIES = (
    Activity("s2_srs", "Review due", "vocabulary", 5, "srs", target="due cards", dims={"vocabulary": 1}),
    Activity("s2_transform", "Sentence transformations · modals", "grammar", 8, "drill", format="sentence_transform",
             target="vouloir → pouvoir → devoir", params={"count": 10, "sprint": 2}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s2_ladder", "Translation ladder · quiero ir", "grammar", 8, "drill", format="translation_ladder",
             target="modal + infinitif", params={"count": 2, "sprint": 2}, dims={"grammar": 0.5, "verbs": 0.3, "writing": 0.2}),
    Activity("s2_futur", "Futur proche", "grammar", 5, "drill", format="sentence_transform", target="aller + infinitif",
             params={"count": 8, "sprint": 2, "transformations": ["tense_futur_proche"]}, dims={"grammar": 1}),
    Activity("s2_verbs", "Verb drill · modals + -er", "verbs", 8, "drill", format="verb_drill", target="8 new verbs",
             params={"count": 14, "sprint": 2}, dims={"verbs": 1}),
    Activity("s2_er", "Regular -er", "verbs", 5, "drill", format="verb_drill", target="parler · penser · aimer",
             params={"count": 10, "sprint": 2, "group": "er"}, dims={"verbs": 1}),
    Activity("s2_fr_es", "French → Spanish", "vocabulary", 5, "drill", format="fr_to_es", target="Sprint 2 core",
             params={"count": 12, "sprint": 2}, dims={"vocabulary": 1}),
    Activity("s2_es_fr", "Spanish → French", "vocabulary", 10, "drill", format="es_to_fr", target="Sprint 2 core",
             params={"count": 10, "sprint": 2}, dims={"vocabulary": 0.8, "writing": 0.2}),
    Activity("s2_audio", "Audio recognition", "listening", 5, "drill", format="audio_recognition", target="S1+S2",
             params={"count": 10, "sprint": 2}, dims={"listening": 0.6, "vocabulary": 0.4}),
    Activity("s2_cloze", "Cloze · possessives & prepositions", "grammar", 5, "drill", format="cloze", target="mon · au · chez",
             params={"count": 10, "sprint": 2}, dims={"grammar": 0.6, "vocabulary": 0.4}),
    Activity("s2_e_eh", "/e/ vs /ɛ/", "pronunciation", 5, "drill", format="pronunciation_ab", target="été / était",
             params={"target": "e_vs_eh", "count": 10}, dims={"pronunciation": 1}),
    Activity("s2_oe_o", "/ø/ vs /o/", "pronunciation", 5, "drill", format="pronunciation_ab", target="peu / peau",
             params={"target": "oe_vs_o", "count": 10}, dims={"pronunciation": 1}),
    Activity("s2_liaison", "Liaison: yes or no?", "pronunciation", 5, "drill", format="liaison", target="les amis · et aussi",
             params={"target": "liaison_recognition", "count": 10}, dims={"pronunciation": 0.6, "listening": 0.4}),
    Activity("s2_rhythm", "Read aloud · rhythm", "pronunciation", 5, "drill", format="read_aloud", target="sentence groups",
             params={"target": "rhythm_reading", "count": 6}, dims={"pronunciation": 0.6, "speaking": 0.4}),
    Activity("s2_dictation", "Dictation · sentences", "listening", 8, "drill", format="dictation", target="one sentence",
             params={"count": 6, "level": 2, "sprint": 2}, dims={"listening": 0.7, "writing": 0.3}),
    Activity("s2_comprehension", "Audio comprehension", "listening", 5, "drill", format="audio_comprehension",
             target="plans · likes", params={"count": 8, "sprint": 2}, dims={"listening": 1}),
    Activity("s2_repair", "Interference repair", "grammar", 5, "drill", format="error_repair", target="me gusta → j'aime le",
             params={"count": 6, "sprint": 2}, dims={"grammar": 1}),
    Activity("s2_questions", "20 spoken questions", "speaking", 10, "drill", format="timed_fluency", target="answer aloud",
             params={"count": 12, "sprint": 2}, dims={"speaking": 0.7, "listening": 0.3}),
    Activity("s2_plans", "3 plans · aller + infinitif", "speaking", 5, "self", target="say 3 plans", params={"task": "three_plans"},
             dims={"speaking": 0.7, "grammar": 0.3}),
    Activity("s2_description", "2-minute self-description", "speaking", 10, "self", target="record & self-rate",
             params={"task": "self_description"}, dims={"speaking": 1}),
    Activity("s2_llm_dialogue", "Micro-dialogue (AI)", "speaking", 10, "llm", format="micro_dialogue", target="want / can / must",
             params={"count": 4, "sprint": 2}, dims={"speaking": 0.5, "grammar": 0.5}),
    Activity("s2_llm_transform", "Transformations (AI, fresh)", "grammar", 10, "llm", format="sentence_transform",
             target="new sentences", params={"count": 8, "sprint": 2}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s2_llm_context", "Vocabulary in context (AI)", "vocabulary", 8, "llm", format="context_choice", target="S2 core",
             params={"count": 8, "sprint": 2}, dims={"vocabulary": 1}),
    Activity("s2_tutor", "Focused conversation · 30–45 min", "speaking", 40, "self", target="tutor / partner brief",
             params={"task": "tutor_session"}, dims={"speaking": 1}),
    Activity("s2_tv5", "TV5 · Parler de soi", "listening", 15, "external", resource="tv5", target="1 clip", dims={"listening": 1}),
    Activity("s2_fci", "FCI · beginners", "listening", 15, "external", resource="fci", target="1 video", dims={"listening": 1}),
    Activity("s2_gram", "Grammaire progressive", "grammar", 20, "external", resource="grammaire", target="-er · aller + inf",
             dims={"grammar": 1}),
    Activity("s2_text", "Text study", "reading", 20, "text", target="one short text", dims={"reading": 1}),
    Activity("s2_test", "Sprint 2 mastery test", "grammar", 30, "test", target="all dimensions"),
)

S2_CRITERIA = (
    Criterion("speaking", "2-min unscripted intro · 3 plans with aller + inf · ~20 random questions", "speaking"),
    Criterion("pronunciation", "target vowel contrasts in novel words", "pronunciation"),
    Criterion("grammar", "affirmative ↔ negative ↔ question transforms", "grammar"),
    Criterion("verbs", "≥6 new verbs in spontaneous answers · regular -er", "verbs"),
    Criterion("vocabulary", "≥85% recognition · ≥70% ES→FR on S2 Core", "vocab"),
    Criterion("listening", "5 listening exercises · sentence dictation", "listening"),
)

# ---------------------------------------------------------------------------
# Sprint 3 — Past & speech
# ---------------------------------------------------------------------------
S3_GRAMMAR = (
    GrammarTarget("passe_compose_avoir", "Passé composé: avoir + participe", "tense-map#passe-compose",
                  es="he trabajado / trabajé → j'ai travaillé", formats=("sentence_transform", "verb_drill", "es_to_fr")),
    GrammarTarget("passe_compose_etre", "Passé composé: être (aller, venir, partir, rester, arriver)", "tense-map#passe-compose-etre",
                  es="ir → je suis allé (agreement as recognition)", formats=("sentence_transform", "verb_drill")),
    GrammarTarget("participles_core", "Past participles of core verbs", "core-verbs", es="fait · vu · pris · eu · été · dit",
                  formats=("verb_drill", "cloze")),
    GrammarTarget("venir_de", "venir de + infinitif", "tense-map#recent-past", es="acabar de + infinitivo",
                  formats=("sentence_transform", "translation_ladder")),
    GrammarTarget("object_pronouns_1", "me / te / le / la / les", "pronouns#object", es="before the conjugated verb, like Spanish",
                  formats=("sentence_transform", "cloze")),
    GrammarTarget("sequencing", "d'abord · puis · après · enfin · donc", "sentence-architecture#connectors", formats=("cloze", "es_to_fr")),
    GrammarTarget("past_time", "hier · la semaine dernière · il y a …", "tense-map#ago", es="ayer · la semana pasada · hace …",
                  formats=("es_to_fr", "cloze")),
    GrammarTarget("spoken_ne_drop", "Spoken: ne drops, y a, t'as", "spoken-french", recognition_only=True),
)

S3_RESOURCES = (
    _r("grammaire", "Ch. passé composé (avoir · être) · les pronoms COD"),
    _r("phonetique", "Ch. enchaînement · liaison · e muet"),
    _r("tv5", "A1 · Raconter · Les activités"),
    _r("fci", "Beginners · stories in the past"),
    _r("alice", "Beginner stories"),
    _r("youglish", "j'ai fait / je suis allé"),
)

S3_ACTIVITIES = (
    Activity("s3_srs", "Review due", "vocabulary", 5, "srs", target="due cards", dims={"vocabulary": 1}),
    Activity("s3_pc", "Passé composé transforms", "grammar", 8, "drill", format="sentence_transform", target="présent → passé composé",
             params={"count": 10, "sprint": 3, "transformations": ["tense_passe_compose"]}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s3_participles", "Participles · core verbs", "verbs", 5, "drill", format="verb_drill", target="fait · vu · pris",
             params={"count": 12, "sprint": 3, "tense": "passe_compose"}, dims={"verbs": 1}),
    Activity("s3_verbs", "Verb drill · 10 new verbs", "verbs", 8, "drill", format="verb_drill", target="venir · prendre · voir …",
             params={"count": 14, "sprint": 3}, dims={"verbs": 1}),
    Activity("s3_venir_de", "venir de + infinitif", "grammar", 5, "drill", format="translation_ladder", target="acabo de …",
             params={"count": 2, "sprint": 3, "family": "venir_de"}, dims={"grammar": 1}),
    Activity("s3_pronouns", "Object pronouns", "grammar", 5, "drill", format="sentence_transform", target="le / la / les",
             params={"count": 8, "sprint": 3, "transformations": ["object_pronoun"]}, dims={"grammar": 1}),
    Activity("s3_transform", "Mixed transformations", "grammar", 8, "drill", format="sentence_transform", target="person · polarity · tense",
             params={"count": 10, "sprint": 3}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s3_fr_es", "French → Spanish", "vocabulary", 5, "drill", format="fr_to_es", target="Sprint 3 core",
             params={"count": 12, "sprint": 3}, dims={"vocabulary": 1}),
    Activity("s3_es_fr", "Spanish → French", "vocabulary", 10, "drill", format="es_to_fr", target="Sprint 3 core",
             params={"count": 10, "sprint": 3}, dims={"vocabulary": 0.8, "writing": 0.2}),
    Activity("s3_cloze", "Cloze · sequencing", "vocabulary", 5, "drill", format="cloze", target="puis · après · donc",
             params={"count": 10, "sprint": 3}, dims={"vocabulary": 0.5, "grammar": 0.5}),
    Activity("s3_audio", "Audio recognition", "listening", 5, "drill", format="audio_recognition", target="S1–S3",
             params={"count": 10, "sprint": 3}, dims={"listening": 0.6, "vocabulary": 0.4}),
    Activity("s3_spoken", "Spoken French decoder", "listening", 5, "drill", format="liaison", target="je sais pas · y a",
             params={"target": "spoken_reductions", "count": 8}, dims={"listening": 1}),
    Activity("s3_dictation", "Dictation · two sentences", "listening", 10, "drill", format="dictation", target="linked sentences",
             params={"count": 5, "level": 3, "sprint": 3}, dims={"listening": 0.7, "writing": 0.3}),
    Activity("s3_comprehension", "Audio comprehension · past", "listening", 5, "drill", format="audio_comprehension",
             target="what happened?", params={"count": 8, "sprint": 3}, dims={"listening": 1}),
    Activity("s3_enchainement", "Linking & schwa · read aloud", "pronunciation", 5, "drill", format="read_aloud", target="il‿est là",
             params={"target": "enchainement_schwa", "count": 6}, dims={"pronunciation": 0.6, "speaking": 0.4}),
    Activity("s3_repair", "Interference repair", "grammar", 5, "drill", format="error_repair", target="past & pronouns",
             params={"count": 6, "sprint": 3}, dims={"grammar": 1}),
    Activity("s3_questions", "Questions about yesterday", "speaking", 10, "drill", format="timed_fluency", target="answer aloud",
             params={"count": 12, "sprint": 3}, dims={"speaking": 0.7, "listening": 0.3}),
    Activity("s3_story", "Yesterday · 2–3 min story", "speaking", 10, "self", target="record & self-rate", params={"task": "yesterday_story"},
             dims={"speaking": 1}),
    Activity("s3_llm_dialogue", "Micro-dialogue (AI) · past", "speaking", 10, "llm", format="micro_dialogue", target="what did you do?",
             params={"count": 4, "sprint": 3}, dims={"speaking": 0.5, "grammar": 0.5}),
    Activity("s3_llm_reading", "Short reading (AI)", "reading", 10, "llm", format="reading", target="past narrative",
             params={"count": 1, "sprint": 3}, dims={"reading": 0.7, "vocabulary": 0.3}),
    Activity("s3_llm_transform", "Transformations (AI, fresh)", "grammar", 10, "llm", format="sentence_transform", target="passé composé",
             params={"count": 8, "sprint": 3}, dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s3_tv5", "TV5 · Raconter", "listening", 15, "external", resource="tv5", target="1 clip", dims={"listening": 1}),
    Activity("s3_fci", "FCI · story", "listening", 15, "external", resource="fci", target="1 video", dims={"listening": 1}),
    Activity("s3_gram", "Grammaire progressive · passé composé", "grammar", 20, "external", resource="grammaire", target="PC chapters",
             dims={"grammar": 1}),
    Activity("s3_text", "Text study", "reading", 20, "text", target="one text", dims={"reading": 1}),
    Activity("s3_test", "Sprint 3 mastery test", "grammar", 30, "test", target="all dimensions"),
)

S3_CRITERIA = (
    Criterion("speaking", "2–3 min story about yesterday · follow-up questions", "speaking"),
    Criterion("verbs", "common passé composé forms without constructing each one", "verbs"),
    Criterion("listening", "short dictations · slow dialogue understood before transcript", "listening"),
    Criterion("pronunciation", "identify linking / reduction in audio", "pronunciation"),
    Criterion("grammar", "passé composé · venir de · le/la/les", "grammar"),
    Criterion("vocabulary", "≥85% recognition · ≥70% ES→FR on S3 Core", "vocab"),
)

# ---------------------------------------------------------------------------
# Sprint 4 — Consolidate
# ---------------------------------------------------------------------------
S4_GRAMMAR = (
    GrammarTarget("tense_mixing", "présent · futur proche · passé composé in one answer", "tense-map",
                  es="trabajo · voy a trabajar · he trabajado", formats=("sentence_transform", "translation_ladder", "es_to_fr")),
    GrammarTarget("questions_all", "All question forms", "questions", formats=("sentence_transform", "timed_fluency")),
    GrammarTarget("negation_all", "ne … pas / jamais / rien / plus", "sentence-architecture#negation", es="nunca / nada / ya no",
                  formats=("sentence_transform", "es_to_fr")),
    GrammarTarget("articles_prepositions", "Articles + prepositions consolidated", "articles", formats=("cloze", "es_to_fr")),
    GrammarTarget("agreement", "Adjective agreement", "sentence-architecture#adjectives", formats=("cloze", "es_to_fr")),
    GrammarTarget("object_pronouns_2", "Object pronouns in use", "pronouns#object", formats=("sentence_transform",)),
    GrammarTarget("reasons_opinions", "parce que · je pense / trouve / crois que", "sentence-architecture#que-clauses",
                  formats=("es_to_fr", "micro_dialogue")),
    GrammarTarget("depuis_pendant", "depuis · pendant · il y a", "tense-map#depuis", es="desde hace · durante · hace",
                  formats=("cloze", "es_to_fr")),
    GrammarTarget("imparfait_recognition", "Imparfait (recognition: c'était, il y avait)", "tense-map#imparfait", recognition_only=True),
)

S4_RESOURCES = (
    _r("fci", "Beginners · longer videos"),
    _r("alice", "Stories · level 1"),
    _r("tv5", "A1 · any topic · transcript-assisted"),
    _r("grammaire", "Weak chapters only"),
    _r("phonetique", "Weak sounds only"),
    _r("youglish", "any phrase"),
    _r("rfi", "parked — A2/B1"),
)

S4_ACTIVITIES = (
    Activity("s4_srs", "Review due", "vocabulary", 5, "srs", target="due cards", dims={"vocabulary": 1}),
    Activity("s4_rapid", "Rapid transformations · 3 tenses", "grammar", 5, "drill", format="sentence_transform",
             target="présent ↔ futur proche ↔ passé composé", params={"count": 12, "sprint": 4, "timed": True},
             dims={"grammar": 0.6, "verbs": 0.4}),
    Activity("s4_ladder", "Translation ladder · mixed", "grammar", 8, "drill", format="translation_ladder", target="3 tenses",
             params={"count": 3, "sprint": 4}, dims={"grammar": 0.5, "verbs": 0.3, "writing": 0.2}),
    Activity("s4_verbs", "Verb drill · all 32", "verbs", 8, "drill", format="verb_drill", target="mixed persons & tenses",
             params={"count": 16, "sprint": 4, "mixed": True}, dims={"verbs": 1}),
    Activity("s4_new_verbs", "Verb drill · S4 verbs", "verbs", 5, "drill", format="verb_drill", target="vivre · partir · finir …",
             params={"count": 12, "sprint": 4, "only_sprint": True}, dims={"verbs": 1}),
    Activity("s4_speed", "Speed recognition", "vocabulary", 5, "drill", format="fr_to_es", target="all core, timed",
             params={"count": 20, "sprint": 4, "timed": True}, dims={"vocabulary": 1}),
    Activity("s4_es_fr", "Spanish → French · mixed", "vocabulary", 10, "drill", format="es_to_fr", target="S1–S4 core",
             params={"count": 12, "sprint": 4}, dims={"vocabulary": 0.8, "writing": 0.2}),
    Activity("s4_audio", "Rapid audio recognition", "listening", 5, "drill", format="audio_recognition", target="timed",
             params={"count": 15, "sprint": 4, "timed": True}, dims={"listening": 0.6, "vocabulary": 0.4}),
    Activity("s4_cloze", "Cloze · depuis / pendant / negations", "grammar", 5, "drill", format="cloze", target="jamais · rien · plus",
             params={"count": 10, "sprint": 4}, dims={"grammar": 1}),
    Activity("s4_dictation", "Dictation · dialogue excerpt", "listening", 10, "drill", format="dictation", target="short dialogue",
             params={"count": 4, "level": 4, "sprint": 4}, dims={"listening": 0.7, "writing": 0.3}),
    Activity("s4_comprehension", "Audio comprehension · mixed", "listening", 5, "drill", format="audio_comprehension",
             target="3 tenses", params={"count": 8, "sprint": 4}, dims={"listening": 1}),
    Activity("s4_shadow", "Shadowing", "pronunciation", 5, "drill", format="read_aloud", target="known text only",
             params={"target": "shadowing", "count": 4}, dims={"pronunciation": 0.5, "speaking": 0.5}),
    Activity("s4_repair", "Interference repair · all", "grammar", 5, "drill", format="error_repair", target="your log",
             params={"count": 8, "sprint": 4}, dims={"grammar": 1}),
    Activity("s4_questions", "10 known questions · fast", "speaking", 5, "drill", format="timed_fluency", target="no pauses",
             params={"count": 10, "sprint": 4, "timed": True}, dims={"speaking": 1}),
    Activity("s4_432", "4/3/2 retelling", "speaking", 10, "self", target="60 s → 45 s → 30 s", params={"task": "retell_432"},
             dims={"speaking": 1}),
    Activity("s4_conversation", "5-minute conversation", "speaking", 15, "self", target="constrained topics", params={"task": "five_minutes"},
             dims={"speaking": 1}),
    Activity("s4_writing", "Write 100–150 words", "writing", 20, "self", target="self · life · recent · plans", params={"task": "writing_150"},
             dims={"writing": 1}),
    Activity("s4_read_aloud", "Read a new A1 passage aloud", "reading", 10, "llm", format="reading", target="decode + explain",
             params={"count": 1, "sprint": 4, "read_aloud": True}, dims={"reading": 0.6, "pronunciation": 0.4}),
    Activity("s4_llm_dialogue", "Micro-dialogue (AI) · mixed", "speaking", 10, "llm", format="micro_dialogue", target="opinions · plans · past",
             params={"count": 5, "sprint": 4}, dims={"speaking": 0.5, "grammar": 0.5}),
    Activity("s4_llm_cognates", "Cognate mining (AI)", "reading", 10, "llm", format="cognate_mining", target="infer before translating",
             params={"count": 1, "sprint": 4}, dims={"reading": 0.7, "vocabulary": 0.3}),
    Activity("s4_llm_repair", "Error repair (AI, fresh)", "grammar", 8, "llm", format="error_repair", target="your recurring errors",
             params={"count": 8, "sprint": 4}, dims={"grammar": 1}),
    Activity("s4_fci", "FCI · longer video", "listening", 20, "external", resource="fci", target="transcript after", dims={"listening": 1}),
    Activity("s4_alice", "Alice Ayel · story", "listening", 15, "external", resource="alice", target="1 story", dims={"listening": 1}),
    Activity("s4_tv5", "TV5 · any A1", "listening", 15, "external", resource="tv5", target="1 clip", dims={"listening": 1}),
    Activity("s4_text", "Text study · authentic", "reading", 25, "text", target="one text", dims={"reading": 1}),
    Activity("s4_test", "Month 1 mastery test", "grammar", 45, "test", target="all dimensions"),
)

S4_CRITERIA = (
    Criterion("speaking", "~5 min constrained conversation in French", "speaking"),
    Criterion("reading", "read a new A1 passage aloud + explain it", "reading"),
    Criterion("listening", "clip: gist → questions → transcript → missed words", "listening"),
    Criterion("writing", "100–150 words: self · life · recent · plans", "writing"),
    Criterion("vocabulary", "~240–300 Core words usable", "vocab"),
    Criterion("verbs", "~20–25 key verbs · 3 tenses", "verbs"),
    Criterion("grammar", "questions · negation · present / near future / past", "grammar"),
    Criterion("pronunciation", "basic rules · sound contrasts", "pronunciation"),
)

SPRINTS: tuple[Sprint, ...] = (
    Sprint(1, "Foundation", "Crack the sound system · first sentence engine",
           weights={"pronunciation": 0.25, "vocabulary": 0.2, "verbs": 0.2, "grammar": 0.15, "listening": 0.1, "speaking": 0.1},
           grammar=S1_GRAMMAR, resources=S1_RESOURCES, activities=S1_ACTIVITIES, criteria=S1_CRITERIA,
           output_targets=("60 s self-introduction", "answer ~10 basic spoken questions", "ask 5 useful questions"),
           listening_target=5, output_target=2),
    Sprint(2, "Generate", "Turn a small vocabulary into many things you can say",
           weights={"grammar": 0.25, "verbs": 0.2, "vocabulary": 0.2, "speaking": 0.15, "pronunciation": 0.1, "listening": 0.1},
           grammar=S2_GRAMMAR, resources=S2_RESOURCES, activities=S2_ACTIVITIES, criteria=S2_CRITERIA,
           output_targets=("2-minute self-description", "3 plans with aller + infinitif", "likes / dislikes · want / can / must"),
           listening_target=6, output_target=3),
    Sprint(3, "Past & speech", "Describe what happened · hear real spoken French",
           weights={"grammar": 0.2, "verbs": 0.2, "listening": 0.2, "vocabulary": 0.15, "speaking": 0.15, "pronunciation": 0.1},
           grammar=S3_GRAMMAR, resources=S3_RESOURCES, activities=S3_ACTIVITIES, criteria=S3_CRITERIA,
           output_targets=("2–3 min story about yesterday", "ask what someone did", "past + present + future in one answer"),
           listening_target=6, output_target=3),
    Sprint(4, "Consolidate", "Stop collecting rules · make existing French interact",
           weights={"vocabulary": 0.2, "grammar": 0.1, "verbs": 0.1, "listening": 0.2, "speaking": 0.2, "reading": 0.1, "pronunciation": 0.1},
           grammar=S4_GRAMMAR, resources=S4_RESOURCES, activities=S4_ACTIVITIES, criteria=S4_CRITERIA,
           output_targets=("5-minute conversation", "4/3/2 retelling", "100–150 written words"),
           listening_target=8, output_target=3),
)

SPRINT_BY_NUMBER: dict[int, Sprint] = {s.number: s for s in SPRINTS}
ALL_ACTIVITIES: dict[str, Activity] = {a.id: a for s in SPRINTS for a in s.activities}
ALL_GRAMMAR: dict[str, GrammarTarget] = {g.id: g for s in SPRINTS for g in s.grammar}


def grammar_through_sprint(sprint: int) -> list[GrammarTarget]:
    return [g for s in SPRINTS if s.number <= sprint for g in s.grammar]
