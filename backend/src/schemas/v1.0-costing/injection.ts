import { Schema } from "effect";

/**
 * InjectionWell schema for CO2 injection wells.
 */
export const InjectionWellSchema = Schema.Struct({
  type: Schema.Literal("InjectionWell"),
  
  /** Well location */
  location: Schema.Literal("onshore", "offshore").pipe(
    Schema.annotations({
      title: "Location",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  number_of_wells: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.int(),
    Schema.annotations({
      title: "Number of wells",
    })
  ),

  /** Well depth (required for onshore) */
  well_depth: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "length",
        defaultUnit: "m",
        title: "Well depth",
      })
    )
  ),
});

export type InjectionWell = Schema.Schema.Type<typeof InjectionWellSchema>;

/**
 * InjectionTopsides schema for surface injection facilities.
 */
export const InjectionTopsidesSchema = Schema.Struct({
  type: Schema.Literal("InjectionTopsides"),
  
  /** Location */
  location: Schema.Literal("onshore", "offshore").pipe(
    Schema.annotations({
      title: "Location",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  pump_motor_rating: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "kW",
      title: "Pump motor rating",
    })
  ),

  pump_flowrate: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "volumetric_flow_rate",
      defaultUnit: "m3/h",
      title: "Pump flowrate",
    })
  ),

  heater_duty: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Heater duty",
      })
    )
  ),
});

export type InjectionTopsides = Schema.Schema.Type<typeof InjectionTopsidesSchema>;

/**
 * UtilisationEndpoint schema for CO2 utilisation.
 */
export const UtilisationEndpointSchema = Schema.Struct({
  type: Schema.Literal("UtilisationEndpoint"),
  quantity: Schema.optional(Schema.Number),
  // No scaling factors
});

export type UtilisationEndpoint = Schema.Schema.Type<typeof UtilisationEndpointSchema>;
