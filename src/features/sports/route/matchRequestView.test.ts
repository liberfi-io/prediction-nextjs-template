import { resolveSportsMatchRequestView } from "./matchRequestView";

describe("resolveSportsMatchRequestView", () => {
  it("defaults the plain daily page to live without overriding named views", () => {
    expect(resolveSportsMatchRequestView()).toBe("live");
    expect(resolveSportsMatchRequestView({ view: "upcoming" })).toBe(
      "upcoming",
    );
    expect(resolveSportsMatchRequestView({ view: "results" })).toBe("results");
    expect(resolveSportsMatchRequestView({ view: "proposals" })).toBeUndefined();
    expect(
      resolveSportsMatchRequestView({
        taxonomy_type: "sport",
        taxonomy_slug: "soccer",
      }),
    ).toBeUndefined();
  });
});
