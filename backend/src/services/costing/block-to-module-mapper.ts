/**
 * Maps generic Dagger block types to cost library module types and subtypes.
 * 
 * This is the bridge between operation-agnostic Dagger blocks and 
 * operation-specific cost library modules.
 */

// ============================================================================
// Types
// ============================================================================

export type ModuleMapping = {
  /** Cost library module type (e.g., "GasPipeline") */
  moduleType: string;
  /** Cost library subtype (e.g., "Onshore (Buried) - Medium") */
  subtype: string | null;
};

export type Block = {
  type: string;
  [key: string]: unknown;
};

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Map a Dagger block to a cost library module type and subtype.
 */
export function mapBlockToModule(block: Block): ModuleMapping | null {
  const mappers: Record<string, (block: Block) => ModuleMapping | null> = {
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

function mapPipe(block: Block): ModuleMapping {
  const phase = block.phase as string;
  const location = block.location as string;
  const size = block.size as string;
  
  const moduleType = phase === "gas" ? "GasPipeline" : "DensePhasePipeline";
  
  const locationStr = location === "onshore" 
    ? "Onshore (Buried)" 
    : "Offshore (Subsea)";
  
  const sizeStr = size.charAt(0).toUpperCase() + size.slice(1);
  const subtype = `${locationStr} - ${sizeStr}`;
  
  return { moduleType, subtype };
}

function mapCompressor(block: Block): ModuleMapping {
  const pressureRange = block.pressure_range as string;
  
  const typeMap: Record<string, string> = {
    lp: "LpCompression",
    hp: "HpCompression",
    booster: "BoosterCompression",
  };
  
  const moduleType = typeMap[pressureRange] ?? "LpCompression";
  const subtype = block.drive_type === "electric" ? "Electric Drive" : null;
  
  return { moduleType, subtype };
}

function mapPump(block: Block): ModuleMapping {
  const subtype = block.drive_type === "electric" ? "Electric drive" : null;
  return { moduleType: "BoosterPump", subtype };
}

function mapEmitter(block: Block): ModuleMapping {
  const emitterType = block.emitter_type as string;
  
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

function mapCaptureUnit(block: Block): ModuleMapping {
  const tech = block.capture_technology as string;
  
  const subtypeMap: Record<string, string> = {
    amine: "Amine",
    inorganic_solvents: "Inorganic solvents",
    cryogenic: "Cryogenic (to 100% CO2)",
    psa_tsa: "PSA/TSA",
    membrane: "Membrane",
  };
  
  return { moduleType: "CaptureUnit", subtype: subtypeMap[tech] ?? tech };
}

function mapDehydration(block: Block): ModuleMapping {
  const dehydrationType = block.dehydration_type as string;
  
  const subtypeMap: Record<string, string> = {
    molecular_sieve: "Molecular Sieve",
    glycol: "Glycol (TEG)",
  };
  
  return { moduleType: "Dehydration", subtype: subtypeMap[dehydrationType] ?? dehydrationType };
}

function mapRefrigeration(block: Block): ModuleMapping {
  const pressureClass = block.pressure_class as string;
  const coolingMethod = block.cooling_method as string;
  
  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  const methodMap: Record<string, string> = {
    water: "Water Cooling + trim refrig",
    air: "Air Cooling + trim refrig",
    ammonia: "Refrigerant - Ammonia",
  };
  
  const subtype = `${pressureMap[pressureClass]} - ${methodMap[coolingMethod]}`;
  return { moduleType: "Refrigeration", subtype };
}

function mapMetering(block: Block): ModuleMapping {
  const meteringType = block.metering_type as string;
  
  const subtypeMap: Record<string, string> = {
    fiscal_36: "Fiscal (CO2 flowrate) - 36\"",
    fiscal_24: "Fiscal (CO2 flowrate) - 24\"",
    fiscal_14: "Fiscal (CO2 flowrate) - 14\"",
    compositional: "Compositional quality analysis",
  };
  
  return { moduleType: "Metering", subtype: subtypeMap[meteringType] ?? meteringType };
}

function mapStorage(block: Block): ModuleMapping {
  const pressureClass = block.pressure_class as string;
  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  return { moduleType: "InterimStorage", subtype: pressureMap[pressureClass] };
}

function mapShipping(block: Block): ModuleMapping {
  const pressureClass = block.pressure_class as string;
  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  return { moduleType: "Shipping", subtype: pressureMap[pressureClass] };
}

function mapLandTransport(block: Block): ModuleMapping {
  const mode = block.mode as string;
  
  if (mode === "truck") {
    return { moduleType: "RoadTanker", subtype: "Rental Liquefied Tanker Truck" };
  } else {
    return { moduleType: "Rail", subtype: "Rental Liquefied Railcar" };
  }
}

function mapLoadingOffloading(block: Block): ModuleMapping {
  const facilityType = block.facility_type as string;
  
  const typeMap: Record<string, string> = {
    truck: "TruckLoadingOffloading",
    rail: "RailLoadingOffloading",
    jetty: "JettyLoadingArms",
  };
  
  return { moduleType: typeMap[facilityType], subtype: "New Asset (no existing asset)" };
}

function mapHeatingAndPumping(block: Block): ModuleMapping {
  const pressureClass = block.pressure_class as string;
  const pressureMap: Record<string, string> = { ep: "EP", mp: "MP", lp: "LP" };
  const subtype = `${pressureMap[pressureClass]} - Fully Electrical`;
  return { moduleType: "HeatingAndExportPumping", subtype };
}

function mapPipeMerge(block: Block): ModuleMapping {
  const phase = block.phase as string;
  const moduleType = phase === "gas" ? "MergingGasPipeline" : "MergingDensePhase";
  return { moduleType, subtype: null };
}

function mapInjectionWell(block: Block): ModuleMapping {
  const location = block.location as string;
  const moduleType = location === "onshore" ? "OnshoreInjectionWell" : "OffshoreInjectionWell";
  return { moduleType, subtype: null };
}

function mapInjectionTopsides(block: Block): ModuleMapping {
  const location = block.location as string;
  const moduleType = location === "onshore" ? "OnshoreInjection" : "PlatformFsiuInjection";
  return { moduleType, subtype: null };
}

function mapOffshorePlatform(block: Block): ModuleMapping {
  const platformType = block.platform_type as string;
  
  const typeMap: Record<string, string> = {
    fisu: "FloatingStorageAndInjectionUnit",
    buoy: "DirectInjectionBuoy",
    floater: "OffshorePlatform",
    jackup: "OffshorePlatform",
  };
  
  return { moduleType: typeMap[platformType], subtype: null };
}
