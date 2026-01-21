// Static schema registry - imports all schemas from all schema sets
// This provides synchronous access to all schemas without dynamic imports

import { PipeSchema as V10PipeSchema } from "./v1.0/pipe";
import { CompressorSchema as V10CompressorSchema } from "./v1.0/compressor";
import { ShipSchema as V10ShipSchema } from "./v1.0/ship";

// v1.0-costing schemas (generic, operation-agnostic)
import { PipeSchema } from "./v1.0-costing/pipe";
import { CompressorSchema } from "./v1.0-costing/compressor";
import { PumpSchema } from "./v1.0-costing/pump";
import { EmitterSchema } from "./v1.0-costing/emitter";
import { CaptureUnitSchema } from "./v1.0-costing/capture-unit";
import {
  DehydrationSchema,
  RefrigerationSchema,
  MeteringSchema,
} from "./v1.0-costing/conditioning";
import { StorageSchema } from "./v1.0-costing/storage";
import {
  ShippingSchema,
  LandTransportSchema,
  LoadingOffloadingSchema,
  HeatingAndPumpingSchema,
  PipeMergeSchema,
} from "./v1.0-costing/transport";
import {
  InjectionWellSchema,
  InjectionTopsidesSchema,
  UtilisationEndpointSchema,
} from "./v1.0-costing/injection";
import { OffshorePlatformSchema } from "./v1.0-costing/offshore";

// Registry maps: schemaSet -> blockType -> Schema
export const schemaRegistry = {
  "v1.0": {
    Pipe: V10PipeSchema,
    Compressor: V10CompressorSchema,
    Ship: V10ShipSchema,
  },
  "v1.0-costing": {
    // Generic block types - adapter maps to cost library modules
    Pipe: PipeSchema,
    Compressor: CompressorSchema,
    Pump: PumpSchema,
    Emitter: EmitterSchema,
    CaptureUnit: CaptureUnitSchema,
    Dehydration: DehydrationSchema,
    Refrigeration: RefrigerationSchema,
    Metering: MeteringSchema,
    Storage: StorageSchema,
    Shipping: ShippingSchema,
    LandTransport: LandTransportSchema,
    LoadingOffloading: LoadingOffloadingSchema,
    HeatingAndPumping: HeatingAndPumpingSchema,
    PipeMerge: PipeMergeSchema,
    InjectionWell: InjectionWellSchema,
    InjectionTopsides: InjectionTopsidesSchema,
    OffshorePlatform: OffshorePlatformSchema,
    UtilisationEndpoint: UtilisationEndpointSchema,
  },
} as const;

// Type helpers
export type SchemaSet = keyof typeof schemaRegistry;
export type BlockType = keyof typeof schemaRegistry["v1.0"] | keyof typeof schemaRegistry["v1.0-costing"];
