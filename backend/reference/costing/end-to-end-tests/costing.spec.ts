import { expect, test } from "@playwright/test";
import login from "./lib/login";
import { buildBranch } from "./lib/buildBranch";
import assertClusterResultsSection from "./lib/assertClusterResultsTable";
import assertModuleResultsSection from "./lib/assertModuleResultsTable";

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
    {
      moduleType: /^transport/i,
      moduleName: "Dehydration (Molecular Sieve)",
      properties: {
        "Mass flow CO2": 100,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "HP Compression (40 to 120bara) (Electric Drive)",
      properties: {
        "Compressor Duty": 100,
        "(Item 007) Electrical power": 100,
        "(Item 008) Electrical power": 100,
        "Cooling duty": 100,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Refrigeration (EP - Water Cooling + trim refrig)",
      properties: {
        "Heat duty": 100,
        "Cooling water (10degC temp rise)": 100,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Shipping (EP)",
    },
    {
      moduleType: /^transport/i,
      moduleName: "FISU (vessel)",
      properties: {
        "Number of FISU vessels": 100,
      },
    },
    {
      moduleType: /^transport/i,
      moduleName: "Injection Topsides (pair with FISU or Platform)",
      properties: {
        "Pump moter rating": 100,
        "pump flowrate (volumetric)": 100,
        "(Item 028) Electrical power": 100,
        "(Item 006) Electrical power": 100,
        "Heater Duty": 100,
      },
    },
    {
      moduleType: /sink/i,
      moduleName: "Offshore Injection Well",
      properties: {
        "number of wells": 100,
      },
    },
  ]);

  const resultsArea = page.locator("css=div", {
    has: page.getByRole("heading", { name: "Results" }),
  });

  const clusterResults = resultsArea.locator("css=section");

  const currencySelector = page.getByRole("combobox", { name: "Currency:" });
  await currencySelector.selectOption("USD");

  await page.getByRole("button", { name: "Estimate!" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeAttached();
  await expect(clusterResults.getByText("$").first()).toBeVisible();

  await currencySelector.selectOption("EUR");
  await expect(clusterResults.getByText("$")).toHaveCount(0);
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
            directEquipment: "€1,012,452.60",
            langFactoredCapital: "€3,796,697.23",
            totalInstalled: "€3,796,697.23",
            contingency: "€1,012,452.60",
            fixedOpex: "€6,074,715.57",
            variableOpex: "€0.00",
            decomissioning: "€379,669.72",
          },
          npvCosts: {
            directEquipment: "€966,432.02",
            langFactoredCapital: "€3,624,120.09",
            totalInstalled: "€3,624,120.09",
            contingency: "€966,432.02",
            fixedOpex: "€2,350,794.46",
            variableOpex: "€0.00",
            decomissioning: "€46,640.90",
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
        {
          name: "Dehydration",
          description: "",
          costs: {
            directEquipment: "€642,271,307.06",
            langFactoredCapital: "€2,408,517,401.49",
            totalInstalled: "€2,408,517,401.49",
            contingency: "€642,271,307.06",
            fixedOpex: "€3,853,627,842.39",
            variableOpex: "€0.00",
            decomissioning: "€240,851,740.15",
          },
          npvCosts: {
            directEquipment: "€613,077,156.74",
            langFactoredCapital: "€2,299,039,337.79",
            totalInstalled: "€2,299,039,337.79",
            contingency: "€613,077,156.74",
            fixedOpex: "€1,491,277,554.02",
            variableOpex: "€0.00",
            decomissioning: "€29,587,666.51",
          },
        },
        {
          name: "HP Compression (40 to 120bara)",
          description: "",
          costs: {
            directEquipment: "€299,253,597.41",
            langFactoredCapital: "€1,122,200,990.27",
            totalInstalled: "€1,122,200,990.27",
            contingency: "€299,253,597.41",
            fixedOpex: "€1,795,521,584.43",
            variableOpex: "€256,005,931.21",
            decomissioning: "€112,220,099.03",
          },
          npvCosts: {
            directEquipment: "€285,651,161.16",
            langFactoredCapital: "€1,071,191,854.35",
            totalInstalled: "€1,071,191,854.35",
            contingency: "€285,651,161.16",
            fixedOpex: "€694,831,246.33",
            variableOpex: "€99,069,218.55",
            decomissioning: "€13,785,787.32",
          },
        },
        {
          name: "Refrigeration",
          description: "",
          costs: {
            directEquipment: "€141,545,056.48",
            langFactoredCapital: "€530,793,961.78",
            totalInstalled: "€530,793,961.78",
            contingency: "€141,545,056.48",
            fixedOpex: "€849,270,338.85",
            variableOpex: "€3,626,315,918.00",
            decomissioning: "€53,079,396.18",
          },
          npvCosts: {
            directEquipment: "€135,111,190.27",
            langFactoredCapital: "€506,666,963.52",
            totalInstalled: "€506,666,963.52",
            contingency: "€135,111,190.27",
            fixedOpex: "€328,650,779.32",
            variableOpex: "€1,403,312,347.08",
            decomissioning: "€6,520,590.10",
          },
        },
        {
          name: "Shipping",
          description: "",
          costs: {
            directEquipment: "€279,062,127.52",
            langFactoredCapital: "€1,046,482,978.20",
            totalInstalled: "€1,046,482,978.20",
            contingency: "€279,062,127.52",
            fixedOpex: "€1,674,372,765.13",
            variableOpex: "€0.00",
            decomissioning: "€104,648,297.82",
          },
          npvCosts: {
            directEquipment: "€266,377,485.36",
            langFactoredCapital: "€998,915,570.10",
            totalInstalled: "€998,915,570.10",
            contingency: "€266,377,485.36",
            fixedOpex: "€647,949,055.75",
            variableOpex: "€0.00",
            decomissioning: "€12,855,622.03",
          },
        },
        {
          name: "FISU (vessel)",
          description: "",
          costs: {
            directEquipment: "€422,598,667.88",
            langFactoredCapital: "€1,584,745,004.55",
            totalInstalled: "€1,584,745,004.55",
            contingency: "€422,598,667.88",
            fixedOpex: "€2,535,592,007.28",
            variableOpex: "€0.00",
            decomissioning: "€158,474,500.46",
          },
          npvCosts: {
            directEquipment: "€403,389,637.52",
            langFactoredCapital: "€1,512,711,140.71",
            totalInstalled: "€1,512,711,140.71",
            contingency: "€403,389,637.52",
            fixedOpex: "€981,223,823.70",
            variableOpex: "€0.00",
            decomissioning: "€19,467,954.29",
          },
        },
        {
          name: "Injection Topsides (pair with FISU or Platform)",
          description: "",
          costs: {
            directEquipment: "€560,412,051.48",
            langFactoredCapital: "€2,101,545,193.04",
            totalInstalled: "€2,101,545,193.04",
            contingency: "€560,412,051.48",
            fixedOpex: "€3,362,472,308.86",
            variableOpex: "€355,898,284.22",
            decomissioning: "€210,154,519.30",
          },
          npvCosts: {
            directEquipment: "€534,938,776.41",
            langFactoredCapital: "€2,006,020,411.54",
            totalInstalled: "€2,006,020,411.54",
            contingency: "€534,938,776.41",
            fixedOpex: "€1,301,210,102.61",
            variableOpex: "€137,725,578.20",
            decomissioning: "€25,816,636.52",
          },
        },
        {
          name: "Offshore Injection Well",
          description: "",
          costs: {
            directEquipment: "€5,557,035,959.81",
            langFactoredCapital: "€20,838,884,849.29",
            totalInstalled: "€20,838,884,849.29",
            contingency: "€5,557,035,959.81",
            fixedOpex: "€33,342,215,758.86",
            variableOpex: "€0.00",
            decomissioning: "€2,083,888,484.93",
          },
          npvCosts: {
            directEquipment: "€5,304,443,416.18",
            langFactoredCapital: "€19,891,662,810.68",
            totalInstalled: "€19,891,662,810.68",
            contingency: "€5,304,443,416.18",
            fixedOpex: "€12,902,776,291.86",
            variableOpex: "€0.00",
            decomissioning: "€255,997,309.75",
          },
        },
      ],
    },
    {
      costs: {
        directEquipment: "€8,501,698,415.04",
        langFactoredCapital: "€31,881,369,056.40",
        totalInstalled: "€31,881,369,056.40",
        contingency: "€8,501,698,415.04",
        fixedOpex: "€51,010,190,490.24",
        variableOpex: "€4,750,231,995.86",
        decomissioning: "€3,188,136,905.64",
      },
      npvCosts: {
        directEquipment: "€8,115,257,577.99",
        langFactoredCapital: "€30,432,215,917.47",
        totalInstalled: "€30,432,215,917.47",
        contingency: "€8,115,257,577.99",
        fixedOpex: "€19,739,932,140.71",
        variableOpex: "€1,838,245,580.92",
        decomissioning: "€391,649,782.06",
      },
    },
  );

  const item = page
    .getByTestId("cell")
    .filter({ hasText: "Injection Topsides (pair with FISU or Platform)" });
  await item.hover();
  await item.getByRole("button", { name: "View Costs" }).click();

  const table = page
    .locator("css=div")
    .filter({ has: page.getByText("Module Costs") })
    .nth(1);

  await assertModuleResultsSection(
    table,
    {
      moduleType: "Injection Topsides (pair with FISU or Platform)",
      moduleSubtype: "",

      costItems: [
        {
          name: "Pump",
          description: "Injection Pump",
          costs: {
            directEquipment: "€8,294.96",
            totalInstalled: "€0.00",

            electricalPower: "€9,365,744.32",
            coolingWater: "€0.00",
            naturalGas: "€0.00",
            steamHp: "€0.00",
            steamLp: "€0.00",
            catalystsAndChemicals: "€0.00",
            equipmentItemRental: "€0.00",
            costPerTonneCo2: "€0.00",
          },
        },
        {
          name: "Heating",
          description: "Heater",
          costs: {
            directEquipment: "€560,403,756.52",
            totalInstalled: "€0.00",

            electricalPower: "€8,429,169.89",
            coolingWater: "€0.00",
            naturalGas: "€0.00",
            steamHp: "€0.00",
            steamLp: "€0.00",
            catalystsAndChemicals: "€0.00",
            equipmentItemRental: "€0.00",
            costPerTonneCo2: "€0.00",
          },
        },
      ],
    },
    {
      directEquipment: "€560,412,051.48",
      totalInstalled: "€0.00",

      electricalPower: "€17,794,914.21",
      coolingWater: "€0.00",
      naturalGas: "€0.00",
      steamHp: "€0.00",
      steamLp: "€0.00",
      catalystsAndChemicals: "€0.00",
      equipmentItemRental: "€0.00",
      costPerTonneCo2: "€0.00",
    },
  );
});
