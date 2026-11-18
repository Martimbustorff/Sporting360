import React from 'react';
import { View } from 'react-native';

const make = (name: string) => {
  const C = (props: Record<string, unknown>) => React.createElement(View, { testID: `svg-${name}`, ...props });
  C.displayName = name;
  return C;
};
const Svg = make('Svg');
export default Svg;
export const Circle = make('Circle');
export const Path = make('Path');
export const Rect = make('Rect');
export const G = make('G');
export const Line = make('Line');
export const Defs = make('Defs');
export const LinearGradient = make('LinearGradient');
export const Stop = make('Stop');
export const Text = make('Text');
