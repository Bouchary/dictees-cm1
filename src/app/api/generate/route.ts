import { NextResponse } from "next/server";
import { buildDictationPrompt } from "@/lib/prompt";
import { DictationResult, GenerateDictationInput } from "@/lib/types";

function normalizeResult(value: Partial<DictationResult>): DictationResult {
  return {
    title: value.title || "Dictée d'entraînement",
    dictation: value.dictation || "",
    correction: value.correction || value.dictation || "",
    studentExercise: value.studentExercise || "",
    parentSheet: value.parentSheet || "",
    correctionMethod: Array.isArray(value.correctionMethod)
      ? value.correctionMethod
      : [],
    usedWords: Array.isArray(value.usedWords) ? value.usedWords : [],
    grammarPoints: Array.isArray(value.grammarPoints) ? value.grammarPoints : [],
    vigilancePoints: Array.isArray(value.vigilancePoints)
      ? value.vigilancePoints
      : [],
    wordsToReview: Array.isArray(value.wordsToReview) ? value.wordsToReview : [],
    parentReadingAdvice: value.parentReadingAdvice || "",
    estimatedDifficulty: value.estimatedDifficulty || "",
  };
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as GenerateDictationInput;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY manquante dans .env.local." },
        { status: 500 }
      );
    }

    const hasWords = Boolean(input.requiredWords?.length);
    const hasSource = Boolean(input.sourceDictation?.trim());
    const hasErrors = Boolean(input.errorsToReview?.length);

    if (!hasWords && !hasSource && !hasErrors) {
      return NextResponse.json(
        {
          error:
            "Ajoute au moins quelques mots imposés, une dictée source ou des erreurs à retravailler.",
        },
        { status: 400 }
      );
    }

    const prompt = buildDictationPrompt(input);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: prompt,
        temperature: 0.55,
        max_output_tokens: 2200,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();

      return NextResponse.json(
        {
          error: "Erreur lors de l'appel au modèle.",
          detail,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const text =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "";

    if (!text) {
      return NextResponse.json(
        {
          error: "Réponse vide du modèle.",
        },
        { status: 500 }
      );
    }

    let parsed: Partial<DictationResult>;

    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "La réponse du modèle n'est pas un JSON valide.",
          raw: text,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(normalizeResult(parsed));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erreur serveur inattendue.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}