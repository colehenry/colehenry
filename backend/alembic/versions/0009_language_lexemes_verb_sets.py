"""generalize languages, canonical lexemes, verb equivalents, and verb sets

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LANGUAGE_TABLES = (
    "flashcard_decks",
    "review_logs",
    "language_texts",
    "wiki_entries",
)


def upgrade() -> None:
    op.create_table(
        "supported_languages",
        sa.Column("code", sa.String(12), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.execute(
        "INSERT INTO supported_languages (code, name) "
        "VALUES ('fr', 'French'), ('es', 'Spanish')"
    )

    # The old PostgreSQL enum made every new language a schema migration.
    # Catalog-backed strings let another installation add a language as data.
    for table in LANGUAGE_TABLES:
        op.alter_column(
            table,
            "language",
            existing_type=sa.Enum("es", "fr", name="language_code"),
            type_=sa.String(12),
            postgresql_using="language::text",
            existing_nullable=False,
        )
        op.create_foreign_key(
            f"fk_{table}_language_supported",
            table,
            "supported_languages",
            ["language"],
            ["code"],
        )

    op.create_table(
        "language_lexemes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "language",
            sa.String(12),
            sa.ForeignKey("supported_languages.code"),
            nullable=False,
        ),
        sa.Column("headword", sa.String(160), nullable=False),
        sa.Column("normalized_headword", sa.String(160), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("language", "normalized_headword"),
    )
    op.create_index(
        "ix_language_lexemes_language_headword",
        "language_lexemes",
        ["language", "normalized_headword"],
    )

    op.add_column(
        "language_text_annotations",
        sa.Column("lexeme_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "language_text_annotations",
        sa.Column("form_note", sa.Text(), nullable=False, server_default=""),
    )
    op.create_foreign_key(
        "fk_language_text_annotations_lexeme",
        "language_text_annotations",
        "language_lexemes",
        ["lexeme_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_language_text_annotations_lexeme_id",
        "language_text_annotations",
        ["lexeme_id"],
    )
    op.execute(
        """
        INSERT INTO language_lexemes (language, headword, normalized_headword)
        SELECT DISTINCT 'fr', match.lemma, lower(trim(match.lemma))
        FROM language_text_annotations a
        JOIN language_texts t ON t.id = a.text_id AND t.language = 'fr'
        JOIN LATERAL (
            SELECT l.lemma
            FROM lexique_entries l
            WHERE lower(l.word) = lower(trim(a.selected_text))
              AND l.pos IN ('VER', 'AUX')
            ORDER BY l.frequency DESC
            LIMIT 1
        ) match ON true
        WHERE lower(trim(match.lemma)) <> lower(trim(a.selected_text))
        ON CONFLICT (language, normalized_headword) DO NOTHING
        """
    )
    op.execute(
        """
        WITH matches AS (
            SELECT DISTINCT ON (a.id) a.id, l.lemma
            FROM language_text_annotations a
            JOIN language_texts t ON t.id = a.text_id AND t.language = 'fr'
            JOIN lexique_entries l
              ON lower(l.word) = lower(trim(a.selected_text))
             AND l.pos IN ('VER', 'AUX')
            WHERE lower(trim(l.lemma)) <> lower(trim(a.selected_text))
            ORDER BY a.id, l.frequency DESC
        )
        UPDATE language_text_annotations a SET
            lexeme_id = lex.id,
            form_note = a.translation
        FROM matches m
        JOIN language_lexemes lex
          ON lex.language = 'fr'
         AND lex.normalized_headword = lower(trim(m.lemma))
        WHERE a.id = m.id
        """
    )

    op.add_column(
        "wiki_entries",
        sa.Column("payload_version", sa.Integer(), nullable=False, server_default="1"),
    )

    # Promote verbs from a French row with embedded Spanish strings into one
    # row per language, related explicitly in verb_relations.
    op.add_column(
        "verbs",
        sa.Column("language", sa.String(12), nullable=False, server_default="fr"),
    )
    op.add_column(
        "verbs",
        sa.Column("normalized_infinitive", sa.String(160), nullable=False, server_default=""),
    )
    op.add_column("verbs", sa.Column("lexeme_id", sa.Integer(), nullable=True))
    op.execute("UPDATE verbs SET normalized_infinitive = lower(trim(infinitive))")
    op.drop_constraint("verbs_infinitive_key", "verbs", type_="unique")
    op.create_foreign_key(
        "fk_verbs_language_supported",
        "verbs",
        "supported_languages",
        ["language"],
        ["code"],
    )
    op.create_foreign_key(
        "fk_verbs_lexeme",
        "verbs",
        "language_lexemes",
        ["lexeme_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_verbs_language_infinitive",
        "verbs",
        ["language", "normalized_infinitive"],
    )
    op.create_unique_constraint("uq_verbs_lexeme_id", "verbs", ["lexeme_id"])
    op.create_index(
        "ix_verbs_language_infinitive",
        "verbs",
        ["language", "normalized_infinitive"],
    )

    op.execute(
        """
        INSERT INTO language_lexemes (language, headword, normalized_headword)
        SELECT 'fr', infinitive, lower(trim(infinitive)) FROM verbs
        ON CONFLICT (language, normalized_headword) DO NOTHING
        """
    )
    op.execute(
        """
        CREATE TEMP TABLE verb_es_map ON COMMIT DROP AS
        SELECT
            fr.id AS fr_verb_id,
            COALESCE(
                (
                    SELECT regexp_replace(c.es_form, '^.* a ', '')
                    FROM conjugations c
                    WHERE c.verb_id = fr.id
                      AND c.mood = 'indicatif'
                      AND c.tense = 'futur-proche'
                      AND c.person = '1s'
                      AND c.es_form <> ''
                    LIMIT 1
                ),
                fr.es_equivalent
            ) AS es_infinitive
        FROM verbs fr
        WHERE fr.language = 'fr' AND fr.es_equivalent <> ''
        """
    )
    op.execute(
        """
        INSERT INTO language_lexemes (language, headword, normalized_headword)
        SELECT DISTINCT 'es', es_infinitive, lower(trim(es_infinitive))
        FROM verb_es_map WHERE es_infinitive <> ''
        ON CONFLICT (language, normalized_headword) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE verbs v SET lexeme_id = l.id
        FROM language_lexemes l
        WHERE l.language = 'fr'
          AND l.normalized_headword = v.normalized_infinitive
        """
    )
    op.execute(
        """
        INSERT INTO verbs (
            language, lexeme_id, infinitive, normalized_infinitive, "group",
            is_irregular, translation, es_equivalent, frequency_rank
        )
        SELECT DISTINCT ON (lower(trim(m.es_infinitive)))
            'es', l.id, m.es_infinitive, lower(trim(m.es_infinitive)),
            CASE
                WHEN lower(m.es_infinitive) LIKE '%ar' THEN '-ar'
                WHEN lower(m.es_infinitive) LIKE '%er' THEN '-er'
                WHEN lower(m.es_infinitive) LIKE '%ir' THEN '-ir'
                ELSE 'irregular'
            END,
            CASE
                WHEN lower(m.es_infinitive) LIKE '%ar'
                  OR lower(m.es_infinitive) LIKE '%er'
                  OR lower(m.es_infinitive) LIKE '%ir' THEN false
                ELSE true
            END,
            fr.translation, '', fr.frequency_rank
        FROM verbs fr
        JOIN verb_es_map m ON m.fr_verb_id = fr.id
        JOIN language_lexemes l
          ON l.language = 'es'
         AND l.normalized_headword = lower(trim(m.es_infinitive))
        WHERE fr.language = 'fr' AND m.es_infinitive <> ''
        ORDER BY lower(trim(m.es_infinitive)), fr.frequency_rank
        ON CONFLICT (language, normalized_infinitive) DO NOTHING
        """
    )

    op.create_table(
        "verb_relations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_verb_id",
            sa.Integer(),
            sa.ForeignKey("verbs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_verb_id",
            sa.Integer(),
            sa.ForeignKey("verbs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("relation_type", sa.String(30), nullable=False, server_default="translation"),
        sa.UniqueConstraint("source_verb_id", "target_verb_id", "relation_type"),
    )
    op.create_index("ix_verb_relations_source_verb_id", "verb_relations", ["source_verb_id"])
    op.create_index("ix_verb_relations_target_verb_id", "verb_relations", ["target_verb_id"])
    op.execute(
        """
        INSERT INTO verb_relations (source_verb_id, target_verb_id, relation_type)
        SELECT fr.id, es.id, 'translation'
        FROM verbs fr
        JOIN verb_es_map m ON m.fr_verb_id = fr.id
        JOIN verbs es
          ON es.language = 'es'
         AND es.normalized_infinitive = lower(trim(m.es_infinitive))
        WHERE fr.language = 'fr' AND m.es_infinitive <> ''
        """
    )
    op.execute(
        """
        INSERT INTO verb_relations (source_verb_id, target_verb_id, relation_type)
        SELECT target_verb_id, source_verb_id, relation_type FROM verb_relations
        """
    )

    op.add_column(
        "conjugations",
        sa.Column("slot_key", sa.String(100), nullable=False, server_default=""),
    )
    op.execute(
        """
        UPDATE conjugations SET slot_key =
            CASE mood
                WHEN 'indicatif' THEN 'indicative'
                WHEN 'conditionnel' THEN 'conditional'
                WHEN 'subjonctif' THEN 'subjunctive'
                WHEN 'imperatif' THEN 'imperative'
                ELSE mood
            END || ':' ||
            CASE tense
                WHEN 'présent' THEN 'present'
                WHEN 'passé-composé' THEN 'compound-past'
                WHEN 'imparfait' THEN 'imperfect'
                WHEN 'futur-proche' THEN 'near-future'
                WHEN 'futur-simple' THEN 'future'
                WHEN 'passé-simple' THEN 'simple-past'
                ELSE tense
            END || ':' || person
        """
    )
    op.execute(
        """
        INSERT INTO conjugations (
            verb_id, mood, tense, person, form, es_form, slot_key, audio_url
        )
        SELECT
            es.id,
            CASE c.mood
                WHEN 'indicatif' THEN 'indicativo'
                WHEN 'conditionnel' THEN 'condicional'
                WHEN 'subjonctif' THEN 'subjuntivo'
                WHEN 'imperatif' THEN 'imperativo'
                ELSE c.mood
            END,
            CASE c.tense
                WHEN 'présent' THEN CASE WHEN c.mood = 'imperatif' THEN 'afirmativo' ELSE 'presente' END
                WHEN 'passé-composé' THEN 'pretérito-perfecto-compuesto'
                WHEN 'imparfait' THEN 'pretérito-imperfecto'
                WHEN 'futur-proche' THEN 'futuro-próximo'
                WHEN 'futur-simple' THEN 'futuro'
                WHEN 'passé-simple' THEN 'pretérito-perfecto-simple'
                ELSE c.tense
            END,
            c.person, c.es_form, c.es_form, c.slot_key, ''
        FROM conjugations c
        JOIN verbs fr ON fr.id = c.verb_id AND fr.language = 'fr'
        JOIN verb_relations r
          ON r.source_verb_id = fr.id AND r.relation_type = 'translation'
        JOIN verbs es ON es.id = r.target_verb_id AND es.language = 'es'
        WHERE c.es_form <> ''
        ON CONFLICT (verb_id, mood, tense, person) DO NOTHING
        """
    )
    op.create_index("ix_conjugations_slot_key", "conjugations", ["slot_key"])

    op.create_table(
        "verb_sets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "language",
            sa.String(12),
            sa.ForeignKey("supported_languages.code"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("language", "name"),
    )
    op.create_index("ix_verb_sets_language", "verb_sets", ["language"])
    op.create_table(
        "verb_set_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "set_id",
            sa.Integer(),
            sa.ForeignKey("verb_sets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "verb_id",
            sa.Integer(),
            sa.ForeignKey("verbs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("set_id", "verb_id"),
    )
    op.create_index("ix_verb_set_members_set_id", "verb_set_members", ["set_id"])
    op.create_index("ix_verb_set_members_verb_id", "verb_set_members", ["verb_id"])

    op.add_column("flashcards", sa.Column("lexeme_id", sa.Integer(), nullable=True))
    op.add_column("flashcards", sa.Column("conjugation_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_flashcards_lexeme",
        "flashcards",
        "language_lexemes",
        ["lexeme_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_flashcards_conjugation",
        "flashcards",
        "conjugations",
        ["conjugation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_flashcards_lexeme_id", "flashcards", ["lexeme_id"])
    op.create_index("ix_flashcards_conjugation_id", "flashcards", ["conjugation_id"])
    op.execute(
        """
        UPDATE flashcards c SET conjugation_id = c.source_ref::integer
        WHERE c.source = 'conjugation'
          AND c.source_ref ~ '^[0-9]+$'
          AND EXISTS (SELECT 1 FROM conjugations x WHERE x.id = c.source_ref::integer)
        """
    )
    op.execute(
        """
        UPDATE flashcards c SET lexeme_id = v.lexeme_id
        FROM flashcard_decks d, verbs v
        WHERE d.id = c.deck_id
          AND v.language = d.language
          AND v.normalized_infinitive = lower(trim(c.front))
          AND c.card_type = 'basic'
        """
    )

    # The production lookup uses lower(word); make the large Lexique index
    # match that expression rather than forcing a sequential scan.
    op.drop_index("ix_lexique_entries_word", table_name="lexique_entries")
    op.create_index(
        "ix_lexique_entries_lower_word_frequency",
        "lexique_entries",
        [sa.text("lower(word)"), sa.text("frequency DESC")],
    )

    op.drop_column("conjugations", "es_form")
    op.drop_column("verbs", "es_equivalent")


def downgrade() -> None:
    op.add_column(
        "verbs",
        sa.Column("es_equivalent", sa.String(60), nullable=False, server_default=""),
    )
    op.add_column(
        "conjugations",
        sa.Column("es_form", sa.String(120), nullable=False, server_default=""),
    )
    op.execute(
        """
        UPDATE verbs fr SET es_equivalent = es.infinitive
        FROM verb_relations r JOIN verbs es ON es.id = r.target_verb_id
        WHERE r.source_verb_id = fr.id
          AND fr.language = 'fr' AND es.language = 'es'
        """
    )
    op.execute(
        """
        UPDATE conjugations fr SET es_form = es.form
        FROM verbs fv, verb_relations r, verbs ev, conjugations es
        WHERE fr.verb_id = fv.id AND fv.language = 'fr'
          AND r.source_verb_id = fv.id AND r.target_verb_id = ev.id
          AND ev.language = 'es' AND es.verb_id = ev.id
          AND es.slot_key = fr.slot_key
        """
    )

    op.create_index("ix_lexique_entries_word", "lexique_entries", ["word"])
    op.drop_index("ix_lexique_entries_lower_word_frequency", table_name="lexique_entries")

    op.drop_index("ix_flashcards_conjugation_id", table_name="flashcards")
    op.drop_index("ix_flashcards_lexeme_id", table_name="flashcards")
    op.drop_constraint("fk_flashcards_conjugation", "flashcards", type_="foreignkey")
    op.drop_constraint("fk_flashcards_lexeme", "flashcards", type_="foreignkey")
    op.drop_column("flashcards", "conjugation_id")
    op.drop_column("flashcards", "lexeme_id")

    op.drop_table("verb_set_members")
    op.drop_table("verb_sets")
    op.drop_index("ix_conjugations_slot_key", table_name="conjugations")
    op.drop_column("conjugations", "slot_key")
    op.drop_table("verb_relations")

    op.drop_index("ix_verbs_language_infinitive", table_name="verbs")
    op.drop_constraint("uq_verbs_lexeme_id", "verbs", type_="unique")
    op.drop_constraint("uq_verbs_language_infinitive", "verbs", type_="unique")
    op.drop_constraint("fk_verbs_lexeme", "verbs", type_="foreignkey")
    op.drop_constraint("fk_verbs_language_supported", "verbs", type_="foreignkey")
    op.drop_column("verbs", "lexeme_id")
    op.drop_column("verbs", "normalized_infinitive")
    op.drop_column("verbs", "language")
    op.create_unique_constraint("verbs_infinitive_key", "verbs", ["infinitive"])

    op.drop_column("wiki_entries", "payload_version")
    op.drop_index("ix_language_text_annotations_lexeme_id", table_name="language_text_annotations")
    op.drop_constraint(
        "fk_language_text_annotations_lexeme",
        "language_text_annotations",
        type_="foreignkey",
    )
    op.drop_column("language_text_annotations", "form_note")
    op.drop_column("language_text_annotations", "lexeme_id")
    op.drop_table("language_lexemes")

    for table in reversed(LANGUAGE_TABLES):
        op.drop_constraint(f"fk_{table}_language_supported", table, type_="foreignkey")
        op.alter_column(
            table,
            "language",
            existing_type=sa.String(12),
            type_=sa.Enum("es", "fr", name="language_code"),
            postgresql_using="language::language_code",
            existing_nullable=False,
        )
    op.drop_table("supported_languages")
