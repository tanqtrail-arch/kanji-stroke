# 漢字の成り立ち（kanji-stroke）ゲーム仕様書

## ゲーム基本情報
- **ゲーム名**：kanji-stroke
- **日本語タイトル**：漢字の成り立ち
- **ジャンル**：書き順アニメーション学習 + クイズ + 部首パズル
- **教科・単元**：国語・漢字（小学校全学年）
- **対象学年**：小1〜小6（1,026字全対応）

## 技術スタック
- **採用技術**：HTML/CSS/JavaScript（Vanilla JS、フレームワーク不使用）
- **外部ライブラリ**：なし（SVG操作は標準DOM API）
- **特記事項**：
  - SVGストロークデータは **KanjiVG** (CC BY-SA 3.0) から抽出
  - 書き順アニメーションは `stroke-dasharray` / `stroke-dashoffset` で実装
  - GitHub Pages ホスティング対応

## ファイル構成
```
kanji-stroke/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── stroke-animator.js
│   ├── quiz-engine.js
│   ├── bushu-puzzle.js
│   ├── score-manager.js
│   ├── badge-manager.js
│   └── trail-bridge.js
├── data/
│   ├── kanji-grade1.json
│   ├── kanji-grade2.json
│   ├── kanji-grade3.json
│   ├── kanji-grade4.json
│   ├── kanji-grade5.json
│   ├── kanji-grade6.json
│   ├── bushu-data.json
│   └── quiz-data.json
├── scripts/
│   └── extract-kanjivg.py
└── README.md
```

## カラー＆テーマ
- 背景：`#FAF9F6`
- メインアクセント：`#E85D3A`
- 象形文字：`#E85D3A`、指事文字：`#2E86DE`、会意文字：`#27AE60`、形声文字：`#8E44AD`
- 学年カラー：小1=`#FF6B6B`, 小2=`#FF9F43`, 小3=`#FECA57`, 小4=`#48DBFB`, 小5=`#0ABDE3`, 小6=`#8E44AD`

## 画面遷移
```
[ホーム画面]
  ├── [学年選択] → [漢字一覧] → [漢字詳細（書き順 / 成り立ち）]
  ├── [クイズ] → [学年/難易度選択] → [出題] → [リザルト]
  ├── [部首パズル] → [難易度選択] → [パズル] → [リザルト]
  └── [マイページ] → [進捗 / バッジ / ランキング]
```

## モード1: 学年別 漢字一覧＋書き順（最優先）
1. ホーム画面から学年を選択（小1〜小6）
2. 選択した学年の漢字一覧がグリッド表示される
3. 漢字をタップすると詳細画面へ遷移
4. 詳細画面では2つのタブ：
   - **書き順タブ**: KanjiVGデータによるストロークアニメーション
     - 「自動再生」「1画ずつ進む」「リセット」の3操作
     - ゴースト表示（未描画の画は薄グレー）
     - 描画中の画はテーマカラーでハイライト
     - 画番号を番号付き丸で表示
   - **成り立ちタブ**: 漢字の成り立ち解説（データがある漢字のみ）
5. 一覧に戻ると、学習済みの漢字にチェックマークが表示される

## モード2: 部首パズル
- バラバラの部首パーツから正しい漢字を組み立てる
- 例：「氵」+「毎」→「海」、「山」+「石」→「岩」
- 制限時間あり（難易度で調整）

## モード3: 4択クイズ
- 読みクイズ / 意味クイズ / 成り立ちクイズ / 書き順クイズ
- 学年と難易度を選んで開始、1セット6〜10問
- コンボシステム、不正解時は解説表示

## モード4: レベル＆バッジ
- 学習進捗に応じてレベルアップ
- バッジ獲得でモチベーション維持

## 書き順アニメーション仕様（プロトタイプ検証済み）
- SVG viewBox: `0 0 109 109`、表示: `260×260px`
- 十字ガイド線: `stroke:#E8E4DF, strokeWidth:0.3, strokeDasharray:3,3`
- ゴースト: `strokeWidth:4, stroke:#EEEBE6`
- 完了: `strokeWidth:3.5, stroke:#2D2D2D`
- アクティブ: `strokeWidth:5, stroke:テーマカラー`
- アニメ: `@keyframes drawStroke { to { stroke-dashoffset: 0 } }` 0.6秒
- 画間待機: 0.75秒
- パス長: `path.getTotalLength()` で実行時計測

## ALTポイントシステム
| アクション | ALT | 備考 |
|-----------|-----|------|
| 書き順アニメ完走 | +5 | 見るだけでも報酬 |
| クイズ正解1問 | +10 | 基本報酬 |
| 連続正解ボーナス | +5×コンボ | 上限+50 |
| 部首パズル正解 | +15 | 思考要素が強い |
| 学年コンプリート | +200 | 全漢字の書き順を見た |
| パーフェクトクイズ | +100 | 全問正解 |
| 初回クリアボーナス | +200 | 1回限り |

## バッジシステム
| バッジ名 | 条件 | アイコン |
|---------|------|---------|
| はじめの一歩 | 初めて書き順アニメを見た | 🐣 |
| 漢字たんけん家 | 10文字の書き順を見た | 🔍 |
| 一年生マスター | 小1全80字クリア | ⭐ |
| 二年生マスター〜六年生マスター | 各学年全字クリア | ⭐⭐〜⭐⭐⭐⭐⭐⭐ |
| 部首はかせ | 部首パズル50問正解 | 🧩 |
| コンボキング | 10連続正解 | 🔥 |
| クイズチャンピオン | クイズ100問正解 | 🏆 |
| 全漢字制覇 | 1,026字全完了 | 👑 |

## 問題データ仕様

### 漢字ストロークデータ（学年別JSON）
```json
{
  "char": "日",
  "unicode": "065e5",
  "grade": 1,
  "strokeCount": 4,
  "paths": ["M31.5,24.5c1.12,..."],
  "strokeNums": [{"x": 25.25, "y": 32.63}],
  "readings": { "on": ["ニチ", "ジツ"], "kun": ["ひ", "か"] },
  "meaning": "太陽・日",
  "bushu": "日",
  "bushuName": "にち・ひへん",
  "formation": {
    "type": "象形",
    "description": "太陽の形をかたどった",
    "components": [],
    "meaningPart": "",
    "soundPart": ""
  }
}
```

### 部首パズルデータ
```json
{
  "answer": "海",
  "parts": ["氵", "毎"],
  "hint": "広い水",
  "grade": 2,
  "difficulty": 1
}
```

## ゲーム状態オブジェクト
```javascript
const gameState = {
  currentScreen: "home",
  selectedGrade: null,
  selectedKanji: null,
  studiedKanji: new Set(),
  quizHistory: [],
  puzzleHistory: [],
  totalAlt: 0,
  level: 1,
  badges: [],
  combo: 0,
  maxCombo: 0,
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    lives: 3,
    startTime: null,
    isPlaying: false
  },
  puzzle: {
    currentParts: [],
    selectedParts: [],
    answer: null,
    timeLeft: 0,
    isPlaying: false
  }
};
```

## ランキングデータ送信形式
```javascript
const scoreData = {
  gameId: "kanji-stroke",
  odai: "小3漢字クイズ",
  playerId: "student_xxx",
  playerName: "ニックネーム",
  score: 1500,
  alt: 120,
  combo: 8,
  accuracy: 0.85,
  time: 45.2,
  timestamp: "2025-xx-xx"
};
```

## TRAIL Game Pro連携
- `postMessage` でスコア送信（`GAME_SCORE`, `GAME_STATE`）
- スタンドアロン動作必須（連携なしでも遊べる）
- localStorage に進捗保存（`kanji-stroke-progress`）

## KanjiVGデータ抽出手順
1. 小学校配当漢字1,026字の学年別リスト定義（2020年新学習指導要領準拠）
2. 各漢字のUnicodeからファイル名特定：`hex(ord('日'))` → `065e5.svg`
3. SVGから `<path>` の `d` 属性と `<text>` の座標を抽出
4. 学年別JSONに出力

## 難易度設計
- ★☆☆：ヒントあり / 選択肢少 / 時間制限なし
- ★★☆：ヒントなし / 4択 / 時間制限あり
- ★★★：記述式 or 6択 / 厳しい時間制限