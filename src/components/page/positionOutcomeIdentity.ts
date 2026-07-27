import type { RedeemOutcome } from "../predictOutcomeIdentity";

export type PositionOutcomeEvidence = {
  side?: string;
  positiveSide?: boolean;
  mapsOverUnder?: boolean;
  mapsOddEven?: boolean;
};

export function resolvePositionOutcome(
  evidence: PositionOutcomeEvidence,
): RedeemOutcome | undefined {
  const side = evidence.side?.trim().toLowerCase();
  if (side === "yes" || side === "no") return side;
  if (typeof evidence.positiveSide === "boolean") {
    return evidence.positiveSide ? "yes" : "no";
  }
  if (evidence.mapsOverUnder) {
    if (side === "over") return "yes";
    if (side === "under") return "no";
  }
  if (evidence.mapsOddEven) {
    if (side === "odd") return "yes";
    if (side === "even") return "no";
  }
  return undefined;
}

export function resolveOpposedSidePositive(
  side: string | undefined,
  positiveKeys: ReadonlySet<string>,
  negativeKeys: ReadonlySet<string>,
): boolean | undefined {
  const normalized = side?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (positiveKeys.has(normalized)) return true;
  if (negativeKeys.has(normalized)) return false;
  return undefined;
}
