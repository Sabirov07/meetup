/**
 * Reads an image's pixel size straight out of its header.
 *
 * Worth the 80 lines: with width and height stored alongside the bytes, the
 * document renderer can reserve the right box before the image arrives, so a
 * doc with five screenshots in it does not reflow five times as it loads. No
 * decoder is needed for that — every one of these formats states its size in
 * the first few dozen bytes.
 *
 * Returns null for anything it does not recognise (AVIF, for instance, needs a
 * real box parser), and the renderer then simply lets the image size itself.
 */

export type ImageSize = { width: number; height: number };

export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readPng(bytes) ?? readGif(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  let out = "";
  for (let i = at; i < at + length && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

const be16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const be32 = (b: Uint8Array, at: number) =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const le16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const le24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

function readPng(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((byte, index) => bytes[index] !== byte)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return { width: be32(bytes, 16), height: be32(bytes, 20) };
}

function readGif(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 10 || ascii(bytes, 0, 4) !== "GIF8") return null;
  return { width: le16(bytes, 6), height: le16(bytes, 8) };
}

function readJpeg(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1; // Resynchronise across padding bytes.
      continue;
    }
    const marker = bytes[at + 1];

    // Standalone markers carry no payload length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    // A start-of-frame marker — SOF0 through SOF15, minus the three that are
    // not frame headers — states the frame's size.
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return { height: be16(bytes, at + 5), width: be16(bytes, at + 7) };
    }
    const length = be16(bytes, at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;

  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8 ") {
    // Lossy: a 14-bit dimension pair after the key-frame start code.
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    // Lossless: 14 bits each, bit-packed, both stored one less than actual.
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    // Extended: the canvas size, 24-bit little-endian, also off by one.
    return { width: 1 + le24(bytes, 24), height: 1 + le24(bytes, 27) };
  }
  return null;
}
