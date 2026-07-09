"""Card enrichment: dictionary fields, faux-amis flags, cached TTS audio.

Only fills fields the owner left blank — manual edits always win.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CardDirection, CardType, FalseFriend, Flashcard
from app.services import dictionary, llm, tts


def target_word(card: Flashcard, language: str) -> str:
    """The word in the language being learned (what we look up and speak)."""
    if card.card_type == CardType.cloze:
        return card.back
    if card.direction == CardDirection.production:
        return card.back
    return card.front


def audio_text(card: Flashcard, language: str) -> str:
    """What TTS should read: the full sentence for cloze, else the word."""
    if card.card_type == CardType.cloze and "___" in card.front:
        return card.front.replace("___", card.back)
    return target_word(card, language)


def enrich_card(db: Session, card: Flashcard, language: str) -> None:
    word = target_word(card, language)

    if not (card.ipa and card.part_of_speech and card.example):
        found = dictionary.lookup(language, word)
        if found is None:
            found = llm.enrich_lookup(language, word)
        if found:
            card.ipa = card.ipa or found["ipa"]
            card.part_of_speech = card.part_of_speech or found["part_of_speech"]
            card.gender = card.gender or found["gender"]
            card.example = card.example or found["example"]
            # basic recognition cards with no back yet get the dictionary gloss
            if not card.back.strip() and found["translation"]:
                card.back = found["translation"]

    if not card.cognate_note:
        column = FalseFriend.fr if language == "fr" else FalseFriend.es
        match = db.execute(
            select(FalseFriend).where(func.lower(column) == word.strip().lower())
        ).scalar_one_or_none()
        if match:
            card.is_false_friend = True
            card.cognate_note = match.note

    if not card.audio_url:
        card.audio_url = tts.synthesize(language, audio_text(card, language))
