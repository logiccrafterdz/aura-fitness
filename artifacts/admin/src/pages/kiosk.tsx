import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, QrCode, ScanLine } from "lucide-react";
import { useVerifyAccess } from "@/hooks/use-api";

type KioskState = "idle" | "verifying" | "allowed" | "denied";

export default function Kiosk() {
  const [state, setState] = useState<KioskState>("idle");
  const [token, setToken] = useState("");
  const [result, setResult] = useState<any>(null);
  const verify = useVerifyAccess();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === "idle") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [state]);

  useEffect(() => {
    if (state === "allowed" || state === "denied") {
      const timer = setTimeout(() => {
        setState("idle");
        setToken("");
        setResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state]);

  async function handleVerify(t: string) {
    const cleaned = t.trim();
    if (!cleaned) return;
    setState("verifying");
    try {
      const data = await verify.mutateAsync({ token: cleaned }) as any;
      setResult(data);
      setState(data.allowed ? "allowed" : "denied");
    } catch {
      setState("denied");
      setResult({ allowed: false, message: "Verification error. Please try again." });
    }
  }

  const bgClass =
    state === "allowed"
      ? "bg-gradient-to-br from-emerald-950 to-green-900"
      : state === "denied"
        ? "bg-gradient-to-br from-red-950 to-rose-900"
        : "bg-gradient-to-br from-gray-950 to-gray-900";

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center transition-all duration-700 relative ${bgClass}`}
    >
      <div className="absolute top-6 w-full flex justify-center">
        <span className="text-white/40 font-serif text-xl tracking-[0.3em] uppercase">
          AURA FITNESS
        </span>
      </div>

      <div className="absolute bottom-6 w-full flex justify-center">
        <span className="text-white/20 text-sm">
          Access Control Terminal · Africa/Algiers
        </span>
      </div>

      {state === "idle" && (
        <div className="flex flex-col items-center gap-8 w-full max-w-sm px-8 text-center">
          <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mb-2">
            <ScanLine className="w-10 h-10 text-white/40" />
          </div>
          <div>
            <h2 className="text-white text-2xl font-semibold mb-2">Member Verification</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Scan your QR code or paste the access token below
            </p>
          </div>
          <div className="w-full space-y-3">
            <input
              ref={inputRef}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify(token)}
              placeholder="Paste QR token or scan..."
              autoComplete="off"
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/25 text-center text-sm focus:outline-none focus:border-white/40 focus:bg-white/8 transition-colors"
            />
            <button
              onClick={() => handleVerify(token)}
              disabled={!token.trim()}
              className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 rounded-xl py-4 text-white font-medium text-sm transition-all duration-200"
            >
              <QrCode className="inline-block w-4 h-4 mr-2" />
              Verify Access
            </button>
          </div>
          <p className="text-white/20 text-xs">
            Staff access via <span className="text-white/40">/login</span>
          </p>
        </div>
      )}

      {state === "verifying" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <Loader2 className="w-20 h-20 text-white/60 animate-spin" />
          <p className="text-white/60 text-2xl font-light tracking-wide">Verifying…</p>
        </div>
      )}

      {state === "allowed" && (
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="relative">
            <div className="w-36 h-36 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-20 h-20 text-emerald-400" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-400/10 animate-ping" />
          </div>
          <div>
            {result?.firstName && (
              <p className="text-white/60 text-xl mb-1">Welcome back,</p>
            )}
            <h2 className="text-white text-5xl font-bold tracking-tight">
              {result?.firstName
                ? `${result.firstName} ${result.lastName}`
                : "Access Granted"}
            </h2>
            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-6 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-semibold text-lg">ACCESS GRANTED</span>
            </div>
            {result?.zone && (
              <p className="text-white/40 mt-3 text-sm">Zone: {result.zone}</p>
            )}
          </div>
        </div>
      )}

      {state === "denied" && (
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="w-36 h-36 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center">
            <XCircle className="w-20 h-20 text-red-400" />
          </div>
          <div>
            <h2 className="text-white text-5xl font-bold tracking-tight">Access Denied</h2>
            <p className="text-red-300/80 text-xl mt-3">
              {result?.message ?? "Access not authorized"}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-6 py-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-semibold text-lg uppercase tracking-wide">
                {result?.reason ?? "denied"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
