// Global navigation param list. The app navigates by route name with loosely
// typed params; declaring the global RootParamList lets `useNavigation()` and
// `navigation.navigate(...)` type-check without enumerating every screen.
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [routeName: string]: any;
    }
  }
}

export {};
