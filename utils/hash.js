// Lightweight deterministic hash (FNV-1a 32-bit) for short strings
export function hashString(input) {
  if (input == null) input = '';
  let str = String(input);
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // FNV prime 16777619 with 32-bit overflow
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  // Convert to unsigned and hex string
  return (h >>> 0).toString(16);
}

export function buildFingerprint({ url = '', title = '', subject = '', studentAnswer = '', correctAnswer = '' }) {
  const base = `${url}|${title}|${subject}|${studentAnswer}|${correctAnswer}`;
  return hashString(base);
}



