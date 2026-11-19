import React from 'react';
import { View } from 'react-native';

const QRCode = jest.fn((props: { value?: string; size?: number; ecl?: string; quietZone?: number }) =>
  React.createElement(View, { testID: 'qrcode', value: props.value, size: props.size, ecl: props.ecl, quietZone: props.quietZone } as object),
);
export default QRCode;
