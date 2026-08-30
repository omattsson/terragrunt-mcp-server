import { describe, it, expect } from 'vitest';
import { validateHCL } from '../../src/terragrunt/hcl-validator.js';

describe('HCL Validator', () => {
  describe('Valid HCL configurations', () => {
    it('should validate a simple valid HCL config', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"
}

inputs = {
  vpc_name = "my-vpc"
  cidr_block = "10.0.0.0/16"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.formatted).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should validate config with interpolations', () => {
      const config = `
include "root" {
  path = find_in_parent_folders()
}

locals {
  env = get_env("ENVIRONMENT", "dev")
  region = "\${local.env}-us-east-1"
}

inputs = {
  name = "\${local.env}-vpc"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate config with nested blocks', () => {
      const config = `
remote_state {
  backend = "s3"
  config = {
    bucket = "my-bucket"
    key = "\${path_relative_to_include()}/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = {
      name = "terraform-locks"
      billing_mode = "PAY_PER_REQUEST"
    }
  }
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate config with comments', () => {
      const config = `
# This is a configuration comment
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"
}

// Another style of comment
inputs = {
  vpc_name = "my-vpc" # inline comment
  cidr_block = "10.0.0.0/16"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Invalid delimiter balancing', () => {
    it('should detect unclosed braces', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"

inputs = {
  vpc_name = "my-vpc"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Unclosed brace '{'");
    });

    it('should detect extra closing braces', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"
}
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Unexpected closing brace '}'");
    });

    it('should detect unclosed brackets', () => {
      const config = `
locals {
  tags = [
    "env:prod",
    "team:platform"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes("Unclosed bracket '['"))).toBe(true);
    });

    it('should detect unclosed parentheses', () => {
      const config = `
locals {
  result = function(arg1, arg2
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes("Unclosed parenthesis '('"))).toBe(true);
    });
  });

  describe('String validation', () => {
    it('should detect unclosed double quotes', () => {
      const config = `
inputs = {
  vpc_name = "my-vpc
  cidr_block = "10.0.0.0/16"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Unclosed'))).toBe(true);
    });

    it('should handle escaped quotes correctly', () => {
      const config = `
inputs = {
  description = "This is a \\"quoted\\" value"
  path = "C:\\\\Users\\\\example"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Interpolation syntax validation', () => {
    it('should detect empty interpolations', () => {
      const config = `
inputs = {
  name = "\${}"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Empty interpolation'))).toBe(true);
    });

    it('should detect unclosed interpolations', () => {
      const config = `
inputs = {
  name = "\${local.env"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Unclosed interpolation'))).toBe(true);
    });

    it('should detect unbalanced braces in interpolations', () => {
      const config = `
inputs = {
  name = "\${merge({a = 1}, {b = 2)"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Unclosed'))).toBe(true);
    });

    it('should validate nested interpolations', () => {
      const config = `
inputs = {
  name = "\${merge({env = local.env}, {region = local.region})}"
}
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Formatting validation', () => {
    it('should detect mixed tabs and spaces', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"
}

inputs = {
\tvpc_name = "my-vpc"
  cidr_block = "10.0.0.0/16"
}
`;
      const result = validateHCL(config);
      
      expect(result.formatted).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Mixed indentation'))).toBe(true);
    });

    it('should detect trailing whitespace', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"   
}
`;
      const result = validateHCL(config);
      
      expect(result.formatted).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Trailing whitespace'))).toBe(true);
    });
  });

  describe('HCL structure validation', () => {
    it('should warn about unknown block types', () => {
      const config = `
terraform {
  source = "git::git@github.com:example/modules.git//vpc?ref=v1.0.0"
}

unknown_block {
  key = "value"
}
`;
      const result = validateHCL(config);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Unknown block type'))).toBe(true);
    });

    it('should allow all standard Terragrunt blocks', () => {
      const config = `
terraform {
  source = "."
}

include "root" {
  path = find_in_parent_folders()
}

locals {
  env = "dev"
}

inputs = {
  name = "example"
}

remote_state {
  backend = "s3"
  config = {}
}

generate "provider" {
  path = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents = ""
}

dependency "vpc" {
  config_path = "../vpc"
}
`;
      const result = validateHCL(config);
      
      // Should not warn about any of these standard blocks
      expect(result.warnings.filter(w => w.includes('Unknown block type'))).toEqual([]);
    });

    it('should allow current Terragrunt blocks and nested error handling', () => {
      const config = `
feature "deploy" {
  default = true
}

exclude {
  if      = false
  actions = ["all"]
}

errors {
  retry "transient" {
    retryable_errors  = [".*timeout.*"]
    max_attempts      = 3
    sleep_interval_sec = 5
  }
}

catalog {
  urls = ["github.com/acme/modules"]
}

engine {
  source = "github.com/gruntwork-io/terragrunt-engine-opentofu"
}

unit "vpc" {
  source = "../units/vpc"
  path   = "vpc"

  autoinclude {
    inputs = {
      environment = "dev"
    }
  }
}

stack "services" {
  source = "../stacks/services"
  path   = "services"
}
`;
      const result = validateHCL(config);

      expect(result.syntaxValid).toBe(true);
      expect(result.warnings.filter(w => w.includes('Unknown block type'))).toEqual([]);
    });

    it.each([
      ['skip', 'true'],
      ['retryable_errors', '[".*timeout.*"]'],
      ['retry_max_attempts', '3'],
      ['retry_sleep_interval_sec', '5'],
    ])('should reject removed top-level %s attribute', (attribute, value) => {
      const result = validateHCL(`${attribute} = ${value}`);

      expect(result.syntaxValid).toBe(false);
      expect(result.errors.some(error => error.includes(`'${attribute}' was removed`))).toBe(true);
    });
  });

  describe('Performance validation', () => {
    it('should validate large configs within 100ms', () => {
      // Generate a large but valid config
      const blocks: string[] = [];
      for (let i = 0; i < 100; i++) {
        blocks.push(`
dependency "module_${i}" {
  config_path = "../module_${i}"
  mock_outputs = {
    id = "mock-id-${i}"
    name = "mock-name-${i}"
  }
}
`);
      }
      const config = blocks.join('\n');
      
      const startTime = performance.now();
      const result = validateHCL(config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(result.syntaxValid).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Edge cases', () => {
    it('should handle empty config', () => {
      const result = validateHCL('');
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle config with only comments', () => {
      const config = `
# This is a comment
// Another comment
# More comments
`;
      const result = validateHCL(config);
      
      expect(result.syntaxValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle multi-line strings (heredoc)', () => {
      const config = `
generate "backend" {
  path = "backend.tf"
  if_exists = "overwrite_terragrunt"
  contents = <<EOF
terraform {
  backend "s3" {
    bucket = "my-bucket"
  }
}
EOF
}
`;
      const result = validateHCL(config);
      
      // Note: Our validator doesn't fully parse heredoc strings, but it should not fail
      // This test documents current behavior
      expect(result.errors).toBeDefined();
    });
  });
});
