import { mergeUniqueSportsItems } from "./mergeUniqueSportsItems";

describe("mergeUniqueSportsItems", () => {
  it("deduplicates records appended by automatic pagination", () => {
    const first = { match_group_slug: "first", title: "First" };
    const second = { match_group_slug: "second", title: "Second" };

    expect(
      mergeUniqueSportsItems(
        [first],
        [first, second],
        (item) => item.match_group_slug,
      ),
    ).toEqual([first, second]);
  });
});
