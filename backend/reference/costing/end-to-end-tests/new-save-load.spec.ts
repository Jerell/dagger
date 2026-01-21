import { test, expect } from "@playwright/test";
import login from "./lib/login";
import path from "path";
import os from "os";

test.beforeEach("login", login);

test("Create, save, and load a network", async ({ page }) => {
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

  // 2 clusters created
  // one with Emitter (cement)
  // the other empty

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const download = await downloadPromise;

  const suggested = download.suggestedFilename() || "state.json";
  const destDir = os.tmpdir();
  const destPath = path.join(destDir, suggested);

  await download.saveAs(destPath);

  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByTitle("branch")).toHaveCount(0);

  await page.getByRole("button", { name: "Load", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "upload", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(destPath);

  await page.getByRole("button", { name: "Upload", exact: true }).click();

  await expect(page.getByTitle("branch")).toContainText("Cement");
});
