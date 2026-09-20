# Deploy

## Cloudflare Workers Builds

1. Cloudflare Dashboard → **Workers & Pages**
2. **Create application** → **Import a repository**
3. GitHubの `refrain62/baseball-pitch-counter` を選択
4. Production branch: `main`
5. Build command: 空欄
6. Deploy command: `npm run deploy`
7. Save and Deploy

`package.json` でWranglerを完全一致バージョンに固定している。`package-lock.json` を生成した場合はコミットして `npm ci` を使う。

## ローカル確認

```bash
npm install
npm run dev
```

## 更新

静的ファイルを編集して `main` にpushする。アプリ自体のビルド工程はない。
