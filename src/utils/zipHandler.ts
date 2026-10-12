import JSZip from 'jszip';
import { uint8ArrayToBase64 } from '../services/githubApi';

export interface ExtractedFile {
  originalPath: string;
  relativePath: string;
  size: number;
  isBinary: boolean;
  base64Content: string;
  textContent?: string;
  selected: boolean;
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'svg',
  'pdf', 'zip', 'tar', 'gz', '7z', 'rar',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'mp3', 'wav', 'mp4', 'mov', 'avi',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'apk', 'aab', 'ipa', 'jar', 'class',
  'pyc', 'wasm'
]);

export function isBinaryFilename(filename: string): boolean {
  const parts = filename.split('.');
  if (parts.length <= 1) return false;
  const ext = parts[parts.length - 1].toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export async function parseZipArchive(
  file: File | ArrayBuffer,
  options: {
    stripTopLevelFolder?: boolean;
    targetPrefix?: string;
  } = {}
): Promise<{
  files: ExtractedFile[];
  detectedTopLevelFolder: string | null;
  totalSize: number;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // Analyze all file paths to see if they share a common top-level directory
  const paths: string[] = [];
  loadedZip.forEach((relativePath, entry) => {
    if (!entry.dir) {
      paths.push(relativePath);
    }
  });

  let detectedTopLevelFolder: string | null = null;
  if (paths.length > 0) {
    const firstSegment = paths[0].split('/')[0];
    if (firstSegment && paths.every((p) => p.startsWith(`${firstSegment}/`))) {
      detectedTopLevelFolder = firstSegment;
    }
  }

  const strip = options.stripTopLevelFolder && Boolean(detectedTopLevelFolder);
  const targetPrefix = options.targetPrefix ? options.targetPrefix.replace(/^\/+|\/+$/g, '') : '';

  const extractedFiles: ExtractedFile[] = [];
  let totalSize = 0;

  for (const [relativePath, entry] of Object.entries(loadedZip.files)) {
    if (entry.dir) continue;

    // Filter out OS artifacts like __MACOSX and .DS_Store
    if (relativePath.includes('__MACOSX/') || relativePath.endsWith('.DS_Store')) {
      continue;
    }

    let normalizedPath = relativePath;
    if (strip && detectedTopLevelFolder) {
      normalizedPath = relativePath.slice(detectedTopLevelFolder.length + 1);
    }

    if (targetPrefix) {
      normalizedPath = `${targetPrefix}/${normalizedPath}`;
    }

    const binaryBytes = await entry.async('uint8array');
    const base64Content = uint8ArrayToBase64(binaryBytes);
    const isBinary = isBinaryFilename(normalizedPath);
    totalSize += binaryBytes.byteLength;

    let textContent: string | undefined = undefined;
    if (!isBinary && binaryBytes.byteLength < 500000) {
      try {
        textContent = new TextDecoder().decode(binaryBytes);
      } catch {
        // Fallback to undefined text
      }
    }

    extractedFiles.push({
      originalPath: relativePath,
      relativePath: normalizedPath,
      size: binaryBytes.byteLength,
      isBinary,
      base64Content,
      textContent,
      selected: true,
    });
  }

  return {
    files: extractedFiles,
    detectedTopLevelFolder,
    totalSize,
  };
}

export async function createZipFromFiles(
  files: { path: string; content: string | Uint8Array; isBinary?: boolean }[]
): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) {
    const cleanPath = file.path.replace(/^\/+/, '');
    if (typeof file.content === 'string') {
      zip.file(cleanPath, file.content);
    } else {
      zip.file(cleanPath, file.content);
    }
  }
  return zip.generateAsync({ type: 'blob' });
}
