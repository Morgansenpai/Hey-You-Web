import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  CompanionProfile,
  PartnerLink,
  ScriptRecord,
  TaskItem,
  UserSettings,
} from "@/types/companion";
import { BUILT_IN_COMPANIONS, DEFAULT_USER_SETTINGS } from "@/lib/defaults";

export interface UserWorkspaceData {
  tasks: TaskItem[];
  customCompanions: CompanionProfile[];
  scripts: ScriptRecord[];
  settings: UserSettings;
  partnerLinks: PartnerLink[];
}

const LOCAL_STORAGE_KEY = "hey_you_companion_workspace_v1";

export function getInitialWorkspace(): UserWorkspaceData {
  return {
    tasks: [],
    customCompanions: [],
    scripts: [],
    settings: DEFAULT_USER_SETTINGS,
    partnerLinks: [],
  };
}

export async function loadUserWorkspace(
  uid: string | null
): Promise<{ data: UserWorkspaceData; source: "firestore" | "local" }> {
  if (uid && isFirebaseConfigured && db) {
    try {
      const ref = doc(db, "users", uid, "workspace", "main");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const raw = snap.data() as Partial<UserWorkspaceData>;
        return {
          data: {
            tasks: raw.tasks || [],
            customCompanions: raw.customCompanions || [],
            scripts: raw.scripts || [],
            settings: { ...DEFAULT_USER_SETTINGS, ...(raw.settings || {}) },
            partnerLinks: raw.partnerLinks || [],
          },
          source: "firestore",
        };
      }
    } catch (err) {
      console.error("Firestore read error, falling back to local cache:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserWorkspaceData>;
        return {
          data: {
            tasks: parsed.tasks || [],
            customCompanions: parsed.customCompanions || [],
            scripts: parsed.scripts || [],
            settings: { ...DEFAULT_USER_SETTINGS, ...(parsed.settings || {}) },
            partnerLinks: parsed.partnerLinks || [],
          },
          source: "local",
        };
      }
    } catch (e) {
      console.error("Local storage read error:", e);
    }
  }

  return { data: getInitialWorkspace(), source: "local" };
}

export async function saveUserWorkspace(
  uid: string | null,
  data: UserWorkspaceData
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Local storage write error:", e);
    }
  }

  if (uid && isFirebaseConfigured && db) {
    try {
      const ref = doc(db, "users", uid, "workspace", "main");
      await setDoc(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error("Firestore write error:", err);
      throw err;
    }
  }
}

export function getAllCompanions(
  customCompanions: CompanionProfile[]
): CompanionProfile[] {
  return [...BUILT_IN_COMPANIONS, ...customCompanions];
}

export function isWithinQuietHours(
  now: Date,
  settings: UserSettings
): boolean {
  if (!settings.quietHoursEnabled) return false;
  const [startH, startM] = settings.quietHoursStart.split(":").map(Number);
  const [endH, endM] = settings.quietHoursEnd.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Crosses midnight (e.g., 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
