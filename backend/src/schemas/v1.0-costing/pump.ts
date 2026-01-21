import { Schema } from "effect";

/**
 * Generic Pump schema for CO2 pumping.
 * 
 * Maps to BoosterPump in cost library.
 */
export const PumpSchema = Schema.Struct({
  type: Schema.Literal("Pump"),
  
  /** Pump type/purpose */
  pump_type: Schema.optional(
    Schema.Literal("booster", "export").pipe(
      Schema.annotations({
        title: "Pump type",
      })
    )
  ),
  
  /** Drive type */
  drive_type: Schema.optional(
    Schema.Literal("electric", "gas").pipe(
      Schema.annotations({
        title: "Drive type",
      })
    )
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factor
  pump_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Pump duty",
    })
  ),
});

export type Pump = Schema.Schema.Type<typeof PumpSchema>;
