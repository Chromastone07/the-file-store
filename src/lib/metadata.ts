import { sanitizeFilename } from '@/lib/utils';

export { sanitizeFilename };

export async function stripImageExif(file: File): Promise<File> {
  if (!file.type.startsWith('image/jpeg') && !file.type.startsWith('image/png')) {
    return file;
  }

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  try {
    if (file.type.startsWith('image/jpeg')) {
      // JPEG magic numbers: FF D8
      if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
        return file; // Not a valid JPEG
      }

      let offset = 2;
      const segments: Uint8Array[] = [];
      const uint8Array = new Uint8Array(buffer);

      // Add SOI (0xFF, 0xD8)
      segments.push(uint8Array.slice(0, 2));

      while (offset < view.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
          break; // Invalid marker
        }

        // Skip any padding 0xFF bytes
        while (offset < view.byteLength && view.getUint8(offset) === 0xff) {
          offset++;
        }

        if (offset >= view.byteLength) break;
        const marker = view.getUint8(offset);
        offset++;

        // EOI (End of Image)
        if (marker === 0xd9) {
          segments.push(new Uint8Array([0xff, 0xd9]));
          break;
        }

        // SOS (Start of Scan) - Entropy-coded scan data begins immediately after SOS header
        // All APP markers and EXIF metadata precede SOS. Preserve SOS header and all remaining image data intact.
        if (marker === 0xda) {
          // Slice from the 0xFF byte before the marker to the end of the file
          segments.push(uint8Array.slice(offset - 2));
          break;
        }

        // Standalone markers with no length field
        if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          segments.push(new Uint8Array([0xff, marker]));
          continue;
        }

        if (offset + 2 > view.byteLength) break;
        const length = view.getUint16(offset);
        if (offset + length > view.byteLength) break;

        // APP1 is FFE1 (EXIF). We strip FFE1 to FFEF (APP1-APP15) which contain metadata, keeping APP0 (JFIF)
        if (marker < 0xe1 || marker > 0xef) {
          // Include marker prefix (0xFF, marker) + length + payload
          segments.push(uint8Array.slice(offset - 2, offset + length));
        }

        offset += length;
      }

      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
      const newBuffer = new Uint8Array(totalLength);
      let currentOffset = 0;
      for (const seg of segments) {
        newBuffer.set(seg, currentOffset);
        currentOffset += seg.length;
      }

      return new File([newBuffer], file.name, { type: file.type });
    }

    if (file.type.startsWith('image/png')) {
      // PNG magic numbers: 89 50 4E 47 0D 0A 1A 0A
      const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (view.byteLength < 8) return file;
      for (let i = 0; i < magic.length; i++) {
        if (view.getUint8(i) !== magic[i]) return file;
      }

      let offset = 8;
      const chunks: Uint8Array[] = [];
      const uint8Array = new Uint8Array(buffer);

      chunks.push(uint8Array.slice(0, 8)); // Signature

      while (offset + 8 <= view.byteLength) {
        const length = view.getUint32(offset);
        const chunkTotal = 8 + length + 4; // length (4) + type (4) + data (length) + crc (4)
        if (offset + chunkTotal > view.byteLength) break;

        const type = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );

        // Chunks to remove: tEXt, iTXt, zTXt, eXIf, tIME
        if (type !== 'tEXt' && type !== 'iTXt' && type !== 'zTXt' && type !== 'eXIf' && type !== 'tIME') {
          chunks.push(uint8Array.slice(offset, offset + chunkTotal));
        }

        offset += chunkTotal;
      }

      const totalLength = chunks.reduce((sum, seg) => sum + seg.length, 0);
      const newBuffer = new Uint8Array(totalLength);
      let currentOffset = 0;
      for (const seg of chunks) {
        newBuffer.set(seg, currentOffset);
        currentOffset += seg.length;
      }

      return new File([newBuffer], file.name, { type: file.type });
    }
  } catch (err) {
    console.error('Error stripping EXIF', err);
    return file;
  }

  return file;
}

export async function stripFileMetadata(file: File): Promise<File> {
  const safeName = sanitizeFilename(file.name);
  let cleanedFile = file;

  if (file.type.startsWith('image/jpeg') || file.type.startsWith('image/png') || file.name.match(/\.(jpg|jpeg|png)$/i)) {
    cleanedFile = await stripImageExif(file);
  }

  return new File([cleanedFile], safeName, { type: cleanedFile.type });
}
