/**
 * Type definitions for the Snapshot service.
 *
 * These types mirror the Scenario Modeller API types for the snapshot operation.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Unit value wrapper - a value with its unit specified.
 * e.g., { "bara": 35 } or { "celsius": 55 } or { "mtpa": 1.7 }
 */
export type UnitValue = {
  [unit: string]: number | boolean;
};

/**
 * Conditions are a flat map of pipe-separated keys to unit values.
 * Key format: "componentType|componentId|property"
 * e.g., "source|emitter1|flowrate": { "mtpa": 1.7 }
 */
export type Conditions = Record<string, UnitValue>;

/**
 * Component in a series with its properties.
 */
export interface SeriesComponent {
  elem: string;
  name: string;
  [key: string]: unknown;
}

/**
 * Request to the Scenario Modeller /api/Scenario endpoint.
 */
export interface ScenarioRequest {
  conditions: Conditions;
  structure?: NetworkStructure;
  series?: Record<string, SeriesComponent[]>;
  includeAllPipes?: boolean;
}

/**
 * Network structure definition (optional).
 */
export interface NetworkStructure {
  subnets?: Record<string, SubnetStructure>;
  componentYamlFilenames?: string[];
}

export interface SubnetStructure {
  subnetName?: string;
  downstreamSubnetName?: string;
  componentSeriesMap?: Record<string, string[]>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Error model from the Scenario Modeller API.
 */
export interface ErrorModel {
  type?: string | null;
  message?: string | null;
  severity?: string | null;
  errorCode?: string | null;
  metaData?: Record<string, unknown>;
}

/**
 * Threshold values from the response.
 */
export interface ThresholdsResponse {
  maxWaterContentInPipeline?: MixtureComponent;
  minTemperatureInPipeline?: Temperature;
  maxPressureInOffshorePipeline?: Pressure;
  maxPressureInOnshore?: Pressure;
  temperatureInWell?: Temperature;
  corrosionPotential?: LevelOfCorrosionPotential;
}

export interface MixtureComponent {
  molFraction: number;
  molPercent: number;
}

export interface Temperature {
  kelvin: number;
  celsius: number;
}

export interface Pressure {
  pascal: number;
  bara: number;
  psi: number;
  barg: number;
  psf: number;
}

export enum LevelOfCorrosionPotential {
  None = 0,
  Low = 1,
  High = 2,
}

/**
 * Successful response from the Scenario Modeller /api/Scenario endpoint.
 */
export interface ScenarioOkResponse {
  error?: ErrorModel;
  data?: Record<string, UnitValue>;
  metadata?: Record<string, unknown>;
  report?: string;
  thresholds?: ThresholdsResponse;
}

/**
 * Failed response from the Scenario Modeller /api/Scenario endpoint.
 */
export interface ScenarioFailResponse {
  error?: ErrorModel;
  report?: string;
}

export type ScenarioResponse = ScenarioOkResponse | ScenarioFailResponse;

// ============================================================================
// Transformed Response Types (our API format)
// ============================================================================

/**
 * Component type in the response.
 */
export type ComponentType =
  | "source"
  | "compressorTrain"
  | "cooler"
  | "heater"
  | "pump"
  | "valve"
  | "well"
  | "reservoir"
  | "scavenger"
  | "network"
  | "pipeSeg"
  | "mergingManifold"
  | "splitter"
  | "probe";

/**
 * Fluid properties at a point in the network.
 */
export interface FluidProperties {
  pressure?: Pressure;
  temperature?: Temperature;
  flowrate?: Flowrate;
  density?: Density;
  enthalpy?: Enthalpy;
  entropy?: Entropy;
  molarMass?: { scalar: number };
  molarVolume?: MolarVolume;
  viscosity?: Viscosity;
  volumetricFlowrate?: VolumetricFlowrate;
  vapourFraction?: { scalar: number };
  composition?: Composition;
}

export interface Flowrate {
  kgps: number;
  mtpa: number;
  kgPerDay: number;
  tonnePerHour: number;
}

export interface Density {
  kgPerM3: number;
  lbPerFt3: number;
}

export interface Enthalpy {
  jPerKg: number;
  kjPerKg: number;
}

export interface Entropy {
  jPerK: number;
  kjPerK: number;
}

export interface MolarVolume {
  m3PerMol: number;
  m3PerKMol: number;
}

export interface Viscosity {
  pascalSecond: number;
}

export interface VolumetricFlowrate {
  m3PerS: number;
  m3PerH: number;
}

export interface Composition {
  [component: string]: MixtureComponent;
}

/**
 * Component result in our response format.
 */
export interface ComponentResult {
  id: string;
  type: string;
  enabled?: boolean;
  inlet?: FluidProperties;
  outlet?: FluidProperties;
  workDone?: Power;
  duty?: Power;
}

export interface Power {
  watts: number;
  kiloWatts: number;
  joulesPerSecond: number;
}

/**
 * Our transformed snapshot response.
 */
export interface SnapshotResponse {
  success: boolean;
  components: ComponentResult[];
  thresholds?: ThresholdsResponse;
  metadata?: Record<string, unknown>;
  report?: string;
  error?: ErrorModel;
}
