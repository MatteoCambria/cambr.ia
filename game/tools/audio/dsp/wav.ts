/** Écriture/lecture WAV (PCM flottant 32 bits ou entier 16 bits). */
import { writeFileSync, readFileSync } from 'node:fs';
import { SR, type Stereo } from './core';

export function encodeWav(s: Stereo | Float32Array, opts: { float?: boolean } = {}): Buffer {
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  const nch = chans.length;
  const n = chans[0].length;
  const float = opts.float ?? true;
  const bps = float ? 4 : 2;
  const dataSize = n * nch * bps;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(float ? 3 : 1, 20);
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * nch * bps, 28);
  buf.writeUInt16LE(nch * bps, 32);
  buf.writeUInt16LE(bps * 8, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const v = chans[c][i];
      if (float) buf.writeFloatLE(v, o);
      else buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), o);
      o += bps;
    }
  }
  return buf;
}

export function writeWav(path: string, s: Stereo | Float32Array, opts: { float?: boolean } = {}): void {
  writeFileSync(path, encodeWav(s, opts));
}

/** Lecture minimale d'un WAV PCM16 / float32 (pour vérifications). */
export function readWav(path: string): { sampleRate: number; channels: Float32Array[] } {
  const b = readFileSync(path);
  let o = 12;
  let fmt = 1;
  let nch = 1;
  let rate = SR;
  let bits = 16;
  while (o < b.length - 8) {
    const id = b.toString('ascii', o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') {
      fmt = b.readUInt16LE(o + 8);
      nch = b.readUInt16LE(o + 10);
      rate = b.readUInt32LE(o + 12);
      bits = b.readUInt16LE(o + 22);
    } else if (id === 'data') {
      const bps = bits / 8;
      const n = Math.floor(size / (bps * nch));
      const channels = Array.from({ length: nch }, () => new Float32Array(n));
      let p = o + 8;
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < nch; c++) {
          channels[c][i] = fmt === 3 ? b.readFloatLE(p) : b.readInt16LE(p) / 32768;
          p += bps;
        }
      }
      return { sampleRate: rate, channels };
    }
    o += 8 + size + (size & 1);
  }
  throw new Error(`WAV invalide : ${path}`);
}
