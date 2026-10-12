# 作業履歴

## PC-001 投手ごとのイニング別球数と交代後の訂正

- 状態: 実装とローカル検証を完了。実装PR #2 と本記録PRのレビュー・CI・統合待ち。
- 仕様: [投手ごとのイニング別球数](./specs/pitch-count-innings.md)
- 実装範囲: 各側で独立したイニング切替、現在回チップの強調、現在投手と交代済み投手の回別球数表示・訂正、±ダイアログ、累計との同期、Service Worker キャッシュ更新。
- 互換性: 変更前の保存データには回別情報がないため、旧累計は「イニング未設定」として保持し、利用者が必要に応じて訂正できる。
- 制約: 1〜99回、投手ごとに最大999球、各側で表示・編集できる投手は直近100人。過去履歴を最大900人分保存し、異常データは1,000人分を読込上限とする。
- 検証: `pnpm test`、`pnpm build`、旧形式・新形式・大きな破損値の保存データ移行確認、`git diff --check` が成功。最終コミット後にも `pnpm test` と `pnpm build` を再実行済み。
- 実装コミット: `c443930`（`feature/inning-pitch-count-edit`）
- UIコミット: `7eeff92`（`feature/inning-pitch-count-edit`）
- 実装PR: [#2](https://github.com/refrain62/baseball-pitch-counter/pull/2)（`develop` 宛て Draft）
- 記録ブランチ: `docs/pc-001-pitch-count-records`
