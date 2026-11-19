import { useEffect, useRef } from "react";
import { BOT_TEXTS } from "@/data/content";
import { rpc, type Card, type Player, type Room } from "@/lib/game";

type BotToken = { id: string; token: string };

const SUBMIT_STEPS = new Set(["g1_bet", "g1_q", "g2_q", "g3_write", "g3_vote"]);

const rand = (n: number) => Math.floor(Math.random() * n);

/**
 * 리허설용 봇: 진행자 화면에서만 동작합니다.
 * 제출을 받는 단계가 열리면 봇마다 2~6초 뒤에 무작위 값을 제출합니다.
 */
export function useBots(code: string, hostToken: string | null, room: Room | null | undefined, players: Player[], cards: Card[]) {
  const tokens = useRef<BotToken[]>([]);
  const botCount = players.filter((p) => p.is_bot).length;
  const playersRef = useRef(players);
  const cardsRef = useRef(cards);
  playersRef.current = players;
  cardsRef.current = cards;

  // 봇 토큰 불러오기 (봇 수가 바뀔 때마다)
  useEffect(() => {
    if (!hostToken || botCount === 0) {
      tokens.current = [];
      return;
    }
    rpc<BotToken[]>("host_bot_tokens", { p_code: code, p_token: hostToken })
      .then((t) => {
        tokens.current = t ?? [];
      })
      .catch(() => {
        tokens.current = [];
      });
  }, [code, hostToken, botCount]);

  const step = room?.step;
  const idx = room?.idx;
  const deadline = room?.deadline;

  useEffect(() => {
    if (!step || !SUBMIT_STEPS.has(step) || !deadline) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    tokens.current.forEach((bot) => {
      const delay = 2000 + rand(4000);
      timers.push(
        setTimeout(async () => {
          const me = playersRef.current.find((p) => p.id === bot.id);
          if (!me) return;
          const submit = (kind: string, value: unknown) =>
            rpc("player_submit", { p_code: code, p_token: bot.token, p_kind: kind, p_value: value });
          try {
            if (step === "g1_bet") await submit("bet", rand(me.pieces + 1));
            else if (step === "g1_q") await submit("answer", rand(4));
            else if (step === "g2_q") await submit("g2", Math.random() < 0.5 ? "A" : "B");
            else if (step === "g3_write") await submit("text", BOT_TEXTS[rand(BOT_TEXTS.length)] ?? "봇의 한 줄");
            else if (step === "g3_vote") {
              // 자기 카드는 서버가 거부하므로, 거부되면 다른 카드로 다시 시도
              const pool = cardsRef.current.filter((c) => !c.hidden).sort(() => Math.random() - 0.5);
              for (const c of pool) {
                try {
                  await submit("vote", c.id);
                  break;
                } catch {
                  /* 다음 카드 시도 */
                }
              }
            }
          } catch {
            /* 마감 등으로 거부되면 무시 */
          }
        }, delay),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [code, step, idx, deadline]);
}
