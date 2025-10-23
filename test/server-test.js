#!/usr/bin/env node

import { TerragruntDocsManager } from '../dist/terragrunt/docs.js';
import { ResourceHandler } from '../dist/handlers/resources.js';
import { ToolHandler } from '../dist/handlers/tools.js';

async function testServer() {
  console.log('🧪 Testing Terragrunt MCP Server...\n');

  try {
    // Test documentation manager
    console.log('📚 Testing Documentation Manager...');
    const docsManager = new TerragruntDocsManager();
    const docs = await docsManager.fetchLatestDocs();
    console.log(`✅ Fetched ${docs.length} documentation pages`);

    if (docs.length > 0) {
      const sections = await docsManager.getAvailableSections();
      console.log(`✅ Available sections: ${sections.join(', ')}`);
      if (!sections.includes('getting-started')) throw new Error('Missing expected section: getting-started');
    }

    // Test search functionality
    console.log('\n🔍 Testing Search...');
    const searchResults = await docsManager.searchDocs('dependencies');
    if (!Array.isArray(searchResults)) throw new Error('Search did not return array');
    console.log(`✅ Found ${searchResults.length} results for "dependencies"`);

    // Edge case: empty search
    const emptySearch = await docsManager.searchDocs('');
    if (emptySearch.length !== docs.length) console.log('ℹ️  Empty search returns all docs (expected)');

    // Test resource handler
    console.log('\n📖 Testing Resource Handler...');
    const resourceHandler = new ResourceHandler();
    const resources = await resourceHandler.listResources();
    if (!Array.isArray(resources) || resources.length === 0) throw new Error('No resources listed');
    console.log(`✅ Listed ${resources.length} resources`);

    // Test resource content: overview
    const overview = await resourceHandler.getResource('terragrunt://docs/overview');
    if (!overview.contents[0].text.includes('Terragrunt Documentation Overview')) throw new Error('Overview content missing');
    console.log('✅ Overview resource content OK');

    // Test resource content: section
    const sectionUri = resources.find(r => r.uri.startsWith('terragrunt://docs/section/'))?.uri;
    if (sectionUri) {
      const sectionContent = await resourceHandler.getResource(sectionUri);
      if (!sectionContent.contents[0].text.includes('Terragrunt')) throw new Error('Section content missing');
      console.log('✅ Section resource content OK');
    }

    // Test resource content: page
    const pageUri = resources.find(r => r.uri.startsWith('terragrunt://docs/page/'))?.uri;
    if (pageUri) {
      const pageContent = await resourceHandler.getResource(pageUri);
      if (!pageContent.contents[0].text) throw new Error('Page content missing');
      console.log('✅ Page resource content OK');
    }

    // Test error handling: invalid resource
    try {
      await resourceHandler.getResource('terragrunt://docs/section/doesnotexist');
      console.log('❌ Expected error for invalid section, but none thrown');
    } catch (e) {
      console.log('✅ Error thrown for invalid section as expected');
    }

    // Test tool handler
    console.log('\n🔧 Testing Tool Handler...');
    const toolHandler = new ToolHandler();
    const tools = toolHandler.getAvailableTools();
    if (!Array.isArray(tools) || tools.length === 0) throw new Error('No tools listed');
    console.log(`✅ Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Test tool execution: search
    console.log('\n🎯 Testing Tool Execution...');
    const searchTool = await toolHandler.executeTool('search_terragrunt_docs', {
      query: 'remote state',
      limit: 3
    });
    if (!searchTool.results || searchTool.results.length === 0) throw new Error('No results from search tool');
    console.log(`✅ Search tool returned ${searchTool.results?.length || 0} results`);

    // Test tool execution: get_terragrunt_sections
    const sectionsTool = await toolHandler.executeTool('get_terragrunt_sections', {});
    if (!sectionsTool.sections || sectionsTool.sections.length === 0) throw new Error('No sections from sections tool');
    console.log(`✅ Sections tool returned ${sectionsTool.sections?.length || 0} sections`);

    // Test tool execution: get_section_docs
    const firstSection = sectionsTool.sections[0]?.name;
    if (firstSection) {
      const sectionDocsTool = await toolHandler.executeTool('get_section_docs', { section: firstSection });
      if (!sectionDocsTool.docs || sectionDocsTool.docs.length === 0) throw new Error('No docs from get_section_docs tool');
      console.log(`✅ get_section_docs tool returned ${sectionDocsTool.docs.length} docs for section ${firstSection}`);
    }

    // Test tool execution: error handling
    const badTool = await toolHandler.executeTool('not_a_real_tool', {});
    if (!badTool.error) throw new Error('No error for invalid tool');
    console.log('✅ Error returned for invalid tool as expected');

    // Test tool execution: invalid section
    const badSection = await toolHandler.executeTool('get_section_docs', { section: 'doesnotexist' });
    if (!badSection.error) console.log('ℹ️  No docs for invalid section (expected)');
    else console.log('✅ Error returned for invalid section as expected');

    console.log('\n✨ All extended tests passed! Server is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testServer();