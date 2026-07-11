"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteRecipe,
  getRecipe,
  retranslateRecipe,
  type Ingredient,
} from "@/lib/api/recipes";
import { useLocale } from "@/lib/i18n/locale";
import { useMe } from "@/lib/hooks/use-me";
import { RecipeEditor } from "./recipe-editor";
import {
  Stars,
  cloudinaryResize,
  formatAmount,
  formatPostedDate,
  ingredientEmoji,
  localizeRecipe,
  mealDbThumb,
  renderStepSegments,
  type UnitSystem,
} from "./shared";

const SCALES = [0.5, 1, 2] as const;
const SCALE_LABELS: Record<number, string> = { 0.5: "×½", 1: "×1", 2: "×2" };

export function RecipeCard({ slug }: { slug: string }) {
  const { locale, t } = useLocale();
  const { me } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scale, setScale] = useState<number>(1);
  const [units, setUnits] = useState<UnitSystem>("us");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);

  const recipe = useQuery({
    queryKey: ["recipes", slug],
    queryFn: () => getRecipe(slug),
  });

  const remove = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      router.push("/recipes");
    },
  });

  const retranslate = useMutation({
    mutationFn: retranslateRecipe,
    onSuccess: (fresh) => queryClient.setQueryData(["recipes", slug], fresh),
  });

  const view = useMemo(
    () => (recipe.data ? localizeRecipe(recipe.data, locale) : null),
    [recipe.data, locale],
  );

  const shell = (content: React.ReactNode, masthead?: React.ReactNode) => (
    <div className="rb-bg">
      <div className="rb-page is-narrow">
        {masthead ?? (
          <header className="rb-masthead">
            <h1>
              <Link href="/recipes">
                colehenry@kitchen:~$<span className="rb-cursor" aria-hidden />
              </Link>
            </h1>
          </header>
        )}
        {content}
      </div>
    </div>
  );

  if (recipe.isLoading) {
    return shell(
      <p className="rb-empty">{t({ en: "Preheating…", es: "Precalentando…" })}</p>,
    );
  }

  if (recipe.isError || !recipe.data || !view) {
    return shell(
      <div className="rb-article">
        <p className="rb-error">
          {t({
            en: "This recipe doesn't exist (or isn't public).",
            es: "Esta receta no existe (o no es pública).",
          })}
        </p>
        <p>
          <Link className="rb-link" href="/recipes">
            « {t({ en: "Back to all recipes", es: "Volver a todas las recetas" })}
          </Link>
        </p>
      </div>,
    );
  }

  const data = recipe.data;

  if (editing) {
    return shell(
      <div className="rb-article">
        <h2 className="rb-title">{t({ en: "Edit recipe", es: "Editar receta" })}</h2>
        <RecipeEditor
          recipe={data}
          onCancel={() => setEditing(false)}
          onSaved={(fresh) => {
            queryClient.setQueryData(["recipes", slug], fresh);
            queryClient.invalidateQueries({ queryKey: ["recipes"] });
            setEditing(false);
          }}
        />
      </div>,
    );
  }

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return shell(
    <>
      <p className="rb-breadcrumb rb-noprint">
        <Link className="rb-link" href="/">
          {t({ en: "Home", es: "Inicio" })}
        </Link>
        {" » "}
        <Link className="rb-link" href="/recipes">
          {t({ en: "Recipes", es: "Recetas" })}
        </Link>
        {" » "}
        {view.title}
      </p>

      <article className="rb-article">
        <h1 className="rb-title">{view.title}</h1>
        <p className="rb-byline">
          <strong>{data.rating}/5</strong> ·{" "}
          {t({ en: "posted", es: "publicado" })}{" "}
          {formatPostedDate(data.created_at, locale)}
          {data.tags.length > 0 && <> · {data.tags.join(", ")}</>}
        </p>

        {(view.pending || view.machine) && (
          <p className="rb-note">
            {view.pending
              ? t({
                  en: "The Spanish version is still in the oven — showing the original.",
                  es: "La versión en español sigue en el horno — se muestra el original.",
                })
              : t({ en: "machine-translated", es: "traducción automática" })}
            {view.pending && me && (
              <>
                {" "}
                <button
                  type="button"
                  className="rb-link"
                  disabled={retranslate.isPending}
                  onClick={() => retranslate.mutate(data.id)}
                >
                  {t({ en: "retry", es: "reintentar" })}
                </button>
              </>
            )}
          </p>
        )}

        {data.photo_urls[0] && (
          <figure className="rb-photo">
            <img src={cloudinaryResize(data.photo_urls[0], 700)} alt={view.title} />
            <figcaption>{view.title}</figcaption>
          </figure>
        )}

        {view.description && <p className="rb-description">{view.description}</p>}

        <p className="rb-post-meta">
          {data.servings !== null && (
            <>
              {t({ en: "makes", es: "rinde" })} {Math.round(data.servings * scale)}
              {" · "}
            </>
          )}
          {data.cook_minutes !== null && <>{data.cook_minutes} min · </>}
          <span className="rb-scaler rb-noprint">
            {t({ en: "scale:", es: "escala:" })}{" "}
            {SCALES.map((s) => (
              <button
                key={s}
                type="button"
                className={`rb-btn${scale === s ? " is-active" : ""}`}
                aria-pressed={scale === s}
                onClick={() => setScale(s)}
              >
                {SCALE_LABELS[s]}
              </button>
            ))}
          </span>{" "}
          <span className="rb-scaler rb-noprint">
            {t({ en: "units:", es: "unidades:" })}{" "}
            <button
              type="button"
              className={`rb-btn${units === "us" ? " is-active" : ""}`}
              aria-pressed={units === "us"}
              onClick={() => setUnits("us")}
            >
              {t({ en: "US", es: "EE. UU." })}
            </button>
            <button
              type="button"
              className={`rb-btn${units === "metric" ? " is-active" : ""}`}
              aria-pressed={units === "metric"}
              onClick={() => setUnits("metric")}
            >
              {t({ en: "metric", es: "métrico" })}
            </button>
          </span>
        </p>

        <h2 className="rb-heading">{t({ en: "Ingredients", es: "Ingredientes" })}</h2>
        <div className="rb-ingbox">
          <ul>
            {view.ingredients.map((ing, i) => (
              <IngredientRow
                key={ing.key}
                ingredient={ing}
                englishName={
                  data.language === "en"
                    ? data.ingredients[i].name
                    : data.translations.en?.ingredients[i]?.name ??
                      data.ingredients[i].name
                }
                scale={scale}
                units={units}
                checked={checked.has(ing.key)}
                onToggle={() => toggle(ing.key)}
              />
            ))}
          </ul>
        </div>

        <h2 className="rb-heading">{t({ en: "Directions", es: "Preparación" })}</h2>
        <ol className="rb-steps">
          {view.steps.map((step, i) => (
            <li key={i}>
              {renderStepSegments(step.text, view.ingredients, scale, units).map(
                (seg, j) =>
                  seg.ingredientKey ? (
                    <strong
                      key={j}
                      className={`rb-mention${
                        checked.has(seg.ingredientKey) ? " is-checked" : ""
                      }`}
                    >
                      {seg.text}
                    </strong>
                  ) : (
                    <span key={j}>{seg.text}</span>
                  ),
              )}
            </li>
          ))}
        </ol>

        {data.photo_urls.length > 1 && (
          <div className="rb-gallery">
            {data.photo_urls.slice(1).map((url) => (
              <img key={url} src={cloudinaryResize(url, 500)} alt={view.title} />
            ))}
          </div>
        )}

        <p className="rb-footline">
          {t({ en: "posted", es: "publicado" })}{" "}
          {formatPostedDate(data.created_at, locale)}
          {(data.source_name || data.source_url) && (
            <>
              {" · "}
              {t({ en: "source:", es: "fuente:" })}{" "}
              {data.source_url ? (
                <a href={data.source_url} target="_blank" rel="noreferrer">
                  {data.source_name || data.source_url}
                </a>
              ) : (
                data.source_name
              )}
            </>
          )}
        </p>
      </article>
    </>,
    <header key="masthead" className="rb-masthead">
      <span className="rb-masthead-title">{view.title}</span>
      <span className="rb-masthead-rating">
        <Stars rating={data.rating} /> {data.rating}/5
      </span>
      <span className="rb-masthead-actions rb-noprint">
        <button type="button" className="rb-btn" onClick={() => window.print()}>
          🖨 {t({ en: "Print", es: "Imprimir" })}
        </button>
        {me && (
          <>
            <button
              type="button"
              className="rb-btn"
              onClick={() => setEditing(true)}
            >
              ✏ {t({ en: "Edit", es: "Editar" })}
            </button>
            <button
              type="button"
              className="rb-btn is-danger"
              onClick={() => {
                if (
                  window.confirm(
                    t({
                      en: "Delete this recipe? This can't be undone.",
                      es: "¿Borrar esta receta? No se puede deshacer.",
                    }),
                  )
                ) {
                  remove.mutate(data.id);
                }
              }}
            >
              ✖ {t({ en: "Delete", es: "Borrar" })}
            </button>
          </>
        )}
      </span>
    </header>,
  );
}

function IngredientRow({
  ingredient,
  englishName,
  scale,
  units,
  checked,
  onToggle,
}: {
  ingredient: Ingredient;
  englishName: string;
  scale: number;
  units: UnitSystem;
  checked: boolean;
  onToggle: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <li>
      <label className={`rb-ing${checked ? " is-checked" : ""}`}>
        <input
          type="checkbox"
          className="rb-noprint"
          checked={checked}
          onChange={onToggle}
        />
        {imgFailed ? (
          <span className="rb-ing-emoji" aria-hidden>
            {ingredientEmoji(ingredient.name)}
          </span>
        ) : (
          <img
            src={mealDbThumb(englishName)}
            alt=""
            className="rb-ing-img"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}
        <span className="rb-ing-text">
          {formatAmount(ingredient, scale, units)}
          {ingredient.note && (
            <span className="rb-ing-note"> — {ingredient.note}</span>
          )}
        </span>
      </label>
    </li>
  );
}
