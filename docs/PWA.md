# PWA / Distribution

## iPhone

1. `/counter/` をSafariで開く
2. 共有ボタンを押す
3. 「ホーム画面に追加」を選ぶ
4. カウンター名とアイコンを確認
5. 右上の「追加」（iPhone標準ボタン）を押す

## Android

`/counter/` をChromeで開き、「アプリをインストール」またはページ内の「このカウンターをインストール」ボタンを使用する。

## QRコード

LPの `public/assets/install-qr.svg` は静的ファイル。
初期版は次のURLを指す。

```text
https://refrain62.github.io/baseball-pitch-counter/counter/
```

Cloudflareの本番URLや独自ドメインが確定したら、そのURLでQRを再生成して同名ファイルを差し替える。
ランタイムでQR生成ライブラリや外部QR APIを使用しないのは、依存と情報送信を減らすため。

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
