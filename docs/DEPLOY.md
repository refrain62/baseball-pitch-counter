# Deploy

本番: https://baseball-pitch-counter.refrain62.workers.dev/

## Cloudflare Workers Builds

1. Cloudflare Dashboard → **Workers & Pages**
2. **Create application** → **Import a repository**
3. GitHubの `refrain62/baseball-pitch-counter` を選択
4. Production branch: `main`
5. Build command: 空欄
6. Deploy command: `pnpm run deploy`
7. Save and Deploy

`package.json` でWranglerを完全一致バージョンに固定し、`pnpm-lock.yaml` をコミットする。依存関係は `pnpm install --frozen-lockfile` で再現する。

## ローカル確認

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

## 更新

静的ファイルを編集して `main` にpushする。アプリ自体のビルド工程はない。
