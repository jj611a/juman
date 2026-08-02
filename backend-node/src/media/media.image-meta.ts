export interface ImageMetadata {
  readonly width: number | null;
  readonly height: number | null;
  readonly orientation: number | null;
}

/** Best-effort image dimension/orientation extraction (no thumbnail generation). */
export function readImageMetadata(buffer: Buffer, extension: string): ImageMetadata {
  const ext = extension.toLowerCase();
  try {
    if (ext === 'png') return readPng(buffer);
    if (ext === 'jpg' || ext === 'jpeg') return readJpeg(buffer);
    if (ext === 'gif') return readGif(buffer);
    if (ext === 'webp') return readWebp(buffer);
    if (ext === 'bmp') return readBmp(buffer);
  } catch {
    /* ignore corrupt headers */
  }
  return { width: null, height: null, orientation: null };
}

function readPng(buf: Buffer): ImageMetadata {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') {
    return empty();
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    orientation: null,
  };
}

function readGif(buf: Buffer): ImageMetadata {
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'GIF') return empty();
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), orientation: null };
}

function readBmp(buf: Buffer): ImageMetadata {
  if (buf.length < 26 || buf.toString('ascii', 0, 2) !== 'BM') return empty();
  return {
    width: Math.abs(buf.readInt32LE(18)),
    height: Math.abs(buf.readInt32LE(22)),
    orientation: null,
  };
}

function readWebp(buf: Buffer): ImageMetadata {
  if (
    buf.length < 16 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return empty();
  }
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      orientation: null,
    };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      orientation: null,
    };
  }
  return empty();
}

function readJpeg(buf: Buffer): ImageMetadata {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return empty();
  let offset = 2;
  let orientation: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    const size = buf.readUInt16BE(offset + 2);
    if (marker === 0xe1 && size >= 8) {
      orientation = readExifOrientation(buf.subarray(offset + 4, offset + 2 + size)) ?? orientation;
    }
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      height = buf.readUInt16BE(offset + 5);
      width = buf.readUInt16BE(offset + 7);
      break;
    }
    offset += 2 + size;
  }
  return { width, height, orientation };
}

function readExifOrientation(segment: Buffer): number | null {
  if (segment.length < 14 || segment.toString('ascii', 0, 4) !== 'Exif') return null;
  const tiff = segment.subarray(6);
  const little = tiff.toString('ascii', 0, 2) === 'II';
  const read16 = (i: number) => (little ? tiff.readUInt16LE(i) : tiff.readUInt16BE(i));
  const read32 = (i: number) => (little ? tiff.readUInt32LE(i) : tiff.readUInt32BE(i));
  if (tiff.length < 8) return null;
  const ifd = read32(4);
  if (ifd + 2 > tiff.length) return null;
  const entries = read16(ifd);
  for (let i = 0; i < entries; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) break;
    if (read16(entry) === 0x0112) {
      return read16(entry + 8);
    }
  }
  return null;
}

function empty(): ImageMetadata {
  return { width: null, height: null, orientation: null };
}
