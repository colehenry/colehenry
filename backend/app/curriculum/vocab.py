"""Month-1 Core / Recognition vocabulary, sprint by sprint.

Each item is a structured learning object (spec §17). Spanish is the bridge:
`spanish` is the default gloss, `english` is there when it helps. IPA is
France French. `status` is the *curriculum default* — the learner can promote
or demote items in the Vocabulary view; that state lives in `learning_vocab`.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field


@dataclass(frozen=True)
class VocabItem:
    id: str
    french: str
    spanish: str
    english: str
    part_of_speech: str
    sprint: int
    status: str = "core"  # core | recognition
    priority: int = 1  # 1 = must-have, 2 = important, 3 = nice
    gender: str = ""  # m | f | "" for non-nouns
    ipa: str = ""
    frequency_band: str = "very_high"  # very_high | high | mid
    example_fr: str = ""
    example_es: str = ""
    pattern: str = ""
    spanish_connection: str = ""
    pronunciation_warning: str = ""
    cognate_type: str = "none"  # strong | partial | none | false
    false_friend: bool = False
    reference_links: tuple[str, ...] = ()
    tags: tuple[str, ...] = field(default_factory=tuple)

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "french": self.french,
            "spanish": self.spanish,
            "english": self.english,
            "part_of_speech": self.part_of_speech,
            "sprint": self.sprint,
            "status": self.status,
            "priority": self.priority,
            "gender": self.gender or None,
            "ipa": self.ipa,
            "frequency_band": self.frequency_band,
            "example_fr": self.example_fr,
            "example_es": self.example_es,
            "pattern": self.pattern,
            "spanish_connection": self.spanish_connection,
            "pronunciation_warning": self.pronunciation_warning,
            "cognate_type": self.cognate_type,
            "false_friend": self.false_friend,
            "reference_links": list(self.reference_links),
            "tags": list(self.tags),
        }


def slug(text: str) -> str:
    base = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "_", base.lower()).strip("_")
    return base


_ITEMS: list[VocabItem] = []
_SPRINT = 1


def _v(
    french: str,
    spanish: str,
    english: str,
    pos: str,
    *,
    ex: tuple[str, str] = ("", ""),
    ipa: str = "",
    gender: str = "",
    status: str = "core",
    priority: int = 1,
    band: str = "very_high",
    pattern: str = "",
    es: str = "",
    warn: str = "",
    cognate: str = "none",
    false_friend: bool = False,
    refs: tuple[str, ...] = (),
    tags: tuple[str, ...] = (),
    id: str | None = None,
) -> VocabItem:
    item = VocabItem(
        id=id or f"fr_{slug(french)}",
        french=french,
        spanish=spanish,
        english=english,
        part_of_speech=pos,
        sprint=_SPRINT,
        status=status,
        priority=priority,
        gender=gender,
        ipa=ipa,
        frequency_band=band,
        example_fr=ex[0],
        example_es=ex[1],
        pattern=pattern,
        spanish_connection=es,
        pronunciation_warning=warn,
        cognate_type=cognate,
        false_friend=false_friend,
        reference_links=refs,
        tags=("month1", f"sprint{_SPRINT}", *tags),
    )
    _ITEMS.append(item)
    return item


# ---------------------------------------------------------------------------
# Sprint 1 — Foundation: pronouns, glue, question words, adverbs, frames
# ---------------------------------------------------------------------------
_SPRINT = 1

# pronouns / determiners
_v("je", "yo", "I", "pron", ipa="/ʒə/", ex=("Je suis Cole.", "Soy Cole."),
   es="Never dropped like Spanish 'yo' — French always needs the subject.",
   refs=("pronouns#subject",), tags=("pronoun",))
_v("tu", "tú", "you (informal)", "pron", ipa="/ty/", ex=("Tu es prêt ?", "¿Estás listo?"),
   warn="/ty/ — rounded /y/, not Spanish 'tu' /tu/. tu ≠ tout.",
   refs=("pronouns#subject", "pronunciation#y-vs-u"), tags=("pronoun",))
_v("il", "él", "he / it", "pron", ipa="/il/", ex=("Il est là.", "Él está ahí."),
   refs=("pronouns#subject",), tags=("pronoun",))
_v("elle", "ella", "she / it", "pron", ipa="/ɛl/", ex=("Elle travaille ici.", "Ella trabaja aquí."),
   refs=("pronouns#subject",), tags=("pronoun",))
_v("on", "nosotros / uno / la gente", "we (spoken) / one", "pron", ipa="/ɔ̃/",
   ex=("On va au restaurant ?", "¿Vamos al restaurante?"),
   pattern="on + 3rd-person singular verb",
   es="Everyday 'we'. Conjugates like il/elle, means nous. Also impersonal 'se/uno'.",
   refs=("pronouns#on", "spoken-french#on-vs-nous"), tags=("pronoun",))
_v("nous", "nosotros", "we", "pron", ipa="/nu/", ex=("Nous sommes ici.", "Estamos aquí."),
   es="Written / formal 'we'. In speech 'on' wins.",
   refs=("pronouns#subject",), tags=("pronoun",))
_v("vous", "usted / ustedes / vosotros", "you (formal / plural)", "pron", ipa="/vu/",
   ex=("Vous parlez français ?", "¿Habla usted francés?"),
   es="One word for usted + ustedes + vosotros.",
   refs=("pronouns#subject",), tags=("pronoun",))
_v("ils / elles", "ellos / ellas", "they", "pron", ipa="/il/ · /ɛl/",
   ex=("Ils sont français.", "Ellos son franceses."),
   warn="Sounds identical to il / elle — the verb ending -ent is silent too.",
   refs=("pronouns#subject", "pronunciation#final-ent"), tags=("pronoun",), id="fr_ils_elles")
_v("ce", "este / eso (c'est)", "this / that / it", "det", ipa="/sə/",
   ex=("C'est mon ami.", "Es mi amigo."), pattern="c'est + noun / adjective",
   refs=("sentence-architecture#cest",), tags=("frame",))
_v("ça", "eso / esto", "that / it", "pron", ipa="/sa/",
   ex=("Ça va ?", "¿Qué tal? / ¿Va bien?"), es="ça = cela in speech. Ça va, ça marche, c'est ça.",
   tags=("frame",))
_v("le / la / les", "el / la / los / las", "the", "det", ipa="/lə/ /la/ /le/",
   ex=("Le travail, la maison, les amis.", "El trabajo, la casa, los amigos."),
   es="Same idea as Spanish articles; le → l' before a vowel (l'ami).",
   warn="le /lə/ vs les /le/ — often the only audible plural marker.",
   refs=("articles#definite", "pronunciation#le-vs-les"), tags=("article",), id="fr_le_la_les")
_v("un / une / des", "un / una / unos / unas", "a / some", "det", ipa="/œ̃/ /yn/ /de/",
   ex=("Un café, une bière, des amis.", "Un café, una cerveza, unos amigos."),
   es="des is mandatory where Spanish drops the article: J'ai des amis = Tengo amigos.",
   refs=("articles#indefinite",), tags=("article",), id="fr_un_une_des")

# question words
_v("qui", "quién", "who", "qword", ipa="/ki/", ex=("Qui est-ce ?", "¿Quién es?"),
   refs=("questions#words",), tags=("question",))
_v("quoi", "qué", "what", "qword", ipa="/kwa/", ex=("Tu fais quoi ?", "¿Qué haces?"),
   es="Spoken 'what' at the end of a sentence. Formal: qu'est-ce que.",
   refs=("questions#words",), tags=("question",))
_v("où", "dónde", "where", "qword", ipa="/u/", ex=("Tu habites où ?", "¿Dónde vives?"), id="fr_ou_where",
   refs=("questions#words",), tags=("question",))
_v("quand", "cuándo", "when", "qword", ipa="/kɑ̃/", ex=("Quand est-ce que tu pars ?", "¿Cuándo te vas?"),
   warn="Nasal /ɑ̃/ — the d is silent (liaison /t/ before a vowel: quand il).",
   refs=("questions#words", "pronunciation#nasals"), tags=("question",))
_v("comment", "cómo", "how", "qword", ipa="/kɔmɑ̃/", ex=("Comment ça va ?", "¿Cómo estás?"),
   warn="-ent here IS pronounced /ɑ̃/ (it's not a verb ending).",
   refs=("questions#words",), tags=("question",))
_v("pourquoi", "por qué", "why", "qword", ipa="/puʁkwa/",
   ex=("Pourquoi tu es fatigué ?", "¿Por qué estás cansado?"),
   es="pourquoi ↔ por qué; answer with parce que ↔ porque.",
   refs=("questions#words",), tags=("question",))
_v("quel / quelle", "qué / cuál", "which / what", "qword", ipa="/kɛl/",
   ex=("Quelle heure est-il ?", "¿Qué hora es?"), es="Agrees with the noun: quel jour, quelle heure.",
   refs=("questions#quel",), tags=("question",), id="fr_quel")

# glue
_v("et", "y", "and", "conj", ipa="/e/", ex=("Toi et moi.", "Tú y yo."),
   warn="/e/, never liaise after et: et‿aussi is wrong.", tags=("glue",))
_v("ou", "o", "or", "conj", ipa="/u/", ex=("Café ou thé ?", "¿Café o té?"),
   warn="ou /u/ = or; où /u/ = where — same sound, accent only.", tags=("glue",))
_v("mais", "pero", "but", "conj", ipa="/mɛ/", ex=("Oui, mais pas maintenant.", "Sí, pero no ahora."),
   warn="Silent s. mais /mɛ/ vs mes /me/.", tags=("glue",))
_v("parce que", "porque", "because", "conj", ipa="/paʁs kə/",
   ex=("Je reste parce que je suis fatigué.", "Me quedo porque estoy cansado."),
   es="parce que ↔ porque (reason). pourquoi ↔ por qué (question).", tags=("glue",))
_v("avec", "con", "with", "prep", ipa="/avɛk/", ex=("Je travaille avec elle.", "Trabajo con ella."),
   warn="Final c IS pronounced (CaReFuL).", tags=("glue",))
_v("sans", "sin", "without", "prep", ipa="/sɑ̃/", ex=("Un café sans sucre.", "Un café sin azúcar."),
   warn="Nasal /ɑ̃/, s silent.", tags=("glue",))
_v("pour", "para / por", "for / in order to", "prep", ipa="/puʁ/",
   ex=("C'est pour toi.", "Es para ti."), es="One word for both para and por (mostly).", tags=("glue",))
_v("de", "de", "of / from", "prep", ipa="/də/", ex=("Je viens de Chicago.", "Vengo de Chicago."),
   es="de + le → du, de + les → des.", refs=("articles#contractions",), tags=("glue",))
_v("à", "a / en", "to / at / in", "prep", ipa="/a/", ex=("Je vais à Paris.", "Voy a París."),
   es="à + le → au, à + les → aux. à Paris, au bureau, aux États-Unis.",
   refs=("articles#contractions",), tags=("glue",))
_v("dans", "en / dentro de", "in / inside", "prep", ipa="/dɑ̃/",
   ex=("Il est dans la voiture.", "Está en el coche."), es="Physical 'in'. 'en' is for languages/countries/months.",
   tags=("glue",))
_v("sur", "sobre / en", "on", "prep", ipa="/syʁ/", ex=("C'est sur la table.", "Está en la mesa."),
   warn="/syʁ/ with /y/ — not 'sour'.", tags=("glue",))
_v("chez", "en casa de / donde", "at (someone's place)", "prep", ipa="/ʃe/",
   ex=("On mange chez moi ?", "¿Comemos en mi casa?"), es="No Spanish equivalent — chez + person.",
   refs=("articles#chez",), tags=("glue",))

# adverbs
_v("oui", "sí", "yes", "adv", ipa="/wi/", ex=("Oui, bien sûr.", "Sí, claro."), tags=("adverb",))
_v("non", "no", "no", "adv", ipa="/nɔ̃/", ex=("Non, merci.", "No, gracias."),
   warn="Nasal /ɔ̃/ — no final n sound.", tags=("adverb",))
_v("bien", "bien", "well / good", "adv", ipa="/bjɛ̃/", ex=("Ça va bien.", "Va bien."),
   warn="/bjɛ̃/ nasal — not Spanish 'bien' /bjen/.", cognate="strong", tags=("adverb",))
_v("mal", "mal", "badly", "adv", ipa="/mal/", ex=("J'ai mal à la tête.", "Me duele la cabeza."),
   pattern="avoir mal à + body part", cognate="strong", tags=("adverb",))
_v("très", "muy", "very", "adv", ipa="/tʁɛ/", ex=("C'est très bien.", "Está muy bien."),
   warn="Silent s.", tags=("adverb",))
_v("vraiment", "de verdad / realmente", "really", "adv", ipa="/vʁɛmɑ̃/",
   ex=("C'est vraiment bon.", "Está realmente bueno."), tags=("adverb",))
_v("aussi", "también", "also / too", "adv", ipa="/osi/", ex=("Moi aussi.", "Yo también."), tags=("adverb",))
_v("ici", "aquí", "here", "adv", ipa="/isi/", ex=("Je travaille ici.", "Trabajo aquí."), tags=("adverb",))
_v("là", "ahí / allí", "there", "adv", ipa="/la/", ex=("Il est là.", "Está ahí."),
   es="Also 'là' = here, right now (je suis là = I'm here).", tags=("adverb",))
_v("maintenant", "ahora", "now", "adv", ipa="/mɛ̃tnɑ̃/", ex=("On y va maintenant ?", "¿Vamos ahora?"),
   warn="Two nasals; middle e drops: /mɛ̃t-nɑ̃/.", tags=("adverb", "time"))
_v("aujourd'hui", "hoy", "today", "adv", ipa="/oʒuʁdɥi/", ex=("Je travaille aujourd'hui.", "Trabajo hoy."),
   tags=("adverb", "time"))
_v("demain", "mañana", "tomorrow", "adv", ipa="/dəmɛ̃/", ex=("À demain !", "¡Hasta mañana!"), tags=("adverb", "time"))
_v("hier", "ayer", "yesterday", "adv", ipa="/jɛʁ/", ex=("Hier, j'ai travaillé.", "Ayer trabajé."),
   warn="Final r pronounced.", tags=("adverb", "time"))
_v("toujours", "siempre / todavía", "always / still", "adv", ipa="/tuʒuʁ/",
   ex=("Il est toujours en retard.", "Siempre llega tarde."), es="Also 'still': Tu es toujours là ?",
   tags=("adverb",))
_v("jamais", "nunca", "never", "adv", ipa="/ʒamɛ/", ex=("Je ne fume jamais.", "Nunca fumo."),
   pattern="ne … jamais", es="Replaces pas: ne … jamais ↔ nunca / no … nunca.",
   refs=("sentence-architecture#negation",), tags=("adverb",))
_v("encore", "todavía / otra vez / más", "still / again / more", "adv", ipa="/ɑ̃kɔʁ/",
   ex=("Encore un café ?", "¿Otro café?"), es="Three uses: still (toujours), again, more.", tags=("adverb",))
_v("déjà", "ya", "already", "adv", ipa="/deʒa/", ex=("J'ai déjà mangé.", "Ya he comido."), tags=("adverb",))
_v("beaucoup", "mucho", "a lot / much", "adv", ipa="/boku/", ex=("Merci beaucoup.", "Muchas gracias."),
   pattern="beaucoup de + noun", warn="eau = /o/, final p silent.", tags=("adverb",))
_v("un peu", "un poco", "a little", "adv", ipa="/œ̃ pø/", ex=("Je parle un peu français.", "Hablo un poco de francés."),
   tags=("adverb",))

# early conversational frames
_v("c'est", "es", "it is / this is", "frame", ipa="/sɛ/", ex=("C'est facile.", "Es fácil."),
   pattern="c'est + adj / noun", es="Default 'es' for identifying/commenting. Plural: ce sont (speech: c'est).",
   refs=("sentence-architecture#cest",), tags=("frame",))
_v("il y a", "hay", "there is / there are", "frame", ipa="/ilja/", ex=("Il y a un problème.", "Hay un problema."),
   pattern="il y a + noun", es="Invariable like 'hay'. Spoken: 'y a'.",
   refs=("sentence-architecture#il-y-a", "spoken-french#il-y-a"), tags=("frame",))
_v("je ne sais pas", "no sé", "I don't know", "frame", ipa="/ʒə n(ə) sɛ pa/",
   ex=("Je ne sais pas encore.", "Todavía no sé."), es="Spoken: 'je sais pas' / 'chais pas'.",
   refs=("questions#repair",), tags=("frame",))
_v("d'accord", "vale / de acuerdo", "okay / agreed", "frame", ipa="/dakɔʁ/",
   ex=("D'accord, à demain.", "Vale, hasta mañana."), cognate="strong", tags=("frame",))
_v("merci", "gracias", "thank you", "frame", ipa="/mɛʁsi/", ex=("Merci beaucoup !", "¡Muchas gracias!"), tags=("frame",))
_v("bonjour / salut", "buenos días / hola", "hello / hi", "frame", ipa="/bɔ̃ʒuʁ/ · /saly/",
   ex=("Salut, ça va ?", "Hola, ¿qué tal?"), es="bonjour = formal/daytime default; salut = hi/bye with friends.",
   tags=("frame",), id="fr_bonjour")
_v("pardon / désolé", "perdón / lo siento", "sorry / excuse me", "frame", ipa="/paʁdɔ̃/ · /dezɔle/",
   ex=("Pardon, je ne comprends pas.", "Perdón, no entiendo."), es="pardon = excuse me / say again; désolé(e) = sorry.",
   refs=("questions#repair",), tags=("frame",), id="fr_pardon")
_v("s'il te plaît", "por favor", "please", "frame", ipa="/sil tə plɛ/",
   ex=("Un café, s'il te plaît.", "Un café, por favor."), es="s'il vous plaît with vous.", tags=("frame",), status="recognition", priority=2)
_v("qu'est-ce que", "qué", "what (question opener)", "frame", ipa="/kɛs kə/",
   ex=("Qu'est-ce que tu fais ?", "¿Qué haces?"), pattern="qu'est-ce que + subject + verb",
   es="Hear it as one chunk /kɛskə/. Recognize first; produce 'tu fais quoi ?' meanwhile.",
   refs=("questions#est-ce-que",), tags=("frame", "question"), status="recognition")
_v("est-ce que", "(¿…?)", "question marker", "frame", ipa="/ɛs kə/",
   ex=("Est-ce que tu viens ?", "¿Vienes?"), pattern="est-ce que + statement ?",
   es="Turns any statement into a yes/no question — no word-order change.",
   refs=("questions#est-ce-que",), tags=("frame", "question"))

# core nouns + adjectives for first sentences
_v("ami / amie", "amigo / amiga", "friend", "noun", gender="m", ipa="/ami/",
   ex=("C'est un ami.", "Es un amigo."), cognate="strong", tags=("noun", "people"), id="fr_ami")
_v("travail", "trabajo", "work / job", "noun", gender="m", ipa="/tʁavaj/",
   ex=("J'ai beaucoup de travail.", "Tengo mucho trabajo."), warn="-ail = /aj/, l is not an l.",
   cognate="strong", refs=("spelling#ill",), tags=("noun", "work"))
_v("maison", "casa", "house / home", "noun", gender="f", ipa="/mɛzɔ̃/",
   ex=("Je suis à la maison.", "Estoy en casa."), pattern="à la maison = at home", tags=("noun", "place"))
_v("temps", "tiempo", "time / weather", "noun", gender="m", ipa="/tɑ̃/",
   ex=("Je n'ai pas le temps.", "No tengo tiempo."), warn="ps silent: /tɑ̃/.", cognate="strong", tags=("noun",), status="recognition", priority=2)
_v("jour", "día", "day", "noun", gender="m", ipa="/ʒuʁ/", ex=("Bonne journée !", "¡Buen día!"),
   es="jour (unit) vs journée (span of the day) — like día in both senses.", tags=("noun", "time"), status="recognition", priority=2)
_v("chose", "cosa", "thing", "noun", gender="f", ipa="/ʃoz/", ex=("C'est une bonne chose.", "Es una buena cosa."),
   pattern="quelque chose = algo", cognate="strong", tags=("noun",), status="recognition", priority=2)
_v("problème", "problema", "problem", "noun", gender="m", ipa="/pʁɔblɛm/",
   ex=("Pas de problème.", "No hay problema."), warn="Masculine like Spanish (un problème).", cognate="strong",
   tags=("noun",))
_v("question", "pregunta", "question", "noun", gender="f", ipa="/kɛstjɔ̃/",
   ex=("J'ai une question.", "Tengo una pregunta."), cognate="partial", tags=("noun",), status="recognition", priority=2)
_v("français", "francés", "French", "adj", ipa="/fʁɑ̃sɛ/", ex=("Je parle un peu français.", "Hablo un poco de francés."),
   warn="Nasal /ɑ̃/ + silent s. Feminine française /fʁɑ̃sɛz/.", cognate="strong", tags=("adj", "language"))
_v("anglais", "inglés", "English", "adj", ipa="/ɑ̃ɡlɛ/", ex=("Je parle anglais.", "Hablo inglés."),
   cognate="partial", tags=("adj", "language"), status="recognition", priority=2)
_v("espagnol", "español", "Spanish", "adj", ipa="/ɛspaɲɔl/", ex=("Je parle espagnol.", "Hablo español."),
   warn="gn = /ɲ/ (like ñ).", cognate="strong", tags=("adj", "language"), status="recognition", priority=2)
_v("bon / bonne", "bueno / buena", "good", "adj", ipa="/bɔ̃/ · /bɔn/",
   ex=("C'est bon.", "Está bueno."), warn="bon /bɔ̃/ nasal; bonne /bɔn/ oral — the n comes back.",
   cognate="strong", refs=("pronunciation#nasals",), tags=("adj",), id="fr_bon")
_v("grand / grande", "grande / alto", "big / tall", "adj", ipa="/ɡʁɑ̃/ · /ɡʁɑ̃d/",
   ex=("Une grande maison.", "Una casa grande."), es="Before the noun in French: une grande maison.",
   cognate="strong", refs=("sentence-architecture#adjectives",), tags=("adj",), id="fr_grand", status="recognition", priority=2)
_v("petit / petite", "pequeño / pequeña", "small / little", "adj", ipa="/pəti/ · /pətit/",
   ex=("Un petit café.", "Un café pequeño."), warn="Final t silent in petit, pronounced in petite.",
   refs=("sentence-architecture#adjectives",), tags=("adj",), id="fr_petit", status="recognition", priority=2)
_v("nouveau / nouvelle", "nuevo / nueva", "new", "adj", ipa="/nuvo/ · /nuvɛl/",
   ex=("J'ai un nouveau travail.", "Tengo un trabajo nuevo."), cognate="strong", tags=("adj",), id="fr_nouveau", status="recognition", priority=2)
_v("content / contente", "contento / contenta", "happy / glad", "adj", ipa="/kɔ̃tɑ̃/ · /kɔ̃tɑ̃t/",
   ex=("Je suis content.", "Estoy contento."), cognate="strong", tags=("adj", "feeling"), id="fr_content")
_v("fatigué / fatiguée", "cansado / cansada", "tired", "adj", ipa="/fatiɡe/",
   ex=("Je suis fatigué aujourd'hui.", "Estoy cansado hoy."), es="fatigado exists in Spanish but cansado is the everyday word.",
   cognate="partial", tags=("adj", "feeling"), id="fr_fatigue")
_v("faim", "hambre", "hunger", "noun", gender="f", ipa="/fɛ̃/", ex=("J'ai faim.", "Tengo hambre."),
   pattern="avoir faim", es="avoir faim ↔ tener hambre — same structure.", warn="Nasal /ɛ̃/, m silent.",
   tags=("noun", "avoir"))
_v("soif", "sed", "thirst", "noun", gender="f", ipa="/swaf/", ex=("Tu as soif ?", "¿Tienes sed?"),
   pattern="avoir soif", es="avoir soif ↔ tener sed.", tags=("noun", "avoir"), status="recognition", priority=2)
_v("an / ans", "año / años", "year (age)", "noun", gender="m", ipa="/ɑ̃/",
   ex=("J'ai 30 ans.", "Tengo 30 años."), pattern="avoir + N + ans",
   es="Age uses avoir like tener — never 'je suis 30 ans'.", tags=("noun", "avoir"), id="fr_an")
_v("personne", "persona / nadie", "person / nobody", "noun", gender="f", ipa="/pɛʁsɔn/",
   ex=("Il y a trois personnes.", "Hay tres personas."), es="ne … personne = nadie.", cognate="strong",
   tags=("noun", "people"), status="recognition", priority=2)
_v("ville", "ciudad", "city / town", "noun", gender="f", ipa="/vil/", ex=("J'habite en ville.", "Vivo en la ciudad."),
   warn="ville = /vil/ (exception: not /vij/).", tags=("noun", "place"), status="recognition", priority=2)
_v("langue", "lengua / idioma", "language / tongue", "noun", gender="f", ipa="/lɑ̃ɡ/",
   ex=("Le français est une belle langue.", "El francés es una lengua bonita."), cognate="strong", tags=("noun",), status="recognition", priority=2)
_v("moi / toi", "yo / tú (mí / ti)", "me / you (stressed)", "pron", ipa="/mwa/ · /twa/",
   ex=("Et toi ? — Moi, ça va.", "¿Y tú? — Yo, bien."), es="Tonic pronouns: after prepositions and on their own.",
   refs=("pronouns#tonic",), tags=("pronoun",), id="fr_moi_toi")

# recognition-first cognates (cheap comprehension wins)
_SPRINT = 1
for fr, es_, en, pos, ipa in [
    ("important", "importante", "important", "adj", "/ɛ̃pɔʁtɑ̃/"),
    ("possible", "posible", "possible", "adj", "/pɔsibl/"),
    ("différent", "diferente", "different", "adj", "/difeʁɑ̃/"),
    ("moment", "momento", "moment", "noun", "/mɔmɑ̃/"),
    ("restaurant", "restaurante", "restaurant", "noun", "/ʁɛstoʁɑ̃/"),
    ("musique", "música", "music", "noun", "/myzik/"),
    ("famille", "familia", "family", "noun", "/famij/"),
    ("difficile", "difícil", "difficult", "adj", "/difisil/"),
    ("facile", "fácil", "easy", "adj", "/fasil/"),
    ("intéressant", "interesante", "interesting", "adj", "/ɛ̃teʁesɑ̃/"),
    ("université", "universidad", "university", "noun", "/ynivɛʁsite/"),
    ("téléphone", "teléfono", "phone", "noun", "/telefɔn/"),
]:
    _v(fr, es_, en, pos, ipa=ipa, status="recognition", priority=3, band="high",
       cognate="strong", gender=("f" if fr in ("musique", "famille", "université") else "m" if pos == "noun" else ""),
       warn="Cognate — but French stress is final and endings are silent.", tags=("cognate",))

# ---------------------------------------------------------------------------
# Sprint 2 — Generate: modals, -er verbs, plans, opinions, self-description
# ---------------------------------------------------------------------------
_SPRINT = 2

# modal frames / verbs as vocabulary
_v("vouloir", "querer", "to want", "verb", ipa="/vulwaʁ/", ex=("Je veux partir.", "Quiero irme."),
   pattern="vouloir + infinitif", es="querer + infinitivo", refs=("core-verbs#vouloir", "sentence-architecture#modal"),
   tags=("verb", "modal"))
_v("pouvoir", "poder", "can / to be able", "verb", ipa="/puvwaʁ/", ex=("Je peux venir demain.", "Puedo venir mañana."),
   pattern="pouvoir + infinitif", es="poder + infinitivo", refs=("core-verbs#pouvoir",), tags=("verb", "modal"))
_v("devoir", "deber / tener que", "must / to have to", "verb", ipa="/dəvwaʁ/",
   ex=("Je dois travailler.", "Tengo que trabajar."), pattern="devoir + infinitif",
   es="One verb for deber + tener que.", refs=("core-verbs#devoir",), tags=("verb", "modal"))
_v("savoir", "saber", "to know (facts / how to)", "verb", ipa="/savwaʁ/",
   ex=("Je sais parler espagnol.", "Sé hablar español."), pattern="savoir + infinitif / savoir que",
   es="saber ↔ savoir; conocer ↔ connaître (later).", refs=("core-verbs#savoir",), tags=("verb",))
_v("dire", "decir", "to say / tell", "verb", ipa="/diʁ/", ex=("Qu'est-ce que tu dis ?", "¿Qué dices?"),
   pattern="dire que …", refs=("core-verbs#dire",), tags=("verb",))
_v("parler", "hablar", "to speak / talk", "verb", ipa="/paʁle/", ex=("Je parle un peu français.", "Hablo un poco de francés."),
   pattern="parler + langue / parler de / parler avec", warn="-er = /e/, r silent.", cognate="partial",
   refs=("core-verbs#parler", "spelling#er"), tags=("verb", "er"))
_v("penser", "pensar", "to think", "verb", ipa="/pɑ̃se/", ex=("Je pense que c'est bien.", "Pienso que está bien."),
   pattern="penser que + phrase / penser à", es="pensar que + oración", cognate="strong",
   warn="Don't say the -er like Spanish -ar/-er: /pɑ̃se/.", refs=("core-verbs#penser",), tags=("verb", "er"))
_v("aimer", "gustar / querer", "to like / love", "verb", ipa="/eme/", ex=("J'aime le café.", "Me gusta el café."),
   pattern="aimer + le/la/les + nom / aimer + infinitif",
   es="Subject flips vs gustar: J'aime le café = Me gusta el café. Always the definite article.",
   refs=("core-verbs#aimer", "transfer#aimer-gustar"), tags=("verb", "er"))
_v("travailler", "trabajar", "to work", "verb", ipa="/tʁavaje/", ex=("Je travaille demain.", "Trabajo mañana."),
   cognate="strong", warn="-aill- = /aj/.", refs=("core-verbs#travailler",), tags=("verb", "er"))
_v("habiter", "vivir (en)", "to live (somewhere)", "verb", ipa="/abite/", ex=("J'habite à Chicago.", "Vivo en Chicago."),
   pattern="habiter à + ville / en + pays", es="habitar exists but vivir is the everyday verb — reverse in French.",
   warn="h muet: j'habite.", tags=("verb", "er"))
_v("manger", "comer", "to eat", "verb", ipa="/mɑ̃ʒe/", ex=("On mange à quelle heure ?", "¿A qué hora comemos?"),
   tags=("verb", "er"))
_v("regarder", "mirar / ver (tele)", "to watch / look at", "verb", ipa="/ʁəɡaʁde/",
   ex=("Je regarde une série.", "Veo una serie."), es="regarder la télé = ver la tele.", tags=("verb", "er"))
_v("écouter", "escuchar", "to listen to", "verb", ipa="/ekute/", ex=("J'écoute de la musique.", "Escucho música."),
   es="No preposition: écouter la musique.", cognate="partial", tags=("verb", "er"))
_v("chercher", "buscar", "to look for", "verb", ipa="/ʃɛʁʃe/", ex=("Je cherche un appartement.", "Busco un apartamento."),
   es="No preposition, like buscar.", tags=("verb", "er"))
_v("étudier", "estudiar", "to study", "verb", ipa="/etydje/", ex=("J'étudie le français.", "Estudio francés."),
   cognate="strong", tags=("verb", "er"))
_v("apprendre", "aprender", "to learn", "verb", ipa="/apʁɑ̃dʁ/", ex=("J'apprends le français.", "Aprendo francés."),
   pattern="apprendre à + infinitif", cognate="strong", status="recognition", tags=("verb",))

# self-description / work / places / people
_v("nom", "nombre / apellido", "name", "noun", gender="m", ipa="/nɔ̃/",
   ex=("Je m'appelle Cole.", "Me llamo Cole."), es="Faux ami-ish: FR nom = name; FR nombre = number.",
   false_friend=True, cognate="false", tags=("noun",))
_v("je m'appelle", "me llamo", "my name is", "frame", ipa="/ʒə mapɛl/",
   ex=("Je m'appelle Cole, et toi ?", "Me llamo Cole, ¿y tú?"), es="s'appeler ↔ llamarse, reflexive in both.",
   tags=("frame",))
_v("américain / américaine", "estadounidense", "American", "adj", ipa="/ameʁikɛ̃/ · /ameʁikɛn/",
   ex=("Je suis américain.", "Soy estadounidense."), warn="-ain /ɛ̃/ nasal; -aine /ɛn/ oral.",
   cognate="strong", tags=("adj",), id="fr_americain")
_v("ingénieur", "ingeniero", "engineer", "noun", gender="m", ipa="/ɛ̃ʒenjœʁ/",
   ex=("Je suis ingénieur.", "Soy ingeniero."), es="No article for professions: je suis ingénieur.",
   cognate="strong", tags=("noun", "work"))
_v("entreprise", "empresa", "company", "noun", gender="f", ipa="/ɑ̃tʁəpʁiz/",
   ex=("Je travaille dans une entreprise de logiciels.", "Trabajo en una empresa de software."), tags=("noun", "work"))
_v("bureau", "oficina / escritorio", "office / desk", "noun", gender="m", ipa="/byʁo/",
   ex=("Je vais au bureau.", "Voy a la oficina."), warn="eau = /o/.", tags=("noun", "place", "work"))
_v("collègue", "colega / compañero de trabajo", "coworker", "noun", gender="m", ipa="/kɔlɛɡ/",
   ex=("C'est un collègue.", "Es un compañero de trabajo."), cognate="strong", tags=("noun", "people", "work"))
_v("copain / copine", "amigo / novio · amiga / novia", "buddy / boyfriend · girlfriend", "noun", gender="m", ipa="/kɔpɛ̃/ · /kɔpin/",
   ex=("C'est ma copine.", "Es mi novia."), es="mon copain / ma copine = partner; un copain = a pal.",
   tags=("noun", "people"), id="fr_copain")
_v("femme", "mujer / esposa", "woman / wife", "noun", gender="f", ipa="/fam/",
   ex=("Ma femme est française.", "Mi mujer es francesa."), warn="/fam/ — the e is /a/ here.", tags=("noun", "people"))
_v("homme", "hombre", "man", "noun", gender="m", ipa="/ɔm/", ex=("Un homme et une femme.", "Un hombre y una mujer."),
   warn="h muet: l'homme, un‿homme.", cognate="strong", tags=("noun", "people"))
_v("gens", "gente", "people", "noun", gender="m", ipa="/ʒɑ̃/", ex=("Les gens sont sympas ici.", "La gente es simpática aquí."),
   es="Plural in French (les gens sont), singular in Spanish (la gente es).", cognate="strong", tags=("noun", "people"))
_v("appartement", "apartamento / piso", "apartment", "noun", gender="m", ipa="/apaʁtəmɑ̃/",
   ex=("J'habite dans un petit appartement.", "Vivo en un piso pequeño."), cognate="strong", tags=("noun", "place"))
_v("pays", "país", "country", "noun", gender="m", ipa="/pei/", ex=("C'est un beau pays.", "Es un país bonito."),
   warn="/pe-i/, two syllables, s silent.", cognate="strong", tags=("noun", "place"))
_v("quartier", "barrio", "neighborhood", "noun", gender="m", ipa="/kaʁtje/",
   ex=("J'aime mon quartier.", "Me gusta mi barrio."), tags=("noun", "place"))
_v("rue", "calle", "street", "noun", gender="f", ipa="/ʁy/", ex=("J'habite dans cette rue.", "Vivo en esta calle."),
   warn="rue /ʁy/ vs roue /ʁu/.", refs=("pronunciation#y-vs-u",), tags=("noun", "place"))
_v("chez moi / chez toi", "en mi casa / en tu casa", "at my / your place", "frame", ipa="/ʃe mwa/",
   ex=("On se voit chez moi.", "Nos vemos en mi casa."), tags=("frame", "place"), id="fr_chez_moi")

# interests / opinions / feelings
_v("sport", "deporte", "sport", "noun", gender="m", ipa="/spɔʁ/", ex=("Je fais du sport.", "Hago deporte."),
   pattern="faire du sport", tags=("noun", "interest"))
_v("film", "película", "movie", "noun", gender="m", ipa="/film/", ex=("On regarde un film ?", "¿Vemos una película?"),
   tags=("noun", "interest"))
_v("livre", "libro", "book", "noun", gender="m", ipa="/livʁ/", ex=("Je lis un livre.", "Leo un libro."),
   cognate="strong", tags=("noun", "interest"))
_v("voyage", "viaje", "trip", "noun", gender="m", ipa="/vwajaʒ/", ex=("Bon voyage !", "¡Buen viaje!"),
   cognate="strong", tags=("noun", "travel"))
_v("week-end", "fin de semana", "weekend", "noun", gender="m", ipa="/wikɛnd/",
   ex=("Ce week-end, je vais à Paris.", "Este fin de semana voy a París."), tags=("noun", "time"))
_v("soir", "tarde-noche / noche", "evening", "noun", gender="m", ipa="/swaʁ/",
   ex=("Ce soir, je reste à la maison.", "Esta noche me quedo en casa."), tags=("noun", "time"))
_v("matin", "mañana (parte del día)", "morning", "noun", gender="m", ipa="/matɛ̃/",
   ex=("Le matin, je travaille.", "Por la mañana trabajo."), tags=("noun", "time"))
_v("heure", "hora", "hour / time", "noun", gender="f", ipa="/œʁ/", ex=("Il est quelle heure ?", "¿Qué hora es?"),
   warn="h muet, eu = /œ/: l'heure, une heure /ynœʁ/.", cognate="strong", refs=("numbers#time",), tags=("noun", "time"))
_v("semaine", "semana", "week", "noun", gender="f", ipa="/səmɛn/", ex=("Cette semaine, je suis occupé.", "Esta semana estoy ocupado."),
   cognate="strong", tags=("noun", "time"))
_v("souvent", "a menudo / muchas veces", "often", "adv", ipa="/suvɑ̃/", ex=("Je fais souvent du sport.", "Hago deporte a menudo."),
   tags=("adverb", "frequency"))
_v("parfois", "a veces", "sometimes", "adv", ipa="/paʁfwa/", ex=("Parfois je travaille le week-end.", "A veces trabajo el fin de semana."),
   tags=("adverb", "frequency"))
_v("tous les jours", "todos los días", "every day", "adv", ipa="/tu le ʒuʁ/",
   ex=("J'étudie tous les jours.", "Estudio todos los días."), tags=("adverb", "frequency"))
_v("bien sûr", "claro / por supuesto", "of course", "adv", ipa="/bjɛ̃ syʁ/", ex=("Bien sûr que oui.", "Claro que sí."),
   tags=("adverb",))
_v("peut-être", "quizás / tal vez", "maybe", "adv", ipa="/pøtɛtʁ/", ex=("Peut-être demain.", "Quizás mañana."),
   tags=("adverb",))
_v("trop", "demasiado", "too (much)", "adv", ipa="/tʁo/", ex=("C'est trop cher.", "Es demasiado caro."),
   warn="Final p silent.", tags=("adverb",))
_v("assez", "bastante", "enough / quite", "adv", ipa="/ase/", ex=("C'est assez facile.", "Es bastante fácil."),
   tags=("adverb",))
_v("cher / chère", "caro / cara", "expensive / dear", "adj", ipa="/ʃɛʁ/", ex=("C'est trop cher.", "Es demasiado caro."),
   tags=("adj",), id="fr_cher")
_v("sympa", "simpático / majo", "nice (person)", "adj", ipa="/sɛ̃pa/", ex=("Il est très sympa.", "Es muy majo."),
   cognate="partial", tags=("adj",))
_v("beau / belle", "bonito / guapo", "beautiful", "adj", ipa="/bo/ · /bɛl/", ex=("C'est une belle ville.", "Es una ciudad bonita."),
   cognate="strong", tags=("adj",), id="fr_beau")
_v("occupé / occupée", "ocupado / ocupada", "busy", "adj", ipa="/ɔkype/", ex=("Je suis occupé ce soir.", "Estoy ocupado esta noche."),
   cognate="strong", tags=("adj", "feeling"), id="fr_occupe")
_v("libre", "libre", "free (available)", "adj", ipa="/libʁ/", ex=("Tu es libre demain ?", "¿Estás libre mañana?"),
   cognate="strong", tags=("adj",))
_v("prêt / prête", "listo / lista", "ready", "adj", ipa="/pʁɛ/ · /pʁɛt/", ex=("Je suis prêt.", "Estoy listo."),
   tags=("adj",), id="fr_pret")
_v("même", "mismo / incluso", "same / even", "adj", ipa="/mɛm/", ex=("C'est la même chose.", "Es lo mismo."),
   es="quand même = de todos modos / aun así.", cognate="strong", tags=("adj",))
_v("autre", "otro", "other", "adj", ipa="/otʁ/", ex=("Une autre question ?", "¿Otra pregunta?"),
   cognate="strong", tags=("adj",))
_v("quelque chose", "algo", "something", "pron", ipa="/kɛlkə ʃoz/", ex=("Tu veux quelque chose ?", "¿Quieres algo?"),
   es="ne … rien = nada.", tags=("pronoun",))
_v("rien", "nada", "nothing", "pron", ipa="/ʁjɛ̃/", ex=("Je ne veux rien.", "No quiero nada."),
   pattern="ne … rien", refs=("sentence-architecture#negation",), tags=("pronoun",))
_v("tout / tous", "todo / todos", "all / everything", "det", ipa="/tu/", ex=("C'est tout.", "Eso es todo."),
   warn="tout /tu/ vs tu /ty/ — the /u/–/y/ contrast.", cognate="strong", refs=("pronunciation#y-vs-u",),
   tags=("det",), id="fr_tout")
_v("mon / ma / mes", "mi / mis", "my", "det", ipa="/mɔ̃/ /ma/ /me/", ex=("Mon travail, ma ville, mes amis.", "Mi trabajo, mi ciudad, mis amigos."),
   es="Agrees with the thing owned (gender!), not the owner.", refs=("pronouns#possessive",), tags=("det", "possessive"), id="fr_mon")
_v("ton / ta / tes", "tu / tus", "your (tu)", "det", ipa="/tɔ̃/ /ta/ /te/", ex=("C'est ton livre ?", "¿Es tu libro?"),
   refs=("pronouns#possessive",), tags=("det", "possessive"), id="fr_ton")
_v("son / sa / ses", "su / sus", "his / her", "det", ipa="/sɔ̃/ /sa/ /se/", ex=("C'est sa voiture.", "Es su coche."),
   es="sa voiture = his OR her car — French marks the noun's gender, not the owner's.",
   refs=("pronouns#possessive",), tags=("det", "possessive"), id="fr_son")
_v("notre / votre", "nuestro / vuestro (su)", "our / your", "det", ipa="/nɔtʁ/ /vɔtʁ/", ex=("Notre maison, votre travail.", "Nuestra casa, su trabajo."),
   refs=("pronouns#possessive",), tags=("det", "possessive"), id="fr_notre_votre")
_v("au / aux", "al / a los", "to the", "det", ipa="/o/", ex=("Je vais au bureau.", "Voy a la oficina."),
   es="à + le = au (like a + el = al). à + les = aux.", refs=("articles#contractions",), tags=("article",), id="fr_au")
_v("du / des (de + le)", "del / de los", "of the / some", "det", ipa="/dy/ /de/", ex=("Je fais du sport.", "Hago deporte."),
   es="de + le = du (like de + el = del). Also partitive: du pain, de l'eau.", refs=("articles#contractions",),
   tags=("article",), id="fr_du")
_v("en (pays / langue)", "en / a", "in / to (countries, languages)", "prep", ipa="/ɑ̃/",
   ex=("J'habite en France. Je parle en français.", "Vivo en Francia. Hablo en francés."),
   es="en + feminine country, au + masculine (au Mexique), aux États-Unis.", refs=("articles#places",), tags=("glue",), id="fr_en_prep")
_v("besoin (avoir besoin de)", "necesitar", "to need", "frame", ipa="/bəzwɛ̃/",
   ex=("J'ai besoin de dormir.", "Necesito dormir."), pattern="avoir besoin de + nom / infinitif",
   es="Literally 'tener necesidad de'.", refs=("core-verbs#avoir",), tags=("frame", "avoir"), id="fr_avoir_besoin")
_v("envie (avoir envie de)", "tener ganas de / apetecer", "to feel like", "frame", ipa="/ɑ̃vi/",
   ex=("J'ai envie d'un café.", "Me apetece un café."), pattern="avoir envie de + nom / infinitif",
   refs=("core-verbs#avoir",), tags=("frame", "avoir"), id="fr_avoir_envie")
_v("ça dépend", "depende", "it depends", "frame", ipa="/sa depɑ̃/", ex=("Ça dépend du jour.", "Depende del día."),
   cognate="strong", tags=("frame",))
_v("je pense que", "creo que / pienso que", "I think that", "frame", ipa="/ʒə pɑ̃s kə/",
   ex=("Je pense que c'est une bonne idée.", "Creo que es buena idea."), pattern="je pense que + phrase",
   refs=("sentence-architecture#que-clauses",), tags=("frame",))
_v("idée", "idea", "idea", "noun", gender="f", ipa="/ide/", ex=("Bonne idée !", "¡Buena idea!"), cognate="strong", tags=("noun",))
_v("dormir", "dormir", "to sleep", "verb", ipa="/dɔʁmiʁ/", ex=("Je veux dormir.", "Quiero dormir."),
   cognate="strong", status="recognition", tags=("verb",))
_v("sortir", "salir", "to go out", "verb", ipa="/sɔʁtiʁ/", ex=("Tu veux sortir ce soir ?", "¿Quieres salir esta noche?"),
   es="salir ↔ sortir. FR salir = ensuciar (faux ami).", tags=("verb",))
_v("boire", "beber / tomar", "to drink", "verb", ipa="/bwaʁ/", ex=("On va boire un verre ?", "¿Vamos a tomar algo?"),
   status="recognition", tags=("verb",))
_v("café", "café", "coffee / café", "noun", gender="m", ipa="/kafe/", ex=("Un café, s'il vous plaît.", "Un café, por favor."),
   cognate="strong", tags=("noun",))
_v("eau", "agua", "water", "noun", gender="f", ipa="/o/", ex=("De l'eau, s'il vous plaît.", "Agua, por favor."),
   warn="eau = /o/, one sound.", refs=("spelling#eau",), tags=("noun",))
_v("argent", "dinero", "money", "noun", gender="m", ipa="/aʁʒɑ̃/", ex=("Je n'ai pas d'argent.", "No tengo dinero."),
   es="argent = plata (Latin America) — same word.", tags=("noun",))
_v("voiture", "coche", "car", "noun", gender="f", ipa="/vwatyʁ/", ex=("Je n'ai pas de voiture.", "No tengo coche."),
   tags=("noun",))

# ---------------------------------------------------------------------------
# Sprint 3 — Past & speech: sequencing, time reference, experiences, actions
# ---------------------------------------------------------------------------
_SPRINT = 3

_v("venir", "venir", "to come", "verb", ipa="/vəniʁ/", ex=("Tu viens ce soir ?", "¿Vienes esta noche?"),
   pattern="venir de + infinitif = acabar de", cognate="strong", refs=("core-verbs#venir", "tense-map#recent-past"),
   tags=("verb",))
_v("prendre", "tomar / coger", "to take", "verb", ipa="/pʁɑ̃dʁ/", ex=("Je prends le métro.", "Tomo el metro."),
   es="Also for food/drink: je prends un café.", refs=("core-verbs#prendre",), tags=("verb",))
_v("mettre", "poner", "to put", "verb", ipa="/mɛtʁ/", ex=("Je mets la table.", "Pongo la mesa."),
   es="Also to put on (clothes) and to take (time): ça met dix minutes.", refs=("core-verbs#mettre",), tags=("verb",))
_v("voir", "ver", "to see", "verb", ipa="/vwaʁ/", ex=("On se voit demain ?", "¿Nos vemos mañana?"),
   cognate="strong", refs=("core-verbs#voir",), tags=("verb",))
_v("croire", "creer", "to believe / think", "verb", ipa="/kʁwaʁ/", ex=("Je crois que oui.", "Creo que sí."),
   pattern="croire que …", cognate="strong", refs=("core-verbs#croire",), tags=("verb",))
_v("comprendre", "comprender / entender", "to understand", "verb", ipa="/kɔ̃pʁɑ̃dʁ/",
   ex=("Je ne comprends pas.", "No entiendo."), cognate="strong", refs=("core-verbs#comprendre", "questions#repair"),
   tags=("verb",))
_v("trouver", "encontrar / parecer", "to find / to think (opinion)", "verb", ipa="/tʁuve/",
   ex=("Je trouve ça intéressant.", "Me parece interesante."), pattern="trouver que …",
   es="je trouve que = me parece que.", refs=("core-verbs#trouver",), tags=("verb", "er"))
_v("donner", "dar", "to give", "verb", ipa="/dɔne/", ex=("Tu peux me donner ton numéro ?", "¿Me puedes dar tu número?"),
   refs=("core-verbs#donner",), tags=("verb", "er"))
_v("demander", "preguntar / pedir", "to ask", "verb", ipa="/dəmɑ̃de/", ex=("Je peux te demander quelque chose ?", "¿Te puedo preguntar algo?"),
   es="Faux ami: ES demandar = to sue. FR demander = preguntar AND pedir.", false_friend=True, cognate="false",
   refs=("core-verbs#demander",), tags=("verb", "er"))
_v("répondre", "responder / contestar", "to answer", "verb", ipa="/ʁepɔ̃dʁ/", ex=("Il ne répond pas.", "No contesta."),
   pattern="répondre à", cognate="strong", refs=("core-verbs#repondre",), tags=("verb",))

# sequencing / discourse
_v("puis", "luego / después", "then", "adv", ipa="/pɥi/", ex=("J'ai mangé, puis j'ai dormi.", "Comí, luego dormí."),
   warn="/pɥi/ — u + i glide.", tags=("adverb", "sequence"))
_v("après", "después", "after / afterwards", "adv", ipa="/apʁɛ/", ex=("Après, on va au cinéma.", "Después vamos al cine."),
   tags=("adverb", "sequence"))
_v("avant", "antes", "before", "adv", ipa="/avɑ̃/", ex=("Avant, j'habitais à Boston.", "Antes vivía en Boston."),
   pattern="avant de + infinitif", tags=("adverb", "sequence"))
_v("alors", "entonces", "so / then", "adv", ipa="/alɔʁ/", ex=("Alors, on y va ?", "Entonces, ¿vamos?"),
   tags=("adverb", "sequence"))
_v("donc", "así que / por lo tanto", "so / therefore", "conj", ipa="/dɔ̃k/", ex=("Je suis fatigué, donc je reste ici.", "Estoy cansado, así que me quedo aquí."),
   warn="Final c pronounced.", tags=("adverb", "sequence"))
_v("d'abord", "primero", "first", "adv", ipa="/dabɔʁ/", ex=("D'abord, un café.", "Primero, un café."),
   tags=("adverb", "sequence"))
_v("enfin", "por fin / finalmente", "finally", "adv", ipa="/ɑ̃fɛ̃/", ex=("Enfin, c'est fini !", "¡Por fin terminó!"),
   tags=("adverb", "sequence"))
_v("en fait", "de hecho / en realidad", "actually", "adv", ipa="/ɑ̃ fɛt/", ex=("En fait, je ne sais pas.", "En realidad, no sé."),
   warn="Final t pronounced here: /ɑ̃fɛt/.", tags=("adverb",))
_v("ensuite", "luego / a continuación", "next / then", "adv", ipa="/ɑ̃sɥit/", ex=("Ensuite, j'ai pris le train.", "Luego tomé el tren."),
   tags=("adverb", "sequence"))

# time reference for the past
_v("hier soir", "anoche", "last night", "adv", ipa="/jɛʁ swaʁ/", ex=("Hier soir, j'ai vu un film.", "Anoche vi una película."),
   tags=("adverb", "time"))
_v("ce matin", "esta mañana", "this morning", "adv", ipa="/sə matɛ̃/", ex=("Ce matin, j'ai travaillé.", "Esta mañana trabajé."),
   tags=("adverb", "time"))
_v("la semaine dernière", "la semana pasada", "last week", "adv", ipa="/la səmɛn dɛʁnjɛʁ/",
   ex=("La semaine dernière, je suis allé à Paris.", "La semana pasada fui a París."), tags=("adverb", "time"))
_v("le week-end dernier", "el fin de semana pasado", "last weekend", "adv", ipa="/lə wikɛnd dɛʁnje/",
   ex=("Le week-end dernier, on a fait du sport.", "El finde pasado hicimos deporte."), tags=("adverb", "time"))
_v("l'année dernière", "el año pasado", "last year", "adv", ipa="/lane dɛʁnjɛʁ/",
   ex=("L'année dernière, j'ai commencé le français.", "El año pasado empecé francés."), tags=("adverb", "time"))
_v("il y a (+ temps)", "hace (+ tiempo)", "ago", "frame", ipa="/ilja/", ex=("Il y a deux jours.", "Hace dos días."),
   es="il y a deux jours ↔ hace dos días.", refs=("tense-map#ago",), tags=("frame", "time"), id="fr_il_y_a_ago")
_v("pendant", "durante", "during / for", "prep", ipa="/pɑ̃dɑ̃/", ex=("J'ai travaillé pendant deux heures.", "Trabajé durante dos horas."),
   tags=("glue", "time"))
_v("depuis", "desde / desde hace", "since / for", "prep", ipa="/dəpɥi/", ex=("J'apprends le français depuis un mois.", "Aprendo francés desde hace un mes."),
   es="depuis + present ↔ desde hace + presente (llevo un mes …).", refs=("tense-map#depuis",), tags=("glue", "time"))
_v("mois", "mes", "month", "noun", gender="m", ipa="/mwa/", ex=("Depuis un mois.", "Desde hace un mes."),
   warn="/mwa/ — same as moi.", tags=("noun", "time"))
_v("année", "año", "year", "noun", gender="f", ipa="/ane/", ex=("Cette année, j'apprends le français.", "Este año aprendo francés."),
   es="an = unit (30 ans); année = span (cette année).", tags=("noun", "time"))
_v("fois", "vez", "time (occurrence)", "noun", gender="f", ipa="/fwa/", ex=("C'est la première fois.", "Es la primera vez."),
   pattern="une fois / deux fois / la première fois", tags=("noun", "time"))
_v("dernier / dernière", "último / pasado", "last", "adj", ipa="/dɛʁnje/ · /dɛʁnjɛʁ/", ex=("Le mois dernier.", "El mes pasado."),
   tags=("adj", "time"), id="fr_dernier")
_v("prochain / prochaine", "próximo / que viene", "next", "adj", ipa="/pʁɔʃɛ̃/ · /pʁɔʃɛn/", ex=("La semaine prochaine.", "La semana que viene."),
   cognate="strong", tags=("adj", "time"), id="fr_prochain")

# experiences / actions / movement
_v("aller (je suis allé)", "ir (fui / he ido)", "went", "frame", ipa="/ʒə sɥi zale/",
   ex=("Je suis allé au marché.", "Fui al mercado."), es="aller takes être in the passé composé.",
   refs=("tense-map#passe-compose", "core-verbs#aller"), tags=("frame", "past"), id="fr_je_suis_alle")
_v("fait (j'ai fait)", "hecho (he hecho / hice)", "did / made", "frame", ipa="/ʒe fɛ/",
   ex=("Qu'est-ce que tu as fait hier ?", "¿Qué hiciste ayer?"), refs=("tense-map#passe-compose",), tags=("frame", "past"), id="fr_j_ai_fait")
_v("vu (j'ai vu)", "visto (he visto / vi)", "saw", "frame", ipa="/ʒe vy/", ex=("J'ai vu Marie hier.", "Vi a Marie ayer."),
   refs=("tense-map#passe-compose",), tags=("frame", "past"), id="fr_j_ai_vu")
_v("pris (j'ai pris)", "tomado (tomé)", "took", "frame", ipa="/ʒe pʁi/", ex=("J'ai pris le train.", "Tomé el tren."),
   tags=("frame", "past"), id="fr_j_ai_pris")
_v("marché", "mercado", "market", "noun", gender="m", ipa="/maʁʃe/", ex=("Je vais au marché le samedi.", "Voy al mercado los sábados."),
   cognate="strong", tags=("noun", "place"))
_v("magasin", "tienda", "shop", "noun", gender="m", ipa="/maɡazɛ̃/", ex=("Le magasin est fermé.", "La tienda está cerrada."),
   es="Faux ami: not 'magazine' (FR magazine = revista too).", tags=("noun", "place"))
_v("gare", "estación (de tren)", "train station", "noun", gender="f", ipa="/ɡaʁ/", ex=("On se retrouve à la gare.", "Quedamos en la estación."),
   tags=("noun", "place", "travel"))
_v("train", "tren", "train", "noun", gender="m", ipa="/tʁɛ̃/", ex=("J'ai pris le train.", "Tomé el tren."),
   warn="Nasal /ɛ̃/, n silent.", cognate="strong", tags=("noun", "travel"))
_v("métro", "metro", "subway", "noun", gender="m", ipa="/metʁo/", ex=("Je prends le métro tous les jours.", "Tomo el metro todos los días."),
   cognate="strong", tags=("noun", "travel"))
_v("avion", "avión", "plane", "noun", gender="m", ipa="/avjɔ̃/", ex=("Je préfère l'avion.", "Prefiero el avión."),
   cognate="strong", tags=("noun", "travel"))
_v("vacances", "vacaciones", "vacation", "noun", gender="f", ipa="/vakɑ̃s/", ex=("Je suis en vacances.", "Estoy de vacaciones."),
   pattern="en vacances", cognate="strong", tags=("noun", "travel"))
_v("repas", "comida", "meal", "noun", gender="m", ipa="/ʁəpa/", ex=("C'était un bon repas.", "Fue una buena comida."),
   tags=("noun",))
_v("déjeuner", "almorzar / almuerzo", "to have lunch / lunch", "verb", ipa="/deʒœne/", ex=("On déjeune ensemble ?", "¿Almorzamos juntos?"),
   es="petit-déjeuner = desayuno; dîner = cenar.", tags=("verb", "er"))
_v("dîner", "cenar / cena", "to have dinner / dinner", "verb", ipa="/dine/", ex=("On dîne à quelle heure ?", "¿A qué hora cenamos?"),
   tags=("verb", "er"))
_v("acheter", "comprar", "to buy", "verb", ipa="/aʃte/", ex=("J'ai acheté du pain.", "Compré pan."),
   warn="j'achète /ʒaʃɛt/ — è appears in stressed forms.", tags=("verb", "er"))
_v("payer", "pagar", "to pay", "verb", ipa="/peje/", ex=("C'est moi qui paie.", "Pago yo."), cognate="strong", tags=("verb", "er"))
_v("rentrer", "volver (a casa)", "to go home / come back", "verb", ipa="/ʁɑ̃tʁe/", ex=("Je suis rentré tard.", "Volví tarde a casa."),
   es="Takes être in passé composé.", tags=("verb", "er", "movement"))
_v("ensemble", "juntos", "together", "adv", ipa="/ɑ̃sɑ̃bl/", ex=("On travaille ensemble.", "Trabajamos juntos."),
   tags=("adverb",))
_v("tard", "tarde", "late", "adv", ipa="/taʁ/", ex=("Il est tard.", "Es tarde."), warn="Final d silent.", cognate="strong",
   tags=("adverb", "time"))
_v("tôt", "temprano", "early", "adv", ipa="/to/", ex=("Je me lève tôt.", "Me levanto temprano."), tags=("adverb", "time"))
_v("longtemps", "mucho tiempo", "a long time", "adv", ipa="/lɔ̃tɑ̃/", ex=("Ça fait longtemps !", "¡Cuánto tiempo!"),
   tags=("adverb", "time"))
_v("vite", "rápido / deprisa", "fast / quickly", "adv", ipa="/vit/", ex=("Tu parles trop vite.", "Hablas demasiado rápido."),
   refs=("questions#repair",), tags=("adverb",))
_v("lentement", "despacio / lentamente", "slowly", "adv", ipa="/lɑ̃tmɑ̃/", ex=("Plus lentement, s'il te plaît.", "Más despacio, por favor."),
   refs=("questions#repair",), tags=("adverb",))
_v("plus", "más", "more", "adv", ipa="/plys/ · /ply/", ex=("Plus lentement. Je n'en veux plus.", "Más despacio. No quiero más."),
   warn="/plys/ = more (comparative, end of phrase); /ply/ = no more (ne … plus).", tags=("adverb",))
_v("moins", "menos", "less", "adv", ipa="/mwɛ̃/", ex=("C'est moins cher ici.", "Es menos caro aquí."), tags=("adverb",))

# object pronouns (first layer)
_v("me / te", "me / te", "me / you (object)", "pron", ipa="/mə/ /tə/", ex=("Tu me comprends ?", "¿Me entiendes?"),
   es="Same position as Spanish: before the conjugated verb.", refs=("pronouns#object",), tags=("pronoun", "object"), id="fr_me_te")
_v("le / la / les (objet)", "lo / la / los / las", "him / her / it / them", "pron", ipa="/lə/ /la/ /le/",
   ex=("Je le vois demain. Je la connais.", "Lo veo mañana. La conozco."),
   es="Before the verb, like Spanish. Never attached to an infinitive: je veux le voir = quiero verlo.",
   refs=("pronouns#object", "sentence-architecture#object-pronouns"), tags=("pronoun", "object"), id="fr_le_la_les_obj")

# basic evaluation / conversation
_v("super", "genial", "great", "adj", ipa="/sypɛʁ/", ex=("C'était super.", "Fue genial."), tags=("adj", "evaluation"))
_v("génial", "genial", "brilliant", "adj", ipa="/ʒenjal/", ex=("C'est génial !", "¡Es genial!"), cognate="strong", tags=("adj", "evaluation"))
_v("nul", "malísimo / un rollo", "terrible / rubbish", "adj", ipa="/nyl/", ex=("Le film était nul.", "La película era malísima."),
   tags=("adj", "evaluation"))
_v("mauvais / mauvaise", "malo / mala", "bad", "adj", ipa="/mɔvɛ/ · /mɔvɛz/", ex=("C'est une mauvaise idée.", "Es una mala idea."),
   tags=("adj", "evaluation"), id="fr_mauvais")
_v("c'était", "era / fue / estaba", "it was", "frame", ipa="/setɛ/", ex=("C'était bien.", "Estuvo bien."),
   es="First imparfait chunk — learn as a fixed frame for evaluating the past.", refs=("tense-map#imparfait",),
   tags=("frame", "past"))
_v("il y avait", "había", "there was / were", "frame", ipa="/iljavɛ/", ex=("Il y avait beaucoup de gens.", "Había mucha gente."),
   refs=("tense-map#imparfait",), tags=("frame", "past"), status="recognition")
_v("d'habitude", "normalmente / por lo general", "usually", "adv", ipa="/dabityd/", ex=("D'habitude, je travaille le matin.", "Normalmente trabajo por la mañana."),
   tags=("adverb", "frequency"))
_v("quelqu'un", "alguien", "someone", "pron", ipa="/kɛlkœ̃/", ex=("Quelqu'un a appelé.", "Alguien llamó."), tags=("pronoun",))
_v("pourquoi pas", "por qué no", "why not", "frame", ipa="/puʁkwa pa/", ex=("Pourquoi pas demain ?", "¿Por qué no mañana?"),
   tags=("frame",))

# ---------------------------------------------------------------------------
# Sprint 4 — Consolidate: life, reasons, opinions, connecting existing French
# ---------------------------------------------------------------------------
_SPRINT = 4

_v("vivre", "vivir", "to live", "verb", ipa="/vivʁ/", ex=("Je vis aux États-Unis.", "Vivo en Estados Unidos."),
   es="vivre = be alive / live (broad); habiter = reside.", cognate="strong", refs=("core-verbs#vivre",), tags=("verb",))
_v("rester", "quedarse", "to stay", "verb", ipa="/ʁɛste/", ex=("Je reste à la maison ce soir.", "Me quedo en casa esta noche."),
   es="Faux ami: ES restar = soustraire. Not reflexive in French.", false_friend=True, cognate="false",
   refs=("core-verbs#rester",), tags=("verb", "er"))
_v("partir", "irse / salir", "to leave", "verb", ipa="/paʁtiʁ/", ex=("Je pars demain matin.", "Me voy mañana por la mañana."),
   es="Takes être: je suis parti.", cognate="partial", refs=("core-verbs#partir",), tags=("verb", "movement"))
_v("arriver", "llegar", "to arrive / to manage to", "verb", ipa="/aʁive/", ex=("J'arrive dans dix minutes.", "Llego en diez minutos."),
   pattern="arriver à + infinitif = conseguir / lograr", es="Takes être: je suis arrivé.", refs=("core-verbs#arriver",),
   tags=("verb", "er", "movement"))
_v("passer", "pasar", "to pass / spend (time) / drop by", "verb", ipa="/pase/", ex=("J'ai passé un bon week-end.", "Pasé un buen fin de semana."),
   cognate="strong", refs=("core-verbs#passer",), tags=("verb", "er"))
_v("commencer", "empezar / comenzar", "to start", "verb", ipa="/kɔmɑ̃se/", ex=("Je commence à 9 h.", "Empiezo a las 9."),
   pattern="commencer à + infinitif", cognate="strong", refs=("core-verbs#commencer",), tags=("verb", "er"))
_v("finir", "terminar / acabar", "to finish", "verb", ipa="/finiʁ/", ex=("Je finis à 18 h.", "Termino a las 6."),
   pattern="finir de + infinitif", refs=("core-verbs#finir",), tags=("verb", "ir"))
_v("essayer", "intentar / probar", "to try", "verb", ipa="/eseje/", ex=("J'essaie de parler français.", "Intento hablar francés."),
   pattern="essayer de + infinitif", refs=("core-verbs#essayer",), tags=("verb", "er"))
_v("sentir (se sentir)", "sentir(se)", "to feel / smell", "verb", ipa="/sɑ̃tiʁ/", ex=("Je me sens bien.", "Me siento bien."),
   cognate="strong", refs=("core-verbs#sentir",), tags=("verb",), id="fr_sentir")
_v("connaître", "conocer", "to know (people / places)", "verb", ipa="/kɔnɛtʁ/", ex=("Tu connais Paris ?", "¿Conoces París?"),
   es="conocer ↔ connaître; saber ↔ savoir.", cognate="strong", tags=("verb",))
_v("appeler (s'appeler / appeler)", "llamar(se)", "to call", "verb", ipa="/aple/", ex=("Je t'appelle ce soir.", "Te llamo esta noche."),
   tags=("verb", "er"), id="fr_appeler")
_v("attendre", "esperar (aguardar)", "to wait", "verb", ipa="/atɑ̃dʁ/", ex=("J'attends le bus.", "Espero el autobús."),
   es="Faux ami: ES atender = s'occuper de. No preposition: attendre quelqu'un.", false_friend=True, cognate="false",
   tags=("verb",))
_v("oublier", "olvidar", "to forget", "verb", ipa="/ublije/", ex=("J'ai oublié mon téléphone.", "Olvidé el móvil."),
   tags=("verb", "er"))
_v("lire", "leer", "to read", "verb", ipa="/liʁ/", ex=("J'aime lire le soir.", "Me gusta leer por la noche."), tags=("verb",))
_v("écrire", "escribir", "to write", "verb", ipa="/ekʁiʁ/", ex=("J'écris un message.", "Escribo un mensaje."),
   cognate="strong", tags=("verb",))
_v("jouer", "jugar / tocar", "to play", "verb", ipa="/ʒwe/", ex=("Je joue au foot le dimanche.", "Juego al fútbol los domingos."),
   pattern="jouer à + sport / jouer de + instrument", tags=("verb", "er"))

# opinions / reasons / connecting
_v("à mon avis", "en mi opinión", "in my opinion", "frame", ipa="/a mɔ̃ navi/", ex=("À mon avis, c'est trop cher.", "En mi opinión es demasiado caro."),
   tags=("frame", "opinion"))
_v("je trouve que", "me parece que", "I find that / I think", "frame", ipa="/ʒə tʁuv kə/", ex=("Je trouve que c'est difficile.", "Me parece que es difícil."),
   tags=("frame", "opinion"))
_v("je crois que", "creo que", "I believe that", "frame", ipa="/ʒə kʁwa kə/", ex=("Je crois que oui.", "Creo que sí."),
   tags=("frame", "opinion"))
_v("je suis d'accord", "estoy de acuerdo", "I agree", "frame", ipa="/ʒə sɥi dakɔʁ/", ex=("Je ne suis pas d'accord.", "No estoy de acuerdo."),
   tags=("frame", "opinion"))
_v("c'est vrai", "es verdad", "that's true", "frame", ipa="/sɛ vʁɛ/", ex=("C'est vrai, tu as raison.", "Es verdad, tienes razón."),
   tags=("frame", "opinion"))
_v("avoir raison / tort", "tener razón / no tener razón", "to be right / wrong", "frame", ipa="/avwaʁ ʁɛzɔ̃/",
   ex=("Tu as raison.", "Tienes razón."), es="avoir raison ↔ tener razón — same structure.", tags=("frame", "avoir"), id="fr_avoir_raison")
_v("par exemple", "por ejemplo", "for example", "adv", ipa="/paʁ ɛɡzɑ̃pl/", ex=("Par exemple, le week-end.", "Por ejemplo, el fin de semana."),
   cognate="strong", tags=("adverb",))
_v("surtout", "sobre todo", "especially / above all", "adv", ipa="/syʁtu/", ex=("Surtout le matin.", "Sobre todo por la mañana."),
   tags=("adverb",))
_v("quand même", "de todos modos / aun así", "anyway / still", "adv", ipa="/kɑ̃ mɛm/", ex=("C'est cher, mais je le prends quand même.", "Es caro, pero aun así me lo llevo."),
   tags=("adverb",))
_v("sinon", "si no", "otherwise", "conj", ipa="/sinɔ̃/", ex=("Sinon, on reste ici.", "Si no, nos quedamos aquí."), tags=("glue",))
_v("si", "si / tan", "if / so", "conj", ipa="/si/", ex=("Si tu veux, on sort.", "Si quieres, salimos."), cognate="strong", tags=("glue",))
_v("comme", "como", "like / as / since", "conj", ipa="/kɔm/", ex=("Comme d'habitude.", "Como siempre."), cognate="strong", tags=("glue",))
_v("plutôt", "más bien / bastante", "rather", "adv", ipa="/plyto/", ex=("Je préfère plutôt le soir.", "Prefiero más bien por la noche."),
   tags=("adverb",))
_v("vraiment pas", "para nada", "not at all", "frame", ipa="/vʁɛmɑ̃ pa/", ex=("Ce n'est vraiment pas facile.", "No es nada fácil."),
   tags=("frame",))
_v("presque", "casi", "almost", "adv", ipa="/pʁɛsk/", ex=("J'ai presque fini.", "Casi he terminado."), tags=("adverb",))
_v("seulement", "solo / solamente", "only", "adv", ipa="/sœlmɑ̃/", ex=("Seulement dix minutes.", "Solo diez minutos."),
   cognate="strong", tags=("adverb",))
_v("bientôt", "pronto", "soon", "adv", ipa="/bjɛ̃to/", ex=("À bientôt !", "¡Hasta pronto!"), tags=("adverb", "time"))
_v("déjà / pas encore", "ya / todavía no", "already / not yet", "frame", ipa="/pa zɑ̃kɔʁ/", ex=("Pas encore.", "Todavía no."),
   tags=("frame",), id="fr_pas_encore")

# daily life nouns to tell one's story
_v("vie", "vida", "life", "noun", gender="f", ipa="/vi/", ex=("C'est la vie.", "Así es la vida."), cognate="strong", tags=("noun",))
_v("monde", "mundo / gente", "world / people", "noun", gender="m", ipa="/mɔ̃d/", ex=("Il y a du monde.", "Hay mucha gente."),
   es="tout le monde = todo el mundo = everyone.", cognate="strong", tags=("noun",))
_v("tout le monde", "todo el mundo", "everyone", "pron", ipa="/tu lə mɔ̃d/", ex=("Tout le monde est là.", "Todo el mundo está aquí."),
   tags=("pronoun",))
_v("projet", "proyecto / plan", "project / plan", "noun", gender="m", ipa="/pʁɔʒɛ/", ex=("J'ai des projets ce week-end.", "Tengo planes este finde."),
   cognate="strong", tags=("noun", "work"))
_v("réunion", "reunión", "meeting", "noun", gender="f", ipa="/ʁeynjɔ̃/", ex=("J'ai une réunion à 10 h.", "Tengo una reunión a las 10."),
   cognate="strong", tags=("noun", "work"))
_v("ordinateur", "ordenador / computadora", "computer", "noun", gender="m", ipa="/ɔʁdinatœʁ/", ex=("Je travaille sur ordinateur.", "Trabajo con el ordenador."),
   tags=("noun", "tech"))
_v("message", "mensaje", "message", "noun", gender="m", ipa="/mesaʒ/", ex=("Je t'envoie un message.", "Te mando un mensaje."),
   cognate="strong", tags=("noun", "tech"))
_v("envoyer", "enviar / mandar", "to send", "verb", ipa="/ɑ̃vwaje/", ex=("Envoie-moi un message.", "Mándame un mensaje."),
   cognate="strong", tags=("verb", "er"))
_v("raison", "razón", "reason", "noun", gender="f", ipa="/ʁɛzɔ̃/", ex=("C'est la raison.", "Esa es la razón."), cognate="strong", tags=("noun",))
_v("santé", "salud", "health", "noun", gender="f", ipa="/sɑ̃te/", ex=("Santé !", "¡Salud!"), tags=("noun",))
_v("malade", "enfermo", "sick", "adj", ipa="/malad/", ex=("Je suis malade.", "Estoy enfermo."), tags=("adj",))
_v("content de", "contento de", "glad to", "frame", ipa="/kɔ̃tɑ̃ də/", ex=("Je suis content de te voir.", "Me alegro de verte."),
   pattern="content de + infinitif", tags=("frame",))
_v("chaque", "cada", "each / every", "det", ipa="/ʃak/", ex=("Chaque jour.", "Cada día."), tags=("det",))
_v("plusieurs", "varios", "several", "det", ipa="/plyzjœʁ/", ex=("Plusieurs fois.", "Varias veces."), tags=("det",))
_v("dimanche / samedi", "domingo / sábado", "Sunday / Saturday", "noun", gender="m", ipa="/dimɑ̃ʃ/ · /samdi/",
   ex=("Le dimanche, je me repose.", "Los domingos descanso."), es="le + day = every (that day).",
   refs=("numbers#days",), tags=("noun", "time"), id="fr_dimanche")
_v("meilleur / mieux", "mejor (adj / adv)", "better", "adj", ipa="/mɛjœʁ/ · /mjø/", ex=("C'est mieux comme ça.", "Así está mejor."),
   es="meilleur = adjective (better thing); mieux = adverb (better done).", tags=("adj",), id="fr_meilleur")
_v("besoin de temps / de repos", "necesitar tiempo / descanso", "need time / rest", "frame", ipa="/bəzwɛ̃ də ʁəpo/",
   ex=("J'ai besoin de repos.", "Necesito descanso."), status="recognition", tags=("frame",), id="fr_besoin_repos")
_v("s'il vous plaît", "por favor (usted)", "please (formal)", "frame", ipa="/sil vu plɛ/",
   ex=("L'addition, s'il vous plaît.", "La cuenta, por favor."), tags=("frame",))
_v("je voudrais", "quisiera / me gustaría", "I would like", "frame", ipa="/ʒə vudʁɛ/", ex=("Je voudrais un café.", "Quisiera un café."),
   es="Polite request chunk — memorize, don't analyze the conditional yet.", tags=("frame",))
_v("il faut", "hay que / hace falta", "one must / it's necessary", "frame", ipa="/il fo/", ex=("Il faut partir.", "Hay que irse."),
   pattern="il faut + infinitif", es="il faut ↔ hay que — invariable, like Spanish.", tags=("frame",))
_v("ça marche", "vale / funciona", "that works / OK", "frame", ipa="/sa maʁʃ/", ex=("Demain ? Ça marche.", "¿Mañana? Vale."),
   tags=("frame",))
_v("c'est-à-dire", "es decir", "that is to say", "frame", ipa="/setadiʁ/", ex=("C'est-à-dire, pas ce soir.", "Es decir, esta noche no."),
   status="recognition", tags=("frame",))


VOCAB: tuple[VocabItem, ...] = tuple(_ITEMS)
VOCAB_BY_ID: dict[str, VocabItem] = {item.id: item for item in VOCAB}
assert len(VOCAB_BY_ID) == len(VOCAB), "duplicate vocab ids"


def items_for_sprint(sprint: int) -> list[VocabItem]:
    return [item for item in VOCAB if item.sprint == sprint]


def items_through_sprint(sprint: int) -> list[VocabItem]:
    return [item for item in VOCAB if item.sprint <= sprint]
