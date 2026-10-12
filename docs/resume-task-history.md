# 作業履歴

## PC-001 投手ごとのイニング別球数と交代後の訂正

- 状態: 実装とローカル検証を完了。実装PR #2 と本記録PRのレビュー・CI・統合待ち。
- 仕様: [投手ごとのイニング別球数](./specs/pitch-count-innings.md)
- 実装範囲: 共通イニング切替、現在投手と交代済み投手の回別球数表示・訂正、累計との同期、Service Worker キャッシュ更新。
- 互換性: 変更前の保存データには回別情報がないため、旧累計は「イニング未設定」として保持し、利用者が必要に応じて訂正できる。
- 制約: 1〜99回、投手ごとに最大999球、片側につき投手記録は最大100人。
- 検証: `pnpm test`、`pnpm build`、旧形式・新形式・大きな破損値の保存データ移行確認、`git diff --check` が成功。
- 実装コミット: `c443930`（`feature/inning-pitch-count-edit`）
- 実装PR: [#2](https://github.com/refrain62/baseball-pitch-counter/pull/2)（`develop` 宛て Draft）
- 記録ブランチ: `docs/pc-001-pitch-count-records`
