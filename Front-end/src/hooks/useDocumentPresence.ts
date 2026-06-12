import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { getStoredUser } from '../api';
import { PresenceSnapshot, PresenceUser } from '../types/presence';

export const useDocumentPresence = () => {
  const [presenceMap, setPresenceMap] = useState<PresenceSnapshot>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;

    const socket: Socket = io(SOCKET_URL, {
      auth: { token: user.token },
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('subscribe-presence');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('presence-snapshot', (snapshot: PresenceSnapshot) => {
      setPresenceMap(snapshot || {});
    });

    socket.on('presence-update', (payload: { documentId: string; users: PresenceUser[] }) => {
      setPresenceMap(prev => ({
        ...prev,
        [payload.documentId]: payload.users,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getDocumentPresence = (documentId: string) => presenceMap[documentId] || [];

  return { presenceMap, getDocumentPresence, isConnected };
};
