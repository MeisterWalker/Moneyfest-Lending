-- 📋 APPLICANT ASSESSMENT TABLE
-- Stores rubric scores, interview answers, and red flags for potential borrowers.
-- Run this in the Supabase SQL Editor.

-- Drop existing table if you want a clean slate (optional)
-- DROP TABLE IF EXISTS public.applicant_assessments;

CREATE TABLE IF NOT EXISTS public.applicant_assessments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id),
    
    -- Rubric Scores (stored for reference)
    score_character INTEGER CHECK (score_character >= 0 AND score_character <= 100),
    score_capacity INTEGER,
    score_reliability INTEGER,
    score_purpose INTEGER,
    score_overall INTEGER CHECK (score_overall >= 0 AND score_overall <= 100),
    
    -- Interview data
    answers_json JSONB DEFAULT '{}',  -- Per-question answers { "q1": 3, "q2": 2, ... }
    interview_notes TEXT,
    red_flags TEXT[],  -- Array of flag IDs (e.g. ['resign', 'probation', 'evasive_resign'])
    recommendation TEXT CHECK (recommendation IN ('Highly Recommended', 'Recommended', 'Proceed with Caution', 'Rejected')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint for upsert
    CONSTRAINT unique_application_assessment UNIQUE (application_id)
);

-- Enable RLS
ALTER TABLE public.applicant_assessments ENABLE ROW LEVEL SECURITY;

-- Allow admins to do everything
DROP POLICY IF EXISTS "Allow admin all" ON public.applicant_assessments;
CREATE POLICY "Allow admin all" ON public.applicant_assessments 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- View to join assessments with applications
CREATE OR REPLACE VIEW public.application_with_assessment AS
SELECT 
    a.*,
    ast.score_overall,
    ast.recommendation as assessment_recommendation,
    ast.id as assessment_id
FROM public.applications a
LEFT JOIN public.applicant_assessments ast ON a.id = ast.application_id;
