-- Migração 1: Adicionar novos valores ao enum app_role
-- NOTA: Esses valores precisam ser commitados antes de usar nas funções
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bpo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suporte';