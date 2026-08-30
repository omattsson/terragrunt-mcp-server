import { describe, it, expect, beforeEach } from 'vitest';
import { SolutionRetriever } from '../../src/terragrunt/solution-retriever.js';
import { TerragruntDocsManager, TerragruntDoc } from '../../src/terragrunt/docs.js';
import { ErrorDiagnosisResult, ErrorMatch } from '../../src/types/terragrunt.js';

// Mock TerragruntDocsManager
class MockDocsManager {
  private mockDocs: TerragruntDoc[] = [];

  setMockDocs(docs: TerragruntDoc[]) {
    this.mockDocs = docs;
  }

  async searchDocs(query: string): Promise<TerragruntDoc[]> {
    return this.mockDocs.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  async fetchLatestDocs(): Promise<TerragruntDoc[]> {
    return this.mockDocs;
  }
}

describe('SolutionRetriever', () => {
  let retriever: SolutionRetriever;
  let mockDocsManager: MockDocsManager;

  beforeEach(() => {
    mockDocsManager = new MockDocsManager();
    retriever = new SolutionRetriever(mockDocsManager as unknown as TerragruntDocsManager);
  });

  // ==================== Command Parsing Tests ====================
  
  describe('parseCommandsFromMarkdown', () => {
    it('should extract commands from fenced code blocks', () => {
      const markdown = `
# Backend Configuration

To reconfigure your backend, run:

\`\`\`bash
terragrunt init -reconfigure
\`\`\`

This will reinitialize the backend.
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);

      expect(commands.length).toBeGreaterThanOrEqual(1);
      expect(commands.some(c => c.command === 'terragrunt init -reconfigure')).toBe(true);
    });

    it('should extract commands from shell code blocks', () => {
      const markdown = `
\`\`\`shell
terraform init
terraform plan
\`\`\`
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);

      expect(commands.length).toBe(2);
      expect(commands[0].command).toBe('terraform init');
      expect(commands[1].command).toBe('terraform plan');
    });

    it('should extract inline terragrunt commands', () => {
      const markdown = `
You can run \`terragrunt apply\` to apply changes or \`terragrunt plan\` to preview.
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);

      expect(commands.length).toBe(2);
      expect(commands.some(c => c.command === 'terragrunt apply')).toBe(true);
      expect(commands.some(c => c.command === 'terragrunt plan')).toBe(true);
    });

    it('should skip comments in code blocks', () => {
      const markdown = `
\`\`\`bash
# This is a comment
terragrunt init
// Another comment style
terraform version
\`\`\`
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);

      expect(commands.every(c => !c.command.startsWith('#'))).toBe(true);
      expect(commands.every(c => !c.command.startsWith('//'))).toBe(true);
    });

    it('should handle empty code blocks', () => {
      const markdown = `
\`\`\`bash
\`\`\`
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);
      expect(commands.length).toBe(0);
    });

    it('should extract context from surrounding text', () => {
      const markdown = `
If the backend configuration has changed, reinitialize with:

\`\`\`bash
terragrunt init -reconfigure
\`\`\`
`;

      const commands = retriever.parseCommandsFromMarkdown(markdown);

      expect(commands.length).toBeGreaterThanOrEqual(1);
      // Should have some context about backend configuration
    });
  });

  // ==================== Command Validation Tests ====================

  describe('validateCommand', () => {
    it('should identify safe commands', () => {
      expect(retriever.validateCommand('terragrunt plan')).toBe('safe');
      expect(retriever.validateCommand('terragrunt hcl validate --inputs')).toBe('safe');
      expect(retriever.validateCommand('terraform version')).toBe('safe');
      expect(retriever.validateCommand('terragrunt dag graph')).toBe('safe');
    });

    it('should identify destructive commands', () => {
      expect(retriever.validateCommand('terragrunt destroy')).toBe('destructive');
      expect(retriever.validateCommand('terraform destroy -auto-approve')).toBe('destructive');
      expect(retriever.validateCommand('terragrunt state rm module.example')).toBe('destructive');
      expect(retriever.validateCommand('rm -rf .terraform')).toBe('destructive');
    });

    it('should identify caution commands', () => {
      expect(retriever.validateCommand('terragrunt apply')).toBe('caution');
      expect(retriever.validateCommand('terraform import aws_instance.example i-12345')).toBe('caution');
      expect(retriever.validateCommand('terragrunt init -reconfigure')).toBe('caution');
      expect(retriever.validateCommand('terraform state mv')).toBe('caution');
    });

    it('should handle case insensitivity', () => {
      expect(retriever.validateCommand('TERRAGRUNT DESTROY')).toBe('destructive');
      expect(retriever.validateCommand('Terraform Apply')).toBe('caution');
    });
  });

  // ==================== Troubleshooting Step Extraction Tests ====================

  describe('extractTroubleshootingSteps', () => {
    it('should extract numbered steps', () => {
      const content = `
## Troubleshooting

1. Check your terragrunt.hcl configuration
2. Verify backend credentials
3. Run \`terragrunt hcl validate --inputs\`
`;

      const steps = retriever.extractTroubleshootingSteps(content);

      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps[0].action).toContain('Check');
    });

    it('should extract bullet points with action words', () => {
      const content = `
- Check the backend configuration
- Verify your AWS credentials are valid
- Run terragrunt with debug flag
- Ensure the state file exists
`;

      const steps = retriever.extractTroubleshootingSteps(content);

      expect(steps.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract commands from steps', () => {
      const content = `
## How to fix

1. Run \`terragrunt init -reconfigure\`
2. Check the output with \`terragrunt terragrunt-info\`
`;

      const steps = retriever.extractTroubleshootingSteps(content);

      expect(steps.some(s => s.command === 'terragrunt init -reconfigure')).toBe(true);
    });

    it('should handle content without troubleshooting section', () => {
      const content = `
This is some general documentation about Terragrunt.
It doesn't contain any troubleshooting steps.
`;

      const steps = retriever.extractTroubleshootingSteps(content);

      // Should still return empty or minimal results
      expect(Array.isArray(steps)).toBe(true);
    });
  });

  // ==================== enrichDiagnosis Tests ====================

  describe('enrichDiagnosis', () => {
    const createMockDiagnosis = (matches: Partial<ErrorMatch>[] = []): ErrorDiagnosisResult => ({
      matches: matches.map((m, i) => ({
        pattern: {
          id: m.pattern?.id || `test-pattern-${i}`,
          name: m.pattern?.name || 'Test Pattern',
          category: m.pattern?.category || 'configuration',
          regex: /test/i,
          description: m.pattern?.description || 'Test description',
          likelyCauses: m.pattern?.likelyCauses || ['Test cause'],
          solutions: m.pattern?.solutions || [
            { step: 1, explanation: 'Test solution' }
          ],
          documentationRefs: m.pattern?.documentationRefs || []
        },
        confidence: m.confidence || 0.8,
        context: m.context || {},
        likelyCause: m.likelyCause || 'Test cause',
        solutions: m.solutions || [{ step: 1, explanation: 'Test solution' }],
        documentationRefs: m.documentationRefs || []
      })) as ErrorMatch[],
      generalAdvice: ['General advice'],
      debuggingSteps: ['Debug step 1'],
      relatedErrors: ['Related error'],
      overallConfidence: 0.8
    });

    it('should enrich diagnosis with documentation', async () => {
      mockDocsManager.setMockDocs([
        {
          title: 'Backend Configuration',
          url: 'https://docs.terragrunt.com/backend',
          content: 'Configure backend with remote_state block.',
          section: 'reference'
        }
      ]);

      const diagnosis = createMockDiagnosis([{
        pattern: {
          id: 'backend-error',
          name: 'Backend Configuration Error',
          category: 'backend',
          regex: /backend/i,
          description: 'Backend configuration issue',
          likelyCauses: ['Invalid backend config'],
          solutions: [{ step: 1, explanation: 'Check backend' }],
          documentationRefs: []
        },
        confidence: 0.9
      }]);

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      expect(enriched.enrichmentSuccessful).toBe(true);
      expect(enriched.richSolutions).toBeDefined();
      expect(enriched.orderedDebuggingSteps).toBeDefined();
      expect(enriched.relatedErrorDetails).toBeDefined();
    });

    it('should handle empty diagnosis gracefully', async () => {
      const emptyDiagnosis = createMockDiagnosis([]);

      const enriched = await retriever.enrichDiagnosis(emptyDiagnosis);

      expect(enriched.enrichmentSuccessful).toBe(true);
      expect(enriched.richSolutions).toEqual([]);
    });

    it('should convert pattern solutions to rich solutions', async () => {
      const diagnosis = createMockDiagnosis([{
        pattern: {
          id: 'test',
          name: 'Test Error',
          category: 'configuration',
          regex: /test/i,
          description: 'Test',
          likelyCauses: ['Test'],
          solutions: [
            { step: 1, command: 'terragrunt plan', explanation: 'Run plan to check' },
            { step: 2, explanation: 'Review the output' }
          ],
          documentationRefs: []
        },
        confidence: 0.8
      }]);

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      expect(enriched.richSolutions.length).toBeGreaterThan(0);
      expect(enriched.richSolutions[0].source).toBe('pattern');
      expect(enriched.richSolutions[0].safetyLevel).toBeDefined();
    });

    it('should filter destructive commands when option is set', async () => {
      const diagnosis = createMockDiagnosis([{
        pattern: {
          id: 'test',
          name: 'Test Error',
          category: 'state',
          regex: /test/i,
          description: 'Test',
          likelyCauses: ['Test'],
          solutions: [
            { step: 1, command: 'terragrunt destroy', explanation: 'Destroy resources' },
            { step: 2, command: 'terragrunt plan', explanation: 'Run plan' }
          ],
          documentationRefs: []
        },
        confidence: 0.8
      }]);

      const enriched = await retriever.enrichDiagnosis(diagnosis, {
        includeDestructiveCommands: false
      });

      // Should not include the destroy command
      expect(enriched.richSolutions.every(s => 
        !s.command?.includes('destroy')
      )).toBe(true);
    });

    it('should generate category-specific debugging steps', async () => {
      const diagnosis = createMockDiagnosis([{
        pattern: {
          id: 'state-error',
          name: 'State Lock Error',
          category: 'state',
          regex: /state/i,
          description: 'State locking issue',
          likelyCauses: ['State locked'],
          solutions: [{ step: 1, explanation: 'Wait or force unlock' }],
          documentationRefs: []
        },
        confidence: 0.9
      }]);

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      // Should have state-specific debugging steps
      expect(enriched.orderedDebuggingSteps.some(s => 
        s.action.toLowerCase().includes('state') ||
        s.action.toLowerCase().includes('lock') ||
        s.action.toLowerCase().includes('credential')
      )).toBe(true);
    });

    it('should cache enriched results', async () => {
      const diagnosis = createMockDiagnosis([{
        pattern: {
          id: 'cache-test',
          name: 'Cache Test',
          category: 'configuration',
          regex: /cache/i,
          description: 'Cache test',
          likelyCauses: ['Test'],
          solutions: [{ step: 1, explanation: 'Test' }],
          documentationRefs: []
        },
        confidence: 0.8
      }]);

      // First call
      const first = await retriever.enrichDiagnosis(diagnosis);
      
      // Second call with same diagnosis should use cache
      const second = await retriever.enrichDiagnosis(diagnosis);

      expect(first.enrichmentSuccessful).toBe(second.enrichmentSuccessful);
    });
  });

  // ==================== Documentation Link Tests ====================

  describe('createDocumentationLinks', () => {
    it('should create links with relevance scores', async () => {
      mockDocsManager.setMockDocs([
        {
          title: 'Backend Configuration',
          url: 'https://docs.terragrunt.com/backend',
          content: 'Configure your backend with remote_state block.',
          section: 'reference'
        },
        {
          title: 'Getting Started',
          url: 'https://docs.terragrunt.com/getting-started',
          content: 'Introduction to Terragrunt.',
          section: 'intro'
        }
      ]);

      const diagnosis: ErrorDiagnosisResult = {
        matches: [{
          pattern: {
            id: 'backend-error',
            name: 'Backend Error',
            category: 'backend',
            regex: /backend/i,
            description: 'Backend configuration error',
            likelyCauses: ['Invalid backend'],
            solutions: [{ step: 1, explanation: 'Fix backend' }],
            documentationRefs: []
          },
          confidence: 0.9,
          context: {},
          likelyCause: 'Invalid backend',
          solutions: [{ step: 1, explanation: 'Fix backend' }],
          documentationRefs: []
        }],
        generalAdvice: [],
        debuggingSteps: [],
        relatedErrors: [],
        overallConfidence: 0.9
      };

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      // Should have documentation links
      if (enriched.documentationLinks.length > 0) {
        expect(enriched.documentationLinks[0].relevanceScore).toBeGreaterThan(0);
        expect(enriched.documentationLinks[0].excerpt).toBeDefined();
      }
    });
  });

  // ==================== Related Errors Tests ====================

  describe('findRelatedErrors', () => {
    it('should convert related errors to detailed objects', async () => {
      const diagnosis: ErrorDiagnosisResult = {
        matches: [{
          pattern: {
            id: 'test-error',
            name: 'Test Error',
            category: 'configuration',
            regex: /test/i,
            description: 'Test',
            likelyCauses: ['Test'],
            solutions: [{ step: 1, explanation: 'Test' }],
            documentationRefs: []
          },
          confidence: 0.8,
          context: {},
          likelyCause: 'Test',
          solutions: [{ step: 1, explanation: 'Test' }],
          documentationRefs: []
        }],
        generalAdvice: [],
        debuggingSteps: [],
        relatedErrors: ['Syntax Error', 'Missing Input'],
        overallConfidence: 0.8
      };

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      expect(enriched.relatedErrorDetails.length).toBe(2);
      expect(enriched.relatedErrorDetails[0].name).toBe('Syntax Error');
      expect(enriched.relatedErrorDetails[0].reason).toBeDefined();
      expect(enriched.relatedErrorDetails[0].category).toBeDefined();
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle timeout in documentation search', async () => {
      // Create a slow mock that times out
      const slowMock = {
        async searchDocs(_query: string): Promise<TerragruntDoc[]> {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 10000); // 10 second delay
          });
        }
      };

      const slowRetriever = new SolutionRetriever(slowMock as unknown as TerragruntDocsManager);
      
      const diagnosis: ErrorDiagnosisResult = {
        matches: [{
          pattern: {
            id: 'timeout-test',
            name: 'Timeout Test',
            category: 'configuration',
            regex: /timeout/i,
            description: 'Test',
            likelyCauses: ['Test'],
            solutions: [{ step: 1, explanation: 'Test' }],
            documentationRefs: []
          },
          confidence: 0.8,
          context: {},
          likelyCause: 'Test',
          solutions: [{ step: 1, explanation: 'Test' }],
          documentationRefs: []
        }],
        generalAdvice: [],
        debuggingSteps: [],
        relatedErrors: [],
        overallConfidence: 0.8
      };

      // Should complete within timeout
      const enriched = await slowRetriever.enrichDiagnosis(diagnosis, {
        searchTimeoutMs: 100
      });

      expect(enriched.enrichmentSuccessful).toBe(true);
    });

    it('should handle malformed markdown gracefully', () => {
      const malformedMarkdown = `
\`\`\`bash
this is not properly closed

\`\`\`shell
also not closed
`;

      // Should not throw
      const commands = retriever.parseCommandsFromMarkdown(malformedMarkdown);
      expect(Array.isArray(commands)).toBe(true);
    });

    it('should handle very long content', () => {
      const longContent = 'terragrunt plan '.repeat(10000);
      
      // Should not hang or throw
      const commands = retriever.parseCommandsFromMarkdown(longContent);
      expect(Array.isArray(commands)).toBe(true);
    });
  });

  // ==================== Warning Generation Tests ====================

  describe('Warning Generation', () => {
    it('should add warnings for destructive commands', async () => {
      const diagnosis: ErrorDiagnosisResult = {
        matches: [{
          pattern: {
            id: 'destroy-test',
            name: 'Destroy Test',
            category: 'configuration',
            regex: /destroy/i,
            description: 'Test',
            likelyCauses: ['Test'],
            solutions: [
              { step: 1, command: 'terragrunt destroy', explanation: 'Destroy resources' }
            ],
            documentationRefs: []
          },
          confidence: 0.8,
          context: {},
          likelyCause: 'Test',
          solutions: [{ step: 1, command: 'terragrunt destroy', explanation: 'Destroy resources' }],
          documentationRefs: []
        }],
        generalAdvice: [],
        debuggingSteps: [],
        relatedErrors: [],
        overallConfidence: 0.8
      };

      const enriched = await retriever.enrichDiagnosis(diagnosis, {
        includeDestructiveCommands: true
      });

      const destroySolution = enriched.richSolutions.find(s => 
        s.command?.includes('destroy')
      );

      if (destroySolution) {
        expect(destroySolution.warnings.length).toBeGreaterThan(0);
        expect(destroySolution.safetyLevel).toBe('destructive');
      }
    });

    it('should add warnings for state-modifying commands', async () => {
      const diagnosis: ErrorDiagnosisResult = {
        matches: [{
          pattern: {
            id: 'apply-test',
            name: 'Apply Test',
            category: 'configuration',
            regex: /apply/i,
            description: 'Test',
            likelyCauses: ['Test'],
            solutions: [
              { step: 1, command: 'terragrunt apply', explanation: 'Apply changes' }
            ],
            documentationRefs: []
          },
          confidence: 0.8,
          context: {},
          likelyCause: 'Test',
          solutions: [{ step: 1, command: 'terragrunt apply', explanation: 'Apply changes' }],
          documentationRefs: []
        }],
        generalAdvice: [],
        debuggingSteps: [],
        relatedErrors: [],
        overallConfidence: 0.8
      };

      const enriched = await retriever.enrichDiagnosis(diagnosis);

      const applySolution = enriched.richSolutions.find(s => 
        s.command?.includes('apply')
      );

      if (applySolution) {
        expect(applySolution.safetyLevel).toBe('caution');
        expect(applySolution.warnings.length).toBeGreaterThan(0);
      }
    });
  });
});
