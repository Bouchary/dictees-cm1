export type DictationMode = "words" | "source";

export type Difficulty = "facile" | "standard" | "avancee";

export type Length = "courte" | "moyenne" | "longue";

export type Tense =
  | "present"
  | "imparfait"
  | "futur"
  | "passe-compose"
  | "mixte";

export type GrammarFocus =
  | "accord-groupe-nominal"
  | "accord-sujet-verbe"
  | "pluriel"
  | "feminin"
  | "homophones"
  | "conjugaison"
  | "ponctuation"
  | "mots-invariables";

export type ReviewStatus = "a-faire" | "faite" | "a-revoir";

export type ErrorCategory =
  | "pluriel"
  | "accord-sujet-verbe"
  | "homophones"
  | "conjugaison"
  | "apostrophe"
  | "accents"
  | "ponctuation"
  | "mots-invariables"
  | "autre";

export type PrintMode = "complete" | "student" | "parent";

export type GenerateDictationInput = {
  mode: DictationMode;
  level: "CE1" | "CE2" | "CM1" | "CM2";
  sourceDictation?: string;
  requiredWords: string[];
  errorsToReview?: string[];
  tense: Tense;
  difficulty: Difficulty;
  length: Length;
  grammarFocus: GrammarFocus[];
  theme: string;
};

export type DictationResult = {
  title: string;
  dictation: string;
  correction: string;
  studentExercise: string;
  parentSheet: string;
  correctionMethod: string[];
  usedWords: string[];
  grammarPoints: string[];
  vigilancePoints: string[];
  wordsToReview: string[];
  parentReadingAdvice: string;
  estimatedDifficulty: string;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  input: GenerateDictationInput;
  result: DictationResult;
  observedErrors?: string[];
  reviewStatus?: ReviewStatus;
  reviewOfId?: string;
  schoolDictationId?: string;
  duration?: number;
};

export type SchoolDictation = {
  id: string;
  createdAt: string;
  title: string;
  schoolDate: string;
  sourceText: string;
  words: string[];
  grammarFocus: GrammarFocus[];
  tense: Tense;
  difficulty: Difficulty;
  notes: string;
};

export type AppBackup = {
  version: "2.6";
  exportedAt: string;
  history: HistoryItem[];
  schoolDictations: SchoolDictation[];
};