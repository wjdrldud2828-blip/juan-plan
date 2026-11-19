import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Delta, Pieces, Stars, Timer } from "@/components/game/bits";
import { GAME_INFO, TITLE } from "@/data/content";
import { playerKey, rpc, useCountdown, useRanking, useRoomData, type Card, type Player, type Room } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { RoomData } from "@/components/game/types";

type Me = { player_id: string; token: string };
type MyState = {
  bet: number | null;
  answer: number | null;
  g2: "A" | "B" | null;
  text: string | null;
  vote: string | null;
  my_card: string | null;
};

const NUM = ["①", "②", "③", "④"];

function loadMe(code: string): Me | null {
  try {
    const raw = localStorage.getItem(playerKey(code));
    return raw ? (JSON.parse(raw) as Me) : null;
  } catch {
    return null;
  }
}
function saveMe(code: string, me: Me | null) {
  try {
    if (me) localStorage.setItem(playerKey(code), JSON.stringify(me));
    else localStorage.removeItem(playerKey(code));
  } catch {
    /* 저장 불가 환경: 새로고침하면 다시 입장해야 함 */
  }
}

export function PlayerScreen({ code }: { code: string }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const { room, players, cards } = useRoomData(code);

  // 저장된 입장 정보 확인
  useEffect(() => {
    const saved = loadMe(code);
    if (!saved) {
      setMe(null);
      return;
    }
    rpc<{ id: string } | null>("whoami", { p_code: code, p_token: saved.token })
      .then((r) => {
        if (r?.id) setMe(saved);
        else {
          saveMe(code, null);
          setMe(null);
        }
      })
      .catch(() => setMe(saved));
  }, [code]);

  const mine = me ? players.find((p) => p.id === me.player_id) : undefined;

  // 진행자가 내보낸 경우: 목록에서 사라지면 입장 화면으로
  const seen = useRef(false);
  useEffect(() => {
    if (mine) seen.current = true;
    else if (seen.current && me && players.length > 0) {
      seen.current = false;
      saveMe(code, null);
      setMe(null);
      toast.message("진행자가 참가 목록에서 내보냈습니다. 다시 입장해 주세요.");
    }
  }, [mine, me, players.length, code]);

  if (room === undefined || me === undefined) return <Shell>불러오는 중…</Shell>;
  if (room === null)
    return (
      <Shell>
        <p className="font-display text-3xl text-gold">방 {code}을(를) 찾을 수 없어요</p>
        <p className="mt-2 text-muted-foreground">코드를 다시 확인해 주세요.</p>
        <a href="#/" className="mt-6 inline-block rounded-xl border-2 border-gold/50 px-6 py-3 font-display text-gold">
          코드 다시 입력
        </a>
      </Shell>
    );
  if (!me)
    return (
      <Join
        code={code}
        onJoined={(m) => {
          saveMe(code, m);
          setMe(m);
        }}
      />
    );

  return <Playing code={code} me={me} mine={mine} room={room} players={players} cards={cards} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">{children}</div>;
}

/* ───────── 입장 ───────── */
function Join({ code, onJoined }: { code: string; onJoined: (m: Me) => void }) {
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = nick.trim();
    if (!n) {
      toast.error("닉네임을 입력해 주세요");
      return;
    }
    setBusy(true);
    try {
      const r = await rpc<Me>("join_room", { p_code: code, p_nick: n });
      onJoined(r);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <div className="font-display text-5xl text-gold-gradient glow-gold">{TITLE}</div>
        <div className="mt-2 text-muted-foreground tabular">방 {code}</div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="nick" className="font-semibold text-muted-foreground">
          닉네임 (최대 10자)
        </label>
        <input
          id="nick"
          value={nick}
          maxLength={10}
          autoComplete="off"
          onChange={(e) => setNick(e.target.value)}
          placeholder="예: 주안불꽃"
          className="h-16 rounded-2xl border-2 border-border bg-card px-5 text-2xl font-bold outline-none focus:border-gold"
        />
        <button
          disabled={busy}
          className="h-16 rounded-2xl bg-gold-gradient font-display text-2xl text-primary-foreground shadow-gold active:scale-[0.98] disabled:opacity-50"
        >
          입장하기
        </button>
        <p className="text-center text-sm text-muted-foreground">닉네임 외에는 아무 정보도 받지 않습니다.</p>
      </form>
    </main>
  );
}

/* ───────── 게임 중 ───────── */
function Playing({
  code,
  me,
  mine,
  room,
  players,
  cards,
}: {
  code: string;
  me: Me;
  mine: Player | undefined;
  room: Room;
  players: Player[];
  cards: Card[];
}) {
  const [state, setState] = useState<MyState | null>(null);
  const sec = useCountdown(room.deadline);
  const locked = room.deadline !== null && sec === 0;
  const { ranks } = useRanking(players);

  const refresh = useCallback(async () => {
    try {
      const s = await rpc<MyState>("my_state", { p_code: code, p_token: me.token });
      setState(s);
    } catch {
      /* 무시 */
    }
  }, [code, me.token]);

  useEffect(() => {
    setState(null);
    refresh();
  }, [room.step, room.idx, refresh]);

  const submit = useCallback(
    async (kind: string, value: unknown) => {
      try {
        await rpc("player_submit", { p_code: code, p_token: me.token, p_kind: kind, p_value: value });
        await refresh();
        return true;
      } catch (e) {
        toast.error((e as Error).message);
        return false;
      }
    },
    [code, me.token, refresh],
  );

  // 피스 변동 알림
  const [flash, setFlash] = useState<{ n: number; k: number } | null>(null);
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (!mine) return undefined;
    const prev = lastSeq.current;
    lastSeq.current = mine.delta_seq;
    const n = mine.last_delta ?? 0;
    // 처음 불러올 때와 변동이 0일 때는 알리지 않음
    if (prev === null || prev === mine.delta_seq || n === 0) return undefined;
    setFlash({ n, k: mine.delta_seq });
    try {
      navigator.vibrate?.(n > 0 ? [80, 60, 80] : 250);
    } catch {
      /* 진동 미지원 */
    }
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [mine]);

  const pieces = mine?.pieces ?? 10;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-8">
      <header className="sticky top-0 z-10 -mx-5 flex items-center gap-3 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <span className="min-w-0 flex-1 truncate font-bold">{mine?.nickname ?? "…"}</span>
        {room.deadline && <Timer sec={sec} className="text-2xl" />}
        <Pieces n={pieces} className="text-2xl" />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-6">
        <Body room={room} state={state} pieces={pieces} locked={locked} submit={submit} cards={cards} me={me} mine={mine} ranks={ranks} total={players.length} />
      </main>

      {flash && (
        <div key={flash.k} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Delta n={flash.n} className="anim-pop text-7xl" />
        </div>
      )}
    </div>
  );
}

function Wait({ title, sub }: { title?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {title && <p className="text-balance font-display text-3xl">{title}</p>}
      <p className="text-lg text-muted-foreground">{sub ?? "진행자 화면을 봐주세요"}</p>
    </div>
  );
}

type BodyProps = {
  room: Room;
  state: MyState | null;
  pieces: number;
  locked: boolean;
  submit: (kind: string, value: unknown) => Promise<boolean>;
  cards: Card[];
  me: Me;
  mine: Player | undefined;
  ranks: Map<string, number>;
  total: number;
};

function Body(p: BodyProps) {
  const { room, state, locked, me, mine, ranks, total } = p;
  const s = room.step;
  const d = (room.data ?? {}) as RoomData;

  if (s === "lobby") return <Wait title="입장 완료!" sub="곧 게임이 시작됩니다. 진행자 화면을 봐주세요" />;
  if (s === "g1_intro") return <Rule g={GAME_INFO.g1} no={1} />;
  if (s === "g2_intro") return <Rule g={GAME_INFO.g2} no={2} />;
  if (s === "g3_intro") return <Rule g={GAME_INFO.g3} no={3} />;

  if (s === "g1_cat")
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-muted-foreground tabular">Q{d.n} / {d.total}</span>
        <span className="font-display text-6xl text-gold-gradient">{d.category}</span>
        <Stars n={d.difficulty ?? 1} className="text-4xl" />
        {d.label && <span className="font-display text-2xl text-loss">{d.label}</span>}
        <p className="text-lg text-muted-foreground">곧 베팅이 시작됩니다. 얼마를 걸지 생각해 두세요!</p>
      </div>
    );

  if (s === "g1_bet") return <Bet {...p} />;

  if (s === "g1_q")
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {d.category} · 내 베팅 <b className="text-gold tabular">{state?.bet ?? 0}</b> 피스
        </p>
        <p className="text-balance text-2xl font-bold leading-snug">{d.question}</p>
        <div className="flex flex-col gap-3">
          {d.choices?.map((c, i) => (
            <button
              key={i}
              disabled={locked}
              onClick={() => p.submit("answer", i)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-2xl border-2 px-5 py-3 text-left text-xl font-bold active:scale-[0.98] disabled:opacity-60",
                state?.answer === i ? "border-gold bg-gold/15 text-gold" : "border-border bg-card",
              )}
            >
              <span className="text-gold">{NUM[i]}</span>
              <span className="min-w-0 flex-1">{c}</span>
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {locked ? "마감되었습니다" : state?.answer != null ? "선택 완료 · 마감 전까지 바꿀 수 있어요" : "답을 고르세요"}
        </p>
      </div>
    );

  if (s === "g1_reveal") {
    const delta: number = room.reveals?.[`g1_${room.idx}`]?.deltas?.[me.player_id] ?? 0;
    const ans = state?.answer;
    const correct = ans != null && ans === d.answer;
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={cn("font-display text-6xl", correct ? "text-gain" : "text-loss")}>
          {ans == null ? "미응답" : correct ? "정답!" : "아쉬워요"}
        </span>
        <Delta n={delta} className="text-5xl" />
        <p className="text-lg">
          정답 <b className="text-gold">{NUM[d.answer ?? 0]} {d.choices?.[d.answer ?? 0]}</b>
        </p>
        <p className="text-sm text-muted-foreground">해설은 진행자 화면을 봐주세요</p>
      </div>
    );
  }

  if (s === "g1_rank" || s === "final") {
    const r = mine ? ranks.get(mine.id) : undefined;
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-muted-foreground">{s === "final" ? "최종 순위" : "현재 순위"}</span>
        <span className="font-display text-8xl text-gold-gradient glow-gold tabular">{r ?? "-"}위</span>
        <span className="text-muted-foreground tabular">{total}명 중</span>
        <Pieces n={mine?.pieces ?? 0} className="mt-2 text-4xl" />
        {s === "final" && <p className="mt-4 text-lg">수고하셨습니다! 시상은 진행자 화면에서 확인하세요</p>}
      </div>
    );
  }

  if (s === "g2_q")
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground tabular">ROUND {d.n} / {d.total} · 적은 쪽이 이깁니다</p>
        <p className="text-balance text-center font-display text-4xl leading-tight">{d.question}</p>
        {(["A", "B"] as const).map((side) => (
          <button
            key={side}
            disabled={locked}
            onClick={() => p.submit("g2", side)}
            className={cn(
              "flex min-h-28 flex-col items-center justify-center rounded-3xl border-4 px-4 py-5 active:scale-[0.98] disabled:opacity-60",
              side === "A" ? "border-choice-a/50" : "border-choice-b/50",
              state?.g2 === side && (side === "A" ? "border-choice-a bg-choice-a/20" : "border-choice-b bg-choice-b/20"),
            )}
          >
            <span className={cn("font-display text-3xl", side === "A" ? "text-choice-a" : "text-choice-b")}>{side}</span>
            <span className="font-display text-3xl">{side === "A" ? d.a : d.b}</span>
          </button>
        ))}
        <p className="text-center text-sm text-muted-foreground">
          {locked ? "마감되었습니다" : state?.g2 ? `${state.g2} 선택 · 마감 전까지 바꿀 수 있어요` : "하나를 고르세요"}
        </p>
      </div>
    );

  if (s === "g2_reveal") {
    const rev = room.reveals?.[`g2_${room.idx}`];
    const delta: number = rev?.deltas?.[me.player_id] ?? 0;
    const picked = rev?.picked && mine && rev.picked === mine.nickname;
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-display text-3xl tabular">
          <span className="text-choice-a">A {rev?.a ?? 0}</span> <span className="text-muted-foreground">vs</span>{" "}
          <span className="text-choice-b">B {rev?.b ?? 0}</span>
        </p>
        <Delta n={delta} className="text-5xl" />
        <p className="text-lg text-muted-foreground">
          {state?.g2 ? `나는 ${state.g2}` : "미응답"}
          {rev?.minority === "A" || rev?.minority === "B" ? ` · 소수파 ${rev.minority}` : rev?.minority === "tie" ? " · 동률" : ""}
        </p>
        {picked && <p className="anim-pop font-display text-3xl text-gold">🎤 뽑혔어요! 왜 골랐는지 말해 주세요</p>}
      </div>
    );
  }

  if (s === "g3_pick") return <Wait title="심사 주제를 고르는 중" />;
  if (s === "g3_write") return <Write {...p} />;
  if (s === "g3_prepare") return <Wait title="심사 준비 중" sub="곧 투표가 시작됩니다" />;
  if (s === "g3_vote") return <Vote {...p} />;
  if (s === "g3_result") {
    const myCard = p.cards.find((c) => c.id === state?.my_card);
    const delta: number = room.reveals?.["g3"]?.deltas?.[me.player_id] ?? 0;
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        {myCard ? (
          <>
            <p className="text-muted-foreground">내 답안</p>
            <p className="text-balance text-2xl font-bold">“{myCard.body}”</p>
            <p className="font-display text-4xl tabular">{myCard.votes ?? 0}표</p>
            {myCard.rank && myCard.rank <= 3 ? (
              <p className="font-display text-4xl text-gold">{myCard.rank}위!</p>
            ) : null}
            <Delta n={delta} className="text-4xl" />
          </>
        ) : (
          <Wait title="결과 발표" />
        )}
      </div>
    );
  }
  return <Wait />;
}

function Rule({ g, no }: { g: { title: string; rule: string }; no: number }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="font-display tracking-[0.3em] text-muted-foreground">GAME {no}</span>
      <span className="font-display text-5xl text-gold-gradient">{g.title}</span>
      <p className="text-balance text-lg leading-relaxed">{g.rule}</p>
    </div>
  );
}

function Bet({ room, state, pieces, locked, submit }: BodyProps) {
  const d = (room.data ?? {}) as RoomData;
  const [v, setV] = useState(0);
  const confirmed = state?.bet;
  const max = pieces;
  useEffect(() => {
    if (confirmed != null) setV(confirmed);
  }, [confirmed]);
  const val = Math.min(v, max);
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <span className="text-sm text-muted-foreground tabular">Q{d.n} · {d.category}</span>
        {d.label && <div className="font-display text-xl text-loss">{d.label}</div>}
      </div>
      <div className="text-center font-display text-8xl tabular text-gold-gradient">{val}</div>
      <div className="flex items-center gap-3">
        <button disabled={locked} onClick={() => setV(Math.max(0, val - 1))} className="h-14 w-14 shrink-0 rounded-2xl border-2 border-border text-3xl disabled:opacity-50">
          −
        </button>
        <input
          id="bet-range"
          type="range"
          min={0}
          max={max}
          value={val}
          disabled={locked}
          onChange={(e) => setV(Number(e.target.value))}
          className="h-3 min-w-0 flex-1 accent-[var(--gold)]"
          aria-label="베팅 피스"
        />
        <button disabled={locked} onClick={() => setV(Math.min(max, val + 1))} className="h-14 w-14 shrink-0 rounded-2xl border-2 border-border text-3xl disabled:opacity-50">
          +
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["0", 0],
          ["절반", Math.floor(max / 2)],
          ["올인", max],
        ].map(([label, n]) => (
          <button
            key={label as string}
            disabled={locked}
            onClick={() => setV(n as number)}
            className={cn("h-12 rounded-xl border-2 font-bold disabled:opacity-50", label === "올인" ? "border-loss/60 text-loss" : "border-border")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        disabled={locked}
        onClick={() => submit("bet", val)}
        className="h-16 rounded-2xl bg-gold-gradient font-display text-2xl text-primary-foreground shadow-gold active:scale-[0.98] disabled:opacity-50"
      >
        {confirmed != null && confirmed === val ? "베팅 확정됨 ✓" : "베팅 확정"}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        {locked
          ? `마감 · 최종 베팅 ${confirmed ?? 0} 피스`
          : confirmed != null
            ? `현재 확정 ${confirmed} 피스 · 마감 전까지 바꿀 수 있어요`
            : "확정하지 않으면 0 피스로 처리됩니다"}
      </p>
    </div>
  );
}

function Write({ room, state, locked, submit }: BodyProps) {
  const [t, setT] = useState("");
  const saved = state?.text ?? null;
  useEffect(() => {
    if (saved != null) setT(saved);
  }, [saved]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gold">심사 주제</p>
      <p className="text-balance font-display text-3xl leading-tight">{(room.data as RoomData).prompt}</p>
      <textarea
        id="g3-text"
        value={t}
        maxLength={60}
        rows={3}
        disabled={locked}
        onChange={(e) => setT(e.target.value)}
        placeholder="한 줄로 적어 주세요 (이름은 공개되지 않아요)"
        className="rounded-2xl border-2 border-border bg-card p-4 text-xl outline-none focus:border-gold disabled:opacity-60"
      />
      <div className="flex items-center justify-between text-sm text-muted-foreground tabular">
        <span>{saved != null ? "제출됨 · 마감 전까지 고칠 수 있어요" : "아직 제출 전"}</span>
        <span>{t.length}/60</span>
      </div>
      <button
        disabled={locked || !t.trim()}
        onClick={() => submit("text", t.trim())}
        className="h-16 rounded-2xl bg-gold-gradient font-display text-2xl text-primary-foreground shadow-gold active:scale-[0.98] disabled:opacity-50"
      >
        {saved != null && saved === t.trim() ? "제출 완료 ✓" : saved != null ? "고쳐서 다시 제출" : "제출하기"}
      </button>
    </div>
  );
}

function Vote({ room, state, locked, submit, cards }: BodyProps) {
  const list = cards.filter((c) => !c.hidden && c.id !== state?.my_card).sort((a, b) => a.ord - b.ord);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gold">가장 좋은 답안 하나에 투표하세요</p>
      <p className="text-balance font-bold">{(room.data as RoomData).prompt}</p>
      {list.map((c) => (
        <button
          key={c.id}
          disabled={locked}
          onClick={() => submit("vote", c.id)}
          className={cn(
            "flex items-start gap-3 rounded-2xl border-2 px-4 py-4 text-left text-lg font-semibold active:scale-[0.98] disabled:opacity-60",
            state?.vote === c.id ? "border-gold bg-gold/15" : "border-border bg-card",
          )}
        >
          <span className="font-display text-gold tabular">#{c.ord}</span>
          <span className="min-w-0 flex-1">{c.body}</span>
          {state?.vote === c.id && <span className="text-gold">✓</span>}
        </button>
      ))}
      {list.length === 0 && <Wait title="투표할 답안이 없어요" />}
      <p className="text-center text-sm text-muted-foreground">
        {locked ? "마감되었습니다" : state?.vote ? "투표 완료 · 마감 전까지 바꿀 수 있어요" : "내 답안은 목록에 나오지 않아요"}
      </p>
    </div>
  );
}
