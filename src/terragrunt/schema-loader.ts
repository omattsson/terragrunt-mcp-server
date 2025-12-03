/**
 * Backend Schema Loader
 * 
 * Loads and validates backend schema JSON files for Terraform backend configurations.
 * Part of Epic #138: Auto-Generate Complete Backend Templates
 */

import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import {
  BackendSchema,
  BackendAttribute,
  BackendAttributeType,
  BackendSchemaValidationResult,
  BackendSchemaLoadOptions,
  BackendSchemaCollection,
} from '../types/backend-schema.js';

// Valid attribute types
const VALID_ATTRIBUTE_TYPES: BackendAttributeType[] = ['string', 'number', 'boolean', 'list', 'map', 'object'];

// Valid provider values
const VALID_PROVIDERS = ['aws', 'azure', 'gcp', 'other'];

// Semver regex pattern
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;

// ISO date regex pattern (YYYY-MM-DD)
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Attribute name pattern (lowercase letters, numbers, underscores)
const ATTRIBUTE_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

// Backend/ID name pattern (lowercase letters, numbers, hyphens)
const BACKEND_ID_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Validates a single backend attribute
 */
export function validateAttribute(attr: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `attributes[${index}]`;

  if (!attr || typeof attr !== 'object') {
    errors.push(`${prefix}: Must be an object`);
    return errors;
  }

  const attribute = attr as Record<string, unknown>;

  // Required fields
  if (typeof attribute.name !== 'string' || !attribute.name) {
    errors.push(`${prefix}.name: Required and must be a non-empty string`);
  } else if (!ATTRIBUTE_NAME_REGEX.test(attribute.name)) {
    errors.push(`${prefix}.name: Must match pattern ^[a-z][a-z0-9_]*$ (got "${attribute.name}")`);
  }

  if (typeof attribute.type !== 'string') {
    errors.push(`${prefix}.type: Required and must be a string`);
  } else if (!VALID_ATTRIBUTE_TYPES.includes(attribute.type as BackendAttributeType)) {
    errors.push(`${prefix}.type: Must be one of ${VALID_ATTRIBUTE_TYPES.join(', ')} (got "${attribute.type}")`);
  }

  if (typeof attribute.required !== 'boolean') {
    errors.push(`${prefix}.required: Required and must be a boolean`);
  }

  if (typeof attribute.description !== 'string' || !attribute.description) {
    errors.push(`${prefix}.description: Required and must be a non-empty string`);
  }

  // Optional field validations
  if (attribute.example !== undefined) {
    const exampleType = typeof attribute.example;
    if (!['string', 'number', 'boolean'].includes(exampleType)) {
      errors.push(`${prefix}.example: Must be a string, number, or boolean`);
    }
  }

  if (attribute.defaultValue !== undefined && attribute.defaultValue !== null) {
    const defaultType = typeof attribute.defaultValue;
    if (!['string', 'number', 'boolean'].includes(defaultType)) {
      errors.push(`${prefix}.defaultValue: Must be a string, number, boolean, or null`);
    }
  }

  if (attribute.sensitive !== undefined && typeof attribute.sensitive !== 'boolean') {
    errors.push(`${prefix}.sensitive: Must be a boolean`);
  }

  if (attribute.deprecated !== undefined && typeof attribute.deprecated !== 'boolean') {
    errors.push(`${prefix}.deprecated: Must be a boolean`);
  }

  if (attribute.deprecatedMessage !== undefined) {
    if (typeof attribute.deprecatedMessage !== 'string') {
      errors.push(`${prefix}.deprecatedMessage: Must be a string`);
    } else if (!attribute.deprecated) {
      errors.push(`${prefix}.deprecatedMessage: Can only be specified when deprecated is true`);
    }
  }

  if (attribute.validValues !== undefined) {
    if (!Array.isArray(attribute.validValues)) {
      errors.push(`${prefix}.validValues: Must be an array`);
    } else if (attribute.validValues.length === 0) {
      errors.push(`${prefix}.validValues: Must contain at least one value`);
    } else {
      for (let i = 0; i < attribute.validValues.length; i++) {
        const valueType = typeof attribute.validValues[i];
        if (!['string', 'number', 'boolean'].includes(valueType)) {
          errors.push(`${prefix}.validValues[${i}]: Must be a string, number, or boolean`);
        }
      }
    }
  }

  // Numeric range validations - only valid for number type
  if (attribute.minValue !== undefined) {
    if (typeof attribute.minValue !== 'number') {
      errors.push(`${prefix}.minValue: Must be a number`);
    } else if (attribute.type !== 'number') {
      errors.push(`${prefix}.minValue: Can only be specified for number type attributes`);
    }
  }

  if (attribute.maxValue !== undefined) {
    if (typeof attribute.maxValue !== 'number') {
      errors.push(`${prefix}.maxValue: Must be a number`);
    } else if (attribute.type !== 'number') {
      errors.push(`${prefix}.maxValue: Can only be specified for number type attributes`);
    }
  }

  if (
    typeof attribute.minValue === 'number' &&
    typeof attribute.maxValue === 'number' &&
    attribute.minValue > attribute.maxValue
  ) {
    errors.push(`${prefix}: minValue (${attribute.minValue}) cannot be greater than maxValue (${attribute.maxValue})`);
  }

  if (attribute.pattern !== undefined) {
    if (typeof attribute.pattern !== 'string') {
      errors.push(`${prefix}.pattern: Must be a string`);
    } else {
      try {
        new RegExp(attribute.pattern);
      } catch {
        errors.push(`${prefix}.pattern: Invalid regex pattern`);
      }
    }
  }

  // Array field validations
  if (attribute.conflictsWith !== undefined) {
    if (!Array.isArray(attribute.conflictsWith)) {
      errors.push(`${prefix}.conflictsWith: Must be an array`);
    } else {
      for (let i = 0; i < attribute.conflictsWith.length; i++) {
        if (typeof attribute.conflictsWith[i] !== 'string') {
          errors.push(`${prefix}.conflictsWith[${i}]: Must be a string`);
        } else if (!ATTRIBUTE_NAME_REGEX.test(attribute.conflictsWith[i] as string)) {
          errors.push(`${prefix}.conflictsWith[${i}]: Must match attribute name pattern`);
        }
      }
    }
  }

  if (attribute.requiredWith !== undefined) {
    if (!Array.isArray(attribute.requiredWith)) {
      errors.push(`${prefix}.requiredWith: Must be an array`);
    } else {
      for (let i = 0; i < attribute.requiredWith.length; i++) {
        if (typeof attribute.requiredWith[i] !== 'string') {
          errors.push(`${prefix}.requiredWith[${i}]: Must be a string`);
        } else if (!ATTRIBUTE_NAME_REGEX.test(attribute.requiredWith[i] as string)) {
          errors.push(`${prefix}.requiredWith[${i}]: Must match attribute name pattern`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validates a backend schema object structure
 */
export function validateBackendSchema(data: unknown): BackendSchemaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Schema must be an object'],
      warnings: [],
    };
  }

  const schema = data as Record<string, unknown>;

  // Required fields
  if (typeof schema.id !== 'string' || !schema.id) {
    errors.push('id: Required and must be a non-empty string');
  } else if (!BACKEND_ID_REGEX.test(schema.id)) {
    errors.push(`id: Must match pattern ^[a-z][a-z0-9-]*$ (got "${schema.id}")`);
  }

  if (typeof schema.name !== 'string' || !schema.name) {
    errors.push('name: Required and must be a non-empty string');
  }

  if (typeof schema.description !== 'string' || !schema.description) {
    errors.push('description: Required and must be a non-empty string');
  }

  if (typeof schema.provider !== 'string') {
    errors.push('provider: Required and must be a string');
  } else if (!VALID_PROVIDERS.includes(schema.provider)) {
    errors.push(`provider: Must be one of ${VALID_PROVIDERS.join(', ')} (got "${schema.provider}")`);
  }

  if (typeof schema.backend !== 'string' || !schema.backend) {
    errors.push('backend: Required and must be a non-empty string');
  } else if (!BACKEND_ID_REGEX.test(schema.backend)) {
    errors.push(`backend: Must match pattern ^[a-z][a-z0-9-]*$ (got "${schema.backend}")`);
  }

  if (typeof schema.terraformDocsUrl !== 'string' || !schema.terraformDocsUrl) {
    errors.push('terraformDocsUrl: Required and must be a non-empty string');
  } else {
    try {
      const url = new URL(schema.terraformDocsUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('terraformDocsUrl: Must be an HTTP or HTTPS URL');
      }
    } catch {
      errors.push('terraformDocsUrl: Must be a valid URL');
    }
  }

  // Attributes array
  if (!Array.isArray(schema.attributes)) {
    errors.push('attributes: Required and must be an array');
  } else if (schema.attributes.length === 0) {
    errors.push('attributes: Must contain at least one attribute');
  } else {
    // Validate each attribute
    for (let i = 0; i < schema.attributes.length; i++) {
      const attrErrors = validateAttribute(schema.attributes[i], i);
      errors.push(...attrErrors);
    }

    // Check for duplicate attribute names
    const attrNames = new Set<string>();
    for (let i = 0; i < schema.attributes.length; i++) {
      const attr = schema.attributes[i] as Record<string, unknown>;
      if (typeof attr.name === 'string') {
        if (attrNames.has(attr.name)) {
          errors.push(`attributes[${i}].name: Duplicate attribute name "${attr.name}"`);
        }
        attrNames.add(attr.name);
      }
    }

    // Validate conflictsWith and requiredWith references exist
    for (let i = 0; i < schema.attributes.length; i++) {
      const attr = schema.attributes[i] as Record<string, unknown>;
      
      if (Array.isArray(attr.conflictsWith)) {
        for (const ref of attr.conflictsWith) {
          if (typeof ref === 'string' && !attrNames.has(ref)) {
            warnings.push(`attributes[${i}].conflictsWith: References unknown attribute "${ref}"`);
          }
        }
      }
      
      if (Array.isArray(attr.requiredWith)) {
        for (const ref of attr.requiredWith) {
          if (typeof ref === 'string' && !attrNames.has(ref)) {
            warnings.push(`attributes[${i}].requiredWith: References unknown attribute "${ref}"`);
          }
        }
      }
    }
  }

  // Optional fields
  if (schema.version !== undefined) {
    if (typeof schema.version !== 'string') {
      errors.push('version: Must be a string');
    } else if (!SEMVER_REGEX.test(schema.version)) {
      errors.push(`version: Must be valid semver format (got "${schema.version}")`);
    }
  }

  if (schema.lastUpdated !== undefined) {
    if (typeof schema.lastUpdated !== 'string') {
      errors.push('lastUpdated: Must be a string');
    } else if (!ISO_DATE_REGEX.test(schema.lastUpdated)) {
      errors.push(`lastUpdated: Must be ISO date format YYYY-MM-DD (got "${schema.lastUpdated}")`);
    } else {
      // Validate the date actually exists by checking components match
      const [year, month, day] = schema.lastUpdated.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        errors.push(`lastUpdated: Invalid date "${schema.lastUpdated}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Loads a backend schema from a JSON file
 */
export async function loadBackendSchema(
  filePath: string,
  options: BackendSchemaLoadOptions = {}
): Promise<BackendSchema> {
  const { validate = true, throwOnError = true } = options;

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    const message = `Failed to read schema file: ${filePath}`;
    if (throwOnError) {
      throw new Error(message);
    }
    console.error(message, error);
    // Return empty schema structure when not throwing
    return {
      id: '',
      name: '',
      description: '',
      provider: 'other',
      backend: '',
      terraformDocsUrl: '',
      attributes: [],
    } as BackendSchema;
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch (error) {
    const message = `Failed to parse JSON in schema file: ${filePath}`;
    if (throwOnError) {
      throw new Error(message);
    }
    console.error(message, error);
    // Return empty schema structure when not throwing
    return {
      id: '',
      name: '',
      description: '',
      provider: 'other',
      backend: '',
      terraformDocsUrl: '',
      attributes: [],
    } as BackendSchema;
  }

  if (validate) {
    const result = validateBackendSchema(data);
    
    if (result.warnings.length > 0) {
      console.warn(`Warnings in schema file ${filePath}:`);
      for (const warning of result.warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    if (!result.valid) {
      const message = `Invalid schema in file ${filePath}:\n${result.errors.map(e => `  - ${e}`).join('\n')}`;
      if (throwOnError) {
        throw new Error(message);
      }
      console.error(message);
    }
  }

  return data as BackendSchema;
}

/**
 * Loads all backend schemas from a directory
 */
export async function loadAllBackendSchemas(
  directory: string,
  options: BackendSchemaLoadOptions = {}
): Promise<BackendSchemaCollection> {
  const schemas: BackendSchemaCollection = new Map();
  const { throwOnError = false } = options;

  let files: string[];
  try {
    files = await readdir(directory);
  } catch (error) {
    const message = `Failed to read schema directory: ${directory}`;
    if (throwOnError) {
      throw new Error(message);
    }
    console.error(message, error);
    return schemas;
  }

  const jsonFiles = files.filter(f => extname(f).toLowerCase() === '.json');

  for (const file of jsonFiles) {
    const filePath = join(directory, file);
    try {
      const schema = await loadBackendSchema(filePath, { ...options, throwOnError: false });
      
      // Skip schemas with empty IDs (failed to load properly)
      if (!schema.id) {
        continue;
      }
      
      if (schemas.has(schema.id)) {
        const warning = `Duplicate schema ID "${schema.id}" in file ${filePath}, skipping`;
        if (throwOnError) {
          throw new Error(warning);
        }
        console.warn(warning);
        continue;
      }
      
      schemas.set(schema.id, schema);
    } catch (error) {
      if (throwOnError) {
        throw error;
      }
      console.error(`Failed to load schema from ${filePath}:`, error);
    }
  }

  return schemas;
}

/**
 * Gets a specific attribute from a schema by name
 */
export function getAttributeByName(schema: BackendSchema, attributeName: string): BackendAttribute | undefined {
  return schema.attributes.find(attr => attr.name === attributeName);
}

/**
 * Gets all required attributes from a schema
 */
export function getRequiredAttributes(schema: BackendSchema): BackendAttribute[] {
  return schema.attributes.filter(attr => attr.required);
}

/**
 * Gets all optional attributes from a schema
 */
export function getOptionalAttributes(schema: BackendSchema): BackendAttribute[] {
  return schema.attributes.filter(attr => !attr.required);
}

/**
 * Gets all deprecated attributes from a schema
 */
export function getDeprecatedAttributes(schema: BackendSchema): BackendAttribute[] {
  return schema.attributes.filter(attr => attr.deprecated);
}

/**
 * Gets all sensitive attributes from a schema
 */
export function getSensitiveAttributes(schema: BackendSchema): BackendAttribute[] {
  return schema.attributes.filter(attr => attr.sensitive);
}
