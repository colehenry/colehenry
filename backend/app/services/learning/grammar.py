"""Deterministic French (and bridge-Spanish) sentence renderer.

One `SentenceSpec` → one French sentence, with elision, negation, question
forms, futur proche, passé composé (auxiliary + agreement), venir de, and
first-layer object pronouns. The transformation engine changes one field of
the spec at a time and re-renders; nothing here needs an LLM.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

from app.curriculum.sentences import EXTRA_VERBS, TIME_ES, Frame
from app.curriculum.verbs import CORE_VERBS_BY_INF, PERSONS

VOWELS = "aeiouyhéèêëàâîïôûù"

# subject key → (french pronoun, spanish pronoun, conjugation person, es person, plural, feminine)
SUBJECTS: dict[str, tuple[str, str, str, str, bool, bool]] = {
    "1s": ("je", "", "1s", "1s", False, False),
    "2s": ("tu", "", "2s", "2s", False, False),
    "3s": ("il", "él", "3s", "3s", False, False),
    "3sf": ("elle", "ella", "3s", "3s", False, True),
    "on": ("on", "", "3s", "1p", False, False),
    "1p": ("nous", "", "1p", "1p", True, False),
    "2p": ("vous", "usted", "2p", "3s", True, False),  # ES: usted + 3s form
    "3p": ("ils", "ellos", "3p", "3p", True, False),
    "3pf": ("elles", "ellas", "3p", "3p", True, True),
}
PRODUCTIVE_SUBJECTS = ("1s", "2s", "on", "2p", "3s", "3sf", "1p", "3p")
ES_IR = ("voy", "vas", "va", "vamos", "vais", "van")
ES_HABER = ("he", "has", "ha", "hemos", "habéis", "han")
ES_CLITICS = ("me", "te", "se", "nos", "os", "se")


def verb_info(infinitive: str) -> dict:
    core = CORE_VERBS_BY_INF.get(infinitive)
    if core:
        return {
            "present": core.present, "participle": core.participle, "aux": core.auxiliary,
            "es": core.es_present, "es_inf": core.es_infinitive, "es_pp": core.es_participle,
        }
    extra = EXTRA_VERBS.get(infinitive)
    if extra is None:
        raise KeyError(f"no conjugation data for {infinitive!r}")
    return extra


def starts_with_vowel(word: str) -> bool:
    return bool(word) and word[0].lower() in VOWELS


def elide(particle: str, following: str) -> str:
    """je/ne/le/la/que/de + vowel → j'/n'/l'/qu'/d'."""
    if starts_with_vowel(following):
        return particle[:-1] + "'"
    return particle


@dataclass(frozen=True)
class SentenceSpec:
    frame: Frame
    subject: str = "1s"
    tense: str = "present"  # present | futur_proche | passe_compose | venir_de
    negative: bool = False
    question: str | None = None  # None | intonation | est_ce_que
    verb: str | None = None  # override (modal swap); defaults to frame.verb
    time: str | None = None
    pronoun: bool = False  # replace the object with le/la/les

    @property
    def main_verb(self) -> str:
        return self.verb or self.frame.verb


def _participle(info: dict, spec: SentenceSpec, agree_with_object: str | None = None) -> str:
    pp = info["participle"]
    if info["aux"] == "être":
        _, _, _, _, plural, fem = SUBJECTS[spec.subject]
        if spec.subject == "on":
            return pp
        if fem:
            pp += "e"
        if plural:
            pp += "s"
    elif agree_with_object:
        if agree_with_object == "la":
            pp += "e"
        elif agree_with_object == "les":
            pp += "s"
    return pp


def _agree_fr(frame: Frame, subject: str) -> str:
    m, f, _, _ = frame.agree
    _, _, _, _, plural, fem = SUBJECTS[subject]
    if subject == "on":
        return m
    word = f if fem else m
    return word + ("s" if plural and not word.endswith("s") else "")


def _agree_es(frame: Frame, subject: str) -> str:
    _, _, m, f = frame.agree
    _, _, _, _, plural, fem = SUBJECTS[subject]
    if subject == "on":
        return m + "s"
    if subject == "2p":
        return m  # usted
    word = f if fem else m
    return word + ("s" if plural and not word.endswith("s") else "")


def render_fr(spec: SentenceSpec, *, keep_ne: bool = True) -> str:
    frame = spec.frame
    pron, _, person, _, _, _ = SUBJECTS[spec.subject]
    idx = PERSONS.index(person)
    info = verb_info(spec.main_verb)

    complement = frame.fr
    obj_pronoun = ""
    if spec.pronoun and frame.obj:
        noun, _, obj_pronoun = frame.obj
        complement = complement.replace(noun, "").strip()
    if frame.agree:
        complement = _agree_fr(frame, spec.subject)
    if spec.negative:
        # un / une / des → de after a negated verb (pas de problème), not after être
        if spec.main_verb != "être":
            complement = re.sub(r"^(un|une|des)\s+", lambda m: "d'" if starts_with_vowel(complement.split(" ", 1)[1]) else "de ", complement)

    # verb group: [pronoun] finite [pas] [infinitive/participle]
    if spec.tense == "present":
        finite = info["present"][idx]
        tail = ""
    elif spec.tense == "futur_proche":
        finite = verb_info("aller")["present"][idx]
        tail = spec.main_verb
    elif spec.tense == "passe_compose":
        aux = verb_info(info["aux"])["present"][idx]
        finite = aux
        tail = _participle(info, spec, obj_pronoun if info["aux"] == "avoir" else None)
    elif spec.tense == "venir_de":
        finite = verb_info("venir")["present"][idx]
        tail = f"{elide('de', spec.main_verb)}{'' if starts_with_vowel(spec.main_verb) else ' '}{spec.main_verb}"
    else:
        raise ValueError(spec.tense)

    words: list[str] = []
    # object pronoun placement: before finite verb (present / passé composé),
    # before the infinitive with futur proche or a modal complement.
    pronoun_before_finite = bool(obj_pronoun) and spec.tense in ("present", "passe_compose") and not frame.modal
    pronoun_before_inf = bool(obj_pronoun) and not pronoun_before_finite

    group: list[str] = []
    if pronoun_before_finite:
        group.append(elide(obj_pronoun, finite) if obj_pronoun in ("le", "la") else obj_pronoun)
    group.append(finite)
    if spec.negative:
        group.append("pas")
    if tail:
        if pronoun_before_inf:
            group.append(elide(obj_pronoun, tail) if obj_pronoun in ("le", "la") else obj_pronoun)
        group.append(tail)
    if complement:
        if pronoun_before_inf and frame.modal and not tail:
            # modal in present: pronoun before the infinitive inside the complement
            inf, _, rest = complement.partition(" ")
            p = elide(obj_pronoun, inf) if obj_pronoun in ("le", "la") else obj_pronoun
            complement = f"{p}{'' if p.endswith(chr(39)) else ' '}{inf}{(' ' + rest) if rest else ''}"
        group.append(complement)

    # glue elided tokens (l' + verb) without spaces
    verb_phrase = " ".join(group)
    verb_phrase = re.sub(r"(\b[ldnqj]')\s+", r"\1", verb_phrase)

    if spec.negative and keep_ne:
        first = group[0]
        ne = elide("ne", first)
        verb_phrase = f"{ne}{'' if ne.endswith(chr(39)) else ' '}{verb_phrase}"

    subj = elide("je", verb_phrase) if pron == "je" else pron
    sentence = f"{subj}{'' if subj.endswith(chr(39)) else ' '}{verb_phrase}"
    if spec.time:
        sentence = f"{sentence} {spec.time}"
    sentence = sentence.strip()

    if spec.question == "est_ce_que":
        head = "Est-ce qu'" if starts_with_vowel(sentence) else "Est-ce que "
        sentence = f"{head}{sentence} ?"
    elif spec.question == "intonation":
        sentence = f"{sentence[0].upper()}{sentence[1:]} ?"
    else:
        sentence = f"{sentence[0].upper()}{sentence[1:]}."
    return sentence


def render_es(spec: SentenceSpec) -> str:
    frame = spec.frame
    _, es_pron, _, es_person, _, _ = SUBJECTS[spec.subject]
    idx = PERSONS.index(es_person)
    info = verb_info(spec.main_verb)
    es_inf: str = info["es_inf"]
    reflexive = es_inf.endswith("se") and es_inf not in ("clase",)

    complement = frame.es
    if frame.agree:
        complement = _agree_es(frame, spec.subject)
    obj = ""
    if spec.pronoun and frame.obj:
        noun, es_noun, pr = frame.obj
        complement = complement.replace(es_noun, "").strip()
        obj = {"le": "lo", "la": "la", "les": "los"}[pr]
        if pr == "les" and es_noun.endswith("as"):
            obj = "las"

    if spec.tense == "present":
        finite = info["es"][idx]
        if frame.agree and spec.main_verb == "être":
            finite = ("estoy", "estás", "está", "estamos", "estáis", "están")[idx]  # ser → estar for states
        tail = ""
    elif spec.tense == "futur_proche":
        finite = ES_IR[idx]
        tail = f"a {es_inf}"
    elif spec.tense == "passe_compose":
        clitic = f"{ES_CLITICS[idx]} " if reflexive else ""
        finite = f"{clitic}{ES_HABER[idx]}"
        tail = info["es_pp"]
    elif spec.tense == "venir_de":
        acabar = ("acabo", "acabas", "acaba", "acabamos", "acabáis", "acaban")[idx]
        finite = acabar
        tail = f"de {es_inf}"
    else:
        raise ValueError(spec.tense)

    # gustar frames already carry a dative clitic ("me gusta") — "Me gusta." = I like it.
    if "gust" in finite:
        obj = ""
    parts = []
    if obj and spec.tense in ("present", "passe_compose"):
        parts.append(obj)  # lo veo · lo he visto
    parts.append(finite)
    if tail:
        if obj and spec.tense in ("futur_proche", "venir_de"):
            tail = f"{tail}{obj}"  # voy a verlo
        parts.append(tail)
    if complement:
        parts.append(complement)
    core = " ".join(p for p in parts if p).strip()
    if spec.negative:
        core = f"no {core}"
    if spec.time:
        core = f"{core} {TIME_ES.get(spec.time, spec.time)}"
    core = core.strip()
    core = f"{core[0].upper()}{core[1:]}"
    if es_pron:
        core = f"({es_pron[0].upper()}{es_pron[1:]}) {core[0].lower()}{core[1:]}"
    if spec.question:
        return f"¿{core}?"
    return f"{core}."


def accepted_fr(spec: SentenceSpec) -> list[str]:
    """Canonical rendering plus legitimate alternatives for grading."""
    out = [render_fr(spec)]
    if spec.question is None:
        pass
    elif spec.question in ("intonation", "est_ce_que"):
        alt = "est_ce_que" if spec.question == "intonation" else "intonation"
        out.append(render_fr(replace(spec, question=alt)))
    if spec.subject == "on":
        out.append(render_fr(replace(spec, subject="1p")))
    elif spec.subject == "1p":
        out.append(render_fr(replace(spec, subject="on")))
    if spec.subject == "2p" and spec.tense == "passe_compose":
        # vous can be singular / feminine — accept every agreement
        base = render_fr(spec)
        for suffix in ("", "e", "es"):
            variant = re.sub(r"(\w+?)(és?)\b(?=[^\w]*(?:$|[^\w]))", lambda m: m.group(1) + "é" + suffix, base, count=1)
            if variant not in out:
                out.append(variant)
    if spec.subject == "2p" and spec.frame.agree:
        m, f, _, _ = spec.frame.agree
        base = render_fr(spec)
        for variant in (m, f, f + "s"):
            alt = base.replace(m + "s", variant, 1)
            if alt not in out:
                out.append(alt)
    # dedupe, keep order
    seen: set[str] = set()
    result = []
    for s in out:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


def subject_label(subject: str) -> str:
    return SUBJECTS[subject][0]
