-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (syncs with auth.users, managed by Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
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

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user TO public;
GRANT EXECUTE ON FUNCTION public.match_documents TO public;
GRANT EXECUTE ON FUNCTION public.update_updated_at TO public;

-- Grant table permissions (minimal to avoid security risks)
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;
GRANT SELECT ON public.constitution_embeddings TO authenticated;
GRANT SELECT ON public.document_embeddings TO authenticated;