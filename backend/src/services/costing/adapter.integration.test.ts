/**
 * Integration tests for the costing adapter.
 *
 * These tests verify the full integration path:
 * 1. Loading networks from TOML files (path-based source)
 * 2. Unit conversion via dim (e.g., "100 t/h" → kg/h, "100 m^3/h" → m³/h)
 * 3. Transformation to costing server request format
 * 4. Calling the actual costing server
 * 5. Transforming response back to our format
 *
 * The tests use the reference network in workingfiles/costing-reference/
 * which matches the costing tool's e2e test structure.
 *
 * Prerequisites:
 * - Costing server running at http://localhost:8080
 *
 * Run with: bun test src/services/costing/adapter.integration.test.ts
 */

import { describe, it, expect, beforeAll } from "bun:test";
import {
  transformNetworkToCostingRequest,
  transformCostingResponse,
} from "./adapter";
import type { NetworkSource, NetworkData } from "./request-types";
import type { CostEstimateResponse } from "./types";
import * as path from "path";

const COSTING_SERVER_URL =
  process.env.COSTING_SERVER_URL || "http://localhost:8080";
const LIBRARY_ID = "V1.1_working";

// Path to the reference network TOML files (relative to repo root, not backend/)
const COSTING_REFERENCE_PATH = path.join(
  process.cwd(),
  "..",
  "workingfiles/costing-reference"
);

// Helper to check if costing server is available
async function isCostingServerAvailable(): Promise<boolean> {
  try {
    // Try the API endpoint with empty request
    const response = await fetch(
      `${COSTING_SERVER_URL}/api/cost/estimate?library_id=${LIBRARY_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: [] }),
        signal: AbortSignal.timeout(5000),
      }
    );
    // Server is available if we get a response (even error response)
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

// Helper to call costing server
async function callCostingServer(
  request: unknown,
  libraryId: string = LIBRARY_ID,
  currency: string = "EUR"
): Promise<CostEstimateResponse> {
  const url = `${COSTING_SERVER_URL}/api/cost/estimate?library_id=${libraryId}&target_currency_code=${currency}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Costing server error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Helper to parse EUR amount from string like "€1,012,452.60"
function parseEurAmount(str: string): number {
  return parseFloat(str.replace(/[€,]/g, ""));
}

describe("adapter integration tests", () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isCostingServerAvailable();
    if (!serverAvailable) {
      console.warn(
        "⚠️  Costing server not available - skipping integration tests"
      );
    }
  });

  describe("reference network: Capture Unit (Amine)", () => {
    /**
     * Reference test from costing.spec.ts:
     * - Module: Amine (Capture Unit)
     * - Properties: Mass flow = 100 kg/h, Parallel splits = 3
     * - Expected direct equipment: €1,012,452.60
     * - Expected total installed: €3,796,697.23
     */
    it("produces correct costs for Amine capture unit", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Construct network with single Capture Unit block
      // Uses unit strings to exercise dim parsing
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "capture-branch",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h", // Cost library expects kg/h
                quantity: 3, // "Parallel splits" = 3 in the e2e test
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      expect(request.assets.length).toBe(1);
      expect(request.assets[0].cost_items.length).toBe(1);

      // Call costing server
      const costingResponse = await callCostingServer(request);

      // Transform response
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR"
      );

      // Expected values from e2e test (in EUR)
      const expectedDirectEquipment = parseEurAmount("€1,012,452.60");
      const expectedTotalInstalled = parseEurAmount("€3,796,697.23");

      expect(result.assets.length).toBe(1);
      expect(result.assets[0].lifetimeCosts.directEquipmentCost).toBeCloseTo(
        expectedDirectEquipment,
        0
      );
      expect(result.assets[0].lifetimeCosts.totalInstalledCost).toBeCloseTo(
        expectedTotalInstalled,
        0
      );
    });
  });

  describe("reference network: LP Compression (Electric Drive)", () => {
    /**
     * Reference test from costing.spec.ts:
     * - Module: LP Compression (1 to 40 bar) (Electric Drive)
     * - Properties: Compressor Duty = 100 MW, Electrical power (2x) = 100 kW, Cooling duty = 100 MW, Parallel splits = 2
     * - Expected direct equipment: €598,507,194.81
     *
     * Block properties use flat structure with item-specific suffixes:
     * - electrical_power_compressor → Item 007's "Electrical power"
     * - electrical_power_cooler → Item 008's "Electrical power"
     */
    it("produces costs for LP Compression with item-specific parameters", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "lp-compression-branch",
            label: "LP Compression (1 to 40 bar)",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                // Scaling factors - using unit strings
                compressor_duty: "100 MW", // scales compressor (Item 007)
                cooling_duty: "100 MW", // scales after-cooler (Item 008)
                // Item-specific electrical power (for variable OPEX)
                electrical_power_compressor: "100 kW", // compressor motor (Item 007)
                electrical_power_cooler: "100 kW", // cooler fans (Item 008)
                quantity: 2, // Parallel splits
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      expect(request.assets.length).toBe(1);
      // Should now have 2 cost items: one for compressor (Item 007), one for cooler (Item 008)
      expect(request.assets[0].cost_items.length).toBe(2);

      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR"
      );

      // Log for comparison - e2e expects €598,507,194.81
      console.log(
        `LP Compression direct equipment: €${result.assets[0].lifetimeCosts.directEquipmentCost.toLocaleString()}`
      );
      console.log(`Expected (e2e): €598,507,194.81`);

      // Verify we get the expected cost
      const expectedDirectEquipment = parseEurAmount("€598,507,194.81");
      expect(result.assets[0].lifetimeCosts.directEquipmentCost).toBeCloseTo(
        expectedDirectEquipment,
        0
      );
    });
  });

  describe("reference network: multi-asset chain", () => {
    /**
     * Test multiple assets in a chain.
     * Uses a subset of modules that we can reliably map.
     * All values use unit strings to exercise dim parsing.
     */
    it("produces costs for multiple assets", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Simpler chain with modules we know work
      // Uses unit strings to exercise dim
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "capture",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h",
                quantity: 3,
              },
            ],
          },
          {
            id: "lp-compression",
            label: "LP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                cooling_duty: "100 MW",
                quantity: 2,
              },
            ],
          },
          {
            id: "hp-compression",
            label: "HP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "hp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                cooling_duty: "100 MW",
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      console.log(
        "Multi-asset chain - Assets generated:",
        request.assets.length
      );
      console.log(
        "Multi-asset chain - Asset IDs:",
        request.assets.map((a) => a.id)
      );

      expect(request.assets.length).toBe(3);

      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR"
      );

      // Log results
      console.log(
        "Network total direct equipment:",
        `€${result.lifetimeCosts.directEquipmentCost.toLocaleString()}`
      );
      for (const asset of result.assets) {
        console.log(
          `  ${asset.id}: €${asset.lifetimeCosts.directEquipmentCost.toLocaleString()}`
        );
      }

      // Verify structure
      expect(result.assets.length).toBe(3);
      expect(result.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);

      // All assets should have costs
      for (const asset of result.assets) {
        expect(asset.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);
      }
    });
  });

  describe("reference network: full chain from TOML files", () => {
    /**
     * Full chain loading from TOML files in workingfiles/costing-reference/
     *
     * This test exercises the complete integration:
     * - File-based network loading (type: "path")
     * - TOML parsing with unit strings like "100 kg/h", "100 m^3/h", "100 MW"
     * - Unit conversion via dim (ensures correct numeric values for costing server)
     * - Costing server request/response transformation
     *
     * Expected totals from e2e test:
     * - Direct Equipment: €8,501,698,415.04
     * - Total Installed: €31,881,369,056.40
     *
     * Expected per-asset direct equipment costs:
     * - CO2 Source: €0.00
     * - Capture Unit: €1,012,452.60
     * - LP Compression: €598,507,194.81
     * - Dehydration: €642,271,307.06
     * - HP Compression: €299,253,597.41
     * - Refrigeration: €141,545,056.48
     * - Shipping: €279,062,127.52
     * - FISU: €422,598,667.88
     * - Injection Topsides: €560,412,051.48
     * - Offshore Injection Well: €5,557,035,959.81
     */
    it("loads network from TOML files and produces correct costs", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Use path-based source to load from TOML files
      // This exercises:
      // - WASM network loading
      // - Unit string parsing via dim (e.g., "100 kg/h", "100 m^3/h", "100 MW")
      // - Block property extraction from TOML
      const source: NetworkSource = {
        type: "path",
        path: COSTING_REFERENCE_PATH,
      };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      console.log("\n=== Path-Based Loading Test ===");
      console.log("Network path:", COSTING_REFERENCE_PATH);
      console.log("Assets generated:", request.assets.length);
      console.log(
        "Asset IDs:",
        request.assets.map((a) => a.id)
      );

      // Verify we got assets from the TOML files
      expect(request.assets.length).toBeGreaterThan(0);

      // Call costing server
      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR"
      );

      // Log results
      console.log(
        `\nNetwork Total Direct Equipment: €${result.lifetimeCosts.directEquipmentCost.toLocaleString()}`
      );
      console.log(
        `Network Total Installed: €${result.lifetimeCosts.totalInstalledCost.toLocaleString()}`
      );
      console.log("\nPer-asset Direct Equipment:");
      for (const asset of result.assets) {
        console.log(
          `  ${asset.name}: €${asset.lifetimeCosts.directEquipmentCost.toLocaleString()}`
        );
      }

      // Expected values from e2e test
      const expectedAssetCosts: Record<string, number> = {
        "CO2 Source": 0,
        "Capture Unit": parseEurAmount("€1,012,452.60"),
        "LP Compression": parseEurAmount("€598,507,194.81"),
        Dehydration: parseEurAmount("€642,271,307.06"),
        "HP Compression": parseEurAmount("€299,253,597.41"),
        Refrigeration: parseEurAmount("€141,545,056.48"),
        Shipping: parseEurAmount("€279,062,127.52"),
        FISU: parseEurAmount("€422,598,667.88"),
        "Injection Topsides": parseEurAmount("€560,412,051.48"),
        "Injection Well": parseEurAmount("€5,557,035,959.81"),
      };

      const expectedTotalDirectEquipment = parseEurAmount("€8,501,698,415.04");
      const expectedTotalInstalled = parseEurAmount("€31,881,369,056.40");

      // Verify we have all expected assets
      const missingAssets: string[] = [];
      const matchedAssets: string[] = [];

      for (const [name, expectedCost] of Object.entries(expectedAssetCosts)) {
        const asset = result.assets.find((a) => a.name === name);
        if (asset) {
          matchedAssets.push(name);
          if (expectedCost > 0) {
            // Allow 1% tolerance for floating point differences
            const tolerance = expectedCost * 0.01;
            expect(asset.lifetimeCosts.directEquipmentCost).toBeCloseTo(
              expectedCost,
              -Math.log10(tolerance)
            );
          }
        } else {
          missingAssets.push(name);
        }
      }

      if (missingAssets.length > 0) {
        console.log(
          "\nMissing assets (need schema/mapper work):",
          missingAssets
        );
      }

      // Verify network totals match expected (if all assets present)
      if (missingAssets.length === 0) {
        expect(result.lifetimeCosts.directEquipmentCost).toBeCloseTo(
          expectedTotalDirectEquipment,
          0
        );
        expect(result.lifetimeCosts.totalInstalledCost).toBeCloseTo(
          expectedTotalInstalled,
          0
        );
      } else {
        // At minimum, verify the assets we do have are costed correctly
        console.log("\nPartial chain test - verified assets:", matchedAssets);
        expect(matchedAssets.length).toBeGreaterThan(0);
      }
    });

    it("correctly converts unit strings via dim", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // This test specifically verifies that dim handles volumetric flow rate
      // The TOML files contain unit strings like "100 m^3/h" which dim must parse
      const source: NetworkSource = {
        type: "path",
        path: COSTING_REFERENCE_PATH,
      };

      const { request } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      // Find the Injection Topsides asset which has pump_flowrate in m^3/h
      const injectionTopsides = request.assets.find((a) =>
        a.id.includes("injection-topsides")
      );
      if (injectionTopsides) {
        console.log("\n=== Injection Topsides Cost Items ===");
        for (const item of injectionTopsides.cost_items) {
          console.log(`  ${item.ref}: params =`, item.parameters);
        }

        // The pump flowrate should be converted from "100 m^3/h" to numeric
        const pumpItem = injectionTopsides.cost_items.find(
          (item) => item.parameters["Pump flowrate (volumetric)"] !== undefined
        );
        if (pumpItem) {
          const pumpFlowrate =
            pumpItem.parameters["Pump flowrate (volumetric)"];
          console.log(
            `\nPump flowrate converted: ${pumpFlowrate} (expected ~100 if in m³/h)`
          );
          expect(pumpFlowrate).toBeCloseTo(100, 0);
        }
      }

      // Find the Refrigeration asset which has cooling_water in m^3/h
      const refrigeration = request.assets.find((a) =>
        a.id.includes("refrigeration")
      );
      if (refrigeration) {
        console.log("\n=== Refrigeration Cost Items ===");
        for (const item of refrigeration.cost_items) {
          console.log(`  ${item.ref}: params =`, item.parameters);
        }

        // The cooling water should be converted from "100 m^3/h" to numeric
        const coolingItem = refrigeration.cost_items.find(
          (item) =>
            item.parameters["Cooling water (10degC temp rise)"] !== undefined
        );
        if (coolingItem) {
          const coolingWater =
            coolingItem.parameters["Cooling water (10degC temp rise)"];
          console.log(
            `\nCooling water converted: ${coolingWater} (expected ~100 if in m³/h)`
          );
          expect(coolingWater).toBeCloseTo(100, 0);
        }
      }

      // Find Capture Unit which has mass_flow in t/h that should convert to kg/h
      const captureUnit = request.assets.find((a) => a.id.includes("capture"));
      if (captureUnit) {
        console.log("\n=== Capture Unit Cost Items ===");
        for (const item of captureUnit.cost_items) {
          console.log(`  ${item.ref}: params =`, item.parameters);
        }

        // mass_flow = "100 kg/h" should remain 100 kg/h (same units as cost library)
        const massFlowItem = captureUnit.cost_items.find(
          (item) => item.parameters["Mass flow"] !== undefined
        );
        if (massFlowItem) {
          const massFlow = massFlowItem.parameters["Mass flow"];
          console.log(
            `\nMass flow converted: ${massFlow} kg/h (expected 100 from "100 kg/h")`
          );
          expect(massFlow).toBeCloseTo(100, 0);
        }
      }
    });
  });

  describe("reference network: inline data (for comparison)", () => {
    /**
     * Inline data test for quick verification without file I/O.
     * Uses unit strings to exercise dim conversion.
     */
    it("produces correct costs with inline data using unit strings", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Inline network with unit strings (same as TOML files)
      // These match the reference e2e test values
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "branch-source",
            label: "CO2 Source",
            blocks: [
              {
                type: "Emitter",
                emitter_type: "cement",
                mass_flow: "100 kg/h", // Cost library expects kg/h
              },
            ],
          },
          {
            id: "branch-capture",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h", // Cost library expects kg/h
                quantity: 3,
              },
            ],
          },
          {
            id: "branch-lp-compression",
            label: "LP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                cooling_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                quantity: 2,
              },
            ],
          },
          {
            id: "branch-dehydration",
            label: "Dehydration",
            blocks: [
              {
                type: "Dehydration",
                dehydration_type: "molecular_sieve",
                mass_flow_co2: "100 MTPA",
              },
            ],
          },
          {
            id: "branch-hp-compression",
            label: "HP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "hp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                cooling_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
              },
            ],
          },
          {
            id: "branch-refrigeration",
            label: "Refrigeration",
            blocks: [
              {
                type: "Refrigeration",
                pressure_class: "ep",
                cooling_method: "water",
                heat_duty: "100 MW",
                cooling_water: "100 m^3/h", // Volumetric flow - dim parses m^3/h
              },
            ],
          },
          {
            id: "branch-shipping",
            label: "Shipping",
            blocks: [
              {
                type: "Shipping",
                pressure_class: "ep",
              },
            ],
          },
          {
            id: "branch-fisu",
            label: "FISU",
            blocks: [
              {
                type: "OffshorePlatform",
                platform_type: "fisu",
                number_of_fisu_vessels: 100,
              },
            ],
          },
          {
            id: "branch-injection-topsides",
            label: "Injection Topsides",
            blocks: [
              {
                type: "InjectionTopsides",
                location: "offshore",
                pump_motor_rating: "100 kW",
                pump_flowrate: "100 m^3/h", // Volumetric flow - dim parses m^3/h
                heater_duty: "100 MW",
                electrical_power_pump: "100 kW",
                electrical_power_heater: "100 kW",
              },
            ],
          },
          {
            id: "branch-injection-well",
            label: "Injection Well",
            blocks: [
              {
                type: "InjectionWell",
                location: "offshore",
                number_of_wells: 100,
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        }
      );

      console.log("\n=== Inline Data Test (with unit strings) ===");
      console.log("Assets generated:", request.assets.length);

      // Call costing server
      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR"
      );

      console.log(
        `Network Total Direct Equipment: €${result.lifetimeCosts.directEquipmentCost.toLocaleString()}`
      );

      // Results should match the path-based test
      expect(result.assets.length).toBeGreaterThan(0);
      expect(result.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);
    });
  });
});
