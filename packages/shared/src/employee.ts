import { z } from "zod";

export const badgeNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{3,6}$/, "A jelvényszám 3–6 számjegy");

export const employeeInputSchema = z.object({
  fullName: z.string().trim().min(3, "Adja meg a teljes nevet").max(120),
  badgeNumber: badgeNumberSchema.nullable(),
  active: z.boolean().default(true),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;

export interface ParsedLegacyName {
  fullName: string;
  badgeNumber: string | null;
}

/**
 * A régi rendszer a dolgozót egyetlen szövegként tárolta: "Berencsi János 94016".
 * A régi PDF-sablon ezt az utolsó 6 karakter levágásával bontotta szét.
 * Itt a végén álló számcsoportot választjuk le jelvényszámként.
 * "Válasszon!" és üres érték esetén null.
 */
export function parseLegacyName(raw: string | null | undefined): ParsedLegacyName | null {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text === "" || text === "Válasszon!" || text === "-") return null;
  const m = /^(.*\S)\s+(\d{3,6})$/.exec(text);
  if (m && m[1] && m[2]) return { fullName: m[1], badgeNumber: m[2] };
  return { fullName: text, badgeNumber: null };
}
