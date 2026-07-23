"use client";

import { use, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import { CambioTable } from "@/components/cambio/table";
import { useRoom } from "@/components/cambio/use-room";
import { useSkin } from "@/components/cambio/use-skin";
import "@/components/cambio/xp.css";

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

  const { status, seat, view, room, error, events, snapDeadline, send, restart } =
    useRoom(roomId, token, name);

  const inviteUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <div data-section="cambio" className="cb-desktop">
      {name === null ? (
        <div className="cb-window" style={{ maxWidth: 380 }}>
          <div className="cb-titlebar">
            <span className="cb-title-text">Join Cambio — Room #{roomId}</span>
          </div>
          <form
            className="cb-dialog-body"
            style={{ display: "flex", gap: 8, padding: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              const clean = draft.trim();
              if (!clean) return;
              sessionStorage.setItem("cambio-name", clean);
              setSubmitted(clean);
            }}
          >
            <input
              className="cb-well"
              style={{ flex: 1, padding: "4px 6px", font: "inherit" }}
              placeholder="Your nickname"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={40}
              autoFocus
            />
            <button className="cb-btn" type="submit">
              Join table
            </button>
          </form>
        </div>
      ) : status === "playing" && view && room && seat != null ? (
        <CambioTable
          view={view}
          room={room}
          seat={seat}
          send={send}
          restart={restart}
          error={error}
          events={events}
          snapDeadline={snapDeadline}
          skin={skin}
        />
      ) : (
        <div className="cb-window" style={{ maxWidth: 460 }}>
          <div className="cb-titlebar">
            <span className="cb-title-text">Cambio — Room #{roomId}</span>
          </div>
          <div className="cb-dialog-body" style={{ padding: 16 }}>
            {status === "waiting" && (
              <>
                <p style={{ marginBottom: 8 }}>
                  Waiting for your opponent to join…
                </p>
                <p style={{ marginBottom: 4, fontWeight: 700 }}>Invite link:</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    readOnly
                    className="cb-well"
                    style={{ flex: 1, padding: "4px 6px", fontSize: 11 }}
                    value={inviteUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="cb-btn"
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
        </div>
      )}
    </div>
  );
}
