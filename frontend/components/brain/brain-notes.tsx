"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search as SearchIcon,
} from "lucide-react";

import { getNote, getTree, reindex, search, type TreeNode } from "@/lib/api/brain";
import { NoteReader } from "@/components/brain/note-reader";

function collectFiles(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    if (n.path) out.push(n);
    if (n.children.length) collectFiles(n.children, out);
  }
  return out;
}

function TreeView({
  nodes,
  selected,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  return (
    <ul>
      {nodes.map((n) =>
        n.path ? (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path!)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-muted/40 ${
                selected === n.path ? "bg-brand/10 text-brand" : ""
              }`}
            >
              <FileText className="size-3.5 shrink-0 opacity-60" />
              <span className="truncate">{n.title || n.name}</span>
            </button>
          </li>
        ) : (
          <FolderRow
            key={`dir-${depth}-${n.name}`}
            node={n}
            depth={depth}
            selected={selected}
            onSelect={onSelect}
          />
        ),
      )}
    </ul>
  );
}

function FolderRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-sm text-muted-foreground hover:bg-muted/40"
      >
        <ChevronRight
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Folder className="size-3.5 shrink-0 opacity-60" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <TreeView nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
      )}
    </li>
  );
}

export function BrainNotes() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const treeQ = useQuery({ queryKey: ["brain", "tree"], queryFn: getTree });
  const noteQ = useQuery({
    queryKey: ["brain", "note", selected],
    queryFn: () => getNote(selected!),
    enabled: !!selected,
  });

  const files = useMemo(() => (treeQ.data ? collectFiles(treeQ.data) : []), [treeQ.data]);

  const resolve = useMemo(() => {
    const byPath = new Map<string, string>();
    const byNoExt = new Map<string, string>();
    const byStem = new Map<string, string>();
    for (const f of files) {
      const p = f.path!;
      byPath.set(p, p);
      byNoExt.set(p.replace(/\.md$/, ""), p);
      const stem = p.split("/").pop()!.replace(/\.md$/, "");
      if (!byStem.has(stem)) byStem.set(stem, p);
    }
    return (target: string): string | null =>
      byPath.get(target) ??
      byPath.get(`${target}.md`) ??
      byNoExt.get(target) ??
      byStem.get(target.split("/").pop()!) ??
      null;
  }, [files]);

  const reindexM = useMutation({
    mutationFn: () => reindex(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain", "tree"] }),
  });

  // Debounced search (react-query keyed on the debounced term — no race).
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);
  const searchQ = useQuery({
    queryKey: ["brain", "search", debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length > 0,
  });
  const showHits = debounced.length > 0;

  return (
    <div className="mx-auto grid h-[calc(100vh-3.5rem)] w-full max-w-[1200px] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar — hidden on mobile once a note is open (master-detail) */}
      <aside
        className={`${selected ? "hidden" : "flex"} flex-col overflow-hidden border-r md:flex`}
      >
        <div className="flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full rounded-md border bg-card py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <button
            type="button"
            onClick={() => reindexM.mutate()}
            title="Reindex vault from GitHub"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border hover:border-brand"
          >
            <RefreshCw className={`size-3.5 ${reindexM.isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {treeQ.isLoading ? (
            <p className="p-2 text-xs text-muted-foreground">Loading…</p>
          ) : showHits ? (
            <ul className="space-y-1">
              {(searchQ.data ?? []).length === 0 && !searchQ.isFetching && (
                <li className="p-2 text-xs text-muted-foreground">No matches.</li>
              )}
              {(searchQ.data ?? []).map((h) => (
                <li key={h.path}>
                  <button
                    type="button"
                    onClick={() => setSelected(h.path)}
                    className="block w-full rounded-md p-2 text-left hover:bg-muted/40"
                  >
                    <span className="text-sm text-brand">{h.title}</span>
                    {h.snippet && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{h.snippet}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : files.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              Vault is empty.{" "}
              <button type="button" className="text-brand underline" onClick={() => reindexM.mutate()}>
                Reindex
              </button>{" "}
              to pull from GitHub.
            </div>
          ) : (
            <TreeView nodes={treeQ.data ?? []} selected={selected} onSelect={setSelected} />
          )}
        </nav>
        <Link
          href="/brain"
          className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground hover:text-brand"
        >
          <MessageSquare className="size-4" /> Back to chat
        </Link>
      </aside>

      {/* Reader */}
      <main className={`${selected ? "block" : "hidden"} overflow-y-auto px-5 py-6 md:block lg:px-8`}>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand md:hidden"
          >
            <ArrowLeft className="size-4" /> files
          </button>
        )}
        {noteQ.isLoading ? (
          <div className="flex justify-center pt-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : noteQ.data ? (
          <NoteReader note={noteQ.data} resolve={resolve} onOpen={setSelected} />
        ) : (
          <div className="mx-auto hidden max-w-md pt-24 text-center md:block">
            <h1 className="font-heading text-2xl font-semibold">Notes</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a note from the sidebar or search. Talk to the vault from the{" "}
              <Link href="/brain" className="text-brand underline">
                chat
              </Link>
              .
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
