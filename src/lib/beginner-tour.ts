/** Local, account-scoped tour state. Does not write to auth or usage tables. */
export type TourResult = "skipped" | "completed";
export type TourStep = {
  id: string;
  path: string;
  selector: string;
  title: string;
  description: string;
  hint: string;
};

export const BEGINNER_TOUR_EVENT = "khalories:tour:replay";

export const beginnerTourSteps: readonly TourStep[] = [
  {
    id: "photo",
    path: "/",
    selector: '[data-khalories-tour="photo"]',
    title: "Photo Scanner: two ways to log",
    description: "Photo Scanner now has Khalories AI Scan and AI Web Import. The built-in scan analyzes photos using an available Vision model; Web Import uses another AI website and a manual paste.",
    hint: "Built-in AI scans use your Khalories allowance. Simply opening a tab uses no analysis credits.",
  },
  {
    id: "web-import",
    path: "/",
    selector: '[data-khalories-tour="web-import"]',
    title: "Import nutrition from an AI website",
    description: "Choose AI Web Import to open Gemini, ChatGPT, Grok or another supported website yourself. Paste a normal answer or JSON, review the extracted values, and optionally add a private meal thumbnail.",
    hint: "The import uses no Khalories AI credits. External services have their own accounts, limits and privacy rules.",
  },
  {
    id: "barcode",
    path: "/",
    selector: '[data-khalories-tour="barcode"]',
    title: "Scan a barcode or search its product",
    description: "Use a barcode photo, camera, or packaged-food search. Check the exact variety, serving size, and nutrition label before adding your meal.",
    hint: "Ordinary barcode lookups are free. Optional AI label assistance is a separate action.",
  },
  {
    id: "manual",
    path: "/",
    selector: '[data-khalories-tour="manual"]',
    title: "Manual: four quick tools",
    description: "Choose Find Food, Calculator, Enter Details, or AI Estimate. In Calculator, enter how much food you actually ate and the measurement unit—without the bowl, plate or wrapper.",
    hint: "Manual entry does not require AI credits.",
  },
  {
    id: "recipes",
    path: "/",
    selector: '[data-khalories-tour="saved"]',
    title: "Reuse your recipes and favorites",
    description: "The Recipes & Favorites tab includes your saved foods, editable recipes, and Filipino recipe presets. Adjust servings and ingredients before logging.",
    hint: "Saved foods and manual recipes do not require an AI scan.",
  },
  {
    id: "meal-history",
    path: "/meals",
    selector: '[data-khalories-tour="meal-history"], main h1, main h2',
    title: "Find, edit and review saved meals",
    description: "Meal History groups meals by day, supports date and food searches, and keeps advanced nutrients. You can opt in to saving a private compressed thumbnail with a meal.",
    hint: "Food photos are optional. A thumbnail is saved only when you choose Save photo at confirmation.",
  },
  {
    id: "coach-nav",
    path: "/",
    selector: 'a[href="/coach"], [data-khalories-tour="coach-nav"], [data-fonz-fab="true"]',
    title: "Find your AI Coach",
    description: "Choose AI Coach from the navigation to open the full Coach FONZ conversation. On smaller screens, use the menu icon. You can also reach FONZ from the floating assistant button.",
    hint: "The guided tour never sends a message or spends AI credits.",
  },
  {
    id: "coach-floating",
    path: "/",
    selector: '[data-fonz-fab="true"], a[href="/coach"]',
    title: "Your floating Coach FONZ",
    description: "The floating coach button opens a quick chat wherever it is available. It can give free built-in tips or answer questions using an AI provider you choose.",
    hint: "Opening the coach is free. An AI request may use your daily allowance.",
  },
  {
    id: "coach",
    path: "/coach",
    selector: '#coach-ai-provider, #coach-message, main textarea',
    title: "Ask the full AI Coach",
    description: "This is the full Coach FONZ page. Select an available Text AI such as Mistral, optionally share a short summary of your saved meals, then enter your question.",
    hint: "Food-history coaching uses only the available saved summary. The tour does not contact an AI provider.",
  },
  {
    id: "reports",
    path: "/reports",
    selector: 'main section, main h1',
    title: "Explore daily and weekly reports",
    description: "Switch between a single day and the last seven days of saved nutrition logs. Missing logs never mean zero food intake.",
    hint: "Reports are based on meals you actually saved.",
  },
  {
    id: "activities",
    path: "/activities",
    selector: 'main form, main h1',
    title: "Track your activities",
    description: "Log a workout, walking session, or other activity. Exercise calories stay separate from your food target.",
    hint: "You can review and manage your activity history here.",
  },
  {
    id: "settings",
    path: "/settings",
    selector: '[data-khalories-tour="replay"]',
    title: "Replay this tour anytime",
    description: "Visit Settings whenever you want to run this walkthrough again, even if you skipped it the first time.",
    hint: "Use Finish to close your first tour.",
  },
] as const;

/** Use the authenticated Supabase user id only; never use profile names/emails. */
export function beginnerTourStorageKey(userId: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(userId)) throw new Error("Invalid account id for the local tour state.");
  return `khalories:beginner-tour:v2:${userId}`;
}

export type SpotlightRect = { top: number; right: number; bottom: number; left: number };
export function spotlightHole(rect: SpotlightRect, width: number, height: number, margin = 8): SpotlightRect {
  return {
    top: Math.max(0, rect.top - margin),
    left: Math.max(0, rect.left - margin),
    right: Math.min(width, rect.right + margin),
    bottom: Math.min(height, rect.bottom + margin),
  };
}

export function spotlightCardPosition(
  hole: SpotlightRect | null, width: number, height: number,
): { top: number; left: number; width: number; arrow: "up" | "down" | "none" } {
  const cardWidth = Math.max(0, Math.min(360, width - 32));
  if (!hole || width < 440 || height < 510) {
    return { top: Math.max(16, Math.round((height - 270) / 2)), left: Math.max(16, Math.round((width - cardWidth) / 2)), width: cardWidth, arrow: "none" };
  }
  const left = Math.max(16, Math.min(width - cardWidth - 16, (hole.left + hole.right - cardWidth) / 2));
  const canFitBelow = hole.bottom + 18 + 250 <= height - 16;
  const top = canFitBelow ? hole.bottom + 18 : Math.max(16, hole.top - 270);
  return { top, left, width: cardWidth, arrow: canFitBelow ? "up" : "down" };
}