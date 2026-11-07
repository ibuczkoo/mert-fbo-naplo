import { describe, expect, it } from "vitest";
import { modulesFor } from "./modules";

describe("menü szerepkör szerint", () => {
  it("az őr nem látja a kiadást, a törzsadatot és az archívumot", () => {
    const keys = modulesFor("or").map((m) => m.key);
    expect(keys).toEqual(["shift", "incident", "gate"]);
  });

  it("a parancsnok mindent lát", () => {
    expect(modulesFor("parancsnok")).toHaveLength(8);
    expect(modulesFor("parancsnok").map((m) => m.key)).not.toContain("users");
  });

  it("az admin: megtekintés, archívum, törzsadat, felhasználók", () => {
    expect(modulesFor("admin").map((m) => m.key)).toEqual(["shift", "archive", "masterdata", "users"]);
  });
});
