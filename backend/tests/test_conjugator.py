import unittest
from unittest.mock import patch

from app.services import conjugator


def _rows(forms: list[str], persons: list[str] | None = None) -> list[dict]:
    persons = persons or conjugator.PERSONS_6
    return [
        {"p": person[0], "n": person[1], "c": [form]}
        for person, form in zip(persons, forms)
    ]


class _FakeConjugation:
    def get_data(self) -> dict:
        return {
            "verb": {"template": "aim:er", "predicted": False},
            "moods": {
                "indicatif": {
                    "présent": _rows(
                        [
                            "se balade",
                            "se balades",
                            "se balade",
                            "se baladons",
                            "se baladez",
                            "se baladent",
                        ]
                    ),
                    "passé-composé": _rows(
                        [
                            "se suis baladé",
                            "s'es baladé",
                            "s'est baladé",
                            "se sommes baladés",
                            "s'êtes baladés",
                            "se sont baladés",
                        ]
                    ),
                },
                "imperatif": {
                    "imperatif-présent": _rows(
                        ["balade-toi", "baladons-nous", "baladez-vous"],
                        conjugator.IMPERATIVE_PERSONS["fr"],
                    )
                },
            },
        }


class _FakeConjugator:
    def conjugate(self, infinitive: str, conjugate_pronouns: bool) -> _FakeConjugation:
        self.infinitive = infinitive
        self.conjugate_pronouns = conjugate_pronouns
        return _FakeConjugation()


class FrenchReflexiveConjugationTests(unittest.TestCase):
    def setUp(self) -> None:
        fake = _FakeConjugator()
        self.fake = fake
        available = patch.object(conjugator, "available", return_value=True)
        provider = patch.object(conjugator, "_conjugator", return_value=fake)
        available.start()
        provider.start()
        self.addCleanup(available.stop)
        self.addCleanup(provider.stop)

    def forms(self, result: dict, mood: str, tense: str) -> list[str]:
        return [
            row["form"]
            for row in result["forms"]
            if row["mood"] == mood and row["tense"] == tense
        ]

    def test_personalizes_reflexive_forms_without_adding_subjects(self) -> None:
        result = conjugator.conjugate("se balader", "fr")

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(self.fake.infinitive, "se balader")
        self.assertFalse(self.fake.conjugate_pronouns)
        self.assertEqual(
            self.forms(result, "indicatif", "présent"),
            [
                "me balade",
                "te balades",
                "se balade",
                "nous baladons",
                "vous baladez",
                "se baladent",
            ],
        )
        self.assertEqual(
            self.forms(result, "indicatif", "passé-composé"),
            [
                "me suis baladé",
                "t'es baladé",
                "s'est baladé",
                "nous sommes baladés",
                "vous êtes baladés",
                "se sont baladés",
            ],
        )

    def test_personalizes_near_future_but_preserves_imperative(self) -> None:
        result = conjugator.conjugate("se balader", "fr")

        assert result is not None
        self.assertEqual(
            self.forms(result, "indicatif", "futur-proche"),
            [
                "vais me balader",
                "vas te balader",
                "va se balader",
                "allons nous balader",
                "allez vous balader",
                "vont se balader",
            ],
        )
        self.assertEqual(
            self.forms(result, "imperatif", "présent"),
            ["balade-toi", "baladons-nous", "baladez-vous"],
        )

    def test_handles_elision_and_curly_apostrophe(self) -> None:
        self.assertEqual(
            conjugator._personalize_french_reflexive("s'amuse", "1s"),
            "m'amuse",
        )
        self.assertEqual(
            conjugator._personalize_french_reflexive("s'amusons", "1p"),
            "nous amusons",
        )

        result = conjugator.conjugate("s’amuser", "fr")

        assert result is not None
        self.assertEqual(result["infinitive"], "s'amuser")
        self.assertEqual(
            self.forms(result, "indicatif", "futur-proche")[0],
            "vais m'amuser",
        )


if __name__ == "__main__":
    unittest.main()
