-- 清空 barrages 全部数据（测试串、超长、重复等），主键序列重置
-- 仅在确认需要「彻底清空」时于 Supabase SQL Editor 执行

TRUNCATE public.barrages RESTART IDENTITY;
