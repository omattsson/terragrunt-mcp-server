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
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'backend' | 'provider' | 'dependency' | 'hooks' | 'inputs' | 'advanced' | 'configuration';
  cloudProvider?: 'aws' | 'azure' | 'gcp' | 'multi';
  variables: ConfigVariable[];
  templateHcl: string;
  example?: string;
  source: 'gruntwork' | 'azure-config' | 'documentation' | 'builtin' | 'custom' | 'filesystem';
  tags: string[];
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
