import React from 'react';
import { View } from 'react-native';

export const WebView = jest.fn((props: Record<string, unknown>) =>
  React.createElement(View, { testID: 'webview', ...props }),
);
export default WebView;
