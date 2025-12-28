"use client";
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';
import { 
  AlertCircle, MapPin, CheckCircle, Clock, 
  Shield, Image as ImageIcon, Filter, Zap,
  MessageSquare, SlidersHorizontal, Activity, Loader2,
  LayoutList, Map as MapIcon, ChevronLeft
} from 'lucide-react';
import ReportingForm from '@/components/ReportingForm';
import AuthModal from '@/components/AuthModal';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// --- PRODUCTION CONSTANT ---
const BACKEND_URL = "https://orbit-real-time-incident-signal-response-qimq.onrender.com";

const parsePoint = (pointStr: string): [number, number] => {
  if (!pointStr || pointStr.startsWith('0101')) return [85.1, 25.6];
  const match = pointStr.match(/POINT\s?\(([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\)/);
  return match ? [parseFloat(match[1]), parseFloat(match[2])] : [85.1, 25.6];
};

export default function Dashboard() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // --- RESPONSIVE STATE ---
  const [mobileTab, setMobileTab] = useState<'map' | 'feed'>('map');

  // --- FILTER STATES ---
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState(24);
  const [radiusFilter, setRadiusFilter] = useState(15);

  const loadData = async () => {
    let query = supabase.from('incident_view').select('*');
    if (typeFilter !== 'ALL') query = query.eq('type', typeFilter);
    const timeLimit = new Date(Date.now() - timeFilter * 60 * 60 * 1000).toISOString();
    query = query.gt('created_at', timeLimit);

    const { data } = await query;
    if (data) {
      const prioritized = data.map(i => {
        const severityWeight = i.severity === 'high' ? 1000 : i.severity === 'medium' ? 500 : 100;
        return { 
          ...i, 
          location: i.location_text, 
          priority: severityWeight + (new Date(i.created_at).getTime() / 10000000) 
        };
      }).sort((a, b) => b.priority - a.priority);
      setIncidents(prioritized);
    }
  };

  useEffect(() => { loadData(); }, [typeFilter, timeFilter, isAdminMode]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: isAdminMode ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/dark-v11',
      center: [85.1, 25.6], zoom: 11
    });

    mapRef.current.on('load', loadData);
    
    // ✅ Fix: Use curly braces to avoid implicit return of Map object
    return () => {
      mapRef.current?.remove();
    };
  }, [isAdminMode]);

  useEffect(() => {
    const channel = supabase.channel('dispatch_v2').on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, loadData).subscribe();
    
    // ✅ Fix: Return void
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();

    const syncMarkers = () => {
      if (!mapRef.current) return;
      const currentCenter = mapRef.current.getCenter();
      incidents.forEach((inc) => {
        const coords = parsePoint(inc.location);
        const from = [currentCenter.lng, currentCenter.lat];
        const dist = Math.sqrt(Math.pow(from[0]-coords[0], 2) + Math.pow(from[1]-coords[1], 2)) * 111;
        const isWithinRadius = dist <= radiusFilter;

        if (markersRef.current[inc.id]) {
          if (!isWithinRadius) markersRef.current[inc.id].remove();
          else {
            markersRef.current[inc.id].addTo(mapRef.current!);
            markersRef.current[inc.id].getElement().style.backgroundColor = inc.status === 'verified' ? '#ff3131' : '#ffc107';
          }
          return;
        }

        if (isWithinRadius) {
          const el = document.createElement('div');
          el.style.width = '18px'; el.style.height = '18px';
          el.style.borderRadius = '50%';
          el.style.border = '2px solid white';
          el.style.backgroundColor = inc.status === 'verified' ? '#ff3131' : '#ffc107';
          el.style.cursor = 'pointer';
          el.style.boxShadow = '0 0 15px rgba(0,0,0,0.5)';

          const marker = new mapboxgl.Marker(el).setLngLat(coords).addTo(mapRef.current!);
          el.addEventListener('click', () => {
            setSelectedIncident(inc);
            if (window.innerWidth < 768) setMobileTab('feed');
          });
          markersRef.current[inc.id] = marker;
        }
      });
    };

    syncMarkers();
    mapRef.current.on('moveend', syncMarkers);
    
    // ✅ Fix: Prevents "EffectCallback" error by not returning the Map instance
    return () => {
      mapRef.current?.off('moveend', syncMarkers);
    };
  }, [incidents, radiusFilter]);

  const handleVerify = async (id: string) => {
    if (!isAdminMode) return;
    setIsVerifying(true);
    try {
      // ✅ Updated to your live Render URL
      const res = await fetch(`${BACKEND_URL}/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      });
      if (res.ok) {
        setIncidents(prev => prev.map(i => i.id === id ? {...i, status: 'verified'} : i));
        setSelectedIncident(null);
        await loadData();
      }
    } catch (err) { console.error(err); } finally { setIsVerifying(false); }
  };

  const saveNotes = async (id: string, notes: string) => {
    if (!isAdminMode) return;
    // ✅ Updated to your live Render URL
    await fetch(`${BACKEND_URL}/api/incidents/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
  };

  return (
    <main className="flex flex-col md:flex-row h-screen w-screen bg-black text-white overflow-hidden font-sans">
      <div className={`
        ${mobileTab === 'feed' ? 'flex' : 'hidden'} 
        md:flex flex-col z-20 shadow-2xl relative
        w-full md:w-[400px] h-full bg-slate-900/40 backdrop-blur-3xl border-r border-white/5
      `}>
        <div className="p-4 md:p-6 pb-4">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h1 className="text-lg md:text-xl font-black tracking-widest italic text-white uppercase">System.Alpha</h1>
            </div>
            <button 
              onClick={() => isAdminMode ? setIsAdminMode(false) : setIsAuthModalOpen(true)}
              className={`text-[9px] font-black px-4 py-1.5 rounded-full border transition-all ${
                isAdminMode ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20' : 'border-white/20 text-white/40 hover:text-white'
              }`}
            >
              {isAdminMode ? "END DUTY" : "OFFICER LOGIN"}
            </button>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest">
              <div className="flex items-center gap-2"><SlidersHorizontal size={14}/> Radius Filter</div>
              <span className="text-red-500">{radiusFilter} KM</span>
            </div>
            <input 
              type="range" min="1" max="50" value={radiusFilter}
              onChange={(e) => setRadiusFilter(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex gap-2">
              <select className="flex-1 bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] font-black uppercase outline-none" onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="ALL">All Types</option>
                <option value="FIRE">Fire</option>
                <option value="ACCIDENT">Accident</option>
                <option value="MEDICAL">Medical</option>
              </select>
              <select className="flex-1 bg-black/40 border border-white/5 rounded-xl p-2 text-[10px] font-black uppercase outline-none" onChange={(e) => setTimeFilter(parseInt(e.target.value))}>
                <option value="1">1 Hour</option>
                <option value="24">24 Hours</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4 custom-scrollbar pb-24 md:pb-4">
          {selectedIncident ? (
            <div className="animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                <button onClick={() => setSelectedIncident(null)} className="text-white/40 text-[9px] font-black mb-4 uppercase hover:text-white flex items-center gap-1">
                  <ChevronLeft size={14} /> Back to feed
                </button>
                <h2 className="text-2xl md:text-3xl font-black italic uppercase leading-none mb-4">{selectedIncident.type}</h2>
                
                {selectedIncident.media_url && (
                  <div className="rounded-2xl overflow-hidden mb-6 aspect-video bg-black shadow-2xl border border-white/5">
                    <img src={selectedIncident.media_url} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" alt="Evidence" />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-sm text-white/70 italic leading-relaxed shadow-inner">
                    "{selectedIncident.description}"
                  </div>
                  
                  {isAdminMode && (
                    <div className="pt-4 space-y-4 border-t border-white/10">
                      <button 
                        disabled={isVerifying || selectedIncident.status === 'verified'}
                        onClick={() => handleVerify(selectedIncident.id)} 
                        className="w-full bg-red-600 disabled:opacity-30 py-5 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-red-500 transition-all active:scale-95 flex justify-center items-center gap-2 shadow-xl shadow-red-900/20"
                      >
                        {isVerifying ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle size={16}/>}
                        {selectedIncident.status === 'verified' ? "DEPLOYED" : "VERIFY & COORDINATE"}
                      </button>
                      
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                          <MessageSquare size={12}/> Dispatcher Notes
                        </label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-[11px] outline-none h-24 focus:border-blue-500/50 text-white/80" 
                          placeholder="Log responder instructions..." 
                          onBlur={(e) => saveNotes(selectedIncident.id, e.target.value)}
                          defaultValue={selectedIncident.internal_notes || ""}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Urgent Alerts Queue</h3>
              {incidents.map((inc) => (
                <div 
                  key={inc.id} 
                  onClick={() => {
                    setSelectedIncident(inc);
                    mapRef.current?.flyTo({ center: parsePoint(inc.location), zoom: 15 });
                  }}
                  className={`group p-4 md:p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                    inc.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5'
                  } hover:bg-white/10 hover:translate-x-1 shadow-lg`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter ${inc.severity === 'high' ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'}`}>
                      {inc.severity} Priority
                    </div>
                    <div className="text-[9px] font-bold text-white/20 font-mono italic">{new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <h4 className="font-black text-sm uppercase italic tracking-tight group-hover:text-red-500 transition-colors">{inc.type}</h4>
                  {inc.status === 'verified' && (
                    <div className="absolute top-4 right-4 text-green-500"><CheckCircle size={16} /></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div 
        ref={mapContainerRef} 
        className={`flex-1 h-full relative ${mobileTab === 'map' ? 'block' : 'hidden md:block'}`} 
      />

      <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-3 z-50">
        <button 
          onClick={() => setMobileTab('map')} 
          className={`flex flex-col items-center gap-1 transition-colors ${mobileTab === 'map' ? 'text-red-500' : 'text-white/40'}`}
        >
          <MapIcon size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Live Map</span>
        </button>
        
        {!isAdminMode && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-white text-black p-3 rounded-full -translate-y-6 shadow-2xl border-4 border-black"
          >
            <Zap size={24} fill="currentColor" />
          </button>
        )}

        <button 
          onClick={() => setMobileTab('feed')} 
          className={`flex flex-col items-center gap-1 transition-colors ${mobileTab === 'feed' ? 'text-red-500' : 'text-white/40'}`}
        >
          <LayoutList size={20} />
          <span className="text-[8px] font-black uppercase tracking-widest">Emergency Feed</span>
        </button>
      </div>

      {!isAdminMode && (
        <button 
          onClick={() => setIsFormOpen(true)}
          className="hidden md:flex absolute bottom-12 right-12 bg-white text-black px-10 py-5 rounded-full font-black text-sm tracking-[0.2em] shadow-2xl hover:scale-110 active:scale-95 transition-all z-30 items-center gap-4 group"
        >
          <Activity size={20} className="text-red-500 group-hover:animate-bounce" /> 
          REPORT EMERGENCY
        </button>
      )}

      {isFormOpen && <ReportingForm onClose={() => setIsFormOpen(false)} />}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} onLoginSuccess={() => setIsAdminMode(true)} />}
    </main>
  );
}