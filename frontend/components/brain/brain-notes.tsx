"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  MessageSquare,
  PanelLeft,
  RefreshCw,
  Search as SearchIcon,
} from "lucide-react";

import { getNote, getTree, reindex, search, type TreeNode } from "@/lib/api/brain";
import { BrainDrawer } from "@/components/brain/brain-drawer";
import { NoteReader } from "@/components/brain/note-reader";

function collectFiles(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.path) out.push(node);
    if (node.children.length) collectFiles(node.children, out);
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
      {nodes.map((node) =>
        node.path ? (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onSelect(node.path!)}
              style={{ paddingLeft: `${depth * 12 + 10}px` }}
              className={`brain-tree-item ${selected === node.path ? "brain-tree-item-active" : ""}`}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{node.title || node.name}</span>
            </button>
          </li>
        ) : (
          <FolderRow key={`dir-${depth}-${node.name}`} node={node} depth={depth} selected={selected} onSelect={onSelect} />
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
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ paddingLeft: `${depth * 12 + 10}px` }} className="brain-tree-item text-[var(--term-dim)]">
        <ChevronRight className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
        <span className="truncate">{node.name}</span>
      </button>
      {open && <TreeView nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} />}
    </li>
  );
}

export function BrainNotes() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    for (const file of files) {
      const path = file.path!;
      byPath.set(path, path);
      byNoExt.set(path.replace(/\.md$/, ""), path);
      const stem = path.split("/").pop()!.replace(/\.md$/, "");
      if (!byStem.has(stem)) byStem.set(stem, path);
    }
    return (target: string): string | null =>
      byPath.get(target) ?? byPath.get(`${target}.md`) ?? byNoExt.get(target) ?? byStem.get(target.split("/").pop()!) ?? null;
  }, [files]);

  const reindexM = useMutation({
    mutationFn: () => reindex(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain", "tree"] }),
  });

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(timeout);
  }, [query]);
  const searchQ = useQuery({
    queryKey: ["brain", "search", debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length > 0,
  });
  const showHits = debounced.length > 0;

  function selectNote(path: string) {
    setSelected(path);
    setDrawerOpen(false);
  }

  return (
    <div className="brain-term brain-workspace">
      <BrainDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Note files">
        <div className="brain-drawer-panel flex h-full flex-col">
          <div className="border-b border-[var(--term-line)] px-4 py-3">
            <div className="mb-3 flex items-center justify-between"><span className="term-prompt text-xs">~/notes</span><button type="button" onClick={() => reindexM.mutate()} title="Reindex vault from GitHub" className="brain-icon-control"><RefreshCw className={`size-3.5 ${reindexM.isPending ? "animate-spin" : ""}`} /></button></div>
            <div className="brain-search-field">
              <SearchIcon className="pointer-events-none size-3.5" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes…" aria-label="Search notes" />
            </div>
          </div>
          <nav className="brain-term-scroll flex-1 overflow-y-auto p-2">
            {treeQ.isLoading ? (
              <p className="px-2 py-3 text-xs text-[var(--term-dim)]">Loading…</p>
            ) : showHits ? (
              <ul className="space-y-1">
                {(searchQ.data ?? []).length === 0 && !searchQ.isFetching && <li className="px-2 py-3 text-xs text-[var(--term-dim)]">No matches.</li>}
                {(searchQ.data ?? []).map((hit) => (
                  <li key={hit.path}><button type="button" onClick={() => selectNote(hit.path)} className="brain-search-hit"><span>{hit.title}</span>{hit.snippet && <small>{hit.snippet}</small>}</button></li>
                ))}
              </ul>
            ) : files.length === 0 ? (
              <div className="px-2 py-3 text-xs text-[var(--term-dim)]">Vault is empty. <button type="button" className="text-[var(--term-accent)] underline" onClick={() => reindexM.mutate()}>Reindex</button> to pull from GitHub.</div>
            ) : (
              <TreeView nodes={treeQ.data ?? []} selected={selected} onSelect={selectNote} />
            )}
          </nav>
          <Link href="/brain" className="flex items-center gap-2 border-t border-[var(--term-line)] px-4 py-3 text-sm text-[var(--term-dim)] hover:text-[var(--term-accent)]"><MessageSquare className="size-4" /> back to chat</Link>
        </div>
      </BrainDrawer>

      <section className="flex min-h-0 flex-1 flex-col">
        <header className="brain-workspace-header">
          <button type="button" onClick={() => setDrawerOpen(true)} className="brain-icon-control" aria-label="Open note files"><PanelLeft className="size-4" /></button>
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--term-dim)]">{selected ? `~/notes/${selected}` : "~/notes"}</span>
          <Link href="/brain" className="brain-control brain-control-small"><MessageSquare className="size-3.5" /> chat</Link>
        </header>

        <main className="brain-notes-reader brain-term-scroll min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
          {noteQ.isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="size-5 animate-spin text-[var(--term-dim)]" /></div>
          ) : noteQ.data ? (
            <div className="mx-auto max-w-3xl"><div className="mb-5 font-mono text-xs text-[var(--term-dim)]">~/notes/{noteQ.data.path}</div><NoteReader note={noteQ.data} resolve={resolve} onOpen={selectNote} /></div>
          ) : (
            <div className="mx-auto flex h-full max-w-md items-center justify-center text-center">
              <div className="brain-welcome"><div className="mb-4 flex items-center justify-center gap-2 text-xs text-[var(--term-dim)]"><span className="brain-status-dot" /> vault // ready</div><h1 className="font-mono text-lg text-[var(--term-fg)]">notes are standing by.</h1><p className="mt-2 text-sm text-[var(--term-dim)]">Open a file or search the vault to begin reading.</p><button type="button" onClick={() => setDrawerOpen(true)} className="brain-control mx-auto mt-6"><PanelLeft className="size-4" /> open files</button></div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
