# 作業履歴

## PC-001 投手ごとのイニング別球数と交代後の訂正

- 状態: 完了。実装PR #2 と本記録PR #3 は `develop` へ統合済み。
- 仕様: [投手ごとのイニング別球数](./specs/pitch-count-innings.md)
- 実装範囲: 各側で独立したイニング選択モーダル（1〜9回、延長10〜99回）、現在回チップの強調、現在投手と交代済み投手の回別球数表示・訂正、±ダイアログ、累計との同期、Service Worker キャッシュ更新。仕様確定に合わせ、イニング変更は−／＋操作ではなく選択モーダルとし、確定後の投球から記録する。添付画面案の濃紺・青赤2カラムを保ち、PCのダイアログ横はみ出しを防止し、320〜360pxでも訂正行を横並びにする。280px以下は縦積みとし、回の選択肢と訂正操作は44×44px以上。
- 互換性: 変更前の保存データには回別情報がないため、旧累計は「イニング未設定」として保持し、利用者が必要に応じて訂正できる。
- 制約: 1〜99回、投手ごとに最大999球、各側で表示・編集できる投手は直近100人。過去履歴を最大900人分保存し、異常データは1,000人分を読込上限とする。
- 検証: `pnpm test`、`pnpm build`、旧形式・新形式・大きな破損値の保存データ移行確認、`git diff --check` が成功。最終コミット後にも `pnpm test` と `pnpm build` を再実行済み。
- 実装コミット: `c443930`（`feature/inning-pitch-count-edit`）
- UIコミット: `7eeff92`（`feature/inning-pitch-count-edit`）
- 操作サイズ・ダイアログ調整: `7ed4441`、狭幅での横並び維持: `79fcb42`（`feature/inning-pitch-count-edit`）
- デザインレビュー: 320px・360pxでの横並び、±の44pxタップ領域、対象箇所の横はみ出しを静的確認。重大な残課題なし。
- 実装PR: [#2](https://github.com/refrain62/baseball-pitch-counter/pull/2)（`develop` へ統合、マージコミット `b845dc45d9b4`）
- 記録PR: [#3](https://github.com/refrain62/baseball-pitch-counter/pull/3)（本記録を含めて `develop` へ統合）
- 実装ブランチ: `feature/inning-pitch-count-edit`（統合後に削除）
- 記録ブランチ: `docs/pc-001-pitch-count-records`（本記録PRの統合後に削除）
