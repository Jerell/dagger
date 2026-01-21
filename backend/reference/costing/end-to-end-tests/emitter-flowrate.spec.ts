import { expect, test } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";

test.beforeEach("login", login);

test("Estimate costs on an example branch", async ({ page }) => {
  await page.goto("/");

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
        "Mass flow": 100,
      },
    },
  ]);

  await expect(page.getByTestId("cell").nth(0)).toContainText("100 MTPA");
  await expect(page.getByTestId("cell").nth(1)).toContainText("100 MTPA");
});
