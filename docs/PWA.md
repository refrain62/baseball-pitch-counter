# PWA / Distribution

本番URL:

```text
https://baseball-pitch-counter.refrain62.workers.dev/
```

カウンター:

```text
https://baseball-pitch-counter.refrain62.workers.dev/counter/
```

## iPhone / iPad

1. LPの「ホーム画面への追加を始める」を押して `/counter/?install=1` を開く
2. カウンター画面上部の「このカウンターをホーム画面に追加」を押す
3. Safariの共有ボタンを押す
4. 「ホーム画面に追加」を選ぶ
5. 右上の「追加」（iPhone標準ボタン）を押す

## Android

1. LPの「アプリのインストールを始める」を押して `/counter/?install=1` を開く
2. カウンター画面上部の「このカウンターをインストール」を押す
3. ブラウザの確認画面で「インストール」を押す

## QRコード

LPの `public/assets/install-qr.svg` は静的ファイルで、次の本番LPを指す。

```text
https://baseball-pitch-counter.refrain62.workers.dev/
```

QRコードは実行時に生成しない。外部QR APIやQR生成ライブラリをブラウザから読み込まず、依存と情報送信を減らす。

## アプリアイコン

黒いアナログ回転式カウンターで `001` を表示したデザインを使用する。

配布用サイズ:

- `public/assets/app-icon-1024.png`
- `public/assets/app-icon-512.png`
- `public/assets/app-icon-192.png`
- `public/counter/icons/icon-512.png`
- `public/counter/icons/icon-192.png`
- `public/counter/icons/apple-touch-icon.png` (180×180)
- `public/counter/icons/icon-maskable-512.png` (Androidのマスク領域対策として余白付き)

通常アイコンは元画像のデザインをそのまま縮小する。`maskable` 版だけは端末側の丸形・角丸などのマスクでカウンター本体が切れないよう、安全領域に収める。
