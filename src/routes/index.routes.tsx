import React from "react";
import { useAuthStore } from "../store/auth.store";
import { AppRoutes } from "./app.routes";
import { AuthRoutes } from "./auth.routes";

export default function Routes() {
  const user = useAuthStore((state) => state.user)
  
  // if(!user){
  //   return <AuthRoutes></AuthRoutes>
  // }
    return <AppRoutes></AppRoutes>
 
}
