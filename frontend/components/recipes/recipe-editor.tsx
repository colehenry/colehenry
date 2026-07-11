"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  createRecipe,
  updateRecipe,
  uploadRecipePhoto,
  type Ingredient,
  type Recipe,
  type RecipeDraft,
} from "@/lib/api/recipes";
import { useLocale } from "@/lib/i18n/locale";
import { TOKEN_RE, formatQty } from "./shared";

/** Rows keep qty as the typed string ("2 1/4") and parse on save. */
type IngredientRow = {
  key: string;
  name: string;
  qtyText: string;
  unit: string;
  note: string;
};

/** "2 1/4" | "3/4" | "2.25" | "" → number | null; NaN = unparseable. */
function parseQty(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = Number(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : NaN;
}

function keyFromName(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 2)
      .join("-") || "ingredient";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  return key;
}

function toRows(ingredients: Ingredient[]): IngredientRow[] {
  return ingredients.map((ing) => ({
    key: ing.key,
    name: ing.name,
    qtyText:
      ing.qty === null
        ? ""
        : formatQty(ing.qty).replace(/([¼½¾⅓⅔⅛⅜⅝⅞])/, " $1"),
    unit: ing.unit,
    note: ing.note,
  }));
}

const VULGAR_TO_ASCII: Record<string, string> = {
  "⅛": "1/8",
  "¼": "1/4",
  "⅓": "1/3",
  "⅜": "3/8",
  "½": "1/2",
  "⅝": "5/8",
  "⅔": "2/3",
  "¾": "3/4",
  "⅞": "7/8",
};

function asciiQty(text: string): string {
  return text.replace(/[⅛¼⅓⅜½⅝⅔¾⅞]/g, (g) => VULGAR_TO_ASCII[g] ?? g).trim();
}

export function RecipeEditor({
  recipe,
  onCancel,
  onSaved,
}: {
  recipe?: Recipe;
  onCancel: () => void;
  onSaved: (recipe: Recipe) => void;
}) {
  const { t } = useLocale();

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [rating, setRating] = useState(recipe?.rating ?? 3.5);
  const [rows, setRows] = useState<IngredientRow[]>(
    recipe ? toRows(recipe.ingredients) : [],
  );
  const [steps, setSteps] = useState<string[]>(
    recipe ? recipe.steps.map((s) => s.text) : [""],
  );
  const [photos, setPhotos] = useState<string[]>(recipe?.photo_urls ?? []);
  const [tagsText, setTagsText] = useState(recipe?.tags.join(", ") ?? "");
  const [servings, setServings] = useState(recipe?.servings?.toString() ?? "");
  const [cookMinutes, setCookMinutes] = useState(
    recipe?.cook_minutes?.toString() ?? "",
  );
  const [sourceName, setSourceName] = useState(recipe?.source_name ?? "");
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [language, setLanguage] = useState<"en" | "es">(
    recipe?.language ?? "en",
  );
  const [visibility, setVisibility] = useState(recipe?.visibility ?? "public");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // { autocomplete state: which step textarea, what prefix.
  const [suggest, setSuggest] = useState<{
    step: number;
    prefix: string;
    active: number;
  } | null>(null);
  const stepRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const keys = useMemo(() => new Set(rows.map((r) => r.key)), [rows]);

  const unreferenced = useMemo(() => {
    const used = new Set(
      steps.flatMap((text) => [...text.matchAll(TOKEN_RE)].map((m) => m[1])),
    );
    return rows.filter((r) => r.key && r.name && !used.has(r.key));
  }, [rows, steps]);

  const unknownTokens = useMemo(() => {
    const bad = new Set<string>();
    for (const text of steps) {
      for (const m of text.matchAll(TOKEN_RE)) {
        if (!keys.has(m[1])) bad.add(m[1]);
      }
    }
    return [...bad];
  }, [steps, keys]);

  const save = useMutation({
    mutationFn: (draft: RecipeDraft) =>
      recipe ? updateRecipe(recipe.id, draft) : createRecipe(draft),
    onSuccess: onSaved,
    onError: (err) => setError(String(err)),
  });

  const suggestions = useMemo(() => {
    if (!suggest) return [];
    const needle = suggest.prefix.toLowerCase();
    return rows.filter(
      (r) =>
        r.key &&
        (r.key.startsWith(needle) || r.name.toLowerCase().includes(needle)),
    );
  }, [suggest, rows]);

  /* --- ingredient rows --- */

  const setRow = (i: number, patch: Partial<IngredientRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const commitKey = (i: number) => {
    // Derive the token key from the name once; later renames keep it stable
    // so steps that already reference it don't break.
    setRows((prev) =>
      prev.map((r, j) =>
        j === i && !r.key && r.name.trim()
          ? {
              ...r,
              key: keyFromName(
                r.name,
                new Set(prev.filter((_, k) => k !== i).map((p) => p.key)),
              ),
            }
          : r,
      ),
    );
  };

  /* --- step composer --- */

  const onStepChange = (i: number, value: string) => {
    setSteps((prev) => prev.map((s, j) => (j === i ? value : s)));
    const el = stepRefs.current[i];
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const open = before.lastIndexOf("{");
    if (open >= 0 && !before.slice(open).includes("}")) {
      setSuggest({ step: i, prefix: before.slice(open + 1), active: 0 });
    } else {
      setSuggest(null);
    }
  };

  const insertToken = (key: string) => {
    if (!suggest) return;
    const i = suggest.step;
    const el = stepRefs.current[i];
    const value = steps[i];
    const caret = el?.selectionStart ?? value.length;
    const open = value.slice(0, caret).lastIndexOf("{");
    const next = `${value.slice(0, open)}{${key}}${value.slice(caret)}`;
    setSteps((prev) => prev.map((s, j) => (j === i ? next : s)));
    setSuggest(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = open + key.length + 2;
      el?.setSelectionRange(pos, pos);
    });
  };

  const onStepKeyDown = (e: React.KeyboardEvent) => {
    if (!suggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setSuggest({
        ...suggest,
        active:
          (suggest.active + delta + suggestions.length) % suggestions.length,
      });
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertToken(suggestions[suggest.active].key);
    } else if (e.key === "Escape") {
      setSuggest(null);
    }
  };

  /* --- photos --- */

  const uploadFiles = async (files: Iterable<File>) => {
    setError("");
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadRecipePhoto(file);
        setPhotos((prev) => [...prev, url]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  /* --- save --- */

  const submit = () => {
    setError("");
    if (!title.trim()) {
      setError(
        t({ en: "The dish needs a name.", es: "El plato necesita un nombre." }),
      );
      return;
    }
    const ingredients: Ingredient[] = [];
    for (const row of rows) {
      if (!row.name.trim()) continue;
      const qty = parseQty(asciiQty(row.qtyText));
      if (Number.isNaN(qty)) {
        setError(
          t({
            en: `Can't read the amount for "${row.name}" — use numbers like 2, 0.75, or 2 1/4.`,
            es: `No se entiende la cantidad de "${row.name}" — usa números como 2, 0.75 o 2 1/4.`,
          }),
        );
        return;
      }
      ingredients.push({
        key: row.key || keyFromName(row.name, keys),
        name: row.name.trim(),
        qty,
        unit: row.unit.trim(),
        note: row.note.trim(),
      });
    }
    if (unknownTokens.length > 0) {
      setError(
        t({
          en: `Steps mention unknown ingredients: ${unknownTokens.join(", ")}`,
          es: `Los pasos mencionan ingredientes desconocidos: ${unknownTokens.join(", ")}`,
        }),
      );
      return;
    }
    save.mutate({
      title: title.trim(),
      description: description.trim(),
      rating,
      ingredients,
      steps: steps
        .filter((s) => s.trim())
        .map((text) => ({ text: text.trim() })),
      photo_urls: photos,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      servings: servings.trim() ? Number(servings) : null,
      cook_minutes: cookMinutes.trim() ? Number(cookMinutes) : null,
      source_name: sourceName.trim(),
      source_url: sourceUrl.trim(),
      language,
      visibility,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onPaste={(e) => {
        const files = [...e.clipboardData.files];
        if (files.length > 0) {
          e.preventDefault();
          void uploadFiles(files);
        }
      }}
    >
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-title">
          {t({ en: "Name of dish", es: "Nombre del plato" })}
        </label>
        <input
          id="recipe-title"
          className="rb-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-rating">
          {t({ en: "Rating / 5", es: "Puntuación / 5" })}
        </label>
        <input
          id="recipe-rating"
          type="number"
          className="rb-input"
          style={{ width: "72px" }}
          min={0}
          max={5}
          step={0.5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-desc">
          {t({ en: "Description", es: "Descripción" })}
        </label>
        <textarea
          id="recipe-desc"
          className="rb-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <h2 className="rb-heading">{t({ en: "Ingredients", es: "Ingredientes" })}</h2>
      {rows.map((row, i) => (
        <div key={i} className="rb-ing-row">
          <input
            className="rb-input"
            placeholder={t({ en: "qty", es: "cant" })}
            aria-label={t({ en: "Amount", es: "Cantidad" })}
            value={row.qtyText}
            onChange={(e) => setRow(i, { qtyText: e.target.value })}
          />
          <input
            className="rb-input"
            placeholder={t({ en: "unit", es: "unidad" })}
            aria-label={t({ en: "Unit", es: "Unidad" })}
            value={row.unit}
            onChange={(e) => setRow(i, { unit: e.target.value })}
          />
          <input
            className="rb-input is-wide"
            placeholder={t({ en: "ingredient", es: "ingrediente" })}
            aria-label={t({
              en: "Ingredient name",
              es: "Nombre del ingrediente",
            })}
            value={row.name}
            onChange={(e) => setRow(i, { name: e.target.value })}
            onBlur={() => commitKey(i)}
          />
          <input
            className="rb-input"
            placeholder={t({ en: "note", es: "nota" })}
            aria-label={t({ en: "Note", es: "Nota" })}
            value={row.note}
            onChange={(e) => setRow(i, { note: e.target.value })}
          />
          <button
            type="button"
            className="rb-link is-danger"
            aria-label={t({ en: "Remove ingredient", es: "Quitar ingrediente" })}
            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
          >
            ✖
          </button>
        </div>
      ))}
      <p style={{ margin: "4px 0 0" }}>
        <button
          type="button"
          className="rb-btn"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { key: "", name: "", qtyText: "", unit: "", note: "" },
            ])
          }
        >
          + {t({ en: "Add ingredient", es: "Añadir ingrediente" })}
        </button>
      </p>

      <h2 className="rb-heading">{t({ en: "Directions", es: "Preparación" })}</h2>
      <p className="rb-note">
        {t({
          en: "Type { in a step to mention an ingredient — it always renders with its amount.",
          es: "Escribe { en un paso para mencionar un ingrediente — siempre se muestra con su cantidad.",
        })}
      </p>
      {steps.map((step, i) => (
        <div key={i} className="rb-steprow" style={{ position: "relative" }}>
          <span className="rb-note">{i + 1}.</span>
          <textarea
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
            className="rb-textarea"
            aria-label={`${t({ en: "Step", es: "Paso" })} ${i + 1}`}
            value={step}
            onChange={(e) => onStepChange(i, e.target.value)}
            onKeyDown={onStepKeyDown}
            onBlur={() => setTimeout(() => setSuggest(null), 150)}
          />
          <button
            type="button"
            className="rb-link is-danger"
            aria-label={t({ en: "Remove step", es: "Quitar paso" })}
            onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
          >
            ✖
          </button>
          {suggest?.step === i && suggestions.length > 0 && (
            <div className="rb-suggest" style={{ top: "100%", left: "20px" }}>
              {suggestions.map((s, j) => (
                <button
                  key={s.key}
                  type="button"
                  className={j === suggest.active ? "is-active" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertToken(s.key);
                  }}
                >
                  {`{${s.key}}`} — {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <p style={{ margin: "4px 0 0" }}>
        <button
          type="button"
          className="rb-btn"
          onClick={() => setSteps((prev) => [...prev, ""])}
        >
          + {t({ en: "Add step", es: "Añadir paso" })}
        </button>
      </p>

      {unreferenced.length > 0 && (
        <p className="rb-warning">
          {t({
            en: "Never mentioned in a step:",
            es: "Nunca mencionados en un paso:",
          })}{" "}
          {unreferenced.map((r) => r.name).join(", ")}
        </p>
      )}

      <h2 className="rb-heading">{t({ en: "Photos", es: "Fotos" })}</h2>
      {photos.length > 0 && (
        <div>
          {photos.map((url) => (
            <span key={url} className="rb-photo-edit">
              <img src={url} alt="" />
              <button
                type="button"
                className="rb-link is-danger"
                aria-label={t({ en: "Remove photo", es: "Quitar foto" })}
                onClick={() =>
                  setPhotos((prev) => prev.filter((p) => p !== url))
                }
              >
                ✖
              </button>
            </span>
          ))}
        </div>
      )}
      <div
        className={`rb-uploadzone${dragOver ? " is-over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
      >
        {uploading
          ? t({ en: "uploading…", es: "subiendo…" })
          : t({
              en: "drop a photo here, click to browse, or paste one",
              es: "suelta una foto aquí, haz clic para buscar, o pega una",
            })}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <h2 className="rb-heading">{t({ en: "Details", es: "Detalles" })}</h2>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-tags">
          {t({ en: "Categories", es: "Categorías" })}
        </label>
        <input
          id="recipe-tags"
          className="rb-input"
          placeholder={t({ en: "dessert, bread…", es: "postre, pan…" })}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-servings">
          {t({ en: "Makes", es: "Rinde" })}
        </label>
        <input
          id="recipe-servings"
          type="number"
          min={1}
          className="rb-input"
          style={{ width: "72px" }}
          value={servings}
          onChange={(e) => setServings(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-minutes">
          {t({ en: "Minutes", es: "Minutos" })}
        </label>
        <input
          id="recipe-minutes"
          type="number"
          min={1}
          className="rb-input"
          style={{ width: "72px" }}
          value={cookMinutes}
          onChange={(e) => setCookMinutes(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-source">
          {t({ en: "Source", es: "Fuente" })}
        </label>
        <input
          id="recipe-source"
          className="rb-input"
          placeholder={t({ en: "grandma, a book…", es: "la abuela, un libro…" })}
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-source-url">
          {t({ en: "Source URL", es: "URL de la fuente" })}
        </label>
        <input
          id="recipe-source-url"
          className="rb-input"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-language">
          {t({ en: "Written in", es: "Escrita en" })}
        </label>
        <select
          id="recipe-language"
          className="rb-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as "en" | "es")}
        >
          <option value="en">English</option>
          <option value="es">español</option>
        </select>
      </div>
      <div className="rb-form-row">
        <label className="rb-form-label" htmlFor="recipe-visibility">
          {t({ en: "Visibility", es: "Visibilidad" })}
        </label>
        <select
          id="recipe-visibility"
          className="rb-select"
          value={visibility}
          onChange={(e) =>
            setVisibility(e.target.value as "public" | "private")
          }
        >
          <option value="public">{t({ en: "public", es: "pública" })}</option>
          <option value="private">{t({ en: "private", es: "privada" })}</option>
        </select>
      </div>

      {error && <p className="rb-error">{error}</p>}

      <p style={{ marginTop: "14px" }}>
        <button type="submit" className="rb-btn" disabled={save.isPending}>
          {save.isPending
            ? t({ en: "Saving…", es: "Guardando…" })
            : t({ en: "Save recipe", es: "Guardar receta" })}
        </button>{" "}
        <button type="button" className="rb-btn" onClick={onCancel}>
          {t({ en: "Cancel", es: "Cancelar" })}
        </button>
      </p>
    </form>
  );
}
