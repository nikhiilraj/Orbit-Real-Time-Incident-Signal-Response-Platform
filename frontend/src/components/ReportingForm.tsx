"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, X, Loader2, AlertCircle, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ReportingForm({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'ACCIDENT',
    description: '',
    severity: 'medium'
  });

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      setFile(selected);
      // Clean up old preview URL if it exists
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(selected);
      setPreview(url);
    }
  };

  const handleFileUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `live-${Date.now()}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error } = await supabase.storage
      .from('incident-media')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('incident-media')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Camera evidence is mandatory for verification.");
    
    setLoading(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const mediaUrl = await handleFileUpload(file);

        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          type: formData.type,
          description: formData.description,
          severity: formData.severity,
          media_url: mediaUrl,
        };

        const res = await fetch( `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) onClose();
      } catch (err) {
        console.error(err);
        alert("Transmission failed.");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <form 
        onSubmit={handleSubmit} 
        className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-transparent to-red-600 opacity-50" />
        
        <button type="button" onClick={onClose} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-4 py-1.5 rounded-full mb-4">
            <ShieldCheck size={14} className="text-red-500" />
            <span className="text-[10px] font-black tracking-[0.2em] text-red-500 uppercase">Verified Live Feed</span>
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">Submit Evidence</h2>
        </div>

        <div className="space-y-6">
          <div className="relative">
            {preview ? (
              <div className="relative rounded-3xl overflow-hidden border-2 border-green-500/50 aspect-video bg-black shadow-2xl">
                {file?.type.startsWith('video') ? (
                  <video src={preview} className="w-full h-full object-cover" controls />
                ) : (
                  <img src={preview} className="w-full h-full object-cover" alt="Capture Preview" />
                )}
                <button 
                  type="button" 
                  onClick={() => {setFile(null); setPreview(null);}}
                  className="absolute top-4 right-4 bg-red-600 p-2 rounded-full shadow-lg"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-white/10 rounded-3xl p-10 transition-all hover:border-red-500/40 hover:bg-red-500/5">
                <label className="cursor-pointer flex flex-col items-center gap-4">
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    capture="environment" 
                    className="hidden" 
                    onChange={handleCapture}
                    required
                  />
                  <div className="bg-white/5 p-5 rounded-full">
                    <Camera size={40} className="text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white">Capture Live Media</p>
                    <p className="text-[9px] text-white/30 uppercase mt-1">Direct camera link required</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-red-500"
            >
              <option value="ACCIDENT">Road Accident</option>
              <option value="FIRE">Fire</option>
              <option value="MEDICAL">Medical</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
            </select>
            <select 
              value={formData.severity}
              onChange={(e) => setFormData({...formData, severity: e.target.value})}
              className="flex-1 bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-red-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">Critical</option>
            </select>
          </div>

          <textarea 
            required
            placeholder="Briefly describe the emergency situation..."
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-sm outline-none focus:border-red-500 h-24 resize-none"
          />

          <button 
            disabled={loading || !file}
            className="w-full bg-white text-black py-6 rounded-3xl font-black text-xs tracking-[0.3em] uppercase hover:bg-red-600 hover:text-white disabled:opacity-20 transition-all flex items-center justify-center gap-3 shadow-2xl"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><MapPin size={18} /> Transmit Verified Report</>}
          </button>
        </div>
      </form>
    </div>
  );
}