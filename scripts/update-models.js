import fs from 'fs';

const CURRENT = JSON.parse(fs.readFileSync('public/models.json', 'utf8'));
const KNOWN   = new Set(CURRENT.map(m => m.hfRepo));

const WATCH_ACCOUNTS = [
  'bartowski',
  'TheBloke',
  'unsloth',
  'lmstudio-community',
  'meta-llama',
  'mistralai',
  'google',
  'Qwen',
  'deepseek-ai',
];

async function hfFetch(path) {
  const res = await fetch(`https://huggingface.co/api/${path}`, {
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
  });
  if (!res.ok) throw new Error(`HF API error: ${res.status} ${path}`);
  return res.json();
}

async function scrapeRepo(repoId) {
  const data = await hfFetch(`models/${repoId}`);

  const ggufFiles = (data.siblings || []).filter(
    f => f.rfilename.endsWith('.gguf') && !f.rfilename.includes('mmproj')
  );

  const quants = ggufFiles.map(f => {
    const match = f.rfilename.match(
      /[-_](Q\d[_A-Z0-9]*|IQ\d[_A-Z0-9]*|[Ff]16|[Bb][Ff]16)/
    );
    return {
      q:          match?.[1]?.toUpperCase() || null,
      fileSizeGB: +(f.size / 1e9).toFixed(2),
    };
  }).filter(q => q.q);

  const paramMatch = data.id?.match(/(\d+\.?\d*)[Bb]/);
  const params     = paramMatch ? parseFloat(paramMatch[1]) : null;

  return {
    hfRepo:      repoId,
    params,
    quants,
    verified:    false,
    lastUpdated: new Date().toISOString().split('T')[0],
  };
}

async function main() {
  let models  = [...CURRENT];
  const newOnes = [];

  for (const author of WATCH_ACCOUNTS) {
    let list;
    try {
      list = await hfFetch(
        `models?author=${author}&sort=lastModified&limit=20&filter=gguf`
      );
    } catch (e) {
      console.warn(`Skipping ${author}: ${e.message}`);
      continue;
    }

    for (const m of list) {
      if (KNOWN.has(m.id)) continue;

      try {
        const scraped = await scrapeRepo(m.id);
        if (scraped.quants.length > 0 && scraped.params) {
          models.push(scraped);
          KNOWN.add(m.id);
          newOnes.push(scraped);
          console.log(`+ ${scraped.hfRepo} (${scraped.params}B, ${scraped.quants.length} quants)`);
        }
      } catch (e) {
        console.warn(`  Skip ${m.id}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500)); // rate limit
    }
  }

  if (newOnes.length > 0) {
    fs.writeFileSync('public/models.json', JSON.stringify(models, null, 2));
    console.log(`\nAdded ${newOnes.length} new models. Total: ${models.length}`);

    if (process.env.DISCORD_WEBHOOK) {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🆕 **${newOnes.length} new models** added!\n` +
            newOnes.map(m => `• ${m.hfRepo} (${m.params}B)`).join('\n'),
        }),
      });
    }
  } else {
    console.log('No new models found.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
