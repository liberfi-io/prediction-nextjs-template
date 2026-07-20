import de from "../../../locales/de.json";
import en from "../../../locales/en.json";
import es from "../../../locales/es.json";
import fr from "../../../locales/fr.json";
import itLocale from "../../../locales/it.json";
import ja from "../../../locales/ja.json";
import ko from "../../../locales/ko.json";
import pt from "../../../locales/pt.json";
import ru from "../../../locales/ru.json";
import th from "../../../locales/th.json";
import vi from "../../../locales/vi.json";
import zhHant from "../../../locales/zh-Hant.json";
import inventory from "./taxonomyInventory.json";
import sources from "./taxonomySources.json";

const bundles = {
  "zh-Hant": zhHant,
  ja,
  ko,
  th,
  vi,
  fr,
  de,
  it: itLocale,
  es,
  pt,
  ru,
} as const;

const identity = (section: string, nodeType: string, slug: string) =>
  `${section}:${nodeType}:${slug}`;

function taxonomyEntries(bundle: object): Array<[string, string]> {
  const taxonomy = (
    bundle as {
      extend?: {
        sports?: {
          taxonomy?: Record<string, Record<string, Record<string, string>>>;
        };
      };
    }
  ).extend?.sports?.taxonomy;
  if (!taxonomy) return [];

  return Object.entries(taxonomy).flatMap(([section, nodeTypes]) =>
    Object.entries(nodeTypes).flatMap(([nodeType, labels]) =>
      Object.entries(labels).map(
        ([slug, label]) =>
          [identity(section, nodeType, slug), label] as [string, string],
      ),
    ),
  );
}

describe("taxonomy i18n resources", () => {
  const inventoryIds = new Set(
    inventory.nodes.map((node) =>
      identity(node.section, node.node_type, node.slug),
    ),
  );

  it("keeps the inventory within the runtime key contract", () => {
    expect(inventory.nodes.length).toBeGreaterThan(0);
    expect(inventoryIds.size).toBe(inventory.nodes.length);
    for (const node of inventory.nodes) {
      expect(["sports", "esports"]).toContain(node.section);
      expect(["sport", "league"]).toContain(node.node_type);
      expect(node.slug).not.toMatch(/[.:]/);
      expect(node.label).not.toBe("");
    }
  });

  it("keeps every localized key non-empty and associated with inventory", () => {
    for (const bundle of Object.values(bundles)) {
      for (const [id, label] of taxonomyEntries(bundle)) {
        expect(inventoryIds.has(id)).toBe(true);
        expect(label.trim()).not.toBe("");
      }
    }
  });

  it("does not add a static English taxonomy", () => {
    expect(taxonomyEntries(en)).toEqual([]);
  });

  it("classifies every inventory node in every target language", () => {
    expect(sources.nodes).toHaveLength(inventory.nodes.length);
    expect(
      new Set(
        sources.nodes.map((node) =>
          identity(node.section, node.node_type, node.slug),
        ),
      ),
    ).toEqual(inventoryIds);

    for (const node of sources.nodes) {
      expect(Object.keys(node.languages).sort()).toEqual(
        Object.keys(bundles).sort(),
      );
      for (const evidence of Object.values(node.languages)) {
        expect([
          "adopted",
          "conflict",
          "english-fallback",
          "source-unavailable",
        ]).toContain(evidence.status);
      }
    }
  });

  it("matches frozen per-language source statistics and resource counts", () => {
    for (const [language, bundle] of Object.entries(bundles)) {
      const resourceEntries = new Map(taxonomyEntries(bundle));
      const evidence = sources.nodes.map(
        (node) => node.languages[language as keyof typeof node.languages],
      );
      const actual = {
        inventory_total: inventory.nodes.length,
        source_visible: evidence.filter(
          (entry) => entry.localized_label !== null,
        ).length,
        adopted: evidence.filter((entry) => entry.status === "adopted").length,
        conflict: evidence.filter((entry) => entry.status === "conflict")
          .length,
        english_fallback: evidence.filter(
          (entry) => entry.status === "english-fallback",
        ).length,
        source_unavailable: evidence.filter(
          (entry) => entry.status === "source-unavailable",
        ).length,
      };

      expect(actual).toEqual(
        sources.statistics[language as keyof typeof sources.statistics],
      );
      expect(resourceEntries.size).toBe(actual.adopted + actual.conflict);
      expect(actual.adopted).toBeGreaterThan(0);

      for (const node of sources.nodes) {
        const id = identity(node.section, node.node_type, node.slug);
        const entry = node.languages[language as keyof typeof node.languages];
        expect(["future", "polymarket"]).toContain(entry.source);
        expect(entry.source_url).toMatch(
          entry.source === "future"
            ? /^https:\/\/future\.news\/[a-z-]+\/sports$/
            : /^https:\/\/polymarket\.com\/[a-z-]+\/sports\/live$/,
        );
        expect(entry.source_url).not.toContain("undefined");
        expect(entry.observed_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        if (entry.status === "adopted" || entry.status === "conflict") {
          expect(entry.localized_label).not.toBeNull();
          expect(entry.localized_label?.trim()).not.toBe("");
          expect(resourceEntries.get(id)).toBe(entry.localized_label);
        } else {
          expect(resourceEntries.has(id)).toBe(false);
        }
      }
    }
  });
});
