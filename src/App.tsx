import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/game/bits";
import { HostScreen } from "@/components/game/HostScreen";
import { PlayerScreen } from "@/components/game/PlayerScreen";
import { SUBTITLE, TITLE } from "@/data/content";
import { hostKey, rpc } from "@/lib/game";

type Route = { name: "home" } | { name: "host"; code: string } | { name: "play"; code: string };

// GitHub Pages는 정적 호스팅이라 주소 뒤 # 경로로 화면을 나눕니다. 예: #/play/1234
function parse(hash: string): Route {
  const m = hash.replace(/^#/, "").match(/^\/(host|play)\/(\d{4})\/?$/);
  if (m) return { name: m[1] as "host" | "play", code: m[2]! };
  return { name: "home" };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    document.title =
      route.name === "host" ? `진행자 화면 #${route.code} — ${TITLE}` : route.name === "play" ? `참가 #${route.code} — ${TITLE}` : `${TITLE} — 교학 두뇌 서바이벌`;
  }, [route]);

  if (route.name === "host") return <HostScreen key={route.code} code={route.code} />;
  if (route.name === "play") return <PlayerScreen key={route.code} code={route.code} />;
  return <Home />;
}

function Home() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const r = await rpc<{ code: string; token: string }>("create_room");
      try {
        localStorage.setItem(hostKey(r.code), r.token);
      } catch {
        toast.error("이 브라우저는 저장 기능이 꺼져 있어 진행자 화면을 열 수 없습니다. 일반 창에서 열어 주세요.");
        setBusy(false);
        return;
      }
      window.location.hash = `#/host/${r.code}`;
    } catch (e) {
      toast.error(`방을 만들지 못했습니다: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(code)) {
      toast.error("4자리 숫자 코드를 입력해 주세요");
      return;
    }
    window.location.hash = `#/play/${code}`;
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-10 px-6 py-12">
      <div className="anim-rise text-center">
        <div className="mb-4 flex justify-center gap-2 text-2xl">
          <Chip />
          <Chip />
          <Chip />
        </div>
        <h1 className="font-display text-6xl text-gold-gradient glow-gold">{TITLE}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{SUBTITLE}</p>
      </div>

      <form onSubmit={join} className="w-full space-y-3">
        <label className="block text-sm font-semibold text-muted-foreground" htmlFor="code">
          방 코드
        </label>
        <input
          id="code"
          inputMode="numeric"
          maxLength={4}
          value={code}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="0000"
          className="h-20 w-full rounded-2xl border-2 border-border bg-card text-center font-display text-5xl tracking-[0.4em] tabular text-foreground outline-none focus:border-gold"
        />
        <button className="h-16 w-full rounded-2xl bg-gold-gradient font-display text-2xl text-primary-foreground shadow-gold active:scale-[0.98]">
          참가하기
        </button>
      </form>

      <div className="w-full border-t border-border pt-8">
        <button
          onClick={create}
          disabled={busy}
          className="h-14 w-full rounded-2xl border-2 border-gold/50 font-display text-xl text-gold hover:bg-gold/10 disabled:opacity-50"
        >
          {busy ? "방 만드는 중…" : "진행자로 방 만들기"}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">TV에 연결된 노트북에서 눌러 주세요</p>
      </div>
    </main>
  );
}
