import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  readClipboardFilePaths,
  writeClipboardFilePaths,
} from 'clip-filepaths';
import { app, clipboard, dialog, nativeImage, shell } from 'electron';
import * as neverthrow from 'neverthrow';
import sharp from 'sharp';
import { log } from '../../lib/logger';

const openPathInExplorer = async (
  path: string,
): Promise<neverthrow.Result<string, Error>> => {
  // ネイティブの機能を使う
  try {
    const result = await shell.openPath(path);
    return neverthrow.ok(result);
  } catch (error) {
    if (error instanceof Error) {
      return neverthrow.err(error);
    }
    throw error;
  }
};

export const getApplicationLogPath = (): string => {
  return app.getPath('logs');
};

const openGetDirDialog = async (): Promise<
  neverthrow.Result<string, 'canceled'>
> => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled) {
    return neverthrow.err('canceled');
  }
  return neverthrow.ok(result.filePaths[0]);
};

const openGetFileDialog = async (
  properties: Array<'openDirectory' | 'openFile' | 'multiSelections'>,
): Promise<neverthrow.Result<string[], 'canceled'>> => {
  const result = await dialog.showOpenDialog({
    properties,
  });
  if (result.canceled) {
    return neverthrow.err('canceled');
  }
  return neverthrow.ok(result.filePaths);
};

const openUrlInDefaultBrowser = (url: string) => {
  return shell.openExternal(url);
};

const openPathWithAssociatedApp = async (
  filePath: string,
): Promise<neverthrow.Result<string, Error>> => {
  try {
    // openPath はデフォルトアプリで開くので、これで代用可能
    const errorMsg = await shell.openPath(filePath);
    if (errorMsg) {
      return neverthrow.err(new Error(`Failed to open path: ${errorMsg}`));
    }
    return neverthrow.ok('');
  } catch (error) {
    return neverthrow.err(
      error instanceof Error ? error : new Error('Unknown error opening path'),
    );
  }
};

const copyImageDataByPath = async (
  filePath: string,
): Promise<neverthrow.Result<void, Error>> => {
  try {
    const photoBuf = await sharp(filePath).toBuffer();
    const image = nativeImage.createFromBuffer(photoBuf);
    clipboard.writeImage(image);
    // eventEmitter.emit('toast', 'copied'); // service 層からは直接 emit しない
    return neverthrow.ok(undefined);
  } catch (error) {
    return neverthrow.err(
      error instanceof Error ? error : new Error('Failed to copy image data'),
    );
  }
};

const copyImageByBase64 = async (options: {
  pngBase64: string;
}): Promise<neverthrow.Result<void, Error>> => {
  try {
    await handlePngBase64WithCallback(
      {
        filenameWithoutExt: 'clipboard_image', // 一時ファイル名
        pngBase64: options.pngBase64,
      },
      async (tempPngPath) => {
        const image = nativeImage.createFromPath(tempPngPath);
        clipboard.writeImage(image);
        // eventEmitter.emit('toast', 'copied'); // service 層からは直接 emit しない
      },
    );
    return neverthrow.ok(undefined);
  } catch (error) {
    return neverthrow.err(
      error instanceof Error ? error : new Error('Failed to copy base64 image'),
    );
  }
};

const downloadImageAsPng = async (options: {
  pngBase64: string;
  filenameWithoutExt: string;
}): Promise<neverthrow.Result<void, Error | 'canceled'>> => {
  let tempDir = '';
  try {
    const base64Data = options.pngBase64.replace(
      /^data:image\/[^;]+;base64,/,
      '',
    );
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vrchat-photo-'));
    const tempFilePath = path.join(
      tempDir,
      `${options.filenameWithoutExt}.png`,
    );
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tempFilePath, new Uint8Array(imageBuffer));

    const dialogResult = await showSavePngDialog(options.filenameWithoutExt);

    if (dialogResult.canceled || !dialogResult.filePath) {
      await fs
        .rm(tempDir, { recursive: true, force: true })
        .catch(console.error);
      return neverthrow.err('canceled');
    }

    await saveFileToPath(tempFilePath, dialogResult.filePath);

    return neverthrow.ok(undefined);
  } catch (error) {
    console.error('Error in downloadImageAsPng:', error);
    if (error instanceof Error && error.message === 'canceled') {
      return neverthrow.err('canceled');
    }
    return neverthrow.err(
      error instanceof Error
        ? new Error('Failed to handle png file', { cause: error })
        : new Error('Failed to handle png file'),
    );
  } finally {
    if (tempDir) {
      await fs
        .rm(tempDir, { recursive: true, force: true })
        .catch(console.error);
    }
  }
};

interface SavePngFileOptions {
  pngBase64: string;
  filenameWithoutExt: string;
}

export const handlePngBase64WithCallback = async (
  options: SavePngFileOptions,
  callback: (tempPngPath: string) => Promise<void>,
): Promise<void> => {
  let tempDir = '';
  try {
    const base64Data = options.pngBase64.replace(
      /^data:image\/[^;]+;base64,/,
      '',
    );
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vrchat-photo-'));
    const tempFilePath = path.join(
      tempDir,
      `${options.filenameWithoutExt}.png`,
    );
    const imageBuffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(tempFilePath, new Uint8Array(imageBuffer));
    await callback(tempFilePath);
  } catch (error) {
    console.error('Failed to handle png file:', error);
    throw new Error('Failed to handle png file', { cause: error });
  } finally {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup temporary directory:', cleanupError);
      }
    }
  }
};

export const showSavePngDialog = async (filenameWithoutExt: string) => {
  return dialog.showSaveDialog({
    defaultPath: path.join(
      os.homedir(),
      'Downloads',
      `${filenameWithoutExt}.png`,
    ),
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
};

export const saveFileToPath = async (
  sourcePath: string,
  destinationPath: string,
): Promise<void> => {
  await fs.copyFile(sourcePath, destinationPath);
};

// 複数ファイルをクリップボードにコピーする (クロスプラットフォーム対応)
const copyMultipleFilesToClipboard = async (
  filePaths: string[],
): Promise<neverthrow.Result<void, Error>> => {
  try {
    if (filePaths.length === 0) {
      return neverthrow.ok(undefined);
    }
    writeClipboardFilePaths(filePaths);

    return neverthrow.ok(undefined);
  } catch (error) {
    return neverthrow.err(
      error instanceof Error
        ? error
        : new Error('Failed to copy multiple files'),
    );
  }
};

const readFilePathsFromClipboard = async () => {
  const filePaths = await readClipboardFilePaths();
  log.info('readFilePathsFromClipboard', filePaths);
  return filePaths;
};
// ディレクトリ内のファイル一覧取得用エラー型
export type ListFilesInDirectoryError =
  | { code: 'DIRECTORY_NOT_FOUND'; message: string }
  | { code: 'NOT_A_DIRECTORY'; message: string }
  | { code: 'UNKNOWN_ERROR'; message: string };

/**
 * ディレクトリ内のファイル一覧を取得する
 * @param directory ディレクトリパス
 * @returns ファイル名配列 or エラー
 */
export const listFilesInDirectory = async (
  directory: string,
): Promise<neverthrow.Result<string[], ListFilesInDirectoryError>> => {
  try {
    const stat = await fs.stat(directory);
    if (!stat.isDirectory()) {
      return neverthrow.err({
        code: 'NOT_A_DIRECTORY',
        message: '指定されたパスはディレクトリではありません',
      });
    }
    const files = await fs.readdir(directory);
    return neverthrow.ok(files);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return neverthrow.err({
        code: 'DIRECTORY_NOT_FOUND',
        message: 'ディレクトリが見つかりません',
      });
    }
    return neverthrow.err({
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : '不明なエラー',
    });
  }
};

// NodeJS.ErrnoException型ガード
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

export {
  openPathInExplorer,
  openGetDirDialog,
  openGetFileDialog,
  openUrlInDefaultBrowser,
  openPathWithAssociatedApp,
  copyImageDataByPath,
  copyImageByBase64,
  downloadImageAsPng,
  copyMultipleFilesToClipboard,
  readFilePathsFromClipboard,
};
