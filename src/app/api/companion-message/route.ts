import { NextRequest, NextResponse } from "next/server";
import { CompanionProfile } from "@/types/companion";

interface MessageRequestPayload {
  companion: CompanionProfile;
  taskTitle: string;
  taskDescription?: string;
  stageLabel: string; // e.g., "15-minute warning", "Due now", "Completed", "Missed"
  snoozeCount?: number;
}

function buildDeterministicPersonalizedScript(
  payload: MessageRequestPayload
): string {
  const { companion, taskTitle, stageLabel, snoozeCount = 0 } = payload;
  const jpPrefix =
    companion.language === "Japanese"
      ? "時間です。"
      : companion.language === "English + Japanese"
      ? "ねえ、聞いて。"
      : "";

  const snoozeNote =
    snoozeCount > 0
      ? ` You have already snoozed this ${snoozeCount} time${
          snoozeCount > 1 ? "s" : ""
        }.`
      : "";

  if (stageLabel === "Completed") {
    if (companion.intensity === "Fierce") {
      return `${jpPrefix} ${taskTitle} is done. Good. Keep that exact standard for the rest of the day.`.trim();
    }
    if (companion.intensity === "Soft") {
      return `${jpPrefix} You finished ${taskTitle}. I knew you could handle it. Take a breath and enjoy the progress.`.trim();
    }
    return `${jpPrefix} ${taskTitle} is complete. Solid follow-through. Let us look at what is next when you are ready.`.trim();
  }

  if (companion.temperament === "Strict" || companion.intensity === "Fierce") {
    return `${jpPrefix} Listen closely. ${taskTitle} is at the ${stageLabel} mark.${snoozeNote} Stop stalling and execute what you committed to do.`.trim();
  }

  if (companion.temperament === "Playful") {
    return `${jpPrefix} Hey! ${taskTitle} is hitting ${stageLabel}.${snoozeNote} Do not make me come back in five minutes—get moving!`.trim();
  }

  if (companion.temperament === "Naggy") {
    return `${jpPrefix} I am reminding you again about ${taskTitle} (${stageLabel}).${snoozeNote} If you leave it sitting there, you will only regret it tonight. Start now.`.trim();
  }

  if (companion.temperament === "Sweet" || companion.intensity === "Soft") {
    return `${jpPrefix} Just checking in on ${taskTitle} (${stageLabel}).${snoozeNote} Take a steady breath and take the first step right now.`.trim();
  }

  return `${jpPrefix} This is ${companion.name}. Your commitment "${taskTitle}" is at ${stageLabel}.${snoozeNote} Time to follow through.`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MessageRequestPayload;
    if (!body?.companion || !body?.taskTitle) {
      return NextResponse.json(
        { error: "Companion configuration and task title are required." },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({
        script: buildDeterministicPersonalizedScript(body),
        source: "structured-engine",
      });
    }

    const prompt = `You are "${body.companion.name}", acting as the user's ${body.companion.relationship} in the personal accountability app Hey You! Companion.
Temperament: ${body.companion.temperament}
Intensity: ${body.companion.intensity} (never abusive or threatening, always constructive accountability)
Language mode: ${body.companion.language}
Personality notes: ${body.companion.customInstructions}

Task commitment: "${body.taskTitle}" (${body.taskDescription || "No extra notes"})
Current stage: ${body.stageLabel}
Previous snoozes on this task: ${body.snoozeCount || 0}

Write a short, natural spoken voiceover message (2 to 3 sentences maximum, plain spoken text, no markdown, no stage directions) speaking directly to the user.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        script: buildDeterministicPersonalizedScript(body),
        source: "structured-engine-fallback",
      });
    }

    const result = await response.json();
    const generatedText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return NextResponse.json({
      script: generatedText || buildDeterministicPersonalizedScript(body),
      source: "gemini",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate companion script." },
      { status: 500 }
    );
  }
}
