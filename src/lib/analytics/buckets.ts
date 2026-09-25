/** Coarse buckets so raw sizes and dimensions are never reported. */

export function fileSizeBucket(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 20) return "lt_20kb";
  if (kb < 50) return "20_50kb";
  if (kb < 200) return "50_200kb";
  if (kb < 1024) return "200kb_1mb";
  if (kb < 5 * 1024) return "1_5mb";
  if (kb < 10 * 1024) return "5_10mb";
  return "gte_10mb";
}

export function megapixelBucket(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  if (mp < 0.1) return "lt_0.1mp";
  if (mp < 1) return "0.1_1mp";
  if (mp < 4) return "1_4mp";
  if (mp < 12) return "4_12mp";
  if (mp < 24) return "12_24mp";
  return "gte_24mp";
}
