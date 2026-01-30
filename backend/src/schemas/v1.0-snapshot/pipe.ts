import { Schema } from "effect";

export const PipeSchema = Schema.Struct({
  type: Schema.Literal("Pipe"),
  quantity: Schema.optional(Schema.Number),
  length: Schema.Number.pipe(
    Schema.greaterThan(200),
    Schema.annotations({
      dimension: "length",
      defaultUnit: "m",
      title: "Length",
    }),
  ),

  diameter: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "length",
      defaultUnit: "m",
      title: "Diameter",
    }),
  ),
  uValue: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "uValue",
      defaultUnit: "W/m²*K",
      title: "U-Value",
    }),
  ),
  ambientTemperature: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "temperature",
      defaultUnit: "°C",
      title: "Ambient Temperature",
    }),
  ),
});

export type Pipe = Schema.Schema.Type<typeof PipeSchema>;
