/**
 * Snapshot Adapter
 *
 * Transforms requests and responses between our API format
 * and the Scenario Modeller API format.
 */

import { SnapshotRequestInput } from "./schemas";
import {
  ComponentResult,
  Conditions,
  FluidProperties,
  Power,
  ScenarioFailResponse,
  ScenarioOkResponse,
  ScenarioRequest,
  SnapshotResponse,
  UnitValue,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPE_SEPARATOR = "|";
const FIELD_ID_SEPARATOR = "|";

// ============================================================================
// Response Transformation
// ============================================================================

/**
 * Check if a response is successful.
 */
export function isScenarioOk(
  response: ScenarioOkResponse | ScenarioFailResponse,
): response is ScenarioOkResponse {
  return "data" in response && response.data !== undefined;
}

/**
 * Transform the Scenario Modeller response to our format.
 */
export function transformScenarioResponse(
  response: ScenarioOkResponse | ScenarioFailResponse,
): SnapshotResponse {
  if (!isScenarioOk(response)) {
    return {
      success: false,
      components: [],
      error: response.error,
      report: response.report ?? undefined,
    };
  }

  const components = groupDataByComponent(response.data ?? {});

  return {
    success: true,
    components,
    thresholds: response.thresholds,
    metadata: response.metadata,
    report: response.report ?? undefined,
  };
}

/**
 * Parse a pipe-separated key into its parts.
 * e.g., "source|emitter1|inlet_pressure" -> { type: "source", id: "emitter1", property: "inlet_pressure" }
 */
function parseKey(key: string): {
  type: string;
  id: string;
  property: string;
} | null {
  const parts = key.split(FIELD_TYPE_SEPARATOR);
  if (parts.length < 3) return null;

  // Handle keys with multiple separators in the property name
  const [type, id, ...propertyParts] = parts;
  const property = propertyParts.join(FIELD_ID_SEPARATOR);

  return { type, id, property };
}

/**
 * Group flat response data by component.
 */
function groupDataByComponent(
  data: Record<string, UnitValue>,
): ComponentResult[] {
  // Group by component (type + id)
  const componentMap = new Map<
    string,
    { type: string; id: string; properties: Record<string, UnitValue> }
  >();

  for (const [key, value] of Object.entries(data)) {
    const parsed = parseKey(key);
    if (!parsed) continue;

    const componentKey = `${parsed.type}|${parsed.id}`;
    if (!componentMap.has(componentKey)) {
      componentMap.set(componentKey, {
        type: parsed.type,
        id: parsed.id,
        properties: {},
      });
    }

    componentMap.get(componentKey)!.properties[parsed.property] = value;
  }

  // Transform each component's properties into our format
  const results: ComponentResult[] = [];

  for (const component of componentMap.values()) {
    const result = transformComponentProperties(
      component.id,
      component.type,
      component.properties,
    );
    results.push(result);
  }

  return results;
}

/**
 * Transform a component's flat properties into structured fluid properties.
 */
function transformComponentProperties(
  id: string,
  type: string,
  properties: Record<string, UnitValue>,
): ComponentResult {
  const result: ComponentResult = {
    id,
    type,
  };

  // Extract enabled status
  if (properties["enabled"]) {
    result.enabled = Boolean(Object.values(properties["enabled"])[0]);
  }

  // Extract inlet properties
  const inletProps = extractFluidProperties(properties, "inlet_");
  if (Object.keys(inletProps).length > 0) {
    result.inlet = inletProps;
  }

  // Extract outlet properties
  const outletProps = extractFluidProperties(properties, "outlet_");
  if (Object.keys(outletProps).length > 0) {
    result.outlet = outletProps;
  }

  // Extract work/duty for work elements (compressors, pumps, etc.)
  if (properties["workDone"]) {
    result.workDone = extractPower(properties["workDone"]);
  }
  if (properties["duty"]) {
    result.duty = extractPower(properties["duty"]);
  }

  return result;
}

/**
 * Extract fluid properties with a given prefix from the properties map.
 */
function extractFluidProperties(
  properties: Record<string, UnitValue>,
  prefix: string,
): FluidProperties {
  const fluid: FluidProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith(prefix)) continue;

    const propName = key.slice(prefix.length);

    switch (propName) {
      case "pressure":
        fluid.pressure = {
          pascal: extractNumber(value, "pascal") ?? 0,
          bara: extractNumber(value, "bara") ?? 0,
          psi: extractNumber(value, "psi") ?? 0,
          barg: extractNumber(value, "barg") ?? 0,
          psf: extractNumber(value, "psf") ?? 0,
        };
        break;

      case "temperature":
        fluid.temperature = {
          kelvin: extractNumber(value, "kelvin") ?? 0,
          celsius: extractNumber(value, "celsius") ?? 0,
        };
        break;

      case "flowrate":
        fluid.flowrate = {
          kgps: extractNumber(value, "kgps") ?? 0,
          mtpa: extractNumber(value, "mtpa") ?? 0,
          kgPerDay: extractNumber(value, "kgPerDay") ?? 0,
          tonnePerHour: extractNumber(value, "tonnePerHour") ?? 0,
        };
        break;

      case "density":
        fluid.density = {
          kgPerM3: extractNumber(value, "kgPerM3") ?? 0,
          lbPerFt3: extractNumber(value, "lbPerFt3") ?? 0,
        };
        break;

      case "enthalpy":
        fluid.enthalpy = {
          jPerKg: extractNumber(value, "jPerKg") ?? 0,
          kjPerKg: extractNumber(value, "kjPerKg") ?? 0,
        };
        break;

      case "entropy":
        fluid.entropy = {
          jPerK: extractNumber(value, "jPerK") ?? 0,
          kjPerK: extractNumber(value, "kjPerK") ?? 0,
        };
        break;

      case "molarMass":
        fluid.molarMass = {
          scalar: extractNumber(value, "scalar") ?? 0,
        };
        break;

      case "molarVolume":
        fluid.molarVolume = {
          m3PerMol: extractNumber(value, "m3PerMol") ?? 0,
          m3PerKMol: extractNumber(value, "m3PerKMol") ?? 0,
        };
        break;

      case "viscosity":
        fluid.viscosity = {
          pascalSecond: extractNumber(value, "pascalSecond") ?? 0,
        };
        break;

      case "volumetricFlowrate":
        fluid.volumetricFlowrate = {
          m3PerS: extractNumber(value, "m3PerS") ?? 0,
          m3PerH: extractNumber(value, "m3PerH") ?? 0,
        };
        break;

      case "vapourFraction":
        fluid.vapourFraction = {
          scalar: extractNumber(value, "scalar") ?? 0,
        };
        break;

      default:
        // Check if it's a composition fraction
        if (propName.endsWith("Fraction")) {
          if (!fluid.composition) {
            fluid.composition = {};
          }
          const component = propName.slice(0, -8); // Remove "Fraction" suffix
          fluid.composition[component] = {
            molFraction: extractNumber(value, "molFraction") ?? 0,
            molPercent: extractNumber(value, "molPercent") ?? 0,
          };
        }
        break;
    }
  }

  return fluid;
}

/**
 * Extract a power value from a unit value.
 */
function extractPower(value: UnitValue): Power {
  return {
    watts: extractNumber(value, "watts") ?? 0,
    kiloWatts: extractNumber(value, "kiloWatts") ?? 0,
    joulesPerSecond: extractNumber(value, "joulesPerSecond") ?? 0,
  };
}

/**
 * Extract a numeric value from a unit value object.
 */
function extractNumber(value: UnitValue, key: string): number | undefined {
  const v = value[key];
  return typeof v === "number" ? v : undefined;
}

// ============================================================================
// Utilities for building conditions
// ============================================================================

/**
 * Build a condition key from component type, id, and property.
 */
export function buildConditionKey(
  componentType: string,
  componentId: string,
  property: string,
): string {
  return `${componentType}${FIELD_TYPE_SEPARATOR}${componentId}${FIELD_ID_SEPARATOR}${property}`;
}

/**
 * Create a unit value for a pressure.
 */
export function pressureValue(bara: number): UnitValue {
  return { bara };
}

/**
 * Create a unit value for a temperature.
 */
export function temperatureValue(celsius: number): UnitValue {
  return { celsius };
}

/**
 * Create a unit value for a flowrate.
 */
export function flowrateValue(mtpa: number): UnitValue {
  return { mtpa };
}

/**
 * Create a unit value for a boolean.
 */
export function booleanValue(value: boolean): UnitValue {
  return { boolean: value };
}

/**
 * Create a unit value for a scalar.
 */
export function scalarValue(value: number): UnitValue {
  return { scalar: value };
}

/**
 * Create a unit value for a mol fraction.
 */
export function molFractionValue(value: number): UnitValue {
  return { molFraction: value };
}
