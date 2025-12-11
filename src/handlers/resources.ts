import { TerragruntDocsManager, TerragruntDoc } from '../terragrunt/docs.js';
import { IMetricsManager, NullMetricsManager } from '../terragrunt/metrics.js';

// Truncation limits for resource content optimization
// Resources are for discovery (like 'ls'), tools are for content delivery (like 'cat')
const RESOURCE_TRUNCATION_LIMITS = {
    section: 250,  // chars per doc in section listings (summary only)
    page: 1200     // chars for individual page views (overview + intro)
} as const;

/**
 * Truncates content to specified length while respecting word boundaries
 * @param content The content to truncate
 * @param maxLength Maximum length in characters
 * @param helpMessage Message to append after truncation
 * @returns Truncated content with help message, or original if shorter than limit
 */
function truncateContent(content: string, maxLength: number, helpMessage: string): string {
    if (!content || content.length <= maxLength) {
        return content;
    }

    // Try to find a natural word boundary in the last 20% of the limit
    const truncateAt = content.lastIndexOf(' ', maxLength);
    const cutPoint = truncateAt > maxLength * 0.8 ? truncateAt : maxLength;
    
    return content.substring(0, cutPoint) + '...\n\n' + helpMessage;
}

export interface Resource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

interface ContentItem {
    type: string;
    text: string;
}

export class ResourceHandler {
    private docsManager: TerragruntDocsManager;
    private metricsManager: IMetricsManager;

    constructor(metricsManager?: IMetricsManager) {
        this.metricsManager = metricsManager || new NullMetricsManager();
        this.docsManager = new TerragruntDocsManager();
    }

    async listResources(): Promise<Resource[]> {
        const resources: Resource[] = [];

        try {
            // Add documentation resources
            const docs = await this.docsManager.fetchLatestDocs();

            // Group by sections
            const sections = await this.docsManager.getAvailableSections();

            for (const section of sections) {
                resources.push({
                    uri: `terragrunt://docs/section/${section}`,
                    name: `Terragrunt ${section} Documentation`,
                    description: `Documentation for Terragrunt ${section} features and concepts`,
                    mimeType: 'text/markdown'
                });
            }

            // Add individual doc pages (limit to prevent overwhelming)
            const limitedDocs = docs.slice(0, 50);
            for (const doc of limitedDocs) {
                resources.push({
                    uri: `terragrunt://docs/page/${encodeURIComponent(doc.url)}`,
                    name: doc.title,
                    description: `Documentation: ${doc.title} (${doc.section})`,
                    mimeType: 'text/markdown'
                });
            }

            // Add overview resource
            resources.unshift({
                uri: 'terragrunt://docs/overview',
                name: 'Terragrunt Documentation Overview',
                description: 'Complete overview of all Terragrunt documentation',
                mimeType: 'text/markdown'
            });

        } catch (error) {
            console.error('Error listing documentation resources:', error);
            // Add a basic resource even if docs fail to load
            resources.push({
                uri: 'terragrunt://error',
                name: 'Documentation Error',
                description: 'Failed to load Terragrunt documentation',
                mimeType: 'text/plain'
            });
        }

        return resources;
    }

    async getResource(uri: string): Promise<{ contents: ContentItem[]; mimeType: string }> {
        try {
            if (uri === 'terragrunt://docs/overview') {
                const docs = await this.docsManager.fetchLatestDocs();
                const sections = await this.docsManager.getAvailableSections();

                let content = '# Terragrunt Documentation Overview\n\n';
                content += `Total documentation pages: ${docs.length}\n\n`;
                content += '## Available Sections:\n\n';

                for (const section of sections) {
                    const sectionDocs = docs.filter(doc => doc.section === section);
                    content += `### ${section} (${sectionDocs.length} pages)\n\n`;
                    for (const doc of sectionDocs.slice(0, 10)) { // Limit to first 10 per section
                        content += `- [${doc.title}](${doc.url})\n`;
                    }
                    if (sectionDocs.length > 10) {
                        content += `- ... and ${sectionDocs.length - 10} more pages\n`;
                    }
                    content += '\n';
                }

                const result = {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
                this.metricsManager.logResponse('resource', 'overview', result);
                return result;
            }

            if (uri.startsWith('terragrunt://docs/section/')) {
                const section = uri.replace('terragrunt://docs/section/', '');
                const docs = await this.docsManager.getDocBySection(section);

                if (docs.length === 0) {
                    throw new Error(`No documentation found for section: ${section}`);
                }

                const sectionHelpMsg = `📝 This is a truncated summary for discovery. For complete content, use:\n  @copilot /tools get_terragrunt_documentation with query="${section}"`;

                let content = `# Terragrunt ${section} Documentation\n\n`;
                content += docs.map(doc => {
                    const truncatedContent = truncateContent(doc.content, RESOURCE_TRUNCATION_LIMITS.section, sectionHelpMsg);
                    return `## ${doc.title}\n\n${truncatedContent}\n\n---\n`;
                }).join('\n');

                const result = {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
                this.metricsManager.logResponse('resource', `section:${section}`, result);
                return result;
            }

            if (uri.startsWith('terragrunt://docs/page/')) {
                const pageUrl = decodeURIComponent(uri.replace('terragrunt://docs/page/', ''));
                const docs = await this.docsManager.fetchLatestDocs();
                const doc = docs.find(d => d.url === pageUrl);

                if (!doc) {
                    throw new Error(`Documentation page not found: ${pageUrl}`);
                }

                const pageHelpMsg = `📄 This is a truncated preview for discovery. For complete content, use:\n  @copilot /tools get_terragrunt_documentation with query="${doc.title}"`;
                const truncatedContent = truncateContent(doc.content, RESOURCE_TRUNCATION_LIMITS.page, pageHelpMsg);
                
                const content = `# ${doc.title}\n\n**Source:** [${doc.url}](${doc.url})\n**Section:** ${doc.section}\n**Last Updated:** ${doc.lastUpdated}\n\n---\n\n${truncatedContent}`;

                const result = {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
                this.metricsManager.logResponse('resource', `page:${doc.title}`, result);
                return result;
            }

            if (uri === 'terragrunt://error') {
                const result = {
                    contents: [{ type: 'text', text: 'Failed to load Terragrunt documentation. Please check your internet connection and try again.' }],
                    mimeType: 'text/plain'
                };
                this.metricsManager.logResponse('resource', 'error', result);
                return result;
            }

            throw new Error(`Unknown resource URI: ${uri}`);
        } catch (error) {
            console.error('Error getting resource:', error);
            const result = {
                contents: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                mimeType: 'text/plain'
            };
            this.metricsManager.logResponse('resource', 'error', result);
            return result;
        }
    }

    async searchDocumentation(query: string): Promise<TerragruntDoc[]> {
        return this.docsManager.searchDocs(query);
    }
}