"use client";

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

const tenseOptions: { value: Tense; label: string }[] = [
  { value: "present", label: "Présent" },
  { value: "imparfait", label: "Imparfait" },
  { value: "futur", label: "Futur" },
  { value: "passe-compose", label: "Passé composé" },
  { value: "mixte", label: "Mixte" },
];

const difficultyOptions: { value: Difficulty; label: string }[] = [
  { value: "facile", label: "Facile" },
  { value: "standard", label: "Standard CM1" },
  { value: "avancee", label: "Plus difficile" },
];

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
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
      setResult(data);
      setCurrentHistoryId(item.id);
      setHistory((current) => [item, ...current].slice(0, 30));
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
      level: "CM1",
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
      level: "CM1",
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
    setResult(item.result);
    setCurrentHistoryId(item.id);
    setCopied(false);
    setSaveMessage("");
    setDataMessage("");
    setError("");
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
      level: "CM1",
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
      level: "CM1",
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
      level: "CM1",
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
              Atelier de dictées personnalisées — CM1
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
            <Stat icon={<Target />} label="Niveau" value="CM1" />
            <Stat icon={<Brain />} label="Erreurs suivies" value={`${totalObservedErrors}`} />
            <Stat icon={<LibraryBig />} label="Dictées école" value={`${schoolDictations.length}`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="no-print space-y-6">
          <DataPanel
            onExport={exportData}
            onImportClick={() => importInputRef.current?.click()}
            dataMessage={dataMessage}
          />

          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={importData}
          />

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
          />

          <ErrorTrackingPanel
            stats={errorStats}
            total={totalObservedErrors}
            prioritySummary={prioritySummary}
            isLoading={isLoading}
            onGenerateCategoryReview={generateCategoryReview}
            onGeneratePriorityReview={generatePriorityReview}
          />

          <HistoryPanel
            history={history}
            onLoad={loadFromHistory}
            onClear={clearHistory}
          />
        </div>

        <div className="space-y-6">
          {!result ? (
            <EmptyResult />
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
            />
          )}
        </div>
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
            />
          </Field>
        )}

        <Field label="Mots à apprendre ou mots imposés">
          <SpeechTextarea
            value={requiredWordsText}
            onChange={setRequiredWordsText}
            placeholder="Exemple : prochain, élèves, classe, chanteront, anglais, cour, école"
            className="input min-h-24 resize-y"
            separator=", "
            helpText="Dicte les mots un par un. Ils seront ajoutés comme une liste."
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

        <div className="grid gap-4 md:grid-cols-3">
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
            options={difficultyOptions}
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
          <GrammarButtons
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
          />
        </Field>

        <Field label="Mots à apprendre">
          <SpeechTextarea
            value={schoolWordsText}
            onChange={setSchoolWordsText}
            placeholder="Sépare les mots par virgules, points-virgules ou retours à la ligne."
            className="input min-h-20 resize-y"
            separator=", "
            helpText="Dicte les mots à apprendre. Ils seront ajoutés sous forme de liste."
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
            options={difficultyOptions}
            onChange={(value) =>
              setSchoolForm((current) => ({
                ...current,
                difficulty: value as Difficulty,
              }))
            }
          />
        </div>

        <Field label="Notions associées">
          <GrammarButtons
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
}: {
  stats: ErrorStat[];
  total: number;
  prioritySummary: PrioritySummary | null;
  isLoading: boolean;
  onGenerateCategoryReview: (stat: ErrorStat) => void;
  onGeneratePriorityReview: () => void;
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
            {stats.map((stat) => (
              <div
                key={stat.category}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-100">{stat.label}</strong>
                      <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs text-amber-100">
                        {stat.count} fois
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      {stat.examples.slice(0, 2).join(" · ")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onGenerateCategoryReview(stat)}
                    disabled={isLoading}
                    className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Réviser
                  </button>
                </div>
              </div>
            ))}
          </div>
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
}) {
  return (
    <div className="print-sheet space-y-6" data-print-mode={printMode}>
      <Card>
        <div className="mb-5 flex items-start justify-between gap-4">
          <CardHeader
            icon={<ClipboardList />}
            title={result.title}
            description="Dictée prête à lire, version à trous, correction et fiche parent."
          />

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
        </div>

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
      </Card>

      <Card>
        <div className="grid gap-5 print-parent print-complete">
          <InfoBlock title="Mots utilisés" items={result.usedWords} />
          <InfoBlock title="Mots à revoir" items={result.wordsToReview} />
          <InfoBlock title="Notions travaillées" items={result.grammarPoints} />
          <InfoBlock title="Points de vigilance" items={result.vigilancePoints} />
        </div>
      </Card>

      <Card>
        <div className="no-print">
          <CardHeader
            icon={<RotateCcw />}
            title="Après correction"
            description="Note les erreurs réellement faites, puis génère une dictée de révision ciblée."
          />

          <textarea
            value={observedErrorsText}
            onChange={(e) => setObservedErrorsText(e.target.value)}
            placeholder="Exemple : élèves écrit élève ; chanteront écrit chanterons ; oubli de l’apostrophe dans l’école..."
            className="input min-h-28 resize-y"
          />

          {saveMessage && (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
              {saveMessage}
            </div>
          )}

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

function GrammarButtons({
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block">
      <div className="mb-2 block text-sm font-medium text-slate-200">{label}</div>
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

function EmptyResult() {
  return (
    <Card>
      <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
        <div className="mb-5 rounded-3xl bg-cyan-300/15 p-5 text-cyan-200">
          <ClipboardList size={42} />
        </div>
        <h2 className="text-2xl font-bold">Aucune dictée générée</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          Renseigne une dictée source, des mots imposés ou charge une dictée de
          la bibliothèque.
        </p>
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