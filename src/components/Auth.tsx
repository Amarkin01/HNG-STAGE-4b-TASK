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

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        try {
            if (isRegistering) {
                console.log("Generating RSA Keypair...");
                const keyPair = await generateRSAKeyPair();
                console.log("Wrapping keys with password...");
                const cryptoData = await prepareRegistrationData(keyPair, cleanPassword);

                console.log("Sending registration to server...");
                const response = await api.post('/auth/register', {
                    username: cleanUsername,
                    display_name: cleanUsername,
                    password: cleanPassword,
                    public_key: cryptoData.publicKey,
                    wrapped_private_key: cryptoData.wrappedPrivateKey,
                    pbkdf2_salt: cryptoData.salt
                });

                await storePrivateKey(keyPair.privateKey);
                const token = response.data.access_token || response.data.accessToken;
                localStorage.setItem('whisper_token', token);
                localStorage.setItem('whisper_public_key', cryptoData.publicKey);

            } else {
                const loginRes = await api.post('/auth/login', { 
                    username: cleanUsername, 
                    password: cleanPassword 
                });

                const data = loginRes.data;
                const token = data.access_token || data.accessToken || data.token;
                localStorage.setItem('whisper_token', token);

                // WhisperBox API nests user data (including keys) inside a 'user' object
                const userData = data.user || {};
                const finalWrapped = userData.wrapped_private_key || userData.wrappedPrivateKey;
                const finalSalt = userData.pbkdf2_salt || userData.salt;
                const finalPub = userData.public_key || userData.publicKey;

                if (finalPub) {
                    localStorage.setItem('whisper_public_key', finalPub);
                }

                if (finalWrapped && finalSalt) {
                    try {
                        console.log("Restoring E2EE keys from server...");
                        const privateKey = await unwrapPrivateKey(finalWrapped, cleanPassword, finalSalt);
                        await storePrivateKey(privateKey);
                    } catch (err) {
                        console.error("Key restoration failed. You might still be able to chat, but history decryption might fail.", err);
                    }
                }
            }

            onLoginSuccess(cleanUsername);

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