# Security

## サプライチェーン対策

本番ブラウザで読み込む外部ライブラリ、CDN、外部フォント、分析SDK、外部QR APIは使用しない。
実行時リソースは同一オリジン内の静的ファイルだけに限定する。

デプロイツールのWranglerのみ `package.json` で完全一致バージョンに固定する。将来 `package-lock.json` を生成した場合は、それもGit管理する。

## CSP

`public/_headers` で `default-src 'none'` を起点としたCSPを設定し、script/style/worker/manifest/imageを同一オリジンのみに制限する。inline script/styleは使用しない。

## Service Worker

- scopeは `/counter/` のみに限定
- 外部オリジンをキャッシュしない
- 同一オリジンかつ `/counter/` のGETだけを対象にする
- オンライン時はネットワークを優先してキャッシュを更新し、オフライン時だけキャッシュへフォールバック

## DOM

ユーザーが変更できる名称を `innerHTML` に挿入しない。表示には `textContent` を使う。

## QRコード

QRは静的SVGとしてリポジトリに保存する。ページ表示時に外部サービスへURLを送らない。
