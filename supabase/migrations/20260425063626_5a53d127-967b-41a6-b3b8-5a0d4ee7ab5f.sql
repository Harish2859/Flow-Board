DROP TRIGGER IF EXISTS on_board_created ON public.boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_board();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();