import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import UserList from './components/UserList';
import Chat from './components/Chat';
import ConversationList from './components/ConversationList';
import './App.css';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [username, setUsername] = useState<string | null>(null);
    const [view, setView] = useState<'welcome' | 'directory' | 'chat'>('welcome');
    const [selectedUser, setSelectedUser] = useState<any>(null);

    useEffect(() => {
        const token = localStorage.getItem('whisper_token');
        const storedUser = localStorage.getItem('whisper_username');
        if (token && storedUser) {
            setIsAuthenticated(true);
            setUsername(storedUser);
        }
    }, []);

    const handleLoginSuccess = (user: string) => {
        setIsAuthenticated(true);
        setUsername(user);
        localStorage.setItem('whisper_username', user);
        setView('welcome');
    };

    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        setIsAuthenticated(false);
        setUsername(null);
        setView('welcome');
        window.location.href = '/';
    };

    const handleSelectUser = (user: any) => {
        setSelectedUser(user);
        setView('chat');
    };

    return (
        <div className="app-container">
            <header>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                        🛡️
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>WhisperBox</h1>
                </div>
                {isAuthenticated && (
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                            <span style={{ marginRight: '5px' }}>👤</span>
                            <strong style={{ color: 'white' }}>{username}</strong>
                        </div>
                        <button onClick={handleLogout} className="logout-btn">Logout</button>
                    </div>
                )}
            </header>

            <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {!isAuthenticated ? (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                        <Auth onLoginSuccess={(user) => handleLoginSuccess(user)} />
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', maxWidth: '1000px', margin: '0 auto', width: '100%', background: 'var(--bg-sidebar)', boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>

                        <div style={{ width: view === 'chat' ? '300px' : '100%', display: view === 'chat' ? 'none' : 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
                            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'white' }}>Chats</h2>
                                <button
                                    onClick={() => setView('directory')}
                                    className="btn-primary"
                                    style={{ padding: '8px 15px', fontSize: '0.85rem' }}
                                >
                                    + New
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {view === 'welcome' && (
                                    <ConversationList onSelectUser={handleSelectUser} />
                                )}
                                {view === 'directory' && (
                                    <div style={{ padding: '0 10px' }}>
                                        <button onClick={() => setView('welcome')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '10px', fontSize: '0.9rem' }}>
                                            ← Back to Chats
                                        </button>
                                        <UserList onSelectUser={handleSelectUser} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, display: view === 'chat' ? 'flex' : 'none', flexDirection: 'column', background: 'var(--bg-dark)' }}>
                            {view === 'chat' ? (
                                <>
                                    <button
                                        onClick={() => setView('welcome')}
                                        style={{ background: 'var(--bg-sidebar)', color: 'var(--accent)', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 20px', cursor: 'pointer', textAlign: 'left', fontSize: '0.9rem' }}
                                    >
                                        ← Back to List
                                    </button>
                                    <Chat selectedUser={selectedUser} />
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                    <div style={{ fontSize: '80px', marginBottom: '20px', opacity: 0.2 }}>💬</div>
                                    <p>Select a chat to start messaging</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <style>{`
                .logout-btn {
                    background: #ef4444; color: white; border: none; padding: 6px 16px; 
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem;
                }
                .logout-btn:hover { background: #dc2626; }
            `}</style>
        </div>
    );
}

export default App;