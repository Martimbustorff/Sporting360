import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { settleDue } from "./scheduled/settle";

if (getApps().length === 0) initializeApp();

export { submitPrediction } from "./callables/submitPrediction";
export { voteMvp } from "./callables/voteMvp";
export { updateProfile } from "./callables/updateProfile";

export const settleScheduler = onSchedule(
  { schedule: "every 10 minutes", region: "europe-west1", timeZone: "Europe/Lisbon", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    await settleDue(getFirestore(), new Date());
  },
);
