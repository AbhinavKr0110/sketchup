import {redisClient} from './redis.js';

export interface Player {
    socketId: string;
    username: string;
    score: number;
    hasGuessed: boolean;
    isHost: boolean;
}

export interface GameRoom {
    roomId: string;
    phase: 'LOBBY' | 'CHOOSING' | 'DRAWING' | 'LEADERBOARD';
    players: Player[];
    currentWord: string;
    timer: number;
    currentRound: number;
    totalRounds: number;
    currentArtistIndex: number;
}

const ROOM_TTL = 3600;

export const roomStore = {
    get: async (roomId: string): Promise<GameRoom | null> => {
        const data = await redisClient.get(`room:${roomId}`);
        if (!data) return null;
        return JSON.parse(data); 
    },


    set: async (roomId: string, roomState: GameRoom): Promise<void> => {
        await redisClient.set(`room:${roomId}`, JSON.stringify(roomState), {
        EX: ROOM_TTL 
        });
    },

    update: async (roomId: string, updateFn: (room: GameRoom) => GameRoom): Promise<GameRoom | null> => {
        const current = await roomStore.get(roomId);
        if (!current) return null;
        
        const updated = updateFn(current);
        await roomStore.set(roomId, updated);
        return updated;
    }
};
