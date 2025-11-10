/**
 * 専門的な技術ブリーフのスタイルガイド
 * 感情/共感レトリックを排し、簡潔・具体的・再現性重視の文体規範
 */

export const EXPERT_STYLE_GUIDE = `
# 技術ブリーフ スタイルガイド

## 基本原則

### 口調・トーン
- 「である」体または「です・ます」体（一貫性を保つ）
- 簡潔・明瞭・客観的な記述
- 感情表現・共感レトリックは使用しない
- 結論を先に述べ、根拠を後に続ける
- 専門用語は適切に使用し、必要に応じて簡潔に定義

### 禁止表現
❌ 「こんな経験、ありませんか？」
❌ 「正直、焦っていました」
❌ 「本当に嬉しくて」
❌ 「〜なんですよね」
❌ 「ぐっと良くなる」
❌ 絵文字（💡 🔔 ✅ など）
❌ 過度な装飾・煽り文句

### 推奨表現
✅ 「次の問題が発生する」
✅ 「以下の手順で解決できる」
✅ 「実測で30%改善した」
✅ 「この制約により〜が必要」
✅ 「再現手順は次の通り」

### 構成の流れ
1. **概要**: 目的・対象読者・前提知識を明示
2. **前提と制約**: 環境・バージョン・依存関係・既知の制約
3. **方法**: アプローチの概要と選定理由
4. **実装**: 具体的な手順・コード・設定
5. **評価指標**: 数値・ベンチマーク・比較結果
6. **エラーと限界**: 既知の問題・回避策・適用範囲の限界
7. **運用**: デプロイ・監視・保守のポイント
8. **参考資料**: 公式ドキュメント・論文・関連記事

### フォーマット要件
- **段落は3-5行以内**（情報密度を保ちつつ可読性を確保）
- **箇条書きを積極活用**（手順・条件・結果の列挙）
- **コードブロック必須**（最低1箇所、実行可能な最小例を含む）
- **数値・指標必須**（性能・精度・時間など定量データ）
- **表の活用**（比較・スペック・結果の整理）

### 具体性の担保
- 抽象論を避け、具体例・数値・コードで裏付ける
- 「効果がある」→「精度が85%→92%に向上」
- 「簡単に設定できる」→「3行の設定で完了」
- 「便利なツール」→「yomitoku v1.2.0」

### 対象読者
- 実務経験のあるエンジニア・研究者
- 技術的背景知識を持つ読者
- 再現性・効率性を重視する読者
- 時間を無駄にしたくない読者
`;

export const EXPERT_STRUCTURE_GUIDE = `
# 技術ブリーフの構成ガイド

## 1. 概要セクション
\`\`\`
# [技術/手法名]の実装と評価

## 概要
[目的を1-2文で]

対象読者: [想定する読者層]
前提知識: [必要な前提知識]
所要時間: [実装にかかる時間]
\`\`\`

## 2. 前提と制約
\`\`\`
## 前提と制約

### 環境
- Python 3.10+
- CUDA 11.8
- メモリ: 16GB以上推奨

### 依存関係
- torch==2.0.1
- transformers==4.30.0

### 既知の制約
- 日本語以外の言語には未対応
- GPU必須（CPU実行は10倍以上遅い）
\`\`\`

## 3. 方法
\`\`\`
## 方法

### アプローチ
[選定した手法の概要]

### 選定理由
1. [理由1: 精度・速度などの定量比較]
2. [理由2: 実装コスト・保守性]
3. [理由3: ライセンス・コミュニティ]
\`\`\`

## 4. 実装
\`\`\`
## 実装

### ステップ1: 環境構築
\`\`\`bash
pip install yomitoku==1.2.0
\`\`\`

### ステップ2: 最小実行例
\`\`\`python
from yomitoku import DocumentAnalyzer

analyzer = DocumentAnalyzer()
result = analyzer.analyze("input.pdf")
print(result.text)
\`\`\`

### ステップ3: [次の手順]
[具体的な説明]
\`\`\`

## 5. 評価指標
\`\`\`
## 評価指標

### 精度
| データセット | 文字認識率 | レイアウト精度 |
|------------|----------|-------------|
| テストA     | 94.2%    | 89.1%       |
| テストB     | 91.8%    | 87.3%       |

### 速度
- 1ページあたり: 2.3秒（GPU）
- バッチ処理: 0.8秒/ページ（バッチサイズ=8）

### 比較
従来手法と比較して文字認識率が7.2ポイント向上。
\`\`\`

## 6. エラーと限界
\`\`\`
## エラーと限界

### よくあるエラー
**エラー1: CUDA out of memory**
- 原因: バッチサイズが大きすぎる
- 回避策: バッチサイズを4以下に設定

**エラー2: [エラー名]**
- 原因: [原因]
- 回避策: [具体的な対処法]

### 適用範囲の限界
- 手書き文字の認識精度は印刷文字より10-15%低い
- 画像解像度が300dpi未満の場合、精度が低下
\`\`\`

## 7. 運用
\`\`\`
## 運用

### デプロイ
- Docker イメージ: [イメージ名]
- 推奨インスタンス: GPU付きインスタンス（g4dn.xlarge以上）

### 監視
- 処理時間が5秒を超えた場合はアラート
- エラー率が5%を超えた場合は手動確認

### 保守
- モデル更新: 月次でベンチマーク実行
- ログ保持期間: 30日
\`\`\`

## 8. 参考資料
\`\`\`
## 参考資料

- [公式ドキュメント](URL)
- [論文タイトル](URL)
- [関連記事](URL)
\`\`\`
`;

export const EXPERT_FORMATTING_RULES = `
# フォーマットルール

## 段落の書き方
- 1段落は3-5行まで
- 1段落には1つの主題のみ
- 冗長な接続詞を避ける

## 悪い例
\`\`\`
OCRを実装する際には、まず前処理が重要になります。というのも、前処理の品質が最終的な認識精度に大きく影響するからです。特に、画像の二値化やノイズ除去は必須の処理と言えるでしょう。また、傾き補正も忘れずに実施することをお勧めします。
\`\`\`

## 良い例
\`\`\`
OCR実装では前処理が認識精度を左右する。

必須処理:
- 二値化
- ノイズ除去
- 傾き補正

これらの処理により認識精度が平均8%向上する。
\`\`\`

## コードブロックの要件
- 実行可能な最小例を含める
- コメントは必要最小限
- 言語を明示（\`\`\`python, \`\`\`bash など）

## 表の活用
- 比較データは表形式で整理
- 数値は右揃え
- 単位を明記

## 箇条書きの活用
- 手順・条件・結果は箇条書き
- 各項目は簡潔に（1-2行）
- 階層は2レベルまで
`;

export const EXPERT_TITLE_GUIDE = `
# タイトル作成ガイド

## 基本フォーマット
[技術名] + [動詞] + [結果/指標]

## 良い例
- 「yomitokuで日本語OCR精度を92%に向上させる実装手順」
- 「Pythonによる文書レイアウト解析｜3つのライブラリ比較と選定基準」
- 「日本語特化OCRの前処理最適化｜処理時間を40%削減した手法」

## 避けるべき例
- 「OCRについて」（抽象的）
- 「私のOCR体験談」（主観的）
- 「OCRのすごい話」（曖昧）

## 評価軸
1. **具体性**: 技術名・バージョン・数値があるか（3点）
2. **成果**: 定量的な結果が明示されているか（3点）
3. **範囲**: 対象範囲が明確か（2点）
4. **実用性**: 実装・再現可能性が伝わるか（2点）

合計10点満点で7点以上を目指す
`;

/**
 * エージェント用のシステムプロンプトを生成
 */
export function getExpertStylePrompt(role: 'strategy' | 'draft' | 'editor'): string {
  const baseStyle = EXPERT_STYLE_GUIDE + '\n\n' + EXPERT_FORMATTING_RULES;
  
  switch (role) {
    case 'strategy':
      return baseStyle + '\n\n' + EXPERT_TITLE_GUIDE;
    case 'draft':
      return baseStyle + '\n\n' + EXPERT_STRUCTURE_GUIDE;
    case 'editor':
      return baseStyle + '\n\n' + EXPERT_STRUCTURE_GUIDE;
    default:
      return baseStyle;
  }
}

/**
 * タイトルを評価する関数（専門スタイル用）
 */
export function scoreExpertTitle(title: string): {
  score: number;
  breakdown: {
    specificity: number;
    outcome: number;
    scope: number;
    practicality: number;
  };
  feedback: string;
} {
  const breakdown = {
    specificity: 0,
    outcome: 0,
    scope: 0,
    practicality: 0,
  };

  // 具体性（技術名・バージョン・数値）
  if (/[A-Za-z0-9]+/.test(title)) breakdown.specificity += 1;
  if (/\d+(\.\d+)?/.test(title)) breakdown.specificity += 1;
  if (/(v\d|version|Ver\.)/.test(title)) breakdown.specificity += 1;
  breakdown.specificity = Math.min(3, breakdown.specificity);

  // 成果（定量的結果）
  if (/(\d+%|倍|削減|向上|改善)/.test(title)) breakdown.outcome += 2;
  if (/(精度|速度|性能|効率)/.test(title)) breakdown.outcome += 1;
  breakdown.outcome = Math.min(3, breakdown.outcome);

  // 範囲
  if (/(実装|構築|設計|最適化|比較|評価)/.test(title)) breakdown.scope += 1;
  if (/(手順|方法|ガイド)/.test(title)) breakdown.scope += 1;
  breakdown.scope = Math.min(2, breakdown.scope);

  // 実用性
  if (/(実装|再現|運用|デプロイ)/.test(title)) breakdown.practicality += 2;

  const score = breakdown.specificity + breakdown.outcome + breakdown.scope + breakdown.practicality;

  let feedback = '';
  if (breakdown.specificity < 2) feedback += '技術名やバージョン、数値を追加すると良い。';
  if (breakdown.outcome < 2) feedback += '定量的な成果を明示すると説得力が増す。';
  if (breakdown.scope === 0) feedback += '対象範囲（実装/比較/評価など）を明確にする。';
  if (breakdown.practicality === 0) feedback += '実用性（実装可能性）を示す言葉を入れる。';

  return { score, breakdown, feedback: feedback || '適切なタイトルです。' };
}

