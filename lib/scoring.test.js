import { getBackend } from './scoring';

describe('getBackend', () => {
  it('returns cpu for missing or CPU only labels', () => {
    expect(getBackend('Windows', null)).toBe('cpu');
    expect(getBackend('Windows', undefined)).toBe('cpu');
    expect(getBackend('Windows', '')).toBe('cpu');
    expect(getBackend('Windows', 'No GPU (CPU only)')).toBe('cpu');
  });

  it('returns mlx for Apple GPUs', () => {
    expect(getBackend('Mac OS', 'Apple M1')).toBe('mlx');
    expect(getBackend('Mac OS', 'Apple M2 Max')).toBe('mlx');
  });

  it('returns vulkan for Intel Arc GPUs', () => {
    expect(getBackend('Windows', 'Arc A770')).toBe('vulkan');
    expect(getBackend('Windows', 'Intel Arc Graphics')).toBe('vulkan');
    expect(getBackend('Linux', 'Arc A750')).toBe('vulkan');
  });

  it('returns rocm for AMD GPUs on Linux', () => {
    expect(getBackend('Linux', 'RX 7900 XTX')).toBe('rocm');
    expect(getBackend('Linux', 'Radeon RX 6800')).toBe('rocm');
  });

  it('returns vulkan for AMD GPUs on Windows', () => {
    expect(getBackend('Windows', 'RX 7900 XTX')).toBe('vulkan');
    expect(getBackend('Windows', 'Radeon RX 6800')).toBe('vulkan');
  });

  it('returns cuda for NVIDIA GPUs (fallback)', () => {
    expect(getBackend('Windows', 'RTX 4090')).toBe('cuda');
    expect(getBackend('Linux', 'GTX 1080 Ti')).toBe('cuda');
    expect(getBackend('Windows', 'NVIDIA GeForce RTX 3080')).toBe('cuda');
  });
});
