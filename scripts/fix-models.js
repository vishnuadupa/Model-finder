const fs = require('fs');
const models = JSON.parse(fs.readFileSync('./public/models.json', 'utf8'));

// Standard quant set by model size
function quantsFor(params) {
  const qs = [
    { q: 'Q2_K',   fileSizeGB: +(params * 2.6  / 8).toFixed(2) },
    { q: 'Q3_K_M', fileSizeGB: +(params * 3.35 / 8).toFixed(2) },
    { q: 'Q4_K_S', fileSizeGB: +(params * 4.37 / 8).toFixed(2) },
    { q: 'Q4_K_M', fileSizeGB: +(params * 4.85 / 8).toFixed(2) },
    { q: 'Q5_K_M', fileSizeGB: +(params * 5.69 / 8).toFixed(2) },
    { q: 'Q6_K',   fileSizeGB: +(params * 6.57 / 8).toFixed(2) },
    { q: 'Q8_0',   fileSizeGB: +(params * 8.5  / 8).toFixed(2) },
  ];
  if (params <= 14) qs.push({ q: 'F16', fileSizeGB: +(params * 16 / 8).toFixed(2) });
  if (params > 70)  return qs.filter(q => !['Q6_K', 'Q8_0', 'F16'].includes(q.q));
  return qs;
}

// Update all existing models to full quant set
models.forEach(m => { m.quants = quantsFor(m.params); });

// Fix Solar 10.7B arch — was sharing Gemma 2 9B wrong values
const solar = models.find(m => m.name === 'Solar 10.7B');
if (solar) { solar.layers = 48; solar.numKVHeads = 8; solar.headDim = 128; }

// Fix Wizardlm2 8X22B — 22B is wrong; Mixtral 8x22B is 141B total
const wiz = models.find(m => m.name === 'Wizardlm2 8X22B');
if (wiz) {
  wiz.params = 141; wiz.name = 'WizardLM-2 8x22B';
  wiz.layers = 56; wiz.numKVHeads = 8; wiz.headDim = 128;
  wiz.quants = quantsFor(141);
  wiz.useCases = ['chat', 'reasoning', 'code'];
}

// Fix useCases to be informative
const useCaseMap = {
  'Mistral 7B v0.3':      ['chat', 'code'],
  'DeepSeek R1 7B':       ['reasoning', 'code', 'chat'],
  'DeepSeek R1 14B':      ['reasoning', 'code', 'chat'],
  'DeepSeek R1 32B':      ['reasoning', 'code', 'chat'],
  'Deepseek-r1 1.5B':     ['reasoning', 'chat'],
  'Deepseek-r1 8B':       ['reasoning', 'code', 'chat'],
  'Deepseek-r1 70B':      ['reasoning', 'code', 'chat'],
  'DeepSeek Coder V2 16B':['code'],
  'Codellama 7B':         ['code'],
  'Codellama 13B':        ['code'],
  'Codellama 34B':        ['code'],
  'Phi-3 Mini 3.8B':      ['chat', 'reasoning', 'code'],
  'Phi-3 Medium 14B':     ['chat', 'reasoning', 'code'],
  'Phi4 14B':             ['chat', 'reasoning', 'code'],
  'Qwen2.5 0.5B':         ['chat'],
  'Qwen2.5 1.5B':         ['chat'],
  'Qwen2.5 3B':           ['chat', 'code'],
  'Qwen2.5 7B':           ['chat', 'code', 'reasoning'],
  'Qwen2.5 14B':          ['chat', 'code', 'reasoning'],
  'Qwen2.5 32B':          ['chat', 'code', 'reasoning'],
  'Qwen2.5 72B':          ['chat', 'code', 'reasoning'],
  'Llama 3.1 8B':         ['chat', 'code'],
  'Llama 3.1 70B':        ['chat', 'code', 'reasoning'],
  'Llama 3.2 3B':         ['chat'],
  'Llama 3.3 70B':        ['chat', 'code', 'reasoning'],
  'Llama3.2 1B':          ['chat'],
  'Gemma 2 2B':           ['chat'],
  'Gemma 2 9B':           ['chat', 'code'],
  'Gemma 2 27B':          ['chat', 'code', 'reasoning'],
  'Mistral Nemo 12B':     ['chat', 'multilingual'],
  'Mixtral 8x7B':         ['chat', 'code'],
  'Command-r 35B':        ['chat', 'reasoning', 'long-docs'],
  'Command-r-plus 104B':  ['chat', 'reasoning', 'long-docs'],
  'Aya 8B':               ['chat', 'multilingual'],
  'Aya 35B':              ['chat', 'multilingual'],
  'Solar 10.7B':          ['chat', 'reasoning'],
  'Starling-lm 7B':       ['chat'],
  'Wizardlm2 7B':         ['chat', 'reasoning'],
  'WizardLM-2 8x22B':     ['chat', 'reasoning', 'code'],
  'Smollm2 1.7B':         ['chat'],
};
models.forEach(m => { if (useCaseMap[m.name]) m.useCases = useCaseMap[m.name]; });

// Fix SmolLM2 name
const smol = models.find(m => m.name === 'Smollm2 1.7B');
if (smol) smol.name = 'SmolLM2 1.7B';

// New models to add
const newModels = [
  {
    name: 'QwQ-32B', family: 'qwen2.5', params: 32,
    layers: 64, numKVHeads: 8, headDim: 128, maxCtx: 131072,
    useCases: ['reasoning', 'code', 'chat'],
    quality: 'excellent', verified: true,
    ollamaTag: 'qwq:32b', hfRepo: 'Qwen/QwQ-32B-GGUF',
  },
  {
    name: 'Qwen2.5-Coder 7B', family: 'qwen2.5-coder', params: 7,
    layers: 32, numKVHeads: 8, headDim: 128, maxCtx: 131072,
    useCases: ['code', 'chat'],
    quality: 'great', verified: true,
    ollamaTag: 'qwen2.5-coder:7b', hfRepo: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
  },
  {
    name: 'Qwen2.5-Coder 32B', family: 'qwen2.5-coder', params: 32,
    layers: 64, numKVHeads: 8, headDim: 128, maxCtx: 131072,
    useCases: ['code', 'reasoning'],
    quality: 'excellent', verified: true,
    ollamaTag: 'qwen2.5-coder:32b', hfRepo: 'Qwen/Qwen2.5-Coder-32B-Instruct-GGUF',
  },
  {
    name: 'Gemma 3 1B', family: 'gemma3', params: 1,
    layers: 18, numKVHeads: 4, headDim: 256, maxCtx: 32768,
    useCases: ['chat'],
    quality: 'good', verified: true,
    ollamaTag: 'gemma3:1b', hfRepo: 'google/gemma-3-1b-it-qat-gguf',
  },
  {
    name: 'Gemma 3 4B', family: 'gemma3', params: 4,
    layers: 34, numKVHeads: 4, headDim: 256, maxCtx: 131072,
    useCases: ['chat', 'vision'],
    quality: 'great', verified: true,
    ollamaTag: 'gemma3:4b', hfRepo: 'google/gemma-3-4b-it-qat-gguf',
  },
  {
    name: 'Gemma 3 12B', family: 'gemma3', params: 12,
    layers: 48, numKVHeads: 8, headDim: 256, maxCtx: 131072,
    useCases: ['chat', 'vision', 'reasoning'],
    quality: 'great', verified: true,
    ollamaTag: 'gemma3:12b', hfRepo: 'google/gemma-3-12b-it-qat-gguf',
  },
  {
    name: 'Gemma 3 27B', family: 'gemma3', params: 27,
    layers: 62, numKVHeads: 16, headDim: 128, maxCtx: 131072,
    useCases: ['chat', 'vision', 'reasoning'],
    quality: 'excellent', verified: true,
    ollamaTag: 'gemma3:27b', hfRepo: 'google/gemma-3-27b-it-gguf',
  },
  {
    name: 'Phi-4 Mini 3.8B', family: 'phi4', params: 3.8,
    layers: 32, numKVHeads: 8, headDim: 80, maxCtx: 131072,
    useCases: ['chat', 'reasoning', 'code'],
    quality: 'great', verified: true,
    ollamaTag: 'phi4-mini', hfRepo: 'microsoft/Phi-4-mini-instruct-gguf',
  },
  {
    name: 'Mixtral 8x22B', family: 'mixtral', params: 141,
    layers: 56, numKVHeads: 8, headDim: 128, maxCtx: 65536,
    useCases: ['chat', 'code', 'reasoning', 'multilingual'],
    quality: 'excellent', verified: false,
    ollamaTag: null, hfRepo: 'mistral-community/Mixtral-8x22B-v0.1-GGUF',
  },
];

newModels.forEach(nm => {
  const exists = models.some(m => m.name === nm.name);
  if (!exists) {
    nm.quants = quantsFor(nm.params);
    nm.lastUpdated = new Date().toISOString().slice(0, 10);
    nm.source = 'manual';
    models.push(nm);
    console.log('Added:', nm.name);
  } else {
    console.log('Skipped (exists):', nm.name);
  }
});

// Sort by params ascending, then name
models.sort((a, b) => a.params - b.params || a.name.localeCompare(b.name));

fs.writeFileSync('./public/models.json', JSON.stringify(models, null, 2));
console.log('\nTotal models:', models.length);

// Sanity check
models.forEach(m => {
  const issues = [];
  if (!m.layers) issues.push('no layers');
  if (!m.numKVHeads) issues.push('no numKVHeads');
  if (!m.quants || m.quants.length < 5) issues.push('few quants: ' + m.quants.length);
  if (!m.ollamaTag && !m.hfRepo) issues.push('no links');
  if (issues.length) console.log('  ISSUE', m.name + ':', issues.join(', '));
});
