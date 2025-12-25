import { z } from "zod";

export const PipeSchema = z.object({
  type: z.literal("Pipe"),
  material: z.string().describe("Material of the pipe"),
  quantity: z.number().optional().default(1),

  // Optional properties
  diameter: z
    .number()
    .min(0)
    .optional()
    .meta({ dimension: "length", defaultUnit: "m" }),
  length: z
    .number()
    .min(0)
    .optional()
    .meta({ dimension: "length", defaultUnit: "m" }),
});

export type Pipe = z.infer<typeof PipeSchema>;
