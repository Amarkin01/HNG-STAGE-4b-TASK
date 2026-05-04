import { useEffect, useState } from 'react';
import api from '../lib/api';

interface User {
    id: string;
    username: string;
    publicKey: string;
}

interface UserListProps {
    onSelectUser: (user: User) => void;
}

export default function UserList({ onSelectUser }: UserListProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setUsers([]);
            return;
        }

        const timer = setTimeout(() => {
            fetchUsers(searchQuery);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchUsers = async (query: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);

            const mappedUsers = response.data.map((u: any) => ({
                ...u,
                username: u.username || u.display_name,
                publicKey: u.publicKey || u.public_key,
                id: u.id || u.userId || u._id
            }));

            setUsers(mappedUsers);
        } catch (err: any) {
            setError(err.response?.data?.detail || err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem', color: 'white' }}>User Directory</h3>

            <div style={{ marginBottom: '30px' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type a name to find users..."
                    style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: '12px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: 'white',
                        fontSize: '1rem',
                        boxSizing: 'border-box',
                        outline: 'none'
                    }}
                />
            </div>

            {loading && <div style={{ textAlign: 'center', color: '#94a3b8' }}>Searching encrypted nodes...</div>}

            {error && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '20px' }}>{error}</div>}

            <div style={{ display: 'grid', gap: '12px' }}>
                {!loading && users.length === 0 && searchQuery.trim() !== '' && (
                    <p style={{ textAlign: 'center', color: '#94a3b8' }}>No users found matching "{searchQuery}"</p>
                )}

                {users.map((user) => (
                    <div
                        key={user.id}
                        onClick={() => onSelectUser(user)}
                        className="auth-card"
                        style={{
                            padding: '15px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {user.username ? user.username[0].toUpperCase() : '?'}
                            </div>
                            <strong>{user.username}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                fontSize: '11px',
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: '1px solid rgba(34, 197, 94, 0.2)'
                            }}>
                                🔒 Secure Chat
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
