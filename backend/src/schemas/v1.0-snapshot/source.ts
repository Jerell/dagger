import { Schema } from "effect";

const fractionSchema = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
);

const FluidCompositionSchema = Schema.Struct({
  carbonDioxideFraction: Schema.optional(fractionSchema),
  nitrogenFraction: Schema.optional(fractionSchema),
  waterFraction: Schema.optional(fractionSchema),
  hydrogenSulfideFraction: Schema.optional(fractionSchema),
  carbonMonoxideFraction: Schema.optional(fractionSchema),
  argonFraction: Schema.optional(fractionSchema),
  methaneFraction: Schema.optional(fractionSchema),
  hydrogenFraction: Schema.optional(fractionSchema),
  oxygenFraction: Schema.optional(fractionSchema),
}).pipe(
  Schema.annotations({
    title: "Fluid composition",
    description: "Component mole fractions for the source fluid.",
  }),
);

export const SourceSchema = Schema.Struct({
  type: Schema.Literal("Source"),
  quantity: Schema.optional(Schema.Number),

  flowrate: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "massFlowrate",
      defaultUnit: "mtpa",
      title: "Flowrate",
    }),
  ),

  fluidComposition: Schema.optional(FluidCompositionSchema),

  pressure: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "pressure",
      defaultUnit: "bar",
      title: "Pressure",
    }),
  ),

  temperature: Schema.Number.pipe(
    Schema.annotations({
      dimension: "temperature",
      defaultUnit: "°C",
      title: "Temperature",
    }),
  ),
});

export type Source = Schema.Schema.Type<typeof SourceSchema>;
