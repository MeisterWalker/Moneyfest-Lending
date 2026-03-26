-- 📋 APPLICANT ASSESSMENT TABLE
-- Stores rubric scores and interview notes for potential borrowers.

CREATE TABLE IF NOT EXISTS public.applicant_assessments (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id),
    
    -- Rubric Scores (0-10 or 1-5)
    score_character INTEGER CHECK (score_character >= 0 AND score_character <= 10),
    score_capacity INTEGER CHECK (score_capacity >= 0 AND score_capacity <= 10),
    score_reliability INTEGER CHECK (score_reliability >= 0 AND score_reliability <= 10),
    score_purpose INTEGER CHECK (score_purpose >= 0 AND score_purpose <= 10),
    score_overall INTEGER CHECK (score_overall >= 0 AND score_overall <= 10),
    
    -- Detailed Notes
    interview_notes TEXT,
    red_flags TEXT[], -- Array of red flag strings (e.g. ['Vague about purpose', 'Avoidant behavior'])
    recommendation TEXT CHECK (recommendation IN ('Highly Recommended', 'Recommended', 'Proceed with Caution', 'Rejected')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.applicant_assessments ENABLE ROW LEVEL SECURITY;

-- Allow admins to do everything
CREATE POLICY "Allow admin all" ON public.applicant_assessments 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link assessments to applications in a view or join
CREATE OR REPLACE VIEW public.application_with_assessment AS
SELECT 
    a.*,
    ast.score_overall,
    ast.recommendation as assessment_recommendation,
    ast.id as assessment_id
FROM public.applications a
LEFT JOIN public.applicant_assessments ast ON a.id = ast.application_id;
