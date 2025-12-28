"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function AuthModal({ onClose, onLoginSuccess }: { onClose: () => void, onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Check the Profile Role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError || profile?.role !== 'officer') {
        await supabase.auth.signOut();
        throw new Error("Access Denied: You are not registered as an Officer.");
      }

      // 3. Success
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20}/></button>
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-blue-600/20 p-4 rounded-full mb-4">
            <ShieldCheck className="text-blue-500" size={32} />
          </div>
          <h2 className="text-2xl font-black italic">OFFICER AUTH</h2>
          <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Secure Command Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" placeholder="Official Email" required
            className="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="Passcode" required
            className="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
            onChange={(e) => setPassword(e.target.value)}
          />
          
          {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-tighter">{error}</p>}

          <button 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 p-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={18}/> : <><Lock size={16}/> AUTHORIZE ACCESS</>}
          </button>
        </form>
      </div>
    </div>
  );
}