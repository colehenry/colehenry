"""Card/cell audio: Google Cloud TTS → mp3 cached on Cloudinary.

Both keys are optional — when either is missing every call returns "" and the
app simply shows cards without audio. Uploads use a deterministic public_id
(hash of language+text), so the same text is synthesized and stored once.
"""

import base64
import hashlib
import io
import logging
from urllib.parse import urlparse

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

VOICES = {
    "fr": {"languageCode": "fr-FR", "name": "fr-FR-Neural2-A"},
    "es": {"languageCode": "es-ES", "name": "es-ES-Neural2-A"},
}


def _configured() -> bool:
    s = get_settings()
    return bool(s.google_tts_api_key and s.cloudinary_url)


def synthesize(language: str, text: str) -> str:
    """Return a cached mp3 URL for `text`, or "" when TTS isn't configured."""
    text = text.strip()
    if not text or language not in VOICES or not _configured():
        return ""
    settings = get_settings()

    # One clip per (language, text); re-requests hit the existing asset.
    digest = hashlib.sha1(f"{language}:{text}".encode()).hexdigest()[:20]
    public_id = f"language-audio/{language}/{digest}"

    import cloudinary
    import cloudinary.api
    import cloudinary.uploader

    # The SDK only auto-parses the CLOUDINARY_URL env var — parse ours by hand.
    parsed = urlparse(settings.cloudinary_url)
    cloudinary.config(
        cloud_name=parsed.hostname,
        api_key=parsed.username,
        api_secret=parsed.password,
        secure=True,
    )

    try:
        existing = cloudinary.api.resource(public_id, resource_type="video")
        return existing["secure_url"]
    except cloudinary.api.NotFound:
        pass
    except Exception as exc:  # pragma: no cover — availability blip
        log.warning("cloudinary lookup failed: %s", exc)

    try:
        res = httpx.post(
            TTS_URL,
            params={"key": settings.google_tts_api_key},
            json={
                "input": {"text": text},
                "voice": VOICES[language],
                "audioConfig": {"audioEncoding": "MP3"},
            },
            timeout=15,
        )
        res.raise_for_status()
        audio = base64.b64decode(res.json()["audioContent"])
    except Exception as exc:
        log.warning("google tts failed for %r: %s", text, exc)
        return ""

    try:
        uploaded = cloudinary.uploader.upload(
            io.BytesIO(audio),
            public_id=public_id,
            resource_type="video",  # cloudinary treats audio as video
            overwrite=True,
            format="mp3",
        )
        return uploaded["secure_url"]
    except Exception as exc:
        log.warning("cloudinary upload failed: %s", exc)
        return ""
