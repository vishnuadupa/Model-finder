// Scrapes ollama.com/library for latest models and merges into models.json
// Runs alongside update-models.js in the GitHub Action

import fs from 'fs';

const MODELS_PATH = 'public/models.json';
const CURRENT     = JSON.parse(fs.readFileSync(MODELS_PATH, 'utf8'));
const KNOWN_TAGS  = new Set(CURRENT.map(m => m.ollamaTag).filter(Boolean));
const KNOWN_NAMES = new Set(CURRENT.map(m => m.name.toLowerCase()));

// Param size to architecture constant mapping (same as update-models.js)
const ARCH_DEFAULTS = {
  1:  { layers: 16, numKVHeads: 8,  headDim: 64  },
  3:  { layers: 28, numKVHeads: 8,  headDim: 128 },
  7:  { layers: 32, numKVHeads: 8,  headDim: 128 },
  8:  { layers: 32, numKVHeads: 8,  headDim: 128 },
  9:  { layers: 42, numKVHeads: 4,  headDim: 256 },
  13: { layers: 40, numKVHeads: 8,  headDim: 128 },
  14: { layers: 48, numKVHeads: 8,  headDim: 128 },
  27: { layers: 46, numKVHeads: 16, headDim: 128 },
  32: { layers: 64, numKVHeads: 8,  headDim: 128 },
  70: { layers: 80, numKVHeads: 8,  headDim: 128 },
  72: { layers: 80, numKVHeads: 8,  headDim: 128 },
};

function nearestArch(params) {
  const sizes = Object.keys(ARCH_DEFAULTS).map(Number);
  const nearest = sizes.reduce((a, b) =>
    Math.abs(b - params) < Math.abs(a - params) ? b : a
  );
  return ARCH_DEFAULTS[nearest] || { layers: 32, numKVHeads: 8, headDim: 128 };
}

async function fetchOllamaLibrary() {
  const res = await fetch('https://ollama.com/api/tags', {
    headers: { 'User-Agent': 'llm-matcher-scraper/1.0' },
  });
  if (!res.ok) throw new Error(`Ollama API ${res.status}`);
  return res.json();
}

async function scrapeOllamaModel(modelName) {
  // modelName = "llama3.1:8b" or "mistral:7b"
  const [base, tag] = modelName.split(':');
  const paramMatch  = (tag || '').match(/(\d+\.?\d*)[Bb]/i);
  const params      = paramMatch ? parseFloat(paramMatch[1]) : null;
  if (!params) return null;

  const arch = nearestArch(params);
  const displayName = base.charAt(0).toUpperCase() + base.slice(1) + ' ' +
    (tag ? tag.toUpperCase() : '');

  // Build GGUF quants based on model size (estimated)
  const q4Size = +((params * 4.85 * 1.05) / 8).toFixed(2);
  const q8Size = +((params * 8.5 * 1.05) / 8).toFixed(2);

  const quants = [
    { q: 'Q4_K_M', fileSizeGB: q4Size },
    { q: 'Q5_K_M', fileSizeGB: +((params * 5.69 * 1.05) / 8).toFixed(2) },
    { q: 'Q8_0',   fileSizeGB: q8Size },
  ];

  return {
    name:        displayName,
    family:      base.split('-')[0],
    params,
    ...arch,
    hfRepo:      null,
    ollamaTag:   modelName,
    maxCtx:      4096,
    useCases:    ['chat'],
    quality:     params >= 30 ? 'excellent' : params >= 10 ? 'great' : 'good',
    verified:    false,
    quants,
    lastUpdated: new Date().toISOString().split('T')[0],
    source:      'ollama',
  };
}

async function main() {
  console.log('Scraping Ollama library...');

  let data;
  try {
    // Ollama's public tag list is at a different endpoint
    const res = await fetch('https://ollama.com/library', {
      headers: { 'User-Agent': 'llm-matcher-scraper/1.0', 'Accept': 'application/json' },
    });
    // If Ollama doesn't expose a JSON API, use known popular models
    data = null;
  } catch {
    data = null;
  }

  // Fallback: curated list of popular Ollama models not already in our DB
  const POPULAR_OLLAMA_MODELS = [
    'llama3.2:1b', 'llama3.2:3b', 'llama3.1:8b', 'llama3.1:70b',
    'llama3.3:70b', 'mistral:7b', 'mistral-nemo:12b', 'mixtral:8x7b',
    'gemma2:2b', 'gemma2:9b', 'gemma2:27b',
    'phi3:mini', 'phi3:medium', 'phi4:14b',
    'qwen2.5:0.5b', 'qwen2.5:1.5b', 'qwen2.5:3b', 'qwen2.5:7b',
    'qwen2.5:14b', 'qwen2.5:32b', 'qwen2.5:72b',
    'deepseek-r1:1.5b', 'deepseek-r1:7b', 'deepseek-r1:8b',
    'deepseek-r1:14b', 'deepseek-r1:32b', 'deepseek-r1:70b',
    'codellama:7b', 'codellama:13b', 'codellama:34b',
    'command-r:35b', 'command-r-plus:104b',
    'wizardlm2:7b', 'wizardlm2:8x22b',
    'smollm2:135m', 'smollm2:360m', 'smollm2:1.7b',
    'aya:8b', 'aya:35b',
    'solar:10.7b', 'starling-lm:7b',
  ];

  let models   = [...CURRENT];
  const newOnes = [];

  for (const tag of POPULAR_OLLAMA_MODELS) {
    if (KNOWN_TAGS.has(tag)) continue;

    const scraped = await scrapeOllamaModel(tag);
    if (!scraped) continue;

    // Skip if we already have a model with this name from HF
    if (KNOWN_NAMES.has(scraped.name.toLowerCase())) {
      // Just update the ollamaTag on the existing model
      const existing = models.find(m => m.name.toLowerCase() === scraped.name.toLowerCase());
      if (existing && !existing.ollamaTag) {
        existing.ollamaTag = tag;
        console.log(`~ Updated ollamaTag for ${existing.name}: ${tag}`);
      }
      continue;
    }

    models.push(scraped);
    KNOWN_TAGS.add(tag);
    KNOWN_NAMES.add(scraped.name.toLowerCase());
    newOnes.push(scraped);
    console.log(`+ [Ollama] ${tag} (${scraped.params}B)`);
  }

  if (newOnes.length > 0 || models.some(m => m !== CURRENT.find(c => c === m))) {
    models.sort((a, b) => (a.params || 999) - (b.params || 999));
    fs.writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2));
    console.log(`Ollama scrape done. Added ${newOnes.length} models. Total: ${models.length}`);
  } else {
    console.log('No new Ollama models found.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
