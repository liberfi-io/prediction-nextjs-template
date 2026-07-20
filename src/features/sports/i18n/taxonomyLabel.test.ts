import type { SportsTaxonomyNode } from "../types";
import { localizeTaxonomyLabel } from "./taxonomyLabel";

const node: SportsTaxonomyNode = {
  section: "sports",
  node_type: "sport",
  slug: "soccer",
  label: "Soccer",
};

describe("localizeTaxonomyLabel", () => {
  it("reads a translation only from the requested language", () => {
    const reader = {
      exists: jest.fn(() => true),
      t: jest.fn(() => "足球"),
    };

    expect(localizeTaxonomyLabel(node, "zh-Hant", "sports", reader)).toBe(
      "足球",
    );
    expect(reader.exists).toHaveBeenCalledWith(
      "extend.sports.taxonomy.sports.sport.soccer",
      { lng: "zh-Hant", fallbackLng: false },
    );
  });

  it("returns the API label when the requested language is missing", () => {
    const reader = {
      exists: jest.fn(() => false),
      t: jest.fn(() => "Football"),
    };

    expect(localizeTaxonomyLabel(node, "fr", "sports", reader)).toBe("Soccer");
    expect(reader.t).not.toHaveBeenCalled();
  });

  it.each(["", "extend.sports.taxonomy.sports.sport.soccer"])(
    "returns the API label when the resolved value is not usable",
    (translated) => {
      const reader = {
        exists: jest.fn(() => true),
        t: jest.fn(() => translated),
      };

      expect(localizeTaxonomyLabel(node, "fr", "sports", reader)).toBe(
        "Soccer",
      );
    },
  );

  it("always returns the API label for English", () => {
    const reader = {
      exists: jest.fn(() => true),
      t: jest.fn(() => "Poisoned static English"),
    };

    expect(localizeTaxonomyLabel(node, "en", "sports", reader)).toBe("Soccer");
    expect(reader.exists).not.toHaveBeenCalled();
  });

  it("uses the page section when the DTO omits section", () => {
    const reader = {
      exists: jest.fn(() => true),
      t: jest.fn(() => "英雄聯盟"),
    };
    const esportsNode = {
      ...node,
      section: undefined,
      slug: "league-of-legends",
      label: "League of Legends",
    };

    expect(
      localizeTaxonomyLabel(esportsNode, "zh-Hant", "esports", reader),
    ).toBe("英雄聯盟");
    expect(reader.exists).toHaveBeenCalledWith(
      "extend.sports.taxonomy.esports.sport.league-of-legends",
      { lng: "zh-Hant", fallbackLng: false },
    );
  });

  it.each([
    [{ ...node, node_type: "game" } as SportsTaxonomyNode, "zh-Hant"],
    [
      { ...node, node_type: undefined } as unknown as SportsTaxonomyNode,
      "zh-Hant",
    ],
    [{ ...node, slug: undefined } as unknown as SportsTaxonomyNode, "zh-Hant"],
    [{ ...node, slug: "bad.slug" }, "zh-Hant"],
    [{ ...node, slug: "bad:slug" }, "zh-Hant"],
    [node, ""],
  ])("falls back for an unsafe key contract", (unsafeNode, language) => {
    const reader = {
      exists: jest.fn(() => true),
      t: jest.fn(() => "Unexpected"),
    };

    expect(localizeTaxonomyLabel(unsafeNode, language, "sports", reader)).toBe(
      unsafeNode.label,
    );
    expect(reader.exists).not.toHaveBeenCalled();
  });
});
