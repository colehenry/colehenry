"""Sentence frames and curated banks that feed the deterministic drill engine.

A *frame* is one base sentence the transformation engine can bend along one
dimension at a time (person, polarity, question, modality, time, tense,
object pronoun). Spanish complements ride along so the same frame yields
ES→FR prompts and translation ladders. Everything here uses Month-1 language
only — that is what keeps generated practice inside the ~90%-known rule.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# frames
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Frame:
    id: str
    sprint: int
    verb: str  # core verb infinitive (conjugated slot)
    fr: str  # complement after the verb
    es: str  # Spanish complement
    modal: bool = False  # complement starts with an infinitive (modal frames can swap modality)
    inf: str = ""  # infinitive inside the complement, for futur-proche of modal frames etc.
    obj: tuple[str, str, str] | None = None  # (fr noun phrase, es noun phrase, pronoun le|la|les) for object-pronoun transforms
    agree: tuple[str, str, str, str] | None = None  # adjective complement: (fr m, fr f, es m, es f); plural adds -s
    tenses: tuple[str, ...] = ("present", "futur_proche", "passe_compose")
    times: tuple[str, ...] = ("demain", "ce soir", "aujourd'hui", "ce week-end", "hier", "la semaine dernière", "maintenant")
    grammar: tuple[str, ...] = ()  # grammar target ids evidenced
    subjects: tuple[str, ...] = ("1s", "2s", "3s", "3sf", "on", "1p", "2p", "3p")


TIME_ES = {
    "demain": "mañana", "ce soir": "esta noche", "aujourd'hui": "hoy", "ce week-end": "este fin de semana",
    "hier": "ayer", "la semaine dernière": "la semana pasada", "maintenant": "ahora", "ce matin": "esta mañana",
    "hier soir": "anoche", "tous les jours": "todos los días", "souvent": "a menudo", "le week-end": "los fines de semana",
}
PAST_TIMES = ("hier", "la semaine dernière", "hier soir", "ce matin")
FUTURE_TIMES = ("demain", "ce soir", "ce week-end")
NEUTRAL_TIMES = ("aujourd'hui", "maintenant", "tous les jours", "souvent", "le week-end")

FRAMES: tuple[Frame, ...] = (
    # ---- Sprint 1: être / avoir / aller / faire ---------------------------
    Frame("s1_etre_fatigue", 1, "être", "fatigué", "cansado", tenses=("present",), times=("aujourd'hui", "ce soir", "maintenant"),
          agree=("fatigué", "fatiguée", "cansado", "cansada"), grammar=("present_core4", "negation", "questions_yesno", "gender_agreement")),
    Frame("s1_etre_maison", 1, "être", "à la maison", "en casa", tenses=("present",), times=("ce soir", "aujourd'hui", "maintenant"),
          grammar=("present_core4", "negation", "questions_yesno")),
    Frame("s1_etre_pret", 1, "être", "prêt", "listo", tenses=("present",), times=("maintenant",),
          agree=("prêt", "prête", "listo", "lista"), grammar=("present_core4", "questions_yesno", "gender_agreement")),
    Frame("s1_etre_content", 1, "être", "content", "contento", tenses=("present",), times=("aujourd'hui",),
          agree=("content", "contente", "contento", "contenta"), grammar=("present_core4", "negation", "gender_agreement")),
    Frame("s2_etre_occupe", 2, "être", "occupé", "ocupado", tenses=("present",), times=("ce soir", "aujourd'hui", "ce week-end", "demain"),
          agree=("occupé", "occupée", "ocupado", "ocupada"), grammar=("present_core4", "negation", "questions_stronger")),
    Frame("s2_etre_libre", 2, "être", "libre", "libre", tenses=("present",), times=("demain", "ce soir", "ce week-end"),
          agree=("libre", "libre", "libre", "libre"), grammar=("present_core4", "questions_stronger")),
    Frame("s1_avoir_temps", 1, "avoir", "le temps", "tiempo", tenses=("present",), times=("aujourd'hui", "ce soir", "demain", "maintenant"),
          grammar=("present_core4", "negation", "avoir_expressions")),
    Frame("s1_avoir_faim", 1, "avoir", "faim", "hambre", tenses=("present",), times=("maintenant",), grammar=("avoir_expressions", "negation")),
    Frame("s1_avoir_probleme", 1, "avoir", "un problème", "un problema", tenses=("present",), times=("aujourd'hui", "maintenant"),
          obj=("un problème", "un problema", "le"), grammar=("present_core4", "negation", "articles")),
    Frame("s1_avoir_question", 1, "avoir", "une question", "una pregunta", tenses=("present",), times=("maintenant",),
          grammar=("present_core4", "articles")),
    Frame("s1_aller_bureau", 1, "aller", "au bureau", "a la oficina", tenses=("present", "futur_proche", "passe_compose"),
          grammar=("present_core4", "negation", "questions_yesno")),
    Frame("s1_aller_paris", 1, "aller", "à Paris", "a París", grammar=("present_core4", "questions_yesno")),
    Frame("s1_aller_restaurant", 1, "aller", "au restaurant", "al restaurante", grammar=("present_core4", "negation")),
    Frame("s1_aller_chez", 1, "aller", "chez un ami", "a casa de un amigo", grammar=("present_core4",)),
    Frame("s1_faire_sport", 1, "faire", "du sport", "deporte", grammar=("present_core4", "negation", "questions_yesno")),
    Frame("s1_faire_courses", 1, "faire", "les courses", "la compra", obj=("les courses", "la compra", "les"), grammar=("present_core4",)),
    Frame("s1_faire_cuisine", 1, "faire", "la cuisine", "la comida", obj=("la cuisine", "la comida", "la"), grammar=("present_core4",)),
    # ---- Sprint 2: modals, futur proche, -er verbs -------------------------
    Frame("s2_vouloir_travailler", 2, "vouloir", "travailler", "trabajar", modal=True, inf="travailler",
          tenses=("present", "futur_proche"), times=("demain", "ce soir", "aujourd'hui", "ce week-end", "maintenant"),
          grammar=("modal_infinitive", "negation_modals", "questions_stronger")),
    Frame("s2_vouloir_partir", 2, "vouloir", "partir", "irme", modal=True, inf="partir", tenses=("present",),
          times=("maintenant", "demain", "ce soir"), grammar=("modal_infinitive", "negation_modals")),
    Frame("s2_pouvoir_venir", 2, "pouvoir", "venir", "venir", modal=True, inf="venir", tenses=("present",),
          times=("demain", "ce soir", "ce week-end"), grammar=("modal_infinitive", "negation_modals", "questions_stronger")),
    Frame("s2_devoir_travailler", 2, "devoir", "travailler", "trabajar", modal=True, inf="travailler", tenses=("present", "futur_proche"),
          times=("demain", "ce soir", "aujourd'hui", "ce week-end"), grammar=("modal_infinitive", "negation_modals")),
    Frame("s2_vouloir_manger", 2, "vouloir", "manger quelque chose", "comer algo", modal=True, inf="manger", tenses=("present",),
          times=("maintenant", "ce soir"), grammar=("modal_infinitive",)),
    Frame("s2_pouvoir_parler", 2, "pouvoir", "parler français", "hablar francés", modal=True, inf="parler", tenses=("present",),
          times=("maintenant",), grammar=("modal_infinitive", "questions_stronger")),
    Frame("s2_savoir_parler", 2, "savoir", "parler espagnol", "hablar español", modal=True, inf="parler", tenses=("present",),
          times=(), grammar=("modal_infinitive",)),
    Frame("s2_aller_travailler", 2, "aller", "travailler", "a trabajar", modal=True, inf="travailler", tenses=("present",),
          times=("demain", "ce soir", "ce week-end"), grammar=("futur_proche",)),
    Frame("s2_parler_francais", 2, "parler", "français", "francés", tenses=("present", "futur_proche", "passe_compose"),
          times=("tous les jours", "aujourd'hui", "hier", "demain"), grammar=("regular_er", "negation")),
    Frame("s2_parler_avec", 2, "parler", "avec un collègue", "con un compañero", grammar=("regular_er",)),
    Frame("s2_penser_bien", 2, "penser", "que c'est bien", "que está bien", tenses=("present",), times=(), grammar=("regular_er",)),
    Frame("s2_aimer_cafe", 2, "aimer", "le café", "el café", tenses=("present",), times=(), obj=("le café", "el café", "le"),
          grammar=("aimer_article", "regular_er", "negation")),
    Frame("s2_aimer_musique", 2, "aimer", "la musique", "la música", tenses=("present",), times=(), obj=("la musique", "la música", "la"),
          grammar=("aimer_article", "regular_er")),
    Frame("s2_aimer_voyager", 2, "aimer", "voyager", "viajar", tenses=("present",), times=(), grammar=("aimer_article", "regular_er")),
    Frame("s2_travailler_maison", 2, "travailler", "à la maison", "en casa", grammar=("regular_er", "negation", "questions_stronger")),
    Frame("s2_habiter_ville", 2, "habiter", "en ville", "en la ciudad", tenses=("present", "passe_compose"), times=("maintenant",),
          grammar=("regular_er", "prepositions_places")),
    Frame("s2_regarder_film", 2, "regarder", "un film", "una película", obj=("un film", "una película", "le"),
          grammar=("regular_er", "negation")),
    Frame("s2_manger_restaurant", 2, "manger", "au restaurant", "en el restaurante", grammar=("regular_er", "contractions")),
    Frame("s2_chercher_appart", 2, "chercher", "un appartement", "un apartamento", obj=("un appartement", "un apartamento", "le"),
          grammar=("regular_er",)),
    # ---- Sprint 3: past-capable, object pronouns, venir de ---------------
    Frame("s3_prendre_metro", 3, "prendre", "le métro", "el metro", obj=("le métro", "el metro", "le"),
          grammar=("passe_compose_avoir", "participles_core", "object_pronouns_1")),
    Frame("s3_prendre_cafe", 3, "prendre", "un café", "un café", obj=("un café", "un café", "le"), grammar=("passe_compose_avoir",)),
    Frame("s3_voir_amis", 3, "voir", "mes amis", "a mis amigos", obj=("mes amis", "a mis amigos", "les"),
          grammar=("passe_compose_avoir", "participles_core", "object_pronouns_1")),
    Frame("s3_voir_film", 3, "voir", "un film", "una película", obj=("un film", "una película", "le"),
          grammar=("passe_compose_avoir", "object_pronouns_1")),
    Frame("s3_mettre_table", 3, "mettre", "la table", "la mesa", obj=("la table", "la mesa", "la"), grammar=("passe_compose_avoir",)),
    Frame("s3_comprendre_question", 3, "comprendre", "la question", "la pregunta", obj=("la question", "la pregunta", "la"),
          tenses=("present", "passe_compose"), times=(), grammar=("passe_compose_avoir", "object_pronouns_1", "negation")),
    Frame("s3_trouver_appart", 3, "trouver", "un appartement", "un piso", obj=("un appartement", "un piso", "le"),
          grammar=("passe_compose_avoir",)),
    Frame("s3_demander_addition", 3, "demander", "l'addition", "la cuenta", obj=("l'addition", "la cuenta", "la"),
          grammar=("passe_compose_avoir",)),
    Frame("s3_repondre_message", 3, "répondre", "au message", "al mensaje", grammar=("passe_compose_avoir",)),
    Frame("s3_venir_bureau", 3, "venir", "au bureau", "a la oficina", grammar=("passe_compose_etre",)),
    Frame("s3_faire_courses_past", 3, "faire", "les courses", "la compra", obj=("les courses", "la compra", "les"),
          times=("hier", "ce matin", "la semaine dernière", "demain"), grammar=("passe_compose_avoir", "participles_core")),
    Frame("s3_travailler_tard", 3, "travailler", "tard", "hasta tarde", times=("hier", "hier soir", "la semaine dernière", "demain", "ce soir"),
          grammar=("passe_compose_avoir", "past_time")),
    Frame("s3_manger_amis", 3, "manger", "avec des amis", "con amigos", times=("hier soir", "hier", "ce soir", "demain"),
          grammar=("passe_compose_avoir", "past_time")),
    Frame("s3_aller_marche", 3, "aller", "au marché", "al mercado", times=("hier", "ce matin", "demain", "ce week-end"),
          grammar=("passe_compose_etre", "past_time")),
    Frame("s3_rentrer_tard", 3, "rentrer", "tard", "tarde a casa", times=("hier soir", "hier", "ce soir"),
          grammar=("passe_compose_etre",)),
    # ---- Sprint 4: consolidation --------------------------------------
    Frame("s4_commencer_projet", 4, "commencer", "un nouveau projet", "un proyecto nuevo", obj=("un nouveau projet", "un proyecto nuevo", "le"),
          grammar=("tense_mixing",)),
    Frame("s4_finir_travail", 4, "finir", "le travail", "el trabajo", obj=("le travail", "el trabajo", "le"),
          times=("tard", "à 18 h", "demain", "hier"), grammar=("tense_mixing",)),
    Frame("s4_partir_vacances", 4, "partir", "en vacances", "de vacaciones", times=("demain", "la semaine dernière", "ce week-end"),
          grammar=("tense_mixing", "passe_compose_etre")),
    Frame("s4_rester_maison", 4, "rester", "à la maison", "en casa", times=("ce soir", "hier", "ce week-end", "aujourd'hui"),
          grammar=("tense_mixing", "passe_compose_etre")),
    Frame("s4_arriver_tard", 4, "arriver", "en retard", "tarde", times=("ce matin", "hier", "demain"),
          grammar=("tense_mixing", "passe_compose_etre")),
    Frame("s4_passer_weekend", 4, "passer", "un bon week-end", "un buen fin de semana", tenses=("passe_compose", "futur_proche"),
          times=(), grammar=("tense_mixing",)),
    Frame("s4_essayer_parler", 4, "essayer", "de parler français", "hablar francés", modal=True, inf="parler",
          tenses=("present", "futur_proche", "passe_compose"), times=("aujourd'hui", "hier", "demain"), grammar=("tense_mixing",)),
    Frame("s4_vivre_chicago", 4, "vivre", "à Chicago", "en Chicago", tenses=("present", "passe_compose"), times=(),
          grammar=("tense_mixing",)),
    Frame("s4_lire_livre", 4, "lire", "un livre", "un libro", obj=("un livre", "un libro", "le"), grammar=("tense_mixing",)),
    Frame("s4_envoyer_message", 4, "envoyer", "un message", "un mensaje", obj=("un message", "un mensaje", "le"), grammar=("tense_mixing",)),
)

FRAMES_BY_ID: dict[str, Frame] = {f.id: f for f in FRAMES}

# Extra conjugations for verbs used in frames but outside the 32-verb atlas
# (regular -er / -ir / -re, plus lire). present + participle + auxiliary.
EXTRA_VERBS: dict[str, dict] = {
    "habiter": {"present": ("habite", "habites", "habite", "habitons", "habitez", "habitent"), "participle": "habité", "aux": "avoir",
                "es": ("vivo", "vives", "vive", "vivimos", "vivís", "viven"), "es_inf": "vivir", "es_pp": "vivido"},
    "manger": {"present": ("mange", "manges", "mange", "mangeons", "mangez", "mangent"), "participle": "mangé", "aux": "avoir",
               "es": ("como", "comes", "come", "comemos", "coméis", "comen"), "es_inf": "comer", "es_pp": "comido"},
    "regarder": {"present": ("regarde", "regardes", "regarde", "regardons", "regardez", "regardent"), "participle": "regardé", "aux": "avoir",
                 "es": ("veo", "ves", "ve", "vemos", "veis", "ven"), "es_inf": "ver", "es_pp": "visto"},
    "chercher": {"present": ("cherche", "cherches", "cherche", "cherchons", "cherchez", "cherchent"), "participle": "cherché", "aux": "avoir",
                 "es": ("busco", "buscas", "busca", "buscamos", "buscáis", "buscan"), "es_inf": "buscar", "es_pp": "buscado"},
    "rentrer": {"present": ("rentre", "rentres", "rentre", "rentrons", "rentrez", "rentrent"), "participle": "rentré", "aux": "être",
                "es": ("vuelvo", "vuelves", "vuelve", "volvemos", "volvéis", "vuelven"), "es_inf": "volver", "es_pp": "vuelto"},
    "lire": {"present": ("lis", "lis", "lit", "lisons", "lisez", "lisent"), "participle": "lu", "aux": "avoir",
             "es": ("leo", "lees", "lee", "leemos", "leéis", "leen"), "es_inf": "leer", "es_pp": "leído"},
    "envoyer": {"present": ("envoie", "envoies", "envoie", "envoyons", "envoyez", "envoient"), "participle": "envoyé", "aux": "avoir",
                "es": ("mando", "mandas", "manda", "mandamos", "mandáis", "mandan"), "es_inf": "mandar", "es_pp": "mandado"},
    "écouter": {"present": ("écoute", "écoutes", "écoute", "écoutons", "écoutez", "écoutent"), "participle": "écouté", "aux": "avoir",
                "es": ("escucho", "escuchas", "escucha", "escuchamos", "escucháis", "escuchan"), "es_inf": "escuchar", "es_pp": "escuchado"},
    "étudier": {"present": ("étudie", "étudies", "étudie", "étudions", "étudiez", "étudient"), "participle": "étudié", "aux": "avoir",
                "es": ("estudio", "estudias", "estudia", "estudiamos", "estudiáis", "estudian"), "es_inf": "estudiar", "es_pp": "estudiado"},
    "acheter": {"present": ("achète", "achètes", "achète", "achetons", "achetez", "achètent"), "participle": "acheté", "aux": "avoir",
                "es": ("compro", "compras", "compra", "compramos", "compráis", "compran"), "es_inf": "comprar", "es_pp": "comprado"},
    "sortir": {"present": ("sors", "sors", "sort", "sortons", "sortez", "sortent"), "participle": "sorti", "aux": "être",
               "es": ("salgo", "sales", "sale", "salimos", "salís", "salen"), "es_inf": "salir", "es_pp": "salido"},
    "dormir": {"present": ("dors", "dors", "dort", "dormons", "dormez", "dorment"), "participle": "dormi", "aux": "avoir",
               "es": ("duermo", "duermes", "duerme", "dormimos", "dormís", "duermen"), "es_inf": "dormir", "es_pp": "dormido"},
    "connaître": {"present": ("connais", "connais", "connaît", "connaissons", "connaissez", "connaissent"), "participle": "connu", "aux": "avoir",
                  "es": ("conozco", "conoces", "conoce", "conocemos", "conocéis", "conocen"), "es_inf": "conocer", "es_pp": "conocido"},
    "attendre": {"present": ("attends", "attends", "attend", "attendons", "attendez", "attendent"), "participle": "attendu", "aux": "avoir",
                 "es": ("espero", "esperas", "espera", "esperamos", "esperáis", "esperan"), "es_inf": "esperar", "es_pp": "esperado"},
    "oublier": {"present": ("oublie", "oublies", "oublie", "oublions", "oubliez", "oublient"), "participle": "oublié", "aux": "avoir",
                "es": ("olvido", "olvidas", "olvida", "olvidamos", "olvidáis", "olvidan"), "es_inf": "olvidar", "es_pp": "olvidado"},
    "écrire": {"present": ("écris", "écris", "écrit", "écrivons", "écrivez", "écrivent"), "participle": "écrit", "aux": "avoir",
               "es": ("escribo", "escribes", "escribe", "escribimos", "escribís", "escriben"), "es_inf": "escribir", "es_pp": "escrito"},
    "jouer": {"present": ("joue", "joues", "joue", "jouons", "jouez", "jouent"), "participle": "joué", "aux": "avoir",
              "es": ("juego", "juegas", "juega", "jugamos", "jugáis", "juegan"), "es_inf": "jugar", "es_pp": "jugado"},
}

# ---------------------------------------------------------------------------
# spoken-question banks (timed fluency) — (fr, es gloss), per sprint
# ---------------------------------------------------------------------------
QUESTIONS: dict[int, tuple[tuple[str, str], ...]] = {
    1: (
        ("Comment tu t'appelles ?", "¿Cómo te llamas?"), ("Ça va ?", "¿Qué tal?"), ("Tu es d'où ?", "¿De dónde eres?"),
        ("Tu habites où ?", "¿Dónde vives?"), ("Tu as quel âge ?", "¿Cuántos años tienes?"), ("Tu parles français ?", "¿Hablas francés?"),
        ("Tu es fatigué ?", "¿Estás cansado?"), ("Tu as faim ?", "¿Tienes hambre?"), ("Tu vas où demain ?", "¿A dónde vas mañana?"),
        ("Qu'est-ce que tu fais aujourd'hui ?", "¿Qué haces hoy?"), ("Tu es content ?", "¿Estás contento?"),
        ("Il y a un problème ?", "¿Hay algún problema?"), ("C'est ton ami ?", "¿Es tu amigo?"), ("Tu as le temps ?", "¿Tienes tiempo?"),
        ("Tu fais du sport ?", "¿Haces deporte?"), ("Pourquoi tu es ici ?", "¿Por qué estás aquí?"),
    ),
    2: (
        ("Qu'est-ce que tu veux faire ce week-end ?", "¿Qué quieres hacer este finde?"), ("Tu peux venir demain ?", "¿Puedes venir mañana?"),
        ("Qu'est-ce que tu dois faire aujourd'hui ?", "¿Qué tienes que hacer hoy?"), ("Tu aimes la musique ?", "¿Te gusta la música?"),
        ("Qu'est-ce que tu aimes faire ?", "¿Qué te gusta hacer?"), ("Tu travailles où ?", "¿Dónde trabajas?"),
        ("Tu parles quelles langues ?", "¿Qué idiomas hablas?"), ("Qu'est-ce que tu vas faire ce soir ?", "¿Qué vas a hacer esta noche?"),
        ("Tu habites dans un appartement ou une maison ?", "¿Vives en un piso o en una casa?"), ("Tu es libre demain ?", "¿Estás libre mañana?"),
        ("Qu'est-ce que tu penses de Paris ?", "¿Qué piensas de París?"), ("Tu sais parler espagnol ?", "¿Sabes hablar español?"),
        ("Tu veux un café ?", "¿Quieres un café?"), ("Tu fais du sport souvent ?", "¿Haces deporte a menudo?"),
        ("Pourquoi tu apprends le français ?", "¿Por qué aprendes francés?"), ("On mange où ce soir ?", "¿Dónde comemos esta noche?"),
        ("Tu as besoin de quelque chose ?", "¿Necesitas algo?"), ("Qu'est-ce que tu cherches ?", "¿Qué buscas?"),
        ("Tu regardes des séries ?", "¿Ves series?"), ("Tu peux répéter, s'il te plaît ?", "¿Puedes repetir, por favor?"),
    ),
    3: (
        ("Qu'est-ce que tu as fait hier ?", "¿Qué hiciste ayer?"), ("Tu as bien dormi ?", "¿Dormiste bien?"),
        ("Tu as vu le film ?", "¿Viste la película?"), ("Qu'est-ce que tu as mangé ce matin ?", "¿Qué comiste esta mañana?"),
        ("Tu as pris le métro ?", "¿Tomaste el metro?"), ("Tu es allé où le week-end dernier ?", "¿A dónde fuiste el finde pasado?"),
        ("Tu as travaillé hier soir ?", "¿Trabajaste anoche?"), ("Tu viens de manger ?", "¿Acabas de comer?"),
        ("Qu'est-ce qu'il a dit ?", "¿Qué dijo?"), ("Tu as compris ?", "¿Entendiste?"), ("Tu l'as vu ?", "¿Lo viste?"),
        ("Tu es rentré tard ?", "¿Volviste tarde?"), ("Qu'est-ce que tu as trouvé ?", "¿Qué encontraste?"),
        ("Et après, qu'est-ce que tu as fait ?", "¿Y después qué hiciste?"), ("C'était bien ?", "¿Estuvo bien?"),
        ("Tu as demandé à qui ?", "¿A quién le preguntaste?"), ("Depuis quand tu apprends le français ?", "¿Desde cuándo aprendes francés?"),
    ),
    4: (
        ("Parle-moi de toi.", "Háblame de ti."), ("Qu'est-ce que tu fais dans la vie ?", "¿A qué te dedicas?"),
        ("Où est-ce que tu vis ?", "¿Dónde vives?"), ("Qu'est-ce que tu aimes faire le week-end ?", "¿Qué te gusta hacer los fines de semana?"),
        ("Qu'est-ce que tu as fait ce week-end ?", "¿Qué hiciste este finde?"), ("Qu'est-ce que tu vas faire demain ?", "¿Qué vas a hacer mañana?"),
        ("Pourquoi tu apprends le français ?", "¿Por qué aprendes francés?"), ("Qu'est-ce que tu penses du travail à la maison ?", "¿Qué opinas del teletrabajo?"),
        ("Tu préfères la ville ou la campagne ? Pourquoi ?", "¿Prefieres la ciudad o el campo? ¿Por qué?"),
        ("Depuis combien de temps tu habites là ?", "¿Cuánto tiempo llevas viviendo ahí?"), ("Tu as commencé quand ?", "¿Cuándo empezaste?"),
        ("Qu'est-ce que tu veux faire l'année prochaine ?", "¿Qué quieres hacer el año que viene?"),
        ("Raconte-moi ta journée d'hier.", "Cuéntame tu día de ayer."), ("Tu te sens comment aujourd'hui ?", "¿Cómo te sientes hoy?"),
        ("Qu'est-ce que tu n'aimes pas ?", "¿Qué no te gusta?"), ("Tu peux expliquer pourquoi ?", "¿Puedes explicar por qué?"),
    ),
}

# ---------------------------------------------------------------------------
# curated interference repairs — (wrong, right, es_source, explanation_es, ref, sprint, pattern)
# ---------------------------------------------------------------------------
REPAIRS: tuple[tuple[str, str, str, str, str, int, str], ...] = (
    ("Je suis 30 ans.", "J'ai 30 ans.", "tengo 30 años", "La edad va con avoir, igual que 'tener': j'ai 30 ans.", "core-verbs#avoir", 1, r"\bsuis\s+\d+\s*ans"),
    ("Je suis faim.", "J'ai faim.", "tengo hambre", "avoir faim ↔ tener hambre. Mismo verbo que en español.", "core-verbs#avoir", 1, r"\bsuis\s+faim"),
    ("Suis fatigué.", "Je suis fatigué.", "estoy cansado (sin sujeto)", "El sujeto nunca se omite en francés: je suis.", "pronouns#subject", 1, r"^(suis|ai|vais|fais)\b"),
    ("Je parle pas français.", "Je ne parle pas français.", "no hablo francés", "Por escrito: ne … pas. Hablado 'je parle pas' es normal.", "sentence-architecture#negation", 1, r"^je \w+ pas"),
    ("Je vais à manger.", "Je vais manger.", "voy a comer", "aller + infinitivo sin 'à'. El 'a' español no se traduce.", "tense-map#near-future", 2, r"\bvais à \w+er\b"),
    ("Me gusta le café → Je gusto le café.", "J'aime le café.", "me gusta el café", "aimer se conjuga con el que siente: j'aime le café.", "transfer#aimer-gustar", 2, r"\bgust"),
    ("J'aime café.", "J'aime le café.", "me gusta el café", "aimer siempre lleva artículo definido: le / la / les.", "transfer#aimer-gustar", 2, r"\baime \w+$"),
    ("Je veux à partir.", "Je veux partir.", "quiero irme", "modal + infinitivo directo, sin preposición.", "sentence-architecture#modal", 2, r"\b(veux|peux|dois) à\b"),
    ("Je suis ingénieur un.", "Je suis ingénieur.", "soy ingeniero", "Profesiones sin artículo, igual que en español.", "articles#professions", 2, r"\bsuis un ingénieur"),
    ("J'ai des amis pas.", "Je n'ai pas d'amis.", "no tengo amigos", "Tras negación un/une/des → de: pas de.", "articles#negation-de", 2, r"pas (des|un|une) "),
    ("Je habite à Chicago.", "J'habite à Chicago.", "vivo en Chicago", "h muda: je + habite → j'habite (elisión).", "pronunciation#elision", 2, r"\bje habite"),
    ("J'ai allé au marché.", "Je suis allé au marché.", "fui al mercado", "aller usa être en el passé composé: je suis allé.", "tense-map#passe-compose-etre", 3, r"\bai allé"),
    ("J'ai vu le.", "Je l'ai vu.", "lo vi", "El pronombre va delante del verbo conjugado: je l'ai vu.", "pronouns#object", 3, r"\bvu le$"),
    ("Je viens manger.", "Je viens de manger.", "acabo de comer", "venir DE + infinitivo = acabar de. Sin 'de' = vengo a comer.", "tense-map#recent-past", 3, r"\bviens \w+er\b"),
    ("Hier, je travaille tard.", "Hier, j'ai travaillé tard.", "ayer trabajé", "'hier' pide passé composé: j'ai travaillé.", "tense-map#passe-compose", 3, r"^hier,? je \w+e\b"),
    ("Je pense de que c'est bien.", "Je pense que c'est bien.", "pienso que", "penser que — sin 'de' (dequeísmo no existe en francés).", "sentence-architecture#que-clauses", 2, r"pense de que"),
    ("Je reste me à la maison.", "Je reste à la maison.", "me quedo en casa", "rester no es reflexivo.", "core-verbs#rester", 4, r"\breste me\b"),
    ("J'attends pour le bus.", "J'attends le bus.", "espero el autobús", "attendre + objeto directo, sin 'pour'.", "core-verbs", 4, r"\battends pour\b"),
    ("Je cherche pour un appartement.", "Je cherche un appartement.", "busco un piso", "chercher + objeto directo, como buscar.", "core-verbs", 2, r"\bcherche pour\b"),
    ("Je suis d'accord avec ça pas.", "Je ne suis pas d'accord.", "no estoy de acuerdo", "ne + être + pas + d'accord.", "sentence-architecture#negation", 4, r"d'accord.*pas"),
    ("Il y a deux jours que je suis ici → Je suis ici depuis deux jours.", "Je suis ici depuis deux jours.", "llevo dos días aquí",
     "depuis + presente ↔ llevar / desde hace.", "tense-map#depuis", 4, r"il y a .* que je"),
    ("J'ai besoin un café.", "J'ai besoin d'un café.", "necesito un café", "avoir besoin DE + nombre.", "core-verbs#avoir", 2, r"besoin (un|une|le|la)\b"),
)

# ---------------------------------------------------------------------------
# curated short readings (offline fallback for the LLM reading format)
# ---------------------------------------------------------------------------
READINGS: dict[int, dict] = {
    1: {
        "title": "Bonjour, je suis Cole",
        "text": "Bonjour ! Je m'appelle Cole. Je suis américain et j'habite à Chicago. Je suis ingénieur. "
                "J'ai un ami français, il s'appelle Marc. Il est très sympa. Aujourd'hui, je suis un peu fatigué, "
                "mais ça va. Je fais du sport et j'aime la musique. Et toi, tu es d'où ?",
        "questions": [
            {"q": "Cole est …", "options": ["ingénieur", "professeur", "étudiant", "médecin"], "answer": 0},
            {"q": "Marc est …", "options": ["américain", "français", "espagnol", "fatigué"], "answer": 1},
            {"q": "Aujourd'hui, Cole est …", "options": ["content", "à Paris", "un peu fatigué", "malade"], "answer": 2},
        ],
    },
    2: {
        "title": "Ce week-end",
        "text": "Ce week-end, je veux faire du sport et voir mes amis. Samedi matin, je dois travailler un peu, "
                "mais après, je suis libre. On va manger au restaurant le soir. J'aime beaucoup la cuisine française. "
                "Dimanche, je pense que je vais rester à la maison et regarder un film. Je ne peux pas sortir : je n'ai pas de voiture.",
        "questions": [
            {"q": "Samedi matin, il …", "options": ["fait du sport", "doit travailler", "va au restaurant", "regarde un film"], "answer": 1},
            {"q": "Dimanche, il va …", "options": ["sortir", "voir ses amis", "rester à la maison", "travailler"], "answer": 2},
            {"q": "Pourquoi il ne peut pas sortir ?", "options": ["il est fatigué", "il n'a pas de voiture", "il n'a pas le temps", "il est malade"], "answer": 1},
        ],
    },
    3: {
        "title": "Hier",
        "text": "Hier, j'ai travaillé jusqu'à 18 heures. Après, j'ai pris le métro et je suis allé au marché. "
                "J'ai acheté du pain et des fruits. Le soir, j'ai mangé avec des amis au restaurant. C'était très bien ! "
                "Je suis rentré tard et j'ai regardé un film. Puis j'ai dormi. Ce matin, je viens de prendre un café.",
        "questions": [
            {"q": "Après le travail, il est allé …", "options": ["au bureau", "au marché", "au cinéma", "chez un ami"], "answer": 1},
            {"q": "Le soir, il a mangé …", "options": ["seul", "à la maison", "avec des amis", "au bureau"], "answer": 2},
            {"q": "Ce matin, il vient de …", "options": ["manger", "dormir", "prendre un café", "travailler"], "answer": 2},
        ],
    },
    4: {
        "title": "Ma vie en ce moment",
        "text": "J'habite à Chicago depuis cinq ans. Je travaille dans une entreprise de logiciels ; j'aime bien mon travail, "
                "mais c'est parfois difficile. Le week-end dernier, j'ai commencé un nouveau projet et j'ai passé beaucoup de temps "
                "sur l'ordinateur. Cette semaine, je vais essayer de finir plus tôt pour faire du sport. À mon avis, c'est important. "
                "L'année prochaine, je veux partir en France pendant un mois. Je pense que je vais bien parler français !",
        "questions": [
            {"q": "Il habite à Chicago depuis …", "options": ["un mois", "cinq ans", "l'année dernière", "toujours"], "answer": 1},
            {"q": "Cette semaine, il va essayer de …", "options": ["partir en France", "finir plus tôt", "commencer un projet", "changer de travail"], "answer": 1},
            {"q": "L'année prochaine, il veut …", "options": ["rester à Chicago", "finir le projet", "partir en France", "acheter un ordinateur"], "answer": 2},
        ],
    },
}

# ---------------------------------------------------------------------------
# curated micro-dialogues (offline fallback) — (line, es, goal, sample answers)
# ---------------------------------------------------------------------------
DIALOGUES: dict[int, tuple[tuple[str, str, str, tuple[str, ...]], ...]] = {
    1: (
        ("Salut ! Ça va ?", "¡Hola! ¿Qué tal?", "answer + ask back", ("Ça va bien, merci. Et toi ?", "Oui, ça va. Et toi ?")),
        ("Tu es d'où ?", "¿De dónde eres?", "answer", ("Je suis de Chicago.", "Je suis américain, de Chicago.")),
        ("Tu as faim ?", "¿Tienes hambre?", "answer negatively + reason", ("Non, je n'ai pas faim.", "Non, pas maintenant.")),
        ("Il y a un problème ?", "¿Hay algún problema?", "answer", ("Non, pas de problème.", "Oui, j'ai une question.")),
    ),
    2: (
        ("Tu veux sortir ce soir ?", "¿Quieres salir esta noche?", "decline + reason", ("Je ne peux pas, je dois travailler.", "Non, je suis fatigué ce soir.")),
        ("Qu'est-ce que tu aimes faire le week-end ?", "¿Qué te gusta hacer los fines de semana?", "answer with two things", ("J'aime faire du sport et voir mes amis.",)),
        ("On mange où ?", "¿Dónde comemos?", "propose", ("On peut aller au restaurant.", "Chez moi, si tu veux.")),
        ("Tu parles français ?", "¿Hablas francés?", "answer + limit", ("Un peu. J'apprends.", "Oui, un peu, mais pas très bien.")),
    ),
    3: (
        ("Qu'est-ce que tu as fait hier ?", "¿Qué hiciste ayer?", "two past actions", ("J'ai travaillé et après j'ai vu des amis.",)),
        ("Tu as vu le film ?", "¿Viste la película?", "answer with pronoun", ("Oui, je l'ai vu hier soir.", "Non, je ne l'ai pas vu.")),
        ("Tu viens de manger ?", "¿Acabas de comer?", "answer", ("Oui, je viens de manger.", "Non, pas encore.")),
        ("C'était bien ?", "¿Estuvo bien?", "evaluate + detail", ("Oui, c'était super. Il y avait beaucoup de gens.",)),
    ),
    4: (
        ("Pourquoi tu apprends le français ?", "¿Por qué aprendes francés?", "reason with parce que", ("Parce que je veux partir en France l'année prochaine.",)),
        ("Tu préfères la ville ou la campagne ?", "¿Prefieres la ciudad o el campo?", "opinion + reason", ("La ville, parce qu'il y a plus de choses à faire.",)),
        ("Qu'est-ce que tu vas faire ce week-end ?", "¿Qué vas a hacer este finde?", "plan + past contrast", ("Je vais rester à la maison. Le week-end dernier, j'ai beaucoup travaillé.",)),
        ("Tu te sens comment ?", "¿Cómo te sientes?", "answer + reason", ("Je me sens bien, mais je suis un peu fatigué.",)),
    ),
}

# cognate-mining fallback paragraph (sprint-agnostic; recognition items)
COGNATE_PARAGRAPH = {
    "text": "La situation économique est difficile, mais le gouvernement propose une solution intéressante : "
            "une réforme importante du système de transport public. Les experts pensent que c'est possible, "
            "mais la population a des questions. La décision finale est prévue pour le mois de septembre.",
    "cognates": [
        ("situation", "situación", "/sitɥasjɔ̃/"), ("économique", "económica", "/ekɔnɔmik/"), ("gouvernement", "gobierno", "/ɡuvɛʁnəmɑ̃/"),
        ("solution", "solución", "/sɔlysjɔ̃/"), ("intéressante", "interesante", "/ɛ̃teʁesɑ̃t/"), ("réforme", "reforma", "/ʁefɔʁm/"),
        ("importante", "importante", "/ɛ̃pɔʁtɑ̃t/"), ("système", "sistema", "/sistɛm/"), ("transport", "transporte", "/tʁɑ̃spɔʁ/"),
        ("public", "público", "/pyblik/"), ("experts", "expertos", "/ɛkspɛʁ/"), ("possible", "posible", "/pɔsibl/"),
        ("population", "población", "/pɔpylasjɔ̃/"), ("questions", "preguntas", "/kɛstjɔ̃/"), ("décision", "decisión", "/desizjɔ̃/"),
        ("finale", "final", "/final/"), ("septembre", "septiembre", "/sɛptɑ̃bʁ/"),
    ],
}

# ---------------------------------------------------------------------------
# self-graded tasks
# ---------------------------------------------------------------------------
SELF_TASKS: dict[str, dict] = {
    "self_intro": {
        "title": "Self-introduction · 60 s",
        "steps": ["Name, origin, city, job", "One thing you like, one you do often", "How you feel today", "One question back"],
        "frames": ["Je m'appelle …", "Je suis … / J'habite à …", "J'aime … / Je fais …", "Aujourd'hui, je suis …", "Et toi ?"],
        "dims": {"speaking": 1},
    },
    "three_plans": {
        "title": "3 plans · aller + infinitif",
        "steps": ["Ce soir …", "Demain …", "Ce week-end …"],
        "frames": ["Ce soir, je vais …", "Demain, je vais …", "Ce week-end, on va …"],
        "dims": {"speaking": 0.7, "grammar": 0.3},
    },
    "self_description": {
        "title": "2-minute self-description",
        "steps": ["Who you are", "Work / study", "Where you live and with whom", "Likes / dislikes", "Want / can / must this week"],
        "frames": ["Je travaille dans …", "J'habite … avec …", "J'aime … mais je n'aime pas …", "Cette semaine, je veux … / je dois …"],
        "dims": {"speaking": 1},
    },
    "tutor_session": {
        "title": "Focused conversation · 30–45 min",
        "steps": ["10 min pronunciation correction", "15 min controlled questions (known grammar)", "10 min reformulation",
                  "Record 5–10 recurring errors → Interference log", "Only high-value corrections become cards"],
        "frames": ["Brief: known vocab + grammar, target sounds, themes. Correct pronunciation + major grammar only."],
        "dims": {"speaking": 1},
    },
    "yesterday_story": {
        "title": "Yesterday · 2–3 min",
        "steps": ["D'abord …", "Puis / après …", "Le soir …", "C'était … (evaluation)", "Et demain ? (one future line)"],
        "frames": ["D'abord, j'ai …", "Puis je suis allé …", "Le soir, on a …", "C'était bien / nul", "Demain, je vais …"],
        "dims": {"speaking": 1},
    },
    "retell_432": {
        "title": "4/3/2 retelling",
        "steps": ["Same story: 60 s", "Again: 45 s", "Again: 30 s — fewer pauses, same content"],
        "frames": ["Pick yesterday's story or your intro."],
        "dims": {"speaking": 1},
    },
    "five_minutes": {
        "title": "5-minute conversation",
        "steps": ["Who you are, what you do, where you live", "Likes, can / want / must", "Recent past", "Plans", "One opinion + reason"],
        "frames": ["With a partner or the AI dialogue. Stay in French; circumlocute, don't switch."],
        "dims": {"speaking": 1},
    },
    "writing_150": {
        "title": "Write 100–150 words",
        "steps": ["Yourself and your life now", "A recent activity (passé composé)", "Plans (futur proche)", "One opinion"],
        "frames": ["Write it in a Text (Texts → new) so you can annotate it later."],
        "dims": {"writing": 1},
    },
}
