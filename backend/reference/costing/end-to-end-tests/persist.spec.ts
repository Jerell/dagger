import test, { expect } from "@playwright/test";
import { buildBranch } from "./lib/buildBranch";
import login from "./lib/login";

test.beforeEach("login", login);

test("Network and properties are persisted", async ({ page }) => {
  await page.goto("/");

  await buildBranch(page, [
    {
      moduleType: /source/i,
      moduleName: "Cement",
      properties: {
        "Mass flow": 10,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Amine",
      properties: {
        "Mass flow": 3,
      },
    },
  ]);

  await page.reload();

  const branches = page.getByTitle("branch");
  expect(await branches.count()).toEqual(1);

  const branch = branches.nth(0);

  const cells = branch
    .getByTestId("cell")
    .filter({ has: page.locator("css=[data-category]") });
  expect(await cells.count()).toEqual(2);
  await expect(cells.nth(0)).toContainText("Cement");
  await expect(cells.nth(1)).toContainText("Amine");

  const emitterCell = cells.nth(0);
  await emitterCell.hover();
  await emitterCell.getByRole("button", { name: "Edit" }).click();

  await expect(page.getByLabel("Mass flow")).toHaveValue("10");
  await page.getByRole("button", { name: "Cancel" }).click();

  const captureUnitCell = cells.nth(1);
  await captureUnitCell.hover();
  await captureUnitCell.getByRole("button", { name: "Edit" }).click();

  await expect(page.getByLabel("Mass flow")).toHaveValue("3");
});
