import { trpcReact } from '@/trpc';
import { memo, useCallback, useState } from 'react';
import { useToast } from '../hooks/use-toast';

const PhotoGallery = memo(() => {
  const { toast } = useToast();

  // ディレクトリパス
  const [directory, setDirectory] = useState<string | null>(null);
  // ファイル一覧
  const [files, setFiles] = useState<string[]>([]);
  // 選択されたファイル
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // ディレクトリ選択API
  const showOpenDialogMutation = trpcReact.showOpenDialog.useMutation();
  // ディレクトリ内ファイル一覧取得API（仮: electronUtil.listFilesInDirectory）
  const listFilesInDirectoryMutation =
    trpcReact.electronUtil.listFilesInDirectory.useMutation();
  // ファイルパスコピーAPI
  const copyMultipleMutation =
    trpcReact.electronUtil.copyMultipleImageDataByPath.useMutation();

  // クリップボードのテキスト取得API
  const getClipboardFilePathsQuery =
    trpcReact.electronUtil.getClipboardFilePaths.useQuery(undefined, {
      enabled: false,
    });
  const [clipboardFilePaths, setClipboardFilePaths] = useState<{
    filePaths: Array<string>;
    text?: string | null;
  } | null>(null);

  // ディレクトリ選択ハンドラ
  const handleSelectDirectory = useCallback(async () => {
    const result = await showOpenDialogMutation.mutateAsync({
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      setDirectory(dir);
      // ディレクトリ内ファイル一覧を取得
      const filesResult = await listFilesInDirectoryMutation.mutateAsync({
        directory: dir,
      });
      setFiles(filesResult.files || []);
      setSelectedFiles(new Set());
    }
  }, [showOpenDialogMutation, listFilesInDirectoryMutation]);

  // ファイル選択ハンドラ
  const handleSelectFile = useCallback((file: string, checked: boolean) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(file);
      } else {
        next.delete(file);
      }
      return next;
    });
  }, []);

  // パスコピー
  const handleCopyPaths = useCallback(() => {
    if (selectedFiles.size > 0 && directory) {
      const absPaths = Array.from(selectedFiles).map(
        (file) => `${directory}/${file}`,
      );
      copyMultipleMutation.mutate(absPaths);
    }
    toast({
      title: `${selectedFiles.size}件のパスをコピーしました`,
    });
  }, [selectedFiles, copyMultipleMutation, directory]);

  // ペーストボタンハンドラ
  const handlePasteClipboard = useCallback(async () => {
    const result = await getClipboardFilePathsQuery.refetch();
    setClipboardFilePaths(result.data ?? null);
    toast({
      title: 'クリップボードの内容を取得しました',
    });
  }, [getClipboardFilePathsQuery, toast]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-gradient-to-br from-gray-50 via-white to-gray-200 rounded-xl shadow-lg">
      {/* ローカルからディレクトリを選択する(永続化しなくて良い) */}
      <button
        type="button"
        className="px-5 py-2 bg-gradient-to-r from-blue-500 via-blue-400 to-blue-600 text-white rounded-lg shadow-md hover:from-blue-600 hover:to-blue-700 hover:shadow-lg transition-all duration-200 w-fit font-semibold"
        onClick={handleSelectDirectory}
      >
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <title>ディレクトリ選択アイコン</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75V6.75A2.25 2.25 0 014.5 4.5h3.379c.414 0 .81.162 1.104.454l1.263 1.263c.293.293.69.454 1.104.454h6.15a2.25 2.25 0 012.25 2.25v3.75"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.75v4.5A2.25 2.25 0 004.5 19.5h15a2.25 2.25 0 002.25-2.25v-4.5m-19.5 0h19.5"
            />
          </svg>
          ディレクトリを選択
        </span>
      </button>
      {/* 選択されたディレクトリ以下1階層のファイルを表示。ファイルごとにselectboxを出してファイルの選択を可能にする */}
      {directory && (
        <div className="flex flex-col gap-2">
          <div className="font-bold text-gray-700">
            選択中ディレクトリ:{' '}
            <span className="text-blue-600">{directory}</span>
          </div>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white/80 shadow-inner backdrop-blur-sm">
            {files.length === 0 && (
              <div className="text-gray-400">ファイルがありません</div>
            )}
            {files.map((file) => (
              <label
                key={file}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-blue-500 w-4 h-4"
                  checked={selectedFiles.has(file)}
                  onChange={(e) => handleSelectFile(file, e.target.checked)}
                />
                <span className="truncate text-gray-700">{file}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {/* 選択されたファイルのパスをコピーするボタン */}
      <button
        type="button"
        className="px-5 py-2 bg-gradient-to-r from-green-500 via-green-400 to-green-600 text-white rounded-lg shadow-md hover:from-green-600 hover:to-green-700 hover:shadow-lg transition-all duration-200 w-fit font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={handleCopyPaths}
        disabled={selectedFiles.size === 0}
      >
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <title>パスコピーアイコン</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 15.75h-2.25A2.25 2.25 0 014 13.5v-7.5A2.25 2.25 0 016.25 4.5h7.5A2.25 2.25 0 0116 6.75v2.25m-7.75 6.75v2.25A2.25 2.25 0 0010.5 19.5h7.5A2.25 2.25 0 0020.25 17.25v-7.5A2.25 2.25 0 0018 7.5h-2.25"
            />
          </svg>
          選択したファイルのパスをコピー
        </span>
      </button>
      {/* ペーストボタンとクリップボード内容表示 */}
      <button
        type="button"
        className="px-5 py-2 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-600 text-white rounded-lg shadow-md hover:from-purple-600 hover:to-purple-700 hover:shadow-lg transition-all duration-200 w-fit font-semibold"
        onClick={handlePasteClipboard}
      >
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <title>ペーストアイコン</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75A2.25 2.25 0 0014.25 4.5h-7.5A2.25 2.25 0 004.5 6.75v10.5A2.25 2.25 0 006.75 19.5h6.75"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.75 15.75v-3a.75.75 0 00-.75-.75h-6a.75.75 0 00-.75.75v3m7.5 0a2.25 2.25 0 01-2.25 2.25h-3a2.25 2.25 0 01-2.25-2.25m7.5 0v0a2.25 2.25 0 01-2.25 2.25h-3a2.25 2.25 0 01-2.25-2.25"
            />
          </svg>
          クリップボードをペースト
        </span>
      </button>
      {clipboardFilePaths !== null && (
        <div className="mt-2 p-2 bg-white/80 rounded shadow-inner border border-gray-200 text-gray-800 max-w-full break-all">
          <div className="font-bold text-sm text-purple-700 mb-1">
            クリップボードの内容:
          </div>
          {/* ファイルパス */}
          <div className="text-xs whitespace-pre-wrap">
            {clipboardFilePaths.filePaths.length > 0 ? (
              clipboardFilePaths.filePaths.map((filePath) => (
                <div key={filePath}>{filePath}</div>
              ))
            ) : (
              <span className="text-gray-400">(空です)</span>
            )}
          </div>
          {/* テキスト */}
          <div className="text-xs whitespace-pre-wrap">
            {clipboardFilePaths.text || (
              <span className="text-gray-400">(空です)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

PhotoGallery.displayName = 'PhotoGallery';

export default PhotoGallery;
