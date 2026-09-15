"""Deterministic exercise engine.

Every builder returns a list of *exercise dicts* in one shared shape — the
same shape LLM-generated exercises are validated into — so the practice
runner and the mastery pipeline never care where an item came from.

    {
      id, format, kind (mc | typed | self), sprint, skill, dims, source,
      instructions, prompt, prompt_es, hint,
      audio: {language, text} | None, audio_only, autoplay,
      options: [{id, text, audio}], answer_id,           # mc
      accepted: [str],                                   # typed
      reveal: str,                                       # self
      explanation, refs: [{ref, label}], target_ids,
      difficulty, transformation, pattern, group, meta
    }

Item selection is weakest-first: a `VocabPool` carries per-item mastery so
the engine leans on what is least known without an LLM.
"""

from __future__ import annotations

import random
import re
import uuid
from dataclasses import dataclass, field, replace

from app.curriculum.pronunciation import PRON_BY_ID, PronTarget
from app.curriculum.sentences import (
    COGNATE_PARAGRAPH,
    DIALOGUES,
    FRAMES,
    FUTURE_TIMES,
    NEUTRAL_TIMES,
    PAST_TIMES,
    QUESTIONS,
    READINGS,
    REPAIRS,
    SELF_TASKS,
    TIME_ES,
    Frame,
)
from app.curriculum.sprints import ALL_GRAMMAR
from app.curriculum.verbs import CORE_VERBS, CORE_VERBS_BY_INF, PERSONS, CoreVerb, verbs_through_sprint
from app.curriculum.articles import noun_accepted, noun_display, split_forms, strip_article
from app.curriculum.vocab import VOCAB, VocabItem
from app.services.learning.grammar import (
    PRODUCTIVE_SUBJECTS,
    SUBJECTS,
    SentenceSpec,
    accepted_fr,
    render_es,
    render_fr,
    subject_label,
    verb_info,
)

REF_TITLES = {
    "pronunciation": "Pronunciation", "spelling": "Spelling → sound", "transfer": "ES → FR transfer",
    "core-verbs": "Core verbs", "sentence-architecture": "Sentence architecture", "questions": "Questions & repair",
    "articles": "Articles & prepositions", "tense-map": "Tense map", "pronouns": "Pronouns",
    "spoken-french": "Spoken French", "numbers": "Numbers & time", "interference": "Interference log",
}


def ref_link(ref: str) -> dict:
    sheet, _, section = ref.partition("#")
    label = REF_TITLES.get(sheet, sheet)
    if section:
        label = f"{label} · {section.replace('-', ' ')}"
    return {"ref": ref, "label": label}


def _id() -> str:
    return uuid.uuid4().hex[:12]


def _fr_audio(text: str) -> dict:
    return {"language": "fr", "text": text}


def _base(fmt: str, kind: str, sprint: int, skill: str, dims: dict, **kw) -> dict:
    ex = {
        "id": _id(), "format": fmt, "kind": kind, "sprint": sprint, "skill": skill, "dims": dims,
        "source": "deterministic", "instructions": "", "prompt": "", "prompt_es": "", "hint": "",
        "audio": None, "audio_only": False, "autoplay": False, "options": [], "answer_id": None,
        "accepted": [], "reveal": "", "explanation": "", "refs": [], "target_ids": [],
        "difficulty": 1, "transformation": "", "pattern": "", "group": "", "meta": {},
    }
    ex.update(kw)
    return ex


def _mc_options(rng: random.Random, correct: str, distractors: list[str], *, audio: bool = False, n: int = 4,
                keep_first: bool = False) -> tuple[list[dict], str]:
    """`keep_first` pins distractors[0] into the option set (the rest are shuffled in)."""
    pool = [d for d in dict.fromkeys(distractors) if d and d != correct]
    pinned = pool[:1] if keep_first and pool else []
    pool = pool[len(pinned):]
    rng.shuffle(pool)
    texts = [correct, *pinned, *pool[: n - 1 - len(pinned)]]
    rng.shuffle(texts)
    options = []
    answer_id = ""
    for i, text in enumerate(texts):
        oid = "abcdef"[i]
        options.append({"id": oid, "text": text, "audio": _fr_audio(text) if audio else None})
        if text == correct:
            answer_id = oid
    return options, answer_id


# ---------------------------------------------------------------------------
# vocabulary pool
# ---------------------------------------------------------------------------


@dataclass
class PoolItem:
    id: str  # curriculum id or "v:<db id>"
    french: str
    spanish: str
    english: str
    pos: str
    gender: str
    ipa: str
    sprint: int
    status: str
    example_fr: str
    example_es: str
    spanish_connection: str
    pronunciation_warning: str
    refs: list[str]
    mastery: dict = field(default_factory=dict)  # dim → 0..1
    attempts: int = 0
    priority: int = 2

    @property
    def french_forms(self) -> list[str]:
        forms = [f.strip() for f in re.split(r"\s*/\s*", self.french) if f.strip()]
        # "le / la / les" style entries also accept the whole string
        return list(dict.fromkeys([*forms, self.french.strip()]))

    @property
    def headword(self) -> str:
        return self.french_forms[0]

    @property
    def is_noun(self) -> bool:
        return self.pos == "noun" and bool(self.gender)

    @property
    def display(self) -> str:
        """What the learner sees and hears: nouns carry their article."""
        return noun_display(self.french, self.gender, self.pos)

    @property
    def display_head(self) -> str:
        return split_forms(self.display)[0]

    @property
    def bare_head(self) -> str:
        return strip_article(self.display_head)[1]

    @property
    def accepted_forms(self) -> list[str]:
        """Typed answers that count; nouns must include a gender-bearing article."""
        return noun_accepted(self.french, self.gender, self.pos) or self.french_forms

    @property
    def spanish_short(self) -> str:
        return re.split(r"\s*/\s*", self.spanish)[0].strip()


def pool_from_curriculum(sprint: int, *, statuses: tuple[str, ...] = ("core",), only_sprint: bool = False) -> list[PoolItem]:
    items = [i for i in VOCAB if (i.sprint == sprint if only_sprint else i.sprint <= sprint) and i.status in statuses]
    return [pool_item_from_vocab(i) for i in items]


def pool_item_from_vocab(i: VocabItem) -> PoolItem:
    return PoolItem(
        id=i.id, french=i.french, spanish=i.spanish, english=i.english, pos=i.part_of_speech, gender=i.gender, ipa=i.ipa,
        sprint=i.sprint, status=i.status, example_fr=i.example_fr, example_es=i.example_es,
        spanish_connection=i.spanish_connection, pronunciation_warning=i.pronunciation_warning,
        refs=list(i.reference_links), priority=i.priority,
    )


def _weighted_sample(rng: random.Random, items: list[PoolItem], k: int, dim: str) -> list[PoolItem]:
    """Weakest-first, but random: weight = (1 - mastery) + small floor, boosted for unseen."""
    if not items:
        return []
    k = min(k, len(items))
    weights = []
    for it in items:
        m = it.mastery.get(dim, 0.0)
        w = (1.0 - m) + 0.15
        if it.attempts == 0:
            w += 0.5
        if it.priority == 1:
            w += 0.2
        weights.append(w)
    chosen: list[PoolItem] = []
    pool = list(items)
    ws = list(weights)
    for _ in range(k):
        total = sum(ws)
        r = rng.random() * total
        acc = 0.0
        for idx, w in enumerate(ws):
            acc += w
            if acc >= r:
                chosen.append(pool.pop(idx))
                ws.pop(idx)
                break
    return chosen


def _distractors(rng: random.Random, item: PoolItem, pool: list[PoolItem], attr: str, n: int = 6) -> list[str]:
    same_pos = [getattr(p, attr) for p in pool if p.id != item.id and p.pos == item.pos]
    others = [getattr(p, attr) for p in pool if p.id != item.id and p.pos != item.pos]
    rng.shuffle(same_pos)
    rng.shuffle(others)
    return [*same_pos, *others][:n]


def _vocab_explanation(item: PoolItem) -> str:
    bits = [f"{item.display} {item.ipa}".strip(), f"= {item.spanish}"]
    if item.english:
        bits.append(f"({item.english})")
    if item.example_fr:
        bits.append(f"· {item.example_fr}")
        if item.example_es:
            bits.append(f"— {item.example_es}")
    if item.spanish_connection:
        bits.append(f"· {item.spanish_connection}")
    if item.pronunciation_warning:
        bits.append(f"· ⚠ {item.pronunciation_warning}")
    return " ".join(bits)


def _vocab_refs(item: PoolItem) -> list[dict]:
    return [ref_link(r) for r in item.refs[:3]]


# ---------------------------------------------------------------------------
# lexical formats
# ---------------------------------------------------------------------------


def fr_to_es(rng: random.Random, pool: list[PoolItem], sprint: int, count: int, timed: bool = False) -> list[dict]:
    out = []
    for item in _weighted_sample(rng, pool, count, "recognition"):
        options, answer = _mc_options(rng, item.spanish_short, [PoolItem.spanish_short.fget(p) for p in _pool_distractors(rng, item, pool)])
        out.append(_base(
            "fr_to_es", "mc", sprint, "vocabulary", {"vocabulary": 1.0}, instructions="→ español",
            prompt=item.display, hint=item.ipa, audio=_fr_audio(item.display_head), autoplay=True,
            options=options, answer_id=answer, explanation=_vocab_explanation(item), refs=_vocab_refs(item),
            target_ids=[item.id], meta={"dim": "recognition", "timed": timed},
        ))
    return out


def _pool_distractors(rng: random.Random, item: PoolItem, pool: list[PoolItem], n: int = 6) -> list[PoolItem]:
    same = [p for p in pool if p.id != item.id and p.pos == item.pos]
    others = [p for p in pool if p.id != item.id and p.pos != item.pos]
    rng.shuffle(same)
    rng.shuffle(others)
    return [*same, *others][:n]


def es_to_fr(rng: random.Random, pool: list[PoolItem], sprint: int, count: int) -> list[dict]:
    out = []
    for item in _weighted_sample(rng, pool, count, "written_production"):
        hint = "" if item.is_noun else item.pos
        out.append(_base(
            "es_to_fr", "typed", sprint, "vocabulary", {"vocabulary": 0.8, "writing": 0.2}, instructions="→ français",
            prompt=item.spanish_short if item.is_noun else item.spanish, hint=hint, accepted=item.accepted_forms, explanation=_vocab_explanation(item),
            refs=_vocab_refs(item), target_ids=[item.id], difficulty=2,
            meta={"dim": "written_production", "speak_after": item.display_head, "article_required": item.is_noun},
        ))
    return out


def audio_recognition(rng: random.Random, pool: list[PoolItem], sprint: int, count: int, timed: bool = False) -> list[dict]:
    out = []
    for item in _weighted_sample(rng, pool, count, "audio_recognition"):
        options, answer = _mc_options(rng, item.spanish_short, [p.spanish_short for p in _pool_distractors(rng, item, pool)])
        out.append(_base(
            "audio_recognition", "mc", sprint, "listening", {"listening": 0.6, "vocabulary": 0.4}, instructions="Écoute → significado",
            prompt=item.display, audio=_fr_audio(item.display_head), audio_only=True, autoplay=True,
            options=options, answer_id=answer, explanation=_vocab_explanation(item), refs=_vocab_refs(item),
            target_ids=[item.id], meta={"dim": "audio_recognition", "timed": timed},
        ))
    return out


def _blank(sentence: str, forms: list[str]) -> tuple[str, str] | None:
    """Replace the first whole-word occurrence of any form with ___ (case-insensitive).

    Forms that start with an article swallow it too, so the blank tests
    gender: "Je suis à la maison." → "Je suis à ___."
    """
    for form in sorted(forms, key=len, reverse=True):
        if len(form) < 2:
            continue
        pattern = re.compile(r"(?<![\w'])" + re.escape(form) + r"(?![\w])", re.IGNORECASE)
        m = pattern.search(sentence)
        if m:
            return sentence[: m.start()] + "___" + sentence[m.end():], m.group(0)
    return None


def _cloze_forms(item: PoolItem) -> list[str]:
    """Article-bearing forms first so the blank prefers them; bare forms as fallback."""
    if not item.is_noun:
        return item.french_forms
    articled = [f"{article} {form}" for form in item.french_forms for article in ("le", "la", "l'", "les", "un", "une", "des")]
    articled = [f.replace("l' ", "l'") for f in articled]
    return [*articled, *item.french_forms]


def _swap_article(answer: str, gender: str) -> str:
    """The same noun with the wrong-gender article - the sharpest cloze distractor."""
    article, word = strip_article(answer)
    if not article or not word:
        return ""
    swapped = {"le": "la", "la": "le", "un": "une", "une": "un"}.get(article)
    return f"{swapped} {word}" if swapped else ""


def cloze(rng: random.Random, pool: list[PoolItem], sprint: int, count: int) -> list[dict]:
    candidates = [p for p in pool if p.example_fr and _blank(p.example_fr, _cloze_forms(p))]
    out = []
    for item in _weighted_sample(rng, candidates, count, "contextual_use"):
        blanked = _blank(item.example_fr, _cloze_forms(item))
        if not blanked:
            continue
        sentence, answer_form = blanked
        answer_has_article = bool(strip_article(answer_form)[0])
        distractors = [
            (p.display_head if answer_has_article else p.headword)
            for p in _pool_distractors(rng, item, candidates, 8)
            if p.headword.lower() != item.headword.lower()
        ]
        wrong_gender = _swap_article(answer_form, item.gender) if answer_has_article else ""
        if wrong_gender:
            distractors = [wrong_gender, *distractors]
        options, answer = _mc_options(rng, answer_form, distractors, keep_first=bool(wrong_gender))
        out.append(_base(
            "cloze", "mc", sprint, "vocabulary", {"vocabulary": 0.6, "grammar": 0.4}, instructions="Complète",
            prompt=sentence, prompt_es=item.example_es, options=options, answer_id=answer,
            explanation=_vocab_explanation(item), refs=_vocab_refs(item), target_ids=[item.id],
            meta={"dim": "contextual_use", "speak_after": item.example_fr, "article_required": answer_has_article},
        ))
    return out


def listen_and_type(rng: random.Random, pool: list[PoolItem], sprint: int, count: int) -> list[dict]:
    """Hear the bare word, type it with its article - spelling from sound, gender from memory."""
    out = []
    for item in _weighted_sample(rng, pool, count, "audio_recognition"):
        out.append(_base(
            "dictation", "typed", sprint, "listening", {"listening": 0.5, "vocabulary": 0.5}, instructions="Écoute → écris",
            prompt=item.display_head, audio=_fr_audio(item.bare_head), audio_only=True, autoplay=True,
            accepted=item.accepted_forms, explanation=_vocab_explanation(item), refs=_vocab_refs(item), target_ids=[item.id],
            meta={"dim": "audio_recognition", "dictation": True, "article_required": item.is_noun, "speak_after": item.display_head},
        ))
    return out


def vocabulary_lesson(rng: random.Random, pool: list[PoolItem], sprint: int, count: int = 8) -> list[dict]:
    """One coherent word batch, each round adding one demand:

    meet → recognize (MC) → hear & spell with article (typed) → pick it into a
    sentence frame (MC, article inside the blank) → produce from Spanish (typed).
    The intro cards are the only place the article is shown before a test.
    The shared runner adds one retry round for missed prompts.
    """
    unseen = [item for item in pool if item.attempts == 0]
    batch = _weighted_sample(rng, unseen, count, "recognition")
    if len(batch) < count:
        remaining = [item for item in pool if item.id not in {chosen.id for chosen in batch}]
        batch.extend(_weighted_sample(rng, remaining, count - len(batch), "recognition"))
    if not batch:
        return []

    introductions = [
        _base(
            "vocab_intro", "intro", sprint, "vocabulary", {},
            instructions="Meet the words", prompt=item.display, prompt_es=item.spanish,
            hint=item.ipa, audio=_fr_audio(item.display_head), autoplay=True,
            explanation=_vocab_explanation(item), refs=_vocab_refs(item), target_ids=[item.id],
            group="vocab-lesson", meta={"lesson_stage": "Meet the words", "gender": item.gender if item.is_noun else ""},
        )
        for item in batch
    ]
    rounds = [
        ("1 / 4 · Recognize", fr_to_es(rng, batch, sprint, len(batch))),
        ("2 / 4 · Listen & write", listen_and_type(rng, batch, sprint, len(batch))),
        ("3 / 4 · Use in context", cloze(rng, batch, sprint, len(batch))),
        ("4 / 4 · Produce", es_to_fr(rng, batch, sprint, len(batch))),
    ]
    out: list[dict] = introductions
    for stage, exercises in rounds:
        for exercise in exercises:
            exercise["instructions"] = stage
            exercise["group"] = "vocab-lesson"
            exercise["meta"] = {**exercise.get("meta", {}), "lesson_stage": stage, "retry_missed": True}
            out.append(exercise)
    return out


def audio_comprehension(rng: random.Random, pool: list[PoolItem], sprint: int, count: int) -> list[dict]:
    candidates = [p for p in pool if p.example_fr and p.example_es]
    out = []
    for item in _weighted_sample(rng, candidates, count, "audio_recognition"):
        distractors = [p.example_es for p in _pool_distractors(rng, item, candidates, 8)]
        options, answer = _mc_options(rng, item.example_es, distractors)
        out.append(_base(
            "audio_comprehension", "mc", sprint, "listening", {"listening": 1.0}, instructions="Écoute → ¿qué significa?",
            prompt=item.example_fr, audio=_fr_audio(item.example_fr), audio_only=True, autoplay=True,
            options=options, answer_id=answer, explanation=f"{item.example_fr} — {item.example_es} · {item.display} = {item.spanish}",
            refs=_vocab_refs(item), target_ids=[item.id], difficulty=2, meta={"dim": "audio_recognition"},
        ))
    return out


def dictation(rng: random.Random, pool: list[PoolItem], sprint: int, count: int, level: int = 1) -> list[dict]:
    """Level 1 words · 2 one sentence · 3 two linked sentences · 4 dialogue lines."""
    out = []
    if level <= 1:
        for item in _weighted_sample(rng, pool, count, "audio_recognition"):
            out.append(_base(
                "dictation", "typed", sprint, "listening", {"listening": 0.7, "writing": 0.3}, instructions="Dictée · un mot",
                prompt=item.display_head, audio=_fr_audio(item.display_head), audio_only=True, autoplay=True,
                accepted=item.accepted_forms, explanation=_vocab_explanation(item), refs=_vocab_refs(item), target_ids=[item.id],
                meta={"dim": "audio_recognition", "dictation": True, "article_required": item.is_noun},
            ))
        return out
    if level == 2:
        candidates = [p for p in pool if p.example_fr and 3 <= len(p.example_fr.split()) <= 9]
        for item in _weighted_sample(rng, candidates, count, "audio_recognition"):
            out.append(_base(
                "dictation", "typed", sprint, "listening", {"listening": 0.7, "writing": 0.3}, instructions="Dictée · une phrase",
                prompt=item.example_fr, audio=_fr_audio(item.example_fr), audio_only=True, autoplay=True,
                accepted=[item.example_fr], explanation=f"{item.example_fr} — {item.example_es}", refs=_vocab_refs(item),
                target_ids=[item.id], difficulty=2, meta={"dim": "audio_recognition", "dictation": True},
            ))
        return out
    frames = [f for f in FRAMES if f.sprint <= sprint]
    for _ in range(count):
        if level == 3:
            a, b = rng.sample(frames, 2)
            sa = _random_spec(rng, a, sprint)
            sb = replace(_random_spec(rng, b, sprint), subject=sa.subject, question=None)
            text = f"{render_fr(sa)} {render_fr(sb)}"
            es = f"{render_es(sa)} {render_es(sb)}"
            targets = [f"frame:{a.id}", f"frame:{b.id}"]
        else:
            lines = rng.choice(DIALOGUES.get(min(sprint, 4), DIALOGUES[1]))
            text = f"{lines[0]} {rng.choice(lines[3])}"
            es = lines[1]
            targets = ["dialogue"]
        out.append(_base(
            "dictation", "typed", sprint, "listening", {"listening": 0.7, "writing": 0.3},
            instructions="Dictée · deux phrases" if level == 3 else "Dictée · dialogue", prompt=text, audio=_fr_audio(text),
            audio_only=True, autoplay=True, accepted=[text], explanation=es, target_ids=targets, difficulty=3,
            meta={"dictation": True},
        ))
    return out


# ---------------------------------------------------------------------------
# sentence transformation engine
# ---------------------------------------------------------------------------

TRANSFORMATIONS = ("person", "polarity", "question", "modality", "time", "tense_futur_proche", "tense_passe_compose",
                   "tense_present", "object_pronoun", "translate")
MODALS = ("vouloir", "pouvoir", "devoir")


def _times_for(frame: Frame, tense: str) -> list[str]:
    allowed = set(frame.times)
    if tense == "passe_compose":
        return [t for t in PAST_TIMES if t in allowed]
    if tense == "futur_proche":
        return [t for t in FUTURE_TIMES if t in allowed]
    return [t for t in (*FUTURE_TIMES, *NEUTRAL_TIMES) if t in allowed]


def _random_spec(rng: random.Random, frame: Frame, sprint: int, *, tense: str | None = None, subject: str | None = None) -> SentenceSpec:
    tenses = [t for t in frame.tenses if t != "passe_compose" or sprint >= 3]
    if not tenses:
        tenses = ["present"]
    tense = tense or (rng.choice(tenses) if rng.random() < 0.45 else "present")
    if tense not in tenses:
        tense = tenses[0]
    subject = subject or rng.choice([s for s in PRODUCTIVE_SUBJECTS if s in frame.subjects])
    times = _times_for(frame, tense)
    time = rng.choice(times) if times and rng.random() < 0.7 else None
    return SentenceSpec(frame=frame, subject=subject, tense=tense, time=time)


def _available_transformations(spec: SentenceSpec, sprint: int, allowed: list[str] | None) -> list[str]:
    frame = spec.frame
    ts: list[str] = ["person", "polarity", "question", "translate"]
    if frame.modal and frame.verb in MODALS and sprint >= 2:
        ts.append("modality")
    if len(_times_for(frame, spec.tense)) > 1 and spec.time:
        ts.append("time")
    if "futur_proche" in frame.tenses and spec.tense != "futur_proche" and sprint >= 2:
        ts.append("tense_futur_proche")
    if "passe_compose" in frame.tenses and spec.tense != "passe_compose" and sprint >= 3:
        ts.append("tense_passe_compose")
    if spec.tense != "present":
        ts.append("tense_present")
    if frame.obj and sprint >= 3 and not spec.pronoun and spec.tense in ("present", "passe_compose", "futur_proche"):
        ts.append("object_pronoun")
    if allowed:
        ts = [t for t in ts if t in allowed]
    return ts


def _apply(rng: random.Random, spec: SentenceSpec, transformation: str) -> tuple[SentenceSpec, str, str]:
    """Returns (new spec, instruction, grammar target id)."""
    frame = spec.frame
    if transformation == "person":
        choices = [s for s in PRODUCTIVE_SUBJECTS if s in frame.subjects and s != spec.subject]
        new = rng.choice(choices)
        return replace(spec, subject=new), f"→ {subject_label(new)}", "subject_pronouns"
    if transformation == "polarity":
        if spec.negative:
            return replace(spec, negative=False), "→ affirmatif", "negation"
        return replace(spec, negative=True), "→ négatif", "negation_modals" if frame.modal else "negation"
    if transformation == "question":
        if spec.question:
            return replace(spec, question=None), "→ affirmation", "questions_yesno"
        form = rng.choice(["est_ce_que", "intonation"])
        label = "→ question (est-ce que)" if form == "est_ce_que" else "→ question (intonation)"
        return replace(spec, question=form), label, "questions_yesno"
    if transformation == "modality":
        current = spec.main_verb
        new = rng.choice([m for m in MODALS if m != current])
        return replace(spec, verb=new), f"{current} → {new}", "modal_infinitive"
    if transformation == "time":
        options = [t for t in _times_for(frame, spec.tense) if t != spec.time]
        new = rng.choice(options)
        return replace(spec, time=new), f"{spec.time} → {new}", "past_time" if new in PAST_TIMES else "futur_proche"
    if transformation == "tense_futur_proche":
        times = _times_for(frame, "futur_proche")
        time = spec.time if spec.time in times else (rng.choice(times) if times else None)
        return replace(spec, tense="futur_proche", time=time), "→ futur proche", "futur_proche"
    if transformation == "tense_passe_compose":
        times = _times_for(frame, "passe_compose")
        time = spec.time if spec.time in times else (rng.choice(times) if times else None)
        aux = verb_info(spec.main_verb)["aux"]
        return replace(spec, tense="passe_compose", time=time), "→ passé composé", "passe_compose_etre" if aux == "être" else "passe_compose_avoir"
    if transformation == "tense_present":
        times = _times_for(frame, "present")
        time = spec.time if spec.time in times else (rng.choice(times) if times else None)
        return replace(spec, tense="present", time=time), "→ présent", "present_core4"
    if transformation == "object_pronoun":
        return replace(spec, pronoun=True), f"{frame.obj[0]} → pronom", "object_pronouns_1"
    raise ValueError(transformation)


def _transform_explanation(new: SentenceSpec, transformation: str, gid: str) -> str:
    g = ALL_GRAMMAR.get(gid)
    parts = [f"= {render_es(new)}"]
    if g and g.es:
        parts.append(f"· {g.es}")
    if new.negative and transformation == "polarity":
        parts.append("· ne + verbe conjugué + pas (à l'oral, 'ne' tombe)")
    if transformation == "question" and new.question == "est_ce_que":
        parts.append("· est-ce que + phrase, sans inversion")
    if transformation == "tense_passe_compose":
        aux = verb_info(new.main_verb)["aux"]
        parts.append(f"· auxiliaire {aux} + participe passé" + (" (accord avec le sujet)" if aux == "être" else ""))
    if transformation == "object_pronoun":
        parts.append("· le pronom se place devant le verbe conjugué (ou devant l'infinitif)")
    return " ".join(parts)


def sentence_transform(rng: random.Random, sprint: int, count: int, *, transformations: list[str] | None = None,
                       frames: list[Frame] | None = None, timed: bool = False) -> list[dict]:
    frames = frames or [f for f in FRAMES if f.sprint <= sprint]
    out = []
    attempts = 0
    while len(out) < count and attempts < count * 6:
        attempts += 1
        frame = rng.choice(frames)
        base = _random_spec(rng, frame, sprint)
        # chained: sometimes start from an already-transformed sentence
        if rng.random() < 0.3:
            options = [t for t in _available_transformations(base, sprint, None) if t not in ("translate",)]
            if options:
                base, _, _ = _apply(rng, base, rng.choice(options))
        available = _available_transformations(base, sprint, transformations)
        if not available:
            continue
        transformation = rng.choice(available)
        if transformation == "translate":
            new, instruction, gid = base, "→ français", (frame.grammar[0] if frame.grammar else "present_core4")
            prompt = render_es(base)
            prompt_es = ""
            base_fr = ""
        else:
            new, instruction, gid = _apply(rng, base, transformation)
            prompt = render_fr(base)
            prompt_es = render_es(base)
            base_fr = prompt
        accepted = accepted_fr(new)
        targets = [f"frame:{frame.id}", f"verb:{new.main_verb}", gid, *frame.grammar]
        out.append(_base(
            "sentence_transform", "typed", sprint, "grammar", {"grammar": 0.6, "verbs": 0.4},
            instructions=instruction, prompt=prompt, prompt_es=prompt_es, accepted=accepted,
            audio=_fr_audio(base_fr) if base_fr else None,
            explanation=_transform_explanation(new, transformation, gid),
            refs=[ref_link(ALL_GRAMMAR[gid].ref)] if gid in ALL_GRAMMAR else [ref_link("sentence-architecture")],
            target_ids=list(dict.fromkeys(targets)), difficulty=2 if transformation in ("person", "polarity", "translate") else 3,
            transformation=transformation, meta={"speak_after": accepted[0], "timed": timed, "base": base_fr},
        ))
    return out


def translation_ladder(rng: random.Random, sprint: int, count: int, *, family: str | None = None) -> list[dict]:
    """count ladders × 4–5 rungs, one construction explored structurally."""
    frames = [f for f in FRAMES if f.sprint <= sprint]
    if family == "venir_de":
        frames = [f for f in frames if not f.modal and "venir_de" not in f.tenses and f.sprint <= sprint] or frames
    out = []
    for _ in range(count):
        frame = rng.choice(frames)
        group = f"ladder-{_id()}"
        tense = "venir_de" if family == "venir_de" else "present"
        start = SentenceSpec(frame=frame, subject="1s", tense=tense, time=rng.choice(_times_for(frame, tense) or [None]))
        rungs: list[tuple[SentenceSpec, str]] = [(start, "affirmatif")]
        rungs.append((replace(start, negative=True), "négatif"))
        rungs.append((replace(start, subject="2s", question="est_ce_que"), "question"))
        rungs.append((replace(start, subject="on", time=rng.choice(_times_for(frame, tense) or [None])), "on / nous"))
        if "futur_proche" in frame.tenses and sprint >= 2 and tense == "present":
            rungs.append((replace(start, tense="futur_proche", time=rng.choice(_times_for(frame, "futur_proche") or [None])), "futur proche"))
        elif "passe_compose" in frame.tenses and sprint >= 3 and tense == "present":
            rungs.append((replace(start, tense="passe_compose", time=rng.choice(_times_for(frame, "passe_compose") or [None])), "passé composé"))
        for i, (spec, label) in enumerate(rungs, start=1):
            accepted = accepted_fr(spec)
            gid = frame.grammar[0] if frame.grammar else "present_core4"
            out.append(_base(
                "translation_ladder", "typed", sprint, "grammar", {"grammar": 0.5, "verbs": 0.3, "writing": 0.2},
                instructions=f"Échelle {i}/{len(rungs)} · {label}", prompt=render_es(spec), accepted=accepted,
                explanation=_transform_explanation(spec, label, gid), refs=[ref_link(ALL_GRAMMAR[gid].ref)] if gid in ALL_GRAMMAR else [],
                target_ids=[f"frame:{frame.id}", f"verb:{spec.main_verb}", *frame.grammar], difficulty=2, group=group,
                transformation="translate", meta={"speak_after": accepted[0]},
            ))
    return out


# ---------------------------------------------------------------------------
# verbs
# ---------------------------------------------------------------------------

PERSON_WEIGHTS = {"1s": 3, "2s": 3, "on": 3, "2p": 2, "3s": 1.5, "3sf": 1.5, "1p": 1, "3p": 1.5}


def verb_drill(rng: random.Random, sprint: int, count: int, *, tense: str | None = None, group: str | None = None,
               only_sprint: bool = False, mixed: bool = False, verbs: list[str] | None = None,
               verb_mastery: dict[str, float] | None = None) -> list[dict]:
    """Contextual conjugation: 'Tu ___ (avoir) faim ?' → 'as'."""
    if verbs:
        cv = [CORE_VERBS_BY_INF[v] for v in verbs if v in CORE_VERBS_BY_INF]
    else:
        cv = [v for v in CORE_VERBS if v.sprint == sprint] if only_sprint else verbs_through_sprint(sprint)
    if group:
        cv = [v for v in cv if v.group == group] or cv
    frames_by_verb: dict[str, list[Frame]] = {}
    for f in FRAMES:
        if f.sprint <= sprint:
            frames_by_verb.setdefault(f.verb, []).append(f)
    out = []
    mastery = verb_mastery or {}
    weights = [(1.2 - mastery.get(v.infinitive, 0.0)) for v in cv]
    subjects = list(PERSON_WEIGHTS)
    for _ in range(count):
        verb = rng.choices(cv, weights=weights, k=1)[0]
        subject = rng.choices(subjects, weights=[PERSON_WEIGHTS[s] for s in subjects], k=1)[0]
        frame = rng.choice(frames_by_verb.get(verb.infinitive) or [None])
        if tense == "passe_compose":
            t = "passe_compose"
        elif mixed and sprint >= 3:
            t = rng.choice(["present", "present", "futur_proche", "passe_compose"])
        elif mixed:
            t = rng.choice(["present", "present", "futur_proche"])
        else:
            t = "present"
        if frame is not None:
            if t not in frame.tenses:
                t = "present"
            spec = SentenceSpec(frame=frame, subject=subject, tense=t,
                                time=rng.choice(_times_for(frame, t) or [None]) if rng.random() < 0.5 else None)
            full = render_fr(spec)
            es = render_es(spec)
            # blank the verb group (finite + participle/infinitive) inside the sentence
            info = verb_info(verb.infinitive)
            idx = PERSONS.index(SUBJECTS[subject][2])
            if t == "present":
                answer = info["present"][idx]
            elif t == "futur_proche":
                answer = f"{verb_info('aller')['present'][idx]} {verb.infinitive}"
            else:
                aux = verb_info(info["aux"])["present"][idx]
                pp_spec = SentenceSpec(frame=frame, subject=subject, tense="passe_compose")
                from app.services.learning.grammar import _participle  # local: keep agreement logic in one place
                answer = f"{aux} {_participle(info, pp_spec)}"
            pattern = re.compile(r"(?<![\w'])" + re.escape(answer) + r"(?![\w])")
            m = pattern.search(full)
            if not m:
                # elided forms: j'ai / n'ai — fall back to bare-form blanking
                m = re.search(re.escape(answer.split()[0]), full)
            prompt = full[: m.start()] + "___" + full[m.end():] if m else full.replace(answer, "___")
            prompt = prompt.replace("J'___", "Je ___").replace("j'___", "je ___").replace("n'___", "ne ___").replace("l'___", "le ___")
            accepted = [answer]
            if t == "passe_compose" and info["aux"] == "être" and subject == "2p":
                accepted += [answer.rstrip("s"), answer.rstrip("s") + "e"]
            tense_label = {"present": "présent", "futur_proche": "futur proche", "passe_compose": "passé composé"}[t]
            out.append(_base(
                "verb_drill", "typed", sprint, "verbs", {"verbs": 1.0}, instructions=f"({verb.infinitive}) · {tense_label}",
                prompt=prompt, prompt_es=es, accepted=accepted,
                explanation=f"{full} — {es} · {verb.pronunciation}", refs=[ref_link(f"core-verbs#{verb.infinitive}")],
                target_ids=[f"verb:{verb.infinitive}", "present_core4" if sprint == 1 else f"verb_drill"],
                difficulty=1 if t == "present" else 2, meta={"speak_after": full, "person": subject, "tense": t},
            ))
        else:
            idx = PERSONS.index(SUBJECTS[subject][2])
            answer = verb.form(SUBJECTS[subject][2])
            out.append(_base(
                "verb_drill", "typed", sprint, "verbs", {"verbs": 1.0}, instructions=f"({verb.infinitive}) · présent",
                prompt=f"{subject_label(subject).capitalize()} ___", prompt_es=f"{verb.es_form(SUBJECTS[subject][3]) if subject != '2p' else verb.es_present[2]}",
                accepted=[answer], explanation=f"{subject_label(subject)} {answer} · {verb.pronunciation}",
                refs=[ref_link(f"core-verbs#{verb.infinitive}")], target_ids=[f"verb:{verb.infinitive}"],
                meta={"speak_after": f"{subject_label(subject)} {answer}", "person": subject, "tense": "present"},
            ))
    return out


# ---------------------------------------------------------------------------
# pronunciation
# ---------------------------------------------------------------------------


def pronunciation_ab(rng: random.Random, target: PronTarget, sprint: int, count: int, *, unseen: bool = False) -> list[dict]:
    pairs = list(target.unseen_pairs if unseen else target.pairs)
    if unseen and rng.random() < 0.3 and target.pairs:
        pairs += rng.sample(list(target.pairs), min(2, len(target.pairs)))
    out = []
    for i in range(count):
        a, b = pairs[i % len(pairs)] if i < len(pairs) else rng.choice(pairs)
        played = rng.choice([a, b])
        options = [{"id": "a", "text": a, "audio": None}, {"id": "b", "text": b, "audio": None}]
        out.append(_base(
            "pronunciation_ab", "mc", sprint, "pronunciation", {"pronunciation": 1.0}, instructions=f"{target.label} · ¿cuál oyes?",
            prompt=played, audio=_fr_audio(played), audio_only=True, autoplay=True, options=options,
            answer_id="a" if played == a else "b",
            explanation=f"{a} {target.sounds[0] if target.sounds else ''} · {b} {target.sounds[1] if len(target.sounds) > 1 else ''} — {target.note}",
            refs=[ref_link(target.ref)], target_ids=[f"pron:{target.id}"], meta={"unseen": unseen, "compare": [a, b]},
        ))
    return out


def pronunciation_3way(rng: random.Random, target: PronTarget, sprint: int, count: int, *, unseen: bool = False) -> list[dict]:
    triads = list(target.unseen_triads if unseen else target.triads)
    out = []
    for i in range(count):
        triad = triads[i % len(triads)] if i < len(triads) else rng.choice(triads)
        played = rng.choice(triad)
        options = [{"id": "abc"[j], "text": w, "audio": None} for j, w in enumerate(triad)]
        out.append(_base(
            "pronunciation_odd", "mc", sprint, "pronunciation", {"pronunciation": 1.0}, instructions=f"{target.label} · ¿cuál oyes?",
            prompt=played, audio=_fr_audio(played), audio_only=True, autoplay=True, options=options,
            answer_id="abc"[triad.index(played)],
            explanation=" · ".join(f"{w} {s}" for w, s in zip(triad, target.sounds)) + f" — {target.note}",
            refs=[ref_link(target.ref)], target_ids=[f"pron:{target.id}"], meta={"unseen": unseen, "compare": list(triad)},
        ))
    return out


def grapheme(rng: random.Random, target: PronTarget, sprint: int, count: int, *, unseen: bool = False, extra: list[str] | None = None) -> list[dict]:
    items = list(target.unseen_graphemes if unseen else target.graphemes)
    for tid in extra or []:
        t = PRON_BY_ID.get(tid)
        if t:
            items += list(t.unseen_graphemes if unseen else t.graphemes)
    rng.shuffle(items)
    out = []
    for word, g, correct, distractors in items[:count]:
        options, answer = _mc_options(rng, correct, list(distractors), n=min(4, 1 + len(distractors)))
        out.append(_base(
            "grapheme", "mc", sprint, "pronunciation", {"pronunciation": 0.7, "reading": 0.3},
            instructions=f"« {g} » dans", prompt=word, hint=g, options=options, answer_id=answer,
            explanation=f"{word}: {g} = {correct} — {target.note}", refs=[ref_link(target.ref)],
            target_ids=[f"pron:{target.id}"], meta={"unseen": unseen, "speak_after": word},
        ))
    return out


def liaison(rng: random.Random, target: PronTarget, sprint: int, count: int, *, unseen: bool = False) -> list[dict]:
    pairs = list(target.unseen_pairs if unseen else target.pairs)
    rng.shuffle(pairs)
    out = []
    if target.id == "spoken_reductions":
        for spoken, careful in pairs[:count]:
            distractors = [c for _, c in pairs if c != careful]
            options, answer = _mc_options(rng, careful, distractors, n=3)
            out.append(_base(
                "liaison", "mc", sprint, "listening", {"listening": 1.0}, instructions="À l'oral → à l'écrit",
                prompt=spoken, audio=_fr_audio(spoken), audio_only=True, autoplay=True, options=options, answer_id=answer,
                explanation=f"« {spoken} » = {careful} — {target.note}", refs=[ref_link(target.ref)],
                target_ids=[f"pron:{target.id}"], meta={"unseen": unseen},
            ))
        return out
    for phrase, label in pairs[:count]:
        options = [{"id": "a", "text": "liaison", "audio": None}, {"id": "b", "text": "pas de liaison", "audio": None}]
        out.append(_base(
            "liaison", "mc", sprint, "pronunciation", {"pronunciation": 0.6, "listening": 0.4}, instructions="Liaison ?",
            prompt=phrase, audio=_fr_audio(phrase), autoplay=True, options=options, answer_id="a" if label == "liaison" else "b",
            explanation=f"{phrase}: {label} — {target.note}", refs=[ref_link(target.ref)], target_ids=[f"pron:{target.id}"],
            meta={"unseen": unseen, "speak_after": phrase},
        ))
    return out


def read_aloud(rng: random.Random, target: PronTarget, sprint: int, count: int, *, unseen: bool = False) -> list[dict]:
    words = list(target.unseen_words if unseen else target.words)
    rng.shuffle(words)
    out = []
    for w in words[:count]:
        out.append(_base(
            "read_aloud", "self", sprint, "pronunciation", {"pronunciation": 0.7, "speaking": 0.3},
            instructions=f"{target.label} · lis à voix haute, puis compare", prompt=w, audio=_fr_audio(w), autoplay=False,
            reveal=target.note, explanation=target.note, refs=[ref_link(target.ref)], target_ids=[f"pron:{target.id}"],
            meta={"unseen": unseen, "self_scale": ["raté", "approximatif", "bien", "naturel"]},
        ))
    return out


def pronunciation_for(rng: random.Random, target_id: str, sprint: int, count: int, *, unseen: bool = False, extra: list[str] | None = None) -> list[dict]:
    target = PRON_BY_ID[target_id]
    if target.kind == "ab":
        return pronunciation_ab(rng, target, sprint, count, unseen=unseen)
    if target.kind == "odd":
        return pronunciation_3way(rng, target, sprint, count, unseen=unseen)
    if target.kind == "grapheme":
        return grapheme(rng, target, sprint, count, unseen=unseen, extra=extra)
    if target.kind == "liaison":
        return liaison(rng, target, sprint, count, unseen=unseen)
    return read_aloud(rng, target, sprint, count, unseen=unseen)


# ---------------------------------------------------------------------------
# speaking / self / repair / reading
# ---------------------------------------------------------------------------


def timed_fluency(rng: random.Random, sprint: int, count: int, *, timed: bool = False) -> list[dict]:
    bank = [q for s in range(1, sprint + 1) for q in QUESTIONS.get(s, ())]
    recent = list(QUESTIONS.get(sprint, ()))
    picks = rng.sample(recent, min(count, len(recent)))
    if len(picks) < count:
        rest = [q for q in bank if q not in picks]
        picks += rng.sample(rest, min(count - len(picks), len(rest)))
    out = []
    for fr, es in picks:
        out.append(_base(
            "timed_fluency", "self", sprint, "speaking", {"speaking": 0.7, "listening": 0.3},
            instructions="Écoute · réponds à voix haute", prompt=fr, prompt_es=es, audio=_fr_audio(fr), audio_only=True, autoplay=True,
            reveal=f"{fr} — {es}", target_ids=[f"q:{fr[:30]}"],
            meta={"timed": timed, "self_scale": ["rien", "avec effort", "ok", "fluide"]},
        ))
    return out


def self_task(task: str, sprint: int) -> list[dict]:
    t = SELF_TASKS[task]
    return [_base(
        "self_task", "self", sprint, next(iter(t["dims"])), t["dims"], instructions=t["title"],
        prompt="\n".join(f"• {s}" for s in t["steps"]), reveal="\n".join(t["frames"]), target_ids=[f"task:{task}"],
        meta={"task": task, "self_scale": ["pas fait", "difficile", "fait", "fluide"]},
    )]


def error_repair(rng: random.Random, sprint: int, count: int, log_items: list[dict] | None = None) -> list[dict]:
    """Curated interference traps first from the sprint, then the learner's own log (due first)."""
    curated = [r for r in REPAIRS if r[5] <= sprint]
    rng.shuffle(curated)
    out = []
    for item in (log_items or [])[: max(1, count // 2)]:
        out.append(_base(
            "error_repair", "typed", sprint, "grammar", {"grammar": 1.0}, instructions="Corrige",
            prompt=f"✗ {item['error']}", prompt_es=item.get("spanish_source", ""), accepted=[item["correct"]],
            explanation=item.get("explanation", ""), refs=[ref_link(item["ref"])] if item.get("ref") else [],
            target_ids=[f"interference:{item['id']}"], pattern=item.get("pattern", ""), difficulty=2,
            meta={"speak_after": item["correct"], "interference_id": item["id"]},
        ))
    for wrong, right, es_src, expl, ref, _s, pattern in curated:
        if len(out) >= count:
            break
        out.append(_base(
            "error_repair", "typed", sprint, "grammar", {"grammar": 1.0}, instructions="Corrige",
            prompt=f"✗ {wrong}", prompt_es=es_src, accepted=[right], explanation=expl, refs=[ref_link(ref)],
            target_ids=[f"repair:{pattern}"], pattern=pattern, difficulty=2, meta={"speak_after": right, "curated": True},
        ))
    return out


def reading(sprint: int) -> list[dict]:
    r = READINGS.get(min(sprint, 4), READINGS[1])
    group = f"reading-{_id()}"
    out = []
    for i, q in enumerate(r["questions"]):
        options = [{"id": "abcd"[j], "text": o, "audio": None} for j, o in enumerate(q["options"])]
        out.append(_base(
            "reading", "mc", sprint, "reading", {"reading": 0.7, "vocabulary": 0.3}, instructions=r["title"],
            prompt=q["q"], options=options, answer_id="abcd"[q["answer"]], explanation="", target_ids=[f"reading:{sprint}"],
            group=group, meta={"passage": r["text"], "passage_audio": True, "index": i},
        ))
    return out


def micro_dialogue(rng: random.Random, sprint: int, count: int) -> list[dict]:
    lines = list(DIALOGUES.get(min(sprint, 4), DIALOGUES[1]))
    rng.shuffle(lines)
    out = []
    for line, es, goal, samples in lines[:count]:
        out.append(_base(
            "micro_dialogue", "self", sprint, "speaking", {"speaking": 0.5, "grammar": 0.5}, instructions=f"Réponds · {goal}",
            prompt=f"— {line}", prompt_es=es, audio=_fr_audio(line), autoplay=True, reveal="\n".join(f"— {s}" for s in samples),
            target_ids=["dialogue"], meta={"self_scale": ["rien", "avec effort", "ok", "naturel"], "samples": list(samples)},
        ))
    return out


def cognate_mining(sprint: int) -> list[dict]:
    p = COGNATE_PARAGRAPH
    table = "\n".join(f"{fr} → {es} {ipa}" for fr, es, ipa in p["cognates"])
    return [_base(
        "cognate_mining", "self", sprint, "reading", {"reading": 0.7, "vocabulary": 0.3},
        instructions="Devine avant de traduire · marque ta confiance", prompt=p["text"], audio=_fr_audio(p["text"]),
        reveal=table, explanation="Cognates: same root, French final stress + silent endings — never Spanish pronunciation.",
        refs=[ref_link("transfer#cognates")], target_ids=["cognates"],
        meta={"self_scale": ["<50%", "~70%", "~85%", "tout"]},
    )]
