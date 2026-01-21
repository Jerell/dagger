import { Schema } from "effect";

/**
 * Dehydration schema for removing water from CO2 stream.
 */
export const DehydrationSchema = Schema.Struct({
  type: Schema.Literal("Dehydration"),
  
  /** Dehydration technology */
  dehydration_type: Schema.Literal("molecular_sieve", "glycol").pipe(
    Schema.annotations({
      title: "Dehydration type",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factor
  mass_flow_co2: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "mass_flow_rate",
      defaultUnit: "MTPA",
      title: "Mass flow CO2",
    })
  ),

  heat_duty: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "power",
        defaultUnit: "kW",
        title: "Heat duty",
      })
    )
  ),
});

export type Dehydration = Schema.Schema.Type<typeof DehydrationSchema>;

/**
 * Refrigeration schema for cooling CO2.
 */
export const RefrigerationSchema = Schema.Struct({
  type: Schema.Literal("Refrigeration"),
  
  /** Pressure class */
  pressure_class: Schema.Literal("ep", "mp", "lp").pipe(
    Schema.annotations({
      title: "Pressure class",
      description: "Elevated (EP), Medium (MP), or Low (LP) pressure",
    })
  ),
  
  /** Cooling method */
  cooling_method: Schema.Literal("water", "air", "ammonia").pipe(
    Schema.annotations({
      title: "Cooling method",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factors
  heat_duty: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "power",
      defaultUnit: "MW",
      title: "Heat duty",
    })
  ),

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
});

export type Refrigeration = Schema.Schema.Type<typeof RefrigerationSchema>;

/**
 * Map refrigeration properties to cost library subtype.
 */
export function mapRefrigerationToSubtype(
  pressureClass: string,
  coolingMethod: string
): string {
  const pressureMap: Record<string, string> = {
    ep: "EP",
    mp: "MP",
    lp: "LP",
  };
  
  const methodMap: Record<string, string> = {
    water: "Water Cooling + trim refrig",
    air: "Air Cooling + trim refrig",
    ammonia: "Refrigerant - Ammonia",
  };
  
  return `${pressureMap[pressureClass]} - ${methodMap[coolingMethod]}`;
}

/**
 * Metering schema for flow measurement.
 */
export const MeteringSchema = Schema.Struct({
  type: Schema.Literal("Metering"),
  
  /** Metering type */
  metering_type: Schema.Literal("fiscal_36", "fiscal_24", "fiscal_14", "compositional").pipe(
    Schema.annotations({
      title: "Metering type",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  // Scaling factor
  number_of_systems: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.int(),
    Schema.annotations({
      title: "Number of systems",
    })
  ),
});

export type Metering = Schema.Schema.Type<typeof MeteringSchema>;
