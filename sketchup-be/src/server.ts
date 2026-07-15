import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectRedis, pubClient, subClient } from './redis.js';
import { roomStore, type GameRoom, type Player} from './roomStore.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST']}
});

const WORD_BANK = ["APPLE", "BANANA", "ORANGE", "GRAPES", "CHERRY", "LEMON", "CARROT", "POTATO", "ONION", "PEPPER", "DOG", "CAT", "FISH", "BIRD", "HORSE", "LION", "TIGER", "MONKEY", "RABBIT", "ELEPHANT", "HOUSE", "CASTLE", "TOWER", "BRIDGE", "SCHOOL", "CHURCH", "TEMPLE", "GARAGE", "CABIN", "HUT", "CAR", "BUS", "TRAIN", "TRUCK", "BICYCLE", "BOAT", "ROCKET", "TRACTOR", "SUBMARINE", "HELICOPTER", "TREE", "FLOWER", "MOUNTAIN", "RIVER", "OCEAN", "DESERT", "FOREST", "VOLCANO", "RAINBOW", "CLOUD", "CHAIR", "TABLE", "BED", "LAMP", "SOFA", "CLOCK", "MIRROR", "WINDOW", "DOOR", "PILLOW", "BOOK", "PENCIL", "PEN", "ERASER", "SCISSORS", "BACKPACK", "COMPUTER", "KEYBOARD", "MOUSE", "CAMERA", "PIZZA", "BURGER", "DONUT", "COOKIE", "SANDWICH", "NOODLES", "SAUSAGE", "PANCAKE", "WAFFLE", "POPCORN", "BALL", "FOOTBALL", "BASKETBALL", "TROPHY", "KITE", "BALLOON", "CROWN", "ROBOT", "GUITAR", "UMBRELLA", "HEART", "BOTTLE", "CANDLE", "TOOTHBRUSH", "KEY", "GLASSES", "RING", "WATCH", "MAGNET", "ANCHOR"];

const getRandomWordOptions = (): string[] => {
    const shuffled = [...WORD_BANK].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
};

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
                        if (!currentState.currentWord) {
                            const fallbackPool = getRandomWordOptions();
                            currentState.currentWord = fallbackPool[0] ?? 'APPLE';
                            console.log(`Room ${roomId}: Artist failed to pick a word. Auto-assigned: ${currentState.currentWord}`);
                        }
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

                    // ⚡ THE FIX: If the clock pushed us into a CHOOSING phase, feed the new artist!
                    if (transitionState.phase === 'CHOOSING') {
                        const freshWordPool = getRandomWordOptions();
                        const activeArtist = transitionState.players[transitionState.currentArtistIndex];
                        if (activeArtist) {
                            console.log(`📡 Sending new round words to artist: ${activeArtist.username}`);
                            io.to(activeArtist.socketId).emit('game:word_options', freshWordPool);
                        }
                    }

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
        
        socket.on('room:create', async(data:{username:string, totalRounds?:number})=>{
            const roomId = Math.random().toString(36).substring(2,6).toUpperCase();
            const configuredRounds = data.totalRounds??3;
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
                totalRounds:configuredRounds,
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

        socket.on('game:start', async (data: { roomId: string }) => {
            const targetRoomId = data.roomId.toUpperCase();
            const room = await roomStore.get(targetRoomId);
            if (!room) {
                socket.emit('error:msg', 'Room not found.');
                return;
            }
            const caller = room.players.find(p => p.socketId === socket.id);
            if (!caller || !caller.isHost) {
                socket.emit('error:msg', 'Only the room host can start the game!');
                return;
            }
            await roomStore.update(targetRoomId, (currentState) => {
                currentState.phase = 'CHOOSING';
                currentState.timer = 15;        
                currentState.currentRound = 1;
                return currentState;
            });

            const updatedRoom = await roomStore.get(targetRoomId);
            if (updatedRoom) {
                io.to(targetRoomId).emit('room:state', updatedRoom);
                const wordOptions = getRandomWordOptions();
                const artistPlayer = updatedRoom.players[updatedRoom.currentArtistIndex];
                if (artistPlayer) {
                    io.to(artistPlayer.socketId).emit('game:word_options', wordOptions);
                }
                startRoomTimer(targetRoomId);
            }
        });

        socket.on('game:word_select', async (data: { roomId: string; word: string }) => {
            const targetRoomId = data.roomId.toUpperCase();
            const room = await roomStore.get(targetRoomId);
            if (!room) return;
            const currentArtist = room.players[room.currentArtistIndex];
            if (!currentArtist || currentArtist.socketId !== socket.id) {
                socket.emit('error:msg', 'It is not your turn to pick a word!');
                return;
            }
            await roomStore.update(targetRoomId, (currentState) => {
                currentState.phase = 'DRAWING';
                currentState.currentWord = data.word.toUpperCase();
                currentState.timer = 60;
                return currentState;
            });
            const freshRoomState = await roomStore.get(targetRoomId);
            if (freshRoomState) {
                io.to(targetRoomId).emit('room:state', freshRoomState);
            }
        });

        socket.on('message:send', async (data: { roomId: string; message: string }) => {
            const targetRoomId = data.roomId.toUpperCase();
            const cleanInput = data.message.trim().toUpperCase();
            if (!cleanInput) return;

            const room = await roomStore.get(targetRoomId);
            if (!room || room.phase !== 'DRAWING') return;

            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex === -1) return;

            const sender = room.players[playerIndex];
            if (!sender) return;

            if (room.currentArtistIndex === playerIndex) return;
            if (sender.hasGuessed) return;

            const secretWord = room.currentWord.trim().toUpperCase();
            const isCorrect = cleanInput === secretWord;

            if (isCorrect) {
                const currentRemainingTime = room.timer; 
                const pointsEarned = 50 + (currentRemainingTime * 4);

                await roomStore.update(targetRoomId, (currentState) => {
                    const matchPlayer = currentState.players[playerIndex];
                    if (matchPlayer) {
                        matchPlayer.score += pointsEarned;
                        matchPlayer.hasGuessed = true;
                    }

                    const artistMatch = currentState.players[currentState.currentArtistIndex];
                    if (artistMatch) {
                        artistMatch.score += 25;
                    }
                    return currentState;
                });

                io.to(targetRoomId).emit('message:received', {
                    username: 'SYSTEM',
                    message: `🎉 ${sender.username} guessed the secret word in ${60 - currentRemainingTime}s! (+${pointsEarned} pts)`,
                    isSystem: true
                });

                const freshRoomState = await roomStore.get(targetRoomId);
                if (freshRoomState) {
                    io.to(targetRoomId).emit('room:state', freshRoomState);
                    
                    const totalGuessers = freshRoomState.players.length - 1;
                    const successfulGuessers = freshRoomState.players.filter(p => p.hasGuessed).length;

                    if (successfulGuessers >= totalGuessers && totalGuessers > 0) {
                        console.log(`⚡ Room ${targetRoomId}: All guessers finished early. Shunting clock.`);
                        await roomStore.update(targetRoomId, (state) => {
                            state.phase = 'LEADERBOARD';
                            state.timer = 10;
                            return state;
                        });
                        
                        const endgameRoomState = await roomStore.get(targetRoomId);
                        if (endgameRoomState) {
                            io.to(targetRoomId).emit('room:state', endgameRoomState);
                        }
                    }
                }
            } else {
                io.to(targetRoomId).emit('message:received', {
                    username: sender.username,
                    message: data.message,
                    isSystem: false
                });
            }
        });

        socket.on('canvas:draw', (data: { roomId: string; x: number; y: number; prevX: number; prevY: number; color: string; size: number }) => {
            socket.to(data.roomId.toUpperCase()).emit('canvas:draw_client', data);
        });

        socket.on('canvas:clear', (data: { roomId: string }) => {
            socket.to(data.roomId.toUpperCase()).emit('canvas:clear_client');
        });

        socket.on('disconnect', async () => {
            console.log(`🔌 Client Disconnected from pool: ${socket.id}`);

            const activeRooms = Array.from(io.sockets.adapter.rooms.keys());

            for (const roomId of activeRooms) {
                const room = await roomStore.get(roomId);
                if (!room) continue;

                const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
                if (playerIndex === -1) continue;

                console.log(`👤 Scrubbing user "${room.players[playerIndex]?.username}" from room: ${roomId}`);

                await roomStore.update(roomId, (currentState) => {
                    currentState.players = currentState.players.filter(p => p.socketId !== socket.id);
                    if (currentState.players.length === 0) {
                        currentState.phase = 'LOBBY';
                        return currentState;
                    }
                    if (room.players[playerIndex]?.isHost && currentState.players[0]) {
                        currentState.players[0].isHost = true;
                    }
                    if (currentState.phase === 'DRAWING' && currentState.currentArtistIndex === playerIndex) {
                        console.log(`🎨 The active artist disconnected! Shunting room ${roomId} to Leaderboard.`);
                        currentState.phase = 'LEADERBOARD';
                        currentState.timer = 5; 
                    } 
                    else if (currentState.currentArtistIndex > playerIndex) {
                        currentState.currentArtistIndex -= 1;
                    }

                    return currentState;
                });
                const updatedRoom = await roomStore.get(roomId);
                if (updatedRoom) {
                    io.to(roomId).emit('room:state', updatedRoom);
                }
            }
        });
    });

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`SketchUp Engine live on http://localhost:${PORT}`);
    });
};

startServer();