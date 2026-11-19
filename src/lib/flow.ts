import { GAME1, GAME2, GAME3_PROMPTS, TIMERS } from "@/data/content";

export type Step = { step: string; idx: number; seconds: number; label: string };

/** 진행 순서 전체: 대기실 → 게임1(5문제) → 게임2(3라운드) → 게임3 → 최종 */
export function buildSequence(): Step[] {
  const s: Step[] = [{ step: "lobby", idx: 0, seconds: 0, label: "대기실" }];
  s.push({ step: "g1_intro", idx: 0, seconds: 0, label: "게임1 규칙" });
  GAME1.forEach((_, i) => {
    const n = `Q${i + 1}`;
    s.push({ step: "g1_cat", idx: i, seconds: 0, label: `${n} 카테고리` });
    s.push({ step: "g1_bet", idx: i, seconds: TIMERS.bet, label: `${n} 베팅` });
    s.push({ step: "g1_q", idx: i, seconds: TIMERS.question, label: `${n} 문제` });
    s.push({ step: "g1_reveal", idx: i, seconds: 0, label: `${n} 정답` });
    s.push({ step: "g1_rank", idx: i, seconds: 0, label: `${n} 순위` });
  });
  s.push({ step: "g2_intro", idx: 0, seconds: 0, label: "게임2 규칙" });
  GAME2.forEach((_, i) => {
    s.push({ step: "g2_q", idx: i, seconds: TIMERS.g2, label: `R${i + 1} 질문` });
    s.push({ step: "g2_reveal", idx: i, seconds: 0, label: `R${i + 1} 공개` });
  });
  s.push({ step: "g3_intro", idx: 0, seconds: 0, label: "게임3 규칙" });
  s.push({ step: "g3_pick", idx: 0, seconds: 0, label: "주제 선택" });
  s.push({ step: "g3_write", idx: 0, seconds: TIMERS.write, label: "작성" });
  s.push({ step: "g3_prepare", idx: 0, seconds: 0, label: "심사 준비" });
  s.push({ step: "g3_vote", idx: 0, seconds: TIMERS.vote, label: "투표" });
  s.push({ step: "g3_result", idx: 0, seconds: 0, label: "결과" });
  s.push({ step: "final", idx: 0, seconds: 0, label: "최종" });
  return s;
}

export const SEQUENCE = buildSequence();

export function seqIndex(step: string, idx: number) {
  return SEQUENCE.findIndex((s) => s.step === step && s.idx === idx);
}

/** 단계마다 방에 올리는 공개 데이터. 정답은 '정답 공개' 단계부터만 올라갑니다. */
export function buildData(step: string, idx: number, prev: Record<string, unknown>): Record<string, unknown> {
  if (step.startsWith("g1_") && step !== "g1_intro") {
    const q = GAME1[idx] ?? GAME1[0]!;
    const base: Record<string, unknown> = {
      n: idx + 1,
      total: GAME1.length,
      category: q.category,
      difficulty: q.difficulty,
      mult: q.multiplier,
      label: q.label ?? null,
    };
    if (step === "g1_q" || step === "g1_reveal" || step === "g1_rank") {
      base["question"] = q.question;
      base["choices"] = q.choices;
    }
    if (step === "g1_reveal" || step === "g1_rank") {
      base["answer"] = q.answer;
      base["explanation"] = q.explanation;
      base["source"] = q.source;
    }
    return base;
  }
  if (step === "g2_q" || step === "g2_reveal") {
    const r = GAME2[idx];
    return { n: idx + 1, total: GAME2.length, ...r };
  }
  if (step === "g3_pick") return { prompts: GAME3_PROMPTS, prompt: prev["prompt"] ?? null };
  if (step.startsWith("g3_") && step !== "g3_intro") {
    return { prompt: prev["prompt"] ?? GAME3_PROMPTS[0] };
  }
  if (step === "final") return { podium: 0 };
  return {};
}

export function revealKey(step: string, idx: number) {
  if (step === "g1_reveal" || step === "g1_rank") return `g1_${idx}`;
  if (step === "g2_reveal") return `g2_${idx}`;
  if (step === "g3_result") return "g3";
  return null;
}
