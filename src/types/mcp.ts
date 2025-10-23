export interface MCPMessage {
    id: string;
    type: string;
    payload: any;
    timestamp: Date;
}

export interface MCPResponse {
    id: string;
    status: string;
    data?: any;
    error?: string;
}

export interface MCPConfig {
    provider: string;
    region: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
    };
}

export interface MCPResource {
    name: string;
    type: string;
    properties: Record<string, any>;
}