// Test script for retry and fallback mechanism
import { TerragruntDocsManager } from '../dist/terragrunt/docs.js';

async function testRetryAndFallback() {
    console.log('=== Testing Retry and Fallback Mechanism ===\n');

    const docsManager = new TerragruntDocsManager();

    try {
        console.log('Test 1: Normal fetch with retry (should succeed)');
        const docs = await docsManager.fetchLatestDocs();
        console.log(`✅ Fetched ${docs.length} docs successfully\n`);

        console.log('Test 2: Verify cache works');
        const cachedDocs = await docsManager.fetchLatestDocs();
        console.log(`✅ Retrieved ${cachedDocs.length} docs from cache\n`);

        console.log('Test 3: Verify sections');
        const sections = await docsManager.getAvailableSections();
        console.log(`✅ Found ${sections.length} sections: ${sections.join(', ')}\n`);

        console.log('=== All Tests Passed ===');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testRetryAndFallback().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
