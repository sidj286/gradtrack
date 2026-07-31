-- ============================================================
-- RLS POLICIES
-- Generated: July 31, 2026
-- Total: 74 policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.alumni_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graduates_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

CREATE POLICY "Allow admin to read all activities" ON public.alumni_activities FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Allow admin to view all activities" ON public.alumni_activities FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Users can insert their own activities" ON public.alumni_activities FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own activities" ON public.alumni_activities FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "Users can create comments" ON public.alumni_comments FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own comments" ON public.alumni_comments FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own comments" ON public.alumni_comments FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view all comments" ON public.alumni_comments FOR SELECT USING (true);

CREATE POLICY "Admin can view all job history" ON public.alumni_job_history FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "System can delete job history" ON public.alumni_job_history FOR DELETE USING (true);
CREATE POLICY "System can insert job history" ON public.alumni_job_history FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update job history" ON public.alumni_job_history FOR UPDATE USING (true);
CREATE POLICY "Users can view their own job history" ON public.alumni_job_history FOR SELECT USING ((alumni_id IN ( SELECT alumni_profiles.id FROM alumni_profiles WHERE (alumni_profiles.user_id = auth.uid()))));

CREATE POLICY "Users can create likes" ON public.alumni_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own likes" ON public.alumni_likes FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view all likes" ON public.alumni_likes FOR SELECT USING (true);

CREATE POLICY "Anyone can view posts" ON public.alumni_posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts" ON public.alumni_posts FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own posts" ON public.alumni_posts FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own posts" ON public.alumni_posts FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can view all posts" ON public.alumni_posts FOR SELECT USING (true);

CREATE POLICY "Allow admin to read all profiles" ON public.alumni_profiles FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Allow admin to view all profiles" ON public.alumni_profiles FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Allow profile creation" ON public.alumni_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update own profile" ON public.alumni_profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Allow users to view their own profile" ON public.alumni_profiles FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "Anyone can view profiles" ON public.alumni_profiles FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.alumni_profiles FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Enable insert for authenticated users only" ON public.alumni_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for users based on user_id" ON public.alumni_profiles FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own profile" ON public.alumni_profiles FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own profile" ON public.alumni_profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own profile" ON public.alumni_profiles FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "Admins can delete any comment" ON public.announcement_comments FOR DELETE USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Allow admins to delete any comment" ON public.announcement_comments FOR DELETE USING ((EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND (u.role = 'Admin'::text)))));
CREATE POLICY "Allow admins to view all comments" ON public.announcement_comments FOR SELECT USING ((EXISTS ( SELECT 1 FROM users u WHERE ((u.id = auth.uid()) AND (u.role = 'Admin'::text)))));
CREATE POLICY "Allow alumni to delete their own comments" ON public.announcement_comments FOR DELETE USING ((user_id = auth.uid()));
CREATE POLICY "Allow alumni to insert their own comments" ON public.announcement_comments FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (user_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM announcements a WHERE ((a.id = announcement_comments.announcement_id) AND (a.published = true))))));
CREATE POLICY "Allow authenticated users to insert comments" ON public.announcement_comments FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "Allow authenticated users to view comments on published announc" ON public.announcement_comments FOR SELECT USING ((EXISTS ( SELECT 1 FROM announcements a WHERE ((a.id = announcement_comments.announcement_id) AND (a.published = true)))));
CREATE POLICY "Allow users to update their own comments" ON public.announcement_comments FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Anyone can view comments" ON public.announcement_comments FOR SELECT USING (true);
CREATE POLICY "Users can delete own comments" ON public.announcement_comments FOR DELETE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own comments" ON public.announcement_comments FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can update their own comments" ON public.announcement_comments FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can insert their own announcement views" ON public.announcement_views FOR INSERT WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own announcement views" ON public.announcement_views FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "Allow admin to read all announcements" ON public.announcements FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Allow admin to view all announcements" ON public.announcements FOR SELECT USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "Users can view targeted announcements" ON public.announcements FOR SELECT USING (((published = true) AND ((target_type = 'all'::text) OR ((target_type = 'course'::text) AND (target_course IN ( SELECT alumni_profiles.course FROM alumni_profiles WHERE (alumni_profiles.user_id = auth.uid())))) OR ((target_type = 'batch_year'::text) AND (target_batch_year IN ( SELECT alumni_profiles.batch_year FROM alumni_profiles WHERE (alumni_profiles.user_id = auth.uid())))))));
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (((published = true) OR (EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text))))));
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'Admin'::text)))));

CREATE POLICY "Allow authenticated users to insert replies" ON public.comment_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.comment_replies FOR SELECT USING (true);

CREATE POLICY "Users manage their own device push tokens" ON public.device_push_tokens FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Admin users can manage graduates_master" ON public.graduates_master FOR ALL USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.admin = true))))) WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.admin = true)))));
CREATE POLICY "Allow Public Verification" ON public.graduates_master FOR SELECT USING (true);
CREATE POLICY "Public can verify against master list" ON public.graduates_master FOR SELECT USING ((verified = true));

CREATE POLICY "Allow all inserts" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for authenticated users" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for users based on user_id" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));
CREATE POLICY "Enable update for users based on user_id" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((user_id = auth.uid()));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (true);

CREATE POLICY "Allow registration insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable upsert for registration" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert their own record" ON public.users FOR INSERT WITH CHECK (((auth.uid() = id) AND (role = 'Alumni'::text)));
CREATE POLICY "Users can view their own record" ON public.users FOR SELECT USING ((auth.uid() = id));
CREATE POLICY "Users can view their own role" ON public.users FOR SELECT USING ((auth.uid() = id));

CREATE POLICY "Users manage their own web push subscriptions" ON public.web_push_subscriptions FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));