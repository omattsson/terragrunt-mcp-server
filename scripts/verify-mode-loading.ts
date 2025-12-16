#!/usr/bin/env tsx
/**
 * Verify Mode Loading Script
 * 
 * Tests actual tool and manager loading per mode to validate lazy loading.
 */

import { ServerMode } from '../src/modes/config.js';
import { ToolHandler } from '../src/handlers/tools.js';

function verifyMode(mode: ServerMode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${mode.toUpperCase()} MODE`);
  console.log('='.repeat(60));
  
  const handler = new ToolHandler(undefined, mode);
  const tools = handler.getAvailableTools();
  
  console.log(`\n📦 Tools Available: ${tools.length}`);
  tools.forEach(tool => {
    console.log(`  • ${tool.name}`);
  });
  
  // Check manager loading by trying to access private properties
  const h = handler as any;
  // Check which managers are loaded (truthy check for defined and non-null)
  const managers = {
    docsManager: !!h.docsManager,
    functionsManager: !!h.functionsManager,
    commandsManager: !!h.cliCommandsManager,
    errorPatternMatcher: !!h.errorPatternMatcher,
    bestPracticesAnalyzer: !!h.bestPracticesAnalyzer,
    configGenerator: !!h.configGenerator,
    fileWriter: !!h.fileWriter,
    hclBlocksManager: !!h.hclBlocksManager,
    templatesManager: !!h.templatesManager,
    templateLibrary: !!h.templateLibrary,
    advancedExamplesManager: !!h.advancedExamplesManager,
    blockComparisonManager: !!h.blockComparisonManager,
  };
  
  const loadedCount = Object.values(managers).filter(Boolean).length;
  console.log(`\n🔧 Managers Loaded: ${loadedCount}/12`);
  
  Object.entries(managers).forEach(([name, loaded]) => {
    const status = loaded ? '✅' : '❌';
    console.log(`  ${status} ${name}`);
  });
  
  return { mode, toolCount: tools.length, managerCount: loadedCount, tools: tools.map(t => t.name) };
}

async function main() {
  console.log('🔍 Mode Loading Verification\n');
  
  const modes = [
    ServerMode.OBSERVABILITY,
    ServerMode.CONFIG,
    ServerMode.GUIDANCE,
    ServerMode.CORE,
    ServerMode.FULL,
  ];
  
  const results = modes.map(mode => verifyMode(mode));
  
  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  console.log('\n| Mode | Tools | Managers | Efficiency |');
  console.log('|------|-------|----------|------------|');
  
  results.forEach(r => {
    const efficiency = ((12 - r.managerCount) / 12 * 100).toFixed(0);
    console.log(`| ${r.mode.padEnd(12)} | ${r.toolCount.toString().padStart(5)} | ${r.managerCount.toString().padStart(8)} | ${efficiency}% saved |`);
  });
  
  console.log('\n✅ Verification complete!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
