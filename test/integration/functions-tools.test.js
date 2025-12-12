#!/usr/bin/env node

import { ToolHandler } from '../../dist/handlers/tools.js';

async function testFunctionsTools() {
  console.log('🧪 Testing Terragrunt Function Tools...\n');
  const toolHandler = new ToolHandler();

  // List functions
  const listResp = await toolHandler.executeTool('function_reference', { limit: 10 });
  if (listResp.error) {
    console.error('❌ function_reference returned error:', listResp.error);
    process.exit(1);
  }
  const list = listResp.functions || [];
  console.log(`✅ Listed ${list.length} functions (showing up to 10)`);
  if (list.length === 0) {
    console.warn('⚠️  No functions found in list');
  } else {
    console.log('Sample functions:', list.slice(0, 5).map(f => f.name).join(', '));
  }

  // Get details for first function
  const target = list[0]?.name;
  if (target) {
    const getResp = await toolHandler.executeTool('function_reference', { function_name: target });
    if (getResp.error) {
      console.error('❌ function_reference returned error:', getResp.error);
      process.exit(1);
    }
    console.log(`✅ Retrieved function '${getResp.name}'`);
    console.log('   Signature:', getResp.signature || '(none)');
    console.log('   Return:', getResp.returnType || '(unknown)');
    console.log('   Params:', (getResp.parameters || []).map(p => `${p.name}:${p.type || '?'}`).join(', ') || '(none)');
  } else {
    console.log('ℹ️  Skipping function_reference because no functions were listed');
  }

  console.log('\n✨ Function tools tests completed.');
}

try {
  await testFunctionsTools();
} catch (err) {
  console.error('❌ Function tools tests failed:', err);
  process.exit(1);
}
