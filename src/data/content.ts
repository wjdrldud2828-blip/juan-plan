// 매달 교체용 콘텐츠 파일. 이 파일만 수정하면 문제·질문·주제가 바뀝니다.

export type Game1Question = {
  category: string;
  difficulty: 1 | 2 | 3;
  multiplier: number;
  label?: string;
  question: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  explanation: string;
  source: string;
};

export type Game2Round = { question: string; a: string; b: string };

export const TITLE = "주안 플랜";
export const SUBTITLE = "교학 두뇌 서바이벌 · 주안권 남자부 창제회";

export const GAME_INFO = {
  g1: {
    title: "올인 베팅 퀴즈",
    rule: "분야와 난이도만 보고 먼저 베팅하세요. 맞히면 베팅한 만큼 획득, 틀리면 잃습니다. 마지막 문제는 획득 2배!",
  },
  g2: {
    title: "소수결",
    rule: "A와 B 중 하나를 고르세요. 더 적은 사람이 고른 쪽이 승리! 소수파 전원 +3 피스.",
  },
  g3: {
    title: "블라인드 심사",
    rule: "이름을 가리고 한 줄 답안을 냅니다. 서로의 답안에 투표해 1위 +5, 2위 +3, 3위 +2 피스.",
  },
};

/** 단계별 제한 시간(초) */
export const TIMERS = { bet: 20, question: 20, g2: 15, write: 90, vote: 30 };

export const GAME1: Game1Question[] = [
  {
    category: "학회 역사",
    difficulty: 1,
    multiplier: 1,
    question: "1930년 11월 18일, 창가학회 창립의 원점이 된 일은?",
    choices: ["《창가교육학체계》 제1권 발간", "도다 선생님 제2대 회장 취임", "75만 세대 포교 달성", "국제창가학회(SGI) 결성"],
    answer: 0,
    explanation:
      "교육의 목적은 '가치 창조'라는 마키구치 선생님의 학설을 도다 선생님이 정리·편집해, 1930년 11월 18일 '발행처 창가교육학회' 이름으로 제1권을 발간했습니다. 이날이 창립의 원점입니다.",
    source: "법련 423호(2024.11.1) 「학회역사 — 창가학회 창립기념일」",
  },
  {
    category: "어서",
    difficulty: 2,
    multiplier: 1,
    question: "백미(白米)는 백미가 아니라 즉 (      )이니라.",
    choices: ["목숨", "마음", "공덕", "보배"],
    answer: 0,
    explanation:
      "문하가 정성껏 바친 백미에 답하신 말씀입니다. 그 진심은 옛 성인이 부처와 법을 위해 목숨을 바친 것과 다름없다고 하셨습니다.",
    source: "어서 1597쪽 · 법련 446호(2026.10.1) 「행복대화 플러스+」",
  },
  {
    category: "기초교학",
    difficulty: 2,
    multiplier: 1,
    question: "일념삼천의 '삼천'을 이루는 요소가 아닌 것은?",
    choices: ["십계호구(十界互具)", "십여시(十如是)", "삼세간(三世間)", "구식(九識)"],
    answer: 3,
    explanation:
      "삼천은 십계호구(100) × 십여시(10) × 삼세간(3)으로 이루어집니다. 천태대사가 《마하지관》에서 체계화한 법리입니다.",
    source: "SGI 기초교학 · 천태대사 《마하지관》",
  },
  {
    category: "어서",
    difficulty: 3,
    multiplier: 1,
    question: "마음이 어리석고 조그마한 것이라도 (      ) 사람에게 공양하면 공덕이 크니라.",
    choices: ["진실한", "지혜로운", "부유한", "존귀한"],
    answer: 0,
    explanation:
      "서툴고 부족해 보여도 진실한 마음을 다해 진실한 법에 공양하면, 그 공덕은 결코 작지 않다는 말씀입니다.",
    source: "어서 1595쪽 · 법련 446호(2026.10.1) 「행복대화 플러스+」",
  },
  {
    category: "학회 역사",
    difficulty: 3,
    multiplier: 2,
    label: "최종 문제 · 획득 2배",
    question: "도다 선생님이 발표한 '75만 세대 포교'가 달성된 때는?",
    choices: ["1951년 5월", "1957년 12월", "1960년 5월", "1975년 1월"],
    answer: 1,
    explanation:
      "1951년 5월 제2대 회장 취임 때 발표한 원업을 1957년 12월에 달성했습니다. 1960년 5월은 이케다 선생님 제3대 회장 취임, 1975년 1월은 SGI 결성입니다.",
    source: "법련 423호(2024.11.1) 「학회역사 — 창가학회 창립기념일」",
  },
];

export const GAME2: Game2Round[] = [
  { question: "창제, 나는?", a: "아침형", b: "저녁형" },
  { question: "힘든 일이 생기면 먼저?", a: "일단 창제부터", b: "선배에게 연락부터" },
  { question: "후배를 격려할 때 나는?", a: "전화 한 통", b: "카톡 한 줄" },
];

export const GAME3_PROMPTS: string[] = [
  "20대 친구에게 '일념삼천'을 한 줄로 설명한다면?",
  "'숙명전환'을 요즘 말로 한 줄 요약한다면?",
  "'인간혁명'을 내 SNS 프로필 한 줄로 쓴다면?",
];

// 리허설용 봇이 내는 한 줄 답안
export const BOT_TEXTS = [
  "한 순간의 마음에 우주가 다 들어있다",
  "오늘의 나를 바꾸면 내일이 바뀐다",
  "새벽 창제로 시작하는 인생 리셋",
  "어제보다 한 걸음 더, 그게 혁명",
];
