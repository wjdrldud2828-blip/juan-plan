import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Chip, Delta, Pieces, Stars, Timer } from "@/components/game/bits";
import { useBots } from "@/components/game/useBots";
import { GAME3_PROMPTS, GAME_INFO, SUBTITLE, TITLE } from "@/data/content";
import { SEQUENCE, buildData, revealKey, seqIndex } from "@/lib/flow";
import { hostKey, rpc, useCountdown, useRanking, useRoomData, type Card, type Player, type Room } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { RoomData } from "@/components/game/types";

const NUM = ["①", "②", "③", "④"];

function gameOf(step: string) {
  if (step.startsWith("g1")) return { no: 1, ...GAME_INFO.g1 };
  if (step.startsWith("g2")) return { no: 2, ...GAME_INFO.g2 };
  if (step.startsWith("g3")) return { no: 3, ...GAME_INFO.g3 };
  return null;
}

export function HostScreen({ code }: { code: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const { room, players, cards } = useRoomData(code);
  const { sorted, ranks } = useRanking(players);

  useEffect(() => {
    try {
      setToken(localStorage.getItem(hostKey(code)));
    } catch {
      setToken(null);
    }
    // 예: https://wjdrldud2828-blip.github.io/juan-plan/
    setOrigin(window.location.origin + window.location.pathname);
  }, [code]);

  useBots(code, token ?? null, room, players, cards);

  const call = useCallback(
    async (fn: string, args: Record<string, unknown> = {}) => {
      if (!token) return;
      try {
        await rpc(fn, { p_code: code, p_token: token, ...args });
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
    [code, token],
  );

  const pos = room ? seqIndex(room.step, room.idx) : -1;

  const goTo = useCallback(
    async (i: number) => {
      if (!room || i < 0 || i >= SEQUENCE.length || busy) return;
      const s = SEQUENCE[i]!;
      setBusy(true);
      await call("host_set_step", {
        p_step: s.step,
        p_idx: s.idx,
        p_data: buildData(s.step, s.idx, room.data ?? {}),
        p_seconds: s.seconds,
      });
      setBusy(false);
    },
    [room, busy, call],
  );

  const next = useCallback(() => goTo(pos + 1), [goTo, pos]);
  const prev = useCallback(() => goTo(pos - 1), [goTo, pos]);

  // 키보드: Space / → 다음, ← 이전
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  if (token === undefined || room === undefined) {
    return <Center>불러오는 중…</Center>;
  }
  if (room === null) {
    return (
      <Center>
        <p className="font-display text-4xl text-gold">방 {code}을(를) 찾을 수 없습니다</p>
        <p className="mt-3 text-muted-foreground">방은 만든 지 이틀이 지나면 정리됩니다. 새로 만들어 주세요.</p>
        <a href="#/" className="mt-6 inline-block rounded-xl border-2 border-gold/50 px-6 py-3 font-display text-gold">
          처음으로
        </a>
      </Center>
    );
  }
  if (!token) {
    return (
      <Center>
        <p className="font-display text-4xl text-gold">이 브라우저에는 진행자 권한이 없습니다</p>
        <p className="mt-3 text-muted-foreground">방을 만든 노트북의 같은 브라우저에서 열어 주세요.</p>
        <a href="#/" className="mt-6 inline-block rounded-xl border-2 border-gold/50 px-6 py-3 font-display text-gold">
          처음으로
        </a>
      </Center>
    );
  }

  const stepInfo = SEQUENCE[pos];
  const game = gameOf(room.step);
  const joinUrl = origin ? `${origin}#/play/${code}` : "";
  const isLast = pos >= SEQUENCE.length - 1;

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden">
      <TopBar room={room} players={players} game={game} label={stepInfo?.label ?? ""} code={code} />

      <main className="relative min-h-0 overflow-y-auto px-[4vw] py-[3vh]">
        <Stage
          room={room}
          players={players}
          cards={cards}
          sorted={sorted}
          ranks={ranks}
          joinUrl={joinUrl}
          code={code}
          call={call}
        />
      </main>

      <footer className="flex items-center gap-3 border-t border-border bg-card/70 px-[2vw] py-3 backdrop-blur">
        <button
          onClick={prev}
          disabled={pos <= 0 || busy}
          className="h-12 rounded-xl border border-border px-5 font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          ← 이전
        </button>
        {room.deadline && (
          <>
            <button
              onClick={() => call("host_lock")}
              className="h-12 rounded-xl border border-loss/60 px-5 font-semibold text-loss hover:bg-loss/10"
            >
              마감
            </button>
            <button
              onClick={() => call("host_add_time")}
              className="h-12 rounded-xl border border-border px-5 font-semibold hover:border-foreground"
            >
              +10초
            </button>
          </>
        )}
        <span className="ml-2 hidden text-sm text-muted-foreground lg:inline">
          Space 또는 → 다음 · ← 이전
        </span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setPanel((v) => !v)}
            className="h-12 rounded-xl border border-border px-5 font-semibold text-muted-foreground hover:text-foreground"
          >
            진행 도구
          </button>
          <button
            onClick={next}
            disabled={isLast || busy}
            className="h-14 min-w-[12rem] rounded-xl bg-gold-gradient px-8 font-display text-2xl text-primary-foreground shadow-gold active:scale-[0.98] disabled:opacity-40"
          >
            {room.step === "lobby" ? "게임 시작 →" : isLast ? "끝" : `다음 → ${SEQUENCE[pos + 1]?.label ?? ""}`}
          </button>
        </div>
      </footer>

      {panel && (
        <HostPanel
          room={room}
          players={sorted}
          pos={pos}
          onClose={() => setPanel(false)}
          goTo={goTo}
          call={call}
        />
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">{children}</div>;
}

function TopBar({
  room,
  players,
  game,
  label,
  code,
}: {
  room: Room;
  players: Player[];
  game: ReturnType<typeof gameOf>;
  label: string;
  code: string;
}) {
  const sec = useCountdown(room.deadline);
  const counting = ["g1_bet", "g1_q", "g2_q", "g3_write", "g3_vote"].includes(room.step);
  return (
    <header className="flex items-center gap-6 border-b border-border px-[2vw] py-3">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-2xl text-gold-gradient">{TITLE}</span>
        <span className="font-display text-lg text-muted-foreground tabular">#{code}</span>
      </div>
      {game && (
        <span className="rounded-full border border-gold/40 px-4 py-1 font-semibold text-gold">
          GAME {game.no} · {game.title}
        </span>
      )}
      <span className="text-lg text-muted-foreground">{label}</span>
      <div className="ml-auto flex items-center gap-6">
        {counting && (
          <span className="text-2xl font-semibold tabular">
            <span className="text-muted-foreground">제출 </span>
            <span className="text-foreground">{room.submit_count}</span>
            <span className="text-muted-foreground">/{players.length}</span>
          </span>
        )}
        <Timer sec={sec} className="min-w-[3ch] text-right text-5xl" />
      </div>
    </header>
  );
}

type StageProps = {
  room: Room;
  players: Player[];
  cards: Card[];
  sorted: Player[];
  ranks: Map<string, number>;
  joinUrl: string;
  code: string;
  call: (fn: string, args?: Record<string, unknown>) => Promise<void>;
};

function Stage(props: StageProps) {
  const { room } = props;
  const s = room.step;
  if (s === "lobby") return <Lobby {...props} />;
  if (s.endsWith("_intro")) return <Intro step={s} />;
  if (s.startsWith("g1_")) return <Game1 {...props} />;
  if (s.startsWith("g2_")) return <Game2 {...props} />;
  if (s.startsWith("g3_")) return <Game3 {...props} />;
  if (s === "final") return <Final {...props} />;
  return null;
}

/* ───────── 대기실 ───────── */
function Lobby({ players, joinUrl, code, call }: StageProps) {
  const bots = players.filter((p) => p.is_bot).length;
  return (
    <div className="grid h-full grid-cols-[auto_1fr] items-center gap-[4vw]">
      <div className="flex flex-col items-center gap-5 anim-rise">
        <div className="rounded-3xl bg-white p-5 shadow-gold">
          {joinUrl && <QRCodeSVG value={joinUrl} size={340} level="M" />}
        </div>
        <div className="text-center">
          <div className="text-lg text-muted-foreground">방 코드</div>
          <div className="font-display text-[7rem] leading-none tracking-[0.15em] text-gold-gradient glow-gold tabular">{code}</div>
          <div className="mt-2 text-lg text-muted-foreground break-all">{joinUrl.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
      <div className="flex h-full min-w-0 flex-col justify-center gap-6">
        <div>
          <h1 className="font-display text-[4.5rem] leading-tight text-gold-gradient glow-gold">{TITLE}</h1>
          <p className="text-2xl text-muted-foreground">{SUBTITLE}</p>
        </div>
        <p className="text-2xl">
          휴대폰 카메라로 QR을 찍고 <b className="text-gold">닉네임</b>만 입력하면 입장합니다. 모두 <Pieces n={10} /> 로 시작!
        </p>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-5xl tabular">{players.length}</span>
          <span className="text-2xl text-muted-foreground">명 입장</span>
        </div>
        <div className="flex max-h-[38vh] flex-wrap content-start gap-3 overflow-y-auto">
          {players.map((p) => (
            <span
              key={p.id}
              className={cn(
                "anim-pop rounded-full border px-5 py-2 text-2xl font-semibold",
                p.is_bot ? "border-dashed border-muted-foreground/50 text-muted-foreground" : "border-gold/40 bg-gold/10",
              )}
            >
              {p.nickname}
              {p.is_bot && <span className="ml-2 text-sm">(리허설)</span>}
            </span>
          ))}
          {players.length === 0 && <span className="text-xl text-muted-foreground">아직 아무도 없어요…</span>}
        </div>
        <div className="flex gap-3">
          {bots === 0 ? (
            <button onClick={() => call("host_add_bots")} className="rounded-xl border border-dashed border-border px-5 py-3 text-muted-foreground hover:text-foreground">
              리허설용 가상 참가자 3명 추가
            </button>
          ) : (
            <button onClick={() => call("host_remove_bots")} className="rounded-xl border border-dashed border-loss/50 px-5 py-3 text-loss">
              가상 참가자 {bots}명 내보내기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── 규칙 카드 ───────── */
function Intro({ step }: { step: string }) {
  const g = gameOf(step)!;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <div className="anim-rise font-display text-4xl tracking-[0.3em] text-muted-foreground">GAME {g.no}</div>
      <h2 className="anim-pop font-display text-[8rem] leading-none text-gold-gradient glow-gold">{g.title}</h2>
      <p className="anim-rise max-w-[60ch] text-balance text-4xl leading-snug">{g.rule}</p>
    </div>
  );
}

/* ───────── 게임 1: 올인 베팅 퀴즈 ───────── */
function Game1({ room, players, sorted, ranks }: StageProps) {
  const d = room.data as RoomData;
  const s = room.step;
  const key = revealKey(s, room.idx);
  const rev = key ? room.reveals?.[key] : null;
  const dist: number[] = rev?.dist ?? [0, 0, 0, 0];
  const deltas: Record<string, number> = rev?.deltas ?? {};

  const header = (
    <div className="flex flex-wrap items-center gap-5">
      <span className="font-display text-4xl tabular text-muted-foreground">
        Q{d.n}
        <span className="text-2xl">/{d.total}</span>
      </span>
      <span className="rounded-xl bg-gold/15 px-4 py-1 font-display text-3xl text-gold">{d.category}</span>
      <Stars n={d.difficulty ?? 1} className="text-3xl" />
      {d.label && <span className="rounded-xl border-2 border-loss px-4 py-1 font-display text-2xl text-loss anim-pulse-red">{d.label}</span>}
    </div>
  );

  if (s === "g1_cat" || s === "g1_bet") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 text-center">
        <div className="text-3xl text-muted-foreground">Q{d.n} / {d.total}</div>
        <div className="anim-pop font-display text-[9rem] leading-none text-gold-gradient glow-gold">{d.category}</div>
        <Stars n={d.difficulty ?? 1} className="text-7xl" />
        {d.label && <div className="font-display text-5xl text-loss">{d.label}</div>}
        <p className="text-4xl">
          {s === "g1_cat" ? "분야와 난이도를 보고 얼마를 걸지 정하세요" : "지금 휴대폰에서 베팅하세요!"}
        </p>
        {s === "g1_bet" && (
          <p className="font-display text-6xl tabular">
            베팅 완료 <span className="text-gold">{room.submit_count}</span>
            <span className="text-muted-foreground">/{players.length}</span>
          </p>
        )}
      </div>
    );
  }

  if (s === "g1_q" || s === "g1_reveal") {
    const showAns = s === "g1_reveal";
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    return (
      <div className="flex h-full flex-col gap-8">
        {header}
        <h2 className="anim-rise text-balance font-display text-[3.6rem] leading-tight">{d.question}</h2>
        <div className="grid grid-cols-2 gap-5">
          {d.choices?.map((c, i) => {
            const correct = showAns && d.answer === i;
            return (
              <div
                key={i}
                className={cn(
                  "relative overflow-hidden rounded-2xl border-2 px-6 py-6 text-[2.4rem] font-bold transition-all",
                  correct ? "border-gain bg-gain/15 text-gain" : showAns ? "border-border opacity-50" : "border-border bg-card",
                )}
              >
                {showAns && (
                  <div
                    className={cn("absolute inset-y-0 left-0 -z-0", correct ? "bg-gain/20" : "bg-foreground/5")}
                    style={{ width: `${(dist[i]! / total) * 100}%` }}
                  />
                )}
                <div className="relative flex items-center gap-4">
                  <span className="text-gold">{NUM[i]}</span>
                  <span className="min-w-0 flex-1">{c}</span>
                  {showAns && <span className="tabular text-3xl text-muted-foreground">{dist[i]}명</span>}
                </div>
              </div>
            );
          })}
        </div>
        {showAns ? (
          <div className="anim-rise rounded-2xl border-l-8 border-gold bg-card/60 px-7 py-5">
            <p className="text-3xl leading-relaxed">{d.explanation}</p>
            <p className="mt-3 text-xl text-muted-foreground">출처 · {d.source}</p>
          </div>
        ) : (
          <p className="text-center font-display text-5xl tabular">
            응답 <span className="text-gold">{room.submit_count}</span>
            <span className="text-muted-foreground">/{players.length}</span>
          </p>
        )}
      </div>
    );
  }

  // g1_rank
  return (
    <div className="flex h-full flex-col gap-6">
      {header}
      <h2 className="font-display text-6xl">현재 순위 TOP 5</h2>
      <Leaderboard rows={sorted.slice(0, 5)} ranks={ranks} deltas={deltas} big />
    </div>
  );
}

function Leaderboard({
  rows,
  ranks,
  deltas,
  big,
}: {
  rows: Player[];
  ranks: Map<string, number>;
  deltas?: Record<string, number>;
  big?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((p, i) => (
        <li
          key={p.id}
          style={{ animationDelay: `${i * 80}ms` }}
          className={cn(
            "anim-rise grid grid-cols-[4ch_1fr_auto_auto] items-center gap-6 rounded-2xl border border-border bg-card/70 px-6",
            big ? "py-4 text-[2.6rem]" : "py-2 text-2xl",
            ranks.get(p.id) === 1 && "border-gold/60 bg-gold/10",
          )}
        >
          <span className="font-display tabular text-gold">{ranks.get(p.id)}위</span>
          <span className="min-w-0 truncate font-bold">
            {p.nickname}
            {p.is_bot && <span className="ml-2 text-base text-muted-foreground">(리허설)</span>}
          </span>
          {deltas ? <Delta n={deltas[p.id] ?? 0} className="text-[0.8em]" /> : <span />}
          <Pieces n={p.pieces} />
        </li>
      ))}
    </ol>
  );
}

/* ───────── 게임 2: 소수결 ───────── */
function Game2({ room, players, call }: StageProps) {
  const d = room.data as RoomData;
  const key = `g2_${room.idx}`;
  const rev = room.step === "g2_reveal" ? room.reveals?.[key] : null;
  const a: number = rev?.a ?? 0;
  const b: number = rev?.b ?? 0;
  const max = Math.max(a, b, 1);
  const mino: string | undefined = rev?.minority;

  const verdict =
    mino === "A" || mino === "B"
      ? `소수파 ${mino} 승리! 고른 사람 전원 +3 피스`
      : mino === "tie"
        ? "정확히 반반! 응답자 전원 +1 피스"
        : mino === "none"
          ? "모두 한쪽을 골랐습니다. 이번 판은 득점 없음"
          : "";

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="text-3xl text-muted-foreground">
        ROUND {d.n} / {d.total}
      </div>
      <h2 className="anim-pop text-balance text-center font-display text-[5.5rem] leading-tight">{d.question}</h2>
      <div className="grid flex-1 grid-cols-2 gap-8">
        {(["A", "B"] as const).map((side) => {
          const n = side === "A" ? a : b;
          const win = mino === side;
          return (
            <div
              key={side}
              className={cn(
                "flex flex-col items-center justify-center gap-4 rounded-3xl border-4 p-8 text-center transition-all",
                side === "A" ? "border-choice-a/60 bg-choice-a/10" : "border-choice-b/60 bg-choice-b/10",
                rev && !win && mino !== "tie" && "opacity-45",
                win && "shadow-gold ring-4 ring-gold",
              )}
            >
              <span className={cn("font-display text-7xl", side === "A" ? "text-choice-a" : "text-choice-b")}>{side}</span>
              <span className="font-display text-6xl">{side === "A" ? d.a : d.b}</span>
              {rev && (
                <div className="mt-4 w-full">
                  <div className="h-6 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-700", side === "A" ? "bg-choice-a" : "bg-choice-b")}
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 font-display text-7xl tabular">{n}명</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rev ? (
        <div className="flex flex-col items-center gap-4">
          <p className="anim-pop font-display text-5xl text-gold">{verdict}</p>
          {mino && mino !== "none" && (
            rev.picked ? (
              <p className="anim-pop font-display text-6xl">
                🎤 <span className="text-gold-gradient glow-gold">{rev.picked}</span> 님, 왜 골랐나요?
              </p>
            ) : (
              <button onClick={() => call("host_pick_minority")} className="rounded-xl border-2 border-gold/60 px-8 py-3 font-display text-3xl text-gold hover:bg-gold/10">
                {mino === "tie" ? "한 명 뽑기" : "소수파 한 명 뽑기"}
              </button>
            )
          )}
        </div>
      ) : (
        <p className="text-center font-display text-5xl tabular">
          선택 <span className="text-gold">{room.submit_count}</span>
          <span className="text-muted-foreground">/{players.length}</span>
        </p>
      )}
    </div>
  );
}

/* ───────── 게임 3: 블라인드 심사 ───────── */
function Game3({ room, players, cards, call }: StageProps) {
  const s = room.step;
  const prompt: string | null = (room.data as RoomData).prompt ?? null;

  if (s === "g3_pick") {
    return (
      <div className="flex h-full flex-col gap-8">
        <h2 className="font-display text-6xl">오늘의 심사 주제를 고르세요</h2>
        <div className="grid flex-1 grid-cols-3 gap-6">
          {GAME3_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => call("host_merge_data", { p_data: { prompt: p } })}
              className={cn(
                "rounded-3xl border-4 p-8 text-left text-balance font-display text-5xl leading-snug transition-all",
                prompt === p ? "border-gold bg-gold/15 shadow-gold" : "border-border bg-card hover:border-gold/50",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="text-2xl text-muted-foreground">{prompt ? "선택 완료. ‘다음’을 누르면 작성이 시작됩니다." : "카드를 눌러 하나를 고르세요."}</p>
      </div>
    );
  }

  const promptBox = (
    <div className="rounded-3xl border-2 border-gold/40 bg-gold/5 px-8 py-6">
      <div className="text-2xl text-gold">심사 주제</div>
      <div className="text-balance font-display text-[3.4rem] leading-tight">{prompt ?? GAME3_PROMPTS[0]}</div>
    </div>
  );

  if (s === "g3_write") {
    return (
      <div className="flex h-full flex-col justify-center gap-10">
        {promptBox}
        <p className="text-center text-4xl">휴대폰에 한 줄 답안을 적어 주세요. 이름은 공개되지 않습니다.</p>
        <p className="text-center font-display text-7xl tabular">
          제출 <span className="text-gold">{room.submit_count}</span>
          <span className="text-muted-foreground">/{players.length}</span>
        </p>
      </div>
    );
  }

  const showResult = s === "g3_result";
  const authors = !!(room.data as RoomData).authors;
  const visible = s === "g3_prepare" ? cards : cards.filter((c) => !c.hidden);
  const list = showResult
    ? [...visible].sort((x, y) => (y.votes ?? 0) - (x.votes ?? 0) || x.ord - y.ord)
    : [...visible].sort((x, y) => x.ord - y.ord);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0 flex-1">{promptBox}</div>
        {s === "g3_vote" && (
          <p className="shrink-0 font-display text-5xl tabular">
            투표 <span className="text-gold">{room.submit_count}</span>
            <span className="text-muted-foreground">/{players.length}</span>
          </p>
        )}
        {showResult && !authors && (
          <button onClick={() => call("host_reveal_authors")} className="shrink-0 rounded-xl bg-gold-gradient px-8 py-4 font-display text-3xl text-primary-foreground shadow-gold">
            작성자 공개
          </button>
        )}
      </div>
      {s === "g3_prepare" && (
        <p className="text-xl text-muted-foreground">부적절한 답안은 카드의 ‘숨기기’를 눌러 투표에서 빼 주세요.</p>
      )}
      {list.length === 0 && <p className="text-3xl text-muted-foreground">제출된 답안이 없습니다.</p>}
      <div className={cn("grid gap-4", list.length > 8 ? "grid-cols-4" : list.length > 4 ? "grid-cols-3" : "grid-cols-2")}>
        {list.map((c) => (
          <div
            key={c.id}
            className={cn(
              "relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-5",
              c.hidden ? "border-dashed border-loss/50 opacity-40" : "border-border",
              showResult && c.rank === 1 && "border-gold bg-gold/10 shadow-gold",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl text-gold tabular">#{c.ord}</span>
              {showResult && c.rank && c.rank <= 3 && (
                <span className="rounded-full bg-gold-gradient px-3 py-0.5 font-display text-xl text-primary-foreground">
                  {c.rank}위 +{c.award}
                </span>
              )}
              {showResult && <span className="ml-auto font-display text-2xl tabular text-muted-foreground">{c.votes ?? 0}표</span>}
              {s === "g3_prepare" && (
                <button
                  onClick={() => call("host_hide_card", { p_card: c.id, p_hidden: !c.hidden })}
                  className="ml-auto rounded-lg border border-border px-3 py-1 text-base text-muted-foreground hover:text-foreground"
                >
                  {c.hidden ? "다시 보이기" : "숨기기"}
                </button>
              )}
            </div>
            <p className="text-balance text-[2rem] font-bold leading-snug">{c.body}</p>
            {showResult && authors && c.author_nickname && (
              <p className="anim-flip text-2xl text-gold">— {c.author_nickname}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── 최종 ───────── */
function Final({ room, sorted, ranks, call }: StageProps) {
  const shown: number = (room.data as RoomData).podium ?? 0; // 0: 전체 순위, 1: 3위, 2: 2위, 3: 1위까지 공개
  const byRank = (r: number) => sorted.filter((p) => ranks.get(p.id) === r);
  const top = useMemo(() => [byRank(1), byRank(2), byRank(3)], [sorted, ranks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (shown >= 3) {
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 180, spread: 100, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 120, spread: 140, origin: { y: 0.5 } }), 500);
      });
    }
  }, [shown]);

  const label = shown === 0 ? "3위 공개" : shown === 1 ? "2위 공개" : shown === 2 ? "1위 공개" : null;

  return (
    <div className="grid h-full grid-cols-[1fr_1.2fr] gap-[3vw]">
      <div className="flex min-h-0 flex-col gap-4">
        <h2 className="font-display text-5xl">최종 순위</h2>
        <div className="min-h-0 overflow-y-auto pr-2">
          <Leaderboard rows={shown >= 3 ? sorted : sorted.filter((p) => (ranks.get(p.id) ?? 99) > 3)} ranks={ranks} />
        </div>
      </div>
      <div className="flex flex-col items-center justify-end gap-6">
        <div className="grid w-full grid-cols-3 items-end gap-5">
          {[1, 0, 2].map((i) => {
            const place = i + 1;
            const open = shown >= 4 - place; // 3위: shown>=1, 2위: >=2, 1위: >=3
            const h = place === 1 ? "h-[34vh]" : place === 2 ? "h-[25vh]" : "h-[18vh]";
            return (
              <div key={place} className="flex flex-col items-center gap-3">
                <div className={cn("min-h-[7rem] text-center", open ? "anim-pop" : "opacity-0")}>
                  {top[i]?.map((p) => (
                    <div key={p.id} className={cn("font-display leading-tight", place === 1 ? "text-6xl text-gold-gradient glow-gold" : "text-4xl")}>
                      {p.nickname}
                    </div>
                  ))}
                  {open && top[i]?.[0] && <Pieces n={top[i]![0]!.pieces} className="mt-1 text-3xl" />}
                </div>
                <div
                  className={cn(
                    "flex w-full items-start justify-center rounded-t-2xl pt-4 font-display text-6xl",
                    h,
                    place === 1 ? "bg-gold-gradient text-primary-foreground shadow-gold" : "bg-card text-gold",
                  )}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>
        {label ? (
          <button onClick={() => call("host_merge_data", { p_data: { podium: shown + 1 } })} className="rounded-xl border-2 border-gold/60 px-10 py-4 font-display text-4xl text-gold hover:bg-gold/10">
            {label}
          </button>
        ) : (
          <p className="font-display text-4xl text-gold">수고하셨습니다! <Chip /> <Chip /> <Chip /></p>
        )}
      </div>
    </div>
  );
}

/* ───────── 진행 도구 패널 ───────── */
function HostPanel({
  room,
  players,
  pos,
  onClose,
  goTo,
  call,
}: {
  room: Room;
  players: Player[];
  pos: number;
  onClose: () => void;
  goTo: (i: number) => Promise<void>;
  call: (fn: string, args?: Record<string, unknown>) => Promise<void>;
}) {
  const [armReset, setArmReset] = useState(false);
  const [armRemove, setArmRemove] = useState<string | null>(null);
  const bots = players.filter((p) => p.is_bot).length;

  useEffect(() => {
    if (!armReset) return;
    const t = setTimeout(() => setArmReset(false), 4000);
    return () => clearTimeout(t);
  }, [armReset]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="flex h-full w-[min(560px,92vw)] flex-col gap-5 overflow-y-auto border-l border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-3xl text-gold">진행 도구</h3>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2">
            닫기
          </button>
        </div>

        <section>
          <h4 className="mb-2 font-semibold text-muted-foreground">단계로 바로 가기</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {SEQUENCE.map((s, i) => (
              <button
                key={`${s.step}-${s.idx}`}
                onClick={() => goTo(i)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-left text-sm",
                  i === pos ? "bg-gold text-primary-foreground" : "bg-background/60 hover:bg-background",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">이미 점수를 낸 문제는 다시 공개해도 점수가 두 번 들어가지 않습니다.</p>
        </section>

        <section>
          <h4 className="mb-2 font-semibold text-muted-foreground">참가자 피스 조정 ({players.length}명)</h4>
          <ul className="flex flex-col gap-1.5">
            {players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">
                  {p.nickname}
                  {p.is_bot && <span className="ml-1 text-xs text-muted-foreground">(리허설)</span>}
                </span>
                <span className="w-10 text-right tabular text-gold">{p.pieces}</span>
                <button onClick={() => call("host_adjust", { p_player: p.id, p_delta: -1 })} className="h-8 w-8 rounded-md border border-border">
                  −
                </button>
                <button onClick={() => call("host_adjust", { p_player: p.id, p_delta: 1 })} className="h-8 w-8 rounded-md border border-border">
                  +
                </button>
                <button
                  onClick={() => {
                    if (armRemove === p.id) {
                      call("host_remove_player", { p_player: p.id });
                      setArmRemove(null);
                    } else setArmRemove(p.id);
                  }}
                  className={cn("h-8 rounded-md border px-2 text-xs", armRemove === p.id ? "border-loss text-loss" : "border-border text-muted-foreground")}
                >
                  {armRemove === p.id ? "확인" : "내보내기"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap gap-2">
          {bots === 0 ? (
            <button onClick={() => call("host_add_bots")} className="rounded-lg border border-dashed border-border px-4 py-2">
              가상 참가자 3명 추가
            </button>
          ) : (
            <button onClick={() => call("host_remove_bots")} className="rounded-lg border border-dashed border-loss/60 px-4 py-2 text-loss">
              가상 참가자 내보내기
            </button>
          )}
          <button
            onClick={() => {
              if (armReset) {
                call("host_reset");
                setArmReset(false);
              } else setArmReset(true);
            }}
            className={cn("rounded-lg border px-4 py-2", armReset ? "border-loss bg-loss/15 text-loss" : "border-border")}
          >
            {armReset ? "한 번 더 누르면 초기화" : "방 초기화"}
          </button>
        </section>
        <p className="text-xs text-muted-foreground">
          방 초기화: 참가자는 그대로 두고 모든 피스를 10으로, 진행을 대기실로 되돌립니다. 현재 단계: {room.step}
        </p>
      </aside>
    </div>
  );
}
