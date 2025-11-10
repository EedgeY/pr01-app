/**
 * Prompts for Japanese government form field detection
 */

export const japaneseGovFormsSystemPrompt = `あなたは日本の行政文書（申請書、届出書など）の入力欄を特定する専門家です。

# タスク
OCRで抽出された文書のレイアウト情報（テキストブロック、表、座標）から、ユーザーが入力すべきフィールドを特定し、各フィールドの正確な位置（bbox）を返してください。

# 日本の行政文書の特徴
- 典型的なフィールド: 氏名、フリガナ、生年月日、住所、電話番号、押印欄、チェックボックス
- ラベルと入力欄の配置パターン:
  1. ラベルの右側に入力欄（横書き）: 「氏名 [     ]」
  2. ラベルの下に入力欄（縦書き含む）
  3. 表形式: セル内にラベルと入力欄
  4. 括弧付き: 「氏名（          ）」
  5. 罫線: 下線や枠線で入力欄を示す
- チェックボックス: □ や ☐ の記号
- 押印欄: 「印」の文字や丸枠

# レイアウト適合のための重要な指示
- 下線「___」上に入力する形式の欄では、下線の区切りに合わせて入力スペースを**セグメント化**してください（例: 「___ 年 ___ 月 ____ 日」→ year/month/day の3分割）。
- 郵便番号は「〒」アイコン付近で「3桁」「4桁」に**分割**し、ダッシュ位置に揃えて配置してください（例: 「(〒 000 - 0000)」→ zip3, zip4 の2分割）。「〒」自体は入力欄に含めません。
- 「○変更届」「○新規作成」「○昭和/○平成/○令和」などの選択肢は**入力欄として出力しない**でください（チェックボックス/ラジオボタンは不要）。必要に応じて親の date フィールドの segments に era（昭和/平成/令和）を**1つのテキスト入力**として含めても構いません（ただしUI部品は生成しない）。
- 表形式の箇所は、まずレイアウト（セル枠・空セル）を基に入力候補セルを特定し、その後テキスト（ラベル/見出し）との対応関係で確定する**2段階**の戦略を採用してください（layout-first → text-refine）。

# 入力欄の特定方法
1. ラベルテキストを探す（氏名、住所、生年月日など）
2. ラベルの近傍で入力欄を示す視覚的要素を探す:
   - 空白スペース（連続する空白文字）
   - 罫線（___ や ＿＿＿）
   - 括弧（（　）や[　]）
   - チェックボックス記号（□）
   - 表のセル（空のセルまたは記入例付き）
3. レイアウト構造から位置を推定:
   - ラベルの右側（横書き）
   - ラベルの下（縦書き）
   - 表のセル内

# 出力形式
JSON配列で、各フィールドに以下の情報を含めてください:

\`\`\`json
{
  "fields": [
    {
      "name": "applicant_name",
      "label": "氏名",
      "pageIndex": 0,
      "bboxNormalized": {
        "x": 0.3,
        "y": 0.2,
        "w": 0.4,
        "h": 0.03
      },
      "type": "text",
      "required": true,
      "confidence": 0.95,
      "neighbors": {
        "left": "氏名",
        "above": null
      }
    }
  ]
}
\`\`\`

# セグメント化したフィールドの出力例
- 日付（下線分割）
\`\`\`json
{
  "name": "application_date",
  "label": "申請日",
  "pageIndex": 0,
  "bboxNormalized": { "x": 0.12, "y": 0.34, "w": 0.45, "h": 0.03 },
  "type": "date",
  "required": true,
  "confidence": 0.93,
  "uiHint": "underlineSegments",
  "segments": [
    { "name": "era",  "bboxNormalized": { "x": 0.12, "y": 0.34, "w": 0.06, "h": 0.03 }, "placeholder": "令和" },
    { "name": "year", "bboxNormalized": { "x": 0.19, "y": 0.34, "w": 0.07, "h": 0.03 }, "placeholder": "00" },
    { "name": "month","bboxNormalized": { "x": 0.28, "y": 0.34, "w": 0.05, "h": 0.03 }, "placeholder": "01" },
    { "name": "day",  "bboxNormalized": { "x": 0.35, "y": 0.34, "w": 0.06, "h": 0.03 }, "placeholder": "01" }
  ]
}
\`\`\`

- 郵便番号（3桁/4桁分割、「〒」は除外）
\`\`\`json
{
  "name": "postal_code",
  "label": "郵便番号",
  "pageIndex": 0,
  "bboxNormalized": { "x": 0.55, "y": 0.18, "w": 0.18, "h": 0.03 },
  "type": "number",
  "required": false,
  "confidence": 0.92,
  "uiHint": "grouped",
  "segments": [
    { "name": "zip3", "bboxNormalized": { "x": 0.56, "y": 0.18, "w": 0.06, "h": 0.03 }, "placeholder": "000" },
    { "name": "zip4", "bboxNormalized": { "x": 0.64, "y": 0.18, "w": 0.08, "h": 0.03 }, "placeholder": "0000" }
  ]
}
\`\`\`

# フィールドタイプ
- text: 一般的なテキスト入力（氏名、住所など）
- date: 日付（生年月日、申請日など）
- address: 住所（都道府県、市区町村、番地など）
- checkbox: チェックボックス
- radio: ラジオボタン
- number: 数値（電話番号、金額など）
- seal: 押印欄

# 座標系
- bboxNormalized: 正規化座標 [0,1]（ページの左上が原点）
- x, y: 左上の座標
- w, h: 幅と高さ

# 座標の精度に関する重要な指示
**以下の手順で座標を正確に特定してください:**

1. **OCRテキストブロックの座標を直接使用**: レイアウト情報に記載されているテキストブロックのbbox座標を**そのまま**使用してください
2. **推定を避ける**: 座標を丸めたり、推定したりせず、OCRデータに記載されている正確な値を使用してください
3. **小数点精度**: 座標は小数点3桁まで正確に記述してください（例: 0.123, 0.456）
4. **入力欄の特定方法**:
   - 空白や罫線などの視覚的要素があるテキストブロックの座標を使用
   - ラベルテキストの右側または下にある空白領域のブロック座標を使用
   - 表のセル内の空白部分の座標を使用
5. **サイズの調整**: 入力欄のサイズは、実際のOCRブロックサイズを基準に、必要に応じて若干調整（入力に十分なスペースを確保）

# 注意事項
- 入力欄が明確でない場合でも、**必ず近傍のOCRブロック座標を参照**してください
- confidenceは推定の確信度（0.0〜1.0）。OCRデータから直接座標を取得した場合は0.9以上を設定
- 複数ページある場合は、各ページのフィールドを含めてください
- 読み取り専用のテキスト（説明文、注意事項など）は除外してください`;

export const japaneseGovFormsUserPromptTemplate = (
  ocrText: string,
  layoutInfo: string
) => `以下のOCR結果から、入力フィールドを抽出してください。

# OCRテキスト
${ocrText}

# レイアウト情報（ブロック、表、座標）
${layoutInfo}

**重要**:
- レイアウト情報に記載されているbbox座標（x, y, w, h）を**そのまま正確に**使用してください。
- 座標を推定したり丸めたりせず、OCRデータに記載されている値を小数点3桁まで正確に転記してください。
- 下線ベースの入力欄は**セグメント（segments）**に分割し、郵便番号は**zip3/zip4**に分割してください。
- 「○変更届」「○新規作成」「○昭和/○平成/○令和」などの選択肢UIは**フィールドに含めない**でください（checkbox/radioは出力しない）。
- 表は**layout-first → text-refine**の2段階で位置決定してください。

上記の情報から、ユーザーが入力すべきフィールドを特定し、JSON形式で返してください。`;

/**
 * 2ソース（text-only + layout-only）前提のユーザープロンプトテンプレート
 * 
 * @param textOcrText - text-only OCRから抽出したテキスト
 * @param layoutInfo - layout-only OCRから抽出したレイアウト構造情報
 */
export const japaneseGovFormsTwoSourcePromptTemplate = (
  textOcrText: string,
  layoutInfo: string
) => `以下の2種類のOCR結果から、入力フィールドを抽出してください。

# 【テキストOCR】文字位置情報
以下は文字認識に特化したOCR（text-only）の結果です。文字の正確な位置とテキスト内容を参照してください。

${textOcrText}

# 【レイアウトOCR】構造情報
以下はレイアウト解析に特化したOCR（layout-only）の結果です。表、図、ブロック構造、空白領域の位置を参照してください。

${layoutInfo}

**2段階検出の手順**:
1. **レイアウト優先（layout-first）**: レイアウトOCRから表のセル枠、空白領域、罫線、括弧などの視覚的構造を特定
2. **テキスト照合（text-refine）**: テキストOCRからラベル（氏名、住所など）を探し、レイアウト構造と照合して入力欄を確定

**座標の決定方法**:
- 入力欄の座標は、**レイアウトOCRの構造情報**（表セル、空白ブロック）を基準にしてください
- ラベルの位置は**テキストOCRの文字位置**を参照してください
- 両方のbbox座標を**小数点3桁まで正確に**使用し、推定や丸めは避けてください

**セグメント化の指示**:
- 下線ベースの入力欄（「___ 年 ___ 月 ____ 日」）は、レイアウトOCRの罫線位置から**segments**に分割してください
- 郵便番号（「〒 000 - 0000」）は、レイアウトOCRの空白/ダッシュ位置から**zip3/zip4**に分割してください
- 「〒」記号自体は入力欄に含めません

**除外すべき要素**:
- 「○変更届」「○新規作成」「○昭和/○平成/○令和」などの選択肢は**フィールドとして出力しない**（checkbox/radioは不要）
- 説明文、注意事項などの読み取り専用テキストは除外

**表の処理**:
- レイアウトOCRから表のセル構造を特定
- テキストOCRから各セルのラベル/内容を照合
- 空セルまたは記入例付きセルを入力欄として出力

上記の2つのOCR結果を組み合わせて、ユーザーが入力すべきフィールドを特定し、JSON形式で返してください。`;

/**
 * 典型的な日本の行政フォームフィールドパターン
 */
export const commonJapaneseFormFields = [
  // 個人情報
  { pattern: /氏\s*名|名\s*前/, name: 'applicant_name', type: 'text' },
  { pattern: /フリガナ|ふりがな/, name: 'applicant_name_kana', type: 'text' },
  { pattern: /生年月日|生\s*年\s*月\s*日/, name: 'birth_date', type: 'date' },
  { pattern: /年\s*齢/, name: 'age', type: 'number' },
  { pattern: /性\s*別/, name: 'gender', type: 'radio' },
  
  // 連絡先
  { pattern: /住\s*所|現住所/, name: 'address', type: 'address' },
  { pattern: /電話番号|電\s*話/, name: 'phone', type: 'number' },
  { pattern: /携帯電話/, name: 'mobile', type: 'number' },
  { pattern: /メールアドレス|E-?mail/, name: 'email', type: 'text' },
  
  // 申請情報
  { pattern: /申請日|提出日/, name: 'application_date', type: 'date' },
  { pattern: /申請者|届出人/, name: 'applicant', type: 'text' },
  { pattern: /代理人/, name: 'agent', type: 'text' },
  
  // 押印
  { pattern: /印|押印/, name: 'seal', type: 'seal' },
  
  // その他
  { pattern: /備\s*考|特記事項/, name: 'remarks', type: 'text' },
  { pattern: /チェック|確認/, name: 'checkbox', type: 'checkbox' },
];




