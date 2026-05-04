import React, { useState } from 'react';
import api from '../lib/api';
import { generateRSAKeyPair, prepareRegistrationData, storePrivateKey, unwrapPrivateKey } from '../lib/crypto';

interface AuthProps {
    onLoginSuccess: (username: string) => void;
}

export default function Auth({ onLoginSuccess }: AuthProps) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isRegistering) {
                console.log("Generating RSA Keypair...");
                const keyPair = await generateRSAKeyPair();
                console.log("Wrapping keys with password...");
                const cryptoData = await prepareRegistrationData(keyPair, password);

                console.log("Sending registration to server...");
                const response = await api.post('/auth/register', {
                    username,
                    display_name: username,
                    password,
                    public_key: cryptoData.publicKey,
                    wrapped_private_key: cryptoData.wrappedPrivateKey,
                    pbkdf2_salt: cryptoData.salt
                });

                await storePrivateKey(keyPair.privateKey);
                const token = response.data.access_token || response.data.accessToken;
                localStorage.setItem('whisper_token', token);
                localStorage.setItem('whisper_public_key', cryptoData.publicKey);

            } else {
                const loginRes = await api.post('/auth/login', { username, password });

                const token = loginRes.data.access_token || loginRes.data.accessToken || loginRes.data.token;
                localStorage.setItem('whisper_token', token);

                const data = loginRes.data;
                const finalWrapped = data.wrapped_private_key || data.wrappedPrivateKey;
                const finalSalt = data.pbkdf2_salt || data.salt;
                const finalPub = data.public_key || data.publicKey;

                if (finalPub) {
                    localStorage.setItem('whisper_public_key', finalPub);
                }

                if (finalWrapped && finalSalt) {
                    try {
                        const privateKey = await unwrapPrivateKey(finalWrapped, password, finalSalt);
                        await storePrivateKey(privateKey);
                    } catch (err) {
                        console.error("Unwrap failed:", err);
                    }
                }
            }

            onLoginSuccess(username);

        } catch (err: any) {
            console.error("Auth Error Detail:", err.response?.data);
            const detail = err.response?.data?.detail;
            const message = Array.isArray(detail) ? detail.map(d => `${d.loc[1]}: ${d.msg}`).join(", ") : detail;
            const errMsg = message || err.response?.data?.message || err.message;

            alert(`Security Node Error: ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <div style={{ width: '80px', height: '80px', background: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '40px', boxShadow: '0 4px 15px rgba(36, 129, 204, 0.4)' }}>
                    {isRegistering ? '👤' : '🔐'}
                </div>
                <h2 style={{ fontSize: '1.6rem', color: 'white', margin: '0 0 8px' }}>
                    {isRegistering ? "Your Identity" : "WhisperBox"}
                </h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', margin: 0 }}>
                    {isRegistering ? "Create a secure E2EE account" : "Enter your credentials to login"}
                </p>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        placeholder="e.g. Satoshi"
                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '1rem', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '1rem', boxSizing: 'border-box' }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px', cursor: 'pointer' }}
                >
                    {loading ? "Processing..." : (isRegistering ? "CREATE ACCOUNT" : "NEXT")}
                </button>
            </form>
            
            <button
                onClick={() => setIsRegistering(!isRegistering)}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', width: '100%', marginTop: '20px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
            >
                {isRegistering ? "Already have an account?" : "No account yet? Register"}
            </button>
        </div>
    );
}