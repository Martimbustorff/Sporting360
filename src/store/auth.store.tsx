import { Appearance } from "react-native";
import {  createJSONStorage, persist, StateStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "./persist.store";
import { create } from 'zustand'

export interface IUser {
  name: string,
  email: string,
  uuid:string,
  partnerNumber: string,
  gameboxNumber:string,
  gameboxPort:string,
  gameboxName:string,
  gameboxSector:string,
  gameboxLine:string,
  gameboxSeat:string,

}
interface AuthState {
  login: (user: IUser) => void
  logout: () => void
  user:IUser
}


export const useAuthStore = create<
  AuthState,
  [["zustand/persist", AuthState]]
>(
  persist(
    (set, get) => ({
       user: null,
       login: (user) => set((state) => ({ user: user })),
       logout:() => set((state) => ({ user: null }))
    }),
    {
      name: "app-persist-storage",
      storage: createJSONStorage(() => zustandMMKVStorage)
    },
  ),
);