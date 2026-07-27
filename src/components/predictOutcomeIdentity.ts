export type RedeemOutcome = "yes" | "no";

type StructuralOutcome = {
  key?: unknown;
  label?: unknown;
};

function canonicalRedeemOutcome(value: string): RedeemOutcome | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "yes";
  if (normalized === "no") return "no";
  return undefined;
}

export function resolveRedeemOutcome(
  side: string,
  outcomes: StructuralOutcome[] | undefined,
): RedeemOutcome | undefined {
  if (!outcomes || outcomes.length === 0) return undefined;

  const structuralKeys = outcomes.map((outcome) =>
    typeof outcome.key === "string"
      ? outcome.key.trim().toLowerCase()
      : "",
  );
  if (
    structuralKeys.some((key) => canonicalRedeemOutcome(key) === undefined) ||
    new Set(structuralKeys).size !== structuralKeys.length
  ) {
    return undefined;
  }

  const normalizedSide = side.trim().toLowerCase();
  return structuralKeys.includes(normalizedSide)
    ? canonicalRedeemOutcome(normalizedSide)
    : undefined;
}
