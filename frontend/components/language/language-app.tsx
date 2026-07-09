"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { listDecks, type LanguageCode } from "@/lib/api/language";
import { StudyView } from "./study-view";
import { DecksView } from "./decks-view";
import { TextsView } from "./texts-view";
import { ReferenceView, type ReferenceTab } from "./reference-view";
import "./xp.css";

type SectionId = "study" | "decks" | "texts" | "reference";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "study", label: "Study" },
  { id: "decks", label: "Decks" },
  { id: "texts", label: "Texts" },
  { id: "reference", label: "Reference" },
];

type StudyInit = { deckId?: number; language?: LanguageCode; key: number };
type MenuId = "file" | "study" | "view" | "help";

export function LanguageApp() {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>("study");
  const [refTab, setRefTab] = useState<ReferenceTab>("pronunciation");
  const [refExpanded, setRefExpanded] = useState(true);
  const [studyInit, setStudyInit] = useState<StudyInit>({ key: 0 });
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [wide, setWide] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Track state via the event so Esc (browser-handled) stays in sync.
  useEffect(() => {
    const onChange = () =>
      setFullscreen(
        document.fullscreenElement?.id === "language-trainer-app",
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    setOpenMenu(null);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document
        .getElementById("language-trainer-app")
        ?.requestFullscreen()
        .catch(() => {});
    }
  };

  const decksQuery = useQuery({
    queryKey: ["language", "decks"],
    queryFn: listDecks,
  });
  const decks = decksQuery.data ?? [];
  const dueTotal = decks.reduce((sum, d) => sum + d.due_count, 0);
  const newTotal = decks.reduce((sum, d) => sum + d.new_count, 0);

  const go = (id: SectionId) => {
    setSection(id);
    setOpenMenu(null);
  };
  const goReference = (tab: ReferenceTab) => {
    setRefTab(tab);
    setSection("reference");
    setOpenMenu(null);
  };
  const goStudy = (target: Omit<StudyInit, "key">) => {
    setStudyInit((prev) => ({ ...target, key: prev.key + 1 }));
    go("study");
  };

  const menu = (id: MenuId, label: string, items: React.ReactNode) => (
    <div className="relative">
      <button
        type="button"
        className={`xp-menubar-item ${openMenu === id ? "is-open" : ""}`}
        onClick={() => setOpenMenu((cur) => (cur === id ? null : id))}
        onMouseEnter={() => openMenu && setOpenMenu(id)}
      >
        {label}
      </button>
      {openMenu === id && <div className="xp-menu-popup">{items}</div>}
    </div>
  );

  const menuItem = (
    label: string,
    onClick: () => void,
    opts: { hint?: string; checked?: boolean; disabled?: boolean } = {},
  ) => (
    <button
      type="button"
      className="xp-menu-item"
      disabled={opts.disabled}
      onClick={onClick}
    >
      <span>
        {opts.checked && <span className="xp-check">✓</span>}
        {label}
      </span>
      {opts.hint && <span className="xp-menu-hint">{opts.hint}</span>}
    </button>
  );

  return (
    <div data-section="language" id="language-trainer-app" className="xp-app">
      <div className="xp-desktop">
        <div className={`xp-window ${wide ? "is-wide" : ""}`}>
          <div className="xp-titlebar">
            <span className="xp-title-text">
              Language Trainer{dueTotal > 0 ? ` — ${dueTotal} due` : ""}
            </span>
            <button
              type="button"
              className="xp-caption-btn"
              aria-label={minimized ? "Restore window" : "Minimize window"}
              onClick={() => setMinimized((m) => !m)}
            >
              –
            </button>
            <button
              type="button"
              className="xp-caption-btn"
              aria-label={wide ? "Restore window size" : "Maximize window"}
              onClick={() => setWide((w) => !w)}
            >
              □
            </button>
            <button
              type="button"
              className="xp-caption-btn is-close"
              aria-label="Close (back to colehenry.dev)"
              onClick={() => router.push("/")}
            >
              ×
            </button>
          </div>

          {!minimized && (
            <>
              <div className="xp-menubar">
                {menu(
                  "file",
                  "File",
                  <>
                    {menuItem("New card…", () => go("decks"))}
                    {menuItem("New deck…", () => go("decks"))}
                    {menuItem("New text…", () => go("texts"))}
                    <hr className="xp-menu-sep" />
                    {menuItem("Exit", () => router.push("/"))}
                  </>,
                )}
                {menu(
                  "study",
                  "Study",
                  <>
                    {menuItem("Start session", () => goStudy({}), {
                      hint: `${dueTotal} due`,
                    })}
                    {menuItem("French only", () => goStudy({ language: "fr" }))}
                    {menuItem("Spanish only", () => goStudy({ language: "es" }))}
                  </>,
                )}
                {menu(
                  "view",
                  "View",
                  <>
                    {SECTIONS.map(({ id, label }) =>
                      menuItem(label, () => go(id), { checked: section === id }),
                    )}
                    <hr className="xp-menu-sep" />
                    {menuItem("Full screen", toggleFullscreen, {
                      checked: fullscreen,
                    })}
                  </>,
                )}
                {menu(
                  "help",
                  "Help",
                  <>
                    {menuItem("About Language Trainer…", () => {
                      setAboutOpen(true);
                      setOpenMenu(null);
                    })}
                  </>,
                )}
              </div>
              {openMenu && (
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-50 cursor-default"
                  onClick={() => setOpenMenu(null)}
                />
              )}

              <div className="xp-mobile-nav">
                {SECTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`xp-tab ${section === id ? "is-active" : ""}`}
                    onClick={() => go(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="xp-body">
                <div className="xp-tree-panel xp-well">
                  <nav className="xp-tree" aria-label="Sections">
                    {SECTIONS.map(({ id, label }) => (
                      <div key={id}>
                        <button
                          type="button"
                          className={`xp-tree-item ${
                            section === id ? "is-active" : ""
                          }`}
                          onClick={() =>
                            id === "reference"
                              ? (go("reference"), setRefExpanded(true))
                              : go(id)
                          }
                        >
                          {id === "reference" ? (
                            <span
                              className="xp-tree-glyph"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRefExpanded((open) => !open);
                              }}
                            >
                              {refExpanded ? "−" : "+"}
                            </span>
                          ) : (
                            <span className="xp-tree-glyph">·</span>
                          )}
                          {label}
                        </button>
                        {id === "reference" &&
                          refExpanded &&
                          (["pronunciation", "conjugation"] as const).map(
                            (tab) => (
                              <button
                                key={tab}
                                type="button"
                                className={`xp-tree-item is-child ${
                                  section === "reference" && refTab === tab
                                    ? "is-active"
                                    : ""
                                }`}
                                onClick={() => goReference(tab)}
                              >
                                {tab === "pronunciation"
                                  ? "Pronunciation"
                                  : "Conjugation"}
                              </button>
                            ),
                          )}
                      </div>
                    ))}
                  </nav>
                </div>

                <main className="xp-main">
                  {decksQuery.isLoading ? (
                    <p className="xp-muted p-3">Loading…</p>
                  ) : decksQuery.isError ? (
                    <div className="p-3">
                      <p>The language database could not be reached.</p>
                      <button
                        type="button"
                        className="xp-btn mt-3"
                        onClick={() => decksQuery.refetch()}
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {section === "study" && (
                        <StudyView
                          key={studyInit.key}
                          decks={decks}
                          initialLanguage={studyInit.language}
                          initialDeckId={studyInit.deckId ?? null}
                        />
                      )}
                      {section === "decks" && (
                        <DecksView
                          decks={decks}
                          onStudyDeck={(deckId) => goStudy({ deckId })}
                        />
                      )}
                      {section === "texts" && <TextsView decks={decks} />}
                      {section === "reference" && (
                        <ReferenceView
                          key={refTab}
                          decks={decks}
                          initialTab={refTab}
                          onTabChange={setRefTab}
                          onStudyDeck={(deckId) => goStudy({ deckId })}
                          onDrillsCreated={() => go("decks")}
                        />
                      )}
                    </>
                  )}
                </main>
              </div>

              <div className="xp-statusbar">
                <span className="xp-status-cell is-grow">
                  {decksQuery.isLoading
                    ? "Connecting…"
                    : decksQuery.isError
                      ? "Offline"
                      : "Ready"}
                </span>
                <span className="xp-status-cell">
                  {dueTotal} due · {newTotal} new
                </span>
                <span className="xp-status-cell">{decks.length} decks</span>
                <button
                  type="button"
                  className="xp-status-cell xp-grip"
                  title={fullscreen ? "Exit full screen" : "Full screen"}
                  aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                  onClick={toggleFullscreen}
                >
                  <span className="xp-grip-dots" aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {aboutOpen && (
        <>
          <button
            type="button"
            aria-label="Close dialog"
            className="xp-dialog-backdrop cursor-default"
            onClick={() => setAboutOpen(false)}
          />
          <div className="xp-dialog" role="dialog" aria-label="About Language Trainer">
            <div className="xp-titlebar">
              <span className="xp-title-text">About Language Trainer</span>
              <button
                type="button"
                className="xp-caption-btn is-close"
                aria-label="Close dialog"
                onClick={() => setAboutOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="xp-dialog-body">
              <p style={{ fontWeight: 700 }}>Language Trainer</p>
              <p className="xp-muted">Version 1.0 (Build 2006)</p>
              <p className="mt-3">
                Spaced-repetition flashcards, annotated texts, and French /
                Spanish reference tables.
              </p>
              <p className="xp-muted mt-3">© 2006 Cole Henry. All rights reserved.</p>
            </div>
            <div className="xp-dialog-buttons">
              <button
                type="button"
                className="xp-btn is-default"
                onClick={() => setAboutOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
