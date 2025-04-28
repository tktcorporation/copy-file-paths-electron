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

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* ローカルからディレクトリを選択する(永続化しなくて良い) */}
      <button
        type="button"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-fit"
        onClick={handleSelectDirectory}
      >
        ディレクトリを選択
      </button>
      {/* 選択されたディレクトリ以下1階層のファイルを表示。ファイルごとにselectboxを出してファイルの選択を可能にする */}
      {directory && (
        <div className="flex flex-col gap-2">
          <div className="font-bold">選択中ディレクトリ: {directory}</div>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border rounded p-2 bg-gray-50">
            {files.length === 0 && (
              <div className="text-gray-400">ファイルがありません</div>
            )}
            {files.map((file) => (
              <label key={file} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file)}
                  onChange={(e) => handleSelectFile(file, e.target.checked)}
                />
                <span className="truncate">{file}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {/* 選択されたファイルのパスをコピーするボタン */}
      <button
        type="button"
        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 w-fit disabled:opacity-50"
        onClick={handleCopyPaths}
        disabled={selectedFiles.size === 0}
      >
        選択したファイルのパスをコピー
      </button>
    </div>
  );
});

PhotoGallery.displayName = 'PhotoGallery';

export default PhotoGallery;
