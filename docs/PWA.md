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

## Counter design assets

カウンター画面で使う実アセット:

- `/counter/images/bg-stadium-mobile.png` スマホ向け縦背景
- `/counter/images/bg-stadium-desktop.png` タブレット / PC向け横背景
- `/counter/images/baseball-count-button.png` 「1球カウント」ボタン上部の共通ボール画像
- `/counter/images/base-first.svg` 1塁側インジケーター
- `/counter/images/base-third.svg` 3塁側インジケーター
- `/assets/app-icon-1024.png`, `/assets/app-icon-512.png`, `/assets/app-icon-192.png`
- `/counter/icons/` 以下のPWA用アイコン
- `/og-image.png` SNS / OGP 用画像

アプリ用アイコンは、承認済みの機械式カウンター `001` の画像を元に統一している。

## カウンター音

`+1` は実機の機械式クリック音を使用する。

- `public/counter/audio/counter-click.ogg`
- `public/counter/audio/counter-click.wav`

OGGを優先し、デコードできない場合のみWAVへフォールバックする。
音源は初回に一度だけ `AudioBuffer` へ読み込み、その後の連打ではネットワークアクセスを行わない。

`1球戻す` は外部音源を使わず、Web Audio APIで生成する元の低い電子音を維持する。

## インストール導線の分岐

LPの「今すぐ使う」は `/counter/` へ遷移し、カウンター画面にインストールUIを表示しない。
LPのインストール導線は `/counter/?install=1` へ遷移し、この場合だけインストールボタンを表示する。
PWAの `beforeinstallprompt`、iOSのホーム画面追加案内、Service Worker登録はどちらの経路でも維持する。
