import { test, expect, Locator } from "@playwright/test";
import login from "./lib/login";
import { selectSubmenuItem } from "./lib/selectSubmenuItem";

test.beforeEach("login", login);

test("Build an example cluster", async ({ page }) => {
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

  const branch = page.getByTitle("branch");

  await newModule(branch, /^transport/i, "Amine");
  await newModule(branch, /^transport/i, "LP Compression");
  await newModule(
    branch,
    /^transport/i,
    "Gas Pipeline (Onshore (Buried) - Small)",
  );
  await newModule(branch, /^transport/i, "Topsides");
  await newModule(branch, /sink/i, "Offshore");

  await expect(page.getByTitle("branch")).toContainText("Cement");
  await expect(page.getByTitle("branch")).toContainText("Amine");
  await expect(page.getByTitle("branch")).toContainText("LP");
  await expect(page.getByTitle("branch")).toContainText("Gas");
  await expect(page.getByTitle("branch")).toContainText("Topsides");
  await expect(page.getByTitle("branch")).toContainText("Offshore");

  const fisuCell = getCellWithText("Topsides");
  const fisuDelete = fisuCell.getByRole("button", { name: "Delete" });

  // check only the rightmost cell has a delete button
  await expect(fisuDelete).toHaveCount(0);

  const offshoreWellCell = getCellWithText("Well");
  const deleteButton = offshoreWellCell.getByRole("button", { name: "Delete" });
  await deleteButton.focus();
  await deleteButton.click();
  await expect(page.getByTitle("branch")).not.toContainText("Well");

  await expect(fisuDelete).toBeVisible();

  {
    // branch 2
    await page.getByRole("button", { name: "new-source-module" }).click();
    await page.getByRole("menuitem", { name: /source/i }).click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: "Ammonia" })
      .first()
      .click();

    const branch = getBranchWithCell("Ammonia");

    await newModule(branch, /^transport/i, "PSA/TSA");
    await newModule(branch, /^transport/i, "LP Compression");
    await newModule(branch, /^transport/i, "Topsides");
    await newModule(branch, /sink/i, /Offshore/i);

    await expect(branch).not.toContainText("Cement");
    await expect(branch).toContainText("Ammonia");
    await expect(branch).toContainText("PSA/TSA");
    await expect(branch).toContainText("LP");
    await expect(branch).toContainText("Topsides");
    await expect(branch).toContainText("Well");
  }

  {
    // branch 3
    await page.getByRole("button", { name: "new-source-module" }).click();
    await page.getByRole("menuitem", { name: /source/i }).click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: "Steel" })
      .first()
      .click();

    const branch = getBranchWithCell("Steel");

    await newModule(branch, /^transport/i, "Membrane");
    await newModule(branch, /^transport/i, "LP Compression");
    await newModule(branch, /^transport/i, "Topsides");
    await newModule(branch, /sink/i, /Offshore/i);

    await expect(branch).not.toContainText("Cement");
    await expect(branch).toContainText("Steel");
    await expect(branch).toContainText("Membrane");
    await expect(branch).toContainText("LP");
    await expect(branch).toContainText("Topsides");
    await expect(branch).toContainText("Well");
  }
});

test("delete the only cluster", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "remove cluster" }).click();

  await expect(page.getByTitle("branch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "new cluster" })).toBeVisible();
});
