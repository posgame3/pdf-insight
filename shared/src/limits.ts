export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPages: 300,
  maxPageChars: 40_000,
  maxTotalChars: 480_000,
  maxScanImages: 6,
  maxScanImageChars: 900_000,
  maxRequestBytes: 6 * 1024 * 1024,
  singleCallChars: 120_000,
  chunkChars: 80_000,
} as const;
