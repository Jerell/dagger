import { describe, expect, it } from "bun:test";
import { transformNetworkToSnapshotConditions } from "./network-adapter";

describe("snapshot network adapter", () => {
  it("extracts composition fractions from fluidComposition on Source blocks", async () => {
    const result = await transformNetworkToSnapshotConditions(
      {
        type: "data",
        network: {
          groups: [],
          edges: [],
          branches: [
            {
              id: "branch-1",
              blocks: [
                {
                  type: "Source",
                  flowrate: 1,
                  pressure: 100,
                  temperature: 20,
                  fluidComposition: {
                    carbonDioxideFraction: 0.98,
                    nitrogenFraction: 0.02,
                  },
                },
              ],
            },
          ],
        } as any,
      },
      "v1.0-snapshot",
    );

    expect(
      result.conditions["source|branch-1_blocks_0|carbonDioxideFraction"],
    ).toEqual({ molFraction: 0.98 });
    expect(
      result.conditions["source|branch-1_blocks_0|nitrogenFraction"],
    ).toEqual({ molFraction: 0.02 });
    expect(result.series["branch-1"]?.[0]?.carbonDioxideFraction).toBe(0.98);
    expect(result.series["branch-1"]?.[0]?.nitrogenFraction).toBe(0.02);
  });
});
