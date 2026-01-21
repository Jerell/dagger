import { Schema } from "effect";

/**
 * CaptureUnit schema for CO2 capture.
 * 
 * The capture_technology maps directly to cost library subtypes.
 * 
 * All dimensional values should be strings with units, e.g., "100 t/h"
 */
export const CaptureUnitSchema = Schema.Struct({
  type: Schema.Literal("CaptureUnit"),
  
  /** Capture technology */
  capture_technology: Schema.Literal(
    "amine",
    "inorganic_solvents",
    "cryogenic",
    "psa_tsa",
    "membrane"
  ).pipe(
    Schema.annotations({
      title: "Capture technology",
      description: "CO2 capture technology type",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factor
  mass_flow: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "mass_flow_rate",
        defaultUnit: "t/h",
        title: "Mass flow",
        costParameter: "Mass flow",
      })
    )
  ),
});

export type CaptureUnit = Schema.Schema.Type<typeof CaptureUnitSchema>;

/**
 * Map capture technology to cost library subtype.
 */
export function mapCaptureToSubtype(tech: string): string {
  const map: Record<string, string> = {
    amine: "Amine",
    inorganic_solvents: "Inorganic solvents",
    cryogenic: "Cryogenic (to 100% CO2)",
    psa_tsa: "PSA/TSA",
    membrane: "Membrane",
  };
  return map[tech] ?? tech;
}
