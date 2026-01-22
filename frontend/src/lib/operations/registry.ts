/**
 * Operation Registry
 *
 * Defines available operations that can be run on networks.
 * Each operation has validation requirements and API endpoints.
 */

import type { Operation } from "./types";

/**
 * Available operations.
 * Add new operations here as they are implemented.
 */
export const OPERATIONS: Operation[] = [
  {
    id: "costing",
    name: "Cost Estimation",
    description: "Estimate CAPEX and OPEX for the network using cost library modules",
    schemaVersion: "v1.0-costing",
    endpoint: "/api/operations/costing/estimate",
    validateEndpoint: "/api/operations/costing/validate",
    healthEndpoint: "/api/operations/costing/health",
  },
  // Future operations can be added here:
  // {
  //   id: "modelling",
  //   name: "Network Modelling",
  //   description: "Run flow and pressure modelling on the network",
  //   schemaVersion: "v1.0-modelling",
  //   endpoint: "/api/operations/modelling/run",
  //   validateEndpoint: "/api/operations/modelling/validate",
  // },
];

/**
 * Get an operation by ID.
 */
export function getOperation(id: string): Operation | undefined {
  return OPERATIONS.find((op) => op.id === id);
}

/**
 * Get all available operations.
 */
export function getOperations(): Operation[] {
  return OPERATIONS;
}

/**
 * Check if an operation exists.
 */
export function hasOperation(id: string): boolean {
  return OPERATIONS.some((op) => op.id === id);
}
