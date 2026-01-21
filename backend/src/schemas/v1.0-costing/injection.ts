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
 * 
 * Cost library modules:
 * - PlatformFsiuInjection (offshore): Item 028 (Pump) + Item 006 (Heater)
 * - OnshoreInjection: Item 028 (Pump) + Item 006 (Heater)
 * 
 * Note: Cost library has typo "Pump moter rating" (not "motor")
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

  // === Scaling factors for Item 028 (Pump) ===
  
  /** Pump motor rating - scales pump (Item 028) */
  pump_motor_rating: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Pump motor rating",
        costItem: "Item 028",
        costParameter: "Pump moter rating", // typo in cost library
      })
    )
  ),

  /** Pump volumetric flowrate - scales pump (Item 028) */
  pump_flowrate: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "volumetric_flow_rate",
        defaultUnit: "m3/h",
        title: "Pump flowrate (volumetric)",
        costItem: "Item 028",
        costParameter: "Pump flowrate (volumetric)",
      })
    )
  ),

  // === Scaling factors for Item 006 (Heater) ===
  
  /** Heater duty - scales heater (Item 006) */
  heater_duty: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "MW",
        title: "Heater duty",
        costItem: "Item 006",
        costParameter: "Heater Duty",
      })
    )
  ),

  // === Variable OPEX - electrical power per item ===
  
  /** Electrical power for pump (Item 028) */
  electrical_power_pump: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Pump electrical power",
        costItem: "Item 028",
        costParameter: "Electrical power",
      })
    )
  ),

  /** Electrical power for heater (Item 006) */
  electrical_power_heater: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Heater electrical power",
        costItem: "Item 006",
        costParameter: "Electrical power",
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
