import { Schema } from "effect";

/**
 * OffshorePlatform schema for offshore infrastructure.
 * 
 * Cost library modules:
 * - FloatingStorageAndInjectionUnit (FISU): Item 037 - "Number of FISU vessels"
 * - DirectInjectionBuoy: Item 038 - "Number of buoys"
 * - OffshorePlatform (floater/jackup): Item 040/041 - "Number of floaters/jackups"
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

  // === Type-specific scaling factors ===
  
  /** Number of FISU vessels (for platform_type = "fisu") */
  number_of_fisu_vessels: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.int(),
      Schema.annotations({
        title: "Number of FISU vessels",
        costParameter: "Number of FISU vessels",
      })
    )
  ),

  /** Number of buoys (for platform_type = "buoy") */
  number_of_buoys: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.int(),
      Schema.annotations({
        title: "Number of buoys",
        costParameter: "Number of buoys",
      })
    )
  ),

  /** Number of floaters (for platform_type = "floater") */
  number_of_floaters: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.int(),
      Schema.annotations({
        title: "Number of floaters",
        costParameter: "Number of floaters",
      })
    )
  ),

  /** Number of jackups (for platform_type = "jackup") */
  number_of_jackups: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.int(),
      Schema.annotations({
        title: "Number of jackups",
        costParameter: "Number of jackups",
      })
    )
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
