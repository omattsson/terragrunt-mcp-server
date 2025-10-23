export interface TerragruntConfig {
    version: string;
    terraform: {
        source: string;
        extra_arguments?: ExtraArgument[];
    };
    inputs?: Record<string, any>;
    dependencies?: Dependency[];
}

export interface ExtraArgument {
    arguments: string[];
    commands: string[];
}

export interface Dependency {
    source: string;
    config: string;
}