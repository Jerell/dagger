import { expect, test } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";

test.beforeEach("login", login);

test("Can migrate modules to new cost library", async ({ page }) => {
  await page.goto("/");
  const costLibrarySelector = page.getByRole("combobox", {
    name: "Cost Library:",
  });
  await costLibrarySelector.selectOption({ label: "V1.1" });

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
      properties: {
        "(Item 023) Mass flow": 100,
        "Parallel splits": 3,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "LP Compression (1 to 40 bar) (Electric Drive)",
      properties: {
        "Compressor Duty": 100,
        "(Item 007) Electrical power": 100,
        "(Item 008) Electrical power": 100,
        "Cooling duty": 100,
        "Parallel splits": 2,
      },
    },
  ]);

  await costLibrarySelector.selectOption({ label: "V1.3" });

  // Open capture unit
  const captureUnit = page.getByTestId("cell").nth(1);
  await captureUnit.hover();
  await captureUnit.getByRole("button", { name: "Edit" }).click();

  // Check properties are set
  await expect(
    page.getByRole("spinbutton", { name: "Parallel splits" }),
  ).toHaveValue("3");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 023) Mass flow" }),
  ).toHaveValue("100");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 023) Energy requirement" }),
  ).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 023) Cost per tonne of CO2" }),
  ).toHaveValue("");

  // Close capture unit
  await page.getByRole("button", { name: "close" }).click();

  // Open compressor
  const compressor = page.getByTestId("cell").nth(2);
  await compressor.hover();
  await compressor.getByRole("button", { name: "Edit" }).click();

  // Check properties  are set
  await expect(
    page.getByRole("spinbutton", { name: "Parallel splits" }),
  ).toHaveValue("2");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 007) Compressor Duty" }),
  ).toHaveValue("100");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 007) Electrical power" }),
  ).toHaveValue("100");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 008) Cooling duty" }),
  ).toHaveValue("100");
  await expect(
    page.getByRole("spinbutton", { name: "(Item 008) Electrical power" }),
  ).toHaveValue("100");

  // Close compressor
  await page.getByRole("button", { name: "close" }).click();

  // Check downgrade is disallowed
  // Note: for some reason, `toBeDisabled` always fails, even with aria-disabled
  await expect(
    costLibrarySelector.getByRole("option", { name: "V1.1" }),
  ).toHaveAttribute("disabled");
});
