"""speak — generic tap-to-hear for any FR/ES text, plus conjugation audio."""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Conjugation
from app.routers.language.shared import router
from app.schemas.language import ConjugationAudioOut, SpeakIn, SpeakOut
from app.services import tts

_VOWELISH = tuple("aeiouyàâäéèêëîïôöùûüh")

# What TTS says for each person — one concrete pronoun, not "il/elle".
SPOKEN_SUBJECTS = {
    "fr": {
        "1s": "je",
        "2s": "tu",
        "3s": "il",
        "1p": "nous",
        "2p": "vous",
        "3p": "ils",
    },
    "es": {
        "1s": "yo",
        "2s": "tú",
        "3s": "él",
        "1p": "nosotros",
        "2p": "vosotros",
        "3p": "ellos",
    },
}


def spoken_conjugation(
    person: str, form: str, mood: str, language: str = "fr"
) -> str:
    """Subject + verb as actually said: "je suis", "j'aime", "que je sois"."""
    if mood in ("imperatif", "imperativo") or not form:
        return form
    subject = SPOKEN_SUBJECTS.get(language, {}).get(person)
    if not subject:
        return form
    if language == "fr" and subject == "je" and form.lower().startswith(_VOWELISH):
        phrase = f"j'{form}"
    else:
        phrase = f"{subject} {form}"
    if mood == "subjonctif":
        return f"qu'{phrase}" if phrase[0] in "iî" else f"que {phrase}"
    if mood == "subjuntivo":
        return f"que {phrase}"
    return phrase


@router.post("/speak", response_model=SpeakOut)
def speak(body: SpeakIn):
    """Cached TTS for arbitrary text; "" tells the client to use browser speech."""
    return SpeakOut(audio_url=tts.synthesize(body.language.value, body.text))


@router.post("/conjugations/{conjugation_id}/audio", response_model=ConjugationAudioOut)
def conjugation_audio(conjugation_id: int, db: Session = Depends(get_db)):
    """Lazy tap-to-hear: synthesize + cache the cell's audio on first request."""
    conj = db.get(Conjugation, conjugation_id)
    if conj is None:
        raise HTTPException(status_code=404, detail="Conjugation not found")
    if not conj.audio_url:
        language = conj.verb.language
        conj.audio_url = tts.synthesize(
            language,
            spoken_conjugation(conj.person, conj.form, conj.mood, language),
        )
        db.commit()
    return ConjugationAudioOut(id=conj.id, audio_url=conj.audio_url)
