export type StreamType = 'hls' | 'mjpeg' | 'iframe';

export const detectStreamType = (url?: string | null): StreamType => {
  if (!url) return 'iframe';
  const lower = url.toLowerCase();
  const looksLikeHls =
    lower.includes('.m3u8') ||
    lower.includes('/hls/') ||
    lower.includes('/hls-') ||
    lower.includes('m3u8') ||
    // Our internal proxy path
    (lower.includes('/api/cctv/') && lower.includes('/stream'));
  if (looksLikeHls) {
    return 'hls';
  }

  const looksLikeMjpeg =
    lower.includes('mjpg') ||
    lower.includes('mjpeg') ||
    lower.includes('/mjpeg/') ||
    lower.includes('axis-cgi/mjpg') ||
    lower.includes('cgi-bin/faststream.jpg') ||
    lower.includes('mjpegstream.cgi') ||
    lower.includes('mjpg/video.cgi') ||
    lower.includes('video.cgi') ||
    lower.includes('action=stream');

  if (looksLikeMjpeg) {
    return 'mjpeg';
  }

  return 'iframe';
};
