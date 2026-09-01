/**
 * Template types for Terragrunt configuration generation
 */

export interface ConfigVariable {
  name: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  example?: string;
  sensitive?: boolean;
  /**
   * Treat this variable as an enable-flag in `{{#var}}` conditionals: only a
   * truthy value (true, or a string other than "false"/"0"/"") enables the
   * block. Without this, any provided non-empty value — including `false` —
   * enables the block (needed by templates that render the value itself, e.g.
   * `{{#encrypt}}encrypt = {{encrypt}}{{/encrypt}}`).
   */
  flag?: boolean;
}

/**
 * Changelog entry for template version history
 */
export interface ChangelogEntry {
  /** Version this entry describes (semver format) */
  version: string;
  /** Date of the version release (ISO 8601 format) */
  date: string;
  /** List of changes in this version */
  changes: string[];
  /** Whether this version contains breaking changes */
  breaking?: boolean;
}

/**
 * Deprecation information for templates
 */
export interface DeprecationInfo {
  /** Version when the template was deprecated (semver format) */
  since: string;
  /** Reason for deprecation */
  reason: string;
  /** ID of the replacement template (if available) */
  replacement?: string;
}

/**
 * Compatibility requirements for a template
 */
export interface CompatibilityInfo {
  /** Terragrunt version constraint (semver constraint) */
  terragruntVersion?: string;
  /** Terraform version constraint (semver constraint) */
  terraformVersion?: string;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'backend' | 'provider' | 'dependency' | 'hooks' | 'inputs' | 'advanced' | 'configuration' | 'cicd';
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'multi';
  variables: ConfigVariable[];
  templateHcl: string;
  example?: string;
  source: 'gruntwork' | 'azure-config' | 'documentation' | 'builtin' | 'custom' | 'filesystem';
  tags: string[];
  /** Template version (semver format, e.g., "1.0.0") */
  version?: string;
  /** Version history and changelog */
  changelog?: ChangelogEntry[];
  /** Deprecation status and migration info */
  deprecated?: DeprecationInfo;
  /** Compatibility requirements */
  compatibility?: CompatibilityInfo;
}

export interface TemplateMetadata {
  totalTemplates: number;
  categories: string[];
  cloudProviders: string[];
  sources: string[];
  lastUpdated: string;
}

export interface TemplateSearchOptions {
  category?: string;
  cloudProvider?: string;
  tags?: string[];
  source?: string;
}
