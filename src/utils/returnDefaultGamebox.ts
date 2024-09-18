import { Gamebox } from "../interfaces/Gamebox"
import { IUser } from "../store/auth.store"

export const defaultGamebox = (user:IUser) => {
  try {
    const defaultGameBox:Gamebox = {
      gameboxNumber:user.gameboxNumber,
      gameboxPort:user.gameboxPort,
      gameboxName:user.gameboxName ? user.gameboxName  : "Principal",
      default:true,
      id:"",
      order:1,
      gameboxSector:user.gameboxSector,
      gameboxLine:user.gameboxLine,
      gameboxSeat:user.gameboxSeat,
    }
    return defaultGameBox
  } catch (error) {
    return null
  }
  
}