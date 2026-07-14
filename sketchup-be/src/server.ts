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

        socket.on('chat:message', async (data: { roomId: string; text: string }) => {
            const targetRoomId = data.roomId.toUpperCase();
            const room = await roomStore.get(targetRoomId);

            if (!room) return;

            const sender = room.players.find(p => p.socketId === socket.id);
            if (!sender) return;

            const cleanInput = data.text.trim().toUpperCase();
            const secretWord = room.currentWord.trim().toUpperCase();

            if (room.phase === 'DRAWING' && cleanInput === secretWord) {
                
                const artistPlayer = room.players[room.currentArtistIndex];
                if (artistPlayer && artistPlayer.socketId === socket.id) {
                    socket.emit('error:msg', 'You cannot guess your own word!');
                    return;
                }
                if (sender.hasGuessed) {
                    socket.emit('error:msg', 'You have already solved this round!');
                    return;
                }
                const correctGuessersCount = room.players.filter(p => p.hasGuessed).length;

                let pointsEarned = 100;
                if (correctGuessersCount === 0) pointsEarned = 300;
                else if (correctGuessersCount === 1) pointsEarned = 200;

                await roomStore.update(targetRoomId, (currentState) => {
                    const matchPlayer = currentState.players.find(p => p.socketId === socket.id);
                    if (matchPlayer) {
                        matchPlayer.score += pointsEarned;
                        matchPlayer.hasGuessed = true;
                    }
                    const artistMatch = currentState.players[currentState.currentArtistIndex];
                    if (artistMatch) {
                        artistMatch.score += 50;
                    }

                    return currentState;
                });
                const alertText = `🎉 ${sender.username} guessed the secret word! (+${pointsEarned} pts)`;
                io.to(targetRoomId).emit('chat:broadcast', {
                    username: 'SYSTEM',
                    text: alertText,
                    isSystemNotice: true
                });
                const freshRoomState = await roomStore.get(targetRoomId);
                if (freshRoomState) {
                    io.to(targetRoomId).emit('room:state', freshRoomState);
                    const totalPlayers = freshRoomState.players.length;
                    const totalGuessers = totalPlayers - 1;
                    const successfulGuessers = freshRoomState.players.filter(p => p.hasGuessed).length;

                    if (successfulGuessers >= totalGuessers && totalGuessers > 0) {
                        console.log(`⚡ Room ${targetRoomId}: All guessers finished early. Shunting clock to Leaderboard.`);
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
                io.to(targetRoomId).emit('chat:broadcast', {
                    username: sender.username,
                    text: data.text,
                    isSystemNotice: false
                });
            }
        });

        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.id}`);
            const activeRooms = Array.from(socket.rooms);
            for (const roomId of activeRooms) {
                if (roomId === socket.id) continue;

                const targetRoomId = roomId.toUpperCase();
                
                await roomStore.update(targetRoomId, (currentState) => {
                    currentState.players = currentState.players.filter(p => p.socketId !== socket.id);
                    return currentState;
                });
                const updatedRoom = await roomStore.get(targetRoomId);
                if (!updatedRoom) continue;
                if (updatedRoom.players.length === 0) {
                    console.log(`Room ${targetRoomId} is completely empty. Purging key structure from Redis.`);
                    continue;
                }
                const hostStillExists = updatedRoom.players.some(p => p.isHost);
                if (!hostStillExists && updatedRoom.players.length > 0) {
                    await roomStore.update(targetRoomId, (currentState) => {
                        if (currentState.players[0]) {
                            currentState.players[0].isHost = true;
                            console.log(`Host left Room ${targetRoomId}. Crown passed to: ${currentState.players[0].username}`);
                        }
                        return currentState;
                    });
                }
                const finalRoomState = await roomStore.get(targetRoomId);
                if (finalRoomState) {
                    io.to(targetRoomId).emit('room:state', finalRoomState);
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