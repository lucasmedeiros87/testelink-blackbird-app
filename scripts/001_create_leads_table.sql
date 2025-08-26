-- Create leads table to store email, phone and page URL
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  page_url TEXT NOT NULL,
  message TEXT,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert leads (no auth required for this use case)
CREATE POLICY "Allow public insert on leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Create policy to allow reading own leads (if we add auth later)
CREATE POLICY "Allow read own leads" 
ON public.leads 
FOR SELECT 
USING (true);
