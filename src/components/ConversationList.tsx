import { useEffect, useState } from 'react';
import api from '../lib/api';

interface Conversation {
    user_id: string;
    username: string;
    display_name: string;
    last_message_at: string;
}

interface ConversationListProps {
    onSelectUser: (user: { id: string, username: string, publicKey?: string }) => void;
}

export default function ConversationList({ onSelectUser }: ConversationListProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const response = await api.get('/conversations');
                setConversations(response.data);
            } catch (err) {
                console.error("Failed to fetch conversations:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading && conversations.length === 0) return <div style={{ color: '#94a3b8', textAlign: 'center' }}>Loading your chats...</div>;

    if (conversations.length === 0) return (
        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', border: '1px dashed #334155', borderRadius: '12px' }}>
            No recent conversations. Start one by searching the directory!
        </div>
    );

    return (
        <div style={{ display: 'grid', gap: '2px' }}>
            {conversations.map((conv) => (
                <div 
                    key={conv.user_id} 
                    onClick={() => onSelectUser({ id: conv.user_id, username: conv.username })}
                    style={{
                        padding: '12px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.2s',
                        borderRadius: '12px',
                        margin: '0 5px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #2481cc, #3fa5ed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                            {conv.username[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '1.05rem', color: 'white' }}>{conv.username}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#2b5278' }}>✓✓</span> Tap to open chat
                            </div>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'right' }}>
                        {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            ))}
        </div>
    );
}
