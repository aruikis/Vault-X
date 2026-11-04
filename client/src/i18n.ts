// Multi-language support (Anthony, Nov 4, 2026): Vault X in
// English (default), Spanish, German, French, and Japanese.
// The model mirrors the theme system (themes.ts): the pick
// applies app-wide immediately, mirrors to localStorage so
// the next open starts in the picked language, and saves to
// the collector profile on the server so it follows the user
// across devices.
//
// WHAT IS TRANSLATED: app UI text — navigation, headings,
// menus, labels, and system messages — through the string
// tables below. WHAT IS NEVER TRANSLATED: card and set
// names and all catalog data (they stay exactly as printed;
// a non-English printing is its own catalog item, not a
// translation), and user-generated content (usernames, deck
// names, custom locations, trade messages), which stays as
// its author wrote it.
//
// FALLBACK RULE: a string with no translation yet falls back
// to English — never a blank. Translations are a
// machine-translated first pass (Nov 4, 2026).
//
// Number, date, and currency formatting follows the selected
// language's locale through the Intl formatters here; the
// module-level active locale is what the app's shared money
// formatters read.

import { useSyncExternalStore } from "react";

export type LangId = "en" | "es" | "de" | "fr" | "ja";

export interface LangMeta {
  id: LangId;
  /** The language's own name for itself — picker labels are
      never translated, so every user can find their language. */
  label: string;
  /** BCP-47 locale for Intl number/date/currency formatting. */
  locale: string;
}

export const LANGUAGES: LangMeta[] = [
  { id: "en", label: "English", locale: "en-US" },
  { id: "es", label: "Español", locale: "es-ES" },
  { id: "de", label: "Deutsch", locale: "de-DE" },
  { id: "fr", label: "Français", locale: "fr-FR" },
  { id: "ja", label: "日本語", locale: "ja-JP" },
];

export const DEFAULT_LANG: LangId = "en";

const LANG_STORAGE_KEY = "vaultx-language";

export function isLangId(value: unknown): value is LangId {
  return (
    value === "en" ||
    value === "es" ||
    value === "de" ||
    value === "fr" ||
    value === "ja"
  );
}

export function localeOf(lang: LangId): string {
  return LANGUAGES.find((l) => l.id === lang)?.locale ?? "en-US";
}

/** The language mirrored on this device (set synchronously at
    startup, like the theme, so a reopen starts in the picked
    language from the first frame). */
export function readStoredLanguage(): LangId {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLangId(stored)) return stored;
  } catch {
    // Storage unavailable: English applies.
  }
  return DEFAULT_LANG;
}

let activeLang: LangId = DEFAULT_LANG;
const langListeners = new Set<() => void>();

function notifyLangChanged(): void {
  for (const fn of langListeners) fn();
}

/** The currently active language (module state, kept in step
    by applyLanguage; the shared formatters read it). */
export function currentLang(): LangId {
  return activeLang;
}

export function currentLocale(): string {
  return localeOf(activeLang);
}

/** Apply a language right now: set the document language,
    update the formatters' locale, and mirror the choice on
    this device. React re-rendering is driven by the App's
    language state + LangContext below. */
export function applyLanguage(lang: LangId): void {
  activeLang = lang;
  try {
    document.documentElement.lang = localeOf(lang);
  } catch {
    // No document (never in the app): nothing to set.
  }
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Storage unavailable: the language still applies now.
  }
  notifyLangChanged();
}

/** Read the device mirror once at startup (called by the App
    root's initial state and by main.tsx's first paint). */
export function initLanguageFromStorage(): LangId {
  const lang = readStoredLanguage();
  activeLang = lang;
  return lang;
}

type StringTable = Record<string, string>;

/** UI strings, keyed by dotted name. English is the source of
    truth and the fallback for every language. */
export const STRINGS: Record<LangId, StringTable> = {
  en: {
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.social": "Social",
    "nav.portfolio": "Portfolio",
    "nav.settings": "Settings",
    "forum.title": "Forums",
    "forum.newThread": "New thread",
    "forum.search": "Search threads or authors…",
    "forum.latest": "Latest",
    "forum.new": "New",
    "forum.topWeek": "Top this week",
    "forum.reply": "Reply",
    "forum.postReply": "Post reply",
    "forum.noThreads": "No threads yet — start the first one",
    "nav.main": "Main navigation",
    "home.yourCollections": "Your Collections",
    "home.topMovers": "Top movers · 24h",
    "home.opening": "Opening your vault…",
    "common.comingSoon": "Coming soon",
    "common.back": "Back",
    "common.loading": "Loading…",
    "common.close": "Close",
    "settings.theme": "Theme",
    "settings.language": "Language",
    "settings.yourCollections": "Your Collections",
    "settings.sharing": "Sharing",
    "settings.languageBlurb":
      "Pick the language for menus, buttons, and labels across the app. Card names and your own content always stay exactly as written.",
    "game.back": "Back",
    "game.allSets": "All sets",
    "game.copiesOwned": "Copies owned",
    "game.missingGhosted": "Missing — shown ghosted in the set until you add a copy.",
    "game.inCollection": "In your collection.",
    "game.searching": "Searching…",
    "game.downloadInProgress": "Catalog download in progress",
    "game.downloadNotStarted": "Catalog not downloaded yet",
    "game.downloading": "Downloading…",
    "game.continueDownload": "Continue download",
    "game.downloadCatalog": "Download catalog",
    "game.loadingSets": "Loading sets…",
    "game.loadingCards": "Loading cards…",
  },
  es: {
    "nav.home": "Inicio",
    "nav.search": "Buscar",
    "nav.social": "Social",
    "nav.portfolio": "Portafolio",
    "nav.settings": "Ajustes",
    "forum.title": "Foros",
    "forum.newThread": "Nuevo hilo",
    "forum.search": "Buscar hilos o autores…",
    "forum.latest": "Últimos",
    "forum.new": "Nuevos",
    "forum.topWeek": "Top de la semana",
    "forum.reply": "Responder",
    "forum.postReply": "Publicar respuesta",
    "forum.noThreads": "Aún no hay hilos — crea el primero",
    "nav.main": "Navegación principal",
    "home.yourCollections": "Tus colecciones",
    "home.topMovers": "Mayores movimientos · 24 h",
    "home.opening": "Abriendo tu bóveda…",
    "common.comingSoon": "Próximamente",
    "common.back": "Atrás",
    "common.loading": "Cargando…",
    "common.close": "Cerrar",
    "settings.theme": "Tema",
    "settings.language": "Idioma",
    "settings.yourCollections": "Tus colecciones",
    "settings.sharing": "Compartir",
    "settings.languageBlurb":
      "Elige el idioma de los menús, botones y etiquetas de la app. Los nombres de las cartas y tu propio contenido siempre quedan exactamente como están escritos.",
    "game.back": "Atrás",
    "game.allSets": "Todos los sets",
    "game.copiesOwned": "Copias que tienes",
    "game.missingGhosted": "Falta — se muestra atenuado en el set hasta que añadas una copia.",
    "game.inCollection": "En tu colección.",
    "game.searching": "Buscando…",
    "game.downloadInProgress": "Descarga del catálogo en curso",
    "game.downloadNotStarted": "El catálogo aún no se ha descargado",
    "game.downloading": "Descargando…",
    "game.continueDownload": "Continuar la descarga",
    "game.downloadCatalog": "Descargar el catálogo",
    "game.loadingSets": "Cargando sets…",
    "game.loadingCards": "Cargando cartas…",
  },
  de: {
    "nav.home": "Start",
    "nav.search": "Suche",
    "nav.social": "Sozial",
    "nav.portfolio": "Portfolio",
    "nav.settings": "Einstellungen",
    "forum.title": "Foren",
    "forum.newThread": "Neues Thema",
    "forum.search": "Themen oder Autoren suchen…",
    "forum.latest": "Neueste",
    "forum.new": "Neu",
    "forum.topWeek": "Top der Woche",
    "forum.reply": "Antworten",
    "forum.postReply": "Antwort posten",
    "forum.noThreads": "Noch keine Themen — starte das erste",
    "nav.main": "Hauptnavigation",
    "home.yourCollections": "Deine Sammlungen",
    "home.topMovers": "Top-Bewegungen · 24 Std.",
    "home.opening": "Dein Tresor wird geöffnet…",
    "common.comingSoon": "Demnächst verfügbar",
    "common.back": "Zurück",
    "common.loading": "Wird geladen…",
    "common.close": "Schließen",
    "settings.theme": "Design",
    "settings.language": "Sprache",
    "settings.yourCollections": "Deine Sammlungen",
    "settings.sharing": "Teilen",
    "settings.languageBlurb":
      "Wähle die Sprache für Menüs, Schaltflächen und Beschriftungen in der ganzen App. Kartennamen und deine eigenen Inhalte bleiben immer genau so, wie sie geschrieben sind.",
    "game.back": "Zurück",
    "game.allSets": "Alle Sets",
    "game.copiesOwned": "Vorhandene Exemplare",
    "game.missingGhosted": "Fehlt — wird im Set blass angezeigt, bis du ein Exemplar hinzufügst.",
    "game.inCollection": "In deiner Sammlung.",
    "game.searching": "Suche läuft…",
    "game.downloadInProgress": "Katalog-Download läuft",
    "game.downloadNotStarted": "Katalog noch nicht heruntergeladen",
    "game.downloading": "Wird heruntergeladen…",
    "game.continueDownload": "Download fortsetzen",
    "game.downloadCatalog": "Katalog herunterladen",
    "game.loadingSets": "Sets werden geladen…",
    "game.loadingCards": "Karten werden geladen…",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.search": "Rechercher",
    "nav.social": "Social",
    "nav.portfolio": "Portefeuille",
    "nav.settings": "Réglages",
    "forum.title": "Forums",
    "forum.newThread": "Nouveau sujet",
    "forum.search": "Rechercher des sujets ou des auteurs…",
    "forum.latest": "Récents",
    "forum.new": "Nouveaux",
    "forum.topWeek": "Top de la semaine",
    "forum.reply": "Répondre",
    "forum.postReply": "Publier la réponse",
    "forum.noThreads": "Aucun sujet pour le moment — lancez le premier",
    "nav.main": "Navigation principale",
    "home.yourCollections": "Vos collections",
    "home.topMovers": "Plus fortes variations · 24 h",
    "home.opening": "Ouverture de votre coffre…",
    "common.comingSoon": "Bientôt disponible",
    "common.back": "Retour",
    "common.loading": "Chargement…",
    "common.close": "Fermer",
    "settings.theme": "Thème",
    "settings.language": "Langue",
    "settings.yourCollections": "Vos collections",
    "settings.sharing": "Partage",
    "settings.languageBlurb":
      "Choisissez la langue des menus, boutons et libellés dans toute l'app. Les noms de cartes et vos propres contenus restent toujours exactement tels qu'ils sont écrits.",
    "game.back": "Retour",
    "game.allSets": "Tous les sets",
    "game.copiesOwned": "Exemplaires possédés",
    "game.missingGhosted": "Manquant — affiché en transparence dans le set jusqu'à l'ajout d'un exemplaire.",
    "game.inCollection": "Dans votre collection.",
    "game.searching": "Recherche…",
    "game.downloadInProgress": "Téléchargement du catalogue en cours",
    "game.downloadNotStarted": "Catalogue pas encore téléchargé",
    "game.downloading": "Téléchargement…",
    "game.continueDownload": "Continuer le téléchargement",
    "game.downloadCatalog": "Télécharger le catalogue",
    "game.loadingSets": "Chargement des sets…",
    "game.loadingCards": "Chargement des cartes…",
  },
  ja: {
    "nav.home": "ホーム",
    "nav.search": "検索",
    "nav.social": "ソーシャル",
    "nav.portfolio": "ポートフォリオ",
    "nav.settings": "設定",
    "forum.title": "フォーラム",
    "forum.newThread": "新しいスレッド",
    "forum.search": "スレッドや投稿者を検索…",
    "forum.latest": "最新",
    "forum.new": "新着",
    "forum.topWeek": "今週のトップ",
    "forum.reply": "返信",
    "forum.postReply": "返信を投稿",
    "forum.noThreads": "まだスレッドがありません — 最初のスレッドを立てましょう",
    "nav.main": "メインナビゲーション",
    "home.yourCollections": "あなたのコレクション",
    "home.topMovers": "値動きトップ · 24時間",
    "home.opening": "ボールトを開いています…",
    "common.comingSoon": "近日公開",
    "common.back": "戻る",
    "common.loading": "読み込み中…",
    "common.close": "閉じる",
    "settings.theme": "テーマ",
    "settings.language": "言語",
    "settings.yourCollections": "あなたのコレクション",
    "settings.sharing": "共有",
    "settings.languageBlurb":
      "アプリ全体のメニュー、ボタン、ラベルの言語を選んでください。カード名とあなた自身のコンテンツは、書かれたままの表記が常に維持されます。",
    "game.back": "戻る",
    "game.allSets": "すべてのセット",
    "game.copiesOwned": "所有数",
    "game.missingGhosted": "未所有 — コピーを追加するまでセット内では半透明で表示されます。",
    "game.inCollection": "コレクションに入っています。",
    "game.searching": "検索中…",
    "game.downloadInProgress": "カタログをダウンロード中",
    "game.downloadNotStarted": "カタログはまだダウンロードされていません",
    "game.downloading": "ダウンロード中…",
    "game.continueDownload": "ダウンロードを続ける",
    "game.downloadCatalog": "カタログをダウンロード",
    "game.loadingSets": "セットを読み込み中…",
    "game.loadingCards": "カードを読み込み中…",
  },
};

/** Translate a UI string key for a language, falling back to
    English (and finally to the key itself) — never blank. */
export function translate(lang: LangId, key: string): string {
  return STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
}

/** The active UI language, subscribed from the module store:
    every consumer re-renders the moment the user picks a new
    language in Settings — the change applies app-wide
    immediately, like themes. */
export function useLang(): LangId {
  return useSyncExternalStore(
    (fn) => {
      langListeners.add(fn);
      return () => {
        langListeners.delete(fn);
      };
    },
    () => activeLang,
    () => activeLang,
  );
}

/** A translator bound to the active language. */
export function useT(): (key: string) => string {
  const lang = useLang();
  return (key: string) => translate(lang, key);
}

/** USD in the active language's locale (currency symbol and
    grouping follow the locale; the currency stays USD). */
export function fmtMoneyUSD(n: number, digits = 2): string {
  try {
    return new Intl.NumberFormat(currentLocale(), {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  }
}

/** Plain number grouping in the active locale. */
export function fmtCount(n: number): string {
  try {
    return new Intl.NumberFormat(currentLocale()).format(n);
  } catch {
    return n.toLocaleString("en-US");
  }
}

/** Date in the active locale. */
export function fmtDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat(currentLocale(), {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return d.toLocaleDateString("en-US");
  }
}
