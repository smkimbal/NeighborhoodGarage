import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export async function database(){
 const db=await PGlite.create();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,instance_id uuid,aud text,role text,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',created_at timestamptz,updated_at timestamptz);
 create table auth.mfa_factors(id uuid primary key,user_id uuid,status text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth,storage to authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz not null default now());
 alter table storage.objects enable row level security;grant all on storage.objects to authenticated,service_role;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create publication supabase_realtime;`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
  const sql=(await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto;','');
  try{await db.exec(sql);}catch(error){await db.close();throw new Error('Migration '+file+': '+error.message,{cause:error});}
 }
 await db.exec('grant usage on schema public,private to service_role;grant all on all tables in schema public to service_role;');return db;
}
