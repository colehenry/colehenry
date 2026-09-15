"""Deterministic drill engine: renderer, grading, builders, curriculum integrity."""

import random

from app.curriculum.articles import noun_accepted, noun_display, wrong_article
from app.curriculum.pronunciation import PRON_TARGETS
from app.curriculum.sentences import FRAMES, FRAMES_BY_ID, REPAIRS
from app.curriculum.sprints import ALL_ACTIVITIES, ALL_GRAMMAR, SPRINTS
from app.curriculum.verbs import CORE_VERBS
from app.curriculum.vocab import VOCAB, items_for_sprint
from app.services.learning import drills
from app.services.learning.context import allowed_vocabulary, unknown_ratio
from app.services.learning.grammar import SentenceSpec, accepted_fr, render_es, render_fr, verb_info
from app.services.learning import llm_learning
from app.services.learning.llm_learning import _params_hash
from app.services.learning.mastery import KNOWN_THRESHOLD, PRODUCTIVE_THRESHOLD, ema
from app.services.learning.text import article_issue, check_typed, dictation_score, drop_ne, normalize


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


def test_vocabulary_lesson_delays_production_and_keeps_one_word_batch():
    rng = random.Random(17)
    pool = drills.pool_from_curriculum(1, statuses=("core",), only_sprint=True)
    lesson = drills.vocabulary_lesson(rng, pool, 1, 8)
    assert [exercise["kind"] for exercise in lesson[:8]] == ["intro"] * 8
    assert all(exercise["format"] != "es_to_fr" for exercise in lesson[:-8])
    assert lesson[-1]["format"] == "es_to_fr"
    targets = {target for exercise in lesson for target in exercise["target_ids"] if target.startswith("fr_")}
    assert len(targets) == 8
    assert all(exercise["meta"]["retry_missed"] for exercise in lesson[8:])


def test_every_productive_grammar_pattern_has_a_drill_that_evidences_it():
    """Progress bars only move on accuracy for patterns some drill tags; a pattern
    nothing emits is a bar that can never fill."""
    from app.curriculum.sentences import REPAIRS
    from app.services.learning.drills import PoolItem

    rng = random.Random(9)
    for s in SPRINTS:
        n = s.number
        pool = drills.pool_from_curriculum(n)
        emitted: set[str] = set()
        for _ in range(40):
            for exercises in (
                drills.sentence_transform(rng, n, 12), drills.translation_ladder(rng, n, 3, family="venir_de" if n == 3 else None),
                drills.error_repair(rng, n, len(REPAIRS)), drills.verb_drill(rng, n, 10), drills.cloze(rng, pool, n, 40),
                drills.timed_fluency(rng, n, 12, pool=pool),
            ):
                for exercise in exercises:
                    emitted.update(exercise["target_ids"])
        expected = {g.id for g in s.grammar if not g.recognition_only} - {"adjective_position"}
        missing = sorted(expected - emitted)
        assert not missing, f"S{n}: {missing}"
    # S1 pronunciation target folded into another activity still gets its own evidence
    ex = drills.pronunciation_for(rng, "silent_finals", 1, 40, extra=["final_ent"])
    assert {"pron:silent_finals", "pron:final_ent"} <= {t for e in ex for t in e["target_ids"]}


def test_recently_seen_words_are_damped():
    from dataclasses import replace as dc_replace
    from datetime import datetime, timedelta, timezone

    now = datetime(2026, 9, 15, 12, tzinfo=timezone.utc)
    pool = drills.pool_from_curriculum(1, only_sprint=True)[:2]
    fresh = dc_replace(pool[0], mastery={"recognition": 0.5}, attempts=3, last_seen_at=now - timedelta(hours=1))
    rested = dc_replace(pool[1], mastery={"recognition": 0.5}, attempts=3, last_seen_at=now - timedelta(days=1))
    picks = [drills._weighted_sample(random.Random(i), [fresh, rested], 1, "recognition", now)[0].id for i in range(200)]
    assert picks.count(rested.id) > picks.count(fresh.id) * 2


def test_vocabulary_lesson_rounds_alternate_mc_and_typed():
    rng = random.Random(5)
    pool = drills.pool_from_curriculum(2, statuses=("core",), only_sprint=True)
    lesson = drills.vocabulary_lesson(rng, pool, 2, 8)
    rounds = [exercise for exercise in lesson if exercise["kind"] != "intro"]
    by_stage: dict[str, set[str]] = {}
    for exercise in rounds:
        by_stage.setdefault(exercise["meta"]["lesson_stage"], set()).add(exercise["kind"])
    assert by_stage == {
        "1 / 4 · Recognize": {"mc"},
        "2 / 4 · Listen & write": {"typed"},
        "3 / 4 · Use in context": {"mc"},
        "4 / 4 · Produce": {"typed"},
    }
    listen = [exercise for exercise in rounds if exercise["meta"]["lesson_stage"].startswith("2")]
    for exercise in listen:
        # the audio is the bare word; the article must come from memory
        assert not any(exercise["audio"]["text"].startswith(f"{article} ") for article in ("le", "la", "un", "une", "les"))
        if exercise["meta"]["article_required"]:
            assert all(a.split()[0] in ("le", "la", "un", "une", "les", "des", "l'eau", "l'argent") for a in exercise["accepted"])


def test_nouns_always_carry_a_gendered_article():
    assert noun_display("maison", "f", "noun") == "la maison"
    assert noun_display("travail", "m", "noun") == "le travail"
    assert noun_display("heure", "f", "noun") == "une heure"
    assert noun_display("homme", "m", "noun") == "un homme"
    assert noun_display("ami / amie", "m", "noun") == "un ami / une amie"
    assert noun_display("gens", "m", "noun") == "les gens"
    assert noun_display("dimanche / samedi", "m", "noun") == "le dimanche / le samedi"
    assert noun_display("bonjour", "", "interj") == "bonjour"
    assert noun_accepted("maison", "f", "noun") == ["la maison", "une maison"]
    assert noun_accepted("faim", "f", "noun") == ["la faim"]
    for item in VOCAB:
        if item.part_of_speech == "noun":
            assert item.gender in ("m", "f"), item.id
            assert noun_display(item.french, item.gender, item.part_of_speech) != item.french, item.id


def test_article_grading_flags_missing_and_wrong_gender():
    assert wrong_article("la maison", "maison") == "missing"
    assert wrong_article("la maison", "le maison") == "genre"
    assert wrong_article("la maison", "une maison") == ""
    assert wrong_article("la maison", "la voiture") == ""
    assert article_issue("Le Maison", ["la maison", "une maison"]) == "genre"
    assert not check_typed("maison", ["la maison", "une maison"])["correct"]
    assert not check_typed("le maison", ["la maison", "une maison"])["correct"]
    assert check_typed("une maison", ["la maison", "une maison"])["correct"]


def test_cloze_blank_swallows_article_and_offers_wrong_gender():
    rng = random.Random(2)
    pool = [item for item in drills.pool_from_curriculum(1, only_sprint=True) if item.id == "fr_maison"]
    [exercise] = drills.cloze(rng, pool, 1, 1)
    assert exercise["prompt"] == "Je suis à ___."
    texts = {option["text"] for option in exercise["options"]}
    assert "la maison" in texts
    assert "le maison" in texts
    assert exercise["meta"]["article_required"] is True


def test_write_sentences_picks_known_unproductive_rested_words():
    from dataclasses import replace as dc_replace
    from datetime import datetime, timedelta, timezone

    now = datetime(2026, 9, 15, 12, tzinfo=timezone.utc)
    pool = drills.pool_from_curriculum(1, only_sprint=True)
    known_rested = dc_replace(pool[0], mastery={"recognition": 0.9, "written_production": 0.2}, last_seen_at=now - timedelta(days=2))
    known_fresh = dc_replace(pool[1], mastery={"recognition": 0.9, "written_production": 0.2}, last_seen_at=now - timedelta(hours=2))
    productive = dc_replace(pool[2], mastery={"recognition": 0.9, "written_production": 0.9}, last_seen_at=now - timedelta(days=5))
    unknown = dc_replace(pool[3], mastery={"recognition": 0.3}, last_seen_at=None)
    chosen = drills.writing_candidates([known_rested, known_fresh, productive, unknown], now)
    assert [c.id for c in chosen] == [known_rested.id]
    # nothing rested yet → the fresh known word is still offered rather than an empty activity
    assert [c.id for c in drills.writing_candidates([known_fresh, productive, unknown], now)] == [known_fresh.id]
    [exercise] = drills.write_sentences(random.Random(1), [known_rested], 1, 6, now)
    assert exercise["format"] == "write_sentence" and exercise["kind"] == "typed"
    assert exercise["meta"]["llm_graded"] and exercise["meta"]["lenient"]
    assert exercise["prompt"] == known_rested.display
    assert drills.write_sentences(random.Random(1), [unknown], 1, 6, now) == []


def test_grade_sentence_clamps_hard_failures(monkeypatch):
    monkeypatch.setattr(llm_learning, "available", lambda: True)
    monkeypatch.setattr(llm_learning, "build_context", lambda db, sprint, purpose="drill": {})
    monkeypatch.setattr(llm_learning, "chat_json", lambda *a, **k: ({
        "score": 0.95, "correct": True, "corrected": "Je suis à la maison.", "explanation": "artículo",
        "issues": [{"kind": "gender", "text": "le maison", "fix": "la maison"}],
    }, "test-model"))
    out = llm_learning.grade_sentence(None, sentence="Je suis à le maison.", target="la maison", sprint=1)
    assert out["score"] == 0.5 and out["correct"] is False
    assert out["issues"][0]["kind"] == "gender"
    monkeypatch.setattr(llm_learning, "chat_json", lambda *a, **k: ({"score": 1.0, "correct": True, "corrected": "x", "explanation": "", "issues": []}, "m"))
    assert llm_learning.grade_sentence(None, sentence="Je suis à la maison.", target="la maison", sprint=1)["correct"] is True
    monkeypatch.setattr(llm_learning, "available", lambda: False)
    assert llm_learning.grade_sentence(None, sentence="x", target="y", sprint=1) is None


def test_first_evidence_sets_known_and_productive():
    assert ema(0.0, 0, 1.0) >= KNOWN_THRESHOLD
    assert ema(0.0, 0, 1.0) >= PRODUCTIVE_THRESHOLD
    assert ema(0.0, 0, 0.5) < KNOWN_THRESHOLD
    assert ema(0.7, 3, 1.0) > 0.7


def test_generated_drill_cache_separates_selected_sentences():
    first = _params_hash("sentence_transform", 2, [], 2, {"base_sentence": "Je vais au bureau."})
    second = _params_hash("sentence_transform", 2, [], 2, {"base_sentence": "Je reste à la maison."})
    assert first != second
