"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { listRecipes, type RecipeListItem } from "@/lib/api/recipes";
import { useLocale } from "@/lib/i18n/locale";
import { useMe } from "@/lib/hooks/use-me";
import { RecipeEditor } from "./recipe-editor";
import {
  Stars,
  cloudinaryResize,
  formatPostedDate,
  localizeListItem,
} from "./shared";

type SortKey = "newest" | "rating";

export function RecipeBox() {
  const { locale, t } = useLocale();
  const { me } = useMe();
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [creating, setCreating] = useState(false);

  const recipes = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });

  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const r of recipes.data ?? []) {
      for (const tag of r.tags) seen.add(tag);
    }
    return [...seen].sort();
  }, [recipes.data]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (recipes.data ?? []).filter((r) => {
      if (tab !== "all" && !r.tags.includes(tab)) return false;
      if (!needle) return true;
      const { title, description } = localizeListItem(r, locale);
      return (
        title.toLowerCase().includes(needle) ||
        description.toLowerCase().includes(needle) ||
        r.title.toLowerCase().includes(needle)
      );
    });
    return filtered.sort((a, b) =>
      sort === "rating"
        ? b.rating - a.rating || b.created_at.localeCompare(a.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
  }, [recipes.data, tab, search, sort, locale]);

  return (
    <div className="rb-bg">
      <div className={`rb-page${creating ? " is-narrow" : ""}`}>
        <header className="rb-masthead">
          <h1>
            <Link href="/recipes">
              colehenry@kitchen:~$<span className="rb-cursor" aria-hidden />
            </Link>
          </h1>
        </header>

        {creating ? (
          <div className="rb-article">
            <h2 className="rb-title">
              {t({ en: "New recipe", es: "Nueva receta" })}
            </h2>
            <RecipeEditor
              onCancel={() => setCreating(false)}
              onSaved={(recipe) => router.push(`/recipes/${recipe.slug}`)}
            />
          </div>
        ) : (
          <>
            <nav className="rb-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                className={`rb-btn${tab === "all" ? " is-active" : ""}`}
                onClick={() => setTab("all")}
              >
                {t({ en: "All", es: "Todas" })}
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  role="tab"
                  aria-selected={tab === tag}
                  className={`rb-btn${tab === tag ? " is-active" : ""}`}
                  onClick={() => setTab(tag)}
                >
                  {tag}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              {me && (
                <button
                  type="button"
                  className="rb-btn"
                  onClick={() => setCreating(true)}
                >
                  + {t({ en: "New recipe", es: "Nueva receta" })}
                </button>
              )}
            </nav>

            <div className="rb-columns">
              <main className="rb-main">
                {recipes.isLoading && (
                  <p className="rb-empty">
                    {t({ en: "Preheating…", es: "Precalentando…" })}
                  </p>
                )}
                {recipes.isError && (
                  <p className="rb-error">
                    {t({
                      en: "The kitchen is closed - couldn't load recipes. Refresh to try again.",
                      es: "La cocina está cerrada - no se pudieron cargar las recetas. Recarga para reintentar.",
                    })}
                  </p>
                )}
                {recipes.data && shown.length === 0 && (
                  <p className="rb-empty">
                    {t({
                      en: "Nothing posted here yet.",
                      es: "Aún no hay nada publicado aquí.",
                    })}
                  </p>
                )}
                {shown.map((recipe) => (
                  <PostRow key={recipe.id} recipe={recipe} />
                ))}
              </main>

              <aside className="rb-sidebar">
                <div className="rb-module">
                  <h2 className="rb-module-title">
                    {t({ en: "Search", es: "Buscar" })}
                  </h2>
                  <div className="rb-module-body">
                    <input
                      type="search"
                      className="rb-input"
                      style={{ width: "70%" }}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label={t({ en: "Search recipes", es: "Buscar recetas" })}
                    />{" "}
                    <button type="button" className="rb-btn">
                      {t({ en: "Go", es: "Ir" })}
                    </button>
                  </div>
                </div>

                <div className="rb-module">
                  <h2 className="rb-module-title">
                    {t({ en: "Sort by", es: "Ordenar por" })}
                  </h2>
                  <div className="rb-module-body">
                    <ul>
                      <li>
                        <button
                          type="button"
                          className="rb-link"
                          disabled={sort === "newest"}
                          onClick={() => setSort("newest")}
                        >
                          {t({ en: "Most recent", es: "Más recientes" })}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="rb-link"
                          disabled={sort === "rating"}
                          onClick={() => setSort("rating")}
                        >
                          {t({ en: "Highest rated", es: "Mejor puntuadas" })}
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="rb-module">
                  <h2 className="rb-module-title">
                    {t({ en: "Categories", es: "Categorías" })}
                  </h2>
                  <div className="rb-module-body">
                    <ul>
                      {tags.length === 0 && (
                        <li className="rb-note">
                          {t({ en: "none yet", es: "ninguna aún" })}
                        </li>
                      )}
                      {tags.map((tag) => (
                        <li key={tag}>
                          <button
                            type="button"
                            className="rb-link"
                            onClick={() => setTab(tag)}
                          >
                            {tag}
                          </button>{" "}
                          <span className="rb-note">
                            (
                            {
                              (recipes.data ?? []).filter((r) =>
                                r.tags.includes(tag),
                              ).length
                            }
                            )
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </aside>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

function PostRow({ recipe }: { recipe: RecipeListItem }) {
  const { locale, t } = useLocale();
  const { title, description } = localizeListItem(recipe, locale);
  const photo = recipe.photo_urls[0];

  return (
    <article className="rb-post">
      {photo && (
        <img
          src={cloudinaryResize(photo, 200)}
          alt=""
          className="rb-post-thumb"
          loading="lazy"
        />
      )}
      <h2 className="rb-post-title">
        <Link href={`/recipes/${recipe.slug}`}>{title}</Link>
      </h2>
      <p className="rb-post-meta">
        <Stars rating={recipe.rating} /> {recipe.rating}/5 ·{" "}
        {formatPostedDate(recipe.created_at, locale)}
        {recipe.tags.length > 0 && <> · {recipe.tags.join(", ")}</>}
      </p>
      {description && <p>{description}</p>}
      <p style={{ margin: 0 }}>
        <Link className="rb-link" href={`/recipes/${recipe.slug}`}>
          {t({ en: "Read the recipe »", es: "Leer la receta »" })}
        </Link>
      </p>
    </article>
  );
}
