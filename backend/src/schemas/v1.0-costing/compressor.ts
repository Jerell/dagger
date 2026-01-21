import { Schema } from "effect";

/**
 * Generic Compressor schema for CO2 compression.
 * 
 * The costing adapter maps this to specific cost library modules based on:
 * - pressure_range: "lp" → LpCompression, "hp" → HpCompression, "booster" → BoosterCompression
 * 
 * Cost library modules have multiple cost items (components):
 * - LP/HP Compression: Compressor (Item 007) + After-cooler (Item 008)
 * - Each component can have its own electrical power requirement
 * 
 * All dimensional values should be strings with units, e.g., "100 MW"
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

  // === Scaling factors ===
  
  /** Compressor duty - scales the compressor component (Item 007) */
  compressor_duty: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Compressor duty",
        description: "Mechanical power required by the compressor",
        costItem: "Item 007",
        costParameter: "Compressor Duty",
      })
    )
  ),

  /** Cooling duty - scales the after-cooler component (Item 008) */
  cooling_duty: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Cooling duty",
        description: "Heat duty of the after-cooler",
        costItem: "Item 008",
        costParameter: "Cooling duty",
      })
    )
  ),

  // === Variable OPEX parameters ===
  
  /** Electrical power for the compressor motor (Item 007) */
  electrical_power_compressor: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Compressor electrical power",
        description: "Electrical power consumption of the compressor motor",
        costItem: "Item 007",
        costParameter: "Electrical power",
      })
    )
  ),

  /** Electrical power for the after-cooler fans (Item 008) */
  electrical_power_cooler: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Cooler electrical power",
        description: "Electrical power consumption of the after-cooler fans",
        costItem: "Item 008",
        costParameter: "Electrical power",
      })
    )
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
