# 作業履歴

## PC-001 投手ごとのイニング別球数と交代後の訂正

- 状態: 完了。実装PR #2 と本記録PR #3 は `develop` へ統合済み。
- 仕様: [投手ごとのイニング別球数](./specs/pitch-count-innings.md)
- 実装範囲: 各側で独立したイニング選択モーダル（1〜9回、延長10〜99回）、現在回チップの強調、現在投手と交代済み投手の回別球数表示・訂正、±ダイアログ、累計との同期、Service Worker キャッシュ更新。仕様確定に合わせ、イニング変更は−／＋操作ではなく選択モーダルとし、確定後の投球から記録する。添付画面案の濃紺・青赤2カラムを保ち、PCのダイアログ横はみ出しを防止し、320〜360pxでも訂正行を横並びにする。320px未満は縦積みとし、回の選択肢は44×44px以上、投球数訂正の「＋／−」ボタンは56×56px以上。
- 互換性: 変更前の保存データには回別情報がないため、旧累計は「イニング未設定」として保持し、利用者が必要に応じて訂正できる。
- 制約: 1〜99回、投手ごとに最大999球、各側で表示・編集できる投手は直近100人。過去履歴を最大900人分保存し、異常データは1,000人分を読込上限とする。
- 検証: `pnpm test`、`pnpm build`、旧形式・新形式・大きな破損値の保存データ移行確認、`git diff --check` が成功。最終コミット後にも `pnpm test` と `pnpm build` を再実行済み。
- 実装コミット: `c443930`（`feature/inning-pitch-count-edit`）
- UIコミット: `7eeff92`（`feature/inning-pitch-count-edit`）
- 操作サイズ・ダイアログ調整: `7ed4441`、狭幅での横並び維持: `79fcb42`（`feature/inning-pitch-count-edit`）
- デザインレビュー: 320px・360pxでの横並び、±56pxボタン、320px未満での縦積み、対象箇所の横はみ出しなしを実画面で確認。重大な残課題なし。
- 実装PR: [#2](https://github.com/refrain62/baseball-pitch-counter/pull/2)（`develop` へ統合、マージコミット `b845dc45d9b4`）
- 記録PR: [#3](https://github.com/refrain62/baseball-pitch-counter/pull/3)（本記録を含めて `develop` へ統合）
- 実装ブランチ: `feature/inning-pitch-count-edit`（統合後に削除）
- 記録ブランチ: `docs/pc-001-pitch-count-records`（本記録PRの統合後に削除）

### 表示文言・LPの追加更新

- 投手情報と交代済み投手カードの見出しを「N人目の投手」に統一し、左右どちら側でも投手の順番が分かるようにした。
- LPの説明・FAQ・構造化データ、およびカウンター内の使い方説明を、投手ごとのイニング別記録と交代後の確認・訂正に合わせて更新した。
- `pnpm test`、`pnpm build`、`git diff --check` とPR CIが成功。静的レビューで重大な指摘なし。
- 追加実装PR: [#4](https://github.com/refrain62/baseball-pitch-counter/pull/4)（`develop` へ統合、マージコミット `165d55933a9c`）

### 投手情報の文字サイズ調整

- スマートフォンの投手見出し・累計球数・状態バッジ・履歴案内・イニングチップを拡大。狭幅時の基準を見出し12px、累計14px、バッジと案内10px、回表示10px、球数12pxとし、チップを74×36pxにした。
- 320px・360pxの画面で文字の切れ・重なりとページ横はみ出しがないことを確認。独立レビューで指摘なし。
- `pnpm test`、`pnpm build`、`git diff --check`、Workers Buildsが成功。
- CSSの参照をv51、Service Workerキャッシュをv56へ更新。
- 実装PR: [#7](https://github.com/refrain62/baseball-pitch-counter/pull/7)（`develop` へ統合、マージコミット `719690ed344d`）
- 実装コミット: `6532a52`（`feature/pitcher-info-readability`）

### 投手履歴の狭幅表示修正

- 投手履歴を展開したとき、投手名や3桁の累計球数がスマートフォンのカードからはみ出す問題を修正。2列表示を維持しつつ列を縮小できるようにし、390px以下では投手名・累計・状態を縦に配置して折り返す。
- 249px・320px・360px幅で、複数の投手履歴と3桁球数を使って実画面を確認。320pxではページ幅305px・カード幅138px、360pxではページ幅345px・カード幅158pxとなり、投手見出しを含む横はみ出しなし。249pxでもページ幅234px、投手見出しは92px内に収まることを確認。
- `pnpm test`、`pnpm build`、`git diff --check` が成功。独立レビューでCritical／Highの指摘なし。
- CSS参照をv52、Service Workerキャッシュをv57へ更新。
- 実装PR: [#10](https://github.com/refrain62/baseball-pitch-counter/pull/10)（`develop` へ統合、マージコミット `e200a8f417a0`）
- 実装コミット: `90d0387`（`feature/pitcher-details-overflow`）

### 操作ボタンの文字サイズ・アイコン位置調整

- 「1球戻す」「イニング変更」「選手交代」の主ラベルを同じサイズに揃え、ラベルはボタン中央、アイコンは左側の共通位置に配置した。狭い画面では3ボタンとも同じ文字サイズへ切り替わる。
- CSS参照をv53、Service Workerキャッシュをv58へ更新。
- 最新developを取り込んだ後に `pnpm test`、`pnpm build`、`git diff --check` が成功。
- 実装PR: [#13](https://github.com/refrain62/baseball-pitch-counter/pull/13)（`develop` へ統合、マージコミット `e8ccc32919fd`）。実装コミット: `5d746f4`。
- 本番デプロイ済み（Worker version `39b7d047-31c2-43fa-9b4a-07bb752d5f9c`）。
- 作業記録PR: [#14](https://github.com/refrain62/baseball-pitch-counter/pull/14)（`develop` へ統合、マージコミット `cf5a5d589f9f`）。

## SEC-001 依存関係とブラウザ保存境界の強化

- 状態: 実装完了。実装PR #17はDraftでレビュー待ち。
- 対応範囲: Wranglerと推移依存の既知High脆弱性、パッケージ管理の再現性、破損・改変された `localStorage` による初期化停止、Service Workerの不要な応答キャッシュ、CSPとHTTPS強制。
- 依存関係: Wranglerを `4.152.0` へ更新し、上流の完全一致依存に残る `undici` をpnpm overrideで修正版 `7.30.1` へ固定。`pnpm@10.26.0` と `pnpm-lock.yaml` に統一。
- ブラウザ境界: 保存データをサイズ・既知フィールド・文字列長・数値型で検証し、Service Workerの対象を列挙済みURLへ限定。HSTSと `script-src-attr 'none'` を追加。
- 敵対的レビュー: 独立レビューで依存解決、悪性保存値、任意queryキャッシュ、ヘッダー互換性を再確認し、Critical / High / Mediumの未解消指摘なし。
- 検証: `pnpm audit --audit-level high` は既知脆弱性なし、`pnpm test` は7件成功、`pnpm build` と `git diff --check` は成功。実インストールが `wrangler 4.152.0` → `miniflare` → `undici 7.30.1` となることを確認。
- 残る確認: 実HTTPヘッダーとService Workerのブラウザ実環境E2Eは、本番反映後に確認する。
- 実装コミット: `37fff6b`（`feature/security-hardening`）
- 実装PR: [#17](https://github.com/refrain62/baseball-pitch-counter/pull/17)（Draft、`develop` 向け）
