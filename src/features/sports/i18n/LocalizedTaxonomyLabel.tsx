"use client";

import { useTranslation } from "@liberfi.io/i18n";
import type { SportsSection, SportsTaxonomyNode } from "../types";
import { localizeTaxonomyLabel } from "./taxonomyLabel";

export function LocalizedTaxonomyLabel({
  node,
  pageSection,
}: {
  node: SportsTaxonomyNode;
  pageSection: SportsSection;
}) {
  const { i18n } = useTranslation();
  const label = localizeTaxonomyLabel(node, i18n.language, pageSection, {
    exists: (key, options) => i18n.exists(key, options),
    t: (key, options) => i18n.t(key, options),
  });

  return <>{label}</>;
}
