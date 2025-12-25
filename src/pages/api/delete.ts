import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const { slug } = await request.json();

        if (!slug) {
            return new Response(JSON.stringify({ message: 'Slug is required' }), { status: 400 });
        }

        // Sanitize slug to prevent directory traversal
        const sanitizedSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');

        if (sanitizedSlug !== slug) {
            return new Response(JSON.stringify({ message: 'Invalid slug' }), { status: 400 });
        }

        const projectRoot = process.cwd();
        const mdPath = path.join(projectRoot, 'src/content/gallery', `${sanitizedSlug}.md`);
        const jpgPath = path.join(projectRoot, 'src/assets/images/uploads', `${sanitizedSlug}.jpg`);
        const pngPath = path.join(projectRoot, 'src/assets/images/uploads', `${sanitizedSlug}.png`);

        // Delete markdown file
        try {
            await fs.unlink(mdPath);
            console.log('[delete] Deleted:', mdPath);
        } catch (e) {
            console.log('[delete] MD file not found:', mdPath);
        }

        // Delete image file (try both jpg and png)
        try {
            await fs.unlink(jpgPath);
            console.log('[delete] Deleted:', jpgPath);
        } catch (e) {
            try {
                await fs.unlink(pngPath);
                console.log('[delete] Deleted:', pngPath);
            } catch (e2) {
                console.log('[delete] Image file not found');
            }
        }

        // Clear Astro's content cache to prevent stale references
        const astroCachePath = path.join(projectRoot, '.astro');
        try {
            await fs.rm(astroCachePath, { recursive: true, force: true });
            console.log('[delete] Cleared Astro cache');
        } catch (e) {
            console.log('[delete] No Astro cache to clear');
        }

        return new Response(JSON.stringify({ message: 'Deleted successfully' }), { status: 200 });

    } catch (error: unknown) {
        console.error('[delete] Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ message: 'Error deleting item', error: errorMessage }), { status: 500 });
    }
};
