"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import MetallicOrb, { OrbState } from "@/components/MetallicOrb";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth";
import {
  CompanionProfile,
  IntensityLevel,
  LanguageOption,
  RecurrenceRule,
  RelationshipType,
  ScriptRecord,
  TaskItem,
  Temperament,
} from "@/types/companion";
import {
  AVAILABLE_VOICES,
  BUILT_IN_COMPANIONS,
  DEFAULT_USER_SETTINGS,
} from "@/lib/defaults";
import {
  getAllCompanions,
  getInitialWorkspace,
  isWithinQuietHours,
  loadUserWorkspace,
  saveUserWorkspace,
  UserWorkspaceData,
} from "@/lib/storage";
import {
  Calendar,
  CheckSquare,
  Users,
  Settings,
  Volume2,
  LogOut,
  ArrowRight,
  Clock,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  Play,
  Square,
  CheckCircle2,
  Bell,
  Share2,
  Download,
  RotateCcw,
} from "lucide-react";

type ViewMode = "landing" | "auth" | "app";
type NavSection = "today" | "tasks" | "companions" | "partner" | "settings";

export default function HeyYouCompanionApp() {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [activeNav, setActiveNav] = useState<NavSection>("today");
  const [orbState, setOrbState] = useState<OrbState>("idle");

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "reset">(
    "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Persistent Workspace State
  const [workspace, setWorkspace] = useState<UserWorkspaceData>(
    getInitialWorkspace()
  );
  const [storageSource, setStorageSource] = useState<"firestore" | "local">(
    "local"
  );
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Task Builder State
  const todayIso = new Date().toISOString().split("T")[0];
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDate, setTaskDate] = useState(todayIso);
  const [taskTime, setTaskTime] = useState("18:00");
  const [taskRecurrence, setTaskRecurrence] = useState<RecurrenceRule>("Once");
  const [taskCompanionId, setTaskCompanionId] = useState("comp-coach");
  const [stage30, setStage30] = useState(true);
  const [stage15, setStage15] = useState(true);
  const [stage5, setStage5] = useState(true);
  const [taskMaxFollowUps, setTaskMaxFollowUps] = useState(2);
  const [taskShared, setTaskShared] = useState(false);

  // Companion Builder State
  const [compName, setCompName] = useState("");
  const [editingCompanionId, setEditingCompanionId] = useState<string | null>(null);
  const [compRel, setCompRel] = useState<RelationshipType>("Custom");
  const [compTemp, setCompTemp] = useState<Temperament>("Calm");
  const [compIntensity, setCompIntensity] = useState<IntensityLevel>("Firm");
  const [compLang, setCompLang] = useState<LanguageOption>("English");
  const [compVoiceId, setCompVoiceId] = useState(AVAILABLE_VOICES[0].id);
  const [compStability, setCompStability] = useState(0.6);
  const [compSimilarity, setCompSimilarity] = useState(0.8);
  const [compStyle, setCompStyle] = useState(0.25);
  const [compRate, setCompRate] = useState(1.0);
  const [compNotes, setCompNotes] = useState("");

  // Voice Core State
  const [scriptText, setScriptText] = useState("");
  const [selectedVoiceCompId, setSelectedVoiceCompId] = useState("comp-coach");
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Partner State
  const [partnerEmailInput, setPartnerEmailInput] = useState("");
  const [acceptCodeInput, setAcceptCodeInput] = useState("");

  // Notification Permission State
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>("default");

  // 1. Auth & Workspace Initialization
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      loadUserWorkspace(null).then(({ data, source }) => {
        setWorkspace(data);
        setStorageSource(source);
        setWorkspaceLoaded(true);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      const { data, source } = await loadUserWorkspace(
        currentUser ? currentUser.uid : null
      );
      setWorkspace(data);
      setStorageSource(source);
      setWorkspaceLoaded(true);
      if (currentUser && viewMode === "auth") {
        setViewMode("app");
      }
    });
    return () => unsubscribe();
  }, [viewMode]);

  const persistWorkspace = async (next: UserWorkspaceData) => {
    setWorkspace(next);
    try {
      await saveUserWorkspace(user ? user.uid : null, next);
    } catch {
      setStatusBanner(
        "Saved to local device storage. Cloud sync will resume when connection is restored."
      );
    }
  };

  const allCompanions = useMemo(
    () => getAllCompanions(workspace.customCompanions),
    [workspace.customCompanions]
  );

  const activeCompanion = useMemo(
    () =>
      allCompanions.find(
        (c) => c.id === workspace.settings.defaultCompanionId
      ) || BUILT_IN_COMPANIONS[0],
    [allCompanions, workspace.settings.defaultCompanionId]
  );

  // 2. Background Reminder Check Tick (Runs every 20 seconds)
  useEffect(() => {
    if (!workspaceLoaded) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (isWithinQuietHours(now, workspace.settings)) {
        return; // Quiet hours respected
      }

      let updated = false;
      const nextTasks = workspace.tasks.map((task) => {
        if (task.completed) return task;
        const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}:00`);
        if (isNaN(dueDateTime.getTime())) return task;

        // Check Snooze expiry
        if (task.snoozedUntil) {
          const snoozeEnd = new Date(task.snoozedUntil);
          if (now >= snoozeEnd && task.followUpCount < task.maxFollowUps) {
            const stageKey = `${task.dueDate}-snooze-${task.followUpCount + 1}`;
            if (!task.firedStages.includes(stageKey)) {
              updated = true;
              triggerCompanionReminder(task, "Follow-up after snooze");
              return {
                ...task,
                snoozedUntil: null,
                followUpCount: task.followUpCount + 1,
                firedStages: [...task.firedStages, stageKey],
              };
            }
          }
        }

        const diffMinutes = Math.round(
          (dueDateTime.getTime() - now.getTime()) / 60000
        );

        for (const stage of task.reminderStages) {
          const stageKey = `${task.dueDate}-stage-${stage}`;
          if (
            diffMinutes <= stage &&
            diffMinutes >= stage - 1 &&
            !task.firedStages.includes(stageKey)
          ) {
            updated = true;
            triggerCompanionReminder(task, `${stage}-minute reminder`);
            return {
              ...task,
              firedStages: [...task.firedStages, stageKey],
            };
          }
        }

        const dueKey = `${task.dueDate}-due-now`;
        if (
          diffMinutes <= 0 &&
          diffMinutes >= -2 &&
          !task.firedStages.includes(dueKey)
        ) {
          updated = true;
          triggerCompanionReminder(task, "Due now");
          return {
            ...task,
            firedStages: [...task.firedStages, dueKey],
          };
        }

        return task;
      });

      if (updated) {
        persistWorkspace({ ...workspace, tasks: nextTasks });
      }
    }, 20000);

    return () => clearInterval(interval);
  });

  const triggerCompanionReminder = async (
    task: TaskItem,
    stageLabel: string
  ) => {
    const comp =
      allCompanions.find((c) => c.id === task.companionId) || activeCompanion;

    try {
      const res = await fetch("/api/companion-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companion: comp,
          taskTitle: task.title,
          taskDescription: task.description,
          stageLabel,
          snoozeCount: task.followUpCount,
        }),
      });
      const data = await res.json();
      const spokenText =
        data.script ||
        `${comp.name}: "${task.title}" is at ${stageLabel}. Time to follow through.`;

      setStatusBanner(`${comp.name} (${stageLabel}): ${spokenText}`);

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(`${comp.name} — ${task.title}`, {
          body: spokenText,
        });
      }

      await synthesizeAndPlaySpeech(spokenText, comp);
    } catch (e) {
      console.error("Failed to trigger reminder:", e);
    }
  };

  // 3. Voice Core Synthesis & Playback Engine
  const synthesizeAndPlaySpeech = async (
    textToSpeak: string,
    companion: CompanionProfile
  ) => {
    const cleanText = textToSpeak.trim();
    if (!cleanText) {
      setVoiceFeedback("Please enter a script before generating speech.");
      return;
    }

    setOrbState("generating");
    setVoiceFeedback(`Generating speech with ${companion.name}...`);

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          voiceId: companion.voiceId,
          stability: companion.stability,
          similarityBoost: companion.similarityBoost,
          styleExaggeration: companion.styleExaggeration,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setOrbState("idle");
        setVoiceFeedback(result.error || "Voice generation failed.");
        return;
      }

      const newRecord: ScriptRecord = {
        id: `scr-${Date.now()}`,
        text: cleanText,
        companionId: companion.id,
        companionName: companion.name,
        voiceId: companion.voiceId,
        providerUsed: result.fallback ? "browser-fallback" : "elevenlabs",
        audioDataUrl: result.audioDataUrl || undefined,
        createdAt: new Date().toISOString(),
      };

      const nextScripts = [newRecord, ...workspace.scripts.slice(0, 19)];
      await persistWorkspace({ ...workspace, scripts: nextScripts });

      if (!result.fallback && result.audioDataUrl) {
        setActiveAudioUrl(result.audioDataUrl);
        setVoiceFeedback(
          `Playing ElevenLabs neural audio for ${companion.name}.`
        );
        if (audioRef.current) {
          audioRef.current.src = result.audioDataUrl;
          audioRef.current.playbackRate = companion.speakingRate || 1.0;
          setOrbState("speaking");
          audioRef.current.play().catch(() => {
            setOrbState("idle");
          });
        }
      } else {
        // Explicit Browser Speech Synthesis Fallback
        setVoiceFeedback(
          `${
            result.reason || "Using Browser Speech Synthesis fallback."
          } Speaking now...`
        );
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = companion.speakingRate || 1.0;
          const voiceOption = AVAILABLE_VOICES.find(
            (voice) => voice.id === companion.voiceId
          );
          const targetLanguage =
            companion.language === "Japanese" ? "ja-JP" : "en-GB";
          utterance.lang = targetLanguage;

          // Browser fallback: choose a system voice matching the selected voice's gender.
          // Browser voices are device-provided and may not expose gender metadata.
          const systemVoices = window.speechSynthesis.getVoices();
          const genderNames =
            voiceOption?.gender === "Female"
              ? /female|zira|samantha|victoria|karen|moira|tessa|fiona|ava|jenny|aria|susan|hazel|sonia|libby|natasha|serena/i
              : /male|david|mark|guy|james|daniel|alex|fred|tom|aaron|ryan|george|richard|thomas|lee|andrew|brian|oliver|arthur/i;
          const languageVoices = systemVoices.filter((voice) =>
            voice.lang.toLowerCase().startsWith(
              companion.language === "Japanese" ? "ja" : "en"
            )
          );
          const genderMatchedVoice = languageVoices.find((voice) =>
            genderNames.test(voice.name)
          );
          const preferredVoice =
            genderMatchedVoice ||
            languageVoices.find((voice) =>
              voice.name.toLowerCase().includes(
                voiceOption?.gender.toLowerCase() || ""
              )
            ) ||
            languageVoices[0];
          if (preferredVoice) utterance.voice = preferredVoice;
          utterance.onstart = () => setOrbState("speaking");
          utterance.onend = () => setOrbState("idle");
          utterance.onerror = () => setOrbState("idle");
          window.speechSynthesis.speak(utterance);
        } else {
          setOrbState("idle");
        }
      }
    } catch (err: any) {
      setOrbState("idle");
      setVoiceFeedback(err?.message || "Network error during speech synthesis.");
    }
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setOrbState("idle");
  };

  // 4. Task Management Handlers
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const stages: number[] = [];
    if (stage30) stages.push(30);
    if (stage15) stages.push(15);
    if (stage5) stages.push(5);

    const nowIso = new Date().toISOString();
    const timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (editingTaskId) {
      const nextTasks = workspace.tasks.map((t) =>
        t.id === editingTaskId
          ? {
              ...t,
              title: taskTitle.trim(),
              description: taskDesc.trim(),
              dueDate: taskDate,
              dueTime: taskTime,
              recurrence: taskRecurrence,
              companionId: taskCompanionId,
              reminderStages: stages,
              maxFollowUps: taskMaxFollowUps,
              sharedWithPartner: taskShared,
              updatedAt: nowIso,
            }
          : t
      );
      await persistWorkspace({ ...workspace, tasks: nextTasks });
      setEditingTaskId(null);
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        dueDate: taskDate,
        dueTime: taskTime,
        timeZone,
        recurrence: taskRecurrence,
        companionId: taskCompanionId,
        reminderStages: stages,
        maxFollowUps: taskMaxFollowUps,
        followUpCount: 0,
        snoozedUntil: null,
        completed: false,
        completedAt: null,
        completedOccurrences: [],
        firedStages: [],
        sharedWithPartner: taskShared,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await persistWorkspace({
        ...workspace,
        tasks: [newTask, ...workspace.tasks],
      });
    }

    setTaskTitle("");
    setTaskDesc("");
    setStatusBanner("Commitment saved.");
  };

  const handleCompleteTask = async (task: TaskItem) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let nextTask: TaskItem;
    if (task.recurrence !== "Once") {
      // Advance dueDate to next occurrence without destroying recurring definition
      const nextDate = new Date(`${task.dueDate}T${task.dueTime}:00`);
      if (task.recurrence === "Daily") {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (task.recurrence === "Weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (task.recurrence === "Weekdays") {
        do {
          nextDate.setDate(nextDate.getDate() + 1);
        } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
      }
      nextTask = {
        ...task,
        dueDate: nextDate.toISOString().split("T")[0],
        completedOccurrences: Array.from(new Set([...task.completedOccurrences, todayStr])),
        snoozedUntil: null,
        followUpCount: 0,
        updatedAt: now.toISOString(),
      };
    } else {
      nextTask = {
        ...task,
        completed: true,
        completedAt: now.toISOString(),
        snoozedUntil: null,
        updatedAt: now.toISOString(),
      };
    }

    const nextTasks = workspace.tasks.map((t) =>
      t.id === task.id ? nextTask : t
    );
    await persistWorkspace({ ...workspace, tasks: nextTasks });
    triggerCompanionReminder(task, "Completed");
  };

  const handleSnoozeTask = async (task: TaskItem, minutes = 10) => {
    if (task.followUpCount >= task.maxFollowUps) {
      setStatusBanner(
        `Follow-up limit (${task.maxFollowUps}) reached for "${task.title}".`
      );
      return;
    }
    const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
    const nextTasks = workspace.tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            snoozedUntil: snoozeUntil,
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    await persistWorkspace({ ...workspace, tasks: nextTasks });
    setStatusBanner(
      `Snoozed "${task.title}" for ${minutes} minutes. Underlying due time preserved.`
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    const nextTasks = workspace.tasks.filter((t) => t.id !== taskId);
    await persistWorkspace({ ...workspace, tasks: nextTasks });
  };

  // 5. Companion Management Handlers
  const handleSaveCustomCompanion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;

    const existing = editingCompanionId ? allCompanions.find((item) => item.id === editingCompanionId) : undefined;
    const newCompanion: CompanionProfile = {
      id: existing?.id || `custom-${Date.now()}`,
      name: existing?.isBuiltIn ? existing.name : compName.trim(),
      relationship: existing?.isBuiltIn ? existing.relationship : compRel,
      temperament: compTemp, intensity: compIntensity, language: compLang,
      voiceId: compVoiceId, stability: compStability, similarityBoost: compSimilarity,
      styleExaggeration: compStyle, speakingRate: compRate,
      customInstructions: compNotes.trim() || `Speak as a ${compTemp.toLowerCase()} ${(existing?.relationship || compRel).toLowerCase()} with ${compIntensity.toLowerCase()} intensity.`,
      isBuiltIn: existing?.isBuiltIn || false, isAnimeArchetype: existing?.isAnimeArchetype || false,
    };
    const nextCustom = existing?.isBuiltIn
      ? [...workspace.customCompanions.filter((item) => item.id !== newCompanion.id), newCompanion]
      : editingCompanionId
        ? workspace.customCompanions.map((item) => item.id === editingCompanionId ? newCompanion : item)
        : [...workspace.customCompanions, newCompanion];
    await persistWorkspace({ ...workspace, customCompanions: nextCustom, settings: { ...workspace.settings, defaultCompanionId: newCompanion.id } });
    setCompName(""); setCompNotes(""); setEditingCompanionId(null);
    setStatusBanner(`${existing ? "Updated" : "Created"} companion settings for "${newCompanion.name}".`);
  };

  const handleDeleteCompanion = async (compId: string) => {
    const fallbackId = "comp-coach";
    const nextCustom = workspace.customCompanions.filter(
      (c) => c.id !== compId
    );
    // Gracefully reassign any tasks referencing the deleted companion
    const nextTasks = workspace.tasks.map((t) =>
      t.companionId === compId ? { ...t, companionId: fallbackId } : t
    );
    const nextDefault =
      workspace.settings.defaultCompanionId === compId
        ? fallbackId
        : workspace.settings.defaultCompanionId;

    await persistWorkspace({
      ...workspace,
      customCompanions: nextCustom,
      tasks: nextTasks,
      settings: { ...workspace.settings, defaultCompanionId: nextDefault },
    });
    setStatusBanner(
      "Custom companion deleted. Assigned tasks were safely reassigned to Coach Marcus."
    );
  };

  // 6. Auth Handlers
  const handleLaunchClick = () => {
    if (user) {
      setViewMode("app");
    } else {
      setViewMode("auth");
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);

    if (!isFirebaseConfigured || !auth) {
      setAuthError(
        "Firebase environment variables are not yet entered in Vercel. Click 'Enter Workspace (Local Persistence Mode)' below to use all features right now."
      );
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setViewMode("app");
      } else if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setViewMode("app");
      } else if (authMode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setAuthMessage(
          "Password recovery email sent. Please check your inbox."
        );
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        setAuthError("Incorrect email or password.");
      } else if (code === "auth/email-already-in-use") {
        setAuthError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setAuthError("Password must be at least 6 characters.");
      } else {
        setAuthError(err?.message || "Authentication failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    stopAudioPlayback();
    if (auth) {
      await signOut(auth);
    }
    setUser(null);
    setViewMode("landing");
  };

  // Derived Metrics for Today Dashboard
  const openTasks = workspace.tasks.filter((t) => !t.completed);
  const completedTodayCount = workspace.tasks.filter(
    (t) =>
      (t.completed && t.completedAt?.startsWith(todayIso)) ||
      t.completedOccurrences.includes(todayIso)
  ).length;
  const totalTodayCount = openTasks.length + completedTodayCount;
  const nextUpcomingTask = [...openTasks].sort((a, b) =>
    `${a.dueDate}T${a.dueTime}`.localeCompare(`${b.dueDate}T${b.dueTime}`)
  )[0];

  const currentDateFormatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // ===========================================================================
  // VIEW 1: LANDING PAGE
  // ===========================================================================
  if (viewMode === "landing") {
    return (
      <main className="min-h-screen bg-bg-primary architectural-grid flex flex-col justify-between">
        <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-copper" />
            <span className="text-xs font-semibold tracking-[0.22em] uppercase text-text-primary">
              HEY YOU! COMPANION
            </span>
          </div>
          <button
            onClick={handleLaunchClick}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors fine-border px-4 py-2 rounded-full bg-bg-secondary"
          >
            {user ? "Open Workspace" : "Sign In"}
          </button>
        </header>

        <section className="w-full max-w-7xl mx-auto px-6 py-8 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bg-elevated fine-border">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
              <span className="text-xs uppercase tracking-[0.18em] text-copper-champagne">
                YOUR VOICE, REFINED
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-text-primary leading-[1.08]">
              Give your words another dimension.
            </h1>

            <p className="text-base sm:text-lg text-text-secondary max-w-xl leading-relaxed">
              A personal space to shape your commitments, build your companion,
              and hear the reminders that keep you moving.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={handleLaunchClick}
                className="metallic-button px-7 py-3.5 rounded-full text-sm inline-flex items-center gap-2.5 shadow-lg"
              >
                <span>Launch companion</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <span className="text-xs uppercase tracking-[0.16em] text-text-muted">
                YOUR COMMITMENTS. YOUR COMPANION. YOUR TERMS.
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center justify-center order-1 lg:order-2">
            <MetallicOrb size={340} state="idle" />
          </div>
        </section>

        <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <span>HEY YOU! COMPANION</span>
          <span>PERSONAL ACCOUNTABILITY & AI VOICE SYSTEM</span>
        </footer>
      </main>
    );
  }

  // ===========================================================================
  // VIEW 2: AUTHENTICATION
  // ===========================================================================
  if (viewMode === "auth") {
    return (
      <main className="min-h-screen bg-bg-primary architectural-grid flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-md bg-bg-elevated fine-border rounded-2xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMode("landing")}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Back to landing
            </button>
            <span className="text-xs uppercase tracking-[0.18em] text-copper-light">
              HEY YOU! COMPANION
            </span>
          </div>

          <div className="flex justify-center py-2">
            <MetallicOrb size={140} state="idle" />
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-semibold text-text-primary">
              {authMode === "signin" && "Enter your workspace"}
              {authMode === "signup" && "Create your account"}
              {authMode === "reset" && "Reset your password"}
            </h2>
            <p className="text-sm text-text-secondary">
              {authMode === "signin" &&
                "Sign in to access your companions and scheduled commitments."}
              {authMode === "signup" &&
                "Set up your private accountability account."}
              {authMode === "reset" &&
                "Enter your email to receive a password recovery link."}
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="p-3.5 rounded-xl bg-bg-surface fine-border-copper text-xs text-text-secondary space-y-2">
              <div className="flex items-center gap-2 text-copper-champagne font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Local Persistence Active</span>
              </div>
              <p>
                Firebase environment keys are not yet added in Vercel. You can
                enter the full application right now using persistent local
                storage.
              </p>
              <button
                type="button"
                onClick={() => setViewMode("app")}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-text-primary font-medium transition-colors"
              >
                Enter Workspace (Local Persistence Mode)
              </button>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200">
              {authError}
            </div>
          )}

          {authMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200">
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-secondary fine-border text-sm text-text-primary focus:outline-none focus:border-violet"
              />
            </div>

            {authMode !== "reset" && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-secondary fine-border text-sm text-text-primary focus:outline-none focus:border-violet"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || authLoading}
              className="w-full metallic-button py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {submitting
                ? "Processing..."
                : authMode === "signin"
                ? "Sign In"
                : authMode === "signup"
                ? "Create Account"
                : "Send Recovery Email"}
            </button>
          </form>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-text-secondary">
            {authMode === "signin" ? (
              <>
                <button
                  onClick={() => setAuthMode("signup")}
                  className="hover:text-text-primary"
                >
                  Create an account
                </button>
                <button
                  onClick={() => setAuthMode("reset")}
                  className="hover:text-text-primary"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthMode("signin")}
                className="hover:text-text-primary"
              >
                Return to Sign In
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ===========================================================================
  // VIEW 3: MAIN APPLICATION (TODAY, TASKS, COMPANIONS, PARTNER, SETTINGS)
  // ===========================================================================
  const navItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: "today", label: "Today", icon: <Calendar className="w-4 h-4" /> },
    { id: "tasks", label: "Tasks", icon: <CheckSquare className="w-4 h-4" /> },
    {
      id: "companions",
      label: "Companions",
      icon: <Sparkles className="w-4 h-4" />,
    },
    { id: "partner", label: "Partner", icon: <Users className="w-4 h-4" /> },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col md:flex-row pb-20 md:pb-0">
      <audio
        ref={audioRef}
        onEnded={() => setOrbState("idle")}
        onPause={() => setOrbState("idle")}
        className="hidden"
      />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:justify-between bg-bg-secondary border-r border-white/5 p-6 shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-copper" />
            <span className="text-xs font-semibold tracking-[0.2em] uppercase">
              HEY YOU!
            </span>
          </div>

          <nav className="space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-bg-elevated text-copper-champagne fine-border-violet"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-6 border-t border-white/5">
          <div className="text-xs text-text-muted truncate">
            {user ? user.email : `Local Workspace (${storageSource})`}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary py-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{user ? "Sign out" : "Return to Landing"}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              {currentDateFormatted}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary mt-1">
              {activeNav === "today" && "Today"}
              {activeNav === "tasks" && "Commitments & Schedule"}
              {activeNav === "companions" && "Companions & Personalities"}
              {activeNav === "partner" && "Accountability Partner"}
              {activeNav === "settings" && "System Settings"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-text-secondary">
              Active:{" "}
              <strong className="text-copper-champagne">
                {activeCompanion.name}
              </strong>{" "}
              ({activeCompanion.intensity})
            </span>
          </div>
        </div>

        {statusBanner && (
          <div className="p-4 rounded-xl bg-bg-elevated fine-border-copper flex items-center justify-between gap-4 text-xs text-copper-champagne">
            <span>{statusBanner}</span>
            <button
              onClick={() => setStatusBanner(null)}
              className="text-text-muted hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =============================================================== */}
        {/* 1. TODAY DASHBOARD & VOICE CORE */}
        {/* =============================================================== */}
        {activeNav === "today" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              {/* Next Commitment Card */}
              <section className="p-6 rounded-2xl bg-bg-elevated fine-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-copper-champagne">
                    Next Commitment
                  </span>
                  <span className="text-xs text-text-muted flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-violet-soft" />
                    {nextUpcomingTask
                      ? `${nextUpcomingTask.dueDate} at ${nextUpcomingTask.dueTime}`
                      : "No open tasks"}
                  </span>
                </div>

                {nextUpcomingTask ? (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">
                        {nextUpcomingTask.title}
                      </h2>
                      {nextUpcomingTask.description && (
                        <p className="text-sm text-text-secondary mt-1">
                          {nextUpcomingTask.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <span className="px-2.5 py-1 rounded-full bg-bg-surface fine-border">
                        Companion:{" "}
                        {allCompanions.find(
                          (c) => c.id === nextUpcomingTask.companionId
                        )?.name || activeCompanion.name}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-bg-surface fine-border">
                        Recurrence: {nextUpcomingTask.recurrence}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => handleCompleteTask(nextUpcomingTask)}
                        className="metallic-button px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Complete</span>
                      </button>
                      <button
                        onClick={() =>
                          handleSnoozeTask(
                            nextUpcomingTask,
                            workspace.settings.defaultSnoozeMinutes
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-bg-surface fine-border text-xs text-text-secondary hover:text-text-primary"
                      >
                        Snooze ({workspace.settings.defaultSnoozeMinutes}m)
                      </button>
                      <button
                        onClick={() =>
                          triggerCompanionReminder(
                            nextUpcomingTask,
                            "Direct check-in"
                          )
                        }
                        className="px-4 py-2 rounded-xl bg-violet/15 border border-violet/40 text-xs text-violet-soft hover:bg-violet/25 inline-flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Hear Companion Reminder</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-text-secondary">
                      You have no open commitments scheduled. Add your first
                      commitment to put your companion on watch.
                    </p>
                    <button
                      onClick={() => setActiveNav("tasks")}
                      className="metallic-button px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Commitment</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Daily Metrics */}
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-bg-elevated fine-border">
                  <span className="text-xs text-text-muted">
                    Completed Today
                  </span>
                  <p className="text-2xl font-semibold text-text-primary mt-1">
                    {completedTodayCount} / {totalTodayCount}
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-bg-elevated fine-border">
                  <span className="text-xs text-text-muted">
                    Open Commitments
                  </span>
                  <p className="text-2xl font-semibold text-text-primary mt-1">
                    {openTasks.length}
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-bg-elevated fine-border">
                  <span className="text-xs text-text-muted">Quiet Hours</span>
                  <p className="text-sm font-medium text-copper-champagne mt-2">
                    {workspace.settings.quietHoursEnabled
                      ? `${workspace.settings.quietHoursStart} – ${workspace.settings.quietHoursEnd}`
                      : "Disabled"}
                  </p>
                </div>
              </section>

              {/* Voice Core Studio */}
              <section className="p-6 rounded-2xl bg-bg-elevated fine-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-copper-light" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">
                      Voice Core — AI Speech Studio
                    </h2>
                  </div>
                  <select
                    value={selectedVoiceCompId}
                    onChange={(e) => setSelectedVoiceCompId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-bg-secondary fine-border text-xs text-text-primary"
                  >
                    {allCompanions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.temperament} / {c.intensity})
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  maxLength={1000}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Write a script or click 'Draft with Companion Personality' below..."
                  className="w-full p-3.5 rounded-xl bg-bg-secondary fine-border text-sm text-text-primary focus:outline-none focus:border-violet"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-text-muted">
                    {scriptText.length} / 1000 characters
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const comp =
                          allCompanions.find(
                            (c) => c.id === selectedVoiceCompId
                          ) || activeCompanion;
                        const res = await fetch("/api/companion-message", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            companion: comp,
                            taskTitle:
                              nextUpcomingTask?.title ||
                              "staying disciplined on today's priorities",
                            stageLabel: "Direct check-in",
                          }),
                        });
                        const data = await res.json();
                        if (data.script) setScriptText(data.script);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-bg-surface fine-border text-xs text-text-secondary hover:text-text-primary"
                    >
                      Draft with Companion Personality
                    </button>

                    <button
                      type="button"
                      disabled={orbState === "generating"}
                      onClick={() => {
                        const comp =
                          allCompanions.find(
                            (c) => c.id === selectedVoiceCompId
                          ) || activeCompanion;
                        synthesizeAndPlaySpeech(scriptText, comp);
                      }}
                      className="metallic-button px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {orbState === "generating"
                          ? "Generating..."
                          : "Generate & Speak"}
                      </span>
                    </button>

                    {orbState === "speaking" && (
                      <button
                        type="button"
                        onClick={stopAudioPlayback}
                        className="px-3 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 inline-flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>
                </div>

                {voiceFeedback && (
                  <p className="text-xs text-copper-champagne pt-1">
                    {voiceFeedback}
                  </p>
                )}

                {/* Recent Scripts History */}
                {workspace.scripts.length > 0 && (
                  <div className="pt-4 border-t border-white/5 space-y-2.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
                      Recent Generated Scripts
                    </span>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {workspace.scripts.map((scr) => (
                        <div
                          key={scr.id}
                          className="p-3 rounded-xl bg-bg-secondary fine-border flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-copper-champagne">
                                {scr.companionName}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-elevated text-text-muted">
                                {scr.providerUsed === "elevenlabs"
                                  ? "ElevenLabs AI"
                                  : "Browser Voice"}
                              </span>
                            </div>
                            <p className="text-text-secondary line-clamp-2">
                              {scr.text}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setScriptText(scr.text);
                                const comp =
                                  allCompanions.find(
                                    (c) => c.id === scr.companionId
                                  ) || activeCompanion;
                                synthesizeAndPlaySpeech(scr.text, comp);
                              }}
                              className="p-1.5 rounded-lg bg-bg-elevated hover:bg-white/10 text-text-primary"
                              title="Replay"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            {scr.audioDataUrl && (
                              <a
                                href={scr.audioDataUrl}
                                download={`hey-you-${scr.id}.mp3`}
                                className="p-1.5 rounded-lg bg-bg-elevated hover:bg-white/10 text-text-primary"
                                title="Download MP3"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Orb Presence */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-bg-secondary fine-border flex flex-col items-center text-center space-y-4">
              <span className="text-xs uppercase tracking-[0.16em] text-violet-soft">
                {activeCompanion.name} — {orbState.toUpperCase()}
              </span>
              <MetallicOrb size={280} state={orbState} interactive onClick={() => triggerCompanionReminder({
                id: "orb-preview", title: "staying focused on your priorities", description: "", dueDate: todayIso,
                dueTime: "12:00", timeZone: "UTC", recurrence: "Once", companionId: activeCompanion.id,
                reminderStages: [15], maxFollowUps: 1, followUpCount: 0, snoozedUntil: null,
                completed: false, completedAt: null, completedOccurrences: [], firedStages: [],
                sharedWithPartner: false, createdAt: todayIso, updatedAt: todayIso,
              }, "Companion preview")} />
              <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Tap the orb to hear {activeCompanion.name}</span>
              <p className="text-xs text-text-secondary max-w-xs">
                {activeCompanion.customInstructions}
              </p>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 2. TASKS MODULE */}
        {/* =============================================================== */}
        {activeNav === "tasks" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <form
              onSubmit={handleSaveTask}
              className="lg:col-span-5 p-6 rounded-2xl bg-bg-elevated fine-border space-y-4"
            >
              <h2 className="text-lg font-semibold text-text-primary">
                {editingTaskId ? "Edit Commitment" : "New Commitment"}
              </h2>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Commitment Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Finish client voiceover reel"
                  className="w-full px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Optional Notes
                </label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Export clean WAV and check pacing"
                  className="w-full px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={taskTime}
                    onChange={(e) => setTaskTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Recurrence
                  </label>
                  <select
                    value={taskRecurrence}
                    onChange={(e) =>
                      setTaskRecurrence(e.target.value as RecurrenceRule)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    <option value="Once">One-time</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekdays">Weekdays (Mon–Fri)</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Assigned Companion
                  </label>
                  <select
                    value={taskCompanionId}
                    onChange={(e) => setTaskCompanionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    {allCompanions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.intensity})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <span className="block text-xs text-text-secondary">
                  Advance Reminder Stages
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stage30}
                      onChange={(e) => setStage30(e.target.checked)}
                    />
                    <span>30m prior</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stage15}
                      onChange={(e) => setStage15(e.target.checked)}
                    />
                    <span>15m prior</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={stage5}
                      onChange={(e) => setStage5(e.target.checked)}
                    />
                    <span>5m prior</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Max Follow-ups After Snooze
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={taskMaxFollowUps}
                    onChange={(e) =>
                      setTaskMaxFollowUps(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-text-secondary mt-4">
                  <input
                    type="checkbox"
                    checked={taskShared}
                    onChange={(e) => setTaskShared(e.target.checked)}
                  />
                  <span>Share status with Partner</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 metallic-button py-2.5 rounded-xl text-xs font-semibold"
                >
                  {editingTaskId ? "Update Commitment" : "Save Commitment"}
                </button>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaskId(null);
                      setTaskTitle("");
                      setTaskDesc("");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-bg-surface text-xs text-text-secondary"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Task List */}
            <div className="lg:col-span-7 space-y-4">
              {workspace.tasks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-bg-elevated fine-border text-center text-sm text-text-secondary">
                  No commitments created yet. Use the form on the left to
                  schedule your first task.
                </div>
              ) : (
                workspace.tasks.map((task) => {
                  const comp =
                    allCompanions.find((c) => c.id === task.companionId) ||
                    activeCompanion;
                  return (
                    <div
                      key={task.id}
                      className={`p-5 rounded-2xl bg-bg-elevated fine-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        task.completed ? "opacity-60" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary">
                            {task.title}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-bg-surface text-copper-champagne">
                            {comp.name}
                          </span>
                          {task.recurrence !== "Once" && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet/15 text-violet-soft">
                              {task.recurrence}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-text-secondary">
                            {task.description}
                          </p>
                        )}
                        <p className="text-xs text-text-muted">
                          Due: {task.dueDate} at {task.dueTime} | Stages:{" "}
                          {task.reminderStages.map((s) => `${s}m`).join(", ") ||
                            "None"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!task.completed && (
                          <>
                            <button
                              onClick={() => handleCompleteTask(task)}
                              className="metallic-button px-3 py-1.5 rounded-lg text-xs"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleSnoozeTask(task, 10)}
                              className="px-3 py-1.5 rounded-lg bg-bg-surface fine-border text-xs text-text-secondary"
                            >
                              Snooze 10m
                            </button>
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setTaskTitle(task.title);
                                setTaskDesc(task.description);
                                setTaskDate(task.dueDate);
                                setTaskTime(task.dueTime);
                                setTaskRecurrence(task.recurrence);
                                setTaskCompanionId(task.companionId);
                                setTaskShared(task.sharedWithPartner);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-bg-surface fine-border text-xs text-text-secondary"
                            >
                              Edit
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 text-red-300 hover:bg-red-950/70"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 3. COMPANIONS & PERSONALITIES */}
        {/* =============================================================== */}
        {activeNav === "companions" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Custom Companion Builder */}
            <form
              onSubmit={handleSaveCustomCompanion}
              className="lg:col-span-5 p-6 rounded-2xl bg-bg-elevated fine-border space-y-4"
            >
              <h2 className="text-lg font-semibold text-text-primary">
                Build Custom Companion
              </h2>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Companion Name
                </label>
                <input
                  type="text"
                  required={!editingCompanionId}
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="Give your companion a name"
                  className="w-full px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Relationship Type
                  </label>
                  <select
                    value={compRel}
                    onChange={(e) =>
                      setCompRel(e.target.value as RelationshipType)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    {[
                      "Mom",
                      "Dad",
                      "Brother",
                      "Sister",
                      "Son",
                      "Daughter",
                      "Husband",
                      "Wife",
                      "Boyfriend",
                      "Girlfriend",
                      "Best Friend",
                      "Coach",
                      "Boss",
                      "Anime Archetype",
                      "Custom",
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Temperament
                  </label>
                  <select
                    value={compTemp}
                    onChange={(e) =>
                      setCompTemp(e.target.value as Temperament)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    {[
                      "Calm",
                      "Fiery",
                      "Angry",
                      "Naggy",
                      "Sweet",
                      "Playful",
                      "Strict",
                      "Chaotic",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Intensity
                  </label>
                  <select
                    value={compIntensity}
                    onChange={(e) =>
                      setCompIntensity(e.target.value as IntensityLevel)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    <option value="Soft">Soft — Gentle & Reassuring</option>
                    <option value="Firm">Firm — Direct & Expectant</option>
                    <option value="Fierce">Fierce — Urgent & Unyielding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    Language Preference
                  </label>
                  <select
                    value={compLang}
                    onChange={(e) =>
                      setCompLang(e.target.value as LanguageOption)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  >
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                    <option value="English + Japanese">
                      English + Japanese
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Voice Model
                </label>
                <select
                  value={compVoiceId}
                  onChange={(e) => setCompVoiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                >
                  {AVAILABLE_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-text-secondary mb-1">
                    Voice Stability ({compStability})
                  </label>
                  <input
                    type="range"
                    min={0.2}
                    max={0.95}
                    step={0.05}
                    value={compStability}
                    onChange={(e) => setCompStability(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">
                    Speaking Speed ({compRate}x)
                  </label>
                  <input
                    type="range"
                    min={0.85}
                    max={1.2}
                    step={0.05}
                    value={compRate}
                    onChange={(e) => setCompRate(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-secondary mb-1">
                  Personality Instructions
                </label>
                <textarea
                  rows={2}
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  placeholder="How should this companion hold you accountable?"
                  className="w-full px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 metallic-button py-2.5 rounded-xl text-xs font-semibold">{editingCompanionId ? "Save Changes" : "Create Companion"}</button>
                {editingCompanionId && <button type="button" onClick={() => { setEditingCompanionId(null); setCompName(""); setCompNotes(""); }} className="px-4 py-2.5 rounded-xl bg-bg-surface fine-border text-xs">Cancel</button>}
              </div>
            </form>

            {/* Companion Roster */}
            <div className="lg:col-span-7 space-y-4">
              {allCompanions.map((comp) => {
                const isDefault =
                  workspace.settings.defaultCompanionId === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={`p-5 rounded-2xl bg-bg-elevated fine-border space-y-3 ${
                      isDefault ? "fine-border-copper" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">
                          {comp.name}
                        </h3>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-bg-surface text-copper-champagne">
                          {comp.relationship}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-bg-surface text-text-secondary">
                          {comp.temperament} • {comp.intensity}
                        </span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet/15 text-violet-soft">
                          {comp.language}
                        </span>
                      </div>

                      {!comp.isBuiltIn && (
                        <button
                          onClick={() => handleDeleteCompanion(comp.id)}
                          className="p-1.5 rounded-lg bg-red-950/40 text-red-300"
                          title="Delete Custom Companion"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-text-secondary">
                      {comp.customInstructions}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          persistWorkspace({
                            ...workspace,
                            settings: {
                              ...workspace.settings,
                              defaultCompanionId: comp.id,
                            },
                          })
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs ${
                          isDefault
                            ? "metallic-button"
                            : "bg-bg-surface fine-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {isDefault ? "Active Default" : "Set as Default"}
                      </button>

                      <button
                        onClick={() => {
                          setEditingCompanionId(comp.id); setCompName(comp.isBuiltIn ? "" : comp.name);
                          setCompRel(comp.relationship); setCompTemp(comp.temperament); setCompIntensity(comp.intensity);
                          setCompLang(comp.language); setCompVoiceId(comp.voiceId); setCompStability(comp.stability);
                          setCompSimilarity(comp.similarityBoost); setCompStyle(comp.styleExaggeration);
                          setCompRate(comp.speakingRate); setCompNotes(comp.customInstructions);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-bg-surface fine-border text-xs text-text-secondary"
                      >Customize</button>
                      <button
                        onClick={() =>
                          triggerCompanionReminder(
                            {
                              id: "preview",
                              title: "staying focused on your primary goal",
                              description: "",
                              dueDate: todayIso,
                              dueTime: "12:00",
                              timeZone: "UTC",
                              recurrence: "Once",
                              companionId: comp.id,
                              reminderStages: [15],
                              maxFollowUps: 1,
                              followUpCount: 0,
                              snoozedUntil: null,
                              completed: false,
                              completedAt: null,
                              completedOccurrences: [],
                              firedStages: [],
                              sharedWithPartner: false,
                              createdAt: todayIso,
                              updatedAt: todayIso,
                            },
                            "Voice Preview"
                          )
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-bg-surface fine-border text-xs text-copper-champagne inline-flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Preview Voice</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 4. ACCOUNTABILITY PARTNER MODULE */}
        {/* =============================================================== */}
        {activeNav === "partner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 p-6 rounded-2xl bg-bg-elevated fine-border space-y-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-copper-light" />
                <h2 className="text-lg font-semibold">
                  Invite Accountability Partner
                </h2>
              </div>
              <p className="text-xs text-text-secondary">
                Generate an invitation code to link with a trusted partner.
                Private scripts, voice recordings, and unshared tasks are never
                exposed.
              </p>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={partnerEmailInput}
                  onChange={(e) => setPartnerEmailInput(e.target.value)}
                  placeholder="partner@example.com"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!partnerEmailInput.trim()) return;
                    const code = `HY-${Math.random()
                      .toString(36)
                      .substring(2, 8)
                      .toUpperCase()}`;
                    persistWorkspace({
                      ...workspace,
                      partnerLinks: [
                        ...workspace.partnerLinks,
                        {
                          inviteCode: code,
                          status: "pending",
                          partnerEmail: partnerEmailInput.trim(),
                          linkedAt: new Date().toISOString(),
                        },
                      ],
                    });
                    setPartnerEmailInput("");
                    setStatusBanner(`Generated partner invite code: ${code}`);
                  }}
                  className="metallic-button px-4 py-2 rounded-xl text-xs"
                >
                  Create Invite
                </button>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-2">
                <label className="block text-xs text-text-secondary">
                  Have a Partner Invite Code?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={acceptCodeInput}
                    onChange={(e) => setAcceptCodeInput(e.target.value)}
                    placeholder="HY-XXXXXX"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!acceptCodeInput.trim()) return;
                      persistWorkspace({
                        ...workspace,
                        partnerLinks: [
                          ...workspace.partnerLinks,
                          {
                            inviteCode: acceptCodeInput.trim().toUpperCase(),
                            status: "accepted",
                            partnerEmail: "Connected Partner",
                            linkedAt: new Date().toISOString(),
                          },
                        ],
                      });
                      setAcceptCodeInput("");
                      setStatusBanner("Partner connection established.");
                    }}
                    className="px-4 py-2 rounded-xl bg-violet/20 border border-violet/40 text-xs text-violet-soft"
                  >
                    Accept Code
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 p-6 rounded-2xl bg-bg-elevated fine-border space-y-4">
              <h2 className="text-lg font-semibold">
                Shared Commitments & Partner Status
              </h2>
              {workspace.partnerLinks.length === 0 ? (
                <p className="text-xs text-text-secondary">
                  No active partner links yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {workspace.partnerLinks.map((pl) => (
                    <div
                      key={pl.inviteCode}
                      className="p-3 rounded-xl bg-bg-secondary fine-border flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-copper-champagne">
                          {pl.partnerEmail}
                        </span>
                        <span className="ml-2 text-text-muted">
                          Code: {pl.inviteCode} ({pl.status})
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          persistWorkspace({
                            ...workspace,
                            partnerLinks: workspace.partnerLinks.filter(
                              (item) => item.inviteCode !== pl.inviteCode
                            ),
                          })
                        }
                        className="text-red-300 hover:underline"
                      >
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/5 space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
                  Commitments Marked for Partner Sharing
                </span>
                {workspace.tasks.filter((t) => t.sharedWithPartner).length ===
                0 ? (
                  <p className="text-xs text-text-secondary">
                    No tasks are currently shared. Toggle &quot;Share status
                    with Partner&quot; on any task to include it here.
                  </p>
                ) : (
                  workspace.tasks
                    .filter((t) => t.sharedWithPartner)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-bg-secondary fine-border flex items-center justify-between text-xs"
                      >
                        <span>{t.title}</span>
                        <span className="text-copper-champagne">
                          {t.completed ? "Completed" : `Due ${t.dueTime}`}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* 5. SETTINGS & PRIVACY CONTROLS */}
        {/* =============================================================== */}
        {activeNav === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 p-6 rounded-2xl bg-bg-elevated fine-border space-y-5">
              <h2 className="text-lg font-semibold">
                Notifications & Quiet Hours
              </h2>

              <div className="p-4 rounded-xl bg-bg-secondary fine-border flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Bell className="w-4 h-4 text-copper-light" />
                    <span>Browser Notification Permission</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    Current Status: {notifPermission.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (
                      typeof window !== "undefined" &&
                      "Notification" in window
                    ) {
                      const perm = await Notification.requestPermission();
                      setNotifPermission(perm);
                      persistWorkspace({
                        ...workspace,
                        settings: {
                          ...workspace.settings,
                          notificationsEnabled: perm === "granted",
                        },
                      });
                    }
                  }}
                  className="metallic-button px-4 py-2 rounded-xl text-xs"
                >
                  Enable Notifications
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between text-xs">
                  <span>Enforce Quiet Hours (Pause Ordinary Reminders)</span>
                  <input
                    type="checkbox"
                    checked={workspace.settings.quietHoursEnabled}
                    onChange={(e) =>
                      persistWorkspace({
                        ...workspace,
                        settings: {
                          ...workspace.settings,
                          quietHoursEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Quiet Hours Start
                    </label>
                    <input
                      type="time"
                      value={workspace.settings.quietHoursStart}
                      onChange={(e) =>
                        persistWorkspace({
                          ...workspace,
                          settings: {
                            ...workspace.settings,
                            quietHoursStart: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">
                      Quiet Hours End
                    </label>
                    <input
                      type="time"
                      value={workspace.settings.quietHoursEnd}
                      onChange={(e) =>
                        persistWorkspace({
                          ...workspace,
                          settings: {
                            ...workspace.settings,
                            quietHoursEnd: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-bg-secondary fine-border text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 p-6 rounded-2xl bg-bg-elevated fine-border space-y-5">
              <h2 className="text-lg font-semibold">
                Data & Privacy Management
              </h2>
              <p className="text-xs text-text-secondary">
                Storage Mode:{" "}
                <strong className="text-copper-champagne">
                  {storageSource === "firestore"
                    ? "Firebase Cloud Firestore"
                    : "Encrypted Browser Local Storage"}
                </strong>
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    persistWorkspace({ ...workspace, scripts: [] })
                  }
                  className="px-4 py-2 rounded-xl bg-bg-surface fine-border text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Script History</span>
                </button>

                <button
                  onClick={() => {
                    const fresh = getInitialWorkspace();
                    persistWorkspace(fresh);
                    setStatusBanner(
                      "All custom tasks, scripts, and custom companions have been reset."
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-200"
                >
                  Reset All Workspace Data
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary/95 backdrop-blur-md border-t border-white/10 px-3 py-2 flex items-center justify-around z-50"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl text-[11px] ${
                active
                  ? "text-copper-champagne font-medium"
                  : "text-text-muted"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
