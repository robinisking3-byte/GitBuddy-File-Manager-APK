import { uint8ArrayToBase64 } from '../services/githubApi';
import { isBinaryFilename } from './zipHandler';

export interface DroppedFileItem {
  name: string;
  relativePath: string;
  size: number;
  isBinary: boolean;
  base64Content: string;
  file: File;
}

// Recursively traverse FileSystemEntry objects from drag-and-drop
async function traverseFileTree(
  item: any,
  path: string = ''
): Promise<File[]> {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file: File) => {
        // Tag file with relative path property
        Object.defineProperty(file, 'customRelativePath', {
          value: path ? `${path}/${file.name}` : file.name,
          writable: true,
        });
        resolve([file]);
      }, () => resolve([]));
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      const entries: any[] = [];

      const readEntries = () => {
        dirReader.readEntries(async (result: any[]) => {
          if (result.length === 0) {
            const nestedFilesPromises = entries.map((entry) =>
              traverseFileTree(entry, path ? `${path}/${item.name}` : item.name)
            );
            const nestedFilesArrays = await Promise.all(nestedFilesPromises);
            resolve(nestedFilesArrays.flat());
          } else {
            entries.push(...result);
            readEntries();
          }
        }, () => resolve([]));
      };

      readEntries();
    } else {
      resolve([]);
    }
  });
}

export async function processDataTransferItems(
  items: DataTransferItemList | FileList
): Promise<DroppedFileItem[]> {
  const filePromises: Promise<File[]>[] = [];

  if ('length' in items && items.length > 0 && 'webkitGetAsEntry' in (items[0] as any)) {
    // DataTransferItemList with folder entry support
    const list = items as DataTransferItemList;
    for (let i = 0; i < list.length; i++) {
      const entry = list[i].webkitGetAsEntry?.();
      if (entry) {
        filePromises.push(traverseFileTree(entry));
      } else {
        const file = list[i].getAsFile();
        if (file) filePromises.push(Promise.resolve([file]));
      }
    }
  } else {
    // Standard FileList
    const fileList = items as FileList;
    const directFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const webkitPath = (file as any).webkitRelativePath;
      if (webkitPath) {
        Object.defineProperty(file, 'customRelativePath', {
          value: webkitPath,
          writable: true,
        });
      }
      directFiles.push(file);
    }
    filePromises.push(Promise.resolve(directFiles));
  }

  const nestedArrays = await Promise.all(filePromises);
  const flattenedFiles = nestedArrays.flat();

  // Convert files to base64
  const result: DroppedFileItem[] = [];

  for (const file of flattenedFiles) {
    if (file.name === '.DS_Store' || file.name.startsWith('._')) continue;

    const relPath = (file as any).customRelativePath || file.name;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64Content = uint8ArrayToBase64(bytes);
    const isBinary = isBinaryFilename(file.name);

    result.push({
      name: file.name,
      relativePath: relPath,
      size: file.size,
      isBinary,
      base64Content,
      file,
    });
  }

  return result;
}
