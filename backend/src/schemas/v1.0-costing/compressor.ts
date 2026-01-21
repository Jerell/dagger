import { Schema } from "effect";

/**
 * Generic Compressor schema for CO2 compression.
 * 
 * The costing adapter maps this to specific cost library modules based on:
 * - pressure_range: "lp" → LpCompression, "hp" → HpCompression, "booster" → BoosterCompression
 */
export const CompressorSchema = Schema.Struct({
  type: Schema.Literal("Compressor"),
  
  /** Pressure range category */
  pressure_range: Schema.Literal("lp", "hp", "booster").pipe(
    Schema.annotations({
      title: "Pressure range",
      description: "LP (1-40 bar), HP (40-120 bar), or Booster",
    })
  ),
  
  /** Drive type (for module selection) */
  drive_type: Schema.optional(
    Schema.Literal("electric", "gas").pipe(
      Schema.annotations({
        title: "Drive type",
        description: "Electric or gas driven",
      })
    )
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  compressor_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Compressor duty",
    })
  ),

  cooling_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Cooling duty",
    })
  ),
});

export type Compressor = Schema.Schema.Type<typeof CompressorSchema>;

/**
 * Map Compressor properties to cost library module type.
 */
export function mapCompressorToModule(compressor: Compressor): { type: string; subtype: string | null } {
  const typeMap: Record<string, string> = {
    lp: "LpCompression",
    hp: "HpCompression",
    booster: "BoosterCompression",
  };
  
  const type = typeMap[compressor.pressure_range];
  const subtype = compressor.drive_type === "electric" ? "Electric Drive" : null;
  
  return { type, subtype };
}
