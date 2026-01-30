/* tslint:disable */
/* eslint-disable */

export class DaggerWasm {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Get schemas for a specific version
   * Returns JSON object mapping block types to schema definitions
   */
  get_schemas(schemas_dir: string, version: string): string;
  /**
   * Load a network from a directory path (for CLI use)
   * Returns JSON string of the network
   */
  load_network(path: string): string;
  /**
   * Query the network using query path syntax
   * files_json: JSON string mapping filename -> content
   * Returns JSON string of the query result
   */
  query_from_files(files_json: string, config_content: string | null | undefined, query_str: string): string;
  /**
   * Get available schema versions
   * Returns JSON array of version strings
   */
  get_schema_versions(schemas_dir: string): string;
  /**
   * Load a network from file contents (JSON string mapping filename -> content)
   * Returns JSON string of the network
   */
  load_network_from_files(files_json: string, config_content?: string | null): string;
  /**
   * Resolve a property with scope information
   * Returns JSON string with both value and scope: {"value": ..., "scope": "block"|"branch"|"group"|"global"}
   */
  resolve_property_with_scope(files_json: string, config_content: string | null | undefined, node_id: string, block_index: number, property: string): string;
  constructor();
  /**
   * Get all edges in the network
   * Returns JSON string array of edges
   */
  get_edges(network_path: string, source?: string | null, target?: string | null): string;
  /**
   * Get all nodes in the network
   * Returns JSON string array of nodes
   */
  get_nodes(network_path: string, node_type?: string | null): string;
}
