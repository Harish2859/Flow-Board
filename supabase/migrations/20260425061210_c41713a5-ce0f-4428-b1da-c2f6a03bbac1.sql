
-- Profiles table linked to auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Boards
CREATE TABLE public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Board members
CREATE TABLE public.board_members (
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')) DEFAULT 'editor',
  PRIMARY KEY (board_id, user_id)
);
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_board_member(_board_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.board_member_role(_board_id UUID, _user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id LIMIT 1;
$$;

-- Boards policies
CREATE POLICY "boards_select_member" ON public.boards FOR SELECT TO authenticated
  USING (public.is_board_member(id, auth.uid()));
CREATE POLICY "boards_insert_owner" ON public.boards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "boards_update_admin" ON public.boards FOR UPDATE TO authenticated
  USING (public.board_member_role(id, auth.uid()) IN ('admin','editor'));
CREATE POLICY "boards_delete_owner" ON public.boards FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Board members policies
CREATE POLICY "members_select_visible" ON public.board_members FOR SELECT TO authenticated
  USING (public.is_board_member(board_id, auth.uid()));
CREATE POLICY "members_insert_admin_or_self_creator" ON public.board_members FOR INSERT TO authenticated
  WITH CHECK (
    public.board_member_role(board_id, auth.uid()) = 'admin'
    OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid())
  );
CREATE POLICY "members_delete_admin" ON public.board_members FOR DELETE TO authenticated
  USING (public.board_member_role(board_id, auth.uid()) = 'admin');

-- Columns
CREATE TABLE public.columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "columns_select_member" ON public.columns FOR SELECT TO authenticated
  USING (public.is_board_member(board_id, auth.uid()));
CREATE POLICY "columns_insert_editor" ON public.columns FOR INSERT TO authenticated
  WITH CHECK (public.board_member_role(board_id, auth.uid()) IN ('admin','editor'));
CREATE POLICY "columns_update_editor" ON public.columns FOR UPDATE TO authenticated
  USING (public.board_member_role(board_id, auth.uid()) IN ('admin','editor'));
CREATE POLICY "columns_delete_editor" ON public.columns FOR DELETE TO authenticated
  USING (public.board_member_role(board_id, auth.uid()) IN ('admin','editor'));

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.task_board_id(_column_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT board_id FROM public.columns WHERE id = _column_id;
$$;

CREATE POLICY "tasks_select_member" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_board_member(public.task_board_id(column_id), auth.uid()));
CREATE POLICY "tasks_insert_editor" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.board_member_role(public.task_board_id(column_id), auth.uid()) IN ('admin','editor'));
CREATE POLICY "tasks_update_editor" ON public.tasks FOR UPDATE TO authenticated
  USING (public.board_member_role(public.task_board_id(column_id), auth.uid()) IN ('admin','editor'));
CREATE POLICY "tasks_delete_editor" ON public.tasks FOR DELETE TO authenticated
  USING (public.board_member_role(public.task_board_id(column_id), auth.uid()) IN ('admin','editor'));

-- updated_at trigger for tasks
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-add board owner as admin member
CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_board();

-- Realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.columns REPLICA IDENTITY FULL;
ALTER TABLE public.board_members REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_members;
