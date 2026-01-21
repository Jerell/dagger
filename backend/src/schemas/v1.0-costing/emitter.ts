import { Schema } from "effect";

/**
 * Emitter schema for CO2 emission sources.
 * 
 * The emitter_type maps to cost library subtypes.
 */
export const EmitterSchema = Schema.Struct({
  type: Schema.Literal("Emitter"),
  
  /** Type of emission source */
  emitter_type: Schema.Literal(
    "cement",
    "steel",
    "ammonia",
    "gas_power",
    "coal_power",
    "refinery",
    "waste_to_energy",
    "dac"
  ).pipe(
    Schema.annotations({
      title: "Emitter type",
      description: "Type of CO2 emission source",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),
  
  // No scaling factors - cost based on type
});

export type Emitter = Schema.Schema.Type<typeof EmitterSchema>;

/**
 * Map emitter type to cost library subtype.
 */
export function mapEmitterToSubtype(emitterType: string): string {
  const map: Record<string, string> = {
    cement: "Cement",
    steel: "Steel",
    ammonia: "Ammonia",
    gas_power: "Gas power gen (post combustion)",
    coal_power: "Coal power gen (post combustion)",
    refinery: "Refinery -> 99%",
    waste_to_energy: "Waste to energy",
    dac: "Direct Air Capture (DAC)",
  };
  return map[emitterType] ?? emitterType;
}
