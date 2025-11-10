/**
 * Tests for pdfme TextSchema conversion
 */

import { describe, it, expect } from 'vitest';
import {
  bboxToTextSchema,
  manyBboxesToTextSchemas,
  A4_PORTRAIT_MM,
  generatePlaceholder,
  fieldsToTextSchemas,
  type DetectedField,
} from '../pdfme';

describe('bboxToTextSchema', () => {
  it('converts full page bbox to A4 dimensions', () => {
    const bbox = { x: 0, y: 0, w: 1, h: 1 };
    const schema = bboxToTextSchema(bbox, 'Full page', 'fullPage');

    expect(schema.position.x).toBe(0);
    expect(schema.position.y).toBe(0);
    expect(schema.width).toBe(210);
    expect(schema.height).toBe(297);
    expect(schema.content).toBe('Full page');
    expect(schema.name).toBe('fullPage');
  });

  it('converts example bbox [0.11, 0.222, 0.221, 0.012] correctly', () => {
    const bbox = { x: 0.11, y: 0.222, w: 0.221, h: 0.012 };
    const schema = bboxToTextSchema(bbox, 'Sample field', 'sample');

    // x = 0.11 * 210 = 23.1
    expect(schema.position.x).toBeCloseTo(23.1, 2);
    // y = 0.222 * 297 = 65.934
    expect(schema.position.y).toBeCloseTo(65.934, 2);
    // w = 0.221 * 210 = 46.41
    expect(schema.width).toBeCloseTo(46.41, 2);
    // h = 0.012 * 297 = 3.564
    expect(schema.height).toBeCloseTo(3.564, 2);
  });

  it('uses default content when empty string provided', () => {
    const bbox = { x: 0.5, y: 0.5, w: 0.1, h: 0.05 };
    const schema = bboxToTextSchema(bbox, '', 'empty');

    expect(schema.content).toBe('Type Something...');
  });

  it('applies default field properties', () => {
    const bbox = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    const schema = bboxToTextSchema(bbox, 'Test', 'test');

    expect(schema.type).toBe('text');
    expect(schema.rotate).toBe(0);
    expect(schema.alignment).toBe('left');
    expect(schema.verticalAlignment).toBe('top');
    expect(schema.fontSize).toBe(13);
    expect(schema.lineHeight).toBe(1);
    expect(schema.characterSpacing).toBe(0);
    expect(schema.fontColor).toBe('#000000');
    expect(schema.fontName).toBe('NotoSerifJP');
    expect(schema.backgroundColor).toBe('');
    expect(schema.opacity).toBe(1);
    expect(schema.strikethrough).toBe(false);
    expect(schema.underline).toBe(false);
    expect(schema.required).toBe(false);
  });

  it('includes dynamicFontSize configuration', () => {
    const bbox = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    const schema = bboxToTextSchema(bbox, 'Test', 'test');

    expect(schema.dynamicFontSize).toEqual({
      min: 6,
      max: 13,
      fit: 'horizontal',
    });
  });

  it('uses custom page dimensions', () => {
    const bbox = { x: 0, y: 0, w: 1, h: 1 };
    const customPage = { width: 297, height: 210 } as const; // A4 landscape
    const schema = bboxToTextSchema(bbox, 'Landscape', 'landscape', customPage);

    expect(schema.width).toBe(297);
    expect(schema.height).toBe(210);
  });

  it('generates default name when not provided', () => {
    const bbox = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    const schema = bboxToTextSchema(bbox, 'Test');

    expect(schema.name).toBe('field');
  });
});

describe('manyBboxesToTextSchemas', () => {
  it('converts multiple bboxes to schemas', () => {
    const items = [
      { bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 }, text: 'Field 1', name: 'field1' },
      { bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.05 }, text: 'Field 2', name: 'field2' },
      { bbox: { x: 0.1, y: 0.3, w: 0.2, h: 0.05 }, text: 'Field 3', name: 'field3' },
    ];

    const schemas = manyBboxesToTextSchemas(items);

    expect(schemas).toHaveLength(3);
    expect(schemas[0]?.name).toBe('field1');
    expect(schemas[0]?.content).toBe('Field 1');
    expect(schemas[1]?.name).toBe('field2');
    expect(schemas[1]?.content).toBe('Field 2');
    expect(schemas[2]?.name).toBe('field3');
    expect(schemas[2]?.content).toBe('Field 3');
  });

  it('generates sequential field names when not provided', () => {
    const items = [
      { bbox: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 }, text: 'Field A' },
      { bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.05 }, text: 'Field B' },
      { bbox: { x: 0.1, y: 0.3, w: 0.2, h: 0.05 }, text: 'Field C' },
    ];

    const schemas = manyBboxesToTextSchemas(items);

    expect(schemas[0]?.name).toBe('field1');
    expect(schemas[1]?.name).toBe('field2');
    expect(schemas[2]?.name).toBe('field3');
  });

  it('handles empty array', () => {
    const schemas = manyBboxesToTextSchemas([]);
    expect(schemas).toHaveLength(0);
  });

  it('uses custom page dimensions for all items', () => {
    const items = [
      { bbox: { x: 0, y: 0, w: 1, h: 1 }, text: 'Full' },
    ];
    const customPage = { width: 100, height: 200 } as const;

    const schemas = manyBboxesToTextSchemas(items, customPage);

    expect(schemas[0]?.width).toBe(100);
    expect(schemas[0]?.height).toBe(200);
  });
});

describe('A4_PORTRAIT_MM constant', () => {
  it('has correct A4 portrait dimensions', () => {
    expect(A4_PORTRAIT_MM.width).toBe(210);
    expect(A4_PORTRAIT_MM.height).toBe(297);
  });
});

describe('generatePlaceholder', () => {
  const createField = (
    label: string,
    type: DetectedField['type'] = 'text'
  ): DetectedField => ({
    name: 'test',
    label,
    pageIndex: 0,
    bboxNormalized: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
    type,
    required: false,
    confidence: 0.9,
  });

  describe('type-based placeholders', () => {
    it('returns date placeholder for date type', () => {
      const field = createField('日付', 'date');
      expect(generatePlaceholder(field)).toBe('令和6年1月1日');
    });

    it('returns number placeholder for number type', () => {
      const field = createField('金額', 'number');
      expect(generatePlaceholder(field)).toBe('0');
    });

    it('returns checkbox symbol for checkbox type', () => {
      const field = createField('同意する', 'checkbox');
      expect(generatePlaceholder(field)).toBe('☑');
    });

    it('returns radio symbol for radio type', () => {
      const field = createField('選択', 'radio');
      expect(generatePlaceholder(field)).toBe('◉');
    });

    it('returns seal placeholder for seal type', () => {
      const field = createField('印鑑', 'seal');
      expect(generatePlaceholder(field)).toBe('印');
    });

    it('returns address placeholder for address type', () => {
      const field = createField('住所', 'address');
      expect(generatePlaceholder(field)).toBe('東京都渋谷区○○1-2-3');
    });
  });

  describe('name-related placeholders', () => {
    it('returns Japanese name for 氏名', () => {
      const field = createField('氏名');
      expect(generatePlaceholder(field)).toBe('山田 太郎');
    });

    it('returns katakana name for フリガナ', () => {
      const field = createField('氏名（フリガナ）');
      expect(generatePlaceholder(field)).toBe('ヤマダ タロウ');
    });

    it('returns Japanese name for 名前', () => {
      const field = createField('お名前');
      expect(generatePlaceholder(field)).toBe('山田 太郎');
    });
  });

  describe('contact-related placeholders', () => {
    it('returns phone number for 電話', () => {
      const field = createField('電話番号');
      expect(generatePlaceholder(field)).toBe('03-1234-5678');
    });

    it('returns mobile number for 携帯', () => {
      const field = createField('携帯電話');
      expect(generatePlaceholder(field)).toBe('090-1234-5678');
    });

    it('returns email for メール', () => {
      const field = createField('メールアドレス');
      expect(generatePlaceholder(field)).toBe('example@example.com');
    });

    it('returns postal code for 郵便', () => {
      const field = createField('郵便番号');
      expect(generatePlaceholder(field)).toBe('150-0001');
    });
  });

  describe('company-related placeholders', () => {
    it('returns company name for 会社', () => {
      const field = createField('会社名');
      expect(generatePlaceholder(field)).toBe('株式会社○○');
    });

    it('returns department for 部署', () => {
      const field = createField('所属部署');
      expect(generatePlaceholder(field)).toBe('営業部');
    });

    it('returns position for 役職', () => {
      const field = createField('役職名');
      expect(generatePlaceholder(field)).toBe('部長');
    });
  });

  describe('bank-related placeholders', () => {
    it('returns bank name for 銀行', () => {
      const field = createField('銀行名');
      expect(generatePlaceholder(field)).toBe('○○銀行');
    });

    it('returns branch name for 支店', () => {
      const field = createField('支店名');
      expect(generatePlaceholder(field)).toBe('○○支店');
    });

    it('returns account number for 口座番号', () => {
      const field = createField('口座番号');
      expect(generatePlaceholder(field)).toBe('1234567');
    });

    it('returns account holder name for 口座名義', () => {
      const field = createField('口座名義');
      expect(generatePlaceholder(field)).toBe('ヤマダ タロウ');
    });
  });

  describe('other placeholders', () => {
    it('returns age for 年齢', () => {
      const field = createField('年齢');
      expect(generatePlaceholder(field)).toBe('30');
    });

    it('returns gender for 性別', () => {
      const field = createField('性別');
      expect(generatePlaceholder(field)).toBe('男性');
    });

    it('returns amount for 金額', () => {
      const field = createField('支払金額');
      expect(generatePlaceholder(field)).toBe('10,000円');
    });

    it('returns remarks for 備考', () => {
      const field = createField('備考欄');
      expect(generatePlaceholder(field)).toBe('特になし');
    });
  });

  describe('default case', () => {
    it('returns label as placeholder when no match', () => {
      const field = createField('カスタムフィールド');
      expect(generatePlaceholder(field)).toBe('カスタムフィールド');
    });
  });
});

describe('fieldsToTextSchemas', () => {
  it('converts detected fields to text schemas with placeholders', () => {
    const fields: DetectedField[] = [
      {
        name: 'name',
        label: '氏名',
        pageIndex: 0,
        bboxNormalized: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
        type: 'text',
        required: true,
        confidence: 0.95,
      },
      {
        name: 'email',
        label: 'メールアドレス',
        pageIndex: 0,
        bboxNormalized: { x: 0.1, y: 0.2, w: 0.3, h: 0.05 },
        type: 'text',
        required: false,
        confidence: 0.85,
      },
    ];

    const schemas = fieldsToTextSchemas(fields);

    expect(schemas).toHaveLength(2);
    expect(schemas[0]?.name).toBe('name');
    expect(schemas[0]?.content).toBe('山田 太郎');
    expect(schemas[0]?.required).toBe(true);
    expect(schemas[1]?.name).toBe('email');
    expect(schemas[1]?.content).toBe('example@example.com');
    expect(schemas[1]?.required).toBe(false);
  });

  it('handles date type fields', () => {
    const fields: DetectedField[] = [
      {
        name: 'date',
        label: '申請日',
        pageIndex: 0,
        bboxNormalized: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
        type: 'date',
        required: true,
        confidence: 0.9,
      },
    ];

    const schemas = fieldsToTextSchemas(fields);

    expect(schemas[0]?.content).toBe('令和6年1月1日');
  });

  it('uses label as name when name is empty', () => {
    const fields: DetectedField[] = [
      {
        name: '',
        label: '氏名',
        pageIndex: 0,
        bboxNormalized: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 },
        type: 'text',
        required: false,
        confidence: 0.9,
      },
    ];

    const schemas = fieldsToTextSchemas(fields);

    expect(schemas[0]?.name).toBe('氏名');
  });
});

