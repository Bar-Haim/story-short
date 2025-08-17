import { spawn } from 'node:child_process';

type KenBurnsOpts = {
  imagePath: string;           // absolute path to jpg/png
  outPath: string;             // absolute path to temp mp4
  width: number;               // e.g. 1080
  height: number;              // e.g. 1920
  fps: number;                 // e.g. 30
  seconds: number;             // clip duration
  maxZoom?: number;            // e.g. 1.12
  direction?: 'in'|'out'|'panL'|'panR'; // picked per scene
};

/**
 * Render a single image to an MP4 clip with a gentle Ken Burns move.
 * Windows-safe (no shell interpolation). Rejects on ffmpeg error.
 */
export function renderKenBurnsClip(opts: KenBurnsOpts): Promise<void> {
  const {
    imagePath, outPath, width, height, fps, seconds,
    maxZoom = 1.12, direction = 'in',
  } = opts;

  // frames to render
  const frames = Math.max(1, Math.round(seconds * fps));

  // Build a subtle motion expression
  // zoom: in → 1 → maxZoom,  out → maxZoom → 1
  const zExpr =
    direction === 'out'
      ? `max(1.0, ${maxZoom} - (on/${frames})*(${maxZoom}-1.0))`
      : `min(${maxZoom}, 1.0 + (on/${frames})*(${maxZoom}-1.0))`;

  // tiny sideways pan (optional variety)
  const panAmount = 0.06; // up to 6% width
  const xExpr =
    direction === 'panL'
      ? `max(0, (iw*${panAmount})*(1 - on/${frames}))`
      : direction === 'panR'
      ? `min(iw*${panAmount}, (iw*${panAmount})*(on/${frames}))`
      : `iw/2 - (iw/zoom/2)`; // center for zoom in/out
  const yExpr = `ih/2 - (ih/zoom/2)`;

  // Scale a bit larger, then zoom/pan and crop to target size
  const vf = [
    // upscale a bit to avoid black borders during motion
    `scale=${Math.ceil(width*1.25)}:${-1}`,
    // fit vertical if needed then pad/crop to target aspect
    `scale='if(gte(a,${width}/${height}),-2,${width})':'if(gte(a,${width}/${height}),${height},-2)'`,
    // zoom/pan with smooth motion
    `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${width}x${height}`,
    // enforce target fps
    `fps=${fps}`
  ].join(',');

  const args = [
    '-y',
    '-loop','1',                    // loop still image
    '-i', imagePath,
    '-t', String(seconds),          // clip duration
    '-r', String(fps),
    '-vf', vf,
    '-an',                          // no audio in per-image clips
    '-c:v','libx264',
    '-preset','fast',
    '-crf','20',
    '-movflags','+faststart',
    outPath,
  ];

  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', args, { stdio: 'inherit', shell: false });
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg kenburns exited ${code}`))));
  });
} 