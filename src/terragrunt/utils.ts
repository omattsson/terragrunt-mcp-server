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

// Common abbreviations that should not be treated as sentence terminators
// These are checked via negative lookbehind BEFORE the period, so they should NOT include the dot
const COMMON_ABBREVIATIONS = ['Dr', 'Mr', 'Mrs', 'Ms', 'Sr', 'Jr', 'etc', 'e\\.g', 'i\\.e'];

/**
 * Extract the first sentence from text.
 * A sentence is defined as text ending with . ! or ?
 * Handles common abbreviations (Dr., Mr., Mrs., etc.)
 * Falls back to truncation if no sentence boundary is found.
 */
export const getFirstSentence = (text: string): string => {
    if (!text || text.length === 0) {
        return '';
    }
    
    // Match first sentence ending with . ! or ?
    // Uses negative lookbehind to avoid breaking on common abbreviations
    const abbreviationPattern = COMMON_ABBREVIATIONS.join('|');
    const regex = new RegExp(`^.*?(?<!${abbreviationPattern})[.!?](?=\\s|$)`, 's');
    const sentenceMatch = text.match(regex);
    
    if (sentenceMatch) {
        return sentenceMatch[0].trim();
    }
    
    // Fallback: truncate to 100 chars if no sentence boundary
    if (text.length > 100) {
        return text.substring(0, 100).trim() + '...';
    }
    
    return text.trim();
};