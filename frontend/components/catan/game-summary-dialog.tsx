"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteCatanGame, getCatanGame } from "@/lib/api/catan";
import { formatDay } from "@/components/catan/format";
import { PlayerMark } from "@/components/catan/player-mark";
import { ResourceIcon } from "@/components/catan/resource-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function GameSummaryDialog({
  gameId,
  isOwner,
  onClose,
  onEdit,
}: {
  gameId: number | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: game } = useQuery({
    queryKey: ["catan", "game", gameId],
    queryFn: () => getCatanGame(gameId!),
    enabled: gameId !== null,
  });

  const remove = useMutation({
    mutationFn: deleteCatanGame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catan"] });
      toast.success("Game deleted");
      onClose();
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  return (
    <Dialog
      open={gameId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmingDelete(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md" data-section="catan">
        {game && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <ResourceIcon name="crown" className="size-4 text-brand" />
                {game.winner} won
              </DialogTitle>
              <DialogDescription className="flex items-center gap-3 font-mono text-xs">
                {formatDay(game.played_at, true)}
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {game.location || "-"}
                </span>
              </DialogDescription>
            </DialogHeader>

            <ul className="divide-y divide-border/60 rounded-md border">
              {game.results.map((r) => (
                <li
                  key={r.player_id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 text-sm",
                    r.won && "bg-brand/5",
                  )}
                >
                  <PlayerMark name={r.player_name} className="size-4" />
                  <span className={cn("min-w-0 flex-1 truncate", r.won && "font-medium")}>
                    {r.player_name}
                  </span>
                  {r.longest && (
                    <ResourceIcon
                      name="road"
                      className="size-3.5 text-muted-foreground"
                      aria-label="longest road"
                    />
                  )}
                  {r.largest && (
                    <ResourceIcon
                      name="shield"
                      className="size-3.5 text-muted-foreground"
                      aria-label="largest army"
                    />
                  )}
                  {r.starting_pips !== null && (
                    <span
                      className="font-mono text-[10px] text-muted-foreground"
                      title="starting pips"
                    >
                      {r.starting_pips}p
                    </span>
                  )}
                  <span className="w-10 text-right font-mono text-xs font-medium">
                    {r.victory_points !== null ? `${r.victory_points} VP` : "-"}
                  </span>
                </li>
              ))}
            </ul>

            {game.notes && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {game.notes}
              </p>
            )}

            {isOwner && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(game.id)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant={confirmingDelete ? "destructive" : "outline"}
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() =>
                    confirmingDelete
                      ? remove.mutate(game.id)
                      : setConfirmingDelete(true)
                  }
                >
                  <Trash2 className="size-3.5" />
                  {confirmingDelete ? "Really delete?" : "Delete"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
