# Architecture

## 方針

SPAやフレームワークを使わず、HTML/CSS/JavaScriptの静的MPAとして構成する。
変更は対象ファイルを直接編集してpushするだけで、アプリのビルド工程はない。

## URL

本番オリジン: `https://baseball-pitch-counter.refrain62.workers.dev`

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

## Counter UI v15

`/counter/` は実機カウンターをモチーフにした2カラムUI。1塁側は青、3塁側は赤で識別し、各ヘッダーのダイヤモンドでも1塁・3塁を明示する。表示は3桁の機械式カウンター風で、投球数は0〜999。背景・ベース表示・PWAアイコンを含め、外部CDNや外部JSは使用しない。

各側で独立したイニングを管理する。「イニング変更」から選択モーダルを開き、1〜9回または延長10〜99回を選択する。確定後の投球から選択回へ記録し、イニング変更では累計や投手を変えない。現在回のチップを色で示し、投手ごとの累計とイニング別球数を `localStorage` に保存する。投手の見出しは「1人目の投手」「2人目の投手」の形式で、現在投手と交代後の履歴を同じ表記にする。投手履歴を開いて回別チップを選ぶと対象回だけを訂正でき、交代済み投手も同じ方法で編集できる。旧データの回別情報のない球数は「イニング未設定」として引き継ぐ。訂正ダイアログでは±ボタンと数値入力を使い、保存後に累計を再計算する。個別リセットは現在投手の全回別球数と未設定分を消去して履歴を保持し、全リセットは投手別記録と交代履歴も削除する。

画面案に沿った濃紺基調の青／赤2カラムを維持する。「イニング変更」は「選手交代」の直上に置く。投球数訂正ダイアログは画面幅の94%以内・最大520pxで表示し、320px以上ではラベルと「−／数値／＋」を横並びにする。320px未満で縦積みに切り替える。回の選択肢は44×44px以上、球数訂正の「＋／−」は56×56px以上、イニング変更の前後ボタンは80×64px以上を確保する。


### Counter image assets

`public/counter/images/` では、カウンター画面に使う実画像を同梱する。

- `bg-stadium-mobile.png`: スマホ向け縦背景
- `bg-stadium-desktop.png`: タブレット/PC向け横背景
- `baseball-count-button.png`: 1球カウントボタン上部の共通ボール画像
- `base-first.svg`: 1塁側表示
- `base-third.svg`: 3塁側表示

## LP background assets

The landing page uses local self-hosted background assets only:

- `public/assets/lp-bg-mobile.png`
- `public/assets/lp-bg-desktop.png`

The mobile and desktop backgrounds are selected with CSS media queries. A dark overlay is always applied to preserve text contrast.
