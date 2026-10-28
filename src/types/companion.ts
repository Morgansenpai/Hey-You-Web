import { CompanionProfile, UserSettings, VoiceOption } from "@/types/companion";

export const AVAILABLE_VOICES: VoiceOption[] = [
  { id: "voice-rachel", label: "Rachel — warm, expressive", providerId: "21m00Tcm4TlvDq8ikWAM", gender: "Female", accent: "British / Neutral", supportsJapanese: true },
  { id: "voice-adam", label: "Adam — grounded, steady", providerId: "pNInz6obpgDQGcFmaJgB", gender: "Male", accent: "Neutral", supportsJapanese: true },
  { id: "voice-bella", label: "Bella — bright, animated", providerId: "EXAVITQu4vr4xnSDxMaL", gender: "Female", accent: "Neutral", supportsJapanese: true },
  { id: "voice-antoni", label: "Antoni — direct, energetic", providerId: "ErXwobaYiN019PkySvjV", gender: "Male", accent: "Neutral", supportsJapanese: true },
  { id: "voice-charlotte", label: "Charlotte — clear, poised", providerId: "XB0fDUnXU5powFXDhCwa", gender: "Female", accent: "British / Neutral", supportsJapanese: true },
  { id: "voice-callum", label: "Callum — textured, intense", providerId: "N2lVS1w4EtoT3dr4eOWO", gender: "Male", accent: "Neutral", supportsJapanese: true },
];

export const BUILT_IN_COMPANIONS: CompanionProfile[] = [
  {
    id: "comp-mom", name: "Mum", relationship: "Mom", temperament: "Naggy", intensity: "Firm", language: "English",
    voiceId: "voice-rachel", stability: 0.48, similarityBoost: 0.82, styleExaggeration: 0.42, speakingRate: 1.0,
    customInstructions: "A caring, familiar mum: affectionate but observant, gently persistent, and willing to call out procrastination. Sound human and conversational, never like a generic announcer.",
    isBuiltIn: true,
  },
  {
    id: "comp-dad", name: "Dad", relationship: "Dad", temperament: "Calm", intensity: "Firm", language: "English",
    voiceId: "voice-adam", stability: 0.72, similarityBoost: 0.84, styleExaggeration: 0.18, speakingRate: 0.96,
    customInstructions: "A grounded dad: measured, warm, direct, practical, and reassuring without overexplaining. Speak with a steady pace and understated authority.",
    isBuiltIn: true,
  },
  {
    id: "comp-brother", name: "Brother", relationship: "Brother", temperament: "Playful", intensity: "Firm", language: "English",
    voiceId: "voice-antoni", stability: 0.42, similarityBoost: 0.8, styleExaggeration: 0.48, speakingRate: 1.06,
    customInstructions: "A close brother: playful, familiar, quick-witted, supportive, and comfortable teasing the user while still getting them moving. Avoid scripted-sounding jokes.",
    isBuiltIn: true,
  },
  {
    id: "comp-anime-rival", name: "Renji", relationship: "Anime Archetype", temperament: "Fiery", intensity: "Fierce", language: "English + Japanese",
    voiceId: "voice-callum", stability: 0.38, similarityBoost: 0.82, styleExaggeration: 0.62, speakingRate: 1.08,
    customInstructions: "A sharp, intense anime training rival who challenges the user and refuses to let them quit. Use concise, dramatic delivery and occasional natural Japanese phrases, never every sentence.",
    isBuiltIn: true, isAnimeArchetype: true,
  },
  {
    id: "comp-anime-strategist", name: "Sora", relationship: "Anime Archetype", temperament: "Calm", intensity: "Firm", language: "English + Japanese",
    voiceId: "voice-charlotte", stability: 0.68, similarityBoost: 0.84, styleExaggeration: 0.34, speakingRate: 0.96,
    customInstructions: "A composed anime strategist: observant, analytical, deliberate, quietly confident, and precise. Sound like a distinct character rather than a generic assistant.",
    isBuiltIn: true, isAnimeArchetype: true,
  },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  defaultCompanionId: "comp-dad",
  defaultLanguage: "English",
  defaultSnoozeMinutes: 10,
  notificationsEnabled: false,
};
