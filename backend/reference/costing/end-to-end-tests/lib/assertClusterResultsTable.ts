import { expect } from "@playwright/test";
import { Locator } from "playwright";

export type Costs = {
  directEquipment: string;
  langFactoredCapital: string;
  totalInstalled: string;
  contingency: string;
  fixedOpex: string;
  variableOpex: string;
  decomissioning: string;
};

export type ExpectedTableContent = {
  clusterId: string;
  clusterName: string;
  clusterDescription: string;

  assets: {
    name: string;
    description: string;

    costs: Costs;
    npvCosts: Costs;
  }[];
};

export default async function assertClusterResultsSection(
  section: Locator,
  expectedContents: ExpectedTableContent,
  expectedTotal: {
    costs: Costs;
    npvCosts: Costs;
  },
) {
  const summaryTable = section.locator("css=table").nth(0);
  const summaryExpectedRows = [
    ["Cluster ID", expectedContents.clusterId],
    ["Cluster name", expectedContents.clusterName],
    ["Cluster Description", expectedContents.clusterDescription],
  ];
  await assertTable(summaryTable, summaryExpectedRows);

  const breakdownTable = section.locator("css=table").nth(1);
  const breakdownExpectedRows = [
    ["", "Asset ID", ...expectedContents.assets.map(() => /asset-./), "Total"],
    ["", "Asset name", ...expectedContents.assets.map((asset) => asset.name)],
    [
      "",
      "Asset description",
      ...expectedContents.assets.map((asset) => asset.description),
    ],
    ["Lifetime Costs"],
    [
      "CAPEX - Direct Equipment Cost",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.directEquipment),
      expectedTotal.costs.directEquipment,
    ],
    [
      "CAPEX - Lang Factored Capital Cost",
      "€",
      ...expectedContents.assets.map(
        (asset) => asset.costs.langFactoredCapital,
      ),
      expectedTotal.costs.langFactoredCapital,
    ],
    [
      "CAPEX - Total Installed Cost",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.totalInstalled),
      expectedTotal.costs.totalInstalled,
    ],
    [
      "CAPEX - Contingency",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.contingency),
      expectedTotal.costs.contingency,
    ],
    [
      "OPEX - Fixed (Cumulative for life of project)",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.fixedOpex),
      expectedTotal.costs.fixedOpex,
    ],
    [
      "OPEX - Variable (Cumulative for life of project)",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.variableOpex),
      expectedTotal.costs.variableOpex,
    ],
    [
      "Decomissioning",
      "€",
      ...expectedContents.assets.map((asset) => asset.costs.decomissioning),
      expectedTotal.costs.decomissioning,
    ],
    ["Lifetime NPC"],
    [
      "CAPEX - Direct Equipment Cost",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.directEquipment),
      expectedTotal.npvCosts.directEquipment,
    ],
    [
      "CAPEX - Lang Factored Capital Cost",
      "€",
      ...expectedContents.assets.map(
        (asset) => asset.npvCosts.langFactoredCapital,
      ),
      expectedTotal.npvCosts.langFactoredCapital,
    ],
    [
      "CAPEX - Total Installed Cost",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.totalInstalled),
      expectedTotal.npvCosts.totalInstalled,
    ],
    [
      "CAPEX - Contingency",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.contingency),
      expectedTotal.npvCosts.contingency,
    ],
    [
      "OPEX - Fixed (Cumulative for life of project)",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.fixedOpex),
      expectedTotal.npvCosts.fixedOpex,
    ],
    [
      "OPEX - Variable (Cumulative for life of project)",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.variableOpex),
      expectedTotal.npvCosts.variableOpex,
    ],
    [
      "Decomissioning",
      "€",
      ...expectedContents.assets.map((asset) => asset.npvCosts.decomissioning),
      expectedTotal.npvCosts.decomissioning,
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
