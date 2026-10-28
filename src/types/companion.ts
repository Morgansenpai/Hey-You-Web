export type RelationshipType =
  | "Mom"
  | "Dad"
  | "Brother"
  | "Sister"
  | "Son"
  | "Daughter"
  | "Husband"
  | "Wife"
  | "Boyfriend"
  | "Girlfriend"
  | "Best Friend"
  | "Coach"
  | "Boss"
  | "Anime Archetype"
  | "Custom";

export type Temperament =
  | "Calm"
  | "Fiery"
  | "Angry"
  | "Naggy"
  | "Sweet"
  | "Playful"
  | "Strict"
  | "Chaotic";

export type IntensityLevel = "Soft" | "Firm" | "Fierce";

export type LanguageOption = "English" | "Japanese" | "English + Japanese";

export type RecurrenceRule = "Once" | "Daily" | "Weekdays" | "Weekly";

export interface VoiceOption {
  id: string;
  label: string;
  providerId: string;
  gender: "Female" | "Male";
  accent: string;
  supportsJapanese: boolean;
}

export interface CompanionProfile {
  id: string;
  name: string;
  relationship: RelationshipType;
  temperament: Temperament;
  intensity: IntensityLevel;
  language: LanguageOption;
  voiceId: string;
  stability: number;
  similarityBoost: number;
  styleExaggeration: number;
  speakingRate: number;
  customInstructions: string;
  isBuiltIn?: boolean;
  isAnimeArchetype?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:mm
  timeZone: string;
  recurrence: RecurrenceRule;
  companionId: string;
  reminderStages: number[]; // e.g., [30, 15, 5]
  maxFollowUps: number;
  followUpCount: number;
  snoozedUntil: string | null; // ISO timestamp
  completed: boolean;
  completedAt: string | null;
  completedOccurrences: string[]; // array of YYYY-MM-DD for recurring tasks
  firedStages: string[]; // tracks delivered reminders per occurrence
  sharedWithPartner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptRecord {
  id: string;
  text: string;
  companionId: string;
  companionName: string;
  voiceId: string;
  providerUsed: "elevenlabs" | "browser-fallback";
  audioDataUrl?: string;
  createdAt: string;
}

export interface PartnerLink {
  inviteCode: string;
  status: "pending" | "accepted";
  partnerEmail: string;
  linkedAt: string;
}

export interface UserSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string;   // "07:00"
  defaultCompanionId: string;
  defaultLanguage: LanguageOption;
  defaultSnoozeMinutes: number;
  notificationsEnabled: boolean;
}
