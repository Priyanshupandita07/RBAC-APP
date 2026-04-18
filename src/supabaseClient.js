import { createClient } from "@supabase/supabase-js";
const supabaseUrl = 'https://gsioljukmxokkcpopfgq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzaW9sanVrbXhva2tjcG9wZmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDQ3OTEsImV4cCI6MjA5MTQ4MDc5MX0._8nv-LpdVBaUIMGPLhf3ooqAfroCZWH2gHqWTKkC18I'


export const supabase = createClient(supabaseUrl,supabaseKey)