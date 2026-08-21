export type WritingLanguage = "zh" | "en" | "vi";

/**
 * Infer the writing language from a free-text brief/premise when the user did not set one explicitly.
 *
 * Conservative by design: defaults to "zh" (preserving prior behaviour for Chinese users) and only
 * returns "en" when the text is clearly Latin-dominant. A Chinese brief that mentions an English name
 * or term still resolves to "zh"; incidental CJK inside an otherwise English brief resolves to "en".
 */
export function inferLanguage(text?: string | null): WritingLanguage {
  const t = text ?? "";
  const cjk = (t.match(/[一-鿿]/g) ?? []).length;
  // Vietnamese-specific Latin Extended Additional block (Ạ-ίζ) is used only by
  // Vietnamese; diacritic-free Vietnamese cannot be told apart from English.
  const vietnamese = (t.match(/[\u1EA0-\u1EF9]/g) ?? []).length;
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  if (cjk === 0 && vietnamese > 0) return "vi";
  if (cjk === 0 && latin > 0 && vietnamese === 0) return "en";
  if (latin > 0 && cjk * 4 < latin) return vietnamese > 0 ? "vi" : "en";
  return "zh";
}
