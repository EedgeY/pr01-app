'use client';

import {
  BaseBoxShapeUtil,
  DefaultColorStyle,
  HTMLContainer,
  T,
  TLBaseShape,
  TLDefaultColorStyle,
  getColorValue,
  useDefaultColorTheme,
} from 'tldraw';

type IThinRectangleShape = TLBaseShape<
  'thin-rectangle',
  {
    w: number;
    h: number;
    color: TLDefaultColorStyle;
    fill: string;
  }
>;

type IThinCircleShape = TLBaseShape<
  'thin-circle',
  {
    w: number;
    h: number;
    color: TLDefaultColorStyle;
    fill: string;
  }
>;

export class ThinRectangleShapeUtil extends BaseBoxShapeUtil<IThinRectangleShape> {
  static override type = 'thin-rectangle' as const;

  static override props = {
    w: T.number,
    h: T.number,
    color: DefaultColorStyle,
    fill: T.string,
  };

  getDefaultProps(): IThinRectangleShape['props'] {
    return {
      w: 200,
      h: 200,
      color: 'black',
      fill: 'solid',
    };
  }

  component(shape: IThinRectangleShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useDefaultColorTheme();
    const fillColor =
      shape.props.fill === 'solid'
        ? getColorValue(theme, shape.props.color, 'solid')
        : 'transparent';
    const borderColor = theme.text;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,

          border: `1px solid ${borderColor}`,
          backgroundColor: fillColor,
          borderRadius: 0,
        }}
      />
    );
  }

  indicator(shape: IThinRectangleShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

export class ThinCircleShapeUtil extends BaseBoxShapeUtil<IThinCircleShape> {
  static override type = 'thin-circle' as const;

  static override props = {
    w: T.number,
    h: T.number,
    color: DefaultColorStyle,
    fill: T.string,
  };

  getDefaultProps(): IThinCircleShape['props'] {
    return {
      w: 200,
      h: 200,
      color: 'light-blue',
      fill: 'solid',
    };
  }

  component(shape: IThinCircleShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useDefaultColorTheme();
    const fillColor =
      shape.props.fill === 'solid'
        ? getColorValue(theme, shape.props.color, 'solid')
        : 'transparent';
    const borderColor = theme.text;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          border: `1px solid ${borderColor}`,
          backgroundColor: fillColor,
          opacity: 0.5,
          borderRadius: '50%',
        }}
      />
    );
  }

  indicator(shape: IThinCircleShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

export const customShapeUtils = [ThinRectangleShapeUtil, ThinCircleShapeUtil];
