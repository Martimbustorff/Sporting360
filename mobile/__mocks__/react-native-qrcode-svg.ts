import React from 'react';
import { View } from 'react-native';

const QRCode = jest.fn((props: { value?: string }) =>
  React.createElement(View, { testID: 'qrcode', value: props.value } as object),
);
export default QRCode;
