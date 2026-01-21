import { Schema } from "effect";

/**
 * Storage schema for interim CO2 storage.
 */
export const StorageSchema = Schema.Struct({
  type: Schema.Literal("Storage"),
  
  /** Pressure class */
  pressure_class: Schema.Literal("ep", "mp", "lp").pipe(
    Schema.annotations({
      title: "Pressure class",
      description: "Elevated (EP), Medium (MP), or Low (LP) pressure",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  storage_capacity: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "volume",
      defaultUnit: "m3",
      title: "Storage capacity",
    })
  ),

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

export type Storage = Schema.Schema.Type<typeof StorageSchema>;
