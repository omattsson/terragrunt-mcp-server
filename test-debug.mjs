import { TerragruntFunctionsManager } from './dist/terragrunt/functions.js';

class MockDocsManager {
  constructor(docs) { this.docs = docs; }
  async fetchLatestDocs() { return this.docs; }
}

// Exact same content as the working test
const content = [
  '## abspath',
  'Returns the absolute path to a given path.',
  'abspath(path) -> string',
  'Parameters: path (string): The path to resolve.',
  'Example: abspath("./foo")',
  'See also: dirname(), basename()',
  '',
].join(' ');

const mockDocs = [{
  title: 'Built-in Functions',
  url: 'https://terragrunt.gruntwork.io/docs/reference/hcl/functions/',
  content,
  section: 'reference',
  lastUpdated: new Date().toISOString(),
}];

const mgr = new TerragruntFunctionsManager(new MockDocsManager(mockDocs));
await mgr.loadFunctions();
const list = mgr.listFunctions();

console.log('Found', list.length, 'functions');
console.log('Names:', list.map(f => f.name));

const abs = mgr.getFunction('abspath');
console.log('abspath found:', abs ? 'YES' : 'NO');
if (abs) {
  console.log('abspath examples:', abs.examples);
}
