"""Deterministic drill engine: renderer, grading, builders, curriculum integrity."""

import random

from app.curriculum.pronunciation import PRON_TARGETS
from app.curriculum.sentences import FRAMES, FRAMES_BY_ID, REPAIRS
from app.curriculum.sprints import ALL_ACTIVITIES, ALL_GRAMMAR, SPRINTS
from app.curriculum.verbs import CORE_VERBS
from app.curriculum.vocab import VOCAB, items_for_sprint
from app.services.learning import drills
from app.services.learning.context import allowed_vocabulary, unknown_ratio
from app.services.learning.grammar import SentenceSpec, accepted_fr, render_es, render_fr, verb_info
from app.services.learning.llm_learning import _params_hash
from app.services.learning.text import check_typed, dictation_score, drop_ne, normalize


def spec(fid, **kw):
    return SentenceSpec(FRAMES_BY_ID[fid], **kw)


# --- curriculum integrity ---------------------------------------------------


def test_curriculum_counts_match_spec():
    core = {s: sum(1 for i in items_for_sprint(s) if i.status == "core") for s in range(1, 5)}
    assert 55 <= core[1] <= 75
    assert 60 <= core[2] <= 80
    assert 60 <= core[3] <= 80
    assert 45 <= core[4] <= 70
    assert len({i.id for i in VOCAB}) == len(VOCAB)
    assert [v.infinitive for v in CORE_VERBS if v.sprint == 1] == ["être", "avoir", "aller", "faire"]
    assert len([v for v in CORE_VERBS if v.sprint == 2]) == 8
    assert len([v for v in CORE_VERBS if v.sprint == 3]) == 10
    assert len([v for v in CORE_VERBS if v.sprint == 4]) == 10


def test_every_frame_verb_conjugates_and_grammar_ids_exist():
    for f in FRAMES:
        verb_info(f.verb)
        for g in f.grammar:
            assert g in ALL_GRAMMAR, (f.id, g)
    for s in SPRINTS:
        for a in s.activities:
            if a.kind == "external":
                assert a.resource
            if a.format in ("pronunciation_ab", "pronunciation_odd", "grapheme", "liaison", "read_aloud"):
                assert a.params["target"] in {t.id for t in PRON_TARGETS}, a.id


# --- renderer -------------------------------------------------------------


def test_render_basic_and_elision():
    assert render_fr(spec("s1_avoir_faim")) == "J'ai faim."
    assert render_fr(spec("s1_avoir_faim", negative=True)) == "Je n'ai pas faim."
    assert render_fr(spec("s2_habiter_ville", negative=True, subject="3s")) == "Il n'habite pas en ville."
    assert render_fr(spec("s2_vouloir_travailler", subject="2s", question="est_ce_que", time="demain")) == "Est-ce que tu veux travailler demain ?"
    assert render_fr(spec("s2_vouloir_travailler", subject="on", question="est_ce_que")) == "Est-ce qu'on veut travailler ?"


def test_render_tenses_and_agreement():
    assert render_fr(spec("s1_aller_bureau", tense="passe_compose", subject="3sf", time="hier")) == "Elle est allée au bureau hier."
    assert render_fr(spec("s1_aller_bureau", tense="passe_compose", subject="3p", negative=True)) == "Ils ne sont pas allés au bureau."
    assert render_fr(spec("s1_aller_bureau", tense="futur_proche", negative=True)) == "Je ne vais pas aller au bureau."
    assert render_fr(spec("s3_prendre_metro", tense="venir_de")) == "Je viens de prendre le métro."
    assert render_fr(spec("s1_etre_fatigue", subject="3sf")) == "Elle est fatiguée."
    assert render_fr(spec("s1_etre_pret", subject="3pf", negative=True)) == "Elles ne sont pas prêtes."
    assert render_fr(spec("s1_avoir_probleme", negative=True, subject="2s")) == "Tu n'as pas de problème."
    assert render_fr(spec("s2_chercher_appart", negative=True)) == "Je ne cherche pas d'appartement."


def test_render_object_pronouns():
    assert render_fr(spec("s3_voir_film", tense="passe_compose", pronoun=True)) == "Je l'ai vu."
    assert render_fr(spec("s3_voir_amis", tense="passe_compose", pronoun=True, negative=True)) == "Je ne les ai pas vus."
    assert render_fr(spec("s3_voir_film", tense="futur_proche", pronoun=True)) == "Je vais le voir."
    assert render_fr(spec("s3_comprendre_question", pronoun=True, negative=True)) == "Je ne la comprends pas."
    assert render_fr(spec("s2_aimer_cafe", pronoun=True)) == "Je l'aime."


def test_render_spanish_bridge():
    assert render_es(spec("s2_vouloir_travailler", time="demain")) == "Quiero trabajar mañana."
    assert render_es(spec("s2_vouloir_travailler", subject="3sf", negative=True)) == "(Ella) no quiere trabajar."
    assert render_es(spec("s3_voir_film", tense="passe_compose", pronoun=True)) == "Lo he visto."
    assert render_es(spec("s2_aimer_cafe", negative=True)) == "No me gusta el café."
    assert render_es(spec("s1_etre_fatigue", subject="3sf")) == "(Ella) está cansada."
    assert render_es(spec("s2_savoir_parler", subject="2p", question="est_ce_que")) == "¿(Usted) sabe hablar español?"


def test_accepted_variants():
    acc = accepted_fr(spec("s2_vouloir_travailler", subject="on", question="intonation"))
    assert "On veut travailler ?" in acc and "Est-ce qu'on veut travailler ?" in acc and "Nous voulons travailler ?" in acc
    acc = accepted_fr(spec("s1_aller_bureau", subject="2p", tense="passe_compose"))
    assert {"Vous êtes allés au bureau.", "Vous êtes allé au bureau.", "Vous êtes allée au bureau."} <= set(acc)


# --- grading ------------------------------------------------------------------


def test_check_typed_variants():
    acc = ["Je ne veux pas travailler demain."]
    assert check_typed("je ne veux pas travailler demain", acc)["score"] == 1.0
    r = check_typed("je ne veux pas travailler demain", ["Je ne veux pas travailler demain."])
    assert r["exact"]
    r = check_typed("Je ne veux pas travailler demain", acc)
    assert r["correct"]
    r = check_typed("je veux pas travailler demain", acc)
    assert r["correct"] and r["ne_dropped"] and r["score"] == 0.8
    r = check_typed("Je ne veux pas travailler demain !", acc)
    assert r["correct"]
    r = check_typed("j’ai faim", ["J'ai faim."])
    assert r["exact"]
    r = check_typed("Elle est fatiguee", ["Elle est fatiguée."])
    assert r["correct"] and r["accent_issue"] and r["score"] == 0.9
    r = check_typed("Je veux dormir", acc)
    assert not r["correct"]
    assert drop_ne("je n'ai pas faim") == "j'ai pas faim"
    assert normalize("Est-ce que tu viens ?") == "est-ce que tu viens"


def test_dictation_scoring():
    assert dictation_score("Je vais au bureau demain.", "je vais au bureau demain") == 1.0
    assert 0.5 < dictation_score("Je vais au bureau demain.", "je vais au bureau") < 1.0
    assert dictation_score("Je vais au bureau demain.", "") == 0.0


# --- builders ---------------------------------------------------------------


def test_builders_produce_valid_shapes():
    rng = random.Random(7)
    pool = drills.pool_from_curriculum(2, statuses=("core", "recognition"))
    batches = [
        drills.fr_to_es(rng, pool, 2, 8), drills.es_to_fr(rng, pool, 2, 8), drills.audio_recognition(rng, pool, 2, 6),
        drills.cloze(rng, pool, 2, 8), drills.audio_comprehension(rng, pool, 2, 6), drills.dictation(rng, pool, 2, 4, level=2),
        drills.dictation(rng, pool, 3, 3, level=3), drills.sentence_transform(rng, 2, 12), drills.sentence_transform(rng, 4, 12),
        drills.translation_ladder(rng, 2, 2), drills.verb_drill(rng, 2, 10), drills.verb_drill(rng, 3, 8, tense="passe_compose"),
        drills.verb_drill(rng, 4, 8, mixed=True), drills.timed_fluency(rng, 2, 6), drills.error_repair(rng, 3, 6),
        drills.reading(2), drills.micro_dialogue(rng, 2, 3), drills.cognate_mining(4), drills.self_task("three_plans", 2),
    ]
    for t in PRON_TARGETS:
        batches.append(drills.pronunciation_for(rng, t.id, t.sprint, 4))
        batches.append(drills.pronunciation_for(rng, t.id, t.sprint, 4, unseen=True))
    for batch in batches:
        assert batch, "empty batch"
        for ex in batch:
            assert ex["kind"] in ("mc", "typed", "self")
            assert ex["prompt"] or ex["audio"]
            if ex["kind"] == "mc":
                ids = [o["id"] for o in ex["options"]]
                assert ex["answer_id"] in ids and len(set(o["text"] for o in ex["options"])) == len(ids)
            if ex["kind"] == "typed":
                assert ex["accepted"] and all(a.strip() for a in ex["accepted"])
            assert ex["target_ids"]


def test_transform_targets_mark_grammar_and_verbs():
    rng = random.Random(3)
    for ex in drills.sentence_transform(rng, 3, 20):
        assert any(t.startswith("verb:") for t in ex["target_ids"])
        assert any(t in ALL_GRAMMAR for t in ex["target_ids"])
        assert ex["transformation"] in drills.TRANSFORMATIONS


def test_verb_drill_blank_matches_answer():
    rng = random.Random(11)
    for ex in drills.verb_drill(rng, 3, 30, mixed=True):
        assert "___" in ex["prompt"], ex
        full = ex["meta"]["speak_after"]
        assert ex["accepted"][0] in full or ex["accepted"][0].split()[-1] in full


def test_unseen_pronunciation_banks_are_disjoint():
    for t in PRON_TARGETS:
        assert not set(t.pairs) & set(t.unseen_pairs)
        assert not set(t.triads) & set(t.unseen_triads)
        assert not set(t.words) & set(t.unseen_words)


def test_curriculum_sentences_respect_known_language_budget():
    """The curated frames / examples for a sprint must be inside that sprint's allowed vocabulary."""
    for s in range(1, 5):
        allowed = allowed_vocabulary(s)
        for f in FRAMES:
            if f.sprint <= s:
                ratio, unknown = unknown_ratio(f.fr, allowed)
                assert ratio == 0.0, (f.id, unknown)
    allowed4 = allowed_vocabulary(4)
    for wrong, right, *_ in REPAIRS:
        ratio, unknown = unknown_ratio(right, allowed4)
        assert ratio <= 0.2, (right, unknown)


def test_activity_bank_covers_every_skill_per_sprint():
    for s in SPRINTS:
        skills = {a.skill for a in s.activities}
        assert {"vocabulary", "pronunciation", "grammar", "listening", "speaking"} <= skills, s.number
        buckets = {"short": 0, "medium": 0, "long": 0}
        for a in s.activities:
            buckets["short" if a.minutes <= 5 else "medium" if a.minutes <= 15 else "long"] += 1
        assert all(v > 0 for v in buckets.values()), s.number
    assert len(ALL_ACTIVITIES) > 90


def test_generated_drill_cache_separates_selected_sentences():
    first = _params_hash("sentence_transform", 2, [], 2, {"base_sentence": "Je vais au bureau."})
    second = _params_hash("sentence_transform", 2, [], 2, {"base_sentence": "Je reste à la maison."})
    assert first != second
