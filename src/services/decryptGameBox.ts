import CryptoJS from "react-native-crypto-js";
import { GAMEBOX_PASSPHRASE_PREFIX } from '../constants/config';

export const decryptGameBox = (gamebox:string,uuid:string) => {
  if(!gamebox){
    return ""
  }
const passphrase = GAMEBOX_PASSPHRASE_PREFIX+uuid;
return CryptoJS.AES.decrypt(gamebox, passphrase).toString(CryptoJS.enc.Utf8).replace(uuid+"_","");
}