# Security

## サプライチェーン対策

本番ブラウザで読み込む外部ライブラリ、CDN、外部フォント、分析SDK、外部QR APIは使用しない。
実行時リソースは同一オリジン内の静的ファイルだけに限定する。

デプロイツールのWranglerのみ `package.json` と `pnpm-lock.yaml` で完全一致バージョンに固定する。パッケージマネージャーは `pnpm@10.26.0` に統一し、Wranglerの推移依存 `undici` は修正版 `7.30.1` へ固定する。別形式のロックファイルは置かない。

## CSP

`public/_headers` で `default-src 'none'` を起点としたCSPを設定し、script/style/worker/manifest/imageを同一オリジンのみに制限する。inline script/styleは使用しない。

## Service Worker

- scopeは `/counter/` のみに限定
- 外部オリジンをキャッシュしない
- `APP_SHELL` に列挙した同一オリジンの静的GETだけを対象にする
- オンライン時はネットワークを優先してキャッシュを更新し、オフライン時だけキャッシュへフォールバック

## DOM

ユーザーが変更できる名称を `innerHTML` に挿入しない。表示には `textContent` を使う。

## QRコード

QRは静的SVGとしてリポジトリに保存する。ページ表示時に外部サービスへURLを送らない。
