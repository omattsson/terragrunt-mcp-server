#!/usr/bin/env tsx
/**
 * Debug Mode Loading
 * 
 * Detailed trace of what gets loaded and why
 */

import { ServerMode, shouldLoadDependency, getModeConfig } from '../src/modes/config.js';

function debugMode(mode: ServerMode) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${mode.toUpperCase()} MODE DEBUG`);
  console.log('='.repeat(70));
  
  const config = getModeConfig(mode);
  
  console.log(`\nConfiguration:`);
  console.log(`  Tools: ${config.tools.join(', ')}`);
  console.log(`  Dependencies: ${config.dependencies.join(', ')}`);
  console.log(`  Estimated tokens: ${config.estimatedTokens}`);
  
  console.log(`\nDependency Loading Checks:`);
  const deps = [
    'docs', 'functions', 'cli', 'templates', 'generator', 
    'hcl', 'fileWriter', 'bestPractices', 'errorPatterns', 
    'comparisons', 'advancedExamples', 'metrics'
  ];
  
  deps.forEach(dep => {
    const shouldLoad = shouldLoadDependency(dep as any, mode);
    const status = shouldLoad ? '✅ LOAD' : '❌ SKIP';
    console.log(`  ${status} ${dep.padEnd(20)}`);
  });
}

async function main() {
  console.log('🔍 Mode Loading Debug Trace\n');
  
  const modes = [
    ServerMode.OBSERVABILITY,
    ServerMode.CONFIG,
    ServerMode.GUIDANCE,
    ServerMode.CORE,
    ServerMode.FULL,
  ];
  
  modes.forEach(mode => debugMode(mode));
  
  console.log('\n✅ Debug complete!\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
