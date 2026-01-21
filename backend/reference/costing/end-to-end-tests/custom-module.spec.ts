import { expect, test } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";

test.beforeEach("login", login);

test("Can input custom modules", async ({ page }) => {
  await page.goto("/");

  await buildBranch(page, [
    {
      moduleType: /source/i,
      moduleName: "Cement",
      properties: {
        "Mass flow": 10.5,
      },
    },
    {
      // This is not a realistic module to place next,
      // but any works for testing purposes
      moduleType: "Custom Transport",
      moduleName: "Pipeline Booster Pump",
      properties: {
        "Output Pressure/Temperature": "40 bar(a)",
        "Output Purity": "100%",

        "(Item 072) length of pipeline": 100,
        "(Item 072) Frequency of crossings per 50 km": 100,
        "(Item 072) Pump duty": 100,
        "(Item 072) Electrical power": 100,
      },
    },
    {
      // Ensure we can add something that requires 40 bara afterwards
      moduleType: /^transport/i,
      moduleName: "Dehydration (Molecular Sieve)",
      properties: {
        "(Item 011) Mass flow CO2": 5,
      },
    },
  ]);

  const lastModule = page
    .getByTitle("branch")
    .last()
    .getByTestId("cell")
    .nth(2);
  await expect(lastModule).toContainText("100%");
  await expect(lastModule).toContainText("40 Bara");
  await expect(lastModule).toContainText("10.5 MTPA");
  await expect(lastModule).toContainText("Carbon");
});
