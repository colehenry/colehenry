"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BrainDock } from "../brain-dock";
import {
  EVENTS,
  GROCERIES,
  INBOX,
  MEALS,
  MONTH_DAYS,
  MONTH_LABEL,
  MONTH_PAD,
  RECIPES,
  ROUTINE,
  TASKS,
  TODAY,
  WAITING,
  WEEK,
  dayOfMonth,
  eventsFor,
  mealFor,
  recipeFor,
  relativeDay,
  shortDate,
} from "../data";
import { TABS, counts, destination, parse, type Tab } from "./shared";
import "./base.css";
import "./paper.css";
import "./slate.css";
import "./ember.css";

/**
 * Studio — one structure, three input philosophies.
 *
 * Tabs: Today / Calendar / Kitchen / Open loops. "Open loops" absorbs waiting,
 * later and undated, which were previously spread over two thin tabs.
 *
 *   paper — every list ends with an inline "+ add" row, typed by context
 *   slate — one omnibar at the top; a parser routes it and previews where
 *   ember — the sidebar itself is writable; add to any section from any tab
 *
 * When one wins, delete the other two theme files and collapse the `variant`
 * branches; the structure is already shared.
 */

export type Variant = "paper" | "slate" | "ember";

type Added = { id: string; title: string; where: string };

export function Studio({ variant }: { variant: Variant }) {
  const [tab, setTab] = useState<Tab>("today");
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [selDay, setSelDay] = useState(TODAY);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROUTINE.filter((r) => r.done).map((r) => [r.id, true])),
  );
  const [got, setGot] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROCERIES.filter((g) => g.got).map((g) => [g.id, true])),
  );
  const [added, setAdded] = useState<Added[]>([]);
  const [omni, setOmni] = useState("");
  const [sideAdd, setSideAdd] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Each tab starts at the top. The old version inherited the previous tab's
  // scroll position, which made Calendar open halfway down.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const c = counts(got);
  const parsed = useMemo(() => parse(omni), [omni]);
  const where = destination(parsed);

  function push(title: string, dest: string) {
    if (!title.trim()) return;
    setAdded((p) => [
      { id: `n${Date.now()}`, title: title.trim(), where: dest },
      ...p,
    ]);
  }

  const badge: Record<Tab, number> = {
    today: c.today,
    calendar: c.calendar,
    kitchen: c.kitchen,
    loops: c.loops,
  };

  const todayEvents = eventsFor(TODAY);
  const useSoon = GROCERIES.filter(
    (g) => g.daysLeft !== undefined && g.pantry === "stocked" && !got[g.id],
  ).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  const restock = GROCERIES.filter(
    (g) => g.staple && (g.pantry === "out" || g.pantry === "low") && !got[g.id],
  );
  const byList = (l: string) =>
    GROCERIES.filter((g) => (g.list ?? "market") === l);

  return (
    <div data-studio={variant}>
      <div className="sd">
        <div className="sd__main">
          <div className="sd__top">
            <div className="sd__titlerow">
              <h1 className="sd__h">
                Sunday 26 July<span>week 31 · 2026</span>
              </h1>

              {variant === "slate" && (
                <form
                  className="om"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!parsed.title) return;
                    push(parsed.title, where);
                    setOmni("");
                  }}
                >
                  <span className="om__plus">+</span>
                  <input
                    className="om__input"
                    value={omni}
                    onChange={(e) => setOmni(e.target.value)}
                    placeholder="buy eggs · call mom friday · #cambio scoring…"
                    aria-label="Add anything"
                  />
                  {parsed.title && (
                    <span className="om__dest">
                      → {where}
                      <kbd>⏎</kbd>
                    </span>
                  )}
                </form>
              )}

              {variant === "paper" && (
                <p className="sd__cardmeta">
                  Every list has its own <strong>+ add</strong> at the bottom.
                </p>
              )}

              {variant === "ember" && (
                <p className="sd__cardmeta">
                  Add from the rail — every section there has a <strong>+</strong>.
                </p>
              )}
            </div>

            <div className="sd__tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className="sd__tab"
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                  <span className="sd__badge">{badge[t.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sd__body" ref={bodyRef}>
            {added.length > 0 && (
              <div className="sd__card" style={{ marginBottom: "1rem" }}>
                <div className="sd__cardhead">
                  <span className="sd__cardtitle">Just added</span>
                  <span className="sd__cardmeta">{added.length} this session</span>
                </div>
                {added.map((a) => (
                  <div key={a.id} className="sd__row">
                    <span className="sd__name">
                      {a.title}
                      <span className="sd__sub">{a.where}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "today" && (
              <div className="sd__split">
                <div className="sd__col">
                  <Card title="Routine" meta="today only">
                    {ROUTINE.map((r) => (
                      <Row
                        key={r.id}
                        on={!!done[r.id]}
                        onClick={() =>
                          setDone((p) => ({ ...p, [r.id]: !p[r.id] }))
                        }
                        name={r.title}
                        sub={r.cadence}
                      />
                    ))}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="add a routine…"
                        onAdd={(v) => push(v, "Routine · every day")}
                      />
                    )}
                  </Card>

                  <Card
                    title="Due"
                    meta="today or earlier"
                  >
                    {c.todayDue.map((t) => (
                      <Row
                        key={t.id}
                        name={t.title}
                        sub={t.tag}
                        meta={relativeDay(t.dueOn!)}
                      />
                    ))}
                    {c.todayDue.length === 0 && (
                      <p className="sd__empty">Nothing due.</p>
                    )}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="add something due today…"
                        onAdd={(v) => push(v, "Task · today")}
                      />
                    )}
                  </Card>
                </div>

                <div className="sd__col">
                  {/* The first Studio omitted this: a day with a 09:30
                      meeting on it showed no meeting on the Today tab. */}
                  <Card title="On the calendar" meta="mirrored from Google">
                    {todayEvents.map((e) => (
                      <Row key={e.id} name={e.title} sub={`${e.calendar} calendar`} meta={e.time ?? "all day"} />
                    ))}
                    {todayEvents.length === 0 && (
                      <p className="sd__empty">Nothing scheduled by anyone else.</p>
                    )}
                  </Card>

                  <Card title="Tonight" meta="from your recipes">
                    {(() => {
                      const m = mealFor(TODAY);
                      const r = recipeFor(m?.recipeSlug);
                      if (!m) return <p className="sd__empty">Nothing planned.</p>;
                      return (
                        <>
                          <Row
                            name={m.title}
                            sub={r ? r.ingredients.map((i) => i.name).join(", ") : m.kind}
                            meta={r ? `${r.minutes} min` : ""}
                          />
                          {useSoon.length > 0 && (
                            <Row
                              name={`Use soon — ${useSoon.map((g) => g.name).join(", ")}`}
                              meta={`${useSoon[0].daysLeft}d`}
                              tone="warm"
                            />
                          )}
                        </>
                      );
                    })()}
                  </Card>
                </div>
              </div>
            )}

            {tab === "calendar" && (
              <div className="sd__card">
                <div className="sd__calbar">
                  {(["week", "month"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="sd__calbtn"
                      aria-pressed={calView === v}
                      onClick={() => setCalView(v)}
                    >
                      {v === "week" ? "Week" : "Month"}
                    </button>
                  ))}
                  <span className="sd__calspacer">
                    {calView === "week" ? "26 Jul — 1 Aug" : MONTH_LABEL}
                  </span>
                </div>

                <div className="sd__dowrow">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="sd__dow">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="sd__grid7">
                  {calView === "month" &&
                    Array.from({ length: MONTH_PAD }).map((_, i) => (
                      <div key={`p${i}`} className="sd__cell" />
                    ))}
                  {(calView === "week"
                    ? WEEK.map((w) => w.date)
                    : Array.from({ length: MONTH_DAYS }, (_, i) => dayOfMonth(i + 1))
                  ).map((date) => {
                    const evs = eventsFor(date);
                    const ml = mealFor(date);
                    const tk = TASKS.filter((x) => x.dueOn === date);
                    return (
                      <button
                        key={date}
                        type="button"
                        className="sd__cell"
                        data-today={date === TODAY ? "true" : undefined}
                        data-sel={date === selDay && date !== TODAY ? "true" : undefined}
                        onClick={() => setSelDay(date)}
                      >
                        <span className="sd__cellnum">{Number(date.slice(-2))}</span>
                        {evs.map((e) => (
                          <span key={e.id} className="sd__cellitem" data-k="event">
                            {e.time ? `${e.time} ` : ""}
                            {e.title}
                          </span>
                        ))}
                        {ml && (
                          <span className="sd__cellitem" data-k="meal">
                            {ml.title}
                          </span>
                        )}
                        {tk.map((x) => (
                          <span key={x.id} className="sd__cellitem">
                            {x.title}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>

                {variant === "paper" && (
                  <AddRow
                    placeholder={`add to ${shortDate(selDay)}…`}
                    onAdd={(v) => push(v, `Task · ${shortDate(selDay)}`)}
                  />
                )}
              </div>
            )}

            {tab === "kitchen" && (
              <div className="sd__split">
                <div className="sd__col">
                  <Card title="Groceries" meta={`${c.toBuy.length} to get`}>
                    {restock.length > 0 && (
                      <>
                        <p className="sd__group">Ran out or running low</p>
                        {restock.map((g) => (
                          <Row
                            key={g.id}
                            on={!!got[g.id]}
                            onClick={() => setGot((p) => ({ ...p, [g.id]: !p[g.id] }))}
                            name={g.name}
                            sub={g.qtyNote}
                            meta={g.pantry === "out" ? "out" : "low"}
                            tone={g.pantry === "out" ? "alert" : "warm"}
                          />
                        ))}
                      </>
                    )}
                    {(["market", "costco", "hardware"] as const).map((list) => {
                      const rows = byList(list).filter((g) => !restock.includes(g));
                      if (!rows.length) return null;
                      return (
                        <div key={list}>
                          <p className="sd__group">{list}</p>
                          {rows.map((g) => (
                            <Row
                              key={g.id}
                              on={!!got[g.id]}
                              onClick={() => setGot((p) => ({ ...p, [g.id]: !p[g.id] }))}
                              name={g.name}
                              sub={g.forMeal ? `for ${g.forMeal}` : undefined}
                              meta={
                                g.daysLeft !== undefined
                                  ? `${g.daysLeft}d left`
                                  : (g.qtyNote ?? "")
                              }
                              tone={g.daysLeft !== undefined ? "warm" : undefined}
                            />
                          ))}
                        </div>
                      );
                    })}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="add to groceries…"
                        onAdd={(v) => push(v, "Groceries · market")}
                      />
                    )}
                  </Card>
                </div>

                <div className="sd__col">
                  <Card title="This week's meals" meta="7 nights">
                    {MEALS.filter((m) => m.day >= TODAY).map((m) => {
                      const r = recipeFor(m.recipeSlug);
                      const d = WEEK.find((w) => w.date === m.day);
                      return (
                        <Row
                          key={m.id}
                          name={m.title}
                          sub={r ? `${r.minutes} min · serves ${r.serves}` : m.kind}
                          meta={d?.weekdayShort}
                        />
                      );
                    })}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="plan a meal…"
                        onAdd={(v) => push(v, "Meals · this week")}
                      />
                    )}
                  </Card>

                  <Card title="Recipes" meta={`${RECIPES.length} saved`}>
                    {RECIPES.map((r) => (
                      <Row
                        key={r.slug}
                        name={r.title}
                        sub={`${r.ingredients.length} ingredients`}
                        meta={`${r.minutes} min`}
                      />
                    ))}
                  </Card>
                </div>
              </div>
            )}

            {tab === "loops" && (
              <div className="sd__split">
                <div className="sd__col">
                  <Card title="Waiting on someone" meta="days since you asked">
                    {WAITING.map((w) => (
                      <Row
                        key={w.id}
                        name={w.who}
                        sub={`${w.what}${w.replied ? " · reply arrived" : ""}`}
                        meta={`${w.days}d`}
                      />
                    ))}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="who are you waiting on?…"
                        onAdd={(v) => push(v, "Waiting on")}
                      />
                    )}
                  </Card>

                  <Card title="Later" meta={`${c.later.length} dated ahead`}>
                    {c.later.map((t) => (
                      <Row
                        key={t.id}
                        name={t.title}
                        sub={t.tag}
                        meta={shortDate(t.dueOn!)}
                      />
                    ))}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="add with a date…"
                        onAdd={(v) => push(v, "Task · dated")}
                      />
                    )}
                  </Card>
                </div>

                <div className="sd__col">
                  <Card title="Undated" meta={`${INBOX.length} held`}>
                    {INBOX.map((n) => (
                      <Row key={n.id} name={n.title} meta="no date" />
                    ))}
                    {variant === "paper" && (
                      <AddRow
                        placeholder="catch something…"
                        onAdd={(v) => push(v, "Undated")}
                      />
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="sd__side">
          <SideGroup
            label="Today"
            onJump={() => setTab("today")}
            variant={variant}
            open={sideAdd === "today"}
            onToggleAdd={() => setSideAdd(sideAdd === "today" ? null : "today")}
            onAdd={(v) => push(v, "Task · today")}
            rows={[
              ...ROUTINE.map((r) => ({
                text: r.title,
                meta: done[r.id] ? "done" : "",
                on: !!done[r.id],
              })),
              ...c.todayDue.map((t) => ({
                text: t.title,
                meta: relativeDay(t.dueOn!),
              })),
            ]}
          />
          <SideGroup
            label="Next up"
            onJump={() => setTab("calendar")}
            variant={variant}
            open={sideAdd === "cal"}
            onToggleAdd={() => setSideAdd(sideAdd === "cal" ? null : "cal")}
            onAdd={(v) => push(v, "Task · dated")}
            rows={EVENTS.filter((e) => e.day >= TODAY)
              .slice(0, 5)
              .map((e) => ({ text: e.title, meta: e.time ?? "all day" }))}
          />
          <SideGroup
            label="Groceries"
            onJump={() => setTab("kitchen")}
            variant={variant}
            open={sideAdd === "groc"}
            onToggleAdd={() => setSideAdd(sideAdd === "groc" ? null : "groc")}
            onAdd={(v) => push(v, "Groceries · market")}
            rows={c.toBuy.slice(0, 6).map((g) => ({
              text: g.name,
              meta: g.pantry === "out" ? "out" : (g.qtyNote ?? ""),
            }))}
            more={c.toBuy.length > 6 ? `+${c.toBuy.length - 6} more` : undefined}
          />
          <SideGroup
            label="Waiting"
            onJump={() => setTab("loops")}
            variant={variant}
            open={sideAdd === "wait"}
            onToggleAdd={() => setSideAdd(sideAdd === "wait" ? null : "wait")}
            onAdd={(v) => push(v, "Waiting on")}
            rows={WAITING.slice(0, 5).map((w) => ({
              text: w.who,
              meta: `${w.days}d`,
            }))}
            more={WAITING.length > 5 ? `+${WAITING.length - 5} more` : undefined}
          />
          <SideGroup
            label="Undated"
            onJump={() => setTab("loops")}
            variant={variant}
            open={sideAdd === "note"}
            onToggleAdd={() => setSideAdd(sideAdd === "note" ? null : "note")}
            onAdd={(v) => push(v, "Undated")}
            rows={INBOX.slice(0, 5).map((n) => ({ text: n.title, meta: "" }))}
            more={INBOX.length > 5 ? `+${INBOX.length - 5} more` : undefined}
          />
        </aside>
      </div>
      <BrainDock accent={variant} />
    </div>
  );
}

/* --- small pieces -------------------------------------------------------- */

function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sd__card">
      <div className="sd__cardhead">
        <span className="sd__cardtitle">{title}</span>
        {meta && <span className="sd__cardmeta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({
  name,
  sub,
  meta,
  tone,
  on,
  onClick,
}: {
  name: string;
  sub?: string;
  meta?: string;
  tone?: "alert" | "warm";
  on?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className="sd__row"
      data-on={on ? "true" : undefined}
      {...(onClick
        ? { type: "button" as const, onClick, "aria-pressed": !!on }
        : {})}
    >
      {onClick !== undefined && (
        <span className="sd__box">
          {on && (
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M1.5 5.2 4 7.6 8.6 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              />
            </svg>
          )}
        </span>
      )}
      <span className="sd__name">
        {name}
        {sub && <span className="sd__sub">{sub}</span>}
      </span>
      {meta && (
        <span className="sd__meta" data-t={tone}>
          {meta}
        </span>
      )}
    </Tag>
  );
}

function AddRow({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (v: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <form
      className="sd__addrow"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV("");
      }}
    >
      <span className="sd__addplus">+</span>
      <input
        className="sd__addinput"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </form>
  );
}

function SideGroup({
  label,
  onJump,
  rows,
  more,
  variant,
  open,
  onToggleAdd,
  onAdd,
}: {
  label: string;
  onJump: () => void;
  rows: { text: string; meta: string; on?: boolean }[];
  more?: string;
  variant: Variant;
  open: boolean;
  onToggleAdd: () => void;
  onAdd: (v: string) => void;
}) {
  return (
    <div className="sd__sgroup">
      <p className="sd__slabel">
        {label}
        <span className="sd__slabelbtns">
          {variant === "ember" && (
            <button
              type="button"
              className="sd__sjump"
              onClick={onToggleAdd}
              aria-label={`Add to ${label}`}
            >
              +
            </button>
          )}
          <button type="button" className="sd__sjump" onClick={onJump}>
            open
          </button>
        </span>
      </p>
      {variant === "ember" && open && (
        <AddRow placeholder={`add to ${label.toLowerCase()}…`} onAdd={onAdd} />
      )}
      {rows.map((r, i) => (
        <p key={i} className="sd__sitem" data-on={r.on ? "true" : undefined}>
          <b>{r.text}</b>
          {r.meta && <span className="sd__snum">{r.meta}</span>}
        </p>
      ))}
      {more && <p className="sd__smore">{more}</p>}
    </div>
  );
}
