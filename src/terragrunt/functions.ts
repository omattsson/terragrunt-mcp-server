import { TerragruntDocsManager } from './docs.js';

/**
 * Describes a single parameter accepted by a Terragrunt built-in function
 */
export interface FunctionParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string | number | boolean | null;
}

/**
 * Represents a code example demonstrating how to use a function
 */
export interface FunctionExample {
  code: string;
  description: string;
  useCase: string;
}

/**
 * Canonical representation of a Terragrunt built-in function
 */
export interface TerragruntFunction {
  name: string;
  signature: string;
  description: string;
  parameters: FunctionParameter[];
  returnType: string;
  category: string;
  examples: FunctionExample[];
  relatedFunctions: string[];
}

/**
 * Manages Terragrunt built-in function metadata with an in-memory cache.
 *
 * Notes:
 * - Cache keys are stored in lowercase for case-insensitive lookups.
 * - Population of the cache is deferred to loadFunctions() (see issue #13).
 */
export class TerragruntFunctionsManager {
  private readonly docsManager: TerragruntDocsManager;
  private readonly functionsCache: Map<string, TerragruntFunction> = new Map();

  constructor(docsManager: TerragruntDocsManager) {
    this.docsManager = docsManager;
  }

  /**
   * Load and parse Terragrunt built-in function definitions into the cache.
   * Extracts functions from the HCL functions reference documentation page.
   */
  async loadFunctions(): Promise<void> {
    // Load Terragrunt documentation from the docs manager
    const allDocs = await this.docsManager.fetchLatestDocs();

    // Prefer the canonical HCL functions reference page(s)
    const functionDocs = allDocs.filter(d =>
      d.section === 'reference' && (
        d.url.includes('/docs/reference/hcl/functions/') ||
        d.title.toLowerCase().includes('built-in function') ||
        d.title.toLowerCase().includes('function')
      )
    );

    // Clear and repopulate cache
    this.functionsCache.clear();

    for (const doc of functionDocs) {
      const extracted = this.extractFunctionsFromContent(doc.content);
      for (const fn of extracted) {
        const key = this.normalizeKey(fn.name);
        if (!this.functionsCache.has(key)) {
          this.functionsCache.set(key, {
            ...fn,
            category: fn.category || 'functions'
          });
        }
      }
    }

    // If nothing was extracted, leave cache empty; callers handle empty states
    return;
  }  /**
   * Retrieve a function definition by name, case-insensitively.
   * @param name The function name (e.g., "get_env", "find_in_parent_folders")
   * @returns TerragruntFunction if found, otherwise null
   */
  getFunction(name: string): TerragruntFunction | null {
    if (!name || !name.trim()) {
      return null;
    }
    const key = this.normalizeKey(name);
    return this.functionsCache.get(key) ?? null;
  }

  /**
   * List all known functions, optionally filtered by category (case-insensitive).
   * Results are sorted by function name ascending.
   * @param category Optional category filter (e.g., "filesystem", "env")
   */
  listFunctions(category?: string): TerragruntFunction[] {
    let items = Array.from(this.functionsCache.values());

    if (category && category.trim()) {
      const filter = category.trim().toLowerCase();
      items = items.filter(f => (f.category || '').toLowerCase() === filter);
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Perform a simple text search across common fields.
   * Empty or whitespace-only queries return an empty result set.
   */
  searchFunctions(query: string): TerragruntFunction[] {
    if (!query || !query.trim()) {
      return [];
    }

    const q = query.toLowerCase();

    const matches: TerragruntFunction[] = [];
    for (const fn of this.functionsCache.values()) {
      if (this.matchesFunction(fn, q)) {
        matches.push(fn);
      }
    }

    // Sort deterministically by name
    return matches.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Helper to add or replace a function in cache using normalized key.
   * Not part of the public API specified by the issue, but useful for tests
   * and for the upcoming implementation in issue #13.
   */
  private upsertFunction(fn: TerragruntFunction): void {
    const key = this.normalizeKey(fn.name);
    this.functionsCache.set(key, fn);
  }

  /**
   * Best-effort extractor for function definitions from plain text content.
   * Handles flattened content (newlines collapsed by cleanContent) with global regex.
   * Infers return types from signature or nearby "returns <Type>" context.
   */
  private extractFunctionsFromContent(content: string): TerragruntFunction[] {
    const results: TerragruntFunction[] = [];
    if (!content) return results;

    // Content is flattened by docs.cleanContent(); use global regex to scan across text
    const text = content.replace(/\r/g, ' ');

    // Match signature patterns: name(params) -> ReturnType or name(params)
    // Use non-capturing negative lookbehind to avoid matching mid-identifier
  const signatureRegex = /(?:^|[^a-zA-Z0-9_])(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?:->|→)\s*(?<ret>[^\s.,;:(){}[\]]+)?/g;
  // Alternate: name(params) [ -|—|–|:] (returns|return type) Type
  const altSignatureRegex = /(?:^|[^a-zA-Z0-9_])(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?:[-–—,:])?\s*(?:returns?|return\s+type)\s+(?<ret2>[A-Za-z0-9_{}<>|.\][[]]+)/gi;
    
    // Fallback: register function names that appear as calls
    const inlineCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;

    const seen = new Set<string>();

    // Helper to parse parameter list from inline signature
    const parseParams = (paramsRaw: string): FunctionParameter[] => {
      const out: FunctionParameter[] = [];
      const raw = (paramsRaw || '').trim();
      if (!raw) return out;
      
      const parts = raw.split(/\s*,\s*/);
      for (const part of parts) {
        if (!part) continue;
        
        let nameGuess = part;
        let typeGuess = 'unknown';
        
        // Try "name: type" format
        const colonIdx = part.indexOf(':');
        if (colonIdx > -1) {
          nameGuess = part.substring(0, colonIdx).trim();
          typeGuess = part.substring(colonIdx + 1).trim() || 'unknown';
        } else {
          // Try "type name" or just "name"
          const tokens = part.trim().split(/\s+/);
          if (tokens.length >= 2) {
            nameGuess = tokens[0];
            typeGuess = tokens.slice(1).join(' ');
          } else {
            nameGuess = tokens[0];
          }
        }
        
        out.push({ 
          name: nameGuess, 
          type: typeGuess, 
          required: true, 
          description: '', 
          default: undefined 
        });
      }
      return out;
    };

    // Fallback: parse parameters from context block following a "Parameters" label
    const parseParamsFromContext = (context: string): FunctionParameter[] => {
      const out: FunctionParameter[] = [];
      const lowerCtx = context.toLowerCase();
      const idx = lowerCtx.indexOf('parameters');
      if (idx === -1) return out;
      // Limit to the likely end of the parameters block to avoid capturing trailing prose
      const searchStart = idx + 'parameters'.length;
      const markers = ['usage:', 'example:', 'examples:', 'see also', 'related', 'returns '];
      let end = idx + 260; // default small window
      for (const m of markers) {
        const pos = lowerCtx.indexOf(m, searchStart);
        if (pos !== -1) {
          end = Math.min(end, pos);
        }
      }
      const slice = context.slice(idx, Math.max(idx + 1, end));
      
      // First try to match structured parameter lists: "Parameters: list1 (list), list2 (list)"
      const structuredMatch = /parameters:\s*([^]+?)(?=usage:|example:|see also|related|returns |$)/i.exec(context.slice(idx, end));
      if (structuredMatch) {
        const paramText = structuredMatch[1];
        // Match patterns like "name (type)" or "name: type"
        const paramRe = /\b([a-zA-Z_][\w-]*)\s*(?:\(([^)]+)\)|:\s*([^;,.\n]+))/g;
        let pm: RegExpExecArray | null;
        const seenNames = new Set<string>();
        while ((pm = paramRe.exec(paramText)) !== null) {
          const name = pm[1].trim();
          const lname = name.toLowerCase();
          const stopwords = new Set(['parameters','parameter','example','examples','usage','see','also','related']);
          if (!name || seenNames.has(lname) || stopwords.has(lname)) continue;
          const type = (pm[2] || pm[3] || 'unknown').trim();
          seenNames.add(lname);
          out.push({ name, type, required: true, description: '', default: undefined });
          if (out.length >= 6) break;
        }
      }
      
      // Fallback to original regex if nothing found
      if (out.length === 0) {
        const re = /([a-zA-Z_][\w-]*)\s*(?:\(([^)]+)\)|:\s*([^;,.\n]+))?/g;
        let m: RegExpExecArray | null;
        const seenNames = new Set<string>();
        const stopwords = new Set(['parameters','parameter','example','examples','usage','see','also','related']);
        while ((m = re.exec(slice)) !== null) {
          const name = (m[1] || '').trim();
          const lname = name.toLowerCase();
          if (!name || seenNames.has(lname) || stopwords.has(lname)) continue;
          const type = (m[2] || m[3] || 'unknown').trim();
          seenNames.add(lname);
          out.push({ name, type, required: true, description: '', default: undefined });
          if (out.length >= 6) break;
        }
      }
      return out;
    };

  // Scan for signature patterns with explicit return types (arrow style)
    let match: RegExpExecArray | null;
    while ((match = signatureRegex.exec(text)) !== null) {
      const groups = match.groups as { name?: string; params?: string; ret?: string } | undefined;
      if (!groups?.name) continue;
      
      const name = groups.name;
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;

      const paramsRaw = (groups.params || '').trim();
      let returnType = (groups.ret || '').trim();
      
      // If no explicit return type, try to infer from nearby context
      if (!returnType) {
        const contextWindow = text.slice(
          match.index + match[0].length, 
          match.index + match[0].length + 160
        );
  const retMatch = /returns?\s+(?:a\s+)?([A-Za-z0-9_{}<>|.\][[]]+)/i.exec(contextWindow);
        if (retMatch) {
          returnType = retMatch[1];
        }
      }
      if (!returnType) returnType = 'unknown';

      let parameters = parseParams(paramsRaw);
      // Try to enrich parameters from nearby explicit "Parameters" context
      const ctx = text.slice(match.index, match.index + 500);
      const ctxParams = parseParamsFromContext(ctx);
      if (parameters.length === 0 || ctxParams.length > parameters.length) {
        parameters = ctxParams;
      }

      // Try to extract small inline example usage within the nearby context
      const examples: FunctionExample[] = [];
      const usageCtx = text.slice(match.index, match.index + 240);
      const usageRe = new RegExp(`${name}\\s*\\(([^)]{0,120})\\)`, 'i');
      const u = usageRe.exec(usageCtx);
      if (u) {
        examples.push({ code: `${name}(${u[1]})`, description: 'Inline example', useCase: 'inline' });
      }

      // Related functions via "See also" pattern in nearby context
  const relRe = /(see\s+also|related)[:\s]+([^\n.]{0,120})/i;
      const relCtx = text.slice(match.index, match.index + 300);
      const rel = relRe.exec(relCtx);
      const related: string[] = [];
      if (rel && rel[2]) {
        const cand = rel[2];
        const idRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)?/g;
        let r: RegExpExecArray | null;
        while ((r = idRe.exec(cand)) !== null) {
          const nm = r[1];
          if (nm && nm.toLowerCase() !== name.toLowerCase() && !related.includes(nm)) related.push(nm);
        }
      }

      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description: '',
        parameters,
        returnType,
        category: 'functions',
        examples,
        relatedFunctions: related
      });
      seen.add(key);
    }

    // Alternate signature style with explicit "returns" wording
    while ((match = altSignatureRegex.exec(text)) !== null) {
      const groups = match.groups as { name?: string; params?: string; ret2?: string } | undefined;
      if (!groups?.name) continue;
      const name = groups.name;
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;
      const paramsRaw = (groups.params || '').trim();
      const returnType = (groups.ret2 || 'unknown').trim();
      let parameters = parseParams(paramsRaw);
      // Try to enrich parameters from nearby explicit "Parameters" context
      const ctx = text.slice(match.index, match.index + 500);
      const ctxParams = parseParamsFromContext(ctx);
      if (parameters.length === 0 || ctxParams.length > parameters.length) {
        parameters = ctxParams;
      }
      const examples: FunctionExample[] = [];
      const usageCtx = text.slice(match.index, match.index + 240);
      const usageRe = new RegExp(`${name}\\s*\\(([^)]{0,120})\\)`, 'i');
      const u = usageRe.exec(usageCtx);
      if (u) examples.push({ code: `${name}(${u[1]})`, description: 'Inline example', useCase: 'inline' });
  const relRe = /(see\s+also|related)[:\s]+([^\n.]{0,120})/i;
      const relCtx = text.slice(match.index, match.index + 300);
      const rel = relRe.exec(relCtx);
      const related: string[] = [];
      if (rel && rel[2]) {
        const cand = rel[2];
        const idRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)?/g;
        let r: RegExpExecArray | null;
        while ((r = idRe.exec(cand)) !== null) {
          const nm = r[1];
          if (nm && nm.toLowerCase() !== name.toLowerCase() && !related.includes(nm)) related.push(nm);
        }
      }
      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description: '',
        parameters,
        returnType,
        category: 'functions',
        examples,
        relatedFunctions: related
      });
      seen.add(key);
    }

    // Fallback: capture function names from inline calls
    while ((match = inlineCallRegex.exec(text)) !== null) {
      const name = match[1];
      const key = this.normalizeKey(name);
      if (seen.has(key)) continue;
      
      seen.add(key);
      // Try to capture a tiny inline example of invocation
      const usageCtx = text.slice(match.index, match.index + 200);
      const usageRe = new RegExp(`${name}\\s*\\(([^)]{0,120})\\)`, 'i');
      const u = usageRe.exec(usageCtx);
      const examples: FunctionExample[] = u ? [{ code: `${name}(${u[1]})`, description: 'Inline example', useCase: 'inline' }] : [];
      // Best-effort: attempt to extract parameter names/types from nearby context
      let paramCtx = text.slice(Math.max(0, match.index - 300), match.index + 400);
      const pLower = paramCtx.toLowerCase();
      const lastParamsIdx = pLower.lastIndexOf('parameters');
      if (lastParamsIdx !== -1) {
        paramCtx = paramCtx.slice(lastParamsIdx);
      }
      const inferredParams = parseParamsFromContext(paramCtx);
      results.push({
        name,
        signature: `${name}(...)`,
        description: '',
        parameters: inferredParams,
        returnType: 'unknown',
        category: 'functions',
        examples,
        relatedFunctions: []
      });
    }

    // Sort deterministically by name
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }  private matchesFunction(fn: TerragruntFunction, q: string): boolean {
    const inText = (text?: string) => !!text && text.toLowerCase().includes(q);

    const paramMatch = fn.parameters?.some(p =>
      inText(p.name) || inText(p.type) || inText(p.description)
    );

    const exampleMatch = fn.examples?.some(ex =>
      inText(ex.code) || inText(ex.description) || inText(ex.useCase)
    );

    const relatedMatch = fn.relatedFunctions?.some(r => inText(r));

    return (
      inText(fn.name) ||
      inText(fn.signature) ||
      inText(fn.description) ||
      inText(fn.returnType) ||
      inText(fn.category) ||
      paramMatch ||
      exampleMatch ||
      relatedMatch
    );
  }

  private normalizeKey(name: string): string {
    return name.trim().toLowerCase();
  }
}
