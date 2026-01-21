import { expect, test } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";
import assertClusterResultsSection from "./lib/assertClusterResultsTable";

test.beforeEach("login", login);

test("Allows fractional inputs", async ({ page }) => {
  await page.goto("/");

  await buildBranch(
    page,
    [
      {
        moduleType: /source/i,
        moduleName: "Cement",
        properties: {
          "Mass flow": 10.5,
        },
      },
      {
        moduleType: /^transport/i,
        moduleName: "Amine",
        properties: {
          "Mass flow": 10.5,
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
    ],
    { typeCharacters: true },
  );

  const resultsArea = page.locator("css=div", {
    has: page.getByRole("heading", { name: "Results" }),
  });
  const clusterResults = resultsArea.locator("css=section");

  await page.getByRole("button", { name: "Estimate!" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeAttached();

  await assertClusterResultsSection(
    clusterResults.nth(0),
    {
      clusterId: "initial",
      clusterName: "Cluster",
      clusterDescription: "",

      assets: [
        {
          name: "CO₂ Source",
          description: "",
          costs: {
            directEquipment: "€0.00",
            langFactoredCapital: "€0.00",
            totalInstalled: "€0.00",
            contingency: "€0.00",
            fixedOpex: "€0.00",
            variableOpex: "€0.00",
            decomissioning: "€0.00",
          },
          npvCosts: {
            directEquipment: "€0.00",
            langFactoredCapital: "€0.00",
            totalInstalled: "€0.00",
            contingency: "€0.00",
            fixedOpex: "€0.00",
            variableOpex: "€0.00",
            decomissioning: "€0.00",
          },
        },
        {
          name: "Capture Unit",
          description: "",
          costs: {
            directEquipment: "€106,307.52",
            langFactoredCapital: "€398,653.21",
            totalInstalled: "€398,653.21",
            contingency: "€106,307.52",
            fixedOpex: "€637,845.14",
            variableOpex: "€0.00",
            decomissioning: "€39,865.32",
          },
          npvCosts: {
            directEquipment: "€101,475.36",
            langFactoredCapital: "€380,532.61",
            totalInstalled: "€380,532.61",
            contingency: "€101,475.36",
            fixedOpex: "€246,833.42",
            variableOpex: "€0.00",
            decomissioning: "€4,897.29",
          },
        },
        {
          name: "LP Compression (1 to 40 bar)",
          description: "",
          costs: {
            directEquipment: "€598,507,194.81",
            langFactoredCapital: "€2,244,401,980.54",
            totalInstalled: "€2,244,401,980.54",
            contingency: "€598,507,194.81",
            fixedOpex: "€3,591,043,168.87",
            variableOpex: "€512,011,862.42",
            decomissioning: "€224,440,198.05",
          },
          npvCosts: {
            directEquipment: "€571,302,322.32",
            langFactoredCapital: "€2,142,383,708.70",
            totalInstalled: "€2,142,383,708.70",
            contingency: "€571,302,322.32",
            fixedOpex: "€1,389,662,492.66",
            variableOpex: "€198,138,437.09",
            decomissioning: "€27,571,574.64",
          },
        },
      ],
    },
    {
      costs: {
        directEquipment: "€598,613,502.33",
        langFactoredCapital: "€2,244,800,633.75",
        totalInstalled: "€2,244,800,633.75",
        contingency: "€598,613,502.33",
        fixedOpex: "€3,591,681,014.00",
        variableOpex: "€512,011,862.42",
        decomissioning: "€224,480,063.38",
      },
      npvCosts: {
        directEquipment: "€571,403,797.68",
        langFactoredCapital: "€2,142,764,241.31",
        totalInstalled: "€2,142,764,241.31",
        contingency: "€571,403,797.68",
        fixedOpex: "€1,389,909,326.08",
        variableOpex: "€198,138,437.09",
        decomissioning: "€27,576,471.93",
      },
    },
  );
});

test("Doesn't mark input fields as empty when they contain a 0", async ({
  page,
}) => {
  await page.goto("/");

  await buildBranch(page, [
    {
      moduleType: /source/i,
      moduleName: "Cement",
      properties: {
        "Mass flow": 0,
      },
    },
  ]);

  expect(page.getByTestId("alert-empty")).not.toBeVisible();
});
