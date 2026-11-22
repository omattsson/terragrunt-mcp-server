const warned = new Set<string>();

/**
 * Reads the setting TERRAGRUNT_MCP_<name>. The old unprefixed name
 * TERRAGRUNT_<name> still works as a deprecated alias for one release and
 * logs a one-time warning to stderr (stdout is the MCP stdio channel).
 */
export function readEnv(name: string): string | undefined {
  const current = process.env[`TERRAGRUNT_MCP_${name}`];
  if (current !== undefined) return current;

  const legacy = process.env[`TERRAGRUNT_${name}`];
  if (legacy !== undefined && !warned.has(name)) {
    warned.add(name);
    console.error(
      `[terragrunt-mcp] TERRAGRUNT_${name} is deprecated; use TERRAGRUNT_MCP_${name}. The old name will be removed in a future release.`
    );
  }
  return legacy;
}
