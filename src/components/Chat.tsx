import React, { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import { encryptMessage, decryptMessage, getStoredPrivateKey } from '../lib/crypto';

interface Message {
    id: string;
    senderId: string;
    recipientId: string;
    ciphertext: string;
    iv: string;
    encryptedKey: string;
    encryptedKeyForSelf?: string;
    createdAt: string;
    decryptedContent?: string;
}

interface ChatProps {
    selectedUser: {
        id: string;
        username: string;
        publicKey: string;
    };
    onBack: () => void;
}

export default function Chat({ selectedUser: initialUser, onBack }: ChatProps) {
    const [selectedUser, setSelectedUser] = useState(initialUser);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(() => {
        const fetchPubKey = async () => {
            if (selectedUser.publicKey) return;

            try {
                // The guide says GET /users/{userId}/public-key
                const res = await api.get(`/users/${selectedUser.id}/public-key`);
                const pubKey = res.data.public_key || res.data.publicKey;
                if (pubKey) {
                    setSelectedUser(prev => ({ ...prev, publicKey: pubKey }));
                }
            } catch (err) {
                console.error("Failed to fetch recipient public key:", err);
            }
        };

        fetchPubKey();
    }, [selectedUser.id]);

    useEffect(() => {
        fetchAndDecryptMessages();
        const interval = setInterval(fetchAndDecryptMessages, 5000);
        return () => clearInterval(interval);
    }, [selectedUser.id]);

    useEffect(scrollToBottom, [messages]);

    const fetchAndDecryptMessages = async () => {
        try {
            const privateKey = await getStoredPrivateKey();
            if (!privateKey) return;

            const response = await api.get(`/conversations/${selectedUser.id}/messages`);
            const rawData = response.data;
            const rawMessages: any[] = Array.isArray(rawData) ? rawData : (rawData.messages || []);

            const decryptedMessages = await Promise.all(rawMessages.map(async (m: any) => {
                const payload = m.payload || {};
                const msg = {
                    ...m,
                    senderId: m.from_user_id,
                    recipientId: m.to_user_id,
                    createdAt: m.created_at || m.createdAt,
                    ciphertext: payload.ciphertext,
                    iv: payload.iv,
                    encryptedKey: payload.encryptedKey,
                    encryptedKeyForSelf: payload.encryptedKeyForSelf
                };

                try {
                    const isSender = msg.senderId !== selectedUser.id;
                    const keyToUse = isSender ? msg.encryptedKeyForSelf : msg.encryptedKey;

                    if (!keyToUse || !msg.ciphertext || !msg.iv) {
                        throw new Error("Missing crypto components");
                    }

                    const decrypted = await decryptMessage({
                        ciphertext: msg.ciphertext,
                        iv: msg.iv,
                        encryptedKey: keyToUse
                    }, privateKey);

                    return { ...msg, decryptedContent: decrypted };
                } catch (err) {
                    console.error("Decryption failed for message:", m.id, err);
                    return { ...msg, decryptedContent: "[Decryption Failed]" };
                }
            }));

            // Sort messages chronologically (oldest first, newest at the bottom)
            const sortedMessages = decryptedMessages.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            setMessages(sortedMessages);
        } catch (err: any) {
            console.error("Error fetching messages:", err);
            // Show alert for persistent errors
            if (err.response?.status !== 404) {
                setError("Failed to sync secure messages: " + (err.response?.data?.message || err.message));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        const senderPubKey = localStorage.getItem('whisper_public_key');
        if (!senderPubKey || !selectedUser.publicKey) {
            alert("Security Error: One or both participants are missing encryption keys. Secure chat is not possible.");
            return;
        }

        setSending(true);
        try {
            // 1. Dual Encryption (Recipient + Self)
            const cryptoPayload = await encryptMessage(
                newMessage,
                selectedUser.publicKey,
                senderPubKey
            );

            // 2. Send to API (Strictly following the 'to' and 'payload' schema)
            await api.post('/messages', {
                to: selectedUser.id,
                payload: {
                    ciphertext: cryptoPayload.ciphertext,
                    iv: cryptoPayload.iv,
                    encryptedKey: cryptoPayload.encryptedKey,
                    encryptedKeyForSelf: cryptoPayload.encryptedKeyForSelf
                }
            });

            setNewMessage('');
            fetchAndDecryptMessages();
        } catch (err: any) {
            alert("Failed to send secure message: " + (err.response?.data?.message || err.message));
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent' }}>
            {/* Header */}
            <div style={{ padding: '12px 20px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                    onClick={onBack}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', borderRadius: '50%', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#2481cc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {selectedUser.username[0].toUpperCase()}
                </div>
                <div>
                    <div style={{ fontWeight: '600' }}>{selectedUser.username}</div>
                    <div style={{ fontSize: '0.8rem', color: '#60a5fa' }}>online</div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="chat-window" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                {error && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '10px', fontSize: '14px', background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '8px' }}>{error}</div>}
                
                <div style={{ flex: 1 }}></div> {/* Spacer to push messages to bottom */}
                
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Restoring secure session...</p>
                ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: '40px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '20px', maxWidth: '250px', margin: '40px auto' }}>
                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔐</div>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>End-to-end encrypted.<br />Messages are safe.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div 
                            key={msg.id} 
                            className={`message-bubble ${msg.senderId === selectedUser.id ? 'message-in' : 'message-out'}`}
                            style={{ maxWidth: '85%' }}
                        >
                            <div style={{ wordBreak: 'break-word' }}>{msg.decryptedContent}</div>
                            <div style={{ 
                                fontSize: '0.65rem', 
                                textAlign: 'right', 
                                marginTop: '4px',
                                opacity: 0.7,
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '4px'
                            }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {msg.senderId !== selectedUser.id && <span>✓✓</span>}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} style={{ padding: '15px', background: 'var(--bg-sidebar)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Write a message..."
                    style={{ 
                        flex: 1, 
                        padding: '12px 20px', 
                        borderRadius: '12px', 
                        background: 'var(--bg-dark)', 
                        border: '1px solid var(--border)', 
                        color: 'white',
                        outline: 'none'
                    }}
                    disabled={sending}
                />
                <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    style={{
                        width: '45px', 
                        height: '45px', 
                        borderRadius: '50%', 
                        background: 'var(--accent)', 
                        border: 'none', 
                        color: 'white', 
                        cursor: 'pointer', 
                        display: 'flex',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        transition: 'transform 0.2s',
                        padding: '10px'
                    }}
                >
                    {sending ? '...' : (
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
}
