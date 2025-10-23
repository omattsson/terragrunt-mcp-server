import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface TerragruntCommandResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode: number;
}

export interface TerragruntModule {
    name: string;
    path: string;
    hasConfig: boolean;
    dependencies: string[];
}

export const runTerragruntCommand = async (
    command: string,
    args: string[] = [],
    workingDir: string = process.cwd()
): Promise<TerragruntCommandResult> => {
    try {
        const fullCommand = `terragrunt ${command} ${args.join(' ')}`;
        console.log(`Running Terragrunt command: ${fullCommand} in ${workingDir}`);

        const { stdout, stderr } = await execAsync(fullCommand, {
            cwd: workingDir,
            timeout: 300000 // 5 minutes timeout
        });

        return {
            success: true,
            output: stdout,
            error: stderr || undefined,
            exitCode: 0
        };
    } catch (error: any) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
            exitCode: error.code || 1
        };
    }
};

export const validateTerragruntConfig = async (configPath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
}> => {
    const result = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[]
    };

    try {
        // Check if file exists
        await fs.access(configPath);

        // Read and parse the config
        const configContent = await fs.readFile(configPath, 'utf-8');

        // Basic syntax validation
        if (!configContent.includes('terraform {') && !configContent.includes('terragrunt_version_constraint')) {
            result.errors.push('No terraform block found in configuration');
            result.valid = false;
        }

        // Run terragrunt validate-inputs if available
        try {
            const validateResult = await runTerragruntCommand('validate-inputs', [], path.dirname(configPath));
            if (!validateResult.success) {
                result.errors.push(`Terragrunt validation failed: ${validateResult.error}`);
                result.valid = false;
            }
        } catch (error) {
            result.warnings.push('Could not run terragrunt validate-inputs');
        }

    } catch (error) {
        result.errors.push(`Failed to read config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.valid = false;
    }

    return result;
};

export const listTerragruntModules = async (rootPath: string = process.cwd()): Promise<TerragruntModule[]> => {
    const modules: TerragruntModule[] = [];

    try {
        // Find all terragrunt.hcl files recursively
        const findTerragruntFiles = async (dir: string): Promise<string[]> => {
            const files: string[] = [];
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    files.push(...await findTerragruntFiles(fullPath));
                } else if (entry.isFile() && entry.name === 'terragrunt.hcl') {
                    files.push(fullPath);
                }
            }

            return files;
        };

        const configFiles = await findTerragruntFiles(rootPath);

        for (const configFile of configFiles) {
            const modulePath = path.dirname(configFile);
            const moduleName = path.relative(rootPath, modulePath) || path.basename(modulePath);

            // Read dependencies from config
            const dependencies = await extractDependencies(configFile);

            modules.push({
                name: moduleName,
                path: modulePath,
                hasConfig: true,
                dependencies
            });
        }

    } catch (error) {
        console.error('Error listing Terragrunt modules:', error);
    }

    return modules;
};

export const extractDependencies = async (configPath: string): Promise<string[]> => {
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        const dependencies: string[] = [];

        // Simple regex to find dependency blocks
        const dependencyRegex = /dependency\s+"([^"]+)"/g;
        let match;

        while ((match = dependencyRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }

        return dependencies;
    } catch (error) {
        console.error(`Error extracting dependencies from ${configPath}:`, error);
        return [];
    }
};

export const getTerragruntVersion = async (): Promise<string> => {
    try {
        const result = await runTerragruntCommand('--version');
        return result.success ? result.output.trim() : 'Unknown';
    } catch (error) {
        return 'Not installed';
    }
};

export const planModule = async (modulePath: string): Promise<TerragruntCommandResult> => {
    return runTerragruntCommand('plan', [], modulePath);
};

export const applyModule = async (modulePath: string, autoApprove = false): Promise<TerragruntCommandResult> => {
    const args = autoApprove ? ['--terragrunt-non-interactive'] : [];
    return runTerragruntCommand('apply', args, modulePath);
};

export const destroyModule = async (modulePath: string, autoApprove = false): Promise<TerragruntCommandResult> => {
    const args = autoApprove ? ['--terragrunt-non-interactive'] : [];
    return runTerragruntCommand('destroy', args, modulePath);
};