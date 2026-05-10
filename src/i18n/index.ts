// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Lightweight i18n. No external deps — keeps the dep graph honest. Pattern:
//
//   import { useT } from "../../i18n";
//   const t = useT();
//   <h1>{t("dashboard.title")}</h1>
//
// All translation keys live in TRANSLATIONS below. TypeScript enforces that
// `t(...)` only accepts known keys, so missing strings fail at compile time
// rather than rendering "undefined" at runtime.
//
// To add a language: add it to `Locale`, add a column to each TRANSLATIONS
// entry, and surface it in the Settings language picker.

import { useSettingsStore } from "../stores/settingsStore";

export type Locale = "en" | "nl";

export const SUPPORTED_LOCALES: { id: Locale; label: string; flag: string }[] = [
  { id: "en", label: "English", flag: "🇬🇧" },
  { id: "nl", label: "Nederlands", flag: "🇳🇱" },
];

// Source of truth for every UI string. Keep keys grouped by feature for
// browsability; alphabetical within each group. Mockup-1 / mockup-2 Dutch
// labels are used verbatim in the `nl` column so the redesign matches the
// design intent on day one.
export const TRANSLATIONS = {
  // Splash / welcome
  "splash.start":              { en: "Start now",            nl: "Start nu" },
  "splash.signin":             { en: "Sign in",              nl: "Inloggen" },
  "splash.intro":              {
    en: "The smartest way to make any PC fully ready in just a few minutes.",
    nl: "De slimste manier om elke pc in enkele minuten volledig gebruiksklaar te maken.",
  },
  "splash.welcomeBack":        { en: "Welcome back!",        nl: "Welkom terug!" },
  "splash.readyHeadline":      {
    en: "Ready to optimise your PC?",
    nl: "Klaar om je PC te optimaliseren?",
  },
  "splash.pickOption":         { en: "Pick an option to get started.", nl: "Kies een optie om te beginnen." },
  "splash.getStarted":         { en: "Get started",          nl: "Aan de slag" },
  "splash.or":                 { en: "or",                   nl: "of" },
  "splash.loadLast":           { en: "Load last setup",      nl: "Laatste setup laden" },

  // Sidebar
  "nav.home":                  { en: "Home",                 nl: "Home" },
  "nav.snelsetup":             { en: "Quick setup",          nl: "Snelsetup" },
  "nav.aangepaste":            { en: "Custom setup",         nl: "Aangepaste setup" },
  "nav.profiles":              { en: "Profiles",             nl: "Profielen" },
  "nav.tools":                 { en: "Tools",                nl: "Tools" },
  "nav.fleet":                 { en: "Fleet",                nl: "Fleet" },
  "nav.settings":              { en: "Settings",             nl: "Instellingen" },
  "nav.about":                 { en: "About",                nl: "Over" },
  "sidebar.systemOptimal":     { en: "System optimal",       nl: "Systeem optimaal" },
  "sidebar.systemAttention":   { en: "Attention needed",     nl: "Aandacht nodig" },
  "sidebar.systemCritical":    { en: "Action required",      nl: "Actie vereist" },
  "sidebar.lastScan":          { en: "Last scan",            nl: "Laatste scan" },

  // Dashboard
  "dashboard.title":           { en: "Dashboard",            nl: "Dashboard" },
  "dashboard.scanSystem":      { en: "Scan system",          nl: "Systeem scannen" },
  "dashboard.scanning":        { en: "Scanning…",            nl: "Scannen…" },
  "dashboard.allNominal":      { en: "All systems nominal",  nl: "Alles in orde" },
  "dashboard.systemStatus":    { en: "System status",        nl: "Systeemstatus" },
  "dashboard.everythingOk":    { en: "Everything under control.", nl: "Alles onder controle." },
  "dashboard.someToAddress":   { en: "Some things to address.",   nl: "Enkele aandachtspunten." },
  "dashboard.optimisedUpToDate": {
    en: "Your system is optimised and up to date.",
    nl: "Je systeem is geoptimaliseerd en up-to-date.",
  },
  "dashboard.systemScore":     { en: "System score",         nl: "Systeemscore" },
  "dashboard.recentSetups":    { en: "Recent setups",        nl: "Recente setups" },
  "dashboard.viewAll":         { en: "View all",             nl: "Bekijk alle" },
  "dashboard.open":            { en: "Open",                 nl: "Openen" },

  // Quick Setup
  "snelsetup.title":           { en: "Quick Setup",          nl: "Snelsetup" },
  "snelsetup.tagline":         { en: "Full installation. Automatic.", nl: "Volledige installatie. Automatisch." },
  "snelsetup.intro":           {
    en: "Let FreshRig optimise your PC automatically with the best drivers, essential software, and tuned settings — based on your hardware.",
    nl: "Laat FreshRig je pc automatisch optimaliseren met de beste drivers, software en instellingen op basis van jouw hardware.",
  },
  "snelsetup.included":        { en: "What's included",      nl: "Wat zit erbij?" },
  "snelsetup.startCta":        { en: "Start Quick Setup",    nl: "Snelsetup starten" },
  "snelsetup.cancel":          { en: "Cancel",               nl: "Annuleren" },

  // Custom Setup
  "aangepaste.title":          { en: "Custom Setup",         nl: "Aangepaste setup" },
  "aangepaste.tagline":        { en: "You decide. Full control.", nl: "Jij bepaalt. Volledige controle." },
  "aangepaste.intro":          {
    en: "Build your own configuration — choose exactly what gets installed, optimised, and configured. Down to the smallest detail.",
    nl: "Stel zelf samen wat er geïnstalleerd, geoptimaliseerd en aangepast moet worden. Tot in elk detail.",
  },
  "aangepaste.categories":     { en: "Categories",           nl: "Categorieën" },
  "aangepaste.startCta":       { en: "Build Custom Setup",   nl: "Aangepaste setup maken" },
  "aangepaste.next":           { en: "Next: Settings",       nl: "Volgende: Instellingen" },
  "aangepaste.back":           { en: "Back",                 nl: "Terug" },
  "aangepaste.search":         { en: "Search software…",     nl: "Zoek software…" },
  "aangepaste.summary":        { en: "Selection summary",    nl: "Selectie overzicht" },
  "aangepaste.totalSelected":  { en: "Total selected",       nl: "Totaal geselecteerd" },
  "aangepaste.diskNeeded":     { en: "Disk space needed",    nl: "Opslagruimte nodig" },
  "aangepaste.estimatedTime":  { en: "Estimated time",       nl: "Geschatte installatietijd" },

  // Tools
  "tools.title":               { en: "Tools",                nl: "Tools" },
  "tools.intro":               {
    en: "Every individual tool, ready to use. Pick what you need — or use Quick Setup to run the recommended bundle automatically.",
    nl: "Elke tool afzonderlijk, klaar voor gebruik. Kies wat je nodig hebt — of gebruik Snelsetup voor het aanbevolen pakket.",
  },

  // Status pills
  "status.complete":           { en: "Complete",             nl: "Voltooid" },
  "status.scanning":           { en: "Scanning…",            nl: "Scannen…" },
  "status.waiting":            { en: "Waiting",              nl: "Wachten" },

  // Hex stepper labels (Quick Setup flow)
  "step.scan":                 { en: "Scan",                 nl: "Scannen" },
  "step.select":               { en: "Select",               nl: "Selecteren" },
  "step.settings":             { en: "Settings",             nl: "Instellingen" },
  "step.install":              { en: "Install",              nl: "Installeren" },
  "step.finish":               { en: "Finish",               nl: "Afronden" },

  // Hex stepper labels (Custom Setup flow)
  "step.categories":           { en: "Categories",           nl: "Categorieën" },
  "step.review":               { en: "Review",               nl: "Overzicht" },

  // Common
  "common.back":               { en: "Back",                 nl: "Terug" },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;

/**
 * Translation hook. Subscribes to the settings store's `locale` so the entire
 * UI re-renders when the user changes language. Falls back to English if a
 * key is somehow missing the active-locale entry.
 */
export function useT() {
  const locale = useSettingsStore((s) => s.settings.locale);
  return (key: TranslationKey): string => {
    const entry = TRANSLATIONS[key];
    return entry[locale] ?? entry.en;
  };
}

/** Synchronous lookup for callsites that aren't React components (rare —
 *  prefer `useT()`). Reads the current locale at call time without subscribing. */
export function tNow(key: TranslationKey): string {
  const locale = useSettingsStore.getState().settings.locale;
  const entry = TRANSLATIONS[key];
  return entry[locale] ?? entry.en;
}
