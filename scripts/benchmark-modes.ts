#!/usr/bin/env tsx
/**
 * Mode Performance Benchmark Script
 * 
 * Measures actual performance metrics for each mode:
 * - Startup time (server initialization)
 * - Memory usage (heap + external)
 * - Tool execution time
 * - Manager loading time
 * 
 * Usage: npm run benchmark-modes
 */

import { performance } from 'perf_hooks';
import { ServerMode } from '../src/modes/config.js';
import { ToolHandler } from '../src/handlers/tools.js';

interface PerformanceMetrics {
  mode: ServerMode;
  startupTime: number;
  memoryUsed: number;
  toolCount: number;
  managersLoaded: string[];
  toolExecutionTime: Record<string, number>;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get current memory usage
 */
function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed + usage.external;
}

/**
 * Benchmark a specific mode
 */
async function benchmarkMode(mode: ServerMode): Promise<PerformanceMetrics> {
  console.log(`\n🔍 Benchmarking ${mode.toUpperCase()} mode...`);
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const memBefore = getMemoryUsage();
  const startTime = performance.now();
  
  // Initialize handler (triggers lazy loading)
  const handler = new ToolHandler(undefined, mode);
  const tools = handler.getAvailableTools();
  
  const initTime = performance.now() - startTime;
  const memAfter = getMemoryUsage();
  const memUsed = memAfter - memBefore;
  
  // Get loaded managers (non-null managers)
  const loadedManagers: string[] = [];
  const managerChecks = [
    { name: 'docsManager', check: () => !!(handler as any).docsManager },
    { name: 'functionsManager', check: () => !!(handler as any).functionsManager },
    { name: 'commandsManager', check: () => !!(handler as any).commandsManager },
    { name: 'solutionRetriever', check: () => !!(handler as any).solutionRetriever },
    { name: 'comparisonsManager', check: () => !!(handler as any).comparisonsManager },
    { name: 'bestPracticesManager', check: () => !!(handler as any).bestPracticesManager },
    { name: 'errorPatternsManager', check: () => !!(handler as any).errorPatternsManager },
    { name: 'cliValidator', check: () => !!(handler as any).cliValidator },
    { name: 'generator', check: () => !!(handler as any).generator },
    { name: 'fileWriter', check: () => !!(handler as any).fileWriter },
    { name: 'hclBlocksManager', check: () => !!(handler as any).hclBlocksManager },
    { name: 'metricsManager', check: () => !!(handler as any).metricsManager },
  ];
  
  managerChecks.forEach(({ name, check }) => {
    try {
      if (check()) {
        loadedManagers.push(name);
      }
    } catch {
      // Manager not loaded
    }
  });
  
  // Measure tool execution time (sample one tool per category if available)
  const toolExecutionTime: Record<string, number> = {};
  
  // Sample tools to benchmark (if available in this mode)
  const sampleTools = [
    { name: 'search_docs', args: { query: 'dependencies' } },
    { name: 'build_config', args: { backend: 's3', useDefaults: true } },
    { name: 'get_guidance', args: { topic: 'dependencies' } },
    { name: 'get_server_metrics', args: {} },
  ];
  
  for (const sample of sampleTools) {
    const tool = tools.find(t => t.name === sample.name);
    if (tool) {
      try {
        const execStart = performance.now();
        await handler.executeTool(sample.name, sample.args);
        const execTime = performance.now() - execStart;
        toolExecutionTime[sample.name] = execTime;
      } catch (error) {
        // Tool execution failed (expected for some modes)
        toolExecutionTime[sample.name] = -1;
      }
    }
  }
  
  console.log(`  ✓ Startup: ${initTime.toFixed(2)}ms`);
  console.log(`  ✓ Memory: ${formatBytes(memUsed)}`);
  console.log(`  ✓ Tools: ${tools.length}`);
  console.log(`  ✓ Managers: ${loadedManagers.length}`);
  
  return {
    mode,
    startupTime: initTime,
    memoryUsed: memUsed,
    toolCount: tools.length,
    managersLoaded: loadedManagers,
    toolExecutionTime,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('⚡ Mode Performance Benchmark');
  console.log('═'.repeat(80));
  
  const modes: ServerMode[] = [
    ServerMode.OBSERVABILITY, // Smallest first
    ServerMode.GUIDANCE,
    ServerMode.CONFIG,
    ServerMode.CORE,
    ServerMode.FULL, // Largest last
  ];
  
  const results: PerformanceMetrics[] = [];
  
  // Benchmark each mode
  for (const mode of modes) {
    const metrics = await benchmarkMode(mode);
    results.push(metrics);
    
    // Small delay between benchmarks
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print comprehensive report
  console.log('\n\n📊 Performance Comparison');
  console.log('═'.repeat(80));
  
  console.log('\n┌─────────────────┬──────────────┬──────────────┬───────┬────────────┐');
  console.log('│ Mode            │ Startup (ms) │ Memory       │ Tools │ Managers   │');
  console.log('├─────────────────┼──────────────┼──────────────┼───────┼────────────┤');
  
  results.forEach(result => {
    const modePadded = result.mode.padEnd(15);
    const startupPadded = result.startupTime.toFixed(2).padStart(12);
    const memPadded = formatBytes(result.memoryUsed).padStart(12);
    const toolsPadded = result.toolCount.toString().padStart(5);
    const managersPadded = result.managersLoaded.length.toString().padStart(10);
    
    console.log(
      `│ ${modePadded} │ ${startupPadded} │ ${memPadded} │ ${toolsPadded} │ ${managersPadded} │`
    );
  });
  
  console.log('└─────────────────┴──────────────┴──────────────┴───────┴────────────┘');
  
  // Manager loading breakdown
  console.log('\n🔧 Manager Loading by Mode\n');
  results.forEach(result => {
    console.log(`${result.mode.toUpperCase()} (${result.managersLoaded.length}/12 managers):`);
    console.log(`  ${result.managersLoaded.join(', ') || 'none'}`);
  });
  
  // Tool execution benchmarks
  console.log('\n⚡ Tool Execution Time (ms)\n');
  const allToolNames = [...new Set(results.flatMap(r => Object.keys(r.toolExecutionTime)))];
  
  if (allToolNames.length > 0) {
    console.log('┌─────────────────┬' + allToolNames.map(() => '──────────────┬').join('').slice(0, -1) + '┐');
    console.log('│ Mode            │' + allToolNames.map(name => ` ${name.padEnd(12)} │`).join(''));
    console.log('├─────────────────┼' + allToolNames.map(() => '──────────────┼').join('').slice(0, -1) + '┤');
    
    results.forEach(result => {
      const row = [result.mode.padEnd(15)];
      allToolNames.forEach(toolName => {
        const time = result.toolExecutionTime[toolName];
        const timeStr = time === undefined ? '-' : time === -1 ? 'N/A' : time.toFixed(2);
        row.push(` ${timeStr.padStart(12)} `);
      });
      console.log(`│ ${row.join('│')} │`);
    });
    
    console.log('└─────────────────┴' + allToolNames.map(() => '──────────────┴').join('').slice(0, -1) + '┘');
  }
  
  // Performance comparison vs FULL mode
  const fullMode = results.find(r => r.mode === ServerMode.FULL)!;
  
  console.log('\n📈 Efficiency Gains vs FULL Mode\n');
  console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────────┐');
  console.log('│ Mode            │ Startup Speedup  │ Memory Savings   │ Complexity       │');
  console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────────┤');
  
  results
    .filter(r => r.mode !== ServerMode.FULL)
    .forEach(result => {
      const startupSpeedup = ((fullMode.startupTime - result.startupTime) / fullMode.startupTime * 100).toFixed(1);
      const memSavings = ((fullMode.memoryUsed - result.memoryUsed) / fullMode.memoryUsed * 100).toFixed(1);
      const complexityReduction = ((fullMode.managersLoaded.length - result.managersLoaded.length) / fullMode.managersLoaded.length * 100).toFixed(1);
      
      console.log(
        `│ ${result.mode.padEnd(15)} │ ${(startupSpeedup + '%').padStart(16)} │ ${(memSavings + '%').padStart(16)} │ ${(complexityReduction + '%').padStart(16)} │`
      );
    });
  
  console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────────┘');
  
  console.log('\n✅ Performance benchmark complete!\n');
}

// Execute
main().catch(error => {
  console.error('❌ Error running benchmark:', error);
  process.exit(1);
});
