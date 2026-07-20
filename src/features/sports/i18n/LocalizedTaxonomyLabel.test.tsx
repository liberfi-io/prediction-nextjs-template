import { act, render, screen } from "@testing-library/react";
import { defaultNS, i18n } from "@liberfi.io/i18n";
import { LocalizedTaxonomyLabel } from "./LocalizedTaxonomyLabel";

describe("LocalizedTaxonomyLabel", () => {
  afterEach(async () => {
    i18n.removeResourceBundle("zh-Hant", defaultNS);
    i18n.removeResourceBundle("fr", defaultNS);
    await i18n.changeLanguage("en");
  });

  it("renders a requested-language taxonomy resource", async () => {
    i18n.addResource(
      "zh-Hant",
      defaultNS,
      "extend.sports.taxonomy.sports.sport.soccer",
      "足球",
    );
    await i18n.changeLanguage("zh-Hant");

    render(
      <LocalizedTaxonomyLabel
        pageSection="sports"
        node={{ node_type: "sport", slug: "soccer", label: "Soccer" }}
      />,
    );

    expect(screen.getByText("足球")).not.toBeNull();
  });

  it("renders the API label when no requested-language resource exists", async () => {
    await i18n.changeLanguage("fr");

    render(
      <LocalizedTaxonomyLabel
        pageSection="sports"
        node={{ node_type: "sport", slug: "soccer", label: "Soccer" }}
      />,
    );

    expect(screen.getByText("Soccer")).not.toBeNull();
  });

  it("updates the same node when the active language changes", async () => {
    const key = "extend.sports.taxonomy.sports.sport.soccer";
    i18n.addResource("zh-Hant", defaultNS, key, "足球");
    i18n.addResource("fr", defaultNS, key, "Football");
    await i18n.changeLanguage("zh-Hant");

    render(
      <LocalizedTaxonomyLabel
        pageSection="sports"
        node={{ node_type: "sport", slug: "soccer", label: "Soccer" }}
      />,
    );
    expect(screen.getByText("足球")).not.toBeNull();

    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    expect(screen.getByText("Football")).not.toBeNull();
  });
});
