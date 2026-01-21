import { test, expect, Locator } from "@playwright/test";
import login from "./lib/login";
import { selectSubmenuItem } from "./lib/selectSubmenuItem";

test.beforeEach("login", login);

test("Merge two branches", async ({ page }) => {
  function getCellWithText(text: string) {
    return page.getByTestId("cell").filter({ has: page.getByText(text) });
  }
  function getBranchWithCell(text: string) {
    return page.getByTitle("branch").filter({ has: getCellWithText(text) });
  }

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

  {
    const branch = page.getByTitle("branch");

    await newModule(branch, /^transport/i, "Amine");
    await newModule(branch, /^transport/i, "LP Compression");
    await newModule(branch, /^transport/i, "Dehydration (Molecular Sieve)");
    await newModule(branch, /^transport/i, "Merging Gas Pipeline");
    await newModule(branch, /^transport/i, "Truck");

    await expect(getCellWithText("Truck")).toContainText("Carbon");
  }

  {
    await page.getByRole("button", { name: "new-source-module" }).click();
    await page.getByRole("menuitem", { name: /source/i }).click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: "Ammonia" })
      .first()
      .click();

    const branch = getBranchWithCell("Ammonia");

    await newModule(
      branch,
      /^transport/i,
      "Capture Unit (Cryogenic (to 100% CO2))",
    );
    await newModule(branch, /^transport/i, "LP Compression");
    await newModule(branch, /sink/i, "Merging Gas Pipeline");

    await branch.getByRole("combobox", { name: "merge" }).click();
    await page.getByRole("option", { name: "1/1" }).click();

    await expect(getCellWithText("Truck")).toContainText("Stainless");
  }
});
