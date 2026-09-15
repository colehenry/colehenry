"""Pronunciation targets + the word banks that drive discrimination drills.

Every target has a *trained* bank (used in practice) and an *unseen* bank
(held back for the mastery test) so a pass measures the sound category, not
memorized recordings (HVPT principle). Audio comes from TTS at runtime.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PronTarget:
    id: str
    label: str  # compact: "/y/ vs /u/"
    sprint: int
    kind: str  # ab | odd | grapheme | liaison | self
    ref: str  # reference deep link
    note: str = ""  # one line, the mouth/ear cue
    # ab: pairs (a, b) where a has sound A, b has sound B
    pairs: tuple[tuple[str, str], ...] = ()
    unseen_pairs: tuple[tuple[str, str], ...] = ()
    # odd: triads where every word has a different target vowel
    triads: tuple[tuple[str, str, str], ...] = ()
    unseen_triads: tuple[tuple[str, str, str], ...] = ()
    sounds: tuple[str, ...] = ()  # IPA labels for the A / B (/ triad) slots
    # grapheme: (word, grapheme, correct ipa, distractor ipas)
    graphemes: tuple[tuple[str, str, str, tuple[str, ...]], ...] = ()
    unseen_graphemes: tuple[tuple[str, str, str, tuple[str, ...]], ...] = ()
    # self: production task read aloud, self-rated
    words: tuple[str, ...] = ()
    unseen_words: tuple[str, ...] = ()
    threshold: float = 0.8
    min_attempts: int = 10
    carry: bool = False  # keep drilling in later sprints even when met

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "sprint": self.sprint,
            "kind": self.kind,
            "ref": self.ref,
            "note": self.note,
            "sounds": list(self.sounds),
            "threshold": self.threshold,
            "min_attempts": self.min_attempts,
        }


PRON_TARGETS: tuple[PronTarget, ...] = (
    PronTarget(
        id="y_vs_u", label="/y/ vs /u/", sprint=1, kind="ab", ref="pronunciation#y-vs-u",
        note="u = say /i/ and round the lips; ou = Spanish u. tu ≠ tout.",
        sounds=("/y/ (u)", "/u/ (ou)"),
        pairs=(("tu", "tout"), ("rue", "roue"), ("dessus", "dessous"), ("pur", "pour"), ("su", "sous"),
               ("lu", "loup"), ("vu", "vous"), ("bu", "bout"), ("mule", "moule"), ("pull", "poule")),
        unseen_pairs=(("du", "doux"), ("nu", "nous"), ("jus", "joue"), ("cure", "cour"), ("sûr", "sourd"),
                      ("bulle", "boule"), ("mue", "mou"), ("pu", "pou")),
        threshold=0.85, min_attempts=12,
    ),
    PronTarget(
        id="i_vs_y", label="/i/ vs /y/", sprint=1, kind="ab", ref="pronunciation#i-y-u",
        note="Same tongue, different lips: i spread, u rounded.",
        sounds=("/i/ (i)", "/y/ (u)"),
        pairs=(("vie", "vue"), ("dit", "du"), ("lit", "lu"), ("si", "su"), ("riz", "rue"), ("mi", "mu"), ("pis", "pu"), ("nid", "nu")),
        unseen_pairs=(("fit", "fut"), ("cri", "cru"), ("dire", "dur"), ("pire", "pur"), ("mille", "mule"), ("kir", "cure")),
    ),
    PronTarget(
        id="nasals", label="/ɑ̃/ /ɔ̃/ /ɛ̃/", sprint=1, kind="odd", ref="pronunciation#nasals",
        note="an/en · on · in/ain. The n/m is never pronounced — the vowel carries it.",
        sounds=("/ɑ̃/ (an, en)", "/ɔ̃/ (on)", "/ɛ̃/ (in, ain, ein)"),
        triads=(("vent", "vont", "vin"), ("banc", "bon", "bain"), ("lent", "long", "lin"), ("sans", "son", "sain"),
                ("temps", "ton", "teint"), ("dans", "don", "daim"), ("blanc", "blond", "blin"), ("cent", "son", "saint")),
        unseen_triads=(("rang", "rond", "rein"), ("gant", "gond", "gain"), ("pan", "pont", "pain"), ("ment", "mont", "main"),
                       ("tant", "thon", "teint"), ("plan", "plomb", "plein")),
        threshold=0.8, min_attempts=12,
    ),
    PronTarget(
        id="sh_zh", label="/ʃ/ vs /ʒ/", sprint=1, kind="ab", ref="pronunciation#consonants",
        note="ch = English sh; j / g(e,i) = the voiced one (like Argentine 'll'). Neither exists in Castilian.",
        sounds=("/ʃ/ (ch)", "/ʒ/ (j, ge)"),
        pairs=(("chou", "joue"), ("cache", "cage"), ("bouche", "bouge"), ("chant", "gens"), ("hache", "âge"), ("choix", "joie"),
               ("chose", "j'ose"), ("char", "jar")),
        unseen_pairs=(("champ", "Jean"), ("chute", "jute"), ("mâche", "mage"), ("lécher", "léger"), ("bêche", "beige"), ("chaîne", "gêne")),
    ),
    PronTarget(
        id="s_vs_z", label="/s/ vs /z/", sprint=1, kind="ab", ref="pronunciation#consonants",
        note="Single s between vowels = /z/ (poison); ss = /s/ (poisson). Spanish has no /z/.",
        sounds=("/s/ (ss, c, ç)", "/z/ (s between vowels, z)"),
        pairs=(("poisson", "poison"), ("dessert", "désert"), ("coussin", "cousin"), ("baisser", "baiser"), ("casser", "caser"),
               ("russe", "ruse"), ("douce", "douze"), ("basse", "base")),
        unseen_pairs=(("cesse", "seize"), ("face", "phase"), ("lisse", "lise"), ("hausse", "ose"), ("visse", "vise"), ("casse", "case")),
    ),
    PronTarget(
        id="r_production", label="French /ʁ/", sprint=1, kind="self", ref="pronunciation#r",
        note="Back of the tongue near the uvula, like a soft Spanish j (jota) but voiced. Never rolled.",
        words=("rue", "Paris", "parler", "très", "trois", "merci", "regarder", "rouge", "arriver", "pourquoi"),
        unseen_words=("rire", "prendre", "réunion", "sortir", "rester", "partir", "france", "heure", "dernier", "vraiment"),
        threshold=0.7, min_attempts=6, carry=True,
    ),
    PronTarget(
        id="grapheme_decoding", label="Spelling → sound", sprint=1, kind="grapheme", ref="spelling",
        note="Predict the sound from the spelling. eau = /o/, oi = /wa/, ai = /ɛ/, u = /y/, ou = /u/.",
        graphemes=(
            ("beaucoup", "eau", "/o/", ("/ø/", "/y/", "/eau/")),
            ("tu", "u", "/y/", ("/u/", "/i/")),
            ("vous", "ou", "/u/", ("/y/", "/o/")),
            ("vin", "in", "/ɛ̃/", ("/ɑ̃/", "/ɔ̃/", "/in/")),
            ("vent", "en", "/ɑ̃/", ("/ɛ̃/", "/ɔ̃/", "/en/")),
            ("bon", "on", "/ɔ̃/", ("/ɑ̃/", "/ɛ̃/", "/on/")),
            ("chat", "ch", "/ʃ/", ("/tʃ/", "/k/", "/ʒ/")),
            ("jour", "j", "/ʒ/", ("/x/", "/dʒ/", "/j/")),
            ("montagne", "gn", "/ɲ/", ("/ɡn/", "/n/")),
            ("fille", "ill", "/j/", ("/il/", "/l/")),
            ("parler", "-er", "/e/", ("/ɛʁ/", "/əʁ/")),
            ("mais", "ai", "/ɛ/", ("/ai/", "/e/", "/a/")),
            ("peu", "eu", "/ø/", ("/e-u/", "/u/", "/y/")),
            ("moi", "oi", "/wa/", ("/oi/", "/o/")),
            ("chez", "-ez", "/e/", ("/ɛz/", "/ez/")),
            ("temps", "-ps", "silent", ("/ps/", "/s/")),
            ("maison", "s", "/z/", ("/s/",)),
            ("être", "ê", "/ɛ/", ("/e/", "/ə/")),
        ),
        unseen_graphemes=(
            ("bateau", "eau", "/o/", ("/ø/", "/y/")),
            ("lune", "u", "/y/", ("/u/", "/i/")),
            ("bouger", "ou", "/u/", ("/y/", "/o/")),
            ("pain", "ain", "/ɛ̃/", ("/ɑ̃/", "/ɔ̃/", "/ain/")),
            ("enfant", "an", "/ɑ̃/", ("/ɛ̃/", "/ɔ̃/", "/an/")),
            ("pont", "on", "/ɔ̃/", ("/ɑ̃/", "/ɛ̃/")),
            ("chien", "ch", "/ʃ/", ("/tʃ/", "/k/")),
            ("genou", "ge", "/ʒ/", ("/ɡ/", "/x/")),
            ("gagner", "gn", "/ɲ/", ("/ɡn/", "/n/")),
            ("travail", "ail", "/aj/", ("/ail/", "/al/")),
            ("manger", "-er", "/e/", ("/ɛʁ/", "/əʁ/")),
            ("lait", "ai", "/ɛ/", ("/ai/", "/e/")),
            ("deux", "eu", "/ø/", ("/e-u/", "/u/")),
            ("voiture", "oi", "/wa/", ("/oi/", "/o/")),
            ("trop", "-p", "silent", ("/p/",)),
            ("choisir", "s", "/z/", ("/s/",)),
        ),
        threshold=0.85, min_attempts=15,
    ),
    PronTarget(
        id="silent_finals", label="Silent finals", sprint=1, kind="grapheme", ref="pronunciation#silent-finals",
        note="Final consonants are silent — except C, R, F, L (CaReFuL) most of the time.",
        graphemes=(
            ("grand", "d", "silent", ("/d/",)), ("petit", "t", "silent", ("/t/",)), ("avec", "c", "/k/", ("silent",)),
            ("pour", "r", "/ʁ/", ("silent",)), ("chef", "f", "/f/", ("silent",)), ("trop", "p", "silent", ("/p/",)),
            ("vous", "s", "silent", ("/s/",)), ("nez", "z", "silent", ("/z/",)), ("sac", "c", "/k/", ("silent",)),
            ("bus", "s", "/s/", ("silent",)), ("beaucoup", "p", "silent", ("/p/",)), ("hôtel", "l", "/l/", ("silent",)),
        ),
        unseen_graphemes=(
            ("blanc", "c", "silent", ("/k/",)), ("froid", "d", "silent", ("/d/",)), ("fils", "s", "/s/", ("silent",)),
            ("mer", "r", "/ʁ/", ("silent",)), ("neuf", "f", "/f/", ("silent",)), ("prix", "x", "silent", ("/ks/",)),
            ("tabac", "c", "silent", ("/k/",)), ("cher", "r", "/ʁ/", ("silent",)), ("sport", "t", "silent", ("/t/",)),
            ("mal", "l", "/l/", ("silent",)),
        ),
    ),
    PronTarget(
        id="final_ent", label="Verb -ent", sprint=1, kind="grapheme", ref="pronunciation#final-ent",
        note="-ent on a verb (ils parlent) is SILENT. -ent on an adverb/noun (souvent, comment) is /ɑ̃/.",
        graphemes=(
            ("ils parlent", "-ent", "silent", ("/ɑ̃/",)), ("comment", "-ent", "/ɑ̃/", ("silent",)),
            ("elles aiment", "-ent", "silent", ("/ɑ̃/",)), ("souvent", "-ent", "/ɑ̃/", ("silent",)),
            ("ils mangent", "-ent", "silent", ("/ɑ̃/",)), ("vraiment", "-ent", "/ɑ̃/", ("silent",)),
            ("ils restent", "-ent", "silent", ("/ɑ̃/",)), ("argent", "-ent", "/ɑ̃/", ("silent",)),
        ),
        unseen_graphemes=(
            ("ils travaillent", "-ent", "silent", ("/ɑ̃/",)), ("moment", "-ent", "/ɑ̃/", ("silent",)),
            ("elles pensent", "-ent", "silent", ("/ɑ̃/",)), ("lentement", "-ent", "/ɑ̃/", ("silent",)),
            ("ils veulent", "-ent", "silent", ("/ɑ̃/",)), ("différent", "-ent", "/ɑ̃/", ("silent",)),
        ),
        min_attempts=8,
    ),
    PronTarget(
        id="liaison_intro", label="ils ont / ils sont", sprint=1, kind="ab", ref="pronunciation#liaison",
        note="ils‿ont /ilzɔ̃/ (liaison z) vs ils sont /ilsɔ̃/. Hear the z.",
        sounds=("/z/ liaison (ont, aiment…)", "/s/ (sont, savent…)"),
        pairs=(("ils ont", "ils sont"), ("elles ont", "elles sont"), ("ils aiment", "ils s'aiment"), ("vous avez", "vous savez"),
               ("nous avons", "nous savons"), ("ils attendent", "ils s'attendent")),
        unseen_pairs=(("elles aiment", "elles s'aiment"), ("ils écoutent", "ils s'écoutent"), ("vous aimez", "vous semez"),
                      ("ils appellent", "ils s'appellent")),
        min_attempts=8,
    ),
    PronTarget(
        id="e_vs_eh", label="/e/ vs /ɛ/", sprint=2, kind="ab", ref="pronunciation#e-vs-eh",
        note="é, -er, -ez = /e/ (closed). è, ê, ai, ais, ait, -et = /ɛ/ (open, like Spanish e in 'perro').",
        sounds=("/e/ (é, er, ez)", "/ɛ/ (è, ê, ai, et)"),
        pairs=(("pré", "prêt"), ("dé", "dais"), ("fée", "fait"), ("été", "était"), ("thé", "taie"), ("les", "lait"), ("allé", "allait"), ("mes", "mais")),
        unseen_pairs=(("né", "naît"), ("ré", "raie"), ("gué", "guet"), ("vallée", "valet"), ("clé", "claie"), ("parlé", "parlait")),
        threshold=0.75, min_attempts=12,
    ),
    PronTarget(
        id="oe_vs_o", label="/ø/ vs /o/", sprint=2, kind="ab", ref="pronunciation#eu",
        note="eu = /ø/: say /e/ and round the lips. o / au / eau = /o/. cheveux ≠ chevaux.",
        sounds=("/ø/ (eu)", "/o/ (o, au, eau)"),
        pairs=(("peu", "peau"), ("ceux", "seau"), ("deux", "dos"), ("veux", "veau"), ("cheveux", "chevaux"), ("jeune", "jaune"), ("nœud", "nos")),
        unseen_pairs=(("feu", "faux"), ("bœufs", "beau"), ("queue", "côte"), ("pneu", "pot"), ("vœu", "vos")),
        threshold=0.75,
    ),
    PronTarget(
        id="liaison_recognition", label="Liaison", sprint=2, kind="liaison", ref="pronunciation#liaison",
        note="Silent final consonant returns before a vowel inside a group: les‿amis, vous‿avez, un‿homme. Never after et.",
        pairs=(("les amis", "liaison"), ("vous avez", "liaison"), ("un homme", "liaison"), ("et aussi", "no liaison"),
               ("petit ami", "liaison"), ("les héros", "no liaison"), ("nous allons", "liaison"), ("ils sont", "no liaison"),
               ("très important", "liaison"), ("chez eux", "liaison"), ("mais oui", "no liaison"), ("deux heures", "liaison")),
        unseen_pairs=(("ils habitent", "liaison"), ("mon ami", "liaison"), ("et elle", "no liaison"), ("les enfants", "liaison"),
                      ("vous êtes", "liaison"), ("le hasard", "no liaison"), ("dans un mois", "liaison"), ("un peu", "no liaison")),
        min_attempts=10,
    ),
    PronTarget(
        id="rhythm_reading", label="Read aloud", sprint=2, kind="self", ref="pronunciation#rhythm",
        note="Even syllables, stress only the last syllable of the group. Read, then compare with TTS.",
        words=("Je travaille demain.", "Tu veux un café ?", "On va au restaurant ce soir.", "Je ne sais pas encore.",
               "Il y a beaucoup de gens ici.", "Elle habite dans un petit appartement."),
        unseen_words=("Je dois partir maintenant.", "Vous pouvez répéter, s'il vous plaît ?", "Nous allons à Paris la semaine prochaine.",
                      "Ils aiment beaucoup la musique.", "Est-ce que tu as le temps ?", "Je pense que c'est une bonne idée."),
        threshold=0.7, min_attempts=6, carry=True,
    ),
    PronTarget(
        id="spoken_reductions", label="Spoken French", sprint=3, kind="liaison", ref="spoken-french",
        note="ne drops, il y a → y a, je ne sais pas → chais pas, tu as → t'as. Recognize, don't imitate yet.",
        pairs=(("je sais pas", "je ne sais pas"), ("y a un problème", "il y a un problème"), ("t'as le temps ?", "tu as le temps ?"),
               ("j'sais pas", "je ne sais pas"), ("on va manger", "nous allons manger"), ("il est pas là", "il n'est pas là"),
               ("y a pas de souci", "il n'y a pas de souci"), ("t'es prêt ?", "tu es prêt ?")),
        unseen_pairs=(("je veux pas", "je ne veux pas"), ("y a du monde", "il y a du monde"), ("t'habites où ?", "tu habites où ?"),
                      ("on y va", "nous y allons"), ("c'est pas grave", "ce n'est pas grave"), ("j'ai pas faim", "je n'ai pas faim")),
        min_attempts=8,
    ),
    PronTarget(
        id="enchainement_schwa", label="Linking & schwa", sprint=3, kind="self", ref="pronunciation#schwa",
        note="Consonants attach to the next vowel (il‿est → i-lɛ); weak e disappears (samedi → sam-di).",
        words=("Il est là.", "Elle arrive demain.", "Je ne sais pas.", "Une amie américaine.", "Samedi, je me lève tôt.",
               "Il y a quelque chose."),
        unseen_words=("Elle est ingénieur.", "Il habite à côté.", "Je te le donne.", "Une autre idée.", "Ce que je veux dire…",
                      "Petit à petit."),
        threshold=0.7, min_attempts=6,
    ),
    PronTarget(
        id="shadowing", label="Shadowing", sprint=4, kind="self", ref="pronunciation#rhythm",
        note="Only with text you fully understand. Play, speak along, match the rhythm.",
        words=("Je m'appelle Cole et j'habite à Chicago. Je suis ingénieur.",
               "Le week-end, j'aime faire du sport et voir mes amis.",
               "Hier, j'ai travaillé, puis je suis rentré tard.",
               "Demain, je vais commencer un nouveau projet."),
        unseen_words=("Je pense que le français est difficile, mais intéressant.",
                      "Ce matin, j'ai pris le métro pour aller au bureau.",
                      "On va essayer de parler seulement en français."),
        threshold=0.7, min_attempts=4,
    ),
)

PRON_BY_ID: dict[str, PronTarget] = {t.id: t for t in PRON_TARGETS}


def targets_for_sprint(sprint: int) -> list[PronTarget]:
    return [t for t in PRON_TARGETS if t.sprint == sprint]


def targets_through_sprint(sprint: int) -> list[PronTarget]:
    return [t for t in PRON_TARGETS if t.sprint <= sprint]


# ---------------------------------------------------------------------------
# meanings for every minimal-pair word, so a sound drill never quizzes on a
# word the learner cannot place. Spanish glosses; "(nombre)" marks names.
# ---------------------------------------------------------------------------

GLOSSES: dict[str, str] = {
    "Jean": "Juan (nombre)", "allait": "iba", "allé": "ido", "bain": "baño", "baiser": "beso / besar", "baisser": "bajar",
    "banc": "banco (asiento)", "base": "base", "basse": "baja", "beau": "bello", "beige": "beis", "blanc": "blanco", "blin": "blini",
    "blond": "rubio", "bon": "bueno", "bouche": "boca", "bouge": "(se) mueve", "boule": "bola", "bout": "extremo / trozo", "bu": "bebido",
    "bulle": "burbuja", "bêche": "pala", "bœufs": "bueyes", "c'est pas grave": "no pasa nada (oral)", "cache": "esconde", "cage": "jaula",
    "case": "casilla", "caser": "colocar", "casse": "rompe", "casser": "romper", "ce n'est pas grave": "no pasa nada", "cent": "cien",
    "cesse": "cesa", "ceux": "los (que)", "champ": "campo", "chant": "canto", "char": "carro", "chaîne": "cadena", "chevaux": "caballos",
    "cheveux": "cabellos", "chez eux": "en su casa", "choix": "elección", "chose": "cosa", "chou": "col / repollo", "chute": "caída",
    "claie": "rejilla", "clé": "llave", "cour": "patio", "cousin": "primo", "coussin": "cojín", "cri": "grito", "cru": "crudo",
    "cure": "cura", "côte": "costa / costilla", "daim": "gamo / ante", "dais": "dosel", "dans": "en / dentro", "dans un mois": "dentro de un mes",
    "dessert": "postre", "dessous": "debajo", "dessus": "encima", "deux": "dos", "deux heures": "dos horas / las dos", "dire": "decir",
    "dit": "dice / dicho", "don": "don / donación", "dos": "espalda", "douce": "dulce (f)", "doux": "dulce (m)", "douze": "doce", "du": "del",
    "dur": "duro", "dé": "dado", "désert": "desierto", "elles aiment": "ellas aman", "elles ont": "ellas tienen", "elles s'aiment": "ellas se aman",
    "elles sont": "ellas son", "et aussi": "y también", "et elle": "y ella", "face": "cara", "fait": "hace / hecho", "faux": "falso", "feu": "fuego",
    "fit": "hizo", "fut": "fue", "fée": "hada", "gain": "ganancia", "gant": "guante", "gens": "gente", "gond": "bisagra", "guet": "acecho",
    "gué": "vado", "gêne": "molestia", "hache": "hacha", "hausse": "subida", "il est pas là": "no está (oral)", "il n'est pas là": "no está",
    "il n'y a pas de souci": "no hay problema", "il y a du monde": "hay gente", "il y a un problème": "hay un problema", "ils aiment": "ellos aman",
    "ils appellent": "ellos llaman", "ils attendent": "ellos esperan", "ils habitent": "ellos viven", "ils ont": "ellos tienen",
    "ils s'aiment": "ellos se aman", "ils s'appellent": "ellos se llaman", "ils s'attendent": "ellos se esperan", "ils s'écoutent": "ellos se escuchan",
    "ils sont": "ellos son", "ils écoutent": "ellos escuchan", "j'ai pas faim": "no tengo hambre (oral)", "j'ose": "me atrevo",
    "j'sais pas": "no sé (muy oral)", "jar": "jarra", "jaune": "amarillo", "je n'ai pas faim": "no tengo hambre", "je ne sais pas": "no sé",
    "je ne veux pas": "no quiero", "je sais pas": "no sé (oral)", "je veux pas": "no quiero (oral)", "jeune": "joven", "joie": "alegría",
    "joue": "mejilla / juega", "jus": "jugo", "jute": "yute", "kir": "kir (bebida)", "lait": "leche", "le hasard": "la casualidad", "lent": "lento",
    "les": "los / las", "les amis": "los amigos", "les enfants": "los niños", "les héros": "los héroes", "liaison": "enlace", "lin": "lino",
    "lise": "lea (subj.)", "lisse": "liso", "lit": "cama", "long": "largo", "loup": "lobo", "lu": "leído", "lécher": "lamer", "léger": "ligero",
    "mage": "mago", "main": "mano", "mais": "pero", "mais oui": "claro que sí", "ment": "miente", "mes": "mis", "mi": "mi (nota)", "mille": "mil",
    "mon ami": "mi amigo", "mont": "monte", "mou": "blando", "moule": "mejillón / molde", "mu": "movido", "mue": "muda (de piel)", "mule": "mula",
    "mâche": "mastica", "naît": "nace", "nid": "nido", "no liaison": "sin enlace", "nos": "nuestros", "nous": "nosotros", "nous allons": "vamos",
    "nous allons manger": "vamos a comer", "nous avons": "tenemos", "nous savons": "sabemos", "nous y allons": "vamos allí", "nu": "desnudo",
    "né": "nacido", "nœud": "nudo", "on va manger": "vamos a comer", "on y va": "vamos", "ose": "se atreve", "pain": "pan", "pan": "faldón / lado",
    "parlait": "hablaba", "parlé": "hablado", "peau": "piel", "petit ami": "novio", "peu": "poco", "phase": "fase", "pire": "peor", "pis": "peor (oral)",
    "plan": "plano / plan", "plein": "lleno", "plomb": "plomo", "pneu": "neumático", "poison": "veneno", "poisson": "pez / pescado", "pont": "puente",
    "pot": "tarro", "pou": "piojo", "poule": "gallina", "pour": "para", "pré": "prado", "prêt": "listo", "pu": "podido", "pull": "jersey", "pur": "puro",
    "queue": "cola", "raie": "raya", "rang": "fila", "rein": "riñón", "riz": "arroz", "rond": "redondo", "roue": "rueda", "rue": "calle",
    "ruse": "astucia", "russe": "ruso", "ré": "re (nota)", "sain": "sano", "saint": "santo", "sans": "sin", "seau": "cubo", "seize": "dieciséis",
    "si": "si / tan", "son": "su / sonido", "sourd": "sordo", "sous": "bajo / debajo", "su": "sabido", "sûr": "seguro", "t'as le temps ?": "¿tienes tiempo? (oral)",
    "t'es prêt ?": "¿estás listo? (oral)", "t'habites où ?": "¿dónde vives? (oral)", "taie": "funda", "tant": "tanto", "teint": "tez", "temps": "tiempo",
    "thon": "atún", "thé": "té", "ton": "tu / tono", "tout": "todo", "très important": "muy importante", "tu": "tú", "tu as le temps ?": "¿tienes tiempo?",
    "tu es prêt ?": "¿estás listo?", "tu habites où ?": "¿dónde vives?", "un homme": "un hombre", "un peu": "un poco", "valet": "criado / sota",
    "vallée": "valle", "veau": "ternera", "vent": "viento", "veux": "quiero / quieres", "vie": "vida", "vin": "vino", "vise": "apunta", "visse": "atornilla",
    "vont": "van", "vos": "vuestros", "vous": "vosotros / usted", "vous aimez": "amáis", "vous avez": "tenéis", "vous savez": "sabéis",
    "vous semez": "sembráis", "vous êtes": "sois", "vu": "visto", "vue": "vista", "vœu": "deseo", "y a du monde": "hay gente (oral)",
    "y a pas de souci": "no hay problema (oral)", "y a un problème": "hay un problema (oral)", "âge": "edad", "était": "era / estaba", "été": "verano / sido",
}


def gloss(word: str) -> str:
    return GLOSSES.get(word, "")


def glossed(word: str) -> str:
    """"tout = todo" when a gloss exists, else the bare word."""
    meaning = gloss(word)
    return f"{word} = {meaning}" if meaning else word
