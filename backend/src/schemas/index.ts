// Static schema registry - imports all schemas from all schema sets
// This provides synchronous access to all schemas without dynamic imports

import { PipeSchema as V10PipeSchema } from "./v1.0/pipe";
import { CompressorSchema as V10CompressorSchema } from "./v1.0/compressor";
import { PipeSchema as V10CostingPipeSchema } from "./v1.0-costing/pipe";
import { CompressorSchema as V10CostingCompressorSchema } from "./v1.0-costing/compressor";
import { ShipSchema as V10ShipSchema } from "./v1.0/ship";

// Registry maps: schemaSet -> blockType -> Schema
export const schemaRegistry = {
  "v1.0": {
    Pipe: V10PipeSchema,
    Compressor: V10CompressorSchema,
    Ship: V10ShipSchema,
  },
  "v1.0-costing": {
    Pipe: V10CostingPipeSchema,
    Compressor: V10CostingCompressorSchema,
  },
} as const;

// Type helpers
export type SchemaSet = keyof typeof schemaRegistry;
export type BlockType = "Pipe" | "Compressor"; // Expand as needed
