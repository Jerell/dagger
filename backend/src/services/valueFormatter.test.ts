import { describe, it, expect, beforeEach, vi } from "vitest";
import { formatValueUnified, FormatValueOptions } from "./valueFormatter";
import { UnitPreferences } from "./unitFormatter";

// Mock dim
vi.mock("./dim.js", () => ({
  default: {
    init: vi.fn().mockResolvedValue(undefined),
    eval: vi.fn((expr: string) => {
      // Mock unit conversions
      if (expr.includes("1 mi as km")) return "1.60934 km";
      if (expr.includes("1 mi as m")) return "1609.34 m";
      if (expr.includes("100 m as km")) return "0.1 km";
      if (expr.includes("20 K as C")) return "-253.15 C";
      if (expr.includes("20 K as K")) return "20 K";
      return expr;
    }),
  },
}));

// Mock schema properties lookup
vi.mock("./effectSchemaProperties.js", () => ({
  getBlockSchemaProperties: vi.fn().mockResolvedValue({}),
}));

describe("formatValueUnified", () => {
  beforeEach(async () => {
    const dim = await import("./dim.js");
    await dim.default.init();
  });

  const baseOptions: FormatValueOptions = {
    propertyName: "length",
    blockType: "Pipe",
    unitPreferences: {
      blockTypes: {},
      dimensions: {},
      propertyDimensions: {},
    },
  };

  describe("unit string formatting", () => {
    it("should format unit strings according to block-type preferences", async () => {
      const options: FormatValueOptions = {
        ...baseOptions,
        unitPreferences: {
          ...baseOptions.unitPreferences,
          blockTypes: {
            Pipe: {
              length: "km",
            },
          },
        },
      };

      const result = await formatValueUnified("1 mi", options);
      expect(result).toBe("1.60934 km");
    });

    it("should format unit strings according to dimension-level preferences", async () => {
      const options: FormatValueOptions = {
        ...baseOptions,
        propertyMetadata: {
          dimension: "length",
        },
        unitPreferences: {
          ...baseOptions.unitPreferences,
          dimensions: {
            length: "km",
          },
        },
      };

      const result = await formatValueUnified("100 m", options);
      expect(result).toBe("0.1 km");
    });

    it("should format unit strings using schema defaultUnit when no preferences", async () => {
      const options: FormatValueOptions = {
        ...baseOptions,
        propertyMetadata: {
          dimension: "length",
          defaultUnit: "m",
        },
      };

      const result = await formatValueUnified("1 mi", options);
      expect(result).toBe("1609.34 m");
    });

    it("should return original string if not a unit string", async () => {
      const result = await formatValueUnified("some text", baseOptions);
      expect(result).toBe("some text");
    });
  });

  describe("numeric value formatting", () => {
    it("should format numbers when original string is available", async () => {
      const options: FormatValueOptions = {
        ...baseOptions,
        unitPreferences: {
          ...baseOptions.unitPreferences,
          originalStrings: {
            _length_original: "1 mi",
          },
          blockTypes: {
            Pipe: {
              length: "km",
            },
          },
        },
      };

      const result = await formatValueUnified(1, options);
      expect(result).toBe("1.60934 km");
    });

    it("should return number as string when no original string", async () => {
      const result = await formatValueUnified(100, baseOptions);
      expect(result).toBe("100");
    });
  });

  describe("global property formatting", () => {
    it("should format global properties using dimension map", async () => {
      const options: FormatValueOptions = {
        propertyName: "ambientTemperature",
        unitPreferences: {
          ...baseOptions.unitPreferences,
          propertyDimensions: {
            ambientTemperature: "temperature",
          },
          dimensions: {
            temperature: "C",
          },
        },
      };

      const result = await formatValueUnified("20 K", options);
      expect(result).toBe("-253.15 C");
    });
  });

  describe("edge cases", () => {
    it("should handle null values", async () => {
      const result = await formatValueUnified(null, baseOptions);
      expect(result).toBeUndefined();
    });

    it("should handle undefined values", async () => {
      const result = await formatValueUnified(undefined, baseOptions);
      expect(result).toBeUndefined();
    });

    it("should handle invalid unit strings", async () => {
      const result = await formatValueUnified("not a number mi", baseOptions);
      expect(result).toBe("not a number mi");
    });
  });
});
