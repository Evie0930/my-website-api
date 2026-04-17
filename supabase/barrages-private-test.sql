-- 扩展 barrages：仅自己可见的「[测试]」弹幕 + API 按 viewer_token 过滤
-- 在 Supabase SQL Editor 中执行（在 barrages-rls-anon.sql 之后执行亦可）

ALTER TABLE public.barrages
  ADD COLUMN IF NOT EXISTS is_private_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewer_token text NULL;

COMMENT ON COLUMN public.barrages.is_private_test IS 'true：以 [测试] 发送，仅同 viewer_token 可见';
COMMENT ON COLUMN public.barrages.viewer_token IS '浏览器持久化 UUID；与 is_private_test 配对';

CREATE INDEX IF NOT EXISTS idx_barrages_private_viewer
  ON public.barrages (is_private_test, viewer_token)
  WHERE is_private_test = true;

-- 已有 GRANT SELECT, INSERT 仍覆盖新列；RLS 策略 USING (true) 仍适用
