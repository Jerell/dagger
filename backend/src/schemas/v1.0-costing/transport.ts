import { Schema } from "effect";

/**
 * Shipping schema for marine CO2 transport.
 */
export const ShippingSchema = Schema.Struct({
  type: Schema.Literal("Shipping"),
  
  /** Pressure class */
  pressure_class: Schema.Literal("ep", "mp", "lp").pipe(
    Schema.annotations({
      title: "Pressure class",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),
  // No scaling factors
});

export type Shipping = Schema.Schema.Type<typeof ShippingSchema>;

/**
 * LandTransport schema for truck/rail transport.
 */
export const LandTransportSchema = Schema.Struct({
  type: Schema.Literal("LandTransport"),
  
  /** Transport mode */
  mode: Schema.Literal("truck", "rail").pipe(
    Schema.annotations({
      title: "Transport mode",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),
  // No scaling factors - rental cost based
});

export type LandTransport = Schema.Schema.Type<typeof LandTransportSchema>;

/**
 * LoadingOffloading schema for loading/offloading facilities.
 */
export const LoadingOffloadingSchema = Schema.Struct({
  type: Schema.Literal("LoadingOffloading"),
  
  /** Facility type */
  facility_type: Schema.Literal("truck", "rail", "jetty").pipe(
    Schema.annotations({
      title: "Facility type",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  /** Number of equipment sets (for jetty) */
  number_of_sets: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.int(),
      Schema.annotations({
        title: "Number of equipment sets",
      })
    )
  ),

  /** Mass of CO2 (for truck loading) */
  mass_co2: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "mass",
        defaultUnit: "kg",
        title: "Mass of CO2",
      })
    )
  ),
});

export type LoadingOffloading = Schema.Schema.Type<typeof LoadingOffloadingSchema>;

/**
 * HeatingAndPumping schema for export heating/pumping.
 */
export const HeatingAndPumpingSchema = Schema.Struct({
  type: Schema.Literal("HeatingAndPumping"),
  
  /** Pressure class */
  pressure_class: Schema.Literal("ep", "mp", "lp").pipe(
    Schema.annotations({
      title: "Pressure class",
    })
  ),
  
  /** Drive type */
  drive_type: Schema.optional(
    Schema.Literal("electric").pipe(
      Schema.annotations({
        title: "Drive type",
      })
    )
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  pump_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Pump duty",
    })
  ),

  heater_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Heater duty",
    })
  ),
});

export type HeatingAndPumping = Schema.Schema.Type<typeof HeatingAndPumpingSchema>;

/**
 * PipeMerge schema for merging pipelines.
 */
export const PipeMergeSchema = Schema.Struct({
  type: Schema.Literal("PipeMerge"),
  
  /** Pipeline phase being merged */
  phase: Schema.Literal("gas", "dense").pipe(
    Schema.annotations({
      title: "Phase",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),
  // No scaling factors
});

export type PipeMerge = Schema.Schema.Type<typeof PipeMergeSchema>;
