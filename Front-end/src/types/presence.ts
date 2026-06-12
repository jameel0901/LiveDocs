export interface PresenceUser {
  userId: string;
  userName: string;
  isTyping: boolean;
  isActive: boolean;
}

export type PresenceSnapshot = Record<string, PresenceUser[]>;
