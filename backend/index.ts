import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// 1. POST Incident (Now with Severity and Media)
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
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 2. PATCH Status (The missing route causing the 404)
app.patch('/api/incidents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { data, error } = await supabase.from('incidents').update({ status }).eq('id', id).select();
    if (error || !data.length) return res.status(404).json({ error: "Not found or error" });
    res.status(200).json(data[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// 3. PATCH Internal Notes (Sprint 2 Feature)
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

app.listen(3000, () => console.log('🚀 Backend synced on port 3000'));