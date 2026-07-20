import type { SportsSection, SportsTaxonomyNode } from "../types";

export interface TaxonomyI18nReader {
  exists(
    key: `extend.${string}`,
    options: { lng: string; fallbackLng: false },
  ): boolean;
  t(
    key: `extend.${string}`,
    options: { lng: string; fallbackLng: false },
  ): unknown;
}

const supportedNodeTypes = new Set(["sport", "league"]);

export function taxonomyTranslationKey(
  node: SportsTaxonomyNode,
  pageSection: SportsSection,
): `extend.${string}` | undefined {
  const section = node.section ?? pageSection;
  if (
    !supportedNodeTypes.has(node.node_type ?? "") ||
    typeof node.slug !== "string" ||
    node.slug === "" ||
    node.slug.includes(".") ||
    node.slug.includes(":")
  ) {
    return undefined;
  }

  return `extend.sports.taxonomy.${section}.${node.node_type}.${node.slug}`;
}

export function localizeTaxonomyLabel(
  node: SportsTaxonomyNode,
  language: string,
  pageSection: SportsSection,
  reader: TaxonomyI18nReader,
): string {
  if (!language || language === "en") return node.label;

  const key = taxonomyTranslationKey(node, pageSection);
  if (!key || !reader.exists(key, { lng: language, fallbackLng: false })) {
    return node.label;
  }

  const translated = reader.t(key, { lng: language, fallbackLng: false });
  return typeof translated === "string" &&
    translated !== "" &&
    translated !== key
    ? translated
    : node.label;
}
