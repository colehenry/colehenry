"""Seed the Conjugation Center: top ~100 French verbs, conjugated with
verbecc (FR + ES) at seed time and cached to the DB — no runtime dependency.

Run locally from /backend (verbecc is seed-only, not deployed):

    source .venv/bin/activate
    pip install -r requirements-seed.txt
    python scripts/seed_verbs.py

Idempotent: existing verbs are skipped; pass --force to re-conjugate everything.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models import Conjugation, Verb  # noqa: E402

PERSONS_6 = ["1s", "2s", "3s", "1p", "2p", "3p"]
PERSONS_IMPERATIF = ["2s", "1p", "2p"]

# (fr mood key, fr tense key in verbecc, our tense key, es mood, es tense)
# Our keys match TENSE_LABELS in app/routers/language.py.
TENSE_MAP = [
    ("indicatif", "présent", "présent", "indicativo", "presente"),
    ("indicatif", "passé-composé", "passé-composé", "indicativo", "pretérito-perfecto-compuesto"),
    ("indicatif", "imparfait", "imparfait", "indicativo", "pretérito-imperfecto"),
    ("indicatif", "futur-simple", "futur-simple", "indicativo", "futuro"),
    ("indicatif", "passé-simple", "passé-simple", "indicativo", "pretérito-perfecto-simple"),
    ("conditionnel", "présent", "présent", "condicional", "presente"),
    ("subjonctif", "présent", "présent", "subjuntivo", "presente"),
    ("imperatif", "imperatif-présent", "présent", "imperativo", "afirmativo"),
]

# (infinitive, group, is_irregular, translation, es_display, es_conjugatable)
# es_conjugatable is what verbecc-es conjugates; "" skips ES forms.
VERBS = [
    ("être", "irregular", True, "to be", "ser / estar", "ser"),
    ("avoir", "irregular", True, "to have", "tener (aux: haber)", "tener"),
    ("faire", "irregular", True, "to do, to make", "hacer", "hacer"),
    ("dire", "irregular", True, "to say", "decir", "decir"),
    ("pouvoir", "irregular", True, "to be able to", "poder", "poder"),
    ("aller", "irregular", True, "to go", "ir", "ir"),
    ("voir", "irregular", True, "to see", "ver", "ver"),
    ("savoir", "irregular", True, "to know (facts)", "saber", "saber"),
    ("vouloir", "irregular", True, "to want", "querer", "querer"),
    ("venir", "irregular", True, "to come", "venir", "venir"),
    ("devoir", "irregular", True, "must, to owe", "deber", "deber"),
    ("prendre", "irregular", True, "to take", "tomar", "tomar"),
    ("trouver", "-er", False, "to find", "encontrar", "encontrar"),
    ("donner", "-er", False, "to give", "dar", "dar"),
    ("falloir", "irregular", True, "to be necessary (il faut)", "hacer falta", ""),
    ("parler", "-er", False, "to speak", "hablar", "hablar"),
    ("mettre", "irregular", True, "to put", "poner", "poner"),
    ("passer", "-er", False, "to pass, to spend (time)", "pasar", "pasar"),
    ("regarder", "-er", False, "to watch, to look at", "mirar", "mirar"),
    ("aimer", "-er", False, "to love, to like", "amar / querer", "amar"),
    ("croire", "irregular", True, "to believe", "creer", "creer"),
    ("demander", "-er", False, "to ask (≠ demandar!)", "pedir / preguntar", "pedir"),
    ("rester", "-er", False, "to stay (≠ restar!)", "quedarse", "quedar"),
    ("répondre", "-re", False, "to answer", "responder", "responder"),
    ("entendre", "-re", False, "to hear (≠ entender!)", "oír", "oír"),
    ("penser", "-er", False, "to think", "pensar", "pensar"),
    ("arriver", "-er", False, "to arrive, to happen", "llegar", "llegar"),
    ("connaître", "irregular", True, "to know (people, places)", "conocer", "conocer"),
    ("devenir", "irregular", True, "to become", "volverse / llegar a ser", "volver"),
    ("sentir", "irregular", True, "to feel, to smell", "sentir", "sentir"),
    ("sembler", "-er", False, "to seem", "parecer", "parecer"),
    ("tenir", "irregular", True, "to hold", "tener / sostener", "sostener"),
    ("comprendre", "irregular", True, "to understand", "comprender / entender", "comprender"),
    ("rendre", "-re", False, "to give back, to make (+adj)", "devolver", "devolver"),
    ("attendre", "-re", False, "to wait (≠ atender!)", "esperar", "esperar"),
    ("sortir", "irregular", True, "to go out (≠ es salir 'dirty' in fr!)", "salir", "salir"),
    ("vivre", "irregular", True, "to live", "vivir", "vivir"),
    ("entrer", "-er", False, "to enter", "entrar", "entrar"),
    ("porter", "-er", False, "to carry, to wear", "llevar", "llevar"),
    ("chercher", "-er", False, "to look for", "buscar", "buscar"),
    ("revenir", "irregular", True, "to come back", "volver", "volver"),
    ("appeler", "-er", False, "to call (l→ll)", "llamar", "llamar"),
    ("mourir", "irregular", True, "to die", "morir", "morir"),
    ("partir", "irregular", True, "to leave", "irse / partir", "partir"),
    ("jeter", "-er", False, "to throw (t→tt)", "tirar", "tirar"),
    ("suivre", "irregular", True, "to follow", "seguir", "seguir"),
    ("écrire", "irregular", True, "to write", "escribir", "escribir"),
    ("montrer", "-er", False, "to show", "mostrar", "mostrar"),
    ("lever", "-er", False, "to raise (e→è)", "levantar", "levantar"),
    ("laisser", "-er", False, "to let, to leave (something)", "dejar", "dejar"),
    ("apprendre", "irregular", True, "to learn", "aprender", "aprender"),
    ("garder", "-er", False, "to keep", "guardar", "guardar"),
    ("commencer", "-er", False, "to begin (c→ç)", "comenzar", "comenzar"),
    ("aider", "-er", False, "to help", "ayudar", "ayudar"),
    ("jouer", "-er", False, "to play", "jugar", "jugar"),
    ("finir", "-ir", False, "to finish", "terminar / acabar", "terminar"),
    ("perdre", "-re", False, "to lose", "perder", "perder"),
    ("ouvrir", "irregular", True, "to open", "abrir", "abrir"),
    ("gagner", "-er", False, "to win, to earn", "ganar", "ganar"),
    ("servir", "irregular", True, "to serve", "servir", "servir"),
    ("écouter", "-er", False, "to listen", "escuchar", "escuchar"),
    ("changer", "-er", False, "to change (g→ge)", "cambiar", "cambiar"),
    ("travailler", "-er", False, "to work", "trabajar", "trabajar"),
    ("acheter", "-er", False, "to buy (e→è)", "comprar", "comprar"),
    ("essayer", "-er", False, "to try (y→i)", "intentar", "intentar"),
    ("manger", "-er", False, "to eat (g→ge)", "comer", "comer"),
    ("boire", "irregular", True, "to drink", "beber", "beber"),
    ("lire", "irregular", True, "to read", "leer", "leer"),
    ("dormir", "irregular", True, "to sleep", "dormir", "dormir"),
    ("courir", "irregular", True, "to run", "correr", "correr"),
    ("envoyer", "-er", False, "to send (y→i)", "enviar", "enviar"),
    ("payer", "-er", False, "to pay (y→i)", "pagar", "pagar"),
    ("recevoir", "irregular", True, "to receive", "recibir", "recibir"),
    ("offrir", "irregular", True, "to offer, to gift", "ofrecer", "ofrecer"),
    ("décider", "-er", False, "to decide", "decidir", "decidir"),
    ("permettre", "irregular", True, "to allow", "permitir", "permitir"),
    ("continuer", "-er", False, "to continue", "continuar", "continuar"),
    ("oublier", "-er", False, "to forget", "olvidar", "olvidar"),
    ("préférer", "-er", False, "to prefer (é→è)", "preferir", "preferir"),
    ("expliquer", "-er", False, "to explain", "explicar", "explicar"),
    ("rencontrer", "-er", False, "to meet", "encontrarse con / conocer", "encontrar"),
    ("choisir", "-ir", False, "to choose", "elegir / escoger", "elegir"),
    ("toucher", "-er", False, "to touch", "tocar", "tocar"),
    ("arrêter", "-er", False, "to stop", "parar / detener", "parar"),
    ("réussir", "-ir", False, "to succeed", "lograr / tener éxito", "lograr"),
    ("utiliser", "-er", False, "to use", "usar / utilizar", "usar"),
    ("quitter", "-er", False, "to leave (place/person) (≠ quitar!)", "dejar / abandonar", "abandonar"),
    ("valoir", "irregular", True, "to be worth", "valer", "valer"),
    ("tomber", "-er", False, "to fall", "caer", "caer"),
    ("poser", "-er", False, "to put down; poser une question", "colocar / poner", "colocar"),
    ("rentrer", "-er", False, "to go home", "regresar / volver a casa", "regresar"),
    ("présenter", "-er", False, "to introduce, to present", "presentar", "presentar"),
    ("accepter", "-er", False, "to accept", "aceptar", "aceptar"),
    ("marcher", "-er", False, "to walk; to work (a thing) (≠ marcharse!)", "caminar / andar", "caminar"),
    ("reprendre", "irregular", True, "to take back, to resume", "retomar", "retomar"),
    ("compter", "-er", False, "to count, to intend", "contar", "contar"),
    ("tourner", "-er", False, "to turn", "girar", "girar"),
    ("grandir", "-ir", False, "to grow (up)", "crecer", "crecer"),
    ("remplir", "-ir", False, "to fill", "llenar", "llenar"),
    ("vendre", "-re", False, "to sell", "vender", "vender"),
]


def value(raw) -> str:
    """verbecc 2.x returns enums in row dicts; older versions returned strings."""
    return getattr(raw, "value", raw or "")


def row_person(row: dict) -> str:
    return f"{value(row.get('p'))}{value(row.get('n'))}"


def row_form(row: dict) -> str:
    forms = row.get("c") or []
    return clean(forms[0] if forms else "")


def forms_for(
    conj,
    mood: str,
    tense: str,
    persons: list[str] | None = None,
) -> list[str]:
    try:
        data = conj.get_data() if hasattr(conj, "get_data") else conj
        rows = data["moods"][mood][tense]
    except (AttributeError, KeyError, TypeError):
        return []
    if not rows:
        return []
    if not isinstance(rows[0], dict):
        return [clean(form) for form in rows]
    wanted = persons or PERSONS_6
    out: list[str] = []
    for person in wanted:
        match = next((row for row in rows if row_person(row) == person), None)
        out.append(row_form(match) if match else "")
    return out


def clean(form: str) -> str:
    return form.strip()


def usable(form: str) -> bool:
    return bool(form) and form != "-" and not form.startswith("-")


def main(force: bool = False) -> None:
    from verbecc import CompleteConjugator

    cg_fr = CompleteConjugator(lang="fr")
    cg_es = CompleteConjugator(lang="es")

    db = SessionLocal()
    seeded = skipped = 0
    try:
        aller = cg_fr.conjugate("aller", conjugate_pronouns=False)
        aller_present = forms_for(aller, "indicatif", "présent", PERSONS_6)
        ir_es = cg_es.conjugate("ir", conjugate_pronouns=False)
        ir_presente = forms_for(ir_es, "indicativo", "presente", PERSONS_6)

        for rank, (inf, group, irregular, translation, es_display, es_inf) in enumerate(
            VERBS, start=1
        ):
            existing = db.execute(
                select(Verb).where(Verb.infinitive == inf)
            ).scalar_one_or_none()
            if existing and not force:
                skipped += 1
                continue
            if existing:
                db.execute(delete(Conjugation).where(Conjugation.verb_id == existing.id))
                db.delete(existing)
                db.flush()

            try:
                fr = cg_fr.conjugate(inf, conjugate_pronouns=False)
            except Exception as exc:
                print(f"  !! verbecc failed for {inf}: {exc}")
                continue
            es = None
            if es_inf:
                try:
                    es = cg_es.conjugate(es_inf, conjugate_pronouns=False)
                except Exception as exc:
                    print(f"  !! verbecc-es failed for {es_inf}: {exc}")

            verb = Verb(
                infinitive=inf,
                group=group,
                is_irregular=irregular,
                translation=translation,
                es_equivalent=es_display,
                frequency_rank=rank,
            )
            db.add(verb)
            db.flush()

            for fr_mood, fr_tense, our_tense, es_mood, es_tense in TENSE_MAP:
                our_mood = fr_mood
                persons = (
                    PERSONS_IMPERATIF if fr_mood == "imperatif" else PERSONS_6
                )
                fr_forms = forms_for(fr, fr_mood, fr_tense, persons)
                es_forms = forms_for(es, es_mood, es_tense, persons) if es else []
                for i, person in enumerate(persons):
                    if i >= len(fr_forms) or not usable(clean(fr_forms[i])):
                        continue
                    es_form = (
                        clean(es_forms[i])
                        if es_forms and i < len(es_forms) and usable(clean(es_forms[i]))
                        else ""
                    )
                    db.add(
                        Conjugation(
                            verb_id=verb.id,
                            mood=our_mood,
                            tense=our_tense,
                            person=person,
                            form=clean(fr_forms[i]),
                            es_form=es_form,
                        )
                    )

            # futur proche: aller (présent) + infinitive ≈ ES ir a + infinitive
            for i, person in enumerate(PERSONS_6):
                if i >= len(aller_present):
                    continue
                es_form = ""
                if es_inf and i < len(ir_presente):
                    es_form = f"{clean(ir_presente[i])} a {es_inf}"
                db.add(
                    Conjugation(
                        verb_id=verb.id,
                        mood="indicatif",
                        tense="futur-proche",
                        person=person,
                        form=f"{clean(aller_present[i])} {inf}",
                        es_form=es_form,
                    )
                )
            seeded += 1
            print(f"  {rank:3d}. {inf} ✓")

        db.commit()
        print(f"verbs seeded: {seeded}, skipped (already present): {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    main(force="--force" in sys.argv)
