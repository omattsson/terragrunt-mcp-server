#!/usr/bin/env tsx
/**
 * Memory Usage Benchmark
 * 
 * Measures actual heap memory usage for each mode with proper isolation
 */

import { performance } from 'perf_hooks';
import { ServerMode } from '../src/modes/config.js';
import { ToolHandler } from '../src/handlers/tools.js';

interface MemoryMetrics {
  mode: ServerMode;
  toolCount: number;
  managerCount: number;
  heapUsedMB: number;
  externalMB: number;
  totalMB: number;
  startupMs: number;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function countLoadedManagers(handler: any): number {
  const managerFields = [
    'docsManager', 'functionsManager', 'cliCommandsManager',
    'errorPatternMatcher', 'bestPracticesAnalyzer', 'configGenerator',
    'fileWriter', 'hclBlocksManager', 'templatesManager',
    'templateLibrary', 'advancedExamplesManager', 'blockComparisonManager'
  ];
  
  return managerFields.filter(field => 
    handler[field] !== undefined && handler[field] !== null
  ).length;
}

async function benchmarkMode(mode: ServerMode): Promise<MemoryMetrics> {
  // Force garbage collection if available (run with --expose-gc)
  if (global.gc) {
    global.gc();
    global.gc(); // Double GC to ensure clean slate
  }
  
  // Wait for GC to settle
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Capture baseline memory
  const memBefore = process.memoryUsage();
  const startTime = performance.now();
  
  // Initialize handler
  const handler = new ToolHandler(undefined, mode);
  const tools = handler.getAvailableTools();
  const managerCount = countLoadedManagers(handler as any);
  
  // Measure after initialization
  const startupMs = performance.now() - startTime;
  const memAfter = process.memoryUsage();
  
  // Calculate deltas
  const heapDelta = memAfter.heapUsed - memBefore.heapUsed;
  const externalDelta = memAfter.external - memBefore.external;
  const totalDelta = heapDelta + externalDelta;
  
  return {
    mode,
    toolCount: tools.length,
    managerCount,
    heapUsedMB: parseFloat(formatMB(heapDelta)),
    externalMB: parseFloat(formatMB(externalDelta)),
    totalMB: parseFloat(formatMB(totalDelta)),
    startupMs: parseFloat(startupMs.toFixed(2)),
  };
}

async function main() {
  console.log('💾 Memory Usage Benchmark\n');
  console.log('═'.repeat(80));
  
  if (!global.gc) {
    console.log('⚠️  Running without --expose-gc flag');
    console.log('   Memory measurements may be less accurate\n');
  }
  
  const modes = [
    ServerMode.OBSERVABILITY,
    ServerMode.GUIDANCE,
    ServerMode.CORE,
    ServerMode.CONFIG,
    ServerMode.FULL,
  ];
  
  const results: MemoryMetrics[] = [];
  
  console.log('Benchmarking modes (with GC between each)...\n');
  
  for (const mode of modes) {
    process.stdout.write(`  ${mode.padEnd(15)} ... `);
    const metrics = await benchmarkMode(mode);
    results.push(metrics);
    console.log(`✓ ${metrics.totalMB} MB total`);
    
    // Delay between benchmarks
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Print detailed report
  console.log('\n\n' + '═'.repeat(80));
  console.log('MEMORY USAGE REPORT');
  console.log('═'.repeat(80));
  
  console.log('\n┌──────────────┬───────┬──────────┬──────────┬───────────┬───────────┬────────────┐');
  console.log('│ Mode         │ Tools │ Managers │ Heap(MB) │ Ext(MB)   │ Total(MB) │ Startup(ms)│');
  console.log('├──────────────┼───────┼──────────┼──────────┼───────────┼───────────┼────────────┤');
  
  results.forEach(r => {
    const row = [
      r.mode.padEnd(12),
      r.toolCount.toString().padStart(5),
      `${r.managerCount}/12`.padStart(8),
      r.heapUsedMB.toFixed(2).padStart(8),
      r.externalMB.toFixed(2).padStart(9),
      r.totalMB.toFixed(2).padStart(9),
      r.startupMs.toFixed(2).padStart(10)
    ];
    console.log(`│ ${row.join(' │ ')} │`);
  });
  
  console.log('└──────────────┴───────┴──────────┴──────────┴───────────┴───────────┴────────────┘');
  
  // Efficiency analysis
  const fullMode = results.find(r => r.mode === ServerMode.FULL)!;
  
  console.log('\n' + '═'.repeat(80));
  console.log('EFFICIENCY GAINS vs FULL MODE');
  console.log('═'.repeat(80));
  
  console.log('\n┌──────────────┬──────────────────┬──────────────────┬──────────────────┐');
  console.log('│ Mode         │ Memory Saved (%) │ Managers Saved(%)│ Startup Gain (%) │');
  console.log('├──────────────┼──────────────────┼──────────────────┼──────────────────┤');
  
  results
    .filter(r => r.mode !== ServerMode.FULL)
    .forEach(r => {
      const memSavings = ((fullMode.totalMB - r.totalMB) / fullMode.totalMB * 100);
      const mgrSavings = ((fullMode.managerCount - r.managerCount) / fullMode.managerCount * 100);
      const startupGain = ((fullMode.startupMs - r.startupMs) / fullMode.startupMs * 100);
      
      const row = [
        r.mode.padEnd(12),
        `${memSavings >= 0 ? '+' : ''}${memSavings.toFixed(1)}%`.padStart(16),
        `${mgrSavings >= 0 ? '+' : ''}${mgrSavings.toFixed(1)}%`.padStart(16),
        `${startupGain >= 0 ? '+' : ''}${startupGain.toFixed(1)}%`.padStart(16)
      ];
      console.log(`│ ${row.join(' │ ')} │`);
    });
  
  console.log('└──────────────┴──────────────────┴──────────────────┴──────────────────┘');
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  
  const avgMemSavings = results
    .filter(r => r.mode !== ServerMode.FULL)
    .reduce((sum, r) => sum + ((fullMode.totalMB - r.totalMB) / fullMode.totalMB * 100), 0) / 4;
  
  const avgMgrSavings = results
    .filter(r => r.mode !== ServerMode.FULL)
    .reduce((sum, r) => sum + ((fullMode.managerCount - r.managerCount) / fullMode.managerCount * 100), 0) / 4;
  
  console.log(`\nFULL Mode Baseline:`);
  console.log(`  Memory: ${fullMode.totalMB} MB`);
  console.log(`  Managers: ${fullMode.managerCount}/12`);
  console.log(`  Startup: ${fullMode.startupMs} ms`);
  
  console.log(`\nAverage Savings Across Specialized Modes:`);
  console.log(`  Memory: ${avgMemSavings >= 0 ? '+' : ''}${avgMemSavings.toFixed(1)}%`);
  console.log(`  Managers: ${avgMgrSavings >= 0 ? '+' : ''}${avgMgrSavings.toFixed(1)}%`);
  
  const best = results.reduce((min, r) => r.totalMB < min.totalMB ? r : min);
  console.log(`\nMost Efficient Mode:`);
  console.log(`  ${best.mode.toUpperCase()}: ${best.totalMB} MB (${best.managerCount}/12 managers)`);
  
  console.log('\n✅ Memory benchmark complete!\n');
}

// Execute
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
