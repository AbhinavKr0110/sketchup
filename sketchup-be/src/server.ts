import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectRedis, pubClient, subClient } from './redis.js';
import { roomStore, GameRoom, Player} from './roomStore.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST']}
});

const startServer = async (): Promise<void> => {

    await connectRedis();
    io.adapter(createAdapter(pubClient, subClient));

    const startRoomTimer = async (roomId: string) => {
        const timerInterval = setInterval(async () => {
            const room = await roomStore.get(roomId);
            if (!room) {
                clearInterval(timerInterval);
                return;
            }
            if (room.timer <= 1) {
                clearInterval(timerInterval); 

                await roomStore.update(roomId, (currentState) => {
                    if (currentState.phase === 'CHOOSING') {
                        currentState.phase = 'DRAWING';
                        currentState.timer = 60; 
                    } 
                    else if (currentState.phase === 'DRAWING') {
                        currentState.phase = 'LEADERBOARD';
                        currentState.timer = 10; 
                    } 
                    else if (currentState.phase === 'LEADERBOARD') {
                        if (currentState.currentArtistIndex < currentState.players.length - 1) {
                            currentState.currentArtistIndex += 1;
                            currentState.phase = 'CHOOSING';
                            currentState.timer = 15;
                            currentState.players = currentState.players.map(p => ({ ...p, hasGuessed: false }));
                        } 
                        else {
                            if (currentState.currentRound < currentState.totalRounds) {
                                currentState.currentRound += 1; 
                                currentState.currentArtistIndex = 0; 
                                currentState.phase = 'CHOOSING';
                                currentState.timer = 15;
                                currentState.players = currentState.players.map(p => ({ ...p, hasGuessed: false }));
                            } 
                            else {
                                currentState.phase = 'LOBBY';
                                currentState.timer = 0;
                                currentState.currentRound = 0;
                                currentState.currentArtistIndex = 0;
                            }
                        }
                    }
                    return currentState;
                });
                const transitionState = await roomStore.get(roomId);
                if (transitionState) {
                    io.to(roomId).emit('room:state', transitionState);
                    if (transitionState.phase !== 'LOBBY') {
                        startRoomTimer(roomId);
                    }
                }
            } 
            else {
                await roomStore.update(roomId, (currentState) => {
                    currentState.timer -= 1;
                    return currentState;
                });
                io.to(roomId).emit('game:timer', room.timer - 1);
            }
        }, 1000);
    };

    io.on('connection', (socket)=>{
        console.log(`A user connected via socket ID: ${socket.id}`);
        
        socket.on('room:create', async(data:{username:string})=>{
            const roomId = Math.random().toString(36).substring(2,6).toUpperCase();
            const newPlayer: Player = {
                socketId: socket.id,
                username: data.username,
                score: 0,
                hasGuessed: false,
                isHost: true
            };
            const newRoom: GameRoom = {
                roomId,
                phase: 'LOBBY',
                players: [newPlayer],
                currentWord: '',
                timer: 0,
                currentRound:0,
                totalRounds:3,
                currentArtistIndex:0
            }
            await roomStore.set(roomId,newRoom);
            await socket.join(roomId);
            socket.emit('room:state', newRoom);
            console.log(`Room ${roomId} successfully registered by Host: ${data.username}`);
        });

        socket.on('room:join', async(data:{roomId:string,username:string})=>{
            const targetRoomId = data.roomId.toUpperCase();
            const room = await roomStore.get(targetRoomId);
            if(!room){
                socket.emit('error:msg', 'Room not found!');
                return;
            }
            const newPlayer: Player = {
                socketId: socket.id,
                username: data.username,
                score: 0,
                hasGuessed: false,
                isHost: false
            };
            await roomStore.update(targetRoomId, (currentRoomState) => {
                currentRoomState.players.push(newPlayer);
                return currentRoomState;
            });
            await socket.join(targetRoomId);
            const updatedRoom = await roomStore.get(targetRoomId);
            if (updatedRoom) {
                io.to(targetRoomId).emit('room:state', updatedRoom);
                console.log(`Player ${data.username} successfully entered Room ${targetRoomId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`SketchUp Engine live on http://localhost:${PORT}`);
    });
};

startServer();