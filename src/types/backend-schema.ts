/**
 * Backend Schema types for defining complete Terraform backend configurations
 * 
 * These types define a standardized format for describing ALL attributes
 * of Terraform backends (S3, Azure Blob, GCS, etc.) with rich validation metadata.
 * 
 * Part of Epic #138: Auto-Generate Complete Backend Templates
 */

/**
 * Terraform value types supported by backend attributes
 */
export type BackendAttributeType = 'string' | 'number' | 'boolean' | 'list' | 'map' | 'object';

/**
 * Complete definition of a backend attribute with validation rules
 */
export interface BackendAttribute {
  /** Attribute identifier (e.g., 'bucket', 'region', 'encrypt') */
  name: string;

  /** Terraform type of the attribute */
  type: BackendAttributeType;

  /** Whether this attribute is required */
  required: boolean;

  /** Human-readable description of what the attribute does */
  description: string;

  /** Example value demonstrating usage */
  example?: string | number | boolean;

  /** Default value if not specified */
  defaultValue?: string | number | boolean | null;

  /** Whether the attribute value should be marked as sensitive */
  sensitive?: boolean;

  /** Whether this attribute is deprecated */
  deprecated?: boolean;

  /** Message explaining why deprecated and what to use instead */
  deprecatedMessage?: string;

  /** Array of allowed values (enum validation) */
  validValues?: (string | number | boolean)[];

  /** Minimum value for numeric attributes */
  minValue?: number;

  /** Maximum value for numeric attributes */
  maxValue?: number;

  /** Regex pattern for string validation */
  pattern?: string;

  /** Array of attribute names that conflict with this one */
  conflictsWith?: string[];

  /** Array of attribute names that must be specified together with this one */
  requiredWith?: string[];
}

/**
 * Complete schema definition for a Terraform backend type
 */
export interface BackendSchema {
  /** Unique identifier for this backend schema (e.g., 's3', 'azurerm', 'gcs') */
  id: string;

  /** Human-readable name (e.g., 'AWS S3 Backend') */
  name: string;

  /** Description of what this backend does */
  description: string;

  /** Cloud provider (e.g., 'aws', 'azure', 'gcp') */
  provider: string;

  /** Terraform backend type (e.g., 's3', 'azurerm', 'gcs') */
  backend: string;

  /** URL to official Terraform documentation for this backend */
  terraformDocsUrl: string;

  /** All supported attributes for this backend */
  attributes: BackendAttribute[];

  /** Schema version (semver format) */
  version?: string;

  /** ISO 8601 date when schema was last updated */
  lastUpdated?: string;
}

/**
 * Result of schema validation
 */
export interface BackendSchemaValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Array of validation error messages */
  errors: string[];

  /** Array of validation warning messages */
  warnings: string[];
}

/**
 * Options for loading backend schemas
 */
export interface BackendSchemaLoadOptions {
  /** Whether to validate schemas during loading (default: true) */
  validate?: boolean;

  /** Whether to throw on validation errors (default: false) */
  throwOnError?: boolean;
}

/**
 * Collection of loaded backend schemas indexed by ID
 */
export type BackendSchemaCollection = Map<string, BackendSchema>;
