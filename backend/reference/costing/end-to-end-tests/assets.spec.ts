import { test, expect, Locator } from "@playwright/test";
import login from "./lib/login";
import { selectSubmenuItem } from "./lib/selectSubmenuItem";

test.beforeEach("login", login);

test("Create, rename, and remove an asset", async ({ page }) => {
  async function newModule(
    branch: Locator,
    type: string | RegExp,
    name: string | RegExp,
  ) {
    await branch.getByRole("button", { name: "new-module" }).click();
    await selectSubmenuItem(page, type, name);
  }

  await page.goto("/");

  await page.getByRole("button", { name: "new-source-module" }).click();
  await page.getByRole("menuitem", { name: /source/i }).click();
  await page
    .getByRole("menuitem")
    .filter({ hasText: "Cement" })
    .first()
    .click();

  const branch = page.getByTitle("branch");

  await newModule(branch, /^transport/i, "100% CO2");
  await newModule(branch, /sink/i, "Utilisation");

  // Asset grouping

  const cell1 = branch
    .getByTestId("cell")
    .filter({ has: page.getByText("100% CO2") });
  const cell2 = branch
    .getByTestId("cell")
    .filter({ has: page.getByText("Utilisation") });

  await cell1.click({
    modifiers: ["ControlOrMeta"],
    position: { x: 10, y: 10 },
  });
  await cell2.click({
    modifiers: ["ControlOrMeta"],
    position: { x: 10, y: 10 },
  });

  await expect(page.getByText("2 modules selected")).toBeVisible();
  await page.getByRole("button", { name: "Create Asset" }).click();
  await page.getByRole("textbox", { name: "Asset name" }).fill("renamed asset");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(
    page.getByText("2 modules selected in renamed asset"),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByText("2 modules selected in renamed asset", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove asset" }).click();
  await expect(
    page.getByText("2 modules selected in renamed asset", { exact: true }),
  ).toHaveCount(0);
});
