import { Schema } from "effect";

export const CompressorSchema = Schema.Struct({
  type: Schema.Literal("Compressor"),
  quantity: Schema.optional(Schema.Number),

  // Required properties
  pressure: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "pressure",
      defaultUnit: "bar",
      title: "Outlet pressure",
    })
  ),

  // Optional properties
  efficiency: Schema.optional(
    Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(1))
  ),
});

export type Compressor = Schema.Schema.Type<typeof CompressorSchema>;
