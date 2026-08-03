import aurisArt from "../../assets/fleet/auris.png";
import corollaArt from "../../assets/fleet/corolla.png";
import priusArt from "../../assets/fleet/prius.png";

const MODEL_ART: Array<{ match: RegExp; src: string; accent: string }> = [
  { match: /\bprius\b/i, src: priusArt, accent: "#b6e34a" },
  { match: /\bcorolla\b/i, src: corollaArt, accent: "#4aa3ff" },
  { match: /\bauris\b/i, src: aurisArt, accent: "#d8dee8" },
];

/** Studio model tile for known fleet models (Prius / Corolla / Auris). */
export function resolveCarModelArt(make?: string | null, model?: string | null): {
  src: string;
  accent: string;
} | null {
  const hay = [make, model].filter(Boolean).join(" ");
  if (!hay) return null;
  for (const entry of MODEL_ART) {
    if (entry.match.test(hay)) return { src: entry.src, accent: entry.accent };
  }
  return null;
}
