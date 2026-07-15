import { io, Socket } from 'socket.io-client';

const SOCKET_SERVER_URL = 'https://sketchup-backend-ukat.onrender.com';

export const socket: Socket = io(SOCKET_SERVER_URL, {
    autoConnect: false,
    transports: ['websocket']
});