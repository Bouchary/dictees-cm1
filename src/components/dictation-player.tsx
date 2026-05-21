"use client";

import { Eye, EyeOff, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Speed = "slow" | "normal";

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function DictationPlayer({
  dictation,
  hideTextByDefault = false,
}: {
  dictation: string;
  hideTextByDefault?: boolean;
}) {
  const sentences = splitSentences(dictation);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [supported, setSupported] = useState(true);
  const [textHidden, setTextHidden] = useState(hideTextByDefault);
  const indexRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.speechSynthesis) {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    setTextHidden(hideTextByDefault);
  }, [hideTextByDefault]);

  const getVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === "fr-FR") ??
      voices.find((v) => v.lang.startsWith("fr")) ??
      null
    );
  }, []);

  const speakSentence = useCallback(
    (index: number): Promise<void> => {
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(sentences[index]);
        utterance.lang = "fr-FR";
        utterance.rate = speed === "slow" ? 0.7 : 0.88;
        const voice = getVoice();
        if (voice) utterance.voice = voice;

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      });
    },
    [sentences, speed, getVoice]
  );

  const playFrom = useCallback(
    async (startIndex: number) => {
      cancelledRef.current = false;
      setIsPlaying(true);

      for (let i = startIndex; i < sentences.length; i++) {
        if (cancelledRef.current) break;
        indexRef.current = i;
        setCurrentIndex(i);
        await speakSentence(i);
        if (cancelledRef.current) break;
        if (i < sentences.length - 1) {
          await new Promise((r) => setTimeout(r, 2200));
        }
      }

      if (!cancelledRef.current) {
        setIsPlaying(false);
        setCurrentIndex(null);
        indexRef.current = 0;
      }
    },
    [sentences, speakSentence]
  );

  function handlePlay() {
    if (isPlaying) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setCurrentIndex(null);
    } else {
      playFrom(indexRef.current);
    }
  }

  function handleReplayLast() {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    const idx = Math.max(0, indexRef.current);
    setTimeout(() => playFrom(idx), 100);
  }

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!supported) return null;

  const progressLabel =
    currentIndex !== null
      ? `Phrase ${currentIndex + 1} / ${sentences.length}`
      : sentences.length > 0
      ? `${sentences.length} phrase${sentences.length > 1 ? "s" : ""}`
      : "";

  return (
    <div className="rounded-2xl border border-purple-400/30 bg-purple-400/10 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-purple-200">
          <Volume2 size={18} />
          <span className="text-sm font-semibold">Lecture de la dictée</span>
          {progressLabel && (
            <span className="text-xs text-purple-300/70">{progressLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSpeed(speed === "slow" ? "normal" : "slow")}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              speed === "slow"
                ? "border-purple-400/50 bg-purple-400/20 text-purple-100"
                : "border-white/10 bg-white/[0.06] text-slate-400 hover:text-slate-200"
            }`}
          >
            {speed === "slow" ? "Vitesse : lente" : "Vitesse : normale"}
          </button>

          <button
            type="button"
            onClick={() => setTextHidden((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-slate-300 transition hover:bg-white/10"
            title={textHidden ? "Afficher le texte" : "Cacher le texte"}
          >
            {textHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>

          <button
            type="button"
            onClick={handleReplayLast}
            disabled={currentIndex === null && !isPlaying}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            title="Relire la dernière phrase"
          >
            <RotateCcw size={16} />
          </button>

          <button
            type="button"
            onClick={handlePlay}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isPlaying
                ? "bg-red-400/20 border border-red-400/30 text-red-200 hover:bg-red-400/30"
                : "bg-purple-400 text-slate-950 hover:bg-purple-300"
            }`}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? "Pause" : "Lire la dictée"}
          </button>
        </div>
      </div>

      {sentences.length > 0 && !textHidden && (
        <div className="space-y-1.5">
          {sentences.map((sentence, i) => (
            <p
              key={i}
              className={`rounded-xl px-3 py-2 text-sm leading-6 transition-all duration-300 ${
                currentIndex === i
                  ? "bg-purple-400/20 text-purple-50 font-medium"
                  : "text-slate-400"
              }`}
            >
              {sentence}
            </p>
          ))}
        </div>
      )}

      {sentences.length > 0 && textHidden && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-400/20 bg-purple-400/5 px-3 py-2">
          <div className="flex gap-1">
            {sentences.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  currentIndex === i
                    ? "bg-purple-400 scale-125"
                    : i < (currentIndex ?? -1)
                    ? "bg-purple-400/50"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-purple-300/60">Texte masqué</span>
        </div>
      )}
    </div>
  );
}
