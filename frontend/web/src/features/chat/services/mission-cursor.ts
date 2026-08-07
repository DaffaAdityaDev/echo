import { getStorage, removeStorage, setStorage } from "@/utils/storage";

const CURSOR_PREFIX = "echo:mission-cursor:";

export function getMissionCursor(missionId: string): string | null {
  return getStorage(`${CURSOR_PREFIX}${missionId}`);
}

export function setMissionCursor(missionId: string, sid: string): void {
  setStorage(`${CURSOR_PREFIX}${missionId}`, sid);
}

export function clearMissionCursor(missionId: string): void {
  removeStorage(`${CURSOR_PREFIX}${missionId}`);
}
