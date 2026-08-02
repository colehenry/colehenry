"use client";

import { use, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import { CambioTable } from "@/components/cambio/table";
import { SceneBackdrop } from "@/components/cambio/scene-backdrop";
import { useRoom } from "@/components/cambio/use-room";
import { useSkin } from "@/components/cambio/use-skin";
import { useScene } from "@/components/cambio/use-scene";
import "@/components/cambio/table.css";

/** The table (guest entry point). No OAuth: the room token in the URL gates
 * access, a nickname is the only identity a guest needs. */
export default function CambioRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const skin = useSkin();
  const scene = useScene();

  // Returning players (or the creator hopping back in) skip the gate:
  // hydration-safe sessionStorage read, no effect needed.
  const storedIdentity = useSyncExternalStore(
    () => () => {},
    () => {
      const stored = sessionStorage.getItem("cambio-name");
      const seatToken = sessionStorage.getItem(`cambio-seat-${roomId}`);
      return stored ?? (seatToken ? "" : null);
    },
    () => null,
  );
  const [submitted, setSubmitted] = useState<string | null>(null);
  const name = submitted ?? storedIdentity;
  const [draft, setDraft] = useState("");

  const { status, seat, view, room, error, events, send, restart } =
    useRoom(roomId, token, name);

  const inviteUrl =
    typeof window !== "undefined" ? window.location.href : "";

  if (status === "playing" && view && room && seat != null && name !== null) {
    return (
      <CambioTable
        view={view}
        room={room}
        seat={seat}
        send={send}
        restart={restart}
        error={error}
        events={events}
        skin={skin}
        scene={scene}
      />
    );
  }

  return (
    <div data-section="cambio" className={`cb-game cb-scene-${scene}`}>
      <SceneBackdrop scene={scene} />
      <div className="cb-gate">
        {name === null ? (
          <div className="cb-card">
            <h3>Join Cambio — Room #{roomId}</h3>
            <form
              style={{ display: "flex", gap: 8, marginTop: 4 }}
              onSubmit={(e) => {
                e.preventDefault();
                const clean = draft.trim();
                if (!clean) return;
                sessionStorage.setItem("cambio-name", clean);
                setSubmitted(clean);
              }}
            >
              <input
                className="cb-input"
                placeholder="Your nickname"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <button className="cb-primary" type="submit">
                Join
              </button>
            </form>
          </div>
        ) : (
          <div className="cb-card">
            <h3>Cambio — Room #{roomId}</h3>
            {status === "waiting" && (
              <>
                <p style={{ marginBottom: 10 }}>Waiting for your opponent to join…</p>
                <div className="cb-card-sub">Invite link</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    readOnly
                    className="cb-input"
                    value={inviteUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="cb-primary"
                    onClick={() => navigator.clipboard.writeText(inviteUrl)}
                  >
                    Copy
                  </button>
                </div>
              </>
            )}
            {status === "connecting" && <p>Connecting…</p>}
            {status === "full" && <p>This table is full.</p>}
            {status === "closed" && (
              <p>Room not found — it may have expired (rooms live 24h).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
