import { Schema } from "effect";

export const PipeSchema = Schema.Struct({
  type: Schema.Literal("Pipe"),
  material: Schema.String.pipe(
    Schema.annotations({
      title: "Material of the pipe",
    })
  ),
  quantity: Schema.optional(Schema.Number),

  // Optional properties
  diameter: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "length",
        defaultUnit: "m",
        title: "Diameter",
      })
    )
  ),
  length: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        dimension: "length",
        defaultUnit: "m",
        title: "Length",
      })
    )
  ),
});

export type Pipe = Schema.Schema.Type<typeof PipeSchema>;

