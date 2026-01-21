/**
 * Tests for the module lookup service.
 */

import { describe, it, expect, beforeAll } from "bun:test";
import {
  loadCostLibrary,
  listCostLibraries,
  ModuleLookupService,
  buildModuleIndex,
} from "./module-lookup";
import {
  normalizeBlockType,
  normalizeBlockTypeWithOverrides,
  denormalizeBlockType,
} from "./type-normalization";
import type { CostLibrary } from "./types";

describe("type-normalization", () => {
  describe("normalizeBlockType", () => {
    it("converts space-separated words to PascalCase", () => {
      expect(normalizeBlockType("Capture Unit")).toBe("CaptureUnit");
      expect(normalizeBlockType("capture unit")).toBe("CaptureUnit");
      expect(normalizeBlockType("CAPTURE UNIT")).toBe("CaptureUnit");
    });

    it("converts underscore-separated words to PascalCase", () => {
      expect(normalizeBlockType("capture_unit")).toBe("CaptureUnit");
      expect(normalizeBlockType("CAPTURE_UNIT")).toBe("CaptureUnit");
    });

    it("handles single words", () => {
      expect(normalizeBlockType("Pipe")).toBe("Pipe");
      expect(normalizeBlockType("pipe")).toBe("Pipe");
      expect(normalizeBlockType("PIPE")).toBe("Pipe");
    });

    it("handles multi-word types", () => {
      expect(normalizeBlockType("LP Compression")).toBe("LpCompression");
      expect(normalizeBlockType("Direct Air Capture")).toBe("DirectAirCapture");
    });
  });

  describe("denormalizeBlockType", () => {
    it("converts PascalCase to space-separated words", () => {
      expect(denormalizeBlockType("CaptureUnit")).toBe("Capture Unit");
      expect(denormalizeBlockType("DirectAirCapture")).toBe("Direct Air Capture");
    });

    it("handles single words", () => {
      expect(denormalizeBlockType("Pipe")).toBe("Pipe");
    });
  });
});

describe("loadCostLibrary", () => {
  it("loads V1.1_working library", async () => {
    const library = await loadCostLibrary("V1.1_working");
    expect(library).toBeDefined();
    expect(library.modules).toBeInstanceOf(Array);
    expect(library.modules.length).toBeGreaterThan(0);
  });

  it("throws for non-existent library", async () => {
    await expect(loadCostLibrary("nonexistent")).rejects.toThrow();
  });
});

describe("listCostLibraries", () => {
  it("lists available libraries", async () => {
    const libraries = await listCostLibraries();
    expect(libraries).toContain("V1.1_working");
    expect(libraries).toContain("V1.3");
    expect(libraries).toContain("V2.0");
  });
});

describe("ModuleLookupService", () => {
  let library: CostLibrary;
  let service: ModuleLookupService;

  beforeAll(async () => {
    library = await loadCostLibrary("V1.1_working");
    service = new ModuleLookupService(library);
  });

  describe("lookup", () => {
    it("finds CaptureUnit/Amine module", () => {
      // Using normalized type
      const module = service.lookup("CaptureUnit", "Amine");
      expect(module).toBeDefined();
      expect(module?.id).toBe("M0201");
      expect(module?.type).toBe("CaptureUnit");
      expect(module?.subtype).toBe("Amine");
    });

    it("finds module using user-friendly type", () => {
      // Using space-separated type (as users would write)
      const module = service.lookup("Capture Unit", "Amine");
      expect(module).toBeDefined();
      expect(module?.id).toBe("M0201");
    });

    it("finds Emitter/Cement module", () => {
      const module = service.lookup("Emitter", "Cement");
      expect(module).toBeDefined();
      expect(module?.id).toBe("M0101");
    });

    it("returns undefined for unknown type", () => {
      const module = service.lookup("UnknownType", "Something");
      expect(module).toBeUndefined();
    });

    it("returns undefined for unknown subtype", () => {
      const module = service.lookup("CaptureUnit", "UnknownSubtype");
      expect(module).toBeUndefined();
    });

    it("returns undefined when subtype required but not provided", () => {
      // CaptureUnit has multiple subtypes, so subtype is required
      const module = service.lookup("CaptureUnit");
      expect(module).toBeUndefined();
    });
  });

  describe("listTypes", () => {
    it("returns all unique types", () => {
      const types = service.listTypes();
      expect(types).toContain("CaptureUnit");
      expect(types).toContain("Emitter");
    });
  });

  describe("listSubtypes", () => {
    it("returns subtypes for CaptureUnit", () => {
      const subtypes = service.listSubtypes("CaptureUnit");
      expect(subtypes).toContain("Amine");
      expect(subtypes).toContain("Inorganic solvents");
    });

    it("returns subtypes for user-friendly type", () => {
      const subtypes = service.listSubtypes("Capture Unit");
      expect(subtypes).toContain("Amine");
    });

    it("returns empty array for unknown type", () => {
      const subtypes = service.listSubtypes("UnknownType");
      expect(subtypes).toEqual([]);
    });
  });

  describe("findByType", () => {
    it("returns all modules for a type", () => {
      const modules = service.findByType("CaptureUnit");
      expect(modules.length).toBeGreaterThan(1);
      expect(modules.every(m => m.type === "CaptureUnit")).toBe(true);
    });
  });

  describe("getById", () => {
    it("returns module by ID", () => {
      const module = service.getById("M0201");
      expect(module).toBeDefined();
      expect(module?.type).toBe("CaptureUnit");
      expect(module?.subtype).toBe("Amine");
    });

    it("returns undefined for unknown ID", () => {
      const module = service.getById("M9999");
      expect(module).toBeUndefined();
    });
  });

  describe("requiredParameters", () => {
    it("extracts required parameters from module", () => {
      const module = service.lookup("CaptureUnit", "Amine");
      expect(module?.requiredParameters).toBeDefined();
      expect(module?.requiredParameters.length).toBeGreaterThan(0);
      
      // Check for expected parameter
      const massFlowParam = module?.requiredParameters.find(
        p => p.name === "Mass flow"
      );
      expect(massFlowParam).toBeDefined();
      expect(massFlowParam?.units).toBe("kg/h");
    });
  });
});
