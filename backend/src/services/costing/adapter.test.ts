import { describe, it, expect } from "bun:test";
import {
  transformNetworkToCostingRequest,
  transformCostingResponse,
} from "./adapter";
import type { CostEstimateResponse } from "./types";
import type { NetworkSource } from "./request-types";

describe("adapter", () => {
  describe("transformNetworkToCostingRequest", () => {
    const networkIdSource: NetworkSource = {
      type: "networkId",
      networkId: "preset1",
    };

    it("produces valid structure even with incompatible blocks", async () => {
      // preset1 may have blocks that can't be costed - the adapter should handle this gracefully
      const result = await transformNetworkToCostingRequest(
        networkIdSource,
        "v1.0-costing",
        {
          libraryId: "V1.1_working",
        },
      );

      expect(result.request).toBeDefined();
      expect(result.request.assets).toBeInstanceOf(Array);
      expect(result.assetMetadata).toBeInstanceOf(Array);

      // Metadata tracks all groups/branches, assets only includes those with costable items
      // So assets.length <= assetMetadata.length
      expect(result.request.assets.length).toBeLessThanOrEqual(
        result.assetMetadata.length,
      );
    });

    it("applies default properties to assets", async () => {
      const result = await transformNetworkToCostingRequest(
        networkIdSource,
        "v1.0-costing",
        {
          libraryId: "V1.1_working",
        },
      );

      // Each asset (if any) should have timeline with defaults
      for (const asset of result.request.assets) {
        expect(asset.id).toBeDefined();
        expect(asset.timeline).toBeDefined();
        expect(asset.timeline.construction_start).toBeTypeOf("number");
        expect(asset.labour_average_salary).toBeDefined();
        expect(asset.cost_items).toBeInstanceOf(Array);
      }

      // Each metadata tracks defaults usage
      for (const metadata of result.assetMetadata) {
        expect(metadata.assetId).toBeDefined();
        expect(metadata.usingDefaults).toBeInstanceOf(Array);
        expect(metadata.blockCount).toBeTypeOf("number");
      }
    });

    it("applies custom asset overrides when provided", async () => {
      const customTimeline = {
        construction_start: 2030,
        construction_finish: 2031,
        operation_start: 2032,
        operation_finish: 2050,
        decommissioning_start: 2051,
        decommissioning_finish: 2052,
      };

      const result = await transformNetworkToCostingRequest(
        networkIdSource,
        "v1.0-costing",
        {
          libraryId: "V1.1_working",
          assetDefaults: {
            timeline: customTimeline,
          },
        },
      );

      // All assets (if any) should have the custom timeline
      for (const asset of result.request.assets) {
        expect(asset.timeline.construction_start).toBe(2030);
        expect(asset.timeline.operation_finish).toBe(2050);
      }
    });

    it("accepts inline network data", async () => {
      const dataSource: NetworkSource = {
        type: "data",
        network: {
          groups: [
            { id: "group-1", label: "Test Group", branchIds: ["branch-1"] },
          ],
          branches: [
            {
              id: "branch-1",
              label: "Test Branch",
              parentId: "group-1",
              blocks: [
                {
                  type: "Pipe",
                  phase: "gas",
                  location: "onshore",
                  size: "medium",
                  length: 1000,
                },
              ],
            },
          ],
        },
      };

      const result = await transformNetworkToCostingRequest(
        dataSource,
        "v1.0-costing",
        {
          libraryId: "V1.1_working",
        },
      );

      expect(result.request).toBeDefined();
      expect(result.assetMetadata).toBeInstanceOf(Array);
      // Should have one asset (the group with the Pipe block)
      expect(result.request.assets.length).toBe(1);
      expect(result.assetMetadata[0].name).toBe("Test Group");
    });
  });

  describe("transformCostingResponse", () => {
    it("transforms costing server response to our format", () => {
      const mockResponse: CostEstimateResponse = {
        assets: [
          {
            id: "asset-1",
            costs: {
              direct_equipment_cost: 1000000,
              lang_factored_capital_cost: {
                equipment_erection: 100000,
                piping: 100000,
                instrumentation: 50000,
                electrical: 50000,
                buildings_and_process: 50000,
                utilities: 50000,
                storages: 50000,
                site_development: 50000,
                ancillary_buildings: 50000,
                design_and_engineering: 100000,
                contractors_fee: 50000,
                contingency: 100000,
              },
              total_installed_cost: 1800000,
              fixed_opex_cost_per_year: {
                maintenance: 50000,
                control_room_facilities: 0,
                insurance_liability: 0,
                insurance_equipment_loss: 0,
                cost_of_capital: 0,
                major_turnarounds: 0,
              },
              variable_opex_cost_per_year: {
                electrical_power: 10000,
                cooling_water: 5000,
                natural_gas: 0,
                steam_hp_superheated: 0,
                steam_lp_saturated: 0,
                catalysts_and_chemicals: 0,
                equipment_item_rental: 0,
                cost_per_tonne_of_co2: 0,
                tariff: 0,
              },
              decommissioning_cost: 100000,
            },
            costs_by_year: [],
            lifetime_costs: {
              direct_equipment_cost: 1000000,
              lang_factored_capital_cost: {
                equipment_erection: 100000,
                piping: 100000,
                instrumentation: 50000,
                electrical: 50000,
                buildings_and_process: 50000,
                utilities: 50000,
                storages: 50000,
                site_development: 50000,
                ancillary_buildings: 50000,
                design_and_engineering: 100000,
                contractors_fee: 50000,
                contingency: 100000,
              },
              total_installed_cost: 1800000,
              fixed_opex_cost: {
                maintenance: 1000000,
                control_room_facilities: 0,
                insurance_liability: 0,
                insurance_equipment_loss: 0,
                cost_of_capital: 0,
                major_turnarounds: 0,
              },
              variable_opex_cost: {
                electrical_power: 200000,
                cooling_water: 100000,
                natural_gas: 0,
                steam_hp_superheated: 0,
                steam_lp_saturated: 0,
                catalysts_and_chemicals: 0,
                equipment_item_rental: 0,
                cost_per_tonne_of_co2: 0,
                tariff: 0,
              },
              decommissioning_cost: 100000,
            },
            lifetime_dcf_costs: {
              direct_equipment_cost: 900000,
              lang_factored_capital_cost: {
                equipment_erection: 90000,
                piping: 90000,
                instrumentation: 45000,
                electrical: 45000,
                buildings_and_process: 45000,
                utilities: 45000,
                storages: 45000,
                site_development: 45000,
                ancillary_buildings: 45000,
                design_and_engineering: 90000,
                contractors_fee: 45000,
                contingency: 90000,
              },
              total_installed_cost: 1620000,
              fixed_opex_cost: {
                maintenance: 500000,
                control_room_facilities: 0,
                insurance_liability: 0,
                insurance_equipment_loss: 0,
                cost_of_capital: 0,
                major_turnarounds: 0,
              },
              variable_opex_cost: {
                electrical_power: 100000,
                cooling_water: 50000,
                natural_gas: 0,
                steam_hp_superheated: 0,
                steam_lp_saturated: 0,
                catalysts_and_chemicals: 0,
                equipment_item_rental: 0,
                cost_per_tonne_of_co2: 0,
                tariff: 0,
              },
              decommissioning_cost: 50000,
            },
            cost_items: [],
          },
        ],
      };

      const metadata = [
        {
          assetId: "asset-1",
          name: "Test Asset",
          isGroup: true,
          branchIds: ["branch-1"],
          blockCount: 5,
          costableBlockCount: 5,
          usingDefaults: ["timeline", "capex_lang_factors"],
          blocks: [],
        },
      ];

      const result = transformCostingResponse(mockResponse, metadata, "USD");

      expect(result.currency).toBe("USD");
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe("asset-1");
      expect(result.assets[0].name).toBe("Test Asset");
      expect(result.assets[0].isUsingDefaults).toBe(true);
      expect(result.assets[0].propertiesUsingDefaults).toContain("timeline");
      expect(result.lifetimeCosts.directEquipmentCost).toBe(1000000);
      expect(result.lifetimeCosts.totalInstalledCost).toBe(1800000);
    });
  });
});
