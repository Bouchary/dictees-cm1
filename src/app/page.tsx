"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  History,
  LibraryBig,
  Loader2,
  PencilLine,
  Printer,
  RefreshCcw,
  RotateCcw,
  Save,
  School,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DictationPlayer } from "@/components/dictation-player";
import { SpeechTextarea } from "@/components/speech-textarea";
import {
  AppBackup,
  Difficulty,
  DictationResult,
  ErrorCategory,
  GenerateDictationInput,
  GrammarFocus,
  HistoryItem,
  Length,
  PrintMode,
  SchoolDictation,
  Tense,
} from "@/lib/types";

const grammarOptions: { value: GrammarFocus; label: string }[] = [
  { value: "accord-groupe-nominal", label: "Accords dans le groupe nominal" },
  { value: "accord-sujet-verbe", label: "Accord sujet-verbe" },
  { value: "pluriel", label: "Singulier / pluriel" },
  { value: "feminin", label: "Masculin / féminin" },
  { value: "homophones", label: "Homophones simples" },
  { value: "conjugaison", label: "Conjugaison" },
  { value: "ponctuation", label: "Ponctuation" },
  { value: "mots-invariables", label: "Mots invariables" },
];

const levelOptions: { value: "CE1" | "CE2" | "CM1" | "CM2"; label: string }[] = [
  { value: "CE1", label: "CE1" },
  { value: "CE2", label: "CE2" },
  { value: "CM1", label: "CM1" },
  { value: "CM2", label: "CM2" },
];

const tenseOptions: { value: Tense; label: string }[] = [
  { value: "present", label: "Présent" },
  { value: "imparfait", label: "Imparfait" },
  { value: "futur", label: "Futur" },
  { value: "passe-compose", label: "Passé composé" },
  { value: "mixte", label: "Mixte" },
];

function getDifficultyOptions(level: string): { value: Difficulty; label: string }[] {
  return [
    { value: "facile", label: "Facile" },
    { value: "standard", label: `Standard ${level}` },
    { value: "avancee", label: "Plus difficile" },
  ];
}

const lengthOptions: { value: Length; label: string }[] = [
  { value: "courte", label: "Courte" },
  { value: "moyenne", label: "Moyenne" },
  { value: "longue", label: "Longue" },
];

const printModeOptions: { value: PrintMode; label: string }[] = [
  { value: "complete", label: "Fiche complète" },
  { value: "student", label: "Version élève" },
  { value: "parent", label: "Fiche parent" },
];

const HISTORY_STORAGE_KEY = "dictees-cm1-history-v23";
const SCHOOL_STORAGE_KEY = "dictees-cm1-school-dictations-v1";

const initialInput: GenerateDictationInput = {
  mode: "words",
  level: "CM1",
  sourceDictation: "",
  requiredWords: [],
  errorsToReview: [],
  tense: "present",
  difficulty: "standard",
  length: "moyenne",
  grammarFocus: ["accord-groupe-nominal", "accord-sujet-verbe"],
  theme: "quotidien, école, famille ou nature",
};

const initialSchoolForm: Omit<SchoolDictation, "id" | "createdAt"> = {
  title: "",
  schoolDate: "",
  sourceText: "",
  words: [],
  grammarFocus: ["accord-groupe-nominal", "accord-sujet-verbe"],
  tense: "present",
  difficulty: "standard",
  notes: "",
};

type ErrorStat = {
  category: ErrorCategory;
  label: string;
  count: number;
  examples: string[];
};

type PrioritySummary = {
  mainCategoryLabel: string;
  mainCount: number;
  categoryCount: number;
  totalErrors: number;
  priorityLabels: string[];
};

const categoryLabels: Record<ErrorCategory, string> = {
  pluriel: "Pluriel",
  "accord-sujet-verbe": "Accord sujet-verbe",
  homophones: "Homophones",
  conjugaison: "Conjugaison",
  apostrophe: "Apostrophe",
  accents: "Accents",
  ponctuation: "Ponctuation",
  "mots-invariables": "Mots invariables",
  autre: "Autre",
};

const categoryToGrammarFocus: Partial<Record<ErrorCategory, GrammarFocus[]>> = {
  pluriel: ["pluriel", "accord-groupe-nominal"],
  "accord-sujet-verbe": ["accord-sujet-verbe"],
  homophones: ["homophones"],
  conjugaison: ["conjugaison", "accord-sujet-verbe"],
  ponctuation: ["ponctuation"],
  "mots-invariables": ["mots-invariables"],
  autre: [],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyError(error: string): ErrorCategory {
  const value = normalizeText(error);

  if (
    value.includes("pluriel") ||
    value.includes("singulier") ||
    value.includes("s du pluriel") ||
    value.includes("oubli du s") ||
    value.includes("oubli de s") ||
    value.includes("nom au pluriel")
  ) {
    return "pluriel";
  }

  if (
    value.includes("sujet") ||
    value.includes("verbe") ||
    value.includes("accord sujet") ||
    value.includes("ils ") ||
    value.includes("elles ")
  ) {
    return "accord-sujet-verbe";
  }

  if (
    value.includes("son/sont") ||
    value.includes("a/a") ||
    value.includes("a/à") ||
    value.includes("et/est") ||
    value.includes("ou/où") ||
    value.includes("ce/se") ||
    value.includes("ces/ses") ||
    value.includes("homophone")
  ) {
    return "homophones";
  }

  if (
    value.includes("conjugaison") ||
    value.includes("terminaison") ||
    value.includes("-ent") ||
    value.includes("-ont") ||
    value.includes("chanterons") ||
    value.includes("chanteront") ||
    value.includes("imparfait") ||
    value.includes("futur") ||
    value.includes("present") ||
    value.includes("passe compose")
  ) {
    return "conjugaison";
  }

  if (
    value.includes("apostrophe") ||
    value.includes("l'") ||
    value.includes("d'") ||
    value.includes("l ecole") ||
    value.includes("lecole")
  ) {
    return "apostrophe";
  }

  if (
    value.includes("accent") ||
    value.includes("ecrit e") ||
    value.includes("é") ||
    value.includes("è") ||
    value.includes("ê")
  ) {
    return "accents";
  }

  if (
    value.includes("point") ||
    value.includes("virgule") ||
    value.includes("majuscule") ||
    value.includes("ponctuation")
  ) {
    return "ponctuation";
  }

  if (
    value.includes("mot invariable") ||
    value.includes("toujours") ||
    value.includes("beaucoup") ||
    value.includes("demain") ||
    value.includes("pendant")
  ) {
    return "mots-invariables";
  }

  return "autre";
}

function parseList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export default function Home() {
  const [input, setInput] = useState<GenerateDictationInput>(initialInput);
  const [requiredWordsText, setRequiredWordsText] = useState("");
  const [errorsText, setErrorsText] = useState("");
  const [observedErrorsText, setObservedErrorsText] = useState("");
  const [result, setResult] = useState<DictationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [schoolDictations, setSchoolDictations] = useState<SchoolDictation[]>([]);
  const [schoolForm, setSchoolForm] =
    useState<Omit<SchoolDictation, "id" | "createdAt">>(initialSchoolForm);
  const [schoolWordsText, setSchoolWordsText] = useState("");
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [printMode, setPrintMode] = useState<PrintMode>("complete");
  const [activeTab, setActiveTab] = useState<"bibliotheque" | "generer" | "pratiquer" | "suivi">("bibliotheque");
  const [studentMode, setStudentMode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    const rawSchool = localStorage.getItem(SCHOOL_STORAGE_KEY);

    if (rawHistory) {
      try {
        setHistory(JSON.parse(rawHistory));
      } catch {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    }

    if (rawSchool) {
      try {
        setSchoolDictations(JSON.parse(rawSchool));
      } catch {
        localStorage.removeItem(SCHOOL_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(SCHOOL_STORAGE_KEY, JSON.stringify(schoolDictations));
  }, [schoolDictations]);

  const errorStats = useMemo(() => {
    const stats = new Map<ErrorCategory, ErrorStat>();

    for (const item of history) {
      for (const observedError of item.observedErrors || []) {
        const category = classifyError(observedError);
        const existing = stats.get(category);

        if (existing) {
          existing.count += 1;
          if (existing.examples.length < 5) existing.examples.push(observedError);
        } else {
          stats.set(category, {
            category,
            label: categoryLabels[category],
            count: 1,
            examples: [observedError],
          });
        }
      }
    }

    return Array.from(stats.values()).sort((a, b) => b.count - a.count);
  }, [history]);

  const totalObservedErrors = useMemo(() => {
    return history.reduce(
      (total, item) => total + (item.observedErrors?.length || 0),
      0
    );
  }, [history]);

  const prioritySummary = useMemo<PrioritySummary | null>(() => {
    if (errorStats.length === 0) return null;

    const topStats = errorStats.slice(0, 2);

    return {
      mainCategoryLabel: errorStats[0].label,
      mainCount: errorStats[0].count,
      categoryCount: errorStats.length,
      totalErrors: totalObservedErrors,
      priorityLabels: topStats.map((stat) => stat.label),
    };
  }, [errorStats, totalObservedErrors]);

  const canGenerate = useMemo(() => {
    const hasRequiredWords = requiredWordsText.trim().length > 0;
    const hasSourceDictation =
      input.mode === "source" &&
      Boolean(input.sourceDictation && input.sourceDictation.trim().length > 0);
    const hasKnownErrors = errorsText.trim().length > 0;

    return hasRequiredWords || hasSourceDictation || hasKnownErrors;
  }, [requiredWordsText, input.mode, input.sourceDictation, errorsText]);

  function toggleGrammar(value: GrammarFocus) {
    setInput((current) => {
      const exists = current.grammarFocus.includes(value);

      return {
        ...current,
        grammarFocus: exists
          ? current.grammarFocus.filter((item) => item !== value)
          : [...current.grammarFocus, value],
      };
    });
  }

  function toggleSchoolGrammar(value: GrammarFocus) {
    setSchoolForm((current) => {
      const exists = current.grammarFocus.includes(value);

      return {
        ...current,
        grammarFocus: exists
          ? current.grammarFocus.filter((item) => item !== value)
          : [...current.grammarFocus, value],
      };
    });
  }

  async function callGenerateApi(payload: GenerateDictationInput) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Erreur lors de la génération.");
    }

    return data as DictationResult;
  }

  async function generateFromPayload(
    payload: GenerateDictationInput,
    options?: { reviewOfId?: string; schoolDictationId?: string }
  ) {
    setError("");
    setSaveMessage("");
    setDataMessage("");
    setResult(null);
    setCopied(false);
    setIsLoading(true);

    try {
      const data = await callGenerateApi(payload);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        input: payload,
        result: data,
        observedErrors: [],
        reviewStatus: "a-faire",
        reviewOfId: options?.reviewOfId,
        schoolDictationId: options?.schoolDictationId,
      };

      setInput(payload);
      setRequiredWordsText(payload.requiredWords.join(", "));
      setErrorsText(payload.errorsToReview?.join(", ") || "");
      setObservedErrorsText("");
      setElapsedSeconds(0);
      setResult(data);
      setCurrentHistoryId(item.id);
      setHistory((current) => [item, ...current].slice(0, 30));
      setActiveTab("pratiquer");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateDictation() {
    if (!canGenerate || isLoading) return;

    const payload: GenerateDictationInput = {
      ...input,
      requiredWords: parseList(requiredWordsText),
      errorsToReview: parseList(errorsText),
    };

    await generateFromPayload(payload);
  }

  async function generateReviewDictation() {
    if (!result || isLoading) return;

    const observedErrors = parseList(observedErrorsText);
    const previousInput = input;

    const revisionWords = uniqueList([
      ...previousInput.requiredWords,
      ...parseList(requiredWordsText),
      ...result.usedWords,
      ...result.wordsToReview,
    ]);

    const revisionErrors = uniqueList([
      ...(previousInput.errorsToReview || []),
      ...parseList(errorsText),
      ...observedErrors,
    ]);

    if (revisionWords.length === 0 && revisionErrors.length === 0) {
      setError(
        "Impossible de générer une révision : ajoute au moins une erreur observée ou des mots à retravailler."
      );
      return;
    }

    if (currentHistoryId) {
      setHistory((current) =>
        current.map((item) =>
          item.id === currentHistoryId
            ? {
                ...item,
                observedErrors,
                reviewStatus: observedErrors.length
                  ? "a-revoir"
                  : item.reviewStatus,
              }
            : item
        )
      );
    }

    const payload: GenerateDictationInput = {
      ...previousInput,
      mode: "words",
      sourceDictation: "",
      requiredWords: revisionWords,
      errorsToReview: revisionErrors,
      difficulty:
        previousInput.difficulty === "avancee"
          ? "standard"
          : previousInput.difficulty,
      length:
        previousInput.length === "longue" ? "moyenne" : previousInput.length,
      theme: previousInput.theme || "révision ciblée",
    };

    await generateFromPayload(payload, {
      reviewOfId: currentHistoryId || undefined,
    });
  }

  async function generateCategoryReview(stat: ErrorStat) {
    if (isLoading) return;

    const grammarFocus = uniqueList([
      ...input.grammarFocus,
      ...(categoryToGrammarFocus[stat.category] || []),
    ]) as GrammarFocus[];

    const payload: GenerateDictationInput = {
      mode: "words",
      level: input.level,
      sourceDictation: "",
      requiredWords: uniqueList([
        ...parseList(requiredWordsText),
        ...(result?.wordsToReview || []),
        ...(result?.usedWords || []),
      ]),
      errorsToReview: uniqueList([
        ...parseList(errorsText),
        ...stat.examples,
        `Révision ciblée : ${stat.label}`,
      ]),
      tense: input.tense,
      difficulty: "standard",
      length: "moyenne",
      grammarFocus,
      theme: `révision ciblée : ${stat.label.toLowerCase()}`,
    };

    await generateFromPayload(payload);
  }

  async function generatePriorityReview() {
    if (isLoading || errorStats.length === 0) return;

    const priorityStats = errorStats.slice(0, 2);

    const grammarFocus = uniqueList([
      ...input.grammarFocus,
      ...priorityStats.flatMap(
        (stat) => categoryToGrammarFocus[stat.category] || []
      ),
    ]) as GrammarFocus[];

    const priorityExamples = priorityStats.flatMap((stat) => stat.examples);

    const payload: GenerateDictationInput = {
      mode: "words",
      level: input.level,
      sourceDictation: "",
      requiredWords: uniqueList([
        ...parseList(requiredWordsText),
        ...(result?.wordsToReview || []),
        ...(result?.usedWords || []),
      ]),
      errorsToReview: uniqueList([
        ...parseList(errorsText),
        ...priorityExamples,
        `Révision prioritaire : ${priorityStats
          .map((stat) => stat.label)
          .join(" + ")}`,
      ]),
      tense: input.tense,
      difficulty: "standard",
      length: "moyenne",
      grammarFocus,
      theme: `révision prioritaire : ${priorityStats
        .map((stat) => stat.label.toLowerCase())
        .join(" et ")}`,
    };

    await generateFromPayload(payload);
  }

  function saveObservedErrors() {
    if (!currentHistoryId) {
      setError("Aucune dictée active à mettre à jour.");
      return;
    }

    const observedErrors = parseList(observedErrorsText);

    setHistory((current) =>
      current.map((item) =>
        item.id === currentHistoryId
          ? {
              ...item,
              observedErrors,
              reviewStatus: observedErrors.length ? "a-revoir" : "faite",
              ...(elapsedSeconds > 0 ? { duration: elapsedSeconds } : {}),
            }
          : item
      )
    );

    setSaveMessage(
      observedErrors.length
        ? "Erreurs enregistrées. Le tableau de suivi est mis à jour."
        : "Dictée marquée comme faite sans erreur observée."
    );

    window.setTimeout(() => setSaveMessage(""), 2500);
  }

  function loadFromHistory(item: HistoryItem) {
    setInput(item.input);
    setRequiredWordsText(item.input.requiredWords.join(", "));
    setErrorsText(item.input.errorsToReview?.join(", ") || "");
    setObservedErrorsText(item.observedErrors?.join("\n") || "");
    setElapsedSeconds(0);
    setResult(item.result);
    setCurrentHistoryId(item.id);
    setCopied(false);
    setSaveMessage("");
    setDataMessage("");
    setError("");
    setActiveTab("pratiquer");
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function addSchoolDictation() {
    const words = parseList(schoolWordsText);

    if (!schoolForm.title.trim()) {
      setError("Ajoute un titre pour la dictée de l’école.");
      return;
    }

    if (!schoolForm.sourceText.trim() && words.length === 0) {
      setError("Ajoute au moins le texte source ou des mots à apprendre.");
      return;
    }

    const item: SchoolDictation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...schoolForm,
      title: schoolForm.title.trim(),
      sourceText: schoolForm.sourceText.trim(),
      notes: schoolForm.notes.trim(),
      words,
    };

    setSchoolDictations((current) => [item, ...current]);
    setSchoolForm(initialSchoolForm);
    setSchoolWordsText("");
    setError("");
    setDataMessage("Dictée de l’école enregistrée.");

    window.setTimeout(() => setDataMessage(""), 2500);
  }

  function deleteSchoolDictation(id: string) {
    setSchoolDictations((current) => current.filter((item) => item.id !== id));
  }

  function loadSchoolDictation(item: SchoolDictation) {
    const payload: GenerateDictationInput = {
      mode: "source",
      level: input.level,
      sourceDictation: item.sourceText,
      requiredWords: item.words,
      errorsToReview: parseList(item.notes),
      tense: item.tense,
      difficulty: item.difficulty,
      length: "moyenne",
      grammarFocus: item.grammarFocus,
      theme: item.title,
    };

    setInput(payload);
    setRequiredWordsText(payload.requiredWords.join(", "));
    setErrorsText(payload.errorsToReview?.join(", ") || "");
    setDataMessage("Dictée chargée dans le formulaire.");
    setError("");

    window.setTimeout(() => setDataMessage(""), 2500);
  }

  async function generateVariantFromSchool(item: SchoolDictation) {
    const payload: GenerateDictationInput = {
      mode: "source",
      level: input.level,
      sourceDictation: item.sourceText,
      requiredWords: item.words,
      errorsToReview: parseList(item.notes),
      tense: item.tense,
      difficulty: item.difficulty,
      length: "moyenne",
      grammarFocus: item.grammarFocus,
      theme: `variante de ${item.title}`,
    };

    await generateFromPayload(payload, { schoolDictationId: item.id });
  }

  async function generateReviewFromSchool(item: SchoolDictation) {
    const payload: GenerateDictationInput = {
      mode: "words",
      level: input.level,
      sourceDictation: "",
      requiredWords: item.words,
      errorsToReview: uniqueList([
        ...parseList(item.notes),
        `Révision de la dictée source : ${item.title}`,
      ]),
      tense: item.tense,
      difficulty: "standard",
      length: "moyenne",
      grammarFocus: item.grammarFocus,
      theme: `révision de ${item.title}`,
    };

    await generateFromPayload(payload, { schoolDictationId: item.id });
  }

  function clearHistory() {
    setHistory([]);
    setCurrentHistoryId(null);
    setObservedErrorsText("");
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  function exportData() {
    const backup: AppBackup = {
      version: "2.6",
      exportedAt: new Date().toISOString(),
      history,
      schoolDictations,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `dictees-cm1-sauvegarde-${date}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppBackup>;

      if (!Array.isArray(parsed.history) || !Array.isArray(parsed.schoolDictations)) {
        throw new Error("Fichier de sauvegarde invalide.");
      }

      setHistory(parsed.history);
      setSchoolDictations(parsed.schoolDictations);
      setDataMessage("Sauvegarde importée correctement.");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’importer cette sauvegarde."
      );
    } finally {
      event.target.value = "";
      window.setTimeout(() => setDataMessage(""), 2500);
    }
  }

  async function copyDictation() {
    if (!result) return;

    const text = [
      result.title,
      "",
      "DICTÉE À LIRE",
      result.dictation,
      "",
      "CORRECTION",
      result.correction,
      "",
      "VERSION À TROUS",
      result.studentExercise,
      "",
      "FICHE PARENT",
      result.parentSheet,
      "",
      "MOTS À REVOIR",
      result.wordsToReview.join(", "),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);

    window.setTimeout(() => setCopied(false), 1800);
  }

  function printSheet() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="no-print relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_35%)]" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
              <School size={17} />
              Atelier de dictées personnalisées — {input.level}
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Créer, suivre et réviser les dictées.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Bibliothèque des dictées de l’école, suivi des erreurs, révisions
              ciblées, saisie au clavier ou au micro, impression et sauvegarde locale.
            </p>
          </div>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur md:min-w-[320px]">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="rounded-xl bg-cyan-300/15 p-3 text-cyan-200">
                <Target size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Niveau</p>
                <select
                  value={input.level}
                  onChange={(e) =>
                    setInput((current) => ({
                      ...current,
                      level: e.target.value as "CE1" | "CE2" | "CM1" | "CM2",
                    }))
                  }
                  className="mt-0.5 w-full bg-transparent font-semibold text-slate-100 focus:outline-none"
                >
                  {levelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-slate-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {schoolDictations.length > 0 ? (
              <Stat icon={<LibraryBig />} label="Dictées école" value={`${schoolDictations.length}`} />
            ) : (
              <StatEmpty icon={<LibraryBig />} label="Bibliothèque" hint="Ajoute une dictée de l'école" />
            )}
            {totalObservedErrors > 0 ? (
              <Stat icon={<Brain />} label="Erreurs suivies" value={`${totalObservedErrors}`} />
            ) : (
              <StatEmpty icon={<Brain />} label="Suivi des erreurs" hint="Pratique pour commencer le suivi" />
            )}
          </div>
        </div>
      </section>

      <div className="no-print mx-auto flex max-w-7xl items-center gap-3 px-5 pt-6 md:px-8">
        {!studentMode && (
          <div className="flex-1">
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} hasResult={!!result} />
          </div>
        )}
        {studentMode && (
          <div className="flex-1 rounded-2xl border border-purple-400/30 bg-purple-400/10 px-4 py-2.5 text-sm font-semibold text-purple-200">
            Mode élève actif — interface simplifiée
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            const next = !studentMode;
            setStudentMode(next);
            if (next) setActiveTab("pratiquer");
          }}
          className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
            studentMode
              ? "border-purple-400/40 bg-purple-400/15 text-purple-200 hover:bg-purple-400/25"
              : "border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
          }`}
        >
          {studentMode ? "← Mode enseignant" : "Mode élève"}
        </button>
      </div>

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={importData}
        />

        {activeTab === "bibliotheque" && (
          <div className="no-print space-y-6">
            {schoolDictations.length === 0 && history.length === 0 && (
              <OnboardingGuide onGoGenerate={() => setActiveTab("generer")} />
            )}
            <SchoolLibraryPanel
              schoolForm={schoolForm}
              setSchoolForm={setSchoolForm}
              schoolWordsText={schoolWordsText}
              setSchoolWordsText={setSchoolWordsText}
              schoolDictations={schoolDictations}
              onToggleSchoolGrammar={toggleSchoolGrammar}
              onAdd={addSchoolDictation}
              onLoad={loadSchoolDictation}
              onVariant={generateVariantFromSchool}
              onReview={generateReviewFromSchool}
              onDelete={deleteSchoolDictation}
              isLoading={isLoading}
              level={input.level}
            />
          </div>
        )}

        {activeTab === "generer" && (
          <div className="no-print">
            <GenerationPanel
              input={input}
              setInput={setInput}
              requiredWordsText={requiredWordsText}
              setRequiredWordsText={setRequiredWordsText}
              errorsText={errorsText}
              setErrorsText={setErrorsText}
              canGenerate={canGenerate}
              isLoading={isLoading}
              error={error}
              onGenerate={generateDictation}
              onToggleGrammar={toggleGrammar}
            />
          </div>
        )}

        {activeTab === "pratiquer" && (
          <div ref={resultRef} className="print-sheet space-y-6">
            {!result ? (
              <EmptyResult onGoGenerate={studentMode ? undefined : () => setActiveTab("generer")} />
            ) : (
              <ResultPanel
                result={result}
                observedErrorsText={observedErrorsText}
                setObservedErrorsText={setObservedErrorsText}
                onSaveObservedErrors={saveObservedErrors}
                onGenerateReview={generateReviewDictation}
                onRegenerate={generateDictation}
                isLoading={isLoading}
                onPrint={printSheet}
                onCopy={copyDictation}
                copied={copied}
                saveMessage={saveMessage}
                printMode={printMode}
                setPrintMode={setPrintMode}
                studentMode={studentMode}
                onTimerUpdate={setElapsedSeconds}
              />
            )}
          </div>
        )}

        {activeTab === "suivi" && (
          <div className="no-print space-y-6">
            <ErrorTrackingPanel
              stats={errorStats}
              total={totalObservedErrors}
              prioritySummary={prioritySummary}
              isLoading={isLoading}
              onGenerateCategoryReview={generateCategoryReview}
              onGeneratePriorityReview={generatePriorityReview}
              history={history}
            />

            <HistoryPanel
              history={history}
              onLoad={loadFromHistory}
              onClear={clearHistory}
            />

            <DataPanel
              onExport={exportData}
              onImportClick={() => importInputRef.current?.click()}
              dataMessage={dataMessage}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function DataPanel({
  onExport,
  onImportClick,
  dataMessage,
}: {
  onExport: () => void;
  onImportClick: () => void;
  dataMessage: string;
}) {
  return (
    <Card>
      <CardHeader
        icon={<Download />}
        title="Sauvegarde"
        description="Exporte ou importe l’historique et la bibliothèque des dictées."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onExport}
          className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Download size={18} />
          Exporter JSON
        </button>

        <button
          type="button"
          onClick={onImportClick}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/[0.1]"
        >
          <Upload size={18} />
          Importer JSON
        </button>
      </div>

      {dataMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
          {dataMessage}
        </div>
      )}
    </Card>
  );
}

function GenerationPanel({
  input,
  setInput,
  requiredWordsText,
  setRequiredWordsText,
  errorsText,
  setErrorsText,
  canGenerate,
  isLoading,
  error,
  onGenerate,
  onToggleGrammar,
}: {
  input: GenerateDictationInput;
  setInput: (value: React.SetStateAction<GenerateDictationInput>) => void;
  requiredWordsText: string;
  setRequiredWordsText: (value: string) => void;
  errorsText: string;
  setErrorsText: (value: string) => void;
  canGenerate: boolean;
  isLoading: boolean;
  error: string;
  onGenerate: () => void;
  onToggleGrammar: (value: GrammarFocus) => void;
}) {
  return (
    <Card>
      <CardHeader
        icon={<Wand2 />}
        title="Paramètres de génération"
        description="Choisis le type d’entraînement, les mots, le temps et les accords à travailler."
      />

      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeButton
            active={input.mode === "words"}
            icon={<Sparkles size={19} />}
            title="Mots imposés"
            description="Créer une dictée à partir d’une liste de mots."
            onClick={() => setInput((current) => ({ ...current, mode: "words" }))}
          />
          <ModeButton
            active={input.mode === "source"}
            icon={<BookOpen size={19} />}
            title="Dictée source"
            description="Créer une variante d’une dictée déjà faite."
            onClick={() => setInput((current) => ({ ...current, mode: "source" }))}
          />
        </div>

        {input.mode === "source" && (
          <Field label="Dictée déjà faite">
            <SpeechTextarea
              value={input.sourceDictation || ""}
              onChange={(value) =>
                setInput((current) => ({
                  ...current,
                  sourceDictation: value,
                }))
              }
              placeholder="Colle ou dicte ici la dictée donnée par l’école..."
              className="input min-h-32 resize-y"
              separator=" "
              helpText="Tu peux coller le texte ou le dicter au micro."
              dictLabel="Dicter le texte source"
            />
          </Field>
        )}

        <Field
          label="Mots imposés"
          description="Mots que tu veux voir apparaître dans la dictée générée."
        >
          <SpeechTextarea
            value={requiredWordsText}
            onChange={setRequiredWordsText}
            placeholder="Exemple : prochain, élèves, classe, chanteront, anglais, cour, école"
            className="input min-h-24 resize-y"
            separator=", "
            helpText="Dicte les mots un par un. Ils seront ajoutés comme une liste."
            dictLabel="Dicter les mots imposés"
          />
        </Field>

        <Field label="Erreurs déjà connues à retravailler, optionnel">
          <textarea
            value={errorsText}
            onChange={(e) => setErrorsText(e.target.value)}
            placeholder="Exemple : oublie le -s du pluriel, confond son/sont, oublie les accents..."
            className="input min-h-20 resize-y"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Temps"
            value={input.tense}
            options={tenseOptions}
            onChange={(value) =>
              setInput((current) => ({ ...current, tense: value as Tense }))
            }
          />

          <SelectField
            label="Difficulté"
            value={input.difficulty}
            options={getDifficultyOptions(input.level)}
            onChange={(value) =>
              setInput((current) => ({
                ...current,
                difficulty: value as Difficulty,
              }))
            }
          />

          <SelectField
            label="Longueur"
            value={input.length}
            options={lengthOptions}
            onChange={(value) =>
              setInput((current) => ({ ...current, length: value as Length }))
            }
          />
        </div>

        <Field label="Thème">
          <input
            value={input.theme}
            onChange={(e) =>
              setInput((current) => ({ ...current, theme: e.target.value }))
            }
            placeholder="Exemple : nature, école, animaux, aventure, quotidien..."
            className="input"
          />
        </Field>

        <Field label="Notions à travailler">
          <NotionsCheckboxes
            selected={input.grammarFocus}
            onToggle={onToggleGrammar}
          />
        </Field>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isLoading}
          className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-4 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Génération en cours...
            </>
          ) : (
            <>
              <PencilLine size={20} />
              Générer la dictée
            </>
          )}
        </button>

        {!canGenerate && (
          <p className="text-sm text-amber-200">
            Ajoute au moins un mot imposé, une dictée source ou une erreur connue à retravailler.
          </p>
        )}
      </div>
    </Card>
  );
}

function SchoolLibraryPanel({
  schoolForm,
  setSchoolForm,
  schoolWordsText,
  setSchoolWordsText,
  schoolDictations,
  onToggleSchoolGrammar,
  onAdd,
  onLoad,
  onVariant,
  onReview,
  onDelete,
  isLoading,
  level,
}: {
  schoolForm: Omit<SchoolDictation, "id" | "createdAt">;
  setSchoolForm: (
    value: React.SetStateAction<Omit<SchoolDictation, "id" | "createdAt">>
  ) => void;
  schoolWordsText: string;
  setSchoolWordsText: (value: string) => void;
  schoolDictations: SchoolDictation[];
  onToggleSchoolGrammar: (value: GrammarFocus) => void;
  onAdd: () => void;
  onLoad: (item: SchoolDictation) => void;
  onVariant: (item: SchoolDictation) => void;
  onReview: (item: SchoolDictation) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  level: string;
}) {
  return (
    <Card>
      <CardHeader
        icon={<LibraryBig />}
        title="Bibliothèque des dictées de l’école"
        description="Enregistre les dictées déjà faites pour générer ensuite des variantes ou des révisions."
      />

      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titre">
            <input
              value={schoolForm.title}
              onChange={(e) =>
                setSchoolForm((current) => ({
                  ...current,
                  title: e.target.value,
                }))
              }
              placeholder="Exemple : Les animaux de la forêt"
              className="input"
            />
          </Field>

          <Field label="Date de la dictée">
            <input
              type="date"
              value={schoolForm.schoolDate}
              onChange={(e) =>
                setSchoolForm((current) => ({
                  ...current,
                  schoolDate: e.target.value,
                }))
              }
              className="input"
            />
          </Field>
        </div>

        <Field label="Texte original">
          <SpeechTextarea
            value={schoolForm.sourceText}
            onChange={(value) =>
              setSchoolForm((current) => ({
                ...current,
                sourceText: value,
              }))
            }
            placeholder="Colle ou dicte ici la dictée donnée par l’école..."
            className="input min-h-28 resize-y"
            separator=" "
            helpText="Tu peux enregistrer la dictée source en la dictant au micro."
            dictLabel="Dicter le texte source"
          />
        </Field>

        <Field
          label="Mots à apprendre"
          description="Mots de la leçon que l'élève doit mémoriser (liste de vocabulaire)."
        >
          <SpeechTextarea
            value={schoolWordsText}
            onChange={setSchoolWordsText}
            placeholder="Sépare les mots par virgules, points-virgules ou retours à la ligne."
            className="input min-h-20 resize-y"
            separator=", "
            helpText="Dicte les mots à apprendre. Ils seront ajoutés sous forme de liste."
            dictLabel="Dicter les mots à apprendre"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Temps principal"
            value={schoolForm.tense}
            options={tenseOptions}
            onChange={(value) =>
              setSchoolForm((current) => ({
                ...current,
                tense: value as Tense,
              }))
            }
          />

          <SelectField
            label="Difficulté"
            value={schoolForm.difficulty}
            options={getDifficultyOptions(level)}
            onChange={(value) =>
              setSchoolForm((current) => ({
                ...current,
                difficulty: value as Difficulty,
              }))
            }
          />
        </div>

        <Field label="Notions associées">
          <NotionsCheckboxes
            selected={schoolForm.grammarFocus}
            onToggle={onToggleSchoolGrammar}
          />
        </Field>

        <Field label="Notes ou erreurs déjà connues">
          <textarea
            value={schoolForm.notes}
            onChange={(e) =>
              setSchoolForm((current) => ({
                ...current,
                notes: e.target.value,
              }))
            }
            placeholder="Exemple : attention au pluriel, futur simple, son/sont..."
            className="input min-h-20 resize-y"
          />
        </Field>

        <button
          type="button"
          onClick={onAdd}
          className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Save size={18} />
          Enregistrer cette dictée
        </button>

        {schoolDictations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
            Aucune dictée source enregistrée pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {schoolDictations.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <strong className="text-slate-100">{item.title}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.schoolDate || "date non renseignée"} · {item.words.length} mot(s)
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                      {item.sourceText || item.words.join(", ")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-xl border border-white/10 p-2 text-slate-400 transition hover:bg-white/10 hover:text-red-200"
                    title="Supprimer"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <SmallActionButton onClick={() => onLoad(item)} disabled={isLoading}>
                    Charger
                  </SmallActionButton>
                  <SmallActionButton onClick={() => onVariant(item)} disabled={isLoading}>
                    Variante
                  </SmallActionButton>
                  <SmallActionButton onClick={() => onReview(item)} disabled={isLoading}>
                    Révision
                  </SmallActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ErrorTrackingPanel({
  stats,
  total,
  prioritySummary,
  isLoading,
  onGenerateCategoryReview,
  onGeneratePriorityReview,
  history,
}: {
  stats: ErrorStat[];
  total: number;
  prioritySummary: PrioritySummary | null;
  isLoading: boolean;
  onGenerateCategoryReview: (stat: ErrorStat) => void;
  onGeneratePriorityReview: () => void;
  history: HistoryItem[];
}) {
  return (
    <Card>
      <CardHeader
        icon={<AlertTriangle />}
        title="Suivi des difficultés"
        description="Analyse locale des erreurs saisies après les dictées."
      />

      {total === 0 || !prioritySummary ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-400">
          Aucune erreur enregistrée pour l’instant.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <DashboardMetric label="Difficulté principale" value={prioritySummary.mainCategoryLabel} />
              <DashboardMetric label="Occurrences" value={`${prioritySummary.mainCount} fois`} />
              <DashboardMetric label="Catégories détectées" value={`${prioritySummary.categoryCount}`} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <p className="text-sm text-amber-50">
                Priorité de révision :{" "}
                <strong>{prioritySummary.priorityLabels.join(" + ")}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={onGeneratePriorityReview}
              disabled={isLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Génération...
                </>
              ) : (
                <>
                  <RotateCcw size={18} />
                  Générer une révision prioritaire
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {stats.map((stat) => {
              const maxCount = stats[0].count;
              const pct = Math.round((stat.count / maxCount) * 100);
              return (
                <div
                  key={stat.category}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <strong className="text-sm text-slate-100">{stat.label}</strong>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-100">
                        {stat.count}×
                      </span>
                      <button
                        type="button"
                        onClick={() => onGenerateCategoryReview(stat)}
                        disabled={isLoading}
                        className="rounded-lg bg-amber-300 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Réviser
                      </button>
                    </div>
                  </div>

                  <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-300 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {stat.examples.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {stat.examples.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {stats.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Erreurs par catégorie
              </p>
              <ResponsiveContainer width="100%" height={stats.length * 42 + 16}>
                <BarChart
                  data={stats.map((s) => ({ name: s.label, count: s.count }))}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    labelStyle={{ color: "#f8fafc" }}
                    itemStyle={{ color: "#fcd34d" }}
                    formatter={(v) => [`${v} occurrence(s)`, ""]}
                  />
                  <Bar dataKey="count" fill="#fcd34d" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {history.length >= 2 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Progression (erreurs par dictée)
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={[...history]
                    .reverse()
                    .slice(-10)
                    .map((item) => ({
                      date: new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
                      erreurs: item.observedErrors?.length ?? 0,
                    }))}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    labelStyle={{ color: "#f8fafc" }}
                    itemStyle={{ color: "#fcd34d" }}
                    formatter={(v) => [`${v} erreur(s)`, ""]}
                  />
                  <Line type="monotone" dataKey="erreurs" stroke="#fcd34d" strokeWidth={2} dot={{ fill: "#fcd34d", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-slate-500">Une courbe descendante = des progrès !</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function HistoryPanel({
  history,
  onLoad,
  onClear,
}: {
  history: HistoryItem[];
  onLoad: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <CardHeader
          icon={<History />}
          title="Historique local"
          description="Les 30 dernières dictées sont conservées dans ce navigateur."
        />

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-white/10 p-3 text-slate-400 transition hover:bg-white/10 hover:text-red-200"
            title="Vider l’historique"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-slate-400">
          Aucune dictée enregistrée pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onLoad(item)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]"
            >
              <div className="flex items-center justify-between gap-3">
                <strong className="text-slate-100">{item.result.title}</strong>
                <span className="text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                {item.result.dictation}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <HistoryBadge status={item.reviewStatus || "a-faire"} />

                {item.observedErrors?.length ? (
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                    {item.observedErrors.length} erreur(s)
                  </span>
                ) : null}

                {item.schoolDictationId ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    dictée école
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function ResultPanel({
  result,
  observedErrorsText,
  setObservedErrorsText,
  onSaveObservedErrors,
  onGenerateReview,
  onRegenerate,
  isLoading,
  onPrint,
  onCopy,
  copied,
  saveMessage,
  printMode,
  setPrintMode,
  studentMode = false,
  onTimerUpdate,
}: {
  result: DictationResult;
  observedErrorsText: string;
  setObservedErrorsText: (value: string) => void;
  onSaveObservedErrors: () => void;
  onGenerateReview: () => void;
  onRegenerate: () => void;
  isLoading: boolean;
  onPrint: () => void;
  onCopy: () => void;
  copied: boolean;
  saveMessage: string;
  printMode: PrintMode;
  setPrintMode: (value: PrintMode) => void;
  studentMode?: boolean;
  onTimerUpdate?: (seconds: number) => void;
}) {
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimerSeconds(0);
    onTimerUpdate?.(0);
    if (studentMode) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [studentMode]);

  useEffect(() => {
    onTimerUpdate?.(timerSeconds);
  }, [timerSeconds]);

  return (
    <div className="print-sheet space-y-6" data-print-mode={printMode}>
      <Card>
        <div className="mb-5 flex items-start justify-between gap-4">
          <CardHeader
            icon={<ClipboardList />}
            title={result.title}
            description={studentMode ? "Écoute bien et écris la dictée." : "Dictée prête à lire, version à trous, correction et fiche parent."}
          />

          {!studentMode && (
          <div className="no-print flex flex-wrap gap-2">
            <select
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value as PrintMode)}
              className="input max-w-[170px] py-2 text-sm"
              title="Mode d’impression"
            >
              {printModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onCopy}
              className="rounded-xl border border-white/10 p-3 text-slate-300 transition hover:bg-white/10"
              title="Copier"
            >
              {copied ? <ClipboardCheck size={18} /> : <Clipboard size={18} />}
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="rounded-xl border border-white/10 p-3 text-slate-300 transition hover:bg-white/10"
              title="Imprimer"
            >
              <Printer size={18} />
            </button>

            <button
              type="button"
              onClick={onRegenerate}
              disabled={isLoading}
              className="rounded-xl border border-white/10 p-3 text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              title="Regénérer une variante"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCcw size={18} />}
            </button>
          </div>
          )}
        </div>

        {studentMode ? (
          <>
            <DictationPlayer dictation={result.dictation} hideTextByDefault={true} />
            <Section title="Écris la dictée ici" icon={<PencilLine size={18} />}>
              <textarea
                value={observedErrorsText}
                onChange={(e) => setObservedErrorsText(e.target.value)}
                placeholder="Écris la dictée ici au fur et à mesure que tu l’entends..."
                className="input min-h-48 resize-y text-lg leading-8"
              />
            </Section>
          </>
        ) : (
          <>
            <section className="print-parent print-complete">
              <Section title="Dictée à lire" icon={<BookOpen size={18} />}>
                <p className="print-block whitespace-pre-line rounded-2xl bg-slate-950/70 p-5 text-lg leading-9 text-slate-50">
                  {result.dictation}
                </p>
              </Section>
            </section>

            <section className="print-student print-complete">
              <Section title="Version élève à trous" icon={<FileText size={18} />}>
                <p className="print-block whitespace-pre-line rounded-2xl bg-indigo-400/10 p-5 text-lg leading-9 text-indigo-50">
                  {result.studentExercise || "Aucune version à trous générée."}
                </p>
              </Section>
            </section>

            <section className="print-parent print-complete">
              <Section title="Correction" icon={<CheckCircle2 size={18} />}>
                <p className="print-block whitespace-pre-line rounded-2xl bg-emerald-400/10 p-5 leading-8 text-emerald-50">
                  {result.correction}
                </p>
              </Section>

              <Section title="Fiche parent" icon={<Brain size={18} />}>
                <p className="print-block whitespace-pre-line rounded-2xl bg-cyan-300/10 p-5 leading-8 text-cyan-50">
                  {result.parentSheet || "Aucune fiche parent générée."}
                </p>
              </Section>
            </section>
          </>
        )}
      </Card>

      {!studentMode && (
      <Card>
        <div className="grid gap-5 print-parent print-complete">
          <InfoBlock title="Mots utilisés" items={result.usedWords} />
          <InfoBlock title="Mots à revoir" items={result.wordsToReview} />
          <InfoBlock title="Notions travaillées" items={result.grammarPoints} />
          <InfoBlock title="Points de vigilance" items={result.vigilancePoints} />
        </div>
      </Card>
      )}

      <Card>
        <div className="no-print">
          <CardHeader
            icon={<RotateCcw />}
            title={studentMode ? "Terminer la dictée" : "Après correction"}
            description={studentMode ? "Enregistre tes erreurs pour les réviser plus tard." : "Note les erreurs réellement faites, puis génère une dictée de révision ciblée."}
          />

          {!studentMode && (
          <textarea
            value={observedErrorsText}
            onChange={(e) => setObservedErrorsText(e.target.value)}
            placeholder="Exemple : élèves écrit élève ; chanteront écrit chanterons ; oubli de l’apostrophe dans l’école..."
            className="input min-h-28 resize-y"
          />
          )}

          {saveMessage && (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
              {saveMessage}
            </div>
          )}

          {studentMode ? (
            <button
              type="button"
              onClick={onSaveObservedErrors}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <Save size={18} />
              Enregistrer la dictée
            </button>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onSaveObservedErrors}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-semibold text-slate-100 transition hover:bg-white/[0.1]"
              >
                <Save size={18} />
                Enregistrer les erreurs
              </button>

              <button
                type="button"
                onClick={onGenerateReview}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Génération...
                  </>
                ) : (
                  <>
                    <RotateCcw size={18} />
                    Générer une révision
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="print-only rounded-2xl border border-slate-300 p-4">
          <h3 className="mb-3 font-semibold text-slate-950">
            Erreurs observées pendant la dictée
          </h3>
          <div className="h-24 border-b border-dashed border-slate-400" />
          <div className="mt-6 h-24 border-b border-dashed border-slate-400" />
        </div>
      </Card>
    </div>
  );
}

function NotionsCheckboxes({
  selected,
  onToggle,
}: {
  selected: GrammarFocus[];
  onToggle: (value: GrammarFocus) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {grammarOptions.map((option) => {
        const active = selected.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              active
                ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-50"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
            }`}
          >
            <span className="flex items-center gap-2">
              {active && <CheckCircle2 size={16} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SmallActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
      <p className="text-xs uppercase tracking-wide text-amber-100/70">{label}</p>
      <p className="mt-2 text-lg font-bold text-amber-50">{value}</p>
    </div>
  );
}

function HistoryBadge({ status }: { status: string }) {
  if (status === "faite") {
    return (
      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
        faite
      </span>
    );
  }

  if (status === "a-revoir") {
    return (
      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
        à revoir
      </span>
    );
  }

  return (
    <span className="rounded-full border border-slate-300/20 bg-slate-300/10 px-3 py-1 text-xs text-slate-200">
      à faire
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="rounded-xl bg-cyan-300/15 p-3 text-cyan-200">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <p className="font-semibold text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function StatEmpty({
  icon,
  label,
  hint,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-4">
      <div className="rounded-xl bg-white/5 p-3 text-slate-500">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur">
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-50">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition ${
        active
          ? "border-cyan-300/70 bg-cyan-300/15"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
      }`}
    >
      <div
        className={`mb-3 inline-flex rounded-2xl p-3 ${
          active ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-300"
        }`}
      >
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>
    </button>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1 block text-sm font-medium text-slate-200">{label}</div>
      {description && (
        <p className="mb-2 text-xs leading-5 text-slate-400">{description}</p>
      )}
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-200">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function OnboardingGuide({ onGoGenerate }: { onGoGenerate: () => void }) {
  const steps = [
    {
      number: "1",
      title: "Ajoute une dictée",
      description: "Enregistre une dictée de l'école dans la bibliothèque ci-dessous (texte, mots à apprendre, notions).",
      color: "cyan",
    },
    {
      number: "2",
      title: "Génère une variante",
      description: "Va dans l'onglet Générer pour créer une nouvelle dictée personnalisée ou une révision ciblée.",
      color: "purple",
    },
    {
      number: "3",
      title: "Pratique et suis les progrès",
      description: "Passe la dictée dans l'onglet Pratiquer, note les erreurs et consulte ton suivi dans Suivi.",
      color: "amber",
    },
  ];

  return (
    <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-purple-400/10 p-6">
      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex rounded-2xl bg-cyan-300/15 p-3 text-cyan-200">
          <School size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-50">Bienvenue dans l'Atelier de dictées</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Suis ces 3 étapes pour commencer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
          >
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-slate-950">
              {step.number}
            </div>
            <h3 className="mb-1 font-semibold text-slate-100">{step.title}</h3>
            <p className="text-sm leading-5 text-slate-400">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <p className="text-sm text-slate-400">Commence par ajouter une dictée ci-dessous, ou</p>
        <button
          type="button"
          onClick={onGoGenerate}
          className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <Wand2 size={16} />
          Générer directement
        </button>
      </div>
    </div>
  );
}

function TabBar({
  activeTab,
  onTabChange,
  hasResult,
}: {
  activeTab: "bibliotheque" | "generer" | "pratiquer" | "suivi";
  onTabChange: (tab: "bibliotheque" | "generer" | "pratiquer" | "suivi") => void;
  hasResult: boolean;
}) {
  const tabs: { id: "bibliotheque" | "generer" | "pratiquer" | "suivi"; label: string; icon: ReactNode }[] = [
    { id: "bibliotheque", label: "Bibliothèque", icon: <LibraryBig size={17} /> },
    { id: "generer", label: "Générer", icon: <Wand2 size={17} /> },
    { id: "pratiquer", label: "Pratiquer", icon: <PencilLine size={17} /> },
    { id: "suivi", label: "Suivi", icon: <Brain size={17} /> },
  ];

  return (
    <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const showDot = tab.id === "pratiquer" && hasResult && !isActive;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "bg-cyan-300 text-slate-950 shadow"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {showDot && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyResult({ onGoGenerate }: { onGoGenerate?: () => void }) {
  return (
    <Card>
      <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
        <div className="mb-5 rounded-3xl bg-cyan-300/15 p-5 text-cyan-200">
          <ClipboardList size={42} />
        </div>
        <h2 className="text-2xl font-bold">Aucune dictée générée</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          Renseigne une dictée source, des mots imposés ou charge une dictée de
          la bibliothèque pour générer une dictée.
        </p>
        {onGoGenerate && (
          <button
            type="button"
            onClick={onGoGenerate}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            <Wand2 size={18} />
            Générer une dictée
          </button>
        )}
      </div>
    </Card>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-100">
        <span className="text-cyan-200">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h3 className="mb-3 font-semibold text-slate-100">{title}</h3>

      {items?.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-sm text-slate-300"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aucun élément indiqué.</p>
      )}
    </div>
  );
}