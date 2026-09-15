"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCard,
  listDecks,
  wikiLookup,
  type LanguageCode,
} from "@/lib/api/language";
import { getDashboard } from "@/lib/api/learning";
import { Speak } from "./language-shared";
import { TutorDock } from "@/components/language/tutor/tutor-dock";
import { TutorProvider } from "@/components/language/tutor/tutor-provider";
import { StudyView } from "./study-view";
import { DecksView } from "./decks-view";
import { TextsView } from "./texts-view";
import { WikiView, type WikiQuery, type WikiTab } from "./wiki-view";
import { DashboardView } from "./dashboard-view";
import { PracticeView, type PracticeConfig } from "./practice-view";
import { VocabView } from "./vocab-view";
import { ReferenceView } from "./reference-view";
import { MasteryTestView } from "./mastery-test-view";
import "./xp.css";

type SectionId = "dashboard" | "study" | "practice" | "vocab" | "decks" | "texts" | "wiki" | "test";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "study", label: "Study" },
  { id: "practice", label: "Practice" },
  { id: "vocab", label: "Vocabulary" },
  { id: "decks", label: "Decks" },
  { id: "texts", label: "Texts" },
  { id: "wiki", label: "Wiki" },
];

const WIKI_CHILDREN: { tab: WikiTab; label: string }[] = [
  { tab: "conjugation", label: "Conjugations" },
  { tab: "pronunciation", label: "Pronunciation" },
  { tab: "references", label: "References" },
];

type StudyInit = {
  deckId?: number;
  verbSetId?: number;
  language?: LanguageCode;
  mode?: "mixed" | "review" | "learn";
  key: number;
};
type MenuId = "file" | "study" | "view" | "help";

// Title-bar greeting - a new phrase every load, click to hear it.
const TITLE_PHRASES: { text: string; language: LanguageCode }[] = [
  { text: "On y va !", language: "fr" },
  { text: "Petit à petit", language: "fr" },
  { text: "C'est parti !", language: "fr" },
  { text: "Allez, hop !", language: "fr" },
  { text: "Quoi de neuf ?", language: "fr" },
  { text: "Mieux vaut tard que jamais", language: "fr" },
  { text: "L'appétit vient en mangeant", language: "fr" },
  { text: "Ça roule ?", language: "fr" },
  { text: "Chapeau !", language: "fr" },
  { text: "Au boulot !", language: "fr" },
  { text: "Doucement mais sûrement", language: "fr" },
  { text: "N'importe quoi !", language: "fr" },
  { text: "¡Vamos!", language: "es" },
  { text: "Poco a poco", language: "es" },
  { text: "¡Qué padre!", language: "es" },
  { text: "Así es la vida", language: "es" },
  { text: "¡Ánimo!", language: "es" },
  { text: "Más vale tarde que nunca", language: "es" },
  { text: "El mundo es un pañuelo", language: "es" },
  { text: "¡Manos a la obra!", language: "es" },
  { text: "No hay mal que por bien no venga", language: "es" },
  { text: "¿Qué tal?", language: "es" },
];

/**
 * `readOnly` renders the public showcase: same app, live data, but every
 * mutation affordance is hidden and owner-only endpoints are never called.
 * The backend enforces this too (see /backend routers/language.py - the
 * `public` router) - this flag is UX, not security.
 */
export function LanguageApp({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  // The public showcase opens on Study; the owner lands on the Dashboard.
  const [section, setSection] = useState<SectionId>(readOnly ? "study" : "dashboard");
  const [wikiTab, setWikiTab] = useState<WikiTab>("search");
  const [refTarget, setRefTarget] = useState<string | null>(null);
  const [verbInfinitive, setVerbInfinitive] = useState<string | null>(null);
  const [practiceConfig, setPracticeConfig] = useState<PracticeConfig | null>(null);
  const [testSprint, setTestSprint] = useState<number>(1);
  const [dashboardSprint, setDashboardSprint] = useState<number | undefined>(undefined);
  const [wikiExpanded, setWikiExpanded] = useState(true);
  const [wikiQuery, setWikiQuery] = useState<WikiQuery | null>(null);
  const [studyInit, setStudyInit] = useState<StudyInit>({ key: 0 });
  // A running lesson keeps its place: full sheets open in a dialog over it instead of navigating away.
  const [runningActivity, setRunningActivity] = useState<string | null>(null);
  const [drawerRef, setDrawerRef] = useState<string | null>(null);
  const onRunningChange = useCallback((id: string | null) => setRunningActivity(id), []);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [wide, setWide] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [titlePhrase, setTitlePhrase] = useState<
    (typeof TITLE_PHRASES)[number] | null
  >(null);

  // Picked after mount (in a timeout) - random text can't be server-rendered
  // without a hydration mismatch.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setTitlePhrase(
        TITLE_PHRASES[Math.floor(Math.random() * TITLE_PHRASES.length)],
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Hovering the title phrase opens a popover (play / look up / add to deck),
  // same interaction as annotations in the texts reader.
  const queryClient = useQueryClient();
  const [phrasePoint, setPhrasePoint] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [phraseDeckId, setPhraseDeckId] = useState<number | "">("");
  const phraseTimer = useRef<number | null>(null);
  const cancelPhraseClose = () => {
    if (phraseTimer.current != null) {
      window.clearTimeout(phraseTimer.current);
      phraseTimer.current = null;
    }
  };
  const schedulePhraseClose = () => {
    cancelPhraseClose();
    phraseTimer.current = window.setTimeout(() => setPhrasePoint(null), 250);
  };

  // Same cache key shape as the wiki search page, so the lookup is shared.
  const phraseWord = titlePhrase?.text.trim().toLowerCase() ?? "";
  const phraseWiki = useQuery({
    queryKey: ["language", "wiki", titlePhrase?.language, phraseWord, "en"],
    queryFn: () => wikiLookup(titlePhrase!.language, titlePhrase!.text),
    enabled: titlePhrase != null && phrasePoint != null,
    staleTime: Infinity,
  });
  const phraseDefinition =
    phraseWiki.data?.entries[0]?.senses[0]?.definition ?? "";

  const addPhraseCard = useMutation({
    mutationFn: (deckId: number) => {
      if (!titlePhrase) throw new Error("No phrase");
      return createCard({
        deck_id: deckId,
        front: titlePhrase.text,
        back: phraseDefinition,
        tags: ["phrase"],
        enrich: true,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] }),
  });

  // Track state via the event so Esc (browser-handled) stays in sync.
  useEffect(() => {
    const onChange = () =>
      setFullscreen(
        document.fullscreenElement?.id === "quenoseteolvide-app",
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
        .getElementById("quenoseteolvide-app")
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

  // Active sprint + resources for the practice runner (owner only).
  const dashboardQuery = useQuery({
    queryKey: ["language", "dashboard", "active"],
    queryFn: () => getDashboard(),
    enabled: !readOnly,
  });
  const activeSprint = dashboardQuery.data?.state.active_sprint ?? 1;
  const resources = dashboardQuery.data?.sprint.resources ?? [];

  const go = (id: SectionId) => {
    setSection(id);
    setOpenMenu(null);
  };
  const goWiki = (tab: WikiTab) => {
    setWikiTab(tab);
    setSection("wiki");
    setOpenMenu(null);
  };
  const goStudy = (target: Omit<StudyInit, "key">) => {
    setStudyInit((prev) => ({ ...target, key: prev.key + 1 }));
    go("study");
  };
  const goPractice = (config: PracticeConfig | null) => {
    setPracticeConfig(config ? { ...config } : null);
    go("practice");
  };
  const goRef = (ref: string) => {
    setRefTarget(ref);
    goWiki("references");
  };
  // From inside a running lesson: same sheet, but as a dialog so the lesson stays mounted.
  const goRefFromPractice = (ref: string) => {
    if (section === "practice" && runningActivity) {
      setDrawerRef(ref);
      return;
    }
    goRef(ref);
  };
  const goConjugation = (infinitive?: string) => {
    if (infinitive) setVerbInfinitive(infinitive);
    goWiki("conjugation");
  };
  const goTest = (sprint: number) => {
    setTestSprint(sprint);
    go("test");
  };

  // Hash deep links: #dashboard · #practice · #practice/<activity> · #vocab · #ref/<sheet>/<section> · #wiki/<tab>
  useEffect(() => {
    if (readOnly) return;
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      const [head, ...rest] = hash.split("/");
      if (head === "practice" && rest[0]) {
        // an activity id in the hash relaunches (or resumes) it on reload
        setPracticeConfig((current) => (current?.activityId === rest[0] ? current : { activityId: rest[0] }));
        setSection("practice");
      } else if (head === "ref") {
        setRefTarget(rest.length ? `${rest[0]}${rest[1] ? `#${rest[1]}` : ""}` : null);
        setWikiTab("references");
        setSection("wiki");
      } else if (head === "wiki") {
        setWikiTab((rest[0] as WikiTab) || "search");
        if (rest[0] === "conjugation" && rest[1]) setVerbInfinitive(decodeURIComponent(rest[1]));
        setSection("wiki");
      } else if ((SECTIONS as { id: string }[]).some((sec) => sec.id === head)) {
        setSection(head as SectionId);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [readOnly]);
  useEffect(() => {
    if (readOnly || typeof window === "undefined") return;
    const next =
      section === "wiki"
        ? wikiTab === "references" && refTarget
          ? `ref/${refTarget.replace("#", "/")}`
          : `wiki/${wikiTab}`
        : section === "practice" && runningActivity
          ? `practice/${runningActivity}`
          : section;
    if (window.location.hash.replace(/^#/, "") !== next) {
      window.history.replaceState(null, "", `#${next}`);
    }
  }, [section, wikiTab, refTarget, readOnly, runningActivity]);

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
    <TutorProvider
      onOpenRef={readOnly ? undefined : goRefFromPractice}
      onOpenActivity={readOnly ? undefined : (id) => goPractice({ activityId: id })}
    >
    <div data-section="language" id="quenoseteolvide-app" className="xp-app">
      <div className="xp-desktop">
        <div className={`xp-window ${wide ? "is-wide" : "is-narrow"}`}>
          <div className="xp-titlebar">
            <span className="xp-title-text">
              Qué no se te olvide
              {titlePhrase && readOnly && <> - {titlePhrase.text}</>}
              {titlePhrase && !readOnly && (
                <>
                  {" - "}
                  <button
                    type="button"
                    className="xp-title-phrase"
                    title={`Look up in wiki (${titlePhrase.language.toUpperCase()})`}
                    onClick={() => {
                      setPhrasePoint(null);
                      setWikiQuery({
                        language: titlePhrase.language,
                        word: titlePhrase.text,
                      });
                      goWiki("search");
                    }}
                    onMouseEnter={(event) => {
                      cancelPhraseClose();
                      const box = event.currentTarget.getBoundingClientRect();
                      setPhrasePoint({
                        top: box.bottom,
                        left: box.left + box.width / 2,
                      });
                    }}
                    onMouseLeave={schedulePhraseClose}
                  >
                    {titlePhrase.text}
                  </button>
                </>
              )}
              {dueTotal > 0 ? ` - ${dueTotal} due` : ""}
            </span>
            {section === "dashboard" && !readOnly && (
              <span className="xp-title-sprints" aria-label="Dashboard sprint">
                {[1, 2, 3, 4].map((number) => (
                  <button
                    key={number}
                    type="button"
                    className={(dashboardSprint ?? activeSprint) === number ? "is-active" : ""}
                    onClick={() => setDashboardSprint(number)}
                  >
                    S{number}
                  </button>
                ))}
              </span>
            )}
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
                    {!readOnly && (
                      <>
                        {menuItem("New card…", () => go("decks"))}
                        {menuItem("New deck…", () => go("decks"))}
                        {menuItem("New text…", () => go("texts"))}
                        <hr className="xp-menu-sep" />
                      </>
                    )}
                    {menuItem("Exit", () => router.push("/"))}
                  </>,
                )}
                {menu(
                  "study",
                  "Study",
                  <>
                    {menuItem("Review due", () => goStudy({}), {
                      hint: `${dueTotal} due`,
                    })}
                    {menuItem("French only", () => goStudy({ language: "fr" }))}
                    {menuItem("Spanish only", () => goStudy({ language: "es" }))}
                    {!readOnly && (
                      <>
                        <hr className="xp-menu-sep" />
                        {menuItem("Dashboard", () => go("dashboard"), { hint: `sprint ${activeSprint}` })}
                        {menuItem("Generate drill…", () => goPractice(null))}
                        {menuItem("Mastery test…", () => goTest(activeSprint))}
                        {menuItem("Interference log", () => goRef("interference"))}
                      </>
                    )}
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
                    {menuItem("About Qué no se te olvide…", () => {
                      setAboutOpen(true);
                      setOpenMenu(null);
                    })}
                  </>,
                )}
                {readOnly && (
                  <span className="qnst-preview-pill">
                    Read-only preview · live data
                  </span>
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
                {SECTIONS.filter(({ id }) => !readOnly || !["dashboard", "practice", "vocab"].includes(id)).map(({ id, label }) => (
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
                    {SECTIONS.filter(({ id }) => !readOnly || !["dashboard", "practice", "vocab"].includes(id)).map(({ id, label }) => (
                      <div key={id}>
                        <button
                          type="button"
                          className={`xp-tree-item ${
                            section === id &&
                            (id !== "wiki" || wikiTab === "search")
                              ? "is-active"
                              : ""
                          }`}
                          onClick={() =>
                            id === "wiki"
                              ? (goWiki("search"), setWikiExpanded(true))
                              : go(id)
                          }
                        >
                          {id === "wiki" ? (
                            <span
                              className="xp-tree-glyph"
                              onClick={(event) => {
                                event.stopPropagation();
                                setWikiExpanded((open) => !open);
                              }}
                            >
                              {wikiExpanded ? "−" : "+"}
                            </span>
                          ) : (
                            <span className="xp-tree-glyph">·</span>
                          )}
                          {label}
                        </button>
                        {id === "wiki" &&
                          wikiExpanded &&
                          WIKI_CHILDREN.filter(({ tab }) => !readOnly || tab !== "references").map(({ tab, label: childLabel }) => (
                            <button
                              key={tab}
                              type="button"
                              className={`xp-tree-item is-child ${
                                section === "wiki" && wikiTab === tab
                                  ? "is-active"
                                  : ""
                              }`}
                              onClick={() => goWiki(tab)}
                            >
                              {childLabel}
                            </button>
                          ))}
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
                      {section === "dashboard" && !readOnly && (
                        <DashboardView
                          viewSprint={dashboardSprint}
                          onPractice={(cfg) => goPractice(cfg.format === undefined && !cfg.activityId ? null : cfg)}
                          onStudy={() => goStudy({ language: "fr", mode: "review" })}
                          onTest={goTest}
                          onOpenRef={goRef}
                          onTexts={() => go("texts")}
                        />
                      )}
                      {section === "practice" && !readOnly && (
                        <PracticeView
                          key={JSON.stringify(practiceConfig)}
                          config={practiceConfig}
                          decks={decks}
                          activeSprint={activeSprint}
                          resources={resources}
                          onExit={() => go("dashboard")}
                          onOpenRef={goRefFromPractice}
                          onOpenTexts={() => go("texts")}
                          onStartTest={goTest}
                          onRunningChange={onRunningChange}
                        />
                      )}
                      {section === "vocab" && !readOnly && (
                        <VocabView
                          activeSprint={activeSprint}
                          onOpenRef={goRef}
                          onPractice={(targets, format) =>
                            goPractice({ format, targets, source: "deterministic", count: Math.min(20, Math.max(6, targets.length)), title: `Vocabulary · ${format}` })
                          }
                        />
                      )}
                      {section === "test" && !readOnly && (
                        <MasteryTestView sprint={testSprint} onExit={() => go("dashboard")} onOpenRef={goRef} />
                      )}
                      {section === "study" && (
                        <StudyView
                          key={studyInit.key}
                          decks={decks}
                          readOnly={readOnly}
                          initialLanguage={studyInit.language}
                          initialDeckId={studyInit.deckId ?? null}
                          initialVerbSetId={studyInit.verbSetId ?? null}
                          initialMode={studyInit.mode}
                        />
                      )}
                      {section === "decks" && (
                        <DecksView
                          decks={decks}
                          readOnly={readOnly}
                          onStudyDeck={(deckId) => goStudy({ deckId })}
                        />
                      )}
                      {section === "texts" && (
                        <TextsView
                          decks={decks}
                          readOnly={readOnly}
                          onOpenRef={readOnly ? undefined : goRef}
                          onDrillSentence={
                            readOnly
                              ? undefined
                              : (sentence) =>
                                  goPractice({
                                    format: "sentence_transform",
                                    source: "llm",
                                    count: 6,
                                    params: { extra: { base_sentence: sentence } },
                                    title: "Drill from text",
                                    fresh: true,
                                  })
                          }
                        />
                      )}
                      {section === "wiki" && wikiTab === "references" && !readOnly && (
                        <ReferenceView
                          target={refTarget}
                          onOpenVerb={(inf) => goConjugation(inf)}
                          onPractice={(format, targets) =>
                            goPractice({ format, targets, source: "deterministic", count: 10, title: `Drill · ${targets.join(", ") || format}` })
                          }
                        />
                      )}
                      {section === "wiki" && wikiTab !== "references" && (
                        <WikiView
                          decks={decks}
                          readOnly={readOnly}
                          initialTab={wikiTab}
                          initialQuery={wikiQuery}
                          initialInfinitive={verbInfinitive}
                          onTabChange={setWikiTab}
                          onStudyDeck={(deckId) => goStudy({ deckId })}
                          onStudyVerbSet={(verbSetId, language) =>
                            goStudy({ verbSetId, language })
                          }
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
                {!readOnly && dashboardQuery.data && (
                  <span className="xp-status-cell">
                    Sprint {activeSprint} · {Math.round(dashboardQuery.data.progress.readiness * 100)}%
                  </span>
                )}
                <span className="xp-status-cell">{decks.length} decks</span>
                <button
                  type="button"
                  className="xp-status-cell xp-grip"
                  title={fullscreen ? "Exit full screen" : "Full screen"}
                  onClick={toggleFullscreen}
                >
                  <span className="xp-grip-label">
                    {fullscreen ? "⤡ Exit full screen" : "⤢ Full screen"}
                  </span>
                  <span className="xp-grip-dots" aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* title-phrase popover - play, look up, or capture as a card */}
      {titlePhrase && phrasePoint && (
        <div
          className="xp-tooltip is-interactive"
          style={{
            top: phrasePoint.top,
            left: phrasePoint.left,
            transform: "translate(-50%, 6px)",
          }}
          onMouseEnter={cancelPhraseClose}
          onMouseLeave={schedulePhraseClose}
        >
          <div className="flex items-center gap-2">
            <Speak
              language={titlePhrase.language}
              text={titlePhrase.text}
              label="►"
            />
            <b>{titlePhrase.text}</b>
          </div>
          <div>
            {phraseWiki.isLoading ? (
              <span className="xp-muted">Looking up…</span>
            ) : (
              phraseDefinition && (
                <>
                  {phraseDefinition.length > 120
                    ? `${phraseDefinition.slice(0, 120)}…`
                    : phraseDefinition}{" "}
                </>
              )
            )}
            <button
              type="button"
              className="xp-link"
              onClick={() => {
                setPhrasePoint(null);
                setWikiQuery({
                  language: titlePhrase.language,
                  word: titlePhrase.text,
                });
                goWiki("search");
              }}
            >
              [wiki]
            </button>
          </div>
          {(() => {
            const compatible = decks.filter(
              (d) => d.language === titlePhrase.language && !d.is_system,
            );
            const deckId =
              phraseDeckId !== "" &&
              compatible.some((d) => d.id === phraseDeckId)
                ? phraseDeckId
                : (compatible[0]?.id ?? null);
            return (
              <div className="mt-1 flex items-center gap-2">
                <select
                  aria-label="Deck"
                  className="xp-select"
                  value={deckId ?? ""}
                  onChange={(event) =>
                    setPhraseDeckId(
                      event.target.value ? Number(event.target.value) : "",
                    )
                  }
                >
                  {compatible.length === 0 && (
                    <option value="">No matching deck</option>
                  )}
                  {compatible.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="xp-btn is-small"
                  disabled={!deckId || addPhraseCard.isPending}
                  onClick={() => deckId && addPhraseCard.mutate(deckId)}
                >
                  {addPhraseCard.isSuccess ? "Added ✓" : "Add card"}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {drawerRef && !readOnly && (
        <>
          <button type="button" aria-label="Back to lesson" className="xp-dialog-backdrop cursor-default" onClick={() => setDrawerRef(null)} />
          <div className="xp-dialog is-wide" role="dialog" aria-label="Reference">
            <div className="xp-titlebar">
              <span className="xp-title-text">Reference</span>
              <button type="button" className="xp-caption-btn is-close" aria-label="Back to lesson" onClick={() => setDrawerRef(null)}>
                ×
              </button>
            </div>
            <div className="xp-dialog-body">
              <ReferenceView
                embedded
                target={drawerRef}
                onOpenVerb={(inf) => { setDrawerRef(null); goConjugation(inf); }}
                onPractice={(format, targets) => {
                  setDrawerRef(null);
                  goPractice({ format, targets, source: "deterministic", count: 10, title: `Drill · ${targets.join(", ") || format}` });
                }}
              />
            </div>
            <div className="xp-dialog-buttons">
              <button type="button" className="xp-link" onClick={() => { const ref = drawerRef; setDrawerRef(null); goRef(ref); }}>
                [open in wiki]
              </button>
              <button type="button" className="xp-btn is-default" onClick={() => setDrawerRef(null)}>
                ← Back to lesson
              </button>
            </div>
          </div>
        </>
      )}

      {aboutOpen && (
        <>
          <button
            type="button"
            aria-label="Close dialog"
            className="xp-dialog-backdrop cursor-default"
            onClick={() => setAboutOpen(false)}
          />
          <div
            className="xp-dialog"
            role="dialog"
            aria-label="About Qué no se te olvide"
          >
            <div className="xp-titlebar">
              <span className="xp-title-text">About Qué no se te olvide</span>
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
              <p style={{ fontWeight: 700 }}>Qué no se te olvide</p>
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
      {!readOnly && <TutorDock />}
    </div>
    </TutorProvider>
  );
}
