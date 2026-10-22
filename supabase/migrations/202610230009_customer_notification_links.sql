-- Make inquiry replies easy for customers to recognize. This migration also
-- updates projects that already ran the original booking-experience migration.
CREATE OR REPLACE FUNCTION public.notify_message_recipient(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_sender_id UUID;
  message_receiver_id UUID;
  sender_role TEXT;
  message_content TEXT;
  venue_name TEXT;
  package_name TEXT;
  notice_title TEXT;
  notice_link TEXT;
BEGIN
  SELECT m.sender_id, m.receiver_id, p.role, m.content, v.name, pkg.name
  INTO message_sender_id, message_receiver_id, sender_role, message_content, venue_name, package_name
  FROM public.messages AS m
  JOIN public.profiles AS p ON p.id = m.sender_id
  LEFT JOIN public.venues AS v ON v.id = m.venue_id
  LEFT JOIN public.packages AS pkg ON pkg.id = m.package_id
  WHERE m.id = p_message_id AND m.sender_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or caller is not its sender';
  END IF;

  IF sender_role IN ('admin', 'staff') THEN
    notice_title := CASE
      WHEN package_name IS NOT NULL THEN 'Venue team replied about ' || package_name
      WHEN venue_name IS NOT NULL THEN 'Venue team replied about ' || venue_name
      ELSE 'Venue team replied to your message'
    END;
    notice_link := '/dashboard/messages';
  ELSE
    notice_title := CASE
      WHEN message_content LIKE 'Package inquiry:%' THEN 'Package inquiry: ' || COALESCE(package_name, '')
      WHEN message_content LIKE 'Venue inquiry:%' THEN 'Venue inquiry: ' || COALESCE(venue_name, '')
      WHEN package_name IS NOT NULL THEN 'New message about ' || package_name
      WHEN venue_name IS NOT NULL THEN 'New message about ' || venue_name
      ELSE 'New Message'
    END;
    notice_link := '/admin/messages?userId=' || message_sender_id::TEXT;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (message_receiver_id, notice_title, LEFT(message_content, 80), notice_link);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_message_recipient(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_message_recipient(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
