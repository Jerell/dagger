import { Schema } from "effect";

/**
 * Generic Pipe schema for CO2 transport.
 * 
 * The costing adapter maps this to specific cost library modules based on:
 * - phase: "gas" → GasPipeline, "dense" → DensePhasePipeline
 * - location + size → specific subtype (e.g., "Onshore (Buried) - Medium")
 */
export const PipeSchema = Schema.Struct({
  type: Schema.Literal("Pipe"),
  
  /** CO2 phase: gas phase or dense (supercritical) phase */
  phase: Schema.Literal("gas", "dense").pipe(
    Schema.annotations({
      title: "CO2 phase",
      description: "Gas phase or dense (supercritical) phase",
    })
  ),
  
  /** Pipeline location */
  location: Schema.Literal("onshore", "offshore").pipe(
    Schema.annotations({
      title: "Location",
      description: "Onshore (buried) or offshore (subsea)",
    })
  ),
  
  /** Pipeline size category */
  size: Schema.Literal("small", "medium", "large").pipe(
    Schema.annotations({
      title: "Size",
      description: "Pipeline diameter category",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  length: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "length",
      defaultUnit: "km",
      title: "Pipeline length",
    })
  ),

  /** Number of road/river crossings per 10km (for onshore) */
  crossings_frequency: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({
        title: "Crossing frequency",
        description: "Number of crossings per 10km",
      })
    )
  ),

  /** Compressor duty for gas pipelines (MW) */
  compressor_duty: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Compressor duty",
      })
    )
  ),

  /** Cooling duty for gas pipelines (MW) */
  cooling_duty: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Cooling duty",
      })
    )
  ),

  /** Pump duty for dense phase pipelines (MW) */
  pump_duty: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Pump duty",
      })
    )
  ),
});

export type Pipe = Schema.Schema.Type<typeof PipeSchema>;

/**
 * Map Pipe properties to cost library module type and subtype.
 */
export function mapPipeToModule(pipe: Pipe): { type: string; subtype: string } {
  const type = pipe.phase === "gas" ? "GasPipeline" : "DensePhasePipeline";
  
  const locationStr = pipe.location === "onshore" 
    ? "Onshore (Buried)" 
    : "Offshore (Subsea)";
  
  const sizeStr = pipe.size.charAt(0).toUpperCase() + pipe.size.slice(1);
  
  const subtype = `${locationStr} - ${sizeStr}`;
  
  return { type, subtype };
}
