import { z } from "zod";

export const CompressorSchema = z.object({
  type: z.literal("Compressor"),
  quantity: z.number().optional().default(1),

  // Required properties
  pressure: z
    .number()
    .min(0)
    .describe("Outlet pressure")
    .meta({ dimension: "pressure", defaultUnit: "bar" }),

  cost: z
    .number()
    .min(0)
    .describe("Cost of the compressor")
    .meta({ dimension: "cost", defaultUnit: "USD" }),

  // Optional properties
  efficiency: z.number().min(0).max(1).default(0.85).optional(),
});

export type Compressor = z.infer<typeof CompressorSchema>;
