# Architecture

## 方針

SPAやフレームワークを使わず、HTML/CSS/JavaScriptの静的MPAとして構成する。
変更は対象ファイルを直接編集してpushするだけで、アプリのビルド工程はない。

## URL

本番オリジン: `https://baseball-pitch-counter.refrain62.workers.dev`

- `/` — 初めて使う人向けLP
- `/counter/` — 実際のピッチカウンター/PWA

## 主なファイル

```text
public/
├─ index.html
├─ _headers
├─ assets/
│  ├─ site.css
│  ├─ site.js
│  ├─ app-icon-512.png
│  └─ install-qr.svg
└─ counter/
   ├─ index.html
   ├─ counter.css
   ├─ counter.js
   ├─ manifest.webmanifest
   ├─ sw.js
   └─ icons/
```

## データ

投球数・名称はブラウザの `localStorage` のみに保存する。サーバー、DB、Cookie、ユーザー登録は使用しない。

## Service Worker

`/counter/sw.js` を `/counter/` scopeで登録する。LPにはService Workerを適用しない。

## Counter UI v12

`/counter/` は実機カウンターをモチーフにした2カラムUI。1塁側は青、3塁側は赤で識別し、各ヘッダーのダイヤモンドでも1塁・3塁を明示する。表示は3桁の機械式カウンター風で、投球数は0〜999。背景・ベース表示・PWAアイコンを含め、外部CDNや外部JSは使用しない。


### Counter image assets

`public/counter/images/` では、カウンター画面に使う実画像を同梱する。

- `bg-stadium-mobile.png`: スマホ向け縦背景
- `bg-stadium-desktop.png`: タブレット/PC向け横背景
- `baseball-count-button.png`: 1球カウントボタン上部の共通ボール画像
- `base-first.svg`: 1塁側表示
- `base-third.svg`: 3塁側表示

## LP background assets

The landing page uses local self-hosted background assets only:

- `public/assets/lp-bg-mobile.png`
- `public/assets/lp-bg-desktop.png`

The mobile and desktop backgrounds are selected with CSS media queries. A dark overlay is always applied to preserve text contrast.
