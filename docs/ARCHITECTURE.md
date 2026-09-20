# Architecture

## 方針

SPAやフレームワークを使わず、HTML/CSS/JavaScriptの静的MPAとして構成する。
変更は対象ファイルを直接編集してpushするだけで、アプリのビルド工程はない。

## URL

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
