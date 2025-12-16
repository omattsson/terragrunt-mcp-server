#!/usr/bin/env tsx
/**
 * Token Overhead Measurement Script
 * 
 * Measures actual token overhead for each server mode by:
 * 1. Loading tool definitions for each mode
 * 2. Calculating JSON size of tool schemas
 * 3. Comparing against FULL mode baseline
 * 4. Generating detailed report with reduction percentages
 * 
 * Usage: npm run measure-tokens
 */

import { ServerMode, shouldEnableTool } from '../src/modes/config.js';
import { ToolHandler } from '../src/handlers/tools.js';

interface ModeMetrics {
  mode: ServerMode;
  toolCount: number;
  toolNames: string[];
  jsonSize: number;
  tokenEstimate: number;
  reductionVsBaseline: number;
  percentageReduction: number;
}

/**
 * Estimate tokens from JSON size
 * Rule of thumb: ~4 characters per token
 */
function estimateTokens(jsonSize: number): number {
  return Math.ceil(jsonSize / 4);
}

/**
 * Get available tools for a specific mode
 */
function getToolsForMode(mode: ServerMode): any[] {
  const handler = new ToolHandler(mode);
  const allTools = handler.getAvailableTools();
  
  // Filter tools based on mode configuration
  return allTools.filter(tool => shouldEnableTool(tool.name, mode));
}

/**
 * Measure token overhead for a specific mode
 */
function measureMode(mode: ServerMode): ModeMetrics {
  const tools = getToolsForMode(mode);
  const toolNames = tools.map(t => t.name).sort();
  const jsonString = JSON.stringify(tools, null, 2);
  const jsonSize = jsonString.length;
  const tokenEstimate = estimateTokens(jsonSize);
  
  return {
    mode,
    toolCount: tools.length,
    toolNames,
    jsonSize,
    tokenEstimate,
    reductionVsBaseline: 0, // Calculated later
    percentageReduction: 0, // Calculated later
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Measuring Token Overhead per Mode\n');
  console.log('═'.repeat(80));
  
  // Measure all modes
  const modes: ServerMode[] = [
    ServerMode.FULL,
    ServerMode.CORE,
    ServerMode.CONFIG,
    ServerMode.GUIDANCE,
    ServerMode.OBSERVABILITY,
  ];
  
  const results: ModeMetrics[] = modes.map(mode => measureMode(mode));
  
  // Calculate reductions against FULL mode baseline
  const baseline = results.find(r => r.mode === ServerMode.FULL)!;
  results.forEach(result => {
    if (result.mode !== ServerMode.FULL) {
      result.reductionVsBaseline = baseline.tokenEstimate - result.tokenEstimate;
      result.percentageReduction = Math.round(
        (result.reductionVsBaseline / baseline.tokenEstimate) * 100
      );
    }
  });
  
  // Print detailed report
  console.log('\n📊 Token Overhead Summary\n');
  console.log('┌─────────────────┬───────┬──────────┬────────────┬────────────┬──────────┐');
  console.log('│ Mode            │ Tools │ JSON (B) │ Tokens Est │ Reduction  │ % Saved  │');
  console.log('├─────────────────┼───────┼──────────┼────────────┼────────────┼──────────┤');
  
  results.forEach(result => {
    const modePadded = result.mode.padEnd(15);
    const toolsPadded = result.toolCount.toString().padStart(5);
    const jsonPadded = result.jsonSize.toString().padStart(8);
    const tokensPadded = result.tokenEstimate.toString().padStart(10);
    const reductionPadded = result.reductionVsBaseline > 0 
      ? `-${result.reductionVsBaseline}`.padStart(10)
      : 'baseline'.padStart(10);
    const percentPadded = result.percentageReduction > 0
      ? `${result.percentageReduction}%`.padStart(8)
      : '-'.padStart(8);
    
    console.log(
      `│ ${modePadded} │ ${toolsPadded} │ ${jsonPadded} │ ${tokensPadded} │ ${reductionPadded} │ ${percentPadded} │`
    );
  });
  
  console.log('└─────────────────┴───────┴──────────┴────────────┴────────────┴──────────┘');
  
  // Print tool breakdown per mode
  console.log('\n🔧 Tool Distribution by Mode\n');
  results.forEach(result => {
    console.log(`\n${result.mode.toUpperCase()} Mode (${result.toolCount} tools):`);
    result.toolNames.forEach(name => {
      console.log(`  • ${name}`);
    });
  });
  
  // Validation against targets
  console.log('\n🎯 Target vs Actual Comparison\n');
  
  const targets: Record<string, number> = {
    [ServerMode.CORE]: 1200,
    [ServerMode.CONFIG]: 800,
    [ServerMode.GUIDANCE]: 600,
    [ServerMode.OBSERVABILITY]: 200,
  };
  
  console.log('┌─────────────────┬────────────┬────────────┬──────────┐');
  console.log('│ Mode            │ Target     │ Actual     │ Status   │');
  console.log('├─────────────────┼────────────┼────────────┼──────────┤');
  
  results
    .filter(r => r.mode !== ServerMode.FULL)
    .forEach(result => {
      const target = targets[result.mode] || 0;
      const actual = result.tokenEstimate;
      const status = actual <= target ? '✅ PASS' : '❌ OVER';
      const diff = actual - target;
      const diffStr = diff > 0 ? `+${diff}` : diff.toString();
      
      console.log(
        `│ ${result.mode.padEnd(15)} │ ${target.toString().padStart(10)} │ ${actual.toString().padStart(10)} │ ${status.padEnd(8)} │`
      );
      if (diff !== 0) {
        console.log(`│                 │            │ ${`(${diffStr})`.padStart(10)} │          │`);
      }
    });
  
  console.log('└─────────────────┴────────────┴────────────┴──────────┘');
  
  // Summary statistics
  console.log('\n📈 Summary Statistics\n');
  const totalReduction = results
    .filter(r => r.mode !== ServerMode.FULL)
    .reduce((sum, r) => sum + r.reductionVsBaseline, 0);
  const avgReduction = Math.round(totalReduction / 4);
  const maxReduction = Math.max(...results.filter(r => r.mode !== ServerMode.FULL).map(r => r.percentageReduction));
  const minReduction = Math.min(...results.filter(r => r.mode !== ServerMode.FULL).map(r => r.percentageReduction));
  
  console.log(`Total Token Savings Across All Modes: ${totalReduction} tokens`);
  console.log(`Average Reduction per Mode: ${avgReduction} tokens`);
  console.log(`Maximum Reduction: ${maxReduction}% (${results.find(r => r.percentageReduction === maxReduction)?.mode})`);
  console.log(`Minimum Reduction: ${minReduction}% (${results.find(r => r.percentageReduction === minReduction)?.mode})`);
  
  console.log('\n✅ Token overhead measurement complete!\n');
}

// Execute
main().catch(error => {
  console.error('❌ Error measuring token overhead:', error);
  process.exit(1);
});
