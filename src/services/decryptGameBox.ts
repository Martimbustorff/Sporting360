import CryptoJS from "react-native-crypto-js";

export const decryptGameBox = (gamebox:string,uuid:string) => {
  if(!gamebox){
    return ""
  }
const passphrase = 'SCP3#$)=:JI)!F5860_'+uuid;
return CryptoJS.AES.decrypt(gamebox, passphrase).toString(CryptoJS.enc.Utf8).replace(uuid+"_","");
}