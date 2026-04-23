import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL parameter required' });

  let videoId = '';
  try {
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0].split('&')[0];
    } else {
      const u = new URL(url);
      videoId = u.searchParams.get('v');
    }
    if (!videoId) throw new Error('Invalid URL');
  } catch {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const outPath = join(tmpdir(), `nova_${videoId}_${Date.now()}.mp3`);

  try {
    // Download audio pakai yt-dlp
    await execAsync(
      `yt-dlp -x --audio-format mp3 --audio-quality 192K ` +
      `--no-playlist --max-filesize 50m ` +
      `--output "${outPath}" ` +
      `--print-json ` +
      `"https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 55000 }
    );

    if (!existsSync(outPath)) throw new Error('File not found after download');

    const file = readFileSync(outPath);
    try { unlinkSync(outPath); } catch {}

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp3"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(file);

  } catch (err) {
    try { if (existsSync(outPath)) unlinkSync(outPath); } catch {}
    console.error('yt-dlp error:', err.message);
    return res.status(500).json({ error: err.message || 'Download failed' });
  }
}

export const config = {
  api: { responseLimit: '50mb' },
};
