// Bangla (Bengali) → Latin consonant/vowel map, applied before kebab-casing so
// Bangla-heavy titles still produce readable slugs instead of being stripped to
// an empty string.
const BANGLA_TO_LATIN: Record<string, string> = {
  অ: "o",
  আ: "a",
  ই: "i",
  ঈ: "i",
  উ: "u",
  ঊ: "u",
  ঋ: "ri",
  এ: "e",
  ঐ: "oi",
  ও: "o",
  ঔ: "ou",
  ক: "ka",
  খ: "kha",
  গ: "ga",
  ঘ: "gha",
  ঙ: "nga",
  চ: "cha",
  ছ: "chha",
  জ: "ja",
  ঝ: "jha",
  ঞ: "nya",
  ট: "ta",
  ঠ: "tha",
  ড: "da",
  ঢ: "dha",
  ণ: "na",
  ত: "ta",
  থ: "tha",
  দ: "da",
  ধ: "dha",
  ন: "na",
  প: "pa",
  ফ: "pha",
  ব: "ba",
  ভ: "bha",
  ম: "ma",
  য: "ya",
  র: "ra",
  ল: "la",
  শ: "sha",
  ষ: "sha",
  স: "sa",
  হ: "ha",
  ড়: "ra",
  ঢ়: "rha",
  য়: "ya",
  "ং": "ng",
  "ঃ": "h",
  "ঁ": "",
  "্": "",
  "ে": "e",
  "ৈ": "oi",
  "ো": "o",
  "ৌ": "ou",
  "া": "a",
  "ি": "i",
  "ী": "i",
  "ু": "u",
  "ূ": "u",
  "ৃ": "ri",
};

const transliterate = (text: string): string =>
  [...text].map((char) => BANGLA_TO_LATIN[char] ?? char).join("");

// Shared kebab-case slugifier used by Category and TourPackage slugs. Non-Latin
// scripts (e.g. Bangla) are transliterated first; if the result is still empty
// the caller may supply a `fallback` (e.g. "package-<shortId>").
export const slugify = (text: string, fallback?: string): string => {
  const slug = transliterate(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback || "";
};