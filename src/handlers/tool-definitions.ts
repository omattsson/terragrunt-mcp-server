/**
 * Tool definitions: name, description, annotations and the zod input schema of
 * every tool. `getAvailableTools()` derives the advertised JSON Schema from
 * these, and `ToolHandler.callTool` validates arguments against them.
 *
 * Validation is lenient-compatible: it rejects only input the handlers never
 * handled meaningfully (wrong types, unknown enum values, oversized queries).
 * Rules that keep today's behaviour:
 * - `z.looseObject`: unknown keys (including legacy inputs) reach the handler.
 * - No `.default()`: zod would fill defaults before the handler runs and hide
 *   "omitted" from it. Defaults are documented in the advertised schema via
 *   `.meta({ default })` only, which does not affect parsing.
 * - Optional fields accept `null` as well as `undefined` (`.nullish()`).
 * - Numeric fields accept numbers and digit-only strings (converted); every
 *   other value is passed through unchanged to the handler's own normalisation.
 * - Booleans accept booleans and strings, as the handlers do today.
 */

import { z } from 'zod';

/** Longest search_docs query accepted, in characters. */
export const MAX_SEARCH_QUERY_LENGTH = 4096;

export interface ToolAnnotations {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
}

export interface ToolDefinition {
    name: string;
    description: string;
    annotations: ToolAnnotations;
    input: z.ZodType<Record<string, unknown>>;
}

type FieldMeta = {
    description: string;
    default?: unknown;
};

const str = (description: string) =>
    z.string().nullish().meta({ description });

const strEnum = <T extends [string, ...string[]]>(values: T, meta: FieldMeta) =>
    z.enum(values).nullish().meta(meta);

/**
 * zod drops `default` from the metadata of a preprocessed schema when emitting
 * JSON Schema, so numeric defaults travel under this key and the adapter
 * renames it back to `default`.
 */
const DEFAULT_KEY = 'x_default';

/**
 * Number or digit-only string. Everything else (including non-numeric strings,
 * negatives, 0, floats) is passed to the handler's normaliser untouched, so
 * `pageSize: 0` and `pageSize: -5` keep their existing warning/default paths.
 */
const num = (meta: FieldMeta) =>
    z.preprocess(
        (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value),
        z.custom<number | string>((value) => typeof value === 'number' || typeof value === 'string')
    ).nullish().meta({ description: meta.description, type: 'number', [DEFAULT_KEY]: meta.default });

/** Boolean; strings are accepted because the handlers accept them today. */
const bool = (meta: FieldMeta) =>
    z.custom<boolean | string>((value) => typeof value === 'boolean' || typeof value === 'string')
        .nullish()
        .meta({ ...meta, type: 'boolean' });

const SEARCH_DOCS_MODES = ['search', 'list', 'section', 'examples'] as const;

const searchDocsInput = z.looseObject({
    mode: strEnum([...SEARCH_DOCS_MODES], {
        description: 'search: full-text query | list: browse sections | section: get content by name | examples: code samples',
        default: 'search'
    }),
    query: str('Search terms, e.g. "remote state s3"'),
    section: str('Section name from mode=list, e.g. "reference"'),
    detailLevel: strEnum(['summary', 'full'], {
        description: 'Section and examples modes only: summary for an overview, full for complete content or code (ignored in search mode)',
        default: 'summary'
    }),
    page: num({ description: '1-based page number of results', default: 1 }),
    pageSize: num({ description: 'Number of results per page', default: 10 }),
    limit: num({ description: 'Maximum examples to return in examples mode', default: 5 }),
    advanced: bool({ description: 'Use curated advanced examples instead of docs code blocks', default: false }),
    category: strEnum(['hooks', 'generate', 'environment', 'dependencies', 'dry-patterns'], {
        description: 'With advanced=true, only examples from this category'
    }),
    listCategories: bool({ description: 'List curated example categories instead of examples', default: false })
}).superRefine((args, ctx) => {
    // Only search mode tokenises the query, so only search mode caps it.
    const mode = args.mode ?? 'search';
    if (mode === 'search' && typeof args.query === 'string' && args.query.length > MAX_SEARCH_QUERY_LENGTH) {
        ctx.addIssue({
            code: 'custom',
            path: ['query'],
            message: `query is too long (${args.query.length} characters, maximum ${MAX_SEARCH_QUERY_LENGTH}). Use a shorter, more specific query.`
        });
    }
});

const functionReferenceInput = z.looseObject({
    function_name: str('Exact function name, e.g. "find_in_parent_folders"'),
    mode: strEnum(['summary', 'full'], {
        description: 'summary: signature and short text | full: complete details',
        default: 'summary'
    }),
    include_examples: bool({ description: 'Include usage examples in the result', default: true }),
    category: str('Only list functions in this category'),
    search: str('Text to match when listing functions'),
    page: num({ description: '1-based page number of results', default: 1 }),
    pageSize: num({ description: 'Number of functions per page', default: 20 })
});

const cliReferenceInput = z.looseObject({
    command: str('Command to get help for, e.g. "run --all"'),
    category: strEnum(['main', 'backend', 'stack', 'catalog', 'discovery', 'configuration', 'shortcut'], {
        description: 'Only list commands in this category'
    }),
    search: str('Text to match when listing commands'),
    page: num({ description: '1-based page number of results', default: 1 }),
    pageSize: num({ description: 'Number of commands per page', default: 20 })
});

const hclConfigReferenceInput = z.looseObject({
    config: str('HCL block name, e.g. "remote_state"'),
    category: strEnum(['core', 'modules', 'generation', 'execution', 'iam', 'terraform'], {
        description: 'Only list blocks in this category'
    }),
    listBlocks: bool({ description: 'List all block names instead of one reference', default: false })
});

const guidanceInput = z.looseObject({
    query: str('Topic, comparison, or scenario'),
    type: strEnum(['best-practices', 'comparison', 'pattern', 'experiments'], {
        description: 'best-practices | comparison (e.g. dependency vs dependencies) | pattern | experiments'
    }),
    mode: strEnum(['summary', 'full'], {
        description: 'summary: key points | full: complete guidance with examples',
        default: 'summary'
    }),
    level: strEnum(['beginner', 'intermediate', 'advanced'], {
        description: 'Experience level for best-practices guidance'
    }),
    listAll: bool({ description: 'List all topics, comparisons and patterns instead of answering a query', default: false })
});

const buildConfigInput = z.looseObject({
    useCase: strEnum(['remote_state', 'provider_generation', 'dependencies', 'hooks', 'inputs', 'cicd'], {
        description: 'remote_state | provider_generation | dependencies | hooks | inputs | cicd (omit to write existing content)'
    }),
    options: z.record(z.string(), z.unknown()).nullish().meta({
        description: 'Template variables, e.g. {"bucket":"b","key":"k","region":"eu-west-1"}'
    }),
    content: str('HCL content to write'),
    backend: str('For remote_state, the backend type (s3, azurerm, gcs). For cicd, the platform (github-actions, gitlab, azure-devops).'),
    tier: strEnum(['essential', 'advanced', 'complete'], {
        description: 'essential: basics | advanced: common extras | complete: every attribute',
        default: 'essential'
    }),
    strictValidation: bool({ description: 'Validate with the Terragrunt CLI when installed and fail if invalid', default: false }),
    write: bool({ description: 'Write to path instead of only returning the config', default: false }),
    path: str('Target .hcl file inside an allowed directory'),
    overwrite: bool({ description: 'Replace an existing file at path', default: false }),
    createBackup: bool({ description: 'Back up an existing file before overwriting', default: true }),
    createParentDirs: bool({ description: 'Create missing parent directories of path', default: true }),
    preview: bool({
        description: 'Dry-run: never write; return what would be written plus a diff and overwrite/backup info',
        default: false
    }),
    compareWith: str('Path of an existing file to diff the result against (defaults to path in preview mode)')
});

const diagnoseInput = z.looseObject({
    error_message: z.string().meta({
        description: 'Full error text from the failed command, e.g. "Error acquiring the state lock"'
    }),
    command: str('Command that failed, e.g. "terragrunt run --all apply"'),
    version: str('Terragrunt version, e.g. "0.93.1"'),
    os: str('Operating system, e.g. "linux" or "darwin"'),
    filePath: str('Config file involved, e.g. "live/prod/vpc/terragrunt.hcl"'),
    module: str('Module or unit name, e.g. "vpc"'),
    backend: str('Remote state backend, e.g. "s3" or "gcs"'),
    maxMatches: num({ description: 'Maximum causes to return, e.g. 5', default: 3 }),
    minConfidence: num({ description: 'Minimum confidence from 0 to 1, e.g. 0.7', default: 0.5 }),
    enableFuzzyMatching: bool({ description: 'Also match errors similar to known patterns', default: true }),
    detailLevel: strEnum(['summary', 'full'], {
        description: 'summary: matches with causes and solutions | full: adds debugging steps, related errors, and documentation links',
        default: 'summary'
    }),
    // No schema default: clients that fill in defaults would send true and
    // always select full detail
    enrichWithDocs: bool({
        description: 'Full detail only: add documentation-sourced solutions and links (on by default in full; true selects full detail when detailLevel is unset)'
    }),
    includeDestructiveCommands: bool({ description: 'Include solutions marked destructive', default: true })
});

const serverMetricsInput = z.looseObject({
    filter: str('Only metrics whose name contains this text, e.g. "search_docs"'),
    format: strEnum(['json', 'text'], {
        description: 'json: structured | text: readable summary',
        default: 'json'
    }),
    reset: bool({ description: 'Clear all metrics after reading them', default: false })
});

const READ_ONLY: ToolAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'search_docs',
        description: 'Search Terragrunt documentation for HCL blocks, CLI commands, functions, and IaC patterns. Modes: search, list sections, get section content, or find code examples.',
        annotations: READ_ONLY,
        input: searchDocsInput
    },
    {
        name: 'function_reference',
        description: 'Get Terragrunt built-in function details (find_in_parent_folders, dependency, read_terragrunt_config, etc.) or list all available functions by category.',
        annotations: READ_ONLY,
        input: functionReferenceInput
    },
    {
        name: 'cli_reference',
        description: 'Get current Terragrunt CLI command help (run --all, browse, plan, apply, hcl validate, etc.) or list commands by category.',
        annotations: READ_ONLY,
        input: cliReferenceInput
    },
    {
        name: 'get_hcl_config_reference',
        description: 'Get current Terragrunt HCL block and attribute documentation with syntax and examples, including stacks, feature flags, exclusions, error handling, catalogs, and engines.',
        annotations: READ_ONLY,
        input: hclConfigReferenceInput
    },
    {
        name: 'get_guidance',
        description: 'Get Terragrunt best practices, block comparisons (dependency vs dependencies), DRY patterns, or experiment status (type=experiments lists active/completed experiments and how to enable them) for infrastructure-as-code organization.',
        annotations: READ_ONLY,
        input: guidanceInput
    },
    {
        name: 'build_config',
        description: 'Generate or write Terragrunt HCL configuration files (terragrunt.hcl). Use cases: remote_state backends (S3, GCS, Azure), provider generation, dependency blocks, hooks, inputs, and cicd (CI/CD-ready config for GitHub Actions, GitLab, Azure DevOps).',
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: false
        },
        input: buildConfigInput
    },
    {
        name: 'diagnose_terragrunt_error',
        description: 'Diagnose Terragrunt and Terraform error messages with root cause analysis and solutions. Handles dependency cycles, state lock errors, provider issues, and HCL syntax problems.',
        annotations: READ_ONLY,
        input: diagnoseInput
    },
    {
        name: 'get_server_metrics',
        description: 'Get Terragrunt MCP server metrics: cache hit rates, tool invocation counts, response times, and memory usage for observability.',
        // reset: true clears the collected metrics, so this tool is not read-only
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false
        },
        input: serverMetricsInput
    }
];

const DEFINITIONS_BY_NAME = new Map(TOOL_DEFINITIONS.map(def => [def.name, def]));

export function getToolDefinition(name: string): ToolDefinition | undefined {
    return DEFINITIONS_BY_NAME.get(name);
}

/** Advertised JSON Schema of a tool's input, in the shape tools/list has always had. */
export function toInputJsonSchema(def: ToolDefinition): {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
} {
    const json = z.toJSONSchema(def.input, { io: 'input', target: 'draft-7', unrepresentable: 'any' }) as Record<string, any>;
    const properties: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries<any>(json.properties ?? {})) {
        properties[key] = cleanProperty(prop);
    }
    return { type: 'object', properties, required: json.required ?? [] };
}

/** Drop the `null` alternative that `.nullish()` adds; clients see an optional plain type. */
function cleanProperty(prop: Record<string, any>): Record<string, any> {
    const out = { ...prop };
    if (DEFAULT_KEY in out) {
        if (out[DEFAULT_KEY] !== undefined) out.default = out[DEFAULT_KEY];
        delete out[DEFAULT_KEY];
    }
    if (Array.isArray(out.type)) {
        const types = out.type.filter((t: string) => t !== 'null');
        out.type = types.length === 1 ? types[0] : types;
    }
    if (Array.isArray(out.anyOf)) {
        const rest = out.anyOf.filter((s: any) => s?.type !== 'null');
        if (rest.length === 1) {
            delete out.anyOf;
            Object.assign(out, rest[0], { ...out });
        } else {
            out.anyOf = rest;
        }
    }
    if (out.type === 'object' && out.additionalProperties && typeof out.additionalProperties === 'object'
        && Object.keys(out.additionalProperties).length === 0) {
        out.additionalProperties = true;
        delete out.propertyNames;
    }
    return out;
}

/** Format zod issues as one message; paths are prefixed unless the message already names it. */
export function formatValidationIssues(issues: z.core.$ZodIssue[]): string {
    return issues.map(issue => {
        const path = issue.path.map(String).join('.');
        if (!path || issue.message.startsWith(path)) return issue.message;
        return `${path}: ${issue.message}`;
    }).join('; ');
}
