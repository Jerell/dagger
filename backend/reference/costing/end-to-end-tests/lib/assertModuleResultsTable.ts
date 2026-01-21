import { expect } from "@playwright/test";
import { Locator } from "playwright";

export type Costs = {
  directEquipment: string;
  totalInstalled: string;

  electricalPower: string;
  coolingWater: string;
  naturalGas: string;
  steamHp: string;
  steamLp: string;
  catalystsAndChemicals: string;
  equipmentItemRental: string;
  costPerTonneCo2: string;
};

export type ExpectedTableContent = {
  moduleType: string;
  moduleSubtype: string;

  costItems: {
    name: string;
    description: string;

    costs: Costs;
  }[];
};

export default async function assertModuleResultsSection(
  section: Locator,
  expectedContents: ExpectedTableContent,
  expectedTotal: Costs,
) {
  const summaryTable = section.locator("css=table").nth(0);
  const summaryExpectedRows = [
    ["Module ID", /source-|transport-|sink-/],
    ["Module type", expectedContents.moduleType],
    ["Module sub-type", expectedContents.moduleSubtype],
  ];
  await assertTable(summaryTable, summaryExpectedRows);

  const breakdownTable = section.locator("css=table").nth(1);
  const breakdownExpectedRows = [
    [
      "",
      "Scaled item ID",
      ...expectedContents.costItems.map(() => /source-|transport-|sink-/),
      "Module Total",
    ],
    [
      "",
      "Item type",
      ...expectedContents.costItems.map((scaledItem) => scaledItem.name),
    ],
    [
      "",
      "Short Name",
      ...expectedContents.costItems.map((scaledItem) => scaledItem.description),
    ],
    ["Capex Contribution"],
    [
      "Direct Equipment Cost",
      "€",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.directEquipment,
      ),
    ],
    [
      "Total Installed Cost",
      "€",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.totalInstalled,
      ),
    ],
    [],
    ["Variable OPEX contribution"],
    [
      "Electrical Power",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.electricalPower,
      ),
      expectedTotal.electricalPower,
    ],
    [
      "Cooling water (10degC temp rise)",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.coolingWater,
      ),
      expectedTotal.coolingWater,
    ],
    [
      "Natural gas",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.naturalGas,
      ),
      expectedTotal.naturalGas,
    ],
    [
      "Steam HP superheat, 600degC and 50bara",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.steamHp,
      ),
      expectedTotal.steamHp,
    ],
    [
      "Steam LP saturated, 160degC and 6.2bara",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.steamLp,
      ),
      expectedTotal.steamLp,
    ],
    [
      "Catalysts and chemicals",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.catalystsAndChemicals,
      ),
      expectedTotal.catalystsAndChemicals,
    ],
    [
      "Equipment item rental",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.equipmentItemRental,
      ),
      expectedTotal.equipmentItemRental,
    ],
    [
      "Cost per tonne of CO2",
      "€/year",
      ...expectedContents.costItems.map(
        (scaledItem) => scaledItem.costs.costPerTonneCo2,
      ),
      expectedTotal.costPerTonneCo2,
    ],
  ];
  await assertTable(breakdownTable, breakdownExpectedRows);
}

async function assertTable(
  table: Locator,
  expectedRows: (string | RegExp)[][],
) {
  const tableBody = table.locator("css=tbody");
  const rows = tableBody.locator("css=tr");

  expect(await rows.count()).toEqual(expectedRows.length);

  // Would be more semantic to write `.map`s here with a
  // `Promise.all` to resolve them all at the end, but on
  // slower runners (AKA, Github Actions), the assertion times out
  // because it's busy processing every request at once. Writing it like
  // this performs each assert in series, which avoids the timeout.
  for (const [i, expectedRow] of expectedRows.entries()) {
    for (const [j, cell] of expectedRow.entries()) {
      await expect(rows.nth(i).locator("css=td").nth(j)).toHaveText(cell);
    }
  }
}
