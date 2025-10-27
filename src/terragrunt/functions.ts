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
   * Extract a specific function from documentation by name.
   * Searches documentation for the named function and extracts its details on-demand.
   * Useful for lazy loading or as a fallback when loadFunctions() didn't find a function.
   * 
   * @param name The function name to search for (case-insensitive)
   * @returns TerragruntFunction if found, otherwise null
   */
  async extractFunctionFromDocs(name: string): Promise<TerragruntFunction | null> {
    if (!name || !name.trim()) {
      return null;
    }

    const searchName = name.trim();
    const normalizedName = this.normalizeKey(searchName);

    // First check if it's already in cache
    const cached = this.functionsCache.get(normalizedName);
    if (cached) {
      return cached;
    }

    // Search documentation for the function
    const allDocs = await this.docsManager.fetchLatestDocs();
    
    // Prefer the canonical HCL functions reference page(s)
    const functionDocs = allDocs.filter(d =>
      d.section === 'reference' && (
        d.url.includes('/docs/reference/hcl/functions/') ||
        d.title.toLowerCase().includes('built-in function') ||
        d.title.toLowerCase().includes('function')
      )
    );

    // Search for the specific function in documentation content
    for (const doc of functionDocs) {
      const content = doc.content;
      
      // Look for the function name as a potential signature
      // Use case-insensitive regex to find the function name
      const functionNamePattern = new RegExp(
        `\\b${searchName}\\s*\\([^)]*\\)`,
        'i'
      );
      
      if (!functionNamePattern.test(content)) {
        continue; // Function not mentioned in this doc
      }

      // Extract functions from this document
      const extracted = this.extractFunctionsFromContent(content);
      
      // Find the specific function we're looking for
      const found = extracted.find(fn => 
        this.normalizeKey(fn.name) === normalizedName
      );

      if (found) {
        // Add to cache for future lookups
        this.upsertFunction(found);
        return found;
      }
    }

    // Not found in any documentation
    return null;
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
  const altSignatureRegex = /(?:^|[^a-zA-Z0-9_])(?<name>[a-zA-Z_][a-zA-Z0-9_]*)\s*\((?<params>[^)]*)\)\s*(?:[-–—,:])?\s*(?:returns?|return\s+type)\s+(?<ret2>[A-Za-z0-9_<>|[\]{}]+)/gi;
    
    // Fallback: register function names that appear in explicit usage context (more selective)
    // Look for patterns like "use function_name()", "call function_name()", "function_name() function", etc.
    // Use word boundaries to avoid matching "function" as a substring (e.g., in "test_function")
    const inlineCallRegex = /\b(?:use|call|invoke|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi;

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

    // Helper to extract description from context around a function signature
    const extractDescription = (context: string, functionName: string, matchIndex: number): string => {
      // Look for description BEFORE the signature match
      // Split context at the match point
      const beforeMatch = context.slice(0, matchIndex);
      const afterMatch = context.slice(matchIndex);
      
      const lowerBefore = beforeMatch.toLowerCase();
      const lowerName = functionName.toLowerCase();
      
      // Try to find "Description:" label before the signature
      const descIdx = lowerBefore.lastIndexOf('description:');
      if (descIdx !== -1) {
        const start = descIdx + 'description:'.length;
        const slice = beforeMatch.slice(start).trim();
        // Extract until we hit the signature or section marker
        const endMarkers = ['parameters:', functionName.toLowerCase() + '(', '##', '\n\n'];
        let end = slice.length;
        for (const marker of endMarkers) {
          const pos = slice.toLowerCase().indexOf(marker);
          if (pos !== -1 && pos > 0 && pos < end) {
            end = pos;
          }
        }
        const desc = slice.slice(0, end).trim();
        if (desc && desc.length > 10 && desc.length < 500) {
          return desc.replace(/\s+/g, ' ');
        }
      }
      
      // Try to find text between function name heading (##) and signature
      const headingPattern = new RegExp(`##\\s*${functionName}\\s*`, 'i');
      const headingMatch = headingPattern.exec(beforeMatch);
      if (headingMatch) {
        // Get text after the heading but before the signature
        const afterHeading = beforeMatch.slice(headingMatch.index + headingMatch[0].length).trim();
        // Look for complete sentences
        const sentences = afterHeading.match(/[A-Z][^.!?]{10,300}[.!?]/g);
        if (sentences && sentences.length > 0) {
          const firstSent = sentences[0].trim();
          if (!firstSent.toLowerCase().includes(functionName.toLowerCase() + '(')) {
            return firstSent;
          }
        }
      }
      
      // Fallback: look for descriptive sentence immediately before the signature
      // Get last 200 chars before match
      const beforeSig = beforeMatch.slice(Math.max(0, beforeMatch.length - 200)).trim();
      const sentences = beforeSig.match(/[A-Z][^.!?]{15,250}[.!?]/g);
      if (sentences && sentences.length > 0) {
        // Take the last substantial sentence
        const lastSent = sentences[sentences.length - 1].trim();
        if (lastSent.length > 20 && 
            !lastSent.toLowerCase().includes('parameters:') &&
            !lastSent.toLowerCase().includes('example:') &&
            !lastSent.toLowerCase().includes(functionName.toLowerCase() + '(')) {
          return lastSent;
        }
      }
      
      return '';
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

    // Helper to categorize a function based on name patterns, description, and context
    const categorizeFunction = (name: string, description: string, context: string): string => {
      const lowerName = name.toLowerCase();
      const lowerDesc = description.toLowerCase();
      const lowerCtx = context.toLowerCase();
      
      // Category detection by function name patterns
      if (lowerName.startsWith('path_') || 
          lowerName.startsWith('get_terragrunt_dir') ||
          lowerName.startsWith('get_parent_terragrunt') ||
          lowerName.includes('_path') ||
          lowerName === 'abspath' ||
          lowerName === 'dirname' ||
          lowerName === 'basename') {
        return 'path';
      }
      
      if (lowerName.startsWith('get_env') ||
          lowerName.startsWith('get_aws_') ||
          lowerName.includes('account') ||
          lowerName.includes('identity') ||
          lowerName.includes('region')) {
        return 'environment';
      }
      
      if (lowerName.startsWith('get_terraform_') ||
          lowerName.includes('terraform')) {
        return 'terraform';
      }
      
      if (lowerName === 'find_in_parent_folders' ||
          lowerName.startsWith('read_') ||
          lowerName.startsWith('file') ||
          lowerName === 'fileexists' ||
          lowerName === 'filebase64' ||
          lowerName === 'templatefile') {
        return 'file';
      }
      
      if (lowerName === 'dependency') {
        return 'dependency';
      }
      
      if (lowerName.includes('encode') || lowerName.includes('decode')) {
        return 'encoding';
      }
      
      if (lowerName === 'regex' ||
          lowerName === 'replace' ||
          lowerName === 'join' ||
          lowerName === 'split' ||
          lowerName === 'trim' ||
          lowerName === 'format' ||
          lowerName === 'substr') {
        return 'string';
      }
      
      if (lowerName === 'concat' ||
          lowerName === 'flatten' ||
          lowerName === 'distinct' ||
          lowerName === 'compact' ||
          lowerName === 'reverse' ||
          lowerName === 'sort' ||
          lowerName === 'slice') {
        return 'list';
      }
      
      if (lowerName === 'merge' ||
          lowerName === 'lookup' ||
          lowerName === 'keys' ||
          lowerName === 'values') {
        return 'map';
      }
      
      // Category hints from description
      if (lowerDesc.includes('path') || lowerDesc.includes('directory')) {
        return 'path';
      }
      
      if (lowerDesc.includes('environment') || lowerDesc.includes('aws account')) {
        return 'environment';
      }
      
      if (lowerDesc.includes('file') || lowerDesc.includes('read')) {
        return 'file';
      }
      
      if (lowerDesc.includes('list') || lowerDesc.includes('array')) {
        return 'list';
      }
      
      if (lowerDesc.includes('string') || lowerDesc.includes('text')) {
        return 'string';
      }
      
      // Category hints from context headings
      if (lowerCtx.includes('## path functions') || lowerCtx.includes('path helpers')) {
        return 'path';
      }
      
      if (lowerCtx.includes('## environment') || lowerCtx.includes('environment variables')) {
        return 'environment';
      }
      
      if (lowerCtx.includes('## terraform')) {
        return 'terraform';
      }
      
      if (lowerCtx.includes('## file') || lowerCtx.includes('file functions')) {
        return 'file';
      }
      
      // Default fallback
      return 'general';
    };

    // Helper to extract examples from "Example:" or "Examples:" sections
    const extractExamples = (context: string, functionName: string): FunctionExample[] => {
      const examples: FunctionExample[] = [];
      
      // Look for "Example:" or "Examples:" section
      const exampleSectionRegex = /examples?[:\s]+(.+?)(?=##|see\s+also|parameters:|usage:|$)/is;
      const exampleMatch = exampleSectionRegex.exec(context);
      
      if (exampleMatch && exampleMatch[1]) {
        const exampleContent = exampleMatch[1].trim();
        
        // Split by common delimiters that indicate separate examples
        // Look for patterns like "Example 1:", "Another example:", or numbered examples
        const exampleDelimiters = /(?:example\s+\d+|another\s+example|additionally)[:\s]+/gi;
        const splits = exampleContent.split(exampleDelimiters);
        
        for (const section of splits) {
          if (!section.trim()) continue;
          
          // Extract code blocks (indented, fenced, or inline)
          // Pattern 1: Fenced code blocks (```...```)
          const fencedMatch = /```[\w]*\s*(.+?)```/s.exec(section);
          if (fencedMatch) {
            const code = fencedMatch[1].trim();
            // Look for description before the code block
            const descMatch = /^([^`]+?)(?=```)/s.exec(section);
            const description = descMatch ? descMatch[1].trim() : 'Example usage';
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
            continue;
          }
          
          // Pattern 2: Indented code blocks (multiple lines starting with spaces/tabs)
          const indentedMatch = /(?:^|\n)([ \t]+.+?)(?=\n[^\s\t]|$)/s.exec(section);
          if (indentedMatch) {
            const code = indentedMatch[1].trim();
            // Extract description from text before indented code
            const beforeCode = section.slice(0, indentedMatch.index).trim();
            const description = beforeCode || 'Example usage';
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
            continue;
          }
          
          // Pattern 3: Inline function calls
          const inlineRegex = new RegExp(`${functionName}\\s*\\(([^)]{0,120})\\)`, 'i');
          const inlineMatch = inlineRegex.exec(section);
          if (inlineMatch) {
            const code = `${functionName}(${inlineMatch[1]})`;
            const description = section.trim().slice(0, 100);
            
            examples.push({
              code,
              description,
              useCase: 'documented'
            });
          }
        }
      }
      
      // Fallback: If no examples found in explicit section, look for inline usage
      if (examples.length === 0) {
        const usageRegex = new RegExp(`${functionName}\\s*\\(([^)]{0,120})\\)`, 'i');
        const usageMatch = usageRegex.exec(context);
        if (usageMatch) {
          examples.push({
            code: `${functionName}(${usageMatch[1]})`,
            description: 'Inline example',
            useCase: 'inline'
          });
        }
      }
      
      return examples;
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

      // Extract description from context before/around the signature
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));

      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);

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

      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);

      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description,
        parameters,
        returnType,
        category,
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
      
      // Extract description from context before/around the signature
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));
      
      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);
      
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
      
      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);
      
      results.push({
        name,
        signature: `${name}(${paramsRaw})${returnType !== 'unknown' ? ` -> ${returnType}` : ''}`.trim(),
        description,
        parameters,
        returnType,
        category,
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
      
      // Extract description from surrounding context
      const descCtx = text.slice(Math.max(0, match.index - 500), match.index + 200);
      const description = extractDescription(descCtx, name, Math.min(500, match.index));
      
      // Extract examples from context around the function
      const exampleCtx = text.slice(match.index, match.index + 600);
      const examples = extractExamples(exampleCtx, name);
      
      // Best-effort: attempt to extract parameter names/types from nearby context
      let paramCtx = text.slice(Math.max(0, match.index - 300), match.index + 400);
      const pLower = paramCtx.toLowerCase();
      const lastParamsIdx = pLower.lastIndexOf('parameters');
      if (lastParamsIdx !== -1) {
        paramCtx = paramCtx.slice(lastParamsIdx);
      }
      const inferredParams = parseParamsFromContext(paramCtx);
      
      // Categorize based on name, description, and context
      const category = categorizeFunction(name, description, descCtx);
      
      results.push({
        name,
        signature: `${name}(...)`,
        description,
        parameters: inferredParams,
        returnType: 'unknown',
        category,
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
