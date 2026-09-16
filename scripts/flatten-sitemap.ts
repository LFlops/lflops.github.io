/**
 * 构建后补一个 /sitemap.xml。
 *
 * @astrojs/sitemap 固定输出 sitemap-index.xml + sitemap-N.xml，不产出 /sitemap.xml，
 * 而 GSC 的默认提交路径正是 /sitemap.xml（目前线上返回 404）。这里补上：
 *   - 只有单个分片 → 摊平成扁平 urlset，省掉 index 这一层间接
 *   - 多个分片     → 把 index 原样放到 /sitemap.xml（index 放在任意路径都合法）
 */

const DIST = "dist";
const index = Bun.file(`${DIST}/sitemap-index.xml`);

if (!(await index.exists())) {
  console.log("[sitemap] 未找到 sitemap-index.xml，跳过");
} else {
  const xml = await index.text();
  const children = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // 只在单分片时摊平：多分片摊平会静默丢掉除第一片之外的所有 URL
  if (children.length === 1) {
    const name = children[0].split("/").pop()!;
    const child = Bun.file(`${DIST}/${name}`);

    if (await child.exists()) {
      await Bun.write(`${DIST}/sitemap.xml`, await child.text());
      console.log(`[sitemap] 已摊平 ${name} → sitemap.xml`);
    } else {
      await Bun.write(`${DIST}/sitemap.xml`, xml);
      console.warn(`[sitemap] 找不到 ${name}，回退为 index 格式`);
    }
  } else {
    await Bun.write(`${DIST}/sitemap.xml`, xml);
    console.log(`[sitemap] ${children.length} 个分片 → sitemap.xml（index 格式）`);
  }
}
