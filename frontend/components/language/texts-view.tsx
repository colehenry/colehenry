"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCardFromAnnotation,
  createLanguageText,
  createTextAnnotation,
  deleteLanguageText,
  deleteTextAnnotation,
  getLanguageText,
  listLanguageTexts,
  lookupTextSelection,
  updateLanguageText,
  updateTextAnnotation,
  type Deck,
  type LanguageCode,
  type LanguageTextDetail,
  type TextAnnotation,
} from "@/lib/api/language";
import {
  genderLabel,
  languageName,
  shortDate,
  Speak,
  splitTags,
} from "./language-shared";

const EMPTY_TEXT_FORM = {
  title: "",
  language: "fr" as LanguageCode,
  source_type: "lyric",
  source_ref: "",
  tags: "",
  content: "",
};

type TextSelection = { start: number; end: number; selectedText: string };
type Point = { top: number; left: number };

type AnnotationDraft = {
  note: string;
  translation: string;
  ipa: string;
  gender: string;
  cognate_note: string;
  is_false_friend: boolean;
  headword: string;
  form_note: string;
};

function toDraft(a: TextAnnotation): AnnotationDraft {
  return {
    note: a.note,
    translation: a.translation,
    ipa: a.ipa,
    gender: a.gender,
    cognate_note: a.cognate_note,
    is_false_friend: a.is_false_friend,
    headword: a.headword,
    form_note: a.form_note,
  };
}

export function TextsView({
  decks,
  readOnly = false,
}: {
  decks: Deck[];
  readOnly?: boolean;
}) {
  const [openTextId, setOpenTextId] = useState<number | null>(null);

  if (openTextId == null) {
    return <Library readOnly={readOnly} onOpen={setOpenTextId} />;
  }
  return (
    <Reader
      key={openTextId}
      textId={openTextId}
      decks={decks}
      readOnly={readOnly}
      onBack={() => setOpenTextId(null)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Library — Explorer details view                                             */
/* -------------------------------------------------------------------------- */

function Library({
  readOnly,
  onOpen,
}: {
  readOnly: boolean;
  onOpen: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_TEXT_FORM);

  const texts = useQuery({
    queryKey: ["language", "texts"],
    queryFn: () => listLanguageTexts(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLanguageText({
        title: form.title,
        language: form.language,
        content: form.content,
        source_type: form.source_type,
        source_ref: form.source_ref,
        tags: splitTags(form.tags),
      }),
    onSuccess: (created) => {
      setForm(EMPTY_TEXT_FORM);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["language", "texts"] });
      onOpen(created.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLanguageText,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["language", "texts"] }),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 700 }}>Texts</span>
        {!readOnly && (
          <button
            type="button"
            className="xp-link"
            onClick={() => setCreating((open) => !open)}
          >
            {creating ? "[cancel]" : "[new text]"}
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (form.title.trim() && form.content.trim()) createMutation.mutate();
          }}
        >
          <fieldset className="xp-group flex flex-col gap-2">
            <legend>New text</legend>
            <TextFormFields form={form} setForm={setForm} />
            <div className="flex justify-end">
              <button
                className="xp-btn is-default"
                disabled={
                  createMutation.isPending ||
                  !form.title.trim() ||
                  !form.content.trim()
                }
              >
                Save &amp; open
              </button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="xp-well overflow-x-auto">
        <table className="xp-listview">
          <thead>
            <tr>
              <th>Name</th>
              <th>Language</th>
              <th>Type</th>
              <th>Notes</th>
              <th>Modified</th>
              <th style={{ width: 1 }} />
            </tr>
          </thead>
          <tbody>
            {texts.isLoading && (
              <tr>
                <td colSpan={6} className="xp-muted">
                  Loading texts…
                </td>
              </tr>
            )}
            {texts.data?.map((item) => (
              <tr
                key={item.id}
                className="is-clickable"
                onClick={() => onOpen(item.id)}
              >
                <td style={{ fontWeight: 700 }}>{item.title}</td>
                <td>{languageName(item.language)}</td>
                <td className="xp-muted">{item.source_type}</td>
                <td>{item.annotation_count}</td>
                <td className="xp-muted">{shortDate(item.updated_at)}</td>
                <td>
                  {!readOnly && (
                    <button
                      type="button"
                      className="xp-link"
                      disabled={deleteMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMutation.mutate(item.id);
                      }}
                    >
                      [delete]
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {texts.data?.length === 0 && !creating && (
              <tr>
                <td colSpan={6} className="xp-muted">
                  {readOnly
                    ? "No texts yet."
                    : "No texts. Use [new text] to paste lyrics, a poem, or an article."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TextFormFields({
  form,
  setForm,
}: {
  form: typeof EMPTY_TEXT_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_TEXT_FORM>>;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="xp-label" htmlFor="text-title">
            Title:
          </label>
          <input
            id="text-title"
            className="xp-input"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value }))
            }
          />
        </div>
        <div>
          <label className="xp-label" htmlFor="text-language">
            Language:
          </label>
          <select
            id="text-language"
            className="xp-select"
            value={form.language}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                language: event.target.value as LanguageCode,
              }))
            }
          >
            <option value="fr">French</option>
            <option value="es">Spanish</option>
          </select>
        </div>
        <div>
          <label className="xp-label" htmlFor="text-source">
            Type:
          </label>
          <select
            id="text-source"
            className="xp-select"
            value={form.source_type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, source_type: event.target.value }))
            }
          >
            <option value="lyric">Lyrics</option>
            <option value="poem">Poem</option>
            <option value="article">Article</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-48 flex-1">
          <label className="xp-label" htmlFor="text-ref">
            Source:
          </label>
          <input
            id="text-ref"
            className="xp-input"
            value={form.source_ref}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, source_ref: event.target.value }))
            }
          />
        </div>
        <div className="min-w-48 flex-1">
          <label className="xp-label" htmlFor="text-tags">
            Tags:
          </label>
          <input
            id="text-tags"
            className="xp-input"
            value={form.tags}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, tags: event.target.value }))
            }
          />
        </div>
      </div>
      <div>
        <label className="xp-label" htmlFor="text-content">
          Text:
        </label>
        <textarea
          id="text-content"
          className="xp-textarea"
          style={{ minHeight: 160 }}
          value={form.content}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, content: event.target.value }))
          }
        />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Reader — document well + XP tooltip + annotation dialog                     */
/* -------------------------------------------------------------------------- */

function Reader({
  textId,
  decks,
  readOnly,
  onBack,
}: {
  textId: number;
  decks: Deck[];
  readOnly: boolean;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const readerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_TEXT_FORM);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [selectionPoint, setSelectionPoint] = useState<Point | null>(null);
  // Hovering shows the popover; clicking pins it open (play + edit stay usable).
  const [popover, setPopover] = useState<{
    id: number;
    point: Point;
    pinned: boolean;
  } | null>(null);
  // Delay hover close so the cursor can travel into the popover.
  const hoverTimer = useRef<number | null>(null);
  const cancelHoverClose = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverTimer.current = window.setTimeout(
      () => setPopover((cur) => (cur?.pinned ? cur : null)),
      250,
    );
  };

  // A pinned popover closes on any click outside it (or its annotation).
  useEffect(() => {
    if (!popover?.pinned) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".xp-tooltip") || target?.closest(".xp-annotation")) {
        return;
      }
      setPopover(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popover?.pinned]);
  const [editId, setEditId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, AnnotationDraft>>({});
  const [cardDeckId, setCardDeckId] = useState<number | "">("");

  const detail = useQuery({
    queryKey: ["language", "text", textId],
    queryFn: () => getLanguageText(textId),
  });
  const text = detail.data ?? null;

  const editAnnotation = text?.annotations.find((a) => a.id === editId) ?? null;
  const draft = editAnnotation
    ? drafts[editAnnotation.id] ?? toDraft(editAnnotation)
    : null;
  const popoverAnnotation =
    (popover && text?.annotations.find((a) => a.id === popover.id)) || null;

  const annotationLookup = useQuery({
    queryKey: ["language", "text-lookup", textId, editAnnotation?.selected_text],
    queryFn: () =>
      lookupTextSelection(textId, editAnnotation?.selected_text as string),
    enabled: editAnnotation != null,
    staleTime: 60_000,
  });

  const selectionLookup = useQuery({
    queryKey: ["language", "text-lookup", textId, selection?.selectedText],
    queryFn: () =>
      lookupTextSelection(textId, selection?.selectedText as string),
    enabled: selection != null,
    staleTime: 60_000,
  });
  useEffect(() => {
    const found = annotationLookup.data;
    if (!editAnnotation || !found || !found.is_inflected) return;
    setDrafts((current) => {
      const base = current[editAnnotation.id] ?? toDraft(editAnnotation);
      const translationWasFormDescription =
        !base.translation || base.translation === found.form_note;
      return {
        ...current,
        [editAnnotation.id]: {
          ...base,
          headword: base.headword || found.headword,
          form_note: base.form_note || found.form_note,
          translation: translationWasFormDescription
            ? found.translation
            : base.translation,
        },
      };
    });
  }, [annotationLookup.data, editAnnotation]);

  const compatibleDecks = text
    ? decks.filter((d) => d.language === text.language && !d.is_system)
    : [];
  const deckId =
    cardDeckId !== "" && compatibleDecks.some((d) => d.id === cardDeckId)
      ? cardDeckId
      : compatibleDecks[0]?.id ?? null;
  const existingDeckIds = new Set(
    annotationLookup.data?.existing_cards.map((card) => card.deck_id) ?? [],
  );
  const selectedDeckHasCard = deckId != null && existingDeckIds.has(deckId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["language", "text", textId] });
    queryClient.invalidateQueries({ queryKey: ["language", "texts"] });
  };

  const patchDraft = (patch: Partial<AnnotationDraft>) => {
    if (!editAnnotation) return;
    setDrafts((current) => ({
      ...current,
      [editAnnotation.id]: {
        ...toDraft(editAnnotation),
        ...current[editAnnotation.id],
        ...patch,
      },
    }));
  };

  const clearDraft = (id: number) =>
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

  const saveTextMutation = useMutation({
    mutationFn: () =>
      updateLanguageText(textId, {
        title: editForm.title,
        content: editForm.content,
        source_type: editForm.source_type,
        source_ref: editForm.source_ref,
        tags: splitTags(editForm.tags),
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const deleteTextMutation = useMutation({
    mutationFn: () => deleteLanguageText(textId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["language", "texts"] });
      onBack();
    },
  });

  const createAnnotationMutation = useMutation({
    mutationFn: async () => {
      if (!text || !selection) throw new Error("No selection");
      const found = selectionLookup.data;
      return createTextAnnotation(text.id, {
        start_offset: selection.start,
        end_offset: selection.end,
        selected_text: selection.selectedText,
        translation: found?.translation ?? "",
        ipa: found?.ipa ?? "",
        gender: found?.gender ?? "",
        part_of_speech: found?.part_of_speech ?? "",
        cognate_note: found?.cognate_note ?? "",
        is_false_friend: found?.is_false_friend ?? false,
        headword: found?.headword ?? selection.selectedText,
        form_note: found?.form_note ?? "",
      });
    },
    onSuccess: (annotation) => {
      setSelection(null);
      setSelectionPoint(null);
      setEditId(annotation.id);
      invalidate();
    },
  });

  const saveAnnotationMutation = useMutation({
    mutationFn: () => {
      if (!editAnnotation || !draft) throw new Error("No annotation");
      return updateTextAnnotation(editAnnotation.id, draft);
    },
    onSuccess: (updated) => {
      clearDraft(updated.id);
      setEditId(null);
      invalidate();
    },
  });

  const lookupAnnotationMutation = useMutation({
    mutationFn: async () => {
      if (!text || !editAnnotation) throw new Error("No annotation");
      const found = await lookupTextSelection(
        text.id,
        editAnnotation.selected_text,
      );
      return updateTextAnnotation(editAnnotation.id, {
        translation: found.translation,
        ipa: found.ipa,
        gender: found.gender,
        part_of_speech: found.part_of_speech,
        cognate_note: found.cognate_note,
        is_false_friend: found.is_false_friend,
        headword: found.headword,
        form_note: found.form_note,
      });
    },
    onSuccess: (updated) => {
      clearDraft(updated.id);
      invalidate();
    },
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: deleteTextAnnotation,
    onSuccess: () => {
      setEditId(null);
      invalidate();
    },
  });

  const addCardMutation = useMutation({
    mutationFn: () => {
      if (!editAnnotation || !draft || !deckId) throw new Error("No deck");
      return createCardFromAnnotation(editAnnotation.id, {
        deck_id: deckId,
        front:
          draft.headword ||
          annotationLookup.data?.headword ||
          editAnnotation.selected_text,
        back: draft.translation || draft.note,
        card_type: "basic",
        direction: "recognition",
        tags: ["text"],
        enrich: true,
      });
    },
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["language", "decks"] });
    },
  });

  const captureSelection = () => {
    const root = readerRef.current;
    const sel = window.getSelection();
    if (!root || !text || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return;
    }
    const range = sel.getRangeAt(0);
    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      return;
    }
    // Offsets are measured inside each line span (the gutter play buttons
    // sit outside them, so they never pollute the character count).
    const lineSpanOf = (node: Node): HTMLElement | null => {
      const el = node instanceof Element ? node : node.parentElement;
      return el?.closest<HTMLElement>("[data-line-start]") ?? null;
    };
    const startSpan = lineSpanOf(range.startContainer);
    const endSpan = lineSpanOf(range.endContainer);
    if (!startSpan || !endSpan) return;
    const measure = (span: HTMLElement, container: Node, offset: number) => {
      const probe = document.createRange();
      probe.selectNodeContents(span);
      probe.setEnd(container, offset);
      return probe.toString().length;
    };
    const start =
      Number(startSpan.dataset.lineStart) +
      measure(startSpan, range.startContainer, range.startOffset);
    const end =
      Number(endSpan.dataset.lineStart) +
      measure(endSpan, range.endContainer, range.endOffset);
    const selectedText = text.content.slice(start, end);
    if (!selectedText.trim() || end <= start) return;
    const box = range.getBoundingClientRect();
    setSelection({ start, end, selectedText });
    setSelectionPoint({ top: box.top, left: box.left + box.width / 2 });
    setEditId(null);
    setPopover(null);
  };

  const startEditing = () => {
    if (!text) return;
    setEditForm({
      title: text.title,
      language: text.language,
      source_type: text.source_type,
      source_ref: text.source_ref,
      tags: text.tags.join(", "),
      content: text.content,
    });
    setEditing(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="xp-link" onClick={onBack}>
          « all texts
        </button>
        <span className="xp-muted">|</span>
        <span style={{ fontWeight: 700 }}>{text?.title ?? "…"}</span>
        {text && (
          <span className="xp-muted">
            {languageName(text.language)} · {text.source_type}
            {text.source_ref ? ` · ${text.source_ref}` : ""} ·{" "}
            {text.annotations.length} notes
          </span>
        )}
        {text && !editing && !readOnly && (
          <span className="ml-auto flex gap-2">
            <button type="button" className="xp-link" onClick={startEditing}>
              [edit]
            </button>
            <button
              type="button"
              className="xp-link"
              onClick={() => deleteTextMutation.mutate()}
            >
              [delete]
            </button>
          </span>
        )}
      </div>

      {detail.isLoading && (
        <div className="xp-well flex min-h-[380px] items-center justify-center">
          <span className="xp-muted">Loading…</span>
        </div>
      )}

      {text && editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (editForm.title.trim() && editForm.content.trim()) {
              saveTextMutation.mutate();
            }
          }}
        >
          <fieldset className="xp-group flex flex-col gap-2">
            <legend>Edit text</legend>
            <TextFormFields form={editForm} setForm={setEditForm} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="xp-btn"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button className="xp-btn is-default" disabled={saveTextMutation.isPending}>
                Save
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {text && !editing && (
        <>
          <div
            ref={readerRef}
            role="document"
            className="xp-well xp-doc"
            onMouseUp={readOnly ? undefined : captureSelection}
          >
            <AnnotatedText
              text={text}
              activeId={editId ?? (popover?.pinned ? popover.id : null)}
              onHover={(a, point) => {
                if (selection || popover?.pinned) return;
                cancelHoverClose();
                setPopover({ id: a.id, point, pinned: false });
              }}
              onLeave={scheduleHoverClose}
              onPin={(a, point) => {
                setSelection(null);
                setSelectionPoint(null);
                cancelHoverClose();
                setPopover({ id: a.id, point, pinned: true });
              }}
            />
          </div>
          {text.annotations.length === 0 && (
            <p className="xp-muted text-center">
              {readOnly
                ? "No notes on this text yet."
                : "Select a word or phrase to add a note."}
            </p>
          )}
        </>
      )}

      {/* annotation popover — hover to peek, click to pin */}
      {popoverAnnotation && popover && text && (
        <div
          className="xp-tooltip is-interactive"
          style={{
            top: popover.point.top,
            left: popover.point.left,
            transform: "translate(-50%, calc(-100% - 6px))",
          }}
          onMouseEnter={cancelHoverClose}
          onMouseLeave={() => {
            if (!popover.pinned) scheduleHoverClose();
          }}
        >
          <div className="flex items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                className="xp-link"
                onClick={() => {
                  setPopover(null);
                  setEditId(popoverAnnotation.id);
                }}
              >
                [edit]
              </button>
            )}
            <Speak
              language={text.language}
              text={popoverAnnotation.selected_text}
              label="►"
              title={`Listen: ${popoverAnnotation.selected_text}`}
            />
            <b>{popoverAnnotation.selected_text}</b>
          </div>
          {popoverAnnotation.translation && (
            <div>{popoverAnnotation.translation}</div>
          )}
          {(popoverAnnotation.ipa || popoverAnnotation.gender) && (
            <div>
              {popoverAnnotation.ipa && (
                <span className="xp-ipa">{popoverAnnotation.ipa}</span>
              )}
              {popoverAnnotation.ipa && popoverAnnotation.gender && " · "}
              {popoverAnnotation.gender &&
                genderLabel(popoverAnnotation.gender)}
            </div>
          )}
          {popoverAnnotation.cognate_note && (
            <div>ES: {popoverAnnotation.cognate_note}</div>
          )}
          {!popoverAnnotation.translation &&
            !popoverAnnotation.note &&
            !popoverAnnotation.cognate_note && <div>no note yet</div>}
        </div>
      )}

      {/* selection popup — auto-looked-up data + add-note action */}
      {selection && selectionPoint && text && (
        <div
          className="xp-tooltip is-interactive"
          style={{
            top: selectionPoint.top,
            left: selectionPoint.left,
            transform: "translate(-50%, calc(-100% - 6px))",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="xp-btn is-small"
              disabled={createAnnotationMutation.isPending}
              onClick={() => createAnnotationMutation.mutate()}
            >
              Add note
            </button>
            <Speak
              language={text.language}
              text={selection.selectedText}
              label="►"
              title={`Listen: ${selection.selectedText}`}
            />
            <b>{selection.selectedText}</b>
          </div>
          {selectionLookup.isFetching && (
            <div className="xp-muted">looking up…</div>
          )}
          {selectionLookup.data?.translation && (
            <div>{selectionLookup.data.translation}</div>
          )}
          {(selectionLookup.data?.ipa || selectionLookup.data?.gender) && (
            <div>
              {selectionLookup.data.ipa && (
                <span className="xp-ipa">{selectionLookup.data.ipa}</span>
              )}
              {selectionLookup.data.ipa && selectionLookup.data.gender && " · "}
              {selectionLookup.data.gender &&
                genderLabel(selectionLookup.data.gender)}
            </div>
          )}
          {selectionLookup.data?.cognate_note && (
            <div>ES: {selectionLookup.data.cognate_note}</div>
          )}
        </div>
      )}

      {/* annotation dialog */}
      {editAnnotation && draft && (
        <>
          <button
            type="button"
            aria-label="Close dialog"
            className="xp-dialog-backdrop cursor-default"
            onClick={() => setEditId(null)}
          />
          <div className="xp-dialog" role="dialog" aria-label="Annotation">
            <div className="xp-titlebar">
              <span className="xp-title-text">
                Annotation — {editAnnotation.selected_text}
              </span>
              <button
                type="button"
                className="xp-caption-btn is-close"
                aria-label="Close dialog"
                onClick={() => setEditId(null)}
              >
                ×
              </button>
            </div>
            <div className="xp-dialog-body flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <b>{editAnnotation.selected_text}</b>
                {text && (
                  <Speak
                    language={text.language}
                    text={editAnnotation.selected_text}
                  />
                )}
                {draft.gender && (
                  <span className="xp-muted">{genderLabel(draft.gender)}</span>
                )}
              </div>
              {(draft.headword || annotationLookup.data?.headword) && (
                <div>
                  <label className="xp-label" htmlFor="a-headword">
                    Card headword:
                  </label>
                  <input
                    id="a-headword"
                    className="xp-input"
                    value={draft.headword || annotationLookup.data?.headword || ""}
                    onChange={(event) =>
                      patchDraft({ headword: event.target.value })
                    }
                  />
                  {(draft.form_note || annotationLookup.data?.form_note) && (
                    <p className="xp-muted mt-1">
                      {draft.form_note || annotationLookup.data?.form_note}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="xp-label" htmlFor="a-translation">
                  Translation:
                </label>
                <textarea
                  id="a-translation"
                  className="xp-textarea"
                  style={{ minHeight: 48 }}
                  value={draft.translation}
                  onChange={(event) =>
                    patchDraft({ translation: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="xp-label" htmlFor="a-note">
                  Note:
                </label>
                <textarea
                  id="a-note"
                  className="xp-textarea"
                  style={{ minHeight: 48 }}
                  value={draft.note}
                  onChange={(event) => patchDraft({ note: event.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-32 flex-1">
                  <label className="xp-label" htmlFor="a-ipa">
                    IPA:
                  </label>
                  <input
                    id="a-ipa"
                    className="xp-input xp-ipa"
                    value={draft.ipa}
                    onChange={(event) => patchDraft({ ipa: event.target.value })}
                  />
                </div>
                <div>
                  <label className="xp-label" htmlFor="a-gender">
                    Gender:
                  </label>
                  <select
                    id="a-gender"
                    className="xp-select"
                    value={draft.gender}
                    onChange={(event) =>
                      patchDraft({ gender: event.target.value })
                    }
                  >
                    <option value="">—</option>
                    <option value="m">masculine</option>
                    <option value="f">feminine</option>
                  </select>
                </div>
                <label
                  className="flex items-center gap-2"
                  style={{ fontSize: "11px" }}
                >
                  <input
                    type="checkbox"
                    className="xp-checkbox"
                    checked={draft.is_false_friend}
                    onChange={(event) =>
                      patchDraft({ is_false_friend: event.target.checked })
                    }
                  />
                  Faux ami
                </label>
              </div>
              <div>
                <label className="xp-label" htmlFor="a-cognate">
                  Spanish note:
                </label>
                <textarea
                  id="a-cognate"
                  className="xp-textarea"
                  style={{ minHeight: 40 }}
                  value={draft.cognate_note}
                  onChange={(event) =>
                    patchDraft({ cognate_note: event.target.value })
                  }
                />
              </div>

              <fieldset className="xp-group">
                <legend>Flashcard</legend>
                {editAnnotation.flashcard_id ? (
                  <p className="xp-muted">
                    Card #{editAnnotation.flashcard_id} exists for this note.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Deck"
                      className="xp-select flex-1"
                      value={deckId ?? ""}
                      onChange={(event) =>
                        setCardDeckId(
                          event.target.value ? Number(event.target.value) : "",
                        )
                      }
                    >
                      {compatibleDecks.length === 0 && (
                        <option value="">No matching deck</option>
                      )}
                      {compatibleDecks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{existingDeckIds.has(d.id) ? " — already added" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="xp-btn is-small"
                      disabled={
                        !deckId || addCardMutation.isPending || selectedDeckHasCard
                      }
                      onClick={() => addCardMutation.mutate()}
                    >
                      {selectedDeckHasCard
                        ? "Already in deck"
                        : `Add ${draft.headword || annotationLookup.data?.headword || editAnnotation.selected_text}`}
                    </button>
                  </div>
                )}
              </fieldset>
            </div>
            <div className="xp-dialog-buttons">
              <button
                type="button"
                className="xp-link mr-auto"
                disabled={deleteAnnotationMutation.isPending}
                onClick={() => deleteAnnotationMutation.mutate(editAnnotation.id)}
              >
                [delete note]
              </button>
              <button
                type="button"
                className="xp-btn"
                disabled={lookupAnnotationMutation.isPending}
                onClick={() => lookupAnnotationMutation.mutate()}
              >
                Look up
              </button>
              <button
                type="button"
                className="xp-btn"
                onClick={() => setEditId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="xp-btn is-default"
                disabled={saveAnnotationMutation.isPending}
                onClick={() => saveAnnotationMutation.mutate()}
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

function AnnotatedText({
  text,
  activeId,
  onHover,
  onLeave,
  onPin,
}: {
  text: LanguageTextDetail;
  activeId: number | null;
  onHover: (annotation: TextAnnotation, point: Point) => void;
  onLeave: () => void;
  onPin: (annotation: TextAnnotation, point: Point) => void;
}) {
  const sorted = [...text.annotations].sort(
    (a, b) => a.start_offset - b.start_offset || a.end_offset - b.end_offset,
  );

  // One row per line: a play-the-line gutter button plus the annotated text.
  // Offsets live on the line span (data-line-start) so selection math in
  // captureSelection stays exact.
  const lines: { start: number; content: string }[] = [];
  let lineStart = 0;
  for (const line of text.content.split("\n")) {
    lines.push({ start: lineStart, content: line });
    lineStart += line.length + 1;
  }

  const midpoint = (el: Element): Point => {
    const box = el.getBoundingClientRect();
    return { top: box.top, left: box.left + box.width / 2 };
  };

  return (
    <>
      {lines.map(({ start, content }) => {
        const end = start + content.length;
        const nodes: React.ReactNode[] = [];
        let cursor = start;
        for (const annotation of sorted) {
          const segStart = Math.max(annotation.start_offset, start);
          const segEnd = Math.min(annotation.end_offset, end);
          if (segEnd <= segStart || segStart < cursor) continue;
          if (segStart > cursor) {
            nodes.push(text.content.slice(cursor, segStart));
          }
          nodes.push(
            <button
              key={`${annotation.id}-${segStart}`}
              type="button"
              className={`xp-annotation ${
                activeId === annotation.id ? "is-active" : ""
              }`}
              onMouseEnter={(event) =>
                onHover(annotation, midpoint(event.currentTarget))
              }
              onMouseLeave={onLeave}
              onClick={(event) =>
                onPin(annotation, midpoint(event.currentTarget))
              }
            >
              {text.content.slice(segStart, segEnd)}
            </button>,
          );
          cursor = segEnd;
        }
        if (cursor < end) {
          nodes.push(text.content.slice(cursor, end));
        }
        return (
          <div key={start} className="xp-doc-line">
            <span className="xp-line-gutter">
              {content.trim() && (
                <Speak
                  language={text.language}
                  text={content.trim()}
                  label="►"
                  title="Listen to this line"
                />
              )}
            </span>
            <span className="xp-line-text" data-line-start={start}>
              {nodes}
            </span>
          </div>
        );
      })}
    </>
  );
}
