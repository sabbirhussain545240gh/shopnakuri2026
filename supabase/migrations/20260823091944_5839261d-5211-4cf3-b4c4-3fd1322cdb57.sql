UPDATE public.profiles SET status = 'active' WHERE user_id = 'f91210a0-a440-480c-9619-bea9b8d8c75e';
INSERT INTO public.user_roles (user_id, role) VALUES ('f91210a0-a440-480c-9619-bea9b8d8c75e', 'admin') ON CONFLICT (user_id, role) DO NOTHING;
DELETE FROM public.user_roles WHERE user_id = 'f91210a0-a440-480c-9619-bea9b8d8c75e' AND role = 'member';