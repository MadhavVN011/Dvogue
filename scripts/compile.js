import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

export async function compileContracts() {
  const names = ['DvogueRegistry', 'DvogueMarket'];
  const sources = {};
  for (const name of names) sources[name + '.sol'] = { content: await readFile(new URL('../contracts/' + name + '.sol', import.meta.url), 'utf8') };
  const input = { language: 'Solidity', sources, settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  } };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: name => {
    if (!name.startsWith('@openzeppelin/contracts/') || name.includes('..')) return { error: 'Unsupported import: ' + name };
    try { const contents = readFileSync(new URL('../node_modules/' + name, import.meta.url), 'utf8'); sources[name] = { content: contents }; return { contents }; } catch { return { error: 'Import not found: ' + name }; }
  } }));
  const errors = (output.errors || []).filter(error => error.severity === 'error');
  if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
  const artifacts = {};
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/solc-input.json', import.meta.url), JSON.stringify(input, null, 2) + '\n');
  for (const name of names) {
    const result = output.contracts[name + '.sol'][name];
    const artifact = { contractName: name, sourceName: name + '.sol', compilerVersion: solc.version(), abi: result.abi, bytecode: '0x' + result.evm.bytecode.object };
    const directory = new URL('../artifacts/contracts/' + name + '.sol/', import.meta.url);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL(name + '.json', directory), JSON.stringify(artifact, null, 2) + '\n');
    artifacts[name] = artifact;
  }
  return artifacts;
}
export async function compileRegistry() { return (await compileContracts()).DvogueRegistry; }
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await compileContracts();
  console.log('Compiled DvogueRegistry and DvogueMarket with Solidity ' + solc.version() + ' (Cancun EVM).');
}
