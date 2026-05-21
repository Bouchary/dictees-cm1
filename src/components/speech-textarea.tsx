"use client";

import { Mic, MicOff, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SpeechTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  separator?: string;
  helpText?: string;
  dictLabel?: string;
};

function appendText(current: string, addition: string, separator: string) {
  const cleanAddition = addition.trim();

  if (!cleanAddition) return current;
  if (!current.trim()) return cleanAddition;

  const trimmedCurrent = current.trimEnd();

  if (separator === ", ") {
    const hasEndingSeparator =
      trimmedCurrent.endsWith(",") ||
      trimmedCurrent.endsWith(";") ||
      trimmedCurrent.endsWith("\n");

    return hasEndingSeparator
      ? `${trimmedCurrent} ${cleanAddition}`
      : `${trimmedCurrent}, ${cleanAddition}`;
  }

  return `${trimmedCurrent}${separator}${cleanAddition}`;
}

export function SpeechTextarea({
  value,
  onChange,
  placeholder,
  className,
  separator = " ",
  helpText,
  dictLabel = "Dicter",
}: SpeechTextareaProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const latestValueRef = useRef(value);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [speechError, setSpeechError] = useState("");

  latestValueRef.current = value;

  function startListening() {
    setSpeechError("");
    setInterimText("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        "Reconnaissance vocale non disponible dans ce navigateur. Essaie avec Chrome ou Edge."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = "fr-FR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let index = event.resultIndex; index < event.results.length; index++) {
          const transcript = event.results[index][0].transcript;

          if (event.results[index].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          const nextValue = appendText(
            latestValueRef.current,
            finalTranscript,
            separator
          );

          latestValueRef.current = nextValue;
          onChange(nextValue);
        }

        setInterimText(interimTranscript.trim());
      };

      recognition.onerror = (event) => {
        setSpeechError(`Erreur micro : ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText("");
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (error) {
      setSpeechError(
        error instanceof Error
          ? error.message
          : "Impossible de démarrer la reconnaissance vocale."
      );
      setIsListening(false);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-slate-400">
          {helpText || "Tu peux écrire au clavier ou dicter au micro."}
        </div>

        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            isListening
              ? "bg-red-300 text-slate-950 hover:bg-red-200"
              : "border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]"
          }`}
        >
          {isListening ? (
            <>
              <MicOff size={16} />
              Arrêter
            </>
          ) : (
            <>
              <Mic size={16} />
              {dictLabel}
            </>
          )}
        </button>
      </div>

      {isListening && (
        <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-50">
          <Volume2 size={16} />
          <span>Écoute en cours...</span>
          {interimText ? (
            <span className="text-cyan-100/80">“{interimText}”</span>
          ) : null}
        </div>
      )}

      {speechError && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
          {speechError}
        </div>
      )}
    </div>
  );
}