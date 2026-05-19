import fs from 'fs';

const MODELS_PATH = 'public/models.json';
const CURRENT = JSON.parse(fs.readFileSync(MODELS_PATH, 'utf8'));
const KNOWN   = new Set(CURRENT.map(m => m.hfRepo).filter(Boolean));

// Trusted GGUF packagers — high quality, consistent naming
const WATCH_ACCOUNTS = [
  'bartowski',        // most prolific, best quality
  'TheBloke',         // huge back-catalog
  'unsloth',          // fast quantized + fine-tuned
  'lmstudio-community',
  'meta-llama',
  'mistralai',
  'google',
  'Qwen',
  'deepseek-ai',
  'microsoft',        // Phi models
  'cohere-for-ai',    // Command R
  'NousResearch',     // Hermes family
];

// Known architecture constants for common model families
// Used to enrich scraped models with accurate KV cache constants
const ARCH_HINTS = [
  { pattern: /llama.*3\.1.*8b/i,  layers: 32, numKVHeads: 8,  headDim: 128 },
  { pattern: /llama.*3.*8b/i,     layers: 32, numKVHeads: 8,  headDim: 128 },
  { pattern: /llama.*3.*70b/i,    layers: 80, numKVHeads: 8,  headDim: 128 },
  { pattern: /llama.*3.*3b/i,     layers: 28, numKVHeads: 8,  headDim: 128 },
  { pattern: /llama.*3.*1b/i,     layers: 16, numKVHeads: 8,  headDim: 64  },
  { pattern: /mistral.*7b/i,      layers: 32, numKVHeads: 8,  headDim: 128 },
  { pattern: /mistral.*nemo/i,    layers: 40, numKVHeads: 8,  headDim: 128 },
  { pattern: /mixtral.*8x7b/i,    layers: 32, numKVHeads: 8,  headDim: 128 },
  { pattern: /gemma.*2b/i,        layers: 26, numKVHeads: 4,  headDim: 256 },
  { pattern: /gemma.*9b/i,        layers: 42, numKVHeads: 4,  headDim: 256 },
  { pattern: /gemma.*27b/i,       layers: 46, numKVHeads: 16, headDim: 128 },
  { pattern: /phi.*3.*mini/i,     layers: 32, numKVHeads: 32, headDim: 96  },
  { pattern: /phi.*3.*medium/i,   layers: 40, numKVHeads: 10, headDim: 128 },
  { pattern: /phi.*4/i,           layers: 40, numKVHeads: 10, headDim: 128 },
  { pattern: /qwen.*0\.5b/i,      layers: 24, numKVHeads: 2,  headDim: 64  },
  { pattern: /qwen.*1\.5b/i,      layers: 28, numKVHeads: 2,  headDim: 64  },
  { pattern: /qwen.*7b/i,         layers: 28, numKVHeads: 4,  headDim: 128 },
  { pattern: /qwen.*14b/i,        layers: 48, numKVHeads: 8,  headDim: 128 },
  { pattern: /qwen.*32b/i,        layers: 64, numKVHeads: 8,  headDim: 128 },
  { pattern: /qwen.*72b/i,        layers: 80, numKVHeads: 8,  headDim: 128 },
  { pattern: /deepseek.*r1.*7b/i, layers: 28, numKVHeads: 4,  headDim: 128 },
  { pattern: /deepseek.*r1.*14b/i,layers: 28, numKVHeads: 4,  headDim: 128 },
  { pattern: /deepseek.*r1.*32b/i,layers: 64, numKVHeads: 8,  headDim: 128 },
  { pattern: /deepseek.*r1.*70b/i,layers: 80, numKVHeads: 8,  headDim: 128 },
];

function inferArchConstants(name, hfRepo) {
  const str = `${name} ${hfRepo}`.toLowerCase();
  for (const hint of ARCH_HINTS) {
    if (hint.pattern.test(str)) {
      return { layers: hint.layers, numKVHeads: hint.numKVHeads, headDim: hint.headDim };
    }
  }
  return { layers: null, numKVHeads: null, headDim: null };
}

async function hfFetch(path) {
  const res = await fetch(`https://huggingface.co/api/${path}`, {
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
  });
  if (!res.ok) throw new Error(`HF API ${res.status}: ${path}`);
  return res.json();
}

async function scrapeRepo(repoId) {
  const data = await hfFetch(`models/${repoId}`);

  const ggufFiles = (data.siblings || []).filter(
    f => f.rfilename.endsWith('.gguf')
      && !f.rfilename.includes('mmproj')
      && !f.rfilename.includes('-of-')  // skip split files
  );

  const quants = ggufFiles.map(f => {
    const match = f.rfilename.match(
      /[-_](Q\d[_A-Z0-9]*|IQ\d[_A-Z0-9]*|[Ff]16|[Bb][Ff]16)/
    );
    return {
      q:          match?.[1]?.toUpperCase() || null,
      fileSizeGB: +(f.size / 1e9).toFixed(2),
    };
  }).filter(q => q.q && q.fileSizeGB > 0.1);

  // Deduplicate quants by q value (keep largest file = unsharded)
  const quantMap = new Map();
  for (const q of quants) {
    if (!quantMap.has(q.q) || q.fileSizeGB > quantMap.get(q.q).fileSizeGB) {
      quantMap.set(q.q, q);
    }
  }
  const dedupedQuants = [...quantMap.values()];

  const paramMatch = (data.id + ' ' + (data.modelId || '')).match(/(\d+\.?\d*)[Bb]/);
  const params     = paramMatch ? parseFloat(paramMatch[1]) : null;

  // Infer context from tags or card
  const maxCtx = data.tags?.includes('context:131072') ? 131072
               : data.tags?.includes('context:32768')  ? 32768
               : data.tags?.includes('context:8192')   ? 8192
               : 4096;

  // Use cases from tags
  const useCases = [];
  if (data.tags?.some(t => t.includes('code'))) useCases.push('code');
  if (data.tags?.some(t => t.includes('chat') || t.includes('instruct'))) useCases.push('chat');
  if (data.tags?.some(t => t.includes('math') || t.includes('reason'))) useCases.push('reasoning');

  const arch = inferArchConstants(data.modelId || data.id, repoId);

  return {
    name:        data.modelId?.split('/').pop()?.replace(/-GGUF$/, '') || repoId.split('/').pop(),
    family:      repoId.split('/').pop().split('-')[0],
    params,
    ...arch,
    hfRepo:      repoId,
    ollamaTag:   null,
    maxCtx,
    useCases:    useCases.length ? useCases : ['chat'],
    quality:     params >= 30 ? 'excellent' : params >= 10 ? 'great' : 'good',
    verified:    false,
    quants:      dedupedQuants,
    lastUpdated: new Date().toISOString().split('T')[0],
  };
}

async function main() {
  let models    = [...CURRENT];
  const newOnes = [];

  for (const author of WATCH_ACCOUNTS) {
    let list;
    try {
      list = await hfFetch(`models?author=${author}&sort=lastModified&limit=30&filter=gguf`);
    } catch (e) {
      console.warn(`Skip ${author}: ${e.message}`);
      continue;
    }

    for (const m of list) {
      if (KNOWN.has(m.id)) continue;

      try {
        const scraped = await scrapeRepo(m.id);
        if (scraped.quants.length > 0 && scraped.params && scraped.params <= 200) {
          models.push(scraped);
          KNOWN.add(m.id);
          newOnes.push(scraped);
          console.log(`+ ${scraped.hfRepo} (${scraped.params}B, ${scraped.quants.length} quants)`);
        }
      } catch (e) {
        console.warn(`  Skip ${m.id}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 400)); // rate limit
    }
  }

  if (newOnes.length > 0) {
    // Sort by params ascending before saving
    models.sort((a, b) => (a.params || 999) - (b.params || 999));
    fs.writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2));
    console.log(`\nAdded ${newOnes.length} models. Total: ${models.length}`);

    if (process.env.DISCORD_WEBHOOK) {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🆕 **${newOnes.length} new models** added to LLM Matcher!\n`
            + newOnes.slice(0, 10).map(m => `• ${m.name} (${m.params}B)`).join('\n')
            + (newOnes.length > 10 ? `\n… and ${newOnes.length - 10} more` : ''),
        }),
      });
    }
  } else {
    console.log('No new models found.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
