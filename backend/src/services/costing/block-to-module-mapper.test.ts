import { describe, it, expect } from "bun:test";
import { mapBlockToModule } from "./block-to-module-mapper";

describe("block-to-module-mapper", () => {
  describe("mapBlockToModule", () => {
    describe("Pipe", () => {
      it("maps gas phase onshore medium pipe to GasPipeline", () => {
        const result = mapBlockToModule({
          type: "Pipe",
          phase: "gas",
          location: "onshore",
          size: "medium",
        });
        
        expect(result).toEqual({
          moduleType: "GasPipeline",
          subtype: "Onshore (Buried) - Medium",
        });
      });

      it("maps dense phase offshore large pipe to DensePhasePipeline", () => {
        const result = mapBlockToModule({
          type: "Pipe",
          phase: "dense",
          location: "offshore",
          size: "large",
        });
        
        expect(result).toEqual({
          moduleType: "DensePhasePipeline",
          subtype: "Offshore (Subsea) - Large",
        });
      });
    });

    describe("Compressor", () => {
      it("maps lp compressor to LpCompression", () => {
        const result = mapBlockToModule({
          type: "Compressor",
          pressure_range: "lp",
        });
        
        expect(result?.moduleType).toBe("LpCompression");
      });

      it("maps hp compressor to HpCompression", () => {
        const result = mapBlockToModule({
          type: "Compressor",
          pressure_range: "hp",
        });
        
        expect(result?.moduleType).toBe("HpCompression");
      });

      it("maps booster compressor to BoosterCompression", () => {
        const result = mapBlockToModule({
          type: "Compressor",
          pressure_range: "booster",
        });
        
        expect(result?.moduleType).toBe("BoosterCompression");
      });

      it("includes Electric Drive subtype when drive_type is electric", () => {
        const result = mapBlockToModule({
          type: "Compressor",
          pressure_range: "lp",
          drive_type: "electric",
        });
        
        expect(result?.subtype).toBe("Electric Drive");
      });
    });

    describe("Emitter", () => {
      it("maps cement emitter", () => {
        const result = mapBlockToModule({
          type: "Emitter",
          emitter_type: "cement",
        });
        
        expect(result).toEqual({
          moduleType: "Emitter",
          subtype: "Cement",
        });
      });

      it("maps DAC emitter", () => {
        const result = mapBlockToModule({
          type: "Emitter",
          emitter_type: "dac",
        });
        
        expect(result).toEqual({
          moduleType: "Emitter",
          subtype: "Direct Air Capture (DAC)",
        });
      });
    });

    describe("CaptureUnit", () => {
      it("maps amine capture technology", () => {
        const result = mapBlockToModule({
          type: "CaptureUnit",
          capture_technology: "amine",
        });
        
        expect(result).toEqual({
          moduleType: "CaptureUnit",
          subtype: "Amine",
        });
      });

      it("maps membrane capture technology", () => {
        const result = mapBlockToModule({
          type: "CaptureUnit",
          capture_technology: "membrane",
        });
        
        expect(result).toEqual({
          moduleType: "CaptureUnit",
          subtype: "Membrane",
        });
      });
    });

    describe("Refrigeration", () => {
      it("maps EP water cooling refrigeration", () => {
        const result = mapBlockToModule({
          type: "Refrigeration",
          pressure_class: "ep",
          cooling_method: "water",
        });
        
        expect(result).toEqual({
          moduleType: "Refrigeration",
          subtype: "EP - Water Cooling + trim refrig",
        });
      });

      it("maps LP ammonia refrigeration", () => {
        const result = mapBlockToModule({
          type: "Refrigeration",
          pressure_class: "lp",
          cooling_method: "ammonia",
        });
        
        expect(result).toEqual({
          moduleType: "Refrigeration",
          subtype: "LP - Refrigerant - Ammonia",
        });
      });
    });

    describe("Storage", () => {
      it("maps EP storage to InterimStorage", () => {
        const result = mapBlockToModule({
          type: "Storage",
          pressure_class: "ep",
        });
        
        expect(result).toEqual({
          moduleType: "InterimStorage",
          subtype: "EP",
        });
      });
    });

    describe("InjectionWell", () => {
      it("maps onshore injection well", () => {
        const result = mapBlockToModule({
          type: "InjectionWell",
          location: "onshore",
        });
        
        expect(result?.moduleType).toBe("OnshoreInjectionWell");
      });

      it("maps offshore injection well", () => {
        const result = mapBlockToModule({
          type: "InjectionWell",
          location: "offshore",
        });
        
        expect(result?.moduleType).toBe("OffshoreInjectionWell");
      });
    });

    describe("OffshorePlatform", () => {
      it("maps FISU platform", () => {
        const result = mapBlockToModule({
          type: "OffshorePlatform",
          platform_type: "fisu",
        });
        
        expect(result?.moduleType).toBe("FloatingStorageAndInjectionUnit");
      });

      it("maps direct injection buoy", () => {
        const result = mapBlockToModule({
          type: "OffshorePlatform",
          platform_type: "buoy",
        });
        
        expect(result?.moduleType).toBe("DirectInjectionBuoy");
      });
    });

    describe("PipeMerge", () => {
      it("maps gas phase merge", () => {
        const result = mapBlockToModule({
          type: "PipeMerge",
          phase: "gas",
        });
        
        expect(result?.moduleType).toBe("MergingGasPipeline");
      });

      it("maps dense phase merge", () => {
        const result = mapBlockToModule({
          type: "PipeMerge",
          phase: "dense",
        });
        
        expect(result?.moduleType).toBe("MergingDensePhase");
      });
    });

    describe("unknown block type", () => {
      it("returns null for unknown block type", () => {
        const result = mapBlockToModule({
          type: "UnknownType",
        });
        
        expect(result).toBeNull();
      });
    });
  });
});
