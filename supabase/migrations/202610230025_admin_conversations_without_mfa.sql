-- Let authenticated staff/admins open conversations addressed to themselves
-- without MFA, while returning only customer contacts they have messaged.
CREATE OR REPLACE FUNCTION public.get_my_message_conversations()
RETURNS TABLE(id UUID, full_name TEXT, last_activity TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS staff_profile
    WHERE staff_profile.id = auth.uid()
      AND staff_profile.role IN ('admin', 'staff')
      AND staff_profile.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Active staff access is required';
  END IF;

  RETURN QUERY
  SELECT customer.id,
         COALESCE(customer.full_name, 'Customer'),
         MAX(message.created_at) AS last_activity
  FROM public.messages AS message
  JOIN public.profiles AS customer
    ON customer.id = CASE
      WHEN message.sender_id = auth.uid() THEN message.receiver_id
      ELSE message.sender_id
    END
  WHERE (message.sender_id = auth.uid() OR message.receiver_id = auth.uid())
    AND customer.role NOT IN ('admin', 'staff')
  GROUP BY customer.id, customer.full_name
  ORDER BY MAX(message.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_message_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_message_conversations() TO authenticated;

NOTIFY pgrst, 'reload schema';
