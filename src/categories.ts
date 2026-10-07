import type { Box } from "./config";
import CATEGORIES from "../content/categories.json";

export const CATEGORY_KEYS = [
  "offer", "interview", "assessment", "action", "verification", "confirmation", "rejection", "noise",
] as const;

export type Category = (typeof CATEGORY_KEYS)[number] | "unsure";

export const INSTRUCTIONS: string = CATEGORIES.instructions;
export const CRITERIA: Record<string, string> = CATEGORIES.criteria;

for (const key of CATEGORY_KEYS) {
  if (!CRITERIA[key]) throw new Error(`content/categories.json is missing a description for "${key}"`);
}

export const isCategory = (v: unknown): v is Category =>
  v === "unsure" || (CATEGORY_KEYS as readonly unknown[]).includes(v);

/** Worth a ping and the attention box: someone moved the application forward or wants something. */
export const ATTENTION: ReadonlySet<Category> = new Set(["offer", "interview", "assessment", "action"]);

/** Mail that can leave the inbox, and where it goes when the classifier is sure. */
export const ARCHIVE: Partial<Record<Category, Box>> = {
  rejection: "rejected",
  confirmation: "archive",
  noise: "archive",
};
