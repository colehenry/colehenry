"use client";

import Link from "next/link";
import { useState } from "react";

import "./xp.css";

type DemoSection = "texts" | "study" | "decks" | "wiki";
type PhraseId = "la-veille" | "souvenir" | "a-force" | "en-revanche";

const sections: { id: DemoSection; label: string }[] = [
  { id: "texts", label: "Texts" },
  { id: "study", label: "Study" },
  { id: "decks", label: "Decks" },
  { id: "wiki", label: "Wiki" },
];

const phraseDetails: Record<
  PhraseId,
  { phrase: string; translation: string; note: string; tag: string }
> = {
  "la-veille": {
    phrase: "la veille",
    translation: "the day before",
    note: "A compact way to refer to the previous day.",
    tag: "time expression",
  },
  souvenir: {
    phrase: "s’en souvenir",
    translation: "to remember it",
    note: "Se souvenir de + noun. The pronoun en replaces de + thing.",
    tag: "pronominal verb",
  },
  "a-force": {
    phrase: "à force de",
    translation: "by repeatedly / through",
    note: "Introduces the repeated effort that produces a result.",
    tag: "expression",
  },
  "en-revanche": {
    phrase: "en revanche",
    translation: "on the other hand",
    note: "Marks a contrast, similar to par contre in everyday speech.",
    tag: "connector",
  },
};

const cards = [
  {
    front: "se souvenir de",
    back: "to remember",
    example: "J’essaie de me souvenir de cette phrase.",
  },
  {
    front: "à force de",
    back: "by repeatedly / through",
    example: "À force de lire, les mots deviennent familiers.",
  },
];

function DemoAnnotation({
  id,
  compact,
  selected,
  onSelect,
}: {
  id: PhraseId;
  compact: boolean;
  selected: PhraseId;
  onSelect: (id: PhraseId) => void;
}) {
  const className = `xp-annotation ${selected === id ? "is-active" : ""}`;
  if (compact) {
    return <span className={className}>{phraseDetails[id].phrase}</span>;
  }
  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected === id}
      onClick={() => onSelect(id)}
    >
      {phraseDetails[id].phrase}
    </button>
  );
}

function TextPreview({
  compact,
  selected,
  onSelect,
}: {
  compact: boolean;
  selected: PhraseId;
  onSelect: (id: PhraseId) => void;
}) {
  const detail = phraseDetails[selected];

  return (
    <div className="qnst-view">
      <div className="qnst-view-heading">
        <div>
          <b>Une habitude à garder</b>
          <span className="xp-muted"> French · journal</span>
        </div>
        <span className="qnst-readonly-badge">read only</span>
      </div>
      <div className="qnst-reader-grid">
        <article className="xp-well xp-doc qnst-document" lang="fr">
          <p>
            Chaque matin, Camille note une phrase entendue{" "}
            <DemoAnnotation
              id="la-veille"
              compact={compact}
              selected={selected}
              onSelect={onSelect}
            />
            . Elle la relit dans son contexte, puis essaie de{" "}
            <DemoAnnotation
              id="souvenir"
              compact={compact}
              selected={selected}
              onSelect={onSelect}
            />{" "}
            sans regarder la traduction.
          </p>
          <p>
            <DemoAnnotation
              id="a-force"
              compact={compact}
              selected={selected}
              onSelect={onSelect}
            />{" "}
            les retrouver dans ses lectures, les mots sont devenus familiers.
            Elle ne cherchait plus à tout mémoriser d’un coup;{" "}
            <DemoAnnotation
              id="en-revanche"
              compact={compact}
              selected={selected}
              onSelect={onSelect}
            />
            , elle revenait souvent.
          </p>
        </article>
        <fieldset className="xp-group qnst-inspector" aria-live="polite">
          <legend>Annotation</legend>
          <p className="qnst-phrase" lang="fr">
            {detail.phrase}
          </p>
          <p className="qnst-translation">{detail.translation}</p>
          <p className="xp-muted qnst-note">{detail.note}</p>
          <div className="qnst-tag">{detail.tag}</div>
          {!compact && (
            <p className="xp-muted qnst-preview-note">
              In the private app, this can be saved directly to a deck.
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );
}

function StudyPreview() {
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = cards[cardIndex];

  return (
    <div className="qnst-view qnst-study-view">
      <div className="qnst-view-heading">
        <div>
          <b>French phrases</b>
          <span className="xp-muted"> · 2 sample cards</span>
        </div>
        <span className="qnst-readonly-badge">practice preview</span>
      </div>
      <fieldset className="xp-group qnst-study-card">
        <legend>Card {cardIndex + 1} of {cards.length}</legend>
        <p className="qnst-study-front" lang="fr">
          {card.front}
        </p>
        {revealed ? (
          <div className="qnst-answer">
            <p>{card.back}</p>
            <p className="xp-muted" lang="fr">
              {card.example}
            </p>
          </div>
        ) : (
          <p className="xp-muted">Recall the meaning, then reveal the answer.</p>
        )}
        <div className="qnst-study-actions">
          <button
            type="button"
            className="xp-btn is-default"
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? "Hide answer" : "Show answer"}
          </button>
          <button
            type="button"
            className="xp-btn"
            onClick={() => {
              setCardIndex((index) => (index + 1) % cards.length);
              setRevealed(false);
            }}
          >
            Next sample
          </button>
        </div>
      </fieldset>
      <p className="xp-muted qnst-local-note">
        Preview interactions stay in this browser and never update study history.
      </p>
    </div>
  );
}

function DecksPreview() {
  return (
    <div className="qnst-view">
      <div className="qnst-view-heading">
        <div>
          <b>Decks</b>
          <span className="xp-muted"> Curated sample library</span>
        </div>
        <span className="qnst-readonly-badge">read only</span>
      </div>
      <div className="xp-well overflow-x-auto">
        <table className="xp-listview">
          <thead>
            <tr>
              <th>Name</th>
              <th>Language</th>
              <th>Cards</th>
              <th>Due</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>French phrases</b></td>
              <td>French</td>
              <td>42</td>
              <td>8</td>
              <td className="xp-muted">reading</td>
            </tr>
            <tr>
              <td><b>Spanish connectors</b></td>
              <td>Spanish</td>
              <td>27</td>
              <td>3</td>
              <td className="xp-muted">notes</td>
            </tr>
            <tr>
              <td><b>Verbs in context</b></td>
              <td>French</td>
              <td>64</td>
              <td>12</td>
              <td className="xp-muted">texts</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="qnst-deck-summary">
        <div><b>133</b><span>sample cards</span></div>
        <div><b>23</b><span>due today</span></div>
        <div><b>2</b><span>languages</span></div>
      </div>
    </div>
  );
}

function WikiPreview() {
  return (
    <div className="qnst-view">
      <div className="qnst-view-heading">
        <div>
          <b>Reference</b>
          <span className="xp-muted"> French verb</span>
        </div>
        <span className="qnst-readonly-badge">sample entry</span>
      </div>
      <div className="qnst-wiki-grid">
        <fieldset className="xp-group">
          <legend>Word</legend>
          <p className="qnst-wiki-word" lang="fr">retrouver</p>
          <p><span className="xp-muted">verb · </span>to find again, meet again</p>
          <p className="xp-muted qnst-note">
            Built from re- + trouver. Often appears when returning to a person,
            place, or idea.
          </p>
        </fieldset>
        <fieldset className="xp-group">
          <legend>Présent</legend>
          <dl className="qnst-conjugations" lang="fr">
            <div><dt>je</dt><dd>retrouve</dd></div>
            <div><dt>tu</dt><dd>retrouves</dd></div>
            <div><dt>il / elle</dt><dd>retrouve</dd></div>
            <div><dt>nous</dt><dd>retrouvons</dd></div>
            <div><dt>vous</dt><dd>retrouvez</dd></div>
            <div><dt>ils / elles</dt><dd>retrouvent</dd></div>
          </dl>
        </fieldset>
      </div>
    </div>
  );
}

export function QuenoseteolvideShowcase({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [section, setSection] = useState<DemoSection>("texts");
  const [selectedPhrase, setSelectedPhrase] =
    useState<PhraseId>("en-revanche");

  const navItem = (item: (typeof sections)[number], child = false) => {
    const className = `${child ? "xp-tree-item is-child" : "xp-tree-item"} ${
      section === item.id ? "is-active" : ""
    }`;

    if (compact) {
      return (
        <span key={item.id} className={className}>
          {!child && <span className="xp-tree-glyph">·</span>}
          {item.label}
        </span>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={className}
        onClick={() => setSection(item.id)}
      >
        {!child && <span className="xp-tree-glyph">·</span>}
        {item.label}
      </button>
    );
  };

  return (
    <div
      data-section="language"
      className={`xp-app qnst-showcase ${compact ? "is-compact" : ""}`}
    >
      <div className="xp-desktop">
        <div className="xp-window qnst-window">
          <div className="xp-titlebar">
            <span className="xp-title-text">Qué no se te olvide — Preview</span>
            <span className="xp-caption-btn" aria-hidden>–</span>
            <span className="xp-caption-btn" aria-hidden>□</span>
            {compact ? (
              <span className="xp-caption-btn is-close" aria-hidden>×</span>
            ) : (
              <Link
                href="/"
                className="xp-caption-btn is-close"
                aria-label="Close preview and return to the portfolio"
              >
                ×
              </Link>
            )}
          </div>

          <div className="xp-menubar qnst-menubar">
            <span className="xp-menubar-item">File</span>
            <span className="xp-menubar-item">Study</span>
            <span className="xp-menubar-item">View</span>
            <span className="xp-menubar-item">Help</span>
            <span className="qnst-preview-pill">Preview mode · sample data</span>
          </div>

          <div className="xp-mobile-nav">
            {sections.map((item) =>
              compact ? (
                <span
                  key={item.id}
                  className={`xp-tab ${section === item.id ? "is-active" : ""}`}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={`xp-tab ${section === item.id ? "is-active" : ""}`}
                  onClick={() => setSection(item.id)}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>

          <div className="xp-body">
            <div className="xp-tree-panel xp-well">
              <nav className="xp-tree" aria-label="Preview sections">
                <p className="qnst-tree-label">Workspace</p>
                {sections.map((item) => navItem(item))}
                <p className="qnst-tree-label">Languages</p>
                <span className="xp-tree-item is-child">Français</span>
                <span className="xp-tree-item is-child">Español</span>
              </nav>
            </div>

            <main className="xp-main">
              {section === "texts" && (
                <TextPreview
                  compact={compact}
                  selected={selectedPhrase}
                  onSelect={setSelectedPhrase}
                />
              )}
              {section === "study" && <StudyPreview />}
              {section === "decks" && <DecksPreview />}
              {section === "wiki" && <WikiPreview />}
            </main>
          </div>

          <div className="xp-statusbar">
            <span className="xp-status-cell is-grow">Ready · view only</span>
            <span className="xp-status-cell">23 due · 16 new</span>
            <span className="xp-status-cell">3 decks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
