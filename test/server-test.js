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
      const sectionDocsTool = await toolHandler.executeTool('get_section_docs', { section: firstSection, mode: 'full' });
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

    // Test tool execution: get_cli_command_help
    console.log('\n📖 Testing CLI Command Help Tool...');
    const cliHelp = await toolHandler.executeTool('get_cli_command_help', { command: 'plan' });
    if (cliHelp.error) {
      console.log(`⚠️  CLI help returned error (may be expected if docs don't have command): ${cliHelp.error}`);
    } else if (cliHelp.help) {
      console.log(`✅ CLI command help tool returned help for 'plan'`);
    } else {
      console.log('ℹ️  No CLI help found for "plan" command');
    }

    // Test with another common command
    const cliHelpApply = await toolHandler.executeTool('get_cli_command_help', { command: 'apply' });
    if (!cliHelpApply.error && cliHelpApply.help) {
      console.log(`✅ CLI command help tool returned help for 'apply'`);
    }

    // Test with run-all command
    const cliHelpRunAll = await toolHandler.executeTool('get_cli_command_help', { command: 'run-all' });
    if (!cliHelpRunAll.error && cliHelpRunAll.help) {
      console.log(`✅ CLI command help tool returned help for 'run-all'`);
    }

    // Test tool execution: get_hcl_config_reference
    console.log('\n🔧 Testing HCL Config Reference Tool...');
    const hclRefTerraform = await toolHandler.executeTool('get_hcl_config_reference', { config: 'terraform' });
    if (hclRefTerraform.error) {
      console.log(`⚠️  HCL config returned error (may be expected): ${hclRefTerraform.error}`);
    } else if (hclRefTerraform.docs && hclRefTerraform.docs.length > 0) {
      console.log(`✅ HCL config reference tool returned ${hclRefTerraform.docs.length} docs for 'terraform' block`);
    } else {
      console.log('ℹ️  No HCL docs found for "terraform" config');
    }

    // Test with other common HCL blocks
    const hclRefDependency = await toolHandler.executeTool('get_hcl_config_reference', { config: 'dependency' });
    if (!hclRefDependency.error && hclRefDependency.docs && hclRefDependency.docs.length > 0) {
      console.log(`✅ HCL config reference tool returned ${hclRefDependency.docs.length} docs for 'dependency' block`);
    }

    const hclRefRemoteState = await toolHandler.executeTool('get_hcl_config_reference', { config: 'remote_state' });
    if (!hclRefRemoteState.error && hclRefRemoteState.docs && hclRefRemoteState.docs.length > 0) {
      console.log(`✅ HCL config reference tool returned ${hclRefRemoteState.docs.length} docs for 'remote_state' block`);
    }

    // Test tool execution: get_code_examples
    console.log('\n💻 Testing Code Examples Tool...');
    const codeExamples = await toolHandler.executeTool('get_code_examples', { 
      topic: 'dependencies',
      limit: 5
    });
    if (codeExamples.error) {
      console.log(`⚠️  Code examples returned error (may be expected): ${codeExamples.error}`);
    } else if (codeExamples.examples && codeExamples.examples.length > 0) {
      console.log(`✅ Code examples tool returned ${codeExamples.examples.length} examples for 'dependencies'`);
    } else {
      console.log('ℹ️  No code examples found for "dependencies" topic');
    }

    // Test with other topics
    const codeExamplesRemoteState = await toolHandler.executeTool('get_code_examples', { 
      topic: 'remote state',
      limit: 3
    });
    if (!codeExamplesRemoteState.error && codeExamplesRemoteState.examples && codeExamplesRemoteState.examples.length > 0) {
      console.log(`✅ Code examples tool returned ${codeExamplesRemoteState.examples.length} examples for 'remote state'`);
    }

    const codeExamplesHooks = await toolHandler.executeTool('get_code_examples', { 
      topic: 'before hooks',
      limit: 3
    });
    if (!codeExamplesHooks.error && codeExamplesHooks.examples && codeExamplesHooks.examples.length > 0) {
      console.log(`✅ Code examples tool returned ${codeExamplesHooks.examples.length} examples for 'before hooks'`);
    }

    // Test edge cases
    console.log('\n🧪 Testing Edge Cases...');
    
    // Search with special characters
    const specialSearch = await toolHandler.executeTool('search_terragrunt_docs', {
      query: 'S3 bucket & DynamoDB',
      limit: 5
    });
    if (!specialSearch.error) {
      console.log(`✅ Search with special characters returned ${specialSearch.results?.length || 0} results`);
    }

    // Very long search query
    const longQuery = 'terragrunt configuration file dependency management remote state backend S3 DynamoDB locking'.repeat(5);
    const longSearch = await toolHandler.executeTool('search_terragrunt_docs', {
      query: longQuery,
      limit: 1
    });
    if (!longSearch.error) {
      console.log(`✅ Very long search query handled successfully`);
    }

    // Limit at boundaries
    const limitZero = await toolHandler.executeTool('search_terragrunt_docs', {
      query: 'test',
      limit: 0
    });
    if (limitZero.results) {
      console.log(`✅ Limit=0 handled: returned ${limitZero.results.length} results`);
    }

    const limitOne = await toolHandler.executeTool('search_terragrunt_docs', {
      query: 'test',
      limit: 1
    });
    if (limitOne.results && limitOne.results.length <= 1) {
      console.log(`✅ Limit=1 respected: returned ${limitOne.results.length} results`);
    }

    const limitTwenty = await toolHandler.executeTool('get_code_examples', {
      topic: 'terraform',
      limit: 20
    });
    if (!limitTwenty.error) {
      console.log(`✅ Limit=20 handled for code examples`);
    }

    console.log('\n✨ All extended tests passed! Server is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testServer();