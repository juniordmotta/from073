
-- Allow all authenticated users to see hidden houses (so they can filter them out)
CREATE POLICY "Authenticated users can see hidden houses"
ON public.hidden_betting_houses
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
