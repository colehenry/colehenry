"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  createCatanGame,
  getCatanGame,
  updateCatanGame,
  type CatanGame,
  type CatanGameIn,
  type CatanResultIn,
} from "@/lib/api/catan";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RowState = {
  player_name: string;
  victory_points: string;
  starting_pips: string;
  largest: boolean;
  longest: boolean;
  won: boolean;
};

const emptyRow = (): RowState => ({
  player_name: "",
  victory_points: "",
  starting_pips: "",
  largest: false,
  longest: false,
  won: false,
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function GameEditorDialog({
  open,
  editId,
  knownPlayers,
  knownLocations,
  onClose,
}: {
  open: boolean;
  /** null = create */
  editId: number | null;
  knownPlayers: string[];
  knownLocations: string[];
  onClose: () => void;
}) {
  const { data: existing } = useQuery({
    queryKey: ["catan", "game", editId],
    queryFn: () => getCatanGame(editId!),
    enabled: open && editId !== null,
  });

  const ready = editId === null || (existing && existing.id === editId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90svh] max-w-lg overflow-y-auto"
        data-section="catan"
      >
        <DialogHeader>
          <DialogTitle className="font-heading">
            {editId === null ? "Add game" : "Edit game"}
          </DialogTitle>
        </DialogHeader>
        {ready && (
          <EditorForm
            key={editId ?? "new"}
            editId={editId}
            existing={editId === null ? null : existing!}
            knownPlayers={knownPlayers}
            knownLocations={knownLocations}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted fresh per game (via key), so state initializes without effects. */
function EditorForm({
  editId,
  existing,
  knownPlayers,
  knownLocations,
  onClose,
}: {
  editId: number | null;
  existing: CatanGame | null;
  knownPlayers: string[];
  knownLocations: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [playedAt, setPlayedAt] = useState(existing?.played_at ?? today());
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [rows, setRows] = useState<RowState[]>(() =>
    existing
      ? existing.results.map((r) => ({
          player_name: r.player_name,
          victory_points: r.victory_points?.toString() ?? "",
          starting_pips: r.starting_pips?.toString() ?? "",
          largest: r.largest,
          longest: r.longest,
          won: r.won,
        }))
      : [emptyRow(), emptyRow()],
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: CatanGameIn) =>
      editId === null ? createCatanGame(body) : updateCatanGame(editId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catan"] });
      toast.success(editId === null ? "Game added" : "Game updated");
      onClose();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows((prev) =>
      prev.map((row, j) => {
        if (j !== i) return row;
        return { ...row, ...patch };
      }),
    );

  const submit = () => {
    const filled = rows.filter((r) => r.player_name.trim() !== "");
    if (filled.length < 2) return setError("A game needs at least 2 players.");
    const names = filled.map((r) => r.player_name.trim().toLowerCase());
    if (new Set(names).size !== names.length)
      return setError("A player is listed twice.");
    if (filled.filter((r) => r.won).length !== 1)
      return setError("Mark exactly one winner.");
    if (!playedAt) return setError("Date is required.");

    const results: CatanResultIn[] = filled.map((r) => ({
      player_name: r.player_name.trim(),
      victory_points:
        r.victory_points.trim() === "" ? null : Number(r.victory_points),
      starting_pips:
        r.starting_pips.trim() === "" ? null : Number(r.starting_pips),
      largest: r.largest,
      longest: r.longest,
      won: r.won,
    }));
    setError(null);
    save.mutate({
      played_at: playedAt,
      location: location.trim(),
      notes: notes.trim(),
      results,
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="catan-date">Date</Label>
          <Input
            id="catan-date"
            type="date"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="catan-location">Location</Label>
          <Input
            id="catan-location"
            list="catan-locations"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Redcliff"
          />
          <datalist id="catan-locations">
            {knownLocations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="catan-notes">Notes</Label>
        <Textarea
          id="catan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="anything worth remembering"
        />
      </div>

      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_3.5rem_3.5rem_2rem_2rem_2.5rem_1.5rem] items-center gap-1.5 px-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          <span>Player</span>
          <span className="text-center">VP</span>
          <span className="text-center">Pips</span>
          <span className="text-center" title="largest army">Army</span>
          <span className="text-center" title="longest road">Road</span>
          <span className="text-center">Won</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_3.5rem_3.5rem_2rem_2rem_2.5rem_1.5rem] items-center gap-1.5"
          >
            <Input
              list="catan-players"
              value={row.player_name}
              onChange={(e) => setRow(i, { player_name: e.target.value })}
              placeholder={`Player ${i + 1}`}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={row.victory_points}
              onChange={(e) => setRow(i, { victory_points: e.target.value })}
              className="h-8 px-1.5 text-center text-sm"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={row.starting_pips}
              onChange={(e) => setRow(i, { starting_pips: e.target.value })}
              className="h-8 px-1.5 text-center text-sm"
            />
            <input
              type="checkbox"
              checked={row.largest}
              onChange={(e) => setRow(i, { largest: e.target.checked })}
              className="mx-auto size-4 accent-[hsl(var(--accent))]"
              aria-label="largest army"
            />
            <input
              type="checkbox"
              checked={row.longest}
              onChange={(e) => setRow(i, { longest: e.target.checked })}
              className="mx-auto size-4 accent-[hsl(var(--accent))]"
              aria-label="longest road"
            />
            <input
              type="radio"
              name="catan-winner"
              checked={row.won}
              onChange={() =>
                setRows((prev) => prev.map((r, j) => ({ ...r, won: j === i })))
              }
              className="mx-auto size-4 accent-[hsl(var(--accent))]"
              aria-label="winner"
            />
            <button
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              disabled={rows.length <= 2}
              className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
              aria-label="remove player"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <datalist id="catan-players">
          {knownPlayers.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          <Plus className="size-3.5" />
          Add player
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={save.isPending}
          className="bg-brand text-brand-contrast hover:bg-brand/90"
        >
          {save.isPending ? "Saving…" : editId === null ? "Add game" : "Save"}
        </Button>
      </div>
    </>
  );
}
