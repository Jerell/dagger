/**
 * Maps generic Dagger block types to cost library module types and subtypes.
 *
 * This is the bridge between operation-agnostic Dagger blocks and
 * operation-specific cost library modules.
 */

import type { NetworkBlock } from "./request-types";

// ============================================================================
// Types
// ============================================================================

export type ModuleMapping = {
  /** Cost library module type (e.g., "GasPipeline") */
  moduleType: string;
  /** Cost library subtype (e.g., "Onshore (Buried) - Medium") */
  subtype: string | null;
};

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map a Dagger block to a cost library module type and subtype.
 * Returns null if the block type is unknown or missing required properties.
 */
export function mapBlockToModule(block: NetworkBlock): ModuleMapping | null {
  const mappers: Record<string, (block: NetworkBlock) => ModuleMapping | null> = {
    Pipe: mapPipe,
    Compressor: mapCompressor,
    Pump: mapPump,
    Emitter: mapEmitter,
    CaptureUnit: mapCaptureUnit,
    Dehydration: mapDehydration,
    Refrigeration: mapRefrigeration,
    Metering: mapMetering,
    Storage: mapStorage,
    Shipping: mapShipping,
    LandTransport: mapLandTransport,
    LoadingOffloading: mapLoadingOffloading,
    HeatingAndPumping: mapHeatingAndPumping,
    PipeMerge: mapPipeMerge,
    InjectionWell: mapInjectionWell,
    InjectionTopsides: mapInjectionTopsides,
    OffshorePlatform: mapOffshorePlatform,
    UtilisationEndpoint: () => ({ moduleType: "UtilisationEndpoint", subtype: null }),
  };

  const mapper = mappers[block.type];
  if (!mapper) {
    return null;
  }

  return mapper(block);
}

// ============================================================================
// Individual Mappers
// ============================================================================

function mapPipe(block: NetworkBlock): ModuleMapping | null {
  const phase = block.phase as string | undefined;
  const location = block.location as string | undefined;
  const size = block.size as string | undefined;

  if (!phase || !location || !size) {
    return null;
  }

  const moduleType = phase === "gas" ? "GasPipeline" : "DensePhasePipeline";
  const locationStr = location === "onshore" ? "Onshore (Buried)" : "Offshore (Subsea)";
  const sizeStr = size.charAt(0).toUpperCase() + size.slice(1);
  const subtype = `${locationStr} - ${sizeStr}`;

  return { moduleType, subtype };
}

function mapCompressor(block: NetworkBlock): ModuleMapping | null {
  const pressureRange = block.pressure_range as string | undefined;

  if (!pressureRange) {
    return null;
  }

  const typeMap: Record<string, string> = {
    lp: "LpCompression",
    hp: "HpCompression",
    booster: "BoosterCompression",
  };

  const moduleType = typeMap[pressureRange] ?? "LpCompression";
  const subtype = block.drive_type === "electric" ? "Electric Drive" : null;

  return { moduleType, subtype };
}

function mapPump(block: NetworkBlock): ModuleMapping {
  const subtype = block.drive_type === "electric" ? "Electric drive" : null;
  return { moduleType: "BoosterPump", subtype };
}

function mapEmitter(block: NetworkBlock): ModuleMapping | null {
  const emitterType = block.emitter_type as string | undefined;

  if (!emitterType) {
    return null;
  }

  const subtypeMap: Record<string, string> = {
    cement: "Cement",
    steel: "Steel",
    ammonia: "Ammonia",
    gas_power: "Gas power gen (post combustion)",
    coal_power: "Coal power gen (post combustion)",
    refinery: "Refinery -> 99%",
    waste_to_energy: "Waste to energy",
    dac: "Direct Air Capture (DAC)",
  };

  return { moduleType: "Emitter", subtype: subtypeMap[emitterType] ?? emitterType };
}

function mapCaptureUnit(block: NetworkBlock): ModuleMapping | null {
  const tech = block.capture_technology as string | undefined;

  if (!tech) {
    return null;
  }

  const subtypeMap: Record<string, string> = {
    amine: "Amine",
    inorganic_solvents: "Inorganic solvents",
    cryogenic: "Cryogenic (to 100% CO2)",
    psa_tsa: "PSA/TSA",
    membrane: "Membrane",
  };

  return { moduleType: "CaptureUnit", subtype: subtypeMap[tech] ?? tech };
}

function mapDehydration(block: NetworkBlock): ModuleMapping | null {
  const dehydrationType = block.dehydration_type as string | undefined;

  if (!dehydrationType) {
    return null;
  }

  const subtypeMap: Record<string, string> = {
    molecular_sieve: "Molecular Sieve",
    glycol: "Glycol (TEG)",
  };

  return { moduleType: "Dehydration", subtype: subtypeMap[dehydrationType] ?? dehydrationType };
}

function mapRefrigeration(block: NetworkBlock): ModuleMapping | null {
  const pressureClass = block.pressure_class as string | undefined;
  const coolingMethod = block.cooling_method as string | undefined;

  if (!pressureClass || !coolingMethod) {
    return null;
  }

  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  const methodMap: Record<string, string> = {
    water: "Water Cooling + trim refrig",
    air: "Air Cooling + trim refrig",
    ammonia: "Refrigerant - Ammonia",
  };

  const subtype = `${pressureMap[pressureClass]} - ${methodMap[coolingMethod]}`;
  return { moduleType: "Refrigeration", subtype };
}

function mapMetering(block: NetworkBlock): ModuleMapping | null {
  const meteringType = block.metering_type as string | undefined;

  if (!meteringType) {
    return null;
  }

  const subtypeMap: Record<string, string> = {
    fiscal_36: 'Fiscal (CO2 flowrate) - 36"',
    fiscal_24: 'Fiscal (CO2 flowrate) - 24"',
    fiscal_14: 'Fiscal (CO2 flowrate) - 14"',
    compositional: "Compositional quality analysis",
  };

  return { moduleType: "Metering", subtype: subtypeMap[meteringType] ?? meteringType };
}

function mapStorage(block: NetworkBlock): ModuleMapping | null {
  const pressureClass = block.pressure_class as string | undefined;

  if (!pressureClass) {
    return null;
  }

  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  return { moduleType: "InterimStorage", subtype: pressureMap[pressureClass] };
}

function mapShipping(block: NetworkBlock): ModuleMapping | null {
  const pressureClass = block.pressure_class as string | undefined;

  if (!pressureClass) {
    return null;
  }

  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  return { moduleType: "Shipping", subtype: pressureMap[pressureClass] };
}

function mapLandTransport(block: NetworkBlock): ModuleMapping | null {
  const mode = block.mode as string | undefined;

  if (!mode) {
    return null;
  }

  if (mode === "truck") {
    return { moduleType: "RoadTanker", subtype: "Rental Liquefied Tanker Truck" };
  } else {
    return { moduleType: "Rail", subtype: "Rental Liquefied Railcar" };
  }
}

function mapLoadingOffloading(block: NetworkBlock): ModuleMapping | null {
  const facilityType = block.facility_type as string | undefined;

  if (!facilityType) {
    return null;
  }

  const typeMap: Record<string, string> = {
    truck: "TruckLoadingOffloading",
    rail: "RailLoadingOffloading",
    jetty: "JettyLoadingArms",
  };

  return { moduleType: typeMap[facilityType], subtype: "New Asset (no existing asset)" };
}

function mapHeatingAndPumping(block: NetworkBlock): ModuleMapping | null {
  const pressureClass = block.pressure_class as string | undefined;

  if (!pressureClass) {
    return null;
  }

  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  const subtype = `${pressureMap[pressureClass]} - Fully Electrical`;
  return { moduleType: "HeatingAndExportPumping", subtype };
}

function mapPipeMerge(block: NetworkBlock): ModuleMapping | null {
  const phase = block.phase as string | undefined;

  if (!phase) {
    return null;
  }

  const moduleType = phase === "gas" ? "MergingGasPipeline" : "MergingDensePhase";
  return { moduleType, subtype: null };
}

function mapInjectionWell(block: NetworkBlock): ModuleMapping | null {
  const location = block.location as string | undefined;

  if (!location) {
    return null;
  }

  const moduleType = location === "onshore" ? "OnshoreInjectionWell" : "OffshoreInjectionWell";
  return { moduleType, subtype: null };
}

function mapInjectionTopsides(block: NetworkBlock): ModuleMapping | null {
  const location = block.location as string | undefined;

  if (!location) {
    return null;
  }

  const moduleType = location === "onshore" ? "OnshoreInjection" : "PlatformFsiuInjection";
  return { moduleType, subtype: null };
}

function mapOffshorePlatform(block: NetworkBlock): ModuleMapping | null {
  const platformType = block.platform_type as string | undefined;

  if (!platformType) {
    return null;
  }

  const typeMap: Record<string, string> = {
    fisu: "FloatingStorageAndInjectionUnit",
    buoy: "DirectInjectionBuoy",
    floater: "OffshorePlatform",
    jackup: "OffshorePlatform",
  };

  return { moduleType: typeMap[platformType], subtype: null };
}
