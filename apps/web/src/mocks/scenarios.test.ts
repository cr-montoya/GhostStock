import { afterEach, describe, expect, it } from "vitest";
import { currentScenario } from "./scenarios";

function visit(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

describe("currentScenario", () => {
  afterEach(() => {
    sessionStorage.clear();
    visit("");
  });

  it("defaults to happy", () => {
    expect(currentScenario()).toBe("happy");
  });

  it("reads ?scenario= and keeps it across navigation", () => {
    visit("?scenario=empty");
    expect(currentScenario()).toBe("empty");
    visit("");
    expect(currentScenario()).toBe("empty");
  });

  it("ignores unknown scenarios", () => {
    visit("?scenario=chaos");
    expect(currentScenario()).toBe("happy");
  });
});
