import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const projectRoot = process.cwd();
        const contentDir = path.join(projectRoot, 'src/content/gallery');

        const files = await fs.readdir(contentDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const items = await Promise.all(mdFiles.map(async (file) => {
            const slug = file.replace('.md', '');
            const content = await fs.readFile(path.join(contentDir, file), 'utf-8');

            // Simple frontmatter parsing
            const titleMatch = content.match(/title:\s*"([^"]+)"/);
            const authorMatch = content.match(/author:\s*"([^"]+)"/);
            const imageMatch = content.match(/image:\s*"([^"]+)"/);
            const urlMatch = content.match(/originalUrl:\s*"([^"]+)"/);

            // Build GitHub raw URL for production preview
            const GITHUB_OWNER = import.meta.env.GITHUB_OWNER || process.env.GITHUB_OWNER || '';
            const GITHUB_REPO = import.meta.env.GITHUB_REPO || process.env.GITHUB_REPO || '';
            const imageRaw = imageMatch ? imageMatch[1] : '';
            const imagePath = imageRaw.replace('../../assets/images/uploads/', '');
            const imageUrl = (GITHUB_OWNER && GITHUB_REPO && imagePath)
                ? `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/src/assets/images/uploads/${imagePath}`
                : '';

            return {
                slug,
                title: titleMatch ? titleMatch[1] : slug,
                author: authorMatch ? authorMatch[1] : 'Unknown',
                image: imageMatch ? imageMatch[1] : '',
                imageUrl, // GitHub raw URL for production
                originalUrl: urlMatch ? urlMatch[1] : '',
            };
        }));

        // Sort by filename (newest first, assuming timestamp in filename)
        items.sort((a, b) => b.slug.localeCompare(a.slug));

        return new Response(JSON.stringify({ items }), { status: 200 });

    } catch (error: unknown) {
        console.error('[list] Error:', error);
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
};
