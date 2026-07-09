"""Seed the language tool: curated ES↔FR faux-amis, the minimal-pair drill
deck, starter decks, default daily tasks and weekly targets.

Idempotent — run any time with `python -m app.seed_language`.
"""

from sqlalchemy import select

from app.db import SessionLocal
from app.models import (
    CardSource,
    CardType,
    FalseFriend,
    Flashcard,
    FlashcardDeck,
    FlashcardReview,
    Language,
    LanguageTarget,
    LanguageTask,
)

# (fr, es, note) — the note teaches the trap via Spanish, per the plan.
FALSE_FRIENDS: list[tuple[str, str, str]] = [
    ("embarrassé", "embarazada", "FR embarrassé = embarrassed. ES embarazada = pregnant. The classic."),
    ("large", "largo", "FR large = wide. ES largo = long (FR long). Width vs length swap."),
    ("constipé", "constipado", "FR constipé = constipated. ES constipado = having a cold (FR enrhumé)."),
    ("entendre", "entender", "FR entendre = to hear. ES entender = to understand (FR comprendre)."),
    ("attendre", "atender", "FR attendre = to wait. ES atender = to attend to / serve (FR s'occuper de)."),
    ("subir", "subir", "FR subir = to undergo / suffer. ES subir = to go up (FR monter)."),
    ("salir", "salir", "FR salir = to dirty. ES salir = to go out (FR sortir)."),
    ("quitter", "quitar", "FR quitter = to leave (a place/person). ES quitar = to remove (FR enlever)."),
    ("demander", "demandar", "FR demander = to ask (ES pedir/preguntar). ES demandar = to sue (FR poursuivre)."),
    ("nombre", "nombre", "FR nombre = number (ES número). ES nombre = name (FR nom)."),
    ("carte", "carta", "FR carte = card / map / menu. ES carta = letter (FR lettre) or menu."),
    ("gâteau", "gato", "FR gâteau /ɡɑto/ = cake. Sounds like ES gato = cat (FR chat)."),
    ("sol", "sol", "FR sol = ground / floor. ES sol = sun (FR soleil)."),
    ("équipage", "equipaje", "FR équipage = crew. ES equipaje = luggage (FR bagages)."),
    ("contester", "contestar", "FR contester = to dispute. ES contestar = to answer (FR répondre)."),
    ("débile", "débil", "FR débile = idiotic / moronic (slang). ES débil = weak (FR faible)."),
    ("exprimer", "exprimir", "FR exprimer = to express. ES exprimir = to squeeze (FR presser)."),
    ("enfermé", "enfermo", "FR enfermé = locked up / shut in. ES enfermo = sick (FR malade)."),
    ("discuter", "discutir", "FR discuter = to chat / discuss. ES discutir usually = to argue (FR se disputer)."),
    ("doubler", "doblar", "FR doubler = to overtake / to dub. ES doblar = to fold / to turn (FR plier, tourner)."),
    ("sable", "sable", "FR sable = sand (ES arena). ES sable = saber (FR sabre)."),
    ("sombre", "sombra", "FR sombre = dark (adj). ES sombra = shadow (FR ombre)."),
    ("vase", "vaso", "FR vase = vase (or mud). ES vaso = drinking glass (FR verre)."),
    ("rester", "restar", "FR rester = to stay (ES quedarse). ES restar = to subtract (FR soustraire)."),
    ("apurer", "apurar", "FR apurer = to audit/clear accounts. ES apurar(se) = to hurry / worry (FR se dépêcher)."),
    ("bâtir", "batir", "FR bâtir = to build (ES construir). ES batir = to beat / whisk (FR battre)."),
    ("créance", "creencia", "FR créance = debt / claim. ES creencia = belief (FR croyance)."),
    ("dos", "dos", "FR dos = back (body part, ES espalda). ES dos = two (FR deux)."),
    ("con", "con", "FR con = idiot (vulgar). ES con = with (FR avec). Watch your prepositions."),
    ("pourtant", "por tanto", "FR pourtant = however / yet. ES por (lo) tanto = therefore (FR donc). Near-opposites."),
    ("bizarre", "bizarro", "FR bizarre = strange (ES raro). ES bizarro (traditional) = brave / gallant."),
    ("marcher", "marchar", "FR marcher = to walk / to work (function). ES marchar(se) = to leave / march."),
    ("tirer", "tirar", "FR tirer = to pull / shoot. ES tirar = to throw / throw away (FR jeter)."),
    ("prune", "pruna", "FR prune = plum (ES ciruela); pruneau = prune. ES seca: ciruela pasa."),
    ("figure", "figura", "FR figure = face (ES cara). ES figura = figure / shape (FR silhouette, forme)."),
]

# (front, ipa, back) — one card per pair, IPA is the point.
MINIMAL_PAIRS: list[tuple[str, str, str]] = [
    ("dessus / dessous", "/dəsy/ · /dəsu/", "dessus /dəsy/ = on top · dessous /dəsu/ = underneath. u vs ou — round your lips harder for /u/."),
    ("poisson / poison", "/pwasɔ̃/ · /pwazɔ̃/", "poisson /s/ = fish · poison /z/ = poison. Double s stays voiceless."),
    ("rue / roue", "/ʁy/ · /ʁu/", "rue /ʁy/ = street · roue /ʁu/ = wheel. The /y/–/u/ split, again."),
    ("vin / vent", "/vɛ̃/ · /vɑ̃/", "vin /vɛ̃/ = wine · vent /vɑ̃/ = wind. Two different nasal vowels (ES has none)."),
    ("bon / banc", "/bɔ̃/ · /bɑ̃/", "bon /bɔ̃/ = good · banc /bɑ̃/ = bench. /ɔ̃/ vs /ɑ̃/."),
    ("brin / brun", "/bʁɛ̃/ · /bʁœ̃/", "brin = sprig · brun = brown. Many French speakers merge these; aim for the contrast anyway."),
    ("jeune / jaune", "/ʒœn/ · /ʒon/", "jeune /ʒœn/ = young · jaune /ʒon/ = yellow."),
    ("cheveux / chevaux", "/ʃəvø/ · /ʃəvo/", "cheveux = hair · chevaux = horses. /ø/ vs /o/ — a classic mixup."),
    ("baisser / baiser", "/bese/ · /beze/", "baisser = to lower · baiser (verb) = vulgar. Voicing of one s — get this one right."),
    ("cousin / coussin", "/kuzɛ̃/ · /kusɛ̃/", "cousin /z/ = cousin · coussin /s/ = cushion."),
    ("désert / dessert", "/dezɛʁ/ · /desɛʁ/", "désert /z/ = desert · dessert /s/ = dessert. Same trap as ES desierto/postre? No — pure voicing."),
    ("pécheur / pêcheur", "/peʃœʁ/ · /pɛʃœʁ/", "pécheur /e/ = sinner · pêcheur /ɛ/ = fisherman. é vs ê."),
    ("le / les", "/lə/ · /le/", "le /ə/ singular · les /e/ plural. Often the only audible number marker."),
    ("mais / mes", "/mɛ/ · /me/", "mais /ɛ/ = but · mes /e/ = my (pl). /ɛ/–/e/ carries meaning."),
    ("tu / tout", "/ty/ · /tu/", "tu /ty/ = you · tout /tu/ = all. If /y/ fails, these collide."),
]

STARTER_DECKS = [
    ("Français · Core", Language.fr, "Day-to-day French vocab — the main FR deck."),
    ("Español · Mantenimiento", Language.es, "C1 maintenance — Kobo imports land here."),
]

DAILY_TASKS = [
    ("20 French reviews", "study:fr:20"),
    ("10 Spanish reviews", "study:es:10"),
    ("10 min French listening (music / YouTube)", ""),
]

TARGETS = [
    ("reviews", "Total reviews", 150, True),
    ("fr_reviews", "French reviews", 100, True),
    ("es_reviews", "Spanish reviews (guardrail)", 50, True),
    ("new_cards", "New cards added", 20, True),
    ("lessons", "italki lessons", 2, False),
    ("input_minutes", "Listening minutes", 120, False),
]


def seed() -> None:
    db = SessionLocal()
    try:
        for fr, es, note in FALSE_FRIENDS:
            if not db.execute(
                select(FalseFriend).where(FalseFriend.fr == fr)
            ).scalar_one_or_none():
                db.add(FalseFriend(fr=fr, es=es, note=note))

        for name, language, description in STARTER_DECKS:
            if not db.execute(
                select(FlashcardDeck).where(FlashcardDeck.name == name)
            ).scalar_one_or_none():
                db.add(FlashcardDeck(name=name, language=language, description=description))

        pairs_name = "Minimal pairs · prononciation"
        pairs = db.execute(
            select(FlashcardDeck).where(FlashcardDeck.name == pairs_name)
        ).scalar_one_or_none()
        if pairs is None:
            pairs = FlashcardDeck(
                name=pairs_name,
                language=Language.fr,
                description="Sound contrasts French lives on — hear and hold the difference.",
                tags=["pronunciation"],
                is_system=True,
            )
            db.add(pairs)
            db.flush()
            for front, ipa, back in MINIMAL_PAIRS:
                card = Flashcard(
                    deck_id=pairs.id,
                    card_type=CardType.basic,
                    front=front,
                    back=back,
                    ipa=ipa,
                    source=CardSource.system,
                    tags=["minimal-pair"],
                )
                card.review = FlashcardReview()
                db.add(card)

        for text, action_ref in DAILY_TASKS:
            if not db.execute(
                select(LanguageTask).where(
                    LanguageTask.text == text, LanguageTask.recurrence == "daily"
                )
            ).scalar_one_or_none():
                db.add(LanguageTask(text=text, recurrence="daily", action_ref=action_ref))

        for metric, label, target, auto in TARGETS:
            if not db.execute(
                select(LanguageTarget).where(LanguageTarget.metric == metric)
            ).scalar_one_or_none():
                db.add(LanguageTarget(metric=metric, label=label, target=target, auto=auto))

        db.commit()
        print("language seed complete")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
