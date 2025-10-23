import { TerragruntDocsManager, TerragruntDoc } from '../terragrunt/docs.js';

export interface Resource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export class ResourceHandler {
    private docsManager: TerragruntDocsManager;

    constructor() {
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

    async getResource(uri: string): Promise<{ contents: any; mimeType: string }> {
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

                return {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
            }

            if (uri.startsWith('terragrunt://docs/section/')) {
                const section = uri.replace('terragrunt://docs/section/', '');
                const docs = await this.docsManager.getDocBySection(section);

                if (docs.length === 0) {
                    throw new Error(`No documentation found for section: ${section}`);
                }

                let content = `# Terragrunt ${section} Documentation\n\n`;
                content += docs.map(doc => `## ${doc.title}\n\n${doc.content}\n\n---\n`).join('\n');

                return {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
            }

            if (uri.startsWith('terragrunt://docs/page/')) {
                const pageUrl = decodeURIComponent(uri.replace('terragrunt://docs/page/', ''));
                const docs = await this.docsManager.fetchLatestDocs();
                const doc = docs.find(d => d.url === pageUrl);

                if (!doc) {
                    throw new Error(`Documentation page not found: ${pageUrl}`);
                }

                const content = `# ${doc.title}\n\n**Source:** [${doc.url}](${doc.url})\n**Section:** ${doc.section}\n**Last Updated:** ${doc.lastUpdated}\n\n---\n\n${doc.content}`;

                return {
                    contents: [{ type: 'text', text: content }],
                    mimeType: 'text/markdown'
                };
            }

            if (uri === 'terragrunt://error') {
                return {
                    contents: [{ type: 'text', text: 'Failed to load Terragrunt documentation. Please check your internet connection and try again.' }],
                    mimeType: 'text/plain'
                };
            }

            throw new Error(`Unknown resource URI: ${uri}`);
        } catch (error) {
            console.error('Error getting resource:', error);
            return {
                contents: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                mimeType: 'text/plain'
            };
        }
    }

    async searchDocumentation(query: string): Promise<TerragruntDoc[]> {
        return this.docsManager.searchDocs(query);
    }
}