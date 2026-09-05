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
      if (view.getUint16(0) !== 0xffd8) {
        return file; // Not a valid JPEG
      }

      let offset = 2;
      const segments: Uint8Array[] = [];
      const uint8Array = new Uint8Array(buffer);

      // Add SOI
      segments.push(uint8Array.slice(0, 2));

      while (offset < view.byteLength) {
        if (view.getUint8(offset) !== 0xff) {
          break; // Invalid marker
        }

        const marker = view.getUint8(offset + 1);
        if (marker === 0xd9) { // EOI
          segments.push(uint8Array.slice(offset, offset + 2));
          break;
        }

        const length = view.getUint16(offset + 2);
        
        // APP1 is FFE1 (EXIF)
        // We'll strip FFE1 to FFEF (APP1-APP15) which contain metadata, keeping APP0 (JFIF)
        if (marker < 0xe1 || marker > 0xef) {
          segments.push(uint8Array.slice(offset, offset + 2 + length));
        }

        offset += 2 + length;
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
      for (let i = 0; i < magic.length; i++) {
        if (view.getUint8(i) !== magic[i]) return file;
      }

      let offset = 8;
      const chunks: Uint8Array[] = [];
      const uint8Array = new Uint8Array(buffer);

      chunks.push(uint8Array.slice(0, 8)); // Signature

      while (offset < view.byteLength) {
        const length = view.getUint32(offset);
        const type = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );

        // Chunks to remove: tEXt, iTXt, zTXt, eXIf
        if (type !== 'tEXt' && type !== 'iTXt' && type !== 'zTXt' && type !== 'eXIf') {
          chunks.push(uint8Array.slice(offset, offset + 8 + length + 4)); // length + type + data + crc
        }

        offset += 8 + length + 4;
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
