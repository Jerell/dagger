/**
 * v1.0-costing schema index
 * 
 * Generic, operation-agnostic block schemas.
 * The costing adapter maps these to specific cost library modules based on properties.
 */

// Pipe (maps to GasPipeline or DensePhasePipeline based on phase)
export { PipeSchema, type Pipe, mapPipeToModule } from "./pipe";

// Compressor (maps to LpCompression, HpCompression, or BoosterCompression based on pressure_range)
export { CompressorSchema, type Compressor, mapCompressorToModule } from "./compressor";

// Pump
export { PumpSchema, type Pump } from "./pump";

// Emitter
export { EmitterSchema, type Emitter, mapEmitterToSubtype } from "./emitter";

// Capture
export { CaptureUnitSchema, type CaptureUnit, mapCaptureToSubtype } from "./capture-unit";

// Conditioning (Dehydration, Refrigeration, Metering)
export {
  DehydrationSchema, type Dehydration,
  RefrigerationSchema, type Refrigeration, mapRefrigerationToSubtype,
  MeteringSchema, type Metering,
} from "./conditioning";

// Storage
export { StorageSchema, type Storage } from "./storage";

// Transport
export {
  ShippingSchema, type Shipping,
  LandTransportSchema, type LandTransport,
  LoadingOffloadingSchema, type LoadingOffloading,
  HeatingAndPumpingSchema, type HeatingAndPumping,
  PipeMergeSchema, type PipeMerge,
} from "./transport";

// Injection
export {
  InjectionWellSchema, type InjectionWell,
  InjectionTopsidesSchema, type InjectionTopsides,
  UtilisationEndpointSchema, type UtilisationEndpoint,
} from "./injection";

// Offshore
export {
  OffshorePlatformSchema, type OffshorePlatform, mapPlatformToModule,
} from "./offshore";
