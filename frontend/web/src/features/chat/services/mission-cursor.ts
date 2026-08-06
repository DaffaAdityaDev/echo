const CURSOR_PREFIX = "echo:mission-cursor:";

export function getMissionCursor(missionId: string): string | null {
  try {
    return localStorage.getItem(`${CURSOR_PREFIX}${missionId}`);
  } catch {
    return null;
  }
}

export function setMissionCursor(missionId: string, sid: string): void {
  try {
    localStorage.setItem(`${CURSOR_PREFIX}${missionId}`, sid);
  } catch {
    // storage unavailable — replay cursor is best-effort
  }
}

export function clearMissionCursor(missionId: string): void {
  try {
    localStorage.removeItem(`${CURSOR_PREFIX}${missionId}`);
  } catch {
    // storage unavailable
  }
}
