import { NextRequest, NextResponse } from "next/server";
import { AVAILABLE_VOICES } from "@/lib/defaults";

interface VoiceSynthesisRequest {
  text: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  styleExaggeration?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VoiceSynthesisRequest;
    const text = (body.text || "").trim();

    if (!text) {
      return NextResponse.json(
        { error: "Script text cannot be empty." },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: "Script exceeds the 1,000 character maximum per request." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          fallback: true,
          reason:
            "ELEVENLABS_API_KEY is not configured on the server. Using explicitly labelled Browser Speech Synthesis fallback.",
        },
        { status: 200 }
      );
    }

    const matchedVoice =
      AVAILABLE_VOICES.find((v) => v.id === body.voiceId) ||
      AVAILABLE_VOICES[0];

    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${matchedVoice.providerId}`;

    const elevenRes = await fetch(elevenUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: body.stability ?? 0.6,
          similarity_boost: body.similarityBoost ?? 0.8,
          style: body.styleExaggeration ?? 0.25,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errorDetail = await elevenRes.text();
      return NextResponse.json(
        {
          fallback: true,
          reason: `ElevenLabs API returned status ${elevenRes.status}: ${errorDetail.slice(
            0,
            180
          )}`,
        },
        { status: 200 }
      );
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return NextResponse.json({
      fallback: false,
      audioDataUrl,
      provider: "elevenlabs",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Unexpected server error during voice generation.",
      },
      { status: 500 }
    );
  }
}
