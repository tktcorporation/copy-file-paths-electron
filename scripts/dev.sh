#!/bin/bash
# DBus設定
eval `dbus-launch --sh-syntax`

# Viteの開発サーバーをバックグラウンドで起動
yarn dev:vite &
VITE_PID=$!

# Electronビルドを実行し、完了を待つ
echo "Building Electron..."
yarn build:electron

# ビルドが成功したら、Electronを起動
if [ $? -eq 0 ]; then
  echo "Starting Electron..."
  electron /workspaces/copy-file-paths-electron --disable-gpu
else
  echo "Electron build failed"
fi

# 終了時にViteサーバーを停止
kill $VITE_PID