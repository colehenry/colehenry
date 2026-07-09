"""repair migrated Spanish display labels into canonical infinitives

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-09

The pre-0009 ``es_equivalent`` column sometimes held a display label such as
``ser / estar`` while its conjugation rows were generated from ``ser``. 0009
now handles that distinction during fresh upgrades; this repair preserves the
already-migrated production data and merges repeated equivalents safely.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TEMP TABLE es_verb_repair ON COMMIT DROP AS
        WITH canonical AS (
            SELECT
                v.id AS old_id,
                COALESCE(
                    (
                        SELECT regexp_replace(c.form, '^voy a ', '')
                        FROM conjugations c
                        WHERE c.verb_id = v.id
                          AND c.mood = 'indicativo'
                          AND c.tense = 'futuro-próximo'
                          AND c.person = '1s'
                          AND c.form LIKE 'voy a %'
                        LIMIT 1
                    ),
                    v.infinitive
                ) AS canonical_infinitive
            FROM verbs v
            WHERE v.language = 'es'
        )
        SELECT
            old_id,
            canonical_infinitive,
            min(old_id) OVER (PARTITION BY lower(trim(canonical_infinitive))) AS keeper_id
        FROM canonical
        """
    )

    op.execute(
        """
        INSERT INTO language_lexemes (language, headword, normalized_headword)
        SELECT DISTINCT 'es', canonical_infinitive, lower(trim(canonical_infinitive))
        FROM es_verb_repair
        ON CONFLICT (language, normalized_headword) DO NOTHING
        """
    )

    # Redirect relationships and memberships before duplicate verb rows go.
    op.execute(
        """
        INSERT INTO verb_relations (source_verb_id, target_verb_id, relation_type)
        SELECT
            CASE WHEN s.old_id IS NULL THEN r.source_verb_id ELSE s.keeper_id END,
            CASE WHEN t.old_id IS NULL THEN r.target_verb_id ELSE t.keeper_id END,
            r.relation_type
        FROM verb_relations r
        LEFT JOIN es_verb_repair s ON s.old_id = r.source_verb_id
        LEFT JOIN es_verb_repair t ON t.old_id = r.target_verb_id
        WHERE (s.old_id IS NOT NULL AND s.old_id <> s.keeper_id)
           OR (t.old_id IS NOT NULL AND t.old_id <> t.keeper_id)
        ON CONFLICT (source_verb_id, target_verb_id, relation_type) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO verb_set_members (set_id, verb_id, position)
        SELECT m.set_id, r.keeper_id, m.position
        FROM verb_set_members m
        JOIN es_verb_repair r ON r.old_id = m.verb_id
        WHERE r.old_id <> r.keeper_id
        ON CONFLICT (set_id, verb_id) DO NOTHING
        """
    )

    # Preserve any Spanish generated-card links if this migration is applied
    # after the feature has already been used.
    op.execute(
        """
        UPDATE flashcards card SET conjugation_id = keeper_conj.id
        FROM conjugations old_conj
        JOIN es_verb_repair r ON r.old_id = old_conj.verb_id
        JOIN conjugations keeper_conj
          ON keeper_conj.verb_id = r.keeper_id
         AND keeper_conj.slot_key = old_conj.slot_key
        WHERE card.conjugation_id = old_conj.id
          AND r.old_id <> r.keeper_id
        """
    )
    op.execute(
        """
        INSERT INTO conjugations (
            verb_id, mood, tense, person, form, slot_key, audio_url
        )
        SELECT
            r.keeper_id, c.mood, c.tense, c.person, c.form, c.slot_key, c.audio_url
        FROM conjugations c
        JOIN es_verb_repair r ON r.old_id = c.verb_id
        WHERE r.old_id <> r.keeper_id
        ON CONFLICT (verb_id, mood, tense, person) DO NOTHING
        """
    )

    op.execute(
        """
        DELETE FROM verbs v USING es_verb_repair r
        WHERE v.id = r.old_id AND r.old_id <> r.keeper_id
        """
    )
    op.execute(
        """
        UPDATE verbs v SET
            infinitive = r.canonical_infinitive,
            normalized_infinitive = lower(trim(r.canonical_infinitive)),
            lexeme_id = l.id,
            "group" = CASE
                WHEN lower(r.canonical_infinitive) LIKE '%ar' THEN '-ar'
                WHEN lower(r.canonical_infinitive) LIKE '%er' THEN '-er'
                WHEN lower(r.canonical_infinitive) LIKE '%ir' THEN '-ir'
                ELSE 'irregular'
            END
        FROM es_verb_repair r
        JOIN language_lexemes l
          ON l.language = 'es'
         AND l.normalized_headword = lower(trim(r.canonical_infinitive))
        WHERE v.id = r.keeper_id
        """
    )


def downgrade() -> None:
    # The old display strings are not recoverable after 0009 drops the source
    # column. The repaired canonical records remain valid on downgrade to 0009.
    pass
