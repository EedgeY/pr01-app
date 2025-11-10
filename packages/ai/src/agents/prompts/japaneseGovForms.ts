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

# 注意事項
- 入力欄が明確でない場合は、ラベルの位置と典型的な配置パターンから推定してください
- confidenceは推定の確信度（0.0〜1.0）
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

上記の情報から、ユーザーが入力すべきフィールドを特定し、JSON形式で返してください。`;

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




