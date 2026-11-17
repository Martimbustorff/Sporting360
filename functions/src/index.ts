import { initializeApp, getApps } from "firebase-admin/app";

if (getApps().length === 0) initializeApp();

export { submitPrediction } from "./callables/submitPrediction";
export { voteMvp } from "./callables/voteMvp";
