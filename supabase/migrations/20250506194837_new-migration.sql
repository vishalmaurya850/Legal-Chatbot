-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (syncs with auth.users, managed by Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  latitude FLOAT,
  longitude FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector store for constitution embeddings
CREATE TABLE IF NOT EXISTS public.constitution_embeddings (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User uploaded documents table
CREATE TABLE IF NOT EXISTS public.user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_path TEXT NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User document embeddings
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.user_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lawyers table
CREATE TABLE IF NOT EXISTS public.lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  specialization TEXT NOT NULL,
  experience_years INTEGER NOT NULL,
  bio TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  postal_code TEXT,
  latitude FLOAT,
  longitude FLOAT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  rating FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legal help requests table
CREATE TABLE IF NOT EXISTS public.legal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  legal_area TEXT NOT NULL,
  urgency TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  postal_code TEXT,
  latitude FLOAT,
  longitude FLOAT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_lawyer_id UUID REFERENCES public.lawyers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lawyer-User matches table
CREATE TABLE IF NOT EXISTS public.lawyer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_request_id UUID NOT NULL REFERENCES public.legal_requests(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, completed
  match_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(legal_request_id, lawyer_id)
);

-- Messages between lawyers and users
CREATE TABLE IF NOT EXISTS public.lawyer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.lawyer_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speech to text transcriptions table
CREATE TABLE IF NOT EXISTS public.speech_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  audio_file_path TEXT NOT NULL,
  transcription TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en-US',
  duration_seconds FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_session_id ON public.messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON public.feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON public.document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_user_id ON public.lawyers(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyers_specialization ON public.lawyers(specialization);
CREATE INDEX IF NOT EXISTS idx_lawyers_location ON public.lawyers(city, state, country);
CREATE INDEX IF NOT EXISTS idx_lawyers_is_available ON public.lawyers(is_available);
CREATE INDEX IF NOT EXISTS idx_legal_requests_user_id ON public.legal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_requests_legal_area ON public.legal_requests(legal_area);
CREATE INDEX IF NOT EXISTS idx_legal_requests_location ON public.legal_requests(city, state, country);
CREATE INDEX IF NOT EXISTS idx_legal_requests_status ON public.legal_requests(status);
CREATE INDEX IF NOT EXISTS idx_lawyer_matches_legal_request_id ON public.lawyer_matches(legal_request_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_matches_lawyer_id ON public.lawyer_matches(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_matches_user_id ON public.lawyer_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_matches_status ON public.lawyer_matches(status);
CREATE INDEX IF NOT EXISTS idx_lawyer_messages_match_id ON public.lawyer_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_messages_sender_id ON public.lawyer_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_speech_transcriptions_user_id ON public.speech_transcriptions(user_id);

-- Create vector similarity search indexes (optimized for small to medium datasets)
CREATE INDEX IF NOT EXISTS constitution_embeddings_embedding_idx 
ON public.constitution_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON public.document_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Function to match documents based on embedding similarity
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding VECTOR(1024),
  match_threshold FLOAT,
  match_count INT,
  filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  document_id UUID
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate inputs
  IF query_embedding IS NULL THEN
    RAISE EXCEPTION 'query_embedding cannot be NULL';
  END IF;
  IF match_threshold < 0 OR match_threshold > 1 THEN
    RAISE EXCEPTION 'match_threshold must be between 0 and 1';
  END IF;
  IF match_count < 1 THEN
    RAISE EXCEPTION 'match_count must be at least 1';
  END IF;

  -- Query constitution and document embeddings
  RETURN QUERY
  SELECT
    ce.id,
    ce.content,
    ce.metadata,
    (1 - (ce.embedding <=> query_embedding))::FLOAT AS similarity,
    NULL::UUID AS document_id
  FROM public.constitution_embeddings ce
  WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
  
  UNION ALL
  
  SELECT
    de.id,
    de.content,
    de.metadata,
    (1 - (de.embedding <=> query_embedding))::FLOAT AS similarity,
    de.document_id
  FROM public.document_embeddings de
  WHERE 
    (filter_document_id IS NULL OR de.document_id = filter_document_id)
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
  
  ORDER BY similarity DESC
  LIMIT match_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in match_documents: %', SQLERRM;
    RAISE;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.email, ''),
      'Unknown'
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(
          NULLIF(EXCLUDED.full_name, ''),
          NULLIF(users.full_name, ''),
          'Unknown'
        ),
        updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in handle_new_user: % (NEW: %)', SQLERRM, NEW;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lawyers_updated_at
  BEFORE UPDATE ON public.lawyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_legal_requests_updated_at
  BEFORE UPDATE ON public.legal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_lawyer_matches_updated_at
  BEFORE UPDATE ON public.lawyer_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
  R FLOAT := 6371; -- Radius of the earth in km
  dLat FLOAT;
  dLon FLOAT;
  a FLOAT;
  c FLOAT;
  d FLOAT;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  d := R * c; -- Distance in km
  RETURN d;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby lawyers
CREATE OR REPLACE FUNCTION find_nearby_lawyers(
  request_id UUID,
  max_distance FLOAT DEFAULT 50.0 -- Default 50km radius
)
RETURNS TABLE (
  lawyer_id UUID,
  distance FLOAT,
  match_score FLOAT
) AS $$
DECLARE
  req_lat FLOAT;
  req_lon FLOAT;
  req_area TEXT;
BEGIN
  -- Get request details
  SELECT latitude, longitude, legal_area INTO req_lat, req_lon, req_area
  FROM public.legal_requests
  WHERE id = request_id;
  
  -- Return nearby lawyers with matching specialization
  RETURN QUERY
  SELECT 
    l.id,
    calculate_distance(req_lat, req_lon, l.latitude, l.longitude) AS distance,
    CASE
      WHEN l.specialization = req_area THEN 1.0
      ELSE 0.5
    END * (1.0 / (1.0 + calculate_distance(req_lat, req_lon, l.latitude, l.longitude) / 10.0)) AS match_score
  FROM public.lawyers l
  WHERE 
    l.is_available = TRUE AND
    l.is_verified = TRUE AND
    calculate_distance(req_lat, req_lon, l.latitude, l.longitude) <= max_distance
  ORDER BY match_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get lawyer matches for a legal request
CREATE OR REPLACE FUNCTION get_lawyer_matches_for_request(request_id UUID)
RETURNS TABLE (
  match_id UUID,
  lawyer_id UUID,
  lawyer_name TEXT,
  lawyer_specialization TEXT,
  match_status TEXT,
  match_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    l.id AS lawyer_id,
    l.full_name AS lawyer_name,
    l.specialization AS lawyer_specialization,
    m.status AS match_status,
    m.match_score
  FROM 
    public.lawyer_matches m
    JOIN public.lawyers l ON m.lawyer_id = l.id
  WHERE 
    m.legal_request_id = request_id
  ORDER BY 
    m.match_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get legal requests for a lawyer
CREATE OR REPLACE FUNCTION get_legal_requests_for_lawyer(lawyer_id UUID)
RETURNS TABLE (
  request_id UUID,
  title TEXT,
  legal_area TEXT,
  urgency TEXT,
  status TEXT,
  match_id UUID,
  match_status TEXT,
  match_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS request_id,
    r.title,
    r.legal_area,
    r.urgency,
    r.status,
    m.id AS match_id,
    m.status AS match_status,
    m.match_score
  FROM 
    public.lawyer_matches m
    JOIN public.legal_requests r ON m.legal_request_id = r.id
  WHERE 
    m.lawyer_id = lawyer_id
  ORDER BY 
    m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speech_transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY users_policy ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY chat_sessions_policy ON public.chat_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY messages_policy ON public.messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY attachments_policy ON public.attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = attachments.message_id
      AND messages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = attachments.message_id
      AND messages.user_id = auth.uid()
    )
  );

CREATE POLICY feedback_policy ON public.feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_documents_policy ON public.user_documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY constitution_embeddings_policy ON public.constitution_embeddings
  FOR SELECT
  USING (true); -- Allow all authenticated users to read embeddings

CREATE POLICY document_embeddings_policy ON public.document_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_documents
      WHERE user_documents.id = document_embeddings.document_id
      AND user_documents.user_id = auth.uid()
    )
  );

CREATE POLICY lawyers_policy ON public.lawyers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY lawyers_read_policy ON public.lawyers
  FOR SELECT
  USING (true);

CREATE POLICY legal_requests_policy ON public.legal_requests
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY legal_requests_read_policy ON public.legal_requests
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM public.lawyers WHERE id = legal_requests.assigned_lawyer_id
  ));

CREATE POLICY lawyer_matches_policy ON public.lawyer_matches
  FOR ALL
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT user_id FROM public.lawyers WHERE id = lawyer_matches.lawyer_id)
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (SELECT user_id FROM public.lawyers WHERE id = lawyer_matches.lawyer_id)
  );

CREATE POLICY lawyer_messages_policy ON public.lawyer_messages
  FOR ALL
  USING (
    auth.uid() = sender_id OR 
    auth.uid() IN (
      SELECT user_id FROM public.lawyer_matches WHERE id = lawyer_messages.match_id
      UNION
      SELECT l.user_id FROM public.lawyers l
      JOIN public.lawyer_matches m ON l.id = m.lawyer_id
      WHERE m.id = lawyer_messages.match_id
    )
  )
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY speech_transcriptions_policy ON public.speech_transcriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user TO public;
GRANT EXECUTE ON FUNCTION public.match_documents TO public;
GRANT EXECUTE ON FUNCTION public.update_updated_at TO public;
GRANT EXECUTE ON FUNCTION calculate_distance TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_lawyers TO authenticated;
GRANT EXECUTE ON FUNCTION get_lawyer_matches_for_request TO authenticated;
GRANT EXECUTE ON FUNCTION get_legal_requests_for_lawyer TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;
GRANT SELECT ON public.constitution_embeddings TO authenticated;
GRANT SELECT ON public.document_embeddings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lawyer_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speech_transcriptions TO authenticated;