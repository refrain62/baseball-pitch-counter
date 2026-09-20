# Baseball Pitch Counter

野球の投球数を2系統で数える、ビルド不要の静的PWAです。

- 本番: https://baseball-pitch-counter.refrain62.workers.dev/
- LP: `/`
- カウンター: `/counter/`
- 実行時の外部依存: なし
- 配信: Cloudflare Workers Static Assets

詳細は [`docs/`](./docs/) を参照してください。

- LP background: stadium artwork is limited to the first-view area; desktop/mobile assets are switched by CSS so the rest of the landing page stays readable.

- LP visual treatment: important action/instruction sections use near-black opaque panels; secondary sections use translucent glass panels so the stadium background remains visible.

- Counter utility tools: in-page knowledge dialog and share dialog with QR, clipboard copy, and Web Share API for LINE/other installed apps.
