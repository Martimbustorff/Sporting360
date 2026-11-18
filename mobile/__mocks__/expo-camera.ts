import React from 'react';
import { View } from 'react-native';

// Os testes disparam um scan através da prop capturada em `props.onBarcodeScanned`.
export const CameraView = jest.fn((props: Record<string, unknown>) =>
  React.createElement(View, { testID: 'camera-view', ...props }),
);
export const requestPermission = jest.fn(() => Promise.resolve({ granted: true }));
export const useCameraPermissions = jest.fn(() => [{ granted: true }, requestPermission]);
