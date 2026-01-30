import { describe, it, expect } from "bun:test";
import { Either } from "effect";
import {
  CostingEstimateRequestSchema,
  validateRequest,
  formatValidationErrors,
} from "./schemas";

describe("schemas", () => {
  describe("CostingEstimateRequestSchema", () => {
    it("validates valid networkId-based request", () => {
      const request = {
        source: { type: "networkId", networkId: "preset1" },
        libraryId: "V1.1_working",
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.source.type).toBe("networkId");
        expect(result.right.libraryId).toBe("V1.1_working");
      }
    });

    it("validates valid data-based request", () => {
      const request = {
        source: {
          type: "data",
          network: {
            groups: [{ id: "g1", branchIds: ["b1"] }],
            branches: [
              {
                id: "b1",
                blocks: [{ type: "Pipe", length: 1000 }],
              },
            ],
          },
        },
        libraryId: "V1.1_working",
        targetCurrency: "EUR",
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.source.type).toBe("data");
        expect(result.right.targetCurrency).toBe("EUR");
      }
    });

    it("rejects request with missing source", () => {
      const request = {
        libraryId: "V1.1_working",
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isLeft(result)).toBe(true);
    });

    it("rejects request with missing libraryId", () => {
      const request = {
        source: { type: "networkId", networkId: "preset1" },
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isLeft(result)).toBe(true);
    });

    it("rejects request with invalid source type", () => {
      const request = {
        source: { type: "invalid", path: "test" },
        libraryId: "V1.1_working",
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isLeft(result)).toBe(true);
    });

    it("rejects data source with missing network", () => {
      const request = {
        source: { type: "data" },
        libraryId: "V1.1_working",
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isLeft(result)).toBe(true);
    });

    it("validates request with asset overrides", () => {
      const request = {
        source: { type: "networkId", networkId: "preset1" },
        libraryId: "V1.1_working",
        assetDefaults: {
          timeline: {
            construction_start: 2025,
            operation_finish: 2050,
          },
          discount_rate: 0.08,
        },
        assetOverrides: {
          "group-1": {
            fte_personnel: 50,
          },
        },
      };

      const result = validateRequest(CostingEstimateRequestSchema, request);

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.assetDefaults?.discount_rate).toBe(0.08);
      }
    });
  });

  describe("formatValidationErrors", () => {
    it("formats errors for HTTP response", () => {
      const errors = [
        { message: "Missing field", path: "source", received: undefined },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted.error).toBe("Invalid request body");
      expect(formatted.details).toHaveLength(1);
      expect(formatted.details[0].path).toBe("source");
    });
  });
});
