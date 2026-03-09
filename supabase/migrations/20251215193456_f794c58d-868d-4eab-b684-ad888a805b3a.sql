-- Enable realtime for companies table to detect plan changes
ALTER TABLE companies REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE companies;