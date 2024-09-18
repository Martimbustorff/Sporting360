import create from "zustand";
import { persist, StateStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";

export const appPersistStorage = new MMKV({ id: "app-persist-storage" });

export const zustandMMKVStorage: StateStorage = {
  setItem: (name, value) => {
    return appPersistStorage.set(name, value);
  },
  getItem: (name) => {
    const value = appPersistStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name) => {
    return appPersistStorage.delete(name);
  },
};