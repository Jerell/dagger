import { Schema } from "effect";

export const ReservoirSchema = Schema.Struct({
  type: Schema.Literal("Reservoir"),
  quantity: Schema.optional(Schema.Number),

  pressure: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "pressure",
      defaultUnit: "bar",
      title: "Pressure",
    }),
  ),
});

export type Reservoir = Schema.Schema.Type<typeof ReservoirSchema>;
