import { test, expect } from "@playwright/test";
import login from "./lib/login";

test.beforeEach("login", login);

test("Create multiple clusters", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "new-source-module" }).click();

  await page.getByRole("menuitem", { name: /source/i }).click();
  await page
    .getByRole("menuitem")
    .filter({ hasText: "Cement" })
    .first()
    .click();

  await expect(page.getByTitle("branch")).toContainText("Cement");

  await page.getByRole("button", { name: "new cluster" }).click();
  await expect(page.getByTitle("branch")).toHaveCount(0);

  await expect(
    // new tab
    page.getByRole("tab", { name: "Cluster 2 edit cluster remove" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Cluster edit cluster remove" }).click();
  await expect(page.getByTitle("branch")).toContainText("Cement");

  await page
    .getByRole("tab", { name: "Cluster edit cluster remove" })
    .getByRole("button", { name: "remove cluster" })
    .click();

  await expect(page.getByTitle("branch")).toHaveCount(0);
});
