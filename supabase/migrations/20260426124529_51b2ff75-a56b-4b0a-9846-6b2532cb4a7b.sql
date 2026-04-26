UPDATE auth.users
SET encrypted_password = crypt('aline123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'alinerabbib79@gmail.com';