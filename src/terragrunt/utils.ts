export const parseConfig = (config: string): object => {
    try {
        return JSON.parse(config);
    } catch {
        throw new Error('Invalid configuration format');
    }
};

export const handleError = (error: Error): void => {
    console.error('An error occurred:', error.message);
};

export const formatOutput = (data: any): string => {
    return JSON.stringify(data, null, 2);
};

/**
 * Extract the first sentence from text.
 * A sentence is defined as text ending with . ! or ?
 * Falls back to truncation if no sentence boundary is found.
 */
export const getFirstSentence = (text: string): string => {
    if (!text || text.length === 0) {
        return '';
    }
    
    // Match first sentence ending with . ! or ?
    const sentenceMatch = text.match(/[^.!?]+[.!?]+/);
    
    if (sentenceMatch) {
        return sentenceMatch[0].trim();
    }
    
    // Fallback: truncate to 100 chars if no sentence boundary
    if (text.length > 100) {
        return text.substring(0, 100).trim() + '...';
    }
    
    return text.trim();
};