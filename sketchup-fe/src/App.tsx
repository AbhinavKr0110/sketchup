import { useState, useEffect } from 'react';
import { socket } from './socket';

interface Player {
    socketId: string;
    username: string;
    score: number;
    hasGuessed: boolean;
    isHost: boolean;
}

interface GameRoom {
    roomId: string;
    phase: 'LOBBY' | 'CHOOSING' | 'DRAWING' | 'LEADERBOARD';
    players: Player[];
    currentWord: string;
    timer: number;
    currentRound: number;
    totalRounds: number;
    currentArtistIndex: number;
}

export default function App() {
    const [username, setUsername] = useState<string>('');
    const [roomIdInput, setRoomIdInput] = useState<string>('');
    const [roomState, setRoomState] = useState<GameRoom | null>(null);
    const [error, setError] = useState<string>('');
    const [wordOptions, setWordOptions] = useState<string[]>([]);
    const [globalTimer, setGlobalTimer] = useState<number>(0);
    const [roundsSelection, setRoundsSelection] = useState<number>(3);

    useEffect(() => {
        socket.on('room:state', (data: GameRoom) => {
            setRoomState(data);
            setGlobalTimer(data.timer);
            setError('');
            if (data.phase !== 'CHOOSING') {
                setWordOptions([]);
            }
        });

        socket.on('game:timer', (timeRemaining: number) => {
            setGlobalTimer(timeRemaining);
        });

        socket.on('game:word_options', (options: string[]) => {
            setWordOptions(options);
        });

        socket.on('error:msg', (message: string) => {
            setError(message);
        });

        return () => {
            socket.off('room:state');
            socket.off('game:timer');
            socket.off('game:word_options');
            socket.off('error:msg');
        };
    }, []);

    const handleCreateRoom = () => {
        if (!username.trim()) return setError('Please enter a username first!');
        socket.connect();
        socket.emit('room:create', { username, totalRounds: roundsSelection });
    };

    const handleJoinRoom = () => {
        if (!username.trim()) return setError('Please enter a username!');
        if (!roomIdInput.trim()) return setError('Please enter a Room Code!');
        socket.connect();
        socket.emit('room:join', { roomId: roomIdInput, username });
    };

    const handleStartGame = () => {
        if (roomState) {
            socket.emit('game:start', { roomId: roomState.roomId });
        }
    };

    const handleSelectWord = (word: string) => {
        if (roomState) {
            socket.emit('game:word_select', { roomId: roomState.roomId, word });
        }
    };

    const handleLeaveGame = () => {
        socket.disconnect();
        setRoomState(null);
        setWordOptions([]);
        setError('');
    };

    const localPlayer = roomState?.players.find(p => p.socketId === socket.id);
    const isLocalArtist = roomState ? roomState.players[roomState.currentArtistIndex]?.socketId === socket.id : false;

    if (!roomState) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100 font-sans">
                <div className="bg-white p-10 rounded-2xl shadow-xl w-96 text-center">
                    <h1 className="text-indigo-600 text-4xl font-black tracking-tight mb-2">SketchUp! 🎨</h1>
                    <p className="text-slate-400 text-sm mb-8">Real-Time Multiplayer Drawing Arena</p>
                    
                    {error && <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm mb-4 font-semibold">{error}</div>}

                    <input 
                        type="text" 
                        placeholder="Type Your Nickname..." 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full p-3 rounded-lg border-2 border-slate-200 text-base mb-4 focus:border-indigo-500 outline-none transition"
                    />

                    <div className="flex items-center justify-between mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <label 
                            htmlFor="match-length-selector" 
                            className="text-xs font-bold text-slate-500 uppercase tracking-wide"
                        >
                            Match Length:
                        </label>
                        <select 
                            id="match-length-selector"
                            value={roundsSelection} 
                            onChange={(e) => setRoundsSelection(parseInt(e.target.value, 10))}
                            className="bg-white px-3 py-1.5 rounded-lg text-sm font-bold text-indigo-600 border border-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
                        >
                            <option value={3}>3 Rounds (Short)</option>
                            <option value={5}>5 Rounds (Medium)</option>
                            <option value={8}>8 Rounds (Long)</option>
                        </select>
                    </div>
                    
                    <button onClick={handleCreateRoom} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-3.5 rounded-lg text-base transition duration-200 mb-4 shadow-md shadow-indigo-100 cursor-pointer">
                        Create Private Room
                    </button>

                    <div className="flex items-center text-slate-400 my-4">
                        <div className="flex-1 h-px bg-slate-200"></div>
                        <span className="px-3 text-xs font-bold tracking-wider">OR JOIN ARENA</span>
                        <div className="flex-1 h-px bg-slate-200"></div>
                    </div>

                    <input 
                        type="text" 
                        placeholder="4-LETTER CODE" 
                        value={roomIdInput} 
                        onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                        maxLength={4}
                        className="w-full p-3 rounded-lg border-2 border-slate-200 text-center text-xl font-black tracking-widest mb-4 uppercase focus:border-emerald-500 outline-none transition"
                    />
                    
                    <button onClick={handleJoinRoom} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold p-3.5 rounded-lg text-base transition duration-200 shadow-md shadow-emerald-100 cursor-pointer">
                        Join Room Code 🚀
                    </button>
                </div>
            </div>
        );
    }

    const isGameFinished = roomState.phase === 'LOBBY' && roomState.currentRound === 0 && roomState.players.some(p => p.score > 0);
    if (isGameFinished) {
        const sortedWinners = [...roomState.players].sort((a, b) => b.score - a.score);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100 font-sans">
                <div className="bg-white p-10 rounded-2xl shadow-xl w-[450px] text-center">
                    <h1 className="text-5xl mb-2">👑</h1>
                    <h2 className="text-indigo-600 text-2xl font-black mb-6">Final Leaderboard Standings</h2>
                    
                    <div className="bg-slate-50 rounded-xl p-5 mb-8 text-left border border-slate-100">
                        {sortedWinners.map((p, index) => (
                            <div key={p.socketId} className={`flex justify-between p-3 rounded-lg mb-2 ${index === 0 ? 'bg-amber-50 border border-amber-200 font-bold text-amber-800' : 'text-slate-700'}`}>
                                <span className="flex items-center gap-2">
                                    <span>#{index + 1}</span>
                                    <span>{p.username}</span>
                                    {index === 0 && '🏆'}
                                </span>
                                <span>{p.score} pts</span>
                            </div>
                        ))}
                    </div>

                    <button onClick={handleLeaveGame} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold p-3.5 rounded-lg text-base transition shadow-md shadow-red-100 cursor-pointer">
                        Exit to Main Menu
                    </button>
                </div>
            </div>
        );
    }

    if (roomState.phase === 'LOBBY') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100 font-sans">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-[500px]">
                    <div className="flex justify-between items-center border-b-2 border-slate-50 pb-4 mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Room Lobby: <span className="text-indigo-600 tracking-wider">{roomState.roomId}</span></h2>
                        <span className="px-3 py-1 bg-indigo-50 rounded-full text-xs font-bold text-indigo-600 border border-indigo-100">
                            ⚙️ {roomState.totalRounds} Rounds Match
                        </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Connected Players ({roomState.players.length})</h4>
                    <div className="flex flex-col gap-2.5 mb-8 max-h-64 overflow-y-auto pr-1">
                        {roomState.players.map(p => (
                            <div key={p.socketId} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="font-semibold text-slate-800 flex items-center gap-2">
                                    {p.username} 
                                    {p.isHost && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-bold">👑 Host</span>}
                                </span>
                                <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">Joined</span>
                            </div>
                        ))}
                    </div>

                    {localPlayer?.isHost ? (
                        <button onClick={handleStartGame} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black p-4 rounded-lg text-base transition shadow-md shadow-emerald-100 tracking-wide cursor-pointer">
                            Launch Engine 🚀
                        </button>
                    ) : (
                        <div className="text-center text-slate-400 text-sm italic font-medium py-2">
                            👋 Waiting for host to launch match...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 h-screen font-sans flex flex-col overflow-hidden select-none">

            <header className="bg-white px-8 py-4 flex justify-between items-center shadow-sm border-b border-slate-200 z-20">
                <div className="text-base font-bold text-slate-700">
                    Room: <span className="text-indigo-600 font-black">{roomState.roomId}</span>
                </div>

                <div className="text-2xl font-black tracking-[0.3em] text-slate-800 uppercase">
                    {roomState.phase === 'DRAWING' ? (
                        isLocalArtist ? `🎨 Word: ${roomState.currentWord}` : `🔤 ${roomState.currentWord.replace(/[a-zA-Z]/g, '_ ')}`
                    ) : (
                        <span className="text-indigo-600 tracking-wider">PREPARING ROUND</span>
                    )}
                </div>

                <div className="flex items-center gap-4 text-sm font-black">
                    <div className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full border border-amber-200">
                        Round {roomState.currentRound}/{roomState.totalRounds}
                    </div>
                    <div className="bg-red-100 text-red-600 px-4 py-1.5 rounded-full border border-red-200 min-w-[75px] text-center">
                        ⏱️ {globalTimer}s
                    </div>
                </div>
            </header>

            <div className="flex flex-1 p-5 gap-5 box-border overflow-hidden h-[calc(100vh-73px)]">

                <div className="w-64 bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2 overflow-y-auto">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">Players</h3>
                    {roomState.players.map((p, idx) => {
                        const isArtist = roomState.currentArtistIndex === idx;
                        return (
                            <div key={p.socketId} className={`flex justify-between items-center p-3 rounded-lg border text-sm transition-all duration-150 ${p.hasGuessed ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold' : isArtist ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' : 'bg-white border-slate-200 text-slate-700'}`}>
                                <span className="flex items-center gap-1.5 truncate">
                                    {p.username}
                                    {isArtist && <span>🖌️</span>}
                                    {p.hasGuessed && <span className="text-xs">✅</span>}
                                </span>
                                <span className="font-bold text-xs shrink-0">{p.score} pt</span>
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden">
                    
                    {roomState.phase === 'CHOOSING' && (
                        <div className="absolute inset-0 bg-slate-900/95 z-30 flex flex-col items-center justify-center text-white backdrop-blur-xs">
                            {isLocalArtist ? (
                                <div className="text-center">
                                    <h2 className="text-xl font-extrabold mb-6 text-amber-400 tracking-wide uppercase">Select a Secret Word to Draw!</h2>
                                    <div className="flex gap-4">
                                        {wordOptions.map(word => (
                                            <button key={word} onClick={() => handleSelectWord(word)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl text-lg tracking-wide shadow-lg transition duration-150 transform hover:-translate-y-0.5 cursor-pointer">
                                                {word}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="w-10 h-10 border-4 border-white border-t-indigo-500 rounded-full animate-spin mb-4 mx-auto"></div>
                                    <h3 className="text-slate-300 font-semibold tracking-wide">Artist is currently picking a puzzle word...</h3>
                                </div>
                            )}
                        </div>
                    )}

                    {roomState.phase === 'LEADERBOARD' && (
                        <div className="absolute inset-0 bg-slate-50/95 z-30 flex flex-col items-center justify-center">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Round Complete!</h3>
                            <h1 className="text-3xl font-black text-slate-800 mb-8">
                                The word was: <span className="text-emerald-500 border-b-4 border-emerald-200 pb-1">{roomState.currentWord}</span>
                            </h1>
                            <div className="w-80 bg-white p-5 rounded-xl shadow-md border border-slate-200">
                                <h4 className="text-xs font-black text-slate-400 uppercase border-b border-slate-100 pb-2 mb-2">Round Summary</h4>
                                {roomState.players.map(p => (
                                    <div key={p.socketId} className="flex justify-between py-1.5 text-sm font-medium text-slate-700">
                                        <span>{p.username}</span>
                                        <strong className="text-slate-900">{p.score} pts</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center bg-slate-50 relative">
                        <div className="border border-slate-200 rounded-xl w-[92%] h-[90%] flex items-center justify-center text-slate-400 font-bold bg-white shadow-inner">
                            [ Canvas Sandbox Mount Point ]
                        </div>
                    </div>

                    {roomState.phase === 'DRAWING' && isLocalArtist && (
                        <div className="h-16 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-6 z-20">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-indigo-100 text-indigo-700 font-black px-2.5 py-1 rounded-md uppercase tracking-wider">🖌️ Drawer Mode Active</span>
                            </div>
                            <button className="bg-red-500 hover:bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-sm cursor-pointer">
                                Wipe Board
                            </button>
                        </div>
                    )}
                </div>

                <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2 bg-white">
                        <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">
                            📢 SYSTEM: Connected to room socket pool. Start guessing!
                        </div>
                    </div>

                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder={isLocalArtist ? "You are drawing! Typing blocked." : "Type your guess here..."}
                                disabled={isLocalArtist}
                                className="flex-1 p-2.5 rounded-lg border border-slate-200 text-sm outline-none transition focus:border-indigo-500 disabled:bg-slate-200 disabled:text-slate-400"
                            />
                            <button disabled={isLocalArtist} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm px-4 rounded-lg transition shadow-sm cursor-pointer">
                                Send
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}