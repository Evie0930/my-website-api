-- barrages：与项目 API 字段对齐（见 api/barrages.js、api/message.js）
--   列：id（主键/序列）, content（文本）, created_at（默认 now()）
--   扩展列（见 barrages-private-test.sql）：is_private_test, viewer_token（[测试] 仅自己可见）
--   服务端用 anon key（SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY）查询与插入，RLS 生效；勿用 service_role 若需验证策略。
-- 在 Supabase SQL Editor 中整段执行；可按需调整策略名称。

-- 1) 表级权限（RLS 仍生效，需下方策略放行）
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.barrages TO anon, authenticated;

-- SERIAL / identity 主键插入需要序列使用权
GRANT USAGE, SELECT ON SEQUENCE public.barrages_id_seq TO anon, authenticated;

-- 2) RLS
ALTER TABLE public.barrages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.barrages;
DROP POLICY IF EXISTS "Allow public insert" ON public.barrages;
DROP POLICY IF EXISTS "Allow anon select barrages" ON public.barrages;
DROP POLICY IF EXISTS "Allow anon insert barrages" ON public.barrages;

-- 匿名与会话用户可读全部行（如需仅读自己的，可改 USING）
CREATE POLICY "Allow anon select barrages"
  ON public.barrages
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon insert barrages"
  ON public.barrages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 说明：若仍 403 / permission denied，多为 GRANT 未执行、策略未创建，或客户端用了 service_role（会绕过 RLS，与本地 anon 行为不一致）。
-- 若你仍使用旧表 messages，可取消注释并执行：
-- GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- （再按需 DROP/CREATE 对应 POLICY）
