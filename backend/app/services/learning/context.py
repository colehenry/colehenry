"""Shared learner-context builder — the compact, purpose-specific payload every
learning-AI call receives. Never the whole database."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.curriculum.sentences import EXTRA_VERBS, FRAMES, TIME_ES
from app.curriculum.sprints import SPRINT_BY_NUMBER, grammar_through_sprint
from app.curriculum.verbs import verbs_through_sprint
from app.curriculum.vocab import items_through_sprint
from app.models import FlashcardReview, LearningInterference, LearningVocab, ReviewStateName
from app.services.learning.mastery import KNOWN_THRESHOLD, sprint_progress, weakest_dimensions

FUNCTION_WORDS = set("""
je j tu il elle on nous vous ils elles ne n pas le la les l un une des de d du au aux à a et ou mais que qu qui quoi où quand comment
pourquoi est ce c ça cela y en me te se m t s lui leur mon ma mes ton ta tes son sa ses notre votre nos vos leurs si oui non
très plus moins bien mal ici là avec sans pour dans sur sous chez par vers entre puis alors donc car parce comme tout tous toute toutes
quel quelle quels quelles moi toi eux elle même autre quelque chose rien personne jamais toujours encore déjà aussi
bonjour salut merci pardon monsieur madame heure heures minutes jour jours semaine mois an ans année
un deux trois quatre cinq six sept huit neuf dix onze douze quinze vingt trente quarante cinquante cent
lundi mardi mercredi jeudi vendredi samedi dimanche janvier février mars avril mai juin juillet août septembre octobre novembre décembre
paris france chicago lyon marseille cole marc marie
""".split())


def tokenize_fr(text: str) -> list[str]:
    text = text.replace("’", "'").lower()
    return [t for t in re.split(r"[^a-zàâäéèêëîïôöùûüçœ]+", text) if t]


def allowed_vocabulary(sprint: int) -> set[str]:
    """Every French token the learner has met by `sprint` (curriculum items,
    their example sentences, conjugated core verbs, frame complements)."""
    allowed = set(FUNCTION_WORDS)
    for item in items_through_sprint(sprint):
        allowed.update(tokenize_fr(item.french))
        allowed.update(tokenize_fr(item.example_fr))
        allowed.update(tokenize_fr(item.pattern))
    for v in verbs_through_sprint(sprint):
        allowed.add(v.infinitive)
        allowed.update(v.present)
        allowed.add(v.participle)
        allowed.update({v.participle + "e", v.participle + "s", v.participle + "es"})
        for fr, _ in v.constructions + v.examples:
            allowed.update(tokenize_fr(fr))
    for inf, info in EXTRA_VERBS.items():
        allowed.add(inf)
        allowed.update(info["present"])
        allowed.add(info["participle"])
    for f in FRAMES:
        if f.sprint <= sprint:
            allowed.update(tokenize_fr(f.fr))
    for t in TIME_ES:
        allowed.update(tokenize_fr(t))
    return allowed


def unknown_ratio(text: str, allowed: set[str]) -> tuple[float, list[str]]:
    tokens = tokenize_fr(text)
    if not tokens:
        return 0.0, []
    unknown = [t for t in tokens if t not in allowed and not t[0].isupper()]
    # tolerate regular inflections of known stems (plural -s, feminine -e)
    unknown = [t for t in unknown if not (t.endswith("s") and t[:-1] in allowed) and not (t.endswith("e") and t[:-1] in allowed)]
    return len(unknown) / len(tokens), unknown


def build_context(db: Session, sprint: int, purpose: str = "drill") -> dict:
    cfg = SPRINT_BY_NUMBER[sprint]
    progress = sprint_progress(db, sprint)
    rows = db.execute(select(LearningVocab).where(LearningVocab.sprint <= sprint, LearningVocab.status.in_(("core", "recognition")))).scalars().all()
    known = [r.french for r in rows if r.status == "core" and (r.recognition >= KNOWN_THRESHOLD or r.sprint < sprint)]
    learning = [r.french for r in rows if r.status == "core" and r.sprint == sprint and r.recognition < KNOWN_THRESHOLD]
    recognition = [r.french for r in rows if r.status == "recognition"]
    earlier_verbs = [v.infinitive for v in verbs_through_sprint(sprint - 1)] if sprint > 1 else []
    target_verbs = [v.infinitive for v in cfg.verbs]
    grammar_earlier = [g.id for g in grammar_through_sprint(sprint - 1)] if sprint > 1 else []
    grammar_met = [g["id"] for g in progress["grammar"] if g["met"]]
    grammar_target = [g["id"] for g in progress["grammar"] if not g["met"]]
    pron_targets = [p["id"] for p in progress["pronunciation"] if not p["met"]]
    errors = db.execute(
        select(LearningInterference).where(LearningInterference.resolved.is_(False)).order_by(LearningInterference.times_seen.desc()).limit(6)
    ).scalars().all()
    due = db.execute(
        select(func.count(FlashcardReview.id)).where(FlashcardReview.state != ReviewStateName.new, FlashcardReview.due <= datetime.now(timezone.utc))
    ).scalar_one()

    ctx = {
        "active_sprint": sprint,
        "sprint_title": cfg.title,
        "bridge_language": "es",
        "target_variant": "fr-FR",
        "learner": "A0 French, C1 Spanish, native English. Explanations in Spanish, short.",
        "known_verbs": earlier_verbs,
        "target_verbs": target_verbs,
        "known_grammar": sorted(set(grammar_earlier + grammar_met)),
        "target_grammar": grammar_target,
        "pronunciation_targets": pron_targets,
        "weak_dimensions": weakest_dimensions(progress),
        "recent_errors": [{"error": e.error, "correct": e.correct, "why": e.spanish_source} for e in errors],
        "due_review_count": int(due),
    }
    if purpose in ("drill", "explain", "text", "micro"):
        ctx["core_vocab_known"] = known[:200]
        ctx["core_vocab_learning"] = learning[:120]
        ctx["recognition_vocab"] = recognition[:80]
    if purpose == "session":
        ctx["activities"] = [
            {"id": a.id, "name": a.name, "skill": a.skill, "minutes": a.minutes, "kind": a.kind}
            for a in cfg.activities if a.kind != "test"
        ]
        ctx["progress"] = progress["dims"]
    return ctx
