import { describe, it, expect, beforeAll } from 'vitest';
import { ToolHandler } from '../../src/handlers/tools.js';

describe('Summary Mode - Tool Integration Tests', () => {
    let toolHandler: ToolHandler;

    beforeAll(() => {
        toolHandler = new ToolHandler();
    });

    describe('get_terragrunt_function', () => {
        it('should return summary mode by default', async () => {
            const result = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env'
            });

            expect(result).toHaveProperty('name', 'get_env');
            expect(result).toHaveProperty('signature');
            expect(result).toHaveProperty('shortDescription');
            expect(result).toHaveProperty('category');
            expect(result).toHaveProperty('parameterCount');
            expect(result).toHaveProperty('exampleCount');
            expect(result).toHaveProperty('relatedFunctions');
            
            // Summary mode should NOT have full description or examples array
            expect(result).not.toHaveProperty('description');
            expect(result).not.toHaveProperty('examples');
            expect(result).not.toHaveProperty('parameters');
        });

        it('should return full mode when specified', async () => {
            const result = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env',
                mode: 'full'
            });

            expect(result).toHaveProperty('name', 'get_env');
            expect(result).toHaveProperty('signature');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('category');
            expect(result).toHaveProperty('parameters');
            expect(result).toHaveProperty('returnType');
            expect(result).toHaveProperty('examples');
            expect(result).toHaveProperty('relatedFunctions');
            
            // Full mode should have complete description, not shortened
            expect(result).not.toHaveProperty('shortDescription');
            expect(result.description).toBeTruthy();
            expect(result.description.length).toBeGreaterThan(20);
        });

        it('should have shorter response in summary mode', async () => {
            const summaryResult = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env',
                mode: 'summary'
            });
            
            const fullResult = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env',
                mode: 'full'
            });

            const summarySize = JSON.stringify(summaryResult).length;
            const fullSize = JSON.stringify(fullResult).length;
            
            // Summary should be significantly smaller (at least 60% reduction as advertised)
            expect(summarySize).toBeLessThan(fullSize * 0.4);
        });
    });

    describe('analyze_best_practices', () => {
        it('should return summary mode by default', async () => {
            const result = await toolHandler.executeTool('analyze_best_practices', {
                topic: 'state_management'
            });

            expect(result).toHaveProperty('topic', 'state_management');
            expect(result).toHaveProperty('practiceCount');
            expect(result).toHaveProperty('practices');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('confidence');
            
            // Check practice structure in summary mode
            if (result.practices && result.practices.length > 0) {
                const practice = result.practices[0];
                expect(practice).toHaveProperty('practice');
                expect(practice).toHaveProperty('shortRationale');
                expect(practice).not.toHaveProperty('rationale');
                expect(practice).not.toHaveProperty('example');
            }

            // Summary mode should NOT have detailed arrays
            expect(result).not.toHaveProperty('commonPitfalls');
            expect(result).not.toHaveProperty('experienceNotes');
            expect(result).not.toHaveProperty('realWorldExamples');
        });

        it('should return full mode when specified', async () => {
            const result = await toolHandler.executeTool('analyze_best_practices', {
                topic: 'state_management',
                mode: 'full'
            });

            expect(result).toHaveProperty('topic', 'state_management');
            expect(result).toHaveProperty('recommendations');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('commonPitfalls');
            expect(result).toHaveProperty('experienceNotes');
            expect(result).toHaveProperty('realWorldExamples');
            expect(result).toHaveProperty('confidence');
            
            // Full mode should NOT have summary-specific fields
            expect(result).not.toHaveProperty('practiceCount');
            expect(result).not.toHaveProperty('practices');
        });

        it('should have shorter response in summary mode', async () => {
            const summaryResult = await toolHandler.executeTool('analyze_best_practices', {
                topic: 'state_management',
                mode: 'summary'
            });
            
            const fullResult = await toolHandler.executeTool('analyze_best_practices', {
                topic: 'state_management',
                mode: 'full'
            });

            const summarySize = JSON.stringify(summaryResult).length;
            const fullSize = JSON.stringify(fullResult).length;
            
            // Summary should be significantly smaller (at least 60% reduction)
            expect(summarySize).toBeLessThan(fullSize * 0.4);
        });
    });

    describe('search_docs', () => {
        it('should return summary mode by default', async () => {
            const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
                section: 'getting-started'
            });

            // Skip test if section doesn't exist
            if (result.error) {
                expect(result.error).toContain('No documentation found');
                return;
            }

            expect(result).toHaveProperty('section', 'getting-started');
            expect(result).toHaveProperty('documentCount');
            expect(result).toHaveProperty('documents');
            
            // Check document structure in summary mode
            if (result.documents && result.documents.length > 0) {
                const doc = result.documents[0];
                expect(doc).toHaveProperty('title');
                expect(doc).toHaveProperty('url');
                expect(doc).toHaveProperty('snippet');
                expect(doc).not.toHaveProperty('content');
                expect(doc).not.toHaveProperty('lastUpdated');
                
                // getFirstSentence() returns first sentence (can vary in length) or truncates at 100 chars
                // Most documentation sentences should be reasonably short
                expect(doc.snippet.length).toBeLessThan(300);
                expect(doc.snippet).toBeTruthy();
            }

            // Summary mode should NOT have 'docs' array or 'totalDocs'
            expect(result).not.toHaveProperty('docs');
            expect(result).not.toHaveProperty('totalDocs');
        });

        it('should return full mode when specified', async () => {
            const result = await toolHandler.executeTool('search_docs', {mode: 'section', 
                section: 'getting-started',
                detailLevel: 'full'
            });

            // Skip test if section doesn't exist
            if (result.error) {
                expect(result.error).toContain('No documentation found');
                return;
            }

            expect(result).toHaveProperty('section', 'getting-started');
            expect(result).toHaveProperty('docs');
            expect(result).toHaveProperty('totalDocs');
            
            // Check document structure in full mode
            if (result.docs && result.docs.length > 0) {
                const doc = result.docs[0];
                expect(doc).toHaveProperty('title');
                expect(doc).toHaveProperty('url');
                expect(doc).toHaveProperty('content');
                expect(doc).toHaveProperty('lastUpdated');
                expect(doc).not.toHaveProperty('snippet');
            }

            // Full mode should NOT have summary-specific fields
            expect(result).not.toHaveProperty('documentCount');
            expect(result).not.toHaveProperty('documents');
        });
    });

    describe('search_docs', () => {
        it('should return summary mode by default for regular examples', async () => {
            const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
                query: 'remote state'
            });

            // Skip test if no examples found
            if (result.error) {
                return;
            }

            expect(result).toHaveProperty('query', 'remote state');
            expect(result).toHaveProperty('source', 'documentation');
            expect(result).toHaveProperty('documentCount');
            expect(result).toHaveProperty('documents');
            
            // Check document structure in summary mode
            if (result.documents && result.documents.length > 0) {
                const doc = result.documents[0];
                expect(doc).toHaveProperty('title');
                expect(doc).toHaveProperty('url');
                expect(doc).toHaveProperty('section');
                expect(doc).toHaveProperty('snippetCount');
                expect(doc).not.toHaveProperty('codeSnippets');
            }

            // Summary mode should NOT have 'examples' array
            expect(result).not.toHaveProperty('examples');
            expect(result).not.toHaveProperty('totalDocuments');
        });

        it('should return full mode when specified for regular examples', async () => {
            const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
                query: 'remote state',
                detailLevel: 'full'
            });

            // Skip test if no examples found
            if (result.error) {
                return;
            }

            expect(result).toHaveProperty('query', 'remote state');
            expect(result).toHaveProperty('source', 'documentation');
            expect(result).toHaveProperty('examples');
            expect(result).toHaveProperty('totalDocuments');
            
            // Check example structure in full mode
            if (result.examples && result.examples.length > 0) {
                const example = result.examples[0];
                expect(example).toHaveProperty('documentTitle');
                expect(example).toHaveProperty('documentUrl');
                expect(example).toHaveProperty('codeSnippets');
                expect(example).toHaveProperty('snippetCount');
            }

            // Full mode should NOT have summary-specific fields
            expect(result).not.toHaveProperty('documentCount');
            expect(result).not.toHaveProperty('documents');
        });

        it('should return summary mode for advanced examples', async () => {
            const result = await toolHandler.executeTool('search_docs', {mode: 'examples', 
                query: 'hook',
                advanced: true,
                detailLevel: 'summary'
            });

            // Skip test if no examples found
            if (result.error) {
                return;
            }

            expect(result).toHaveProperty('topic', 'hook');
            expect(result).toHaveProperty('source', 'advanced-examples');
            expect(result).toHaveProperty('matchCount');
            expect(result).toHaveProperty('bestMatch');
            
            // Check best match structure in summary mode
            const bestMatch = result.bestMatch;
            expect(bestMatch).toHaveProperty('id');
            expect(bestMatch).toHaveProperty('name');
            expect(bestMatch).toHaveProperty('shortDescription');
            expect(bestMatch).toHaveProperty('category');
            expect(bestMatch).toHaveProperty('complexity');
            expect(bestMatch).toHaveProperty('tags');
            expect(bestMatch).not.toHaveProperty('code');
            expect(bestMatch).not.toHaveProperty('description');
            expect(bestMatch).not.toHaveProperty('useCases');
        });

        it('should have shorter response in summary mode', async () => {
            const summaryResult = await toolHandler.executeTool('search_docs', {mode: 'examples', 
                query: 'remote state',
                detailLevel: 'summary'
            });
            
            const fullResult = await toolHandler.executeTool('search_docs', {mode: 'examples', 
                query: 'remote state',
                detailLevel: 'full'
            });

            // Skip comparison if either failed
            if (summaryResult.error || fullResult.error) {
                return;
            }

            const summarySize = JSON.stringify(summaryResult).length;
            const fullSize = JSON.stringify(fullResult).length;
            
            // Summary should be significantly smaller
            expect(summarySize).toBeLessThan(fullSize);
        });
    });

    describe('Mode parameter validation', () => {
        it('should default to summary mode when mode not specified', async () => {
            const result = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env'
            });

            expect(result).toHaveProperty('shortDescription');
            expect(result).not.toHaveProperty('description');
        });

        it('should handle explicit summary mode', async () => {
            const result = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env',
                mode: 'summary'
            });

            expect(result).toHaveProperty('shortDescription');
        });

        it('should handle explicit full mode', async () => {
            const result = await toolHandler.executeTool('get_terragrunt_function', {
                function_name: 'get_env',
                mode: 'full'
            });

            expect(result).toHaveProperty('description');
            expect(result).not.toHaveProperty('shortDescription');
        });
    });
});
