import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();

/**
 * PRODUCTION CORS CONFIGURATION
 * Replace '*' with your actual Vercel URL after deployment for better security.
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', 
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HEALTH CHECK (Required for Render/Railway deployment monitoring) ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'operational', timestamp: new Date().toISOString() });
});

// 1. POST Incident (With PostGIS Point Generation)
app.post('/api/incidents', async (req, res) => {
  const { lat, lng, type, description, severity, media_url } = req.body;
  try {
    const { data, error } = await supabase.from('incidents').insert([{ 
      type, description, severity, media_url,
      location: `POINT(${lng} ${lat})`,
      status: 'pending' 
    }]).select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err: any) { 
    console.error("POST Error:", err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// 2. PATCH Status (Incident Verification)
app.patch('/api/incidents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update({ status })
      .eq('id', id)
      .select();
      
    if (error || !data.length) return res.status(404).json({ error: "Incident not found" });
    res.status(200).json(data[0]);
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 3. PATCH Internal Notes (Officer Coordination)
app.patch('/api/incidents/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update({ internal_notes: notes })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DYNAMIC PORT BINDING
 * Render assigns a port via process.env.PORT. 
 * '0.0.0.0' is required to accept external traffic.
 */
const PORT = process.env.PORT || 3000;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 System.Alpha Backend active on port ${PORT}`);
});