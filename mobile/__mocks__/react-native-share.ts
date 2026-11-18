const Share = {
  open: jest.fn(() => Promise.resolve({ success: true })),
  shareSingle: jest.fn(() => Promise.resolve({ success: true })),
};
export default Share;
