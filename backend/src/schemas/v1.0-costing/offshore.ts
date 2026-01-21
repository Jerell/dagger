import { Schema } from "effect";

/**
 * OffshorePlatform schema for offshore infrastructure.
 */
export const OffshorePlatformSchema = Schema.Struct({
  type: Schema.Literal("OffshorePlatform"),
  
  /** Platform type */
  platform_type: Schema.Literal("fisu", "buoy", "floater", "jackup").pipe(
    Schema.annotations({
      title: "Platform type",
      description: "FISU, Direct injection buoy, Floater, or Jackup",
    })
  ),
  
  quantity: Schema.optional(Schema.Number),

  /** Number of units (for applicable types) */
  number_of_units: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.int(),
    Schema.annotations({
      title: "Number of units",
    })
  ),
});

export type OffshorePlatform = Schema.Schema.Type<typeof OffshorePlatformSchema>;

/**
 * Map platform type to cost library module type.
 */
export function mapPlatformToModule(platformType: string): string {
  const map: Record<string, string> = {
    fisu: "FloatingStorageAndInjectionUnit",
    buoy: "DirectInjectionBuoy",
    floater: "OffshorePlatform",
    jackup: "OffshorePlatform",
  };
  return map[platformType] ?? platformType;
}
