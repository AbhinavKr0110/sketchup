import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectRedis, pubClient, subClient } from './redis.js';
import { roomStore, type GameRoom, type Player} from './roomStore.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173", 
            "https://sketchup-frontend.vercel.app/"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

const WORD_BANK = ["APPLE", "BANANA", "ORANGE", "GRAPES", "CHERRY", "LEMON", "PEAR", "PEACH", "PLUM", "MANGO", "PINEAPPLE", "COCONUT", "KIWI", "MELON", "PAPAYA", "LIME", "AVOCADO", "FIG", "DATE", "APRICOT", "DOG", "CAT", "FISH", "BIRD", "HORSE", "LION", "TIGER", "ELEPHANT", "MONKEY", "RABBIT", "BEAR", "WOLF", "FOX", "DEER", "CAMEL", "SHEEP", "GOAT", "COW", "PIG", "CHICKEN", "DUCK", "TURTLE", "SNAKE", "FROG", "WHALE", "SHARK", "DOLPHIN", "OCTOPUS", "CRAB", "SPIDER", "HOUSE", "CASTLE", "TOWER", "BRIDGE", "SCHOOL", "HOSPITAL", "TEMPLE", "CHURCH", "GARAGE", "CABIN", "HUT", "PALACE", "HOTEL", "LIBRARY", "MUSEUM", "FACTORY", "FARM", "LIGHTHOUSE", "AIRPORT", "STADIUM", "CAR", "BUS", "TRAIN", "TRUCK", "VAN", "TAXI", "BICYCLE", "SCOOTER", "MOTORCYCLE", "BOAT", "SHIP", "SUBMARINE", "HELICOPTER", "AIRPLANE", "ROCKET", "TRACTOR", "AMBULANCE", "POLICECAR", "FIRETRUCK", "TREE", "FLOWER", "GRASS", "BUSH", "LEAF", "RIVER", "OCEAN", "BEACH", "MOUNTAIN", "HILL", "VOLCANO", "DESERT", "FOREST", "CLOUD", "RAIN", "SNOW", "SUN", "MOON", "STAR", "RAINBOW", "CHAIR", "TABLE", "BED", "SOFA", "COUCH", "LAMP", "CLOCK", "MIRROR", "WINDOW", "DOOR", "PILLOW", "BLANKET", "SHELF", "DRAWER", "CARPET", "DESK", "STOOL", "FAN", "FRIDGE", "OVEN", "BOOK", "PENCIL", "PEN", "ERASER", "RULER", "MARKER", "CRAYON", "NOTEBOOK", "SCISSORS", "GLUE", "BACKPACK", "COMPUTER", "LAPTOP", "KEYBOARD", "MOUSE", "CAMERA", "PHONE", "TABLET", "PRINTER", "MONITOR", "PIZZA", "BURGER", "DONUT", "COOKIE", "CAKE", "MUFFIN", "PANCAKE", "WAFFLE", "SANDWICH", "TACO", "BURRITO", "HOTDOG", "FRIES", "NOODLES", "PASTA", "RICE", "BREAD", "CHEESE", "EGG", "SAUSAGE", "BALL", "FOOTBALL", "BASKETBALL", "BASEBALL", "TENNIS", "TROPHY", "MEDAL", "KITE", "BALLOON", "CROWN", "HELMET", "GLOVE", "BAT", "RACKET", "SKATEBOARD", "SURFBOARD", "DUMBBELL", "WHISTLE", "FLAG", "HEART", "STARFISH", "BOTTLE", "CUP", "MUG", "PLATE", "SPOON", "FORK", "KNIFE", "CANDLE", "TOOTHBRUSH", "TOOTHPASTE", "SOAP", "SHAMPOO", "COMB", "BRUSH", "KEY", "LOCK", "UMBRELLA", "GLASSES", "WATCH", "RING", "NECKLACE", "GUITAR", "PIANO", "DRUM", "VIOLIN", "TRUMPET", "MICROPHONE", "SPEAKER", "HEADPHONES", "RADIO", "TV", "ROBOT", "ALIEN", "GHOST", "MONSTER", "DRAGON", "DINOSAUR", "UNICORN", "MERMAID", "FAIRY", "WIZARD", "PIRATE", "KNIGHT", "NINJA", "CLOWN", "ASTRONAUT", "CHEF", "DOCTOR", "POLICE", "FIREFIGHTER", "BAKER", "PAINTER", "TEACHER", "FARMER", "JUDGE", "KING", "QUEEN", "PRINCE", "PRINCESS", "BABY", "CHILD", "TEAPOT", "KETTLE", "BUCKET", "BROOM", "MOP", "SHOVEL", "HAMMER", "WRENCH", "SCREWDRIVER", "NAIL", "BOLT", "LADDER", "ROPE", "CHAIN", "MAGNET", "ANCHOR", "COMPASS", "MAP", "GLOBE", "CANNON", "ARROW", "TARGET", "DICE", "CHESS", "DOMINO", "PUZZLE", "TEDDY", "DOLL", "YOYO", "MARBLE", "BUBBLE", "CUBE", "PYRAMID", "CIRCLE", "TRIANGLE", "SQUARE", "RECTANGLE", "OVAL", "DIAMOND", "SPIRAL", "CRESCENT", "LIGHTNING", "FLAME", "SMOKE", "ICEBERG", "WATERFALL", "CAVE", "ISLAND", "VALLEY", "SWAMP", "JUNGLE", "CLIFF", "PATH", "ROAD", "TUNNEL", "FENCE", "GATE", "MAILBOX", "BENCH", "FOUNTAIN", "STATUE", "WINDMILL", "SKYSCRAPER", "TENT", "CAMPFIRE", "CAMPER", "BARN", "SILO", "GREENHOUSE", "POND", "LAKE", "STREAM", "CANOE", "KAYAK", "SAILBOAT", "YACHT", "JET", "SATELLITE", "UFO", "METEOR", "COMET", "PLANET", "GALAXY", "TELESCOPE", "BINOCULARS", "FLASHLIGHT", "BATTERY", "PLUG", "SOCKET", "BULB", "REMOTE", "JOYSTICK", "GAMEPAD", "KEYCHAIN", "WALLET", "PURSE", "SUITCASE", "BRIEFCASE", "ENVELOPE", "LETTER", "STAMP", "NEWSPAPER", "MAGAZINE", "CALENDAR", "PASSPORT", "TICKET", "RECEIPT", "COIN", "MONEY", "SAFE", "TREASURE", "CHEST", "GEM", "CRYSTAL", "PEARL", "ACORN", "MUSHROOM", "CACTUS", "BAMBOO", "VINE", "SEED", "NEST", "EGGSHELL", "FEATHER", "HONEY", "BEEHIVE", "BUTTERFLY", "LADYBUG", "DRAGONFLY", "BEETLE", "ANT", "MOSQUITO", "GRASSHOPPER", "SNAIL", "WORM", "SQUID", "SEAHORSE", "JELLYFISH", "PENGUIN", "KOALA", "KANGAROO", "ZEBRA", "GIRAFFE", "HIPPO", "RHINO", "BISON", "SQUIRREL", "HEDGEHOG", "RACCOON", "OTTER", "MOOSE", "OWL", "PARROT", "PEACOCK", "FLAMINGO", "EAGLE", "HAWK", "SWAN", "SEAGULL", "ROOSTER", "TURKEY", "LOBSTER", "SHRIMP", "OYSTER", "CLAM", "CROSS", "CHECKMARK", "SMILEY", "MASK", "HOURGLASS", "SANDCASTLE", "SNOWMAN", "GIFT", "PRESENT", "RIBBON", "BOW", "CONFETTI", "FIREWORK", "PINWHEEL", "SPINNER", "TOP", "KETTLEBELL", "BARBELL", "BINOCULAR", "MEGAPHONE", "STOPWATCH", "THERMOMETER", "STETHOSCOPE", "SYRINGE", "BANDAGE", "PILL", "WHEELCHAIR", "CRUTCH", "TOASTER", "BLENDER", "MICROWAVE", "VACUUM", "WASHER", "DRYER", "IRON", "HANGER", "CLOSET", "CURTAIN"];

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
                            if (state.currentRound >= state.totalRounds) {
                                console.log(`🏆 Final round complete! Shunting directly to Final Standings.`);
                                state.phase = 'LEADERBOARD'; 
                                state.timer = 0;
                            } else {
                                state.phase = 'LEADERBOARD';
                                state.timer = 10;
                            }
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