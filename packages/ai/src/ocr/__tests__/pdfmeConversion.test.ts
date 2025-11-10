/**
 * Tests for pdfme TextSchema conversion
 */

import { describe, it, expect } from 'vitest';
import { bboxToTextSchema, manyBboxesToTextSchemas, A4_PORTRAIT_MM } from '../pdfme';

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
    expect(schema.fontName).toBe('Roboto');
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

