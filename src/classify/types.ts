import type { Category } from "../categories";

export interface Verdict {
  category: Category;
  /** Probability per category. Classifiers without real probabilities report 1 for their pick. */
  probabilities: Partial<Record<Category, number>>;
  source: "jev" | "workers-ai";
}

/** Characters of body the classifier sees; the verdict is nearly always in the first lines. */
export const CLASSIFY_BODY = 1500;
