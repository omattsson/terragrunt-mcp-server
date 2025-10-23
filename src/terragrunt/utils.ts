export const parseConfig = (config: string): object => {
    try {
        return JSON.parse(config);
    } catch (_error) {
        throw new Error('Invalid configuration format');
    }
};

export const handleError = (error: Error): void => {
    console.error('An error occurred:', error.message);
};

export const formatOutput = (data: any): string => {
    return JSON.stringify(data, null, 2);
};