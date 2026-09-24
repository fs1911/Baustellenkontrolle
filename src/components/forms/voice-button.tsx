"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Spracheingabe (Web Speech API, falls vom Browser unterstützt). Text wird angehängt. */
export function VoiceButton({ onText, label = "Diktieren" }: { onText: (text: string) => void; label?: string }) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => !!getRecognition(),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) return;
    r.lang = "de-CH";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const parts: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) parts.push(e.results[i][0].transcript);
      if (parts.length) onText(parts.join(" ").trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-lg border-2 px-3 font-semibold",
        listening
          ? "border-negative bg-negative-soft text-negative animate-pulse"
          : "border-line-strong text-ink bg-white hover:bg-slate-50",
      )}
    >
      {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
      {listening ? "Aufnahme stoppen" : label}
    </button>
  );
}
