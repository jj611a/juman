import { describe, expect, it } from 'vitest';
import { readImageMetadata } from '../src/media/media.image-meta';

describe('readImageMetadata', () => {
  it('reads png gif bmp', () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    expect(readImageMetadata(png, 'png')).toMatchObject({ width: 1, height: 1 });

    // GIF89a 1x1
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    expect(readImageMetadata(gif, 'gif').width).toBe(1);

    // BMP 1x1 24-bit minimal header
    const bmp = Buffer.alloc(54);
    bmp.write('BM');
    bmp.writeInt32LE(1, 18);
    bmp.writeInt32LE(1, 22);
    expect(readImageMetadata(bmp, 'bmp')).toMatchObject({ width: 1, height: 1 });
  });

  it('reads jpeg sof and handles corrupt buffers', () => {
    // minimal JPEG with SOF0
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 0x01, 0x11, 0x00, 0x02,
      0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
    ]);
    const meta = readImageMetadata(jpeg, 'jpg');
    expect(meta.width).toBe(0x20);
    expect(meta.height).toBe(0x10);

    expect(readImageMetadata(Buffer.from([1, 2, 3]), 'png')).toEqual({
      width: null,
      height: null,
      orientation: null,
    });
    expect(readImageMetadata(Buffer.alloc(0), 'jpeg').width).toBeNull();
    expect(readImageMetadata(Buffer.from('nope'), 'webp').width).toBeNull();
    expect(readImageMetadata(Buffer.from('nope'), 'txt').width).toBeNull();
  });

  it('reads webp vp8 and vp8l', () => {
    const vp8 = Buffer.alloc(30);
    vp8.write('RIFF', 0);
    vp8.write('WEBP', 8);
    vp8.write('VP8 ', 12);
    vp8.writeUInt16LE(100, 26);
    vp8.writeUInt16LE(50, 28);
    expect(readImageMetadata(vp8, 'webp')).toMatchObject({ width: 100, height: 50 });

    const vp8l = Buffer.alloc(25);
    vp8l.write('RIFF', 0);
    vp8l.write('WEBP', 8);
    vp8l.write('VP8L', 12);
    // width-1=9 (10), height-1=19 (20) packed
    const bits = 9 | (19 << 14);
    vp8l.writeUInt32LE(bits, 21);
    expect(readImageMetadata(vp8l, 'webp')).toMatchObject({ width: 10, height: 20 });

    const unknown = Buffer.alloc(30);
    unknown.write('RIFF', 0);
    unknown.write('WEBP', 8);
    unknown.write('VP8X', 12);
    expect(readImageMetadata(unknown, 'webp').width).toBeNull();
  });

  it('reads jpeg exif orientation when present', () => {
    // Build APP1 Exif with orientation=6
    const tiff = Buffer.alloc(26);
    tiff.write('MM', 0); // big endian
    tiff.writeUInt16BE(0x002a, 2);
    tiff.writeUInt32BE(8, 4); // IFD offset
    tiff.writeUInt16BE(1, 8); // 1 entry
    tiff.writeUInt16BE(0x0112, 10); // orientation tag
    tiff.writeUInt16BE(3, 12); // SHORT
    tiff.writeUInt32BE(1, 14); // count
    tiff.writeUInt16BE(6, 18); // value
    const exifHeader = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
    const app1Payload = Buffer.concat([exifHeader, tiff]);
    const app1 = Buffer.alloc(4 + app1Payload.length);
    app1[0] = 0xff;
    app1[1] = 0xe1;
    app1.writeUInt16BE(app1Payload.length + 2, 2);
    app1Payload.copy(app1, 4);

    const sof = Buffer.from([
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x02, 0x01, 0x01, 0x11, 0x00,
    ]);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sof, Buffer.from([0xff, 0xd9])]);
    const meta = readImageMetadata(jpeg, 'jpeg');
    expect(meta.orientation).toBe(6);
    expect(meta.width).toBe(2);
  });
});
