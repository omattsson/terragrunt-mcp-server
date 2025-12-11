import { describe, it, expect } from 'vitest';
import { getFirstSentence } from '../../src/terragrunt/utils.js';

describe('getFirstSentence', () => {
    it('should extract first sentence ending with period', () => {
        const text = 'This is the first sentence. This is the second sentence.';
        expect(getFirstSentence(text)).toBe('This is the first sentence.');
    });

    it('should extract first sentence ending with exclamation mark', () => {
        const text = 'This is exciting! This is more text.';
        expect(getFirstSentence(text)).toBe('This is exciting!');
    });

    it('should extract first sentence ending with question mark', () => {
        const text = 'Is this a question? Yes it is.';
        expect(getFirstSentence(text)).toBe('Is this a question?');
    });

    it('should handle multiple punctuation marks', () => {
        const text = 'First sentence here. Second one! Third one?';
        expect(getFirstSentence(text)).toBe('First sentence here.');
    });

    it('should truncate to 100 chars if no sentence boundary found', () => {
        const text = 'This is a very long text without any sentence boundary that goes on and on and on and should be truncated at one hundred characters';
        const result = getFirstSentence(text);
        expect(result).toContain('...');
        expect(result.length).toBeLessThanOrEqual(104); // 100 + "..."
    });

    it('should return text as-is if shorter than 100 chars and no sentence boundary', () => {
        const text = 'Short text without punctuation';
        expect(getFirstSentence(text)).toBe('Short text without punctuation');
    });

    it('should handle empty string', () => {
        expect(getFirstSentence('')).toBe('');
    });

    it('should trim whitespace from result', () => {
        const text = '  This is a sentence.  ';
        expect(getFirstSentence(text)).toBe('This is a sentence.');
    });

    it('should handle text with only whitespace', () => {
        const text = '    ';
        expect(getFirstSentence(text)).toBe('');
    });

    it('should handle sentence with newlines', () => {
        const text = 'This is a sentence\nwith newlines. This is another.';
        expect(getFirstSentence(text)).toBe('This is a sentence\nwith newlines.');
    });

    it('should handle abbreviations correctly', () => {
        const text = 'Dr. Smith went to the store. He bought milk.';
        // Should match the full first sentence, not stop at abbreviation
        expect(getFirstSentence(text)).toBe('Dr. Smith went to the store.');
    });
});
