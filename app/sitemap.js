import { GPU_PRESETS, gpuToSlug } from '@/lib/gpuPresets';

export default function sitemap() {
  const baseUrl = 'https://llm-matcher.vercel.app';

  // Base routes
  const routes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  // Dynamic GPU pages
  const gpuRoutes = GPU_PRESETS.map((gpu) => ({
    url: `${baseUrl}/gpu/${gpuToSlug(gpu.label)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...routes, ...gpuRoutes];
}
