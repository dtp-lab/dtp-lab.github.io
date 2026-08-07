import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const siteDir = path.resolve("site");
const galleryRoots = {
  original: path.join(siteDir, "assets", "gallery"),
  thumbnail: path.join(siteDir, "assets", "gallery-thumbs"),
};
const maxAssetBytes = 2 * 1024 * 1024;
const formatByExtension = new Map([
  [".jpg", "JPEG"],
  [".jpeg", "JPEG"],
  [".png", "PNG"],
  [".webp", "WEBP"],
]);
const mimeByFormat = new Map([
  ["JPEG", "image/jpeg"],
  ["PNG", "image/png"],
  ["WEBP", "image/webp"],
]);

const walkFiles = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const stat = fs.lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, `Gallery assets must not be symbolic links: ${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else assert.fail(`Gallery asset is neither a file nor directory: ${absolute}`);
    }
  };
  visit(root);
  return files;
};

const chunks = (buffer, offset, littleEndian = false) => {
  const result = [];
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset + (littleEndian ? 0 : 4), offset + (littleEndian ? 4 : 8)).toString("ascii");
    const size = littleEndian ? buffer.readUInt32LE(offset + 4) : buffer.readUInt32BE(offset);
    const dataOffset = offset + 8;
    const end = dataOffset + size;
    if (end > buffer.length) break;
    result.push({ type, data: buffer.subarray(dataOffset, end) });
    offset = end + (littleEndian ? size % 2 : 4);
    if (!littleEndian && type === "IEND") break;
  }
  return result;
};

const inspectJpeg = (buffer) => {
  assert.equal(buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), true);
  let offset = 2;
  let width = 0;
  let height = 0;
  let exif = false;
  let xmp = false;
  let iptc = false;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = buffer.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= buffer.length, "Invalid JPEG segment length");
    const payload = buffer.subarray(offset + 2, offset + length);
    if (startOfFrame.has(marker) && payload.length >= 5) {
      height = payload.readUInt16BE(1);
      width = payload.readUInt16BE(3);
    }
    if (marker === 0xe1 && payload.subarray(0, 6).equals(Buffer.from("Exif\0\0", "binary"))) exif = true;
    if (marker === 0xe1 && (
      payload.subarray(0, 29).toString("binary") === "http://ns.adobe.com/xap/1.0/\0"
      || payload.includes(Buffer.from("<x:xmpmeta"))
    )) xmp = true;
    if (marker === 0xed && (payload.includes(Buffer.from("Photoshop 3.0\0", "binary")) || payload.includes(Buffer.from("8BIM")))) iptc = true;
    offset += length;
  }
  assert.ok(width > 0 && height > 0, "JPEG dimensions were not found");
  return { format: "JPEG", mime: "image/jpeg", width, height, hasAlpha: false, exif, xmp, iptc };
};

const inspectPng = (buffer) => {
  assert.equal(buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  const parsed = chunks(buffer, 8);
  const header = parsed.find((chunk) => chunk.type === "IHDR")?.data;
  assert.ok(header?.length === 13, "PNG IHDR is missing or invalid");
  const metadataPayloads = parsed.filter((chunk) => ["iTXt", "tEXt", "zTXt"].includes(chunk.type));
  const hasText = (needle) => metadataPayloads.some((chunk) => chunk.data.toString("binary").toLowerCase().includes(needle));
  const colorType = header[9];
  return {
    format: "PNG",
    mime: "image/png",
    width: header.readUInt32BE(0),
    height: header.readUInt32BE(4),
    hasAlpha: colorType === 4 || colorType === 6 || parsed.some((chunk) => chunk.type === "tRNS"),
    exif: parsed.some((chunk) => chunk.type === "eXIf"),
    xmp: hasText("xml:com.adobe.xmp") || hasText("<x:xmpmeta"),
    iptc: hasText("raw profile type iptc"),
  };
};

const inspectWebp = (buffer) => {
  assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP");
  const parsed = chunks(buffer, 12, true);
  const extended = parsed.find((chunk) => chunk.type === "VP8X")?.data;
  const lossy = parsed.find((chunk) => chunk.type === "VP8 ")?.data;
  const lossless = parsed.find((chunk) => chunk.type === "VP8L")?.data;
  let width = 0;
  let height = 0;
  let hasAlpha = parsed.some((chunk) => chunk.type === "ALPH");
  if (extended?.length >= 10) {
    width = 1 + extended[4] + (extended[5] << 8) + (extended[6] << 16);
    height = 1 + extended[7] + (extended[8] << 8) + (extended[9] << 16);
    hasAlpha ||= Boolean(extended[0] & 0x10);
  } else if (lossy?.length >= 10 && lossy.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    width = lossy.readUInt16LE(6) & 0x3fff;
    height = lossy.readUInt16LE(8) & 0x3fff;
  } else if (lossless?.length >= 5 && lossless[0] === 0x2f) {
    const bits = lossless.readUInt32LE(1);
    width = 1 + (bits & 0x3fff);
    height = 1 + ((bits >>> 14) & 0x3fff);
    hasAlpha ||= Boolean(bits & 0x10000000);
  }
  assert.ok(width > 0 && height > 0, "WebP dimensions were not found");
  return {
    format: "WEBP",
    mime: "image/webp",
    width,
    height,
    hasAlpha,
    exif: parsed.some((chunk) => chunk.type === "EXIF") || Boolean(extended?.[0] & 0x08),
    xmp: parsed.some((chunk) => chunk.type === "XMP ") || Boolean(extended?.[0] & 0x04),
    iptc: false,
  };
};

const inspectImage = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  let result;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) result = inspectJpeg(buffer);
  else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) result = inspectPng(buffer);
  else if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") result = inspectWebp(buffer);
  else assert.fail(`Unsupported image signature: ${filePath}`);
  const extension = path.extname(filePath).toLowerCase();
  assert.equal(formatByExtension.get(extension), result.format, `Extension/signature mismatch: ${filePath}`);
  assert.equal(mimeByFormat.get(result.format), result.mime, `MIME/signature mismatch: ${filePath}`);
  assert.ok(buffer.length <= maxAssetBytes, `Gallery asset exceeds 2 MiB: ${filePath}`);
  assert.equal(result.exif, false, `EXIF remains: ${filePath}`);
  assert.equal(result.xmp, false, `XMP remains: ${filePath}`);
  assert.equal(result.iptc, false, `IPTC remains: ${filePath}`);
  return { ...result, bytes: buffer.length };
};

test("Gallery assets satisfy the v2.1.6 path, reference, format, metadata, and size invariants", () => {
  const gallery = JSON.parse(fs.readFileSync(path.join(siteDir, "data", "gallery.json"), "utf8"));
  assert.ok(gallery.events.length > 0);
  const eventIds = new Set();
  const originalReferences = new Set();
  const thumbnailReferences = new Set();
  let imageCount = 0;

  for (const event of gallery.events) {
    assert.match(event.id, /^[0-9a-f]{12}$/);
    assert.equal(eventIds.has(event.id), false, `Duplicate Gallery event ID: ${event.id}`);
    eventIds.add(event.id);
    const eventStems = new Set();
    for (const image of event.images) {
      imageCount += 1;
      const originalReference = image.src.match(new RegExp(`^assets/gallery/${event.id}/(0[1-9]|[1-9][0-9]+)\\.(jpe?g|png|webp)$`));
      const thumbnailReference = image.thumbnail.match(new RegExp(`^assets/gallery-thumbs/${event.id}/(0[1-9]|[1-9][0-9]+)\\.(jpe?g|png|webp)$`));
      assert.ok(originalReference, `Invalid Gallery original path: ${image.src}`);
      assert.ok(thumbnailReference, `Invalid Gallery thumbnail path: ${image.thumbnail}`);
      assert.equal(originalReference[1], thumbnailReference[1], `Original/thumbnail numeric stem mismatch: ${image.src}`);
      assert.equal(eventStems.has(originalReference[1]), false, `Duplicate Gallery numeric stem: ${event.id}/${originalReference[1]}`);
      eventStems.add(originalReference[1]);
      assert.equal(path.extname(image.src), path.extname(image.thumbnail));
      assert.equal(originalReferences.has(image.src), false, `Duplicate original reference: ${image.src}`);
      assert.equal(thumbnailReferences.has(image.thumbnail), false, `Duplicate thumbnail reference: ${image.thumbnail}`);
      originalReferences.add(image.src);
      thumbnailReferences.add(image.thumbnail);

      const originalPath = path.join(siteDir, image.src);
      const thumbnailPath = path.join(siteDir, image.thumbnail);
      assert.equal(fs.existsSync(originalPath), true, `Missing Gallery original: ${image.src}`);
      assert.equal(fs.existsSync(thumbnailPath), true, `Missing Gallery thumbnail: ${image.thumbnail}`);
      const original = inspectImage(originalPath);
      const thumbnail = inspectImage(thumbnailPath);
      if (original.format === "PNG") {
        assert.equal(thumbnail.format, "PNG");
        assert.equal(thumbnail.hasAlpha, original.hasAlpha, `PNG alpha mismatch: ${image.src}`);
      }
    }
  }

  assert.equal(originalReferences.size, imageCount);
  assert.equal(thumbnailReferences.size, imageCount);
  const relativeAssetPath = (filePath) => path.relative(siteDir, filePath).replaceAll("\\", "/");
  const originalFiles = new Set(walkFiles(galleryRoots.original).map(relativeAssetPath));
  const thumbnailFiles = new Set(walkFiles(galleryRoots.thumbnail).map(relativeAssetPath));
  assert.deepEqual(originalFiles, originalReferences, "Gallery originals contain missing or unreferenced files");
  assert.deepEqual(thumbnailFiles, thumbnailReferences, "Gallery thumbnails contain missing or unreferenced files");
});
