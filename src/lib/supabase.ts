import { createClient } from "@supabase/supabase-js";

// 게임 서버 주소와 공개 키 (공개 키는 브라우저에 노출되도록 만들어진 값입니다.
// 실제 권한 검사는 서버 함수가 진행자·참가자 토큰으로 합니다.)
export const SUPABASE_URL = "https://c--5a8c4575-6076-4eb6-b0d0-554b7084e81a-prod.lovable.cloud";
export const SUPABASE_KEY = "sb_publishable_9-KrklJ5SKSkbCNQNNQIRA_uRiURtuN";

// 새 형식의 공개 키는 Bearer 토큰이 아니므로 Authorization 헤더를 빼고 apikey로만 보냅니다.
const keyFetch: typeof fetch = (input, init) => {
  const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  if (headers.get("Authorization") === `Bearer ${SUPABASE_KEY}`) headers.delete("Authorization");
  headers.set("apikey", SUPABASE_KEY);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: keyFetch },
  auth: { persistSession: false, autoRefreshToken: false },
});
