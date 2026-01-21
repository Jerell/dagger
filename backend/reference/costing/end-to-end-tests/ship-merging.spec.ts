import { test, expect } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";

test.beforeEach("login", login);

test("Merge ship to FISU", async ({ page }) => {
  await page.goto("/");

  // Build branch 1
  await buildBranch(page, [
    {
      moduleType: /source/i,
      moduleName: "Cement",
      properties: {
        "Mass flow": 100,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Amine",
    },
    {
      moduleType: /^transport/i,
      moduleName: "LP Compression (1 to 40 bar) (Electric Drive)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Dehydration (Molecular Sieve)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "HP Compression (40 to 120bara) (Electric Drive)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Refrigeration (EP - Water Cooling + trim refrig)",
    },
    {
      moduleType: /sink/i,
      moduleName: "Shipping (EP)",
    },
  ]);

  // Build branch 2
  await buildBranch(page, [
    {
      moduleType: /source/i,
      moduleName: "Cement",
      properties: {
        "Mass flow": 50,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Amine",
    },
    {
      moduleType: /^transport/i,
      moduleName: "LP Compression (1 to 40 bar) (Electric Drive)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Dehydration (Molecular Sieve)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "HP Compression (40 to 120bara) (Electric Drive)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Refrigeration (EP - Water Cooling + trim refrig)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Shipping (EP)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "FISU (vessel)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "Injection Topsides (pair with FISU or Platform)",
    },
    {
      moduleType: /sink/i,
      moduleName: "Offshore Injection Well",
    },
  ]);

  // Merge the branches together
  const mergeDestinationSelector = page.getByRole("combobox", {
    name: "merge",
  });
  await mergeDestinationSelector.click();
  await page.getByText("FISU (vessel) (2/1)").click();

  // Find final sink
  const finalSink = page
    .getByTestId("cell")
    .filter({ hasText: "Offshore Injection Well" });
  // If the fluids have correctly merged, this should be the sum of the two flowrates.
  await expect(finalSink).toContainText("150 MTPA");
});
