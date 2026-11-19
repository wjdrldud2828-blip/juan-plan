import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Room = {
  code: string;
  step: string;
  idx: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reveals: Record<string, any>;
  deadline: string | null;
  submit_count: number;
};
export type Player = {
  id: string;
  nickname: string;
  pieces: number;
  is_bot: boolean;
  last_delta: number | null;
  delta_seq: number;
  joined_at: string;
};
export type Card = {
  id: string;
  ord: number;
  body: string;
  hidden: boolean;
  votes: number | null;
  rank: number | null;
  award: number | null;
  author_nickname: string | null;
};

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const hostKey = (code: string) => `jp_host_${code}`;
export const playerKey = (code: string) => `jp_player_${code}`;

/** 방 상태·참가자·심사 카드를 실시간으로 받아옵니다. */
export function useRoomData(code: string) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let alive = true;
    let connected = false;
    const loadRoom = async () => {
      const { data, error } = await db
        .from("rooms")
        .select("code,step,idx,data,reveals,deadline,submit_count")
        .eq("code", code)
        .maybeSingle();
      if (!alive) return;
      if (error) return; // 일시적 네트워크 오류: 다음 갱신에서 다시 시도
      setRoom(data ?? null);
    };
    const loadPlayers = async () => {
      const { data } = await db.from("players").select("*").eq("room_code", code).order("joined_at");
      if (alive && data) setPlayers(data);
    };
    const loadCards = async () => {
      const { data } = await db.from("g3_cards").select("*").eq("room_code", code).order("ord");
      if (alive && data) setCards(data);
    };
    loadRoom();
    loadPlayers();
    loadCards();
    const ch = supabase
      .channel(`room-${code}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, (p) => {
        if (p.eventType === "DELETE") setRoom(null);
        else setRoom(p.new as Room);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { room_code?: string };
        if (!row?.room_code || row.room_code === code) loadPlayers();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "g3_cards" }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { room_code?: string };
        if (!row?.room_code || row.room_code === code) loadCards();
      })
      .subscribe((status) => {
        if (!alive) return;
        connected = status === "SUBSCRIBED";
        setLive(connected);
        if (status === "SUBSCRIBED") {
          loadRoom();
          loadPlayers();
          loadCards();
        }
      });
    // 보조 갱신: 실시간 연결 중에는 15초마다, 끊겼을 때는 3초마다 다시 읽습니다.
    let tick = 0;
    const iv = setInterval(() => {
      tick += 1;
      if (!connected || tick % 5 === 0) {
        loadRoom();
        loadPlayers();
        loadCards();
      }
    }, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [code]);

  return { room, players, cards, live };
}

let clockOffset = 0;
let clockPromise: Promise<void> | null = null;
function syncClock() {
  if (!clockPromise) {
    clockPromise = (async () => {
      const t0 = Date.now();
      const now = await rpc<string>("server_now").catch(() => null);
      const t1 = Date.now();
      if (now) clockOffset = new Date(now).getTime() - (t0 + t1) / 2;
    })();
  }
  return clockPromise;
}

/** 서버 마감 시각까지 남은 초 (시간 제한이 없으면 null) */
export function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    syncClock().then(() => setNow(Date.now()));
    const iv = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, []);
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - (now + clockOffset);
  return Math.max(0, Math.ceil(ms / 1000));
}

export function useRanking(players: Player[]) {
  return useMemo(() => {
    const sorted = [...players].sort((a, b) => b.pieces - a.pieces || a.nickname.localeCompare(b.nickname));
    const ranks = new Map<string, number>();
    sorted.forEach((p, i) => {
      const prev = sorted[i - 1];
      ranks.set(p.id, prev && prev.pieces === p.pieces ? ranks.get(prev.id)! : i + 1);
    });
    return { sorted, ranks };
  }, [players]);
}
