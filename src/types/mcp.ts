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

export interface PaginationParams {
    page?: number;      // Default: 1
    pageSize?: number;  // Default: varies by tool
}

export interface PaginationMetadata {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasMore: boolean;
    hasPrevious: boolean;
    warning?: string;  // Optional warning for invalid input (e.g., pageSize <= 0)
}