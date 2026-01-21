import { Hono } from "hono";
import { Either } from "effect";
import {
  transformNetworkToCostingRequest,
  transformCostingResponse,
  listCostLibraries,
  getModuleLookupService,
} from "../services/costing";
import {
  CostingEstimateRequestSchema,
  validateRequest,
  formatValidationErrors,
} from "../services/costing/schemas";
import type { CostEstimateResponse } from "../services/costing/types";
import { resolveNetworkPath } from "../utils/network-path";

export const costingRoutes = new Hono();

// Default costing server URL (can be overridden via environment variable)
const COSTING_SERVER_URL = process.env.COSTING_SERVER_URL || "http://localhost:8080";

/**
 * POST /api/operations/costing/estimate
 * 
 * Run a costing estimate for a network.
 * 
 * Request body: CostingEstimateRequest
 * - networkPath: Path to network directory (or preset name like "preset1")
 * - libraryId: Cost library ID (e.g., "V1.1_working")
 * - targetCurrency: Optional target currency (default: "USD")
 * - assetDefaults: Optional default asset properties
 * - assetOverrides: Optional per-asset property overrides
 */
costingRoutes.post("/estimate", async (c) => {
  try {
    const rawBody = await c.req.json();
    
    // Validate request body with Effect Schema
    const parseResult = validateRequest(CostingEstimateRequestSchema, rawBody);
    if (Either.isLeft(parseResult)) {
      return c.json(formatValidationErrors(parseResult.left), 400);
    }
    const body = parseResult.right;
    
    // Resolve path if source is path-based
    const source = body.source.type === "path" 
      ? { type: "path" as const, path: resolveNetworkPath(body.source.path) }
      : body.source;
    const currency = body.targetCurrency || "USD";
    
    // Transform network to costing request
    const { request, assetMetadata } = await transformNetworkToCostingRequest(source, {
      libraryId: body.libraryId,
      assetDefaults: body.assetDefaults,
      assetOverrides: body.assetOverrides,
    });
    
    // Check if we have any assets to cost
    if (request.assets.length === 0) {
      return c.json({
        error: "No costable assets found",
        message: "The network contains no blocks that can be mapped to cost library modules. " +
          "Ensure blocks have the required properties for costing (e.g., Pipe blocks need phase, location, size).",
        assetCount: 0,
      }, 400);
    }
    
    // Call the costing server
    let costingResponse: CostEstimateResponse;
    try {
      const response = await fetch(`${COSTING_SERVER_URL}/api/cost/estimate?library_id=${body.libraryId}&target_currency_code=${currency}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return c.json({
          error: "Costing server error",
          status: response.status,
          message: errorText,
        }, 502);
      }
      
      costingResponse = await response.json();
    } catch (fetchError) {
      return c.json({
        error: "Costing server unavailable",
        message: `Failed to connect to costing server at ${COSTING_SERVER_URL}. ` +
          "Ensure the costing server is running.",
        details: fetchError instanceof Error ? fetchError.message : String(fetchError),
      }, 503);
    }
    
    // Transform response to our format
    const result = transformCostingResponse(costingResponse, assetMetadata, currency);
    
    return c.json(result);
  } catch (error) {
    console.error("Costing estimate error:", error);
    return c.json({
      error: "Internal error",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * POST /api/operations/costing/validate
 * 
 * Validate a network for costing readiness without running the actual calculation.
 * Returns which blocks can be costed and which are missing required properties.
 */
costingRoutes.post("/validate", async (c) => {
  try {
    const rawBody = await c.req.json();
    
    // Validate request body with Effect Schema
    const parseResult = validateRequest(CostingEstimateRequestSchema, rawBody);
    if (Either.isLeft(parseResult)) {
      return c.json(formatValidationErrors(parseResult.left), 400);
    }
    const body = parseResult.right;
    
    // Resolve path if source is path-based
    const source = body.source.type === "path" 
      ? { type: "path" as const, path: resolveNetworkPath(body.source.path) }
      : body.source;
    
    // Transform network (this validates blocks and maps to modules)
    const { request, assetMetadata } = await transformNetworkToCostingRequest(source, {
      libraryId: body.libraryId,
    });
    
    // Count total blocks vs costable blocks
    const totalBlocks = assetMetadata.reduce((sum, a) => sum + a.blockCount, 0);
    const costableBlocks = request.assets.reduce((sum, a) => sum + a.cost_items.length, 0);
    
    return c.json({
      isReady: request.assets.length > 0,
      summary: {
        assetCount: request.assets.length,
        totalBlocks,
        costableBlocks,
        unmappedBlocks: totalBlocks - costableBlocks,
      },
      assets: assetMetadata.map(m => ({
        id: m.assetId,
        name: m.name,
        isGroup: m.isGroup,
        blockCount: m.blockCount,
        usingDefaults: m.usingDefaults,
      })),
    });
  } catch (error) {
    console.error("Costing validation error:", error);
    return c.json({
      error: "Validation failed",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/operations/costing/libraries
 * 
 * List available cost libraries.
 */
costingRoutes.get("/libraries", async (c) => {
  try {
    const libraries = await listCostLibraries();
    return c.json({ libraries });
  } catch (error) {
    console.error("List libraries error:", error);
    return c.json({
      error: "Failed to list libraries",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/operations/costing/libraries/:id
 * 
 * Get details about a specific cost library.
 */
costingRoutes.get("/libraries/:id", async (c) => {
  try {
    const libraryId = c.req.param("id");
    const service = await getModuleLookupService(libraryId);
    
    const types = service.listTypes();
    
    return c.json({
      id: libraryId,
      types,
      moduleCount: types.reduce((sum, t) => sum + service.findByType(t).length, 0),
    });
  } catch (error) {
    console.error("Get library error:", error);
    return c.json({
      error: "Failed to get library",
      message: error instanceof Error ? error.message : String(error),
    }, 404);
  }
});

/**
 * GET /api/operations/costing/libraries/:id/modules
 * 
 * List modules in a cost library.
 * 
 * Query params:
 * - type: Filter by module type (e.g., "CaptureUnit")
 */
costingRoutes.get("/libraries/:id/modules", async (c) => {
  try {
    const libraryId = c.req.param("id");
    const typeFilter = c.req.query("type");
    
    const service = await getModuleLookupService(libraryId);
    
    if (typeFilter) {
      const modules = service.findByType(typeFilter);
      return c.json({
        type: typeFilter,
        modules: modules.map(m => ({
          id: m.id,
          subtype: m.subtype,
          requiredParameters: m.requiredParameters,
        })),
      });
    }
    
    // Return all types with their subtypes
    const types = service.listTypes();
    const result = types.map(type => ({
      type,
      subtypes: service.listSubtypes(type),
      moduleCount: service.findByType(type).length,
    }));
    
    return c.json({ types: result });
  } catch (error) {
    console.error("List modules error:", error);
    return c.json({
      error: "Failed to list modules",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

/**
 * GET /api/operations/costing/health
 * 
 * Check if the costing server is reachable.
 */
costingRoutes.get("/health", async (c) => {
  try {
    // Use the /hello endpoint as a health check
    const response = await fetch(`${COSTING_SERVER_URL}/api/hello`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    
    if (response.ok) {
      return c.json({
        status: "ok",
        costingServer: COSTING_SERVER_URL,
        serverStatus: "reachable",
      });
    } else {
      return c.json({
        status: "degraded",
        costingServer: COSTING_SERVER_URL,
        serverStatus: "unhealthy",
        statusCode: response.status,
      });
    }
  } catch (error) {
    return c.json({
      status: "error",
      costingServer: COSTING_SERVER_URL,
      serverStatus: "unreachable",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
