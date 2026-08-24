import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import themeConfig from "@/theme.config";

export async function GET(context: { site: URL }) {
  const posts = await getCollection("posts");
  const published = posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: themeConfig.siteName,
    description: themeConfig.sidebar?.description || "",
    site: context.site,
    items: published.map((post) => ({
      title: post.data.title,
      description: post.data.description || "",
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
    })),
  });
}
