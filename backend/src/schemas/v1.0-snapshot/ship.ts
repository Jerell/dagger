import { Schema } from "effect";

export const ShipSchema = Schema.Struct({
  type: Schema.Literal("Ship"),
  quantity: Schema.optional(Schema.Number),

  frequency: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "ship-frequency",
      defaultUnit: "ships per day",
      title: "Ship frequency",
    })
  ),
  speed: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "speed",
      defaultUnit: "m/s",
      title: "Speed",
    })
  ),
});

export type Ship = Schema.Schema.Type<typeof ShipSchema>;
