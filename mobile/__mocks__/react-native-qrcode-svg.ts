import React from 'react';
import { View } from 'react-native';

const QRCode = jest.fn((props: { value?: string; size?: number }) =>
  React.createElement(View, { testID: 'qrcode', value: props.value, size: props.size } as object),
);
export default QRCode;
