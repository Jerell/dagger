import { z } from "zod";

export const CompressorSchema = z.object({
  type: z.literal("Compressor"),
  quantity: z.number().optional().default(1),

  // Required properties
  pressure: z.number().min(0).describe("Operating pressure in PSI"),

  // Optional properties
  efficiency: z.number().min(0).max(1).default(0.85).optional(),
});

export type Compressor = z.infer<typeof CompressorSchema>;
