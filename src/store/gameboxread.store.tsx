import { Appearance } from "react-native";
import {  createJSONStorage, persist, StateStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "./persist.store";
import { create } from 'zustand'

export interface IGameboxRead {
  gameboxNumber:string,
}
interface GameboxState {
  add: (user: IGameboxRead) => void
  gamebox:IGameboxRead
}


export const useGameboxRead = create<
GameboxState,
  [["zustand/persist", GameboxState]]
>(
  persist(
    (set, get) => ({
      gamebox: {
        gameboxNumber:""
      },
      add: (gamebox) => set((state) => ({ gamebox: gamebox })),
    }),
    {
      name: "app-persist-storage",
      storage: createJSONStorage(() => zustandMMKVStorage)
    },
  ),
);