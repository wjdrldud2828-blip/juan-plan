/** 방(room.data)에 단계별로 들어가는 공개 데이터. src/lib/flow.ts의 buildData와 짝을 이룹니다. */
export type RoomData = {
  n?: number;
  total?: number;
  category?: string;
  difficulty?: number;
  mult?: number;
  label?: string | null;
  question?: string;
  choices?: string[];
  answer?: number;
  explanation?: string;
  source?: string;
  a?: string;
  b?: string;
  prompt?: string | null;
  prompts?: string[];
  authors?: boolean;
  podium?: number;
};
