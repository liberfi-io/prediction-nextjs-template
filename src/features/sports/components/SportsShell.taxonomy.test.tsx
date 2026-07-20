import { render, screen } from "@testing-library/react";
import { SportsShell } from "./SportsShell";

jest.mock("../i18n/LocalizedTaxonomyLabel", () => ({
  LocalizedTaxonomyLabel: ({ node }: { node: { slug: string } }) => (
    <span data-testid="localized-taxonomy-label">{node.slug}</span>
  ),
}));

describe("SportsShell taxonomy labels", () => {
  it("uses the shared localized label at mobile and rail entry points", () => {
    render(
      <SportsShell
        section="sports"
        filters={{}}
        data={{
          matches: [],
          props: [],
          taxonomy: {
            sections: [
              {
                section: "sports",
                children: [
                  {
                    section: "sports",
                    node_type: "sport",
                    slug: "soccer",
                    label: "Soccer",
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getAllByTestId("localized-taxonomy-label")).toHaveLength(2);
  });
});
