// Simulator fixture only, not device measurements. Independent big-endian encoding.
export function meterFixture({ levels = {}, peak = -24, midi = 3 } = {}) {
  const values = Array(830).fill(-24);
  for (let i = 0; i < 24; i++) values[i * 10 + 3] = levels[`ch${i + 1}`] ?? -24;
  for (let i = 0; i < 3; i++)
    values[240 + i * 20 + 3] = values[240 + i * 20 + 13] =
      levels[`st${i + 1}`] ?? -24;
  values[687] = values[688] = peak;
  const bytes = values.flatMap((db) => {
    const raw = Math.round(db * 256 + 32768);
    return [raw >>> 8, raw & 255];
  });
  const packed = [];
  for (let i = 0; i < bytes.length; i += 7) {
    const group = bytes.slice(i, i + 7);
    packed.push(
      group.reduce((mask, b, j) => mask | ((b >>> 7) << (6 - j)), 0),
      ...group.map((b) => b & 127),
    );
  }
  return [240, 0, 0, 26, 80, 17, 1, 0, midi, 19, ...packed, 247];
}
