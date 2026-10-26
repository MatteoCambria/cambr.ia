/**
 * Rendu complet de la bande-son d'Orrhéa : `npm run audio`.
 *
 *   npx tsx tools/audio/render.ts [--only=id,id] [--jobs=4] [--keep-wav=dossier] [--no-verify]
 *
 * 1. Rend chaque morceau (stems) et chaque SFX en PCM flottant 44,1 kHz (WAV temporaires) ;
 * 2. encode en MP3 avec ffmpeg/libmp3lame (musique 112-128 kb/s stéréo, SFX 96 kb/s mono ou
 *    128 kb/s stéréo) dans public/audio/music et public/audio/sfx ;
 * 3. vérifie chaque MP3 (durée ffprobe, sonie EBU R128 et crête vraie / crête décodée) ;
 * 4. écrit public/audio/manifest.json.
 * Les morceaux sont répartis sur plusieurs processus (un par cœur).
 */
import { fork, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeWav } from './dsp/wav';
import { SR } from './dsp/core';
import { renderSong, stemFileId, renderSfx, loopFile, SONGS, CUES, SFX, getSong, getSfx, cueOf, LOOP_PAD, LOOP_START } from './api';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const OUT = join(ROOT, 'public', 'audio');
const MANIFEST = join(OUT, 'manifest.json');

// ------------------------------------------------------------------------------- Types manifeste

export interface ManifestStem {
  id: string;
  role: string;
  file: string;
  minIntensity: number;
  duration: number;
  fileDuration: number;
  bytes: number;
  lufs: number;
  truePeakDb: number;
}

export interface ManifestMusic {
  id: string;
  cue: string;
  variation: number;
  title: string;
  description: string;
  /** Fichier principal (premier stem). */
  file: string;
  /** Durée musicale (= longueur de boucle pour les boucles), s. */
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  /** Gain de lecture conseillé (linéaire). */
  gain: number;
  lufs: number;
  /** Sonie par niveau d'intensité cumulé (0, 1, 2). */
  intensityLufs: number[];
  stems: ManifestStem[];
}

export interface ManifestSfx {
  id: string;
  file: string;
  duration: number;
  bytes: number;
  bus: 'ui' | 'sfx';
  channels: number;
  gain: number;
  pitchVar: number;
  maxVoices: number;
  throttleMs: number;
  group: string | null;
  loudness: number;
  peakDb: number;
  description: string;
}

export interface Manifest {
  version: number;
  generator: string;
  sampleRate: number;
  loopPadding: number;
  music: ManifestMusic[];
  sfx: ManifestSfx[];
}

// ---------------------------------------------------------------------------------- Encodage

const BITRATE: Record<string, string> = { default: '128k', stem: '112k', ambience: '112k', sfxMono: '96k', sfxStereo: '128k' };

function ffmpeg(args: string[]): string {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`ffmpeg introuvable : ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg a échoué (${r.status}) : ${r.stderr.slice(-800)}`);
  return r.stderr;
}

function encodeMp3(wav: string, mp3: string, bitrate: string, mono: boolean): void {
  mkdirSync(dirname(mp3), { recursive: true });
  ffmpeg(['-y', '-loglevel', 'error', '-i', wav, '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '1', '-c:a', 'libmp3lame', '-b:a', bitrate, ...(mono ? ['-ac', '1'] : ['-ac', '2']), '-ar', String(SR), mp3]);
}

function probeDuration(file: string): number {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat((r.stdout || '0').trim()) || 0;
}

/** Sonie intégrée et crête vraie du MP3 décodé (filtre ebur128 de ffmpeg). */
function probeLoudness(file: string): { lufs: number; truePeakDb: number } {
  const err = ffmpeg(['-nostats', '-i', file, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary);
  const P = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary);
  return { lufs: I ? parseFloat(I[1]) : -70, truePeakDb: P ? parseFloat(P[1]) : -99 };
}

/** Crête d'échantillon du MP3 décodé (volumedetect). */
function probePeak(file: string): number {
  const err = ffmpeg(['-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /max_volume:\s+(-?[\d.]+) dB/.exec(err);
  return m ? parseFloat(m[1]) : -99;
}

// ----------------------------------------------------------------------------------- Tâches

type Job = { kind: 'song'; id: string } | { kind: 'sfx'; ids: string[] };
type JobResult = { kind: 'song'; music: ManifestMusic; log: string[] } | { kind: 'sfx'; sfx: ManifestSfx[]; log: string[] };

function runJob(job: Job, wavDir: string, verify: boolean): JobResult {
  const log: string[] = [];
  if (job.kind === 'song') {
    const song = getSong(job.id);
    const t0 = Date.now();
    const r = renderSong(song);
    const variation = CUES.find((c) => c.cue === cueOf(song.id))?.songs.findIndex((s) => s.id === song.id) ?? 0;
    const stems: ManifestStem[] = [];
    for (const st of r.stems) {
      const id = stemFileId(song, st.name);
      const wav = join(wavDir, `${id}.wav`);
      writeWav(wav, song.loop ? loopFile(st.audio) : st.audio);
      const rel = `music/${id}.mp3`;
      const mp3 = join(OUT, rel);
      const br = song.id === 'ambience' ? BITRATE.ambience : r.stems.length > 1 ? BITRATE.stem : BITRATE.default;
      encodeMp3(wav, mp3, br, false);
      const fileDuration = probeDuration(mp3);
      const meas = verify ? probeLoudness(mp3) : { lufs: st.lufs, truePeakDb: st.truePeakDb };
      stems.push({
        id,
        role: st.name,
        file: rel,
        minIntensity: st.minIntensity,
        duration: +(r.length / SR).toFixed(4),
        fileDuration: +fileDuration.toFixed(4),
        bytes: statSync(mp3).size,
        lufs: meas.lufs,
        truePeakDb: meas.truePeakDb,
      });
      log.push(
        `  ${id.padEnd(16)} ${(r.length / SR).toFixed(2).padStart(6)} s  fichier ${fileDuration.toFixed(2)} s  ${(statSync(mp3).size / 1024).toFixed(0).padStart(5)} Ko  ` +
          `rendu ${st.lufs.toFixed(1)} LUFS / TP ${st.truePeakDb.toFixed(2)} dB  mp3 ${meas.lufs.toFixed(1)} LUFS / TP ${meas.truePeakDb.toFixed(2)} dB` +
          (st.seam !== undefined ? `  couture ${st.seam.toFixed(3)}` : ''),
      );
    }
    log.unshift(`♪ ${song.id} (${song.title}) — ${((Date.now() - t0) / 1000).toFixed(1)} s de calcul ; intensités ${r.intensityLufs.map((x) => x.toFixed(1)).join(' / ')} LUFS, crêtes ${r.intensityPeaksDb.map((x) => x.toFixed(2)).join(' / ')} dBTP`);
    const duration = +(r.length / SR).toFixed(4);
    const music: ManifestMusic = {
      id: song.id,
      cue: cueOf(song.id),
      variation: variation + 1,
      title: song.title,
      description: song.description,
      file: stems[0].file,
      duration,
      loop: song.loop,
      loopStart: song.loop ? LOOP_START : 0,
      loopEnd: song.loop ? +(LOOP_START + duration).toFixed(4) : duration,
      bpm: song.bpm,
      beatsPerBar: song.beatsPerBar,
      bars: song.bars,
      gain: song.gain ?? 1,
      lufs: +r.fullLufs.toFixed(2),
      intensityLufs: r.intensityLufs.map((x) => +x.toFixed(2)),
      stems,
    };
    return { kind: 'song', music, log };
  }
  const out: ManifestSfx[] = [];
  for (const id of job.ids) {
    const def = getSfx(id);
    const r = renderSfx(def);
    const wav = join(wavDir, `sfx_${id}.wav`);
    writeWav(wav, r.audio);
    const rel = `sfx/${id}.mp3`;
    const mp3 = join(OUT, rel);
    encodeMp3(wav, mp3, r.channels === 2 ? BITRATE.sfxStereo : BITRATE.sfxMono, r.channels === 1);
    const dur = probeDuration(mp3);
    const pk = verify ? probePeak(mp3) : r.peakDb;
    out.push({
      id,
      file: rel,
      duration: +dur.toFixed(4),
      bytes: statSync(mp3).size,
      bus: def.bus,
      channels: r.channels,
      gain: 1,
      pitchVar: def.pitchVar,
      maxVoices: def.maxVoices,
      throttleMs: def.throttleMs,
      group: def.group ?? null,
      loudness: +r.loudness.toFixed(2),
      peakDb: pk,
      description: def.description,
    });
    log.push(`  ${id.padEnd(15)} ${r.duration.toFixed(3)} s (mp3 ${dur.toFixed(3)} s) ${String(r.channels)}c ${(statSync(mp3).size / 1024).toFixed(1).padStart(5)} Ko  sonie ${r.loudness.toFixed(1)} LUFS  crête mp3 ${pk.toFixed(2)} dB`);
  }
  return { kind: 'sfx', sfx: out, log };
}

// ---------------------------------------------------------------------------- Orchestration

function parseArgs(argv: string[]): { only: string[] | null; jobs: number; keepWav: string | null; verify: boolean; worker: boolean; job: Job | null; wavDir: string | null } {
  const get = (k: string): string | undefined => argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  const only = get('only');
  const job = get('job');
  return {
    only: only ? only.split(',').map((s) => s.trim()).filter(Boolean) : null,
    jobs: Math.max(1, parseInt(get('jobs') ?? String(Math.min(4, cpus().length)), 10)),
    keepWav: get('keep-wav') ?? null,
    verify: !argv.includes('--no-verify'),
    worker: argv.includes('--worker'),
    job: job ? (JSON.parse(job) as Job) : null,
    wavDir: get('wav-dir') ?? null,
  };
}

function planJobs(only: string[] | null): Job[] {
  const want = (id: string, cue?: string): boolean => !only || only.includes(id) || (cue !== undefined && only.includes(cue)) || only.includes(cue ? 'music' : 'sfx');
  // Morceaux les plus longs d'abord (meilleure répartition).
  const songs = SONGS.filter((s) => want(s.id, cueOf(s.id)))
    .map((s) => ({ s, cost: s.bars * s.beatsPerBar * (60 / s.bpm) * s.stems.length }))
    .sort((a, b) => b.cost - a.cost)
    .map(({ s }): Job => ({ kind: 'song', id: s.id }));
  const sfxIds = SFX.map((x) => x.id).filter((id) => want(id));
  const jobs: Job[] = [...songs];
  const chunk = Math.ceil(sfxIds.length / 2);
  for (let i = 0; i < sfxIds.length; i += chunk) jobs.push({ kind: 'sfx', ids: sfxIds.slice(i, i + chunk) });
  return jobs;
}

async function runPool(jobs: Job[], n: number, wavDir: string, verify: boolean): Promise<JobResult[]> {
  const results: JobResult[] = [];
  let next = 0;
  const script = fileURLToPath(import.meta.url);
  const runOne = (job: Job): Promise<JobResult> =>
    new Promise((res, rej) => {
      const child = fork(script, ['--worker', `--job=${JSON.stringify(job)}`, `--wav-dir=${wavDir}`, ...(verify ? [] : ['--no-verify'])], { execArgv: process.execArgv, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      let got: JobResult | null = null;
      child.on('message', (m) => {
        got = m as JobResult;
      });
      child.on('error', rej);
      child.on('exit', (code) => (got ? res(got) : rej(new Error(`tâche ${JSON.stringify(job).slice(0, 80)} : code ${code}`))));
    });
  const lanes = Array.from({ length: Math.min(n, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await runOne(job);
      for (const line of r.log) console.log(line);
      results.push(r);
    }
  });
  await Promise.all(lanes);
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.worker && args.job && args.wavDir) {
    const r = runJob(args.job, args.wavDir, args.verify);
    process.send?.(r);
    return;
  }
  const t0 = Date.now();
  mkdirSync(join(OUT, 'music'), { recursive: true });
  mkdirSync(join(OUT, 'sfx'), { recursive: true });
  const wavDir = args.keepWav ? resolve(args.keepWav) : mkdtempSync(join(tmpdir(), 'orrhea-audio-'));
  mkdirSync(wavDir, { recursive: true });
  const jobs = planJobs(args.only);
  console.log(`Orrhéa — rendu de ${jobs.length} tâche(s) sur ${args.jobs} processus (WAV temporaires : ${wavDir})`);
  let results: JobResult[];
  if (args.jobs <= 1) {
    results = [];
    for (const j of jobs) {
      const r = runJob(j, wavDir, args.verify);
      for (const line of r.log) console.log(line);
      results.push(r);
    }
  } else {
    results = await runPool(jobs, args.jobs, wavDir, args.verify);
  }

  // Fusion avec le manifeste existant (rendu partiel) puis tri dans l'ordre canonique.
  let manifest: Manifest = { version: 1, generator: 'tools/audio/render.ts', sampleRate: SR, loopPadding: LOOP_PAD, music: [], sfx: [] };
  if (args.only && existsSync(MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
    } catch {
      /* manifeste illisible : régénéré */
    }
  }
  for (const r of results) {
    if (r.kind === 'song') manifest.music = [...manifest.music.filter((m) => m.id !== r.music.id), r.music];
    else for (const s of r.sfx) manifest.sfx = [...manifest.sfx.filter((x) => x.id !== s.id), s];
  }
  const songOrder = SONGS.map((s) => s.id);
  const sfxOrder = SFX.map((s) => s.id as string);
  manifest.music.sort((a, b) => songOrder.indexOf(a.id) - songOrder.indexOf(b.id));
  manifest.sfx.sort((a, b) => sfxOrder.indexOf(a.id) - sfxOrder.indexOf(b.id));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  const total = [...manifest.music.flatMap((m) => m.stems.map((s) => s.bytes)), ...manifest.sfx.map((s) => s.bytes)].reduce((a, b) => a + b, 0);
  const musicBytes = manifest.music.flatMap((m) => m.stems.map((s) => s.bytes)).reduce((a, b) => a + b, 0);
  console.log(`\nManifeste : ${manifest.music.length} morceaux (${manifest.music.reduce((a, m) => a + m.stems.length, 0)} fichiers), ${manifest.sfx.length} SFX.`);
  console.log(`Taille totale : ${(total / 1024 / 1024).toFixed(2)} Mo (musique ${(musicBytes / 1024 / 1024).toFixed(2)} Mo, SFX ${((total - musicBytes) / 1024).toFixed(0)} Ko).`);
  const hot = [...manifest.music.flatMap((m) => m.stems), ...manifest.sfx].filter((x) => ('truePeakDb' in x ? x.truePeakDb : x.peakDb) > -1);
  if (hot.length) console.warn(`⚠ crête > -1 dBFS : ${hot.map((h) => h.id).join(', ')}`);
  if (!args.keepWav) rmSync(wavDir, { recursive: true, force: true });
  console.log(`Terminé en ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
